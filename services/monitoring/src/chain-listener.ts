/**
 * ============================================================================
 * ARCHIVO: ./services/monitoring/src/chain-listener.ts
 * SERVICIO: monitoring
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ./alert-manager, ethers, events
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: ChainListener
 *   INTERFACES: CircuitBreakerEvent, BatchExecutedEvent, OperationFailedEvent
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: CircuitBreakerEvent, BatchExecutedEvent, ChainListener
 * 
 * 🔗 DEPENDENCIAS:
 *   - ./alert-manager
 *   - ethers
 *   - events
 * 
 * ============================================================================
 */

/**
 * @file chain-listener.ts
 * @description Listener de eventos on-chain con WebSockets para monitoreo en tiempo real
 * 
 * ARBITRAGEXPLUS2025 - Chain Event Listener
 * 
 * Monitorea eventos emitidos por los contratos ArbitrageManager en múltiples chains:
 * - BatchExecuted: Ejecución de batches
 * - OperationExecuted: Operaciones individuales exitosas
 * - OperationFailed: Operaciones fallidas
 * - CircuitBreakerTriggered: Activación del circuit breaker
 * 
 * Características:
 * - WebSocket connections para baja latencia
 * - Reconexión automática
 * - Filtrado de eventos por chain y contrato
 * - Actualización de Sheets con eventos
 * - Alertas en tiempo real
 */

import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { GoogleSheetsClient } from './google-sheets-client';
import { AlertManager } from './alert-manager';
import { Logger } from './logger';

// ==================================================================================
// TIPOS
// ==================================================================================

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  wsUrl: string;
  arbitrageManagerAddress: string;
  enabled: boolean;
}

export interface BatchExecutedEvent {
  executor: string;
  batchId: ethers.BigNumber;
  totalOperations: ethers.BigNumber;
  successfulOps: ethers.BigNumber;
  totalProfit: ethers.BigNumber;
  gasUsed: ethers.BigNumber;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export interface OperationExecutedEvent {
  batchId: ethers.BigNumber;
  opIndex: ethers.BigNumber;
  tokenIn: string;
  tokenOut: string;
  amountIn: ethers.BigNumber;
  amountOut: ethers.BigNumber;
  profit: ethers.BigNumber;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export interface OperationFailedEvent {
  batchId: ethers.BigNumber;
  opIndex: ethers.BigNumber;
  tokenIn: string;
  tokenOut: string;
  reason: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export interface CircuitBreakerEvent {
  batchId: ethers.BigNumber;
  failedOps: ethers.BigNumber;
  reason: string;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

// ==================================================================================
// CLASE PRINCIPAL
// ==================================================================================

export class ChainListener extends EventEmitter {
  private logger: Logger;
  private sheetsClient: GoogleSheetsClient;
  private alertManager: AlertManager;
  
  // Providers WebSocket por chain
  private wsProviders: Map<number, ethers.providers.WebSocketProvider>;
  
  // Contratos por chain
  private contracts: Map<number, ethers.Contract>;
  
  // Configuración de chains
  private chains: Map<number, ChainConfig>;
  
  // Estado
  private isListening: boolean = false;
  private reconnectAttempts: Map<number, number>;
  private readonly MAX_RECONNECT_ATTEMPTS = 10;
  private readonly RECONNECT_DELAY_MS = 5000;
  
  // Estadísticas
  private stats: {
    totalBatches: number;
    totalOperations: number;
    totalProfit: ethers.BigNumber;
    totalGasUsed: ethers.BigNumber;
    failedOperations: number;
    circuitBreakerActivations: number;
  };
  
  constructor() {
    super();
    
    this.logger = new Logger('ChainListener');
    this.sheetsClient = new GoogleSheetsClient();
    this.alertManager = new AlertManager();
    
    this.wsProviders = new Map();
    this.contracts = new Map();
    this.chains = new Map();
    this.reconnectAttempts = new Map();
    
    this.stats = {
      totalBatches: 0,
      totalOperations: 0,
      totalProfit: ethers.BigNumber.from(0),
      totalGasUsed: ethers.BigNumber.from(0),
      failedOperations: 0,
      circuitBreakerActivations: 0,
    };
  }
  
  // ==================================================================================
  // INICIALIZACIÓN
  // ==================================================================================
  
  /**
   * Inicializa el listener con configuración de chains
   */
  async initialize(chains: ChainConfig[]): Promise<void> {
    this.logger.info('Initializing ChainListener...', {
      chains: chains.length,
    });
    
    for (const chain of chains) {
      if (!chain.enabled) {
        this.logger.debug(`Chain ${chain.name} disabled, skipping`);
        continue;
      }
      
      this.chains.set(chain.chainId, chain);
      this.reconnectAttempts.set(chain.chainId, 0);
      
      await this.connectChain(chain);
    }
    
    this.logger.info('ChainListener initialized', {
      activeChains: this.wsProviders.size,
    });
  }
  
  /**
   * Conecta a una chain específica
   */
  private async connectChain(chain: ChainConfig): Promise<void> {
    try {
      this.logger.info(`Connecting to ${chain.name}...`, {
        chainId: chain.chainId,
        wsUrl: chain.wsUrl,
      });
      
      // Crear WebSocket provider
      const wsProvider = new ethers.providers.WebSocketProvider(
        chain.wsUrl,
        chain.chainId
      );
      
      // Configurar event listeners para reconexión
      wsProvider._websocket.on('error', (error: Error) => {
        this.logger.error(`WebSocket error on ${chain.name}`, error);
        this.handleDisconnect(chain);
      });
      
      wsProvider._websocket.on('close', () => {
        this.logger.warn(`WebSocket closed on ${chain.name}`);
        this.handleDisconnect(chain);
      });
      
      // Crear contrato
      const contract = new ethers.Contract(
        chain.arbitrageManagerAddress,
        this.getArbitrageManagerABI(),
        wsProvider
      );
      
      // Guardar provider y contrato
      this.wsProviders.set(chain.chainId, wsProvider);
      this.contracts.set(chain.chainId, contract);
      
      // Resetear contador de reconexiones
      this.reconnectAttempts.set(chain.chainId, 0);
      
      this.logger.info(`Connected to ${chain.name}`, {
        chainId: chain.chainId,
      });
    } catch (error) {
      this.logger.error(`Failed to connect to ${chain.name}`, error);
      throw error;
    }
  }
  
  /**
   * Maneja desconexiones y reconexión automática
   */
  private async handleDisconnect(chain: ChainConfig): Promise<void> {
    const attempts = this.reconnectAttempts.get(chain.chainId) || 0;
    
    if (attempts >= this.MAX_RECONNECT_ATTEMPTS) {
      this.logger.error(`Max reconnection attempts reached for ${chain.name}`);
      
      // Enviar alerta
      await this.alertManager.sendAlert({
        severity: 'critical',
        title: `Chain Disconnected: ${chain.name}`,
        message: `Failed to reconnect after ${attempts} attempts`,
        chainId: chain.chainId,
      });
      
      return;
    }
    
    this.reconnectAttempts.set(chain.chainId, attempts + 1);
    
    this.logger.warn(`Attempting to reconnect to ${chain.name}...`, {
      attempt: attempts + 1,
      maxAttempts: this.MAX_RECONNECT_ATTEMPTS,
    });
    
    // Esperar antes de reconectar
    await this.sleep(this.RECONNECT_DELAY_MS * (attempts + 1));
    
    try {
      // Limpiar provider anterior
      const oldProvider = this.wsProviders.get(chain.chainId);
      if (oldProvider) {
        await oldProvider.destroy();
        this.wsProviders.delete(chain.chainId);
        this.contracts.delete(chain.chainId);
      }
      
      // Reconectar
      await this.connectChain(chain);
      
      // Si estábamos escuchando, reanudar
      if (this.isListening) {
        await this.startListening();
      }
      
      this.logger.info(`Reconnected to ${chain.name}`);
    } catch (error) {
      this.logger.error(`Reconnection failed for ${chain.name}`, error);
      await this.handleDisconnect(chain);
    }
  }
  
  // ==================================================================================
  // ESCUCHA DE EVENTOS
  // ==================================================================================
  
  /**
   * Inicia la escucha de eventos en todas las chains
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      this.logger.warn('Already listening');
      return;
    }
    
    this.isListening = true;
    this.logger.info('Starting event listening...');
    
    for (const [chainId, contract] of this.contracts.entries()) {
      const chain = this.chains.get(chainId)!;
      
      this.logger.info(`Listening to events on ${chain.name}`);
      
      // BatchExecuted
      contract.on(
        'BatchExecuted',
        async (
          executor: string,
          batchId: ethers.BigNumber,
          totalOperations: ethers.BigNumber,
          successfulOps: ethers.BigNumber,
          totalProfit: ethers.BigNumber,
          gasUsed: ethers.BigNumber,
          event: ethers.Event
        ) => {
          await this.handleBatchExecuted({
            executor,
            batchId,
            totalOperations,
            successfulOps,
            totalProfit,
            gasUsed,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: Date.now(),
          }, chain);
        }
      );
      
      // OperationExecuted
      contract.on(
        'OperationExecuted',
        async (
          batchId: ethers.BigNumber,
          opIndex: ethers.BigNumber,
          tokenIn: string,
          tokenOut: string,
          amountIn: ethers.BigNumber,
          amountOut: ethers.BigNumber,
          profit: ethers.BigNumber,
          event: ethers.Event
        ) => {
          await this.handleOperationExecuted({
            batchId,
            opIndex,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            profit,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: Date.now(),
          }, chain);
        }
      );
      
      // OperationFailed
      contract.on(
        'OperationFailed',
        async (
          batchId: ethers.BigNumber,
          opIndex: ethers.BigNumber,
          tokenIn: string,
          tokenOut: string,
          reason: string,
          event: ethers.Event
        ) => {
          await this.handleOperationFailed({
            batchId,
            opIndex,
            tokenIn,
            tokenOut,
            reason,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: Date.now(),
          }, chain);
        }
      );
      
      // CircuitBreakerTriggered
      contract.on(
        'CircuitBreakerTriggered',
        async (
          batchId: ethers.BigNumber,
          failedOps: ethers.BigNumber,
          reason: string,
          event: ethers.Event
        ) => {
          await this.handleCircuitBreakerTriggered({
            batchId,
            failedOps,
            reason,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: Date.now(),
          }, chain);
        }
      );
    }
    
    this.logger.info('Event listening started', {
      chains: this.contracts.size,
    });
  }
  
  /**
   * Detiene la escucha de eventos
   */
  async stopListening(): Promise<void> {
    if (!this.isListening) {
      return;
    }
    
    this.isListening = false;
    this.logger.info('Stopping event listening...');
    
    // Remover todos los listeners
    for (const contract of this.contracts.values()) {
      contract.removeAllListeners();
    }
    
    // Cerrar WebSocket providers
    for (const provider of this.wsProviders.values()) {
      await provider.destroy();
    }
    
    this.wsProviders.clear();
    this.contracts.clear();
    
    this.logger.info('Event listening stopped');
  }
  
  // ==================================================================================
  // HANDLERS DE EVENTOS
  // ==================================================================================
  
  /**
   * Maneja evento BatchExecuted
   */
  private async handleBatchExecuted(
    event: BatchExecutedEvent,
    chain: ChainConfig
  ): Promise<void> {
    this.logger.info('BatchExecuted event', {
      chain: chain.name,
      batchId: event.batchId.toString(),
      totalOps: event.totalOperations.toString(),
      successfulOps: event.successfulOps.toString(),
      profit: ethers.utils.formatEther(event.totalProfit),
      txHash: event.transactionHash,
    });
    
    // Actualizar estadísticas
    this.stats.totalBatches++;
    this.stats.totalOperations += event.totalOperations.toNumber();
    this.stats.totalProfit = this.stats.totalProfit.add(event.totalProfit);
    this.stats.totalGasUsed = this.stats.totalGasUsed.add(event.gasUsed);
    
    // Emitir evento
    this.emit('batchExecuted', {
      ...event,
      chain: chain.name,
      chainId: chain.chainId,
    });
    
    // Actualizar Sheets
    try {
      await this.sheetsClient.addExecution({
        batchId: event.batchId.toString(),
        chain: chain.name,
        executor: event.executor,
        totalOps: event.totalOperations.toNumber(),
        successfulOps: event.successfulOps.toNumber(),
        profit: ethers.utils.formatEther(event.totalProfit),
        gasUsed: event.gasUsed.toString(),
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.error('Failed to update Sheets with batch execution', error);
    }
    
    // Enviar alerta si el profit es alto
    const profitEth = parseFloat(ethers.utils.formatEther(event.totalProfit));
    if (profitEth > 1.0) {
      await this.alertManager.sendAlert({
        severity: 'info',
        title: 'High Profit Batch Executed',
        message: `Batch ${event.batchId} generated ${profitEth.toFixed(4)} ETH profit on ${chain.name}`,
        chainId: chain.chainId,
        txHash: event.transactionHash,
      });
    }
  }
  
  /**
   * Maneja evento OperationExecuted
   */
  private async handleOperationExecuted(
    event: OperationExecutedEvent,
    chain: ChainConfig
  ): Promise<void> {
    this.logger.debug('OperationExecuted event', {
      chain: chain.name,
      batchId: event.batchId.toString(),
      opIndex: event.opIndex.toString(),
      profit: ethers.utils.formatEther(event.profit),
    });
    
    // Emitir evento
    this.emit('operationExecuted', {
      ...event,
      chain: chain.name,
      chainId: chain.chainId,
    });
  }
  
  /**
   * Maneja evento OperationFailed
   */
  private async handleOperationFailed(
    event: OperationFailedEvent,
    chain: ChainConfig
  ): Promise<void> {
    this.logger.warn('OperationFailed event', {
      chain: chain.name,
      batchId: event.batchId.toString(),
      opIndex: event.opIndex.toString(),
      reason: event.reason,
    });
    
    // Actualizar estadísticas
    this.stats.failedOperations++;
    
    // Emitir evento
    this.emit('operationFailed', {
      ...event,
      chain: chain.name,
      chainId: chain.chainId,
    });
    
    // Actualizar Sheets con fallo
    try {
      await this.sheetsClient.addAlert({
        severity: 'warning',
        chain: chain.name,
        message: `Operation failed: ${event.reason}`,
        batchId: event.batchId.toString(),
        opIndex: event.opIndex.toNumber(),
        txHash: event.transactionHash,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.error('Failed to update Sheets with operation failure', error);
    }
  }
  
  /**
   * Maneja evento CircuitBreakerTriggered
   */
  private async handleCircuitBreakerTriggered(
    event: CircuitBreakerEvent,
    chain: ChainConfig
  ): Promise<void> {
    this.logger.error('CircuitBreakerTriggered event', {
      chain: chain.name,
      batchId: event.batchId.toString(),
      failedOps: event.failedOps.toString(),
      reason: event.reason,
    });
    
    // Actualizar estadísticas
    this.stats.circuitBreakerActivations++;
    
    // Emitir evento
    this.emit('circuitBreakerTriggered', {
      ...event,
      chain: chain.name,
      chainId: chain.chainId,
    });
    
    // Enviar alerta crítica
    await this.alertManager.sendAlert({
      severity: 'critical',
      title: `Circuit Breaker Activated: ${chain.name}`,
      message: `Circuit breaker triggered on batch ${event.batchId}: ${event.reason}`,
      chainId: chain.chainId,
      txHash: event.transactionHash,
    });
    
    // Actualizar Sheets
    try {
      await this.sheetsClient.addAlert({
        severity: 'critical',
        chain: chain.name,
        message: `Circuit breaker triggered: ${event.reason}`,
        batchId: event.batchId.toString(),
        failedOps: event.failedOps.toNumber(),
        txHash: event.transactionHash,
        timestamp: event.timestamp,
      });
    } catch (error) {
      this.logger.error('Failed to update Sheets with circuit breaker event', error);
    }
  }
  
  // ==================================================================================
  // HELPERS
  // ==================================================================================
  
  /**
   * Obtiene el ABI del contrato ArbitrageManager
   */
  private getArbitrageManagerABI(): any[] {
    return [
      'event BatchExecuted(address indexed executor, uint256 indexed batchId, uint256 totalOperations, uint256 successfulOps, uint256 totalProfit, uint256 gasUsed)',
      'event OperationExecuted(uint256 indexed batchId, uint256 indexed opIndex, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, uint256 profit)',
      'event OperationFailed(uint256 indexed batchId, uint256 indexed opIndex, address tokenIn, address tokenOut, string reason)',
      'event CircuitBreakerTriggered(uint256 indexed batchId, uint256 failedOps, string reason)',
    ];
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  /**
   * Obtiene estadísticas
   */
  getStats() {
    return {
      ...this.stats,
      totalProfit: ethers.utils.formatEther(this.stats.totalProfit),
      activeChains: this.wsProviders.size,
      isListening: this.isListening,
    };
  }
}

