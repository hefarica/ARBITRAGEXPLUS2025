/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/server.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   FUENTE: Google Sheets - ASSETS, BLOCKCHAINS, DEXES, CONFIG, POOLS
 *     - Formato: JSON array
 *     - Frecuencia: Tiempo real / Polling
 *   DEPENDENCIAS: ./config/database, ./lib/logger, @fastify/helmet
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: ArbitrageApiServer
 *   INTERFACES: PriceStreamData, ExecutionRequest, ArbitrageRoute
 * 
 * 📤 SALIDA DE DATOS:
 *   DESTINO: Google Sheets (actualización)
 * 
 * 🔗 DEPENDENCIAS:
 *   - ./config/database
 *   - ./lib/logger
 *   - @fastify/helmet
 * 
 * ============================================================================
 */

import fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';

// Importar servicios dinámicos
import { SheetsService } from './services/sheetsService';
import { ArbitrageService } from './services/arbitrageService';
import { WebSocketManager } from './adapters/ws/websocketManager';
import { PythOracle } from './oracles/pyth';
import { ChainlinkOracle } from './oracles/chainlink';
import { FlashExecutor } from './exec/flash';

// Importar configuración dinámica
import { DatabaseConfig } from './config/database';
import { RedisConfig } from './config/redis';
import { Logger } from './lib/logger';
import { ApiError, handleError } from './lib/errors';

// Tipos dinámicos basados en Google Sheets
interface ArbitrageRoute {
  route_id: string;
  source_token: string;
  target_token: string;
  dex_path: string[];
  expected_output: number;
  net_profit_usd: number;
  roi_percentage: number;
  gas_cost_usd: number;
  execution_time: number;
}

interface ExecutionRequest {
  route_id: string;
  input_amount: number;
  max_slippage: number;
  dry_run?: boolean;
}

interface PriceStreamData {
  symbol: string;
  price_usd: number;
  timestamp: number;
  source: 'pyth' | 'chainlink' | 'dex';
  confidence: number;
}

/**
 * ARBITRAGEXPLUS2025 - API Server Principal
 * 
 * Servidor Fastify que funciona como cerebro central del sistema:
 * - Recibe configuración dinámica desde Google Sheets
 * - Expone endpoints para interacción con el sistema
 * - Maneja WebSockets para datos en tiempo real
 * - Orquesta ejecución de operaciones de arbitraje
 * - Integra con oráculos Pyth y Chainlink
 * - Todos los datos provienen de arrays dinámicos (NO hardcoding)
 */
class ArbitrageApiServer {
  private app: FastifyInstance;
  private sheetsService: SheetsService;
  private arbitrageService: ArbitrageService;
  private wsManager: WebSocketManager;
  private pythOracle: PythOracle;
  private chainlinkOracle: ChainlinkOracle;
  private flashExecutor: FlashExecutor;
  private logger: Logger;
  
  // Estados dinámicos cargados desde Google Sheets
  private blockchains: any[] = [];
  private dexes: any[] = [];
  private assets: any[] = [];
  private pools: any[] = [];
  private systemConfig: Map<string, any> = new Map();

  constructor() {
    this.app = fastify({
      logger: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
      }
    }).withTypeProvider<TypeBoxTypeProvider>();
    
