/**
 * ARBITRAGEXPLUS2025 - Application Settings
 * 
 * Configuración centralizada de la aplicación con validación de tipos,
 * configuración por entornos y settings dinámicos para arbitraje DeFi.
 */

import { z } from 'zod';
import { logger } from '@logger';

// ==================================================================================
// CONFIGURATION SCHEMAS & TYPES
// ==================================================================================

// Environment validation schema
const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().min(1000).max(65535).default(3000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  
  // Database
  DATABASE_URL: z.string().optional(),
  DATABASE_MAX_CONNECTIONS: z.coerce.number().default(20),
  DATABASE_SSL: z.coerce.boolean().default(false),
  
  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().default(0),
  
  // Google Sheets
  SPREADSHEET_ID: z.string().min(10),
  GOOGLE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  PRIVATE_KEY: z.string().optional(),
  
  // Blockchain RPCs
  ETHEREUM_RPC_URL: z.string().url().optional(),
  POLYGON_RPC_URL: z.string().url().optional(),
  BSC_RPC_URL: z.string().url().optional(),
  AVALANCHE_RPC_URL: z.string().url().optional(),
  
  // External APIs
  PYTH_API_KEY: z.string().optional(),
  CHAINLINK_API_KEY: z.string().optional(),
  DEFILLAMA_API_KEY: z.string().optional(),
  
  // Security
  JWT_SECRET: z.string().min(32).optional(),
  ENCRYPTION_KEY: z.string().min(32).optional(),
  
  // GitHub Integration
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_REPO: z.string().default('hefarica/ARBITRAGEXPLUS2025'),
  
  // Monitoring
  SENTRY_DSN: z.string().url().optional(),
  NEW_RELIC_LICENSE_KEY: z.string().optional(),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000),
  
  // WebSocket
  WS_ENABLED: z.coerce.boolean().default(true),
  WS_PORT: z.coerce.number().default(3001),
  WS_PING_INTERVAL: z.coerce.number().default(30000),
  
  // Arbitrage Configuration
  MIN_PROFIT_USD: z.coerce.number().default(10),
  MAX_SLIPPAGE: z.coerce.number().min(0).max(1).default(0.005),
  MAX_GAS_PRICE_GWEI: z.coerce.number().default(100),
  DEFAULT_DEADLINE_MINUTES: z.coerce.number().default(20),
  
  // Feature Flags
  ENABLE_FLASH_LOANS: z.coerce.boolean().default(true),
  ENABLE_CROSS_CHAIN: z.coerce.boolean().default(true),
  ENABLE_TRIANGULAR_ARBITRAGE: z.coerce.boolean().default(true),
  ENABLE_AUTOMATIC_EXECUTION: z.coerce.boolean().default(false),
  
  // Performance
  MAX_CONCURRENT_OPERATIONS: z.coerce.number().default(10),
  CACHE_TTL_SECONDS: z.coerce.number().default(30),
  HEALTH_CHECK_INTERVAL_MS: z.coerce.number().default(30000)
});

type Environment = z.infer<typeof EnvironmentSchema>;

// Application configuration interface
interface AppConfig {
  // Server Configuration
  server: {
    port: number;
    host: string;
    environment: string;
    cors: {
      enabled: boolean;
      origins: string[];
      credentials: boolean;
    };
    compression: {
      enabled: boolean;
      level: number;
      threshold: number;
    };
    security: {
      helmet: boolean;
      rateLimiting: boolean;
      trustedProxies: number;
    };
  };

  // Database Configuration
  database: {
    url: string;
    maxConnections: number;
    ssl: boolean;
    logging: boolean;
    migrations: {
      autoRun: boolean;
    };
  };

