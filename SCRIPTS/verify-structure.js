#!/usr/bin/env node
/**
 * verify-structure.js
 * 
 * Script crítico de validación de estructura del repositorio ARBITRAGEXPLUS2025.
 * 
 * RESPONSABILIDADES:
 * - Verificar existencia de todos los archivos críticos del ecosistema
 * - Validar integridad de estructura de directorios
 * - Detectar archivos faltantes que bloquean el sistema
 * - Generar reporte detallado de estado con métricas de completitud
 * - Exit con código apropiado para integración CI/CD
 * 
 * INTEGRACIÓN:
 * - Pre-commit hook obligatorio
 * - GitHub Actions workflow de validación
 * - Health check local pre-deployment
 * 
 * EJECUCIÓN:
 * node SCRIPTS/verify-structure.js
 * 
 * EXIT CODES:
 * 0 = Estructura válida, todos los archivos críticos presentes
 * 1 = Faltan archivos críticos o estructura inválida (BLOQUEANTE)
 * 
 * @author ARBITRAGEXPLUS2025 Core Team
 * @version 1.0.0
 * @criticality BLOQUEANTE
 * @integration-with sheets:MODULOS_REGISTRADOS, LOG_ERRORES_EVENTOS
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// ============================================================================
// CONFIGURACIÓN: Lista exhaustiva de archivos y carpetas CRÍTICOS
// Esta estructura debe mantenerse sincronizada con Google Sheets
// Hoja: MODULOS_REGISTRADOS, Columnas: RUTA_ARCHIVO, ESTADO, CRITICIDAD
// ============================================================================

const EXPECTED_STRUCTURE = {
  // ========== ARCHIVOS RAÍZ OBLIGATORIOS ==========
  ROOT_FILES: [
    'package.json',
    'pnpm-workspace.yaml',
    'fly.toml',
    'README.md',
    '.gitignore',
    '.editorconfig',
    '.env.example',
    'CHECKLIST_MANU_MASTER.md',
    'CHANGELOG.md'
  ],

  // ========== CARPETAS PRINCIPALES OBLIGATORIAS ==========
  ROOT_DIRECTORIES: [
    '.github',
    '.github/workflows',
    '.github/ISSUE_TEMPLATE',
    '.github/PULL_REQUEST_TEMPLATE',
    'SCRIPTS',
    'configs',
    'services',
    'services/api-server',
    'services/python-collector',
    'services/engine-rust',
    'services/ts-executor',
    'contracts',
    'docs',
    'db',
    'db/migrations',
    'db/seeds',
    'tools'
  ],

  // ========== ARCHIVOS DE CONFIGURACIÓN ==========
  CONFIG_FILES: [
    'configs/chains.yaml',
    'configs/dex.yaml',
    'configs/tokens.yaml',
    'configs/pools.yaml',
    'configs/strategies.yaml',
    'configs/monitoring.yaml'
  ],

  // ========== SCRIPTS DE VALIDACIÓN (estos mismos) ==========
  VALIDATION_SCRIPTS: [
    'SCRIPTS/package.json',
    'SCRIPTS/verify-structure.js',
    'SCRIPTS/scan-dead-paths.js',
    'SCRIPTS/check-fly-config.js',
    'SCRIPTS/validate-deployment.js',
    'SCRIPTS/validate-local-health.js'
  ],

  // ========== SERVICIOS CRÍTICOS - API SERVER ==========
  API_SERVER_CRITICAL: [
    'services/api-server/package.json',
    'services/api-server/tsconfig.json',
    'services/api-server/Dockerfile',
    'services/api-server/src/server.ts',
    'services/api-server/src/routes/index.ts',
    'services/api-server/src/adapters/ws/websocketManager.ts',
    'services/api-server/src/adapters/ws/uniswap.ts',
    'services/api-server/src/adapters/ws/sushiswap.ts',
    'services/api-server/src/adapters/ws/pancakeswap.ts',
    'services/api-server/src/oracles/pyth.ts',
    'services/api-server/src/oracles/chainlink.ts',
    'services/api-server/src/services/sheetsService.ts',
    'services/api-server/src/services/arbitrageService.ts',
    'services/api-server/src/exec/flash.ts',
    'services/api-server/src/controllers/arbitrage.ts',
    'services/api-server/src/controllers/health.ts'
  ],

  // ========== SERVICIOS CRÍTICOS - PYTHON COLLECTOR ==========
  PYTHON_COLLECTOR_CRITICAL: [
    'services/python-collector/requirements.txt',
    'services/python-collector/setup.py',
    'services/python-collector/src/main.py',
    'services/python-collector/src/sheets/client.py',
    'services/python-collector/src/sheets/config_reader.py',
    'services/python-collector/src/sheets/route_writer.py',
    'services/python-collector/src/collectors/dex_prices.py',
    'services/python-collector/src/collectors/blockchain_health.py',
    'services/python-collector/src/connectors/pyth.py',
    'services/python-collector/src/connectors/defillama.py',
    'services/python-collector/src/connectors/publicnodes.py'
  ],

  // ========== SERVICIOS CRÍTICOS - RUST ENGINE ==========
  RUST_ENGINE_CRITICAL: [
    'services/engine-rust/Cargo.toml',
    'services/engine-rust/src/main.rs',
    'services/engine-rust/src/lib.rs',
    'services/engine-rust/src/pathfinding/mod.rs',
    'services/engine-rust/src/pathfinding/two_dex.rs',
    'services/engine-rust/src/pathfinding/three_dex.rs',
    'services/engine-rust/src/pathfinding/ranking.rs',
    'services/engine-rust/src/pricing/mod.rs',
    'services/engine-rust/src/pricing/dex_pricing.rs',
    'services/engine-rust/src/engine/mod.rs',
    'services/engine-rust/src/engine/arbitrage.rs',
    'services/engine-rust/src/engine/optimizer.rs',
    'services/engine-rust/src/connectors/sheets.rs',
    'services/engine-rust/src/connectors/blockchain.rs'
  ],

  // ========== SERVICIOS CRÍTICOS - TS EXECUTOR ==========
  TS_EXECUTOR_CRITICAL: [
    'services/ts-executor/package.json',
    'services/ts-executor/tsconfig.json',
    'services/ts-executor/src/index.ts',
    'services/ts-executor/src/exec/flash.ts',
    'services/ts-executor/src/queues/queueManager.ts',
    'services/ts-executor/src/chains/manager.ts',
    'services/ts-executor/src/jobs/arbitrage_job.ts'
  ],

  // ========== CONTRATOS SOLIDITY ==========
  CONTRACTS_CRITICAL: [
    'contracts/foundry.toml',
    'contracts/src/ArbitrageExecutor.sol',
    'contracts/src/Router.sol',
    'contracts/src/Vault.sol',
    'contracts/interfaces/IERC20.sol',
    'contracts/interfaces/IFlashLoanReceiver.sol',
    'contracts/test/ArbitrageExecutor.t.sol',
    'contracts/script/DeployArbitrage.s.sol'
  ],

  // ========== DOCUMENTACIÓN ==========
  DOCUMENTATION: [
    'docs/ARCHITECTURE.md',
    'docs/DATAFLOW.md',
    'docs/PLAN_DE_ACCION_ES.md',
    'docs/REQUISITOS_TECNICOS_P0_ES.md',
    'docs/API.md'
  ],

  // ========== GITHUB WORKFLOWS ==========
  GITHUB_WORKFLOWS: [
    '.github/workflows/ci.yml',
    '.github/workflows/deploy.yml',
    '.github/workflows/validate.yml'
  ],

  // ========== PLANTILLAS GITHUB ==========
  GITHUB_TEMPLATES: [
    '.github/ISSUE_TEMPLATE/bug-report.md',
    '.github/ISSUE_TEMPLATE/feature-request.md',
    '.github/ISSUE_TEMPLATE/operational.md',
    '.github/PULL_REQUEST_TEMPLATE/default.md',
    '.github/PULL_REQUEST_TEMPLATE/manu-fly-deployment.md'
  ]
};

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

/**
 * Verifica si un path existe (archivo o directorio)
 * @param {string} relativePath - Path relativo desde raíz del proyecto
 * @returns {boolean} true si existe, false si no
 */
