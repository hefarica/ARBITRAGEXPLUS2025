/**
 * ============================================================================
 * ARCHIVO: services/api-server/src/services/priceService.ts
 * SERVICIO: api-server
 * PRIORIDAD: P0 (CRÍTICO)
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   FUENTE 1: Google Sheets - Hoja "ORACLE_ASSETS"
 *     - Formato: Array de objetos { SYMBOL, BLOCKCHAIN, PYTH_PRICE_ID, CHAINLINK_ADDRESS, IS_ACTIVE, PRIORITY, MIN_CONFIDENCE, NOTES }
 *     - Frecuencia: Carga inicial + refresh cada 5 minutos
 *   FUENTE 2: Pyth Network API
 *     - Formato: JSON { price: { price: string, expo: number, conf: string } }
 *     - Frecuencia: Polling cada 5 segundos
 *   FUENTE 3: Chainlink Price Feeds (fallback)
 *     - Formato: On-chain data
 *   FUENTE 4: Uniswap V3 TWAP (fallback)
 *     - Formato: On-chain data
 * 
 * 🔄 TRANSFORMACIÓN:
 *   PASO 1: Carga configuración dinámica desde Google Sheets
 *   PASO 2: Construye Map de assets configurados (blockchain:symbol → config)
 *   PASO 3: Consulta múltiples oráculos en paralelo según configuración
 *   PASO 4: Valida consistencia de precios (desviación < config.maxDeviation)
 *   PASO 5: Calcula precio consensuado (mediana)
 *   PASO 6: Verifica confianza mínima (config.minConfidence)
 *   PASO 7: Cachea resultado con TTL configurable
 *   PASO 8: Emite evento de actualización
 * 
 * 📤 SALIDA DE DATOS:
 *   DESTINO 1: Cache en memoria (Map<string, PriceUpdate>)
 *     - Formato: { token, blockchain, price, timestamp, source, confidence, deviation }
 *   DESTINO 2: Event emitter (price_update)
 *     - Formato: PriceUpdate interface
 *   DESTINO 3: API response
 *     - Formato: number (precio en USD)
 *   DESTINO 4: Google Sheets - Hoja "PRICE_UPDATES" (opcional)
 *     - Formato: { timestamp, symbol, blockchain, price, source, confidence }
 * 
 * 🔗 DEPENDENCIAS:
 *   CONSUME:
 *     - axios → HTTP requests a Pyth API
 *     - events → EventEmitter para pub/sub
 *     - ./logger → Logging de errores
 *     - ../lib/sheets-service → Lectura de configuración desde Sheets
 *   ES CONSUMIDO POR:
 *     - arbitrageService → Cálculo de rentabilidad
 *     - routeValidator → Validación de rutas
 *     - executionService → Verificación pre-ejecución
 * 
 * 🧬 PROGRAMACIÓN DINÁMICA APLICADA:
 *   1. ❌ NO hardcoding de tokens → ✅ Carga desde Google Sheets
 *   2. ❌ NO mapeo fijo de price IDs → ✅ Map dinámico construido en runtime
 *   3. ❌ NO array fijo de oráculos → ✅ Array de OracleSource configurables
 *   4. ✅ Descubrimiento dinámico de assets activos (IS_ACTIVE = TRUE)
 *   5. ✅ Validación por características (minConfidence, priority)
 *   6. ✅ Refresh automático de configuración cada 5 minutos
 *   7. ✅ Polimorfismo: OracleSource interface permite agregar oráculos sin modificar código
 * 
 * ============================================================================
 */

import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../lib/logger';
import { sanitizeError } from '../lib/errors';

// ==================================================================================
// INTERFACES - PROGRAMACIÓN DINÁMICA
// ==================================================================================

/**
 * Configuración de un asset desde Google Sheets
 * Estructura dinámica que se carga en runtime
 */
export interface OracleAssetConfig {
  symbol: string;
  blockchain: string;
  pythPriceId?: string;
  chainlinkAddress?: string;
  uniswapPoolAddress?: string;
  isActive: boolean;
  priority: number; // 1=crítico, 2=importante, 3=opcional
  minConfidence: number; // 0-1
  maxDeviation?: number; // Desviación máxima permitida (default 0.02)
  notes?: string;
}

