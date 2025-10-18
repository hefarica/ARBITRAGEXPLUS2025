/**
 * @file gas-manager.ts
 * @description Gestor de gas para optimización de costos de transacciones
 * 
 * ARBITRAGEXPLUS2025 - Gas Manager
 * 
 * Monitorea precios de gas en tiempo real y calcula precios óptimos
 * para maximizar rentabilidad de operaciones de arbitraje.
 */

import { ethers } from 'ethers';
import axios from 'axios';
import { Logger } from './logger';

// ==================================================================================
// TIPOS
// ==================================================================================

export interface GasPrice {
  slow: ethers.BigNumber;
  standard: ethers.BigNumber;
  fast: ethers.BigNumber;
  instant: ethers.BigNumber;
  baseFee?: ethers.BigNumber;
  priorityFee?: ethers.BigNumber;
}

export interface GasEstimate {
  gasPrice: ethers.BigNumber;
  gasLimit: ethers.BigNumber;
  totalCost: ethers.BigNumber;
  estimatedTime: number; // en segundos
}

// ==================================================================================
// CLASE PRINCIPAL
// ==================================================================================

export class GasManager {
  private logger: Logger;
  
  // Cache de precios de gas por chain
  private gasPriceCache: Map<number, { price: GasPrice; timestamp: number }>;
  
  // Tiempo de cache (30 segundos)
  private readonly CACHE_TTL_MS = 30000;
  
  // Multiplicadores de gas por prioridad
  private readonly GAS_MULTIPLIERS = {
    slow: 0.9,
    standard: 1.0,
    fast: 1.2,
    instant: 1.5,
  };
  
  constructor() {
    this.logger = new Logger('GasManager');
    this.gasPriceCache = new Map();
  }
  
  /**
   * Obtiene el precio de gas óptimo para una chain
   */
  async getOptimalGasPrice(chainId: number, priority: 'slow' | 'standard' | 'fast' | 'instant' = 'fast'): Promise<ethers.BigNumber> {
    try {
      const gasPrice = await this.getGasPrice(chainId);
      
      // Retornar según prioridad
      switch (priority) {
        case 'slow':
          return gasPrice.slow;
        case 'standard':
          return gasPrice.standard;
        case 'fast':
          return gasPrice.fast;
        case 'instant':
          return gasPrice.instant;
        default:
          return gasPrice.fast;
      }
    } catch (error) {
      this.logger.error('Failed to get optimal gas price', error);
      
      // Fallback a precio por defecto
      return this.getDefaultGasPrice(chainId);
    }
  }
  
  /**
   * Obtiene precios de gas actuales
   */
  async getGasPrice(chainId: number): Promise<GasPrice> {
    // Verificar cache
    const cached = this.gasPriceCache.get(chainId);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.price;
    }
    
    // Obtener precio según la chain
    let gasPrice: GasPrice;
    
    switch (chainId) {
      case 1: // Ethereum Mainnet
        gasPrice = await this.getEthereumGasPrice();
        break;
      case 56: // BSC
        gasPrice = await this.getBSCGasPrice();
        break;
      case 137: // Polygon
        gasPrice = await this.getPolygonGasPrice();
        break;
      case 42161: // Arbitrum
        gasPrice = await this.getArbitrumGasPrice();
        break;
      default:
        gasPrice = await this.getGenericGasPrice(chainId);
    }
    
    // Guardar en cache
    this.gasPriceCache.set(chainId, {
      price: gasPrice,
      timestamp: Date.now(),
    });
    
