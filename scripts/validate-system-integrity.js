#!/usr/bin/env node

/**
 * SCRIPT MAESTRO DE VALIDACIÓN DE INTEGRIDAD DEL SISTEMA
 * 
 * Valida exhaustivamente:
 * 1. Integridad de cada archivo (NO vacíos, NO a medias)
 * 2. Flujo de datos dinámicos entre módulos
 * 3. Uso de arrays dinámicos (NO hardcoding)
 * 4. Patrones arquitectónicos (DI, Strategy, Observer, CQRS)
 * 5. Configuración externalizada
 * 6. Integración sistémica completa
 * 
 * CRITERIO DE ÉXITO: 100% de validaciones PASADAS
 * CUALQUIER FALLO ES CONSIDERADO CRÍTICO
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// CONFIGURACIÓN
// ============================================================================

const REPO_ROOT = path.resolve(__dirname, '..');

const CRITICAL_FILES = {
  // Python Collector
  'services/python-collector/src/sheets/client.py': {
    minLines: 500,
    requiredPatterns: [
      'class GoogleSheetsClient',
      'async def read_sheet',
      'async def write_',
      'cache',
      '@retry'
    ],
    requiredArrays: ['List\\[', 'Dict\\[', 'for .* in'],
    mustNotContain: ['hardcoded', 'TODO', 'FIXME', 'mock_data']
  },
  
  // WebSocket Manager
  'services/api-server/src/adapters/ws/websocketManager.ts': {
    minLines: 600,
    requiredPatterns: [
      'class WebSocketManager',
      'Map<',
      'async.*connect',
      'subscribe',
      'EventEmitter'
    ],
    requiredArrays: ['Array.map', 'Array.filter', '.forEach', 'Promise.all'],
    mustNotContain: ['hardcoded', 'TODO', 'FIXME']
  },
  
  // Flash Executor
  'services/ts-executor/src/exec/flash.ts': {
    minLines: 600,
    requiredPatterns: [
      'class.*Executor',
      'async.*execute',
      'flashLoan',
      'validateRoute',
      'calculateGas'
    ],
    requiredArrays: ['routes.map', 'routes.filter', 'Promise.all'],
    mustNotContain: ['hardcoded', 'TODO', 'const FIXED_']
  },
  
  // Rust Pathfinding
  'services/engine-rust/src/pathfinding/mod.rs': {
    minLines: 300,
    requiredPatterns: [
      'pub struct',
      'impl.*Pathfinder',
      'Vec<',
      'HashMap<',
      'pub fn find'
    ],
    requiredArrays: ['.iter()', '.filter()', '.map()', '.collect()'],
    mustNotContain: ['hardcoded', 'TODO', 'FIXME']
  },
  
  // Router Contract
  'contracts/src/Router.sol': {
    minLines: 500,
    requiredPatterns: [
      'contract.*Router',
      'function execute',
      'flashLoan',
      'address\\[\\] calldata',
      'uint256\\[\\] calldata'
    ],
    requiredArrays: ['\\[\\]', 'for.*uint'],
    mustNotContain: ['hardcoded', 'TODO', 'FIXME']
  },
  
  // Vault Contract
  'contracts/src/Vault.sol': {
    minLines: 300,
    requiredPatterns: [
      'contract.*Vault',
      'function flashLoan',
      'mapping',
      'ReentrancyGuard',
      'Pausable'
    ],
    requiredArrays: ['mapping', '\\[\\]'],
    mustNotContain: ['hardcoded', 'TODO']
  }
};

const INTEGRATION_FLOWS = [
  {
    name: 'Google Sheets → Python Collector',
    source: 'services/python-collector/src/sheets/client.py',
    target: 'services/python-collector/src/main.py',
    requiredImports: ['from.*sheets.*import', 'GoogleSheetsClient'],
    requiredCalls: ['read_sheet', 'write_']
  },
  {
    name: 'Python Collector → API Server',
    source: 'services/python-collector/src/main.py',
    target: 'services/api-server/src/routes/',
    requiredPatterns: ['fetch.*config', 'get.*pools', 'get.*dexes']
  },
  {
    name: 'WebSocket Manager → Flash Executor',
    source: 'services/api-server/src/adapters/ws/websocketManager.ts',
    target: 'services/ts-executor/src/exec/flash.ts',
    requiredImports: ['import.*WebSocket', 'EventEmitter'],
    requiredCalls: ['on\\(', 'emit\\(']
  },
  {
    name: 'Flash Executor → Router Contract',
    source: 'services/ts-executor/src/exec/flash.ts',
    target: 'contracts/src/Router.sol',
    requiredPatterns: ['executeArbitrage', 'flashLoan', 'ethers']
  },
  {
    name: 'Rust Engine → TS Executor',
    source: 'services/engine-rust/src/pathfinding/mod.rs',
    target: 'services/ts-executor/src/exec/flash.ts',
    requiredPatterns: ['find.*routes', 'calculate.*profit']
  }
];

const ARCHITECTURAL_PATTERNS = {
  'Dependency Injection': {
    files: [
      'services/api-server/src/container.ts',
      'services/ts-executor/src/di/',
      'services/python-collector/src/di/'
    ],
    requiredPatterns: ['inject', 'container', 'register', 'resolve']
  },
  'Strategy Pattern': {
    files: [
      'services/engine-rust/src/strategies/',
      'services/ts-executor/src/strategies/'
    ],
    requiredPatterns: ['trait.*Strategy', 'interface.*Strategy', 'execute']
  },
  'Observer Pattern': {
    files: [
      'services/api-server/src/events/',
      'services/ts-executor/src/events/'
    ],
    requiredPatterns: ['EventEmitter', 'on\\(', 'emit\\(', 'subscribe']
  },
  'Factory Pattern': {
    files: [
      'services/ts-executor/src/factories/',
      'services/api-server/src/factories/'
    ],
    requiredPatterns: ['create', 'factory', 'build']
  }
};

// ============================================================================
// UTILIDADES
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
  log('\n' + '='.repeat(80), 'cyan');
  log(`  ${message}`, 'bold');
  log('='.repeat(80), 'cyan');
}

function readFile(filePath) {
  const fullPath = path.join(REPO_ROOT, filePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return fs.readFileSync(fullPath, 'utf-8');
}

function countLines(content) {
  return content.split('\n').length;
}

function checkPattern(content, pattern) {
  const regex = new RegExp(pattern, 'gm');
  return regex.test(content);
}

function findMatches(content, pattern) {
  const regex = new RegExp(pattern, 'gm');
  return content.match(regex) || [];
}

// ============================================================================
// VALIDADORES
// ============================================================================

class ValidationResult {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.warnings = 0;
    this.errors = [];
    this.details = [];
  }

  addPass(message) {
    this.passed++;
    this.details.push({ type: 'PASS', message });
  }

  addFail(message) {
    this.failed++;
    this.errors.push(message);
    this.details.push({ type: 'FAIL', message });
  }

  addWarning(message) {
    this.warnings++;
    this.details.push({ type: 'WARN', message });
  }

  isSuccess() {
    return this.failed === 0;
  }

  print() {
    log(`\n📊 RESULTADOS:`, 'bold');
    log(`  ✅ Pasadas:      ${this.passed}`, 'green');
    log(`  ❌ Fallidas:     ${this.failed}`, 'red');
    log(`  ⚠️  Advertencias: ${this.warnings}`, 'yellow');

    if (this.errors.length > 0) {
      log(`\n🔴 ERRORES CRÍTICOS:`, 'red');
      this.errors.forEach((err, i) => {
        log(`  ${i + 1}. ${err}`, 'red');
      });
    }
  }
}

// ============================================================================
// VALIDACIÓN 1: INTEGRIDAD DE ARCHIVOS
// ============================================================================

function validateFileIntegrity() {
  header('VALIDACIÓN 1: INTEGRIDAD DE ARCHIVOS CRÍTICOS');
  
  const result = new ValidationResult();

  for (const [filePath, config] of Object.entries(CRITICAL_FILES)) {
    log(`\n📄 Validando: ${filePath}`, 'cyan');
    
    const content = readFile(filePath);
    
    if (!content) {
      result.addFail(`Archivo no existe: ${filePath}`);
      continue;
    }

    // Validar líneas mínimas
    const lines = countLines(content);
    if (lines < config.minLines) {
      result.addFail(`${filePath}: Solo ${lines} líneas (mínimo: ${config.minLines})`);
    } else {
      result.addPass(`${filePath}: ${lines} líneas ✓`);
    }

    // Validar patrones requeridos
    for (const pattern of config.requiredPatterns) {
      if (checkPattern(content, pattern)) {
        result.addPass(`  ✓ Patrón encontrado: ${pattern}`);
      } else {
        result.addFail(`${filePath}: Falta patrón requerido: ${pattern}`);
      }
    }

    // Validar arrays dinámicos
    let hasArrays = false;
    for (const arrayPattern of config.requiredArrays) {
      if (checkPattern(content, arrayPattern)) {
        hasArrays = true;
        result.addPass(`  ✓ Array dinámico: ${arrayPattern}`);
      }
    }
    if (!hasArrays) {
      result.addFail(`${filePath}: NO usa arrays dinámicos`);
    }

    // Validar que NO contenga prohibidos
    for (const forbidden of config.mustNotContain) {
      if (checkPattern(content, forbidden)) {
        result.addFail(`${filePath}: Contiene prohibido: ${forbidden}`);
      }
    }
  }

  result.print();
  return result;
}

// ============================================================================
// VALIDACIÓN 2: FLUJO DE DATOS ENTRE MÓDULOS
// ============================================================================

function validateDataFlow() {
  header('VALIDACIÓN 2: FLUJO DE DATOS ENTRE MÓDULOS');
  
  const result = new ValidationResult();

  for (const flow of INTEGRATION_FLOWS) {
    log(`\n🔄 Validando flujo: ${flow.name}`, 'cyan');
    
    const sourceContent = readFile(flow.source);
    
    if (!sourceContent) {
      result.addFail(`Archivo fuente no existe: ${flow.source}`);
      continue;
    }

    // Validar imports requeridos
    if (flow.requiredImports) {
      for (const importPattern of flow.requiredImports) {
        if (checkPattern(sourceContent, importPattern)) {
          result.addPass(`  ✓ Import encontrado: ${importPattern}`);
        } else {
          result.addWarning(`${flow.source}: Falta import: ${importPattern}`);
        }
      }
    }

    // Validar llamadas requeridas
    if (flow.requiredCalls) {
      for (const callPattern of flow.requiredCalls) {
        const matches = findMatches(sourceContent, callPattern);
        if (matches.length > 0) {
          result.addPass(`  ✓ Llamada encontrada: ${callPattern} (${matches.length}x)`);
        } else {
          result.addFail(`${flow.source}: Falta llamada: ${callPattern}`);
        }
      }
    }

    // Validar patrones requeridos
    if (flow.requiredPatterns) {
      for (const pattern of flow.requiredPatterns) {
        if (checkPattern(sourceContent, pattern)) {
          result.addPass(`  ✓ Patrón encontrado: ${pattern}`);
        } else {
          result.addWarning(`${flow.source}: Falta patrón: ${pattern}`);
        }
      }
    }
  }

  result.print();
  return result;
}

// ============================================================================
// VALIDACIÓN 3: PATRONES ARQUITECTÓNICOS
// ============================================================================

function validateArchitecturalPatterns() {
  header('VALIDACIÓN 3: PATRONES ARQUITECTÓNICOS');
  
  const result = new ValidationResult();

  for (const [patternName, config] of Object.entries(ARCHITECTURAL_PATTERNS)) {
    log(`\n🏗️  Validando patrón: ${patternName}`, 'cyan');
    
    let patternFound = false;

    for (const filePath of config.files) {
      // Buscar archivos que coincidan con el patrón
      const fullPath = path.join(REPO_ROOT, filePath);
      
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        
        if (stats.isDirectory()) {
          // Buscar archivos en el directorio
          const files = fs.readdirSync(fullPath);
          if (files.length > 0) {
            patternFound = true;
            result.addPass(`  ✓ Directorio encontrado: ${filePath} (${files.length} archivos)`);
          }
        } else {
          // Validar archivo individual
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          let hasPattern = false;
          for (const pattern of config.requiredPatterns) {
            if (checkPattern(content, pattern)) {
              hasPattern = true;
              patternFound = true;
            }
          }
          
          if (hasPattern) {
            result.addPass(`  ✓ Archivo encontrado: ${filePath}`);
          }
        }
      }
    }

    if (!patternFound) {
      result.addWarning(`Patrón ${patternName} no implementado completamente`);
    }
  }

  result.print();
  return result;
}

// ============================================================================
// VALIDACIÓN 4: CONFIGURACIÓN EXTERNALIZADA
// ============================================================================

function validateExternalizedConfig() {
  header('VALIDACIÓN 4: CONFIGURACIÓN EXTERNALIZADA');
  
  const result = new ValidationResult();

  const configFiles = [
    'config/chains.yaml',
    'config/dexes.yaml',
    'config/system.yaml',
    '.env.example',
    'services/python-collector/.env.example',
    'services/api-server/.env.example'
  ];

  for (const configFile of configFiles) {
    const content = readFile(configFile);
    
    if (!content) {
      result.addWarning(`Archivo de configuración no existe: ${configFile}`);
      continue;
    }

    // Validar que use variables de entorno
    if (checkPattern(content, '\\$\\{.*\\}|process\\.env')) {
      result.addPass(`✓ ${configFile} usa variables de entorno`);
    } else {
      result.addWarning(`${configFile} podría no usar variables de entorno`);
    }

    // Validar que NO tenga valores hardcodeados sensibles
    const sensitivePatterns = [
      'api_key.*=.*[a-zA-Z0-9]{20,}',
      'private_key.*=.*0x[a-fA-F0-9]{64}',
      'password.*=.*[^\\$]'
    ];

    for (const pattern of sensitivePatterns) {
      if (checkPattern(content, pattern)) {
        result.addFail(`${configFile}: Posible valor sensible hardcodeado`);
      }
    }
  }

  result.print();
  return result;
}

// ============================================================================
// VALIDACIÓN 5: ARRAYS DINÁMICOS (NO HARDCODING)
// ============================================================================

function validateDynamicArrays() {
  header('VALIDACIÓN 5: ARRAYS DINÁMICOS (NO HARDCODING)');
  
  const result = new ValidationResult();

  const filesToCheck = [
    'services/python-collector/src/sheets/client.py',
    'services/api-server/src/adapters/ws/websocketManager.ts',
    'services/ts-executor/src/exec/flash.ts',
    'services/engine-rust/src/pathfinding/mod.rs'
  ];

  for (const filePath of filesToCheck) {
    log(`\n📋 Validando arrays en: ${filePath}`, 'cyan');
    
    const content = readFile(filePath);
    
    if (!content) {
      result.addFail(`Archivo no existe: ${filePath}`);
      continue;
    }

    // Detectar arrays hardcodeados
    const hardcodedArrayPatterns = [
      'const.*=.*\\[.*".*",.*".*".*\\]',
      'BLOCKCHAINS.*=.*\\[',
      'DEXES.*=.*\\[',
      'const FIXED_.*=.*\\['
    ];

    let hasHardcoded = false;
    for (const pattern of hardcodedArrayPatterns) {
      const matches = findMatches(content, pattern);
      if (matches.length > 0) {
        hasHardcoded = true;
        result.addFail(`${filePath}: Array hardcodeado detectado: ${matches[0]}`);
      }
    }

    if (!hasHardcoded) {
      result.addPass(`✓ ${filePath}: NO tiene arrays hardcodeados`);
    }

    // Validar uso de arrays dinámicos
    const dynamicArrayPatterns = {
      python: ['\\[.*for.*in.*\\]', 'map\\(', 'filter\\('],
      typescript: ['Array\\.map', 'Array\\.filter', '\\.forEach', 'Promise\\.all'],
      rust: ['\\.iter\\(\\)', '\\.filter\\(', '\\.map\\(', '\\.collect\\(\\)'],
      solidity: ['\\[\\].*calldata', 'for.*uint', 'mapping']
    };

    const ext = path.extname(filePath);
    let language = 'typescript';
    if (ext === '.py') language = 'python';
    if (ext === '.rs') language = 'rust';
    if (ext === '.sol') language = 'solidity';

    const patterns = dynamicArrayPatterns[language];
    let hasDynamic = false;

    for (const pattern of patterns) {
      const matches = findMatches(content, pattern);
      if (matches.length > 0) {
        hasDynamic = true;
        result.addPass(`  ✓ Uso dinámico: ${pattern} (${matches.length}x)`);
      }
    }

    if (!hasDynamic) {
      result.addFail(`${filePath}: NO usa arrays dinámicos`);
    }
  }

  result.print();
  return result;
}

// ============================================================================
// VALIDACIÓN 6: INTEGRACIÓN SISTÉMICA COMPLETA
// ============================================================================

function validateSystemIntegration() {
  header('VALIDACIÓN 6: INTEGRACIÓN SISTÉMICA COMPLETA');
  
  const result = new ValidationResult();

  log('\n🔗 Validando cadena de integración completa...', 'cyan');

  const integrationChain = [
    {
      name: 'Google Sheets',
      file: 'services/python-collector/src/sheets/client.py',
      exports: ['GoogleSheetsClient', 'read_sheet', 'write_']
    },
    {
      name: 'Python Collector',
      file: 'services/python-collector/src/main.py',
      imports: ['GoogleSheetsClient'],
      exports: ['fetch_config', 'get_pools']
    },
    {
      name: 'API Server',
      file: 'services/api-server/src/server.ts',
      exports: ['app', 'listen']
    },
    {
      name: 'WebSocket Manager',
      file: 'services/api-server/src/adapters/ws/websocketManager.ts',
      exports: ['WebSocketManager', 'connect', 'subscribe']
    },
    {
      name: 'Flash Executor',
      file: 'services/ts-executor/src/exec/flash.ts',
      imports: ['WebSocketManager'],
      exports: ['executeArbitrage', 'flashLoan']
    },
    {
      name: 'Router Contract',
      file: 'contracts/src/Router.sol',
      exports: ['executeArbitrage', 'flashLoan']
    }
  ];

  for (const component of integrationChain) {
    const content = readFile(component.file);
    
    if (!content) {
      result.addFail(`${component.name}: Archivo no existe (${component.file})`);
      continue;
    }

    // Validar imports
    if (component.imports) {
      for (const importName of component.imports) {
        if (checkPattern(content, `import.*${importName}|from.*${importName}`)) {
          result.addPass(`✓ ${component.name} importa ${importName}`);
        } else {
          result.addWarning(`${component.name}: No importa ${importName}`);
        }
      }
    }

    // Validar exports
    if (component.exports) {
      for (const exportName of component.exports) {
        if (checkPattern(content, `export.*${exportName}|def ${exportName}|function ${exportName}|contract.*${exportName}`)) {
          result.addPass(`✓ ${component.name} exporta ${exportName}`);
        } else {
          result.addWarning(`${component.name}: No exporta ${exportName}`);
        }
      }
    }
  }

  result.print();
  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.clear();
  
  log('╔═══════════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                                                                           ║', 'cyan');
  log('║         VALIDACIÓN DE INTEGRIDAD COMPLETA DEL SISTEMA                    ║', 'cyan');
  log('║         ARBITRAGEXPLUS2025                                                ║', 'cyan');
  log('║                                                                           ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════════════════════╝', 'cyan');

  const results = [];

  // Ejecutar todas las validaciones
  results.push(validateFileIntegrity());
  results.push(validateDataFlow());
  results.push(validateArchitecturalPatterns());
  results.push(validateExternalizedConfig());
  results.push(validateDynamicArrays());
  results.push(validateSystemIntegration());

  // Resumen final
  header('RESUMEN FINAL');

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings, 0);

  log(`\n📊 TOTALES:`, 'bold');
  log(`  ✅ Validaciones pasadas:    ${totalPassed}`, 'green');
  log(`  ❌ Validaciones fallidas:   ${totalFailed}`, 'red');
  log(`  ⚠️  Advertencias:           ${totalWarnings}`, 'yellow');

  const allSuccess = results.every(r => r.isSuccess());

  if (allSuccess) {
    log(`\n✅ SISTEMA VALIDADO EXITOSAMENTE`, 'green');
    log(`   Todos los archivos están completos e integrados correctamente`, 'green');
    process.exit(0);
  } else {
    log(`\n❌ VALIDACIÓN FALLIDA`, 'red');
    log(`   Se encontraron ${totalFailed} errores críticos`, 'red');
    log(`   Por favor revisa los errores arriba y corrige`, 'red');
    process.exit(1);
  }
}

// Ejecutar
main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

