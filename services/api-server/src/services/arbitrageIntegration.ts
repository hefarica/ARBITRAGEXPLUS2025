/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/services/arbitrageIntegration.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: @logger, events, @errors
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: ArbitrageIntegrationService
 *   INTERFACES: ValidationResult, OpportunityFilter, ExecutionDecision
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: ArbitrageIntegrationService, arbitrageIntegrationService
 * 
 * 🔗 DEPENDENCIAS:
 *   - @logger
 *   - events
 *   - @errors
 * 
 * ============================================================================
 */

/**
 * ARBITRAGEXPLUS2025 - Arbitrage Integration Service
 * 
 * Servicio que integra MarketDataService con ArbitrageService para
 * crear el flujo E2E completo de detección y ejecución de arbitraje.
 * 
 * Flujo:
 * 1. MarketDataService detecta oportunidades en tiempo real
 * 2. ArbitrageIntegration valida y filtra oportunidades
 * 3. ArbitrageService ejecuta las oportunidades validadas
 * 4. Resultados se registran en Google Sheets
 */

import { EventEmitter } from 'events';
import { logger } from '@logger';
import { marketDataService } from '@services/marketDataService';
import { ArbitrageService } from '@services/arbitrageService';
import { SheetsService } from '@services/sheetsService';
import { BusinessError, SystemError } from '@errors';

// ==================================================================================
// TYPES & INTERFACES
// ==================================================================================

interface OpportunityFilter {
  minProfitUSD: number;
  maxSlippage: number;
  minConfidence: number;
  enabledStrategies: string[];
  enabledChains: number[];
}

interface ValidationResult {
  isValid: boolean;
  confidence: number;
  reason?: string;
  priceData?: any;
}

interface ExecutionDecision {
  shouldExecute: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  reason: string;
  estimatedProfitUSD: number;
  riskScore: number;
}

interface OpportunityMetrics {
  totalDetected: number;
  totalValidated: number;
  totalExecuted: number;
  totalSuccessful: number;
  totalFailed: number;
  totalProfitUSD: number;
  averageExecutionTime: number;
}

// ==================================================================================
// ARBITRAGE INTEGRATION SERVICE
// ==================================================================================

export class ArbitrageIntegrationService extends EventEmitter {
  private arbitrageService: ArbitrageService;
  private sheetsService: SheetsService;
  
  // Estado
  private isInitialized = false;
  private isActive = false;
  
  // Configuración
  private config: OpportunityFilter;
  
  // Métricas
  private metrics: OpportunityMetrics = {
    totalDetected: 0,
    totalValidated: 0,
    totalExecuted: 0,
    totalSuccessful: 0,
    totalFailed: 0,
    totalProfitUSD: 0,
    averageExecutionTime: 0,
  };

  // Queue de oportunidades
  private opportunityQueue: any[] = [];
  private isProcessing = false;

  constructor(config?: Partial<OpportunityFilter>) {
    super();
    
    this.config = {
      minProfitUSD: config?.minProfitUSD || 10,
      maxSlippage: config?.maxSlippage || 0.01,
      minConfidence: config?.minConfidence || 0.7,
      enabledStrategies: config?.enabledStrategies || ['2dex', '3dex', 'triangular'],
      enabledChains: config?.enabledChains || [1, 56, 137], // Ethereum, BSC, Polygon
    };

    this.arbitrageService = new ArbitrageService();
    this.sheetsService = new SheetsService();
  }

  // ================================================================================
  // INITIALIZATION
  // ================================================================================

