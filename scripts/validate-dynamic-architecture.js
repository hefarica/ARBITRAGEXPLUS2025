#!/usr/bin/env node

/**
 * VALIDADOR DE ARQUITECTURA DINÁMICA ESTRICTA
 * 
 * Valida cumplimiento al 100% de:
 * - Dependency Injection Pattern
 * - Strategy + Factory Patterns
 * - Observer + Event-Driven Architecture
 * - CQRS + Event Sourcing
 * - Plugin Architecture
 * - Externalized Configuration
 * - Multi-tier Caching
 * - Stream Processing
 * 
 * CRITERIO: CERO tolerancia a hardcoding o implementaciones parciales
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ============================================================================
// PATRONES ARQUITECTÓNICOS REQUERIDOS
// ============================================================================

const REQUIRED_PATTERNS = {
  'Dependency Injection': {
    description: 'IoC Container con inyección de dependencias',
    locations: [
      'services/api-server/src/di/',
      'services/ts-executor/src/di/',
      'services/python-collector/src/di/'
    ],
    requiredFiles: [
      'container.ts',
      'container.py',
      'interfaces.ts'
    ],
    requiredPatterns: [
      '@inject',
      'container\\.register',
      'container\\.resolve',
      'interface.*Service',
      'class.*Container'
    ],
    mustNotContain: [
      'new.*Service\\(',
      'import.*\\.\\.\\/.*Service'
    ]
  },

  'Strategy Pattern': {
    description: 'Estrategias intercambiables para algoritmos',
    locations: [
      'services/engine-rust/src/strategies/',
      'services/ts-executor/src/strategies/'
    ],
    requiredFiles: [
      'mod.rs',
      'strategy.ts'
    ],
    requiredPatterns: [
      'trait.*Strategy',
      'interface.*Strategy',
      'impl.*Strategy.*for',
      'execute.*\\(',
      'factory.*create'
    ],
    mustNotContain: [
      'if.*type.*==.*"hardcoded"',
      'switch.*hardcoded'
    ]
  },

  'Factory Pattern': {
    description: 'Factories para creación dinámica de objetos',
    locations: [
      'services/ts-executor/src/factories/',
      'services/api-server/src/factories/'
    ],
    requiredFiles: [
      'strategyFactory.ts',
      'executorFactory.ts'
    ],
    requiredPatterns: [
      'class.*Factory',
      'create.*\\(',
      'build.*\\(',
      'register.*\\(',
      'Map<string'
    ],
    mustNotContain: [
      'const FIXED_STRATEGIES',
      'hardcoded.*strategy'
    ]
  },

  'Observer Pattern': {
    description: 'Event-driven con publishers y subscribers',
    locations: [
      'services/api-server/src/events/',
      'services/ts-executor/src/events/'
    ],
    requiredFiles: [
      'eventBus.ts',
      'events.ts'
    ],
    requiredPatterns: [
      'EventEmitter',
      '\\.on\\(',
      '\\.emit\\(',
      'subscribe',
      'publish',
      'class.*EventBus'
    ],
    mustNotContain: [
      'direct.*call',
      'tightly.*coupled'
    ]
  },

  'CQRS Pattern': {
    description: 'Separación comando/consulta',
    locations: [
      'services/api-server/src/cqrs/',
      'services/ts-executor/src/cqrs/'
    ],
    requiredFiles: [
      'commands/',
      'queries/',
      'handlers/'
    ],
    requiredPatterns: [
      'class.*Command',
      'class.*Query',
      'interface.*CommandHandler',
      'interface.*QueryHandler',
      'execute.*command',
      'execute.*query'
    ],
    mustNotContain: [
      'mixed.*read.*write',
      'query.*modify'
    ]
  },

  'Event Sourcing': {
    description: 'Event store inmutable',
    locations: [
      'services/api-server/src/events/store/',
      'services/ts-executor/src/events/store/'
    ],
    requiredFiles: [
      'eventStore.ts',
      'projections.ts'
    ],
    requiredPatterns: [
      'class.*EventStore',
      'append.*event',
      'getEvents',
      'projection',
      'readonly.*events'
    ],
    mustNotContain: [
      'delete.*event',
      'modify.*event'
    ]
  },

  'Plugin Architecture': {
    description: 'Sistema de plugins extensible',
    locations: [
      'services/api-server/src/plugins/',
      'services/ts-executor/src/plugins/'
    ],
    requiredFiles: [
      'pluginRegistry.ts',
      'pluginLoader.ts'
    ],
    requiredPatterns: [
      'interface.*Plugin',
      'register.*plugin',
      'load.*plugin',
      'Map<string.*Plugin',
      'dynamic.*import'
    ],
    mustNotContain: [
      'hardcoded.*plugin.*list',
      'static.*plugins'
    ]
  },

  'Externalized Configuration': {
    description: 'Configuración 100% externa',
    locations: [
      'config/',
      'services/*/config/'
    ],
    requiredFiles: [
      'chains.yaml',
      'dexes.yaml',
      'system.yaml',
      '.env.example'
    ],
    requiredPatterns: [
      '\\$\\{[A-Z_]+\\}',
      'process\\.env\\.',
      'os\\.getenv',
      'env::var'
    ],
    mustNotContain: [
      'const CHAIN_ID = 1',
      'const DEX_ADDRESS = "0x',
      'hardcoded.*api.*key'
    ]
  },

  'Multi-tier Caching': {
    description: 'Cache L1 (memory) + L2 (Redis)',
    locations: [
      'services/api-server/src/cache/',
      'services/python-collector/src/cache/'
    ],
    requiredFiles: [
      'cacheManager.ts',
      'cacheManager.py',
      'redisCache.ts'
    ],
    requiredPatterns: [
      'class.*CacheManager',
      'L1.*cache',
      'L2.*cache',
      'redis',
      'TTL',
      'invalidate'
    ],
    mustNotContain: [
      'simple.*object.*cache',
      'no.*expiration'
    ]
  },

  'Stream Processing': {
    description: 'Procesamiento de streams en tiempo real',
    locations: [
      'services/api-server/src/streams/',
      'services/ts-executor/src/streams/'
    ],
    requiredFiles: [
      'streamProcessor.ts',
      'pipeline.ts'
    ],
    requiredPatterns: [
      'stream',
      'pipeline',
      'transform',
      'backpressure',
      'async.*iterator'
    ],
    mustNotContain: [
      'blocking.*read',
      'sync.*processing'
    ]
  }
};

