/**
 * ============================================================================
 * ARCHIVO: ./scripts/apply-simple-formatting.js
 * SERVICIO: apply-simple-formatting.js
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   FUENTE: Google Sheets - BLOCKCHAINS
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

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ';
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './keys/gsheets-sa.json';

async function applyFormatting() {
  try {
    console.log('🎨 Aplicando formato condicional simple...\n');
    
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    console.log(`✅ Conectado\n`);
    
    const formatRequests = [];
    
    // BLOCKCHAINS - IS_ACTIVE
    const blockchainsSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'BLOCKCHAINS');
    if (blockchainsSheet) {
      const sheetId = blockchainsSheet.properties.sheetId;
      const headersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'BLOCKCHAINS!1:1',
      });
      
      const headers = headersResponse.data.values ? headersResponse.data.values[0] : [];
      const isActiveIndex = headers.indexOf('IS_ACTIVE');
      
      if (isActiveIndex !== -1) {
        console.log(`📊 BLOCKCHAINS - IS_ACTIVE (columna ${isActiveIndex + 1})`);
        
        // TRUE/VERDADERO → Verde
        formatRequests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [{
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: isActiveIndex,
                endColumnIndex: isActiveIndex + 1,
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
        
        // FALSE/FALSO → Rojo
        formatRequests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [{
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: isActiveIndex,
                endColumnIndex: isActiveIndex + 1,
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
        
        console.log('   ✅ TRUE → Verde');
        console.log('   ❌ FALSE → Rojo\n');
      }
    }
    
    if (formatRequests.length > 0) {
      console.log(`⚙️  Aplicando ${formatRequests.length} reglas...\n`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: formatRequests },
      });
      console.log('✅ Formato aplicado\n');
    }
    
    console.log('🎉 COMPLETADO\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

applyFormatting().then(() => process.exit(0)).catch((error) => { console.error(error); process.exit(1); });
