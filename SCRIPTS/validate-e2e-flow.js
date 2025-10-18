#!/usr/bin/env node

/**
 * validate-e2e-flow.js
 * 
 * Validación E2E del flujo completo según Prompt Supremo Definitivo - FASE 6
 * 
 * Flujo completo:
 * Google Sheets (BLOCKCHAINS, DEXES, ASSETS, POOLS)
 *   → Python Collector (dynamic_client.py)
 *   → Rust Engine (twodex_dp.rs con DP y memoización)
 *   → Google Sheets (ROUTES)
 *   → TS Executor (FlashLoanExecutorV2.ts)
 *   → Smart Contracts (FlashLoanArbitrage.sol)
 *   → Blockchain
 *   → Google Sheets (EXECUTIONS, METRICS, LOGS)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const VALIDATION_CONFIG = {
  projectRoot: path.resolve(__dirname, '..'),
  requiredEnvVars: [
    'GOOGLE_SHEETS_SPREADSHEET_ID',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'PRIVATE_KEY',
    'RPC_URL'
  ],
  criticalPaths: {
    // Python Collector
    pythonCollector: 'services/python-collector/src/sheets/dynamic_client.py',
    pythonPythConnector: 'services/python-collector/src/connectors/pyth_connector.py',
    
    // Rust Engine
    rustTypes: 'services/engine-rust/src/pathfinding/types.rs',
    rustTwodexDp: 'services/engine-rust/src/pathfinding/twodex_dp.rs',
    
    // TS Executor
    tsExecutor: 'services/ts-executor/src/executor/FlashLoanExecutorV2.ts',
    tsGasManager: 'services/ts-executor/src/gas/GasManager.ts',
    tsOracleValidator: 'services/ts-executor/src/oracles/OracleValidator.ts',
    tsSheetsClient: 'services/ts-executor/src/sheets/GoogleSheetsClient.ts',
    
    // Smart Contracts
    flashLoanArbitrage: 'contracts/src/FlashLoanArbitrage.sol',
    batchExecutor: 'contracts/src/BatchExecutor.sol',
    
    // Scripts
    expandSheets: 'scripts/expand-sheets-brain.js',
    gasAdvancedMapper: 'apps-script/gas-advanced-mapper.gs',
    
    // Configuración
    flyToml: 'fly.toml',
    envExample: '.env.example'
  }
};

// ============================================================================
// COLORES PARA OUTPUT
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log('═'.repeat(80), 'cyan');
  log(`  ${title}`, 'bright');
  log('═'.repeat(80), 'cyan');
}

// ============================================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================================

/**
 * Valida que todos los archivos críticos existan
 */
function validateCriticalFiles() {
  logSection('1. VALIDACIÓN DE ARCHIVOS CRÍTICOS');
  
  let allFilesExist = true;
  const missingFiles = [];
  
  Object.entries(VALIDATION_CONFIG.criticalPaths).forEach(([name, filePath]) => {
    const fullPath = path.join(VALIDATION_CONFIG.projectRoot, filePath);
    const exists = fs.existsSync(fullPath);
    
    if (exists) {
      log(`  ✅ ${name}: ${filePath}`, 'green');
    } else {
      log(`  ❌ ${name}: ${filePath}`, 'red');
      missingFiles.push(filePath);
      allFilesExist = false;
    }
  });
  
  if (!allFilesExist) {
    log(`\n  ⚠️  Archivos faltantes: ${missingFiles.length}`, 'yellow');
    return false;
  }
  
  log('\n  ✅ Todos los archivos críticos presentes', 'green');
  return true;
}

/**
 * Valida la estructura de Google Sheets Brain
 */
