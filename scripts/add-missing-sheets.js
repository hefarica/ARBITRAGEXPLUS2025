/**
 * ============================================================================
 * ARCHIVO: ./scripts/add-missing-sheets.js
 * SERVICIO: add-missing-sheets.js
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: getColumnLetter, createSheet, getAuthClient
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

#!/usr/bin/env node
/**
 * ARBITRAGEXPLUS2025 - Add Missing Sheets to Google Sheet Brain
 * 
 * Agrega las 5 hojas faltantes para completar las 13 hojas maestras
 * según especificaciones del Prompt Supremo:
 * 
 * Hojas existentes (8):
 * 1. BLOCKCHAINS (50 campos)
 * 2. DEXES (201 campos)
 * 3. ASSETS (400 campos)
 * 4. POOLS (100 campos)
 * 5. ROUTES (201 campos)
 * 6. EXECUTIONS (51 campos)
 * 7. CONFIG (7 campos)
 * 8. ALERTS (9 campos)
 * 
 * Hojas nuevas a crear (5):
 * 9. ORACLES (50 campos) - Configuración de oráculos Pyth/Chainlink
 * 10. STRATEGIES (100 campos) - Estrategias de arbitraje configurables
 * 11. FLASH_LOANS (75 campos) - Configuración de protocolos flash loan
 * 12. METRICS (80 campos) - Métricas y KPIs del sistema
 * 13. LOGS (50 campos) - Logs de operaciones y eventos
 */

