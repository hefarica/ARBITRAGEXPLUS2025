/**
 * ARBITRAGEXPLUS2025 - Add Validations to Google Sheet Brain
 * 
 * Script para agregar validaciones, formato condicional, fórmulas y protecciones
 * a las hojas del Google Sheet Brain.
 */

const { google } = require('googleapis');
const fs = require('fs');

// Configuración
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ';
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './keys/gsheets-sa.json';

// Definición de validaciones por hoja
const VALIDATIONS = {
  BLOCKCHAINS: {
    IS_TESTNET: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    SUPPORTS_EIP1559: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    SUPPORTS_FLASHBOTS: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    CHAIN_LINK_SUPPORTED: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    PYTH_SUPPORTED: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    IS_ACTIVE: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    PRIORITY: { type: 'NUMBER_BETWEEN', min: 1, max: 10 },
    GAS_BUFFER_PERCENT: { type: 'NUMBER_BETWEEN', min: 0, max: 100 },
    SUCCESS_RATE_PERCENT: { type: 'NUMBER_BETWEEN', min: 0, max: 100 },
  },
  
  DEXES: {
    DEX_TYPE: { type: 'LIST', values: ['AMM', 'ORDERBOOK', 'HYBRID', 'AGGREGATOR'] },
    PROTOCOL_TYPE: { type: 'LIST', values: ['UNISWAP_V2', 'UNISWAP_V3', 'CURVE', 'BALANCER', 'SUSHISWAP', 'PANCAKESWAP'] },
    AMM_TYPE: { type: 'LIST', values: ['CONSTANT_PRODUCT', 'CONCENTRATED_LIQUIDITY', 'STABLE_SWAP', 'WEIGHTED'] },
    WS_SUPPORTED: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    API_KEY_REQUIRED: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    SUPPORTS_BATCH_REQUESTS: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    SUPPORTS_CONCENTRATED_LIQUIDITY: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    SUPPORTS_STABLE_POOLS: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    SUPPORTS_WEIGHTED_POOLS: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    SUPPORTS_CUSTOM_CURVES: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    DYNAMIC_FEE_ENABLED: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    IS_ACTIVE: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    IS_VERIFIED: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
  },
  
  ASSETS: {
    TOKEN_TYPE: { type: 'LIST', values: ['NATIVE', 'ERC20', 'ERC721', 'ERC1155', 'WRAPPED'] },
    TOKEN_STANDARD: { type: 'LIST', values: ['ERC20', 'BEP20', 'SPL', 'NATIVE'] },
    IS_STABLECOIN: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    IS_WRAPPED: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    IS_VERIFIED: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    IS_ACTIVE: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    DECIMALS: { type: 'NUMBER_BETWEEN', min: 0, max: 18 },
  },
  
  POOLS: {
    POOL_TYPE: { type: 'LIST', values: ['V2', 'V3', 'STABLE', 'WEIGHTED', 'CONCENTRATED'] },
    IS_ACTIVE: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    IS_VERIFIED: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
  },
  
  ROUTES: {
    STRATEGY_TYPE: { type: 'LIST', values: ['2DEX', '3DEX', 'TRIANGULAR', 'FLASH_LOAN', 'MULTI_HOP'] },
    ROUTE_TYPE: { type: 'LIST', values: ['DIRECT', 'MULTI_HOP', 'SPLIT'] },
    STATUS: { type: 'LIST', values: ['ACTIVE', 'INACTIVE', 'CALCULATING', 'EXPIRED'] },
    IS_PROFITABLE: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
  },
  
  EXECUTIONS: {
    STATUS: { type: 'LIST', values: ['PENDING', 'EXECUTING', 'SUCCESS', 'FAILED', 'CANCELLED'] },
    EXECUTION_TYPE: { type: 'LIST', values: ['DIRECT', 'FLASH_LOAN', 'MULTI_HOP'] },
    IS_SUCCESSFUL: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    IS_FAILED: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
    IS_PENDING: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
  },
  
  CONFIG: {
    TYPE: { type: 'LIST', values: ['STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'URL'] },
    IS_ACTIVE: { type: 'BOOLEAN', values: ['TRUE', 'FALSE'] },
  },
  
  ALERTS: {
    TYPE: { type: 'LIST', values: ['ERROR', 'WARNING', 'INFO', 'SUCCESS'] },
    SEVERITY: { type: 'LIST', values: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] },
    STATUS: { type: 'LIST', values: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'CLOSED'] },
  },
};

// Formato condicional por hoja
const CONDITIONAL_FORMATTING = {
  BLOCKCHAINS: {
    IS_ACTIVE: {
      TRUE: { backgroundColor: { red: 0.85, green: 0.96, blue: 0.85 } }, // Verde claro
      FALSE: { backgroundColor: { red: 1, green: 0.9, blue: 0.9 } }, // Rojo claro
    },
  },
  
  EXECUTIONS: {
    STATUS: {
      SUCCESS: { backgroundColor: { red: 0.85, green: 0.96, blue: 0.85 }, textFormat: { foregroundColor: { red: 0, green: 0.5, blue: 0 } } },
      FAILED: { backgroundColor: { red: 1, green: 0.9, blue: 0.9 }, textFormat: { foregroundColor: { red: 0.8, green: 0, blue: 0 } } },
      PENDING: { backgroundColor: { red: 1, green: 0.95, blue: 0.8 }, textFormat: { foregroundColor: { red: 0.8, green: 0.5, blue: 0 } } },
    },
  },
  
  ALERTS: {
    SEVERITY: {
      CRITICAL: { backgroundColor: { red: 0.8, green: 0, blue: 0 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } },
      HIGH: { backgroundColor: { red: 1, green: 0.6, blue: 0 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 } } },
      MEDIUM: { backgroundColor: { red: 1, green: 0.95, blue: 0.8 } },
      LOW: { backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 } },
    },
  },
};