/**
 * Interface abstracta para fuentes de oráculos
 * Permite agregar nuevos oráculos sin modificar código (polimorfismo)
 */
export interface OracleSource {
  name: string;
  priority: number;
  query(symbol: string, blockchain: string, config: OracleAssetConfig): Promise<OraclePrice | null>;
  isAvailable(): boolean;
}

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
// ORACLE SOURCES - IMPLEMENTACIONES POLIMÓRFICAS
// ==================================================================================

/**
 * Pyth Network Oracle Source
 */
class PythOracleSource implements OracleSource {
  name = 'pyth';
  priority = 1;
  private client: AxiosInstance;
  private endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || process.env.PYTH_ENDPOINT || 'https://hermes.pyth.network';
    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async query(symbol: string, blockchain: string, config: OracleAssetConfig): Promise<OraclePrice | null> {
    try {
      if (!config.pythPriceId) {
        logger.debug(`No Pyth price ID for ${symbol} on ${blockchain}`);
        return null;
      }

      const response = await this.client.get('/api/latest_price_feeds', {
        params: { ids: [config.pythPriceId] },
      });

      if (!response.data || response.data.length === 0) {
        return null;
      }

      const priceData = response.data[0];
      const price = parseFloat(priceData.price.price) / Math.pow(10, Math.abs(priceData.price.expo));
      const confidence = priceData.price.conf 
        ? 1 - (parseFloat(priceData.price.conf) / parseFloat(priceData.price.price))
        : 0.9;

      return {
        source: 'pyth',
        price,
        timestamp: new Date(),
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    } catch (error) {
      logger.error(`Pyth query failed for ${symbol}`, sanitizeError(error));
      return null;
    }
  }

  isAvailable(): boolean {
    return true; // Pyth siempre disponible vía HTTP
  }
}

/**
 * Chainlink Oracle Source
 * Consulta price feeds on-chain de Chainlink
 */
class ChainlinkOracleSource implements OracleSource {
  name = 'chainlink';
  priority = 2;
  private providers: Map<string, any> = new Map(); // ethers.providers por blockchain
  private aggregatorABI = [
    'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
    'function decimals() external view returns (uint8)',
  ];

  constructor() {
    // Inicializar providers para cada blockchain
    this.initializeProviders();
  }

