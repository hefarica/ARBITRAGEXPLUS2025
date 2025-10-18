/**
 * ============================================================================
 * ARCHIVO: ./services/api-server/src/lib/utils.ts
 * SERVICIO: api-server
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ethers, crypto, ./logger
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: RateLimiter, PerformanceTimer
 *   FUNCIONES: formatDuration, truncateString, getUnixTimestamp
 * 
 * 📤 SALIDA DE DATOS:
 *   EXPORTS: formatDuration, truncateString, getUnixTimestamp
 * 
 * 🔗 DEPENDENCIAS:
 *   - ethers
 *   - crypto
 *   - ./logger
 * 
 * ============================================================================
 */

/**
 * ARBITRAGEXPLUS2025 - Utility Functions
 * 
 * Funciones utilitarias centralizadas para operaciones comunes,
 * validaciones, conversiones, formateo y manipulación de datos
 * específicos para el sistema de arbitraje DeFi.
 */

import { ethers } from 'ethers';
import crypto from 'crypto';
import { logger } from './logger';
import { 
  Address, 
  Hash, 
  ChainId, 
  TokenSymbol, 
  BigNumberish,
  isValidAddress,
  isValidHash,
  isValidChainId
} from './types';

// ==================================================================================
// ADDRESS & VALIDATION UTILITIES
// ==================================================================================

/**
 * Normalize Ethereum address to checksummed format
 */
export function normalizeAddress(address: string): Address {
  try {
    if (!isValidAddress(address)) {
      throw new Error(`Invalid address format: ${address}`);
    }
    return ethers.getAddress(address) as Address;
  } catch (error) {
    throw new Error(`Failed to normalize address ${address}: ${error.message}`);
  }
}

/**
 * Validate and normalize transaction hash
 */
export function normalizeHash(hash: string): Hash {
  const normalized = hash.toLowerCase();
  if (!isValidHash(normalized)) {
    throw new Error(`Invalid hash format: ${hash}`);
  }
  return normalized as Hash;
}

/**
 * Check if two addresses are equal (case-insensitive)
 */
export function addressesEqual(addr1: string, addr2: string): boolean {
  try {
    return normalizeAddress(addr1) === normalizeAddress(addr2);
  } catch {
    return false;
  }
}

/**
 * Generate a random Ethereum address (for testing)
 */
export function generateRandomAddress(): Address {
  const randomBytes = crypto.randomBytes(20);
  return normalizeAddress(`0x${randomBytes.toString('hex')}`);
}

// ==================================================================================
// BIGINT & NUMBER UTILITIES
// ==================================================================================

/**
 * Convert various number formats to BigInt
 */
export function toBigInt(value: BigNumberish): bigint {
  if (typeof value === 'bigint') {
    return value;
  }
  
  if (typeof value === 'string') {
    // Handle hex strings
    if (value.startsWith('0x')) {
      return BigInt(value);
    }
    
    // Handle decimal strings
    if (/^\d+(\.\d+)?$/.test(value)) {
      // If it has decimals, we need to know the decimal places
      // For now, assume it's already in wei/smallest unit
      return BigInt(value.split('.')[0]);
    }
    
    return BigInt(value);
  }
  
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error('Cannot convert non-integer number to BigInt');
    }
    return BigInt(value);
  }
  
  throw new Error(`Cannot convert ${typeof value} to BigInt`);
}

/**
 * Format BigInt with decimals for display
 */
export function formatUnits(value: BigNumberish, decimals: number = 18): string {
  const bigIntValue = toBigInt(value);
  const divisor = 10n ** BigInt(decimals);
  const quotient = bigIntValue / divisor;
  const remainder = bigIntValue % divisor;
  
  if (remainder === 0n) {
    return quotient.toString();
  }
  
  const remainderStr = remainder.toString().padStart(decimals, '0');
  const trimmedRemainder = remainderStr.replace(/0+$/, '');
  
  if (trimmedRemainder === '') {
    return quotient.toString();
  }
  
  return `${quotient}.${trimmedRemainder}`;
}

/**
 * Parse string with decimals to BigInt
 */
export function parseUnits(value: string, decimals: number = 18): bigint {
  if (!value || typeof value !== 'string') {
    throw new Error('Invalid value for parseUnits');
  }
  
  const [integer, decimal = ''] = value.split('.');
  
  if (decimal.length > decimals) {
    throw new Error(`Too many decimal places: ${decimal.length} > ${decimals}`);
  }
  
  const paddedDecimal = decimal.padEnd(decimals, '0');
  const combined = integer + paddedDecimal;
  
  return BigInt(combined);
}

/**
 * Calculate percentage change between two values
 */
export function calculatePercentageChange(oldValue: number, newValue: number): number {
  if (oldValue === 0) {
    return newValue > 0 ? 100 : 0;
  }
  return ((newValue - oldValue) / oldValue) * 100;
}

