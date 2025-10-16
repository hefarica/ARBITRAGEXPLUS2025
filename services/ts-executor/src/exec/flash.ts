/**
 * Flash Loan Executor - Ejecución de flash loans atómicos
 * 
 * Ejecuta operaciones de arbitraje usando flash loans.
 * TODO consume configuración desde Google Sheets dinámicamente.
 * 
 * Premisas:
 * 1. Configuración desde Sheets (DEXES, POOLS, ROUTES)
 * 2. Arrays dinámicos (map, filter, reduce)
 * 3. Consumido por el executor principal
 */

import { ethers } from 'ethers';
import type { Provider, Signer } from 'ethers';

/**
 * Configuración de flash loan desde Sheets
 */
export interface FlashLoanConfig {
  provider: string;
  router: string;
  vault: string;
  maxGasPrice: string;
  slippage: number;
}

/**
 * Ruta de arbitraje desde Sheets
 */
export interface ArbitrageRoute {
  id: string;
  chain: string;
  path: string[];
  expectedProfit: number;
  gasCost: number;
  netProfit: number;
}

/**
 * Resultado de ejecución
 */
export interface ExecutionResult {
  success: boolean;
  txHash?: string;
  actualProfit?: number;
  gasUsed?: number;
  error?: string;
}

/**
 * Flash Loan Executor
 * Consume configuración dinámicamente desde Sheets
 */
export class FlashLoanExecutor {
  private provider: Provider;
  private signer: Signer;
  private config: FlashLoanConfig;
  private routerContract: ethers.Contract;
  private vaultContract: ethers.Contract;
  
  constructor(
    provider: Provider,
    signer: Signer,
    config: FlashLoanConfig
  ) {
    this.provider = provider;
    this.signer = signer;
    this.config = config;
    
    // Inicializar contratos usando configuración dinámica
    this.routerContract = new ethers.Contract(
      config.router,
      this.getRouterABI(),
      signer
    );
    
    this.vaultContract = new ethers.Contract(
      config.vault,
      this.getVaultABI(),
      signer
    );
  }
  
  /**
   * Ejecuta múltiples rutas de arbitraje usando arrays dinámicos
   */
  async executeRoutes(routes: ArbitrageRoute[]): Promise<ExecutionResult[]> {
    // Filtrar rutas rentables usando array dinámico
    const profitableRoutes = routes.filter(route => 
      route.netProfit > 0 && route.expectedProfit > route.gasCost
    );
    
    if (profitableRoutes.length === 0) {
      return [];
    }
    
    // Ejecutar rutas en paralelo usando Promise.all (array dinámico)
    const results = await Promise.all(
      profitableRoutes.map(route => this.executeRoute(route))
    );
    
    return results;
  }
  
