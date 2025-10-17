/**
 * ARBITRAGEXPLUS2025 - Market Data Service
 * 
 * Servicio integrador que coordina:
 * - Adaptadores DEX (Uniswap, SushiSwap, PancakeSwap)
 * - Oráculos de precios (Pyth, Chainlink)
 * - Google Sheets (configuración dinámica)
 * - Eventos en tiempo real
 * 
 * Este servicio es el "hub" central de datos de mercado para el sistema de arbitraje.
 */

import { EventEmitter } from 'events';
import { logger } from '@logger';
import { UniswapAdapter } from '@adapters/ws/uniswap';
import { SushiSwapAdapter } from '@adapters/ws/sushiswap';
import { PancakeSwapAdapter } from '@adapters/ws/pancakeswap';
import { PythOracle } from '@oracles/pyth';
import { ChainlinkOracle } from '@oracles/chainlink';
import { SheetsService } from '@services/sheetsService';
import { BusinessError, SystemError } from '@errors';

// ==================================================================================
// TYPES & INTERFACES
// ==================================================================================

interface MarketDataConfig {
  enabledDexes: string[];
  enabledOracles: string[];
  priceUpdateInterval: number;
  maxCacheAge: number;
}

interface PriceData {
  symbol: string;
  price: number;
  source: 'pyth' | 'chainlink' | 'dex';
  confidence: number;
  timestamp: number;
  metadata?: any;
}

interface PoolLiquidity {
  poolId: string;
  dexId: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  tvlUSD: number;
  price: number;
  timestamp: number;
}

interface MarketOpportunity {
  type: 'arbitrage' | 'price_divergence' | 'liquidity_imbalance';
  tokens: string[];
  dexes: string[];
  estimatedProfitUSD: number;
  confidence: number;
  timestamp: number;
  metadata: any;
}

// ==================================================================================
// MARKET DATA SERVICE CLASS
// ==================================================================================

export class MarketDataService extends EventEmitter {
  private sheetsService: SheetsService;
  private pythOracle: PythOracle;
  private chainlinkOracle: ChainlinkOracle;
  
  // Adaptadores DEX
  private dexAdapters: Map<string, any> = new Map();
  
  // Cache de datos
  private priceCache: Map<string, PriceData> = new Map();
  private liquidityCache: Map<string, PoolLiquidity> = new Map();
  
  // Estado
  private isInitialized = false;
  private config: MarketDataConfig;

  constructor(config?: Partial<MarketDataConfig>) {
    super();
    
    this.config = {
      enabledDexes: config?.enabledDexes || ['uniswap', 'sushiswap', 'pancakeswap'],
      enabledOracles: config?.enabledOracles || ['pyth', 'chainlink'],
      priceUpdateInterval: config?.priceUpdateInterval || 5000,
      maxCacheAge: config?.maxCacheAge || 10000,
    };

    this.sheetsService = new SheetsService();
  }

  // ================================================================================
  // INITIALIZATION
  // ================================================================================

  /**
   * Inicializar servicio de datos de mercado
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        logger.warn('MarketDataService already initialized');
        return;
      }

      logger.info('🚀 Initializing MarketDataService...');

      // 1. Cargar configuración desde Google Sheets
      await this.loadConfiguration();

      // 2. Inicializar oráculos
      await this.initializeOracles();

      // 3. Inicializar adaptadores DEX
      await this.initializeDexAdapters();

      // 4. Configurar event listeners
      this.setupEventListeners();

      // 5. Iniciar actualizaciones periódicas
      this.startPeriodicUpdates();

      this.isInitialized = true;
      logger.info('✅ MarketDataService initialized successfully');

      this.emit('initialized');

    } catch (error) {
      logger.error('❌ Failed to initialize MarketDataService:', error);
      throw new SystemError('MarketDataService initialization failed', {
        context: { error: error.message }
      });
    }
  }

  /**
   * Cargar configuración desde Google Sheets
   */
  private async loadConfiguration(): Promise<void> {
    try {
      logger.info('📊 Loading configuration from Google Sheets...');

      // Cargar DEXes activos
      const dexes = await this.sheetsService.getDEXes();
      const activeDexes = dexes.filter(dex => dex.IS_ACTIVE === 'TRUE');
      
      logger.info(`✅ Loaded ${activeDexes.length} active DEXes`);

      // Cargar assets para oráculos
      const assets = await this.sheetsService.getAssets();
      const activeAssets = assets.filter(asset => asset.IS_ACTIVE === 'TRUE');
      
      logger.info(`✅ Loaded ${activeAssets.length} active assets`);

      // Cargar pools activos
      const pools = await this.sheetsService.getPools();
      const activePools = pools.filter(pool => pool.IS_ACTIVE === 'TRUE');
      
      logger.info(`✅ Loaded ${activePools.length} active pools`);

      // Guardar en contexto
      this.context = {
        dexes: activeDexes,
        assets: activeAssets,
        pools: activePools
      };

    } catch (error) {
      logger.error('❌ Error loading configuration:', error);
      throw error;
    }
  }