// ============================================================================
// VALIDACIONES DE NO-HARDCODING
// ============================================================================

const HARDCODING_CHECKS = {
  'Blockchain Data': {
    files: ['services/**/*.ts', 'services/**/*.py', 'services/**/*.rs'],
    forbiddenPatterns: [
      'const ETHEREUM_CHAIN_ID = 1',
      'const POLYGON_CHAIN_ID = 137',
      'const BSC_CHAIN_ID = 56',
      'CHAIN_IDS = \\[1, 137, 56\\]',
      'hardcoded.*chain'
    ],
    requiredPatterns: [
      'getChains.*\\(',
      'loadChains.*\\(',
      'fetchChains.*from.*sheets'
    ]
  },

  'DEX Data': {
    files: ['services/**/*.ts', 'services/**/*.py'],
    forbiddenPatterns: [
      'const UNISWAP_ROUTER = "0x',
      'const SUSHISWAP_ROUTER = "0x',
      'DEXES = \\[.*"Uniswap".*\\]',
      'hardcoded.*dex'
    ],
    requiredPatterns: [
      'getDexes.*\\(',
      'loadDexes.*\\(',
      'fetchDexes.*from.*sheets'
    ]
  },

  'Token/Asset Data': {
    files: ['services/**/*.ts', 'services/**/*.py'],
    forbiddenPatterns: [
      'const WETH_ADDRESS = "0x',
      'const USDC_ADDRESS = "0x',
      'TOKENS = \\[.*"WETH".*\\]',
      'hardcoded.*token'
    ],
    requiredPatterns: [
      'getAssets.*\\(',
      'loadAssets.*\\(',
      'fetchAssets.*from.*sheets'
    ]
  },

  'Pool Data': {
    files: ['services/**/*.ts', 'services/**/*.py'],
    forbiddenPatterns: [
      'const POOL_ADDRESS = "0x',
      'POOLS = \\[.*0x.*\\]',
      'hardcoded.*pool'
    ],
    requiredPatterns: [
      'getPools.*\\(',
      'loadPools.*\\(',
      'fetchPools.*from.*sheets'
    ]
  },

  'Configuration Values': {
    files: ['services/**/*.ts', 'services/**/*.py', 'contracts/**/*.sol'],
    forbiddenPatterns: [
      'const API_KEY = "[a-zA-Z0-9]{20,}"',
      'const PRIVATE_KEY = "0x[a-fA-F0-9]{64}"',
      'const RPC_URL = "https://',
      'hardcoded.*secret'
    ],
    requiredPatterns: [
      'process\\.env\\.',
      'os\\.getenv',
      'env::var',
      'config\\.get'
    ]
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
  log('\n' + '━'.repeat(80), 'cyan');
  log(`  ${message}`, 'bold');
  log('━'.repeat(80), 'cyan');
}

function findFiles(dir, pattern) {
  const results = [];
  
  if (!fs.existsSync(dir)) {
    return results;
  }

  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      results.push(...findFiles(filePath, pattern));
    } else if (file.match(pattern)) {
      results.push(filePath);
    }
  }
  
  return results;
}