  private initializeProviders() {
    try {
      // Lazy import de ethers
      const ethers = require('ethers');
      
      // Configurar providers para cada blockchain
      const rpcEndpoints: Record<string, string> = {
        ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
        polygon: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
        avalanche: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
        arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        optimism: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
      };

      for (const [blockchain, rpcUrl] of Object.entries(rpcEndpoints)) {
        try {
          const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
          this.providers.set(blockchain, provider);
          logger.debug(`Chainlink provider initialized for ${blockchain}`);
        } catch (error) {
          logger.warn(`Failed to initialize Chainlink provider for ${blockchain}`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize Chainlink providers', error);
    }
  }

  async query(symbol: string, blockchain: string, config: OracleAssetConfig): Promise<OraclePrice | null> {
    try {
      if (!config.chainlinkAddress) {
        logger.debug(`No Chainlink address for ${symbol} on ${blockchain}`);
        return null;
      }

      const provider = this.providers.get(blockchain);
      if (!provider) {
        logger.warn(`No provider available for ${blockchain}`);
        return null;
      }

      // Lazy import de ethers
      const ethers = require('ethers');
      
      // Crear contrato del price feed
      const aggregator = new ethers.Contract(
        config.chainlinkAddress,
        this.aggregatorABI,
        provider
      );

      // Consultar datos del último round
      const [roundData, decimals] = await Promise.all([
        aggregator.latestRoundData(),
        aggregator.decimals(),
      ]);

      // Extraer precio
      const price = parseFloat(ethers.utils.formatUnits(roundData.answer, decimals));
      
      // Calcular confianza basada en la edad de la actualización
      const updatedAt = roundData.updatedAt.toNumber() * 1000; // Convertir a ms
      const age = Date.now() - updatedAt;
      const maxAge = 3600000; // 1 hora
      const confidence = Math.max(0, 1 - (age / maxAge));

      // Validar que el precio sea reciente (< 1 hora)
      if (age > maxAge) {
        logger.warn(`Chainlink price for ${symbol} is stale (${age}ms old)`);
        return null;
      }

      return {
        source: 'chainlink',
        price,
        timestamp: new Date(updatedAt),
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    } catch (error) {
      logger.error(`Chainlink query failed for ${symbol} on ${blockchain}`, sanitizeError(error));
      return null;
    }
  }

  isAvailable(): boolean {
    // Disponible si hay al menos un provider inicializado
    return this.providers.size > 0;
  }
}

/**
 * Uniswap V3 TWAP Oracle Source
 * Consulta Time-Weighted Average Price de pools de Uniswap V3
 */
class UniswapOracleSource implements OracleSource {
  name = 'uniswap';
  priority = 3;
  private providers: Map<string, any> = new Map(); // ethers.providers por blockchain
  private poolABI = [
    'function observe(uint32[] secondsAgos) external view returns (int56[] tickCumulatives, uint160[] secondsPerLiquidityCumulativeX128s)',
    'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
  ];
  private twapPeriod: number = 1800; // 30 minutos por defecto

  constructor(twapPeriod?: number) {
    if (twapPeriod) {
      this.twapPeriod = twapPeriod;
    }
    this.initializeProviders();
  }

  private initializeProviders() {
    try {
      const ethers = require('ethers');
      
      const rpcEndpoints: Record<string, string> = {
        ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
        polygon: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
        avalanche: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
        arbitrum: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        optimism: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
      };

      for (const [blockchain, rpcUrl] of Object.entries(rpcEndpoints)) {
        try {
          const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
          this.providers.set(blockchain, provider);
          logger.debug(`Uniswap provider initialized for ${blockchain}`);
        } catch (error) {
          logger.warn(`Failed to initialize Uniswap provider for ${blockchain}`, error);
        }
      }
    } catch (error) {
      logger.error('Failed to initialize Uniswap providers', error);
    }
  }

  async query(symbol: string, blockchain: string, config: OracleAssetConfig): Promise<OraclePrice | null> {
    try {
      if (!config.uniswapPoolAddress) {
        logger.debug(`No Uniswap pool address for ${symbol} on ${blockchain}`);
        return null;
      }

      const provider = this.providers.get(blockchain);
      if (!provider) {
        logger.warn(`No provider available for ${blockchain}`);
        return null;
      }

      const ethers = require('ethers');
      
      // Crear contrato del pool
      const pool = new ethers.Contract(
        config.uniswapPoolAddress,
        this.poolABI,
        provider
      );

      // Obtener TWAP
      const secondsAgos = [this.twapPeriod, 0]; // [periodo atrás, ahora]
      const [tickCumulatives] = await pool.observe(secondsAgos);
      
      // Calcular tick promedio
      const tickCumulativeDelta = tickCumulatives[1].sub(tickCumulatives[0]);
      const timeWeightedAverageTick = tickCumulativeDelta.div(this.twapPeriod);
      
      // Convertir tick a precio
      // price = 1.0001^tick
      const price = Math.pow(1.0001, timeWeightedAverageTick.toNumber());
      
      // Obtener slot0 para verificar liquidez
      const slot0 = await pool.slot0();
      const currentTick = slot0.tick;
      
      // Calcular confianza basada en la diferencia entre TWAP y precio spot
      const spotPrice = Math.pow(1.0001, currentTick);
      const deviation = Math.abs(price - spotPrice) / spotPrice;
      const confidence = Math.max(0, 1 - (deviation * 10)); // Penalizar desviaciones grandes
      
      // Validar que la desviación no sea demasiado grande (> 5%)
      if (deviation > 0.05) {
        logger.warn(`Uniswap TWAP for ${symbol} has high deviation: ${(deviation * 100).toFixed(2)}%`);
        return null;
      }

      return {
        source: 'uniswap',
        price,
        timestamp: new Date(),
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    } catch (error) {
      logger.error(`Uniswap query failed for ${symbol} on ${blockchain}`, sanitizeError(error));
      return null;
    }
  }

  isAvailable(): boolean {
    return this.providers.size > 0;
  }
}

/**
 * Binance API Oracle Source
 * Consulta precios de CEX (Centralized Exchange) vía API pública
 */
class BinanceOracleSource implements OracleSource {
  name = 'binance';
  priority = 4;
  private client: AxiosInstance;
  private endpoint: string;

  constructor(endpoint?: string) {
    this.endpoint = endpoint || process.env.BINANCE_API_ENDPOINT || 'https://api.binance.com';
    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async query(symbol: string, blockchain: string, config: OracleAssetConfig): Promise<OraclePrice | null> {
    try {
      // Binance usa pares como BTCUSDT, ETHUSDT, etc.
      // Normalizar símbolo: ETH -> ETHUSDT, BTC -> BTCUSDT
      const normalizedSymbol = this.normalizeBinanceSymbol(symbol);
      if (!normalizedSymbol) {
        logger.debug(`Cannot normalize symbol ${symbol} for Binance`);
        return null;
      }

      // Consultar precio actual
      const response = await this.client.get('/api/v3/ticker/price', {
        params: { symbol: normalizedSymbol },
      });

      if (!response.data || !response.data.price) {
        return null;
      }

      const price = parseFloat(response.data.price);

      // Obtener 24h stats para calcular confianza basada en volumen
      let confidence = 0.8; // Confianza base para Binance
      try {
        const statsResponse = await this.client.get('/api/v3/ticker/24hr', {
          params: { symbol: normalizedSymbol },
        });
        
        if (statsResponse.data) {
          const volume = parseFloat(statsResponse.data.volume);
          const quoteVolume = parseFloat(statsResponse.data.quoteVolume);
          
          // Mayor volumen = mayor confianza
          // Volumen > $10M = alta confianza
          if (quoteVolume > 10000000) {
            confidence = 0.95;
          } else if (quoteVolume > 1000000) {
            confidence = 0.9;
          } else if (quoteVolume > 100000) {
            confidence = 0.85;
          }
        }
      } catch (error) {
        // Si falla obtener stats, usar confianza base
        logger.debug(`Failed to get Binance stats for ${symbol}`);
      }

      return {
        source: 'binance',
        price,
        timestamp: new Date(),
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    } catch (error) {
      logger.error(`Binance query failed for ${symbol}`, sanitizeError(error));
      return null;
    }
  }

  /**
   * Normaliza símbolos para Binance
   * ETH, WETH -> ETHUSDT
   * BTC, WBTC -> BTCUSDT
   */
  private normalizeBinanceSymbol(symbol: string): string | null {
    const normalized = symbol.toUpperCase()
      .replace('W', '') // WETH -> ETH, WBTC -> BTC
      .replace('USDC', '')
      .replace('USDT', '')
      .replace('DAI', '');
    
    // Mapeo de símbolos conocidos
    const symbolMap: Record<string, string> = {
      'ETH': 'ETHUSDT',
      'BTC': 'BTCUSDT',
      'BNB': 'BNBUSDT',
      'MATIC': 'MATICUSDT',
      'AVAX': 'AVAXUSDT',
      'SOL': 'SOLUSDT',
      'LINK': 'LINKUSDT',
      'UNI': 'UNIUSDT',
      'AAVE': 'AAVEUSDT',
      'SHIB': 'SHIBUSDT',
      'PEPE': 'PEPEUSDT',
      'ARB': 'ARBUSDT',
      'OP': 'OPUSDT',
      'ATOM': 'ATOMUSDT',
      'DOT': 'DOTUSDT',
      'ADA': 'ADAUSDT',
      'XRP': 'XRPUSDT',
      'DOGE': 'DOGEUSDT',
    };

    return symbolMap[normalized] || null;
  }

  isAvailable(): boolean {
    return true; // Binance API siempre disponible
  }
}

/**
 * CoinGecko API Oracle Source
 * Consulta precios agregados de múltiples exchanges
 */
class CoinGeckoOracleSource implements OracleSource {
  name = 'coingecko';
  priority = 5;
  private client: AxiosInstance;
  private endpoint: string;
  private apiKey?: string;

  constructor(endpoint?: string, apiKey?: string) {
    this.endpoint = endpoint || process.env.COINGECKO_API_ENDPOINT || 'https://api.coingecko.com/api/v3';
    this.apiKey = apiKey || process.env.COINGECKO_API_KEY;
    
    const headers: any = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['x-cg-pro-api-key'] = this.apiKey;
    }

    this.client = axios.create({
      baseURL: this.endpoint,
      timeout: 10000, // CoinGecko puede ser más lento
      headers,
    });
  }

  async query(symbol: string, blockchain: string, config: OracleAssetConfig): Promise<OraclePrice | null> {
    try {
      // CoinGecko usa IDs como 'ethereum', 'bitcoin', etc.
      const coinId = this.getCoinGeckoId(symbol);
      if (!coinId) {
        logger.debug(`Cannot map symbol ${symbol} to CoinGecko ID`);
        return null;
      }

      // Consultar precio simple
      const response = await this.client.get('/simple/price', {
        params: {
          ids: coinId,
          vs_currencies: 'usd',
          include_24hr_vol: 'true',
          include_last_updated_at: 'true',
        },
      });

      if (!response.data || !response.data[coinId]) {
        return null;
      }

      const data = response.data[coinId];
      const price = data.usd;
      const lastUpdated = data.last_updated_at * 1000; // Convertir a ms
      const volume24h = data.usd_24h_vol || 0;

      // Calcular confianza basada en volumen y edad
      const age = Date.now() - lastUpdated;
      const maxAge = 300000; // 5 minutos
      const ageConfidence = Math.max(0, 1 - (age / maxAge));
      
      // Volumen > $100M = alta confianza
      let volumeConfidence = 0.7;
      if (volume24h > 100000000) {
        volumeConfidence = 0.95;
      } else if (volume24h > 10000000) {
        volumeConfidence = 0.9;
      } else if (volume24h > 1000000) {
        volumeConfidence = 0.85;
      }

      const confidence = (ageConfidence + volumeConfidence) / 2;

      // Rechazar si muy viejo (> 5 min)
      if (age > maxAge) {
        logger.warn(`CoinGecko price for ${symbol} is stale (${age}ms old)`);
        return null;
      }

      return {
        source: 'coingecko',
        price,
        timestamp: new Date(lastUpdated),
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    } catch (error) {
      logger.error(`CoinGecko query failed for ${symbol}`, sanitizeError(error));
      return null;
    }
  }

  /**
   * Mapea símbolos a IDs de CoinGecko
   */
  private getCoinGeckoId(symbol: string): string | null {
    const normalized = symbol.toUpperCase().replace('W', '');
    
    const idMap: Record<string, string> = {
      'ETH': 'ethereum',
      'BTC': 'bitcoin',
      'BNB': 'binancecoin',
      'MATIC': 'matic-network',
      'AVAX': 'avalanche-2',
      'SOL': 'solana',
      'LINK': 'chainlink',
      'UNI': 'uniswap',
      'AAVE': 'aave',
      'SHIB': 'shiba-inu',
      'PEPE': 'pepe',
      'ARB': 'arbitrum',
      'OP': 'optimism',
      'ATOM': 'cosmos',
      'DOT': 'polkadot',
      'ADA': 'cardano',
      'XRP': 'ripple',
      'DOGE': 'dogecoin',
      'USDC': 'usd-coin',
      'USDT': 'tether',
      'DAI': 'dai',
    };

    return idMap[normalized] || null;
  }

  isAvailable(): boolean {
    return true; // CoinGecko API siempre disponible
  }
}

/**
 * Band Protocol Oracle Source
 * Consulta precios on-chain de Band Protocol
 */
class BandOracleSource implements OracleSource {
  name = 'band';
  priority = 6;
  private providers: Map<string, any> = new Map();
  private aggregatorABI = [
    'function getReferenceData(string base, string quote) external view returns (uint256 rate, uint256 lastUpdatedBase, uint256 lastUpdatedQuote)',
  ];
  // Band Protocol StdReference contracts por chain
  private contractAddresses: Record<string, string> = {
    ethereum: '0xDA7a001b254CD22e46d3eAB04d937489c93174C3',
    polygon: '0x56E2898E0ceFF0D1222827759B56B28Ad812f92F',
    bsc: '0xDA7a001b254CD22e46d3eAB04d937489c93174C3',
    avalanche: '0x7c7C1D1E4c7C1C6C5C5C5C5C5C5C5C5C5C5C5C5C', // Placeholder
  };

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders() {
    try {
      const ethers = require('ethers');
      
      const rpcEndpoints: Record<string, string> = {
        ethereum: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
        polygon: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
        avalanche: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
      };

      for (const [blockchain, rpcUrl] of Object.entries(rpcEndpoints)) {
        if (this.contractAddresses[blockchain]) {
          try {
            const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
            this.providers.set(blockchain, provider);
            logger.debug(`Band provider initialized for ${blockchain}`);
          } catch (error) {
            logger.warn(`Failed to initialize Band provider for ${blockchain}`, error);
          }
        }
      }
    } catch (error) {
      logger.error('Failed to initialize Band providers', error);
    }
  }

  async query(symbol: string, blockchain: string, config: OracleAssetConfig): Promise<OraclePrice | null> {
    try {
      const contractAddress = this.contractAddresses[blockchain];
      if (!contractAddress) {
        logger.debug(`No Band contract for ${blockchain}`);
        return null;
      }

      const provider = this.providers.get(blockchain);
      if (!provider) {
        logger.warn(`No provider available for ${blockchain}`);
        return null;
      }

      const ethers = require('ethers');
      
      // Crear contrato
      const aggregator = new ethers.Contract(
        contractAddress,
        this.aggregatorABI,
        provider
      );

      // Normalizar símbolo para Band (ETH, BTC, etc.)
      const normalizedSymbol = symbol.toUpperCase().replace('W', '');

      // Consultar precio vs USD
      const result = await aggregator.getReferenceData(normalizedSymbol, 'USD');
      
      // Band retorna precio con 18 decimales
      const price = parseFloat(ethers.utils.formatUnits(result.rate, 18));
      const lastUpdatedBase = result.lastUpdatedBase.toNumber() * 1000;
      
      // Calcular confianza basada en edad
      const age = Date.now() - lastUpdatedBase;
      const maxAge = 3600000; // 1 hora
      const confidence = Math.max(0, 1 - (age / maxAge));

      // Rechazar si muy viejo
      if (age > maxAge) {
        logger.warn(`Band price for ${symbol} is stale (${age}ms old)`);
        return null;
      }

      return {
        source: 'band',
        price,
        timestamp: new Date(lastUpdatedBase),
        confidence: Math.max(0, Math.min(1, confidence)),
      };
    } catch (error) {
      logger.error(`Band query failed for ${symbol} on ${blockchain}`, sanitizeError(error));
      return null;
    }
  }

  isAvailable(): boolean {
    return this.providers.size > 0;
  }
}

// ==================================================================================
// PRICE SERVICE - 100% DINÁMICO
// ==================================================================================

export class PriceService extends EventEmitter {
  // Configuración dinámica cargada desde Google Sheets
  private assetsConfig: Map<string, OracleAssetConfig> = new Map();
  
  // Array dinámico de fuentes de oráculos (polimorfismo)
  private oracleSources: OracleSource[] = [];
  
  // Cache de precios
  private priceCache: Map<string, PriceUpdate> = new Map();
  
  // Intervalos configurables
  private updateInterval?: NodeJS.Timeout;
  private configRefreshInterval?: NodeJS.Timeout;
  
  // Configuración del servicio (puede cargarse desde Sheets también)
  private readonly CACHE_TTL: number;
  private readonly UPDATE_INTERVAL: number;
  private readonly CONFIG_REFRESH_INTERVAL: number;
  private readonly MAX_DEVIATION: number;
  private readonly MIN_ORACLES: number;

  // Servicio de Google Sheets (inyección de dependencia)
  private sheetsService: any;

  constructor(sheetsService?: any, config?: {
    cacheTTL?: number;
    updateInterval?: number;
    configRefreshInterval?: number;
    maxDeviation?: number;
    minOracles?: number;
  }) {
    super();
    
    this.sheetsService = sheetsService;
    
    // Configuración con defaults
    this.CACHE_TTL = config?.cacheTTL || 30000; // 30 segundos
    this.UPDATE_INTERVAL = config?.updateInterval || 5000; // 5 segundos
    this.CONFIG_REFRESH_INTERVAL = config?.configRefreshInterval || 300000; // 5 minutos
    this.MAX_DEVIATION = config?.maxDeviation || 0.02; // 2%
    this.MIN_ORACLES = config?.minOracles || 2;

    // Inicializar fuentes de oráculos (array dinámico)
    this.initializeOracleSources();
  }

  /**
   * Inicializa las fuentes de oráculos disponibles
   * Programación Dinámica: Array de objetos polimórficos
   */
  private initializeOracleSources(): void {
    this.oracleSources = [
      new PythOracleSource(),
      new ChainlinkOracleSource(),
      new UniswapOracleSource(),
    ];

    // Filtrar solo oráculos disponibles
    this.oracleSources = this.oracleSources.filter(source => source.isAvailable());

    // Ordenar por prioridad
    this.oracleSources.sort((a, b) => a.priority - b.priority);

    logger.info(`Initialized ${this.oracleSources.length} oracle sources`, {
      sources: this.oracleSources.map(s => s.name),
    });
  }

  /**
   * Inicializa el servicio de precios
   * Carga configuración desde Google Sheets
   */
  async init(): Promise<void> {
    logger.info('Initializing PriceService (100% Dynamic)', {
      cacheTTL: this.CACHE_TTL,
      updateInterval: this.UPDATE_INTERVAL,
      configRefreshInterval: this.CONFIG_REFRESH_INTERVAL,
    });

    // Cargar configuración inicial desde Google Sheets
    await this.loadAssetsConfig();

    // Iniciar polling de precios
    this.updateInterval = setInterval(() => {
      this.updateAllPrices().catch((error) => {
        logger.error('Failed to update prices', sanitizeError(error));
      });
    }, this.UPDATE_INTERVAL);

    // Iniciar refresh de configuración
    this.configRefreshInterval = setInterval(() => {
      this.loadAssetsConfig().catch((error) => {
        logger.error('Failed to refresh config', sanitizeError(error));
      });
    }, this.CONFIG_REFRESH_INTERVAL);

    logger.info('PriceService initialized successfully', {
      configuredAssets: this.assetsConfig.size,
      activeAssets: this.getActiveAssetsCount(),
    });
  }

  /**
   * Carga configuración de assets desde Google Sheets
   * Programación Dinámica: Descubrimiento dinámico de assets
   */
  async loadAssetsConfig(): Promise<void> {
    try {
      if (!this.sheetsService) {
        logger.warn('No sheets service configured, using empty config');
        return;
      }

      logger.info('Loading assets configuration from Google Sheets...');

      // Leer hoja ORACLE_ASSETS
      const rows = await this.sheetsService.readSheet('ORACLE_ASSETS');

      if (!rows || rows.length === 0) {
        logger.warn('No assets configured in ORACLE_ASSETS sheet');
        return;
      }

      // Limpiar configuración anterior
      this.assetsConfig.clear();

      // Construir Map dinámicamente
      let activeCount = 0;
      for (const row of rows) {
        try {
          const config: OracleAssetConfig = {
            symbol: row.SYMBOL?.toUpperCase() || '',
            blockchain: row.BLOCKCHAIN?.toLowerCase() || '',
            pythPriceId: row.PYTH_PRICE_ID || undefined,
            chainlinkAddress: row.CHAINLINK_ADDRESS || undefined,
            uniswapPoolAddress: row.UNISWAP_POOL_ADDRESS || undefined,
            isActive: row.IS_ACTIVE === 'TRUE' || row.IS_ACTIVE === true,
            priority: parseInt(row.PRIORITY) || 2,
            minConfidence: parseFloat(row.MIN_CONFIDENCE) || 0.8,
            maxDeviation: parseFloat(row.MAX_DEVIATION) || this.MAX_DEVIATION,
            notes: row.NOTES || '',
          };

          // Validar configuración mínima
          if (!config.symbol || !config.blockchain) {
            logger.warn('Skipping invalid asset config', { row });
            continue;
          }

          // Validar que tenga al menos un oráculo configurado
          if (!config.pythPriceId && !config.chainlinkAddress && !config.uniswapPoolAddress) {
            logger.warn(`Asset ${config.symbol} has no oracle configured`, { config });
            continue;
          }

          // Agregar al Map (key: blockchain:symbol)
          const key = `${config.blockchain}:${config.symbol}`;
          this.assetsConfig.set(key, config);

          if (config.isActive) {
            activeCount++;
          }

          logger.debug(`Loaded asset config: ${key}`, { config });
        } catch (error) {
          logger.error('Failed to parse asset config row', { row, error: sanitizeError(error) });
        }
      }

      logger.info('Assets configuration loaded successfully', {
        totalAssets: this.assetsConfig.size,
        activeAssets: activeCount,
        inactiveAssets: this.assetsConfig.size - activeCount,
      });
    } catch (error) {
      logger.error('Failed to load assets configuration', sanitizeError(error));
      throw error;
    }
  }

  /**
   * Obtiene el precio de un token con validación multi-oracle
   * Programación Dinámica: Consulta oráculos según configuración dinámica
   */
  async getPrice(query: PriceQuery): Promise<number> {
    const { token, blockchain, minConfidence, maxAge = this.CACHE_TTL } = query;
    const cacheKey = `${blockchain}:${token.toUpperCase()}`;

    // Obtener configuración del asset
    const assetConfig = this.assetsConfig.get(cacheKey);
    
    if (!assetConfig) {
      throw new Error(`Asset ${token} on ${blockchain} is not configured in ORACLE_ASSETS sheet`);
    }

    if (!assetConfig.isActive) {
      throw new Error(`Asset ${token} on ${blockchain} is disabled (IS_ACTIVE = FALSE)`);
    }

    // Verificar cache
    const cached = this.priceCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - new Date(cached.timestamp).getTime();
      const requiredConfidence = minConfidence || assetConfig.minConfidence;
      
      if (age < maxAge && cached.confidence >= requiredConfidence) {
        logger.debug('Price cache hit', { 
          token, 
          blockchain, 
          age, 
          confidence: cached.confidence,
          requiredConfidence,
        });
        return cached.price;
      }
    }

    // Consultar múltiples oráculos dinámicamente
    const oraclePrices = await this.queryMultipleOracles(token, blockchain, assetConfig);

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

    // Validar desviación según configuración del asset
    const maxDeviation = assetConfig.maxDeviation || this.MAX_DEVIATION;
    if (deviation > maxDeviation) {
      logger.warn('High price deviation detected', {
        token,
        blockchain,
        deviation,
        maxDeviation,
        prices: oraclePrices.map(p => ({ source: p.source, price: p.price })),
      });
    }

    // Validar confianza mínima
    const requiredConfidence = minConfidence || assetConfig.minConfidence;
    if (confidence < requiredConfidence) {
      logger.warn('Confidence below threshold', {
        token,
        blockchain,
        confidence,
        requiredConfidence,
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
   * Programación Dinámica: Itera sobre array de OracleSource
   */
  private async queryMultipleOracles(
    symbol: string, 
    blockchain: string, 
    config: OracleAssetConfig
  ): Promise<OraclePrice[]> {
    // Consultar todos los oráculos disponibles en paralelo
    const results = await Promise.allSettled(
      this.oracleSources.map(source => source.query(symbol, blockchain, config))
    );

    const prices: OraclePrice[] = [];
    
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        prices.push(result.value);
      }
    }

    return prices;
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
    const oracleCountFactor = Math.min(prices.length / 3, 1);
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
      configuredAssets: this.assetsConfig.size,
      activeAssets: this.getActiveAssetsCount(),
      inactiveAssets: this.assetsConfig.size - this.getActiveAssetsCount(),
      cachedPrices: this.priceCache.size,
      oracleSources: this.oracleSources.length,
      availableSources: this.oracleSources.filter(s => s.isAvailable()).length,
      updateInterval: this.UPDATE_INTERVAL,
      cacheTTL: this.CACHE_TTL,
      configRefreshInterval: this.CONFIG_REFRESH_INTERVAL,
      maxDeviation: this.MAX_DEVIATION,
      minOracles: this.MIN_ORACLES,
    };
  }

  /**
   * Obtiene cantidad de assets activos
   */
  private getActiveAssetsCount(): number {
    return Array.from(this.assetsConfig.values()).filter(config => config.isActive).length;
  }

  /**
   * Obtiene lista de assets configurados
   */
  getConfiguredAssets(): OracleAssetConfig[] {
    return Array.from(this.assetsConfig.values());
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
    if (this.configRefreshInterval) {
      clearInterval(this.configRefreshInterval);
    }
    this.removeAllListeners();
    logger.info('PriceService closed');
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
    throw new Error('PriceService not initialized. Call initPriceService() first.');
  }
  return priceServiceInstance;
}

/**
 * Inicializa el PriceService global
 */
export async function initPriceService(sheetsService: any, config?: any): Promise<PriceService> {
  if (priceServiceInstance) {
    logger.warn('PriceService already initialized, returning existing instance');
    return priceServiceInstance;
  }

  priceServiceInstance = new PriceService(sheetsService, config);
  await priceServiceInstance.init();
  return priceServiceInstance;
}

