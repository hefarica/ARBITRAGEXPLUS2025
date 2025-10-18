/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/lib/errors.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ./logger
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: SystemError, DatabaseError, SlippageTooHighError
 *   FUNCIONES: isBaseError, handleError
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: SystemError, DatabaseError, SlippageTooHighError
 * 
 * 🔗 DEPENDENCIAS:
 *   - ./logger
 * 
 * ============================================================================

 * 
 * 🧬 PROGRAMACIÓN DINÁMICA APLICADA:
 *   1. ❌ NO handlers hardcodeados → ✅ Array dinámico de ErrorHandler
 *   2. ❌ NO configuración fija → ✅ Map de configuraciones desde Sheets
 *   3. ✅ Interface ErrorHandler permite agregar handlers sin modificar código
 *   4. ✅ registerHandler() agrega handlers en runtime
 *   5. ✅ loadErrorConfig() carga configuración desde Google Sheets
 *   6. ✅ Polimorfismo: Cualquier clase que implemente ErrorHandler puede ser registrada
 *   7. ✅ Descubrimiento dinámico de configuraciones de manejo de errores
 * 
 */

/**
 * ARBITRAGEXPLUS2025 - Error Handling System
 * 
 * Sistema centralizado de manejo de errores con clasificación,
 * logging automático, recovery strategies y métricas de errores
 * para operaciones críticas de arbitraje DeFi.
 * 
 * SECURITY NOTE: Este archivo NO contiene credenciales hardcodeadas.
 * Todas las referencias a "TOKEN", "KEY", "SECRET" son nombres de
 * tipos de error, no valores reales. Todas las credenciales deben
 * gestionarse exclusivamente a través de variables de entorno.
 */

import { logger } from './logger';

// ==================================================================================
// ERROR CLASSIFICATION & CODES
// ==================================================================================

export enum ErrorCode {
  // Validation Errors (400x)
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  
  // Authentication & Authorization (401x, 403x)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Not Found (404x)
  NOT_FOUND = 'NOT_FOUND',
  ROUTE_NOT_FOUND = 'ROUTE_NOT_FOUND',
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  EXECUTION_NOT_FOUND = 'EXECUTION_NOT_FOUND',
  
  // Business Logic Errors (422x)
  BUSINESS_ERROR = 'BUSINESS_ERROR',
  INSUFFICIENT_LIQUIDITY = 'INSUFFICIENT_LIQUIDITY',
  SLIPPAGE_TOO_HIGH = 'SLIPPAGE_TOO_HIGH',
  PROFIT_TOO_LOW = 'PROFIT_TOO_LOW',
  EXECUTION_FAILED = 'EXECUTION_FAILED',
  ROUTE_EXPIRED = 'ROUTE_EXPIRED',
  
  // Rate Limiting (429x)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // System Errors (500x)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  REDIS_ERROR = 'REDIS_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  
  // Blockchain Errors (503x)
  BLOCKCHAIN_ERROR = 'BLOCKCHAIN_ERROR',
  RPC_ERROR = 'RPC_ERROR',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  GAS_ESTIMATION_FAILED = 'GAS_ESTIMATION_FAILED',
  INSUFFICIENT_GAS = 'INSUFFICIENT_GAS',
  NONCE_ERROR = 'NONCE_ERROR',
  
  // Google Sheets Errors (502x)
  SHEETS_ERROR = 'SHEETS_ERROR',
  SHEETS_AUTH_ERROR = 'SHEETS_AUTH_ERROR',
  SHEETS_QUOTA_ERROR = 'SHEETS_QUOTA_ERROR',
  SHEETS_RATE_LIMIT = 'SHEETS_RATE_LIMIT',
  
  // Arbitrage Specific Errors (600x)
  ARBITRAGE_ERROR = 'ARBITRAGE_ERROR',
  NO_PROFITABLE_ROUTES = 'NO_PROFITABLE_ROUTES',
  PRICE_OUTDATED = 'PRICE_OUTDATED',
  LIQUIDATION_RISK = 'LIQUIDATION_RISK',
  MEV_COMPETITION = 'MEV_COMPETITION',
  FLASH_LOAN_FAILED = 'FLASH_LOAN_FAILED'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  BUSINESS = 'business',
  SYSTEM = 'system',
  EXTERNAL = 'external',
  BLOCKCHAIN = 'blockchain',
  ARBITRAGE = 'arbitrage'
}

// ==================================================================================
// BASE ERROR CLASS
// ==================================================================================

export abstract class BaseError extends Error {
  public readonly code: ErrorCode;
  public readonly category: ErrorCategory;
  public readonly severity: ErrorSeverity;
  public readonly statusCode: number;
  public readonly context?: Record<string, any>;
  public readonly timestamp: Date;
  public readonly recoverable: boolean;
  public readonly retryable: boolean;
  public readonly userId?: string;
  public readonly requestId?: string;

