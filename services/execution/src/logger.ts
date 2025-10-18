/**
 * @file logger.ts
 * @description Logger simple para servicios de ejecución
 */

export class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  info(message: string, meta?: any): void {
    console.log(`[${this.context}] INFO: ${message}`, meta || '');
  }
  
  debug(message: string, meta?: any): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.log(`[${this.context}] DEBUG: ${message}`, meta || '');
    }
  }
  
  warn(message: string, meta?: any): void {
    console.warn(`[${this.context}] WARN: ${message}`, meta || '');
  }
  
  error(message: string, error?: any): void {
    console.error(`[${this.context}] ERROR: ${message}`, error || '');
  }
}

