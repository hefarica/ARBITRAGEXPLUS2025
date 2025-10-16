/**
 * ARBITRAGEXPLUS2025 - Redis Configuration
 * 
 * Configuración centralizada para Redis con soporte para clustering,
 * cache inteligente, pub/sub para real-time updates y persistencia.
 * Optimizado para high-frequency trading data y arbitrage opportunities.
 */

import Redis, { RedisOptions, Cluster } from 'ioredis';
import { logger } from '@logger';

// ==================================================================================
// REDIS CONFIGURATION INTERFACES
// ==================================================================================

interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  connectTimeout: number;
  commandTimeout: number;
  lazyConnect: boolean;
  keepAlive: number;
  family: 4 | 6;
  cluster: {
    enabled: boolean;
    nodes: Array<{ host: string; port: number }>;
  };
  sentinel: {
    enabled: boolean;
    sentinels: Array<{ host: string; port: number }>;
    name: string;
  };
}

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  compress?: boolean; // Compress large values
  serialize?: boolean; // Auto serialize/deserialize JSON
}

// ==================================================================================
// REDIS SERVICE CLASS
// ==================================================================================

class RedisService {
  private client: Redis | Cluster | null = null;
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;
  private config: RedisConfig;
  private isConnected = false;
  private connectionAttempts = 0;
  private readonly maxRetries = 3;

  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  constructor() {
    this.config = this.loadConfiguration();
    this.initializeRedis();
  }

  // ================================================================================
  // CONFIGURATION LOADING
  // ================================================================================

  private loadConfiguration(): RedisConfig {
    return {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'arbitragexplus2025:',
      maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
      retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
      connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
      commandTimeout: parseInt(process.env.REDIS_COMMAND_TIMEOUT || '5000'),
      lazyConnect: process.env.REDIS_LAZY_CONNECT !== 'false',
      keepAlive: parseInt(process.env.REDIS_KEEPALIVE || '30000'),
      family: (process.env.REDIS_FAMILY as '4' | '6') || 4,
      
      cluster: {
        enabled: process.env.REDIS_CLUSTER_ENABLED === 'true',
        nodes: this.parseClusterNodes()
      },
      
      sentinel: {
        enabled: process.env.REDIS_SENTINEL_ENABLED === 'true',
        sentinels: this.parseSentinelNodes(),
        name: process.env.REDIS_SENTINEL_NAME || 'mymaster'
      }
    };
  }

