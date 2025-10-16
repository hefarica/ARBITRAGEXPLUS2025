/**
 * Chain Manager - Gestión dinámica de blockchains
 * 
 * Gestiona conexiones a múltiples blockchains consumiendo configuración desde Sheets.
 * TODO es dinámico, sin hardcoding de chains.
 * 
 * Premisas:
 * 1. Configuración de chains desde BLOCKCHAINS en Sheets
 * 2. Arrays dinámicos para gestión de múltiples chains
 * 3. Consumido por el executor principal y flash.ts
 */

import { ethers } from 'ethers';
import type { Provider, Signer, Wallet } from 'ethers';

/**
 * Configuración de blockchain desde Sheets
 */
export interface ChainConfig {
  chainId: string;
  name: string;
  rpcUrl: string;
  chainIdNum: number;
  nativeCurrency: string;
  blockTime: number;
  gasLimit: string;
  maxGasPrice: string;
  enabled: boolean;
}

/**
 * Conexión activa a una blockchain
 */
export interface ChainConnection {
  config: ChainConfig;
  provider: Provider;
  signer: Signer;
  blockNumber: number;
  lastUpdate: number;
}

/**
 * Chain Manager
 * Gestiona conexiones a múltiples blockchains dinámicamente desde Sheets
 */
export class ChainManager {
  private connections: Map<string, ChainConnection> = new Map();
  private wallet: Wallet;
  private chainsConfig: ChainConfig[] = [];
  
  constructor(privateKey: string) {
    this.wallet = new ethers.Wallet(privateKey);
  }
  
  /**
   * Inicializa chains desde configuración de Sheets
   * Consume el array de BLOCKCHAINS dinámicamente
   */
  async initializeChains(chainsConfig: ChainConfig[]): Promise<void> {
    this.chainsConfig = chainsConfig;
    
    // Filtrar chains habilitadas usando array dinámico
    const enabledChains = chainsConfig.filter(chain => chain.enabled);
    
    // Inicializar conexiones en paralelo usando Promise.all
    await Promise.all(
      enabledChains.map(config => this.connectToChain(config))
    );
  }
  
  /**
   * Conecta a una blockchain específica
   */
  private async connectToChain(config: ChainConfig): Promise<void> {
    try {
      // Crear provider desde RPC URL dinámico
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      
      // Conectar wallet al provider
      const signer = this.wallet.connect(provider);
      
      // Obtener block number actual
      const blockNumber = await provider.getBlockNumber();
      
      // Guardar conexión
      this.connections.set(config.chainId, {
        config,
        provider,
        signer,
        blockNumber,
        lastUpdate: Date.now()
      });
      
      console.log(`✅ Connected to ${config.name} (${config.chainId})`);
    } catch (error) {
      console.error(`❌ Failed to connect to ${config.name}:`, error);
    }
  }
  
  /**
   * Obtiene la conexión a una chain específica
   */
  getConnection(chainId: string): ChainConnection | undefined {
    return this.connections.get(chainId);
  }
  
  /**
   * Obtiene el provider de una chain
   */
  getProvider(chainId: string): Provider | undefined {
    return this.connections.get(chainId)?.provider;
  }
  
  /**
   * Obtiene el signer de una chain
   */
  getSigner(chainId: string): Signer | undefined {
    return this.connections.get(chainId)?.signer;
  }
  
  /**
   * Obtiene todas las chains activas usando array dinámico
   */
  getActiveChains(): ChainConfig[] {
    return Array.from(this.connections.values()).map(conn => conn.config);
  }
  
  /**
   * Obtiene todas las chain IDs activas
   */
  getActiveChainIds(): string[] {
    return Array.from(this.connections.keys());
  }
  
  /**
   * Verifica el estado de salud de todas las chains
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const healthStatus = new Map<string, boolean>();
    
    // Verificar cada chain en paralelo usando Promise.all
    const checks = Array.from(this.connections.entries()).map(
      async ([chainId, connection]) => {
        try {
          const blockNumber = await connection.provider.getBlockNumber();
          const isHealthy = blockNumber > connection.blockNumber;
          
          // Actualizar block number
          if (isHealthy) {
            connection.blockNumber = blockNumber;
            connection.lastUpdate = Date.now();
          }
          
          healthStatus.set(chainId, isHealthy);
        } catch {
          healthStatus.set(chainId, false);
        }
      }
    );
    
    await Promise.all(checks);
    
    return healthStatus;
  }
  
  /**
   * Reconecta a chains que fallaron el health check
   */
  async reconnectFailedChains(): Promise<void> {
    const healthStatus = await this.healthCheck();
    
    // Filtrar chains no saludables usando array dinámico
    const failedChainIds = Array.from(healthStatus.entries())
      .filter(([, isHealthy]) => !isHealthy)
      .map(([chainId]) => chainId);
    
    if (failedChainIds.length === 0) {
      return;
    }
    
    console.log(`🔄 Reconnecting to ${failedChainIds.length} failed chains...`);
    
    // Obtener configuraciones de chains fallidas
    const failedConfigs = this.chainsConfig.filter(config =>
      failedChainIds.includes(config.chainId)
    );
    
    // Reconectar en paralelo
    await Promise.all(
      failedConfigs.map(config => this.connectToChain(config))
    );
  }
  