  constructor(
    message: string,
    code: ErrorCode,
    category: ErrorCategory,
    severity: ErrorSeverity,
    statusCode: number,
    options?: {
      context?: Record<string, any>;
      cause?: Error;
      recoverable?: boolean;
      retryable?: boolean;
      userId?: string;
      requestId?: string;
    }
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.category = category;
    this.severity = severity;
    this.statusCode = statusCode;
    this.context = options?.context;
    this.timestamp = new Date();
    this.recoverable = options?.recoverable ?? false;
    this.retryable = options?.retryable ?? false;
    this.userId = options?.userId;
    this.requestId = options?.requestId;

    // Preserve original stack trace
    if (options?.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }

    // Automatically log the error
    this.logError();
  }

  private logError(): void {
    const logContext = {
      errorCode: this.code,
      category: this.category,
      severity: this.severity,
      statusCode: this.statusCode,
      recoverable: this.recoverable,
      retryable: this.retryable,
      userId: this.userId,
      requestId: this.requestId,
      context: this.context,
      stack: this.stack
    };

    switch (this.severity) {
      case ErrorSeverity.CRITICAL:
        logger.alert(this.message, {
          severity: 'critical',
          component: 'error_system',
          ...logContext
        });
        break;
      case ErrorSeverity.HIGH:
        logger.error(this.message, logContext);
        break;
      case ErrorSeverity.MEDIUM:
        logger.warn(this.message, logContext);
        break;
      case ErrorSeverity.LOW:
        logger.info(this.message, logContext);
        break;
    }
  }

  /**
   * Convert error to JSON for API responses
   */
  toJSON(): Record<string, any> {
    return {
      error: {
        name: this.name,
        message: this.message,
        code: this.code,
        category: this.category,
        severity: this.severity,
        timestamp: this.timestamp.toISOString(),
        recoverable: this.recoverable,
        retryable: this.retryable,
        context: this.context
      }
    };
  }

  /**
   * Get suggested recovery actions
   */
  abstract getRecoveryActions(): string[];

  /**
   * Check if error should trigger an alert
   */
  shouldAlert(): boolean {
    return this.severity === ErrorSeverity.CRITICAL || 
           this.severity === ErrorSeverity.HIGH;
  }
}

// ==================================================================================
// VALIDATION ERRORS
// ==================================================================================

