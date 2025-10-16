#!/usr/bin/env node

/**
 * ARBITRAGEXPLUS2025 - Local Health Validator
 * 
 * Este script valida que todos los servicios del sistema funcionen correctamente
 * en el entorno local. Es crítico para desarrollo y debugging, verificando
 * conectividad, configuración y estado de todos los componentes.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fetch from 'node-fetch';
import { createConnection } from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ==================================================================================
// CONFIGURACIÓN DE HEALTH CHECKS
// ==================================================================================

const HEALTH_CONFIG = {
  // Servicios locales a verificar
  localServices: [
    {
      name: 'API Server',
      host: 'localhost',
      port: 3000,
      healthPath: '/health',
      expectedStatus: 200,
      timeout: 5000
    },
    {
      name: 'Python Collector',
      host: 'localhost', 
      port: 8001,
      healthPath: '/health',
      expectedStatus: 200,
      timeout: 8000
    },
    {
      name: 'Rust Engine',
      host: 'localhost',
      port: 8002,
      healthPath: '/health',
      expectedStatus: 200,
      timeout: 3000
    },
    {
      name: 'TS Executor',
      host: 'localhost',
      port: 8003,
      healthPath: '/health',
      expectedStatus: 200,
      timeout: 5000
    }
  ],

  // Servicios externos críticos
  externalServices: [
    {
      name: 'Google Sheets API',
      url: 'https://sheets.googleapis.com/v4/spreadsheets',
      timeout: 10000,
      testMethod: 'testGoogleSheetsAPI'
    },
    {
      name: 'Pyth Network',
      url: 'https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
      timeout: 8000,
      testMethod: 'testPythNetwork'
    },
    {
      name: 'DefiLlama API',
      url: 'https://api.llama.fi/protocols',
      timeout: 10000,
      testMethod: 'testDefiLlama'
    },
    {
      name: 'Ethereum Mainnet RPC',
      url: process.env.ETHEREUM_RPC_URL || 'https://eth.public-rpc.com',
      timeout: 15000,
      testMethod: 'testEthereumRPC'
    }
  ],

  // Bases de datos y cache
  databases: [
    {
      name: 'PostgreSQL',
      host: 'localhost',
      port: 5432,
      testMethod: 'testPostgreSQL'
    },
    {
      name: 'Redis',
      host: 'localhost',
      port: 6379,
      testMethod: 'testRedis'
    }
  ],

  // Archivos críticos del sistema
  criticalFiles: [
    '.env',
    'package.json',
    'fly.toml',
    'services/api-server/src/server.ts',
    'services/python-collector/src/main.py',
    'services/engine-rust/src/main.rs'
  ],

  // Procesos que deben estar ejecutándose
  requiredProcesses: [
    { name: 'node', pattern: 'api-server' },
    { name: 'python', pattern: 'collector' },
    { name: 'engine-rust', pattern: 'main' }
  ],

  // Variables de entorno críticas
  requiredEnvVars: [
    'NODE_ENV',
    'SPREADSHEET_ID', 
    'GITHUB_TOKEN',
    'ETHEREUM_RPC_URL'
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

async function checkPortOpen(host, port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new createConnection({ host, port });
    
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);
    
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}

async function makeHttpRequest(url, options = {}) {
  const timeout = options.timeout || 10000;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    return {
      success: true,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: await response.text(),
      responseTime: Date.now() - (options.startTime || Date.now())
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    return {
      success: false,
      status: 0,
      statusText: error.name,
      headers: {},
      data: null,
      error: error.message,
      responseTime: Date.now() - (options.startTime || Date.now())
    };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================================================================================
// HEALTH CHECKER PRINCIPAL
// ==================================================================================

class LocalHealthChecker {
  constructor() {
    this.results = {
      overall: { healthy: 0, unhealthy: 0, warnings: 0 },
      services: { local: [], external: [] },
      databases: [],
      files: [],
      processes: [],
      environment: [],
      issues: [],
      recommendations: []
    };
    
    this.startTime = Date.now();
  }

  async runCompleteHealthCheck() {
    logHeader('ARBITRAGEXPLUS2025 - Local Health Check');
    logInfo(`Started at: ${new Date().toISOString()}`);
    
    try {
      // 1. Verificar archivos críticos
      await this.checkCriticalFiles();
      
      // 2. Verificar variables de entorno
      await this.checkEnvironmentVariables();
      
      // 3. Verificar procesos en ejecución
      await this.checkRunningProcesses();
      
      // 4. Verificar servicios locales
      await this.checkLocalServices();
      
      // 5. Verificar bases de datos
      await this.checkDatabases();
      
      // 6. Verificar servicios externos
      await this.checkExternalServices();
      
      // 7. Verificar configuración del sistema
      await this.checkSystemConfiguration();
      
      // 8. Generar reporte final
      return this.generateHealthReport();
      
    } catch (error) {
      logError(`Error crítico en health check: ${error.message}`);
      console.error(error.stack);
      return 1;
    }
  }

  async checkCriticalFiles() {
    logHeader('Verificando Archivos Críticos');
    
    for (const file of HEALTH_CONFIG.criticalFiles) {
      const filePath = path.resolve(rootDir, file);
      
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeKB = (stats.size / 1024).toFixed(1);
        
        logSuccess(`${file} (${sizeKB}KB)`);
        
        this.results.files.push({
          file,
          exists: true,
          size: stats.size,
          lastModified: stats.mtime,
          status: 'healthy'
        });
        
        this.results.overall.healthy++;
      } else {
        logError(`Missing: ${file}`);
        
        this.results.files.push({
          file,
          exists: false,
          status: 'missing'
        });
        
        this.results.overall.unhealthy++;
        this.addIssue('error', `Critical file missing: ${file}`, `Create ${file}`);
      }
    }
  }

  async checkEnvironmentVariables() {
    logHeader('Verificando Variables de Entorno');
    
    // Cargar .env si existe
    const envPath = path.resolve(rootDir, '.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      logInfo('Found .env file');
      
      // Parse basic env vars (simplified)
      envContent.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value && !process.env[key]) {
          process.env[key] = value;
        }
      });
    }
    
    for (const envVar of HEALTH_CONFIG.requiredEnvVars) {
      const value = process.env[envVar];
      
      if (value) {
        // Mostrar valor truncado por seguridad
        const displayValue = value.length > 20 ? 
          `${value.substring(0, 8)}...${value.substring(value.length - 4)}` : 
          value;
          
        logSuccess(`${envVar}: ${displayValue}`);
        
        this.results.environment.push({
          variable: envVar,
          configured: true,
          hasValue: true,
          status: 'healthy'
        });
        
        this.results.overall.healthy++;
      } else {
        logWarning(`${envVar}: Not configured`);
        
        this.results.environment.push({
          variable: envVar,
          configured: false,
          hasValue: false,
          status: 'warning'
        });
        
        this.results.overall.warnings++;
        this.addRecommendation(`Configure ${envVar} environment variable`);
      }
    }
  }

  async checkRunningProcesses() {
    logHeader('Verificando Procesos en Ejecución');
    
    const psResult = executeCommand('ps aux');
    
    if (!psResult.success) {
      logWarning('Cannot check running processes (ps command failed)');
      return;
    }
    
    const processes = psResult.output.split('\n');
    
    for (const requiredProcess of HEALTH_CONFIG.requiredProcesses) {
      const isRunning = processes.some(proc => 
        proc.includes(requiredProcess.name) && 
        proc.includes(requiredProcess.pattern)
      );
      
      if (isRunning) {
        logSuccess(`${requiredProcess.name} (${requiredProcess.pattern}): Running`);
        
        this.results.processes.push({
          name: requiredProcess.name,
          pattern: requiredProcess.pattern,
          running: true,
          status: 'healthy'
        });
        
        this.results.overall.healthy++;
      } else {
        logWarning(`${requiredProcess.name} (${requiredProcess.pattern}): Not running`);
        
        this.results.processes.push({
          name: requiredProcess.name,
          pattern: requiredProcess.pattern,
          running: false,
          status: 'warning'
        });
        
        this.results.overall.warnings++;
        this.addRecommendation(`Start ${requiredProcess.name} service`);
      }
    }
  }

  async checkLocalServices() {
    logHeader('Verificando Servicios Locales');
    
    for (const service of HEALTH_CONFIG.localServices) {
      logInfo(`Testing ${service.name} at ${service.host}:${service.port}...`);
      
      // Primero verificar si el puerto está abierto
      const portOpen = await checkPortOpen(service.host, service.port, 3000);
      
      if (!portOpen) {
        logError(`${service.name}: Port ${service.port} not accessible`);
        
        this.results.services.local.push({
          name: service.name,
          host: service.host,
          port: service.port,
          accessible: false,
          status: 'unhealthy',
          error: 'Port not accessible'
        });
        
        this.results.overall.unhealthy++;
        this.addIssue('error', `${service.name} not accessible on port ${service.port}`, `Start ${service.name} service`);
        continue;
      }
      
      // Verificar endpoint de salud
      const url = `http://${service.host}:${service.port}${service.healthPath}`;
      const startTime = Date.now();
      
      const response = await makeHttpRequest(url, { 
        timeout: service.timeout,
        startTime 
      });
      
      if (response.success && response.status === service.expectedStatus) {
        logSuccess(`${service.name}: Healthy (${response.status}) - ${response.responseTime}ms`);
        
        this.results.services.local.push({
          name: service.name,
          host: service.host,
          port: service.port,
          accessible: true,
          status: 'healthy',
          responseTime: response.responseTime,
          httpStatus: response.status
        });
        
        this.results.overall.healthy++;
      } else {
        logError(`${service.name}: Unhealthy (${response.status || 'timeout'}) - ${response.responseTime}ms`);
        
        this.results.services.local.push({
          name: service.name,
          host: service.host,
          port: service.port,
          accessible: portOpen,
          status: 'unhealthy',
          responseTime: response.responseTime,
          httpStatus: response.status,
          error: response.error || `HTTP ${response.status}`
        });
        
        this.results.overall.unhealthy++;
        this.addIssue('error', `${service.name} health check failed`, `Check ${service.name} logs and configuration`);
      }
    }
  }

  async checkDatabases() {
    logHeader('Verificando Bases de Datos');
    
    for (const db of HEALTH_CONFIG.databases) {
      logInfo(`Testing ${db.name} at ${db.host}:${db.port}...`);
      
      const isAccessible = await checkPortOpen(db.host, db.port, 5000);
      
      if (isAccessible) {
        logSuccess(`${db.name}: Port ${db.port} accessible`);
        
        this.results.databases.push({
          name: db.name,
          host: db.host,
          port: db.port,
          accessible: true,
          status: 'healthy'
        });
        
        this.results.overall.healthy++;
      } else {
        logWarning(`${db.name}: Port ${db.port} not accessible (service may not be running)`);
        
        this.results.databases.push({
          name: db.name,
          host: db.host,
          port: db.port,
          accessible: false,
          status: 'warning'
        });
        
        this.results.overall.warnings++;
        this.addRecommendation(`Start ${db.name} service if needed`);
      }
    }
  }

  async checkExternalServices() {
    logHeader('Verificando Servicios Externos');
    
    for (const service of HEALTH_CONFIG.externalServices) {
      logInfo(`Testing ${service.name}...`);
      
      const startTime = Date.now();
      
      // Usar método específico si existe
      if (service.testMethod && this[service.testMethod]) {
        const result = await this[service.testMethod](service);
        
        this.results.services.external.push({
          name: service.name,
          url: service.url,
          ...result
        });
        
        if (result.status === 'healthy') {
          this.results.overall.healthy++;
        } else if (result.status === 'warning') {
          this.results.overall.warnings++;
        } else {
          this.results.overall.unhealthy++;
        }
      } else {
        // Test HTTP básico
        const response = await makeHttpRequest(service.url, { 
          timeout: service.timeout,
          startTime 
        });
        
        if (response.success && response.status >= 200 && response.status < 300) {
          logSuccess(`${service.name}: Available (${response.status}) - ${response.responseTime}ms`);
          
          this.results.services.external.push({
            name: service.name,
            url: service.url,
            status: 'healthy',
            responseTime: response.responseTime,
            httpStatus: response.status
          });
          
          this.results.overall.healthy++;
        } else {
          logError(`${service.name}: Not available (${response.status || 'timeout'})`);
          
          this.results.services.external.push({
            name: service.name,
            url: service.url,
            status: 'unhealthy',
            responseTime: response.responseTime,
            httpStatus: response.status,
            error: response.error
          });
          
          this.results.overall.unhealthy++;
          this.addIssue('warning', `${service.name} not available`, 'Check internet connectivity');
        }
      }
    }
  }

  async testGoogleSheetsAPI(service) {
    const response = await makeHttpRequest(`${service.url}/test`, {
      timeout: service.timeout,
      headers: {
        'Authorization': `Bearer ${process.env.GOOGLE_SERVICE_ACCOUNT_KEY || 'dummy'}`
      }
    });
    
    if (response.success && [200, 401, 403].includes(response.status)) {
      // 401/403 significa que la API responde, solo falta auth
      logSuccess(`${service.name}: API responding (${response.status})`);
      return {
        status: response.status === 200 ? 'healthy' : 'warning',
        responseTime: response.responseTime,
        httpStatus: response.status,
        note: response.status !== 200 ? 'Authentication required' : 'OK'
      };
    } else {
      logError(`${service.name}: API not responding (${response.status || 'timeout'})`);
      return {
        status: 'unhealthy',
        responseTime: response.responseTime,
        httpStatus: response.status,
        error: response.error
      };
    }
  }

  async testPythNetwork(service) {
    const response = await makeHttpRequest(service.url, { timeout: service.timeout });
    
    if (response.success && response.status === 200) {
      try {
        const data = JSON.parse(response.data);
        
        if (Array.isArray(data) && data.length > 0) {
          logSuccess(`${service.name}: Available with ${data.length} price feeds - ${response.responseTime}ms`);
          return {
            status: 'healthy',
            responseTime: response.responseTime,
            httpStatus: response.status,
            priceFeeds: data.length
          };
        } else {
          logWarning(`${service.name}: Available but no price feeds`);
          return {
            status: 'warning',
            responseTime: response.responseTime,
            httpStatus: response.status,
            note: 'No price feeds available'
          };
        }
      } catch (error) {
        logError(`${service.name}: Invalid response format`);
        return {
          status: 'unhealthy',
          responseTime: response.responseTime,
          httpStatus: response.status,
          error: 'Invalid JSON response'
        };
      }
    } else {
      logError(`${service.name}: Not available (${response.status || 'timeout'})`);
      return {
        status: 'unhealthy',
        responseTime: response.responseTime,
        httpStatus: response.status,
        error: response.error
      };
    }
  }

  async testDefiLlama(service) {
    const response = await makeHttpRequest(service.url, { timeout: service.timeout });
    
    if (response.success && response.status === 200) {
      try {
        const data = JSON.parse(response.data);
        
        if (Array.isArray(data) && data.length > 0) {
          logSuccess(`${service.name}: Available with ${data.length} protocols - ${response.responseTime}ms`);
          return {
            status: 'healthy',
            responseTime: response.responseTime,
            httpStatus: response.status,
            protocols: data.length
          };
        }
      } catch (error) {
        // Fallback to basic check
      }
    }
    
    logError(`${service.name}: Not available (${response.status || 'timeout'})`);
    return {
      status: 'unhealthy',
      responseTime: response.responseTime,
      httpStatus: response.status,
      error: response.error
    };
  }

  async testEthereumRPC(service) {
    const rpcPayload = {
      jsonrpc: '2.0',
      method: 'eth_blockNumber',
      params: [],
      id: 1
    };
    
    const response = await makeHttpRequest(service.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rpcPayload),
      timeout: service.timeout
    });
    
    if (response.success && response.status === 200) {
      try {
        const data = JSON.parse(response.data);
        
        if (data.result) {
          const blockNumber = parseInt(data.result, 16);
          logSuccess(`${service.name}: Connected (Block: ${blockNumber}) - ${response.responseTime}ms`);
          return {
            status: 'healthy',
            responseTime: response.responseTime,
            httpStatus: response.status,
            currentBlock: blockNumber
          };
        }
      } catch (error) {
        // Invalid response
      }
    }
    
    logError(`${service.name}: RPC not available (${response.status || 'timeout'})`);
    return {
      status: 'unhealthy',
      responseTime: response.responseTime,
      httpStatus: response.status,
      error: response.error
    };
  }

  async checkSystemConfiguration() {
    logHeader('Verificando Configuración del Sistema');
    
    // Check Node.js version
    const nodeResult = executeCommand('node --version');
    if (nodeResult.success) {
      logSuccess(`Node.js: ${nodeResult.output}`);
      this.results.overall.healthy++;
    } else {
      logError('Node.js: Not available');
      this.results.overall.unhealthy++;
    }
    
    // Check pnpm version
    const pnpmResult = executeCommand('pnpm --version');
    if (pnpmResult.success) {
      logSuccess(`pnpm: ${pnpmResult.output}`);
      this.results.overall.healthy++;
    } else {
      logWarning('pnpm: Not available');
      this.results.overall.warnings++;
    }
    
    // Check Rust version
    const rustResult = executeCommand('rustc --version');
    if (rustResult.success) {
      logSuccess(`Rust: ${rustResult.output}`);
      this.results.overall.healthy++;
    } else {
      logWarning('Rust: Not available');
      this.results.overall.warnings++;
    }
    
    // Check Python version
    const pythonResult = executeCommand('python3 --version');
    if (pythonResult.success) {
      logSuccess(`Python: ${pythonResult.output}`);
      this.results.overall.healthy++;
    } else {
      logWarning('Python3: Not available');
      this.results.overall.warnings++;
    }
  }

  addIssue(type, message, fix) {
    this.results.issues.push({ type, message, fix });
  }

  addRecommendation(message) {
    this.results.recommendations.push(message);
  }

  generateHealthReport() {
    const totalTime = Date.now() - this.startTime;
    
    logHeader('REPORTE FINAL DE HEALTH CHECK');
    
    // Estadísticas generales
    console.log();
    log('📊 ESTADÍSTICAS GENERALES:', 'bright');
    log(`   ✅ Healthy: ${this.results.overall.healthy}`, 'green');
    log(`   ❌ Unhealthy: ${this.results.overall.unhealthy}`, this.results.overall.unhealthy > 0 ? 'red' : 'green');
    log(`   ⚠️  Warnings: ${this.results.overall.warnings}`, this.results.overall.warnings > 0 ? 'yellow' : 'green');
    log(`   ⏱️  Total time: ${totalTime}ms`, 'cyan');
    
    const totalChecks = this.results.overall.healthy + this.results.overall.unhealthy + this.results.overall.warnings;
    const healthPercentage = totalChecks > 0 ? ((this.results.overall.healthy / totalChecks) * 100).toFixed(1) : 0;
    
    log(`   📈 Health Score: ${healthPercentage}%`, healthPercentage >= 90 ? 'green' : healthPercentage >= 70 ? 'yellow' : 'red');
    
    // Breakdown por categoría
    console.log();
    log('📋 BREAKDOWN POR CATEGORÍA:', 'bright');
    log(`   📁 Files: ${this.results.files.filter(f => f.status === 'healthy').length}/${this.results.files.length}`, 'cyan');
    log(`   🌐 Local Services: ${this.results.services.local.filter(s => s.status === 'healthy').length}/${this.results.services.local.length}`, 'cyan');
    log(`   🔗 External Services: ${this.results.services.external.filter(s => s.status === 'healthy').length}/${this.results.services.external.length}`, 'cyan');
    log(`   🗄️  Databases: ${this.results.databases.filter(d => d.status === 'healthy').length}/${this.results.databases.length}`, 'cyan');
    log(`   ⚙️  Environment: ${this.results.environment.filter(e => e.status === 'healthy').length}/${this.results.environment.length}`, 'cyan');
    
    // Mostrar issues críticos
    const criticalIssues = this.results.issues.filter(i => i.type === 'error');
    
    if (criticalIssues.length > 0) {
      console.log();
      log(`🔴 ISSUES CRÍTICOS (${criticalIssues.length}):`, 'red');
      
      criticalIssues.forEach((issue, index) => {
        log(`   ${index + 1}. ${issue.message}`, 'red');
        log(`      💡 Fix: ${issue.fix}`, 'dim');
      });
    }
    
    // Mostrar recomendaciones
    if (this.results.recommendations.length > 0) {
      console.log();
      log(`💡 RECOMENDACIONES (${this.results.recommendations.length}):`, 'yellow');
      
      this.results.recommendations.slice(0, 10).forEach((rec, index) => {
        log(`   ${index + 1}. ${rec}`, 'yellow');
      });
    }
    
    // Services performance summary
    const healthyLocalServices = this.results.services.local.filter(s => s.status === 'healthy');
    
    if (healthyLocalServices.length > 0) {
      console.log();
      log('⚡ PERFORMANCE DE SERVICIOS:', 'bright');
      
      healthyLocalServices.forEach(service => {
        const perfColor = service.responseTime < 100 ? 'green' : 
                         service.responseTime < 500 ? 'yellow' : 'red';
        log(`   ${service.name}: ${service.responseTime}ms`, perfColor);
      });
    }
    
    // Próximos pasos
    console.log();
    log('📋 PRÓXIMOS PASOS:', 'bright');
    
    if (this.results.overall.unhealthy === 0) {
      log('   🚀 Sistema healthy - Ready para desarrollo/deployment', 'green');
      
      if (this.results.overall.warnings > 0) {
        log(`   📝 Considera resolver ${this.results.overall.warnings} warnings para optimizar`, 'yellow');
      }
    } else {
      log(`   🔧 Resolver ${this.results.overall.unhealthy} issues críticos`, 'red');
      log('   🔄 Re-ejecutar health check después de los fixes', 'yellow');
      
      if (criticalIssues.length > 0) {
        log('   📖 Consultar logs de servicios para más detalles', 'cyan');
      }
    }
    
    // Comandos útiles
    console.log();
    log('🛠️  COMANDOS ÚTILES:', 'bright');
    log('   pnpm dev                    # Start all services', 'dim');
    log('   pnpm health-check          # Re-run this check', 'dim');
    log('   docker-compose up          # Start databases', 'dim');
    log('   fly logs                   # View production logs', 'dim');
    
    // Resultado final
    console.log();
    
    if (this.results.overall.unhealthy === 0) {
      logSuccess('✅ LOCAL HEALTH CHECK PASSED');
      return 0;
    } else {
      logError('❌ LOCAL HEALTH CHECK FAILED');
      return 1;
    }
  }
}

// ==================================================================================
// EJECUCIÓN
// ==================================================================================

async function main() {
  try {
    const checker = new LocalHealthChecker();
    const exitCode = await checker.runCompleteHealthCheck();
    process.exit(exitCode);
  } catch (error) {
    logError(`Error crítico en health check: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { LocalHealthChecker };