async function addValidations() {
  try {
    console.log('🔧 Agregando validaciones al Google Sheet Brain...\n');
    
    // 1. Cargar credenciales
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    // 2. Obtener información del spreadsheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    console.log(`✅ Conectado a: "${spreadsheet.data.properties.title}"\n`);
    
    // 3. Crear requests para validaciones
    const requests = [];
    
    for (const [sheetName, validations] of Object.entries(VALIDATIONS)) {
      console.log(`📋 Procesando validaciones para: ${sheetName}`);
      
      const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) {
        console.log(`   ⚠️  Hoja no encontrada, saltando...\n`);
        continue;
      }
      
      const sheetId = sheet.properties.sheetId;
      
      // Obtener headers para encontrar índices de columnas
      const headersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!1:1`,
      });
      
      const headers = headersResponse.data.values ? headersResponse.data.values[0] : [];
      
      for (const [fieldName, validation] of Object.entries(validations)) {
        const columnIndex = headers.indexOf(fieldName);
        if (columnIndex === -1) {
          console.log(`   ⚠️  Campo "${fieldName}" no encontrado`);
          continue;
        }
        
        console.log(`   ✅ Agregando validación a: ${fieldName} (columna ${columnIndex + 1})`);
        
        // Crear validación según tipo
        let dataValidation = {};
        
        if (validation.type === 'BOOLEAN' || validation.type === 'LIST') {
          dataValidation = {
            condition: {
              type: 'ONE_OF_LIST',
              values: validation.values.map(v => ({ userEnteredValue: v })),
            },
            strict: true,
            showCustomUi: true,
          };
        } else if (validation.type === 'NUMBER_BETWEEN') {
          dataValidation = {
            condition: {
              type: 'NUMBER_BETWEEN',
              values: [
                { userEnteredValue: validation.min.toString() },
                { userEnteredValue: validation.max.toString() },
              ],
            },
            strict: true,
            showCustomUi: true,
          };
        }
        
        // Agregar request para validación
        requests.push({
          setDataValidation: {
            range: {
              sheetId: sheetId,
              startRowIndex: 1, // Desde fila 2 (después del header)
              endRowIndex: 1000,
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1,
            },
            rule: dataValidation,
          },
        });
      }
      
      console.log('');
    }
    
    // 4. Ejecutar validaciones
    if (requests.length > 0) {
      console.log(`⚙️  Aplicando ${requests.length} validaciones...\n`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests },
      });
      console.log('✅ Validaciones aplicadas correctamente\n');
    }
    
    // 5. Agregar formato condicional
    console.log('🎨 Agregando formato condicional...\n');
    
    const formatRequests = [];
    
    for (const [sheetName, formats] of Object.entries(CONDITIONAL_FORMATTING)) {
      console.log(`📋 Procesando formato para: ${sheetName}`);
      
      const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) continue;
      
      const sheetId = sheet.properties.sheetId;
      
      // Obtener headers
      const headersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!1:1`,
      });
      
      const headers = headersResponse.data.values ? headersResponse.data.values[0] : [];
      
      for (const [fieldName, conditions] of Object.entries(formats)) {
        const columnIndex = headers.indexOf(fieldName);
        if (columnIndex === -1) continue;
        
        console.log(`   ✅ Formato condicional en: ${fieldName}`);
        
        for (const [value, format] of Object.entries(conditions)) {
          formatRequests.push({
            addConditionalFormatRule: {
              rule: {
                ranges: [{
                  sheetId: sheetId,
                  startRowIndex: 1,
                  endRowIndex: 1000,
                  startColumnIndex: columnIndex,
                  endColumnIndex: columnIndex + 1,
                }],
                booleanRule: {
                  condition: {
                    type: 'TEXT_EQ',
                    values: [{ userEnteredValue: value }],
                  },
                  format: format,
                },
              },
              index: 0,
            },
          });
        }
      }
      
      console.log('');
    }
    
    if (formatRequests.length > 0) {
      console.log(`⚙️  Aplicando ${formatRequests.length} reglas de formato...\n`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: formatRequests },
      });
      console.log('✅ Formato condicional aplicado\n');
    }
    
    // 6. Resumen final
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 VALIDACIONES Y FORMATO AGREGADOS EXITOSAMENTE');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📊 Validaciones aplicadas: ${requests.length}`);
    console.log(`🎨 Reglas de formato: ${formatRequests.length}`);
    console.log(`🔗 URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Detalles:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

// Ejecutar
if (require.main === module) {
  addValidations()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { addValidations };