const { google } = require('googleapis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ==================================================================================
// CONFIGURACIÓN
// ==================================================================================

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || process.env.SPREADSHEET_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './keys/gsheets-sa.json';

if (!SPREADSHEET_ID) {
  console.error('❌ Error: GOOGLE_SHEETS_SPREADSHEET_ID no configurado en .env');
  process.exit(1);
}

// ==================================================================================
// DEFINICIÓN DE NUEVAS HOJAS
// ==================================================================================

const NEW_SHEETS = [
  {
    title: 'ORACLES',
    fields: 50,
    color: { red: 0.95, green: 0.87, blue: 0.80 }, // #F2DEC8 - Naranja claro
    headers: [
      'ORACLE_ID', 'ORACLE_NAME', 'IS_ACTIVE', 'PRIORITY', 'ORACLE_TYPE',
      'PROVIDER', 'NETWORK', 'CHAIN_ID', 'CONTRACT_ADDRESS', 'API_ENDPOINT',
      'API_KEY_ENV_VAR', 'UPDATE_FREQUENCY_MS', 'CONFIDENCE_THRESHOLD', 'MAX_STALENESS_MS',
      'SUPPORTS_REALTIME', 'SUPPORTS_HISTORICAL', 'PRICE_FEEDS_COUNT', 'SUPPORTED_ASSETS',
      'FALLBACK_ORACLE', 'COST_PER_QUERY', 'RATE_LIMIT_PER_SECOND', 'TIMEOUT_MS',
      'RETRY_ATTEMPTS', 'EXPONENTIAL_BACKOFF', 'CIRCUIT_BREAKER_ENABLED', 'CIRCUIT_BREAKER_THRESHOLD',
      'HEALTH_CHECK_ENDPOINT', 'LAST_HEALTH_CHECK', 'UPTIME_PERCENT', 'AVG_RESPONSE_TIME_MS',
      'TOTAL_QUERIES', 'SUCCESSFUL_QUERIES', 'FAILED_QUERIES', 'ERROR_RATE',
      'LAST_ERROR', 'LAST_ERROR_TIMESTAMP', 'DOCUMENTATION_URL', 'SUPPORT_EMAIL',
      'NOTES', 'CREATED_AT', 'UPDATED_AT', 'CREATED_BY', 'UPDATED_BY',
      'METADATA_JSON', 'CUSTOM_CONFIG_JSON', 'TAGS', 'IS_VERIFIED', 'IS_DEPRECATED',
      'DEPRECATION_DATE', 'REPLACEMENT_ORACLE', 'VERSION'
    ]
  },
  {
    title: 'STRATEGIES',
    fields: 100,
    color: { red: 0.85, green: 0.92, blue: 0.97 }, // #D9EBF7 - Azul claro
    headers: [
      'STRATEGY_ID', 'STRATEGY_NAME', 'IS_ACTIVE', 'PRIORITY', 'STRATEGY_TYPE',
      'CATEGORY', 'COMPLEXITY', 'RISK_LEVEL', 'MIN_PROFIT_USD', 'MIN_ROI_PERCENT',
      'MAX_SLIPPAGE', 'MAX_GAS_PRICE_GWEI', 'TIMEOUT_MS', 'RETRY_ATTEMPTS',
      'REQUIRES_FLASH_LOAN', 'FLASH_LOAN_PROTOCOL', 'FLASH_LOAN_AMOUNT_USD', 'FLASH_LOAN_FEE_BPS',
      'DEX_COUNT', 'ALLOWED_DEXES', 'ALLOWED_CHAINS', 'ALLOWED_TOKENS',
      'MIN_LIQUIDITY_USD', 'MAX_PRICE_IMPACT', 'CONFIDENCE_THRESHOLD', 'ORACLE_VALIDATION_REQUIRED',
      'PRIMARY_ORACLE', 'SECONDARY_ORACLE', 'PRICE_DEVIATION_THRESHOLD', 'EXECUTION_MODE',
      'BATCH_SIZE', 'CONCURRENT_EXECUTIONS', 'COOLDOWN_MS', 'BACKOFF_MULTIPLIER',
      'CIRCUIT_BREAKER_ENABLED', 'CIRCUIT_BREAKER_THRESHOLD', 'MAX_DAILY_EXECUTIONS', 'MAX_DAILY_LOSS_USD',
      'STOP_LOSS_PERCENT', 'TAKE_PROFIT_PERCENT', 'TRAILING_STOP', 'POSITION_SIZE_PERCENT',
      'LEVERAGE', 'MARGIN_REQUIREMENT', 'LIQUIDATION_THRESHOLD', 'HEDGING_ENABLED',
      'HEDGE_RATIO', 'REBALANCE_FREQUENCY_MS', 'MONITORING_ENABLED', 'ALERT_THRESHOLD',
      'NOTIFICATION_CHANNELS', 'WEBHOOK_URL', 'SLACK_CHANNEL', 'EMAIL_RECIPIENTS',
      'LOG_LEVEL', 'DEBUG_MODE', 'SIMULATION_MODE', 'PAPER_TRADING',
      'BACKTEST_ENABLED', 'BACKTEST_START_DATE', 'BACKTEST_END_DATE', 'BACKTEST_RESULTS_JSON',
      'PERFORMANCE_METRICS_JSON', 'TOTAL_EXECUTIONS', 'SUCCESSFUL_EXECUTIONS', 'FAILED_EXECUTIONS',
      'TOTAL_PROFIT_USD', 'TOTAL_LOSS_USD', 'NET_PROFIT_USD', 'AVG_PROFIT_PER_TRADE',
      'WIN_RATE', 'SHARPE_RATIO', 'MAX_DRAWDOWN', 'PROFIT_FACTOR',
      'AVG_EXECUTION_TIME_MS', 'FASTEST_EXECUTION_MS', 'SLOWEST_EXECUTION_MS', 'LAST_EXECUTION_AT',
      'LAST_PROFIT_USD', 'LAST_ERROR', 'LAST_ERROR_TIMESTAMP', 'DOCUMENTATION_URL',
      'AUTHOR', 'VERSION', 'CREATED_AT', 'UPDATED_AT',
      'NOTES', 'TAGS', 'IS_EXPERIMENTAL', 'IS_DEPRECATED',
      'DEPRECATION_DATE', 'REPLACEMENT_STRATEGY', 'CUSTOM_PARAMS_JSON', 'METADATA_JSON'
    ]
  },
  {
    title: 'FLASH_LOANS',
    fields: 75,
    color: { red: 1.0, green: 0.95, blue: 0.80 }, // #FFF2CC - Amarillo claro
    headers: [
      'PROTOCOL_ID', 'PROTOCOL_NAME', 'IS_ACTIVE', 'PRIORITY', 'PROTOCOL_TYPE',
      'VERSION', 'CHAIN_ID', 'CONTRACT_ADDRESS', 'LENDING_POOL_ADDRESS', 'PROVIDER_ADDRESS',
      'MAX_LOAN_AMOUNT_USD', 'MIN_LOAN_AMOUNT_USD', 'FEE_BPS', 'FIXED_FEE_USD',
      'SUPPORTED_TOKENS', 'SUPPORTED_TOKENS_COUNT', 'LIQUIDITY_USD', 'AVAILABLE_LIQUIDITY_USD',
      'UTILIZATION_RATE', 'BORROW_RATE_APY', 'SUPPLY_RATE_APY', 'RESERVE_FACTOR',
      'LIQUIDATION_THRESHOLD', 'LIQUIDATION_BONUS', 'HEALTH_FACTOR_MIN', 'COLLATERAL_REQUIRED',
      'FLASH_LOAN_PREMIUM', 'REFERRAL_CODE', 'CALLBACK_GAS_LIMIT', 'EXECUTION_TIMEOUT_MS',
      'MAX_CONCURRENT_LOANS', 'COOLDOWN_MS', 'RATE_LIMIT_PER_BLOCK', 'CIRCUIT_BREAKER_ENABLED',
      'CIRCUIT_BREAKER_THRESHOLD', 'FALLBACK_PROTOCOL', 'RETRY_ATTEMPTS', 'EXPONENTIAL_BACKOFF',
      'REQUIRES_APPROVAL', 'APPROVAL_TOKEN', 'APPROVAL_AMOUNT', 'GAS_ESTIMATE',
      'GAS_BUFFER_PERCENT', 'PRIORITY_FEE_GWEI', 'MAX_FEE_PER_GAS_GWEI', 'NONCE_MANAGEMENT',
      'TRANSACTION_TYPE', 'ACCESS_LIST', 'SUPPORTS_EIP1559', 'SUPPORTS_MULTICALL',
      'TOTAL_LOANS', 'SUCCESSFUL_LOANS', 'FAILED_LOANS', 'TOTAL_VOLUME_USD',
      'TOTAL_FEES_PAID_USD', 'AVG_LOAN_AMOUNT_USD', 'AVG_EXECUTION_TIME_MS', 'SUCCESS_RATE',
      'LAST_LOAN_AT', 'LAST_LOAN_AMOUNT_USD', 'LAST_ERROR', 'LAST_ERROR_TIMESTAMP',
      'DOCUMENTATION_URL', 'AUDIT_REPORT_URL', 'SECURITY_SCORE', 'IS_AUDITED',
      'AUDIT_DATE', 'AUDITOR', 'TVL_USD', 'REPUTATION_SCORE',
      'CREATED_AT', 'UPDATED_AT', 'NOTES', 'TAGS', 'METADATA_JSON'
    ]
  },
  {
    title: 'METRICS',
    fields: 80,
    color: { red: 0.85, green: 0.95, blue: 0.85 }, // #D9F2D9 - Verde claro
    headers: [
      'METRIC_ID', 'METRIC_NAME', 'CATEGORY', 'TYPE', 'UNIT',
      'CURRENT_VALUE', 'PREVIOUS_VALUE', 'CHANGE_PERCENT', 'CHANGE_ABSOLUTE', 'TREND',
      'TARGET_VALUE', 'THRESHOLD_MIN', 'THRESHOLD_MAX', 'IS_CRITICAL', 'ALERT_ENABLED',
      'ALERT_THRESHOLD', 'ALERT_CONDITION', 'LAST_ALERT_AT', 'ALERT_COUNT', 'ALERT_FREQUENCY',
      'AGGREGATION_TYPE', 'AGGREGATION_PERIOD', 'WINDOW_SIZE', 'ROLLING_AVERAGE', 'MOVING_AVERAGE',
      'EXPONENTIAL_SMOOTHING', 'STANDARD_DEVIATION', 'VARIANCE', 'MIN_VALUE', 'MAX_VALUE',
      'MEDIAN_VALUE', 'PERCENTILE_25', 'PERCENTILE_75', 'PERCENTILE_95', 'PERCENTILE_99',
      'TOTAL_COUNT', 'SUCCESS_COUNT', 'FAILURE_COUNT', 'PENDING_COUNT', 'CANCELLED_COUNT',
      'SUCCESS_RATE', 'FAILURE_RATE', 'COMPLETION_RATE', 'ERROR_RATE', 'RETRY_RATE',
      'AVG_EXECUTION_TIME_MS', 'P50_EXECUTION_TIME_MS', 'P95_EXECUTION_TIME_MS', 'P99_EXECUTION_TIME_MS',
      'TOTAL_PROFIT_USD', 'TOTAL_LOSS_USD', 'NET_PROFIT_USD', 'GROSS_PROFIT_USD',
      'PROFIT_MARGIN', 'ROI_PERCENT', 'SHARPE_RATIO', 'SORTINO_RATIO',
      'MAX_DRAWDOWN', 'RECOVERY_FACTOR', 'PROFIT_FACTOR', 'WIN_RATE',
      'AVG_WIN_USD', 'AVG_LOSS_USD', 'LARGEST_WIN_USD', 'LARGEST_LOSS_USD',
      'CONSECUTIVE_WINS', 'CONSECUTIVE_LOSSES', 'TOTAL_TRADES', 'WINNING_TRADES',
      'LOSING_TRADES', 'BREAKEVEN_TRADES', 'TIMESTAMP', 'UPDATED_AT',
      'DATA_SOURCE', 'CALCULATION_METHOD', 'NOTES', 'TAGS', 'METADATA_JSON'
    ]
  },
  {
    title: 'LOGS',
    fields: 50,
    color: { red: 0.95, green: 0.95, blue: 0.95 }, // #F2F2F2 - Gris claro
    headers: [
      'LOG_ID', 'TIMESTAMP', 'LEVEL', 'CATEGORY', 'COMPONENT',
      'EVENT_TYPE', 'MESSAGE', 'DETAILS', 'CONTEXT_JSON', 'ERROR_CODE',
      'ERROR_MESSAGE', 'STACK_TRACE', 'USER_ID', 'SESSION_ID', 'REQUEST_ID',
      'EXECUTION_ID', 'ROUTE_ID', 'STRATEGY_ID', 'CHAIN_ID', 'DEX_ID',
      'TOKEN_SYMBOL', 'AMOUNT', 'TRANSACTION_HASH', 'BLOCK_NUMBER', 'GAS_USED',
      'GAS_PRICE_GWEI', 'PROFIT_USD', 'STATUS', 'DURATION_MS', 'RETRY_COUNT',
      'IS_CRITICAL', 'IS_RESOLVED', 'RESOLVED_AT', 'RESOLVED_BY', 'RESOLUTION_NOTES',
      'ALERT_SENT', 'ALERT_CHANNEL', 'NOTIFICATION_ID', 'SOURCE_FILE', 'SOURCE_LINE',
      'FUNCTION_NAME', 'ENVIRONMENT', 'VERSION', 'HOST', 'IP_ADDRESS',
      'USER_AGENT', 'REFERRER', 'TAGS', 'METADATA_JSON', 'CREATED_AT'
    ]
  }
];

// ==================================================================================
// FUNCIONES AUXILIARES
// ==================================================================================

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });
  
  return await auth.getClient();
}

