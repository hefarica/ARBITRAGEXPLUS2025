#!/usr/bin/env node
/**
 * ARBITRAGEXPLUS2025 - Fly.io Configuration Checker
 * 
 * Valida la configuración de Fly.io para asegurar que:
 * - fly.toml existe y tiene configuración válida
 * - Los puertos están correctamente configurados
 * - Las variables de entorno necesarias están documentadas
 * - Los health checks están configurados
 * - La configuración de recursos es adecuada
 */

const fs = require('fs');
const path = require('path');
const toml = require('@iarna/toml');

// ==================================================================================
// CONFIGURACIÓN
// ==================================================================================

const ROOT_DIR = path.resolve(__dirname, '..');
const FLY_TOML_PATH = path.join(ROOT_DIR, 'fly.toml');
const ENV_EXAMPLE_PATH = path.join(ROOT_DIR, '.env.example');

const REQUIRED_CONFIG = {
  app: true,
  primary_region: true,
  build: false,
  services: true
};

const REQUIRED_SERVICE_CONFIG = {
  internal_port: 3000,
  protocol: 'tcp',
  auto_stop_machines: true,
  auto_start_machines: true
};

const REQUIRED_ENV_VARS = [
  'GOOGLE_SHEETS_SPREADSHEET_ID',
  'GOOGLE_APPLICATION_CREDENTIALS',
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL'
];

// ==================================================================================
// UTILIDADES
// ==================================================================================

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '─'.repeat(70));
  log(`  ${title}`, 'bright');
  console.log('─'.repeat(70));
}

function logCheck(message, passed, details = '') {
  const icon = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`  ${icon} ${message}`, color);
  if (details) {
    console.log(`    ${details}`);
  }
}

// ==================================================================================
// VALIDACIONES
// ==================================================================================

let errors = [];
let warnings = [];
let checks = 0;
let passed = 0;

function checkFileExists(filePath, name) {
  checks++;
  const exists = fs.existsSync(filePath);
  logCheck(`${name} existe`, exists, exists ? filePath : `No encontrado: ${filePath}`);
  
  if (!exists) {
    errors.push(`${name} no encontrado en ${filePath}`);
  } else {
    passed++;
  }
  
  return exists;
}

function validateFlyToml(config) {
  logSection('Validación de fly.toml');
  
  // Validar campos requeridos
  for (const [field, required] of Object.entries(REQUIRED_CONFIG)) {
    checks++;
    const exists = config[field] !== undefined;
    
    if (required && !exists) {
      logCheck(`Campo requerido: ${field}`, false);
      errors.push(`Campo requerido faltante en fly.toml: ${field}`);
    } else if (exists) {
      logCheck(`Campo: ${field}`, true, `Valor: ${JSON.stringify(config[field])}`);
      passed++;
    } else {
      logCheck(`Campo opcional: ${field}`, true, 'No configurado');
      passed++;
    }
  }
  
  // Validar configuración de servicios
  if (config.services && Array.isArray(config.services) && config.services.length > 0) {
    const service = config.services[0];
    
    checks++;
    const portCorrect = service.internal_port === REQUIRED_SERVICE_CONFIG.internal_port;
    logCheck(
      `Puerto interno configurado correctamente`,
      portCorrect,
      `Esperado: ${REQUIRED_SERVICE_CONFIG.internal_port}, Actual: ${service.internal_port}`
    );
    
    if (!portCorrect) {
      warnings.push(`Puerto interno debería ser ${REQUIRED_SERVICE_CONFIG.internal_port}, actual: ${service.internal_port}`);
    } else {
      passed++;
    }
    
    // Validar health checks
    checks++;
    const hasHealthCheck = service.http_checks && service.http_checks.length > 0;
    logCheck(`Health checks configurados`, hasHealthCheck);
    
    if (!hasHealthCheck) {
      warnings.push('No se encontraron health checks configurados en fly.toml');
    } else {
      passed++;
      const healthCheck = service.http_checks[0];
      log(`    Endpoint: ${healthCheck.path || '/health'}`, 'cyan');
      log(`    Intervalo: ${healthCheck.interval || 'default'}`, 'cyan');
      log(`    Timeout: ${healthCheck.timeout || 'default'}`, 'cyan');
    }
    
    // Validar configuración de concurrencia
    checks++;
    const hasConcurrency = service.concurrency !== undefined;
    logCheck(`Configuración de concurrencia`, hasConcurrency);
    
    if (hasConcurrency) {
      passed++;
      log(`    Tipo: ${service.concurrency.type}`, 'cyan');
      log(`    Límite suave: ${service.concurrency.soft_limit}`, 'cyan');
      log(`    Límite duro: ${service.concurrency.hard_limit}`, 'cyan');
    } else {
      warnings.push('Configuración de concurrencia no especificada');
    }
  } else {
    errors.push('No se encontró configuración de servicios en fly.toml');
  }
  
  // Validar configuración de VM
  checks++;
  const hasVmConfig = config.vm !== undefined;
  logCheck(`Configuración de VM`, hasVmConfig);
  
  if (hasVmConfig) {
    passed++;
    log(`    CPU: ${config.vm.cpu_kind || config.vm.cpus || 'default'}`, 'cyan');
    log(`    Memoria: ${config.vm.memory || config.vm.memory_mb || 'default'}`, 'cyan');
  } else {
    warnings.push('Configuración de VM no especificada (se usarán valores por defecto)');
  }
}

