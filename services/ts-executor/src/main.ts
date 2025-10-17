/**
 * main.ts
 * 
 * Punto de entrada principal del servicio ts-executor
 * Inicializa y ejecuta el ParallelOrchestrator
 * 
 * @author ARBITRAGEXPLUS2025
 */

import dotenv from 'dotenv';
import { ParallelOrchestrator, OrchestratorConfig } from './orchestrator/ParallelOrchestrator';
import { ethers } from 'ethers';

// Cargar variables de entorno
dotenv.config();

// ==================================================================================
// CONFIGURACIÓN
// ==================================================================================

const config: OrchestratorConfig = {
  maxParallelOperations: parseInt(process.env.MAX_PARALLEL_OPERATIONS || '40'),
  
  // Múltiples wallets para distribuir carga
  wallets: [
    process.env.PRIVATE_KEY_1,
    process.env.PRIVATE_KEY_2,
    process.env.PRIVATE_KEY_3
  ].filter(Boolean) as string[],
  
  // Múltiples RPCs para load balancing y redundancia
  rpcUrls: [
    process.env.RPC_URL_1,
    process.env.RPC_URL_2,
    process.env.RPC_URL_3
  ].filter(Boolean) as string[],
  
  chainId: parseInt(process.env.CHAIN_ID || '1'),
  flashLoanArbitrageAddress: process.env.FLASH_LOAN_ARBITRAGE_ADDRESS || '',
  batchExecutorAddress: process.env.BATCH_EXECUTOR_ADDRESS,
  autoScaling: process.env.AUTO_SCALING === 'true',
  minProfitUSD: parseFloat(process.env.MIN_PROFIT_USD || '10'),
  refreshIntervalMs: parseInt(process.env.REFRESH_INTERVAL_MS || '5000')
};

// ==================================================================================
// VALIDACIÓN DE CONFIGURACIÓN
// ==================================================================================

function validateConfig(): void {
  const errors: string[] = [];
  
  if (config.wallets.length === 0) {
    errors.push('No wallets configured (PRIVATE_KEY_1, PRIVATE_KEY_2, etc.)');
  }
  
  if (config.rpcUrls.length === 0) {
    errors.push('No RPC URLs configured (RPC_URL_1, RPC_URL_2, etc.)');
  }
  
  if (!config.flashLoanArbitrageAddress) {
    errors.push('FLASH_LOAN_ARBITRAGE_ADDRESS not configured');
  }
  
  if (!ethers.utils.isAddress(config.flashLoanArbitrageAddress)) {
    errors.push('FLASH_LOAN_ARBITRAGE_ADDRESS is not a valid address');
  }
  
  if (config.batchExecutorAddress && !ethers.utils.isAddress(config.batchExecutorAddress)) {
    errors.push('BATCH_EXECUTOR_ADDRESS is not a valid address');
  }
  
  if (errors.length > 0) {
    console.error('❌ Configuration errors:');
    errors.forEach(error => console.error(`   - ${error}`));
    process.exit(1);
  }
}

// ==================================================================================
// MAIN
// ==================================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  ARBITRAGEXPLUS2025 - Transaction Executor Service     ║');
  console.log('║  Parallel Orchestrator for 40+ Simultaneous Operations║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  // Validar configuración
  validateConfig();
  
  // Imprimir configuración
  console.log('📋 Configuration:');
  console.log(`   Max parallel operations: ${config.maxParallelOperations}`);
  console.log(`   Wallets configured: ${config.wallets.length}`);
  console.log(`   RPC endpoints: ${config.rpcUrls.length}`);
  console.log(`   Chain ID: ${config.chainId}`);
  console.log(`   FlashLoanArbitrage: ${config.flashLoanArbitrageAddress}`);
  console.log(`   BatchExecutor: ${config.batchExecutorAddress || 'Not configured'}`);
  console.log(`   Min profit USD: $${config.minProfitUSD}`);
  console.log(`   Refresh interval: ${config.refreshIntervalMs}ms`);
  console.log(`   Auto-scaling: ${config.autoScaling ? 'Enabled' : 'Disabled'}\n`);
  
  // Crear orquestador
  const orchestrator = new ParallelOrchestrator(config);
  
  // Monitorear estadísticas cada 30 segundos
  const statsInterval = setInterval(() => {
    orchestrator.printStats();
  }, 30000);
  
  // Manejo de señales para shutdown graceful
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 Received SIGINT, shutting down gracefully...');
    clearInterval(statsInterval);
    await orchestrator.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Received SIGTERM, shutting down gracefully...');
    clearInterval(statsInterval);
    await orchestrator.stop();
    process.exit(0);
  });
  
  // Manejo de errores no capturados
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught exception:', error);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
    process.exit(1);
  });
  
  // Iniciar orquestador
  try {
    await orchestrator.start();
  } catch (error) {
    console.error('❌ Failed to start orchestrator:', error);
    process.exit(1);
  }
}

// Ejecutar
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

