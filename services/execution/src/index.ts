/**
 * ============================================================================
 * ARCHIVO: ./services/execution/src/index.ts
 * SERVICIO: execution
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ./parallel-executor, dotenv, ./logger
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: main
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 *   - ./parallel-executor
 *   - dotenv
 *   - ./logger
 * 
 * ============================================================================
 */

/**
 * @file index.ts
 * @description Entry point para el servicio de ejecución paralela
 * 
 * ARBITRAGEXPLUS2025 - Parallel Execution Service
 * 
 * Este servicio orquesta la ejecución de hasta 40 operaciones de arbitraje
 * simultáneas en múltiples blockchains.
 */

import dotenv from 'dotenv';
import { ParallelExecutor } from './parallel-executor';
import { Logger } from './logger';

// Cargar variables de entorno
dotenv.config();

// ==================================================================================
// CONFIGURACIÓN
// ==================================================================================

const config = {
  maxConcurrentOps: parseInt(process.env.MAX_CONCURRENT_OPS || '40'),
  minOracleConfirmations: parseInt(process.env.MIN_ORACLE_CONFIRMATIONS || '2'),
  maxSlippageBps: parseInt(process.env.MAX_SLIPPAGE_BPS || '100'),
  gasLimitPerOp: parseInt(process.env.GAS_LIMIT_PER_OP || '500000'),
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
  retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '1000'),
  circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
  sheetsRefreshIntervalMs: parseInt(process.env.SHEETS_REFRESH_INTERVAL_MS || '10000'),
};

// ==================================================================================
// INICIALIZACIÓN
// ==================================================================================

const logger = new Logger('Main');

async function main() {
  logger.info('Starting ARBITRAGEXPLUS2025 Parallel Execution Service...');
  logger.info('Configuration:', config);
  
  try {
    // Crear executor
    const executor = new ParallelExecutor(config);
    
    // Inicializar
    await executor.initialize();
    
    logger.info('Executor initialized successfully');
    
    // Manejar señales de terminación
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      executor.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      executor.stop();
      process.exit(0);
    });
    
    // Iniciar ejecución
    await executor.start();
  } catch (error) {
    logger.error('Fatal error in main', error);
    process.exit(1);
  }
}

// ==================================================================================
// EJECUCIÓN
// ==================================================================================

main().catch((error) => {
  logger.error('Unhandled error in main', error);
  process.exit(1);
});

// ==================================================================================
// EXPORTS
// ==================================================================================

export { ParallelExecutor } from './parallel-executor';
export { TransactionBuilder } from './transaction-builder';
export { OracleValidator } from './oracle-validator';
export { GasManager } from './gas-manager';
export { Logger } from './logger';

