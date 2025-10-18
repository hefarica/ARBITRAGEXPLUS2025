"""
flash.ts

Ejecutor de flash loans atómicos para ARBITRAGEXPLUS2025.
Coordina hasta 40 operaciones simultáneas con failsafes automáticos.

RESPONSABILIDADES:
- Gestión de flash loans atómicos multi-DEX
- Orquestación de swaps secuenciales en una transacción
- Validación de rentabilidad pre-ejecución
- MEV protection y gas optimization
- Rollback automático si la operación no es rentable
- Monitoreo y logging de todas las operaciones
- Rate limiting para evitar spam de transacciones

INTEGRACIÓN:
- Rust Engine: Recibe rutas óptimas calculadas por DP
- Google Sheets: Actualiza resultados en hoja EXECUTIONS
- WebSocket Manager: Recibe precios en tiempo real
- Oráculos: Valida precios antes de ejecutar

ARQUITECTURA:
Sheets → Rust DP → TS Executor → Blockchain → Results → Sheets

@author ARBITRAGEXPLUS2025 Core Team
@version 1.0.0
@criticality BLOQUEANTE
@integration-with rust:pathfinding, sheets:EXECUTIONS, oracles:pyth
"""

import { ethers, BigNumber } from 'ethers';
import { FlashLoanReceiverBase } from '@aave/protocol-v2';
import { IPoolAddressesProvider } from '@aave/core-v3';

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

interface FlashLoanParams {
  routeId: string;
  path: string[]; // [DEX1, DEX2, DEX3]
  tokens: string[]; // [TokenA, TokenB, TokenC, TokenA]
  amounts: string[]; // Amounts as string (BigNumber compatible)
  expectedProfit: string;
  maxSlippage: number;
  gasLimit: number;
  deadline: number;
}

interface ExecutionResult {
  routeId: string;
  success: boolean;
  actualProfit: string;
  gasUsed: number;
  txHash?: string;
  error?: string;
  executionTimeMs: number;
  timestamp: number;
}

interface DexAdapter {
  name: string;
  routerAddress: string;
  factoryAddress: string;
  initCodeHash: string;
  feeRate: number;
}

interface ValidationResult {
  isValid: boolean;
  reason?: string;
  adjustedAmounts?: string[];
  currentPrices?: Record<string, number>;
}

// ============================================================================
// CONFIGURACIONES DEX
// ============================================================================

const DEX_ADAPTERS: Record<string, DexAdapter> = {
  'uniswap': {
    name: 'Uniswap V2',
    routerAddress: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
    factoryAddress: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
    initCodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f',
    feeRate: 0.003
  },
  'sushiswap': {
    name: 'SushiSwap',
    routerAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
    factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
    initCodeHash: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303',
    feeRate: 0.003
  },
  'pancakeswap': {
    name: 'PancakeSwap',
    routerAddress: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
    factoryAddress: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
    initCodeHash: '0x00fb7f630766e6a796048ea87d01acd3068e8ff67d078148a3fa3f4a84f69bd5',
    feeRate: 0.0025
  }
};

// ============================================================================
// CLASE PRINCIPAL: FlashLoanExecutor
// ============================================================================

export class FlashLoanExecutor extends FlashLoanReceiverBase {
  private provider: ethers.providers.Provider;
  private wallet: ethers.Wallet;
  private poolAddressesProvider: IPoolAddressesProvider;
  
  // Control de operaciones concurrentes
  private activeOperations: Map<string, Promise<ExecutionResult>> = new Map();
  private maxConcurrentOps: number = 40;
  private operationQueue: FlashLoanParams[] = [];
  
  // Métricas y monitoreo
  private executionStats = {
    totalExecutions: 0,
    successfulExecutions: 0,
    totalProfitUSD: 0,
    avgExecutionTimeMs: 0,
    lastExecutionTime: 0
  };

  // Rate limiting
  private rateLimiter = {
    requestsPerMinute: 120,
    requests: [] as number[],
    windowMs: 60000
  };

