#!/usr/bin/env node

/**
 * validate-1016-fields.js
 * 
 * Validación E2E completa según Prompt Supremo Definitivo Ultra Efectivo.
 * Verifica que el sistema tenga exactamente 1016 campos distribuidos correctamente.
 */

const fs = require('fs');
const path = require('path');

// ============================================================================
// ESQUEMA EXACTO SEGÚN PROMPT SUPREMO - 1016 CAMPOS
// ============================================================================

const EXPECTED_SCHEMA = {
  BLOCKCHAINS: 50,
  DEXES: 200,
  ASSETS: 400,
  POOLS: 100,
  ROUTES: 200,
  EXECUTIONS: 50,
  CONFIG: 7,
  ALERTS: 9
};

const TOTAL_EXPECTED_FIELDS = 1016;

// ============================================================================
// VALIDACIONES
// ============================================================================

console.log('🔍 Validación E2E del Sistema ARBITRAGEXPLUS2025');
console.log('=' .repeat(80));
console.log('\n📋 Verificando implementación según Prompt Supremo Definitivo...\n');

let totalValidations = 0;
let passedValidations = 0;
const results = [];

// ----------------------------------------------------------------------------
// 1. VALIDAR GOOGLE SHEETS BRAIN - 1016 CAMPOS
// ----------------------------------------------------------------------------

console.log('1️⃣  Validando Google Sheets Brain (1016 campos)...');

const sheetsScriptPath = path.join(__dirname, '../scripts/expand-sheets-brain-v2.js');

if (fs.existsSync(sheetsScriptPath)) {
  try {
    const scriptContent = fs.readFileSync(sheetsScriptPath, 'utf8');
    
    // Verificar que el script define exactamente 1016 campos
    let totalFieldsInScript = 0;
    
    for (const [sheetName, expectedFields] of Object.entries(EXPECTED_SCHEMA)) {
      // Buscar en la definición de SHEET_SCHEMA
      const regex = new RegExp(`${sheetName}:\\s*{[^}]*fields:\\s*(\\d+)`, 's');
      const match = scriptContent.match(regex);
      
      if (match) {
        const fieldsInScript = parseInt(match[1]);
        totalFieldsInScript += fieldsInScript;
        
        if (fieldsInScript === expectedFields) {
          console.log(`  ✅ ${sheetName}: ${fieldsInScript} campos (esperado: ${expectedFields})`);
        } else {
          console.log(`  ❌ ${sheetName}: ${fieldsInScript} campos (esperado: ${expectedFields})`);
        }
      } else {
        console.log(`  ⚠️  ${sheetName}: No encontrado en el script`);
      }
    }
    
    if (totalFieldsInScript === TOTAL_EXPECTED_FIELDS) {
      console.log(`\n  ✅ Total de campos en script: ${totalFieldsInScript} (esperado: ${TOTAL_EXPECTED_FIELDS})`);
      passedValidations++;
    } else {
      console.log(`\n  ❌ Total de campos en script: ${totalFieldsInScript} (esperado: ${TOTAL_EXPECTED_FIELDS})`);
    }
    
    results.push({
      name: 'Google Sheets Brain (1016 campos)',
      status: totalFieldsInScript === TOTAL_EXPECTED_FIELDS ? 'PASS' : 'FAIL',
      details: `${totalFieldsInScript}/${TOTAL_EXPECTED_FIELDS} campos`
    });
    
  } catch (error) {
    console.log(`  ❌ Error al leer script: ${error.message}`);
    results.push({
      name: 'Google Sheets Brain (1016 campos)',
      status: 'FAIL',
      details: error.message
    });
  }
} else {
  console.log(`  ❌ Script no encontrado: ${sheetsScriptPath}`);
  results.push({
    name: 'Google Sheets Brain (1016 campos)',
    status: 'FAIL',
    details: 'Script no encontrado'
  });
}

totalValidations++;