export class ValidationError extends BaseError {
  constructor(
    message: string,
    options?: {
      field?: string;
      value?: any;
      expectedType?: string;
      context?: Record<string, any>;
      userId?: string;
      requestId?: string;
    }
  ) {
    const context = {
      field: options?.field,
      value: options?.value,
      expectedType: options?.expectedType,
      ...options?.context
    };

    super(
      message,
      ErrorCode.VALIDATION_ERROR,
      ErrorCategory.VALIDATION,
      ErrorSeverity.LOW,
      400,
      {
        context,
        recoverable: true,
        retryable: false,
        userId: options?.userId,
        requestId: options?.requestId
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Check input validation requirements',
      'Ensure all required fields are provided',
      'Verify data types and formats',
      'Review API documentation for correct parameters'
    ];
  }
}

export class InvalidAddressError extends ValidationError {
  constructor(address: string, options?: { userId?: string; requestId?: string }) {
    super(
      `Invalid Ethereum address: ${address}`,
      {
        field: 'address',
        value: address,
        expectedType: '0x followed by 40 hexadecimal characters',
        ...options
      }
    );
    this.code = ErrorCode.INVALID_ADDRESS;
  }
}

export class InvalidAmountError extends ValidationError {
  constructor(amount: any, options?: { userId?: string; requestId?: string }) {
    super(
      `Invalid amount: ${amount}`,
      {
        field: 'amount',
        value: amount,
        expectedType: 'positive number or valid BigNumber string',
        ...options
      }
    );
    this.code = ErrorCode.INVALID_AMOUNT;
  }
}

// ==================================================================================
// BUSINESS LOGIC ERRORS
// ==================================================================================

export class BusinessError extends BaseError {
  constructor(
    message: string,
    statusCode: number = 422,
    options?: {
      code?: ErrorCode;
      context?: Record<string, any>;
      recoverable?: boolean;
      retryable?: boolean;
      userId?: string;
      requestId?: string;
    }
  ) {
    super(
      message,
      options?.code || ErrorCode.BUSINESS_ERROR,
      ErrorCategory.BUSINESS,
      ErrorSeverity.MEDIUM,
      statusCode,
      {
        context: options?.context,
        recoverable: options?.recoverable ?? true,
        retryable: options?.retryable ?? true,
        userId: options?.userId,
        requestId: options?.requestId
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Check business rule constraints',
      'Verify current system state',
      'Review operation parameters',
      'Try again with adjusted parameters'
    ];
  }
}

export class InsufficientLiquidityError extends BusinessError {
  constructor(
    tokenSymbol: string,
    requiredAmount: string,
    availableAmount: string,
    options?: { userId?: string; requestId?: string }
  ) {
    super(
      `Insufficient liquidity for ${tokenSymbol}: required ${requiredAmount}, available ${availableAmount}`,
      422,
      {
        code: ErrorCode.INSUFFICIENT_LIQUIDITY,
        context: {
          tokenSymbol,
          requiredAmount,
          availableAmount
        },
        recoverable: true,
        retryable: true,
        ...options
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Reduce trade size to fit available liquidity',
      'Split large trades into smaller chunks',
      'Wait for liquidity to increase',
      'Try alternative routes with better liquidity'
    ];
  }
}

export class SlippageTooHighError extends BusinessError {
  constructor(
    expectedSlippage: number,
    maxSlippage: number,
    options?: { userId?: string; requestId?: string }
  ) {
    super(
      `Slippage ${expectedSlippage}% exceeds maximum allowed ${maxSlippage}%`,
      422,
      {
        code: ErrorCode.SLIPPAGE_TOO_HIGH,
        context: {
          expectedSlippage,
          maxSlippage
        },
        recoverable: true,
        retryable: true,
        ...options
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Increase maximum slippage tolerance',
      'Reduce trade size to minimize slippage',
      'Wait for better market conditions',
      'Use routes with deeper liquidity'
    ];
  }
}

// ==================================================================================
// SYSTEM ERRORS
// ==================================================================================

export class SystemError extends BaseError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      cause?: Error;
      context?: Record<string, any>;
      recoverable?: boolean;
      retryable?: boolean;
      userId?: string;
      requestId?: string;
    }
  ) {
    super(
      message,
      options?.code || ErrorCode.INTERNAL_ERROR,
      ErrorCategory.SYSTEM,
      ErrorSeverity.HIGH,
      500,
      {
        cause: options?.cause,
        context: options?.context,
        recoverable: options?.recoverable ?? false,
        retryable: options?.retryable ?? true,
        userId: options?.userId,
        requestId: options?.requestId
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Check system logs for detailed error information',
      'Verify all system dependencies are running',
      'Restart affected services if necessary',
      'Contact system administrator if problem persists'
    ];
  }
}

export class DatabaseError extends SystemError {
  constructor(
    operation: string,
    cause?: Error,
    options?: { userId?: string; requestId?: string }
  ) {
    super(
      `Database operation failed: ${operation}`,
      {
        code: ErrorCode.DATABASE_ERROR,
        cause,
        context: { operation },
        recoverable: true,
        retryable: true,
        ...options
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Check database connection',
      'Verify database is running and accessible',
      'Review database logs for errors',
      'Retry operation after brief delay'
    ];
  }
}

export class RedisError extends SystemError {
  constructor(
    operation: string,
    cause?: Error,
    options?: { userId?: string; requestId?: string }
  ) {
    super(
      `Redis operation failed: ${operation}`,
      {
        code: ErrorCode.REDIS_ERROR,
        cause,
        context: { operation },
        recoverable: true,
        retryable: true,
        ...options
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Check Redis connection',
      'Verify Redis server is running',
      'Clear cache if data is corrupted',
      'Fallback to database if Redis is unavailable'
    ];
  }
}

// ==================================================================================
// BLOCKCHAIN ERRORS
// ==================================================================================

export class BlockchainError extends BaseError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      chainId?: number;
      transactionHash?: string;
      blockNumber?: number;
      cause?: Error;
      context?: Record<string, any>;
      userId?: string;
      requestId?: string;
    }
  ) {
    const context = {
      chainId: options?.chainId,
      transactionHash: options?.transactionHash,
      blockNumber: options?.blockNumber,
      ...options?.context
    };

    super(
      message,
      options?.code || ErrorCode.BLOCKCHAIN_ERROR,
      ErrorCategory.BLOCKCHAIN,
      ErrorSeverity.HIGH,
      503,
      {
        cause: options?.cause,
        context,
        recoverable: true,
        retryable: true,
        userId: options?.userId,
        requestId: options?.requestId
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Check blockchain network status',
      'Verify RPC endpoint availability',
      'Increase gas price if transaction is stuck',
      'Retry with different RPC endpoint'
    ];
  }
}

export class TransactionFailedError extends BlockchainError {
  constructor(
    transactionHash: string,
    reason: string,
    options?: {
      chainId?: number;
      blockNumber?: number;
      gasUsed?: number;
      userId?: string;
      requestId?: string;
    }
  ) {
    super(
      `Transaction failed: ${reason}`,
      {
        code: ErrorCode.TRANSACTION_FAILED,
        transactionHash,
        context: {
          reason,
          gasUsed: options?.gasUsed
        },
        chainId: options?.chainId,
        blockNumber: options?.blockNumber,
        userId: options?.userId,
        requestId: options?.requestId
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Review transaction failure reason',
      'Check if contract reverted with specific error',
      'Adjust transaction parameters',
      'Verify sufficient balance for gas fees'
    ];
  }
}

// ==================================================================================
// ARBITRAGE SPECIFIC ERRORS
// ==================================================================================

export class ArbitrageError extends BaseError {
  constructor(
    message: string,
    options?: {
      code?: ErrorCode;
      routeId?: string;
      executionId?: string;
      context?: Record<string, any>;
      recoverable?: boolean;
      retryable?: boolean;
      userId?: string;
      requestId?: string;
    }
  ) {
    const context = {
      routeId: options?.routeId,
      executionId: options?.executionId,
      ...options?.context
    };

    super(
      message,
      options?.code || ErrorCode.ARBITRAGE_ERROR,
      ErrorCategory.ARBITRAGE,
      ErrorSeverity.MEDIUM,
      422,
      {
        context,
        recoverable: options?.recoverable ?? true,
        retryable: options?.retryable ?? true,
        userId: options?.userId,
        requestId: options?.requestId
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Check current market conditions',
      'Verify route is still profitable',
      'Review arbitrage parameters',
      'Try alternative arbitrage strategies'
    ];
  }
}

export class NoProfitableRoutesError extends ArbitrageError {
  constructor(
    sourceToken: string,
    targetToken: string,
    minProfit: number,
    options?: { userId?: string; requestId?: string }
  ) {
    super(
      `No profitable routes found for ${sourceToken} -> ${targetToken} with minimum profit $${minProfit}`,
      {
        code: ErrorCode.NO_PROFITABLE_ROUTES,
        context: {
          sourceToken,
          targetToken,
          minProfitUSD: minProfit
        },
        recoverable: true,
        retryable: true,
        ...options
      }
    );
  }

