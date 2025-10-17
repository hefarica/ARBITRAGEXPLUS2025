/**
 * ARBITRAGEXPLUS2025 - Fix Conditional Formatting
 * 
 * Script para corregir el formato condicional en Google Sheets
 * Funciona con TRUE/FALSE y VERDADERO/FALSO
 */

const { google } = require('googleapis');
const fs = require('fs');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1qLKS8anyP8lb9jCVujT6KzTPjaSjNrAPYWhCxv4sChQ';
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || './keys/gsheets-sa.json';

async function fixConditionalFormatting() {
  try {
    console.log('🎨 Corrigiendo formato condicional...\n');
    
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    const sheets = google.sheets({ version: 'v4', auth });
    
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    console.log(`✅ Conectado a: "${spreadsheet.data.properties.title}"\n`);
    
    // 1. Eliminar todas las reglas de formato condicional existentes
    console.log('🗑️  Eliminando reglas existentes...');
    
    const deleteRequests = [];
    for (const sheet of spreadsheet.data.sheets) {
      const sheetId = sheet.properties.sheetId;
      const conditionalFormats = sheet.conditionalFormats || [];
      
      for (let i = 0; i < conditionalFormats.length; i++) {
        deleteRequests.push({
          deleteConditionalFormatRule: {
            sheetId: sheetId,
            index: 0, // Siempre eliminar el primero
          },
        });
      }
    }
    
    if (deleteRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: deleteRequests },
      });
      console.log(`   ✅ ${deleteRequests.length} reglas eliminadas\n`);
    } else {
      console.log('   ℹ️  No hay reglas existentes\n');
    }
    
    // 2. Agregar nuevas reglas de formato condicional
    console.log('📋 Agregando nuevas reglas de formato...\n');
    
    const formatRequests = [];
    
    // BLOCKCHAINS - IS_ACTIVE
    const blockchainsSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'BLOCKCHAINS');
    if (blockchainsSheet) {
      const sheetId = blockchainsSheet.properties.sheetId;
      
      // Obtener headers
      const headersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'BLOCKCHAINS!1:1',
      });
      
      const headers = headersResponse.data.values ? headersResponse.data.values[0] : [];
      const isActiveIndex = headers.indexOf('IS_ACTIVE');
      
      if (isActiveIndex !== -1) {
        console.log(`   📊 BLOCKCHAINS - IS_ACTIVE (columna ${isActiveIndex + 1})`);
        
        // Regla para TRUE/VERDADERO (Verde)
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
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: `=OR(UPPER(${String.fromCharCode(65 + isActiveIndex)}2)="TRUE", UPPER(${String.fromCharCode(65 + isActiveIndex)}2)="VERDADERO")` }],
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
        
        // Regla para FALSE/FALSO (Rojo)
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
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: `=OR(UPPER(${String.fromCharCode(65 + isActiveIndex)}2)="FALSE", UPPER(${String.fromCharCode(65 + isActiveIndex)}2)="FALSO")` }],
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
        
        console.log('      ✅ TRUE/VERDADERO → Verde');
        console.log('      ✅ FALSE/FALSO → Rojo');
      }
    }
    
    // DEXES - IS_ACTIVE
    const dexesSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'DEXES');
    if (dexesSheet) {
      const sheetId = dexesSheet.properties.sheetId;
      
      const headersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'DEXES!1:1',
      });
      
      const headers = headersResponse.data.values ? headersResponse.data.values[0] : [];
      const isActiveIndex = headers.indexOf('IS_ACTIVE');
      
      if (isActiveIndex !== -1) {
        console.log(`\n   📊 DEXES - IS_ACTIVE (columna ${isActiveIndex + 1})`);
        
        const columnLetter = String.fromCharCode(65 + (isActiveIndex % 26));
        
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
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: `=OR(UPPER(${columnLetter}2)="TRUE", UPPER(${columnLetter}2)="VERDADERO")` }],
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
                  type: 'CUSTOM_FORMULA',
                  values: [{ userEnteredValue: `=OR(UPPER(${columnLetter}2)="FALSE", UPPER(${columnLetter}2)="FALSO")` }],
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
        
        console.log('      ✅ TRUE/VERDADERO → Verde');
        console.log('      ✅ FALSE/FALSO → Rojo');
      }
    }
    
    // EXECUTIONS - STATUS
    const executionsSheet = spreadsheet.data.sheets.find(s => s.properties.title === 'EXECUTIONS');
    if (executionsSheet) {
      const sheetId = executionsSheet.properties.sheetId;
      
      const headersResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: 'EXECUTIONS!1:1',
      });
      
      const headers = headersResponse.data.values ? headersResponse.data.values[0] : [];
      const statusIndex = headers.indexOf('EXECUTION_STATUS');
      
      if (statusIndex !== -1) {
        console.log(`\n   📊 EXECUTIONS - EXECUTION_STATUS (columna ${statusIndex + 1})`);
        
        const columnLetter = getColumnLetter(statusIndex);
        
        // SUCCESS → Verde
        formatRequests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [{
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: statusIndex,
                endColumnIndex: statusIndex + 1,
              }],
              booleanRule: {
                condition: {
                  type: 'TEXT_EQ',
                  values: [{ userEnteredValue: 'SUCCESS' }],
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
        
        // FAILED → Rojo
        formatRequests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [{
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: statusIndex,
                endColumnIndex: statusIndex + 1,
              }],
              booleanRule: {
                condition: {
                  type: 'TEXT_EQ',
                  values: [{ userEnteredValue: 'FAILED' }],
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
        
        // PENDING → Naranja
        formatRequests.push({
          addConditionalFormatRule: {
            rule: {
              ranges: [{
                sheetId: sheetId,
                startRowIndex: 1,
                endRowIndex: 1000,
                startColumnIndex: statusIndex,
                endColumnIndex: statusIndex + 1,
              }],
              booleanRule: {
                condition: {
                  type: 'TEXT_EQ',
                  values: [{ userEnteredValue: 'PENDING' }],
                },
                format: {
                  backgroundColor: { red: 1, green: 0.95, blue: 0.8 },
                  textFormat: { foregroundColor: { red: 0.8, green: 0.5, blue: 0 }, bold: true },
                },
              },
            },
            index: 0,
          },
        });
        
        console.log('      ✅ SUCCESS → Verde');
        console.log('      ✅ FAILED → Rojo');
        console.log('      ✅ PENDING → Naranja');
      }
    }
    
    // 3. Aplicar reglas
    if (formatRequests.length > 0) {
      console.log(`\n⚙️  Aplicando ${formatRequests.length} reglas de formato...\n`);
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: formatRequests },
      });
      console.log('✅ Formato condicional aplicado correctamente\n');
    }
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log('🎉 FORMATO CONDICIONAL CORREGIDO');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log(`📊 Reglas aplicadas: ${formatRequests.length}`);
    console.log(`🔗 URL: https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit\n`);
    console.log('💡 Ahora las celdas cambiarán de color automáticamente:\n');
    console.log('   ✅ TRUE/VERDADERO → Fondo verde, texto verde oscuro');
    console.log('   ❌ FALSE/FALSO → Fondo rojo, texto rojo oscuro');
    console.log('   ✅ SUCCESS → Fondo verde');
    console.log('   ❌ FAILED → Fondo rojo');
    console.log('   ⏳ PENDING → Fondo naranja\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Detalles:', JSON.stringify(error.response.data, null, 2));
    }
    throw error;
  }
}

function getColumnLetter(index) {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode(65 + (index % 26)) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

if (require.main === module) {
  fixConditionalFormatting()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { fixConditionalFormatting };

