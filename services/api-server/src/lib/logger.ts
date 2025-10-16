/**
 * ARBITRAGEXPLUS2025 - Logger Configuration
 * 
 * Sistema de logging centralizado con soporte para múltiples transports,
 * structured logging, performance tracking y alerting para operaciones
 * críticas de arbitraje DeFi.
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { format } from 'winston';
import path from 'path';

// ==================================================================================
// LOGGER CONFIGURATION INTERFACES
// ==================================================================================

interface LogContext {
  requestId?: string;
  userId?: string;
  tradeId?: string;
  routeId?: string;
  executionId?: string;
  component?: string;
  operation?: string;
  duration?: number;
  error?: Error | string;
  metadata?: Record<string, any>;
}

interface PerformanceLog {
  operation: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  metadata?: Record<string, any>;
}

// ==================================================================================
// CUSTOM LOG LEVELS
// ==================================================================================

const customLevels = {
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
    trace: 5,
    performance: 6,
    arbitrage: 7,
    execution: 8,
    alert: 9
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
    trace: 'grey',
    performance: 'cyan',
    arbitrage: 'blue',
    execution: 'brightGreen',
    alert: 'brightRed'
  }
};

// ==================================================================================
// CUSTOM FORMATTERS
// ==================================================================================

// Formato para desarrollo - human readable
const developmentFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  format.errors({ stack: true }),
  format.colorize({ all: true }),
  format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\n  ${JSON.stringify(meta, null, 2)}`;
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\n  ${stack}`;
    }
    
    return log;
  })
);

// Formato para producción - structured JSON
const productionFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.json(),
  format.printf((info) => {
    // Ensure consistent structure for log aggregation
    const logEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      service: 'api-server',
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0',
      ...info
    };
    
    // Remove duplicated fields
    delete logEntry.timestamp;
    delete logEntry.level;
    delete logEntry.message;
    
    return JSON.stringify({
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      ...logEntry
    });
  })
);

// Formato específico para arbitraje
const arbitrageFormat = format.combine(
  format.timestamp(),
  format.printf(({ timestamp, level, message, ...meta }) => {
    return JSON.stringify({
      timestamp,
      level,
      message,
      type: 'arbitrage',
      service: 'api-server',
      ...meta
    });
  })
);

// ==================================================================================
// TRANSPORTS CONFIGURATION
// ==================================================================================

const createTransports = () => {
  const environment = process.env.NODE_ENV || 'development';
  const logLevel = process.env.LOG_LEVEL || 'info';
  const logDir = process.env.LOG_DIR || 'logs';

  const transports: winston.transport[] = [];

  // Console transport - always enabled
  transports.push(
    new winston.transports.Console({
      level: logLevel,
      format: environment === 'production' ? productionFormat : developmentFormat,
      handleExceptions: true,
      handleRejections: true
    })
  );

  // File transports - only in non-test environments
  if (environment !== 'test') {
    // General application logs
    transports.push(
      new DailyRotateFile({
        level: logLevel,
        filename: path.join(logDir, 'application-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: productionFormat,
        handleExceptions: true,
        handleRejections: true
      })
    );

    // Error logs - separate file
    transports.push(
      new DailyRotateFile({
        level: 'error',
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: productionFormat
      })
    );

    // HTTP request logs
    transports.push(
      new DailyRotateFile({
        level: 'http',
        filename: path.join(logDir, 'http-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '50m',
        maxFiles: '7d',
        format: format.combine(
          format.timestamp(),
          format.json()
        )
      })
    );

    // Performance logs
    transports.push(
      new DailyRotateFile({
        level: 'performance',
        filename: path.join(logDir, 'performance-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '100m',
        maxFiles: '14d',
        format: format.combine(
          format.timestamp(),
          format.json()
        )
      })
    );

    // Arbitrage-specific logs
    transports.push(
      new DailyRotateFile({
        level: 'arbitrage',
        filename: path.join(logDir, 'arbitrage-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '100m',
        maxFiles: '30d',
        format: arbitrageFormat
      })
    );

    // Execution logs
    transports.push(
      new DailyRotateFile({
        level: 'execution',
        filename: path.join(logDir, 'execution-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxSize: '200m',
        maxFiles: '60d',
        format: format.combine(
          format.timestamp(),
          format.json()
        )
      })
    );
  }

  return transports;
};

// ==================================================================================
// LOGGER INSTANCE CREATION
// ==================================================================================

const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: {
    service: 'arbitragexplus2025-api-server',
    pid: process.pid,
    hostname: require('os').hostname()
  },
  transports: createTransports(),
  exitOnError: false,
  
  // Exception handlers
  exceptionHandlers: process.env.NODE_ENV !== 'test' ? [
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || 'logs', 'exceptions.log'),
      format: productionFormat
    })
  ] : [],
  
  // Rejection handlers
  rejectionHandlers: process.env.NODE_ENV !== 'test' ? [
    new winston.transports.File({
      filename: path.join(process.env.LOG_DIR || 'logs', 'rejections.log'),
      format: productionFormat
    })
  ] : []
});

// Add colors to winston
winston.addColors(customLevels.colors);

// ==================================================================================
// ENHANCED LOGGER CLASS
// ==================================================================================

class EnhancedLogger {
  private baseLogger: winston.Logger;
  private performanceTimers = new Map<string, number>();

  constructor(baseLogger: winston.Logger) {
    this.baseLogger = baseLogger;
  }

  // ================================================================================
  // STANDARD LOG METHODS
  // ================================================================================

  error(message: string, context?: LogContext): void {
    this.baseLogger.error(message, this.sanitizeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.baseLogger.warn(message, this.sanitizeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.baseLogger.info(message, this.sanitizeContext(context));
  }

  http(message: string, context?: LogContext): void {
    this.baseLogger.http(message, this.sanitizeContext(context));
  }

  debug(message: string, context?: LogContext): void {
    this.baseLogger.debug(message, this.sanitizeContext(context));
  }

  trace(message: string, context?: LogContext): void {
    this.baseLogger.log('trace', message, this.sanitizeContext(context));
  }

  // ================================================================================
  // SPECIALIZED LOG METHODS
  // ================================================================================

  /**
   * Log arbitrage-specific events
   */
  arbitrage(message: string, context?: {
    routeId?: string;
    sourceToken?: string;
    targetToken?: string;
    profitUSD?: number;
    slippage?: number;
    gasUsed?: number;
    dexPath?: string[];
    [key: string]: any;
  }): void {
    this.baseLogger.log('arbitrage', message, {
      type: 'arbitrage_event',
      ...this.sanitizeContext(context)
    });
  }

  /**
   * Log execution events
   */
  execution(message: string, context?: {
    executionId?: string;
    routeId?: string;
    status?: 'pending' | 'success' | 'failed' | 'timeout';
    transactionHash?: string;
    blockNumber?: number;
    gasUsed?: number;
    gasPrice?: number;
    profitUSD?: number;
    duration?: number;
    [key: string]: any;
  }): void {
    this.baseLogger.log('execution', message, {
      type: 'execution_event',
      ...this.sanitizeContext(context)
    });
  }

  /**
   * Log performance metrics
   */
  performance(message: string, metrics: PerformanceLog): void {
    this.baseLogger.log('performance', message, {
      type: 'performance_metric',
      operation: metrics.operation,
      duration_ms: metrics.duration,
      success: metrics.success,
      timestamp: new Date().toISOString(),
      ...metrics.metadata
    });
  }

  /**
   * Log critical alerts
   */
  alert(message: string, context?: {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    component?: string;
    action?: string;
    impacted_users?: number;
    estimated_loss?: number;
    [key: string]: any;
  }): void {
    this.baseLogger.log('alert', message, {
      type: 'system_alert',
      severity: context?.severity || 'medium',
      timestamp: new Date().toISOString(),
      ...this.sanitizeContext(context)
    });
  }

  // ================================================================================
  // PERFORMANCE TRACKING
  // ================================================================================

  /**
   * Start performance timer
   */
  startTimer(operation: string): void {
    const timerId = `${operation}_${Date.now()}_${Math.random()}`;
    this.performanceTimers.set(timerId, performance.now());
    return timerId as any;
  }

  /**
   * End performance timer and log result
   */
  endTimer(timerId: string, operation: string, success: boolean = true, metadata?: Record<string, any>): void {
    const startTime = this.performanceTimers.get(timerId);
    
    if (!startTime) {
      this.warn(`Performance timer not found for operation: ${operation}`, { timerId });
      return;
    }

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    this.performance(`Operation completed: ${operation}`, {
      operation,
      startTime,
      endTime,
      duration,
      success,
      metadata
    });

    // Clean up timer
    this.performanceTimers.delete(timerId);

    // Alert for slow operations (>5 seconds)
    if (duration > 5000) {
      this.alert(`Slow operation detected: ${operation}`, {
        severity: 'medium',
        operation,
        duration_ms: duration,
        component: 'performance_monitoring'
      });
    }
  }

  /**
   * Measure function execution time
   */
  async measureAsync<T>(
    operation: string, 
    fn: () => Promise<T>, 
    metadata?: Record<string, any>
  ): Promise<T> {
    const timerId = this.startTimer(operation);
    let success = true;
    let result: T;

    try {
      result = await fn();
      return result;
    } catch (error) {
      success = false;
      this.error(`Operation failed: ${operation}`, {
        operation,
        error: error instanceof Error ? error.message : String(error),
        ...metadata
      });
      throw error;
    } finally {
      this.endTimer(timerId, operation, success, metadata);
    }
  }

  /**
   * Measure synchronous function execution time
   */
  measure<T>(
    operation: string, 
    fn: () => T, 
    metadata?: Record<string, any>
  ): T {
    const timerId = this.startTimer(operation);
    let success = true;
    let result: T;

    try {
      result = fn();
      return result;
    } catch (error) {
      success = false;
      this.error(`Operation failed: ${operation}`, {
        operation,
        error: error instanceof Error ? error.message : String(error),
        ...metadata
      });
      throw error;
    } finally {
      this.endTimer(timerId, operation, success, metadata);
    }
  }

  // ================================================================================
  // REQUEST LOGGING
  // ================================================================================

  /**
   * Log HTTP request
   */
  logRequest(req: any, res: any, responseTime?: number): void {
    const context = {
      method: req.method,
      url: req.originalUrl || req.url,
      status_code: res.statusCode,
      response_time_ms: responseTime,
      user_agent: req.get('User-Agent'),
      ip_address: req.ip || req.connection.remoteAddress,
      request_id: req.id,
      user_id: req.user?.id,
      content_length: res.get('Content-Length'),
      referrer: req.get('Referrer')
    };

    if (res.statusCode >= 400) {
      this.warn(`HTTP ${res.statusCode} - ${req.method} ${req.originalUrl || req.url}`, context);
    } else {
      this.http(`${req.method} ${req.originalUrl || req.url}`, context);
    }
  }

  /**
   * Log database query
   */
  logQuery(query: string, duration: number, success: boolean, context?: Record<string, any>): void {
    this.performance('Database query executed', {
      operation: 'database_query',
      startTime: Date.now() - duration,
      endTime: Date.now(),
      duration,
      success,
      metadata: {
        query: query.substring(0, 200), // Truncate long queries
        ...context
      }
    });
  }

  // ================================================================================
  // UTILITY METHODS
  // ================================================================================

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context?: LogContext | Record<string, any>): Record<string, any> {
    if (!context) return {};

    const sanitized = { ...context };
    
    // Remove or mask sensitive fields
    const sensitiveFields = ['password', 'privateKey', 'secret', 'token', 'apiKey'];
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Truncate long strings
    Object.keys(sanitized).forEach(key => {
      const value = sanitized[key];
      if (typeof value === 'string' && value.length > 1000) {
        sanitized[key] = value.substring(0, 1000) + '... [TRUNCATED]';
      }
    });

    return sanitized;
  }

  /**
   * Create child logger with context
   */
  child(context: Record<string, any>): EnhancedLogger {
    const childLogger = this.baseLogger.child(this.sanitizeContext(context));
    return new EnhancedLogger(childLogger);
  }

  /**
   * Get logger statistics
   */
  getStats(): {
    activeTimers: number;
    logLevel: string;
    transports: number;
  } {
    return {
      activeTimers: this.performanceTimers.size,
      logLevel: this.baseLogger.level,
      transports: this.baseLogger.transports.length
    };
  }

  /**
   * Flush all transports
   */
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      this.baseLogger.on('finish', resolve);
      this.baseLogger.end();
    });
  }
}

// ==================================================================================
// EXPORT SINGLETON INSTANCE
// ==================================================================================

export const logger = new EnhancedLogger(logger);
export type { LogContext, PerformanceLog };
export { EnhancedLogger };

// ==================================================================================
// GRACEFUL SHUTDOWN
// ==================================================================================

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, flushing logs...');
  await logger.flush();
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, flushing logs...');
  await logger.flush();
});

// Handle uncaught exceptions and rejections
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack,
    component: 'global_exception_handler'
  });
  
  // Give time for logs to be written
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Rejection', {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    component: 'global_rejection_handler'
  });
});