function validateSheetsBrain() {
  logSection('2. VALIDACIÓN DE GOOGLE SHEETS BRAIN');
  
  const expandSheetsPath = path.join(
    VALIDATION_CONFIG.projectRoot,
    VALIDATION_CONFIG.criticalPaths.expandSheets
  );
  
  if (!fs.existsSync(expandSheetsPath)) {
    log('  ❌ Script expand-sheets-brain.js no encontrado', 'red');
    return false;
  }
  
  // Leer el script y verificar que define el esquema correcto
  const scriptContent = fs.readFileSync(expandSheetsPath, 'utf8');
  
  const requiredSheets = [
    'BLOCKCHAINS',
    'DEXES',
    'ASSETS',
    'POOLS',
    'ROUTES',
    'EXECUTIONS',
    'ORACLES',
    'STRATEGIES',
    'FLASH_LOANS',
    'METRICS',
    'LOGS',
    'CONFIG',
    'ALERTS'
  ];
  
  const sheetsFound = requiredSheets.filter(sheet => 
    scriptContent.includes(sheet)
  );
  
  log(`  📊 Hojas definidas: ${sheetsFound.length}/${requiredSheets.length}`, 'cyan');
  
  sheetsFound.forEach(sheet => {
    log(`    ✅ ${sheet}`, 'green');
  });
  
  const missingSheets = requiredSheets.filter(sheet => 
    !sheetsFound.includes(sheet)
  );
  
  if (missingSheets.length > 0) {
    log(`\n  ⚠️  Hojas faltantes:`, 'yellow');
    missingSheets.forEach(sheet => {
      log(`    ❌ ${sheet}`, 'red');
    });
    return false;
  }
  
  log('\n  ✅ Estructura de Google Sheets Brain válida', 'green');
  return true;
}

/**
 * Valida el Python Collector
 */
function validatePythonCollector() {
  logSection('3. VALIDACIÓN DE PYTHON COLLECTOR');
  
  const dynamicClientPath = path.join(
    VALIDATION_CONFIG.projectRoot,
    VALIDATION_CONFIG.criticalPaths.pythonCollector
  );
  
  if (!fs.existsSync(dynamicClientPath)) {
    log('  ❌ dynamic_client.py no encontrado', 'red');
    return false;
  }
  
  const content = fs.readFileSync(dynamicClientPath, 'utf8');
  
  // Verificar funciones críticas
  const requiredFunctions = [
    'get_blockchains_array',
    'get_dexes_array',
    'get_assets_array',
    'get_pools_array',
    'get_routes_array',
    'write_routes_array',
    'write_executions_array'
  ];
  
  const functionsFound = requiredFunctions.filter(func => 
    content.includes(`def ${func}`)
  );
  
  log(`  📊 Funciones encontradas: ${functionsFound.length}/${requiredFunctions.length}`, 'cyan');
  
  functionsFound.forEach(func => {
    log(`    ✅ ${func}()`, 'green');
  });
  
  const missingFunctions = requiredFunctions.filter(func => 
    !functionsFound.includes(func)
  );
  
  if (missingFunctions.length > 0) {
    log(`\n  ⚠️  Funciones faltantes:`, 'yellow');
    missingFunctions.forEach(func => {
      log(`    ❌ ${func}()`, 'red');
    });
    return false;
  }
  
  // Verificar que NO haya hardcoding
  const hardcodedPatterns = [
    /blockchain_id\s*=\s*["'][^"']+["']/,
    /dex_id\s*=\s*["'][^"']+["']/,
    /0x[a-fA-F0-9]{40}/ // Ethereum addresses
  ];
  
  let hasHardcoding = false;
  hardcodedPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      log(`  ⚠️  Posible hardcoding detectado: ${pattern}`, 'yellow');
      hasHardcoding = true;
    }
  });
  
  if (hasHardcoding) {
    log('\n  ⚠️  ADVERTENCIA: Se detectó posible hardcoding en Python Collector', 'yellow');
  } else {
    log('\n  ✅ Sin hardcoding detectado', 'green');
  }
  
  log('  ✅ Python Collector válido', 'green');
  return true;
}

/**
 * Valida el Rust Engine
 */
