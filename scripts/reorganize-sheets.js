/**
 * ============================================================================
 * ARCHIVO: ./scripts/reorganize-sheets.js
 * SERVICIO: reorganize-sheets.js
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: reorganizeSheets
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

const { google } = require('googleapis');
const fs = require('fs');

const SPREADSHEET_ID = '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ';
const CREDENTIALS_PATH = '/home/ubuntu/ARBITRAGEXPLUS2025/keys/gsheets-sa.json';

// Schema reorganizado con campos críticos al principio
const OPTIMIZED_SCHEMA = {
  BLOCKCHAINS: [
    // Campos Críticos (1-10) - Siempre visibles
    'CHAIN_ID', 'CHAIN_NAME', 'IS_ACTIVE', 'PRIORITY',
    'NETWORK_TYPE', 'IS_TESTNET', 'CHAIN_SYMBOL', 'NATIVE_TOKEN_SYMBOL',
    'RPC_URL_PRIMARY', 'EXPLORER_URL',
    
    // Configuración RPC (11-20)
    'RPC_URL_SECONDARY', 'RPC_URL_FALLBACK', 'RPC_URL_ARCHIVE',
    'WS_URL', 'WS_URL_FALLBACK',
    'RPC_TIMEOUT_MS', 'RPC_MAX_RETRIES', 'RPC_RETRY_DELAY_MS',
    'SUPPORTS_EIP1559', 'SUPPORTS_FLASHBOTS',
    
    // Blockchain Info (21-30)
    'BLOCK_TIME_MS', 'CONFIRMATION_BLOCKS', 'FINALITY_BLOCKS',
    'CHAIN_LINK_SUPPORTED', 'PYTH_SUPPORTED',
    'NATIVE_TOKEN_DECIMALS', 'NATIVE_TOKEN_ADDRESS',
    'WRAPPED_NATIVE_ADDRESS', 'STABLE_TOKEN_ADDRESS',
    'MULTICALL_ADDRESS',
    
    // Gas & Fees (31-40)
    'GAS_PRICE_ORACLE_URL', 'GAS_PRICE_MULTIPLIER',
    'MAX_GAS_PRICE_GWEI', 'MIN_GAS_PRICE_GWEI',
    'PRIORITY_FEE_PERCENTILE', 'GAS_BUFFER_PERCENT',
    'GAS_ESTIMATION_BUFFER', 'MAX_GAS_LIMIT',
    'NATIVE_TRANSFER_GAS', 'ERC20_TRANSFER_GAS',
    
    // Monitoring & Stats (41-50)
    'HEALTH_CHECK_URL', 'HEALTH_CHECK_INTERVAL_MS',
    'LAST_BLOCK_CHECKED', 'LAST_HEALTH_CHECK',
    'SUCCESS_RATE_PERCENT', 'AVG_RESPONSE_TIME_MS',
    'TOTAL_TRANSACTIONS', 'FAILED_TRANSACTIONS',
    'LAST_UPDATED', 'NOTES'
  ],
  
  DEXES: [
    // Campos Críticos (1-15)
    'DEX_ID', 'DEX_NAME', 'IS_ACTIVE', 'PRIORITY',
    'CHAIN_ID', 'DEX_TYPE', 'PROTOCOL_VERSION', 'PROTOCOL_TYPE',
    'AMM_TYPE', 'ROUTER_ADDRESS', 'FACTORY_ADDRESS',
    'QUOTER_ADDRESS', 'POSITION_MANAGER_ADDRESS',
    'FEE_BPS', 'DYNAMIC_FEE_ENABLED',
    
    // URLs & APIs (16-30)
    'API_URL', 'API_KEY_REQUIRED', 'API_KEY_ENV_VAR',
    'WS_URL', 'WS_SUPPORTED', 'WS_RECONNECT_DELAY_MS',
    'SUBGRAPH_URL', 'SUBGRAPH_FALLBACK_URL',
    'DOCS_URL', 'EXPLORER_URL',
    'GITHUB_URL', 'TWITTER_URL', 'DISCORD_URL',
    'TELEGRAM_URL', 'WEBSITE_URL',
    
    // Features & Capabilities (31-50)
    'SUPPORTS_BATCH_REQUESTS', 'SUPPORTS_MULTICALL',
    'SUPPORTS_CONCENTRATED_LIQUIDITY', 'SUPPORTS_STABLE_POOLS',
    'SUPPORTS_WEIGHTED_POOLS', 'SUPPORTS_CUSTOM_CURVES',
    'SUPPORTS_FLASH_SWAPS', 'SUPPORTS_LIMIT_ORDERS',
    'SUPPORTS_TWAP_ORACLE', 'SUPPORTS_PRICE_IMPACT_PROTECTION',
    'MIN_LIQUIDITY_USD', 'MAX_SLIPPAGE_BPS',
    'MAX_HOPS', 'MAX_SPLITS',
    'GAS_ESTIMATE_MULTIPLIER', 'EXECUTION_TIMEOUT_MS',
    'RATE_LIMIT_PER_SECOND', 'RATE_LIMIT_PER_MINUTE',
    'CACHE_TTL_MS', 'RETRY_MAX_ATTEMPTS',
    
    // Stats & Monitoring (51-70)
    'TVL_USD', 'VOLUME_24H_USD', 'VOLUME_7D_USD',
    'FEES_24H_USD', 'FEES_7D_USD',
    'TOTAL_POOLS', 'ACTIVE_POOLS',
    'TOTAL_TOKENS', 'ACTIVE_TOKENS',
    'LAST_SYNC_TIME', 'SYNC_INTERVAL_MS',
    'SUCCESS_RATE_PERCENT', 'AVG_RESPONSE_TIME_MS',
    'TOTAL_REQUESTS', 'FAILED_REQUESTS',
    'LAST_ERROR', 'LAST_ERROR_TIME',
    'HEALTH_STATUS', 'HEALTH_CHECK_TIME',
    'LAST_UPDATED', 'NOTES',
    
    // Resto de campos técnicos (71-200)
    ...Array.from({ length: 130 }, (_, i) => `DEX_FIELD_${i + 71}`)
  ],
  
  ASSETS: [
    // Campos Críticos (1-15)
    'TOKEN_SYMBOL', 'TOKEN_NAME', 'IS_ACTIVE', 'IS_VERIFIED',
    'CHAIN_ID', 'TOKEN_ADDRESS', 'TOKEN_TYPE', 'TOKEN_STANDARD',
    'DECIMALS', 'IS_STABLECOIN', 'IS_WRAPPED',
    'COINGECKO_ID', 'COINMARKETCAP_ID',
    'PYTH_PRICE_FEED_ID', 'CHAINLINK_FEED',
    
    // Price & Market Data (16-30)
    'PRICE_USD', 'PRICE_NATIVE', 'PRICE_BTC', 'PRICE_ETH',
    'MARKET_CAP_USD', 'TOTAL_SUPPLY', 'CIRCULATING_SUPPLY',
    'MAX_SUPPLY', 'FULLY_DILUTED_VALUATION',
    'VOLUME_24H_USD', 'VOLUME_CHANGE_24H_PERCENT',
    'PRICE_CHANGE_24H_PERCENT', 'PRICE_CHANGE_7D_PERCENT',
    'PRICE_CHANGE_30D_PERCENT', 'ATH_USD',
    
    // Trading Info (31-50)
    'MIN_TRADE_AMOUNT', 'MAX_TRADE_AMOUNT',
    'LIQUIDITY_USD', 'LIQUIDITY_NATIVE',
    'HOLDER_COUNT', 'TRANSFER_COUNT_24H',
    'UNIQUE_TRADERS_24H', 'BUY_COUNT_24H', 'SELL_COUNT_24H',
    'AVG_TRADE_SIZE_USD', 'LARGEST_TRADE_24H_USD',
    'PRICE_IMPACT_1K_USD', 'PRICE_IMPACT_10K_USD', 'PRICE_IMPACT_100K_USD',
    'SLIPPAGE_TOLERANCE_BPS', 'GAS_ESTIMATE_TRANSFER',
    'GAS_ESTIMATE_SWAP', 'IS_TAXED', 'BUY_TAX_PERCENT', 'SELL_TAX_PERCENT',
    
    // Contract & Security (51-70)
    'CONTRACT_VERIFIED', 'CONTRACT_AUDIT_URL',
    'SECURITY_SCORE', 'HONEYPOT_RISK',
    'OWNER_ADDRESS', 'OWNER_BALANCE_PERCENT',
    'TOP_10_HOLDERS_PERCENT', 'LP_LOCKED',
    'LP_LOCK_UNTIL', 'MINT_FUNCTION_DISABLED',
    'PROXY_CONTRACT', 'PAUSABLE',
    'BLACKLIST_FUNCTION', 'WHITELIST_ONLY',
    'MAX_TX_AMOUNT', 'MAX_WALLET_AMOUNT',
    'COOLDOWN_ENABLED', 'ANTI_BOT_ENABLED',
    'TRADING_ENABLED_TIME', 'LAUNCH_DATE',
    
    // Metadata (71-90)
    'LOGO_URL', 'WEBSITE_URL', 'TWITTER_URL',
    'TELEGRAM_URL', 'DISCORD_URL', 'GITHUB_URL',
    'WHITEPAPER_URL', 'DOCS_URL',
    'DESCRIPTION', 'CATEGORY', 'TAGS',
    'PROJECT_TEAM', 'INVESTORS',
    'LAST_UPDATED', 'DATA_SOURCE',
    'CONFIDENCE_SCORE', 'ALERT_ENABLED',
    'ALERT_PRICE_ABOVE', 'ALERT_PRICE_BELOW',
    'NOTES',
    
    // Resto de campos técnicos (91-400)
    ...Array.from({ length: 310 }, (_, i) => `ASSET_FIELD_${i + 91}`)
  ],
  
  POOLS: [
    // Campos Críticos (1-15)
    'POOL_ID', 'POOL_ADDRESS', 'IS_ACTIVE', 'IS_VERIFIED',
    'DEX_ID', 'CHAIN_ID', 'POOL_TYPE', 'PROTOCOL_VERSION',
    'TOKEN_A', 'TOKEN_B', 'TOKEN_C',
    'FEE_BPS', 'TICK_SPACING', 'SQRT_PRICE_X96',
    'LIQUIDITY',
    
    // Pool Stats (16-30)
    'TVL_USD', 'TVL_TOKEN_A', 'TVL_TOKEN_B',
    'VOLUME_24H_USD', 'VOLUME_7D_USD',
    'FEES_24H_USD', 'FEES_7D_USD',
    'APR_24H', 'APR_7D', 'APR_30D',
    'SWAP_COUNT_24H', 'UNIQUE_TRADERS_24H',
    'PRICE_TOKEN_A_USD', 'PRICE_TOKEN_B_USD',
    'PRICE_RATIO',
    
    // Trading Info (31-50)
    'MIN_TRADE_AMOUNT_USD', 'MAX_TRADE_AMOUNT_USD',
    'PRICE_IMPACT_1K_USD', 'PRICE_IMPACT_10K_USD',
    'AVG_SLIPPAGE_BPS', 'MAX_SLIPPAGE_BPS',
    'GAS_ESTIMATE_SWAP', 'EXECUTION_TIME_AVG_MS',
    'SUCCESS_RATE_PERCENT', 'FAILED_SWAPS_24H',
    'LAST_SWAP_TIME', 'LAST_SWAP_AMOUNT_USD',
    'LARGEST_SWAP_24H_USD', 'TOTAL_SWAPS',
    'CREATED_AT', 'CREATED_BLOCK',
    'CREATOR_ADDRESS', 'FACTORY_ADDRESS',
    'ROUTER_ADDRESS', 'POSITION_MANAGER',
    
    // Resto de campos técnicos (51-100)
    ...Array.from({ length: 50 }, (_, i) => `POOL_FIELD_${i + 51}`)
  ],
  
  ROUTES: [
    // Campos Críticos (1-15)
    'ROUTE_ID', 'ROUTE_NAME', 'IS_ACTIVE', 'IS_PROFITABLE',
    'STRATEGY_TYPE', 'ROUTE_TYPE', 'PRIORITY',
    'SOURCE_TOKEN', 'TARGET_TOKEN', 'INTERMEDIATE_TOKEN',
    'DEX_1', 'DEX_2', 'DEX_3',
    'EXPECTED_PROFIT_USD', 'EXPECTED_ROI_PERCENT',
    
    // Route Details (16-30)
    'PATH', 'HOPS', 'TOTAL_FEE_BPS',
    'MIN_INPUT_AMOUNT', 'MAX_INPUT_AMOUNT',
    'OPTIMAL_INPUT_AMOUNT', 'SLIPPAGE_TOLERANCE_BPS',
    'MAX_PRICE_IMPACT_BPS', 'GAS_ESTIMATE',
    'EXECUTION_TIME_EST_MS', 'SUCCESS_PROBABILITY',
    'CONFIDENCE_SCORE', 'RISK_SCORE',
    'LAST_PROFITABLE_TIME', 'LAST_CHECKED_TIME',
    'CHECK_INTERVAL_MS',
    
    // Stats & Performance (31-50)
    'TOTAL_EXECUTIONS', 'SUCCESSFUL_EXECUTIONS',
    'FAILED_EXECUTIONS', 'SUCCESS_RATE_PERCENT',
    'TOTAL_PROFIT_USD', 'AVG_PROFIT_USD',
    'MAX_PROFIT_USD', 'MIN_PROFIT_USD',
    'TOTAL_GAS_USED', 'AVG_GAS_USED',
    'TOTAL_GAS_COST_USD', 'AVG_EXECUTION_TIME_MS',
    'LAST_EXECUTION_TIME', 'LAST_EXECUTION_PROFIT_USD',
    'LAST_EXECUTION_STATUS', 'LAST_ERROR',
    'CREATED_AT', 'UPDATED_AT',
    'DISCOVERED_BY', 'NOTES',
    
    // Resto de campos técnicos (51-200)
    ...Array.from({ length: 150 }, (_, i) => `ROUTE_FIELD_${i + 51}`)
  ],
  
  EXECUTIONS: [
    // Campos Críticos (1-15)
    'EXECUTION_ID', 'ROUTE_ID', 'STATUS', 'IS_SUCCESSFUL',
    'TIMESTAMP', 'BLOCK_NUMBER', 'TRANSACTION_HASH',
    'INPUT_TOKEN', 'OUTPUT_TOKEN', 'INPUT_AMOUNT',
    'OUTPUT_AMOUNT', 'PROFIT_USD', 'ROI_PERCENT',
    'GAS_USED', 'GAS_PRICE_GWEI',
    
    // Execution Details (16-30)
    'GAS_COST_USD', 'TOTAL_COST_USD', 'NET_PROFIT_USD',
    'SLIPPAGE_ACTUAL_BPS', 'PRICE_IMPACT_BPS',
    'EXECUTION_TIME_MS', 'CONFIRMATION_TIME_MS',
    'DEX_1_AMOUNT_IN', 'DEX_1_AMOUNT_OUT',
    'DEX_2_AMOUNT_IN', 'DEX_2_AMOUNT_OUT',
    'DEX_3_AMOUNT_IN', 'DEX_3_AMOUNT_OUT',
    'FLASH_LOAN_USED', 'FLASH_LOAN_AMOUNT', 'FLASH_LOAN_FEE',
    
    // Error & Monitoring (31-50)
    'ERROR_MESSAGE', 'ERROR_CODE', 'ERROR_STACK',
    'RETRY_COUNT', 'RETRY_REASON',
    'REVERT_REASON', 'SIMULATION_PASSED',
    'MEMPOOL_TIME_MS', 'PENDING_TIME_MS',
    'NONCE', 'FROM_ADDRESS', 'TO_ADDRESS',
    'CHAIN_ID', 'NETWORK_NAME',
    'EXPLORER_URL', 'LOGS', 'EVENTS',
    'CREATED_AT', 'UPDATED_AT', 'NOTES'
  ],
  
  CONFIG: [
    'CONFIG_KEY', 'VALUE', 'TYPE', 'DESCRIPTION',
    'IS_ACTIVE', 'LAST_UPDATED', 'NOTES'
  ],
  
  ALERTS: [
    'ALERT_ID', 'TYPE', 'SEVERITY', 'STATUS',
    'MESSAGE', 'TIMESTAMP', 'RESOLVED_AT',
    'RESOLVED_BY', 'NOTES'
  ]
};

async function reorganizeSheets() {
  try {
    console.log('🔄 Reorganizando Google Sheet con campos críticos al principio...\n');
    
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    console.log('✅ Conectado al spreadsheet\n');
    
    // Para cada hoja, reescribir los headers
    for (const [sheetName, columns] of Object.entries(OPTIMIZED_SCHEMA)) {
      console.log(`📋 Reorganizando: ${sheetName}`);
      console.log(`   Columnas: ${columns.length}`);
      console.log(`   Primeras 10: ${columns.slice(0, 10).join(', ')}`);
      
      // Escribir nuevos headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [columns],
        },
      });
      
      console.log(`   ✅ Headers actualizados\n`);
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 REORGANIZACIÓN COMPLETADA');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ Campos críticos ahora en columnas 1-15');
    console.log('✅ IS_ACTIVE en columna 3 (fácil acceso)');
    console.log('✅ Formato condicional ya aplicado');
    console.log(`🔗 URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

reorganizeSheets().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });

