/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/oracles/pyth.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: @solana/web3.js, ../lib/errors, @pythnetwork/client
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: PythOracle
 *   INTERFACES: RouteValidation, PythPriceData, PriceValidationResult
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: PythOracle
 * 
 * 🔗 DEPENDENCIAS:
 *   - @solana/web3.js
 *   - ../lib/errors
 *   - @pythnetwork/client
 * 
 * ============================================================================
 */

import { Connection, PublicKey } from '@solana/web3.js';
import { PythHttpClient, getPythProgramKeyForCluster } from '@pythnetwork/client';
import { Logger } from '../lib/logger';
import { ApiError } from '../lib/errors';

/**
 * ARBITRAGEXPLUS2025 - Pyth Network Oracle
 * 
 * Cliente para Pyth Network que funciona como fuente primaria de precios.
 * Pyth proporciona precios de alta frecuencia y confiabilidad para validar
 * oportunidades de arbitraje antes de ejecutar transacciones.
 * 
 * Funcionalidades:
 * - Obtener precios en tiempo real desde Pyth Network
 * - Validar precios antes de ejecución de rutas
 * - Calcular intervalos de confianza
 * - Manejar múltiples assets dinámicamente desde Google Sheets
 * - Detectar anomalías en precios
 */

interface PythPriceData {
  symbol: string;
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
  priceId: string;
}

interface PriceValidationResult {
  isValid: boolean;
  confidence: number;
  priceAge: number;
  reason?: string;
}

interface RouteValidation {
  isValid: boolean;
  confidence: number;
  reason?: string;
  prices: {
    [symbol: string]: PythPriceData;
  };
}

export class PythOracle {
  private pythClient: PythHttpClient;
  private connection: Connection;
  private logger: Logger;
  private assets: any[] = [];
  private priceCache: Map<string, PythPriceData> = new Map();
  private cacheTimeout: number = 5000; // 5 segundos para precios
  
  // Configuración de Pyth
  private readonly PYTH_ENDPOINTS = [
    'https://hermes.pyth.network',
    'https://hermes-beta.pyth.network'
  ];

  // Mapeo de símbolos a Price IDs de Pyth (se carga dinámicamente desde Sheets)
  private priceIdMap: Map<string, string> = new Map();

  constructor(assets: any[] = []) {
    this.logger = new Logger('PythOracle');
    this.assets = assets;
    this.initializePythClient();
    this.loadAssetPriceIds();
  }

  /**
   * Inicializar cliente de Pyth
   */
  private async initializePythClient(): Promise<void> {
    try {
      this.logger.info('🔮 Inicializando cliente Pyth Oracle...');

      // Conexión a Solana para Pyth on-chain data si se necesita
      this.connection = new Connection(
        process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com'
      );

      // Cliente HTTP de Pyth para Hermes
      this.pythClient = new PythHttpClient(this.connection, getPythProgramKeyForCluster('mainnet-beta'));

      this.logger.info('✅ Cliente Pyth inicializado correctamente');

    } catch (error) {
      this.logger.error('❌ Error inicializando cliente Pyth:', error);
      throw new ApiError('Failed to initialize Pyth client', 500);
    }
  }

  /**
   * Cargar Price IDs desde configuración de assets
   */
  private loadAssetPriceIds(): void {
    this.priceIdMap.clear();

    this.assets.forEach((asset: any) => {
      if (asset.TOKEN_SYMBOL && asset.PYTH_PRICE_ID) {
        this.priceIdMap.set(asset.TOKEN_SYMBOL, asset.PYTH_PRICE_ID);
      }
    });

    this.logger.info(`📊 Price IDs cargados: ${this.priceIdMap.size} assets`);
  }

  /**
   * Actualizar configuración de assets
   */
  async updateAssetConfiguration(assets: any[]): Promise<void> {
    this.assets = assets;
    this.loadAssetPriceIds();
    this.clearPriceCache();
    
    this.logger.info(`🔄 Configuración actualizada: ${assets.length} assets`);
  }

  /**
   * Obtener precios actuales de múltiples símbolos
   */
  async getCurrentPrices(symbols?: string[]): Promise<PythPriceData[]> {
    try {
      const targetSymbols = symbols || Array.from(this.priceIdMap.keys());
      const prices: PythPriceData[] = [];

      // Verificar cache primero
      const cachedPrices: PythPriceData[] = [];
      const uncachedSymbols: string[] = [];

      targetSymbols.forEach(symbol => {
        const cached = this.getCachedPrice(symbol);
        if (cached) {
          cachedPrices.push(cached);
        } else {
          uncachedSymbols.push(symbol);
        }
      });

      // Si todos están en cache, retornar
      if (uncachedSymbols.length === 0) {
        return cachedPrices;
      }

      // Obtener Price IDs para símbolos no cacheados
      const priceIds = uncachedSymbols
        .map(symbol => this.priceIdMap.get(symbol))
        .filter(id => id !== undefined) as string[];

      if (priceIds.length === 0) {
        this.logger.warn('⚠️ No hay Price IDs configurados para los símbolos solicitados');
        return cachedPrices;
      }

      // Hacer request a Pyth Hermes API
      const response = await this.fetchFromHermes(priceIds);
      
      for (const priceData of response) {
        const symbol = this.getSymbolFromPriceId(priceData.id);
        if (symbol) {
          const formattedPrice: PythPriceData = {
            symbol: symbol,
            price: priceData.price.price * Math.pow(10, priceData.price.expo),
            confidence: priceData.price.conf * Math.pow(10, priceData.price.expo),
            expo: priceData.price.expo,
            publishTime: priceData.price.publish_time,
            priceId: priceData.id
          };

          prices.push(formattedPrice);
          this.setCachedPrice(symbol, formattedPrice);
        }
      }

      // Combinar precios cached y nuevos
      return [...cachedPrices, ...prices];

    } catch (error) {
      this.logger.error('❌ Error obteniendo precios de Pyth:', error);
      throw new ApiError('Failed to fetch prices from Pyth', 500);
    }
  }