  /**
   * Inicializar servicio de integración
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        logger.warn('ArbitrageIntegrationService already initialized');
        return;
      }

      logger.info('🚀 Initializing ArbitrageIntegrationService...');

      // 1. Inicializar MarketDataService
      if (!marketDataService['isInitialized']) {
        await marketDataService.initialize();
      }

      // 2. Inicializar ArbitrageService
      if (!this.arbitrageService['isInitialized']) {
        await this.arbitrageService.initialize();
      }

      // 3. Configurar event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      logger.info('✅ ArbitrageIntegrationService initialized successfully');

      this.emit('initialized');

    } catch (error) {
      logger.error('❌ Failed to initialize ArbitrageIntegrationService:', error);
      throw new SystemError('ArbitrageIntegrationService initialization failed', {
        context: { error: error.message }
      });
    }
  }

  /**
   * Configurar event listeners
   */
  private setupEventListeners(): void {
    logger.info('📡 Setting up integration event listeners...');

    // Suscribirse a oportunidades detectadas por MarketDataService
    marketDataService.on('opportunity_detected', async (opportunity: any) => {
      await this.handleOpportunityDetected(opportunity);
    });

    // Suscribirse a divergencias de precio
    marketDataService.on('price_divergence', async (divergence: any) => {
      await this.handlePriceDivergence(divergence);
    });

    // Suscribirse a actualizaciones de liquidez
    marketDataService.on('liquidity_update', async (liquidity: any) => {
      await this.handleLiquidityUpdate(liquidity);
    });

    // Suscribirse a errores de DEX
    marketDataService.on('dex_error', (error: any) => {
      logger.error(`DEX error detected: ${error.dexId}`, error);
      this.emit('dex_error', error);
    });

    logger.info('✅ Integration event listeners configured');
  }

  // ================================================================================
  // OPPORTUNITY HANDLING
  // ================================================================================

  /**
   * Manejar oportunidad detectada
   */
  private async handleOpportunityDetected(opportunity: any): Promise<void> {
    try {
      this.metrics.totalDetected++;

      logger.info('🎯 Opportunity detected:', {
        type: opportunity.type,
        tokens: opportunity.tokens,
        dexes: opportunity.dexes,
        estimatedProfit: opportunity.estimatedProfitUSD,
      });

      // 1. Filtrar oportunidad
      if (!this.shouldProcessOpportunity(opportunity)) {
        logger.debug('Opportunity filtered out', { reason: 'Does not meet criteria' });
        return;
      }

      // 2. Validar oportunidad con oráculos
      const validation = await this.validateOpportunity(opportunity);
      
      if (!validation.isValid) {
        logger.warn('Opportunity validation failed:', validation.reason);
        return;
      }

      this.metrics.totalValidated++;

      // 3. Decidir si ejecutar
      const decision = await this.makeExecutionDecision(opportunity, validation);
      
      if (!decision.shouldExecute) {
        logger.info('Execution decision: SKIP', { reason: decision.reason });
        return;
      }

      // 4. Agregar a queue de ejecución
      this.opportunityQueue.push({
        opportunity,
        validation,
        decision,
        timestamp: Date.now(),
      });

      // 5. Procesar queue
      if (!this.isProcessing) {
        await this.processOpportunityQueue();
      }

    } catch (error) {
      logger.error('Error handling opportunity:', error);
      this.emit('opportunity_error', { opportunity, error });
    }
  }

  /**
   * Filtrar oportunidad según configuración
   */
  private shouldProcessOpportunity(opportunity: any): boolean {
    // Verificar profit mínimo
    if (opportunity.estimatedProfitUSD < this.config.minProfitUSD) {
      return false;
    }

    // Verificar confianza mínima
    if (opportunity.confidence < this.config.minConfidence) {
      return false;
    }

    // Verificar estrategia habilitada
    if (!this.config.enabledStrategies.includes(opportunity.type)) {
      return false;
    }

    return true;
  }

  /**
   * Validar oportunidad con oráculos
   */
  private async validateOpportunity(opportunity: any): Promise<ValidationResult> {
    try {
      const validations: ValidationResult[] = [];

      // Validar precio de cada token involucrado
      for (const token of opportunity.tokens) {
        const priceData = await marketDataService.getPrice(token);
        
        if (!priceData) {
          return {
            isValid: false,
            confidence: 0,
            reason: `No price data available for ${token}`,
          };
        }

        // Verificar que el precio no sea muy antiguo (> 30 segundos)
        const priceAge = Date.now() - priceData.timestamp;
        if (priceAge > 30000) {
          return {
            isValid: false,
            confidence: 0,
            reason: `Price too old for ${token}: ${(priceAge / 1000).toFixed(1)}s`,
          };
        }

        validations.push({
          isValid: true,
          confidence: priceData.confidence,
          priceData,
        });
      }

      // Calcular confianza promedio
      const avgConfidence = validations.reduce((sum, v) => sum + v.confidence, 0) / validations.length;

      return {
        isValid: true,
        confidence: avgConfidence,
        priceData: validations.map(v => v.priceData),
      };

    } catch (error) {
      logger.error('Error validating opportunity:', error);
      return {
        isValid: false,
        confidence: 0,
        reason: `Validation error: ${error.message}`,
      };
    }
  }