  private parseClusterNodes(): Array<{ host: string; port: number }> {
    const clusterNodes = process.env.REDIS_CLUSTER_NODES;
    if (!clusterNodes) return [];

    return clusterNodes.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port) };
    });
  }

  private parseSentinelNodes(): Array<{ host: string; port: number }> {
    const sentinelNodes = process.env.REDIS_SENTINEL_NODES;
    if (!sentinelNodes) return [];

    return sentinelNodes.split(',').map(node => {
      const [host, port] = node.trim().split(':');
      return { host, port: parseInt(port) };
    });
  }

  // ================================================================================
  // REDIS INITIALIZATION
  // ================================================================================

  private initializeRedis(): void {
    try {
      const baseOptions: RedisOptions = {
        password: this.config.password,
        db: this.config.db,
        keyPrefix: this.config.keyPrefix,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        retryDelayOnFailover: this.config.retryDelayOnFailover,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout,
        lazyConnect: this.config.lazyConnect,
        keepAlive: this.config.keepAlive,
        family: this.config.family,
        
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          logger.warn(`Redis connection retry ${times}, delay: ${delay}ms`);
          return delay;
        },
        
        reconnectOnError: (err: Error) => {
          const targetError = 'READONLY';
          return err.message.includes(targetError);
        }
      };

      // Initialize based on configuration
      if (this.config.cluster.enabled && this.config.cluster.nodes.length > 0) {
        this.client = new Redis.Cluster(this.config.cluster.nodes, {
          redisOptions: baseOptions,
          scaleReads: 'slave'
        });
        logger.info('Redis cluster client initialized', { 
          nodes: this.config.cluster.nodes.length 
        });
      } else if (this.config.sentinel.enabled && this.config.sentinel.sentinels.length > 0) {
        this.client = new Redis({
          ...baseOptions,
          sentinels: this.config.sentinel.sentinels,
          name: this.config.sentinel.name
        });
        logger.info('Redis sentinel client initialized', { 
          sentinels: this.config.sentinel.sentinels.length 
        });
      } else {
        this.client = new Redis({
          ...baseOptions,
          host: this.config.host,
          port: this.config.port
        });
        logger.info('Redis standalone client initialized', {
          host: this.config.host,
          port: this.config.port
        });
      }

      // Set up event handlers
      this.setupEventHandlers();

      // Initialize pub/sub clients
      this.initializePubSub();

    } catch (error) {
      logger.error('Failed to initialize Redis client', { error });
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.client) return;

    this.client.on('connect', () => {
      logger.info('Redis connected');
      this.isConnected = true;
      this.connectionAttempts = 0;
    });

    this.client.on('ready', () => {
      logger.info('Redis ready for commands');
    });

    this.client.on('error', (error) => {
      logger.error('Redis connection error', { error });
      this.isConnected = false;
      this.stats.errors++;
    });

    this.client.on('close', () => {
      logger.warn('Redis connection closed');
      this.isConnected = false;
    });

    this.client.on('reconnecting', (ms: number) => {
      logger.info(`Redis reconnecting in ${ms}ms`);
      this.connectionAttempts++;
    });

    this.client.on('end', () => {
      logger.warn('Redis connection ended');
      this.isConnected = false;
    });
  }

  private initializePubSub(): void {
    // Create separate clients for pub/sub to avoid blocking
    const pubOptions = { ...this.getRedisOptions() };
    const subOptions = { ...this.getRedisOptions() };

    this.publisher = new Redis(pubOptions);
    this.subscriber = new Redis(subOptions);

    logger.info('Redis pub/sub clients initialized');
  }

  private getRedisOptions(): RedisOptions {
    return {
      host: this.config.host,
      port: this.config.port,
      password: this.config.password,
      db: this.config.db,
      lazyConnect: true,
      retryStrategy: (times: number) => Math.min(times * 50, 2000)
    };
  }

  // ================================================================================
  // CONNECTION MANAGEMENT
  // ================================================================================

  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      logger.info('Connecting to Redis...', {
        host: this.config.host,
        port: this.config.port,
        cluster: this.config.cluster.enabled
      });

      await this.client.connect();
      
      // Test connection
      await this.ping();

      logger.info('Redis connected successfully');

    } catch (error) {
      logger.error('Redis connection failed', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const promises = [];

      if (this.client) {
        promises.push(this.client.quit());
      }
      if (this.publisher) {
        promises.push(this.publisher.quit());
      }
      if (this.subscriber) {
        promises.push(this.subscriber.quit());
      }

      await Promise.all(promises);
      
      this.isConnected = false;
      logger.info('Redis disconnected successfully');

    } catch (error) {
      logger.error('Error disconnecting from Redis', { error });
      throw error;
    }
  }

  // ================================================================================
  // BASIC OPERATIONS
  // ================================================================================

  async ping(): Promise<boolean> {
    try {
      if (!this.client) {
        return false;
      }

      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      logger.error('Redis ping failed', { error });
      return false;
    }
  }

  async get<T = string>(key: string, options?: CacheOptions): Promise<T | null> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      const value = await this.client.get(key);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;

      // Auto-deserialize JSON if enabled
      if (options?.serialize && value) {
        try {
          return JSON.parse(value) as T;
        } catch {
          return value as T;
        }
      }

      return value as T;

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis GET failed', { key, error });
      throw error;
    }
  }

  async set(key: string, value: any, options?: CacheOptions): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      let serializedValue = value;

      // Auto-serialize objects to JSON
      if (options?.serialize && typeof value === 'object') {
        serializedValue = JSON.stringify(value);
      }

      let result: string;

      if (options?.ttl && options.ttl > 0) {
        result = await this.client.setex(key, options.ttl, serializedValue);
      } else {
        result = await this.client.set(key, serializedValue);
      }

      this.stats.sets++;
      return result === 'OK';

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis SET failed', { key, error });
      throw error;
    }
  }

  async setEx(key: string, seconds: number, value: any): Promise<boolean> {
    return this.set(key, value, { ttl: seconds, serialize: true });
  }

  async del(key: string): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      const result = await this.client.del(key);
      this.stats.deletes++;
      return result > 0;

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis DELETE failed', { key, error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      const result = await this.client.exists(key);
      return result === 1;

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis EXISTS failed', { key, error });
      throw error;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      const result = await this.client.expire(key, seconds);
      return result === 1;

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis EXPIRE failed', { key, seconds, error });
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      return await this.client.ttl(key);

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis TTL failed', { key, error });
      throw error;
    }
  }

  // ================================================================================
  // ADVANCED OPERATIONS
  // ================================================================================

  async mget<T = string>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      const values = await this.client.mget(...keys);
      
      return values.map(value => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }

        this.stats.hits++;

        if (options?.serialize && value) {
          try {
            return JSON.parse(value) as T;
          } catch {
            return value as T;
          }
        }

        return value as T;
      });

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis MGET failed', { keys, error });
      throw error;
    }
  }

  async mset(keyValuePairs: Record<string, any>, options?: CacheOptions): Promise<boolean> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      const flatArray: (string | any)[] = [];

      for (const [key, value] of Object.entries(keyValuePairs)) {
        flatArray.push(key);
        
        if (options?.serialize && typeof value === 'object') {
          flatArray.push(JSON.stringify(value));
        } else {
          flatArray.push(value);
        }
      }

      const result = await this.client.mset(...flatArray);
      this.stats.sets += Object.keys(keyValuePairs).length;
      
      return result === 'OK';

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis MSET failed', { error });
      throw error;
    }
  }

  async increment(key: string, by: number = 1): Promise<number> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      return await this.client.incrby(key, by);

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis INCREMENT failed', { key, by, error });
      throw error;
    }
  }

  async keys(pattern: string): Promise<string[]> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      return await this.client.keys(pattern);

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis KEYS failed', { pattern, error });
      throw error;
    }
  }

  // ================================================================================
  // PUB/SUB OPERATIONS
  // ================================================================================

  async publish(channel: string, message: any): Promise<number> {
    try {
      if (!this.publisher) {
        throw new Error('Redis publisher not available');
      }

      const serializedMessage = typeof message === 'object' ? 
        JSON.stringify(message) : message;

      return await this.publisher.publish(channel, serializedMessage);

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis PUBLISH failed', { channel, error });
      throw error;
    }
  }

  async subscribe(channel: string, callback: (message: any) => void): Promise<void> {
    try {
      if (!this.subscriber) {
        throw new Error('Redis subscriber not available');
      }

      await this.subscriber.subscribe(channel);

      this.subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const parsedMessage = JSON.parse(message);
            callback(parsedMessage);
          } catch {
            callback(message);
          }
        }
      });

      logger.info(`Subscribed to Redis channel: ${channel}`);

    } catch (error) {
      this.stats.errors++;
      logger.error('Redis SUBSCRIBE failed', { channel, error });
      throw error;
    }
  }

  // ================================================================================
  // INFO & STATS
  // ================================================================================

  async getInfo(): Promise<Record<string, string>> {
    try {
      if (!this.client) {
        throw new Error('Redis client not available');
      }

      const info = await this.client.info();
      const lines = info.split('\r\n');
      const result: Record<string, string> = {};

      for (const line of lines) {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split(':');
          if (key && value) {
            result[key] = value;
          }
        }
      }

      return result;

    } catch (error) {
      logger.error('Redis INFO failed', { error });
      throw error;
    }
  }

  getStats(): typeof this.stats {
    const hitRate = this.stats.hits + this.stats.misses > 0 ? 
      (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2) : '0';

    return {
      ...this.stats,
      hitRate: parseFloat(hitRate)
    };
  }

  // ================================================================================
  // GETTERS
  // ================================================================================

  get client(): Redis | Cluster | null {
    return this.client;
  }

  get isReady(): boolean {
    return this.isConnected && this.client !== null;
  }

  get configuration(): RedisConfig {
    return { ...this.config };
  }
}

// ==================================================================================
// SINGLETON INSTANCE
// ==================================================================================

export const redisService = new RedisService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, closing Redis connections...');
  await redisService.disconnect();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, closing Redis connections...');
  await redisService.disconnect();
});

// Export for dependency injection
export { RedisService };
export type { RedisConfig, CacheOptions };