  getRecoveryActions(): string[] {
    return [
      'Lower minimum profit threshold',
      'Wait for better market opportunities',
      'Try different token pairs',
      'Check if sufficient liquidity exists'
    ];
  }
}

// ==================================================================================
// ERROR FACTORY & UTILITIES
// ==================================================================================

export class ErrorFactory {
  /**
   * Create error from HTTP status code
   */
  static fromHttpStatus(
    statusCode: number,
    message: string,
    options?: { context?: Record<string, any>; userId?: string; requestId?: string }
  ): BaseError {
    switch (Math.floor(statusCode / 100)) {
      case 4:
        if (statusCode === 400) {
          return new ValidationError(message, options);
        } else if (statusCode === 404) {
          return new BusinessError(message, 404, {
            code: ErrorCode.NOT_FOUND,
            ...options
          });
        } else if (statusCode === 422) {
          return new BusinessError(message, 422, options);
        } else {
          return new ValidationError(message, options);
        }
      case 5:
      default:
        return new SystemError(message, {
          context: { statusCode, ...options?.context },
          userId: options?.userId,
          requestId: options?.requestId
        });
    }
  }

  /**
   * Create error from database operation
   */
  static fromDatabaseError(
    operation: string,
    cause: Error,
    options?: { userId?: string; requestId?: string }
  ): DatabaseError {
    return new DatabaseError(operation, cause, options);
  }

  /**
   * Create error from blockchain operation
   */
  static fromBlockchainError(
    message: string,
    chainId: number,
    cause?: Error,
    options?: { userId?: string; requestId?: string }
  ): BlockchainError {
    return new BlockchainError(message, {
      chainId,
      cause,
      userId: options?.userId,
      requestId: options?.requestId
    });
  }
}

// ==================================================================================
// ERROR METRICS & TRACKING
// ==================================================================================

export class ErrorMetrics {
  private static errorCounts = new Map<ErrorCode, number>();
  private static errorsByCategory = new Map<ErrorCategory, number>();
  private static errorsBySeverity = new Map<ErrorSeverity, number>();

  static trackError(error: BaseError): void {
    // Count by error code
    const currentCount = this.errorCounts.get(error.code) || 0;
    this.errorCounts.set(error.code, currentCount + 1);

    // Count by category
    const categoryCount = this.errorsByCategory.get(error.category) || 0;
    this.errorsByCategory.set(error.category, categoryCount + 1);

    // Count by severity
    const severityCount = this.errorsBySeverity.get(error.severity) || 0;
    this.errorsBySeverity.set(error.severity, severityCount + 1);

    // Log metrics periodically
    this.logMetricsIfNeeded();
  }

  static getMetrics(): {
    byCode: Record<string, number>;
    byCategory: Record<string, number>;
    bySeverity: Record<string, number>;
  } {
    return {
      byCode: Object.fromEntries(this.errorCounts),
      byCategory: Object.fromEntries(this.errorsByCategory),
      bySeverity: Object.fromEntries(this.errorsBySeverity)
    };
  }