  // Redis Configuration
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    ttl: {
      default: number;
      prices: number;
      routes: number;
      health: number;
    };
  };

  // Blockchain Configuration
  blockchain: {
    networks: {
      ethereum: {
        rpcUrl: string;
        chainId: number;
        gasMultiplier: number;
      };
      polygon: {
        rpcUrl: string;
        chainId: number;
        gasMultiplier: number;
      };
      bsc: {
        rpcUrl: string;
        chainId: number;
        gasMultiplier: number;
      };
      avalanche: {
        rpcUrl: string;
        chainId: number;
        gasMultiplier: number;
      };
    };
    defaultNetwork: string;
    maxRetries: number;
    timeout: number;
  };

  // Google Sheets Configuration
  googleSheets: {
    spreadsheetId: string;
    serviceAccountKey?: string;
    privateKey?: string;
    updateInterval: number;
    maxRetries: number;
    timeout: number;
  };

  // Arbitrage Configuration
  arbitrage: {
    minProfitUSD: number;
    maxSlippage: number;
    maxGasPriceGwei: number;
    defaultDeadlineMinutes: number;
    maxConcurrentOperations: number;
    strategies: {
      flashLoans: boolean;
      crossChain: boolean;
      triangular: boolean;
      twoWay: boolean;
    };
    risk: {
      maxPositionSizeUSD: number;
      maxDailyLossUSD: number;
      blacklistedTokens: string[];
      minLiquidityUSD: number;
    };
    execution: {
      automatic: boolean;
      simulationMode: boolean;
      dryRun: boolean;
      confirmationBlocks: number;
    };
  };

  // External APIs Configuration
  externalAPIs: {
    pyth: {
      enabled: boolean;
      apiKey?: string;
      baseUrl: string;
      timeout: number;
    };
    chainlink: {
      enabled: boolean;
      apiKey?: string;
      baseUrl: string;
      timeout: number;
    };
    defiLlama: {
      enabled: boolean;
      apiKey?: string;
      baseUrl: string;
      timeout: number;
    };
  };

  // Monitoring & Logging
  monitoring: {
    logging: {
      level: string;
      format: string;
      maxFiles: string;
      maxSize: string;
    };
    sentry: {
      enabled: boolean;
      dsn?: string;
      environment: string;
    };
    newRelic: {
      enabled: boolean;
      licenseKey?: string;
    };
    healthCheck: {
      interval: number;
      timeout: number;
      retries: number;
    };
  };

  // WebSocket Configuration
  websocket: {
    enabled: boolean;
    port: number;
    pingInterval: number;
    maxConnections: number;
    channels: {
      prices: boolean;
      executions: boolean;
      alerts: boolean;
      health: boolean;
    };
  };

  // Security Configuration
  security: {
    jwt: {
      secret?: string;
      expiresIn: string;
      algorithm: string;
    };
    encryption: {
      key?: string;
      algorithm: string;
    };
    rateLimiting: {
      windowMs: number;
      maxRequests: number;
      skipSuccessfulRequests: boolean;
    };
  };

  // Feature Flags
  features: {
    realTimeUpdates: boolean;
    advancedAnalytics: boolean;
    multiChainSupport: boolean;
    autoExecution: boolean;
    riskManagement: boolean;
    performanceTracking: boolean;
  };
}

// ==================================================================================
// SETTINGS CLASS
// ==================================================================================

class Settings {
  private env: Environment;
  private config: AppConfig;
  private initialized = false;

  constructor() {
    this.env = this.loadAndValidateEnvironment();
    this.config = this.buildConfiguration();
    this.initialized = true;

    logger.info('Application settings initialized', {
      environment: this.env.NODE_ENV,
      port: this.env.PORT,
      features: Object.keys(this.config.features).filter(key => 
        this.config.features[key as keyof typeof this.config.features]
      )
    });
  }

  // ================================================================================
  // ENVIRONMENT LOADING & VALIDATION
  // ================================================================================

