/**
 * ARBITRAGEXPLUS2025 - SushiSwap WebSocket Adapter
 * 
 * Adaptador dinámico para SushiSwap que:
 * - Hereda funcionalidad de UniswapAdapter (mismo protocolo AMM)
 * - Se configura desde Google Sheets (DEXES y POOLS)
 * - Monitorea precios y liquidez en tiempo real
 * - Soporta múltiples chains (Ethereum, Polygon, Arbitrum, etc.)
 * - NO tiene hardcoding
 */

import { UniswapAdapter } from './uniswap';

// ==================================================================================
// TYPES & INTERFACES
// ==================================================================================

interface SushiSwapConfig {
  dexId: string;
  name: string;
  chainId: number;
  routerAddress: string;
  factoryAddress: string;
  wssUrl?: string;
  rpcUrl: string;
  isActive: boolean;
  // SushiSwap specific
  masterChefAddress?: string;
  rewardsEnabled?: boolean;
}

// ==================================================================================
// SUSHISWAP ADAPTER CLASS
// ==================================================================================

/**
 * SushiSwap usa el mismo protocolo que Uniswap V2, por lo que podemos
 * heredar toda la funcionalidad y solo agregar características específicas
 */
export class SushiSwapAdapter extends UniswapAdapter {
  private sushiConfig: SushiSwapConfig;

  constructor(config: SushiSwapConfig) {
    // Convertir config de SushiSwap a formato UniswapAdapter
    super({
      dexId: config.dexId,
      name: config.name,
      version: 'v2', // SushiSwap usa protocolo V2
      chainId: config.chainId,
      routerAddress: config.routerAddress,
      factoryAddress: config.factoryAddress,
      wssUrl: config.wssUrl,
      rpcUrl: config.rpcUrl,
      isActive: config.isActive,
    });

    this.sushiConfig = config;
  }

  // ================================================================================
  // SUSHISWAP SPECIFIC FEATURES
  // ================================================================================

  /**
   * Conectar con logging específico de SushiSwap
   */
  async connect(): Promise<void> {
    console.log(`[SushiSwapAdapter] Conectando a SushiSwap en chain ${this.sushiConfig.chainId}...`);
    await super.connect();
    
    if (this.sushiConfig.rewardsEnabled && this.sushiConfig.masterChefAddress) {
      console.log(`[SushiSwapAdapter] Rewards habilitados con MasterChef: ${this.sushiConfig.masterChefAddress}`);
    }
  }

  /**
   * Obtener configuración específica de SushiSwap
   */
  getSushiConfig(): SushiSwapConfig {
    return { ...this.sushiConfig };
  }

  /**
   * Verificar si tiene rewards habilitados
   */
  hasRewardsEnabled(): boolean {
    return this.sushiConfig.rewardsEnabled === true && !!this.sushiConfig.masterChefAddress;
  }

  /**
   * Obtener estadísticas extendidas
   */
  getStats() {
    const baseStats = super.getStats();
    return {
      ...baseStats,
      platform: 'SushiSwap',
      rewardsEnabled: this.sushiConfig.rewardsEnabled,
      masterChefAddress: this.sushiConfig.masterChefAddress,
    };
  }
}

export default SushiSwapAdapter;

