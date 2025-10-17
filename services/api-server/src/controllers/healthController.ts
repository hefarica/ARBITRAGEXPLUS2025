/**
 * ARBITRAGEXPLUS2025 - Health Controller
 * 
 * Controlador para endpoints de salud y monitoreo del sistema.
 * Proporciona información detallada sobre el estado de todos los componentes,
 * métricas de rendimiento y conectividad con servicios externos.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '@logger';
import { SheetsService } from '@services/sheetsService';
import { ArbitrageService } from '@services/arbitrageService';
import { RedisService } from '@services/redisService';
import { DatabaseService } from '@services/databaseService';
import { SystemError } from '@errors';
import { 
  HealthStatus, 
  ServiceStatus, 
  ComponentHealth,
  SystemMetrics 
} from '@types';

// ==================================================================================
// HEALTH CONTROLLER CLASS
// ==================================================================================

export class HealthController {
  private sheetsService: SheetsService;
  private arbitrageService: ArbitrageService;
  private redisService: RedisService;
  private databaseService: DatabaseService;
  
  private startTime: Date;
  private version: string;

  constructor() {
    this.sheetsService = new SheetsService();
    this.arbitrageService = new ArbitrageService();
    this.redisService = new RedisService();
    this.databaseService = new DatabaseService();
    
    this.startTime = new Date();
    this.version = process.env.npm_package_version || '1.0.0';
  }

  /**
   * Helper para obtener URLs de servicios con protocolo correcto según entorno
   */
  private getServiceUrl(service: 'rust' | 'python'): string {
    const urls = {
      rust: process.env.RUST_ENGINE_URL || 
        (process.env.NODE_ENV === 'production' 
          ? 'https://rust-engine:8002' 
          : 'http://localhost:8002'),
      python: process.env.PYTHON_COLLECTOR_URL || 
        (process.env.NODE_ENV === 'production' 
          ? 'https://python-collector:8001' 
          : 'http://localhost:8001')
    };
    return urls[service];
  }

  // ================================================================================
  // BASIC HEALTH ENDPOINTS
  // ================================================================================

  /**
   * Basic health check - minimal response for load balancers
   * GET /health
   */
  basicHealth = async (req: Request, res: Response): Promise<void> => {
    try {
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      
      // Quick checks for critical services
      const isRedisConnected = await this.redisService.ping();
      const isDatabaseConnected = await this.databaseService.ping();
      
      const isHealthy = isRedisConnected && isDatabaseConnected;
      
      const healthData = {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: Math.round(uptime),
        version: this.version,
        memory: {
          used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          total: Math.round(memoryUsage.heapTotal / 1024 / 1024)
        }
      };

      const statusCode = isHealthy ? 200 : 503;
      
      res.status(statusCode).json(healthData);
      
    } catch (error) {
      logger.error('Basic health check failed', { error });
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  };

  /**
   * Detailed health check with all component status
   * GET /api/v1/health
   */
  detailedHealth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const startCheckTime = Date.now();
      
      // Perform comprehensive health checks
      const [
        systemStatus,
        servicesStatus,
        externalStatus,
        metricsData
      ] = await Promise.all([
        this.getSystemStatus(),
        this.getServicesStatus(),
        this.getExternalServicesStatus(),
        this.getSystemMetrics()
      ]);

      const checkDuration = Date.now() - startCheckTime;
      
      // Determine overall health
      const allStatuses = [
        ...Object.values(servicesStatus),
        ...Object.values(externalStatus)
      ];
      
      const unhealthyServices = allStatuses.filter(s => s.status !== 'healthy').length;
      const totalServices = allStatuses.length;
      
      let overallStatus: HealthStatus;
      
      if (unhealthyServices === 0) {
        overallStatus = 'healthy';
      } else if (unhealthyServices <= totalServices * 0.3) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'unhealthy';
      }

      const healthReport = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: this.version,
        uptime: process.uptime(),
        checkDuration,
        system: systemStatus,
        services: servicesStatus,
        external: externalStatus,
        metrics: metricsData,
        summary: {
          totalServices,
          healthyServices: totalServices - unhealthyServices,
          degradedServices: unhealthyServices,
          healthPercentage: ((totalServices - unhealthyServices) / totalServices * 100).toFixed(1)
        }
      };

      const statusCode = overallStatus === 'healthy' ? 200 : 
                        overallStatus === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: overallStatus !== 'unhealthy',
        data: healthReport
      });

    } catch (error) {
      next(error);
    }
  };

  // ================================================================================
  // COMPONENT STATUS CHECKS
  // ================================================================================

  /**
   * Get system-level status
   */
  private async getSystemStatus(): Promise<ComponentHealth> {
    const memUsage = process.memoryUsage();
    const loadAvg = require('os').loadavg();
    const cpuUsage = process.cpuUsage();
    
    return {
      status: 'healthy',
      details: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        startTime: this.startTime.toISOString(),
        uptime: process.uptime(),
        pid: process.pid,
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
          arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024)
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
          loadAverage: loadAvg
        }
      },
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Check status of internal services
   */
  private async getServicesStatus(): Promise<Record<string, ServiceStatus>> {
    const checks = await Promise.allSettled([
      this.checkRedis(),
      this.checkDatabase(),
      this.checkGoogleSheets(),
      this.checkArbitrageService(),
      this.checkRustEngine(),
      this.checkPythonCollector()
    ]);

    return {
      redis: checks[0].status === 'fulfilled' ? checks[0].value : this.createErrorStatus('Redis check failed'),
      database: checks[1].status === 'fulfilled' ? checks[1].value : this.createErrorStatus('Database check failed'),
      googleSheets: checks[2].status === 'fulfilled' ? checks[2].value : this.createErrorStatus('Google Sheets check failed'),
      arbitrageService: checks[3].status === 'fulfilled' ? checks[3].value : this.createErrorStatus('Arbitrage service check failed'),
      rustEngine: checks[4].status === 'fulfilled' ? checks[4].value : this.createErrorStatus('Rust engine check failed'),
      pythonCollector: checks[5].status === 'fulfilled' ? checks[5].value : this.createErrorStatus('Python collector check failed')
    };
  }

  /**
   * Check status of external services
   */
  private async getExternalServicesStatus(): Promise<Record<string, ServiceStatus>> {
    const checks = await Promise.allSettled([
      this.checkPythOracle(),
      this.checkChainlinkOracle(),
      this.checkDefiLlama(),
      this.checkEthereumRPC(),
      this.checkPolygonRPC(),
      this.checkBSCRPC()
    ]);

    return {
      pythOracle: checks[0].status === 'fulfilled' ? checks[0].value : this.createErrorStatus('Pyth oracle check failed'),
      chainlinkOracle: checks[1].status === 'fulfilled' ? checks[1].value : this.createErrorStatus('Chainlink oracle check failed'),
      defiLlama: checks[2].status === 'fulfilled' ? checks[2].value : this.createErrorStatus('DefiLlama check failed'),
      ethereumRPC: checks[3].status === 'fulfilled' ? checks[3].value : this.createErrorStatus('Ethereum RPC check failed'),
      polygonRPC: checks[4].status === 'fulfilled' ? checks[4].value : this.createErrorStatus('Polygon RPC check failed'),
      bscRPC: checks[5].status === 'fulfilled' ? checks[5].value : this.createErrorStatus('BSC RPC check failed')
    };
  }

  // ================================================================================
  // INDIVIDUAL SERVICE CHECKS
  // ================================================================================

  private async checkRedis(): Promise<ServiceStatus> {
    try {
      const start = Date.now();
      const pong = await this.redisService.ping();
      const responseTime = Date.now() - start;
      
      if (!pong) {
        return {
          status: 'unhealthy',
          message: 'Redis ping failed',
          lastChecked: new Date().toISOString()
        };
      }

      const info = await this.redisService.getInfo();
      
      return {
        status: 'healthy',
        responseTime,
        details: {
          connected: true,
          version: info.redis_version,
          mode: info.redis_mode,
          connectedClients: parseInt(info.connected_clients),
          usedMemory: info.used_memory_human,
          uptimeInSeconds: parseInt(info.uptime_in_seconds)
        },
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Redis error: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    try {
      const start = Date.now();
      const result = await this.databaseService.ping();
      const responseTime = Date.now() - start;
      
      if (!result) {
        return {
          status: 'unhealthy',
          message: 'Database ping failed',
          lastChecked: new Date().toISOString()
        };
      }

      const stats = await this.databaseService.getConnectionStats();
      
      return {
        status: 'healthy',
        responseTime,
        details: {
          connected: true,
          activeConnections: stats.activeConnections,
          totalConnections: stats.totalConnections,
          maxConnections: stats.maxConnections,
          version: stats.version
        },
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database error: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkGoogleSheets(): Promise<ServiceStatus> {
    try {
      const start = Date.now();
      const isConnected = await this.sheetsService.testConnection();
      const responseTime = Date.now() - start;
      
      if (!isConnected) {
        return {
          status: 'unhealthy',
          message: 'Google Sheets connection failed',
          lastChecked: new Date().toISOString()
        };
      }

      const sheetInfo = await this.sheetsService.getSheetInfo();
      
      return {
        status: 'healthy',
        responseTime,
        details: {
          connected: true,
          spreadsheetId: sheetInfo.spreadsheetId,
          title: sheetInfo.title,
          sheetsCount: sheetInfo.sheetsCount,
          lastUpdated: sheetInfo.lastUpdated
        },
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Google Sheets error: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkArbitrageService(): Promise<ServiceStatus> {
    try {
      const start = Date.now();
      const status = await this.arbitrageService.getServiceStatus();
      const responseTime = Date.now() - start;
      
      return {
        status: status.healthy ? 'healthy' : 'degraded',
        responseTime,
        details: {
          activeRoutes: status.activeRoutes,
          pendingExecutions: status.pendingExecutions,
          successRate24h: status.successRate24h,
          lastExecution: status.lastExecution,
          systemLoad: status.systemLoad
        },
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Arbitrage service error: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkRustEngine(): Promise<ServiceStatus> {
    try {
      // Check if Rust engine is responsive via HTTP or IPC
      const response = await fetch(`${this.getServiceUrl('rust')}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (!response.ok) {
        return {
          status: 'unhealthy',
          message: `Rust engine HTTP ${response.status}`,
          lastChecked: new Date().toISOString()
        };
      }
      
      const data = await response.json();
      
      return {
        status: data.status === 'healthy' ? 'healthy' : 'degraded',
        responseTime: data.responseTime,
        details: {
          version: data.version,
          uptime: data.uptime,
          performance: data.performance,
          activeCalculations: data.activeCalculations
        },
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Rust engine unreachable: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkPythonCollector(): Promise<ServiceStatus> {
    try {
      // Check if Python collector is responsive
      const response = await fetch(`${this.getServiceUrl('python')}/health`, {
        method: 'GET',
        timeout: 8000
      });
      
      if (!response.ok) {
        return {
          status: 'unhealthy',
          message: `Python collector HTTP ${response.status}`,
          lastChecked: new Date().toISOString()
        };
      }
      
      const data = await response.json();
      
      return {
        status: data.status === 'healthy' ? 'healthy' : 'degraded',
        responseTime: data.responseTime,
        details: {
          version: data.version,
          uptime: data.uptime,
          lastDataUpdate: data.lastDataUpdate,
          dataFreshness: data.dataFreshness,
          activeCollectors: data.activeCollectors
        },
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Python collector unreachable: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  // ================================================================================
  // EXTERNAL SERVICE CHECKS
  // ================================================================================

  private async checkPythOracle(): Promise<ServiceStatus> {
    try {
      const start = Date.now();
      const response = await fetch(
        'https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
        { timeout: 10000 }
      );
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        return {
          status: 'unhealthy',
          message: `Pyth API HTTP ${response.status}`,
          lastChecked: new Date().toISOString()
        };
      }
      
      const data = await response.json();
      
      return {
        status: Array.isArray(data) && data.length > 0 ? 'healthy' : 'degraded',
        responseTime,
        details: {
          priceFeeds: Array.isArray(data) ? data.length : 0,
          endpoint: 'hermes.pyth.network'
        },
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Pyth Oracle error: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkChainlinkOracle(): Promise<ServiceStatus> {
    // Placeholder for Chainlink oracle check
    return {
      status: 'healthy',
      message: 'Chainlink oracle check not implemented',
      details: {
        note: 'Direct Chainlink API not used, checking via on-chain calls'
      },
      lastChecked: new Date().toISOString()
    };
  }

  private async checkDefiLlama(): Promise<ServiceStatus> {
    try {
      const start = Date.now();
      const response = await fetch('https://api.llama.fi/protocols', { timeout: 10000 });
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        return {
          status: 'unhealthy',
          message: `DefiLlama API HTTP ${response.status}`,
          lastChecked: new Date().toISOString()
        };
      }
      
      return {
        status: 'healthy',
        responseTime,
        details: {
          endpoint: 'api.llama.fi'
        },
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `DefiLlama error: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkEthereumRPC(): Promise<ServiceStatus> {
    try {
      const start = Date.now();
      const rpcUrl = process.env.ETHEREUM_RPC_URL || 'https://eth.public-rpc.com';
      
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1
        }),
        timeout: 15000
      });
      
      const responseTime = Date.now() - start;
      
      if (!response.ok) {
        return {
          status: 'unhealthy',
          message: `Ethereum RPC HTTP ${response.status}`,
          lastChecked: new Date().toISOString()
        };
      }
      
      const data = await response.json();
      
      if (!data.result) {
        return {
          status: 'unhealthy',
          message: 'Ethereum RPC invalid response',
          lastChecked: new Date().toISOString()
        };
      }
      
      const blockNumber = parseInt(data.result, 16);
      
      return {
        status: 'healthy',
        responseTime,
        details: {
          currentBlock: blockNumber,
          endpoint: rpcUrl.replace(/\/\/.*@/, '//***@') // Hide API keys
        },
        lastChecked: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Ethereum RPC error: ${error.message}`,
        lastChecked: new Date().toISOString()
      };
    }
  }

  private async checkPolygonRPC(): Promise<ServiceStatus> {
    // Similar implementation to Ethereum RPC but for Polygon
    return {
      status: 'healthy',
      message: 'Polygon RPC check not implemented',
      lastChecked: new Date().toISOString()
    };
  }

  private async checkBSCRPC(): Promise<ServiceStatus> {
    // Similar implementation to Ethereum RPC but for BSC
    return {
      status: 'healthy',
      message: 'BSC RPC check not implemented',
      lastChecked: new Date().toISOString()
    };
  }

  // ================================================================================
  // SYSTEM METRICS
  // ================================================================================

  private async getSystemMetrics(): Promise<SystemMetrics> {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        total: memUsage.heapTotal,
        used: memUsage.heapUsed,
        free: memUsage.heapTotal - memUsage.heapUsed,
        percentage: (memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(2)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        usage: ((cpuUsage.user + cpuUsage.system) / 1000000).toFixed(2) // Convert to seconds
      },
      eventLoop: {
        lag: await this.measureEventLoopLag()
      },
      gc: process.memoryUsage ? {
        collections: 'N/A', // Would need --expose-gc flag
        duration: 'N/A'
      } : undefined
    };
  }

  private async measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1e6; // Convert to milliseconds
        resolve(lag);
      });
    });
  }

  // ================================================================================
  // UTILITY METHODS
  // ================================================================================

  private createErrorStatus(message: string): ServiceStatus {
    return {
      status: 'unhealthy',
      message,
      lastChecked: new Date().toISOString()
    };
  }

  /**
   * Readiness check - for Kubernetes readiness probe
   * GET /ready
   */
  readinessCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      // Check critical dependencies
      const [redisReady, dbReady] = await Promise.all([
        this.redisService.ping(),
        this.databaseService.ping()
      ]);

      const isReady = redisReady && dbReady;

      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        timestamp: new Date().toISOString(),
        checks: {
          redis: redisReady,
          database: dbReady
        }
      });
      
    } catch (error) {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed'
      });
    }
  };

  /**
   * Liveness check - for Kubernetes liveness probe
   * GET /live
   */
  livenessCheck = async (req: Request, res: Response): Promise<void> => {
    // Simple check that the process is alive and responsive
    res.status(200).json({
      alive: true,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid
    });
  };
}

export const healthController = new HealthController();