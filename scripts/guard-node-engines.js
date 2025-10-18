/**
 * ============================================================================
 * ARCHIVO: ./scripts/guard-node-engines.js
 * SERVICIO: guard-node-engines.js
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: semver, url, child_process
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: EngineGuardian
 *   FUNCIONES: logHeader, parseVersion, logWarning
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 *   - semver
 *   - url
 *   - child_process
 * 
 * ============================================================================
 */

#!/usr/bin/env node

/**
 * ARBITRAGEXPLUS2025 - Node.js Engine Guardian  
 * 
 * Este script valida que las versiones de Node.js y otras herramientas críticas
 * sean compatibles con el sistema. Actúa como guardian para evitar problemas
 * de compatibilidad durante desarrollo y deployment.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import semver from 'semver';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ==================================================================================
// REQUISITOS DE VERSIONES
// ==================================================================================

const ENGINE_REQUIREMENTS = {
  // Node.js requirements
  node: {
    minimum: '18.0.0',
    recommended: '18.17.0',
    maximum: '20.99.99', // No restrictions on major version 20
    name: 'Node.js'
  },
  
  // npm requirements (though we use pnpm)
  npm: {
    minimum: '8.0.0',
    recommended: '9.8.0',
    maximum: '10.99.99',
    name: 'npm'
  },
  
  // pnpm requirements (primary package manager)
  pnpm: {
    minimum: '8.0.0', 
    recommended: '8.15.0',
    maximum: '8.99.99',
    name: 'pnpm',
    required: true
  },
  
  // Python requirements (for collector service)
  python: {
    minimum: '3.9.0',
    recommended: '3.11.0',
    maximum: '3.12.99',
    name: 'Python',
    command: 'python3'
  },
  
  // Rust requirements (for engine)
  rust: {
    minimum: '1.70.0',
    recommended: '1.75.0', 
    maximum: '1.99.99',
    name: 'Rust',
    command: 'rustc'
  },
  
  // Git requirements
  git: {
    minimum: '2.25.0',
    recommended: '2.40.0',
    maximum: '2.99.99',
    name: 'Git'
  },
  
  // Docker requirements (optional but recommended)
  docker: {
    minimum: '20.10.0',
    recommended: '24.0.0',
    maximum: '24.99.99',
    name: 'Docker',
    required: false
  },
  
  // Fly CLI requirements (for deployment)
  flyctl: {
    minimum: '0.1.0',
    recommended: '0.1.100',
    maximum: '0.99.99',
    name: 'Fly CLI',
    command: 'fly',
    required: false
  }
};

// Features específicos que requieren versiones mínimas
const FEATURE_REQUIREMENTS = {
  esModules: { node: '14.0.0', description: 'ES Modules support' },
  topLevelAwait: { node: '14.8.0', description: 'Top-level await' },
  optionalChaining: { node: '14.0.0', description: 'Optional chaining (?.)' },
  nullishCoalescing: { node: '14.0.0', description: 'Nullish coalescing (??)' },
  webStreams: { node: '16.5.0', description: 'Web Streams API' },
  fetch: { node: '18.0.0', description: 'Built-in fetch API' },
  abortController: { node: '15.0.0', description: 'AbortController' },
  performanceObserver: { node: '8.5.0', description: 'Performance Observer' },
  workerThreads: { node: '10.5.0', description: 'Worker Threads' }
};

// Configuraciones específicas por OS
const OS_SPECIFIC = {
  win32: {
    name: 'Windows',
    notes: ['Windows Subsystem for Linux (WSL) recommended for development']
  },
  darwin: {
    name: 'macOS',
    notes: ['Homebrew package manager recommended']
  },
  linux: {
    name: 'Linux',
    notes: ['APT/YUM package managers supported']
  }
};

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
  bright: '\x1b[1m',
  dim: '\x1b[2m'
};

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
  log(`\n🛡️  ${message}`, 'bright');
  log('='.repeat(80), 'blue');
}

// ==================================================================================
// UTILIDADES
// ==================================================================================

function executeCommand(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 10000,
      ...options
    });
    return {
      success: true,
      output: result.trim(),
      error: null
    };
  } catch (error) {
    return {
      success: false,
      output: null,
      error: error.message
    };
  }
}

function parseVersion(versionString) {
  // Extraer version number desde strings como "v18.17.0" o "rustc 1.75.0"
  const versionMatch = versionString.match(/(\d+\.\d+\.\d+)/);
  return versionMatch ? versionMatch[1] : null;
}

function getVersionCommand(engineName, config) {
  const command = config.command || engineName;
  
  switch (engineName) {
    case 'node':
      return `${command} --version`;
    case 'npm':
      return `${command} --version`;
    case 'pnpm':
      return `${command} --version`;
    case 'python':
      return `${command} --version`;
    case 'rust':
      return `${command} --version`;
    case 'git':
      return `${command} --version`;
    case 'docker':
      return `${command} --version`;
    case 'flyctl':
      return `${command} version`;
    default:
      return `${command} --version`;
  }
}

function formatVersionStatus(current, requirements) {
  if (!current) {
    return { status: 'missing', message: 'Not installed' };
  }
  
  if (semver.lt(current, requirements.minimum)) {
    return { 
      status: 'too_old', 
      message: `Too old (${current} < ${requirements.minimum})` 
    };
  }
  
  if (requirements.maximum && semver.gt(current, requirements.maximum)) {
    return { 
      status: 'too_new', 
      message: `Too new (${current} > ${requirements.maximum})` 
    };
  }
  
  if (semver.gte(current, requirements.recommended)) {
    return { 
      status: 'excellent', 
      message: `Excellent (${current} >= ${requirements.recommended})` 
    };
  }
  
  return { 
    status: 'acceptable', 
    message: `Acceptable (${current} >= ${requirements.minimum})` 
  };
}

// ==================================================================================
// ENGINE GUARDIAN PRINCIPAL
// ==================================================================================

class EngineGuardian {
  constructor() {
    this.results = {
      engines: {},
      features: {},
      system: {},
      issues: [],
      recommendations: [],
      overall: { passed: 0, failed: 0, warnings: 0 }
    };
    
    this.criticalErrors = [];
    this.warnings = [];
  }

  async guardAllEngines() {
    logHeader('ARBITRAGEXPLUS2025 - Node.js Engine Guardian');
    logInfo('Validating development environment compatibility...');
    
    try {
      // 1. Detectar información del sistema
      await this.detectSystemInfo();
      
      // 2. Validar engines requeridos
      await this.validateEngines();
      
      // 3. Validar features de Node.js
      await this.validateNodeFeatures();
      
      // 4. Validar configuraciones específicas
      await this.validateProjectConfiguration();
      
      // 5. Verificar package.json engines
      await this.validatePackageEngines();
      
      // 6. Generar reporte y recomendaciones
      return this.generateGuardianReport();
      
    } catch (error) {
      logError(`Error crítico en Engine Guardian: ${error.message}`);
      console.error(error.stack);
      return 1;
    }
  }

  async detectSystemInfo() {
    logInfo('Detectando información del sistema...');
    
    // OS information
    this.results.system.platform = process.platform;
    this.results.system.arch = process.arch;
    this.results.system.osInfo = OS_SPECIFIC[process.platform] || { name: 'Unknown OS' };
    
    logInfo(`Platform: ${this.results.system.osInfo.name} (${process.arch})`);
    
    // Environment variables
    this.results.system.nodeEnv = process.env.NODE_ENV || 'development';
    this.results.system.ciEnvironment = !!(process.env.CI || process.env.GITHUB_ACTIONS);
    
    // System resources
    this.results.system.totalMemoryGB = (require('os').totalmem() / (1024 ** 3)).toFixed(1);
    this.results.system.cpuCount = require('os').cpus().length;
    
    logInfo(`Memory: ${this.results.system.totalMemoryGB}GB, CPUs: ${this.results.system.cpuCount}`);
  }

  async validateEngines() {
    logHeader('Validando Versiones de Engines');
    
    for (const [engineName, requirements] of Object.entries(ENGINE_REQUIREMENTS)) {
      await this.validateEngine(engineName, requirements);
    }
  }

  async validateEngine(engineName, requirements) {
    logInfo(`Checking ${requirements.name}...`);
    
    const versionCommand = getVersionCommand(engineName, requirements);
    const result = executeCommand(versionCommand);
    
    if (!result.success) {
      if (requirements.required !== false) {
        this.criticalErrors.push({
          engine: engineName,
          issue: 'not_installed',
          message: `${requirements.name} is not installed`,
          fix: `Install ${requirements.name} ${requirements.recommended} or later`
        });
        
        logError(`${requirements.name}: Not installed`);
        this.results.overall.failed++;
      } else {
        logWarning(`${requirements.name}: Not installed (optional)`);
        this.results.overall.warnings++;
      }
      
      this.results.engines[engineName] = {
        installed: false,
        version: null,
        status: 'missing',
        required: requirements.required !== false
      };
      
      return;
    }
    
    const versionString = parseVersion(result.output);
    
    if (!versionString) {
      this.warnings.push({
        engine: engineName,
        issue: 'version_parse_failed',
        message: `Could not parse version from: ${result.output}`,
        fix: 'Manually verify version compatibility'
      });
      
      logWarning(`${requirements.name}: Version parse failed`);
      this.results.overall.warnings++;
      return;
    }
    
    const status = formatVersionStatus(versionString, requirements);
    
    this.results.engines[engineName] = {
      installed: true,
      version: versionString,
      status: status.status,
      message: status.message,
      requirements: requirements
    };
    
    switch (status.status) {
      case 'excellent':
        logSuccess(`${requirements.name}: ${status.message}`);
        this.results.overall.passed++;
        break;
        
      case 'acceptable':
        logSuccess(`${requirements.name}: ${status.message}`);
        this.results.overall.passed++;
        break;
        
      case 'too_old':
        if (requirements.required !== false) {
          this.criticalErrors.push({
            engine: engineName,
            issue: 'version_too_old',
            message: `${requirements.name} version too old: ${versionString}`,
            fix: `Update to ${requirements.recommended} or later`
          });
          
          logError(`${requirements.name}: ${status.message}`);
          this.results.overall.failed++;
        } else {
          logWarning(`${requirements.name}: ${status.message} (optional)`);
          this.results.overall.warnings++;
        }
        break;
        
      case 'too_new':
        this.warnings.push({
          engine: engineName,
          issue: 'version_too_new',
          message: `${requirements.name} version may be incompatible: ${versionString}`,
          fix: `Consider downgrading to ${requirements.recommended} if issues occur`
        });
        
        logWarning(`${requirements.name}: ${status.message}`);
        this.results.overall.warnings++;
        break;
        
      case 'missing':
        // Already handled above
        break;
    }
  }

  async validateNodeFeatures() {
    logHeader('Validando Features de Node.js');
    
    const nodeVersion = this.results.engines.node?.version;
    
    if (!nodeVersion) {
      logError('Cannot validate Node.js features - Node.js not detected');
      return;
    }
    
    for (const [featureName, requirement] of Object.entries(FEATURE_REQUIREMENTS)) {
      const isSupported = semver.gte(nodeVersion, requirement.node);
      
      this.results.features[featureName] = {
        supported: isSupported,
        requiredVersion: requirement.node,
        currentVersion: nodeVersion,
        description: requirement.description
      };
      
      if (isSupported) {
        logSuccess(`${requirement.description}: Supported (>= ${requirement.node})`);
        this.results.overall.passed++;
      } else {
        // Determinar si es crítico o warning
        const criticalFeatures = ['esModules', 'fetch', 'optionalChaining'];
        
        if (criticalFeatures.includes(featureName)) {
          this.criticalErrors.push({
            engine: 'node',
            issue: 'feature_not_supported',
            message: `Critical Node.js feature not supported: ${requirement.description}`,
            fix: `Update Node.js to ${requirement.node} or later`
          });
          
          logError(`${requirement.description}: Not supported (need >= ${requirement.node})`);
          this.results.overall.failed++;
        } else {
          logWarning(`${requirement.description}: Not supported (need >= ${requirement.node})`);
          this.results.overall.warnings++;
        }
      }
    }
  }

  async validateProjectConfiguration() {
    logHeader('Validando Configuración del Proyecto');
    
    // Validar .nvmrc si existe
    const nvmrcPath = path.resolve(rootDir, '.nvmrc');
    
    if (fs.existsSync(nvmrcPath)) {
      const nvmrcContent = fs.readFileSync(nvmrcPath, 'utf8').trim();
      const nodeVersion = this.results.engines.node?.version;
      
      if (nodeVersion) {
        const nvmrcVersion = parseVersion(nvmrcContent) || nvmrcContent;
        
        if (semver.satisfies(nodeVersion, `^${nvmrcVersion}`)) {
          logSuccess(`.nvmrc: Compatible (${nodeVersion} satisfies ^${nvmrcVersion})`);
          this.results.overall.passed++;
        } else {
          this.warnings.push({
            engine: 'node',
            issue: 'nvmrc_mismatch',
            message: `Node.js version ${nodeVersion} doesn't match .nvmrc ${nvmrcVersion}`,
            fix: `Use 'nvm use' or update Node.js to match .nvmrc`
          });
          
          logWarning(`.nvmrc: Version mismatch (${nodeVersion} vs ${nvmrcVersion})`);
          this.results.overall.warnings++;
        }
      }
    } else {
      logInfo('.nvmrc: Not found (optional)');
    }
    
    // Validar volta configuration en package.json
    const packageJsonPath = path.resolve(rootDir, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        if (packageJson.volta) {
          const voltaNode = packageJson.volta.node;
          const voltaPnpm = packageJson.volta.pnpm;
          
          const nodeVersion = this.results.engines.node?.version;
          const pnpmVersion = this.results.engines.pnpm?.version;
          
          if (voltaNode && nodeVersion) {
            if (semver.satisfies(nodeVersion, `^${voltaNode}`)) {
              logSuccess(`Volta Node.js: Compatible (${nodeVersion} ~ ${voltaNode})`);
            } else {
              logWarning(`Volta Node.js: Version drift (${nodeVersion} vs ${voltaNode})`);
              this.results.overall.warnings++;
            }
          }
          
          if (voltaPnpm && pnpmVersion) {
            if (semver.satisfies(pnpmVersion, `^${voltaPnpm}`)) {
              logSuccess(`Volta pnpm: Compatible (${pnpmVersion} ~ ${voltaPnpm})`);
            } else {
              logWarning(`Volta pnpm: Version drift (${pnpmVersion} vs ${voltaPnpm})`);
              this.results.overall.warnings++;
            }
          }
        } else {
          logInfo('Volta: Not configured');
        }
      } catch (error) {
        logWarning(`package.json: Cannot parse (${error.message})`);
      }
    }
  }

  async validatePackageEngines() {
    logHeader('Validando Engines en package.json');
    
    const packageJsonPath = path.resolve(rootDir, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      logWarning('package.json: Not found');
      return;
    }
    
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (!packageJson.engines) {
        this.recommendations.push('Add "engines" field to package.json to enforce version requirements');
        logInfo('package.json engines: Not specified');
        return;
      }
      
      // Validar engine requirements en package.json
      for (const [engineName, requiredVersion] of Object.entries(packageJson.engines)) {
        const currentEngine = this.results.engines[engineName];
        
        if (!currentEngine || !currentEngine.installed) {
          logWarning(`package.json engines.${engineName}: Engine not installed`);
          continue;
        }
        
        try {
          if (semver.satisfies(currentEngine.version, requiredVersion)) {
            logSuccess(`package.json engines.${engineName}: Compatible (${currentEngine.version} satisfies ${requiredVersion})`);
            this.results.overall.passed++;
          } else {
            this.criticalErrors.push({
              engine: engineName,
              issue: 'package_engines_mismatch',
              message: `${engineName} ${currentEngine.version} doesn't satisfy package.json requirement: ${requiredVersion}`,
              fix: `Update ${engineName} to satisfy ${requiredVersion}`
            });
            
            logError(`package.json engines.${engineName}: Not satisfied (${currentEngine.version} vs ${requiredVersion})`);
            this.results.overall.failed++;
          }
        } catch (error) {
          logWarning(`package.json engines.${engineName}: Invalid semver range (${requiredVersion})`);
          this.results.overall.warnings++;
        }
      }
      
    } catch (error) {
      logError(`package.json: Cannot parse (${error.message})`);
      this.results.overall.failed++;
    }
  }

  generateGuardianReport() {
    logHeader('REPORTE DEL ENGINE GUARDIAN');
    
    // Estadísticas generales
    console.log();
    log('📊 ESTADÍSTICAS GENERALES:', 'bright');
    log(`   ✅ Passed: ${this.results.overall.passed}`, 'green');
    log(`   ❌ Failed: ${this.results.overall.failed}`, this.results.overall.failed > 0 ? 'red' : 'green');
    log(`   ⚠️  Warnings: ${this.results.overall.warnings}`, this.results.overall.warnings > 0 ? 'yellow' : 'green');
    
    const totalChecks = this.results.overall.passed + this.results.overall.failed + this.results.overall.warnings;
    const successRate = totalChecks > 0 ? ((this.results.overall.passed / totalChecks) * 100).toFixed(1) : 0;
    
    log(`   📈 Success Rate: ${successRate}%`, successRate >= 90 ? 'green' : successRate >= 70 ? 'yellow' : 'red');
    
    // Engine status summary
    console.log();
    log('⚙️  ENGINE STATUS:', 'bright');
    
    for (const [engineName, info] of Object.entries(this.results.engines)) {
      if (info.installed) {
        const statusColor = info.status === 'excellent' ? 'green' : 
                           info.status === 'acceptable' ? 'green' :
                           info.status === 'too_old' ? 'red' : 'yellow';
        
        log(`   ${info.requirements.name}: ${info.version} (${info.status})`, statusColor);
      } else {
        const requiredColor = info.required ? 'red' : 'yellow';
        log(`   ${ENGINE_REQUIREMENTS[engineName].name}: Not installed${info.required ? ' (REQUIRED)' : ' (optional)'}`, requiredColor);
      }
    }
    
    // System information
    console.log();
    log('🖥️  SYSTEM INFORMATION:', 'bright');
    log(`   Platform: ${this.results.system.osInfo.name} (${this.results.system.arch})`, 'cyan');
    log(`   Memory: ${this.results.system.totalMemoryGB}GB`, 'cyan');
    log(`   CPUs: ${this.results.system.cpuCount}`, 'cyan');
    log(`   Environment: ${this.results.system.nodeEnv}${this.results.system.ciEnvironment ? ' (CI)' : ''}`, 'cyan');
    
    // Critical errors
    if (this.criticalErrors.length > 0) {
      console.log();
      log(`🔴 CRITICAL ERRORS (${this.criticalErrors.length}):`, 'red');
      
      this.criticalErrors.forEach((error, index) => {
        log(`   ${index + 1}. ${error.message}`, 'red');
        log(`      💡 Fix: ${error.fix}`, 'dim');
      });
    }
    
    // Warnings
    if (this.warnings.length > 0) {
      console.log();
      log(`⚠️  WARNINGS (${this.warnings.length}):`, 'yellow');
      
      this.warnings.forEach((warning, index) => {
        log(`   ${index + 1}. ${warning.message}`, 'yellow');
        log(`      💡 Fix: ${warning.fix}`, 'dim');
      });
    }
    
    // Node.js feature compatibility
    const unsupportedFeatures = Object.entries(this.results.features || {})
      .filter(([_, info]) => !info.supported);
      
    if (unsupportedFeatures.length > 0) {
      console.log();
      log('🚫 UNSUPPORTED NODE.JS FEATURES:', 'red');
      
      unsupportedFeatures.forEach(([featureName, info]) => {
        log(`   ${info.description}: Requires Node.js >= ${info.requiredVersion}`, 'red');
      });
    }
    
    // Recommendations
    if (this.recommendations.length > 0) {
      console.log();
      log(`💡 RECOMMENDATIONS (${this.recommendations.length}):`, 'cyan');
      
      this.recommendations.forEach((rec, index) => {
        log(`   ${index + 1}. ${rec}`, 'cyan');
      });
    }
    
    // OS-specific notes
    if (this.results.system.osInfo.notes?.length > 0) {
      console.log();
      log(`📝 ${this.results.system.osInfo.name.toUpperCase()} NOTES:`, 'cyan');
      
      this.results.system.osInfo.notes.forEach((note, index) => {
        log(`   ${index + 1}. ${note}`, 'cyan');
      });
    }
    
    // Installation commands
    this.generateInstallationCommands();
    
    // Final result
    console.log();
    
    if (this.criticalErrors.length === 0) {
      logSuccess('✅ ENGINE GUARDIAN PASSED');
      log('🚀 Environment is compatible with ARBITRAGEXPLUS2025', 'green');
      
      if (this.warnings.length > 0) {
        log(`💡 Consider addressing ${this.warnings.length} warnings for optimal performance`, 'yellow');
      }
      
      return 0;
    } else {
      logError('❌ ENGINE GUARDIAN FAILED');
      log(`🔧 Fix ${this.criticalErrors.length} critical issues before proceeding`, 'red');
      
      // Show quick fix commands
      console.log();
      log('🚑 QUICK FIXES:', 'bright');
      
      if (this.criticalErrors.some(e => e.engine === 'node')) {
        log('   curl -fsSL https://fnm.vercel.app/install | bash  # Install fnm', 'dim');
        log('   fnm install 18.17.0 && fnm use 18.17.0           # Install Node.js', 'dim');
      }
      
      if (this.criticalErrors.some(e => e.engine === 'pnpm')) {
        log('   npm install -g pnpm@8.15.0                       # Install pnpm', 'dim');
      }
      
      return 1;
    }
  }

  generateInstallationCommands() {
    console.log();
    log('🛠️  INSTALLATION COMMANDS:', 'bright');
    
    const platform = this.results.system.platform;
    
    switch (platform) {
      case 'darwin': // macOS
        log('   # Install via Homebrew:', 'dim');
        log('   brew install node pnpm python rust git docker', 'dim');
        break;
        
      case 'linux':
        log('   # Install via package manager:', 'dim');
        log('   curl -fsSL https://fnm.vercel.app/install | bash', 'dim');
        log('   apt-get install python3 git docker.io  # Ubuntu/Debian', 'dim');
        log('   yum install python3 git docker         # RHEL/CentOS', 'dim');
        break;
        
      case 'win32': // Windows
        log('   # Install via Chocolatey or direct download:', 'dim');
        log('   choco install nodejs pnpm python rust git docker-desktop', 'dim');
        break;
        
      default:
        log('   # Check official documentation for installation instructions', 'dim');
    }
    
    console.log();
    log('   # Verify installation:', 'dim');
    log('   node --version && pnpm --version && python3 --version', 'dim');
  }
}

// ==================================================================================
// EJECUCIÓN
// ==================================================================================

async function main() {
  try {
    const guardian = new EngineGuardian();
    const exitCode = await guardian.guardAllEngines();
    process.exit(exitCode);
  } catch (error) {
    logError(`Error crítico en Engine Guardian: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { EngineGuardian };