  static resetMetrics(): void {
    this.errorCounts.clear();
    this.errorsByCategory.clear();
    this.errorsBySeverity.clear();
  }

  private static logMetricsIfNeeded(): void {
    const totalErrors = Array.from(this.errorCounts.values())
      .reduce((sum, count) => sum + count, 0);

    // Log metrics every 100 errors
    if (totalErrors % 100 === 0) {
      logger.performance('Error metrics update', {
        operation: 'error_tracking',
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        success: true,
        metadata: this.getMetrics()
      });
    }
  }
}

// ==================================================================================
// ERROR MIDDLEWARE & HANDLERS
// ==================================================================================

export function isBaseError(error: any): error is BaseError {
  return error instanceof BaseError;
}

export function handleError(error: unknown): BaseError {
  if (isBaseError(error)) {
    ErrorMetrics.trackError(error);
    return error;
  }

  if (error instanceof Error) {
    const systemError = new SystemError(error.message, {
      cause: error,
      context: { originalError: error.name }
    });
    ErrorMetrics.trackError(systemError);
    return systemError;
  }

  const unknownError = new SystemError('Unknown error occurred', {
    context: { originalError: String(error) }
  });
  ErrorMetrics.trackError(unknownError);
  return unknownError;
}

// ==================================================================================
// EXPORTS
// ==================================================================================

export {
  ErrorFactory,
  ErrorMetrics,
  handleError,
  isBaseError
};

// Export specific error classes for convenience
export {
  ValidationError,
  InvalidAddressError,
  InvalidAmountError,
  BusinessError,
  InsufficientLiquidityError,
  SlippageTooHighError,
  SystemError,
  DatabaseError,
  RedisError,
  BlockchainError,
  TransactionFailedError,
  ArbitrageError,
  NoProfitableRoutesError
};


// ==================================================================================
// SANITIZATION & SECURITY
// ==================================================================================

/**
 * Sanitiza datos sensibles antes de logging
 * Remueve: API keys, tokens, private keys, passwords, secrets
 */
export function sanitizeError(error: any): any {
  if (!error) return error;
  
  const sensitivePatterns = [
    /api[_-]?key/i,
    /secret/i,
    /token/i,
    /password/i,
    /private[_-]?key/i,
    /auth/i,
    /bearer/i,
    /credential/i,
  ];
  
  const sanitize = (obj: any): any => {
    if (typeof obj === 'string') {
      // Redactar valores sensibles
      for (const pattern of sensitivePatterns) {
        if (pattern.test(obj)) {
          return '[REDACTED]';
        }
      }
      // Redactar valores que parecen keys (hex strings largos)
      if (/^0x[a-fA-F0-9]{40,}$/.test(obj)) {
        return '[REDACTED_KEY]';
      }
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Redactar campos sensibles por nombre
        if (sensitivePatterns.some(pattern => pattern.test(key))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = sanitize(value);
        }
      }
      return sanitized;
    }
    
    return obj;
  };
  
  return sanitize(error);
}

// ==================================================================================
// GOOGLE SHEETS ERROR LOGGER
// ==================================================================================

export class ErrorLogger {
  private sheetsService: any;
  private sheetName: string = 'LOGERRORESEVENTOS';
  private batchQueue: any[] = [];
  private batchSize: number = 10;
  private flushInterval: number = 5000; // 5 segundos
  private flushTimer?: NodeJS.Timeout;
  
  constructor(sheetsService: any) {
    this.sheetsService = sheetsService;
  }
  
  async init(): Promise<void> {
    // Iniciar flush automático
    this.flushTimer = setInterval(() => {
      this.flush().catch(err => {
        logger.error('Failed to flush error logs to Sheets', { error: err });
      });
    }, this.flushInterval);
    
    logger.info('ErrorLogger initialized', { sheetName: this.sheetName });
  }
  
  /**
   * Registra un error en Google Sheets
   */
  async logError(error: BaseError | Error): Promise<void> {
    try {
      const sanitized = sanitizeError(error);
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        errorName: error.name,
        errorMessage: sanitized.message || String(error),
        errorCode: (error as BaseError).code || 'UNKNOWN',
        category: (error as BaseError).category || 'unknown',
        severity: (error as BaseError).severity || 'medium',
        statusCode: (error as BaseError).statusCode || 500,
        recoverable: (error as BaseError).recoverable || false,
        retryable: (error as BaseError).retryable || false,
        userId: (error as BaseError).userId || null,
        requestId: (error as BaseError).requestId || null,
        context: JSON.stringify(sanitized.context || {}),
        stack: sanitized.stack ? sanitized.stack.substring(0, 500) : null,
      };
      
      // Agregar a batch queue
      this.batchQueue.push(logEntry);
      
      // Flush si alcanzamos el tamaño del batch
      if (this.batchQueue.length >= this.batchSize) {
        await this.flush();
      }
    } catch (err) {
      logger.error('Failed to log error to Sheets', { error: err });
    }
  }
  
