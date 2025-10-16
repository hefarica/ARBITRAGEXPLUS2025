/**
 * ARBITRAGEXPLUS2025 - Prices Controller
 * 
 * Controlador para endpoints de precios de activos DeFi.
 * Maneja consultas de precios en tiempo real, históricos, comparaciones
 * entre DEXes y análisis de liquidez.
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '@logger';
import { PriceService } from '@services/priceService';
import { SheetsService } from '@services/sheetsService';
import { RedisService } from '@services/redisService';
import { ValidationError, BusinessError } from '@errors';
import { 
  PriceData, 
  PriceComparison, 
  LiquidityAnalysis,
  PriceAlert,
  MarketDepth,
  OHLCVData 
} from '@types';

// ==================================================================================
// VALIDATION SCHEMAS
// ==================================================================================

const PriceQuerySchema = z.object({
  symbol: z.string().min(2).max(10).toUpperCase(),
  chain: z.number().int().positive().optional(),
  dex: z.string().optional(),
  includeMetadata: z.boolean().default(false)
});

const MultiplePricesSchema = z.object({
  symbols: z.array(z.string().min(2).max(10)).min(1).max(50),
  chain: z.number().int().positive().optional(),
  includeLiquidity: z.boolean().default(false),
  includeVolume: z.boolean().default(false)
});

const HistoricalPricesSchema = z.object({
  symbol: z.string().min(2).max(10).toUpperCase(),
  timeframe: z.enum(['1m', '5m', '15m', '1h', '4h', '1d', '1w']).default('1h'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  chain: z.number().int().positive().optional()
});

const PriceComparisonSchema = z.object({
  symbol: z.string().min(2).max(10).toUpperCase(),
  chains: z.array(z.number().int().positive()).min(2).max(10),
  dexes: z.array(z.string()).min(2).max(20).optional(),
  includeArbitrageOpportunities: z.boolean().default(true)
});

const LiquidityAnalysisSchema = z.object({
  symbol: z.string().min(2).max(10).toUpperCase(),
  chain: z.number().int().positive(),
  dex: z.string().optional(),
  tradeSize: z.string().regex(/^\d+(\.\d+)?$/).default('1000'), // USD
  slippageTolerance: z.number().min(0).max(0.1).default(0.005)
});

const PriceAlertSchema = z.object({
  symbol: z.string().min(2).max(10).toUpperCase(),
  condition: z.enum(['above', 'below', 'change_percent']),
  value: z.number().positive(),
  chain: z.number().int().positive().optional(),
  webhook: z.string().url().optional(),
  email: z.string().email().optional()
});

// ==================================================================================
// PRICES CONTROLLER CLASS
// ==================================================================================

export class PricesController {
  private priceService: PriceService;
  private sheetsService: SheetsService;
  private redisService: RedisService;

  constructor() {
    this.priceService = new PriceService();
    this.sheetsService = new SheetsService();
    this.redisService = new RedisService();
  }

  // ================================================================================
  // REAL-TIME PRICE ENDPOINTS
  // ================================================================================

  /**
   * Get current price for a single token
   * GET /api/v1/prices/:symbol
   */
  getCurrentPrice = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { symbol } = req.params;
      const validatedQuery = PriceQuerySchema.parse({
        symbol,
        ...req.query
      });

      logger.debug('Fetching current price', {
        symbol: validatedQuery.symbol,
        chain: validatedQuery.chain,
        dex: validatedQuery.dex
      });

      // Check cache first
      const cacheKey = `price:${validatedQuery.symbol}:${validatedQuery.chain || 'all'}:${validatedQuery.dex || 'all'}`;
      const cachedPrice = await this.redisService.get(cacheKey);

      if (cachedPrice) {
        logger.debug('Price found in cache', { symbol: validatedQuery.symbol });
        
        res.status(200).json({
          success: true,
          data: {
            price: JSON.parse(cachedPrice),
            source: 'cache',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Fetch from price service
      const priceData = await this.priceService.getCurrentPrice({
        symbol: validatedQuery.symbol,
        chainId: validatedQuery.chain,
        dexId: validatedQuery.dex,
        includeMetadata: validatedQuery.includeMetadata
      });

      if (!priceData) {
        res.status(404).json({
          success: false,
          error: 'Price not found',
          message: `No price data available for ${validatedQuery.symbol}`
        });
        return;
      }

      // Cache the result for 10 seconds
      await this.redisService.setEx(cacheKey, 10, JSON.stringify(priceData));

      res.status(200).json({
        success: true,
        data: {
          price: priceData,
          source: 'live',
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current prices for multiple tokens
   * POST /api/v1/prices/batch
   */
  getMultiplePrices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = MultiplePricesSchema.parse(req.body);

      logger.debug('Fetching multiple prices', {
        symbolCount: validatedData.symbols.length,
        symbols: validatedData.symbols,
        chain: validatedData.chain
      });

      // Fetch prices in parallel
      const pricePromises = validatedData.symbols.map(symbol =>
        this.priceService.getCurrentPrice({
          symbol,
          chainId: validatedData.chain,
          includeLiquidity: validatedData.includeLiquidity,
          includeVolume: validatedData.includeVolume
        })
      );

      const priceResults = await Promise.allSettled(pricePromises);

      const prices: Record<string, PriceData | null> = {};
      const errors: string[] = [];

      validatedData.symbols.forEach((symbol, index) => {
        const result = priceResults[index];
        
        if (result.status === 'fulfilled') {
          prices[symbol] = result.value;
        } else {
          prices[symbol] = null;
          errors.push(`${symbol}: ${result.reason?.message || 'Unknown error'}`);
        }
      });

      const successCount = Object.values(prices).filter(p => p !== null).length;

      res.status(200).json({
        success: successCount > 0,
        data: {
          prices,
          summary: {
            requested: validatedData.symbols.length,
            successful: successCount,
            failed: validatedData.symbols.length - successCount
          },
          errors: errors.length > 0 ? errors : undefined,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // HISTORICAL DATA ENDPOINTS
  // ================================================================================

  /**
   * Get historical price data
   * GET /api/v1/prices/:symbol/history
   */
  getHistoricalPrices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { symbol } = req.params;
      const validatedQuery = HistoricalPricesSchema.parse({
        symbol,
        ...req.query
      });

      logger.debug('Fetching historical prices', {
        symbol: validatedQuery.symbol,
        timeframe: validatedQuery.timeframe,
        limit: validatedQuery.limit
      });

      const historicalData = await this.priceService.getHistoricalPrices({
        symbol: validatedQuery.symbol,
        timeframe: validatedQuery.timeframe,
        from: validatedQuery.from ? new Date(validatedQuery.from) : undefined,
        to: validatedQuery.to ? new Date(validatedQuery.to) : undefined,
        limit: validatedData.limit,
        chainId: validatedQuery.chain
      });

      if (!historicalData || historicalData.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No historical data found',
          message: `No historical data available for ${validatedQuery.symbol} with the specified parameters`
        });
        return;
      }

      // Calculate basic statistics
      const prices = historicalData.map(d => d.price);
      const volumes = historicalData.map(d => d.volume || 0);

      const statistics = {
        count: historicalData.length,
        price: {
          min: Math.min(...prices),
          max: Math.max(...prices),
          avg: prices.reduce((sum, p) => sum + p, 0) / prices.length,
          first: prices[0],
          last: prices[prices.length - 1],
          change: prices[prices.length - 1] - prices[0],
          changePercent: ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
        },
        volume: {
          total: volumes.reduce((sum, v) => sum + v, 0),
          avg: volumes.reduce((sum, v) => sum + v, 0) / volumes.length,
          max: Math.max(...volumes)
        }
      };

      res.status(200).json({
        success: true,
        data: {
          symbol: validatedQuery.symbol,
          timeframe: validatedQuery.timeframe,
          data: historicalData,
          statistics,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get OHLCV candlestick data
   * GET /api/v1/prices/:symbol/candles
   */
  getCandlestickData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { symbol } = req.params;
      const {
        timeframe = '1h',
        limit = '100',
        chain,
        dex
      } = req.query;

      const candleData = await this.priceService.getCandlestickData({
        symbol: symbol.toUpperCase(),
        timeframe: timeframe as string,
        limit: parseInt(limit as string),
        chainId: chain ? parseInt(chain as string) : undefined,
        dexId: dex as string | undefined
      });

      res.status(200).json({
        success: true,
        data: {
          symbol,
          timeframe,
          candles: candleData,
          count: candleData.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // PRICE COMPARISON ENDPOINTS
  // ================================================================================

  /**
   * Compare prices across chains and DEXes
   * POST /api/v1/prices/compare
   */
  comparePrices = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = PriceComparisonSchema.parse(req.body);

      logger.debug('Comparing prices across chains', {
        symbol: validatedData.symbol,
        chains: validatedData.chains,
        dexes: validatedData.dexes
      });

      const comparison = await this.priceService.comparePricesAcrossChains({
        symbol: validatedData.symbol,
        chainIds: validatedData.chains,
        dexIds: validatedData.dexes,
        includeArbitrageOpportunities: validatedData.includeArbitrageOpportunities
      });

      res.status(200).json({
        success: true,
        data: {
          symbol: validatedData.symbol,
          comparison,
          arbitrageOpportunities: validatedData.includeArbitrageOpportunities ? 
            comparison.arbitrageOpportunities : undefined,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get price spreads between DEXes
   * GET /api/v1/prices/:symbol/spreads
   */
  getPriceSpreads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { symbol } = req.params;
      const { chain, minSpread = '0.1' } = req.query;

      const spreads = await this.priceService.getPriceSpreads({
        symbol: symbol.toUpperCase(),
        chainId: chain ? parseInt(chain as string) : undefined,
        minSpreadPercent: parseFloat(minSpread as string)
      });

      res.status(200).json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          spreads,
          minSpreadPercent: parseFloat(minSpread as string),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // LIQUIDITY ANALYSIS ENDPOINTS
  // ================================================================================

  /**
   * Analyze liquidity and market depth
   * POST /api/v1/prices/liquidity
   */
  analyzeLiquidity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = LiquidityAnalysisSchema.parse(req.body);

      logger.debug('Analyzing liquidity', {
        symbol: validatedData.symbol,
        chain: validatedData.chain,
        tradeSize: validatedData.tradeSize
      });

      const analysis = await this.priceService.analyzeLiquidity({
        symbol: validatedData.symbol,
        chainId: validatedData.chain,
        dexId: validatedData.dex,
        tradeSizeUSD: parseFloat(validatedData.tradeSize),
        slippageTolerance: validatedData.slippageTolerance
      });

      res.status(200).json({
        success: true,
        data: {
          symbol: validatedData.symbol,
          analysis,
          parameters: {
            tradeSize: validatedData.tradeSize,
            slippageTolerance: validatedData.slippageTolerance
          },
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get market depth data
   * GET /api/v1/prices/:symbol/depth
   */
  getMarketDepth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { symbol } = req.params;
      const { chain, dex, depth = '20' } = req.query;

      const marketDepth = await this.priceService.getMarketDepth({
        symbol: symbol.toUpperCase(),
        chainId: chain ? parseInt(chain as string) : undefined,
        dexId: dex as string | undefined,
        depthLevels: parseInt(depth as string)
      });

      res.status(200).json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          marketDepth,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // PRICE ALERTS ENDPOINTS
  // ================================================================================

  /**
   * Create price alert
   * POST /api/v1/prices/alerts
   */
  createPriceAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedData = PriceAlertSchema.parse(req.body);

      logger.info('Creating price alert', {
        symbol: validatedData.symbol,
        condition: validatedData.condition,
        value: validatedData.value
      });

      const alert = await this.priceService.createPriceAlert({
        symbol: validatedData.symbol,
        condition: validatedData.condition,
        value: validatedData.value,
        chainId: validatedData.chain,
        webhook: validatedData.webhook,
        email: validatedData.email,
        userId: req.user?.id // Assuming auth middleware provides user
      });

      // Record alert in Google Sheets
      await this.sheetsService.recordAlert({
        type: 'price_alert_created',
        symbol: validatedData.symbol,
        condition: `${validatedData.condition} ${validatedData.value}`,
        timestamp: new Date().toISOString(),
        data: alert
      });

      res.status(201).json({
        success: true,
        message: 'Price alert created successfully',
        data: { alert }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get active price alerts
   * GET /api/v1/prices/alerts
   */
  getPriceAlerts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { symbol, status = 'active' } = req.query;
      const userId = req.user?.id; // From auth middleware

      const alerts = await this.priceService.getPriceAlerts({
        userId,
        symbol: symbol as string | undefined,
        status: status as 'active' | 'triggered' | 'expired'
      });

      res.status(200).json({
        success: true,
        data: {
          alerts,
          count: alerts.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete price alert
   * DELETE /api/v1/prices/alerts/:alertId
   */
  deletePriceAlert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { alertId } = req.params;
      const userId = req.user?.id;

      if (!z.string().uuid().safeParse(alertId).success) {
        throw new ValidationError('Invalid alert ID format');
      }

      const deleted = await this.priceService.deletePriceAlert(alertId, userId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Alert not found',
          message: `Alert with ID ${alertId} not found or not owned by user`
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Price alert deleted successfully',
        data: { alertId }
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // MARKET DATA ENDPOINTS
  // ================================================================================

  /**
   * Get top tokens by volume/market cap
   * GET /api/v1/prices/top
   */
  getTopTokens = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const {
        sortBy = 'volume24h',
        chain,
        limit = '50',
        category = 'all'
      } = req.query;

      const topTokens = await this.priceService.getTopTokens({
        sortBy: sortBy as 'volume24h' | 'marketCap' | 'priceChange24h',
        chainId: chain ? parseInt(chain as string) : undefined,
        limit: parseInt(limit as string),
        category: category as string
      });

      res.status(200).json({
        success: true,
        data: {
          tokens: topTokens,
          sortBy,
          limit: parseInt(limit as string),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get market summary
   * GET /api/v1/prices/market-summary
   */
  getMarketSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { chain } = req.query;

      const summary = await this.priceService.getMarketSummary({
        chainId: chain ? parseInt(chain as string) : undefined
      });

      res.status(200).json({
        success: true,
        data: {
          summary,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // UTILITY ENDPOINTS
  // ================================================================================

  /**
   * Search tokens by name or symbol
   * GET /api/v1/prices/search
   */
  searchTokens = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { q, chain, limit = '20' } = req.query;

      if (!q || (q as string).length < 2) {
        throw new ValidationError('Search query must be at least 2 characters long');
      }

      const results = await this.priceService.searchTokens({
        query: q as string,
        chainId: chain ? parseInt(chain as string) : undefined,
        limit: parseInt(limit as string)
      });

      res.status(200).json({
        success: true,
        data: {
          query: q,
          results,
          count: results.length,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };

  /**
   * Get supported chains and tokens
   * GET /api/v1/prices/supported
   */
  getSupportedAssets = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const supported = await this.priceService.getSupportedAssets();

      res.status(200).json({
        success: true,
        data: {
          supported,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      next(error);
    }
  };
}

export const pricesController = new PricesController();