async function createSheet(sheets, spreadsheetId, sheetConfig) {
  console.log(`\n📝 Creando hoja: ${sheetConfig.title} (${sheetConfig.fields} campos)`);
  
  try {
    // 1. Crear la hoja
    const addSheetRequest = {
      spreadsheetId,
      resource: {
        requests: [{
          addSheet: {
            properties: {
              title: sheetConfig.title,
              gridProperties: {
                rowCount: 1000,
                columnCount: sheetConfig.fields,
                frozenRowCount: 1
              },
              tabColor: sheetConfig.color
            }
          }
        }]
      }
    };
    
    const addResponse = await sheets.spreadsheets.batchUpdate(addSheetRequest);
    const sheetId = addResponse.data.replies[0].addSheet.properties.sheetId;
    console.log(`  ✓ Hoja creada con ID: ${sheetId}`);
    
    // 2. Agregar encabezados
    const headerRange = `${sheetConfig.title}!A1:${getColumnLetter(sheetConfig.headers.length)}1`;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: headerRange,
      valueInputOption: 'RAW',
      resource: {
        values: [sheetConfig.headers]
      }
    });
    console.log(`  ✓ ${sheetConfig.headers.length} encabezados agregados`);
    
    // 3. Formatear encabezados
    const formatRequests = [
      // Fondo gris oscuro y texto blanco en encabezados
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.26, green: 0.26, blue: 0.26 },
              textFormat: {
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 10,
                bold: true
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE'
            }
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
        }
      },
      // Formato condicional para IS_ACTIVE (columna C)
      {
        addConditionalFormatRule: {
          rule: {
            ranges: [{
              sheetId: sheetId,
              startRowIndex: 1,
              startColumnIndex: 2,
              endColumnIndex: 3
            }],
            booleanRule: {
              condition: {
                type: 'TEXT_EQ',
                values: [{ userEnteredValue: 'TRUE' }]
              },
              format: {
                backgroundColor: { red: 0.85, green: 0.95, blue: 0.85 },
                textFormat: {
                  foregroundColor: { red: 0, green: 0.5, blue: 0 },
                  bold: true
                }
              }
            }
          },
          index: 0
        }
      },
      {
        addConditionalFormatRule: {
          rule: {
            ranges: [{
              sheetId: sheetId,
              startRowIndex: 1,
              startColumnIndex: 2,
              endColumnIndex: 3
            }],
            booleanRule: {
              condition: {
                type: 'TEXT_EQ',
                values: [{ userEnteredValue: 'FALSE' }]
              },
              format: {
                backgroundColor: { red: 1, green: 0.9, blue: 0.9 },
                textFormat: {
                  foregroundColor: { red: 0.8, green: 0, blue: 0 },
                  bold: true
                }
              }
            }
          },
          index: 1
        }
      }
    ];
    
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests: formatRequests }
    });
    console.log(`  ✓ Formato aplicado (encabezados + formato condicional)`);
    
    // 4. Agregar validación de datos para IS_ACTIVE
    if (sheetConfig.headers.includes('IS_ACTIVE')) {
      const validationRequest = {
        setDataValidation: {
          range: {
            sheetId: sheetId,
            startRowIndex: 1,
            startColumnIndex: 2,
            endColumnIndex: 3
          },
          rule: {
            condition: {
              type: 'ONE_OF_LIST',
              values: [
                { userEnteredValue: 'TRUE' },
                { userEnteredValue: 'FALSE' }
              ]
            },
            showCustomUi: true,
            strict: true
          }
        }
      };
      
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: { requests: [validationRequest] }
      });
      console.log(`  ✓ Validación de datos agregada para IS_ACTIVE`);
    }
    
    console.log(`✅ Hoja ${sheetConfig.title} creada exitosamente\n`);
    return true;
    
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log(`  ⚠ La hoja ${sheetConfig.title} ya existe, saltando...\n`);
      return false;
    }
    throw error;
  }
}

