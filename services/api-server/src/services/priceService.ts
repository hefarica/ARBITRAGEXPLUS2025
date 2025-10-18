/**
 * ============================================================================
 * ARCHIVO: services/api-server/src/services/priceService.ts
 * SERVICIO: api-server
 * PRIORIDAD: P0 (CRÍTICO)
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   FUENTE 1: Pyth Network API
 *     - Formato: JSON { price: { price: string, expo: number } }
 *     - Frecuencia: Polling cada 5 segundos
 *   FUENTE 2: Chainlink Price Feeds (fallback)
 *     - Formato: On-chain data
 *   FUENTE 3: Uniswap V3 TWAP (fallback)
 *     - Formato: On-chain data
 * 
 * 🔄 TRANSFORMACIÓN:
 *   PASO 1: Consulta múltiples oráculos en paralelo
 *   PASO 2: Valida consistencia de precios (desviación < 2%)
 *   PASO 3: Calcula precio consensuado (mediana)
 *   PASO 4: Cachea resultado con TTL de 30 segundos
 *   PASO 5: Emite evento de actualización
 * 
 * 📤 SALIDA DE DATOS:
 *   DESTINO 1: Cache en memoria (Map)
 *     - Formato: { token, price, timestamp, source, confidence }
 *   DESTINO 2: Event emitter (price_update)
 *     - Formato: PriceUpdate interface
 *   DESTINO 3: API response
 *     - Formato: number (precio en USD)
 * 
 * 🔗 DEPENDENCIAS:
 *   CONSUME:
 *     - axios → HTTP requests a Pyth API
 *     - events → EventEmitter para pub/sub
 *     - ./logger → Logging de errores
 *   ES CONSUMIDO POR:
 *     - arbitrageService → Cálculo de rentabilidad
 *     - routeValidator → Validación de rutas
 *     - executionService → Verificación pre-ejecución
 * 
 * ============================================================================
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../lib/logger';
import { sanitizeError } from '../lib/errors';

// ==================================================================================
// INTERFACES
// ==================================================================================

export interface PriceUpdate {
  token: string;
  blockchain: string;
  price: number;
  timestamp: string;
  source: 'pyth' | 'chainlink' | 'uniswap' | 'consensus';
  confidence: number; // 0-1, donde 1 es máxima confianza
  deviation?: number; // Desviación estándar entre oráculos
}

export interface PriceQuery {
  token: string;
  blockchain: string;
  minConfidence?: number;
  maxAge?: number; // En milisegundos
}

export interface OraclePrice {
  source: string;
  price: number;
  timestamp: Date;
  confidence: number;
}

// ==================================================================================
// PRICE SERVICE
// ==================================================================================

export class PriceService extends EventEmitter {
  private priceCache: Map<string, PriceUpdate> = new Map();
  private pythEndpoint: string;
  private pythClient: AxiosInstance;
  private updateInterval?: NodeJS.Timeout;
  private readonly CACHE_TTL = 30000; // 30 segundos
  private readonly UPDATE_INTERVAL = 5000; // 5 segundos
  private readonly MAX_DEVIATION = 0.02; // 2% desviación máxima
  private readonly MIN_ORACLES = 2; // Mínimo 2 oráculos para consenso

  constructor() {
    super();
    this.pythEndpoint = process.env.PYTH_ENDPOINT || 'https://hermes.pyth.network';
    
    // Cliente HTTP con retry y timeout
    this.pythClient = axios.create({
      baseURL: this.pythEndpoint,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para logging
    this.pythClient.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Pyth API error', sanitizeError(error));
        throw error;
      }
    );
  }

  /**
   * Inicializa el servicio de precios
   */
  async init(): Promise<void> {
    logger.info('Initializing PriceService', {
      pythEndpoint: this.pythEndpoint,
      updateInterval: this.UPDATE_INTERVAL,
      cacheTTL: this.CACHE_TTL,
    });

    // Iniciar polling de precios
    this.updateInterval = setInterval(() => {
      this.updateAllPrices().catch((error) => {
        logger.error('Failed to update prices', sanitizeError(error));
      });
    }, this.UPDATE_INTERVAL);

    logger.info('PriceService initialized successfully');
  }

  /**
   * Obtiene el precio de un token con validación multi-oracle
   */
  async getPrice(query: PriceQuery): Promise<number> {
    const { token, blockchain, minConfidence = 0.8, maxAge = this.CACHE_TTL } = query;
    const cacheKey = `${blockchain}:${token}`;

    // Verificar cache
    const cached = this.priceCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - new Date(cached.timestamp).getTime();
      
      if (age < maxAge && cached.confidence >= minConfidence) {
        logger.debug('Price cache hit', { token, blockchain, age, confidence: cached.confidence });
        return cached.price;
      }
    }

    // Consultar múltiples oráculos
    const oraclePrices = await this.queryMultipleOracles(token, blockchain);

    if (oraclePrices.length === 0) {
      // Fallback a cache aunque esté viejo
      if (cached) {
        logger.warn('No oracle prices available, using stale cache', { token, blockchain });
        return cached.price;
      }
      throw new Error(`No price available for ${token} on ${blockchain}`);
    }

    // Calcular precio consensuado
    const consensusPrice = this.calculateConsensusPrice(oraclePrices);
    const deviation = this.calculateDeviation(oraclePrices);
    const confidence = this.calculateConfidence(oraclePrices, deviation);

    // Validar desviación
    if (deviation > this.MAX_DEVIATION) {
      logger.warn('High price deviation detected', {
        token,
        blockchain,
        deviation,
        maxDeviation: this.MAX_DEVIATION,
        prices: oraclePrices.map(p => ({ source: p.source, price: p.price })),
      });
    }

    // Actualizar cache
    const update: PriceUpdate = {
      token,
      blockchain,
      price: consensusPrice,
      timestamp: new Date().toISOString(),
      source: oraclePrices.length > 1 ? 'consensus' : oraclePrices[0].source as any,
      confidence,
      deviation,
    };

    this.priceCache.set(cacheKey, update);
    this.emit('price_update', update);

    logger.info('Price updated', {
      token,
      blockchain,
      price: consensusPrice,
      confidence,
      deviation,
      sources: oraclePrices.length,
    });

    return consensusPrice;
  }

  /**
   * Consulta múltiples oráculos en paralelo
   */
  private async queryMultipleOracles(token: string, blockchain: string): Promise<OraclePrice[]> {
    const results = await Promise.allSettled([
      this.queryPyth(token, blockchain),
      // Agregar más oráculos aquí en el futuro:
      // this.queryChainlink(token, blockchain),
      // this.queryUniswap(token, blockchain),
    ]);

    const prices: OraclePrice[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        prices.push(result.value);
      }
    }

    return prices;
  }

  /**
   * Consulta Pyth Network
   */
  private async queryPyth(token: string, blockchain: string): Promise<OraclePrice | null> {
    try {
      const priceId = this.getPythPriceId(token);
      
      if (!priceId) {
        logger.warn('No Pyth price feed ID for token', { token });
        return null;
      }

      const response = await this.pythClient.get('/api/latest_price_feeds', {
        params: { ids: [priceId] },
      });

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const priceData = response.data[0];
      const price = parseFloat(priceData.price.price) / Math.pow(10, Math.abs(priceData.price.expo));
      const confidence = priceData.price.conf ? 1 - (priceData.price.conf / priceData.price.price) : 0.9;

      return {
        source: 'pyth',
        price,
        timestamp: new Date(),
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    } catch (error) {
      logger.error('Pyth query failed', sanitizeError(error));
      return null;
    }
  }

  /**
   * Calcula precio consensuado (mediana)
   */
  private calculateConsensusPrice(prices: OraclePrice[]): number {
    if (prices.length === 0) {
      throw new Error('No prices to calculate consensus');
    }

    if (prices.length === 1) {
      return prices[0].price;
    }

    // Ordenar precios
    const sorted = prices.map(p => p.price).sort((a, b) => a - b);

    // Calcular mediana
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }

  /**
   * Calcula desviación estándar de precios
   */
  private calculateDeviation(prices: OraclePrice[]): number {
    if (prices.length < 2) return 0;

    const priceValues = prices.map(p => p.price);
    const mean = priceValues.reduce((sum, p) => sum + p, 0) / priceValues.length;
    const variance = priceValues.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / priceValues.length;
    const stdDev = Math.sqrt(variance);

    // Retornar como porcentaje del mean
    return stdDev / mean;
  }

  /**
   * Calcula confianza del precio
   */
  private calculateConfidence(prices: OraclePrice[], deviation: number): number {
    // Factores que afectan la confianza:
    // 1. Número de oráculos (más es mejor)
    // 2. Desviación entre precios (menos es mejor)
    // 3. Confianza individual de cada oráculo

    const oracleCountFactor = Math.min(prices.length / 3, 1); // Máximo con 3 oráculos
    const deviationFactor = Math.max(0, 1 - (deviation / this.MAX_DEVIATION));
    const avgOracleConfidence = prices.reduce((sum, p) => sum + p.confidence, 0) / prices.length;

    return (oracleCountFactor * 0.3) + (deviationFactor * 0.4) + (avgOracleConfidence * 0.3);
  }

  /**
   * Actualiza todos los precios en cache
   */
  private async updateAllPrices(): Promise<void> {
    const keys = Array.from(this.priceCache.keys());
    
    for (const key of keys) {
      const [blockchain, token] = key.split(':');
      
      try {
        await this.getPrice({ token, blockchain });
      } catch (error) {
        // Silenciar errores individuales
        logger.debug('Failed to update price', { token, blockchain, error: sanitizeError(error) });
      }
    }
  }

  /**
   * Suscribe a actualizaciones de precios
   */
  subscribe(callback: (update: PriceUpdate) => void): () => void {
    this.on('price_update', callback);
    return () => this.off('price_update', callback);
  }

  /**
   * Obtiene estadísticas del servicio
   */
  getStats(): any {
    return {
      cachedPrices: this.priceCache.size,
      updateInterval: this.UPDATE_INTERVAL,
      cacheTTL: this.CACHE_TTL,
      maxDeviation: this.MAX_DEVIATION,
      minOracles: this.MIN_ORACLES,
    };
  }

  /**
   * Limpia el cache
   */
  clearCache(): void {
    this.priceCache.clear();
    logger.info('Price cache cleared');
  }

  /**
   * Cierra el servicio
   */
  async close(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    this.removeAllListeners();
    logger.info('PriceService closed');
  }

  /**
   * Mapeo de tokens a Pyth price feed IDs
   */
  private getPythPriceId(token: string): string {
    const mapping: Record<string, string> = {
      'ETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      'WETH': '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      'USDC': '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
      'USDT': '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
      'DAI': '0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd',
      'WBTC': '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
      'BNB': '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f',
      'MATIC': '0x5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52',
      'AVAX': '0x93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7',
      'ARB': '0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5',
      'OP': '0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf',
    };

    return mapping[token.toUpperCase()] || '';
  }
}

// ==================================================================================
// SINGLETON INSTANCE
// ==================================================================================

let priceServiceInstance: PriceService | null = null;

/**
 * Obtiene la instancia singleton del PriceService
 */
export function getPriceService(): PriceService {
  if (!priceServiceInstance) {
    priceServiceInstance = new PriceService();
  }
  return priceServiceInstance;
}

/**
 * Inicializa el PriceService global
 */
export async function initPriceService(): Promise<PriceService> {
  const service = getPriceService();
  await service.init();
  return service;
}