    return gasPrice;
  }
  
  /**
   * Estima el costo total de una transacción
   */
  async estimateCost(
    chainId: number,
    gasLimit: number,
    priority: 'slow' | 'standard' | 'fast' | 'instant' = 'fast'
  ): Promise<GasEstimate> {
    const gasPrice = await this.getOptimalGasPrice(chainId, priority);
    const gasLimitBN = ethers.BigNumber.from(gasLimit);
    const totalCost = gasPrice.mul(gasLimitBN);
    
    // Estimar tiempo de confirmación según prioridad
    const estimatedTime = this.getEstimatedConfirmationTime(priority);
    
    return {
      gasPrice,
      gasLimit: gasLimitBN,
      totalCost,
      estimatedTime,
    };
  }
  
  /**
   * Verifica si una operación es rentable considerando el gas
   */
  isProfitable(
    expectedProfit: ethers.BigNumber,
    gasCost: ethers.BigNumber,
    minProfitMarginBps: number = 500 // 5% mínimo
  ): boolean {
    if (gasCost.gte(expectedProfit)) {
      return false;
    }
    
    const netProfit = expectedProfit.sub(gasCost);
    const profitMarginBps = netProfit.mul(10000).div(expectedProfit);
    
    return profitMarginBps.gte(minProfitMarginBps);
  }
  
  // ==================================================================================
  // OBTENCIÓN DE PRECIOS POR CHAIN
  // ==================================================================================
  
  /**
   * Obtiene precio de gas de Ethereum usando múltiples fuentes
   */
  private async getEthereumGasPrice(): Promise<GasPrice> {
    try {
      // Intentar con Etherscan Gas Tracker
      const response = await axios.get(
        'https://api.etherscan.io/api',
        {
          params: {
            module: 'gastracker',
            action: 'gasoracle',
            apikey: process.env.ETHERSCAN_API_KEY || '',
          },
          timeout: 5000,
        }
      );
      
      if (response.data.status === '1') {
        const data = response.data.result;
        
        return {
          slow: ethers.utils.parseUnits(data.SafeGasPrice, 'gwei'),
          standard: ethers.utils.parseUnits(data.ProposeGasPrice, 'gwei'),
          fast: ethers.utils.parseUnits(data.FastGasPrice, 'gwei'),
          instant: ethers.utils.parseUnits(data.FastGasPrice, 'gwei').mul(12).div(10),
        };
      }
    } catch (error) {
      this.logger.debug('Etherscan gas price fetch failed', error);
    }
    
    // Fallback a precio genérico
    return this.getGenericGasPrice(1);
  }
  
  /**
   * Obtiene precio de gas de BSC
   */
  private async getBSCGasPrice(): Promise<GasPrice> {
    try {
      const response = await axios.get(
        'https://api.bscscan.com/api',
        {
          params: {
            module: 'gastracker',
            action: 'gasoracle',
            apikey: process.env.BSCSCAN_API_KEY || '',
          },
          timeout: 5000,
        }
      );
      
      if (response.data.status === '1') {
        const data = response.data.result;
        
        return {
          slow: ethers.utils.parseUnits(data.SafeGasPrice, 'gwei'),
          standard: ethers.utils.parseUnits(data.ProposeGasPrice, 'gwei'),
          fast: ethers.utils.parseUnits(data.FastGasPrice, 'gwei'),
          instant: ethers.utils.parseUnits(data.FastGasPrice, 'gwei').mul(12).div(10),
        };
      }
    } catch (error) {
      this.logger.debug('BSCscan gas price fetch failed', error);
    }
    
    // Fallback: BSC suele tener gas bajo y estable
    const basePrice = ethers.utils.parseUnits('5', 'gwei');
    return {
      slow: basePrice.mul(8).div(10),
      standard: basePrice,
      fast: basePrice.mul(12).div(10),
      instant: basePrice.mul(15).div(10),
    };
  }
  
  /**
   * Obtiene precio de gas de Polygon
   */
  private async getPolygonGasPrice(): Promise<GasPrice> {
    try {
      const response = await axios.get(
        'https://gasstation-mainnet.matic.network/v2',
        {
          timeout: 5000,
        }
      );
      
      if (response.data) {
        const data = response.data;
        
        return {
          slow: ethers.utils.parseUnits(data.safeLow.maxFee.toFixed(9), 'gwei'),
          standard: ethers.utils.parseUnits(data.standard.maxFee.toFixed(9), 'gwei'),
          fast: ethers.utils.parseUnits(data.fast.maxFee.toFixed(9), 'gwei'),
          instant: ethers.utils.parseUnits(data.fastest.maxFee.toFixed(9), 'gwei'),
        };
      }
    } catch (error) {
      this.logger.debug('Polygon gas station fetch failed', error);
    }
    
    // Fallback: Polygon suele tener gas muy bajo
    const basePrice = ethers.utils.parseUnits('30', 'gwei');
    return {
      slow: basePrice.mul(8).div(10),
      standard: basePrice,
      fast: basePrice.mul(12).div(10),
      instant: basePrice.mul(15).div(10),
    };
  }
  
  /**
   * Obtiene precio de gas de Arbitrum
   */
  private async getArbitrumGasPrice(): Promise<GasPrice> {
    // Arbitrum tiene gas muy bajo y estable
    const basePrice = ethers.utils.parseUnits('0.1', 'gwei');
    
    return {
      slow: basePrice.mul(8).div(10),
      standard: basePrice,
      fast: basePrice.mul(12).div(10),
      instant: basePrice.mul(15).div(10),
    };
  }
  
  /**
   * Obtiene precio de gas genérico usando RPC
   */
  private async getGenericGasPrice(chainId: number): Promise<GasPrice> {
    try {
      const rpcUrl = this.getRPCUrl(chainId);
      const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      
      const gasPrice = await provider.getGasPrice();
      
      return {
        slow: gasPrice.mul(this.GAS_MULTIPLIERS.slow * 100).div(100),
        standard: gasPrice,
        fast: gasPrice.mul(this.GAS_MULTIPLIERS.fast * 100).div(100),
        instant: gasPrice.mul(this.GAS_MULTIPLIERS.instant * 100).div(100),
      };
    } catch (error) {
      this.logger.error('Generic gas price fetch failed', error);
      return this.getDefaultGasPrice(chainId);
    }
  }
  
  /**
   * Retorna precio de gas por defecto según chain
   */
  private getDefaultGasPrice(chainId: number): ethers.BigNumber {
    const defaults: Record<number, string> = {
      1: '50', // Ethereum: 50 gwei
      56: '5', // BSC: 5 gwei
      137: '30', // Polygon: 30 gwei
      42161: '0.1', // Arbitrum: 0.1 gwei
      10: '0.001', // Optimism: 0.001 gwei
      43114: '25', // Avalanche: 25 gwei
    };
    
    const defaultGwei = defaults[chainId] || '20';
    return ethers.utils.parseUnits(defaultGwei, 'gwei');
  }
  
  /**
   * Obtiene RPC URL para una chain
   */
  private getRPCUrl(chainId: number): string {
    const urls: Record<number, string> = {
      1: process.env.MAINNET_RPC_URL || 'https://eth.llamarpc.com',
      56: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
      137: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      42161: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
      10: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
      43114: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    };
    
    return urls[chainId] || '';
  }
  
  /**
   * Estima tiempo de confirmación según prioridad
   */
  private getEstimatedConfirmationTime(priority: string): number {
    const times: Record<string, number> = {
      slow: 300, // 5 minutos
      standard: 60, // 1 minuto
      fast: 15, // 15 segundos
      instant: 5, // 5 segundos
    };
    
    return times[priority] || 60;
  }
  
  /**
   * Limpia el cache de precios
   */
  clearCache(): void {
    this.gasPriceCache.clear();
    this.logger.debug('Gas price cache cleared');
  }
}

