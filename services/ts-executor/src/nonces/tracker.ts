/**
 * Nonce Tracker - Gestión dinámica de nonces por chain
 * 
 * Premisas:
 * 1. Configuración de chains desde Sheets (no hardcoded)
 * 2. Tracking dinámico usando Map (estructura dinámica)
 * 3. Consumido por flash.ts para prevenir colisiones
 */

import { ethers } from 'ethers';

export interface NonceState {
  chainId: number;
  address: string;
  current: number;
  pending: number;
  lastUpdate: number;
}

export class NonceTracker {
  private nonces: Map<string, NonceState> = new Map();
  private providers: Map<number, ethers.providers.JsonRpcProvider> = new Map();
  
  constructor() {
    // Constructor vacío - configuración dinámica desde chains
  }
  
  /**
   * Registra un provider para una chain
   * @param chainId ID de la chain
   * @param rpcUrl URL del RPC (desde Sheets)
   */
  registerProvider(chainId: number, rpcUrl: string): void {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.providers.set(chainId, provider);
  }
  
  /**
   * Obtiene el siguiente nonce disponible para una dirección en una chain
   * @param chainId ID de la chain
   * @param address Dirección del wallet
   * @returns Nonce disponible
   */
  async getNextNonce(chainId: number, address: string): Promise<number> {
    const key = this.getKey(chainId, address);
    const state = this.nonces.get(key);
    
    if (!state) {
      // Primera vez - obtener nonce desde chain
      const nonce = await this.fetchNonceFromChain(chainId, address);
      this.nonces.set(key, {
        chainId,
        address,
        current: nonce,
        pending: nonce,
        lastUpdate: Date.now(),
      });
      return nonce;
    }
    
    // Verificar si necesitamos actualizar desde chain
    const timeSinceUpdate = Date.now() - state.lastUpdate;
    if (timeSinceUpdate > 30000) { // 30 segundos
      const chainNonce = await this.fetchNonceFromChain(chainId, address);
      if (chainNonce > state.current) {
        state.current = chainNonce;
        state.pending = chainNonce;
        state.lastUpdate = Date.now();
      }
    }
    
    // Retornar siguiente nonce pending
    const nextNonce = state.pending;
    state.pending++;
    
    return nextNonce;
  }
  
  /**
   * Confirma que un nonce fue usado exitosamente
   * @param chainId ID de la chain
   * @param address Dirección del wallet
   * @param nonce Nonce confirmado
   */
  confirmNonce(chainId: number, address: string, nonce: number): void {
    const key = this.getKey(chainId, address);
    const state = this.nonces.get(key);
    
    if (state && nonce >= state.current) {
      state.current = nonce + 1;
      state.lastUpdate = Date.now();
    }
  }
  
  /**
   * Resetea el nonce para una dirección (en caso de error)
   * @param chainId ID de la chain
   * @param address Dirección del wallet
   */
  async resetNonce(chainId: number, address: string): Promise<void> {
    const key = this.getKey(chainId, address);
    const nonce = await this.fetchNonceFromChain(chainId, address);
    
    this.nonces.set(key, {
      chainId,
      address,
      current: nonce,
      pending: nonce,
      lastUpdate: Date.now(),
    });
  }
  
  /**
   * Obtiene el estado actual de nonces para una dirección
   * @param chainId ID de la chain
   * @param address Dirección del wallet
   * @returns Estado del nonce o undefined
   */
  getState(chainId: number, address: string): NonceState | undefined {
    const key = this.getKey(chainId, address);
    return this.nonces.get(key);
  }
  
  /**
   * Obtiene todos los estados de nonces (para debugging)
   * @returns Array de estados
   */
  getAllStates(): NonceState[] {
    return Array.from(this.nonces.values());
  }
  
  /**
   * Limpia estados antiguos (garbage collection)
   * @param maxAge Edad máxima en milisegundos
   */
  cleanup(maxAge: number = 3600000): void { // 1 hora por defecto
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.nonces.forEach((state, key) => {
      if (now - state.lastUpdate > maxAge) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.nonces.delete(key));
  }
  
  /**
   * Obtiene el nonce directamente desde la chain
   * @param chainId ID de la chain
   * @param address Dirección del wallet
   * @returns Nonce actual en la chain
   */
  private async fetchNonceFromChain(chainId: number, address: string): Promise<number> {
    const provider = this.providers.get(chainId);
    
    if (!provider) {
      throw new Error(`Provider not registered for chainId ${chainId}`);
    }
    
    try {
      const nonce = await provider.getTransactionCount(address, 'pending');
      return nonce;
    } catch (error) {
      console.error(`Error fetching nonce for ${address} on chain ${chainId}:`, error);
      throw error;
    }
  }
  
  /**
   * Genera una clave única para el Map
   * @param chainId ID de la chain
   * @param address Dirección del wallet
   * @returns Clave única
   */
  private getKey(chainId: number, address: string): string {
    return `${chainId}:${address.toLowerCase()}`;
  }
}

// Singleton instance
export const nonceTracker = new NonceTracker();

export default NonceTracker;