  /**
   * Ejecuta una ruta de arbitraje individual
   */
  async executeRoute(route: ArbitrageRoute): Promise<ExecutionResult> {
    try {
      // Validar gas price
      const gasPrice = await this.provider.getFeeData();
      const maxGasPrice = ethers.parseUnits(this.config.maxGasPrice, 'gwei');
      
      if (gasPrice.gasPrice && gasPrice.gasPrice > maxGasPrice) {
        return {
          success: false,
          error: `Gas price too high: ${ethers.formatUnits(gasPrice.gasPrice, 'gwei')} gwei`
        };
      }
      
      // Preparar parámetros del flash loan usando el path dinámico
      const flashLoanParams = this.prepareFlashLoanParams(route);
      
      // Estimar gas
      const estimatedGas = await this.routerContract.executeArbitrage.estimateGas(
        flashLoanParams.token,
        flashLoanParams.amount,
        flashLoanParams.path,
        flashLoanParams.minProfit
      );
      
      // Ejecutar flash loan atómico
      const tx = await this.routerContract.executeArbitrage(
        flashLoanParams.token,
        flashLoanParams.amount,
        flashLoanParams.path,
        flashLoanParams.minProfit,
        {
          gasLimit: estimatedGas * 120n / 100n, // 20% buffer
          gasPrice: gasPrice.gasPrice
        }
      );
      
      // Esperar confirmación
      const receipt = await tx.wait();
      
      // Parsear eventos para obtener profit real
      const actualProfit = this.parseProfit(receipt);
      
      return {
        success: true,
        txHash: receipt.hash,
        actualProfit,
        gasUsed: Number(receipt.gasUsed)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Prepara parámetros del flash loan desde la ruta
   */
  private prepareFlashLoanParams(route: ArbitrageRoute) {
    // Parsear path usando split (array dinámico)
    const pathSteps = route.path;
    
    // Extraer token inicial y cantidad
    const token = pathSteps[0].split(':')[0];
    const amount = ethers.parseEther(route.expectedProfit.toString());
    
    // Construir path de DEXs usando map (array dinámico)
    const dexPath = pathSteps.map(step => {
      const [, dex] = step.split(':');
      return dex;
    });
    
    // Calcular profit mínimo con slippage
    const minProfit = ethers.parseEther(
      (route.expectedProfit * (1 - this.config.slippage / 100)).toString()
    );
    
    return {
      token,
      amount,
      path: dexPath,
      minProfit
    };
  }
  
  /**
   * Parsea el profit real de los eventos del receipt
   */
  private parseProfit(receipt: ethers.ContractTransactionReceipt): number {
    // Buscar evento ArbitrageExecuted usando filter (array dinámico)
    const arbitrageEvents = receipt.logs.filter(log => {
      try {
        const parsed = this.routerContract.interface.parseLog({
          topics: log.topics as string[],
          data: log.data
        });
        return parsed?.name === 'ArbitrageExecuted';
      } catch {
        return false;
      }
    });
    
    if (arbitrageEvents.length === 0) {
      return 0;
    }
    
    // Parsear el primer evento
    const event = arbitrageEvents[0];
    const parsed = this.routerContract.interface.parseLog({
      topics: event.topics as string[],
      data: event.data
    });
    
    if (!parsed) return 0;
    
    // Extraer profit del evento
    const profitWei = parsed.args.profit;
    return Number(ethers.formatEther(profitWei));
  }
  
  /**
   * Simula la ejecución sin enviar transacción
   */
  async simulateRoute(route: ArbitrageRoute): Promise<{
    success: boolean;
    estimatedProfit?: number;
    estimatedGas?: number;
    error?: string;
  }> {
    try {
      const flashLoanParams = this.prepareFlashLoanParams(route);
      
      // Llamada estática para simular
      const result = await this.routerContract.executeArbitrage.staticCall(
        flashLoanParams.token,
        flashLoanParams.amount,
        flashLoanParams.path,
        flashLoanParams.minProfit
      );
      
      // Estimar gas
      const estimatedGas = await this.routerContract.executeArbitrage.estimateGas(
        flashLoanParams.token,
        flashLoanParams.amount,
        flashLoanParams.path,
        flashLoanParams.minProfit
      );
      
      return {
        success: true,
        estimatedProfit: Number(ethers.formatEther(result)),
        estimatedGas: Number(estimatedGas)
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Simulation failed'
      };
    }
  }
  
  /**
   * Obtiene rutas pendientes desde Sheets (consumido por el executor principal)
   */
  async getPendingRoutes(): Promise<ArbitrageRoute[]> {
    // Este método será implementado por el módulo que consume este executor
    // y que tiene acceso directo a Sheets
    throw new Error('getPendingRoutes must be implemented by consumer');
  }
  
  /**
   * ABI del Router (mínimo necesario)
   */
  private getRouterABI() {
    return [
      'function executeArbitrage(address token, uint256 amount, address[] path, uint256 minProfit) external returns (uint256)',
      'event ArbitrageExecuted(address indexed token, uint256 profit, uint256 gasUsed)'
    ];
  }
  
  /**
   * ABI del Vault (mínimo necesario)
   */
  private getVaultABI() {
    return [
      'function flashLoan(address token, uint256 amount, bytes data) external',
      'event FlashLoan(address indexed token, uint256 amount, uint256 fee)'
    ];
  }
  
  /**
   * Cancela una ruta en ejecución
   */
  async cancelRoute(routeId: string): Promise<boolean> {
    // Implementación de cancelación
    // Por ahora retorna false ya que las transacciones son atómicas
    return false;
  }
  
  /**
   * Obtiene el estado de una transacción
   */
  async getTransactionStatus(txHash: string): Promise<{
    confirmed: boolean;
    success?: boolean;
    blockNumber?: number;
  }> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return { confirmed: false };
      }
      
      return {
        confirmed: true,
        success: receipt.status === 1,
        blockNumber: receipt.blockNumber
      };
    } catch {
      return { confirmed: false };
    }
  }
}

/**
 * Factory para crear ejecutores por chain usando configuración dinámica
 */
export class FlashLoanExecutorFactory {
  private executors: Map<string, FlashLoanExecutor> = new Map();
  
  /**
   * Crea o obtiene un executor para una chain específica
   * La configuración viene de Sheets
   */
  getExecutor(
    chain: string,
    provider: Provider,
    signer: Signer,
    config: FlashLoanConfig
  ): FlashLoanExecutor {
    if (!this.executors.has(chain)) {
      this.executors.set(
        chain,
        new FlashLoanExecutor(provider, signer, config)
      );
    }
    
    return this.executors.get(chain)!;
  }
  
  /**
   * Obtiene todos los executors activos usando array dinámico
   */
  getAllExecutors(): FlashLoanExecutor[] {
    return Array.from(this.executors.values());
  }
  
  /**
   * Limpia executors inactivos
   */
  cleanup(activeChains: string[]): void {
    // Filtrar chains inactivas usando array dinámico
    const chainsToRemove = Array.from(this.executors.keys()).filter(
      chain => !activeChains.includes(chain)
    );
    
    // Remover usando forEach (array dinámico)
    chainsToRemove.forEach(chain => this.executors.delete(chain));
  }
}

// Exports para consumo por otros módulos
export default FlashLoanExecutor;