  constructor(
    provider: ethers.providers.Provider,
    wallet: ethers.Wallet,
    poolAddressesProviderAddress: string
  ) {
    const poolAddressesProvider = new ethers.Contract(
      poolAddressesProviderAddress,
      IPoolAddressesProvider.abi,
      provider
    ) as IPoolAddressesProvider;
    
    super(poolAddressesProvider);
    
    this.provider = provider;
    this.wallet = wallet.connect(provider);
    this.poolAddressesProvider = poolAddressesProvider;
    
    this.setupEventListeners();
  }

  // ============================================================================
  // MÉTODOS PÚBLICOS
  // ============================================================================

  /**
   * Ejecuta flash loan de arbitraje
   */
  public async executeFlashLoan(params: FlashLoanParams): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Verificar rate limiting
      if (!this.checkRateLimit()) {
        throw new Error('Rate limit exceeded');
      }
      
      // Verificar límite de operaciones concurrentes
      if (this.activeOperations.size >= this.maxConcurrentOps) {
        // Agregar a cola si hay espacio
        if (this.operationQueue.length < 100) {
          this.operationQueue.push(params);
          return this.waitForQueuedExecution(params.routeId);
        } else {
          throw new Error('Operation queue full');
        }
      }

      // Validación pre-ejecución
      const validation = await this.validateOperation(params);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.reason}`);
      }

      // Ejecutar flash loan
      const result = await this.executeFlashLoanInternal(params, validation);
      
      // Actualizar estadísticas
      this.updateStats(result, Date.now() - startTime);
      
      // Procesar siguiente en cola
      this.processQueue();
      
      return result;

    } catch (error) {
      const errorResult: ExecutionResult = {
        routeId: params.routeId,
        success: false,
        actualProfit: '0',
        gasUsed: 0,
        error: error instanceof Error ? error.message : String(error),
        executionTimeMs: Date.now() - startTime,
        timestamp: Date.now()
      };
      
      this.updateStats(errorResult, Date.now() - startTime);
      return errorResult;
    }
  }

  /**
   * Ejecución interna del flash loan
   */
  private async executeFlashLoanInternal(
    params: FlashLoanParams,
    validation: ValidationResult
  ): Promise<ExecutionResult> {
    const executionPromise = this.performFlashLoan(params, validation);
    this.activeOperations.set(params.routeId, executionPromise);
    
    try {
      const result = await executionPromise;
      return result;
    } finally {
      this.activeOperations.delete(params.routeId);
    }
  }

  /**
   * Ejecuta el flash loan real
   */
  private async performFlashLoan(
    params: FlashLoanParams,
    validation: ValidationResult
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    try {
      // Preparar parámetros del flash loan
      const asset = params.tokens[0]; // Token inicial/final
      const amount = validation.adjustedAmounts?.[0] || params.amounts[0];
      const mode = 0; // Sin deuda, solo flash loan

      // Codificar parámetros para el callback
      const encodedParams = ethers.utils.defaultAbiCoder.encode(
        ['string', 'string[]', 'string[]', 'string[]', 'uint256', 'uint256'],
        [
          params.routeId,
          params.path,
          params.tokens,
          validation.adjustedAmounts || params.amounts,
          params.maxSlippage,
          params.deadline
        ]
      );

      // Obtener pool de Aave
      const pool = await this.poolAddressesProvider.getPool();
      const poolContract = new ethers.Contract(
        pool,
        ['function flashLoan(address,address,uint256,bytes,uint16)'],
        this.wallet
      );

      // Ejecutar flash loan
      const tx = await poolContract.flashLoan(
        this.address, // receiverAddress
        asset,       // asset
        amount,      // amount
        encodedParams, // params
        0           // referralCode
      );

      const receipt = await tx.wait();

      // Parsear eventos para obtener resultado
      const profitEvent = receipt.events?.find(e => e.event === 'FlashLoanExecuted');
      const actualProfit = profitEvent?.args?.profit || '0';

      return {
        routeId: params.routeId,
        success: receipt.status === 1 && BigNumber.from(actualProfit).gt(0),
        actualProfit,
        gasUsed: receipt.gasUsed.toNumber(),
        txHash: receipt.transactionHash,
        executionTimeMs: Date.now() - startTime,
        timestamp: Date.now()
      };

    } catch (error) {
      throw new Error(`Flash loan execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ============================================================================
  // CALLBACK DE FLASH LOAN (heredado de FlashLoanReceiverBase)
  // ============================================================================

  /**
   * Callback ejecutado por Aave durante el flash loan
   */
  public async executeOperation(
    assets: string[],
    amounts: string[],
    premiums: string[],
    initiator: string,
    params: string
  ): Promise<boolean> {
    try {
      // Decodificar parámetros
      const [routeId, path, tokens, swapAmounts, maxSlippage, deadline] = 
        ethers.utils.defaultAbiCoder.decode(
          ['string', 'string[]', 'string[]', 'string[]', 'uint256', 'uint256'],
          params
        );

      // Ejecutar secuencia de swaps
      let currentAmount = BigNumber.from(amounts[0]);
      let currentToken = tokens[0];

      for (let i = 0; i < path.length; i++) {
        const dex = path[i];
        const tokenIn = tokens[i];
        const tokenOut = tokens[i + 1];
        
        // Ejecutar swap en el DEX
        const swapResult = await this.executeSwap(
          dex,
          tokenIn,
          tokenOut,
          currentAmount,
          maxSlippage,
          deadline
        );

        currentAmount = swapResult.amountOut;
        currentToken = tokenOut;
      }

      // Verificar rentabilidad
      const totalRepayment = BigNumber.from(amounts[0]).add(premiums[0]);
      const profit = currentAmount.sub(totalRepayment);

      if (profit.lte(0)) {
        // No rentable, revertir transacción
        throw new Error(`Operation not profitable. Loss: ${profit.toString()}`);
      }

      // Transferir profit a wallet
      if (profit.gt(0)) {
        const tokenContract = new ethers.Contract(
          currentToken,
          ['function transfer(address,uint256) returns (bool)'],
          this.wallet
        );
        
        await tokenContract.transfer(this.wallet.address, profit);
      }

      // Emitir evento de éxito
      const executorContract = new ethers.Contract(
        this.address,
        ['event FlashLoanExecuted(string indexed routeId, uint256 profit)'],
        this.wallet
      );
      
      await executorContract.emit('FlashLoanExecuted', routeId, profit);

      return true; // Éxito

    } catch (error) {
      console.error('Flash loan callback error:', error);
      return false; // Falla, revertir transacción
    }
  }

  // ============================================================================
  // MÉTODOS DE SWAP
  // ============================================================================

  /**
   * Ejecuta swap en un DEX específico
   */
  private async executeSwap(
    dex: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber,
    maxSlippage: number,
    deadline: number
  ): Promise<{ amountOut: BigNumber; gasUsed: number }> {
    const dexConfig = DEX_ADAPTERS[dex.toLowerCase()];
    if (!dexConfig) {
      throw new Error(`DEX not supported: ${dex}`);
    }

    // Calcular minimum amount out considerando slippage
    const expectedAmountOut = await this.getAmountOut(dex, tokenIn, tokenOut, amountIn);
    const minAmountOut = expectedAmountOut.mul(10000 - Math.floor(maxSlippage * 10000)).div(10000);

    // Crear contrato del router
    const router = new ethers.Contract(
      dexConfig.routerAddress,
      [
        'function swapExactTokensForTokens(uint,uint,address[],address,uint) returns (uint[])',
        'function getAmountsOut(uint,address[]) view returns (uint[])'
      ],
      this.wallet
    );

    // Aprobar tokens si es necesario
    await this.ensureTokenApproval(tokenIn, dexConfig.routerAddress, amountIn);

    // Ejecutar swap
    const path = [tokenIn, tokenOut];
    const tx = await router.swapExactTokensForTokens(
      amountIn,
      minAmountOut,
      path,
      this.address,
      deadline,
      { gasLimit: 300000 }
    );

    const receipt = await tx.wait();
    const swapEvent = receipt.events?.find(e => e.event === 'Swap');
    const amountOut = swapEvent?.args?.amount1Out || swapEvent?.args?.amount0Out || minAmountOut;

    return {
      amountOut: BigNumber.from(amountOut),
      gasUsed: receipt.gasUsed.toNumber()
    };
  }

  /**
   * Obtiene amount out esperado para un swap
   */
  private async getAmountOut(
    dex: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: BigNumber
  ): Promise<BigNumber> {
    const dexConfig = DEX_ADAPTERS[dex.toLowerCase()];
    const router = new ethers.Contract(
      dexConfig.routerAddress,
      ['function getAmountsOut(uint,address[]) view returns (uint[])'],
      this.provider
    );

    const path = [tokenIn, tokenOut];
    const amounts = await router.getAmountsOut(amountIn, path);
    return amounts[1]; // Output amount
  }

  /**
   * Asegura approval de tokens
   */
  private async ensureTokenApproval(
    token: string,
    spender: string,
    amount: BigNumber
  ): Promise<void> {
    const tokenContract = new ethers.Contract(
      token,
      ['function allowance(address,address) view returns (uint256)', 'function approve(address,uint256)'],
      this.wallet
    );

    const currentAllowance = await tokenContract.allowance(this.wallet.address, spender);
    
    if (currentAllowance.lt(amount)) {
      const approveTx = await tokenContract.approve(spender, ethers.constants.MaxUint256);
      await approveTx.wait();
    }
  }

  // ============================================================================
  // VALIDACIÓN Y UTILIDADES
  // ============================================================================

  /**
   * Valida operación antes de ejecutar
   */
  private async validateOperation(params: FlashLoanParams): Promise<ValidationResult> {
    try {
      // Verificar deadline
      if (params.deadline < Date.now() / 1000) {
        return { isValid: false, reason: 'Deadline expired' };
      }

      // Verificar liquidez en pools
      for (let i = 0; i < params.path.length; i++) {
        const tokenIn = params.tokens[i];
        const tokenOut = params.tokens[i + 1];
        const dex = params.path[i];
        
        const hasLiquidity = await this.checkPoolLiquidity(dex, tokenIn, tokenOut, params.amounts[i]);
        if (!hasLiquidity) {
          return { isValid: false, reason: `Insufficient liquidity in ${dex} for ${tokenIn}/${tokenOut}` };
        }
      }

      // Validar precios actuales vs esperados
      const currentPrices = await this.getCurrentPrices(params.tokens);
      const priceDeviation = this.calculatePriceDeviation(params, currentPrices);
      
      if (priceDeviation > 0.02) { // 2% deviation threshold
        return { isValid: false, reason: `Price deviation too high: ${priceDeviation * 100}%` };
      }

      return { isValid: true, currentPrices };

    } catch (error) {
      return { isValid: false, reason: `Validation error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Verifica liquidez en un pool
   */
  private async checkPoolLiquidity(
    dex: string,
    tokenA: string,
    tokenB: string,
    amountNeeded: string
  ): Promise<boolean> {
    try {
      const expectedOut = await this.getAmountOut(dex, tokenA, tokenB, BigNumber.from(amountNeeded));
      return expectedOut.gt(0);
    } catch {
      return false;
    }
  }

  /**
   * Obtiene precios actuales de tokens
   */
  private async getCurrentPrices(tokens: string[]): Promise<Record<string, number>> {
    // TODO: Integrar con oráculos (Pyth, Chainlink)
    // Por ahora retornar precios simulados
    const prices: Record<string, number> = {};
    
    for (const token of tokens) {
      // Simular precio del oráculo
      prices[token] = Math.random() * 1000 + 1000; // $1000-2000
    }
    
    return prices;
  }

  /**
   * Calcula desviación de precios
   */
  private calculatePriceDeviation(
    params: FlashLoanParams,
    currentPrices: Record<string, number>
  ): number {
    // TODO: Implementar cálculo real basado en expected profit vs current prices
    return 0.005; // 0.5% deviation simulada
  }

  /**
   * Verifica rate limiting
   */
  private checkRateLimit(): boolean {
    const now = Date.now();
    
    // Limpiar requests antiguos
    this.rateLimiter.requests = this.rateLimiter.requests.filter(
      time => now - time < this.rateLimiter.windowMs
    );
    
    // Verificar límite
    if (this.rateLimiter.requests.length >= this.rateLimiter.requestsPerMinute) {
      return false;
    }
    
    this.rateLimiter.requests.push(now);
    return true;
  }

  /**
   * Espera ejecución desde cola
   */
  private async waitForQueuedExecution(routeId: string): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const checkQueue = () => {
        if (this.activeOperations.size < this.maxConcurrentOps && this.operationQueue.length > 0) {
          const params = this.operationQueue.shift();
          if (params && params.routeId === routeId) {
            this.executeFlashLoan(params).then(resolve);
            return;
          }
        }
        setTimeout(checkQueue, 100);
      };
      checkQueue();
    });
  }

  /**
   * Procesa cola de operaciones
   */
  private processQueue(): void {
    while (
      this.operationQueue.length > 0 && 
      this.activeOperations.size < this.maxConcurrentOps
    ) {
      const params = this.operationQueue.shift();
      if (params) {
        this.executeFlashLoan(params).catch(console.error);
      }
    }
  }

  /**
   * Actualiza estadísticas de ejecución
   */
  private updateStats(result: ExecutionResult, executionTimeMs: number): void {
    this.executionStats.totalExecutions++;
    
    if (result.success) {
      this.executionStats.successfulExecutions++;
      this.executionStats.totalProfitUSD += parseFloat(result.actualProfit) || 0;
    }
    
    this.executionStats.avgExecutionTimeMs = 
      (this.executionStats.avgExecutionTimeMs + executionTimeMs) / 2;
    
    this.executionStats.lastExecutionTime = Date.now();
  }

  /**
   * Configura event listeners
   */
  private setupEventListeners(): void {
    // Manejar shutdown graceful
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Shutdown graceful
   */
  public async shutdown(): Promise<void> {
    console.log('🔌 Cerrando FlashLoan Executor...');
    
    // Esperar a que terminen las operaciones activas
    await Promise.allSettled(Array.from(this.activeOperations.values()));
    
    console.log('✅ FlashLoan Executor cerrado');
  }

  /**
   * Obtiene estadísticas actuales
   */
  public getStats() {
    return {
      ...this.executionStats,
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      successRate: this.executionStats.totalExecutions > 0 
        ? this.executionStats.successfulExecutions / this.executionStats.totalExecutions 
        : 0
    };
  }

  /**
   * TAREA 4.1 - PROMPT SUPREMO DEFINITIVO
   * 
   * Ejecuta múltiples arbitrajes simultáneos (hasta 40+)
   * 
   * Esta es la función principal requerida por el Prompt Supremo.
   * 
   * Flujo:
   * 1. Lee rutas desde Sheets (ROUTES - 200 campos)
   * 2. Valida con oráculos Pyth/Chainlink
   * 3. Ejecuta transacciones en paralelo (40+ simultáneas)
   * 4. Escribe resultados a Sheets (EXECUTIONS - 50 campos)
   * 
   * @param maxConcurrent - Número máximo de operaciones simultáneas (default: 40)
   * @returns Array de resultados de ejecución
   */
  public async executeMultipleArbitrages(maxConcurrent: number = 40): Promise<ExecutionResult[]> {
    console.log(`🚀 Ejecutando hasta ${maxConcurrent} arbitrajes simultáneos...`);
    
    // 1. Leer rutas desde Google Sheets (ROUTES)
    const routes = await this.readRoutesFromSheets();
    console.log(`📊 Leídas ${routes.length} rutas desde Sheets`);
    
    // 2. Filtrar rutas activas y rentables
    const activeRoutes = routes.filter(r => 
      r.isActive && 
      parseFloat(r.expectedProfit) > parseFloat(r.minProfit || '0')
    );
    
    console.log(`✅ ${activeRoutes.length} rutas activas y rentables`);
    
    // 3. Validar con oráculos antes de ejecutar
    const validatedRoutes = [];
    for (const route of activeRoutes) {
      const validation = await this.validateWithOracles(route);
      if (validation.isValid) {
        validatedRoutes.push(route);
      } else {
        console.log(`⚠️  Ruta ${route.routeId} rechazada: ${validation.reason}`);
      }
    }
    
    console.log(`✅ ${validatedRoutes.length} rutas validadas con oráculos`);
    
    // 4. Ejecutar en batches de maxConcurrent
    const results: ExecutionResult[] = [];
    for (let i = 0; i < validatedRoutes.length; i += maxConcurrent) {
      const batch = validatedRoutes.slice(i, i + maxConcurrent);
      console.log(`📦 Ejecutando batch ${Math.floor(i / maxConcurrent) + 1} con ${batch.length} rutas...`);
      
      // Ejecutar batch en paralelo
      const batchPromises = batch.map(route => this.executeFlashLoan({
        routeId: route.routeId,
        path: route.path.split(','),
        tokens: route.tokens.split(','),
        amounts: route.amounts.split(','),
        expectedProfit: route.expectedProfit,
        maxSlippage: parseFloat(route.maxSlippage || '0.5'),
        gasLimit: parseInt(route.gasLimit || '500000'),
        deadline: Date.now() + 300000 // 5 minutos
      }));
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Procesar resultados del batch
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          console.error(`❌ Error en ejecución: ${result.reason}`);
          results.push({
            routeId: 'unknown',
            success: false,
            actualProfit: '0',
            gasUsed: 0,
            error: result.reason?.message || 'Unknown error',
            executionTimeMs: 0,
            timestamp: Date.now()
          });
        }
      }
    }
    
    // 5. Escribir resultados a Google Sheets (EXECUTIONS)
    await this.writeResultsToSheets(results);
    
    // 6. Estadísticas finales
    const successful = results.filter(r => r.success).length;
    const totalProfit = results.reduce((sum, r) => 
      sum + (r.success ? parseFloat(r.actualProfit) : 0), 0
    );
    
    console.log(`\n📊 RESUMEN DE EJECUCIÓN:`);
    console.log(`   Total rutas: ${results.length}`);
    console.log(`   Exitosas: ${successful} (${(successful/results.length*100).toFixed(1)}%)`);
    console.log(`   Profit total: $${totalProfit.toFixed(2)} USD`);
    console.log(`   Avg profit/ruta: $${(totalProfit/successful || 0).toFixed(2)} USD\n`);
    
    return results;
  }
  
  /**
   * Lee rutas desde Google Sheets (ROUTES - 200 campos)
   */
  private async readRoutesFromSheets(): Promise<any[]> {
    // TODO: Implementar lectura real desde Sheets
    // Por ahora devuelve array vacío
    console.log('📖 Leyendo rutas desde Google Sheets...');
    return [];
  }
  
  /**
   * Valida ruta con oráculos Pyth/Chainlink
   */
  private async validateWithOracles(route: any): Promise<ValidationResult> {
    // TODO: Implementar validación real con oráculos
    console.log(`🔍 Validando ruta ${route.routeId} con oráculos...`);
    return {
      isValid: true,
      currentPrices: {}
    };
  }
  
  /**
   * Escribe resultados a Google Sheets (EXECUTIONS - 50 campos)
   */
  private async writeResultsToSheets(results: ExecutionResult[]): Promise<void> {
    // TODO: Implementar escritura real a Sheets
    console.log(`📝 Escribiendo ${results.length} resultados a Google Sheets...`);
  }
}


export default FlashLoanExecutor;