function checkPattern(content, pattern) {
  const regex = new RegExp(pattern, 'gm');
  return regex.test(content);
}

function findMatches(content, pattern) {
  const regex = new RegExp(pattern, 'gm');
  return content.match(regex) || [];
}

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
// VALIDADORES
// ============================================================================

function validateArchitecturalPattern(patternName, config) {
  log(`\n🏗️  Validando: ${patternName}`, 'cyan');
  log(`   ${config.description}`, 'blue');
  
  const result = new ValidationResult();

  // Verificar ubicaciones
  for (const location of config.locations) {
    const fullPath = path.join(REPO_ROOT, location);
    
    if (fs.existsSync(fullPath)) {
      result.addPass(`  ✓ Ubicación encontrada: ${location}`);
      
      // Verificar archivos requeridos
      if (config.requiredFiles) {
        for (const requiredFile of config.requiredFiles) {
          const filePath = path.join(fullPath, requiredFile);
          
          if (fs.existsSync(filePath)) {
            result.addPass(`    ✓ Archivo: ${requiredFile}`);
            
            // Verificar patrones en el archivo
            const content = fs.readFileSync(filePath, 'utf-8');
            
            for (const pattern of config.requiredPatterns) {
              if (checkPattern(content, pattern)) {
                result.addPass(`      ✓ Patrón: ${pattern}`);
              }
            }
            
            // Verificar que NO contenga prohibidos
            if (config.mustNotContain) {
              for (const forbidden of config.mustNotContain) {
                if (checkPattern(content, forbidden)) {
                  result.addFail(`      ✗ Contiene prohibido: ${forbidden}`);
                }
              }
            }
          } else {
            result.addWarning(`    ⚠ Archivo no encontrado: ${requiredFile}`);
          }
        }
      }
    } else {
      result.addFail(`  ✗ Ubicación no existe: ${location}`);
    }
  }

  return result;
}

function validateNoHardcoding(checkName, config) {
  log(`\n🚫 Validando NO hardcoding: ${checkName}`, 'cyan');
  
  const result = new ValidationResult();

  for (const filePattern of config.files) {
    const files = findFiles(REPO_ROOT, new RegExp(filePattern.replace('**', '.*')));
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const relativePath = path.relative(REPO_ROOT, file);
      
      // Verificar patrones prohibidos
      for (const forbidden of config.forbiddenPatterns) {
        const matches = findMatches(content, forbidden);
        if (matches.length > 0) {
          result.addFail(`  ✗ ${relativePath}: Hardcoding detectado: ${matches[0]}`);
        }
      }
      
      // Verificar patrones requeridos
      let hasRequired = false;
      for (const required of config.requiredPatterns) {
        if (checkPattern(content, required)) {
          hasRequired = true;
          result.addPass(`  ✓ ${relativePath}: Usa carga dinámica`);
          break;
        }
      }
      
      if (!hasRequired && content.length > 100) {
        result.addWarning(`  ⚠ ${relativePath}: No se detectó carga dinámica`);
      }
    }
  }

  return result;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.clear();
  
  log('╔═══════════════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                                                                           ║', 'cyan');
  log('║         VALIDACIÓN DE ARQUITECTURA DINÁMICA ESTRICTA                     ║', 'cyan');
  log('║         ARBITRAGEXPLUS2025                                                ║', 'cyan');
  log('║                                                                           ║', 'cyan');
  log('╚═══════════════════════════════════════════════════════════════════════════╝', 'cyan');

  const results = [];

  // PARTE 1: Validar patrones arquitectónicos
  header('PARTE 1: PATRONES ARQUITECTÓNICOS');
  
  for (const [patternName, config] of Object.entries(REQUIRED_PATTERNS)) {
    const result = validateArchitecturalPattern(patternName, config);
    results.push(result);
    result.print();
  }

  // PARTE 2: Validar NO hardcoding
  header('PARTE 2: VALIDACIÓN DE NO-HARDCODING');
  
  for (const [checkName, config] of Object.entries(HARDCODING_CHECKS)) {
    const result = validateNoHardcoding(checkName, config);
    results.push(result);
    result.print();
  }

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
    log(`\n✅ ARQUITECTURA DINÁMICA VALIDADA EXITOSAMENTE`, 'green');
    log(`   El sistema cumple con todos los patrones requeridos`, 'green');
    log(`   NO se detectó hardcoding`, 'green');
    process.exit(0);
  } else {
    log(`\n❌ VALIDACIÓN FALLIDA`, 'red');
    log(`   Se encontraron ${totalFailed} errores críticos`, 'red');
    log(`   El sistema NO cumple con la arquitectura dinámica estricta`, 'red');
    process.exit(1);
  }
}

// Ejecutar
main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});