function pathExists(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  return fs.existsSync(fullPath);
}

/**
 * Determina si un path es archivo o directorio
 * @param {string} relativePath - Path relativo
 * @returns {string} 'file', 'directory', o 'missing'
 */
function getPathType(relativePath) {
  const fullPath = path.join(process.cwd(), relativePath);
  
  if (!fs.existsSync(fullPath)) {
    return 'missing';
  }
  
  const stats = fs.statSync(fullPath);
  return stats.isDirectory() ? 'directory' : 'file';
}

/**
 * Verifica una lista de paths y registra resultados con formato colorido
 * @param {string} category - Nombre de la categoría
 * @param {Array<string>} paths - Lista de paths a verificar
 * @returns {Object} Objeto con arrays de found y missing
 */
function verifyPaths(category, paths) {
  console.log(chalk.bold.blue(`\n📁 ${category}`));
  console.log(chalk.gray('─'.repeat(70)));
  
  const results = {
    found: [],
    missing: [],
    details: []
  };
  
  for (const itemPath of paths) {
    const type = getPathType(itemPath);
    
    if (type !== 'missing') {
      const icon = type === 'directory' ? '📂' : '📄';
      console.log(chalk.green(`  ✓ ${icon} ${itemPath}`));
      results.found.push(itemPath);
      results.details.push({ path: itemPath, status: 'found', type });
    } else {
      const expectedType = itemPath.includes('.') ? '📄' : '📂';
      console.log(chalk.red(`  ✗ ${expectedType} ${itemPath} ${chalk.yellow('[FALTANTE]')}`));
      results.missing.push(itemPath);
      results.details.push({ path: itemPath, status: 'missing', type: 'unknown' });
    }
  }
  
  return results;
}