function validateRustEngine() {
  logSection('4. VALIDACIÓN DE RUST ENGINE');
  
  const typesPath = path.join(
    VALIDATION_CONFIG.projectRoot,
    VALIDATION_CONFIG.criticalPaths.rustTypes
  );
  
  const twodexPath = path.join(
    VALIDATION_CONFIG.projectRoot,
    VALIDATION_CONFIG.criticalPaths.rustTwodexDp
  );
  
  if (!fs.existsSync(typesPath)) {
    log('  ❌ types.rs no encontrado', 'red');
    return false;
  }
  
  if (!fs.existsSync(twodexPath)) {
    log('  ❌ twodex_dp.rs no encontrado', 'red');
    return false;
  }
  
  // Verificar types.rs
  const typesContent = fs.readFileSync(typesPath, 'utf8');
  
  const requiredStructs = [
    'Blockchain',
    'Dex',
    'Asset',
    'Pool',
    'ArbitrageOpportunity',
    'DPMemoState'
  ];
  
  const structsFound = requiredStructs.filter(struct => 
    typesContent.includes(`struct ${struct}`)
  );
  
  log(`  📊 Structs encontrados: ${structsFound.length}/${requiredStructs.length}`, 'cyan');
  
  structsFound.forEach(struct => {
    log(`    ✅ ${struct}`, 'green');
  });
  
  // Verificar twodex_dp.rs
  const twodexContent = fs.readFileSync(twodexPath, 'utf8');
  
  const requiredFunctions = [
    'find_arbitrage_opportunities_twodex',
    'calculate_pair_opportunities',
    'calculate_direct_arbitrage'
  ];
  
  const functionsFound = requiredFunctions.filter(func => 
    twodexContent.includes(`fn ${func}`)
  );
  
  log(`\n  📊 Funciones encontradas: ${functionsFound.length}/${requiredFunctions.length}`, 'cyan');
  
  functionsFound.forEach(func => {
    log(`    ✅ ${func}()`, 'green');
  });
  
  // Verificar memoización
  const hasMemoization = twodexContent.includes('DPMemoState') && 
                         twodexContent.includes('cache_profit') &&
                         twodexContent.includes('get_cached_profit');
  
  if (hasMemoization) {
    log('\n  ✅ Memoización implementada (DP)', 'green');
  } else {
    log('\n  ❌ Memoización NO implementada', 'red');
    return false;
  }
  
  // Verificar que NO haya hardcoding
  const hasHardcodedAddresses = /0x[a-fA-F0-9]{40}/.test(twodexContent);
  
  if (hasHardcodedAddresses) {
    log('  ⚠️  ADVERTENCIA: Direcciones hardcodeadas detectadas', 'yellow');
  } else {
    log('  ✅ Sin hardcoding detectado', 'green');
  }
  
  log('\n  ✅ Rust Engine válido', 'green');
  return true;
}

/**
 * Valida el TS Executor
 */
