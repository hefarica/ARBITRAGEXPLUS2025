/**
 * ARBITRAGEXPLUS2025 - Arbitrage Controller
 * 
 * Controlador principal para operaciones de arbitraje DeFi.
 * Maneja rutas, ejecuciones, análisis de rentabilidad y coordinación
 * entre el motor Rust y los servicios Python.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '@logger';
import { ArbitrageService } from '@services/arbitrageService';
import { SheetsService } from '@services/sheetsService';
import { ValidationError, BusinessError, SystemError } from '@errors';
import { 
  ArbitrageRoute, 
  ExecutionResult, 
  ProfitabilityAnalysis,
  ArbitrageStrategy,
  RiskAssessment,
  PerformanceMetrics 
} from '@types';

// ==================================================================================
// VALIDATION SCHEMAS
// ==================================================================================

const RouteDiscoverySchema = z.object({
  sourceToken: z.string().min(2).max(10),
  targetToken: z.string().min(2).max(10),
  chains: z.array(z.number().int().positive()).min(1).max(5),
  maxHops: z.number().int().min(2).max(4).default(3),
  minProfitUSD: z.number().positive().default(10),
  maxSlippage: z.number().min(0).max(0.1).default(0.005),
  strategy: z.enum(['2dex', '3dex', 'triangular', 'flash_loan', 'cross_chain']).default('2dex')
});

const ExecutionRequestSchema = z.object({
  routeId: z.string().uuid(),
  amountIn: z.string().regex(/^\d+(\.\d+)?$/),
  maxSlippage: z.number().min(0).max(0.1).default(0.005),
  gasMultiplier: z.number().min(1).max(2).default(1.1),
  simulate: z.boolean().default(false),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium')
});

const AnalysisRequestSchema = z.object({
  tokenPair: z.string().regex(/^[A-Z0-9]+\/[A-Z0-9]+$/),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d']).default('1h'),
  includeHistorical: z.boolean().default(true),
  riskProfile: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate')
});

const OptimizationRequestSchema = z.object({
  routes: z.array(z.string().uuid()).min(1).max(10),
  objective: z.enum(['profit', 'success_rate', 'risk_adjusted']).default('profit'),
  constraints: z.object({
    maxGasCost: z.number().positive().optional(),
    maxExecutionTime: z.number().positive().optional(),
    minLiquidity: z.number().positive().optional()
  }).optional()
});

// ==================================================================================
// ARBITRAGE CONTROLLER CLASS
// ==================================================================================

export class ArbitrageController {
  private arbitrageService: ArbitrageService;
  private sheetsService: SheetsService;

  constructor() {
    this.arbitrageService = new ArbitrageService();
    this.sheetsService = new SheetsService();
  }

  // ================================================================================
  // ROUTE DISCOVERY ENDPOINTS
  // ================================================================================

  /**
   * Discover arbitrage opportunities
   * POST /api/v1/arbitrage/discover
   */
  discoverRoutes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = RouteDiscoverySchema.parse(req.body);
      
      logger.info('Starting route discovery', {
        sourceToken: validatedData.sourceToken,
        targetToken: validatedData.targetToken,
        chains: validatedData.chains,
        strategy: validatedData.strategy
      });

      // Call Rust engine for pathfinding
      const routes = await this.arbitrageService.discoverRoutes({
        sourceToken: validatedData.sourceToken,
        targetToken: validatedData.targetToken,
        chains: validatedData.chains,
        maxHops: validatedData.maxHops,
        minProfitUSD: validatedData.minProfitUSD,
        maxSlippage: validatedData.maxSlippage,
        strategy: validatedData.strategy
      });

      if (routes.length === 0) {
        res.status(200).json({
          success: true,
          message: 'No profitable routes found with current parameters',
          data: {
            routes: [],
            searchCriteria: validatedData,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Store routes in Google Sheets
      await this.sheetsService.updateRoutes(routes);

      // Calculate profitability analysis
      const analysis = await this.arbitrageService.analyzeProfitability(routes);

      logger.info(`Discovered ${routes.length} profitable routes`, {
        totalRoutes: routes.length,
        avgProfitUSD: analysis.averageProfitUSD,
        bestRoute: routes[0]?.id
      });

      res.status(200).json({
        success: true,
        message: `Found ${routes.length} profitable arbitrage routes`,
        data: {
          routes,
          analysis,
          searchCriteria: validatedData,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get active routes from cache/database
   * GET /api/v1/arbitrage/routes
   */
  getActiveRoutes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        strategy,
        minProfit = '10',
        maxSlippage = '0.005',
        sortBy = 'profitUSD',
        order = 'desc',
        limit = '50',
        offset = '0'
      } = req.query;

      const filters = {
        strategy: strategy as ArbitrageStrategy,
        minProfitUSD: parseFloat(minProfit as string),
        maxSlippage: parseFloat(maxSlippage as string),
        isActive: true
      };

      const routes = await this.arbitrageService.getActiveRoutes(
        filters,
        {
          sortBy: sortBy as string,
          order: order as 'asc' | 'desc',
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      );

      const totalCount = await this.arbitrageService.getActiveRoutesCount(filters);

      res.status(200).json({
        success: true,
        data: {
          routes,
          pagination: {
            total: totalCount,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore: totalCount > parseInt(offset as string) + routes.length
          }
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get specific route details
   * GET /api/v1/arbitrage/routes/:routeId
   */
  getRouteDetails = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { routeId } = req.params;

      if (!z.string().uuid().safeParse(routeId).success) {
        throw new ValidationError('Invalid route ID format');
      }

      const route = await this.arbitrageService.getRouteById(routeId);

      if (!route) {
        res.status(404).json({
          success: false,
          error: 'Route not found',
          message: `Route with ID ${routeId} does not exist`
        });
        return;
      }

      // Get execution history for this route
      const executions = await this.arbitrageService.getExecutionHistory(routeId, { limit: 10 });

      // Calculate performance metrics
      const performance = await this.arbitrageService.getRoutePerformance(routeId);

      res.status(200).json({
        success: true,
        data: {
          route,
          executions,
          performance,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // EXECUTION ENDPOINTS
  // ================================================================================

  /**
   * Execute arbitrage route
   * POST /api/v1/arbitrage/execute
   */
  executeArbitrage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = ExecutionRequestSchema.parse(req.body);

      logger.info('Starting arbitrage execution', {
        routeId: validatedData.routeId,
        amountIn: validatedData.amountIn,
        simulate: validatedData.simulate
      });

      // Get route details
      const route = await this.arbitrageService.getRouteById(validatedData.routeId);
      
      if (!route) {
        throw new BusinessError('Route not found', 404);
      }

      if (!route.isActive) {
        throw new BusinessError('Route is inactive or expired', 400);
      }

      // Pre-execution validation
      const validation = await this.arbitrageService.validateExecution(route, validatedData);
      
      if (!validation.isValid) {
        throw new BusinessError(`Execution validation failed: ${validation.errors.join(', ')}`, 400);
      }

      let result: ExecutionResult;

      if (validatedData.simulate) {
        // Simulation mode - no actual transactions
        result = await this.arbitrageService.simulateExecution(route, validatedData);
      } else {
        // Real execution
        result = await this.arbitrageService.executeRoute(route, validatedData);
      }

      // Record execution in Google Sheets
      await this.sheetsService.recordExecution(result);

      // Update route performance metrics
      if (!validatedData.simulate) {
        await this.arbitrageService.updateRouteMetrics(validatedData.routeId, result);
      }

      logger.info('Arbitrage execution completed', {
        routeId: validatedData.routeId,
        success: result.success,
        profitUSD: result.profitUSD,
        gasUsed: result.gasUsed,
        simulate: validatedData.simulate
      });

      const statusCode = validatedData.simulate ? 200 : (result.success ? 201 : 400);

      res.status(statusCode).json({
        success: result.success,
        message: validatedData.simulate ? 'Simulation completed' : 
                 result.success ? 'Execution completed successfully' : 'Execution failed',
        data: {
          execution: result,
          route: {
            id: route.id,
            sourceToken: route.sourceToken,
            targetToken: route.targetToken,
            expectedProfitUSD: route.expectedProfitUSD
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get execution history
   * GET /api/v1/arbitrage/executions
   */
  getExecutions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        routeId,
        status,
        minProfit = '0',
        timeframe = '24h',
        sortBy = 'timestamp',
        order = 'desc',
        limit = '50',
        offset = '0'
      } = req.query;

      const filters = {
        routeId: routeId as string | undefined,
        status: status as 'success' | 'failed' | 'pending' | undefined,
        minProfitUSD: parseFloat(minProfit as string),
        timeframe: timeframe as string
      };

      const executions = await this.arbitrageService.getExecutions(
        filters,
        {
          sortBy: sortBy as string,
          order: order as 'asc' | 'desc',
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      );

      const summary = await this.arbitrageService.getExecutionSummary(filters);

      res.status(200).json({
        success: true,
        data: {
          executions,
          summary,
          pagination: {
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            hasMore: executions.length === parseInt(limit as string)
          }
        }
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // ANALYSIS ENDPOINTS
  // ================================================================================

  /**
   * Analyze token pair profitability
   * POST /api/v1/arbitrage/analyze
   */
  analyzePair = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = AnalysisRequestSchema.parse(req.body);

      logger.info('Starting pair analysis', {
        tokenPair: validatedData.tokenPair,
        timeframe: validatedData.timeframe,
        riskProfile: validatedData.riskProfile
      });

      const analysis = await this.arbitrageService.analyzePair(
        validatedData.tokenPair,
        {
          timeframe: validatedData.timeframe,
          includeHistorical: validatedData.includeHistorical,
          riskProfile: validatedData.riskProfile
        }
      );

      res.status(200).json({
        success: true,
        message: `Analysis completed for ${validatedData.tokenPair}`,
        data: {
          analysis,
          parameters: validatedData,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get performance metrics
   * GET /api/v1/arbitrage/performance
   */
  getPerformance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        timeframe = '24h',
        groupBy = 'hour',
        includeDetails = 'false'
      } = req.query;

      const performance = await this.arbitrageService.getOverallPerformance({
        timeframe: timeframe as string,
        groupBy: groupBy as 'hour' | 'day' | 'week',
        includeDetails: includeDetails === 'true'
      });

      res.status(200).json({
        success: true,
        data: {
          performance,
          timeframe,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get risk assessment
   * GET /api/v1/arbitrage/risk
   */
  getRiskAssessment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { routeId, tokenPair, timeframe = '7d' } = req.query;

      let assessment: RiskAssessment;

      if (routeId) {
        if (!z.string().uuid().safeParse(routeId).success) {
          throw new ValidationError('Invalid route ID format');
        }
        assessment = await this.arbitrageService.assessRouteRisk(routeId as string);
      } else if (tokenPair) {
        assessment = await this.arbitrageService.assessPairRisk(
          tokenPair as string,
          timeframe as string
        );
      } else {
        assessment = await this.arbitrageService.getSystemRiskAssessment();
      }

      res.status(200).json({
        success: true,
        data: {
          riskAssessment: assessment,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // OPTIMIZATION ENDPOINTS
  // ================================================================================

  /**
   * Optimize route parameters
   * POST /api/v1/arbitrage/optimize
   */
  optimizeRoutes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = OptimizationRequestSchema.parse(req.body);

      logger.info('Starting route optimization', {
        routes: validatedData.routes,
        objective: validatedData.objective
      });

      const optimization = await this.arbitrageService.optimizeRoutes(validatedData);

      res.status(200).json({
        success: true,
        message: `Optimized ${validatedData.routes.length} routes for ${validatedData.objective}`,
        data: {
          optimization,
          originalRoutes: validatedData.routes,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get optimization suggestions
   * GET /api/v1/arbitrage/suggestions
   */
  getSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        strategy,
        riskTolerance = 'moderate',
        minProfit = '10',
        maxGasCost = '50'
      } = req.query;

      const suggestions = await this.arbitrageService.generateSuggestions({
        strategy: strategy as ArbitrageStrategy | undefined,
        riskTolerance: riskTolerance as 'low' | 'moderate' | 'high',
        minProfitUSD: parseFloat(minProfit as string),
        maxGasCostUSD: parseFloat(maxGasCost as string)
      });

      res.status(200).json({
        success: true,
        data: {
          suggestions,
          parameters: {
            strategy,
            riskTolerance,
            minProfitUSD: parseFloat(minProfit as string),
            maxGasCostUSD: parseFloat(maxGasCost as string)
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // REAL-TIME MONITORING
  // ================================================================================

  /**
   * Get real-time opportunities
   * GET /api/v1/arbitrage/opportunities/live
   */
  getLiveOpportunities = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        minProfit = '5',
        maxSlippage = '0.01',
        chains,
        strategy
      } = req.query;

      const opportunities = await this.arbitrageService.getLiveOpportunities({
        minProfitUSD: parseFloat(minProfit as string),
        maxSlippage: parseFloat(maxSlippage as string),
        chains: chains ? (chains as string).split(',').map(Number) : undefined,
        strategy: strategy as ArbitrageStrategy | undefined
      });

      res.status(200).json({
        success: true,
        data: {
          opportunities,
          count: opportunities.length,
          timestamp: new Date().toISOString(),
          refreshRate: 10 // seconds
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Emergency stop for all executions
   * POST /api/v1/arbitrage/emergency-stop
   */
  emergencyStop = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reason } = req.body;

      logger.warn('Emergency stop initiated', { reason });

      const result = await this.arbitrageService.emergencyStop(reason);

      // Record in Google Sheets
      await this.sheetsService.recordAlert({
        type: 'emergency_stop',
        message: `Emergency stop initiated: ${reason}`,
        severity: 'critical',
        timestamp: new Date().toISOString(),
        data: result
      });

      res.status(200).json({
        success: true,
        message: 'Emergency stop completed',
        data: result
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // SYSTEM STATUS
  // ================================================================================

  /**
   * Get arbitrage system status
   * GET /api/v1/arbitrage/status
   */
  getSystemStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = await this.arbitrageService.getSystemStatus();

      res.status(200).json({
        success: true,
        data: {
          status,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };
}

export const arbitrageController = new ArbitrageController();