  /**
   * Actualiza la configuración de chains desde Sheets
   * Permite hot-reload de configuración sin reiniciar
   */
  async updateChainsConfig(newConfig: ChainConfig[]): Promise<void> {
    const oldChainIds = new Set(this.chainsConfig.map(c => c.chainId));
    const newChainIds = new Set(newConfig.map(c => c.chainId));
    
    // Encontrar chains agregadas usando array dinámico
    const addedChains = newConfig.filter(
      config => !oldChainIds.has(config.chainId) && config.enabled
    );
    
    // Encontrar chains removidas
    const removedChainIds = Array.from(oldChainIds).filter(
      id => !newChainIds.has(id)
    );
    
    // Encontrar chains modificadas
    const modifiedChains = newConfig.filter(newChain => {
      const oldChain = this.chainsConfig.find(c => c.chainId === newChain.chainId);
      return oldChain && JSON.stringify(oldChain) !== JSON.stringify(newChain);
    });
    
    // Aplicar cambios
    this.chainsConfig = newConfig;
    
    // Conectar nuevas chains
    if (addedChains.length > 0) {
      console.log(`➕ Adding ${addedChains.length} new chains...`);
      await Promise.all(
        addedChains.map(config => this.connectToChain(config))
      );
    }
    
    // Desconectar chains removidas
    if (removedChainIds.length > 0) {
      console.log(`➖ Removing ${removedChainIds.length} chains...`);
      removedChainIds.forEach(chainId => this.connections.delete(chainId));
    }
    
    // Reconectar chains modificadas
    if (modifiedChains.length > 0) {
      console.log(`🔄 Updating ${modifiedChains.length} chains...`);
      await Promise.all(
        modifiedChains.map(config => this.connectToChain(config))
      );
    }
  }
  
  /**
   * Obtiene estadísticas de todas las chains
   */
  async getStats(): Promise<Map<string, {
    blockNumber: number;
    gasPrice: bigint;
    balance: bigint;
    lastUpdate: number;
  }>> {
    const stats = new Map();
    
    // Obtener stats de cada chain en paralelo
    const statsPromises = Array.from(this.connections.entries()).map(
      async ([chainId, connection]) => {
        try {
          const [blockNumber, feeData, balance] = await Promise.all([
            connection.provider.getBlockNumber(),
            connection.provider.getFeeData(),
            connection.provider.getBalance(await connection.signer.getAddress())
          ]);
          
          stats.set(chainId, {
            blockNumber,
            gasPrice: feeData.gasPrice || 0n,
            balance,
            lastUpdate: connection.lastUpdate
          });
        } catch (error) {
          console.error(`Error getting stats for ${chainId}:`, error);
        }
      }
    );
    
    await Promise.all(statsPromises);
    
    return stats;
  }
  
  /**
   * Verifica si una chain está conectada
   */
  isConnected(chainId: string): boolean {
    return this.connections.has(chainId);
  }
  
  /**
   * Obtiene el número de chains conectadas
   */
  getConnectedCount(): number {
    return this.connections.size;
  }
  
  /**
   * Desconecta todas las chains
   */
  async disconnectAll(): Promise<void> {
    console.log(`🔌 Disconnecting from ${this.connections.size} chains...`);
    this.connections.clear();
  }
  
  /**
   * Obtiene chains por criterio usando filter (array dinámico)
   */
  getChainsByCriteria(
    criteria: (config: ChainConfig) => boolean
  ): ChainConfig[] {
    return this.chainsConfig.filter(criteria);
  }
  
  /**
   * Obtiene la configuración de una chain
   */
  getChainConfig(chainId: string): ChainConfig | undefined {
    return this.chainsConfig.find(config => config.chainId === chainId);
  }
  
  /**
   * Espera a que una chain alcance un block number específico
   */
  async waitForBlock(chainId: string, targetBlock: number): Promise<boolean> {
    const connection = this.connections.get(chainId);
    if (!connection) {
      return false;
    }
    
    try {
      // Esperar hasta el block target con timeout de 60s
      const timeout = 60000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        const currentBlock = await connection.provider.getBlockNumber();
        
        if (currentBlock >= targetBlock) {
          return true;
        }
        
        // Esperar 1 segundo antes de verificar nuevamente
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      return false;
    } catch {
      return false;
    }
  }
}

/**
 * Singleton instance del ChainManager
 */
let chainManagerInstance: ChainManager | null = null;

/**
 * Obtiene o crea la instancia singleton del ChainManager
 */
export function getChainManager(privateKey?: string): ChainManager {
  if (!chainManagerInstance) {
    if (!privateKey) {
      throw new Error('Private key required to initialize ChainManager');
    }
    chainManagerInstance = new ChainManager(privateKey);
  }
  
  return chainManagerInstance;
}

/**
 * Resetea la instancia singleton (útil para tests)
 */
export function resetChainManager(): void {
  chainManagerInstance = null;
}

// Exports
export default ChainManager;

