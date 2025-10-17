/**
 * OracleValidator.ts
 * 
 * Validación de precios usando oráculos Pyth y Chainlink
 * Previene ejecución de arbitrajes con precios obsoletos o incorrectos
 * 
 * @author ARBITRAGEXPLUS2025
 */

import { ethers, BigNumber, providers } from 'ethers';

export interface PriceData {
  token: string;
  price: number;
  confidence: number;
  timestamp: number;
  source: 'pyth' | 'chainlink' | 'fallback';
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  prices?: Record<string, PriceData>;
}

export class OracleValidator {
  private provider: providers.Provider;
  private pythContract?: ethers.Contract;
  private chainlinkFeeds: Map<string, string> = new Map();
  
  // Pyth Network contract addresses
  private readonly PYTH_MAINNET = '0x4305FB66699C3B2702D4d05CF36551390A4c69C6';
  private readonly PYTH_POLYGON = '0xff1a0f4744e8582DF1aE09D5611b887B6a12925C';
  private readonly PYTH_ARBITRUM = '0xff1a0f4744e8582DF1aE09D5611b887B6a12925C';
  
  // Chainlink price feed addresses (Ethereum Mainnet examples)
  private readonly CHAINLINK_FEEDS: Record<string, string> = {
    'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
    'USDC/USD': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    'USDT/USD': '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
    'DAI/USD': '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9'
  };
  
  // Configuración
  private maxStaleness: number = 60; // 60 segundos
  private minConfidence: number = 0.95; // 95% de confianza mínima
  
  constructor(provider: providers.Provider) {
    this.provider = provider;
    this.initializePyth();
    this.initializeChainlink();
  }
  
  private async initializePyth(): Promise<void> {
    try {
      const network = await this.provider.getNetwork();
      let pythAddress: string;
      
      switch (network.chainId) {
        case 1: // Ethereum Mainnet
          pythAddress = this.PYTH_MAINNET;
          break;
        case 137: // Polygon
          pythAddress = this.PYTH_POLYGON;
          break;
        case 42161: // Arbitrum
          pythAddress = this.PYTH_ARBITRUM;
          break;
        default:
          console.warn(`Pyth not configured for chain ${network.chainId}`);
          return;
      }
      
      this.pythContract = new ethers.Contract(
        pythAddress,
        [
          'function getPrice(bytes32 id) view returns (int64 price, uint64 conf, int32 expo, uint publishTime)',
          'function getPriceUnsafe(bytes32 id) view returns (int64 price, uint64 conf, int32 expo, uint publishTime)'
        ],
        this.provider
      );
      
      console.log(`✅ Pyth oracle initialized at ${pythAddress}`);
    } catch (error) {
      console.error('Failed to initialize Pyth:', error);
    }
  }
  
  private initializeChainlink(): void {
    // Inicializar feeds de Chainlink
    for (const [pair, address] of Object.entries(this.CHAINLINK_FEEDS)) {
      this.chainlinkFeeds.set(pair, address);
    }
    console.log(`✅ Chainlink feeds initialized (${this.chainlinkFeeds.size} feeds)`);
  }
  