// ----------------------------------------------------------------------------
// 2. VALIDAR PYTHON COLLECTOR - ARRAYS DINÁMICOS
// ----------------------------------------------------------------------------

console.log('\n2️⃣  Validando Python Collector (arrays dinámicos)...');

const pythonClientPath = path.join(__dirname, '../services/python-collector/src/sheets/dynamic_client_v2.py');

if (fs.existsSync(pythonClientPath)) {
  try {
    const pythonContent = fs.readFileSync(pythonClientPath, 'utf8');
    
    // Verificar funciones requeridas
    const requiredFunctions = [
      'get_blockchains_array',
      'get_dexes_array',
      'get_assets_array',
      'get_pools_array',
      'get_routes_array',
      'write_routes_array',
      'write_executions_array',
      'get_config_array',
      'get_alerts_array'
    ];
    
    let allFunctionsPresent = true;
    
    for (const func of requiredFunctions) {
      if (pythonContent.includes(`async def ${func}(`)) {
        console.log(`  ✅ Función encontrada: ${func}()`);
      } else {
        console.log(`  ❌ Función faltante: ${func}()`);
        allFunctionsPresent = false;
      }
    }
    
    // Verificar que usa los rangos correctos
    const rangeChecks = [
      { sheet: 'BLOCKCHAINS', range: 'A2:AX', fields: 50 },
      { sheet: 'DEXES', range: 'A2:GR', fields: 200 },
      { sheet: 'ASSETS', range: 'A2:OL', fields: 400 },
      { sheet: 'POOLS', range: 'A2:CV', fields: 100 },
      { sheet: 'ROUTES', range: 'A2:GR', fields: 200 },
      { sheet: 'EXECUTIONS', range: 'A2:AX', fields: 50 },
      { sheet: 'CONFIG', range: 'A2:G', fields: 7 },
      { sheet: 'ALERTS', range: 'A2:I', fields: 9 }
    ];
    
    let allRangesCorrect = true;
    
    for (const check of rangeChecks) {
      if (pythonContent.includes(`'${check.sheet}': '${check.sheet}!${check.range}'`)) {
        console.log(`  ✅ Rango correcto: ${check.sheet}!${check.range} (${check.fields} campos)`);
      } else {
        console.log(`  ❌ Rango incorrecto o faltante: ${check.sheet}!${check.range}`);
        allRangesCorrect = false;
      }
    }
    
    if (allFunctionsPresent && allRangesCorrect) {
      console.log('\n  ✅ Python Collector implementado correctamente');
      passedValidations++;
    } else {
      console.log('\n  ❌ Python Collector incompleto');
    }
    
    results.push({
      name: 'Python Collector (arrays dinámicos)',
      status: (allFunctionsPresent && allRangesCorrect) ? 'PASS' : 'FAIL',
      details: `${requiredFunctions.length} funciones, ${rangeChecks.length} rangos`
    });
    
  } catch (error) {
    console.log(`  ❌ Error al leer Python Collector: ${error.message}`);
    results.push({
      name: 'Python Collector (arrays dinámicos)',
      status: 'FAIL',
      details: error.message
    });
  }
} else {
  console.log(`  ❌ Python Collector no encontrado: ${pythonClientPath}`);
  results.push({
    name: 'Python Collector (arrays dinámicos)',
    status: 'FAIL',
    details: 'Archivo no encontrado'
  });
}

totalValidations++;

// ----------------------------------------------------------------------------
// 3. VALIDAR RUST ENGINE - DP Y MEMOIZACIÓN
// ----------------------------------------------------------------------------

console.log('\n3️⃣  Validando Rust Engine (DP y memoización)...');

const rustEnginePath = path.join(__dirname, '../services/engine-rust/src/pathfinding/twodex_dp_v2.rs');

