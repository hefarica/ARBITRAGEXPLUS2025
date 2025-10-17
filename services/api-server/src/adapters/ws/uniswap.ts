/**
 * ARBITRAGEXPLUS2025 - Uniswap WebSocket Adapter
 * 
 * Adaptador dinámico para Uniswap V2/V3 que:
 * - Se configura desde Google Sheets (DEXES y POOLS)
 * - Monitorea precios y liquidez en tiempo real
 * - Soporta múltiples chains
 * - Emite eventos para el sistema de arbitraje
 * - NO tiene hardcoding de pools o addresses
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { ethers } from 'ethers';

// ==================================================================================
// TYPES & INTERFACES
// ==================================================================================

interface UniswapConfig {
  dexId: string;
  name: string;
  version: 'v2' | 'v3';
  chainId: number;
  routerAddress: string;
  factoryAddress: string;
  wssUrl?: string;
  rpcUrl: string;
  isActive: boolean;
}

interface PoolConfig {
  poolId: string;
  address: string;
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
  fee: number;
  isActive: boolean;
}

interface PriceUpdate {
  poolId: string;
  poolAddress: string;
  token0: string;
  token1: string;
  reserve0: string;
  reserve1: string;
  price: number;
  timestamp: number;
  blockNumber: number;
}

interface SwapEvent {
  poolId: string;
  poolAddress: string;
  sender: string;
  amount0In: string;
  amount1In: string;
  amount0Out: string;
  amount1Out: string;
  to: string;
  txHash: string;
  blockNumber: number;
  timestamp: number;
}

// ==================================================================================
// UNISWAP ADAPTER CLASS
// ==================================================================================

export class UniswapAdapter extends EventEmitter {
  private config: UniswapConfig;
  private pools: Map<string, PoolConfig> = new Map();
  private provider: ethers.providers.WebSocketProvider | null = null;
  private contracts: Map<string, ethers.Contract> = new Map();
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private reconnectDelay: number = 5000;

  // ABIs mínimos para eventos
  private readonly PAIR_ABI = [
    'event Sync(uint112 reserve0, uint112 reserve1)',
    'event Swap(address indexed sender, uint amount0In, uint amount1In, uint amount0Out, uint amount1Out, address indexed to)',
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
  ];

  constructor(config: UniswapConfig) {
    super();
    this.config = config;
  }

  // ================================================================================
  // CONNECTION MANAGEMENT
  // ================================================================================

  /**
   * Conectar al provider WebSocket
   */
  async connect(): Promise<void> {
    try {
      if (this.isConnected) {
        console.log(`[UniswapAdapter] Ya conectado a ${this.config.name}`);
        return;
      }

      console.log(`[UniswapAdapter] Conectando a ${this.config.name} en chain ${this.config.chainId}...`);

      // Crear provider WebSocket
      const wsUrl = this.config.wssUrl || this.config.rpcUrl;
      this.provider = new ethers.providers.WebSocketProvider(wsUrl, this.config.chainId);

      // Configurar event listeners del provider
      this.setupProviderListeners();

      // Esperar a que el provider esté listo
      await this.provider.ready;

      this.isConnected = true;
      this.reconnectAttempts = 0;

      console.log(`[UniswapAdapter] ✅ Conectado a ${this.config.name}`);
      this.emit('connected', { dexId: this.config.dexId });

    } catch (error) {
      console.error(`[UniswapAdapter] Error conectando:`, error);
      this.handleReconnect();
      throw error;
    }
  }

  /**
   * Desconectar del provider
   */
  async disconnect(): Promise<void> {
    try {
      console.log(`[UniswapAdapter] Desconectando de ${this.config.name}...`);

      // Limpiar contratos
      this.contracts.clear();

      // Cerrar provider
      if (this.provider) {
        await this.provider.destroy();
        this.provider = null;
      }

      this.isConnected = false;
      console.log(`[UniswapAdapter] ✅ Desconectado de ${this.config.name}`);
      this.emit('disconnected', { dexId: this.config.dexId });

    } catch (error) {
      console.error(`[UniswapAdapter] Error desconectando:`, error);
    }
  }

  /**
   * Configurar listeners del provider
   */
  private setupProviderListeners(): void {
    if (!this.provider) return;

    this.provider.on('error', (error) => {
      console.error(`[UniswapAdapter] Provider error:`, error);
      this.emit('error', { dexId: this.config.dexId, error });
      this.handleReconnect();
    });

    this.provider.on('close', () => {
      console.log(`[UniswapAdapter] Provider closed`);
      this.isConnected = false;
      this.handleReconnect();
    });
  }

  /**
   * Manejar reconexión automática
   */
  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`[UniswapAdapter] Máximo de intentos de reconexión alcanzado`);
      this.emit('reconnect_failed', { dexId: this.config.dexId });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * this.reconnectAttempts;

    console.log(`[UniswapAdapter] Reintentando conexión en ${delay}ms (intento ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error(`[UniswapAdapter] Error en reconexión:`, error);
      }
    }, delay);
  }

  // ================================================================================
  // POOL MANAGEMENT (DYNAMIC FROM SHEETS)
  // ================================================================================

  /**
   * Cargar pools desde configuración dinámica (Google Sheets)
   */
  async loadPools(pools: PoolConfig[]): Promise<void> {
    console.log(`[UniswapAdapter] Cargando ${pools.length} pools desde configuración...`);

    this.pools.clear();

    for (const pool of pools) {
      if (pool.isActive) {
        this.pools.set(pool.poolId, pool);
      }
    }

    console.log(`[UniswapAdapter] ✅ ${this.pools.size} pools activos cargados`);
    this.emit('pools_loaded', { dexId: this.config.dexId, count: this.pools.size });
  }

  /**
   * Suscribirse a un pool específico
   */
  async subscribeToPool(poolId: string): Promise<void> {
    const pool = this.pools.get(poolId);
    
    if (!pool) {
      throw new Error(`Pool ${poolId} no encontrado en configuración`);
    }

    if (!this.provider) {
      throw new Error('Provider no conectado');
    }

    try {
      console.log(`[UniswapAdapter] Suscribiendo a pool ${poolId} (${pool.token0Symbol}/${pool.token1Symbol})...`);

      // Crear contrato para el pool
      const contract = new ethers.Contract(
        pool.address,
        this.PAIR_ABI,
        this.provider
      );

      this.contracts.set(poolId, contract);

      // Suscribirse a eventos Sync (cambios de reservas)
      contract.on('Sync', async (reserve0: ethers.BigNumber, reserve1: ethers.BigNumber, event: any) => {
        await this.handleSyncEvent(poolId, pool, reserve0, reserve1, event);
      });

      // Suscribirse a eventos Swap
      contract.on('Swap', async (
        sender: string,
        amount0In: ethers.BigNumber,
        amount1In: ethers.BigNumber,
        amount0Out: ethers.BigNumber,
        amount1Out: ethers.BigNumber,
        to: string,
        event: any
      ) => {
        await this.handleSwapEvent(poolId, pool, sender, amount0In, amount1In, amount0Out, amount1Out, to, event);
      });

      // Obtener reservas iniciales
      await this.fetchInitialReserves(poolId, pool, contract);

      console.log(`[UniswapAdapter] ✅ Suscrito a pool ${poolId}`);
      this.emit('pool_subscribed', { dexId: this.config.dexId, poolId });

    } catch (error) {
      console.error(`[UniswapAdapter] Error suscribiendo a pool ${poolId}:`, error);
      throw error;
    }
  }

  /**
   * Suscribirse a todos los pools activos
   */
  async subscribeToAllPools(): Promise<void> {
    console.log(`[UniswapAdapter] Suscribiendo a ${this.pools.size} pools...`);

    const subscriptions = Array.from(this.pools.keys()).map(poolId =>
      this.subscribeToPool(poolId).catch(error => {
        console.error(`[UniswapAdapter] Error suscribiendo a ${poolId}:`, error);
      })
    );

    await Promise.all(subscriptions);

    console.log(`[UniswapAdapter] ✅ Suscripciones completadas`);
  }

  /**
   * Desuscribirse de un pool
   */
  async unsubscribeFromPool(poolId: string): Promise<void> {
    const contract = this.contracts.get(poolId);

    if (contract) {
      contract.removeAllListeners();
      this.contracts.delete(poolId);
      console.log(`[UniswapAdapter] Desuscrito de pool ${poolId}`);
      this.emit('pool_unsubscribed', { dexId: this.config.dexId, poolId });
    }
  }

  // ================================================================================
  // EVENT HANDLERS
  // ================================================================================

  /**
   * Manejar evento Sync (cambio de reservas)
   */
  private async handleSyncEvent(
    poolId: string,
    pool: PoolConfig,
    reserve0: ethers.BigNumber,
    reserve1: ethers.BigNumber,
    event: any
  ): Promise<void> {
    try {
      const reserve0Str = reserve0.toString();
      const reserve1Str = reserve1.toString();

      // Calcular precio (token1/token0)
      const price = parseFloat(reserve1Str) / parseFloat(reserve0Str);

      const priceUpdate: PriceUpdate = {
        poolId,
        poolAddress: pool.address,
        token0: pool.token0,
        token1: pool.token1,
        reserve0: reserve0Str,
        reserve1: reserve1Str,
        price,
        timestamp: Date.now(),
        blockNumber: event.blockNumber,
      };

      // Emitir evento de actualización de precio
      this.emit('price_update', priceUpdate);

    } catch (error) {
      console.error(`[UniswapAdapter] Error procesando Sync event:`, error);
    }
  }

  /**
   * Manejar evento Swap
   */
  private async handleSwapEvent(
    poolId: string,
    pool: PoolConfig,
    sender: string,
    amount0In: ethers.BigNumber,
    amount1In: ethers.BigNumber,
    amount0Out: ethers.BigNumber,
    amount1Out: ethers.BigNumber,
    to: string,
    event: any
  ): Promise<void> {
    try {
      const swapEvent: SwapEvent = {
        poolId,
        poolAddress: pool.address,
        sender,
        amount0In: amount0In.toString(),
        amount1In: amount1In.toString(),
        amount0Out: amount0Out.toString(),
        amount1Out: amount1Out.toString(),
        to,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: Date.now(),
      };

      // Emitir evento de swap
      this.emit('swap', swapEvent);

    } catch (error) {
      console.error(`[UniswapAdapter] Error procesando Swap event:`, error);
    }
  }

  /**
   * Obtener reservas iniciales de un pool
   */
  private async fetchInitialReserves(
    poolId: string,
    pool: PoolConfig,
    contract: ethers.Contract
  ): Promise<void> {
    try {
      const reserves = await contract.getReserves();
      const blockNumber = await this.provider!.getBlockNumber();

      const priceUpdate: PriceUpdate = {
        poolId,
        poolAddress: pool.address,
        token0: pool.token0,
        token1: pool.token1,
        reserve0: reserves.reserve0.toString(),
        reserve1: reserves.reserve1.toString(),
        price: parseFloat(reserves.reserve1.toString()) / parseFloat(reserves.reserve0.toString()),
        timestamp: Date.now(),
        blockNumber,
      };

      this.emit('price_update', priceUpdate);

    } catch (error) {
      console.error(`[UniswapAdapter] Error obteniendo reservas iniciales:`, error);
    }
  }

  // ================================================================================
  // UTILITIES
  // ================================================================================

  /**
   * Verificar si está conectado
   */
  isAdapterConnected(): boolean {
    return this.isConnected && this.provider !== null;
  }

  /**
   * Obtener configuración
   */
  getConfig(): UniswapConfig {
    return { ...this.config };
  }

  /**
   * Obtener pools activos
   */
  getActivePools(): PoolConfig[] {
    return Array.from(this.pools.values());
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    return {
      dexId: this.config.dexId,
      name: this.config.name,
      chainId: this.config.chainId,
      isConnected: this.isConnected,
      poolsLoaded: this.pools.size,
      poolsSubscribed: this.contracts.size,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export default UniswapAdapter;