  /**
   * Decidir si ejecutar oportunidad
   */
  private async makeExecutionDecision(
    opportunity: any,
    validation: ValidationResult
  ): Promise<ExecutionDecision> {
    try {
      // Calcular score de riesgo (0-1, menor es mejor)
      const riskScore = this.calculateRiskScore(opportunity, validation);

      // Determinar prioridad
      let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
      
      if (opportunity.estimatedProfitUSD > 100 && riskScore < 0.3) {
        priority = 'urgent';
      } else if (opportunity.estimatedProfitUSD > 50 && riskScore < 0.5) {
        priority = 'high';
      } else if (riskScore > 0.7) {
        priority = 'low';
      }

      // Decidir si ejecutar
      const shouldExecute = 
        riskScore < 0.8 && // Riesgo aceptable
        validation.confidence > this.config.minConfidence &&
        opportunity.estimatedProfitUSD > this.config.minProfitUSD;

      return {
        shouldExecute,
        priority,
        reason: shouldExecute 
          ? `Profit: $${opportunity.estimatedProfitUSD.toFixed(2)}, Risk: ${(riskScore * 100).toFixed(1)}%, Confidence: ${(validation.confidence * 100).toFixed(1)}%`
          : `Risk too high: ${(riskScore * 100).toFixed(1)}%`,
        estimatedProfitUSD: opportunity.estimatedProfitUSD,
        riskScore,
      };

    } catch (error) {
      logger.error('Error making execution decision:', error);
      return {
        shouldExecute: false,
        priority: 'low',
        reason: `Decision error: ${error.message}`,
        estimatedProfitUSD: 0,
        riskScore: 1.0,
      };
    }
  }

  /**
   * Calcular score de riesgo
   */
  private calculateRiskScore(opportunity: any, validation: ValidationResult): number {
    let riskScore = 0;

    // Factor 1: Confianza de validación (peso: 0.4)
    riskScore += (1 - validation.confidence) * 0.4;

    // Factor 2: Edad de la oportunidad (peso: 0.2)
    const opportunityAge = Date.now() - opportunity.timestamp;
    const ageRisk = Math.min(opportunityAge / 60000, 1); // Normalizar a 1 minuto
    riskScore += ageRisk * 0.2;

    // Factor 3: Número de DEXes (peso: 0.2)
    const dexRisk = Math.min((opportunity.dexes.length - 2) / 3, 1); // Más DEXes = más riesgo
    riskScore += dexRisk * 0.2;

    // Factor 4: Profit vs Gas estimado (peso: 0.2)
    const estimatedGas = 50; // TODO: Calcular gas real
    const profitRatio = estimatedGas / opportunity.estimatedProfitUSD;
    const gasRisk = Math.min(profitRatio, 1);
    riskScore += gasRisk * 0.2;

    return Math.min(riskScore, 1);
  }

  // ================================================================================
  // OPPORTUNITY EXECUTION
  // ================================================================================