  /**
   * Escribe todos los errores pendientes a Sheets
   */
  private async flush(): Promise<void> {
    if (this.batchQueue.length === 0) return;
    
    const entries = [...this.batchQueue];
    this.batchQueue = [];
    
    try {
      await this.sheetsService.appendRows(this.sheetName, entries);
      logger.info(`Flushed ${entries.length} error logs to Sheets`);
    } catch (err) {
      // Re-agregar a la cola si falla
      this.batchQueue.unshift(...entries);
      throw err;
    }
  }
  
  /**
   * Cierra el logger y hace flush final
   */
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
    logger.info('ErrorLogger closed');
  }
}

// ==================================================================================
// CIRCUIT BREAKER FOR ERROR HANDLING
// ==================================================================================

interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeout: number;
  monitoringPeriod: number;
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime?: Date;
  private options: CircuitBreakerOptions;
  private failuresByEndpoint: Map<string, number> = new Map();
  
  constructor(options?: Partial<CircuitBreakerOptions>) {
    this.options = {
      failureThreshold: options?.failureThreshold || 5,
      resetTimeout: options?.resetTimeout || 60000, // 1 minuto
      monitoringPeriod: options?.monitoringPeriod || 180000, // 3 minutos
    };
  }
  
  /**
   * Registra un fallo
   */
  recordFailure(endpoint?: string): void {
    this.failures++;
    this.lastFailureTime = new Date();
    
    if (endpoint) {
      const count = this.failuresByEndpoint.get(endpoint) || 0;
      this.failuresByEndpoint.set(endpoint, count + 1);
    }
    
    // Verificar si debemos abrir el circuito
    if (this.failures >= this.options.failureThreshold) {
      this.open();
    }
    
    logger.warn('Circuit breaker recorded failure', {
      failures: this.failures,
      threshold: this.options.failureThreshold,
      state: this.state,
      endpoint,
    });
  }
  
  /**
   * Registra un éxito
   */
  recordSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.close();
    }
    this.failures = 0;
  }
  
  /**
   * Abre el circuito (bloquea nuevas ejecuciones)
   */
  private open(): void {
    this.state = CircuitState.OPEN;
    logger.alert('Circuit breaker OPENED', {
      severity: 'critical',
      component: 'circuit_breaker',
      failures: this.failures,
      threshold: this.options.failureThreshold,
    });
    
    // Programar reset automático
    setTimeout(() => {
      this.halfOpen();
    }, this.options.resetTimeout);
  }
  
  /**
   * Cierra el circuito (permite ejecuciones)
   */
  private close(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.failuresByEndpoint.clear();
    logger.info('Circuit breaker CLOSED');
  }
  
  /**
   * Pone el circuito en half-open (permite pruebas)
   */
  private halfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    logger.info('Circuit breaker HALF_OPEN - testing recovery');
  }
  
  /**
   * Verifica si se puede ejecutar una operación
   */
  canExecute(): boolean {
    if (this.state === CircuitState.OPEN) {
      return false;
    }
    return true;
  }
  
  /**
   * Obtiene el estado actual
   */
  getState(): CircuitState {
    return this.state;
  }
  
  /**
   * Obtiene estadísticas
   */
  getStats(): any {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
      failuresByEndpoint: Object.fromEntries(this.failuresByEndpoint),
    };
  }
}

// ==================================================================================
// ERROR HANDLER MIDDLEWARE
// ==================================================================================

/**
 * Crea un error handler para Express/Fastify
 */
export function createErrorHandler(errorLogger?: ErrorLogger) {
  return async (error: Error, request: any, reply: any) => {
    // Sanitizar error
    const sanitized = sanitizeError(error);
    
    // Convertir a BaseError si no lo es
    const baseError = isBaseError(error) 
      ? error 
      : ErrorFactory.fromError(error);
    
    // Log a Sheets si está disponible
    if (errorLogger) {
      await errorLogger.logError(baseError);
    }
    
    // Responder al cliente
    const statusCode = baseError.statusCode || 500;
    const response = baseError.toJSON();
    
    // No enviar stack trace en producción
    if (process.env.NODE_ENV === 'production') {
      delete response.error.stack;
    }
    
    reply.status(statusCode).send(response);
  };
}

// ==================================================================================
// GLOBAL ERROR HANDLER
// ==================================================================================

let globalErrorLogger: ErrorLogger | null = null;
let globalCircuitBreaker: CircuitBreaker | null = null;

/**
 * Inicializa el sistema global de manejo de errores
 */
export function initializeErrorSystem(sheetsService: any): void {
  globalErrorLogger = new ErrorLogger(sheetsService);
  globalErrorLogger.init();
  
  globalCircuitBreaker = new CircuitBreaker();
  
  logger.info('Global error system initialized');
}

/**
 * Obtiene el error logger global
 */
