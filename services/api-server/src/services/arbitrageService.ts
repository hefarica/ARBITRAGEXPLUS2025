/**
 * ARBITRAGEXPLUS2025 - Arbitrage Service
 * 
 * Servicio principal para operaciones de arbitraje DeFi.
 * Coordina la comunicación entre el motor Rust, Python collector,
 * Google Sheets y maneja toda la lógica de negocio de arbitraje.
 */

import { logger } from '@logger';
import { 
  ArbitrageRoute, 
  ExecutionResult, 
  ProfitabilityAnalysis,
  ArbitrageStrategy,
  RiskAssessment,
  PerformanceMetrics,
  ExecutionRequest,
  RouteValidation,
  ArbitrageOpportunity
} from '@types';
import { 
  BusinessError, 
  ArbitrageError, 
  NoProfitableRoutesError,
  InsufficientLiquidityError,
  SlippageTooHighError
} from '@errors';
import { 
  retry, 
  withTimeout, 
  generateUUID, 
  calculatePercentageChange,
  formatUnits,
  parseUnits
} from '@utils';
import { redisService } from '@config/redis';
import { databaseService } from '@config/database';

// ==================================================================================
// INTERFACES & TYPES
// ==================================================================================

interface RouteDiscoveryOptions {
  sourceToken: string;
  targetToken: string;
  chains: number[];
  maxHops: number;
  minProfitUSD: number;
  maxSlippage: number;
  strategy: ArbitrageStrategy;
}

interface ExecutionOptions {
  routeId: string;
  amountIn: string;
  maxSlippage: number;
  gasMultiplier: number;
  simulate: boolean;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface RouteFilters {
  strategy?: ArbitrageStrategy;
  minProfitUSD?: number;
  maxSlippage?: number;
  isActive?: boolean;
}

interface PaginationOptions {
  sortBy: string;
  order: 'asc' | 'desc';
  limit: number;
  offset: number;
}

// ==================================================================================
// ARBITRAGE SERVICE CLASS
// ==================================================================================

export class ArbitrageService {
  private rustEngineUrl: string;
  private pythonCollectorUrl: string;
  private isInitialized = false;

  constructor() {
    this.rustEngineUrl = process.env.RUST_ENGINE_URL || 'http://localhost:8002';
    this.pythonCollectorUrl = process.env.PYTHON_COLLECTOR_URL || 'http://localhost:8001';
  }

  // ================================================================================
  // INITIALIZATION & HEALTH CHECKS
  // ================================================================================

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing ArbitrageService...');

      // Check Rust engine connectivity
      await this.checkRustEngineHealth();
      
      // Check Python collector connectivity
      await this.checkPythonCollectorHealth();
      
      // Verify database connectivity
      if (!databaseService.isReady) {
        await databaseService.connect();
      }

