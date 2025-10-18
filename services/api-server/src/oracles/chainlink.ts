/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/oracles/chainlink.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ethers, ../lib/errors, ../lib/logger
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: ChainlinkOracle
 *   FUNCIONES: version, description, decimals
 *   INTERFACES: AssetConfig, ChainlinkPriceData, PriceValidationResult
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: ChainlinkOracle
 * 
 * 🔗 DEPENDENCIAS:
 *   - ethers
 *   - ../lib/errors
 *   - ../lib/logger
 * 
 * ============================================================================
 */

/**
 * ARBITRAGEXPLUS2025 - Chainlink Oracle
 * 
 * Cliente para Chainlink Price Feeds que funciona como fuente secundaria
 * de validación de precios. Chainlink proporciona precios descentralizados
 * y confiables para validar oportunidades de arbitraje.
 * 
 * Funcionalidades:
 * - Obtener precios desde Chainlink Price Feeds
 * - Validar precios contra Pyth para detección de anomalías
 * - Soportar múltiples chains
 * - Configuración dinámica desde Google Sheets
 * - Fallback cuando Pyth no está disponible
 */

import { ethers } from 'ethers';
import { Logger } from '../lib/logger';
import { ApiError } from '../lib/errors';

// ==================================================================================
// TYPES & INTERFACES
// ==================================================================================

interface ChainlinkPriceData {
  symbol: string;
  price: number;
  decimals: number;
  roundId: string;
  updatedAt: number;
  answeredInRound: string;
  feedAddress: string;
}

interface PriceValidationResult {
  isValid: boolean;
  confidence: number;
  priceAge: number;
  reason?: string;
}

interface AssetConfig {
  symbol: string;
  chainId: number;
  chainlinkFeedAddress?: string;
  decimals: number;
}

// ==================================================================================
// CHAINLINK ORACLE CLASS
// ==================================================================================

export class ChainlinkOracle {
  private logger: Logger;
  private assets: AssetConfig[] = [];
  private providers: Map<number, ethers.providers.Provider> = new Map();
  private priceCache: Map<string, ChainlinkPriceData> = new Map();
  private cacheTimeout: number = 10000; // 10 segundos para precios de Chainlink

