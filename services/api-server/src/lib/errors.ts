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