  /**
   * Valida precios de una lista de tokens
   */
  async validatePrices(tokens: string[]): Promise<ValidationResult> {
    try {
      const prices: Record<string, PriceData> = {};
      
      // Obtener precios de todos los tokens
      for (const token of tokens) {
        const priceData = await this.getTokenPrice(token);
        if (!priceData) {
          return {
            isValid: false,
            reason: `Failed to get price for token ${token}`
          };
        }
        
        // Verificar staleness
        const age = Date.now() / 1000 - priceData.timestamp;
        if (age > this.maxStaleness) {
          return {
            isValid: false,
            reason: `Price for ${token} is stale (${age}s old)`
          };
        }
        
        // Verificar confianza
        if (priceData.confidence < this.minConfidence) {
          return {
            isValid: false,
            reason: `Price for ${token} has low confidence (${priceData.confidence})`
          };
        }
        
        prices[token] = priceData;
      }
      
      return {
        isValid: true,
        prices
      };
      
    } catch (error) {
      return {
        isValid: false,
        reason: `Oracle validation error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Obtiene el precio de un token desde oráculos
   */
  async getTokenPrice(token: string): Promise<PriceData | null> {
    // Intentar Pyth primero
    if (this.pythContract) {
      const pythPrice = await this.getPriceFromPyth(token);
      if (pythPrice) {
        return pythPrice;
      }
    }
    
    // Fallback a Chainlink
    const chainlinkPrice = await this.getPriceFromChainlink(token);
    if (chainlinkPrice) {
      return chainlinkPrice;
    }
    
    // Fallback a precio on-chain (simplificado)
    return this.getPriceFromDEX(token);
  }
  
  /**
   * Obtiene precio desde Pyth Network
   */
  private async getPriceFromPyth(token: string): Promise<PriceData | null> {
    if (!this.pythContract) {
      return null;
    }
    
    try {
      // Obtener price feed ID para el token
      // En producción, esto vendría de Google Sheets (ASSETS.PYTH_PRICE_FEED_ID)
      const priceFeedId = this.getPythFeedId(token);
      if (!priceFeedId) {
        return null;
      }
      
      const priceData = await this.pythContract.getPrice(priceFeedId);
      
      // Convertir a formato decimal
      const price = parseFloat(priceData.price.toString()) * Math.pow(10, priceData.expo);
      const confidence = parseFloat(priceData.conf.toString()) * Math.pow(10, priceData.expo);
      const confidenceRatio = 1 - (confidence / price);
      
      return {
        token,
        price,
        confidence: confidenceRatio,
        timestamp: priceData.publishTime,
        source: 'pyth'
      };
    } catch (error) {
      console.warn(`Failed to get Pyth price for ${token}:`, error);
      return null;
    }
  }
  
  /**
   * Obtiene precio desde Chainlink
   */
  private async getPriceFromChainlink(token: string): Promise<PriceData | null> {
    try {
      // Obtener feed address
      const feedAddress = this.getChainlinkFeed(token);
      if (!feedAddress) {
        return null;
      }
      
      const feedContract = new ethers.Contract(
        feedAddress,
        [
          'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
          'function decimals() view returns (uint8)'
        ],
        this.provider
      );
      
      const [roundData, decimals] = await Promise.all([
        feedContract.latestRoundData(),
        feedContract.decimals()
      ]);
      
      const price = parseFloat(roundData.answer.toString()) / Math.pow(10, decimals);
      
      return {
        token,
        price,
        confidence: 1.0, // Chainlink tiene alta confianza
        timestamp: roundData.updatedAt.toNumber(),
        source: 'chainlink'
      };
    } catch (error) {
      console.warn(`Failed to get Chainlink price for ${token}:`, error);
      return null;
    }
  }
  
  /**
   * Obtiene precio desde DEX (fallback)
   */
  private async getPriceFromDEX(token: string): Promise<PriceData | null> {
    // Implementación simplificada
    // En producción, consultar reserves de Uniswap/SushiSwap
    console.warn(`Using fallback price for ${token}`);
    return {
      token,
      price: 0,
      confidence: 0.5,
      timestamp: Math.floor(Date.now() / 1000),
      source: 'fallback'
    };
  }
  
  /**
   * Obtiene el Pyth price feed ID para un token
   */
  private getPythFeedId(token: string): string | null {
    // En producción, esto vendría de Google Sheets
    // Mapeo simplificado para ejemplos
    const feedIds: Record<string, string> = {
      'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      'BTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      'USDC': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
      'USDT': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b'
    };
    
    return feedIds[token] || null;
  }
  
  /**
   * Obtiene el Chainlink feed address para un token
   */
  private getChainlinkFeed(token: string): string | null {
    const pair = `${token}/USD`;
    return this.chainlinkFeeds.get(pair) || null;
  }
  
  /**
   * Configura parámetros de validación
   */
  setValidationParams(maxStaleness?: number, minConfidence?: number): void {
    if (maxStaleness !== undefined) {
      this.maxStaleness = maxStaleness;
    }
    if (minConfidence !== undefined) {
      this.minConfidence = minConfidence;
    }
  }
}

