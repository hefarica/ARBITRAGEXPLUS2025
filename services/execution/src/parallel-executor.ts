/**
 * ============================================================================
 * ARCHIVO: ./services/execution/src/parallel-executor.ts
 * SERVICIO: execution
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: p-limit, ./transaction-builder, ethers
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: ParallelExecutor
 *   FUNCIONES: executeBatch
 *   INTERFACES: ParallelExecutorConfig, ExecutionResult, ArbitrageOpportunity
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: ParallelExecutorConfig, ExecutionResult, ArbitrageOpportunity
 * 
 * 🔗 DEPENDENCIAS:
 *   - p-limit
 *   - ./transaction-builder
 *   - ethers
 * 
 * ============================================================================
 */

/**
 * @file parallel-executor.ts
 * @description Orquestador de ejecución paralela de hasta 40 operaciones atómicas simultáneas
 * 
 * ARBITRAGEXPLUS2025 - Parallel Execution Engine
 * 
 * Este módulo es el núcleo del sistema de ejecución paralela. Coordina:
 * - Lectura de oportunidades desde Google Sheets
 * - Validación de precios con múltiples oráculos (Pyth, Chainlink, Band)
 * - Construcción de transacciones batch
 * - Ejecución atómica en blockchain
 * - Actualización de resultados en Sheets
 * 
 * Características:
 * - Hasta 40 operaciones simultáneas en un solo bloque
 * - Multi-oracle validation (3 oráculos mínimo)
 * - Gas optimization y circuit breakers
 * - Retry logic con backoff exponencial
 * - Monitoring y alertas en tiempo real
 */

import { ethers } from 'ethers';
import pLimit from 'p-limit';
import pRetry from 'p-retry';
import { GoogleSheetsClient } from './google-sheets-client';
import { OracleValidator } from './oracle-validator';
import { TransactionBuilder } from './transaction-builder';
import { GasManager } from './gas-manager';
import { Logger } from './logger';

// ==================================================================================
// TIPOS Y INTERFACES
// ==================================================================================

export interface ArbitrageOpportunity {
  id: string;
  chainId: number;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedProfit: string;
  path: string[];
  dexes: string[];
  deadline: number;
  priority: number;
}

export interface ExecutionResult {
  opportunityId: string;
  success: boolean;
  txHash?: string;
  profit?: string;
  gasUsed?: string;
  error?: string;
  timestamp: number;
}

export interface BatchExecutionResult {
  batchId: string;
  totalOps: number;
  successfulOps: number;
  failedOps: number;
  totalProfit: string;
  totalGasUsed: string;
  results: ExecutionResult[];
  timestamp: number;
}

export interface ParallelExecutorConfig {
  maxConcurrentOps: number;
  minOracleConfirmations: number;
  maxSlippageBps: number;
  gasLimitPerOp: number;
  retryAttempts: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  sheetsRefreshIntervalMs: number;
}

// ==================================================================================
// CLASE PRINCIPAL: PARALLEL EXECUTOR
// ==================================================================================

export class ParallelExecutor {
  private config: ParallelExecutorConfig;
  private sheetsClient: GoogleSheetsClient;
  private oracleValidator: OracleValidator;
  private txBuilder: TransactionBuilder;
  private gasManager: GasManager;
  private logger: Logger;
  
  // Providers por chain
  private providers: Map<number, ethers.providers.JsonRpcProvider>;
  
  // Wallets por chain
  private wallets: Map<number, ethers.Wallet>;
  
  // Contratos ArbitrageManager por chain
  private managers: Map<number, ethers.Contract>;
  
  // Estado del executor
  private isRunning: boolean = false;
  private consecutiveFailures: number = 0;
  private totalExecutions: number = 0;
  private totalProfit: ethers.BigNumber = ethers.BigNumber.from(0);
  
  // Rate limiting
  private limiter: ReturnType<typeof pLimit>;
  
  constructor(config: ParallelExecutorConfig) {
    this.config = config;
    this.logger = new Logger('ParallelExecutor');
    
    // Inicializar componentes
    this.sheetsClient = new GoogleSheetsClient();
    this.oracleValidator = new OracleValidator({
      minConfirmations: config.minOracleConfirmations,
    });
    this.txBuilder = new TransactionBuilder();
    this.gasManager = new GasManager();
    
    // Inicializar maps
    this.providers = new Map();
    this.wallets = new Map();
    this.managers = new Map();
    
    // Configurar rate limiter
    this.limiter = pLimit(config.maxConcurrentOps);
    
    this.logger.info('ParallelExecutor initialized', { config });
  }
  
