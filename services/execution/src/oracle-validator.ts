/**
 * @file oracle-validator.ts
 * @description Validador de precios con múltiples oráculos (Pyth, Chainlink, Band)
 * 
 * ARBITRAGEXPLUS2025 - Multi-Oracle Validator
 * 
 * Valida precios consultando múltiples oráculos y aplicando lógica de consenso.
 * Requiere confirmación de al menos N oráculos antes de aprobar una operación.
 */

import { ethers } from 'ethers';
import axios from 'axios';
import { Logger } from './logger';

// ==================================================================================
// TIPOS
// ==================================================================================

export interface OraclePrice {
  oracle: string;
  price: string;
  timestamp: number;
  confidence: number;
}

export interface PriceValidationResult {
  valid: boolean;
  prices: OraclePrice[];
  averagePrice: string;
  priceDeviation: number;
  reason?: string;
}

export interface OracleValidatorConfig {
  minConfirmations: number;
  maxPriceDeviationBps: number;
  pythEndpoint?: string;
  chainlinkContracts?: Map<number, Map<string, string>>;
  bandContracts?: Map<number, string>;
}

// ==================================================================================
// CLASE PRINCIPAL
// ==================================================================================

export class OracleValidator {
  private config: OracleValidatorConfig;
  private logger: Logger;
  
  // Providers por chain
  private providers: Map<number, ethers.providers.JsonRpcProvider>;
  
  // Contratos Chainlink por chain y token
  private chainlinkFeeds: Map<number, Map<string, ethers.Contract>>;
  
  // Contratos Band por chain
  private bandRefs: Map<number, ethers.Contract>;
  
  constructor(config: Partial<OracleValidatorConfig> = {}) {
    this.config = {
      minConfirmations: config.minConfirmations || 2,
      maxPriceDeviationBps: config.maxPriceDeviationBps || 200, // 2%
      pythEndpoint: config.pythEndpoint || 'https://hermes.pyth.network',
      chainlinkContracts: config.chainlinkContracts || new Map(),
      bandContracts: config.bandContracts || new Map(),
    };
    
    this.logger = new Logger('OracleValidator');
    this.providers = new Map();
    this.chainlinkFeeds = new Map();
    this.bandRefs = new Map();
  }
  
  /**
   * Inicializa el validador
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing OracleValidator...');
    
    // Aquí se cargarían las configuraciones de oráculos desde Sheets o env
    // Por ahora, inicialización básica
    
    this.logger.info('OracleValidator initialized');
  }
  
  /**
   * Valida precios consultando múltiples oráculos
   */
  async validatePrices(
    chainId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: string
  ): Promise<boolean> {
    this.logger.debug('Validating prices', {
      chainId,
      tokenIn,
      tokenOut,
      amountIn,
    });
    
    try {
      // Obtener precios de todos los oráculos
      const prices: OraclePrice[] = [];
      
      // 1. Pyth
      try {
        const pythPrice = await this.getPythPrice(tokenIn, tokenOut);
        if (pythPrice) {
          prices.push(pythPrice);
        }
      } catch (error) {
        this.logger.warn('Pyth price fetch failed', error);
      }
      
      // 2. Chainlink
      try {
        const chainlinkPrice = await this.getChainlinkPrice(chainId, tokenIn, tokenOut);
        if (chainlinkPrice) {
          prices.push(chainlinkPrice);
        }
      } catch (error) {
        this.logger.warn('Chainlink price fetch failed', error);
      }
      
      // 3. Band
      try {
        const bandPrice = await this.getBandPrice(chainId, tokenIn, tokenOut);
        if (bandPrice) {
          prices.push(bandPrice);
        }
      } catch (error) {
        this.logger.warn('Band price fetch failed', error);
      }
      
      // Validar que tengamos suficientes confirmaciones
      if (prices.length < this.config.minConfirmations) {
        this.logger.warn('Insufficient oracle confirmations', {
          required: this.config.minConfirmations,
          received: prices.length,
        });
        return false;
      }
      
      // Calcular precio promedio
      const avgPrice = this.calculateAveragePrice(prices);
      
      // Verificar desviación de precios
      const deviation = this.calculatePriceDeviation(prices, avgPrice);
      
      if (deviation > this.config.maxPriceDeviationBps) {
        this.logger.warn('Price deviation too high', {
          deviation,
          maxAllowed: this.config.maxPriceDeviationBps,
        });
        return false;
      }
      
      this.logger.debug('Price validation successful', {
        prices: prices.length,
        avgPrice,
        deviation,
      });
      
      return true;
    } catch (error) {
      this.logger.error('Price validation failed', error);
      return false;
    }
  }
  
  /**
   * Obtiene precio desde Pyth Network
   */
  private async getPythPrice(tokenIn: string, tokenOut: string): Promise<OraclePrice | null> {
    try {
      // Mapear tokens a price feed IDs de Pyth
      const feedId = this.getPythFeedId(tokenIn, tokenOut);
      if (!feedId) {
        return null;
      }
      
      const response = await axios.get(
        `${this.config.pythEndpoint}/api/latest_price_feeds`,
        {
          params: {
            ids: [feedId],
          },
          timeout: 5000,
        }
      );
      
      if (!response.data || response.data.length === 0) {
        return null;
      }
      
      const priceData = response.data[0];
      const price = priceData.price.price;
      const expo = priceData.price.expo;
      const conf = priceData.price.conf;
      
      // Convertir a precio con 18 decimales
      const normalizedPrice = ethers.BigNumber.from(price)
        .mul(ethers.BigNumber.from(10).pow(18 + expo));
      
      // Calcular confidence (menor conf = mayor confianza)
      const confidence = 100 - Math.min(100, (conf / price) * 100);
      
      return {
        oracle: 'Pyth',
        price: normalizedPrice.toString(),
        timestamp: Date.now(),
        confidence,
      };
    } catch (error) {
      this.logger.debug('Pyth price fetch error', error);
      return null;
    }
  }
  