function validateEnvExample() {
  logSection('Validación de .env.example');
  
  if (!fs.existsSync(ENV_EXAMPLE_PATH)) {
    errors.push('.env.example no encontrado');
    return;
  }
  
  const envContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf8');
  
  for (const varName of REQUIRED_ENV_VARS) {
    checks++;
    const exists = envContent.includes(varName);
    logCheck(`Variable de entorno: ${varName}`, exists);
    
    if (!exists) {
      warnings.push(`Variable de entorno ${varName} no documentada en .env.example`);
    } else {
      passed++;
    }
  }
  
  // Verificar que no hay valores hardcodeados sospechosos
  checks++;
  const hasHardcodedSecrets = /(?:sk_|pk_|AIza|ghp_|gho_)[a-zA-Z0-9]{20,}/.test(envContent);
  logCheck(`Sin credenciales hardcodeadas en .env.example`, !hasHardcodedSecrets);
  
  if (hasHardcodedSecrets) {
    errors.push('Se detectaron posibles credenciales hardcodeadas en .env.example');
  } else {
    passed++;
  }
}

function validateDockerfile() {
  logSection('Validación de Dockerfile');
  
  const dockerfilePath = path.join(ROOT_DIR, 'services', 'api-server', 'Dockerfile');
  
  checks++;
  const exists = fs.existsSync(dockerfilePath);
  logCheck(`Dockerfile existe`, exists, dockerfilePath);
  
  if (!exists) {
    warnings.push('Dockerfile no encontrado para api-server');
    return;
  }
  
  passed++;
  
  const dockerContent = fs.readFileSync(dockerfilePath, 'utf8');
  
  // Verificar que expone el puerto correcto
  checks++;
  const exposesPort = dockerContent.includes('EXPOSE 3000') || dockerContent.includes('EXPOSE ${PORT}');
  logCheck(`Puerto expuesto correctamente`, exposesPort);
  
  if (!exposesPort) {
    warnings.push('Dockerfile no expone el puerto 3000');
  } else {
    passed++;
  }
  
  // Verificar que no hay credenciales hardcodeadas
  checks++;
  const hasSecrets = /(?:sk_|pk_|AIza|ghp_|gho_)[a-zA-Z0-9]{20,}/.test(dockerContent);
  logCheck(`Sin credenciales en Dockerfile`, !hasSecrets);
  
  if (hasSecrets) {
    errors.push('Se detectaron posibles credenciales hardcodeadas en Dockerfile');
  } else {
    passed++;
  }
}

// ==================================================================================
// MAIN
// ==================================================================================

function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  ARBITRAGEXPLUS2025 - Fly.io Configuration Checker     ║');
  console.log('║  Validación de Configuración de Despliegue             ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  log(`\n🔍 Ejecutando desde: ${ROOT_DIR}`, 'cyan');
  log(`📅 Fecha: ${new Date().toLocaleString()}`, 'cyan');
  
  // Verificar archivos principales
  logSection('Archivos de Configuración');
  
  const flyTomlExists = checkFileExists(FLY_TOML_PATH, 'fly.toml');
  checkFileExists(ENV_EXAMPLE_PATH, '.env.example');
  
  // Validar fly.toml
  if (flyTomlExists) {
    try {
      const flyTomlContent = fs.readFileSync(FLY_TOML_PATH, 'utf8');
      const flyConfig = toml.parse(flyTomlContent);
      validateFlyToml(flyConfig);
    } catch (error) {
      errors.push(`Error al parsear fly.toml: ${error.message}`);
      log(`\n  ✗ Error al parsear fly.toml: ${error.message}`, 'red');
    }
  }
  
  // Validar .env.example
  validateEnvExample();
  
  // Validar Dockerfile
  validateDockerfile();
  
  // Resumen
  logSection('Resumen de Validación');
  
  log(`\n  Total de validaciones: ${checks}`, 'bright');
  log(`  ✓ Pasadas: ${passed}`, 'green');
  log(`  ⚠ Advertencias: ${warnings.length}`, 'yellow');
  log(`  ✗ Errores: ${errors.length}`, 'red');
  
  if (warnings.length > 0) {
    log('\n⚠ ADVERTENCIAS:', 'yellow');
    warnings.forEach((warning, i) => {
      console.log(`  ${i + 1}. ${warning}`);
    });
  }
  
  if (errors.length > 0) {
    log('\n✗ ERRORES CRÍTICOS:', 'red');
    errors.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });
    log('\n❌ La configuración de Fly.io tiene errores que deben corregirse.', 'red');
    process.exit(1);
  } else if (warnings.length > 0) {
    log('\n⚠ La configuración de Fly.io es válida pero tiene advertencias.', 'yellow');
    process.exit(0);
  } else {
    log('\n✅ La configuración de Fly.io es válida y está lista para despliegue.', 'green');
    process.exit(0);
  }
}

// Ejecutar
main();