  // ==================================================================================
  // INICIALIZACIÓN
  // ==================================================================================
  
  /**
   * Inicializa el executor con providers y contratos para todas las chains
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing ParallelExecutor...');
    
    try {
      // Cargar configuración de chains desde Sheets
      const chains = await this.sheetsClient.getBlockchains();
      
      for (const chain of chains) {
        if (!chain.enabled) continue;
        
        // Crear provider
        const provider = new ethers.providers.JsonRpcProvider(
          chain.rpcUrl,
          chain.chainId
        );
        this.providers.set(chain.chainId, provider);
        
        // Crear wallet
        const privateKey = process.env[`PRIVATE_KEY_CHAIN_${chain.chainId}`] || process.env.PRIVATE_KEY;
        if (!privateKey) {
          throw new Error(`No private key found for chain ${chain.chainId}`);
        }
        
        const wallet = new ethers.Wallet(privateKey, provider);
        this.wallets.set(chain.chainId, wallet);
        
        // Cargar contrato ArbitrageManager
        const managerAddress = chain.arbitrageManagerAddress;
        if (!managerAddress) {
          this.logger.warn(`No ArbitrageManager address for chain ${chain.chainId}`);
          continue;
        }
        
        const manager = new ethers.Contract(
          managerAddress,
          this.getArbitrageManagerABI(),
          wallet
        );
        this.managers.set(chain.chainId, manager);
        
        this.logger.info(`Initialized chain ${chain.chainId}`, {
          rpcUrl: chain.rpcUrl,
          managerAddress,
          walletAddress: wallet.address,
        });
      }
      
      // Inicializar oracle validator
      await this.oracleValidator.initialize();
      
      this.logger.info('ParallelExecutor initialized successfully', {
        chains: this.providers.size,
      });
    } catch (error) {
      this.logger.error('Failed to initialize ParallelExecutor', error);
      throw error;
    }
  }
  
  // ==================================================================================
  // EJECUCIÓN PRINCIPAL
  // ==================================================================================
  
  /**
   * Inicia el loop de ejecución continua
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('ParallelExecutor is already running');
      return;
    }
    
    this.isRunning = true;
    this.logger.info('Starting ParallelExecutor...');
    
    while (this.isRunning) {
      try {
        // Verificar circuit breaker
        if (this.consecutiveFailures >= this.config.circuitBreakerThreshold) {
          this.logger.error('Circuit breaker activated', {
            consecutiveFailures: this.consecutiveFailures,
          });
          
          // Esperar antes de reintentar
          await this.sleep(60000); // 1 minuto
          this.consecutiveFailures = 0;
          continue;
        }
        
        // Ejecutar batch de operaciones
        await this.executeBatch();
        
        // Esperar antes del siguiente ciclo
        await this.sleep(this.config.sheetsRefreshIntervalMs);
      } catch (error) {
        this.logger.error('Error in execution loop', error);
        this.consecutiveFailures++;
        
        // Esperar antes de reintentar
        await this.sleep(5000);
      }
    }
    
    this.logger.info('ParallelExecutor stopped');
  }
  
  /**
   * Detiene el executor
   */
  stop(): void {
    this.logger.info('Stopping ParallelExecutor...');
    this.isRunning = false;
  }
  
  // ==================================================================================
  // EJECUCIÓN DE BATCH
  // ==================================================================================
  
  /**
   * Ejecuta un batch de hasta 40 operaciones simultáneas
   */
  private async executeBatch(): Promise<BatchExecutionResult> {
    const batchId = this.generateBatchId();
    const startTime = Date.now();
    
    this.logger.info(`Starting batch execution ${batchId}`);
    
    try {
      // 1. Obtener oportunidades desde Sheets
      const opportunities = await this.getOpportunities();
      
      if (opportunities.length === 0) {
        this.logger.debug('No opportunities found');
        return this.createEmptyBatchResult(batchId);
      }
      
      this.logger.info(`Found ${opportunities.length} opportunities`, { batchId });
      
      // 2. Agrupar por chain
      const opsByChain = this.groupByChain(opportunities);
      
      // 3. Ejecutar en paralelo por chain
      const results: ExecutionResult[] = [];
      
      for (const [chainId, ops] of opsByChain.entries()) {
        const chainResults = await this.executeChainBatch(chainId, ops, batchId);
        results.push(...chainResults);
      }
      
      // 4. Calcular estadísticas
      const batchResult = this.calculateBatchResult(batchId, results);
      
      // 5. Actualizar Sheets con resultados
      await this.updateExecutionResults(results);
      
      // 6. Actualizar estado del executor
      this.updateExecutorState(batchResult);
      
      const duration = Date.now() - startTime;
      this.logger.info(`Batch ${batchId} completed`, {
        duration,
        totalOps: batchResult.totalOps,
        successful: batchResult.successfulOps,
        failed: batchResult.failedOps,
        profit: batchResult.totalProfit,
      });
      
      return batchResult;
    } catch (error) {
      this.logger.error(`Batch ${batchId} failed`, error);
      throw error;
    }
  }
  