function getColumnLetter(columnNumber) {
  let letter = '';
  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    columnNumber = Math.floor((columnNumber - 1) / 26);
  }
  return letter;
}

// ==================================================================================
// MAIN
// ==================================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  ARBITRAGEXPLUS2025 - Add Missing Sheets               ║');
  console.log('║  Completar Google Sheet Brain: 8 → 13 hojas           ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  console.log(`📊 Spreadsheet ID: ${SPREADSHEET_ID}`);
  console.log(`🔑 Credentials: ${CREDENTIALS_PATH}\n`);
  
  try {
    const authClient = await getAuthClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    
    console.log('✓ Autenticación exitosa con Google Sheets API\n');
    console.log('─'.repeat(70));
    console.log('Creando 5 hojas nuevas...');
    console.log('─'.repeat(70));
    
    let created = 0;
    let skipped = 0;
    
    for (const sheetConfig of NEW_SHEETS) {
      const result = await createSheet(sheets, SPREADSHEET_ID, sheetConfig);
      if (result) {
        created++;
      } else {
        skipped++;
      }
    }
    
    console.log('═'.repeat(70));
    console.log('📊 RESUMEN FINAL');
    console.log('═'.repeat(70));
    console.log(`✅ Hojas creadas: ${created}`);
    console.log(`⚠ Hojas existentes (saltadas): ${skipped}`);
    console.log(`📈 Total de hojas en el Brain: ${8 + created} de 13`);
    console.log(`\n🔗 Ver spreadsheet: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit\n`);
    
    if (created > 0) {
      console.log('✅ Google Sheet Brain completado exitosamente!');
    } else {
      console.log('ℹ️  Todas las hojas ya existían, no se crearon nuevas hojas.');
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.errors) {
      console.error('Detalles:', JSON.stringify(error.errors, null, 2));
    }
    process.exit(1);
  }
}

// Ejecutar
main();

