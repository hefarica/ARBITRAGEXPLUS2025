/**
 * ============================================================================
 * ARCHIVO: ./services/ts-executor/src/executor/TransactionExecutor.ts
 * SERVICIO: ts-executor
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ../oracles/OracleValidator, ethers, ../gas/GasManager
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: TransactionExecutor
 *   FUNCIONES: executeArbitrage, executeBatch
 *   INTERFACES: ExecutionResult, ArbitrageRoute, TransactionResult
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: ExecutionResult, ArbitrageRoute, TransactionResult
 * 
 * 🔗 DEPENDENCIAS:
 *   - ../oracles/OracleValidator
 *   - ethers
 *   - ../gas/GasManager
 * 
 * ============================================================================
 */

/**
 * TransactionExecutor.ts
 * 
 * Sistema de ejecución real de transacciones para ARBITRAGEXPLUS2025
 * Integra con los contratos FlashLoanArbitrage y BatchExecutor
 * 
 * CARACTERÍSTICAS:
 * - Ejecución de transacciones con gestión segura de claves privadas
 * - Gas pricing dinámico con EIP-1559
 * - Retry logic con exponential backoff
 * - Circuit breaker automático
 * - Integración con Google Sheets para leer ROUTES y escribir EXECUTIONS
 * - Validación de precios con oráculos Pyth/Chainlink
 * - Soporte para 40+ operaciones simultáneas
 * 
 * FLUJO:
 * 1. Leer rutas desde Google Sheets (ROUTES)
 * 2. Validar precios con oráculos
 * 3. Construir transacción para FlashLoanArbitrage
 * 4. Ejecutar con gestión de gas y nonce
 * 5. Esperar confirmación
 * 6. Escribir resultado a Google Sheets (EXECUTIONS)
 * 
 * @author ARBITRAGEXPLUS2025
 * @version 2.0.0
 */

import { ethers, BigNumber, providers, Wallet, Contract } from 'ethers';
import { GoogleSheetsClient } from '../sheets/GoogleSheetsClient';
import { OracleValidator } from '../oracles/OracleValidator';
import { GasManager } from '../gas/GasManager';
import { NonceTracker } from '../nonces/tracker';

// ==================================================================================
// INTERFACES Y TIPOS
// ==================================================================================

export enum FlashLoanProtocol {
  AAVE_V3 = 0,
  BALANCER = 1,
  UNISWAP_V3 = 2,
  DYDX = 3
}

export enum SwapProtocol {
  UNISWAP_V2 = 0,
  UNISWAP_V3 = 1,
  SUSHISWAP = 2,
  PANCAKESWAP = 3,
  CURVE = 4,
  BALANCER = 5
}

export interface FlashLoanParams {
  protocol: FlashLoanProtocol;
  provider: string;
  tokens: string[];
  amounts: string[];
  extraData: string;
}

export interface SwapStep {
  protocol: SwapProtocol;
  router: string;
  path: string[];
  amountIn: string;
  minAmountOut: string;
  extraData: string;
}

export interface ArbitrageRoute {
  routeId: string;
  flashLoan: FlashLoanParams;
  swaps: SwapStep[];
  expectedProfit: string;
  minProfitRequired: string;
  maxSlippageBps: number;
  deadline: number;
  profitToken: string;
}

export interface ExecutionResult {
  success: boolean;
  profitAmount: string;
  gasUsed: number;
  flashLoanFee: string;
  swapCount: number;
  failureReason?: string;
}

export interface TransactionResult {
  routeId: string;
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  effectiveGasPrice?: string;
  profitAmount?: string;
  error?: string;
  timestamp: number;
  executionTimeMs: number;
}

export interface ExecutorConfig {
  privateKey: string;
  rpcUrl: string;
  chainId: number;
  flashLoanArbitrageAddress: string;
  batchExecutorAddress?: string;
  maxConcurrentTxs: number;
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  gasLimitMultiplier: number;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
}

// ==================================================================================
// CLASE PRINCIPAL
// ==================================================================================

export class TransactionExecutor {
  private provider: providers.JsonRpcProvider;
  private wallet: Wallet;
  private flashLoanArbitrage: Contract;
  private batchExecutor?: Contract;
  private sheetsClient: GoogleSheetsClient;
  private oracleValidator: OracleValidator;
  private gasManager: GasManager;
  private nonceTracker: NonceTracker;
  
  private config: ExecutorConfig;
  
  // Control de ejecución
  private activeTxs: Map<string, Promise<TransactionResult>> = new Map();
  private txQueue: ArbitrageRoute[] = [];
  
  // Circuit breaker
  private failureCount: number = 0;
  private circuitBreakerActive: boolean = false;
  private lastCircuitBreakerReset: number = Date.now();
  
  // Estadísticas
  private stats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    totalProfitUSD: 0,
    totalGasUsed: 0,
    avgExecutionTimeMs: 0
  };
  
  // ABIs (simplificados)
  private readonly FLASH_LOAN_ARBITRAGE_ABI = [
    'function executeArbitrage(tuple(string routeId, tuple(uint8 protocol, address provider, address[] tokens, uint256[] amounts, bytes extraData) flashLoan, tuple(uint8 protocol, address router, address[] path, uint256 amountIn, uint256 minAmountOut, bytes extraData)[] swaps, uint256 expectedProfit, uint256 minProfitRequired, uint256 maxSlippageBps, uint256 deadline, address profitToken) route) external returns (tuple(bool success, uint256 profitAmount, uint256 gasUsed, uint256 flashLoanFee, uint256 swapCount, string failureReason))',
    'event ArbitrageExecuted(string indexed routeId, address indexed executor, address indexed profitToken, uint256 profitAmount, uint256 gasUsed, uint256 timestamp)',
    'event ArbitrageFailed(string indexed routeId, address indexed executor, string reason, uint256 timestamp)'
  ];
  
  private readonly BATCH_EXECUTOR_ABI = [
    'function executeBatch(tuple(address arbitrageContract, bytes callData, uint256 gasLimit, bool continueOnFailure)[] operations) external returns (tuple(uint256 totalOperations, uint256 successfulOperations, uint256 failedOperations, uint256 totalProfit, uint256 totalGasUsed, tuple(bool success, uint256 profitAmount, uint256 gasUsed, bytes returnData, string failureReason)[] results))'
  ];
  
  // ==================================================================================
  // CONSTRUCTOR
  // ==================================================================================
  
  constructor(config: ExecutorConfig) {
    this.config = config;
    
    // Inicializar provider y wallet
    this.provider = new providers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new Wallet(config.privateKey, this.provider);
    
    // Inicializar contratos
    this.flashLoanArbitrage = new Contract(
      config.flashLoanArbitrageAddress,
      this.FLASH_LOAN_ARBITRAGE_ABI,
      this.wallet
    );
    
    if (config.batchExecutorAddress) {
      this.batchExecutor = new Contract(
        config.batchExecutorAddress,
        this.BATCH_EXECUTOR_ABI,
        this.wallet
      );
    }
    
    // Inicializar servicios auxiliares
    this.sheetsClient = new GoogleSheetsClient();
    this.oracleValidator = new OracleValidator(this.provider);
    this.gasManager = new GasManager(this.provider);
    this.nonceTracker = new NonceTracker(this.wallet.address, this.provider);
    
    // Setup event listeners
    this.setupEventListeners();
    
    console.log(`✅ TransactionExecutor initialized`);
    console.log(`   Chain ID: ${config.chainId}`);
    console.log(`   Wallet: ${this.wallet.address}`);
    console.log(`   FlashLoanArbitrage: ${config.flashLoanArbitrageAddress}`);
  }
  
  // ==================================================================================
  // MÉTODOS PÚBLICOS
  // ==================================================================================
  
  /**
   * Ejecuta una ruta de arbitraje
   */
  async executeRoute(route: ArbitrageRoute): Promise<TransactionResult> {
    const startTime = Date.now();
    
    try {
      // Verificar circuit breaker
      if (this.circuitBreakerActive) {
        throw new Error('Circuit breaker active');
      }
      
      // Verificar límite de transacciones concurrentes
      if (this.activeTxs.size >= this.config.maxConcurrentTxs) {
        // Agregar a cola
        this.txQueue.push(route);
        console.log(`⏳ Route ${route.routeId} queued (${this.txQueue.length} in queue)`);
        return this.waitForQueuedExecution(route.routeId);
      }
      
      // Validar ruta con oráculos
      const validation = await this.validateRoute(route);
      if (!validation.isValid) {
        throw new Error(`Route validation failed: ${validation.reason}`);
      }
      
      // Ejecutar transacción con retry logic
      const result = await this.executeWithRetry(route);
      
      // Actualizar estadísticas
      this.updateStats(result);
      
      // Escribir resultado a Google Sheets
      await this.writeExecutionResult(result);
      
      // Procesar siguiente en cola
      this.processQueue();
      
      return result;
      
    } catch (error) {
      const errorResult: TransactionResult = {
        routeId: route.routeId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        executionTimeMs: Date.now() - startTime
      };
      
      this.handleFailure(errorResult);
      await this.writeExecutionResult(errorResult);
      
      return errorResult;
    }
  }
  
  /**
   * Ejecuta múltiples rutas en batch
   */
  async executeBatch(routes: ArbitrageRoute[]): Promise<TransactionResult[]> {
    if (!this.batchExecutor) {
      throw new Error('BatchExecutor not configured');
    }
    
    console.log(`📦 Executing batch of ${routes.length} routes`);
    
    // Construir operaciones para batch executor
    const operations = routes.map(route => ({
      arbitrageContract: this.config.flashLoanArbitrageAddress,
      callData: this.flashLoanArbitrage.interface.encodeFunctionData(
        'executeArbitrage',
        [route]
      ),
      gasLimit: 500000, // Estimado por operación
      continueOnFailure: true
    }));
    
    try {
      // Estimar gas total
      const gasEstimate = await this.batchExecutor.estimateGas.executeBatch(operations);
      const gasLimit = gasEstimate.mul(this.config.gasLimitMultiplier * 100).div(100);
      
      // Obtener gas pricing
      const gasPrice = await this.gasManager.getOptimalGasPrice();
      
      // Ejecutar batch
      const tx = await this.batchExecutor.executeBatch(operations, {
        gasLimit,
        maxFeePerGas: gasPrice.maxFeePerGas,
        maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas
      });
      
      console.log(`📤 Batch transaction sent: ${tx.hash}`);
      
      // Esperar confirmación
      const receipt = await tx.wait();
      
      console.log(`✅ Batch transaction confirmed: ${receipt.transactionHash}`);
      console.log(`   Block: ${receipt.blockNumber}`);
      console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
      
      // Parsear resultados
      const results = this.parseBatchResults(receipt, routes);
      
      // Escribir resultados a Google Sheets
      for (const result of results) {
        await this.writeExecutionResult(result);
      }
      
      return results;
      
    } catch (error) {
      console.error(`❌ Batch execution failed:`, error);
      
      // Retornar resultados de error para todas las rutas
      return routes.map(route => ({
        routeId: route.routeId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        executionTimeMs: 0
      }));
    }
  }
  
  /**
   * Lee rutas desde Google Sheets y ejecuta
   */
  async executeFromSheets(filters?: {
    isActive?: boolean;
    isProfitable?: boolean;
    minProfitUSD?: number;
    strategyType?: string;
  }): Promise<TransactionResult[]> {
    console.log('📊 Reading routes from Google Sheets...');
    
    // Leer rutas desde ROUTES sheet
    const routes = await this.sheetsClient.getRoutes(filters);
    
    console.log(`   Found ${routes.length} routes matching filters`);
    
    if (routes.length === 0) {
      return [];
    }
    
    // Convertir a formato ArbitrageRoute
    const arbitrageRoutes = routes.map(r => this.convertToArbitrageRoute(r));
    
    // Ejecutar en batch si hay múltiples rutas
    if (arbitrageRoutes.length > 1 && this.batchExecutor) {
      return await this.executeBatch(arbitrageRoutes);
    } else {
      // Ejecutar individualmente
      const results: TransactionResult[] = [];
      for (const route of arbitrageRoutes) {
        const result = await this.executeRoute(route);
        results.push(result);
      }
      return results;
    }
  }
  
  // ==================================================================================
  // MÉTODOS PRIVADOS - EJECUCIÓN
  // ==================================================================================
  
  /**
   * Ejecuta transacción con retry logic
   */
  private async executeWithRetry(
    route: ArbitrageRoute,
    attempt: number = 1
  ): Promise<TransactionResult> {
    try {
      return await this.executeSingleTransaction(route);
    } catch (error) {
      if (attempt < this.config.maxRetries) {
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
        console.log(`⚠️  Retry ${attempt}/${this.config.maxRetries} after ${delay}ms`);
        await this.sleep(delay);
        return await this.executeWithRetry(route, attempt + 1);
      } else {
        throw error;
      }
    }
  }
  
  /**
   * Ejecuta una transacción individual
   */
  private async executeSingleTransaction(
    route: ArbitrageRoute
  ): Promise<TransactionResult> {
    const startTime = Date.now();
    
    console.log(`\n🚀 Executing route: ${route.routeId}`);
    console.log(`   Expected profit: ${ethers.utils.formatEther(route.expectedProfit)} ETH`);
    
    // Estimar gas
    const gasEstimate = await this.flashLoanArbitrage.estimateGas.executeArbitrage(route);
    const gasLimit = gasEstimate.mul(this.config.gasLimitMultiplier * 100).div(100);
    
    console.log(`   Gas estimate: ${gasEstimate.toString()}`);
    console.log(`   Gas limit: ${gasLimit.toString()}`);
    
    // Obtener gas pricing óptimo
    const gasPrice = await this.gasManager.getOptimalGasPrice();
    
    console.log(`   Max fee per gas: ${ethers.utils.formatUnits(gasPrice.maxFeePerGas, 'gwei')} gwei`);
    console.log(`   Max priority fee: ${ethers.utils.formatUnits(gasPrice.maxPriorityFeePerGas, 'gwei')} gwei`);
    
    // Obtener nonce
    const nonce = await this.nonceTracker.getNextNonce();
    
    // Construir transacción
    const tx = await this.flashLoanArbitrage.executeArbitrage(route, {
      gasLimit,
      maxFeePerGas: gasPrice.maxFeePerGas,
      maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
      nonce
    });
    
    console.log(`📤 Transaction sent: ${tx.hash}`);
    console.log(`   Nonce: ${nonce}`);
    
    // Esperar confirmación
    const receipt = await tx.wait();
    
    console.log(`✅ Transaction confirmed: ${receipt.transactionHash}`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
    console.log(`   Effective gas price: ${ethers.utils.formatUnits(receipt.effectiveGasPrice, 'gwei')} gwei`);
    
    // Parsear eventos
    const events = this.parseTransactionEvents(receipt);
    
    const result: TransactionResult = {
      routeId: route.routeId,
      success: receipt.status === 1 && events.arbitrageExecuted !== undefined,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toNumber(),
      effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      profitAmount: events.arbitrageExecuted?.profitAmount || '0',
      error: events.arbitrageFailed?.reason,
      timestamp: Date.now(),
      executionTimeMs: Date.now() - startTime
    };
    
    if (result.success) {
      console.log(`💰 Profit: ${ethers.utils.formatEther(result.profitAmount!)} ETH`);
    } else {
      console.log(`❌ Execution failed: ${result.error}`);
    }
    
    return result;
  }
  
  // ==================================================================================
  // MÉTODOS PRIVADOS - VALIDACIÓN
  // ==================================================================================
  
  /**
   * Valida una ruta antes de ejecutar
   */
  private async validateRoute(route: ArbitrageRoute): Promise<{
    isValid: boolean;
    reason?: string;
  }> {
    // Validar deadline
    if (route.deadline < Math.floor(Date.now() / 1000)) {
      return { isValid: false, reason: 'Deadline expired' };
    }
    
    // Validar slippage
    if (route.maxSlippageBps > 1000) { // 10% máximo
      return { isValid: false, reason: 'Slippage too high' };
    }
    
    // Validar con oráculos
    const oracleValidation = await this.oracleValidator.validatePrices(
      route.swaps.map(s => s.path).flat()
    );
    
    if (!oracleValidation.isValid) {
      return { isValid: false, reason: `Oracle validation failed: ${oracleValidation.reason}` };
    }
    
    // Validar balance de gas
    const balance = await this.wallet.getBalance();
    const estimatedGasCost = BigNumber.from(this.config.maxFeePerGas).mul(500000);
    
    if (balance.lt(estimatedGasCost)) {
      return { isValid: false, reason: 'Insufficient balance for gas' };
    }
    
    return { isValid: true };
  }
  
  // ==================================================================================
  // MÉTODOS PRIVADOS - UTILIDADES
  // ==================================================================================
  
  private setupEventListeners(): void {
    // Escuchar eventos del contrato
    this.flashLoanArbitrage.on('ArbitrageExecuted', (routeId, executor, profitToken, profitAmount, gasUsed, timestamp) => {
      console.log(`📢 Event: ArbitrageExecuted`);
      console.log(`   Route ID: ${routeId}`);
      console.log(`   Profit: ${ethers.utils.formatEther(profitAmount)} ETH`);
    });
    
    this.flashLoanArbitrage.on('ArbitrageFailed', (routeId, executor, reason, timestamp) => {
      console.log(`📢 Event: ArbitrageFailed`);
      console.log(`   Route ID: ${routeId}`);
      console.log(`   Reason: ${reason}`);
    });
  }
  
  private parseTransactionEvents(receipt: providers.TransactionReceipt): {
    arbitrageExecuted?: any;
    arbitrageFailed?: any;
  } {
    const events: any = {};
    
    for (const log of receipt.logs) {
      try {
        const parsed = this.flashLoanArbitrage.interface.parseLog(log);
        if (parsed.name === 'ArbitrageExecuted') {
          events.arbitrageExecuted = {
            routeId: parsed.args.routeId,
            profitAmount: parsed.args.profitAmount.toString(),
            gasUsed: parsed.args.gasUsed.toNumber()
          };
        } else if (parsed.name === 'ArbitrageFailed') {
          events.arbitrageFailed = {
            routeId: parsed.args.routeId,
            reason: parsed.args.reason
          };
        }
      } catch (e) {
        // Log no es del contrato FlashLoanArbitrage
      }
    }
    
    return events;
  }
  
  private parseBatchResults(
    receipt: providers.TransactionReceipt,
    routes: ArbitrageRoute[]
  ): TransactionResult[] {
    // Simplificado: retornar resultados basados en eventos
    // En producción, decodificar el return value de executeBatch
    return routes.map(route => ({
      routeId: route.routeId,
      success: receipt.status === 1,
      txHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      timestamp: Date.now(),
      executionTimeMs: 0
    }));
  }
  
  private async writeExecutionResult(result: TransactionResult): Promise<void> {
    try {
      await this.sheetsClient.writeExecution({
        executionId: `EXEC_${Date.now()}`,
        routeId: result.routeId,
        status: result.success ? 'SUCCESS' : 'FAILED',
        isSuccessful: result.success,
        timestamp: new Date(result.timestamp).toISOString(),
        blockNumber: result.blockNumber || 0,
        transactionHash: result.txHash || '',
        profitUSD: result.profitAmount ? parseFloat(ethers.utils.formatEther(result.profitAmount)) : 0,
        gasUsed: result.gasUsed || 0,
        gasPriceGwei: result.effectiveGasPrice ? parseFloat(ethers.utils.formatUnits(result.effectiveGasPrice, 'gwei')) : 0,
        errorMessage: result.error || ''
      });
    } catch (error) {
      console.error('Failed to write execution result to Sheets:', error);
    }
  }
  
  private convertToArbitrageRoute(sheetRoute: any): ArbitrageRoute {
    // Convertir formato de Google Sheets a ArbitrageRoute
    // Implementación simplificada
    return {
      routeId: sheetRoute.routeId,
      flashLoan: {
        protocol: FlashLoanProtocol.AAVE_V3,
        provider: sheetRoute.flashLoanProvider,
        tokens: [sheetRoute.sourceToken],
        amounts: [ethers.utils.parseEther(sheetRoute.amount).toString()],
        extraData: '0x'
      },
      swaps: [
        {
          protocol: SwapProtocol.UNISWAP_V2,
          router: sheetRoute.dex1Router,
          path: [sheetRoute.sourceToken, sheetRoute.targetToken],
          amountIn: ethers.utils.parseEther(sheetRoute.amount).toString(),
          minAmountOut: ethers.utils.parseEther(sheetRoute.minAmountOut).toString(),
          extraData: '0x'
        }
      ],
      expectedProfit: ethers.utils.parseEther(sheetRoute.expectedProfit).toString(),
      minProfitRequired: ethers.utils.parseEther(sheetRoute.minProfit).toString(),
      maxSlippageBps: sheetRoute.maxSlippage * 100,
      deadline: Math.floor(Date.now() / 1000) + 300,
      profitToken: sheetRoute.sourceToken
    };
  }
  
  private updateStats(result: TransactionResult): void {
    this.stats.totalExecutions++;
    if (result.success) {
      this.stats.successfulExecutions++;
      if (result.profitAmount) {
        this.stats.totalProfitUSD += parseFloat(ethers.utils.formatEther(result.profitAmount));
      }
    } else {
      this.stats.failedExecutions++;
    }
    if (result.gasUsed) {
      this.stats.totalGasUsed += result.gasUsed;
    }
    this.stats.avgExecutionTimeMs = 
      (this.stats.avgExecutionTimeMs * (this.stats.totalExecutions - 1) + result.executionTimeMs) / 
      this.stats.totalExecutions;
  }
  
  private handleFailure(result: TransactionResult): void {
    this.failureCount++;
    
    if (this.failureCount >= this.config.circuitBreakerThreshold) {
      this.circuitBreakerActive = true;
      this.lastCircuitBreakerReset = Date.now();
      console.log(`⚠️  Circuit breaker activated after ${this.failureCount} failures`);
    }
  }
  
  private async waitForQueuedExecution(routeId: string): Promise<TransactionResult> {
    // Esperar hasta que la ruta sea procesada de la cola
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const result = this.activeTxs.get(routeId);
        if (result) {
          clearInterval(interval);
          resolve(result);
        }
      }, 1000);
    });
  }
  
  private async processQueue(): Promise<void> {
    if (this.txQueue.length > 0 && this.activeTxs.size < this.config.maxConcurrentTxs) {
      const route = this.txQueue.shift()!;
      this.executeRoute(route);
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // ==================================================================================
  // GETTERS
  // ==================================================================================
  
  getStats() {
    return { ...this.stats };
  }
  
  isCircuitBreakerActive() {
    return this.circuitBreakerActive;
  }
  
  resetCircuitBreaker() {
    this.circuitBreakerActive = false;
    this.failureCount = 0;
    this.lastCircuitBreakerReset = Date.now();
    console.log('✅ Circuit breaker reset');
  }
}