  /**
   * Ejecuta un batch de operaciones en una chain específica
   */
  private async executeChainBatch(
    chainId: number,
    opportunities: ArbitrageOpportunity[],
    batchId: string
  ): Promise<ExecutionResult[]> {
    this.logger.info(`Executing batch on chain ${chainId}`, {
      batchId,
      opsCount: opportunities.length,
    });
    
    // Limitar a 40 operaciones máximo
    const limitedOps = opportunities.slice(0, this.config.maxConcurrentOps);
    
    // Ejecutar operaciones en paralelo con rate limiting
    const results = await Promise.all(
      limitedOps.map((op) =>
        this.limiter(() => this.executeOperation(chainId, op, batchId))
      )
    );
    
    return results;
  }
  
  /**
   * Ejecuta una operación individual con retry logic
   */
  private async executeOperation(
    chainId: number,
    opportunity: ArbitrageOpportunity,
    batchId: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Ejecutar con retry
      const result = await pRetry(
        async () => {
          return await this.executeOperationInternal(chainId, opportunity, batchId);
        },
        {
          retries: this.config.retryAttempts,
          minTimeout: this.config.retryDelayMs,
          onFailedAttempt: (error) => {
            this.logger.warn(`Retry attempt ${error.attemptNumber} for op ${opportunity.id}`, {
              error: error.message,
            });
          },
        }
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Operation ${opportunity.id} failed after retries`, error);
      
      return {
        opportunityId: opportunity.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }
  
  /**
   * Lógica interna de ejecución de una operación
   */
  private async executeOperationInternal(
    chainId: number,
    opportunity: ArbitrageOpportunity,
    batchId: string
  ): Promise<ExecutionResult> {
    this.logger.debug(`Executing operation ${opportunity.id}`, { chainId, batchId });
    
    // 1. Validar precios con oráculos
    const priceValid = await this.oracleValidator.validatePrices(
      chainId,
      opportunity.tokenIn,
      opportunity.tokenOut,
      opportunity.amountIn
    );
    
    if (!priceValid) {
      throw new Error('Price validation failed');
    }
    
    // 2. Verificar gas
    const gasPrice = await this.gasManager.getOptimalGasPrice(chainId);
    const estimatedCost = gasPrice.mul(this.config.gasLimitPerOp);
    const expectedProfit = ethers.BigNumber.from(opportunity.expectedProfit);
    
    if (estimatedCost.gte(expectedProfit)) {
      throw new Error('Gas cost exceeds expected profit');
    }
    
    // 3. Construir transacción
    const manager = this.managers.get(chainId);
    if (!manager) {
      throw new Error(`No manager contract for chain ${chainId}`);
    }
    
    const tx = await this.txBuilder.buildBatchOperation(manager, [opportunity]);
    
    // 4. Ejecutar transacción
    const txResponse = await manager.executeBatch(tx.operations, {
      gasLimit: this.config.gasLimitPerOp,
      gasPrice,
    });
    
    this.logger.info(`Transaction sent for op ${opportunity.id}`, {
      txHash: txResponse.hash,
    });
    
    // 5. Esperar confirmación
    const receipt = await txResponse.wait();
    
    // 6. Calcular profit real
    const profit = await this.calculateActualProfit(receipt);
    
    this.logger.info(`Operation ${opportunity.id} successful`, {
      txHash: receipt.transactionHash,
      profit: profit.toString(),
      gasUsed: receipt.gasUsed.toString(),
    });
    
    return {
      opportunityId: opportunity.id,
      success: true,
      txHash: receipt.transactionHash,
      profit: profit.toString(),
      gasUsed: receipt.gasUsed.toString(),
      timestamp: Date.now(),
    };
  }
  
  // ==================================================================================
  // HELPERS
  // ==================================================================================
  
  /**
   * Obtiene oportunidades de arbitraje desde Google Sheets
   */
  private async getOpportunities(): Promise<ArbitrageOpportunity[]> {
    const routes = await this.sheetsClient.getRoutes();
    
    // Filtrar solo rutas activas y rentables
    const opportunities = routes
      .filter((route) => route.enabled && parseFloat(route.expectedProfit) > 0)
      .map((route) => ({
        id: route.id,
        chainId: route.chainId,
        tokenIn: route.tokenIn,
        tokenOut: route.tokenOut,
        amountIn: route.amountIn,
        expectedProfit: route.expectedProfit,
        path: route.path,
        dexes: route.dexes,
        deadline: Date.now() + 300000, // 5 minutos
        priority: route.priority || 0,
      }))
      .sort((a, b) => b.priority - a.priority); // Ordenar por prioridad
    
    return opportunities;
  }
  
  /**
   * Agrupa oportunidades por chain
   */
  private groupByChain(
    opportunities: ArbitrageOpportunity[]
  ): Map<number, ArbitrageOpportunity[]> {
    const grouped = new Map<number, ArbitrageOpportunity[]>();
    
    for (const op of opportunities) {
      const chainOps = grouped.get(op.chainId) || [];
      chainOps.push(op);
      grouped.set(op.chainId, chainOps);
    }
    
    return grouped;
  }
  
  /**
   * Calcula el resultado del batch
   */
  private calculateBatchResult(
    batchId: string,
    results: ExecutionResult[]
  ): BatchExecutionResult {
    const successfulOps = results.filter((r) => r.success).length;
    const failedOps = results.filter((r) => !r.success).length;
    
    const totalProfit = results
      .filter((r) => r.success && r.profit)
      .reduce((sum, r) => sum.add(ethers.BigNumber.from(r.profit!)), ethers.BigNumber.from(0));
    
    const totalGasUsed = results
      .filter((r) => r.success && r.gasUsed)
      .reduce((sum, r) => sum.add(ethers.BigNumber.from(r.gasUsed!)), ethers.BigNumber.from(0));
    
    return {
      batchId,
      totalOps: results.length,
      successfulOps,
      failedOps,
      totalProfit: totalProfit.toString(),
      totalGasUsed: totalGasUsed.toString(),
      results,
      timestamp: Date.now(),
    };
  }
  
  /**
   * Actualiza resultados en Google Sheets
   */
  private async updateExecutionResults(results: ExecutionResult[]): Promise<void> {
    try {
      await this.sheetsClient.updateExecutions(results);
      this.logger.debug('Execution results updated in Sheets', {
        count: results.length,
      });
    } catch (error) {
      this.logger.error('Failed to update execution results in Sheets', error);
      // No lanzar error, solo logear
    }
  }
  
  /**
   * Actualiza el estado interno del executor
   */
  private updateExecutorState(result: BatchExecutionResult): void {
    this.totalExecutions += result.totalOps;
    this.totalProfit = this.totalProfit.add(ethers.BigNumber.from(result.totalProfit));
    
    if (result.failedOps > result.successfulOps) {
      this.consecutiveFailures++;
    } else {
      this.consecutiveFailures = 0;
    }
  }
  
  /**
   * Calcula el profit real de una transacción
   */
  private async calculateActualProfit(receipt: ethers.ContractReceipt): Promise<ethers.BigNumber> {
    // Parsear eventos del contrato para obtener el profit
    // Esto depende de los eventos emitidos por ArbitrageManager
    
    // Por ahora, retornar 0 como placeholder
    return ethers.BigNumber.from(0);
  }
  
  /**
   * Crea un resultado vacío para batch sin oportunidades
   */
  private createEmptyBatchResult(batchId: string): BatchExecutionResult {
    return {
      batchId,
      totalOps: 0,
      successfulOps: 0,
      failedOps: 0,
      totalProfit: '0',
      totalGasUsed: '0',
      results: [],
      timestamp: Date.now(),
    };
  }
  
  /**
   * Genera un ID único para el batch
   */
  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Obtiene el ABI del contrato ArbitrageManager
   */
  private getArbitrageManagerABI(): any[] {
    // ABI simplificado - en producción cargar desde archivo
    return [
      'function executeBatch((address,address,uint256,uint256,address[],address[],bytes,uint256)[] operations) returns ((bool,uint256,uint256,uint256,uint256))',
    ];
  }
  
  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  
  // ==================================================================================
  // GETTERS
  // ==================================================================================
  
  getStats() {
    return {
      isRunning: this.isRunning,
      totalExecutions: this.totalExecutions,
      totalProfit: this.totalProfit.toString(),
      consecutiveFailures: this.consecutiveFailures,
      activeChains: this.providers.size,
    };
  }
}

