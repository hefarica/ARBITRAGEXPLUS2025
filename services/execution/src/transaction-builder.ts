/**
 * @file transaction-builder.ts
 * @description Constructor de transacciones batch para ArbitrageManager
 * 
 * ARBITRAGEXPLUS2025 - Transaction Builder
 * 
 * Construye transacciones optimizadas para el contrato ArbitrageManager,
 * incluyendo encoding de datos, cálculo de gas y validaciones.
 */

import { ethers } from 'ethers';
import { Logger } from './logger';

// ==================================================================================
// TIPOS
// ==================================================================================

export interface BatchOperation {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  minAmountOut: string;
  path: string[];
  exchanges: string[];
  swapData: string;
  deadline: number;
}

export interface BuildBatchResult {
  operations: BatchOperation[];
  estimatedGas: ethers.BigNumber;
  encodedData: string;
}

// ==================================================================================
// CLASE PRINCIPAL
// ==================================================================================

export class TransactionBuilder {
  private logger: Logger;
  
  // Slippage tolerance (en basis points)
  private readonly DEFAULT_SLIPPAGE_BPS = 100; // 1%
  
  constructor() {
    this.logger = new Logger('TransactionBuilder');
  }
  
  /**
   * Construye una transacción batch para ArbitrageManager
   */
  async buildBatchOperation(
    manager: ethers.Contract,
    opportunities: any[]
  ): Promise<BuildBatchResult> {
    this.logger.debug('Building batch operation', {
      opsCount: opportunities.length,
    });
    
    // Convertir oportunidades a BatchOperations
    const operations: BatchOperation[] = opportunities.map((opp) =>
      this.buildOperation(opp)
    );
    
    // Estimar gas
    const estimatedGas = await this.estimateGas(manager, operations);
    
    // Encodear datos
    const encodedData = this.encodeOperations(operations);
    
    this.logger.debug('Batch operation built', {
      opsCount: operations.length,
      estimatedGas: estimatedGas.toString(),
    });
    
    return {
      operations,
      estimatedGas,
      encodedData,
    };
  }
  
  /**
   * Construye una operación individual
   */
  private buildOperation(opportunity: any): BatchOperation {
    // Calcular minAmountOut con slippage
    const expectedOut = ethers.BigNumber.from(opportunity.expectedProfit);
    const slippage = expectedOut.mul(this.DEFAULT_SLIPPAGE_BPS).div(10000);
    const minAmountOut = expectedOut.sub(slippage);
    
    return {
      tokenIn: opportunity.tokenIn,
      tokenOut: opportunity.tokenOut,
      amountIn: opportunity.amountIn,
      minAmountOut: minAmountOut.toString(),
      path: opportunity.path,
      exchanges: opportunity.dexes,
      swapData: this.encodeSwapData(opportunity),
      deadline: opportunity.deadline,
    };
  }
  
  /**
   * Encodea datos específicos del swap
   */
  private encodeSwapData(opportunity: any): string {
    // Por ahora retornar datos vacíos
    // En producción, encodear datos específicos según el DEX
    return '0x';
  }
  
  /**
   * Estima el gas necesario para la transacción
   */
  private async estimateGas(
    manager: ethers.Contract,
    operations: BatchOperation[]
  ): Promise<ethers.BigNumber> {
    try {
      const estimate = await manager.estimateGas.executeBatch(operations);
      
      // Agregar 20% de margen
      const withMargin = estimate.mul(120).div(100);
      
      return withMargin;
    } catch (error) {
      this.logger.warn('Gas estimation failed, using default', error);
      
      // Gas por defecto: 500k por operación
      const defaultGas = ethers.BigNumber.from(500000).mul(operations.length);
      return defaultGas;
    }
  }
  
  /**
   * Encodea las operaciones para la transacción
   */
  private encodeOperations(operations: BatchOperation[]): string {
    // Usar ethers ABI coder
    const abiCoder = new ethers.utils.AbiCoder();
    
    const encoded = abiCoder.encode(
      [
        'tuple(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, address[] path, address[] exchanges, bytes swapData, uint256 deadline)[]',
      ],
      [operations]
    );
    
    return encoded;
  }
  
  /**
   * Valida una operación antes de construirla
   */
  validateOperation(opportunity: any): boolean {
    // Validar campos requeridos
    if (!opportunity.tokenIn || !ethers.utils.isAddress(opportunity.tokenIn)) {
      this.logger.warn('Invalid tokenIn', { tokenIn: opportunity.tokenIn });
      return false;
    }
    
    if (!opportunity.tokenOut || !ethers.utils.isAddress(opportunity.tokenOut)) {
      this.logger.warn('Invalid tokenOut', { tokenOut: opportunity.tokenOut });
      return false;
    }
    
    if (!opportunity.amountIn || ethers.BigNumber.from(opportunity.amountIn).lte(0)) {
      this.logger.warn('Invalid amountIn', { amountIn: opportunity.amountIn });
      return false;
    }
    
    if (!opportunity.path || opportunity.path.length < 2) {
      this.logger.warn('Invalid path', { path: opportunity.path });
      return false;
    }
    
    if (!opportunity.dexes || opportunity.dexes.length === 0) {
      this.logger.warn('Invalid dexes', { dexes: opportunity.dexes });
      return false;
    }
    
    return true;
  }
}

