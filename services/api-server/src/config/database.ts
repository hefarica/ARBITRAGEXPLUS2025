/**
 * ARBITRAGEXPLUS2025 - Database Configuration
 * 
 * Configuración centralizada para PostgreSQL con Prisma ORM.
 * Maneja conexiones, pooling, migraciones y configuraciones
 * específicas para el entorno de producción/desarrollo.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '@logger';

// ==================================================================================
// DATABASE CONFIGURATION
// ==================================================================================

interface DatabaseConfig {
  url: string;
  maxConnections: number;
  connectionTimeout: number;
  queryTimeout: number;
  retryAttempts: number;
  retryDelay: number;
  ssl: boolean;
  logging: boolean;
  migrations: {
    autoRun: boolean;
    directory: string;
  };
}

class DatabaseService {
  private prisma: PrismaClient | null = null;
  private config: DatabaseConfig;
  private isConnected = false;
  private connectionAttempts = 0;
  private maxRetries = 3;

  constructor() {
    this.config = this.loadConfiguration();
    this.initializePrisma();
  }

  // ================================================================================
  // CONFIGURATION LOADING
  // ================================================================================

  private loadConfiguration(): DatabaseConfig {
    const environment = process.env.NODE_ENV || 'development';
    
    return {
      url: this.getDatabaseUrl(),
      maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20'),
      connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '30000'),
      queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '15000'),
      retryAttempts: parseInt(process.env.DATABASE_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.DATABASE_RETRY_DELAY || '1000'),
      ssl: process.env.DATABASE_SSL === 'true',
      logging: environment === 'development',
      migrations: {
        autoRun: process.env.AUTO_RUN_MIGRATIONS === 'true',
        directory: './prisma/migrations'
      }
    };
  }

  private getDatabaseUrl(): string {
    // Priority order for database URL
    const sources = [
      process.env.DATABASE_URL,
      process.env.POSTGRES_URL,
      process.env.POSTGRESQL_URL,
      this.constructDatabaseUrl()
    ];

    for (const url of sources) {
      if (url) {
        return url;
      }
    }

    throw new Error('No database URL configuration found');
  }

  private constructDatabaseUrl(): string {
    const host = process.env.DATABASE_HOST || process.env.POSTGRES_HOST || 'localhost';
    const port = process.env.DATABASE_PORT || process.env.POSTGRES_PORT || '5432';
    const database = process.env.DATABASE_NAME || process.env.POSTGRES_DB || 'arbitragexplus2025';
    const username = process.env.DATABASE_USER || process.env.POSTGRES_USER || 'postgres';
    const password = process.env.DATABASE_PASSWORD || process.env.POSTGRES_PASSWORD;

    if (!password) {
      logger.warn('No database password configured, using empty password');
    }

    let url = `postgresql://${username}:${password || ''}@${host}:${port}/${database}`;

    // Add SSL configuration if enabled
    if (this.config?.ssl) {
      url += '?sslmode=require';
    }

    return url;
  }

  // ================================================================================
  // PRISMA INITIALIZATION
  // ================================================================================

  private initializePrisma(): void {
    try {
      this.prisma = new PrismaClient({
        datasources: {
          db: {
            url: this.config.url
          }
        },
        log: this.config.logging ? [
          { emit: 'event', level: 'query' },
          { emit: 'event', level: 'error' },
          { emit: 'event', level: 'info' },
          { emit: 'event', level: 'warn' }
        ] : ['error'],
        errorFormat: 'pretty'
      });

      // Set up logging if enabled
      if (this.config.logging) {
        this.setupPrismaLogging();
      }

      logger.info('Prisma client initialized', {
        maxConnections: this.config.maxConnections,
        ssl: this.config.ssl,
        logging: this.config.logging
      });

    } catch (error) {
      logger.error('Failed to initialize Prisma client', { error });
      throw error;
    }
  }

  private setupPrismaLogging(): void {
    if (!this.prisma) return;

    this.prisma.$on('query', (e) => {
      logger.debug('Database Query', {
        query: e.query,
        params: e.params,
        duration: e.duration,
        timestamp: e.timestamp
      });
    });

    this.prisma.$on('error', (e) => {
      logger.error('Database Error', {
        message: e.message,
        timestamp: e.timestamp
      });
    });

    this.prisma.$on('info', (e) => {
      logger.info('Database Info', {
        message: e.message,
        timestamp: e.timestamp
      });
    });

    this.prisma.$on('warn', (e) => {
      logger.warn('Database Warning', {
        message: e.message,
        timestamp: e.timestamp
      });
    });
  }

  // ================================================================================
  // CONNECTION MANAGEMENT
  // ================================================================================

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    this.connectionAttempts++;

    try {
      if (!this.prisma) {
        throw new Error('Prisma client not initialized');
      }

      logger.info('Connecting to database...', {
        attempt: this.connectionAttempts,
        maxRetries: this.maxRetries
      });

      // Test connection
      await this.prisma.$connect();
      
      // Verify connection with a simple query
      await this.prisma.$queryRaw`SELECT 1 as test`;

      this.isConnected = true;
      this.connectionAttempts = 0;

      logger.info('Database connected successfully', {
        url: this.config.url.replace(/\/\/.*@/, '//***@') // Hide credentials
      });

      // Run migrations if configured
      if (this.config.migrations.autoRun) {
        await this.runMigrations();
      }

    } catch (error) {
      this.isConnected = false;
      
      logger.error('Database connection failed', {
        error,
        attempt: this.connectionAttempts,
        maxRetries: this.maxRetries
      });

      if (this.connectionAttempts < this.maxRetries) {
        logger.info(`Retrying connection in ${this.config.retryDelay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        return this.connect();
      } else {
        logger.error('Max connection attempts reached. Database unavailable.');
        throw new Error(`Database connection failed after ${this.maxRetries} attempts: ${error.message}`);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected || !this.prisma) {
      return;
    }

    try {
      await this.prisma.$disconnect();
      this.isConnected = false;
      logger.info('Database disconnected successfully');
    } catch (error) {
      logger.error('Error disconnecting from database', { error });
      throw error;
    }
  }

  // ================================================================================
  // HEALTH CHECKS
  // ================================================================================

  async ping(): Promise<boolean> {
    try {
      if (!this.prisma) {
        return false;
      }

      await this.prisma.$queryRaw`SELECT 1 as ping`;
      return true;
    } catch (error) {
      logger.error('Database ping failed', { error });
      return false;
    }
  }

  async getConnectionStats(): Promise<{
    isConnected: boolean;
    activeConnections: number;
    totalConnections: number;
    maxConnections: number;
    version: string;
  }> {
    try {
      if (!this.prisma) {
        throw new Error('Prisma client not available');
      }

      // Get PostgreSQL stats
      const [connectionStats, versionResult] = await Promise.all([
        this.prisma.$queryRaw<Array<{
          active: number;
          total: number;
          max_conn: number;
        }>>`
          SELECT 
            count(*) FILTER (WHERE state = 'active') as active,
            count(*) as total,
            setting::int as max_conn
          FROM pg_stat_activity, pg_settings 
          WHERE pg_settings.name = 'max_connections'
        `,
        this.prisma.$queryRaw<Array<{ version: string }>>`SELECT version() as version`
      ]);

      const stats = connectionStats[0];
      const version = versionResult[0]?.version || 'Unknown';

      return {
        isConnected: this.isConnected,
        activeConnections: stats?.active || 0,
        totalConnections: stats?.total || 0,
        maxConnections: stats?.max_conn || this.config.maxConnections,
        version: version.split(' ')[1] // Extract version number
      };

    } catch (error) {
      logger.error('Failed to get connection stats', { error });
      
      return {
        isConnected: false,
        activeConnections: 0,
        totalConnections: 0,
        maxConnections: this.config.maxConnections,
        version: 'Unknown'
      };
    }
  }

  // ================================================================================
  // MIGRATIONS
  // ================================================================================

  async runMigrations(): Promise<void> {
    try {
      logger.info('Running database migrations...');

      // Using Prisma CLI programmatically would require child_process
      // For production, migrations should be run via CI/CD pipeline
      logger.info('Migrations should be run via: npx prisma migrate deploy');
      
      // Alternatively, check if migrations are needed
      await this.checkMigrationStatus();

    } catch (error) {
      logger.error('Migration check failed', { error });
      // Don't throw - allow app to start even if migration check fails
    }
  }

  private async checkMigrationStatus(): Promise<void> {
    try {
      // Check if _prisma_migrations table exists
      const migrationTable = await this.prisma?.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '_prisma_migrations'
        );
      `;

      logger.info('Migration table check completed', { migrationTable });
    } catch (error) {
      logger.warn('Could not check migration status', { error });
    }
  }

  // ================================================================================
  // TRANSACTION MANAGEMENT
  // ================================================================================

  async transaction<T>(
    operations: (tx: PrismaClient) => Promise<T>,
    options?: {
      maxWait?: number;
      timeout?: number;
    }
  ): Promise<T> {
    if (!this.prisma) {
      throw new Error('Database not connected');
    }

    const txOptions = {
      maxWait: options?.maxWait || 5000,
      timeout: options?.timeout || this.config.queryTimeout
    };

    try {
      return await this.prisma.$transaction(operations, txOptions);
    } catch (error) {
      logger.error('Transaction failed', { error, options: txOptions });
      throw error;
    }
  }

  // ================================================================================
  // QUERY HELPERS
  // ================================================================================

  async executeRawQuery<T = any>(query: string, params?: any[]): Promise<T> {
    if (!this.prisma) {
      throw new Error('Database not connected');
    }

    try {
      logger.debug('Executing raw query', { query, params });
      return await this.prisma.$queryRawUnsafe(query, ...params || []);
    } catch (error) {
      logger.error('Raw query failed', { error, query, params });
      throw error;
    }
  }

  // ================================================================================
  // GETTERS
  // ================================================================================

  get client(): PrismaClient {
    if (!this.prisma) {
      throw new Error('Prisma client not initialized');
    }
    return this.prisma;
  }

  get isReady(): boolean {
    return this.isConnected && this.prisma !== null;
  }

  get configuration(): DatabaseConfig {
    return { ...this.config }; // Return copy to prevent mutations
  }
}

// ==================================================================================
// SINGLETON INSTANCE
// ==================================================================================

export const databaseService = new DatabaseService();

// Graceful shutdown handler
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing database connection...');
  await databaseService.disconnect();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing database connection...');
  await databaseService.disconnect();
});

// Export for dependency injection
export { DatabaseService };
export type { DatabaseConfig };