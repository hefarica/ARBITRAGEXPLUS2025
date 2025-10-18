/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/adapters/ws/pancakeswap.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ./uniswap
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: PancakeSwapAdapter
 *   INTERFACES: PancakeSwapConfig
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: PancakeSwapAdapter
 * 
 * 🔗 DEPENDENCIAS:
 *   - ./uniswap
 * 
 * ============================================================================
 */

/**
 * ARBITRAGEXPLUS2025 - PancakeSwap WebSocket Adapter
 * 
 * Adaptador dinámico para PancakeSwap que:
 * - Hereda funcionalidad de UniswapAdapter (mismo protocolo AMM)
 * - Se configura desde Google Sheets (DEXES y POOLS)
 * - Monitorea precios y liquidez en tiempo real
 * - Soporta BSC y otras chains
 * - Incluye características específicas de PancakeSwap (farms, syrup pools)
 * - NO tiene hardcoding
 */

import { UniswapAdapter } from './uniswap';

// ==================================================================================
// TYPES & INTERFACES
// ==================================================================================

interface PancakeSwapConfig {
  dexId: string;
  name: string;
  version: 'v2' | 'v3';
  chainId: number;
  routerAddress: string;
  factoryAddress: string;
  wssUrl?: string;
  rpcUrl: string;
  isActive: boolean;
  // PancakeSwap specific
  masterChefAddress?: string;
  cakeTokenAddress?: string;
  farmsEnabled?: boolean;
  syrupPoolsEnabled?: boolean;
}

// ==================================================================================
// PANCAKESWAP ADAPTER CLASS
// ==================================================================================

/**
 * PancakeSwap usa el mismo protocolo que Uniswap V2/V3, por lo que podemos
 * heredar toda la funcionalidad y solo agregar características específicas
 */
export class PancakeSwapAdapter extends UniswapAdapter {
  private pancakeConfig: PancakeSwapConfig;

  constructor(config: PancakeSwapConfig) {
    // Convertir config de PancakeSwap a formato UniswapAdapter
    super({
      dexId: config.dexId,
      name: config.name,
      version: config.version,
      chainId: config.chainId,
      routerAddress: config.routerAddress,
      factoryAddress: config.factoryAddress,
      wssUrl: config.wssUrl,
      rpcUrl: config.rpcUrl,
      isActive: config.isActive,
    });

    this.pancakeConfig = config;
  }

  // ================================================================================
  // PANCAKESWAP SPECIFIC FEATURES
  // ================================================================================

  /**
   * Conectar con logging específico de PancakeSwap
   */
  async connect(): Promise<void> {
    console.log(`[PancakeSwapAdapter] Conectando a PancakeSwap ${this.pancakeConfig.version} en chain ${this.pancakeConfig.chainId}...`);
    await super.connect();
    
    if (this.pancakeConfig.farmsEnabled && this.pancakeConfig.masterChefAddress) {
      console.log(`[PancakeSwapAdapter] Farms habilitados con MasterChef: ${this.pancakeConfig.masterChefAddress}`);
    }

    if (this.pancakeConfig.syrupPoolsEnabled) {
      console.log(`[PancakeSwapAdapter] Syrup Pools habilitados`);
    }

    if (this.pancakeConfig.cakeTokenAddress) {
      console.log(`[PancakeSwapAdapter] CAKE token: ${this.pancakeConfig.cakeTokenAddress}`);
    }
  }

  /**
   * Obtener configuración específica de PancakeSwap
   */
  getPancakeConfig(): PancakeSwapConfig {
    return { ...this.pancakeConfig };
  }

  /**
   * Verificar si tiene farms habilitados
   */
  hasFarmsEnabled(): boolean {
    return this.pancakeConfig.farmsEnabled === true && !!this.pancakeConfig.masterChefAddress;
  }

  /**
   * Verificar si tiene syrup pools habilitados
   */
  hasSyrupPoolsEnabled(): boolean {
    return this.pancakeConfig.syrupPoolsEnabled === true;
  }

  /**
   * Obtener dirección del token CAKE
   */
  getCakeTokenAddress(): string | undefined {
    return this.pancakeConfig.cakeTokenAddress;
  }

  /**
   * Obtener estadísticas extendidas
   */
  getStats() {
    const baseStats = super.getStats();
    return {
      ...baseStats,
      platform: 'PancakeSwap',
      version: this.pancakeConfig.version,
      farmsEnabled: this.pancakeConfig.farmsEnabled,
      syrupPoolsEnabled: this.pancakeConfig.syrupPoolsEnabled,
      masterChefAddress: this.pancakeConfig.masterChefAddress,
      cakeTokenAddress: this.pancakeConfig.cakeTokenAddress,
    };
  }
}

export default PancakeSwapAdapter;