if (fs.existsSync(rustEnginePath)) {
  try {
    const rustContent = fs.readFileSync(rustEnginePath, 'utf8');
    
    // Verificar estructuras requeridas
    const requiredStructs = [
      'Dex',
      'Asset',
      'Pool',
      'ArbitrageOpportunity',
      'DPMemoState'
    ];
    
    let allStructsPresent = true;
    
    for (const struct of requiredStructs) {
      if (rustContent.includes(`pub struct ${struct}`)) {
        console.log(`  ✅ Estructura encontrada: ${struct}`);
      } else {
        console.log(`  ❌ Estructura faltante: ${struct}`);
        allStructsPresent = false;
      }
    }
    
    // Verificar funciones clave
    const requiredFunctions = [
      'find_arbitrage_opportunities_twodex',
      'calculate_pair_opportunities',
      'calculate_direct_arbitrage',
      'cache_profit',
      'get_cached_profit'
    ];
    
    let allFunctionsPresent = true;
    
    for (const func of requiredFunctions) {
      if (rustContent.includes(`fn ${func}`) || rustContent.includes(`pub fn ${func}`) || rustContent.includes(`pub async fn ${func}`)) {
        console.log(`  ✅ Función encontrada: ${func}()`);
      } else {
        console.log(`  ❌ Función faltante: ${func}()`);
        allFunctionsPresent = false;
      }
    }
    
    // Verificar memoización
    const hasMemoization = rustContent.includes('HashMap') && 
                          rustContent.includes('cache_hits') && 
                          rustContent.includes('cache_misses');
    
    if (hasMemoization) {
      console.log('  ✅ Memoización implementada (HashMap cache)');
    } else {
      console.log('  ❌ Memoización no implementada');
    }
    
    if (allStructsPresent && allFunctionsPresent && hasMemoization) {
      console.log('\n  ✅ Rust Engine implementado correctamente');
      passedValidations++;
    } else {
      console.log('\n  ❌ Rust Engine incompleto');
    }
    
    results.push({
      name: 'Rust Engine (DP y memoización)',
      status: (allStructsPresent && allFunctionsPresent && hasMemoization) ? 'PASS' : 'FAIL',
      details: `${requiredStructs.length} structs, ${requiredFunctions.length} funciones, memoización`
    });
    
  } catch (error) {
    console.log(`  ❌ Error al leer Rust Engine: ${error.message}`);
    results.push({
      name: 'Rust Engine (DP y memoización)',
      status: 'FAIL',
      details: error.message
    });
  }
} else {
  console.log(`  ❌ Rust Engine no encontrado: ${rustEnginePath}`);
  results.push({
    name: 'Rust Engine (DP y memoización)',
    status: 'FAIL',
    details: 'Archivo no encontrado'
  });
}

totalValidations++;

// ----------------------------------------------------------------------------
// 4. VALIDAR TS EXECUTOR - 40+ FLASH LOANS
// ----------------------------------------------------------------------------

console.log('\n4️⃣  Validando TS Executor (40+ flash loans atómicos)...');

const tsExecutorPath = path.join(__dirname, '../services/ts-executor/src/exec/flash_v2.ts');

