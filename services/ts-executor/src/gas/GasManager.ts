/**
 * ============================================================================
 * ARCHIVO: ./services/ts-executor/src/gas/GasManager.ts
 * SERVICIO: ts-executor
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ethers
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: GasManager
 *   INTERFACES: GasPrice, GasEstimate
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: GasManager, GasPrice, GasEstimate
 * 
 * 🔗 DEPENDENCIAS:
 *   - ethers
 * 
 * ============================================================================
 */

/**
 * GasManager.ts
 * 
 * Gestión inteligente de gas pricing para ARBITRAGEXPLUS2025
 * Soporta EIP-1559 y estrategias de optimización
 * 
 * @author ARBITRAGEXPLUS2025
 */

import { ethers, BigNumber, providers } from 'ethers';

export interface GasPrice {
  maxFeePerGas: BigNumber;
  maxPriorityFeePerGas: BigNumber;
  baseFee?: BigNumber;
}

export interface GasEstimate {
  slow: GasPrice;
  standard: GasPrice;
  fast: GasPrice;
  instant: GasPrice;
}

export enum GasStrategy {
  SLOW = 'slow',
  STANDARD = 'standard',
  FAST = 'fast',
  INSTANT = 'instant',
  CUSTOM = 'custom'
}

export class GasManager {
  private provider: providers.Provider;
  private strategy: GasStrategy;
  private maxFeePerGas?: BigNumber;
  private maxPriorityFeePerGas?: BigNumber;
  
  constructor(
    provider: providers.Provider,
    strategy: GasStrategy = GasStrategy.FAST,
    maxFeePerGas?: string,
    maxPriorityFeePerGas?: string
  ) {
    this.provider = provider;
    this.strategy = strategy;
    
    if (maxFeePerGas) {
      this.maxFeePerGas = BigNumber.from(maxFeePerGas);
    }
    if (maxPriorityFeePerGas) {
      this.maxPriorityFeePerGas = BigNumber.from(maxPriorityFeePerGas);
    }
  }
  
  /**
   * Obtiene el gas price óptimo según la estrategia configurada
   */
  async getOptimalGasPrice(): Promise<GasPrice> {
    if (this.strategy === GasStrategy.CUSTOM && this.maxFeePerGas && this.maxPriorityFeePerGas) {
      return {
        maxFeePerGas: this.maxFeePerGas,
        maxPriorityFeePerGas: this.maxPriorityFeePerGas
      };
    }
    
    const estimates = await this.getGasEstimates();
    
    switch (this.strategy) {
      case GasStrategy.SLOW:
        return estimates.slow;
      case GasStrategy.STANDARD:
        return estimates.standard;
      case GasStrategy.FAST:
        return estimates.fast;
      case GasStrategy.INSTANT:
        return estimates.instant;
      default:
        return estimates.fast;
    }
  }
  
  /**
   * Obtiene estimaciones de gas para diferentes velocidades
   */
  async getGasEstimates(): Promise<GasEstimate> {
    try {
      // Obtener base fee del último bloque
      const block = await this.provider.getBlock('latest');
      const baseFee = block.baseFeePerGas || BigNumber.from(0);
      
      // Calcular priority fees según velocidad
      // Slow: base fee + 1 gwei
      // Standard: base fee + 2 gwei
      // Fast: base fee + 3 gwei
      // Instant: base fee + 5 gwei
      
      const oneGwei = ethers.utils.parseUnits('1', 'gwei');
      
      return {
        slow: {
          maxFeePerGas: baseFee.mul(110).div(100).add(oneGwei), // base * 1.1 + 1 gwei
          maxPriorityFeePerGas: oneGwei,
          baseFee
        },
        standard: {
          maxFeePerGas: baseFee.mul(120).div(100).add(oneGwei.mul(2)), // base * 1.2 + 2 gwei
          maxPriorityFeePerGas: oneGwei.mul(2),
          baseFee
        },
        fast: {
          maxFeePerGas: baseFee.mul(130).div(100).add(oneGwei.mul(3)), // base * 1.3 + 3 gwei
          maxPriorityFeePerGas: oneGwei.mul(3),
          baseFee
        },
        instant: {
          maxFeePerGas: baseFee.mul(150).div(100).add(oneGwei.mul(5)), // base * 1.5 + 5 gwei
          maxPriorityFeePerGas: oneGwei.mul(5),
          baseFee
        }
      };
    } catch (error) {
      // Fallback a gas price legacy
      const gasPrice = await this.provider.getGasPrice();
      
      return {
        slow: {
          maxFeePerGas: gasPrice.mul(90).div(100),
          maxPriorityFeePerGas: ethers.utils.parseUnits('1', 'gwei')
        },
        standard: {
          maxFeePerGas: gasPrice,
          maxPriorityFeePerGas: ethers.utils.parseUnits('2', 'gwei')
        },
        fast: {
          maxFeePerGas: gasPrice.mul(110).div(100),
          maxPriorityFeePerGas: ethers.utils.parseUnits('3', 'gwei')
        },
        instant: {
          maxFeePerGas: gasPrice.mul(130).div(100),
          maxPriorityFeePerGas: ethers.utils.parseUnits('5', 'gwei')
        }
      };
    }
  }
  
  /**
   * Calcula el costo estimado de gas en USD
   */
  async estimateGasCostUSD(
    gasLimit: number,
    ethPriceUSD: number
  ): Promise<number> {
    const gasPrice = await this.getOptimalGasPrice();
    const gasCostWei = gasPrice.maxFeePerGas.mul(gasLimit);
    const gasCostEth = parseFloat(ethers.utils.formatEther(gasCostWei));
    return gasCostEth * ethPriceUSD;
  }
  
  /**
   * Verifica si el gas price está dentro del límite configurado
   */
  isWithinLimit(gasPrice: GasPrice): boolean {
    if (!this.maxFeePerGas) {
      return true;
    }
    return gasPrice.maxFeePerGas.lte(this.maxFeePerGas);
  }
  
  /**
   * Actualiza la estrategia de gas
   */
  setStrategy(strategy: GasStrategy): void {
    this.strategy = strategy;
  }
  
  /**
   * Actualiza los límites de gas
   */
  setLimits(maxFeePerGas?: string, maxPriorityFeePerGas?: string): void {
    if (maxFeePerGas) {
      this.maxFeePerGas = BigNumber.from(maxFeePerGas);
    }
    if (maxPriorityFeePerGas) {
      this.maxPriorityFeePerGas = BigNumber.from(maxPriorityFeePerGas);
    }
  }
}