  // ABI mínimo para Chainlink Price Feed
  private readonly AGGREGATOR_V3_ABI = [
    'function decimals() external view returns (uint8)',
    'function description() external view returns (string memory)',
    'function version() external view returns (uint256)',
    'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  ];

  // RPC URLs por chain (configurables desde env)
  private readonly DEFAULT_RPC_URLS: { [chainId: number]: string } = {
    1: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    56: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
    137: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    10: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    43114: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
  };

  constructor(assets: AssetConfig[] = []) {
    this.logger = new Logger('ChainlinkOracle');
    this.assets = assets;
    this.initializeProviders();
  }

  // ================================================================================
  // INITIALIZATION
  // ================================================================================

  /**
   * Inicializar providers para cada chain
   */
  private initializeProviders(): void {
    try {
      this.logger.info('🔗 Inicializando providers Chainlink...');

      // Obtener chains únicas de los assets
      const uniqueChains = [...new Set(this.assets.map(a => a.chainId))];

      for (const chainId of uniqueChains) {
        const rpcUrl = this.DEFAULT_RPC_URLS[chainId];
        
        if (!rpcUrl) {
          this.logger.warn(`⚠️ No RPC URL configurado para chain ${chainId}`);
          continue;
        }

        const provider = new ethers.providers.JsonRpcProvider(rpcUrl, chainId);
        this.providers.set(chainId, provider);
        
        this.logger.info(`✅ Provider inicializado para chain ${chainId}`);
      }

      this.logger.info(`✅ ${this.providers.size} providers Chainlink inicializados`);

    } catch (error) {
      this.logger.error('❌ Error inicializando providers Chainlink:', error);
      throw new ApiError('Failed to initialize Chainlink providers', 500);
    }
  }

  /**
   * Actualizar configuración de assets
   */
  async updateAssetConfiguration(assets: AssetConfig[]): Promise<void> {
    this.assets = assets;
    this.initializeProviders();
    this.clearPriceCache();
    
    this.logger.info(`🔄 Configuración actualizada: ${assets.length} assets`);
  }

  // ================================================================================
  // PRICE FETCHING
  // ================================================================================

  /**
   * Obtener precio de un asset específico
   */
  async getPrice(symbol: string, chainId?: number): Promise<ChainlinkPriceData | null> {
    try {
      // Buscar asset en configuración
      const asset = chainId 
        ? this.assets.find(a => a.symbol === symbol && a.chainId === chainId)
        : this.assets.find(a => a.symbol === symbol);

      if (!asset) {
        this.logger.warn(`⚠️ Asset ${symbol} no encontrado en configuración`);
        return null;
      }

      if (!asset.chainlinkFeedAddress) {
        this.logger.warn(`⚠️ Asset ${symbol} no tiene Chainlink feed configurado`);
        return null;
      }

      // Verificar cache
      const cacheKey = `${symbol}-${asset.chainId}`;
      const cached = this.getCachedPrice(cacheKey);
      if (cached) {
        return cached;
      }

      // Obtener provider para la chain
      const provider = this.providers.get(asset.chainId);
      if (!provider) {
        this.logger.error(`❌ No provider disponible para chain ${asset.chainId}`);
        return null;
      }

      // Crear contrato del price feed
      const priceFeed = new ethers.Contract(
        asset.chainlinkFeedAddress,
        this.AGGREGATOR_V3_ABI,
        provider
      );

      // Obtener datos del último round
      const roundData = await priceFeed.latestRoundData();

      // Formatear precio
      const decimals = await priceFeed.decimals();
      const price = parseFloat(ethers.utils.formatUnits(roundData.answer, decimals));

      const priceData: ChainlinkPriceData = {
        symbol: asset.symbol,
        price,
        decimals,
        roundId: roundData.roundId.toString(),
        updatedAt: roundData.updatedAt.toNumber(),
        answeredInRound: roundData.answeredInRound.toString(),
        feedAddress: asset.chainlinkFeedAddress,
      };

      // Guardar en cache
      this.setCachedPrice(cacheKey, priceData);

      return priceData;

    } catch (error) {
      this.logger.error(`❌ Error obteniendo precio de ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Obtener precios de múltiples assets
   */
  async getPrices(symbols?: string[]): Promise<ChainlinkPriceData[]> {
    try {
      const targetSymbols = symbols || this.assets.map(a => a.symbol);
      const prices: ChainlinkPriceData[] = [];

      // Obtener precios en paralelo
      const pricePromises = targetSymbols.map(symbol =>
        this.getPrice(symbol).catch(error => {
          this.logger.error(`Error obteniendo precio de ${symbol}:`, error);
          return null;
        })
      );

      const results = await Promise.all(pricePromises);

      // Filtrar resultados válidos
      for (const result of results) {
        if (result) {
          prices.push(result);
        }
      }

      return prices;

    } catch (error) {
      this.logger.error('❌ Error obteniendo precios de Chainlink:', error);
      throw new ApiError('Failed to fetch prices from Chainlink', 500);
    }
  }

  /**
   * Obtener precio con fallback a múltiples feeds
   */
  async getPriceWithFallback(symbol: string): Promise<ChainlinkPriceData | null> {
    // Intentar obtener precio de todas las chains donde esté configurado
    const assetsForSymbol = this.assets.filter(a => a.symbol === symbol && a.chainlinkFeedAddress);

    for (const asset of assetsForSymbol) {
      try {
        const price = await this.getPrice(symbol, asset.chainId);
        if (price) {
          return price;
        }
      } catch (error) {
        this.logger.warn(`⚠️ Fallback: Error obteniendo precio de ${symbol} en chain ${asset.chainId}`);
        continue;
      }
    }

    return null;
  }

  // ================================================================================
  // PRICE VALIDATION
  // ================================================================================

  /**
   * Validar precio para una transacción
   */
  async validatePrice(
    symbol: string,
    expectedPrice: number,
    maxDriftBps: number = 100
  ): Promise<PriceValidationResult> {
    try {
      const priceData = await this.getPriceWithFallback(symbol);
      
      if (!priceData) {
        return {
          isValid: false,
          confidence: 0,
          priceAge: 0,
          reason: `No price data available for ${symbol}`,
        };
      }

      // Calcular edad del precio
      const now = Math.floor(Date.now() / 1000);
      const priceAge = now - priceData.updatedAt;

      // Precio demasiado viejo (más de 1 hora)
      if (priceAge > 3600) {
        return {
          isValid: false,
          confidence: 0,
          priceAge,
          reason: `Price too old: ${(priceAge / 60).toFixed(1)} minutes`,
        };
      }

      // Calcular drift del precio esperado
      const priceDrift = Math.abs(priceData.price - expectedPrice) / expectedPrice;
      const driftBps = priceDrift * 10000;

      // Precio fuera del rango aceptable
      if (driftBps > maxDriftBps) {
        return {
          isValid: false,
          confidence: 1.0, // Chainlink tiene alta confianza
          priceAge,
          reason: `Price drift too high: ${driftBps.toFixed(1)} bps (max: ${maxDriftBps})`,
        };
      }

      return {
        isValid: true,
        confidence: 1.0,
        priceAge,
      };

    } catch (error) {
      this.logger.error(`❌ Error validando precio de ${symbol}:`, error);
      return {
        isValid: false,
        confidence: 0,
        priceAge: 0,
        reason: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Comparar precio de Chainlink con Pyth para detectar anomalías
   */
  async comparePriceWithPyth(
    symbol: string,
    pythPrice: number,
    maxDivergenceBps: number = 200
  ): Promise<{ isValid: boolean; divergenceBps: number; reason?: string }> {
    try {
      const chainlinkPrice = await this.getPriceWithFallback(symbol);

      if (!chainlinkPrice) {
        return {
          isValid: false,
          divergenceBps: 0,
          reason: 'Chainlink price not available',
        };
      }

      // Calcular divergencia
      const divergence = Math.abs(chainlinkPrice.price - pythPrice) / pythPrice;
      const divergenceBps = divergence * 10000;

      if (divergenceBps > maxDivergenceBps) {
        return {
          isValid: false,
          divergenceBps,
          reason: `Price divergence too high: ${divergenceBps.toFixed(1)} bps (Chainlink: $${chainlinkPrice.price.toFixed(2)}, Pyth: $${pythPrice.toFixed(2)})`,
        };
      }

      return {
        isValid: true,
        divergenceBps,
      };

    } catch (error) {
      this.logger.error(`❌ Error comparando precios:`, error);
      return {
        isValid: false,
        divergenceBps: 0,
        reason: `Comparison error: ${error.message}`,
      };
    }
  }

  // ================================================================================
  // CACHE MANAGEMENT
  // ================================================================================

  /**
   * Obtener precio del cache
   */
  private getCachedPrice(cacheKey: string): ChainlinkPriceData | null {
    const cached = this.priceCache.get(cacheKey);
    
    if (!cached) {
      return null;
    }

    // Verificar si el cache expiró
    const now = Date.now();
    const cacheAge = now - (cached.updatedAt * 1000);

    if (cacheAge > this.cacheTimeout) {
      this.priceCache.delete(cacheKey);
      return null;
    }

    return cached;
  }

  /**
   * Guardar precio en cache
   */
  private setCachedPrice(cacheKey: string, priceData: ChainlinkPriceData): void {
    this.priceCache.set(cacheKey, priceData);
  }

  /**
   * Limpiar cache de precios
   */
  clearPriceCache(): void {
    this.priceCache.clear();
    this.logger.info('🗑️ Cache de precios limpiado');
  }

  // ================================================================================
  // UTILITIES
  // ================================================================================

  /**
   * Obtener estadísticas del oráculo
   */
  getStats() {
    return {
      assetsConfigured: this.assets.length,
      chainsSupported: this.providers.size,
      cachedPrices: this.priceCache.size,
      cacheTimeout: this.cacheTimeout,
    };
  }

  /**
   * Verificar salud del oráculo
   */
  async healthCheck(): Promise<{ isHealthy: boolean; details: any }> {
    try {
      const details: any = {
        providers: {},
        samplePrices: [],
      };

      // Verificar conectividad de providers
      for (const [chainId, provider] of this.providers.entries()) {
        try {
          const blockNumber = await provider.getBlockNumber();
          details.providers[chainId] = {
            isHealthy: true,
            blockNumber,
          };
        } catch (error) {
          details.providers[chainId] = {
            isHealthy: false,
            error: error.message,
          };
        }
      }

      // Intentar obtener algunos precios de muestra
      const sampleSymbols = this.assets.slice(0, 3).map(a => a.symbol);
      const samplePrices = await this.getPrices(sampleSymbols);
      details.samplePrices = samplePrices;

      const isHealthy = Object.values(details.providers).some((p: any) => p.isHealthy);

      return {
        isHealthy,
        details,
      };

    } catch (error) {
      this.logger.error('❌ Error en health check:', error);
      return {
        isHealthy: false,
        details: { error: error.message },
      };
    }
  }
}

export default ChainlinkOracle;