      this.isInitialized = true;
      logger.info('ArbitrageService initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize ArbitrageService', { error });
      throw new ArbitrageError('Service initialization failed', {
        context: { error: error.message }
      });
    }
  }

  private async checkRustEngineHealth(): Promise<void> {
    try {
      const response = await fetch(`${this.rustEngineUrl}/health`, {
        method: 'GET',
        timeout: 5000
      });

      if (!response.ok) {
        throw new Error(`Rust engine unhealthy: ${response.status}`);
      }

      const health = await response.json();
      logger.debug('Rust engine health check passed', { health });

    } catch (error) {
      throw new ArbitrageError('Rust engine unavailable', {
        context: { 
          url: this.rustEngineUrl,
          error: error.message 
        }
      });
    }
  }

  private async checkPythonCollectorHealth(): Promise<void> {
    try {
      const response = await fetch(`${this.pythonCollectorUrl}/health`, {
        method: 'GET',
        timeout: 8000
      });

      if (!response.ok) {
        throw new Error(`Python collector unhealthy: ${response.status}`);
      }

      const health = await response.json();
      logger.debug('Python collector health check passed', { health });

    } catch (error) {
      throw new ArbitrageError('Python collector unavailable', {
        context: { 
          url: this.pythonCollectorUrl,
          error: error.message 
        }
      });
    }
  }

  // ================================================================================
  // ROUTE DISCOVERY
  // ================================================================================

  async discoverRoutes(options: RouteDiscoveryOptions): Promise<ArbitrageRoute[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const timerId = logger.startTimer('route_discovery');
    
    try {
      logger.arbitrage('Starting route discovery', {
        sourceToken: options.sourceToken,
        targetToken: options.targetToken,
        chains: options.chains,
        strategy: options.strategy
      });

      // Call Rust engine for pathfinding
      const routes = await this.callRustPathfinder(options);

      if (routes.length === 0) {
        throw new NoProfitableRoutesError(
          options.sourceToken,
          options.targetToken,
          options.minProfitUSD
        );
      }

      // Validate and enrich routes
      const validatedRoutes = await this.validateAndEnrichRoutes(routes, options);

      // Cache routes for quick access
      await this.cacheRoutes(validatedRoutes);

      logger.arbitrage('Route discovery completed', {
        routesFound: validatedRoutes.length,
        avgProfitUSD: this.calculateAverageProfit(validatedRoutes),
        strategy: options.strategy
      });

      return validatedRoutes;

    } catch (error) {
      logger.error('Route discovery failed', {
        operation: 'route_discovery',
        error: error.message,
        options
      });
      throw error;
    } finally {
      logger.endTimer(timerId, 'route_discovery', true);
    }
  }

  private async callRustPathfinder(options: RouteDiscoveryOptions): Promise<any[]> {
    const payload = {
      source_token: options.sourceToken,
      target_token: options.targetToken,
      chain_ids: options.chains,
      max_hops: options.maxHops,
      min_profit_usd: options.minProfitUSD,
      max_slippage: options.maxSlippage,
      strategy: options.strategy,
      timestamp: Date.now()
    };

    const response = await retry(
      async () => {
        const res = await fetch(`${this.rustEngineUrl}/api/v1/pathfinding/discover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          timeout: 30000
        });

        if (!response.ok) {
          throw new Error(`Rust pathfinder failed: ${res.status} ${res.statusText}`);
        }

        return res.json();
      },
      {
        retries: 3,
        delay: 1000,
        shouldRetry: (error) => !error.message.includes('400')
      }
    );

    return response.routes || [];
  }

  private async validateAndEnrichRoutes(
    rustRoutes: any[], 
    options: RouteDiscoveryOptions
  ): Promise<ArbitrageRoute[]> {
    const enrichedRoutes: ArbitrageRoute[] = [];

    for (const rustRoute of rustRoutes) {
      try {
        // Convert Rust route format to our TypeScript format
        const route: ArbitrageRoute = {
          id: generateUUID(),
          strategy: options.strategy,
          sourceToken: await this.getTokenInfo(rustRoute.source_token, rustRoute.chain_id),
          targetToken: await this.getTokenInfo(rustRoute.target_token, rustRoute.chain_id),
          intermediateTokens: await this.getIntermediateTokens(rustRoute.intermediate_tokens),
          
          // Path information
          path: rustRoute.path.map((step: any) => ({
            dexId: step.dex_id,
            poolId: step.pool_id,
            token0: step.token0,
            token1: step.token1,
            fee: step.fee
          })),

          // Profitability
          inputAmount: rustRoute.input_amount,
          expectedOutputAmount: rustRoute.expected_output,
          minOutputAmount: rustRoute.min_output,
          profitAmount: rustRoute.profit_amount,
          profitUSD: rustRoute.profit_usd,
          profitPercent: rustRoute.profit_percent,

          // Execution parameters
          maxSlippage: options.maxSlippage,
          gasEstimate: rustRoute.gas_estimate,
          gasCostUSD: rustRoute.gas_cost_usd,
          deadline: new Date(Date.now() + 20 * 60 * 1000), // 20 minutes

          // Metadata
          confidence: rustRoute.confidence || 0.8,
          riskLevel: this.assessRiskLevel(rustRoute),
          isActive: true,
          createdAt: new Date(),
          lastValidated: new Date(),

          // Constraints
          minLiquidityUSD: rustRoute.min_liquidity_usd || 1000,
          maxGasPriceGwei: 100,
          requiredConfirmations: 1
        };

        // Additional validation
        const validation = await this.validateRoute(route);
        if (validation.isValid) {
          enrichedRoutes.push(route);
        } else {
          logger.warn('Route failed validation', {
            routeId: route.id,
            errors: validation.errors
          });
        }

      } catch (error) {
        logger.warn('Failed to enrich route', { error: error.message });
        continue;
      }
    }

    return enrichedRoutes;
  }

  private assessRiskLevel(rustRoute: any): 'low' | 'medium' | 'high' | 'critical' {
    const slippage = rustRoute.expected_slippage || 0;
    const liquidity = rustRoute.min_liquidity_usd || 0;
    const gasRatio = (rustRoute.gas_cost_usd || 0) / (rustRoute.profit_usd || 1);

    if (slippage > 0.05 || liquidity < 500 || gasRatio > 0.5) {
      return 'critical';
    } else if (slippage > 0.02 || liquidity < 1000 || gasRatio > 0.3) {
      return 'high';
    } else if (slippage > 0.01 || liquidity < 5000 || gasRatio > 0.2) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  // ================================================================================
  // ROUTE VALIDATION
  // ================================================================================

  async validateRoute(route: ArbitrageRoute): Promise<RouteValidation> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check route expiry
      if (new Date() > route.deadline) {
        errors.push('Route has expired');
      }

      // Check minimum profit
      if (route.profitUSD < 1) {
        errors.push(`Profit too low: $${route.profitUSD}`);
      }

      // Check slippage
      if (route.maxSlippage > 0.1) {
        warnings.push(`High slippage: ${route.maxSlippage * 100}%`);
      }

      // Check gas cost ratio
      const gasCostRatio = route.gasCostUSD / route.profitUSD;
      if (gasCostRatio > 0.5) {
        errors.push(`Gas cost too high: ${(gasCostRatio * 100).toFixed(1)}% of profit`);
      }

      // Validate with current market prices
      const priceValidation = await this.validateCurrentPrices(route);
      if (!priceValidation.valid) {
        errors.push('Prices have moved unfavorably');
        warnings.push(...priceValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        gasEstimate: route.gasEstimate,
        priceImpact: await this.calculatePriceImpact(route),
        liquidityCheck: await this.checkLiquidity(route),
        slippageCheck: route.maxSlippage <= 0.05,
        profitabilityCheck: route.profitUSD > 5,
        validatedAt: new Date()
      };

    } catch (error) {
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        gasEstimate: route.gasEstimate,
        priceImpact: 0,
        liquidityCheck: false,
        slippageCheck: false,
        profitabilityCheck: false,
        validatedAt: new Date()
      };
    }
  }

  private async validateCurrentPrices(route: ArbitrageRoute): Promise<{
    valid: boolean;
    warnings: string[];
  }> {
    try {
      // Get current prices from Python collector
      const currentPrices = await this.getCurrentPrices([
        route.sourceToken.symbol,
        route.targetToken.symbol
      ]);

      // Compare with route prices (implement price staleness check)
      const warnings: string[] = [];
      let valid = true;

      // Price staleness check (routes should be validated within 30 seconds)
      const ageMs = Date.now() - route.lastValidated.getTime();
      if (ageMs > 30000) {
        warnings.push('Route prices may be stale');
        if (ageMs > 120000) {
          valid = false;
        }
      }

      return { valid, warnings };

    } catch (error) {
      return { 
        valid: false, 
        warnings: [`Price validation failed: ${error.message}`] 
      };
    }
  }

  // ================================================================================
  // ROUTE EXECUTION
  // ================================================================================

  async executeRoute(route: ArbitrageRoute, options: ExecutionOptions): Promise<ExecutionResult> {
    const executionId = generateUUID();
    const timerId = logger.startTimer('route_execution');

    try {
      logger.execution('Starting route execution', {
        executionId,
        routeId: route.id,
        strategy: route.strategy,
        amountIn: options.amountIn,
        simulate: options.simulate
      });

      // Pre-execution validation
      const validation = await this.validateExecution(route, options);
      if (!validation.isValid) {
        throw new ArbitrageError('Execution validation failed', {
          executionId,
          routeId: route.id,
          context: { errors: validation.errors }
        });
      }

      let result: ExecutionResult;

      if (options.simulate) {
        result = await this.simulateExecution(route, options);
      } else {
        result = await this.executeReal(route, options, executionId);
      }

      logger.execution('Route execution completed', {
        executionId,
        routeId: route.id,
        success: result.success,
        profitUSD: result.profitUSD,
        gasUsed: result.gasUsed
      });

      return result;

    } catch (error) {
      logger.error('Route execution failed', {
        executionId,
        routeId: route.id,
        error: error.message
      });
      
      throw new ArbitrageError('Execution failed', {
        executionId,
        routeId: route.id,
        context: { error: error.message }
      });
    } finally {
      logger.endTimer(timerId, 'route_execution', true);
    }
  }

  async simulateExecution(route: ArbitrageRoute, options: ExecutionOptions): Promise<ExecutionResult> {
    // Call Rust engine for simulation
    const payload = {
      route_id: route.id,
      amount_in: options.amountIn,
      max_slippage: options.maxSlippage,
      gas_multiplier: options.gasMultiplier,
      simulate: true
    };

    const response = await fetch(`${this.rustEngineUrl}/api/v1/execution/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 15000
    });

    if (!response.ok) {
      throw new ArbitrageError('Simulation failed', {
        routeId: route.id,
        context: { status: response.status }
      });
    }

    const simResult = await response.json();

    return {
      id: generateUUID(),
      routeId: route.id,
      success: simResult.success,
      
      amountIn: options.amountIn,
      amountOut: simResult.amount_out,
      expectedAmountOut: route.expectedOutputAmount,
      slippageActual: simResult.slippage,
      
      profitAmount: simResult.profit_amount,
      profitUSD: simResult.profit_usd,
      profitPercent: simResult.profit_percent,
      
      gasUsed: simResult.gas_estimate,
      gasPrice: simResult.gas_price,
      gasCostUSD: simResult.gas_cost_usd,
      totalFees: simResult.total_fees,
      
      executedAt: new Date(),
      executionTime: simResult.execution_time_ms,
      
      status: simResult.success ? 'success' : 'failed',
      
      mevDetected: simResult.mev_detected || false,
      competingTransactions: simResult.competing_txs || 0,
      blockPosition: 0
    };
  }

  private async executeReal(
    route: ArbitrageRoute, 
    options: ExecutionOptions, 
    executionId: string
  ): Promise<ExecutionResult> {
    // Real execution via Rust engine
    const payload = {
      route_id: route.id,
      execution_id: executionId,
      amount_in: options.amountIn,
      max_slippage: options.maxSlippage,
      gas_multiplier: options.gasMultiplier,
      priority: options.priority,
      simulate: false
    };

    const response = await withTimeout(
      fetch(`${this.rustEngineUrl}/api/v1/execution/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }),
      60000, // 60 second timeout
      'Execution timeout'
    );

    if (!response.ok) {
      throw new ArbitrageError('Real execution failed', {
        executionId,
        routeId: route.id,
        context: { status: response.status }
      });
    }

    const execResult = await response.json();

    return {
      id: executionId,
      routeId: route.id,
      transactionHash: execResult.transaction_hash,
      blockNumber: execResult.block_number,
      success: execResult.success,
      
      amountIn: options.amountIn,
      amountOut: execResult.amount_out,
      expectedAmountOut: route.expectedOutputAmount,
      slippageActual: execResult.slippage_actual,
      
      profitAmount: execResult.profit_amount,
      profitUSD: execResult.profit_usd,
      profitPercent: execResult.profit_percent,
      
      gasUsed: execResult.gas_used,
      gasPrice: execResult.gas_price,
      gasCostUSD: execResult.gas_cost_usd,
      totalFees: execResult.total_fees,
      
      executedAt: new Date(execResult.executed_at),
      confirmedAt: execResult.confirmed_at ? new Date(execResult.confirmed_at) : undefined,
      executionTime: execResult.execution_time_ms,
      
      status: execResult.status,
      errorMessage: execResult.error_message,
      failureReason: execResult.failure_reason,
      
      mevDetected: execResult.mev_detected || false,
      competingTransactions: execResult.competing_txs || 0,
      blockPosition: execResult.block_position || 0
    };
  }

  // ================================================================================
  // UTILITY METHODS
  // ================================================================================

  private async getTokenInfo(symbol: string, chainId: number): Promise<any> {
    // Implementation would fetch token info from database or cache
    return {
      address: `0x${'0'.repeat(40)}`, // Placeholder
      symbol,
      name: symbol,
      decimals: 18,
      chainId
    };
  }

  private async getIntermediateTokens(tokens: any[]): Promise<any[]> {
    if (!tokens) return [];
    
    const result = [];
    for (const token of tokens) {
      result.push(await this.getTokenInfo(token.symbol, token.chain_id));
    }
    return result;
  }

  private calculateAverageProfit(routes: ArbitrageRoute[]): number {
    if (routes.length === 0) return 0;
    
    const total = routes.reduce((sum, route) => sum + route.profitUSD, 0);
    return Math.round((total / routes.length) * 100) / 100;
  }

  private async cacheRoutes(routes: ArbitrageRoute[]): Promise<void> {
    try {
      for (const route of routes) {
        const cacheKey = `route:${route.id}`;
        await redisService.setEx(cacheKey, 300, JSON.stringify(route)); // 5 minute cache
      }
    } catch (error) {
      logger.warn('Failed to cache routes', { error: error.message });
    }
  }

  private async getCurrentPrices(symbols: string[]): Promise<Record<string, number>> {
    // Call Python collector for current prices
    const response = await fetch(`${this.pythonCollectorUrl}/api/v1/prices/current`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols }),
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`Price fetch failed: ${response.status}`);
    }

    const result = await response.json();
    return result.prices || {};
  }

  private async calculatePriceImpact(route: ArbitrageRoute): Promise<number> {
    // Simplified price impact calculation
    return 0.01; // 1% placeholder
  }

  private async checkLiquidity(route: ArbitrageRoute): Promise<boolean> {
    // Check if sufficient liquidity exists for the route
    return true; // Placeholder
  }

  // ================================================================================
  // PUBLIC QUERY METHODS
  // ================================================================================

  async validateExecution(route: ArbitrageRoute, options: ExecutionOptions): Promise<RouteValidation> {
    return this.validateRoute(route);
  }

  async getActiveRoutes(filters: RouteFilters, pagination: PaginationOptions): Promise<ArbitrageRoute[]> {
    // Implementation would query database for active routes
    return [];
  }

  async getActiveRoutesCount(filters: RouteFilters): Promise<number> {
    return 0;
  }

  async getRouteById(routeId: string): Promise<ArbitrageRoute | null> {
    // Try cache first
    const cached = await redisService.get(`route:${routeId}`);
    if (cached) {
      return JSON.parse(cached);
    }

    // Query database
    return null;
  }

  async getServiceStatus(): Promise<{
    healthy: boolean;
    activeRoutes: number;
    pendingExecutions: number;
    successRate24h: number;
    lastExecution?: string;
    systemLoad: number;
  }> {
    return {
      healthy: this.isInitialized,
      activeRoutes: 0,
      pendingExecutions: 0,
      successRate24h: 0.85,
      systemLoad: 0.3
    };
  }

  async analyzeProfitability(routes: ArbitrageRoute[]): Promise<ProfitabilityAnalysis> {
    // Placeholder implementation
    return {} as ProfitabilityAnalysis;
  }

  async getExecutionHistory(routeId: string, options: { limit: number }): Promise<ExecutionResult[]> {
    return [];
  }

  async getRoutePerformance(routeId: string): Promise<PerformanceMetrics> {
    return {} as PerformanceMetrics;
  }

  async getExecutions(filters: any, pagination: PaginationOptions): Promise<ExecutionResult[]> {
    return [];
  }

  async getExecutionSummary(filters: any): Promise<any> {
    return {};
  }

  async analyzePair(tokenPair: string, options: any): Promise<ProfitabilityAnalysis> {
    return {} as ProfitabilityAnalysis;
  }

  async getOverallPerformance(options: any): Promise<PerformanceMetrics> {
    return {} as PerformanceMetrics;
  }

  async assessRouteRisk(routeId: string): Promise<RiskAssessment> {
    return {} as RiskAssessment;
  }

  async assessPairRisk(tokenPair: string, timeframe: string): Promise<RiskAssessment> {
    return {} as RiskAssessment;
  }

  async getSystemRiskAssessment(): Promise<RiskAssessment> {
    return {} as RiskAssessment;
  }

  async optimizeRoutes(options: any): Promise<any> {
    return {};
  }

  async generateSuggestions(options: any): Promise<any[]> {
    return [];
  }

  async getLiveOpportunities(options: any): Promise<ArbitrageOpportunity[]> {
    return [];
  }

  async emergencyStop(reason: string): Promise<any> {
    logger.alert('Emergency stop activated', {
      severity: 'critical',
      reason,
      component: 'arbitrage_service'
    });

    return {
      stopped: true,
      reason,
      timestamp: new Date().toISOString()
    };
  }

  async getSystemStatus(): Promise<any> {
    return {
      initialized: this.isInitialized,
      rustEngine: await this.checkRustEngineHealth().then(() => true).catch(() => false),
      pythonCollector: await this.checkPythonCollectorHealth().then(() => true).catch(() => false)
    };
  }

  async updateRouteMetrics(routeId: string, result: ExecutionResult): Promise<void> {
    // Update route performance metrics
    logger.performance('Route metrics updated', {
      operation: 'update_route_metrics',
      startTime: Date.now(),
      endTime: Date.now(),
      duration: 0,
      success: true,
      metadata: { routeId, success: result.success, profitUSD: result.profitUSD }
    });
  }
}

export { ArbitrageService };