  private loadAndValidateEnvironment(): Environment {
    try {
      // Load environment variables
      const rawEnv = process.env;

      // Validate against schema
      const validatedEnv = EnvironmentSchema.parse(rawEnv);

      // Additional custom validation
      this.performCustomValidation(validatedEnv);

      logger.info('Environment variables validated successfully', {
        NODE_ENV: validatedEnv.NODE_ENV,
        PORT: validatedEnv.PORT
      });

      return validatedEnv;

    } catch (error) {
      logger.error('Environment validation failed', { error });
      
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
          received: issue.received
        }));
        
        logger.error('Environment validation issues:', { issues });
      }

      throw new Error(`Environment validation failed: ${error.message}`);
    }
  }

  private performCustomValidation(env: Environment): void {
    // Production-specific validations
    if (env.NODE_ENV === 'production') {
      const requiredProdVars = [
        'SPREADSHEET_ID',
        'ETHEREUM_RPC_URL',
        'REDIS_PASSWORD'
      ];

      for (const varName of requiredProdVars) {
        if (!env[varName as keyof Environment]) {
          throw new Error(`${varName} is required in production environment`);
        }
      }
    }

    // Validate RPC URLs format
    const rpcUrls = [
      env.ETHEREUM_RPC_URL,
      env.POLYGON_RPC_URL,
      env.BSC_RPC_URL,
      env.AVALANCHE_RPC_URL
    ].filter(Boolean);

    for (const url of rpcUrls) {
      if (url && !url.startsWith('http')) {
        throw new Error(`Invalid RPC URL format: ${url}`);
      }
    }

    // Validate arbitrage parameters
    if (env.MIN_PROFIT_USD <= 0) {
      throw new Error('MIN_PROFIT_USD must be greater than 0');
    }

    if (env.MAX_SLIPPAGE >= 1) {
      throw new Error('MAX_SLIPPAGE must be less than 1 (100%)');
    }
  }

  // ================================================================================
  // CONFIGURATION BUILDING
  // ================================================================================

  private buildConfiguration(): AppConfig {
    return {
      server: this.buildServerConfig(),
      database: this.buildDatabaseConfig(),
      redis: this.buildRedisConfig(),
      blockchain: this.buildBlockchainConfig(),
      googleSheets: this.buildGoogleSheetsConfig(),
      arbitrage: this.buildArbitrageConfig(),
      externalAPIs: this.buildExternalAPIsConfig(),
      monitoring: this.buildMonitoringConfig(),
      websocket: this.buildWebSocketConfig(),
      security: this.buildSecurityConfig(),
      features: this.buildFeaturesConfig()
    };
  }

  private buildServerConfig() {
    return {
      port: this.env.PORT,
      host: this.env.HOST,
      environment: this.env.NODE_ENV,
      cors: {
        enabled: true,
        origins: this.env.NODE_ENV === 'production' 
          ? ['https://arbitragexplus2025.fly.dev']
          : ['*'],
        credentials: true
      },
      compression: {
        enabled: true,
        level: 6,
        threshold: 1024
      },
      security: {
        helmet: true,
        rateLimiting: this.env.NODE_ENV === 'production',
        trustedProxies: 1
      }
    };
  }

  private buildDatabaseConfig() {
    return {
      url: this.env.DATABASE_URL || this.constructDefaultDatabaseUrl(),
      maxConnections: this.env.DATABASE_MAX_CONNECTIONS,
      ssl: this.env.DATABASE_SSL,
      logging: this.env.NODE_ENV === 'development',
      migrations: {
        autoRun: this.env.NODE_ENV !== 'production'
      }
    };
  }

  private buildRedisConfig() {
    return {
      host: this.env.REDIS_HOST,
      port: this.env.REDIS_PORT,
      password: this.env.REDIS_PASSWORD,
      db: this.env.REDIS_DB,
      keyPrefix: 'arbitragexplus2025:',
      ttl: {
        default: this.env.CACHE_TTL_SECONDS,
        prices: 10, // 10 seconds for price data
        routes: 60, // 1 minute for route data
        health: 30  // 30 seconds for health data
      }
    };
  }

  private buildBlockchainConfig() {
    return {
      networks: {
        ethereum: {
          rpcUrl: this.env.ETHEREUM_RPC_URL || 'https://eth.public-rpc.com',
          chainId: 1,
          gasMultiplier: 1.1
        },
        polygon: {
          rpcUrl: this.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
          chainId: 137,
          gasMultiplier: 1.2
        },
        bsc: {
          rpcUrl: this.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
          chainId: 56,
          gasMultiplier: 1.1
        },
        avalanche: {
          rpcUrl: this.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
          chainId: 43114,
          gasMultiplier: 1.1
        }
      },
      defaultNetwork: 'ethereum',
      maxRetries: 3,
      timeout: 15000
    };
  }

  private buildGoogleSheetsConfig() {
    return {
      spreadsheetId: this.env.SPREADSHEET_ID,
      serviceAccountKey: this.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      privateKey: this.env.PRIVATE_KEY,
      updateInterval: 30000, // 30 seconds
      maxRetries: 3,
      timeout: 10000
    };
  }

  private buildArbitrageConfig() {
    return {
      minProfitUSD: this.env.MIN_PROFIT_USD,
      maxSlippage: this.env.MAX_SLIPPAGE,
      maxGasPriceGwei: this.env.MAX_GAS_PRICE_GWEI,
      defaultDeadlineMinutes: this.env.DEFAULT_DEADLINE_MINUTES,
      maxConcurrentOperations: this.env.MAX_CONCURRENT_OPERATIONS,
      strategies: {
        flashLoans: this.env.ENABLE_FLASH_LOANS,
        crossChain: this.env.ENABLE_CROSS_CHAIN,
        triangular: this.env.ENABLE_TRIANGULAR_ARBITRAGE,
        twoWay: true
      },
      risk: {
        maxPositionSizeUSD: 10000,
        maxDailyLossUSD: 1000,
        blacklistedTokens: [],
        minLiquidityUSD: 1000
      },
      execution: {
        automatic: this.env.ENABLE_AUTOMATIC_EXECUTION,
        simulationMode: this.env.NODE_ENV !== 'production',
        dryRun: this.env.NODE_ENV === 'development',
        confirmationBlocks: 1
      }
    };
  }

  private buildExternalAPIsConfig() {
    return {
      pyth: {
        enabled: true,
        apiKey: this.env.PYTH_API_KEY,
        baseUrl: 'https://hermes.pyth.network',
        timeout: 8000
      },
      chainlink: {
        enabled: true,
        apiKey: this.env.CHAINLINK_API_KEY,
        baseUrl: 'https://api.chain.link',
        timeout: 10000
      },
      defiLlama: {
        enabled: true,
        apiKey: this.env.DEFILLAMA_API_KEY,
        baseUrl: 'https://api.llama.fi',
        timeout: 10000
      }
    };
  }

  private buildMonitoringConfig() {
    return {
      logging: {
        level: this.env.LOG_LEVEL,
        format: this.env.NODE_ENV === 'production' ? 'json' : 'simple',
        maxFiles: '14d',
        maxSize: '20m'
      },
      sentry: {
        enabled: !!this.env.SENTRY_DSN,
        dsn: this.env.SENTRY_DSN,
        environment: this.env.NODE_ENV
      },
      newRelic: {
        enabled: !!this.env.NEW_RELIC_LICENSE_KEY,
        licenseKey: this.env.NEW_RELIC_LICENSE_KEY
      },
      healthCheck: {
        interval: this.env.HEALTH_CHECK_INTERVAL_MS,
        timeout: 10000,
        retries: 3
      }
    };
  }

  private buildWebSocketConfig() {
    return {
      enabled: this.env.WS_ENABLED,
      port: this.env.WS_PORT,
      pingInterval: this.env.WS_PING_INTERVAL,
      maxConnections: 1000,
      channels: {
        prices: true,
        executions: true,
        alerts: true,
        health: true
      }
    };
  }

  private buildSecurityConfig() {
    return {
      jwt: {
        secret: this.env.JWT_SECRET,
        expiresIn: '24h',
        algorithm: 'HS256'
      },
      encryption: {
        key: this.env.ENCRYPTION_KEY,
        algorithm: 'aes-256-gcm'
      },
      rateLimiting: {
        windowMs: this.env.RATE_LIMIT_WINDOW_MS,
        maxRequests: this.env.RATE_LIMIT_MAX_REQUESTS,
        skipSuccessfulRequests: true
      }
    };
  }

  private buildFeaturesConfig() {
    return {
      realTimeUpdates: true,
      advancedAnalytics: this.env.NODE_ENV === 'production',
      multiChainSupport: true,
      autoExecution: this.env.ENABLE_AUTOMATIC_EXECUTION,
      riskManagement: true,
      performanceTracking: true
    };
  }

  // ================================================================================
  // UTILITY METHODS
  // ================================================================================

  private constructDefaultDatabaseUrl(): string {
    return `postgresql://postgres:postgres@localhost:5432/arbitragexplus2025_${this.env.NODE_ENV}`;
  }

  // ================================================================================
  // PUBLIC GETTERS
  // ================================================================================

  get environment(): Environment {
    return { ...this.env };
  }

  get config(): AppConfig {
    return JSON.parse(JSON.stringify(this.config)); // Deep clone to prevent mutations
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  get isStaging(): boolean {
    return this.env.NODE_ENV === 'staging';
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  // ================================================================================
  // DYNAMIC CONFIGURATION UPDATES
  // ================================================================================

  updateArbitrageConfig(updates: Partial<AppConfig['arbitrage']>): void {
    this.config.arbitrage = { ...this.config.arbitrage, ...updates };
    
    logger.info('Arbitrage configuration updated', { updates });
  }

  updateFeatureFlags(features: Partial<AppConfig['features']>): void {
    this.config.features = { ...this.config.features, ...features };
    
    logger.info('Feature flags updated', { features });
  }

  // ================================================================================
  // CONFIGURATION EXPORT
  // ================================================================================

  exportConfiguration(): Record<string, any> {
    return {
      environment: this.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
      config: this.config
    };
  }
}

// ==================================================================================
// SINGLETON EXPORT
// ==================================================================================

export const settings = new Settings();
export type { AppConfig, Environment };
export { Settings };