  /**
   * Inicializar oráculos de precios
   */
  private async initializeOracles(): Promise<void> {
    try {
      logger.info('🔮 Initializing price oracles...');

      const assets = this.context.assets;

      // Inicializar Pyth Oracle
      if (this.config.enabledOracles.includes('pyth')) {
        this.pythOracle = new PythOracle(assets);
        logger.info('✅ Pyth Oracle initialized');
      }

      // Inicializar Chainlink Oracle
      if (this.config.enabledOracles.includes('chainlink')) {
        this.chainlinkOracle = new ChainlinkOracle(assets);
        logger.info('✅ Chainlink Oracle initialized');
      }

    } catch (error) {
      logger.error('❌ Error initializing oracles:', error);
      throw error;
    }
  }

  /**
   * Inicializar adaptadores DEX
   */
  private async initializeDexAdapters(): Promise<void> {
    try {
      logger.info('🔗 Initializing DEX adapters...');

      const dexes = this.context.dexes;

      for (const dex of dexes) {
        const dexType = dex.DEX_TYPE.toLowerCase();
        const dexId = dex.DEX_ID;

        // Crear configuración del adaptador
        const adapterConfig = {
          dexId: dexId,
          name: dex.DEX_NAME,
          chainId: parseInt(dex.CHAIN_ID),
          routerAddress: dex.ROUTER_ADDRESS,
          factoryAddress: dex.FACTORY_ADDRESS,
          rpcUrl: this.getRpcUrlForChain(parseInt(dex.CHAIN_ID)),
          wssUrl: dex.WSS_URL || undefined,
          isActive: dex.IS_ACTIVE === 'TRUE',
        };

        // Crear adaptador según tipo
        let adapter;
        
        if (dexType.includes('uniswap')) {
          adapter = new UniswapAdapter({
            ...adapterConfig,
            version: dex.VERSION as 'v2' | 'v3',
          });
        } else if (dexType.includes('sushi')) {
          adapter = new SushiSwapAdapter({
            ...adapterConfig,
            masterChefAddress: dex.MASTERCHEF_ADDRESS,
            rewardsEnabled: dex.REWARDS_ENABLED === 'TRUE',
          });
        } else if (dexType.includes('pancake')) {
          adapter = new PancakeSwapAdapter({
            ...adapterConfig,
            version: dex.VERSION as 'v2' | 'v3',
            masterChefAddress: dex.MASTERCHEF_ADDRESS,
            cakeTokenAddress: dex.CAKE_TOKEN_ADDRESS,
            farmsEnabled: dex.FARMS_ENABLED === 'TRUE',
            syrupPoolsEnabled: dex.SYRUP_POOLS_ENABLED === 'TRUE',
          });
        } else {
          logger.warn(`⚠️ Unknown DEX type: ${dexType}, skipping ${dexId}`);
          continue;
        }

        // Conectar adaptador
        await adapter.connect();

        // Cargar pools para este DEX
        const dexPools = this.context.pools.filter(pool => pool.DEX_ID === dexId);
        
        const poolConfigs = dexPools.map(pool => ({
          poolId: pool.POOL_ID,
          address: pool.POOL_ADDRESS,
          token0: pool.TOKEN_A,
          token1: pool.TOKEN_B,
          token0Symbol: pool.TOKEN_A_SYMBOL,
          token1Symbol: pool.TOKEN_B_SYMBOL,
          fee: parseInt(pool.FEE_BPS),
          isActive: pool.IS_ACTIVE === 'TRUE',
        }));

        await adapter.loadPools(poolConfigs);
        await adapter.subscribeToAllPools();

        // Guardar adaptador
        this.dexAdapters.set(dexId, adapter);

        logger.info(`✅ ${dex.DEX_NAME} adapter initialized with ${poolConfigs.length} pools`);
      }

      logger.info(`✅ Initialized ${this.dexAdapters.size} DEX adapters`);

    } catch (error) {
      logger.error('❌ Error initializing DEX adapters:', error);
      throw error;
    }
  }

  /**
   * Configurar event listeners para adaptadores
   */
  private setupEventListeners(): void {
    logger.info('📡 Setting up event listeners...');

    for (const [dexId, adapter] of this.dexAdapters.entries()) {
      // Price updates
      adapter.on('price_update', (priceUpdate: any) => {
        this.handlePriceUpdate(dexId, priceUpdate);
      });

      // Swap events
      adapter.on('swap', (swapEvent: any) => {
        this.handleSwapEvent(dexId, swapEvent);
      });

      // Connection events
      adapter.on('connected', () => {
        logger.info(`✅ ${dexId} connected`);
        this.emit('dex_connected', { dexId });
      });

      adapter.on('disconnected', () => {
        logger.warn(`⚠️ ${dexId} disconnected`);
        this.emit('dex_disconnected', { dexId });
      });

      // Error events
      adapter.on('error', (error: any) => {
        logger.error(`❌ ${dexId} error:`, error);
        this.emit('dex_error', { dexId, error });
      });
    }

    logger.info('✅ Event listeners configured');
  }

  /**
   * Iniciar actualizaciones periódicas
   */
  private startPeriodicUpdates(): void {
    // Actualizar precios de oráculos periódicamente
    setInterval(async () => {
      try {
        await this.updateOraclePrices();
      } catch (error) {
        logger.error('Error updating oracle prices:', error);
      }
    }, this.config.priceUpdateInterval);

    logger.info(`✅ Periodic updates started (interval: ${this.config.priceUpdateInterval}ms)`);
  }

  // ================================================================================
  // EVENT HANDLERS
  // ================================================================================

  /**
   * Manejar actualización de precio desde DEX
   */
  private handlePriceUpdate(dexId: string, priceUpdate: any): void {
    const { poolId, token0, token1, price, reserve0, reserve1, timestamp } = priceUpdate;

    // Actualizar cache de liquidez
    const liquidity: PoolLiquidity = {
      poolId,
      dexId,
      token0,
      token1,
      reserve0,
      reserve1,
      tvlUSD: 0, // TODO: Calcular TVL
      price,
      timestamp,
    };

    this.liquidityCache.set(poolId, liquidity);

    // Emitir evento
    this.emit('liquidity_update', liquidity);

    // Detectar oportunidades
    this.detectOpportunities(liquidity);
  }

  /**
   * Manejar evento de swap
   */
  private handleSwapEvent(dexId: string, swapEvent: any): void {
    logger.debug(`Swap detected on ${dexId}:`, {
      pool: swapEvent.poolId,
      txHash: swapEvent.txHash,
    });

    // Emitir evento
    this.emit('swap_detected', { dexId, ...swapEvent });
  }

  // ================================================================================
  // PRICE QUERIES
  // ================================================================================

  /**
   * Obtener precio de un token con validación multi-oráculo
   */
  async getPrice(symbol: string): Promise<PriceData | null> {
    try {
      // 1. Intentar obtener de Pyth (fuente primaria)
      if (this.pythOracle) {
        const pythPrice = await this.pythOracle.getPrice(symbol);
        if (pythPrice) {
          const priceData: PriceData = {
            symbol,
            price: pythPrice.price,
            source: 'pyth',
            confidence: pythPrice.confidence / pythPrice.price,
            timestamp: pythPrice.publishTime * 1000,
            metadata: pythPrice,
          };

          // 2. Validar con Chainlink
          if (this.chainlinkOracle) {
            const comparison = await this.chainlinkOracle.comparePriceWithPyth(
              symbol,
              pythPrice.price
            );

            if (!comparison.isValid) {
              logger.warn(`⚠️ Price divergence detected for ${symbol}:`, comparison);
              this.emit('price_divergence', { symbol, ...comparison });
            }
          }

          // Guardar en cache
          this.priceCache.set(symbol, priceData);

          return priceData;
        }
      }

      // 3. Fallback a Chainlink
      if (this.chainlinkOracle) {
        const chainlinkPrice = await this.chainlinkOracle.getPriceWithFallback(symbol);
        if (chainlinkPrice) {
          const priceData: PriceData = {
            symbol,
            price: chainlinkPrice.price,
            source: 'chainlink',
            confidence: 1.0,
            timestamp: chainlinkPrice.updatedAt * 1000,
            metadata: chainlinkPrice,
          };

          this.priceCache.set(symbol, priceData);

          return priceData;
        }
      }

      // 4. Fallback a precio de DEX
      return this.getPriceFromDex(symbol);

    } catch (error) {
      logger.error(`Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Obtener precio desde DEX (fallback)
   */
  private getPriceFromDex(symbol: string): PriceData | null {
    // Buscar en cache de liquidez
    for (const liquidity of this.liquidityCache.values()) {
      if (liquidity.token0 === symbol || liquidity.token1 === symbol) {
        return {
          symbol,
          price: liquidity.price,
          source: 'dex',
          confidence: 0.8,
          timestamp: liquidity.timestamp,
          metadata: liquidity,
        };
      }
    }

    return null;
  }

  /**
   * Actualizar precios de oráculos
   */
  private async updateOraclePrices(): Promise<void> {
    try {
      const symbols = this.context.assets.map((a: any) => a.TOKEN_SYMBOL);

      // Actualizar Pyth
      if (this.pythOracle) {
        await this.pythOracle.getCurrentPrices(symbols);
      }

      // Actualizar Chainlink
      if (this.chainlinkOracle) {
        await this.chainlinkOracle.getPrices(symbols);
      }

    } catch (error) {
      logger.error('Error updating oracle prices:', error);
    }
  }

  // ================================================================================
  // OPPORTUNITY DETECTION
  // ================================================================================

  /**
   * Detectar oportunidades de arbitraje
   */
  private detectOpportunities(liquidity: PoolLiquidity): void {
    // TODO: Implementar lógica de detección de oportunidades
    // Por ahora solo emitimos el evento
    
    // Ejemplo: detectar si hay diferencia de precio significativa entre DEXes
    const similarPools = Array.from(this.liquidityCache.values()).filter(
      l => (l.token0 === liquidity.token0 && l.token1 === liquidity.token1) ||
           (l.token0 === liquidity.token1 && l.token1 === liquidity.token0)
    );

    if (similarPools.length > 1) {
      // Calcular diferencia de precio
      const prices = similarPools.map(p => p.price);
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const priceDiff = (maxPrice - minPrice) / minPrice;

      if (priceDiff > 0.005) { // 0.5% diferencia
        const opportunity: MarketOpportunity = {
          type: 'arbitrage',
          tokens: [liquidity.token0, liquidity.token1],
          dexes: similarPools.map(p => p.dexId),
          estimatedProfitUSD: 0, // TODO: Calcular
          confidence: 0.8,
          timestamp: Date.now(),
          metadata: { priceDiff, pools: similarPools },
        };

        this.emit('opportunity_detected', opportunity);
      }
    }
  }

  // ================================================================================
  // UTILITIES
  // ================================================================================

  /**
   * Obtener RPC URL para una chain
   */
  private getRpcUrlForChain(chainId: number): string {
    const rpcUrls: { [key: number]: string } = {
      1: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      56: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
      137: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      10: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
      43114: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    };

    return rpcUrls[chainId] || rpcUrls[1];
  }

  /**
   * Obtener estadísticas del servicio
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      dexAdapters: this.dexAdapters.size,
      cachedPrices: this.priceCache.size,
      cachedLiquidity: this.liquidityCache.size,
      enabledOracles: this.config.enabledOracles,
      enabledDexes: this.config.enabledDexes,
    };
  }

  /**
   * Shutdown del servicio
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down MarketDataService...');

    // Desconectar adaptadores
    for (const [dexId, adapter] of this.dexAdapters.entries()) {
      try {
        await adapter.disconnect();
        logger.info(`✅ ${dexId} disconnected`);
      } catch (error) {
        logger.error(`Error disconnecting ${dexId}:`, error);
      }
    }

    this.isInitialized = false;
    logger.info('✅ MarketDataService shutdown complete');
  }

  // Contexto temporal
  private context: any = {};
}

// Singleton instance
export const marketDataService = new MarketDataService();