export function getErrorLogger(): ErrorLogger | null {
  return globalErrorLogger;
}

/**
 * Obtiene el circuit breaker global
 */
export function getCircuitBreaker(): CircuitBreaker | null {
  return globalCircuitBreaker;
}

// Export nuevas funciones
export {
  sanitizeError,
  ErrorLogger,
  CircuitBreaker,
  CircuitState,
  createErrorHandler,
  initializeErrorSystem,
  getErrorLogger,
  getCircuitBreaker,
};




// ==================================================================================
// DYNAMIC ERROR HANDLER SYSTEM - PROGRAMACIÓN DINÁMICA
// ==================================================================================

/**
 * Interface para handlers de errores dinámicos
 * Permite agregar nuevos handlers sin modificar código (polimorfismo)
 */
export interface ErrorHandler {
  name: string;
  priority: number;
  canHandle(error: Error): boolean;
  handle(error: Error): Promise<void> | void;
}

/**
 * Configuración de manejo de errores desde Google Sheets
 */
export interface ErrorHandlingConfig {
  errorCode: string;
  shouldLog: boolean;
  shouldAlert: boolean;
  shouldRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  customHandlers: string[]; // Nombres de handlers a ejecutar
  notes?: string;
}

/**
 * Sistema dinámico de manejo de errores
 * Programación Dinámica: Array de handlers, configuración desde Sheets
 */
export class DynamicErrorSystem {
  // Array dinámico de handlers (polimorfismo)
  private handlers: ErrorHandler[] = [];
  
  // Map de configuraciones cargadas desde Sheets
  private config: Map<string, ErrorHandlingConfig> = new Map();
  
  // Servicio de Google Sheets
  private sheetsService: any;
  
  // Interval para refresh de configuración
  private configRefreshInterval?: NodeJS.Timeout;
  private readonly CONFIG_REFRESH_INTERVAL = 300000; // 5 minutos

  constructor(sheetsService?: any) {
    this.sheetsService = sheetsService;
  }

  /**
   * Inicializa el sistema dinámico de errores
   */
  async init(): Promise<void> {
    logger.info('Initializing DynamicErrorSystem...');

    // Cargar configuración desde Sheets
    await this.loadErrorConfig();

    // Registrar handlers por defecto
    this.registerDefaultHandlers();

    // Iniciar refresh de configuración
    this.configRefreshInterval = setInterval(() => {
      this.loadErrorConfig().catch((error) => {
        logger.error('Failed to refresh error config', sanitizeError(error));
      });
    }, this.CONFIG_REFRESH_INTERVAL);

    logger.info('DynamicErrorSystem initialized', {
      handlers: this.handlers.length,
      configs: this.config.size,
    });
  }

  /**
   * Carga configuración de manejo de errores desde Google Sheets
   * Programación Dinámica: Descubrimiento dinámico de configuraciones
   */
  async loadErrorConfig(): Promise<void> {
    try {
      if (!this.sheetsService) {
        logger.warn('No sheets service configured for error config');
        return;
      }

      logger.info('Loading error handling configuration from Google Sheets...');

      // Leer hoja ERROR_HANDLING_CONFIG
      const rows = await this.sheetsService.readSheet('ERROR_HANDLING_CONFIG');

      if (!rows || rows.length === 0) {
        logger.warn('No error handling config found in Sheets');
        return;
      }

      // Limpiar configuración anterior
      this.config.clear();

      // Construir Map dinámicamente
      for (const row of rows) {
        try {
          const config: ErrorHandlingConfig = {
            errorCode: row.ERROR_CODE || '',
            shouldLog: row.SHOULD_LOG === 'TRUE' || row.SHOULD_LOG === true,
            shouldAlert: row.SHOULD_ALERT === 'TRUE' || row.SHOULD_ALERT === true,
            shouldRetry: row.SHOULD_RETRY === 'TRUE' || row.SHOULD_RETRY === true,
            maxRetries: parseInt(row.MAX_RETRIES) || 3,
            retryDelay: parseInt(row.RETRY_DELAY) || 1000,
            customHandlers: row.CUSTOM_HANDLERS ? row.CUSTOM_HANDLERS.split(',').map((h: string) => h.trim()) : [],
            notes: row.NOTES || '',
          };

          if (!config.errorCode) {
            continue;
          }

          this.config.set(config.errorCode, config);
          logger.debug(`Loaded error config: ${config.errorCode}`, { config });
        } catch (error) {
          logger.error('Failed to parse error config row', { row, error: sanitizeError(error) });
        }
      }

      logger.info('Error handling configuration loaded', {
        totalConfigs: this.config.size,
      });
    } catch (error) {
      logger.error('Failed to load error config', sanitizeError(error));
    }
  }

