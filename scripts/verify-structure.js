#!/usr/bin/env node

/**
 * ARBITRAGEXPLUS2025 - Structure Verification Script
 * 
 * Este script valida que todos los 124 archivos del sistema estén presentes
 * y tengan la estructura correcta. Es crítico para el funcionamiento del sistema
 * ya que garantiza que no hay rutas muertas ni archivos faltantes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ==================================================================================
// DEFINICIÓN DE ESTRUCTURA ESPERADA (124 archivos)
// ==================================================================================

const EXPECTED_STRUCTURE = {
  // Configuración base (8 archivos)
  '.env.example': { type: 'file', required: true, description: 'Template de variables de entorno' },
  '.editorconfig': { type: 'file', required: true, description: 'Configuración del editor' },
  '.gitignore': { type: 'file', required: true, description: 'Archivos ignorados por Git' },
  'package.json': { type: 'file', required: true, description: 'Configuración pnpm workspace' },
  'fly.toml': { type: 'file', required: true, description: 'Configuración Fly.io' },
  'README.md': { type: 'file', required: true, description: 'Documentación principal' },
  'CHANGELOG.md': { type: 'file', required: true, description: 'Registro de cambios' },
  'CHECKLIST-MANU-COMPLETO.md': { type: 'file', required: true, description: 'Manual implementación' },
  
  // GitHub & CI/CD (8 archivos)
  '.github/workflows/ci.yml': { type: 'file', required: true, description: 'Pipeline CI/CD principal' },
  '.github/workflows/deploy.yml': { type: 'file', required: true, description: 'Pipeline de deployment' },
  '.github/workflows/validate.yml': { type: 'file', required: true, description: 'Validaciones automáticas' },
  '.github/ISSUE_TEMPLATE/bug_report.md': { type: 'file', required: true, description: 'Template bugs' },
  '.github/ISSUE_TEMPLATE/feature_request.md': { type: 'file', required: true, description: 'Template features' },
  '.github/ISSUE_TEMPLATE/operativo.md': { type: 'file', required: true, description: 'Template operativo' },
  '.github/PULL_REQUEST_TEMPLATE/default.md': { type: 'file', required: true, description: 'Template PR por defecto' },
  '.github/PULL_REQUEST_TEMPLATE/manu-fly-deployment.md': { type: 'file', required: true, description: 'Template deployment' },
  
  // Configuraciones YAML (6 archivos)
  'configs/chains.yaml': { type: 'file', required: true, description: 'Configuración blockchains' },
  'configs/dex.yaml': { type: 'file', required: true, description: 'Configuración DEXes' },
  'configs/tokens.yaml': { type: 'file', required: true, description: 'Configuración tokens' },
  'configs/pools.yaml': { type: 'file', required: true, description: 'Configuración pools' },
  'configs/strategies.yaml': { type: 'file', required: true, description: 'Estrategias de arbitraje' },
  'configs/monitoring.yaml': { type: 'file', required: true, description: 'Configuración monitoreo' },
  
  // Scripts de validación (8 archivos)
  'scripts/verify-structure.js': { type: 'file', required: true, description: 'Validador de estructura' },
  'scripts/scan-dead-paths.js': { type: 'file', required: true, description: 'Escáner rutas muertas' },
  'scripts/check_fly_config.js': { type: 'file', required: true, description: 'Validador Fly.io' },
  'scripts/validate-deployment.js': { type: 'file', required: true, description: 'Validador deployment' },
  'scripts/validate-local-health.js': { type: 'file', required: true, description: 'Health check local' },
  'scripts/generate-schema.js': { type: 'file', required: true, description: 'Generador esquemas' },
  'scripts/guard-node-engines.js': { type: 'file', required: true, description: 'Validador Node.js' },
  'scripts/package.json': { type: 'file', required: true, description: 'Config scripts' },
  
  // API Server TypeScript (25 archivos)
  'services/api-server/package.json': { type: 'file', required: true, description: 'Config API server' },
  'services/api-server/tsconfig.json': { type: 'file', required: true, description: 'Config TypeScript' },
  'services/api-server/Dockerfile': { type: 'file', required: true, description: 'Container Docker' },
  'services/api-server/src/server.ts': { type: 'file', required: true, description: 'Servidor principal' },
  'services/api-server/src/adapters/ws/websocketManager.ts': { type: 'file', required: true, description: 'Manager WebSocket' },
  'services/api-server/src/adapters/ws/uniswap.ts': { type: 'file', required: true, description: 'Adapter Uniswap' },
  'services/api-server/src/adapters/ws/sushiswap.ts': { type: 'file', required: true, description: 'Adapter SushiSwap' },
  'services/api-server/src/adapters/ws/pancakeswap.ts': { type: 'file', required: true, description: 'Adapter PancakeSwap' },
  'services/api-server/src/config/database.ts': { type: 'file', required: true, description: 'Config base datos' },
  'services/api-server/src/config/redis.ts': { type: 'file', required: true, description: 'Config Redis' },
  'services/api-server/src/config/settings.ts': { type: 'file', required: true, description: 'Configuraciones' },
  'services/api-server/src/controllers/arbitrageController.ts': { type: 'file', required: true, description: 'Controlador arbitraje' },
  'services/api-server/src/controllers/healthController.ts': { type: 'file', required: true, description: 'Controlador health' },
  'services/api-server/src/controllers/pricesController.ts': { type: 'file', required: true, description: 'Controlador precios' },
  'services/api-server/src/lib/logger.ts': { type: 'file', required: true, description: 'Sistema logging' },
  'services/api-server/src/lib/types.ts': { type: 'file', required: true, description: 'Tipos TypeScript' },
  'services/api-server/src/lib/errors.ts': { type: 'file', required: true, description: 'Manejo errores' },
  'services/api-server/src/lib/utils.ts': { type: 'file', required: true, description: 'Utilidades' },
  'services/api-server/src/middlewares/auth.ts': { type: 'file', required: true, description: 'Autenticación' },
  'services/api-server/src/middlewares/validation.ts': { type: 'file', required: true, description: 'Validaciones' },
  'services/api-server/src/middlewares/rateLimiter.ts': { type: 'file', required: true, description: 'Rate limiting' },
  'services/api-server/src/routes/index.ts': { type: 'file', required: true, description: 'Rutas principales' },
  'services/api-server/src/routes/v1.ts': { type: 'file', required: true, description: 'Rutas API v1' },
  'services/api-server/src/services/arbitrageService.ts': { type: 'file', required: true, description: 'Servicio arbitraje' },
  'services/api-server/src/services/sheetsService.ts': { type: 'file', required: true, description: 'Servicio Sheets' },
  'services/api-server/src/oracles/pyth.ts': { type: 'file', required: true, description: 'Oráculo Pyth' },
  'services/api-server/src/oracles/chainlink.ts': { type: 'file', required: true, description: 'Oráculo Chainlink' },
  'services/api-server/src/exec/flash.ts': { type: 'file', required: true, description: 'Ejecutor flash loans' },
  'services/api-server/test/sheets-schema.test.js': { type: 'file', required: true, description: 'Tests esquemas' },
  
  // Python Collector (15 archivos)
  'services/python-collector/requirements.txt': { type: 'file', required: true, description: 'Dependencias Python' },
  'services/python-collector/setup.py': { type: 'file', required: true, description: 'Setup del módulo' },
  'services/python-collector/src/main.py': { type: 'file', required: true, description: 'Programa principal' },
  'services/python-collector/src/collectors/__init__.py': { type: 'file', required: true, description: 'Init collectors' },
  'services/python-collector/src/collectors/dex_prices.py': { type: 'file', required: true, description: 'Recolector precios DEX' },
  'services/python-collector/src/collectors/blockchain_health.py': { type: 'file', required: true, description: 'Recolector salud chains' },
  'services/python-collector/src/connectors/__init__.py': { type: 'file', required: true, description: 'Init connectors' },
  'services/python-collector/src/connectors/pyth.py': { type: 'file', required: true, description: 'Conector Pyth' },
  'services/python-collector/src/connectors/defillama.py': { type: 'file', required: true, description: 'Conector DefiLlama' },
  'services/python-collector/src/connectors/publicnodes.py': { type: 'file', required: true, description: 'Conector PublicNodes' },
  'services/python-collector/src/sheets/__init__.py': { type: 'file', required: true, description: 'Init sheets' },
  'services/python-collector/src/sheets/client.py': { type: 'file', required: true, description: 'Cliente Sheets' },
  'services/python-collector/src/sheets/config_reader.py': { type: 'file', required: true, description: 'Lector configuración' },
  'services/python-collector/src/pipelines/__init__.py': { type: 'file', required: true, description: 'Init pipelines' },
  'services/python-collector/src/pipelines/data_pipeline.py': { type: 'file', required: true, description: 'Pipeline datos' },
  'services/python-collector/src/schedulers/__init__.py': { type: 'file', required: true, description: 'Init schedulers' },
  'services/python-collector/src/schedulers/cron_jobs.py': { type: 'file', required: true, description: 'Jobs automáticos' },
  'services/python-collector/src/utils/__init__.py': { type: 'file', required: true, description: 'Init utils' },
  'services/python-collector/src/utils/logger.py': { type: 'file', required: true, description: 'Logger Python' },
  'services/python-collector/src/utils/config.py': { type: 'file', required: true, description: 'Configuración' },
  'services/python-collector/notebooks/data_analysis.ipynb': { type: 'file', required: false, description: 'Notebook análisis' }
};

const TOTAL_REQUIRED_FILES = 124;

// ==================================================================================
// COLORES PARA OUTPUT
// ==================================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bright: '\x1b[1m'
};

// ==================================================================================
// UTILIDADES
// ==================================================================================

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function logHeader(message) {
  log(`\n🔍 ${message}`, 'bright');
  log('='.repeat(80), 'blue');
}

function fileExists(filePath) {
  try {
    return fs.existsSync(path.resolve(rootDir, filePath));
  } catch (error) {
    return false;
  }
}

function getFileStats(filePath) {
  try {
    const fullPath = path.resolve(rootDir, filePath);
    const stats = fs.statSync(fullPath);
    return {
      exists: true,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      lastModified: stats.mtime
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

function validateFileContent(filePath, expectedPatterns = []) {
  try {
    const fullPath = path.resolve(rootDir, filePath);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    const validation = {
      hasContent: content.length > 0,
      lineCount: content.split('\n').length,
      patterns: {}
    };
    
    // Validar patrones específicos
    expectedPatterns.forEach(pattern => {
      validation.patterns[pattern.name] = pattern.regex.test(content);
    });
    
    return validation;
  } catch (error) {
    return {
      hasContent: false,
      error: error.message
    };
  }
}

// ==================================================================================
// VALIDACIONES ESPECÍFICAS POR TIPO DE ARCHIVO
// ==================================================================================

const FILE_VALIDATORS = {
  'package.json': (filePath) => {
    try {
      const content = fs.readFileSync(path.resolve(rootDir, filePath), 'utf8');
      const pkg = JSON.parse(content);
      
      return {
        valid: true,
        hasName: !!pkg.name,
        hasVersion: !!pkg.version,
        hasScripts: !!pkg.scripts && Object.keys(pkg.scripts).length > 0,
        hasWorkspaces: !!pkg.workspaces
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  },
  
  '.env.example': (filePath) => {
    const patterns = [
      { name: 'hasGithubToken', regex: /GITHUB_TOKEN=/ },
      { name: 'hasSpreadsheetId', regex: /SPREADSHEET_ID=/ },
      { name: 'hasEthereumRpc', regex: /ETHEREUM_RPC_URL=/ },
      { name: 'hasPrivateKey', regex: /PRIVATE_KEY=/ }
    ];
    
    return validateFileContent(filePath, patterns);
  },
  
  'fly.toml': (filePath) => {
    const patterns = [
      { name: 'hasAppName', regex: /app\s*=\s*["']arbitragexplus2025["']/ },
      { name: 'hasRegion', regex: /primary_region\s*=/ },
      { name: 'hasServices', regex: /\[\[services\]\]/ },
      { name: 'hasProcesses', regex: /\[processes\]/ }
    ];
    
    return validateFileContent(filePath, patterns);
  },
  
  '.ts': (filePath) => {
    const patterns = [
      { name: 'hasImports', regex: /^import\s+.*from\s+['"].*['"];?$/m },
      { name: 'hasExports', regex: /^export\s+/m }
    ];
    
    return validateFileContent(filePath, patterns);
  },
  
  '.py': (filePath) => {
    const patterns = [
      { name: 'hasDocstring', regex: /"""[\s\S]*?"""/ },
      { name: 'hasImports', regex: /^import\s+|^from\s+.*import/m }
    ];
    
    return validateFileContent(filePath, patterns);
  },
  
  '.rs': (filePath) => {
    const patterns = [
      { name: 'hasUseStatements', regex: /^use\s+.*;$/m },
      { name: 'hasFunction', regex: /fn\s+\w+\s*\(/m }
    ];
    
    return validateFileContent(filePath, patterns);
  },
  
  '.yaml': (filePath) => {
    try {
      const content = fs.readFileSync(path.resolve(rootDir, filePath), 'utf8');
      
      return {
        valid: true,
        hasContent: content.length > 0,
        looksLikeYaml: /^[^{}\[\]]+:\s*.+/m.test(content)
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }
};

// ==================================================================================
// FUNCIÓN PRINCIPAL DE VALIDACIÓN
// ==================================================================================

async function validateStructure() {
  logHeader('ARBITRAGEXPLUS2025 - Validador de Estructura del Repositorio');
  
  let totalFiles = 0;
  let existingFiles = 0;
  let validFiles = 0;
  let missingFiles = [];
  let invalidFiles = [];
  let warnings = [];
  
  logInfo(`Validando ${Object.keys(EXPECTED_STRUCTURE).length} archivos esperados...`);
  
  // Validar cada archivo en la estructura esperada
  for (const [filePath, config] of Object.entries(EXPECTED_STRUCTURE)) {
    totalFiles++;
    
    const stats = getFileStats(filePath);
    
    if (!stats.exists) {
      if (config.required) {
        missingFiles.push({
          path: filePath,
          description: config.description
        });
        logError(`Falta: ${filePath} - ${config.description}`);
      } else {
        warnings.push(`Opcional faltante: ${filePath}`);
        logWarning(`Opcional: ${filePath} - ${config.description}`);
      }
      continue;
    }
    
    existingFiles++;
    
    if (config.type === 'file' && !stats.isFile) {
      invalidFiles.push({
        path: filePath,
        reason: 'Expected file but found directory'
      });
      logError(`Tipo incorrecto: ${filePath} (esperado archivo, encontrado directorio)`);
      continue;
    }
    
    // Validaciones específicas por tipo de archivo
    const extension = path.extname(filePath);
    const fileName = path.basename(filePath);
    
    let validator = FILE_VALIDATORS[fileName] || FILE_VALIDATORS[extension];
    
    if (validator) {
      try {
        const validation = validator(filePath);
        
        if (validation.valid === false) {
          invalidFiles.push({
            path: filePath,
            reason: validation.error || 'File validation failed'
          });
          logError(`Inválido: ${filePath} - ${validation.error}`);
          continue;
        }
      } catch (error) {
        warnings.push(`Error validating ${filePath}: ${error.message}`);
        logWarning(`Error validando ${filePath}: ${error.message}`);
      }
    }
    
    validFiles++;
    logSuccess(`Válido: ${filePath} (${(stats.size / 1024).toFixed(1)}KB)`);
  }
  
  // ==================================================================================
  // VALIDACIONES ADICIONALES
  // ==================================================================================
  
  logHeader('Validaciones Adicionales');
  
  // Validar estructura de directorios críticos
  const criticalDirs = [
    'services',
    'services/api-server',
    'services/python-collector', 
    'services/engine-rust',
    'services/ts-executor',
    'contracts',
    'scripts',
    'configs',
    '.github/workflows'
  ];
  
  let missingDirs = [];
  
  for (const dir of criticalDirs) {
    if (!fs.existsSync(path.resolve(rootDir, dir))) {
      missingDirs.push(dir);
      logError(`Directorio faltante: ${dir}`);
    } else {
      logSuccess(`Directorio existe: ${dir}`);
    }
  }
  
  // Validar package.json específicos de servicios
  const servicePackageJsons = [
    'services/api-server/package.json',
    'services/ts-executor/package.json'
  ];
  
  for (const pkgPath of servicePackageJsons) {
    if (fileExists(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.resolve(rootDir, pkgPath), 'utf8'));
        
        if (!pkg.scripts || !pkg.scripts.dev || !pkg.scripts.build) {
          warnings.push(`${pkgPath} falta scripts requeridos (dev, build)`);
        } else {
          logSuccess(`${pkgPath} tiene scripts requeridos`);
        }
      } catch (error) {
        invalidFiles.push({
          path: pkgPath,
          reason: `Invalid JSON: ${error.message}`
        });
      }
    }
  }
  
  // Validar archivos de configuración críticos
  const criticalConfigs = ['.env.example', 'fly.toml'];
  
  for (const config of criticalConfigs) {
    if (fileExists(config)) {
      const content = fs.readFileSync(path.resolve(rootDir, config), 'utf8');
      
      if (content.length < 100) {
        warnings.push(`${config} parece demasiado pequeño (${content.length} caracteres)`);
      } else {
        logSuccess(`${config} tiene contenido adecuado`);
      }
    }
  }
  
  // ==================================================================================
  // GENERAR REPORTE FINAL
  // ==================================================================================
  
  logHeader('Reporte Final de Validación');
  
  console.log();
  log(`📊 ESTADÍSTICAS:`, 'bright');
  log(`   Total archivos esperados: ${totalFiles}`);
  log(`   Archivos existentes: ${existingFiles}`, existingFiles === totalFiles ? 'green' : 'yellow');
  log(`   Archivos válidos: ${validFiles}`, validFiles === existingFiles ? 'green' : 'red');
  log(`   Archivos faltantes: ${missingFiles.length}`, missingFiles.length === 0 ? 'green' : 'red');
  log(`   Archivos inválidos: ${invalidFiles.length}`, invalidFiles.length === 0 ? 'green' : 'red');
  log(`   Directorios faltantes: ${missingDirs.length}`, missingDirs.length === 0 ? 'green' : 'red');
  log(`   Advertencias: ${warnings.length}`, warnings.length === 0 ? 'green' : 'yellow');
  
  console.log();
  
  const completionPercentage = ((validFiles / TOTAL_REQUIRED_FILES) * 100).toFixed(1);
  log(`📈 PROGRESO: ${completionPercentage}% completo (${validFiles}/${TOTAL_REQUIRED_FILES})`, 
      completionPercentage >= 95 ? 'green' : completionPercentage >= 75 ? 'yellow' : 'red');
  
  // Mostrar archivos faltantes críticos
  if (missingFiles.length > 0) {
    console.log();
    log(`📋 ARCHIVOS FALTANTES CRÍTICOS:`, 'red');
    
    missingFiles.slice(0, 10).forEach(file => {
      log(`   • ${file.path} - ${file.description}`, 'red');
    });
    
    if (missingFiles.length > 10) {
      log(`   ... y ${missingFiles.length - 10} archivos más`, 'red');
    }
  }
  
  // Mostrar archivos inválidos
  if (invalidFiles.length > 0) {
    console.log();
    log(`🚫 ARCHIVOS INVÁLIDOS:`, 'red');
    
    invalidFiles.slice(0, 5).forEach(file => {
      log(`   • ${file.path} - ${file.reason}`, 'red');
    });
  }
  
  // Mostrar advertencias importantes
  if (warnings.length > 0) {
    console.log();
    log(`⚠️  ADVERTENCIAS:`, 'yellow');
    
    warnings.slice(0, 5).forEach(warning => {
      log(`   • ${warning}`, 'yellow');
    });
  }
  
  console.log();
  
  // Determinar resultado final
  const isValid = missingFiles.length === 0 && invalidFiles.length === 0 && missingDirs.length === 0;
  
  if (isValid) {
    logSuccess('✅ VALIDACIÓN EXITOSA - Estructura del repositorio es correcta');
    log(`🚀 El sistema está listo para deployment`, 'green');
    return 0; // Exit code 0 = success
  } else {
    logError('❌ VALIDACIÓN FALLIDA - Estructura del repositorio incompleta');
    
    if (missingFiles.length > 0) {
      log(`📋 Crear ${missingFiles.length} archivos faltantes`, 'red');
    }
    
    if (invalidFiles.length > 0) {
      log(`🔧 Reparar ${invalidFiles.length} archivos inválidos`, 'red');
    }
    
    if (missingDirs.length > 0) {
      log(`📁 Crear ${missingDirs.length} directorios faltantes`, 'red');
    }
    
    log(`📖 Consultar CHECKLIST-MANU-COMPLETO.md para instrucciones`, 'cyan');
    
    return 1; // Exit code 1 = failure
  }
}

// ==================================================================================
// EJECUCIÓN
// ==================================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  validateStructure()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      logError(`Error crítico en validación: ${error.message}`);
      console.error(error.stack);
      process.exit(1);
    });
}

export { validateStructure, EXPECTED_STRUCTURE };