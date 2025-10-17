/**
 * ARBITRAGEXPLUS2025 - Controlador de Arbitraje
 * 
 * Controlador principal para operaciones de arbitraje siguiendo
 * arquitectura de programación dinámica con arrays desde Google Sheets.
 * 
 * PRINCIPIO SAGRADO: CERO HARDCODING - Todo desde Sheets (1016+ campos)
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { SheetsService } from '../services/sheetsService';
import { ArbitrageIntegrationService } from '../services/arbitrageIntegration';
import { MarketDataService } from '../services/marketDataService';

export class ArbitrageController {
  private sheetsService: SheetsService;
  private arbitrageService: ArbitrageIntegrationService;
  private marketDataService: MarketDataService;

  constructor() {
    this.sheetsService = new SheetsService();
    this.arbitrageService = new ArbitrageIntegrationService();
    this.marketDataService = new MarketDataService();
  }

  /**
   * GET /api/arbitrage/opportunities
   * Obtiene oportunidades de arbitraje activas desde Google Sheets ROUTES
   */
  async getOpportunities(
    request: FastifyRequest<{
      Querystring: {
        min_profit?: string;
        strategy?: string;
        chain_id?: string;
        limit?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { min_profit, strategy, chain_id, limit } = request.query;

      // Leer rutas dinámicamente desde Sheets ROUTES (200 campos)
      const routes = await this.sheetsService.getRoutesArray();

      // Filtrar según parámetros (todo dinámico, CERO hardcoding)
      let filtered = routes.filter(route => route.IS_ACTIVE === true);

      if (min_profit) {
        const minProfitUSD = parseFloat(min_profit);
        filtered = filtered.filter(r => r.EXPECTED_PROFIT_USD >= minProfitUSD);
      }

      if (strategy) {
        filtered = filtered.filter(r => r.STRATEGY_TYPE === strategy);
      }

      if (chain_id) {
        filtered = filtered.filter(r => r.CHAIN_ID === parseInt(chain_id));
      }

      // Ordenar por profit descendente
      filtered.sort((a, b) => b.EXPECTED_PROFIT_USD - a.EXPECTED_PROFIT_USD);

      // Limitar resultados
      const maxResults = limit ? parseInt(limit) : 50;
      const results = filtered.slice(0, maxResults);

      return reply.code(200).send({
        success: true,
        count: results.length,
        total_available: filtered.length,
        opportunities: results,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      request.log.error({ error }, 'Error getting opportunities');
      return reply.code(500).send({
        success: false,
        error: 'Failed to get opportunities',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/arbitrage/execute
   * Ejecuta una operación de arbitraje
   */
  async executeArbitrage(
    request: FastifyRequest<{
      Body: {
        route_id: string;
        amount?: number;
        slippage_tolerance?: number;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { route_id, amount, slippage_tolerance } = request.body;

      if (!route_id) {
        return reply.code(400).send({
          success: false,
          error: 'route_id is required'
        });
      }

      // Leer ruta desde Sheets ROUTES (200 campos dinámicos)
      const routes = await this.sheetsService.getRoutesArray();
      const route = routes.find(r => r.ROUTE_ID === route_id);

      if (!route) {
        return reply.code(404).send({
          success: false,
          error: 'Route not found'
        });
      }

      if (!route.IS_ACTIVE) {
        return reply.code(400).send({
          success: false,
          error: 'Route is not active'
        });
      }

      // Validar que la ruta sigue siendo rentable
      if (!route.IS_PROFITABLE) {
        return reply.code(400).send({
          success: false,
          error: 'Route is no longer profitable'
        });
      }

      // Ejecutar arbitraje a través del servicio de integración
      const result = await this.arbitrageService.executeOpportunity({
        route_id: route.ROUTE_ID,
        route_name: route.ROUTE_NAME,
        strategy_type: route.STRATEGY_TYPE,
        source_token: route.SOURCE_TOKEN,
        target_token: route.TARGET_TOKEN,
        dex_1: route.DEX_1,
        dex_2: route.DEX_2,
        expected_profit: route.EXPECTED_PROFIT_USD,
        confidence_score: route.CONFIDENCE_SCORE || 0.8,
        amount: amount || route.RECOMMENDED_AMOUNT,
        slippage_tolerance: slippage_tolerance || route.MAX_SLIPPAGE
      });

      // Escribir resultado en Sheets EXECUTIONS (50 campos)
      await this.sheetsService.writeExecutionResult({
        EXECUTION_ID: result.execution_id,
        ROUTE_ID: route_id,
        STATUS: result.success ? 'SUCCESS' : 'FAILED',
        TIMESTAMP: new Date().toISOString(),
        PROFIT_USD: result.profit_usd || 0,
        GAS_USED: result.gas_used || 0,
        TRANSACTION_HASH: result.tx_hash || '',
        ERROR_MESSAGE: result.error || ''
      });

      return reply.code(200).send({
        success: true,
        execution: result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      request.log.error({ error }, 'Error executing arbitrage');
      return reply.code(500).send({
        success: false,
        error: 'Failed to execute arbitrage',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/arbitrage/executions
   * Obtiene historial de ejecuciones desde Google Sheets EXECUTIONS
   */
  async getExecutions(
    request: FastifyRequest<{
      Querystring: {
        route_id?: string;
        status?: string;
        limit?: string;
        offset?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { route_id, status, limit, offset } = request.query;

      // Leer ejecuciones desde Sheets EXECUTIONS (50 campos dinámicos)
      const executions = await this.sheetsService.getExecutionsArray();

      // Filtrar según parámetros
      let filtered = executions;

      if (route_id) {
        filtered = filtered.filter(e => e.ROUTE_ID === route_id);
      }

      if (status) {
        filtered = filtered.filter(e => e.STATUS === status);
      }

      // Ordenar por timestamp descendente
      filtered.sort((a, b) => 
        new Date(b.TIMESTAMP).getTime() - new Date(a.TIMESTAMP).getTime()
      );

      // Paginación
      const offsetNum = offset ? parseInt(offset) : 0;
      const limitNum = limit ? parseInt(limit) : 100;
      const paginated = filtered.slice(offsetNum, offsetNum + limitNum);

      // Calcular estadísticas
      const stats = {
        total: filtered.length,
        successful: filtered.filter(e => e.STATUS === 'SUCCESS').length,
        failed: filtered.filter(e => e.STATUS === 'FAILED').length,
        total_profit: filtered
          .filter(e => e.STATUS === 'SUCCESS')
          .reduce((sum, e) => sum + (e.PROFIT_USD || 0), 0)
      };

      return reply.code(200).send({
        success: true,
        count: paginated.length,
        total: filtered.length,
        stats,
        executions: paginated,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      request.log.error({ error }, 'Error getting executions');
      return reply.code(500).send({
        success: false,
        error: 'Failed to get executions',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/arbitrage/stats
   * Obtiene estadísticas globales del sistema
   */
  async getStats(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // Leer datos dinámicamente desde múltiples hojas
      const [routes, executions, config] = await Promise.all([
        this.sheetsService.getRoutesArray(),      // ROUTES - 200 campos
        this.sheetsService.getExecutionsArray(),  // EXECUTIONS - 50 campos
        this.sheetsService.getConfigArray()       // CONFIG - 7 campos
      ]);

      // Calcular estadísticas dinámicamente
      const activeRoutes = routes.filter(r => r.IS_ACTIVE === true);
      const profitableRoutes = routes.filter(r => r.IS_PROFITABLE === true);
      
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentExecutions = executions.filter(e => 
        new Date(e.TIMESTAMP) >= last24h
      );

      const successfulExecutions = recentExecutions.filter(e => 
        e.STATUS === 'SUCCESS'
      );

      const stats = {
        routes: {
          total: routes.length,
          active: activeRoutes.length,
          profitable: profitableRoutes.length,
          avg_profit: profitableRoutes.length > 0
            ? profitableRoutes.reduce((sum, r) => sum + r.EXPECTED_PROFIT_USD, 0) / profitableRoutes.length
            : 0
        },
        executions_24h: {
          total: recentExecutions.length,
          successful: successfulExecutions.length,
          failed: recentExecutions.length - successfulExecutions.length,
          success_rate: recentExecutions.length > 0
            ? (successfulExecutions.length / recentExecutions.length) * 100
            : 0,
          total_profit: successfulExecutions.reduce((sum, e) => sum + (e.PROFIT_USD || 0), 0)
        },
        config: {
          min_profit_usd: config.find(c => c.CONFIG_KEY === 'MIN_PROFIT_USD')?.VALUE || 10,
          max_slippage: config.find(c => c.CONFIG_KEY === 'MAX_SLIPPAGE')?.VALUE || 0.01,
          enabled_strategies: config.find(c => c.CONFIG_KEY === 'ENABLED_STRATEGIES')?.VALUE || ''
        },
        market_data: await this.marketDataService.getMetrics(),
        timestamp: new Date().toISOString()
      };

      return reply.code(200).send({
        success: true,
        stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      request.log.error({ error }, 'Error getting stats');
      return reply.code(500).send({
        success: false,
        error: 'Failed to get stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/arbitrage/start
   * Inicia el sistema de detección y ejecución automática
   */
  async startSystem(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      // Inicializar servicios con arrays dinámicos desde Sheets
      await this.marketDataService.initialize();
      await this.arbitrageService.initialize();

      // Iniciar detección automática
      await this.arbitrageService.start();

      return reply.code(200).send({
        success: true,
        message: 'Arbitrage system started successfully',
        status: 'running',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      request.log.error({ error }, 'Error starting system');
      return reply.code(500).send({
        success: false,
        error: 'Failed to start system',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/arbitrage/stop
   * Detiene el sistema de detección y ejecución automática
   */
  async stopSystem(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    try {
      await this.arbitrageService.stop();

      return reply.code(200).send({
        success: true,
        message: 'Arbitrage system stopped successfully',
        status: 'stopped',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      request.log.error({ error }, 'Error stopping system');
      return reply.code(500).send({
        success: false,
        error: 'Failed to stop system',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Exportar instancia singleton
export const arbitrageController = new ArbitrageController();

// Exportar rutas para Fastify
export function registerArbitrageRoutes(app: any) {
  const controller = arbitrageController;

  // Rutas de oportunidades y ejecución
  app.get('/api/arbitrage/opportunities', controller.getOpportunities.bind(controller));
  app.post('/api/arbitrage/execute', controller.executeArbitrage.bind(controller));
  app.get('/api/arbitrage/executions', controller.getExecutions.bind(controller));
  app.get('/api/arbitrage/stats', controller.getStats.bind(controller));

  // Rutas de control del sistema
  app.post('/api/arbitrage/start', controller.startSystem.bind(controller));
  app.post('/api/arbitrage/stop', controller.stopSystem.bind(controller));
}

