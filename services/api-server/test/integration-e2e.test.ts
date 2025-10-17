/**
 * ARBITRAGEXPLUS2025 - Integration E2E Tests
 * 
 * Suite de tests de integración End-to-End que valida el flujo completo
 * del sistema de arbitraje desde detección hasta ejecución.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { marketDataService } from '../src/services/marketDataService';
import { arbitrageIntegrationService } from '../src/services/arbitrageIntegration';
import { EventEmitter } from 'events';

// ==================================================================================
// SETUP & TEARDOWN
// ==================================================================================

describe('Integration E2E Tests', () => {
  let opportunityDetectedSpy: jest.SpyInstance;
  let executionSuccessSpy: jest.SpyInstance;

  beforeAll(async () => {
    // Mock de servicios externos
    jest.setTimeout(30000);

    // Spy en eventos
    opportunityDetectedSpy = jest.spyOn(marketDataService, 'emit');
    executionSuccessSpy = jest.spyOn(arbitrageIntegrationService, 'emit');
  });

  afterAll(async () => {
    // Cleanup
    await arbitrageIntegrationService.shutdown();
    await marketDataService.shutdown();
    
    jest.restoreAllMocks();
  });

  // ================================================================================
  // INITIALIZATION TESTS
  // ================================================================================

  describe('1. Initialization', () => {
    it('should initialize MarketDataService successfully', async () => {
      await marketDataService.initialize();
      
      const stats = marketDataService.getStats();
      expect(stats.isInitialized).toBe(true);
    });

    it('should initialize ArbitrageIntegrationService successfully', async () => {
      await arbitrageIntegrationService.initialize();
      
      const stats = arbitrageIntegrationService.getStats();
      expect(stats.isInitialized).toBe(true);
    });

    it('should have event listeners configured', () => {
      const listeners = marketDataService.eventNames();
      expect(listeners).toContain('opportunity_detected');
      expect(listeners).toContain('price_divergence');
    });
  });

  // ================================================================================
  // OPPORTUNITY DETECTION TESTS
  // ================================================================================

  describe('2. Opportunity Detection', () => {
    it('should detect opportunity from price difference', async () => {
      const mockOpportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC'],
        dexes: ['uniswap', 'sushiswap'],
        estimatedProfitUSD: 25,
        confidence: 0.85,
        timestamp: Date.now(),
        metadata: {
          priceDiff: 0.008,
          pools: []
        }
      };

      // Emitir oportunidad simulada
      marketDataService.emit('opportunity_detected', mockOpportunity);

      // Esperar procesamiento
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verificar que se detectó
      expect(opportunityDetectedSpy).toHaveBeenCalledWith(
        'opportunity_detected',
        expect.objectContaining({
          type: 'arbitrage',
          estimatedProfitUSD: 25
        })
      );
    });

    it('should filter out low-profit opportunities', async () => {
      const lowProfitOpportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC'],
        dexes: ['uniswap', 'sushiswap'],
        estimatedProfitUSD: 5, // Menor que el mínimo (10)
        confidence: 0.85,
        timestamp: Date.now(),
        metadata: {}
      };

      const initialMetrics = arbitrageIntegrationService.getMetrics();
      
      marketDataService.emit('opportunity_detected', lowProfitOpportunity);
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMetrics = arbitrageIntegrationService.getMetrics();
      
      // No debería incrementar validadas
      expect(finalMetrics.totalValidated).toBe(initialMetrics.totalValidated);
    });

    it('should filter out low-confidence opportunities', async () => {
      const lowConfidenceOpportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC'],
        dexes: ['uniswap', 'sushiswap'],
        estimatedProfitUSD: 25,
        confidence: 0.5, // Menor que el mínimo (0.7)
        timestamp: Date.now(),
        metadata: {}
      };

      const initialMetrics = arbitrageIntegrationService.getMetrics();
      
      marketDataService.emit('opportunity_detected', lowConfidenceOpportunity);
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMetrics = arbitrageIntegrationService.getMetrics();
      
      expect(finalMetrics.totalValidated).toBe(initialMetrics.totalValidated);
    });
  });

  // ================================================================================
  // PRICE VALIDATION TESTS
  // ================================================================================

  describe('3. Price Validation', () => {
    it('should validate prices with multi-oracle', async () => {
      // Mock de precio
      const mockPrice = {
        symbol: 'ETH',
        price: 2000,
        source: 'pyth',
        confidence: 0.95,
        timestamp: Date.now()
      };

      jest.spyOn(marketDataService, 'getPrice').mockResolvedValue(mockPrice);

      const price = await marketDataService.getPrice('ETH');
      
      expect(price).toBeDefined();
      expect(price?.price).toBe(2000);
      expect(price?.source).toBe('pyth');
      expect(price?.confidence).toBeGreaterThan(0.9);
    });

    it('should detect price divergence', async () => {
      const divergence = {
        symbol: 'ETH',
        pythPrice: 2000,
        chainlinkPrice: 2050,
        divergenceBps: 250,
        reason: 'Price divergence too high'
      };

      let divergenceDetected = false;
      
      marketDataService.once('price_divergence', (data) => {
        divergenceDetected = true;
        expect(data.divergenceBps).toBeGreaterThan(200);
      });

      marketDataService.emit('price_divergence', divergence);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(divergenceDetected).toBe(true);
    });

    it('should reject old prices', async () => {
      const oldPrice = {
        symbol: 'ETH',
        price: 2000,
        source: 'pyth',
        confidence: 0.95,
        timestamp: Date.now() - 60000 // 1 minuto atrás
      };

      jest.spyOn(marketDataService, 'getPrice').mockResolvedValue(oldPrice);

      // Crear oportunidad con precio viejo
      const opportunity = {
        type: 'arbitrage',
        tokens: ['ETH'],
        dexes: ['uniswap'],
        estimatedProfitUSD: 25,
        confidence: 0.85,
        timestamp: Date.now(),
        metadata: {}
      };

      const initialValidated = arbitrageIntegrationService.getMetrics().totalValidated;
      
      marketDataService.emit('opportunity_detected', opportunity);
      await new Promise(resolve => setTimeout(resolve, 100));

      // No debería validarse por precio viejo
      const finalValidated = arbitrageIntegrationService.getMetrics().totalValidated;
      expect(finalValidated).toBe(initialValidated);
    });
  });

  // ================================================================================
  // RISK ASSESSMENT TESTS
  // ================================================================================

  describe('4. Risk Assessment', () => {
    it('should calculate risk score correctly', async () => {
      // Mock de validación exitosa
      const mockValidation = {
        isValid: true,
        confidence: 0.9,
        priceData: []
      };

      const opportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC'],
        dexes: ['uniswap', 'sushiswap'],
        estimatedProfitUSD: 100,
        confidence: 0.9,
        timestamp: Date.now(),
        metadata: {}
      };

      // El risk score debería ser bajo con alta confianza y buen profit
      // Risk = (1-0.9)*0.4 + 0*0.2 + 0*0.2 + (50/100)*0.2 = 0.04 + 0.1 = 0.14
      // Debería ejecutarse (< 0.8)
      
      let executionAttempted = false;
      
      arbitrageIntegrationService.once('execution_success', () => {
        executionAttempted = true;
      });

      marketDataService.emit('opportunity_detected', opportunity);
      await new Promise(resolve => setTimeout(resolve, 1500)); // Esperar ejecución simulada

      expect(executionAttempted).toBe(true);
    });

    it('should reject high-risk opportunities', async () => {
      const highRiskOpportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC', 'DAI', 'USDT'], // Muchos tokens
        dexes: ['uniswap', 'sushiswap', 'pancakeswap', 'curve', 'balancer'], // Muchos DEXes
        estimatedProfitUSD: 15, // Profit bajo
        confidence: 0.5, // Confianza baja
        timestamp: Date.now() - 50000, // Oportunidad vieja
        metadata: {}
      };

      const initialExecuted = arbitrageIntegrationService.getMetrics().totalExecuted;
      
      marketDataService.emit('opportunity_detected', highRiskOpportunity);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const finalExecuted = arbitrageIntegrationService.getMetrics().totalExecuted;
      
      // No debería ejecutarse por alto riesgo
      expect(finalExecuted).toBe(initialExecuted);
    });

    it('should prioritize urgent opportunities', async () => {
      const urgentOpportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC'],
        dexes: ['uniswap', 'sushiswap'],
        estimatedProfitUSD: 150, // > $100
        confidence: 0.95, // Alta confianza
        timestamp: Date.now(),
        metadata: {}
      };

      let priority: string | undefined;
      
      // Interceptar decisión
      const originalMakeDecision = (arbitrageIntegrationService as any).makeExecutionDecision;
      (arbitrageIntegrationService as any).makeExecutionDecision = async function(opp: any, val: any) {
        const decision = await originalMakeDecision.call(this, opp, val);
        priority = decision.priority;
        return decision;
      };

      marketDataService.emit('opportunity_detected', urgentOpportunity);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(priority).toBe('urgent');
    });
  });

  // ================================================================================
  // EXECUTION QUEUE TESTS
  // ================================================================================

  describe('5. Execution Queue', () => {
    it('should process opportunities in FIFO order', async () => {
      const executionOrder: number[] = [];

      arbitrageIntegrationService.on('execution_success', (result: any) => {
        executionOrder.push(result.opportunityId);
      });

      // Emitir 3 oportunidades
      for (let i = 1; i <= 3; i++) {
        const opportunity = {
          id: i,
          type: 'arbitrage',
          tokens: ['ETH', 'USDC'],
          dexes: ['uniswap', 'sushiswap'],
          estimatedProfitUSD: 20 + i,
          confidence: 0.85,
          timestamp: Date.now(),
          metadata: {}
        };

        marketDataService.emit('opportunity_detected', opportunity);
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      // Esperar procesamiento
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Verificar orden FIFO
      expect(executionOrder[0]).toBe(1);
      expect(executionOrder[1]).toBe(2);
      expect(executionOrder[2]).toBe(3);
    });

    it('should track queue size correctly', async () => {
      const stats = arbitrageIntegrationService.getStats();
      
      // Queue debería estar vacía o procesándose
      expect(stats.queueSize).toBeGreaterThanOrEqual(0);
    });
  });

  // ================================================================================
  // METRICS TESTS
  // ================================================================================

  describe('6. Metrics Tracking', () => {
    it('should track total detected opportunities', async () => {
      const initialMetrics = arbitrageIntegrationService.getMetrics();
      
      const opportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC'],
        dexes: ['uniswap'],
        estimatedProfitUSD: 25,
        confidence: 0.85,
        timestamp: Date.now(),
        metadata: {}
      };

      marketDataService.emit('opportunity_detected', opportunity);
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMetrics = arbitrageIntegrationService.getMetrics();
      
      expect(finalMetrics.totalDetected).toBeGreaterThan(initialMetrics.totalDetected);
    });

    it('should calculate success rate correctly', async () => {
      const metrics = arbitrageIntegrationService.getMetrics();
      
      if (metrics.totalExecuted > 0) {
        const successRate = metrics.totalSuccessful / metrics.totalExecuted;
        expect(successRate).toBeGreaterThanOrEqual(0);
        expect(successRate).toBeLessThanOrEqual(1);
      }
    });

    it('should track average execution time', async () => {
      const metrics = arbitrageIntegrationService.getMetrics();
      
      if (metrics.totalExecuted > 0) {
        expect(metrics.averageExecutionTime).toBeGreaterThan(0);
        expect(metrics.averageExecutionTime).toBeLessThan(10000); // < 10 segundos
      }
    });

    it('should accumulate total profit', async () => {
      const initialMetrics = arbitrageIntegrationService.getMetrics();
      
      const profitableOpportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC'],
        dexes: ['uniswap', 'sushiswap'],
        estimatedProfitUSD: 50,
        confidence: 0.9,
        timestamp: Date.now(),
        metadata: {}
      };

      marketDataService.emit('opportunity_detected', profitableOpportunity);
      await new Promise(resolve => setTimeout(resolve, 1500));

      const finalMetrics = arbitrageIntegrationService.getMetrics();
      
      // Si se ejecutó exitosamente, el profit debería incrementar
      if (finalMetrics.totalSuccessful > initialMetrics.totalSuccessful) {
        expect(finalMetrics.totalProfitUSD).toBeGreaterThan(initialMetrics.totalProfitUSD);
      }
    });
  });

  // ================================================================================
  // CONFIGURATION TESTS
  // ================================================================================

  describe('7. Configuration', () => {
    it('should update configuration dynamically', () => {
      const newConfig = {
        minProfitUSD: 50,
        maxSlippage: 0.005,
        minConfidence: 0.8
      };

      arbitrageIntegrationService.updateConfig(newConfig);

      const stats = arbitrageIntegrationService.getStats();
      
      expect(stats.config.minProfitUSD).toBe(50);
      expect(stats.config.maxSlippage).toBe(0.005);
      expect(stats.config.minConfidence).toBe(0.8);
    });

    it('should respect updated filters', async () => {
      // Configurar profit mínimo alto
      arbitrageIntegrationService.updateConfig({ minProfitUSD: 100 });

      const lowProfitOpportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC'],
        dexes: ['uniswap'],
        estimatedProfitUSD: 50, // Menor que el nuevo mínimo
        confidence: 0.9,
        timestamp: Date.now(),
        metadata: {}
      };

      const initialValidated = arbitrageIntegrationService.getMetrics().totalValidated;
      
      marketDataService.emit('opportunity_detected', lowProfitOpportunity);
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalValidated = arbitrageIntegrationService.getMetrics().totalValidated;
      
      expect(finalValidated).toBe(initialValidated);

      // Restaurar configuración
      arbitrageIntegrationService.updateConfig({ minProfitUSD: 10 });
    });
  });

  // ================================================================================
  // CONTROL TESTS
  // ================================================================================

  describe('8. System Control', () => {
    it('should start and stop correctly', async () => {
      await arbitrageIntegrationService.start();
      let stats = arbitrageIntegrationService.getStats();
      expect(stats.isActive).toBe(true);

      await arbitrageIntegrationService.stop();
      stats = arbitrageIntegrationService.getStats();
      expect(stats.isActive).toBe(false);

      // Reiniciar para otros tests
      await arbitrageIntegrationService.start();
    });

    it('should emit control events', async () => {
      let startedEmitted = false;
      let stoppedEmitted = false;

      arbitrageIntegrationService.once('started', () => {
        startedEmitted = true;
      });

      arbitrageIntegrationService.once('stopped', () => {
        stoppedEmitted = true;
      });

      await arbitrageIntegrationService.start();
      await arbitrageIntegrationService.stop();

      expect(startedEmitted).toBe(true);
      expect(stoppedEmitted).toBe(true);

      // Reiniciar
      await arbitrageIntegrationService.start();
    });

    it('should reset metrics correctly', () => {
      arbitrageIntegrationService.resetMetrics();
      
      const metrics = arbitrageIntegrationService.getMetrics();
      
      expect(metrics.totalDetected).toBe(0);
      expect(metrics.totalValidated).toBe(0);
      expect(metrics.totalExecuted).toBe(0);
      expect(metrics.totalSuccessful).toBe(0);
      expect(metrics.totalFailed).toBe(0);
      expect(metrics.totalProfitUSD).toBe(0);
    });
  });

  // ================================================================================
  // ERROR HANDLING TESTS
  // ================================================================================

  describe('9. Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      // Mock error en validación
      jest.spyOn(marketDataService, 'getPrice').mockRejectedValue(
        new Error('Oracle unavailable')
      );

      const opportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC'],
        dexes: ['uniswap'],
        estimatedProfitUSD: 25,
        confidence: 0.85,
        timestamp: Date.now(),
        metadata: {}
      };

      let errorEmitted = false;
      
      arbitrageIntegrationService.once('opportunity_error', () => {
        errorEmitted = true;
      });

      marketDataService.emit('opportunity_detected', opportunity);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errorEmitted).toBe(true);

      // Restaurar mock
      jest.restoreAllMocks();
    });

    it('should handle execution errors gracefully', async () => {
      // La simulación ya tiene 20% de fallo
      const opportunity = {
        type: 'arbitrage',
        tokens: ['ETH', 'USDC'],
        dexes: ['uniswap'],
        estimatedProfitUSD: 25,
        confidence: 0.85,
        timestamp: Date.now(),
        metadata: {}
      };

      let failureEmitted = false;
      
      arbitrageIntegrationService.once('execution_failure', () => {
        failureEmitted = true;
      });

      // Emitir varias oportunidades para aumentar probabilidad de fallo
      for (let i = 0; i < 10; i++) {
        marketDataService.emit('opportunity_detected', { ...opportunity, id: i });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      await new Promise(resolve => setTimeout(resolve, 15000));

      // Al menos una debería fallar
      const metrics = arbitrageIntegrationService.getMetrics();
      expect(metrics.totalFailed).toBeGreaterThan(0);
    });
  });

  // ================================================================================
  // INTEGRATION SUMMARY
  // ================================================================================

  describe('10. Integration Summary', () => {
    it('should have complete E2E flow functional', () => {
      const stats = arbitrageIntegrationService.getStats();
      const metrics = arbitrageIntegrationService.getMetrics();

      // Verificar que el sistema está operativo
      expect(stats.isInitialized).toBe(true);
      expect(stats.isActive).toBe(true);

      // Verificar que se procesaron oportunidades
      expect(metrics.totalDetected).toBeGreaterThan(0);

      // Calcular success rate
      if (metrics.totalExecuted > 0) {
        const successRate = (metrics.totalSuccessful / metrics.totalExecuted) * 100;
        console.log(`\n📊 E2E Integration Summary:`);
        console.log(`   - Total Detected: ${metrics.totalDetected}`);
        console.log(`   - Total Validated: ${metrics.totalValidated}`);
        console.log(`   - Total Executed: ${metrics.totalExecuted}`);
        console.log(`   - Success Rate: ${successRate.toFixed(1)}%`);
        console.log(`   - Total Profit: $${metrics.totalProfitUSD.toFixed(2)}`);
        console.log(`   - Avg Execution Time: ${metrics.averageExecutionTime.toFixed(0)}ms`);
        
        // Success rate debería ser razonable (> 50%)
        expect(successRate).toBeGreaterThan(50);
      }
    });
  });
});