  /**
   * Procesar queue de oportunidades
   */
  private async processOpportunityQueue(): Promise<void> {
    if (this.isProcessing || this.opportunityQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.opportunityQueue.length > 0) {
        const item = this.opportunityQueue.shift();
        await this.executeOpportunity(item);
      }
    } catch (error) {
      logger.error('Error processing opportunity queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Ejecutar oportunidad
   */
  private async executeOpportunity(item: any): Promise<void> {
    const startTime = Date.now();

    try {
      const { opportunity, validation, decision } = item;

      logger.info('⚡ Executing opportunity:', {
        type: opportunity.type,
        priority: decision.priority,
        estimatedProfit: decision.estimatedProfitUSD,
      });

      this.metrics.totalExecuted++;

      // TODO: Implementar lógica de ejecución real
      // Por ahora solo simulamos
      const result = await this.simulateExecution(opportunity, decision);

      if (result.success) {
        this.metrics.totalSuccessful++;
        this.metrics.totalProfitUSD += result.profitUSD;

        logger.info('✅ Execution successful:', {
          profitUSD: result.profitUSD,
          txHash: result.txHash,
        });

        // Registrar en Sheets
        await this.sheetsService.recordExecution({
          ...result,
          opportunity,
          validation,
          decision,
        });

        this.emit('execution_success', result);
      } else {
        this.metrics.totalFailed++;

        logger.error('❌ Execution failed:', result.error);

        this.emit('execution_failure', { opportunity, error: result.error });
      }

      // Actualizar métrica de tiempo promedio
      const executionTime = Date.now() - startTime;
      this.metrics.averageExecutionTime = 
        (this.metrics.averageExecutionTime * (this.metrics.totalExecuted - 1) + executionTime) / 
        this.metrics.totalExecuted;

    } catch (error) {
      this.metrics.totalFailed++;
      logger.error('Error executing opportunity:', error);
      this.emit('execution_error', { item, error });
    }
  }

  /**
   * Simular ejecución (placeholder)
   */
  private async simulateExecution(opportunity: any, decision: any): Promise<any> {
    // Simular delay de ejecución
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Simular resultado (80% éxito)
    const success = Math.random() > 0.2;

    if (success) {
      return {
        success: true,
        profitUSD: decision.estimatedProfitUSD * (0.8 + Math.random() * 0.2), // 80-100% del estimado
        txHash: '0x' + Math.random().toString(16).substring(2, 66),
        gasUsed: 200000 + Math.floor(Math.random() * 100000),
        timestamp: Date.now(),
      };
    } else {
      return {
        success: false,
        error: 'Slippage too high',
        timestamp: Date.now(),
      };
    }
  }

  // ================================================================================
  // OTHER EVENT HANDLERS
  // ================================================================================

  /**
   * Manejar divergencia de precio
   */
  private async handlePriceDivergence(divergence: any): Promise<void> {
    logger.warn('⚠️ Price divergence detected:', divergence);
    
    // Registrar alerta en Sheets
    await this.sheetsService.recordAlert({
      type: 'price_divergence',
      severity: 'warning',
      message: `Price divergence for ${divergence.symbol}: ${divergence.divergenceBps.toFixed(1)} bps`,
      timestamp: new Date().toISOString(),
      data: divergence,
    });

    this.emit('price_divergence', divergence);
  }

  /**
   * Manejar actualización de liquidez
   */
  private async handleLiquidityUpdate(liquidity: any): Promise<void> {
    // Solo log debug, no acción específica
    logger.debug('Liquidity updated:', {
      pool: liquidity.poolId,
      dex: liquidity.dexId,
      tvl: liquidity.tvlUSD,
    });
  }

  // ================================================================================
  // CONTROL
  // ================================================================================

  /**
   * Activar detección y ejecución automática
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    this.isActive = true;
    logger.info('🟢 Arbitrage integration STARTED');
    this.emit('started');
  }

  /**
   * Pausar detección y ejecución automática
   */
  async stop(): Promise<void> {
    this.isActive = false;
    logger.info('🔴 Arbitrage integration STOPPED');
    this.emit('stopped');
  }

  /**
   * Actualizar configuración
   */
  updateConfig(config: Partial<OpportunityFilter>): void {
    this.config = { ...this.config, ...config };
    logger.info('🔄 Configuration updated:', this.config);
    this.emit('config_updated', this.config);
  }

  // ================================================================================
  // UTILITIES
  // ================================================================================

  /**
   * Obtener métricas
   */
  getMetrics(): OpportunityMetrics {
    return { ...this.metrics };
  }

  /**
   * Obtener estadísticas
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      isActive: this.isActive,
      config: this.config,
      metrics: this.metrics,
      queueSize: this.opportunityQueue.length,
      isProcessing: this.isProcessing,
    };
  }

  /**
   * Resetear métricas
   */
  resetMetrics(): void {
    this.metrics = {
      totalDetected: 0,
      totalValidated: 0,
      totalExecuted: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      totalProfitUSD: 0,
      averageExecutionTime: 0,
    };
    logger.info('📊 Metrics reset');
  }

  /**
   * Shutdown del servicio
   */
  async shutdown(): Promise<void> {
    logger.info('🛑 Shutting down ArbitrageIntegrationService...');
    
    await this.stop();
    
    // Procesar oportunidades pendientes
    if (this.opportunityQueue.length > 0) {
      logger.info(`Processing ${this.opportunityQueue.length} pending opportunities...`);
      await this.processOpportunityQueue();
    }

    this.isInitialized = false;
    logger.info('✅ ArbitrageIntegrationService shutdown complete');
  }
}

// Singleton instance
export const arbitrageIntegrationService = new ArbitrageIntegrationService();