  /**
   * Obtiene precio desde Chainlink
   */
  private async getChainlinkPrice(
    chainId: number,
    tokenIn: string,
    tokenOut: string
  ): Promise<OraclePrice | null> {
    try {
      const feeds = this.chainlinkFeeds.get(chainId);
      if (!feeds) {
        return null;
      }
      
      const feedAddress = this.getChainlinkFeedAddress(tokenIn, tokenOut);
      if (!feedAddress) {
        return null;
      }
      
      const feed = feeds.get(feedAddress);
      if (!feed) {
        return null;
      }
      
      const [roundId, answer, , updatedAt, answeredInRound] = await feed.latestRoundData();
      
      // Validar que la respuesta sea válida
      if (answer.lte(0) || answeredInRound.lt(roundId)) {
        return null;
      }
      
      // Obtener decimales del feed
      const decimals = await feed.decimals();
      
      // Convertir a 18 decimales
      const normalizedPrice = answer.mul(
        ethers.BigNumber.from(10).pow(18 - decimals)
      );
      
      // Calcular confidence basado en frescura
      const age = Date.now() / 1000 - updatedAt.toNumber();
      const confidence = Math.max(0, 100 - (age / 3600) * 10); // Decrece 10% por hora
      
      return {
        oracle: 'Chainlink',
        price: normalizedPrice.toString(),
        timestamp: updatedAt.toNumber() * 1000,
        confidence,
      };
    } catch (error) {
      this.logger.debug('Chainlink price fetch error', error);
      return null;
    }
  }
  
  /**
   * Obtiene precio desde Band Protocol
   */
  private async getBandPrice(
    chainId: number,
    tokenIn: string,
    tokenOut: string
  ): Promise<OraclePrice | null> {
    try {
      const bandRef = this.bandRefs.get(chainId);
      if (!bandRef) {
        return null;
      }
      
      const symbol = this.getBandSymbol(tokenIn);
      if (!symbol) {
        return null;
      }
      
      const refData = await bandRef.getReferenceData(symbol, 'USD');
      
      if (!refData || refData.rate.lte(0)) {
        return null;
      }
      
      // Band retorna precios con 18 decimales
      const price = refData.rate;
      
      // Calcular confidence basado en frescura
      const age = Date.now() / 1000 - refData.lastUpdatedBase.toNumber();
      const confidence = Math.max(0, 100 - (age / 3600) * 10);
      
      return {
        oracle: 'Band',
        price: price.toString(),
        timestamp: refData.lastUpdatedBase.toNumber() * 1000,
        confidence,
      };
    } catch (error) {
      this.logger.debug('Band price fetch error', error);
      return null;
    }
  }
  
  /**
   * Calcula el precio promedio ponderado por confidence
   */
  private calculateAveragePrice(prices: OraclePrice[]): ethers.BigNumber {
    let totalWeightedPrice = ethers.BigNumber.from(0);
    let totalWeight = 0;
    
    for (const p of prices) {
      const price = ethers.BigNumber.from(p.price);
      const weight = p.confidence;
      
      totalWeightedPrice = totalWeightedPrice.add(price.mul(Math.floor(weight)));
      totalWeight += weight;
    }
    
    if (totalWeight === 0) {
      return ethers.BigNumber.from(0);
    }
    
    return totalWeightedPrice.div(Math.floor(totalWeight));
  }
  
  /**
   * Calcula la desviación de precios en basis points
   */
  private calculatePriceDeviation(
    prices: OraclePrice[],
    avgPrice: ethers.BigNumber
  ): number {
    if (prices.length === 0 || avgPrice.eq(0)) {
      return 0;
    }
    
    let maxDeviation = 0;
    
    for (const p of prices) {
      const price = ethers.BigNumber.from(p.price);
      const diff = price.sub(avgPrice).abs();
      const deviationBps = diff.mul(10000).div(avgPrice).toNumber();
      
      if (deviationBps > maxDeviation) {
        maxDeviation = deviationBps;
      }
    }
    
    return maxDeviation;
  }
  
  /**
   * Mapea token a Pyth feed ID
   */
  private getPythFeedId(tokenIn: string, tokenOut: string): string | null {
    // Mapeo simplificado - en producción cargar desde configuración
    const feedIds: Record<string, string> = {
      // Ethereum mainnet
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH/USD
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a', // USDC/USD
      '0xdAC17F958D2ee523a2206206994597C13D831ec7': '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b', // USDT/USD
    };
    
    return feedIds[tokenIn.toLowerCase()] || null;
  }
  
  /**
   * Obtiene dirección del feed de Chainlink
   */
  private getChainlinkFeedAddress(tokenIn: string, tokenOut: string): string | null {
    // Mapeo simplificado - en producción cargar desde configuración
    const feeds: Record<string, string> = {
      // Ethereum mainnet
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', // USDC/USD
    };
    
    return feeds[tokenIn.toLowerCase()] || null;
  }
  
  /**
   * Obtiene símbolo de Band Protocol
   */
  private getBandSymbol(token: string): string | null {
    // Mapeo simplificado - en producción cargar desde configuración
    const symbols: Record<string, string> = {
      '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2': 'ETH',
      '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599': 'BTC',
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 'USDC',
    };
    
    return symbols[token.toLowerCase()] || null;
  }
}