/**
 * Genera reporte final consolidado con estadísticas y recomendaciones
 * @param {Object} allResults - Resultados de todas las categorías
 * @returns {boolean} true si validación exitosa, false si hay errores
 */
function generateReport(allResults) {
  console.log(chalk.bold.cyan('\n\n' + '='.repeat(75)));
  console.log(chalk.bold.cyan('📊 REPORTE FINAL DE VALIDACIÓN DE ESTRUCTURA'));
  console.log(chalk.bold.cyan('='.repeat(75) + '\n'));
  
  let totalFound = 0;
  let totalMissing = 0;
  const criticalCategories = [];
  const allMissingFiles = [];
  
  // Consolidar resultados por categoría
  for (const [category, result] of Object.entries(allResults)) {
    totalFound += result.found.length;
    totalMissing += result.missing.length;
    
    if (result.missing.length > 0) {
      criticalCategories.push({
        category,
        missing: result.missing.length,
        files: result.missing
      });
      allMissingFiles.push(...result.missing);
    }
  }
  
  const totalExpected = totalFound + totalMissing;
  const completionPercentage = totalExpected > 0 
    ? ((totalFound / totalExpected) * 100).toFixed(2)
    : 0;
  
  // Estadísticas generales
  console.log(chalk.bold('📈 Estadísticas Generales:'));
  console.log(`  Total archivos/carpetas esperados: ${chalk.cyan(totalExpected)}`);
  console.log(`  Encontrados: ${chalk.green(totalFound)}`);
  console.log(`  Faltantes: ${chalk.red(totalMissing)}`);
  console.log(`  Completitud: ${completionPercentage >= 90 ? chalk.green(completionPercentage + '%') : chalk.red(completionPercentage + '%')}`);
  
  // Análisis por criticidad
  if (criticalCategories.length > 0) {
    console.log(chalk.bold.red('\n❌ ELEMENTOS CRÍTICOS FALTANTES:\n'));
    
    // Ordenar por cantidad de faltantes (mayor a menor)
    criticalCategories.sort((a, b) => b.missing - a.missing);
    
    for (const { category, missing, files } of criticalCategories) {
      console.log(chalk.red(`  📂 ${category} - ${missing} faltante(s):`));
      for (const file of files) {
        const isBlocker = 
          category.includes('CRITICAL') || 
          category.includes('VALIDATION') ||
          category.includes('WORKFLOWS');
        const marker = isBlocker ? '🔴 BLOQUEANTE' : '🟡 IMPORTANTE';
        console.log(chalk.red(`     ${marker} ${file}`));
      }
      console.log('');
    }
    
    console.log(chalk.bold.yellow('\n⚠️  PLAN DE ACCIÓN REQUERIDO:\n'));
    console.log(chalk.yellow(`  1. Revisa los ${totalMissing} archivos/carpetas faltantes listados arriba`));
    console.log(chalk.yellow('  2. Identifica los marcados como 🔴 BLOQUEANTE (prioridad máxima)'));
    console.log(chalk.yellow('  3. Crea los elementos faltantes en las rutas correctas'));
    console.log(chalk.yellow('  4. Ejecuta nuevamente este script: node SCRIPTS/verify-structure.js'));
    console.log(chalk.yellow('  5. Repite hasta que la completitud sea 100%\n'));
    
    // Recomendaciones específicas
    console.log(chalk.bold.cyan('💡 RECOMENDACIONES:\n'));
    
    if (allMissingFiles.some(f => f.includes('SCRIPTS/'))) {
      console.log(chalk.cyan('  • Faltan scripts de validación: Estos son BLOQUEANTES'));
      console.log(chalk.cyan('    Implementa primero todos los archivos en SCRIPTS/\n'));
    }
    
    if (allMissingFiles.some(f => f.includes('adapters/ws'))) {
      console.log(chalk.cyan('  • Faltan adaptadores WebSocket: CRÍTICOS para 40 operaciones simultáneas'));
      console.log(chalk.cyan('    Implementa websocketManager.ts y adaptadores de DEX\n'));
    }
    
    if (allMissingFiles.some(f => f.includes('sheets/'))) {
      console.log(chalk.cyan('  • Faltan integraciones Google Sheets: Cerebro del sistema BLOQUEANTE'));
      console.log(chalk.cyan('    Implementa client.py, config_reader.py, route_writer.py\n'));
    }
    
    if (allMissingFiles.some(f => f.includes('pathfinding/'))) {
      console.log(chalk.cyan('  • Faltan algoritmos pathfinding: BLOQUEANTES para arbitraje DP'));
      console.log(chalk.cyan('    Implementa two_dex.rs y three_dex.rs con DP algorithms\n'));
    }
    
    return false; // Validación fallida
  }
  
  // Éxito total
  console.log(chalk.bold.green('✅ VALIDACIÓN EXITOSA - ESTRUCTURA COMPLETA AL 100%'));
  console.log(chalk.green('   Todos los archivos y carpetas críticos están presentes.\n'));
  
  console.log(chalk.bold.cyan('📋 SIGUIENTES PASOS:\n'));
  console.log(chalk.cyan('  1. Ejecutar escaneo de rutas muertas:'));
  console.log(chalk.cyan('     node SCRIPTS/scan-dead-paths.js\n'));
  console.log(chalk.cyan('  2. Validar configuración Fly.io:'));
  console.log(chalk.cyan('     node SCRIPTS/check-fly-config.js\n'));
  console.log(chalk.cyan('  3. Ejecutar health checks locales:'));
  console.log(chalk.cyan('     node SCRIPTS/validate-local-health.js\n'));
  
  return true; // Validación exitosa
}