  /**
   * Registra un handler dinámicamente
   * Programación Dinámica: Agregar handlers sin modificar código
   */
  registerHandler(handler: ErrorHandler): void {
    // Verificar que no exista ya
    const existing = this.handlers.find(h => h.name === handler.name);
    if (existing) {
      logger.warn(`Handler ${handler.name} already registered, replacing...`);
      this.handlers = this.handlers.filter(h => h.name !== handler.name);
    }

    this.handlers.push(handler);
    
    // Ordenar por prioridad
    this.handlers.sort((a, b) => a.priority - b.priority);

    logger.info(`Handler registered: ${handler.name}`, {
      priority: handler.priority,
      totalHandlers: this.handlers.length,
    });
  }

  /**
   * Registra handlers por defecto
   */
  private registerDefaultHandlers(): void {
    // Handler para errores de Sheets
    this.registerHandler({
      name: 'sheets_error_handler',
      priority: 1,
      canHandle: (error: Error) => {
        return error.message.includes('Sheets') || error.message.includes('Google');
      },
      handle: async (error: Error) => {
        logger.error('Sheets error detected', sanitizeError(error));
        // Aquí se podría implementar lógica de reconexión
      },
    });

    // Handler para errores de blockchain
    this.registerHandler({
      name: 'blockchain_error_handler',
      priority: 2,
      canHandle: (error: Error) => {
        return error.message.includes('RPC') || 
               error.message.includes('transaction') ||
               error.message.includes('gas');
      },
      handle: async (error: Error) => {
        logger.error('Blockchain error detected', sanitizeError(error));
        // Aquí se podría implementar lógica de retry con RPC alternativo
      },
    });

    // Handler genérico
    this.registerHandler({
      name: 'generic_error_handler',
      priority: 999,
      canHandle: () => true,
      handle: async (error: Error) => {
        logger.error('Generic error', sanitizeError(error));
      },
    });
  }

  /**
   * Maneja un error dinámicamente
   * Programación Dinámica: Itera sobre handlers, aplica configuración
   */
  async handleError(error: Error): Promise<void> {
    try {
      // Obtener código de error
      const errorCode = (error as BaseError).code || 'UNKNOWN';

      // Obtener configuración
      const config = this.config.get(errorCode);

      // Aplicar configuración
      if (config) {
        if (!config.shouldLog) {
          logger.debug(`Skipping logging for ${errorCode} (config)`);
          return;
        }

        if (config.shouldAlert) {
          logger.alert(`Alert for ${errorCode}`, {
            severity: 'high',
            component: 'dynamic_error_system',
            error: sanitizeError(error),
          });
        }

        // Ejecutar custom handlers si están configurados
        if (config.customHandlers.length > 0) {
          for (const handlerName of config.customHandlers) {
            const handler = this.handlers.find(h => h.name === handlerName);
            if (handler && handler.canHandle(error)) {
              await handler.handle(error);
            }
          }
        }
      }

      // Ejecutar handlers que puedan manejar el error
      for (const handler of this.handlers) {
        if (handler.canHandle(error)) {
          logger.debug(`Executing handler: ${handler.name}`);
          await handler.handle(error);
          break; // Solo ejecutar el primer handler que pueda manejarlo
        }
      }
    } catch (handlerError) {
      logger.error('Error in error handler', sanitizeError(handlerError));
    }
  }

  /**
   * Obtiene estadísticas del sistema
   */
  getStats(): any {
    return {
      registeredHandlers: this.handlers.length,
      handlers: this.handlers.map(h => ({ name: h.name, priority: h.priority })),
      configuredErrors: this.config.size,
      configs: Array.from(this.config.entries()).map(([code, config]) => ({
        errorCode: code,
        shouldLog: config.shouldLog,
        shouldAlert: config.shouldAlert,
        shouldRetry: config.shouldRetry,
      })),
    };
  }

  /**
   * Cierra el sistema
   */
  async close(): Promise<void> {
    if (this.configRefreshInterval) {
      clearInterval(this.configRefreshInterval);
    }
    logger.info('DynamicErrorSystem closed');
  }
}

// ==================================================================================
// GLOBAL DYNAMIC ERROR SYSTEM
// ==================================================================================

let dynamicErrorSystem: DynamicErrorSystem | null = null;

/**
 * Inicializa el sistema dinámico de errores
 */
export async function initDynamicErrorSystem(sheetsService: any): Promise<DynamicErrorSystem> {
  if (dynamicErrorSystem) {
    logger.warn('DynamicErrorSystem already initialized');
    return dynamicErrorSystem;
  }

  dynamicErrorSystem = new DynamicErrorSystem(sheetsService);
  await dynamicErrorSystem.init();
  return dynamicErrorSystem;
}

/**
 * Obtiene el sistema dinámico de errores
 */
export function getDynamicErrorSystem(): DynamicErrorSystem | null {
  return dynamicErrorSystem;
}

// Export del sistema dinámico
export {
  DynamicErrorSystem,
  ErrorHandler,
  ErrorHandlingConfig,
};