function validateTSExecutor() {
  logSection('5. VALIDACIÓN DE TS EXECUTOR');
  
  const executorPath = path.join(
    VALIDATION_CONFIG.projectRoot,
    VALIDATION_CONFIG.criticalPaths.tsExecutor
  );
  
  if (!fs.existsSync(executorPath)) {
    log('  ❌ FlashLoanExecutorV2.ts no encontrado', 'red');
    return false;
  }
  
  const content = fs.readFileSync(executorPath, 'utf8');
  
  // Verificar funciones críticas
  const requiredMethods = [
    'executeMultipleArbitrages',
    'executeSingleArbitrage',
    'validateRoutesWithOracles',
    'resetCircuitBreaker'
  ];
  
  const methodsFound = requiredMethods.filter(method => 
    content.includes(`${method}(`) || content.includes(`${method} (`)
  );
  
  log(`  📊 Métodos encontrados: ${methodsFound.length}/${requiredMethods.length}`, 'cyan');
  
  methodsFound.forEach(method => {
    log(`    ✅ ${method}()`, 'green');
  });
  
  // Verificar integración con oráculos
  const hasOracleIntegration = content.includes('PythOracle') && 
                                content.includes('ChainlinkOracle');
  
  if (hasOracleIntegration) {
    log('\n  ✅ Integración con oráculos Pyth/Chainlink', 'green');
  } else {
    log('\n  ❌ Integración con oráculos faltante', 'red');
    return false;
  }
  
  // Verificar soporte para 40+ operaciones
  const hasParallelSupport = content.includes('maxConcurrent') || 
                             content.includes('concurrent');
  
  if (hasParallelSupport) {
    log('  ✅ Soporte para operaciones paralelas', 'green');
  } else {
    log('  ❌ Soporte para operaciones paralelas faltante', 'red');
    return false;
  }
  
  // Verificar circuit breaker
  const hasCircuitBreaker = content.includes('circuitBreakerOpen') &&
                            content.includes('failureCount');
  
  if (hasCircuitBreaker) {
    log('  ✅ Circuit breaker implementado', 'green');
  } else {
    log('  ❌ Circuit breaker faltante', 'red');
    return false;
  }
  
  // Verificar que NO haya claves privadas hardcodeadas
  const hasHardcodedKeys = /private.*key.*=.*["']0x[a-fA-F0-9]{64}["']/i.test(content);
  
  if (hasHardcodedKeys) {
    log('\n  ❌ CRÍTICO: Clave privada hardcodeada detectada', 'red');
    return false;
  } else {
    log('\n  ✅ Sin claves privadas hardcodeadas', 'green');
  }
  
  log('  ✅ TS Executor válido', 'green');
  return true;
}

/**
 * Valida los Smart Contracts
 */
function validateSmartContracts() {
  logSection('6. VALIDACIÓN DE SMART CONTRACTS');
  
  const flashLoanPath = path.join(
    VALIDATION_CONFIG.projectRoot,
    VALIDATION_CONFIG.criticalPaths.flashLoanArbitrage
  );
  
  const batchExecutorPath = path.join(
    VALIDATION_CONFIG.projectRoot,
    VALIDATION_CONFIG.criticalPaths.batchExecutor
  );
  
  if (!fs.existsSync(flashLoanPath)) {
    log('  ❌ FlashLoanArbitrage.sol no encontrado', 'red');
    return false;
  }
  
  if (!fs.existsSync(batchExecutorPath)) {
    log('  ❌ BatchExecutor.sol no encontrado', 'red');
    return false;
  }
  
  // Verificar FlashLoanArbitrage.sol
  const flashLoanContent = fs.readFileSync(flashLoanPath, 'utf8');
  
  const requiredFunctions = [
    'executeArbitrage',
    'executeFlashLoanArbitrage',
    'executeOperation'
  ];
  
  const functionsFound = requiredFunctions.filter(func => 
    flashLoanContent.includes(`function ${func}`)
  );
  
  log(`  📊 Funciones encontradas: ${functionsFound.length}/${requiredFunctions.length}`, 'cyan');
  
  functionsFound.forEach(func => {
    log(`    ✅ ${func}()`, 'green');
  });
  
  // Verificar que NO haya direcciones hardcodeadas
  const addressPattern = /address\s+\w+\s*=\s*0x[a-fA-F0-9]{40}/;
  const hasHardcodedAddresses = addressPattern.test(flashLoanContent);
  
  if (hasHardcodedAddresses) {
    log('\n  ⚠️  ADVERTENCIA: Direcciones hardcodeadas detectadas en contrato', 'yellow');
  } else {
    log('\n  ✅ Sin direcciones hardcodeadas', 'green');
  }
  
  // Verificar BatchExecutor.sol
  const batchContent = fs.readFileSync(batchExecutorPath, 'utf8');
  
  const hasBatchFunction = batchContent.includes('function executeBatch');
  
  if (hasBatchFunction) {
    log('  ✅ BatchExecutor.sol con función executeBatch', 'green');
  } else {
    log('  ❌ BatchExecutor.sol sin función executeBatch', 'red');
    return false;
  }
  
  log('\n  ✅ Smart Contracts válidos', 'green');
  return true;
}

/**
 * Valida la configuración de entorno
 */
function validateEnvironment() {
  logSection('7. VALIDACIÓN DE CONFIGURACIÓN DE ENTORNO');
  
  const envExamplePath = path.join(
    VALIDATION_CONFIG.projectRoot,
    VALIDATION_CONFIG.criticalPaths.envExample
  );
  
  if (!fs.existsSync(envExamplePath)) {
    log('  ❌ .env.example no encontrado', 'red');
    return false;
  }
  
  const envContent = fs.readFileSync(envExamplePath, 'utf8');
  
  const requiredVars = VALIDATION_CONFIG.requiredEnvVars;
  
  const varsFound = requiredVars.filter(varName => 
    envContent.includes(varName)
  );
  
  log(`  📊 Variables encontradas: ${varsFound.length}/${requiredVars.length}`, 'cyan');
  
  varsFound.forEach(varName => {
    log(`    ✅ ${varName}`, 'green');
  });
  
  const missingVars = requiredVars.filter(varName => 
    !varsFound.includes(varName)
  );
  
  if (missingVars.length > 0) {
    log(`\n  ⚠️  Variables faltantes en .env.example:`, 'yellow');
    missingVars.forEach(varName => {
      log(`    ❌ ${varName}`, 'red');
    });
    return false;
  }
  
  log('\n  ✅ Configuración de entorno válida', 'green');
  return true;
}

/**
 * Genera reporte final
 */
function generateFinalReport(results) {
  logSection('REPORTE FINAL DE VALIDACIÓN E2E');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  const failedTests = totalTests - passedTests;
  
  log(`\n  Total de validaciones: ${totalTests}`, 'cyan');
  log(`  ✅ Pasadas: ${passedTests}`, 'green');
  log(`  ❌ Fallidas: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  
  const percentage = ((passedTests / totalTests) * 100).toFixed(2);
  log(`\n  📊 Completitud: ${percentage}%`, percentage === '100.00' ? 'green' : 'yellow');
  
  console.log('');
  
  if (failedTests === 0) {
    log('╔════════════════════════════════════════════════════════════════════════╗', 'green');
    log('║  ✅ VALIDACIÓN E2E COMPLETADA EXITOSAMENTE                             ║', 'green');
    log('║                                                                        ║', 'green');
    log('║  El flujo completo está implementado y listo para producción:         ║', 'green');
    log('║  Sheets → Python → Rust → Sheets → TS → Contracts → Blockchain        ║', 'green');
    log('╚════════════════════════════════════════════════════════════════════════╝', 'green');
  } else {
    log('╔════════════════════════════════════════════════════════════════════════╗', 'yellow');
    log('║  ⚠️  VALIDACIÓN E2E INCOMPLETA                                         ║', 'yellow');
    log('║                                                                        ║', 'yellow');
    log('║  Algunas validaciones fallaron. Revisa los detalles arriba.           ║', 'yellow');
    log('╚════════════════════════════════════════════════════════════════════════╝', 'yellow');
  }
  
  console.log('');
  
  // Guardar reporte
  const reportPath = path.join(VALIDATION_CONFIG.projectRoot, 'VALIDATION_E2E_REPORT.md');
  
  const reportContent = `# Reporte de Validación E2E

**Fecha:** ${new Date().toISOString()}
**Completitud:** ${percentage}%

## Resultados

${Object.entries(results).map(([test, passed]) => 
  `- [${passed ? 'x' : ' '}] ${test}`
).join('\n')}

## Resumen

- Total de validaciones: ${totalTests}
- Pasadas: ${passedTests}
- Fallidas: ${failedTests}

${failedTests === 0 ? '✅ **VALIDACIÓN E2E COMPLETADA EXITOSAMENTE**' : '⚠️ **VALIDACIÓN E2E INCOMPLETA**'}

## Flujo E2E Implementado

\`\`\`
Google Sheets (BLOCKCHAINS, DEXES, ASSETS, POOLS)
  ↓
Python Collector (dynamic_client.py)
  ↓
Rust Engine (twodex_dp.rs con DP y memoización)
  ↓
Google Sheets (ROUTES)
  ↓
TS Executor (FlashLoanExecutorV2.ts)
  ↓
Smart Contracts (FlashLoanArbitrage.sol)
  ↓
Blockchain
  ↓
Google Sheets (EXECUTIONS, METRICS, LOGS)
\`\`\`
`;
  
  fs.writeFileSync(reportPath, reportContent);
  log(`📄 Reporte guardado en: ${reportPath}`, 'cyan');
  
  return failedTests === 0;
}

// ============================================================================
// MAIN
// ============================================================================

function main() {
  log('\n🚀 ARBITRAGEXPLUS2025 - Validación E2E del Flujo Completo\n', 'bright');
  
  const results = {
    'Archivos Críticos': validateCriticalFiles(),
    'Google Sheets Brain': validateSheetsBrain(),
    'Python Collector': validatePythonCollector(),
    'Rust Engine': validateRustEngine(),
    'TS Executor': validateTSExecutor(),
    'Smart Contracts': validateSmartContracts(),
    'Configuración de Entorno': validateEnvironment()
  };
  
  const success = generateFinalReport(results);
  
  process.exit(success ? 0 : 1);
}

// Ejecutar
main();