/**
 * Guarda reporte en archivo JSON para auditoría
 */
function saveReportToFile(allResults, isValid) {
  const report = {
    timestamp: new Date().toISOString(),
    validation_status: isValid ? 'PASS' : 'FAIL',
    results: allResults,
    executed_by: process.env.USER || 'unknown',
    project_root: process.cwd()
  };
  
  const reportPath = path.join(process.cwd(), 'SCRIPTS', 'validation-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(chalk.gray(`\n📄 Reporte guardado en: ${reportPath}\n`));
}

// ============================================================================
// EJECUCIÓN PRINCIPAL
// ============================================================================

function main() {
  console.log(chalk.bold.magenta('\n╔════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║  ARBITRAGEXPLUS2025 - Validación Estructura Repositorio ║'));
  console.log(chalk.bold.magenta('║  Sistema de Arbitraje DeFi Autónomo                       ║'));
  console.log(chalk.bold.magenta('╚════════════════════════════════════════════════════════╝\n'));
  
  console.log(chalk.gray(`🔍 Ejecutando desde: ${process.cwd()}`));
  console.log(chalk.gray(`📅 Fecha: ${new Date().toLocaleString('es-ES')}`));
  console.log(chalk.gray(`👤 Usuario: ${process.env.USER || 'unknown'}\n`));
  
  // Verificar cada categoría de archivos/carpetas
  const allResults = {
    'Archivos Raíz': verifyPaths('Archivos Raíz', EXPECTED_STRUCTURE.ROOT_FILES),
    'Directorios Principales': verifyPaths('Directorios Principales', EXPECTED_STRUCTURE.ROOT_DIRECTORIES),
    'Configuraciones': verifyPaths('Configuraciones', EXPECTED_STRUCTURE.CONFIG_FILES),
    'Scripts de Validación': verifyPaths('Scripts de Validación (CRÍTICOS)', EXPECTED_STRUCTURE.VALIDATION_SCRIPTS),
    'API Server': verifyPaths('API Server (CRÍTICOS)', EXPECTED_STRUCTURE.API_SERVER_CRITICAL),
    'Python Collector': verifyPaths('Python Collector (CRÍTICOS)', EXPECTED_STRUCTURE.PYTHON_COLLECTOR_CRITICAL),
    'Rust Engine': verifyPaths('Rust Engine (CRÍTICOS)', EXPECTED_STRUCTURE.RUST_ENGINE_CRITICAL),
    'TS Executor': verifyPaths('TS Executor (CRÍTICOS)', EXPECTED_STRUCTURE.TS_EXECUTOR_CRITICAL),
    'Contratos Solidity': verifyPaths('Contratos Solidity (CRÍTICOS)', EXPECTED_STRUCTURE.CONTRACTS_CRITICAL),
    'Documentación': verifyPaths('Documentación', EXPECTED_STRUCTURE.DOCUMENTATION),
    'GitHub Workflows': verifyPaths('GitHub Workflows (CI/CD)', EXPECTED_STRUCTURE.GITHUB_WORKFLOWS),
    'GitHub Templates': verifyPaths('GitHub Templates', EXPECTED_STRUCTURE.GITHUB_TEMPLATES)
  };
  
  // Generar reporte consolidado
  const isValid = generateReport(allResults);
  
  // Guardar reporte en JSON
  saveReportToFile(allResults, isValid);
  
  // Exit con código apropiado para CI/CD
  process.exit(isValid ? 0 : 1);
}

// Ejecutar si es llamado directamente (no si es importado como módulo)
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(chalk.bold.red('\n❌ ERROR CRÍTICO EN EJECUCIÓN:\n'));
    console.error(chalk.red(error.message));
    console.error(chalk.gray('\nStack trace:'));
    console.error(chalk.gray(error.stack));
    process.exit(1);
  }
}

// Exportar funciones para testing
module.exports = {
  verifyPaths,
  pathExists,
  getPathType,
  EXPECTED_STRUCTURE
};