  /**
   * Obtener precio de un símbolo específico
   */
  async getPrice(symbol: string): Promise<PythPriceData | null> {
    try {
      const prices = await this.getCurrentPrices([symbol]);
      return prices.find(p => p.symbol === symbol) || null;
    } catch (error) {
      this.logger.error(`❌ Error obteniendo precio de ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Validar precio para una transacción
   */
  async validatePrice(symbol: string, expectedPrice: number, maxDriftBps: number = 100): Promise<PriceValidationResult> {
    try {
      const priceData = await this.getPrice(symbol);
      
      if (!priceData) {
        return {
          isValid: false,
          confidence: 0,
          priceAge: 0,
          reason: `No price data available for ${symbol}`
        };
      }

      // Calcular edad del precio
      const now = Date.now() / 1000;
      const priceAge = now - priceData.publishTime;

      // Precio demasiado viejo (más de 30 segundos)
      if (priceAge > 30) {
        return {
          isValid: false,
          confidence: 0,
          priceAge: priceAge,
          reason: `Price too old: ${priceAge.toFixed(1)}s`
        };
      }

      // Calcular drift del precio esperado
      const priceDrift = Math.abs(priceData.price - expectedPrice) / expectedPrice;
      const driftBps = priceDrift * 10000;

      // Precio fuera del rango aceptable
      if (driftBps > maxDriftBps) {
        return {
          isValid: false,
          confidence: priceData.confidence / priceData.price,
          priceAge: priceAge,
          reason: `Price drift too high: ${driftBps.toFixed(1)} bps (max: ${maxDriftBps})`
        };
      }

      // Confianza demasiado baja
      const confidenceRatio = priceData.confidence / priceData.price;
      if (confidenceRatio > 0.01) { // 1% de confidence interval
        return {
          isValid: false,
          confidence: confidenceRatio,
          priceAge: priceAge,
          reason: `Confidence too low: ${(confidenceRatio * 100).toFixed(2)}%`
        };
      }

      return {
        isValid: true,
        confidence: confidenceRatio,
        priceAge: priceAge
      };

    } catch (error) {
      this.logger.error(`❌ Error validando precio de ${symbol}:`, error);
      return {
        isValid: false,
        confidence: 0,
        priceAge: 0,
        reason: `Validation error: ${error.message}`
      };
    }
  }

  /**
   * Validar precios para una ruta de arbitraje completa
   */
  async validateRoutePrice(route: any): Promise<RouteValidation> {
    try {
      const tokens = [route.SOURCE_TOKEN, route.TARGET_TOKEN];
      
      // Agregar token intermedio si existe
      if (route.INTERMEDIATE_TOKEN && route.INTERMEDIATE_TOKEN.trim()) {
        tokens.push(route.INTERMEDIATE_TOKEN);
      }

      // Obtener precios de todos los tokens involucrados
      const prices = await this.getCurrentPrices(tokens);
      const priceMap: { [symbol: string]: PythPriceData } = {};
      
      prices.forEach(price => {
        priceMap[price.symbol] = price;
      });

      // Verificar que tenemos precios para todos los tokens
      const missingPrices = tokens.filter(token => !priceMap[token]);
      if (missingPrices.length > 0) {
        return {
          isValid: false,
          confidence: 0,
          reason: `Missing prices for: ${missingPrices.join(', ')}`,
          prices: priceMap
        };
      }

      // Calcular confianza promedio
      let totalConfidence = 0;
      let totalPriceAge = 0;
      
      Object.values(priceMap).forEach(price => {
        totalConfidence += price.confidence / price.price;
        totalPriceAge += (Date.now() / 1000) - price.publishTime;
      });

      const avgConfidence = totalConfidence / Object.keys(priceMap).length;
      const avgPriceAge = totalPriceAge / Object.keys(priceMap).length;

      // Validar edad promedio de precios
      if (avgPriceAge > 20) { // 20 segundos máximo promedio
        return {
          isValid: false,
          confidence: avgConfidence,
          reason: `Average price age too high: ${avgPriceAge.toFixed(1)}s`,
          prices: priceMap
        };
      }

      // Validar confianza promedio
      if (avgConfidence > 0.005) { // 0.5% máximo
        return {
          isValid: false,
          confidence: avgConfidence,
          reason: `Average confidence too low: ${(avgConfidence * 100).toFixed(3)}%`,
          prices: priceMap
        };
      }

      return {
        isValid: true,
        confidence: avgConfidence,
        prices: priceMap
      };

    } catch (error) {
      this.logger.error('❌ Error validando precios de ruta:', error);
      return {
        isValid: false,
        confidence: 0,
        reason: `Route validation error: ${error.message}`,
        prices: {}
      };
    }
  }

  /**
   * Obtener estadísticas del oráculo
   */
  async getOracleStats(): Promise<any> {
    const cacheStats = {
      size: this.priceCache.size,
      symbols: Array.from(this.priceCache.keys())
    };

    const configStats = {
      totalAssets: this.assets.length,
      configuredPriceIds: this.priceIdMap.size,
      availableSymbols: Array.from(this.priceIdMap.keys())
    };

    return {
      cache: cacheStats,
      configuration: configStats,
      endpoints: this.PYTH_ENDPOINTS,
      cacheTimeout: this.cacheTimeout
    };
  }

  /**
   * Verificar salud del oráculo
   */
  async isHealthy(): Promise<boolean> {
    try {
      // Intentar obtener precio de ETH como health check
      const ethPrice = await this.getPrice('ETH');
      return ethPrice !== null && ethPrice.price > 0;
    } catch (error) {
      this.logger.error('❌ Health check fallido:', error);
      return false;
    }
  }

  // ==================================================================================
  // MÉTODOS PRIVADOS
  // ==================================================================================

  /**
   * Hacer request a Hermes API
   */
  private async fetchFromHermes(priceIds: string[]): Promise<any[]> {
    const params = new URLSearchParams();
    priceIds.forEach(id => params.append('ids[]', id));

    for (const endpoint of this.PYTH_ENDPOINTS) {
      try {
        const url = `${endpoint}/api/latest_price_feeds?${params.toString()}`;
        
        const response = await fetch(url, {
          timeout: 5000,
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return data;

      } catch (error) {
        this.logger.warn(`⚠️ Error con endpoint ${endpoint}:`, error);
        continue; // Intentar siguiente endpoint
      }
    }

    throw new Error('All Pyth endpoints failed');
  }

  /**
   * Obtener símbolo desde Price ID
   */
  private getSymbolFromPriceId(priceId: string): string | null {
    for (const [symbol, id] of this.priceIdMap.entries()) {
      if (id === priceId) {
        return symbol;
      }
    }
    return null;
  }

  /**
   * Obtener precio del cache si está vigente
   */
  private getCachedPrice(symbol: string): PythPriceData | null {
    const cached = this.priceCache.get(symbol);
    
    if (cached) {
      const now = Date.now() / 1000;
      const age = now - cached.publishTime;
      
      if (age < this.cacheTimeout / 1000) {
        return cached;
      } else {
        this.priceCache.delete(symbol);
      }
    }
    
    return null;
  }

  /**
   * Guardar precio en cache
   */
  private setCachedPrice(symbol: string, price: PythPriceData): void {
    this.priceCache.set(symbol, price);
  }

  /**
   * Limpiar cache de precios
   */
  private clearPriceCache(): void {
    this.priceCache.clear();
    this.logger.debug('🗑️ Cache de precios limpiado');
  }
}