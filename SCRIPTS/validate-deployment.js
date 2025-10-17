#!/usr/bin/env node

/**
 * ARBITRAGEXPLUS2025 - Deployment Validator
 * 
 * Este script valida que el deployment esté listo y que todos los componentes
 * del sistema funcionen correctamente. Realiza verificaciones pre-deployment
 * y post-deployment para asegurar un deployment exitoso.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ==================================================================================
// CONFIGURACIÓN DE VALIDACIÓN
// ==================================================================================

const DEPLOYMENT_CONFIG = {
  // Checks pre-deployment
  preDeployment: {
    requiredFiles: [
      'package.json',
      'fly.toml',
      'Dockerfile',
      '.env.example'
    ],
    
    requiredScripts: [
      'build',
      'start',
      'dev'
    ],
    
    requiredServices: [
      'api-server',
      'python-collector',
      'engine-rust',
      'ts-executor'
    ],
    
    environmentChecks: [
      'NODE_VERSION',
      'PNPM_VERSION', 
      'RUST_VERSION',
      'PYTHON_VERSION'
    ]
  },
  
  // Checks post-deployment
  postDeployment: {
    healthEndpoints: [
      '/health',
      '/api/v1/health',
      '/metrics'
    ],
    
    expectedResponseTime: 5000, // ms
    maxRetries: 5,
    retryDelay: 3000 // ms
  },
  
  // Servicios críticos que deben estar funcionando
  criticalServices: [
    {
      name: 'API Server',
      port: 3000,
      healthPath: '/health',
      expectedStatus: 200
    },
    {
      name: 'Python Collector',
      port: 8001, 
      healthPath: '/health',
      expectedStatus: 200
    },
    {
      name: 'Rust Engine',
      port: 8002,
      healthPath: '/health', 
      expectedStatus: 200
    },
    {
      name: 'TS Executor',
      port: 8003,
      healthPath: '/health',
      expectedStatus: 200
    }
  ],
  
  // Integraciones externas críticas
  externalServices: [
    {
      name: 'Google Sheets API',
      testMethod: 'testGoogleSheets'
    },
    {
      name: 'Pyth Network',
      testMethod: 'testPythOracle'
    },
    {
      name: 'Ethereum RPC',
      testMethod: 'testEthereumRPC'
    }
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

async function makeRequest(url, options = {}) {
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
      headers: response.headers,
      data: await response.text(),
      error: null
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    return {
      success: false,
      status: 0,
      headers: null,
      data: null,
      error: error.message
    };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==================================================================================
// VALIDADOR PRINCIPAL
// ==================================================================================

class DeploymentValidator {
  constructor() {
    this.results = {
      preDeployment: {
        passed: 0,
        failed: 0,
        warnings: 0,
        issues: []
      },
      postDeployment: {
        passed: 0,
        failed: 0,
        warnings: 0,
        issues: []
      },
      services: {
        healthy: 0,
        unhealthy: 0,
        issues: []
      },
      external: {
        working: 0,
        failing: 0,
        issues: []
      }
    };
  }

  async validatePreDeployment() {
    logHeader('PRE-DEPLOYMENT VALIDATION');
    
    // 1. Validar archivos requeridos
    await this.validateRequiredFiles();
    
    // 2. Validar herramientas de desarrollo
    await this.validateDevelopmentTools();
    
    // 3. Validar build process
    await this.validateBuildProcess();
    
    // 4. Validar configuración
    await this.validateConfiguration();
    
    // 5. Validar estructura de servicios
    await this.validateServicesStructure();
    
    return this.results.preDeployment;
  }

  async validatePostDeployment(baseUrl = 'http://localhost:3000') {
    logHeader('POST-DEPLOYMENT VALIDATION');
    
    logInfo(`Validating deployment at: ${baseUrl}`);
    
    // 1. Validar servicios principales
    await this.validateCriticalServices(baseUrl);
    
    // 2. Validar endpoints de salud
    await this.validateHealthEndpoints(baseUrl);
    
    // 3. Validar integraciones externas
    await this.validateExternalServices();
    
    // 4. Validar performance
    await this.validatePerformance(baseUrl);
    
    return this.results.postDeployment;
  }

  async validateRequiredFiles() {
    logInfo('Validando archivos requeridos...');
    
    for (const file of DEPLOYMENT_CONFIG.preDeployment.requiredFiles) {
      const filePath = path.resolve(rootDir, file);
      
      if (fs.existsSync(filePath)) {
        logSuccess(`Found: ${file}`);
        this.results.preDeployment.passed++;
      } else {
        logError(`Missing: ${file}`);
        this.addPreDeploymentIssue('error', `Missing required file: ${file}`, `Create ${file}`);
      }
    }
  }

  async validateDevelopmentTools() {
    logInfo('Validando herramientas de desarrollo...');
    
    const tools = [
      { name: 'Node.js', command: 'node --version', pattern: /v\d+\.\d+\.\d+/ },
      { name: 'pnpm', command: 'pnpm --version', pattern: /\d+\.\d+\.\d+/ },
      { name: 'Rust', command: 'rustc --version', pattern: /rustc \d+\.\d+\.\d+/ },
      { name: 'Python', command: 'python3 --version', pattern: /Python \d+\.\d+\.\d+/ },
      { name: 'Docker', command: 'docker --version', pattern: /Docker version/ },
      { name: 'Fly CLI', command: 'fly version', pattern: /flyctl v/ }
    ];
    
    for (const tool of tools) {
      const result = executeCommand(tool.command);
      
      if (result.success && tool.pattern.test(result.output)) {
        logSuccess(`${tool.name}: ${result.output.split('\n')[0]}`);
        this.results.preDeployment.passed++;
      } else {
        const message = `${tool.name} not available or incorrect version`;
        logWarning(message);
        this.addPreDeploymentIssue('warning', message, `Install or update ${tool.name}`);
      }
    }
  }

  async validateBuildProcess() {
    logInfo('Validando build process...');
    
    // Verificar package.json scripts
    const packageJsonPath = path.resolve(rootDir, 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        for (const script of DEPLOYMENT_CONFIG.preDeployment.requiredScripts) {
          if (packageJson.scripts && packageJson.scripts[script]) {
            logSuccess(`Script found: ${script}`);
            this.results.preDeployment.passed++;
          } else {
            logError(`Missing script: ${script}`);
            this.addPreDeploymentIssue('error', `Missing package.json script: ${script}`, `Add "${script}" script to package.json`);
          }
        }
        
        // Test build process
        logInfo('Testing build process...');
        const buildResult = executeCommand('pnpm build', { timeout: 60000 });
        
        if (buildResult.success) {
          logSuccess('Build process completed successfully');
          this.results.preDeployment.passed++;
        } else {
          logError('Build process failed');
          this.addPreDeploymentIssue('error', 'Build process failed', `Fix build errors: ${buildResult.error}`);
        }
        
      } catch (error) {
        logError('Invalid package.json');
        this.addPreDeploymentIssue('error', 'Invalid package.json', 'Fix package.json syntax');
      }
    }
  }

  async validateConfiguration() {
    logInfo('Validando configuración...');
    
    // Verificar .env.example
    const envExamplePath = path.resolve(rootDir, '.env.example');
    
    if (fs.existsSync(envExamplePath)) {
      const envContent = fs.readFileSync(envExamplePath, 'utf8');
      
      const requiredEnvVars = [
        'GITHUB_TOKEN',
        'SPREADSHEET_ID',
        'ETHEREUM_RPC_URL',
        'PRIVATE_KEY'
      ];
      
      let foundVars = 0;
      
      for (const envVar of requiredEnvVars) {
        if (envContent.includes(`${envVar}=`)) {
          foundVars++;
        } else {
          logWarning(`Missing environment variable template: ${envVar}`);
          this.addPreDeploymentIssue('warning', `Missing env var: ${envVar}`, `Add ${envVar} to .env.example`);
        }
      }
      
      if (foundVars === requiredEnvVars.length) {
        logSuccess('All required environment variables templated');
        this.results.preDeployment.passed++;
      }
    }
    
    // Verificar fly.toml
    const flyTomlPath = path.resolve(rootDir, 'fly.toml');
    
    if (fs.existsSync(flyTomlPath)) {
      const flyContent = fs.readFileSync(flyTomlPath, 'utf8');
      
      if (flyContent.includes('app = "arbitragexplus2025"')) {
        logSuccess('Fly.io app name configured correctly');
        this.results.preDeployment.passed++;
      } else {
        logWarning('Fly.io app name not found or incorrect');
        this.addPreDeploymentIssue('warning', 'Fly.io app name not configured', 'Set app name in fly.toml');
      }
    }
  }

  async validateServicesStructure() {
    logInfo('Validando estructura de servicios...');
    
    for (const service of DEPLOYMENT_CONFIG.preDeployment.requiredServices) {
      const servicePath = path.resolve(rootDir, 'services', service);
      
      if (fs.existsSync(servicePath)) {
        logSuccess(`Service directory found: ${service}`);
        
        // Verificar package.json del servicio (para TS services)
        const servicePackageJson = path.resolve(servicePath, 'package.json');
        
        if (fs.existsSync(servicePackageJson)) {
          logSuccess(`${service}: package.json found`);
          this.results.preDeployment.passed++;
        } else if (service === 'engine-rust') {
          // Para Rust, verificar Cargo.toml
          const cargoToml = path.resolve(servicePath, 'Cargo.toml');
          
          if (fs.existsSync(cargoToml)) {
            logSuccess(`${service}: Cargo.toml found`);
            this.results.preDeployment.passed++;
          } else {
            logError(`${service}: No Cargo.toml found`);
            this.addPreDeploymentIssue('error', `Missing Cargo.toml for ${service}`, `Create Cargo.toml in ${service}`);
          }
        } else if (service === 'python-collector') {
          // Para Python, verificar requirements.txt
          const requirementsTxt = path.resolve(servicePath, 'requirements.txt');
          
          if (fs.existsSync(requirementsTxt)) {
            logSuccess(`${service}: requirements.txt found`);
            this.results.preDeployment.passed++;
          } else {
            logError(`${service}: No requirements.txt found`);
            this.addPreDeploymentIssue('error', `Missing requirements.txt for ${service}`, `Create requirements.txt in ${service}`);
          }
        }
      } else {
        logError(`Service directory missing: ${service}`);
        this.addPreDeploymentIssue('error', `Missing service directory: ${service}`, `Create services/${service} directory`);
      }
    }
  }

  async validateCriticalServices(baseUrl) {
    logInfo('Validando servicios críticos...');
    
    for (const service of DEPLOYMENT_CONFIG.criticalServices) {
      const url = `${baseUrl.replace(':3000', `:${service.port}`)}${service.healthPath}`;
      
      logInfo(`Testing ${service.name} at ${url}...`);
      
      let retries = 0;
      let success = false;
      
      while (retries < DEPLOYMENT_CONFIG.postDeployment.maxRetries && !success) {
        const response = await makeRequest(url, {
          timeout: DEPLOYMENT_CONFIG.postDeployment.expectedResponseTime
        });
        
        if (response.success && response.status === service.expectedStatus) {
          logSuccess(`${service.name}: Healthy (${response.status})`);
          this.results.services.healthy++;
          success = true;
        } else {
          retries++;
          
          if (retries < DEPLOYMENT_CONFIG.postDeployment.maxRetries) {
            logWarning(`${service.name}: Retry ${retries}/${DEPLOYMENT_CONFIG.postDeployment.maxRetries}`);
            await sleep(DEPLOYMENT_CONFIG.postDeployment.retryDelay);
          } else {
            logError(`${service.name}: Unhealthy after ${retries} retries`);
            this.addServiceIssue('error', `${service.name} not responding`, `Check ${service.name} logs and configuration`);
          }
        }
      }
    }
  }

  async validateHealthEndpoints(baseUrl) {
    logInfo('Validando endpoints de salud...');
    
    for (const endpoint of DEPLOYMENT_CONFIG.postDeployment.healthEndpoints) {
      const url = `${baseUrl}${endpoint}`;
      const response = await makeRequest(url);
      
      if (response.success && response.status >= 200 && response.status < 300) {
        logSuccess(`Health endpoint OK: ${endpoint} (${response.status})`);
        this.results.postDeployment.passed++;
      } else {
        logError(`Health endpoint failed: ${endpoint} (${response.status || 'timeout'})`);
        this.addPostDeploymentIssue('error', `Health endpoint failed: ${endpoint}`, `Fix health endpoint implementation`);
      }
    }
  }

  async validateExternalServices() {
    logInfo('Validando servicios externos...');
    
    // Test Google Sheets API (mock test)
    await this.testGoogleSheets();
    
    // Test Pyth Network
    await this.testPythOracle();
    
    // Test Ethereum RPC
    await this.testEthereumRPC();
  }

  async testGoogleSheets() {
    logInfo('Testing Google Sheets API connectivity...');
    
    // Verificar que las credenciales estén configuradas
    if (process.env.SPREADSHEET_ID) {
      logSuccess('Google Sheets: SPREADSHEET_ID configured');
      this.results.external.working++;
    } else {
      logWarning('Google Sheets: SPREADSHEET_ID not configured');
      this.addExternalIssue('warning', 'Google Sheets SPREADSHEET_ID not set', 'Configure SPREADSHEET_ID environment variable');
    }
  }

  async testPythOracle() {
    logInfo('Testing Pyth Network connectivity...');
    
    try {
      const response = await makeRequest('https://hermes.pyth.network/api/latest_price_feeds?ids[]=0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace');
      
      if (response.success) {
        logSuccess('Pyth Network: API accessible');
        this.results.external.working++;
      } else {
        logError('Pyth Network: API not accessible');
        this.addExternalIssue('error', 'Pyth Network API not accessible', 'Check internet connectivity and Pyth API status');
      }
    } catch (error) {
      logError(`Pyth Network: ${error.message}`);
      this.addExternalIssue('error', `Pyth Network error: ${error.message}`, 'Check Pyth Network connectivity');
    }
  }

  async testEthereumRPC() {
    logInfo('Testing Ethereum RPC connectivity...');
    
    if (process.env.ETHEREUM_RPC_URL) {
      try {
        const response = await makeRequest(process.env.ETHEREUM_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          })
        });
        
        if (response.success) {
          const data = JSON.parse(response.data);
          
          if (data.result) {
            logSuccess(`Ethereum RPC: Connected (Block: ${parseInt(data.result, 16)})`);
            this.results.external.working++;
          } else {
            logError('Ethereum RPC: Invalid response');
            this.addExternalIssue('error', 'Ethereum RPC invalid response', 'Check RPC URL and authentication');
          }
        } else {
          logError('Ethereum RPC: Connection failed');
          this.addExternalIssue('error', 'Ethereum RPC connection failed', 'Check ETHEREUM_RPC_URL configuration');
        }
      } catch (error) {
        logError(`Ethereum RPC: ${error.message}`);
        this.addExternalIssue('error', `Ethereum RPC error: ${error.message}`, 'Check Ethereum RPC configuration');
      }
    } else {
      logWarning('Ethereum RPC: ETHEREUM_RPC_URL not configured');
      this.addExternalIssue('warning', 'Ethereum RPC URL not configured', 'Set ETHEREUM_RPC_URL environment variable');
    }
  }

  async validatePerformance(baseUrl) {
    logInfo('Validando performance...');
    
    const performanceTests = [
      { name: 'Health Check', path: '/health' },
      { name: 'API Status', path: '/api/v1/health' }
    ];
    
    for (const test of performanceTests) {
      const startTime = Date.now();
      const response = await makeRequest(`${baseUrl}${test.path}`);
      const responseTime = Date.now() - startTime;
      
      if (response.success) {
        if (responseTime < 1000) {
          logSuccess(`${test.name}: ${responseTime}ms (excellent)`);
          this.results.postDeployment.passed++;
        } else if (responseTime < 3000) {
          logWarning(`${test.name}: ${responseTime}ms (acceptable)`);
          this.results.postDeployment.warnings++;
        } else {
          logError(`${test.name}: ${responseTime}ms (too slow)`);
          this.addPostDeploymentIssue('warning', `${test.name} response time too slow: ${responseTime}ms`, 'Optimize application performance');
        }
      }
    }
  }

  // Helper methods para agregar issues
  addPreDeploymentIssue(type, message, fix) {
    this.results.preDeployment.issues.push({ type, message, fix });
    
    if (type === 'error') {
      this.results.preDeployment.failed++;
    } else if (type === 'warning') {
      this.results.preDeployment.warnings++;
    }
  }

  addPostDeploymentIssue(type, message, fix) {
    this.results.postDeployment.issues.push({ type, message, fix });
    
    if (type === 'error') {
      this.results.postDeployment.failed++;
    } else if (type === 'warning') {
      this.results.postDeployment.warnings++;
    }
  }

  addServiceIssue(type, message, fix) {
    this.results.services.issues.push({ type, message, fix });
    
    if (type === 'error') {
      this.results.services.unhealthy++;
    }
  }

  addExternalIssue(type, message, fix) {
    this.results.external.issues.push({ type, message, fix });
    
    if (type === 'error') {
      this.results.external.failing++;
    }
  }

  generateReport() {
    logHeader('REPORTE FINAL DE VALIDACIÓN DE DEPLOYMENT');
    
    // Pre-deployment summary
    console.log();
    log('📋 PRE-DEPLOYMENT:', 'bright');
    log(`   Passed: ${this.results.preDeployment.passed}`, 'green');
    log(`   Failed: ${this.results.preDeployment.failed}`, this.results.preDeployment.failed > 0 ? 'red' : 'green');
    log(`   Warnings: ${this.results.preDeployment.warnings}`, this.results.preDeployment.warnings > 0 ? 'yellow' : 'green');
    
    // Post-deployment summary
    log('\n🚀 POST-DEPLOYMENT:', 'bright');
    log(`   Passed: ${this.results.postDeployment.passed}`, 'green');
    log(`   Failed: ${this.results.postDeployment.failed}`, this.results.postDeployment.failed > 0 ? 'red' : 'green');
    log(`   Warnings: ${this.results.postDeployment.warnings}`, this.results.postDeployment.warnings > 0 ? 'yellow' : 'green');
    
    // Services summary
    log('\n🏥 SERVICES:', 'bright');
    log(`   Healthy: ${this.results.services.healthy}`, 'green');
    log(`   Unhealthy: ${this.results.services.unhealthy}`, this.results.services.unhealthy > 0 ? 'red' : 'green');
    
    // External services summary
    log('\n🌐 EXTERNAL SERVICES:', 'bright');
    log(`   Working: ${this.results.external.working}`, 'green');
    log(`   Failing: ${this.results.external.failing}`, this.results.external.failing > 0 ? 'red' : 'green');
    
    // Show critical issues
    const allIssues = [
      ...this.results.preDeployment.issues,
      ...this.results.postDeployment.issues,
      ...this.results.services.issues,
      ...this.results.external.issues
    ];
    
    const criticalIssues = allIssues.filter(issue => issue.type === 'error');
    
    if (criticalIssues.length > 0) {
      console.log();
      log(`🔴 CRITICAL ISSUES (${criticalIssues.length}):`, 'red');
      
      criticalIssues.forEach((issue, index) => {
        log(`   ${index + 1}. ${issue.message}`, 'red');
        log(`      💡 Fix: ${issue.fix}`, 'dim');
      });
    }
    
    // Final result
    const totalErrors = this.results.preDeployment.failed + 
                       this.results.postDeployment.failed + 
                       this.results.services.unhealthy + 
                       this.results.external.failing;
    
    console.log();
    
    if (totalErrors === 0) {
      logSuccess('✅ DEPLOYMENT VALIDATION PASSED');
      log('🚀 System is ready for production deployment', 'green');
      return 0;
    } else {
      logError('❌ DEPLOYMENT VALIDATION FAILED');
      log(`🔧 Fix ${totalErrors} critical issues before deployment`, 'red');
      return 1;
    }
  }
}

// ==================================================================================
// EJECUCIÓN
// ==================================================================================

async function main() {
  const validator = new DeploymentValidator();
  
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const mode = args[0] || 'full'; // full, pre, post
    const baseUrl = args[1] || 'http://localhost:3000';
    
    switch (mode) {
      case 'pre':
        await validator.validatePreDeployment();
        break;
        
      case 'post':
        await validator.validatePostDeployment(baseUrl);
        break;
        
      case 'full':
      default:
        await validator.validatePreDeployment();
        await validator.validatePostDeployment(baseUrl);
        break;
    }
    
    const exitCode = validator.generateReport();
    process.exit(exitCode);
    
  } catch (error) {
    logError(`Error crítico en validación de deployment: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DeploymentValidator };