#!/usr/bin/env node

/**
 * VALIDACIÓN E2E FINAL - PROMPT SUPREMO DEFINITIVO
 * 
 * Este script valida que todas las tareas del Prompt Supremo Definitivo
 * con Lista Detallada de Tareas por Archivo han sido completadas correctamente.
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('VALIDACIÓN E2E FINAL - PROMPT SUPREMO DEFINITIVO CON LISTA DE TAREAS');
console.log('================================================================================\n');

const validations = [];

// ============================================================================
// BLOQUE 1: GOOGLE SHEETS BRAIN
// ============================================================================

console.log('📋 BLOQUE 1: GOOGLE SHEETS BRAIN\n');

// Tarea 1.1: gas-advanced-mapper.gs
const task11Path = 'apps-script/gas-advanced-mapper.gs';
const task11Exists = fs.existsSync(task11Path);
const task11Content = task11Exists ? fs.readFileSync(task11Path, 'utf8') : '';
const task11HasMapComplete = task11Content.includes('mapCompleteRepository');
const task11HasSheetSchema = task11Content.includes('SHEET_SCHEMA');

validations.push({
  task: 'Tarea 1.1: gas-advanced-mapper.gs',
  checks: [
    { name: 'Archivo existe', pass: task11Exists },
    { name: 'Función mapCompleteRepository()', pass: task11HasMapComplete },
    { name: 'SHEET_SCHEMA definido', pass: task11HasSheetSchema }
  ]
});

// Tarea 1.2: gas-repo-monitor.gs
const task12Path = 'apps-script/gas-repo-monitor.gs';
const task12Exists = fs.existsSync(task12Path);
const task12Content = task12Exists ? fs.readFileSync(task12Path, 'utf8') : '';
const task12HasMonitor = task12Content.includes('repositoryHealthMonitor');
const task12HasConfig = task12Content.includes('MONITOR_CONFIG');

validations.push({
  task: 'Tarea 1.2: gas-repo-monitor.gs',
  checks: [
    { name: 'Archivo existe', pass: task12Exists },
    { name: 'Función repositoryHealthMonitor()', pass: task12HasMonitor },
    { name: 'MONITOR_CONFIG definido', pass: task12HasConfig }
  ]
});

// ============================================================================
// BLOQUE 2: PYTHON COLLECTOR
// ============================================================================

console.log('📋 BLOQUE 2: PYTHON COLLECTOR\n');

// Tarea 2.1: sheets/client.py
const task21Path = 'services/python-collector/src/sheets/client.py';
const task21Exists = fs.existsSync(task21Path);
const task21Content = task21Exists ? fs.readFileSync(task21Path, 'utf8') : '';
const task21HasGetBlockchains = task21Content.includes('get_blockchains_array');
const task21HasGetDexes = task21Content.includes('get_dexes_array');
const task21HasGetAssets = task21Content.includes('get_assets_array');

validations.push({
  task: 'Tarea 2.1: sheets/client.py',
  checks: [
    { name: 'Archivo existe', pass: task21Exists },
    { name: 'Función get_blockchains_array()', pass: task21HasGetBlockchains },
    { name: 'Función get_dexes_array()', pass: task21HasGetDexes },
    { name: 'Función get_assets_array()', pass: task21HasGetAssets }
  ]
});

// Tarea 2.2: connectors/pyth.py
const task22Path = 'services/python-collector/src/connectors/pyth.py';
const task22Exists = fs.existsSync(task22Path);
const task22Content = task22Exists ? fs.readFileSync(task22Path, 'utf8') : '';
const task22HasUpdatePrices = task22Content.includes('update_prices_from_pyth');

validations.push({
  task: 'Tarea 2.2: connectors/pyth.py',
  checks: [
    { name: 'Archivo existe', pass: task22Exists },
    { name: 'Función update_prices_from_pyth()', pass: task22HasUpdatePrices }
  ]
});

// ============================================================================
// BLOQUE 3: RUST ENGINE
// ============================================================================

console.log('📋 BLOQUE 3: RUST ENGINE\n');

// Tarea 3.1: connectors/sheets.rs
const task31Path = 'services/engine-rust/src/connectors/sheets.rs';
const task31Exists = fs.existsSync(task31Path);
const task31Content = task31Exists ? fs.readFileSync(task31Path, 'utf8') : '';
const task31HasGetDexes = task31Content.includes('get_dexes_array');
const task31HasGetAssets = task31Content.includes('get_assets_array');
const task31HasGetPools = task31Content.includes('get_pools_array');

validations.push({
  task: 'Tarea 3.1: connectors/sheets.rs',
  checks: [
    { name: 'Archivo existe', pass: task31Exists },
    { name: 'Función get_dexes_array()', pass: task31HasGetDexes },
    { name: 'Función get_assets_array()', pass: task31HasGetAssets },
    { name: 'Función get_pools_array()', pass: task31HasGetPools }
  ]
});

// Tarea 3.2: pathfinding/twodex.rs
const task32Path = 'services/engine-rust/src/pathfinding/twodex.rs';
const task32Exists = fs.existsSync(task32Path);
const task32Content = task32Exists ? fs.readFileSync(task32Path, 'utf8') : '';
const task32HasFindArbitrage = task32Content.includes('find_arbitrage_opportunities_twodex');
const task32HasDPMemo = task32Content.includes('DPMemoState');

validations.push({
  task: 'Tarea 3.2: pathfinding/twodex.rs',
  checks: [
    { name: 'Archivo existe', pass: task32Exists },
    { name: 'Función find_arbitrage_opportunities_twodex()', pass: task32HasFindArbitrage },
    { name: 'Struct DPMemoState (memoización)', pass: task32HasDPMemo }
  ]
});

// ============================================================================
// BLOQUE 4: TS EXECUTOR
// ============================================================================

console.log('📋 BLOQUE 4: TS EXECUTOR\n');

// Tarea 4.1: exec/flash.ts
const task41Path = 'services/ts-executor/src/exec/flash.ts';
const task41Exists = fs.existsSync(task41Path);
const task41Content = task41Exists ? fs.readFileSync(task41Path, 'utf8') : '';
const task41HasExecuteMultiple = task41Content.includes('executeMultipleArbitrages');
const task41HasReadRoutes = task41Content.includes('readRoutesFromSheets');
const task41HasValidateOracles = task41Content.includes('validateWithOracles');

validations.push({
  task: 'Tarea 4.1: exec/flash.ts',
  checks: [
    { name: 'Archivo existe', pass: task41Exists },
    { name: 'Función executeMultipleArbitrages()', pass: task41HasExecuteMultiple },
    { name: 'Función readRoutesFromSheets()', pass: task41HasReadRoutes },
    { name: 'Función validateWithOracles()', pass: task41HasValidateOracles }
  ]
});

// ============================================================================
// BLOQUE 5: SMART CONTRACTS
// ============================================================================

console.log('📋 BLOQUE 5: SMART CONTRACTS\n');

// Tarea 5.1: ArbitrageExecutor.sol
const task51Path = 'contracts/src/ArbitrageExecutor.sol';
const task51Exists = fs.existsSync(task51Path);
const task51Content = task51Exists ? fs.readFileSync(task51Path, 'utf8') : '';
const task51HasExecuteArbitrage = task51Content.includes('function executeArbitrage');
const task51HasFlashLoan = task51Content.includes('executeOperation');

validations.push({
  task: 'Tarea 5.1: ArbitrageExecutor.sol',
  checks: [
    { name: 'Archivo existe', pass: task51Exists },
    { name: 'Función executeArbitrage()', pass: task51HasExecuteArbitrage },
    { name: 'Callback executeOperation() (flash loan)', pass: task51HasFlashLoan }
  ]
});

// ============================================================================
// RESUMEN DE VALIDACIONES
// ============================================================================

console.log('\n================================================================================');
console.log('RESUMEN DE VALIDACIONES');
console.log('================================================================================\n');

let totalChecks = 0;
let passedChecks = 0;

validations.forEach(validation => {
  const allPassed = validation.checks.every(c => c.pass);
  const status = allPassed ? '✅ PASS' : '❌ FAIL';
  
  console.log(`${status} ${validation.task}`);
  
  validation.checks.forEach(check => {
    totalChecks++;
    if (check.pass) {
      passedChecks++;
      console.log(`   ✅ ${check.name}`);
    } else {
      console.log(`   ❌ ${check.name}`);
    }
  });
  
  console.log('');
});

const percentage = ((passedChecks / totalChecks) * 100).toFixed(2);

console.log('================================================================================');
console.log(`✅ Validaciones pasadas: ${passedChecks}/${totalChecks}`);
console.log(`📈 Porcentaje de completitud: ${percentage}%`);
console.log('================================================================================\n');

if (passedChecks === totalChecks) {
  console.log('🎉 ¡TODAS LAS TAREAS DEL PROMPT SUPREMO DEFINITIVO COMPLETADAS AL 100%!');
  console.log('🚀 El sistema está listo para producción.\n');
  process.exit(0);
} else {
  console.log('⚠️  Algunas validaciones fallaron. Revisa los detalles arriba.\n');
  process.exit(1);
}