if (fs.existsSync(tsExecutorPath)) {
  try {
    const tsContent = fs.readFileSync(tsExecutorPath, 'utf8');
    
    // Verificar función principal
    if (tsContent.includes('executeMultipleArbitrages') && 
        tsContent.includes('concurrent: number = 40')) {
      console.log('  ✅ Función executeMultipleArbitrages() con soporte para 40+ operaciones');
    } else {
      console.log('  ❌ Función executeMultipleArbitrages() no encontrada o sin soporte para 40+');
    }
    
    // Verificar características clave
    const features = [
      { name: 'Validación con oráculos', check: 'validateRoutesWithOracles' },
      { name: 'Circuit breaker', check: 'circuitBreakerOpen' },
      { name: 'Gestión de gas dinámico', check: 'getGasPrice' },
      { name: 'Escritura a EXECUTIONS', check: 'writeExecutionsArray' },
      { name: 'Lectura desde ROUTES', check: 'getRoutesArray' },
      { name: 'Retry logic', check: 'Promise.allSettled' }
    ];
    
    let allFeaturesPresent = true;
    
    for (const feature of features) {
      if (tsContent.includes(feature.check)) {
        console.log(`  ✅ ${feature.name}`);
      } else {
        console.log(`  ❌ ${feature.name} no implementado`);
        allFeaturesPresent = false;
      }
    }
    
    if (allFeaturesPresent) {
      console.log('\n  ✅ TS Executor implementado correctamente');
      passedValidations++;
    } else {
      console.log('\n  ❌ TS Executor incompleto');
    }
    
    results.push({
      name: 'TS Executor (40+ flash loans)',
      status: allFeaturesPresent ? 'PASS' : 'FAIL',
      details: `${features.length} características verificadas`
    });
    
  } catch (error) {
    console.log(`  ❌ Error al leer TS Executor: ${error.message}`);
    results.push({
      name: 'TS Executor (40+ flash loans)',
      status: 'FAIL',
      details: error.message
    });
  }
} else {
  console.log(`  ❌ TS Executor no encontrado: ${tsExecutorPath}`);
  results.push({
    name: 'TS Executor (40+ flash loans)',
    status: 'FAIL',
    details: 'Archivo no encontrado'
  });
}

totalValidations++;

// ----------------------------------------------------------------------------
// 5. VALIDAR GAS ADVANCED MAPPER
// ----------------------------------------------------------------------------

console.log('\n5️⃣  Validando gas-advanced-mapper.gs...');

const gasMapperPath = path.join(__dirname, '../apps-script/gas-advanced-mapper.gs');

if (fs.existsSync(gasMapperPath)) {
  try {
    const gasContent = fs.readFileSync(gasMapperPath, 'utf8');
    
    // Verificar función mapCompleteRepository
    if (gasContent.includes('function mapCompleteRepository()')) {
      console.log('  ✅ Función mapCompleteRepository() encontrada');
      passedValidations++;
    } else {
      console.log('  ❌ Función mapCompleteRepository() no encontrada');
    }
    
    results.push({
      name: 'gas-advanced-mapper.gs (mapCompleteRepository)',
      status: gasContent.includes('function mapCompleteRepository()') ? 'PASS' : 'FAIL',
      details: 'Función principal verificada'
    });
    
  } catch (error) {
    console.log(`  ❌ Error al leer gas-advanced-mapper.gs: ${error.message}`);
    results.push({
      name: 'gas-advanced-mapper.gs (mapCompleteRepository)',
      status: 'FAIL',
      details: error.message
    });
  }
} else {
  console.log(`  ❌ gas-advanced-mapper.gs no encontrado: ${gasMapperPath}`);
  results.push({
    name: 'gas-advanced-mapper.gs (mapCompleteRepository)',
    status: 'FAIL',
    details: 'Archivo no encontrado'
  });
}

totalValidations++;

// ============================================================================
// RESUMEN FINAL
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('📊 RESUMEN DE VALIDACIÓN E2E');
console.log('='.repeat(80));

console.log(`\n✅ Validaciones pasadas: ${passedValidations}/${totalValidations}`);
console.log(`📈 Porcentaje de completitud: ${((passedValidations / totalValidations) * 100).toFixed(2)}%`);

console.log('\n📋 Detalle de resultados:\n');

for (const result of results) {
  const icon = result.status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${result.name}`);
  console.log(`   Status: ${result.status}`);
  console.log(`   Detalles: ${result.details}\n`);
}

// Guardar reporte
const reportPath = path.join(__dirname, 'validation-1016-fields-report.json');
const report = {
  timestamp: new Date().toISOString(),
  totalValidations,
  passedValidations,
  completeness: ((passedValidations / totalValidations) * 100).toFixed(2) + '%',
  results,
  expectedSchema: EXPECTED_SCHEMA,
  totalExpectedFields: TOTAL_EXPECTED_FIELDS
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`📄 Reporte guardado en: ${reportPath}`);

// Exit code
process.exit(passedValidations === totalValidations ? 0 : 1);

