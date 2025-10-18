/**
 * ============================================================================
 * ARCHIVO: ./scripts/format-is-active-col3.js
 * SERVICIO: format-is-active-col3.js
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   FUENTE: Google Sheets - ROUTES, ASSETS, BLOCKCHAINS, DEXES, CONFIG
 *     - Formato: JSON array
 *     - Frecuencia: Tiempo real / Polling
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: applyFormatting
 * 
 * 📤 SALIDA DE DATOS:
 *   DESTINO: Google Sheets (actualización)
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

const { google } = require('googleapis');
const fs = require('fs');

const SPREADSHEET_ID = '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ';
const CREDENTIALS_PATH = '/home/ubuntu/ARBITRAGEXPLUS2025/keys/gsheets-sa.json';

async function applyFormatting() {
  try {
    console.log('🎨 Aplicando formato condicional a IS_ACTIVE (columna 3)...\n');
    
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    const formatRequests = [];
    const sheetsToFormat = ['BLOCKCHAINS', 'DEXES', 'ASSETS', 'POOLS', 'ROUTES', 'CONFIG'];
    
    for (const sheetName of sheetsToFormat) {
      const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
      if (!sheet) continue;
      
      const sheetId = sheet.properties.sheetId;
      console.log(`📊 ${sheetName} - IS_ACTIVE (columna C/3)`);
      
      // TRUE → Verde
      formatRequests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{
              sheetId: sheetId,
              startRowIndex: 1,
              endRowIndex: 1000,
              startColumnIndex: 2, // Columna C (0-indexed)
              endColumnIndex: 3,
            }],
            booleanRule: {
              condition: {
                type: 'TEXT_CONTAINS',
                values: [{ userEnteredValue: 'TRUE' }],
              },
              format: {
                backgroundColor: { red: 0.85, green: 0.96, blue: 0.85 },
                textFormat: { foregroundColor: { red: 0, green: 0.5, blue: 0 }, bold: true },
              },
            },
          },
          index: 0,
        },
      });
      
      // FALSE → Rojo
      formatRequests.push({
        addConditionalFormatRule: {
          rule: {
            ranges: [{
              sheetId: sheetId,
              startRowIndex: 1,
              endRowIndex: 1000,
              startColumnIndex: 2,
              endColumnIndex: 3,
            }],
            booleanRule: {
              condition: {
                type: 'TEXT_CONTAINS',
                values: [{ userEnteredValue: 'FALSE' }],
              },
              format: {
                backgroundColor: { red: 1, green: 0.9, blue: 0.9 },
                textFormat: { foregroundColor: { red: 0.8, green: 0, blue: 0 }, bold: true },
              },
            },
          },
          index: 0,
        },
      });
      
      console.log('   ✅ TRUE → Verde, FALSE → Rojo');
    }
    
    if (formatRequests.length > 0) {
      console.log(`\n⚙️  Aplicando ${formatRequests.length} reglas...\n`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: formatRequests },
      });
      console.log('✅ Formato aplicado correctamente\n');
      console.log('🎉 COMPLETADO - IS_ACTIVE ahora en columna 3 con colores\n');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

applyFormatting().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