/**
 * Calculate slippage percentage
 */
export function calculateSlippage(expectedAmount: BigNumberish, actualAmount: BigNumberish): number {
  const expected = Number(formatUnits(expectedAmount));
  const actual = Number(formatUnits(actualAmount));
  
  if (expected === 0) return 0;
  
  return Math.abs((expected - actual) / expected) * 100;
}

// ==================================================================================
// STRING & FORMATTING UTILITIES
// ==================================================================================

/**
 * Truncate string with ellipsis
 */
export function truncateString(str: string, length: number, ellipsis: string = '...'): string {
  if (str.length <= length) return str;
  return str.slice(0, length - ellipsis.length) + ellipsis;
}

/**
 * Format address for display (show first and last few characters)
 */
export function formatAddress(address: string, startChars: number = 6, endChars: number = 4): string {
  if (!address) return '';
  
  if (address.length <= startChars + endChars) {
    return address;
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Format hash for display
 */
export function formatHash(hash: string, length: number = 10): string {
  if (!hash) return '';
  return `${hash.slice(0, length)}...`;
}

/**
 * Format number with thousands separators
 */
export function formatNumber(
  value: number, 
  options?: {
    decimals?: number;
    compact?: boolean;
    currency?: boolean;
    percentage?: boolean;
  }
): string {
  const opts = {
    decimals: 2,
    compact: false,
    currency: false,
    percentage: false,
    ...options
  };

  if (opts.percentage) {
    return new Intl.NumberFormat('en-US', {
      style: 'percent',
      minimumFractionDigits: opts.decimals,
      maximumFractionDigits: opts.decimals
    }).format(value / 100);
  }

  if (opts.currency) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: opts.decimals,
      maximumFractionDigits: opts.decimals,
      notation: opts.compact ? 'compact' : 'standard'
    }).format(value);
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: opts.decimals,
    maximumFractionDigits: opts.decimals,
    notation: opts.compact ? 'compact' : 'standard'
  }).format(value);
}

/**
 * Format duration in milliseconds to human readable format
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  if (seconds > 0) return `${seconds}s`;
  return `${ms}ms`;
}

// ==================================================================================
// DATE & TIME UTILITIES
// ==================================================================================

/**
 * Get timestamp in seconds (Unix timestamp)
 */
export function getUnixTimestamp(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get timestamp in milliseconds
 */
export function getTimestamp(): number {
  return Date.now();
}

/**
 * Convert Unix timestamp to Date
 */
export function fromUnixTimestamp(timestamp: number): Date {
  return new Date(timestamp * 1000);
}

/**
 * Check if date is recent (within specified minutes)
 */
export function isRecent(date: Date, minutes: number = 5): boolean {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = diffMs / (1000 * 60);
  return diffMinutes <= minutes;
}

/**
 * Get date range for timeframe
 */
export function getDateRange(timeframe: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();

  switch (timeframe.toLowerCase()) {
    case '1h':
      from.setHours(from.getHours() - 1);
      break;
    case '4h':
      from.setHours(from.getHours() - 4);
      break;
    case '1d':
    case '24h':
      from.setDate(from.getDate() - 1);
      break;
    case '7d':
    case '1w':
      from.setDate(from.getDate() - 7);
      break;
    case '30d':
    case '1m':
      from.setMonth(from.getMonth() - 1);
      break;
    case '90d':
    case '3m':
      from.setMonth(from.getMonth() - 3);
      break;
    case '1y':
      from.setFullYear(from.getFullYear() - 1);
      break;
    default:
      throw new Error(`Unsupported timeframe: ${timeframe}`);
  }

  return { from, to };
}

// ==================================================================================
// ARRAY & OBJECT UTILITIES
// ==================================================================================

/**
 * Remove duplicates from array based on a key function
 */
export function uniqueBy<T>(array: T[], keyFn: (item: T) => any): T[] {
  const seen = new Set();
  return array.filter(item => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Group array items by a key function
 */
export function groupBy<T>(array: T[], keyFn: (item: T) => string | number): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  
  for (const item of array) {
    const key = String(keyFn(item));
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  }
  
  return groups;
}

/**
 * Chunk array into smaller arrays
 */
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  
  return chunks;
}

/**
 * Deep merge objects
 */
export function deepMerge<T extends Record<string, any>>(target: T, ...sources: Partial<T>[]): T {
  if (!sources.length) return target;
  
  const source = sources.shift();
  if (!source) return target;

  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {} as any;
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key] as any;
    }
  }

  return deepMerge(target, ...sources);
}

/**
 * Pick specific keys from object
 */
export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T, 
  keys: K[]
): Pick<T, K> {
  const result: any = {};
  
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  
  return result;
}

/**
 * Omit specific keys from object
 */
export function omit<T extends Record<string, any>, K extends keyof T>(
  obj: T, 
  keys: K[]
): Omit<T, K> {
  const result: any = { ...obj };
  
  for (const key of keys) {
    delete result[key];
  }
  
  return result;
}