    this.logger = new Logger('ArbitrageApiServer');
    this.initializeServices();
  }

  /**
   * Inicializar todos los servicios dinámicamente
   */
  private async initializeServices(): Promise<void> {
    try {
      this.logger.info('🚀 Inicializando servicios dinámicamente...');
      
      // 1. Configurar conexión a Google Sheets (fuente de verdad)
      this.sheetsService = new SheetsService();
      await this.sheetsService.initialize();
      
      // 2. Cargar configuración inicial desde Sheets
      await this.loadDynamicConfiguration();
      
      // 3. Inicializar servicios basados en configuración
      this.arbitrageService = new ArbitrageService(this.systemConfig);
      this.wsManager = new WebSocketManager(this.dexes);
      this.pythOracle = new PythOracle(this.assets);
      this.chainlinkOracle = new ChainlinkOracle(this.assets);
      this.flashExecutor = new FlashExecutor(this.blockchains, this.dexes);
      
      // 4. Configurar servidor Fastify
      await this.setupFastify();
      
      // 5. Iniciar monitoreo automático
      this.startAutomaticUpdates();
      
      this.logger.info('✅ Todos los servicios inicializados correctamente');
      
    } catch (error) {
      this.logger.error('❌ Error inicializando servicios:', error);
      throw error;
    }
  }

  /**
   * Cargar configuración dinámica desde Google Sheets
   * TODO: Toda la configuración debe provenir de las 8 hojas de Sheets
   */
  private async loadDynamicConfiguration(): Promise<void> {
    try {
      this.logger.info('📊 Cargando configuración desde Google Sheets...');
      
      // Cargar datos de cada hoja dinámicamente
      this.blockchains = await this.sheetsService.getSheetData('BLOCKCHAINS');
      this.dexes = await this.sheetsService.getSheetData('DEXES');
      this.assets = await this.sheetsService.getSheetData('ASSETS');
      this.pools = await this.sheetsService.getSheetData('POOLS');
      
      // Cargar configuración del sistema
      const configRows = await this.sheetsService.getSheetData('CONFIG');
      configRows.forEach((row: any) => {
        if (row.CONFIG_KEY && row.CONFIG_VALUE) {
          this.systemConfig.set(row.CONFIG_KEY, {
            value: row.CONFIG_VALUE,
            type: row.CONFIG_TYPE || 'string',
            isActive: row.IS_ACTIVE !== false
          });
        }
      });
      
      // Validar que tenemos datos mínimos
      if (this.blockchains.length === 0) {
        throw new ApiError('No hay blockchains configuradas en Google Sheets', 500);
      }
      
      if (this.dexes.length === 0) {
        throw new ApiError('No hay DEXes configurados en Google Sheets', 500);
      }
      
      this.logger.info(`📈 Configuración cargada: ${this.blockchains.length} chains, ${this.dexes.length} DEXes, ${this.assets.length} assets`);
      
    } catch (error) {
      this.logger.error('❌ Error cargando configuración:', error);
      throw error;
    }
  }

  /**
   * Configurar Fastify con middlewares y rutas
   */
  private async setupFastify(): Promise<void> {
    // Registrar plugins de seguridad y utilidades
    await this.app.register(helmet, {
      contentSecurityPolicy: false
    });

    await this.app.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    });

    await this.app.register(rateLimit, {
      max: parseInt(this.systemConfig.get('API_RATE_LIMIT')?.value || '1000'),
      timeWindow: '15 minutes'
    });

    // Configurar manejo de errores global
    this.app.setErrorHandler(handleError);

    // Registrar rutas dinámicas
    this.registerRoutes();
    
    // Configurar WebSocket para streaming de precios
    this.setupWebSocket();
  }

  /**
   * Registrar todas las rutas del API
   */
  private registerRoutes(): void {
    // ==================================================================================
    // HEALTH CHECK Y SISTEMA
    // ==================================================================================
    
    this.app.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          sheets: await this.sheetsService.isHealthy(),
          database: await DatabaseConfig.isHealthy(),
          redis: await RedisConfig.isHealthy(),
          pyth: await this.pythOracle.isHealthy(),
          chainlink: await this.chainlinkOracle.isHealthy()
        },
        configuration: {
          blockchains: this.blockchains.length,
          dexes: this.dexes.length,
          assets: this.assets.length,
          pools: this.pools.length
        }
      };
      
      const isHealthy = Object.values(health.services).every(status => status);
      reply.code(isHealthy ? 200 : 503).send(health);
    });

    this.app.get('/status', async (request: FastifyRequest, reply: FastifyReply) => {
      const activeRoutes = await this.arbitrageService.getActiveRoutesCount();
      const systemMetrics = await this.arbitrageService.getSystemMetrics();
      
      reply.send({
        system: 'ARBITRAGEXPLUS2025',
        status: 'operational',
        metrics: systemMetrics,
        active_routes: activeRoutes,
        configuration_source: 'google_sheets_dynamic',
        last_updated: new Date().toISOString()
      });
    });

    // ==================================================================================
    // CONFIGURACIÓN DINÁMICA
    // ==================================================================================
    
    this.app.get('/config', {
      schema: {
        response: {
          200: Type.Object({
            blockchains: Type.Array(Type.Any()),
            dexes: Type.Array(Type.Any()),
            assets: Type.Array(Type.Any()),
            system_config: Type.Object({})
          })
        }
      }
    }, async (request: FastifyRequest, reply: FastifyReply) => {
      reply.send({
        blockchains: this.blockchains,
        dexes: this.dexes,
        assets: this.assets.slice(0, 50), // Limitar para respuesta más rápida
        system_config: Object.fromEntries(this.systemConfig)
      });
    });

    this.app.post('/config/reload', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        await this.loadDynamicConfiguration();
        
        // Reinicializar servicios que dependen de configuración
        await this.wsManager.updateDexConfiguration(this.dexes);
        await this.pythOracle.updateAssetConfiguration(this.assets);
        
        this.logger.info('🔄 Configuración recargada exitosamente');
        reply.send({ success: true, message: 'Configuration reloaded' });
        
      } catch (error) {
        this.logger.error('❌ Error recargando configuración:', error);
        throw new ApiError('Failed to reload configuration', 500);
      }
    });

    // ==================================================================================
    // PRECIOS EN TIEMPO REAL
    // ==================================================================================
    
    this.app.get('/prices/current', {
      schema: {
        querystring: Type.Object({
          symbols: Type.Optional(Type.String()),
          source: Type.Optional(Type.String())
        }),
        response: {
          200: Type.Array(Type.Object({
            symbol: Type.String(),
            price_usd: Type.Number(),
            timestamp: Type.Number(),
            source: Type.String(),
            confidence: Type.Number()
          }))
        }
      }
    }, async (request: FastifyRequest<{ Querystring: { symbols?: string; source?: string } }>, reply: FastifyReply) => {
      const { symbols, source } = request.query;
      
      try {
        let prices: PriceStreamData[] = [];
        
        if (source === 'pyth') {
          prices = await this.pythOracle.getCurrentPrices(symbols?.split(','));
        } else if (source === 'chainlink') {
          prices = await this.chainlinkOracle.getCurrentPrices(symbols?.split(','));
        } else {
          // Combinar precios de ambas fuentes
          const pythPrices = await this.pythOracle.getCurrentPrices(symbols?.split(','));
          const chainlinkPrices = await this.chainlinkOracle.getCurrentPrices(symbols?.split(','));
          prices = [...pythPrices, ...chainlinkPrices];
        }
        
        reply.send(prices);
        
      } catch (error) {
        this.logger.error('❌ Error obteniendo precios:', error);
        throw new ApiError('Failed to fetch current prices', 500);
      }
    });

    // ==================================================================================
    // RUTAS DE ARBITRAJE
    // ==================================================================================
    
    this.app.get('/routes/best', {
      schema: {
        querystring: Type.Object({
          min_profit: Type.Optional(Type.Number()),
          max_routes: Type.Optional(Type.Number()),
          token_pair: Type.Optional(Type.String())
        }),
        response: {
          200: Type.Array(Type.Object({
            route_id: Type.String(),
            source_token: Type.String(),
            target_token: Type.String(),
            dex_path: Type.Array(Type.String()),
            expected_output: Type.Number(),
            net_profit_usd: Type.Number(),
            roi_percentage: Type.Number(),
            gas_cost_usd: Type.Number(),
            execution_time: Type.Number()
          }))
        }
      }
    }, async (request: FastifyRequest<{ Querystring: { min_profit?: number; max_routes?: number; token_pair?: string } }>, reply: FastifyReply) => {
      const { min_profit, max_routes = 20, token_pair } = request.query;
      
      try {
        const routes = await this.arbitrageService.getBestRoutes({
          minProfitUsd: min_profit || parseFloat(this.systemConfig.get('MIN_PROFIT_USD')?.value || '10'),
          maxRoutes: max_routes,
          tokenPair: token_pair
        });
        
        reply.send(routes);
        
      } catch (error) {
        this.logger.error('❌ Error obteniendo mejores rutas:', error);
        throw new ApiError('Failed to fetch best routes', 500);
      }
    });

    this.app.get('/routes/simulate/:route_id', {
      schema: {
        params: Type.Object({
          route_id: Type.String()
        }),
        querystring: Type.Object({
          input_amount: Type.Number(),
          max_slippage: Type.Optional(Type.Number())
        })
      }
    }, async (request: FastifyRequest<{ Params: { route_id: string }; Querystring: { input_amount: number; max_slippage?: number } }>, reply: FastifyReply) => {
      const { route_id } = request.params;
      const { input_amount, max_slippage } = request.query;
      
      try {
        const simulation = await this.arbitrageService.simulateRoute(route_id, {
          inputAmount: input_amount,
          maxSlippage: max_slippage || parseFloat(this.systemConfig.get('MAX_SLIPPAGE')?.value || '0.005')
        });
        
        reply.send(simulation);
        
      } catch (error) {
        this.logger.error('❌ Error simulando ruta:', error);
        throw new ApiError('Failed to simulate route', 500);
      }
    });

    // ==================================================================================
    // EJECUCIÓN DE OPERACIONES
    // ==================================================================================
    
    this.app.post('/execute/flash', {
      schema: {
        body: Type.Object({
          route_id: Type.String(),
          input_amount: Type.Number(),
          max_slippage: Type.Optional(Type.Number()),
          dry_run: Type.Optional(Type.Boolean())
        }),
        response: {
          200: Type.Object({
            execution_id: Type.String(),
            status: Type.String(),
            transaction_hash: Type.Optional(Type.String()),
            estimated_profit: Type.Number(),
            actual_profit: Type.Optional(Type.Number()),
            gas_used: Type.Optional(Type.Number()),
            execution_time: Type.Number()
          })
        }
      }
    }, async (request: FastifyRequest<{ Body: ExecutionRequest }>, reply: FastifyReply) => {
      const executionRequest = request.body;
      
      try {
        // Validar ruta antes de ejecutar
        const route = await this.arbitrageService.getRoute(executionRequest.route_id);
        if (!route) {
          throw new ApiError(`Route ${executionRequest.route_id} not found`, 404);
        }
        
        // Validar precios con Pyth antes de ejecutar
        const priceValidation = await this.pythOracle.validateRoutePrice(route);
        if (!priceValidation.isValid) {
          throw new ApiError(`Price validation failed: ${priceValidation.reason}`, 400);
        }
        
        // Ejecutar flash loan
        const execution = await this.flashExecutor.execute({
          route: route,
          inputAmount: executionRequest.input_amount,
          maxSlippage: executionRequest.max_slippage || parseFloat(this.systemConfig.get('MAX_SLIPPAGE')?.value || '0.005'),
          dryRun: executionRequest.dry_run || false
        });
        
        // Registrar ejecución en Google Sheets
        await this.sheetsService.recordExecution(execution);
        
        reply.send(execution);
        
      } catch (error) {
        this.logger.error('❌ Error ejecutando flash loan:', error);
        
        if (error instanceof ApiError) {
          throw error;
        }
        
        throw new ApiError('Flash loan execution failed', 500);
      }
    });

    // ==================================================================================
    // HISTORIAL Y MÉTRICAS
    // ==================================================================================
    
    this.app.get('/executions', {
      schema: {
        querystring: Type.Object({
          limit: Type.Optional(Type.Number()),
          offset: Type.Optional(Type.Number()),
          status: Type.Optional(Type.String()),
          date_from: Type.Optional(Type.String()),
          date_to: Type.Optional(Type.String())
        })
      }
    }, async (request: FastifyRequest<{ Querystring: { limit?: number; offset?: number; status?: string; date_from?: string; date_to?: string } }>, reply: FastifyReply) => {
      const { limit = 50, offset = 0, status, date_from, date_to } = request.query;
      
      try {
        const executions = await this.sheetsService.getExecutions({
          limit,
          offset,
          status,
          dateFrom: date_from ? new Date(date_from) : undefined,
          dateTo: date_to ? new Date(date_to) : undefined
        });
        
        reply.send(executions);
        
      } catch (error) {
        this.logger.error('❌ Error obteniendo historial:', error);
        throw new ApiError('Failed to fetch execution history', 500);
      }
    });

    this.app.get('/metrics/performance', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const metrics = await this.arbitrageService.getPerformanceMetrics();
        reply.send(metrics);
        
      } catch (error) {
        this.logger.error('❌ Error obteniendo métricas:', error);
        throw new ApiError('Failed to fetch performance metrics', 500);
      }
    });
  }

  /**
   * Configurar WebSocket para streaming de precios
   */
  private setupWebSocket(): void {
    this.app.register(async function (fastify) {
      await fastify.register(require('@fastify/websocket'));
      
      fastify.get('/prices/stream', { websocket: true }, (connection, request) => {
        connection.socket.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            
            if (data.action === 'subscribe') {
              // Suscribirse a precios de tokens específicos
              const symbols = data.symbols || [];
              // TODO: Implementar suscripción dinámica basada en assets de Sheets
              connection.socket.send(JSON.stringify({
                type: 'subscribed',
                symbols: symbols,
                timestamp: Date.now()
              }));
            }
            
          } catch (error) {
            connection.socket.send(JSON.stringify({
              type: 'error',
              message: 'Invalid message format'
            }));
          }
        });
        
        // Enviar precios cada 5 segundos
        const priceInterval = setInterval(async () => {
          try {
            const prices = await this.pythOracle.getCurrentPrices();
            connection.socket.send(JSON.stringify({
              type: 'price_update',
              data: prices,
              timestamp: Date.now()
            }));
          } catch (error) {
            // Manejar errores de streaming silenciosamente
          }
        }, 5000);
        
        connection.socket.on('close', () => {
          clearInterval(priceInterval);
        });
      });
    });
  }

  /**
   * Iniciar actualizaciones automáticas desde Google Sheets
   */
  private startAutomaticUpdates(): void {
    const updateInterval = parseInt(this.systemConfig.get('UPDATE_INTERVAL')?.value || '30') * 1000;
    
    setInterval(async () => {
      try {
        // Recargar configuración desde Sheets automáticamente
        const oldDexCount = this.dexes.length;
        await this.loadDynamicConfiguration();
        
        if (this.dexes.length !== oldDexCount) {
          this.logger.info(`🔄 Configuración actualizada: ${this.dexes.length} DEXes (antes: ${oldDexCount})`);
          
          // Actualizar servicios que dependen de configuración
          await this.wsManager.updateDexConfiguration(this.dexes);
          await this.pythOracle.updateAssetConfiguration(this.assets);
        }
        
      } catch (error) {
        this.logger.error('❌ Error en actualización automática:', error);
      }
    }, updateInterval);
    
    this.logger.info(`⏰ Actualizaciones automáticas configuradas cada ${updateInterval / 1000}s`);
  }

  /**
   * Iniciar servidor
   */
  public async start(): Promise<void> {
    try {
      const port = parseInt(process.env.PORT || '3000');
      const host = process.env.HOST || '0.0.0.0';
      
      await this.app.listen({ port, host });
      
      const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
      const wsProtocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
      
      this.logger.info(`🚀 ARBITRAGEXPLUS2025 API Server listening on ${host}:${port}`);
      this.logger.info(`📊 Configuración cargada desde Google Sheets`);
      this.logger.info(`🔗 WebSocket disponible en ${wsProtocol}://${host}:${port}/prices/stream`);
      this.logger.info(`🏥 Health check: ${protocol}://${host}:${port}/health`);
      
    } catch (error) {
      this.logger.error('❌ Error starting server:', error);
      process.exit(1);
    }
  }

  /**
   * Detener servidor gracefully
   */
  public async stop(): Promise<void> {
    try {
      await this.app.close();
      this.logger.info('👋 Server stopped gracefully');
    } catch (error) {
      this.logger.error('❌ Error stopping server:', error);
    }
  }
}

// Manejar señales del sistema para shutdown graceful
const server = new ArbitrageApiServer();

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await server.stop();
  process.exit(0);
});

// Iniciar servidor
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { ArbitrageApiServer };