/**
 * ============================================================================
 * ARCHIVO: ./scripts/check_fly_config.js
 * SERVICIO: check_fly_config.js
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   DEPENDENCIAS: path, fs, url
 * 
 * 🔄 TRANSFORMACIÓN:
 *   CLASES: FlyConfigValidator
 *   FUNCIONES: validateDockerfile, logHeader, validatePerformance
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 *   - path
 *   - fs
 *   - url
 * 
 * ============================================================================
 */

#!/usr/bin/env node

/**
 * ARBITRAGEXPLUS2025 - Fly.io Configuration Validator
 * 
 * Este script valida la configuración de Fly.io para asegurar que el deployment
 * sea exitoso. Verifica fly.toml, variables de entorno, servicios, y configuraciones
 * de escalamiento.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ==================================================================================
// CONFIGURACIÓN DE VALIDACIÓN
// ==================================================================================

const FLY_CONFIG = {
  requiredFiles: [
    'fly.toml',
    'Dockerfile',
    '.dockerignore'
  ],
  
  requiredSections: [
    'app',
    'build',
    'env',
    'processes',
    'services'
  ],
  
  requiredProcesses: [
    'api',
    'collector', 
    'engine',
    'executor'
  ],
  
  requiredPorts: [
    { port: 80, handlers: ['http'] },
    { port: 443, handlers: ['tls', 'http'] }
  ],
  
  requiredEnvVars: [
    'NODE_ENV',
    'PORT',
    'HOST'
  ],
  
  requiredSecrets: [
    'GITHUB_TOKEN',
    'SPREADSHEET_ID',
    'PRIVATE_KEY',
    'ETHEREUM_RPC_URL'
  ],
  
  performance: {
    maxMemoryMB: 4096,
    maxCpuCores: 4,
    minHealthCheckInterval: 15,
    maxHealthCheckInterval: 300
  },
  
  regions: [
    'iad', // US East
    'lhr', // London
    'nrt', // Tokyo  
    'syd', // Sydney
    'fra', // Frankfurt
    'sjc'  // US West
  ]
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
  log(`\n🔍 ${message}`, 'bright');
  log('='.repeat(80), 'blue');
}

// ==================================================================================
// UTILIDADES
// ==================================================================================

function parseToml(content) {
  // Parser TOML simplificado para validaciones básicas
  const lines = content.split('\n');
  const config = {};
  let currentSection = null;
  let currentArray = null;
  
  for (let line of lines) {
    line = line.trim();
    
    // Skip comentarios y líneas vacías
    if (!line || line.startsWith('#')) continue;
    
    // Sección
    if (line.startsWith('[') && line.endsWith(']')) {
      const sectionName = line.slice(1, -1);
      
      if (sectionName.startsWith('[') && sectionName.endsWith(']')) {
        // Array de secciones [[services]]
        const arrayName = sectionName.slice(1, -1);
        if (!config[arrayName]) config[arrayName] = [];
        currentArray = {};
        config[arrayName].push(currentArray);
        currentSection = currentArray;
      } else {
        // Sección normal [env]
        if (!config[sectionName]) config[sectionName] = {};
        currentSection = config[sectionName];
        currentArray = null;
      }
      continue;
    }
    
    // Key-value pair
    const equalIndex = line.indexOf('=');
    if (equalIndex > 0) {
      const key = line.substring(0, equalIndex).trim();
      let value = line.substring(equalIndex + 1).trim();
      
      // Remove quotes
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      // Parse numbers and booleans
      if (/^\d+$/.test(value)) {
        value = parseInt(value);
      } else if (/^\d*\.\d+$/.test(value)) {
        value = parseFloat(value);
      } else if (value === 'true' || value === 'false') {
        value = value === 'true';
      }
      
      if (currentSection) {
        currentSection[key] = value;
      } else {
        config[key] = value;
      }
    }
  }
  
  return config;
}

function validateAppName(config) {
  const issues = [];
  
  if (!config.app) {
    issues.push({
      type: 'error',
      message: 'Missing app name in fly.toml',
      fix: 'Add app = "arbitragexplus2025" to fly.toml'
    });
  } else if (config.app !== 'arbitragexplus2025') {
    issues.push({
      type: 'warning',
      message: `App name is "${config.app}", expected "arbitragexplus2025"`,
      fix: 'Change app name to "arbitragexplus2025" or update documentation'
    });
  }
  
  return issues;
}

function validateRegion(config) {
  const issues = [];
  
  if (!config.primary_region) {
    issues.push({
      type: 'error',
      message: 'Missing primary_region in fly.toml',
      fix: 'Add primary_region = "iad" to fly.toml'
    });
  } else if (!FLY_CONFIG.regions.includes(config.primary_region)) {
    issues.push({
      type: 'warning',
      message: `Primary region "${config.primary_region}" is not in recommended list`,
      fix: `Consider using one of: ${FLY_CONFIG.regions.join(', ')}`
    });
  }
  
  return issues;
}

function validateBuild(config) {
  const issues = [];
  
  if (!config.build) {
    issues.push({
      type: 'error',
      message: 'Missing [build] section in fly.toml',
      fix: 'Add [build] section with dockerfile = "Dockerfile"'
    });
    return issues;
  }
  
  if (!config.build.dockerfile && !config.build.builtin) {
    issues.push({
      type: 'error',
      message: 'Build section missing dockerfile or builtin',
      fix: 'Add dockerfile = "Dockerfile" to [build] section'
    });
  }
  
  return issues;
}

function validateProcesses(config) {
  const issues = [];
  
  if (!config.processes) {
    issues.push({
      type: 'error',
      message: 'Missing [processes] section in fly.toml',
      fix: 'Add [processes] section with api, collector, engine, executor processes'
    });
    return issues;
  }
  
  for (const requiredProcess of FLY_CONFIG.requiredProcesses) {
    if (!config.processes[requiredProcess]) {
      issues.push({
        type: 'error',
        message: `Missing required process: ${requiredProcess}`,
        fix: `Add ${requiredProcess} process to [processes] section`
      });
    }
  }
  
  return issues;
}

function validateServices(config) {
  const issues = [];
  
  if (!config.services || !Array.isArray(config.services)) {
    issues.push({
      type: 'error',
      message: 'Missing [[services]] sections in fly.toml',
      fix: 'Add at least one [[services]] section for HTTP traffic'
    });
    return issues;
  }
  
  const httpService = config.services.find(s => 
    s.ports && s.ports.some(p => p.handlers && p.handlers.includes('http'))
  );
  
  if (!httpService) {
    issues.push({
      type: 'error',
      message: 'No HTTP service found in services configuration',
      fix: 'Add a service with HTTP handlers on port 80/443'
    });
  }
  
  // Validar health checks
  for (const service of config.services) {
    if (service.tcp_checks) {
      service.tcp_checks.forEach((check, index) => {
        if (!check.interval) {
          issues.push({
            type: 'warning',
            message: `TCP check ${index} missing interval`,
            fix: 'Add interval = "30s" to tcp_checks'
          });
        }
      });
    }
    
    if (service.http_checks) {
      service.http_checks.forEach((check, index) => {
        if (!check.path) {
          issues.push({
            type: 'error',
            message: `HTTP check ${index} missing path`,
            fix: 'Add path = "/health" to http_checks'
          });
        }
        
        if (check.path && !check.path.startsWith('/')) {
          issues.push({
            type: 'error',
            message: `HTTP check ${index} path should start with /`,
            fix: `Change path to "/${check.path}"`
          });
        }
      });
    }
  }
  
  return issues;
}

function validateEnvironment(config) {
  const issues = [];
  
  if (!config.env) {
    issues.push({
      type: 'warning',
      message: 'Missing [env] section in fly.toml',
      fix: 'Add [env] section with NODE_ENV, PORT, HOST'
    });
    return issues;
  }
  
  for (const requiredEnv of FLY_CONFIG.requiredEnvVars) {
    if (!config.env[requiredEnv]) {
      issues.push({
        type: 'warning',
        message: `Missing environment variable: ${requiredEnv}`,
        fix: `Add ${requiredEnv} to [env] section`
      });
    }
  }
  
  // Validar valores específicos
  if (config.env.NODE_ENV && config.env.NODE_ENV !== 'production') {
    issues.push({
      type: 'warning',
      message: `NODE_ENV is "${config.env.NODE_ENV}", should be "production" for deployment`,
      fix: 'Set NODE_ENV = "production" in [env] section'
    });
  }
  
  if (config.env.PORT && config.env.PORT !== 3000) {
    issues.push({
      type: 'info',
      message: `PORT is ${config.env.PORT}, make sure it matches your app configuration`,
      fix: 'Verify PORT matches your application server configuration'
    });
  }
  
  return issues;
}

function validateVM(config) {
  const issues = [];
  
  if (config.vm) {
    if (config.vm.size) {
      const validSizes = ['shared-cpu-1x', 'shared-cpu-2x', 'shared-cpu-4x', 'shared-cpu-8x'];
      if (!validSizes.includes(config.vm.size)) {
        issues.push({
          type: 'warning',
          message: `VM size "${config.vm.size}" might not be optimal`,
          fix: `Consider using one of: ${validSizes.join(', ')}`
        });
      }
    }
    
    if (config.vm.memory) {
      const memoryGB = parseFloat(config.vm.memory.replace('GB', ''));
      if (memoryGB > FLY_CONFIG.performance.maxMemoryMB / 1024) {
        issues.push({
          type: 'warning',
          message: `VM memory ${config.vm.memory} is very high`,
          fix: 'Consider if you really need that much memory'
        });
      }
    }
  }
  
  return issues;
}

function validateDockerfile() {
  const issues = [];
  const dockerfilePath = path.resolve(rootDir, 'Dockerfile');
  
  if (!fs.existsSync(dockerfilePath)) {
    issues.push({
      type: 'error',
      message: 'Dockerfile not found',
      fix: 'Create a Dockerfile for the application'
    });
    return issues;
  }
  
  try {
    const content = fs.readFileSync(dockerfilePath, 'utf8');
    
    // Validaciones básicas del Dockerfile
    if (!content.includes('FROM ')) {
      issues.push({
        type: 'error',
        message: 'Dockerfile missing FROM instruction',
        fix: 'Add FROM instruction at the beginning of Dockerfile'
      });
    }
    
    if (!content.includes('EXPOSE ') && !content.includes('ENV PORT')) {
      issues.push({
        type: 'warning',
        message: 'Dockerfile should expose port or set PORT env var',
        fix: 'Add EXPOSE 3000 or ENV PORT=3000 to Dockerfile'
      });
    }
    
    if (!content.includes('CMD ') && !content.includes('ENTRYPOINT ')) {
      issues.push({
        type: 'error',
        message: 'Dockerfile missing CMD or ENTRYPOINT',
        fix: 'Add CMD or ENTRYPOINT instruction to Dockerfile'
      });
    }
    
    // Recomendaciones de mejores prácticas
    if (!content.includes('USER ')) {
      issues.push({
        type: 'info',
        message: 'Consider running as non-root user in Dockerfile',
        fix: 'Add USER instruction to run as non-root user'
      });
    }
    
    if (content.includes('apt-get update') && !content.includes('rm -rf /var/lib/apt/lists/*')) {
      issues.push({
        type: 'info',
        message: 'Consider cleaning apt cache in Dockerfile',
        fix: 'Add "rm -rf /var/lib/apt/lists/*" after apt-get commands'
      });
    }
    
  } catch (error) {
    issues.push({
      type: 'error',
      message: `Error reading Dockerfile: ${error.message}`,
      fix: 'Fix Dockerfile permissions or syntax'
    });
  }
  
  return issues;
}

function checkFlySecrets() {
  const issues = [];
  
  // No podemos leer los secrets directamente, pero podemos dar recomendaciones
  issues.push({
    type: 'info',
    message: 'Remember to set required secrets using fly secrets set',
    fix: `Run: fly secrets set GITHUB_TOKEN=... SPREADSHEET_ID=... PRIVATE_KEY=... ETHEREUM_RPC_URL=...`
  });
  
  return issues;
}

function validatePerformance(config) {
  const issues = [];
  
  // Validar configuración de servicios para performance
  if (config.services) {
    for (const service of config.services) {
      if (service.concurrency) {
        if (service.concurrency.hard_limit > 2000) {
          issues.push({
            type: 'warning',
            message: `Service concurrency hard_limit ${service.concurrency.hard_limit} is very high`,
            fix: 'Consider lowering hard_limit for better stability'
          });
        }
        
        if (service.concurrency.soft_limit > service.concurrency.hard_limit) {
          issues.push({
            type: 'error',
            message: 'Service soft_limit is higher than hard_limit',
            fix: 'Set soft_limit lower than hard_limit'
          });
        }
      }
      
      // Validar health checks intervals
      if (service.tcp_checks) {
        for (const check of service.tcp_checks) {
          if (check.interval) {
            const intervalSeconds = parseInt(check.interval.replace('s', ''));
            if (intervalSeconds < FLY_CONFIG.performance.minHealthCheckInterval) {
              issues.push({
                type: 'warning',
                message: `TCP health check interval ${check.interval} is too frequent`,
                fix: `Consider increasing to at least ${FLY_CONFIG.performance.minHealthCheckInterval}s`
              });
            }
          }
        }
      }
    }
  }
  
  return issues;
}

// ==================================================================================
// VALIDADOR PRINCIPAL
// ==================================================================================

class FlyConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.info = [];
    this.config = null;
  }

  async validate() {
    logHeader('ARBITRAGEXPLUS2025 - Fly.io Configuration Validator');
    
    // 1. Verificar archivos requeridos
    await this.validateRequiredFiles();
    
    // 2. Parsear y validar fly.toml
    await this.validateFlyToml();
    
    // 3. Validar Dockerfile
    this.validateDockerfile();
    
    // 4. Validar secrets
    this.validateSecrets();
    
    // 5. Generar reporte
    return this.generateReport();
  }

  async validateRequiredFiles() {
    logInfo('Validando archivos requeridos...');
    
    for (const file of FLY_CONFIG.requiredFiles) {
      const filePath = path.resolve(rootDir, file);
      
      if (!fs.existsSync(filePath)) {
        this.addIssue('error', `Missing required file: ${file}`, `Create ${file}`);
      } else {
        logSuccess(`Found: ${file}`);
      }
    }
  }

  async validateFlyToml() {
    const flyTomlPath = path.resolve(rootDir, 'fly.toml');
    
    if (!fs.existsSync(flyTomlPath)) {
      this.addIssue('error', 'fly.toml not found', 'Create fly.toml configuration file');
      return;
    }
    
    try {
      const content = fs.readFileSync(flyTomlPath, 'utf8');
      this.config = parseToml(content);
      
      logInfo('Validando configuración de fly.toml...');
      
      // Ejecutar todas las validaciones
      this.processIssues(validateAppName(this.config));
      this.processIssues(validateRegion(this.config));
      this.processIssues(validateBuild(this.config));
      this.processIssues(validateProcesses(this.config));
      this.processIssues(validateServices(this.config));
      this.processIssues(validateEnvironment(this.config));
      this.processIssues(validateVM(this.config));
      this.processIssues(validatePerformance(this.config));
      
    } catch (error) {
      this.addIssue('error', `Error parsing fly.toml: ${error.message}`, 'Fix TOML syntax in fly.toml');
    }
  }

  validateDockerfile() {
    logInfo('Validando Dockerfile...');
    this.processIssues(validateDockerfile());
  }

  validateSecrets() {
    logInfo('Validando secrets configuration...');
    this.processIssues(checkFlySecrets());
  }

  addIssue(type, message, fix) {
    const issue = { message, fix };
    
    switch (type) {
      case 'error':
        this.errors.push(issue);
        break;
      case 'warning':
        this.warnings.push(issue);
        break;
      case 'info':
        this.info.push(issue);
        break;
    }
  }

  processIssues(issues) {
    for (const issue of issues) {
      this.addIssue(issue.type, issue.message, issue.fix);
    }
  }

  generateReport() {
    logHeader('Reporte de Validación Fly.io');
    
    // Estadísticas
    console.log();
    log(`📊 RESULTADOS:`, 'bright');
    log(`   Errores: ${this.errors.length}`, this.errors.length > 0 ? 'red' : 'green');
    log(`   Advertencias: ${this.warnings.length}`, this.warnings.length > 0 ? 'yellow' : 'green');
    log(`   Información: ${this.info.length}`, 'cyan');
    
    // Mostrar errores
    if (this.errors.length > 0) {
      console.log();
      log(`🔴 ERRORES CRÍTICOS (${this.errors.length}):`, 'red');
      
      this.errors.forEach((error, index) => {
        log(`   ${index + 1}. ${error.message}`, 'red');
        log(`      💡 Fix: ${error.fix}`, 'dim');
        console.log();
      });
    }
    
    // Mostrar advertencias
    if (this.warnings.length > 0) {
      console.log();
      log(`🟡 ADVERTENCIAS (${this.warnings.length}):`, 'yellow');
      
      this.warnings.forEach((warning, index) => {
        log(`   ${index + 1}. ${warning.message}`, 'yellow');
        log(`      💡 Fix: ${warning.fix}`, 'dim');
        console.log();
      });
    }
    
    // Mostrar información
    if (this.info.length > 0) {
      console.log();
      log(`ℹ️  INFORMACIÓN Y RECOMENDACIONES (${this.info.length}):`, 'cyan');
      
      this.info.forEach((info, index) => {
        log(`   ${index + 1}. ${info.message}`, 'cyan');
        log(`      💡 ${info.fix}`, 'dim');
        console.log();
      });
    }
    
    // Configuración detectada
    if (this.config) {
      console.log();
      log(`⚙️  CONFIGURACIÓN DETECTADA:`, 'bright');
      log(`   App: ${this.config.app || 'No definida'}`, 'cyan');
      log(`   Region: ${this.config.primary_region || 'No definida'}`, 'cyan');
      
      if (this.config.processes) {
        const processCount = Object.keys(this.config.processes).length;
        log(`   Procesos: ${processCount} definidos`, 'cyan');
      }
      
      if (this.config.services) {
        log(`   Servicios: ${this.config.services.length} configurados`, 'cyan');
      }
    }
    
    // Comandos útiles
    console.log();
    log(`🛠️  COMANDOS ÚTILES:`, 'bright');
    log(`   fly apps list              # Listar apps`, 'dim');
    log(`   fly status                 # Estado de la app`, 'dim');
    log(`   fly secrets list           # Ver secrets configurados`, 'dim');
    log(`   fly deploy                 # Deploy la aplicación`, 'dim');
    log(`   fly logs                   # Ver logs en tiempo real`, 'dim');
    log(`   fly ssh console            # Acceso SSH`, 'dim');
    
    // Resultado final
    console.log();
    const isValid = this.errors.length === 0;
    
    if (isValid) {
      logSuccess('✅ CONFIGURACIÓN FLY.IO VÁLIDA');
      log('🚀 Ready para deployment en Fly.io', 'green');
      
      if (this.warnings.length > 0) {
        log(`⚠️  Considera resolver ${this.warnings.length} advertencias para optimizar`, 'yellow');
      }
      
      return 0;
    } else {
      logError('❌ CONFIGURACIÓN FLY.IO INVÁLIDA');
      log(`🔧 Resolver ${this.errors.length} errores antes del deployment`, 'red');
      
      // Mostrar próximos pasos
      console.log();
      log(`📋 PRÓXIMOS PASOS:`, 'bright');
      log(`   1. Corregir errores críticos listados arriba`, 'yellow');
      log(`   2. Re-ejecutar: node scripts/check_fly_config.js`, 'yellow');
      log(`   3. Testear deployment: fly deploy --dry-run`, 'yellow');
      log(`   4. Deploy real: fly deploy`, 'yellow');
      
      return 1;
    }
  }
}

// ==================================================================================
// EJECUCIÓN
// ==================================================================================

async function main() {
  try {
    const validator = new FlyConfigValidator();
    const exitCode = await validator.validate();
    process.exit(exitCode);
  } catch (error) {
    logError(`Error crítico validando configuración Fly.io: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { FlyConfigValidator };