/**
 * ============================================================================
 * ARCHIVO: ./services/monitoring/src/index.ts
 * SERVICIO: monitoring
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: ./chain-listener, ./logger, dotenv
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: main
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 *   - ./chain-listener
 *   - ./logger
 *   - dotenv
 * 
 * ============================================================================
 */

/**
 * @file index.ts
 * @description Entry point para el servicio de monitoreo on-chain
 * 
 * ARBITRAGEXPLUS2025 - On-Chain Monitoring Service
 * 
 * Este servicio monitorea eventos on-chain en tiempo real usando WebSockets
 * y envía alertas a múltiples canales (Sheets, Telegram, Discord, etc.)
 */

import dotenv from 'dotenv';
import { ChainListener } from './chain-listener';
import { GoogleSheetsClient } from './google-sheets-client';
import { Logger } from './logger';

// Cargar variables de entorno
dotenv.config();

// ==================================================================================
// CONFIGURACIÓN
// ==================================================================================

const logger = new Logger('Main');

// ==================================================================================
// INICIALIZACIÓN
// ==================================================================================

async function main() {
  logger.info('Starting ARBITRAGEXPLUS2025 On-Chain Monitoring Service...');
  
  try {
    // Crear Sheets client
    const sheetsClient = new GoogleSheetsClient();
    
    // Obtener configuración de chains desde Sheets
    logger.info('Loading chain configurations from Google Sheets...');
    const chainConfigs = await sheetsClient.getChainConfigs();
    
    if (chainConfigs.length === 0) {
      logger.warn('No chain configurations found in Sheets');
      logger.info('Using default testnet configuration...');
      
      // Configuración por defecto para Sepolia
      chainConfigs.push({
        chainId: 11155111,
        name: 'Sepolia',
        rpcUrl: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
        wsUrl: process.env.SEPOLIA_WS_URL || 'wss://ethereum-sepolia.publicnode.com',
        arbitrageManagerAddress: process.env.ARBITRAGE_MANAGER_SEPOLIA || '0x0000000000000000000000000000000000000000',
        enabled: true,
      });
    }
    
    logger.info('Chain configurations loaded', {
      chains: chainConfigs.length,
    });
    
    // Crear listener
    const listener = new ChainListener();
    
    // Inicializar con configuraciones
    await listener.initialize(chainConfigs);
    
    // Configurar event handlers
    listener.on('batchExecuted', (event) => {
      logger.info('Batch executed', {
        chain: event.chain,
        batchId: event.batchId.toString(),
        profit: event.totalProfit,
      });
    });
    
    listener.on('operationFailed', (event) => {
      logger.warn('Operation failed', {
        chain: event.chain,
        batchId: event.batchId.toString(),
        reason: event.reason,
      });
    });
    
    listener.on('circuitBreakerTriggered', (event) => {
      logger.error('Circuit breaker triggered!', {
        chain: event.chain,
        batchId: event.batchId.toString(),
        reason: event.reason,
      });
    });
    
    // Iniciar escucha
    await listener.startListening();
    
    logger.info('Monitoring service started successfully');
    
    // Mostrar estadísticas cada minuto
    setInterval(() => {
      const stats = listener.getStats();
      logger.info('Current statistics', stats);
    }, 60000);
    
    // Manejar señales de terminación
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await listener.stopListening();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await listener.stopListening();
      process.exit(0);
    });
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

export { ChainListener } from './chain-listener';
export { AlertManager } from './alert-manager';
export { Logger } from './logger';