// ==================================================================================
// CRYPTO & SECURITY UTILITIES
// ==================================================================================

/**
 * Generate cryptographically secure random string
 */
export function generateSecureId(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate UUID v4
 */
export function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Hash string using SHA256
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Create HMAC signature
 */
export function createHMAC(message: string, secret: string, algorithm: string = 'sha256'): string {
  return crypto.createHmac(algorithm, secret).update(message).digest('hex');
}

/**
 * Verify HMAC signature
 */
export function verifyHMAC(message: string, signature: string, secret: string, algorithm: string = 'sha256'): boolean {
  const expected = createHMAC(message, secret, algorithm);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ==================================================================================
// ASYNC & PROMISE UTILITIES
// ==================================================================================

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry async operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options?: {
    retries?: number;
    delay?: number;
    backoffMultiplier?: number;
    maxDelay?: number;
    shouldRetry?: (error: any) => boolean;
  }
): Promise<T> {
  const opts = {
    retries: 3,
    delay: 1000,
    backoffMultiplier: 2,
    maxDelay: 10000,
    shouldRetry: () => true,
    ...options
  };

  let lastError: any;

  for (let attempt = 0; attempt <= opts.retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === opts.retries || !opts.shouldRetry(error)) {
        throw error;
      }

      const delay = Math.min(opts.delay * Math.pow(opts.backoffMultiplier, attempt), opts.maxDelay);
      
      logger.warn(`Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${opts.retries + 1})`, {
        error: error.message,
        attempt: attempt + 1,
        delay
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Timeout promise
 */
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage?: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(errorMessage || `Operation timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

/**
 * Batch process array with concurrency limit
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  options?: {
    batchSize?: number;
    concurrency?: number;
    delayBetweenBatches?: number;
  }
): Promise<R[]> {
  const opts = {
    batchSize: 10,
    concurrency: 3,
    delayBetweenBatches: 0,
    ...options
  };

  const results: R[] = [];
  const batches = chunk(items, opts.batchSize);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    
    // Process batch with concurrency limit
    const batchPromises = batch.map(item => processor(item));
    const batchChunks = chunk(batchPromises, opts.concurrency);
    
    for (const chunkPromises of batchChunks) {
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    // Delay between batches if specified
    if (i < batches.length - 1 && opts.delayBetweenBatches > 0) {
      await sleep(opts.delayBetweenBatches);
    }
  }

  return results;
}

// ==================================================================================
// RATE LIMITING UTILITIES
// ==================================================================================

/**
 * Simple in-memory rate limiter
 */
export class RateLimiter {
  private requests = new Map<string, number[]>();

  constructor(
    private maxRequests: number,
    private windowMs: number
  ) {}

  isAllowed(key: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }

  getRemainingRequests(key: string): number {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxRequests - validRequests.length);
  }

  getResetTime(key: string): number {
    const requests = this.requests.get(key) || [];
    if (requests.length === 0) return 0;
    
    return Math.min(...requests) + this.windowMs;
  }
}

// ==================================================================================
// PERFORMANCE MONITORING UTILITIES
// ==================================================================================

/**
 * Performance timer for measuring operation duration
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;

  constructor() {
    this.startTime = performance.now();
  }

  stop(): number {
    this.endTime = performance.now();
    return this.getDuration();
  }

  getDuration(): number {
    const end = this.endTime || performance.now();
    return Math.round(end - this.startTime);
  }

  static measure<T>(operation: () => T): { result: T; duration: number } {
    const timer = new PerformanceTimer();
    const result = operation();
    const duration = timer.stop();
    return { result, duration };
  }

  static async measureAsync<T>(operation: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const timer = new PerformanceTimer();
    const result = await operation();
    const duration = timer.stop();
    return { result, duration };
  }
}

// ==================================================================================
// EXPORT ALL UTILITIES
// ==================================================================================

export {
  // Address utilities
  normalizeAddress,
  normalizeHash,
  addressesEqual,
  generateRandomAddress,

  // Number utilities
  toBigInt,
  formatUnits,
  parseUnits,
  calculatePercentageChange,
  calculateSlippage,

  // String utilities
  truncateString,
  formatAddress,
  formatHash,
  formatNumber,
  formatDuration,

  // Date utilities
  getUnixTimestamp,
  getTimestamp,
  fromUnixTimestamp,
  isRecent,
  getDateRange,

  // Array utilities
  uniqueBy,
  groupBy,
  chunk,
  deepMerge,
  pick,
  omit,

  // Crypto utilities
  generateSecureId,
  generateUUID,
  sha256,
  createHMAC,
  verifyHMAC,

  // Async utilities
  sleep,
  retry,
  withTimeout,
  batchProcess,

  // Performance utilities
  RateLimiter,
  PerformanceTimer
};