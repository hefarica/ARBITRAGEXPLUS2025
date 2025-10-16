#!/usr/bin/env node

/**
 * ARBITRAGEXPLUS2025 - Dead Paths Scanner
 * 
 * Este script escanea todo el código fuente para detectar rutas muertas,
 * imports incorrectos y referencias a archivos inexistentes. Es crítico para
 * asegurar que el sistema funcione sin errores de dependencias.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// ==================================================================================
// CONFIGURACIÓN DEL SCANNER
// ==================================================================================

const SCAN_CONFIG = {
  // Patrones de archivos a escanear
  includePatterns: [
    '**/*.ts',
    '**/*.js', 
    '**/*.tsx',
    '**/*.jsx',
    '**/*.py',
    '**/*.rs',
    '**/*.sol',
    '**/*.json',
    '**/*.yaml',
    '**/*.yml',
    '**/*.toml',
    '**/*.md'
  ],
  
  // Directorios a excluir del escaneo
  excludePatterns: [
    'node_modules/**',
    'target/**',
    'build/**',
    'dist/**',
    'out/**',
    'cache/**',
    '.git/**',
    '.next/**',
    '.nuxt/**',
    'coverage/**',
    '**/*.log',
    'artifacts/**',
    '__pycache__/**',
    '*.pyc'
  ],
  
  // Extensiones que pueden contener imports/referencias
  codeExtensions: ['.ts', '.js', '.tsx', '.jsx', '.py', '.rs', '.sol'],
  
  // Patrones de import por lenguaje
  importPatterns: {
    javascript: [
      /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    ],
    typescript: [
      /import\s+.*\s+from\s+['"`]([^'"`]+)['"`]/g,
      /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
      /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    ],
    python: [
      /from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import/g,
      /import\s+([a-zA-Z_][a-zA-Z0-9_.]*)/g
    ],
    rust: [
      /use\s+([a-zA-Z_][a-zA-Z0-9_:]*)::/g,
      /mod\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
    ],
    solidity: [
      /import\s+['"`]([^'"`]+)['"`]/g
    ]
  },
  
  // Patrones de referencias de archivos
  fileReferencePatterns: [
    /['"]\.\.[\/\\][^'"]*['"]/g,  // ../relative/path
    /['"]\.[\/\\][^'"]*['"]/g,    // ./relative/path  
    /['"]\/@?[^'"]*['"]/g,        // /absolute/path o @alias/path
    /require\.resolve\(['"`]([^'"`]+)['"`]\)/g,
    /fs\.readFile.*['"`]([^'"`]+)['"`]/g,
    /fs\.writeFile.*['"`]([^'"`]+)['"`]/g,
    /path\.join.*['"`]([^'"`]+)['"`]/g
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

function normalizeImportPath(importPath, currentFileDir) {
  // Normalizar diferentes tipos de imports
  if (importPath.startsWith('./') || importPath.startsWith('../')) {
    return path.resolve(currentFileDir, importPath);
  }
  
  if (importPath.startsWith('/')) {
    return path.resolve(rootDir, importPath.substring(1));
  }
  
  // Alias paths (@/ -> root, etc.)
  if (importPath.startsWith('@/')) {
    return path.resolve(rootDir, importPath.substring(2));
  }
  
  // Node modules (no verificamos estos)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null;
  }
  
  return importPath;
}

function resolveFileExtensions(filePath) {
  // Intentar diferentes extensiones si no tiene extensión
  const extensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.rs', '.sol', '.json', '.yaml', '.yml'];
  
  if (fs.existsSync(filePath)) {
    return filePath;
  }
  
  // Intentar con extensiones
  for (const ext of extensions) {
    const withExt = filePath + ext;
    if (fs.existsSync(withExt)) {
      return withExt;
    }
  }
  
  // Intentar como directorio con index
  const indexFiles = [
    path.join(filePath, 'index.ts'),
    path.join(filePath, 'index.js'),
    path.join(filePath, 'mod.rs'),
    path.join(filePath, '__init__.py')
  ];
  
  for (const indexFile of indexFiles) {
    if (fs.existsSync(indexFile)) {
      return indexFile;
    }
  }
  
  return null;
}

function getLanguageFromExtension(filePath) {
  const ext = path.extname(filePath);
  
  switch (ext) {
    case '.ts':
    case '.tsx':
      return 'typescript';
    case '.js':
    case '.jsx':
      return 'javascript';
    case '.py':
      return 'python';
    case '.rs':
      return 'rust';
    case '.sol':
      return 'solidity';
    default:
      return 'unknown';
  }
}

// ==================================================================================
// SCANNER PRINCIPAL
// ==================================================================================

class DeadPathScanner {
  constructor() {
    this.deadPaths = [];
    this.validPaths = [];
    this.warnings = [];
    this.scannedFiles = 0;
    this.totalImports = 0;
    this.externalDependencies = new Set();
  }

  async scanAllFiles() {
    logHeader('ARBITRAGEXPLUS2025 - Dead Paths Scanner');
    
    // Obtener todos los archivos para escanear
    const files = await this.getFilesToScan();
    
    logInfo(`Escaneando ${files.length} archivos...`);
    
    for (const filePath of files) {
      await this.scanFile(filePath);
    }
    
    return this.generateReport();
  }

  async getFilesToScan() {
    const files = [];
    
    for (const pattern of SCAN_CONFIG.includePatterns) {
      const matches = await glob(pattern, {
        cwd: rootDir,
        ignore: SCAN_CONFIG.excludePatterns,
        absolute: true
      });
      
      files.push(...matches);
    }
    
    // Eliminar duplicados y ordenar
    return [...new Set(files)].sort();
  }

  async scanFile(filePath) {
    try {
      this.scannedFiles++;
      
      const relativePath = path.relative(rootDir, filePath);
      const extension = path.extname(filePath);
      
      // Solo escanear archivos de código
      if (!SCAN_CONFIG.codeExtensions.includes(extension)) {
        return;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      const language = getLanguageFromExtension(filePath);
      
      // Escanear imports según el lenguaje
      await this.scanImports(filePath, content, language);
      
      // Escanear referencias de archivos
      await this.scanFileReferences(filePath, content);
      
    } catch (error) {
      this.warnings.push({
        file: path.relative(rootDir, filePath),
        type: 'scan_error',
        message: `Error scanning file: ${error.message}`,
        severity: 'low'
      });
    }
  }

  async scanImports(filePath, content, language) {
    const patterns = SCAN_CONFIG.importPatterns[language] || [];
    const currentDir = path.dirname(filePath);
    
    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      
      while ((match = pattern.exec(content)) !== null) {
        this.totalImports++;
        
        const importPath = match[1];
        
        // Skip node_modules y packages externos
        if (!importPath.startsWith('.') && !importPath.startsWith('/') && !importPath.startsWith('@/')) {
          this.externalDependencies.add(importPath);
          continue;
        }
        
        const normalizedPath = normalizeImportPath(importPath, currentDir);
        
        if (!normalizedPath) {
          continue;
        }
        
        const resolvedPath = resolveFileExtensions(normalizedPath);
        
        if (!resolvedPath) {
          this.deadPaths.push({
            file: path.relative(rootDir, filePath),
            import: importPath,
            resolvedPath: path.relative(rootDir, normalizedPath),
            type: 'missing_import',
            language: language,
            line: this.getLineNumber(content, match.index),
            severity: 'high'
          });
        } else {
          this.validPaths.push({
            file: path.relative(rootDir, filePath),
            import: importPath,
            resolvedPath: path.relative(rootDir, resolvedPath)
          });
        }
      }
    }
  }

  async scanFileReferences(filePath, content) {
    const currentDir = path.dirname(filePath);
    
    for (const pattern of SCAN_CONFIG.fileReferencePatterns) {
      let match;
      pattern.lastIndex = 0;
      
      while ((match = pattern.exec(content)) !== null) {
        const referencePath = match[1] || match[0].slice(1, -1); // Remove quotes
        
        // Skip URLs y node_modules
        if (referencePath.startsWith('http') || referencePath.includes('node_modules')) {
          continue;
        }
        
        const normalizedPath = normalizeImportPath(referencePath, currentDir);
        
        if (!normalizedPath) {
          continue;
        }
        
        if (!fs.existsSync(normalizedPath)) {
          this.deadPaths.push({
            file: path.relative(rootDir, filePath),
            import: referencePath,
            resolvedPath: path.relative(rootDir, normalizedPath),
            type: 'missing_file_reference',
            line: this.getLineNumber(content, match.index),
            severity: 'medium'
          });
        }
      }
    }
  }

  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  generateReport() {
    logHeader('Reporte de Dead Paths');
    
    const criticalIssues = this.deadPaths.filter(p => p.severity === 'high');
    const mediumIssues = this.deadPaths.filter(p => p.severity === 'medium');
    const lowIssues = this.deadPaths.filter(p => p.severity === 'low');
    
    // Estadísticas generales
    console.log();
    log(`📊 ESTADÍSTICAS GENERALES:`, 'bright');
    log(`   Archivos escaneados: ${this.scannedFiles}`);
    log(`   Imports totales encontrados: ${this.totalImports}`);
    log(`   Imports válidos: ${this.validPaths.length}`, 'green');
    log(`   Rutas muertas encontradas: ${this.deadPaths.length}`, this.deadPaths.length > 0 ? 'red' : 'green');
    log(`   Dependencias externas: ${this.externalDependencies.size}`, 'cyan');
    log(`   Advertencias: ${this.warnings.length}`, this.warnings.length > 0 ? 'yellow' : 'green');
    
    // Breakdown por severidad
    console.log();
    log(`📈 BREAKDOWN POR SEVERIDAD:`, 'bright');
    log(`   🔴 Critical (imports faltantes): ${criticalIssues.length}`, criticalIssues.length > 0 ? 'red' : 'green');
    log(`   🟡 Medium (archivos faltantes): ${mediumIssues.length}`, mediumIssues.length > 0 ? 'yellow' : 'green');
    log(`   🔵 Low (referencias menores): ${lowIssues.length}`, lowIssues.length > 0 ? 'blue' : 'green');
    
    // Mostrar issues críticos
    if (criticalIssues.length > 0) {
      console.log();
      log(`🔴 ISSUES CRÍTICOS (${criticalIssues.length}):`, 'red');
      
      criticalIssues.slice(0, 15).forEach(issue => {
        log(`   ${issue.file}:${issue.line}`, 'dim');
        log(`   ❌ ${issue.import} → ${issue.resolvedPath}`, 'red');
        log(`   📝 ${issue.type} (${issue.language})`, 'dim');
        console.log();
      });
      
      if (criticalIssues.length > 15) {
        log(`   ... y ${criticalIssues.length - 15} issues más`, 'red');
      }
    }
    
    // Mostrar issues medium
    if (mediumIssues.length > 0) {
      console.log();
      log(`🟡 ISSUES MEDIUM (${mediumIssues.length}):`, 'yellow');
      
      mediumIssues.slice(0, 10).forEach(issue => {
        log(`   ${issue.file}:${issue.line}`, 'dim');
        log(`   ⚠️  ${issue.import} → ${issue.resolvedPath}`, 'yellow');
        log(`   📝 ${issue.type}`, 'dim');
        console.log();
      });
      
      if (mediumIssues.length > 10) {
        log(`   ... y ${mediumIssues.length - 10} issues más`, 'yellow');
      }
    }
    
    // Mostrar top dependencias externas
    if (this.externalDependencies.size > 0) {
      console.log();
      log(`📦 TOP DEPENDENCIAS EXTERNAS (${this.externalDependencies.size}):`, 'cyan');
      
      const topDeps = Array.from(this.externalDependencies)
        .sort()
        .slice(0, 20);
        
      topDeps.forEach(dep => {
        log(`   • ${dep}`, 'cyan');
      });
      
      if (this.externalDependencies.size > 20) {
        log(`   ... y ${this.externalDependencies.size - 20} más`, 'cyan');
      }
    }
    
    // Mostrar advertencias
    if (this.warnings.length > 0) {
      console.log();
      log(`⚠️  ADVERTENCIAS (${this.warnings.length}):`, 'yellow');
      
      this.warnings.slice(0, 10).forEach(warning => {
        log(`   ${warning.file}: ${warning.message}`, 'yellow');
      });
    }
    
    // Análisis por tipo de archivo
    this.showAnalysisByFileType();
    
    // Recomendaciones
    this.showRecommendations();
    
    // Resultado final
    console.log();
    const hasDeadPaths = this.deadPaths.length > 0;
    const successRate = ((this.validPaths.length / this.totalImports) * 100).toFixed(1);
    
    if (hasDeadPaths) {
      logError(`❌ SCAN FAILED - ${this.deadPaths.length} rutas muertas encontradas`);
      log(`📊 Tasa de éxito: ${successRate}%`, successRate >= 95 ? 'green' : 'red');
      log(`🔧 Reparar rutas muertas antes de deployment`, 'red');
      return 1;
    } else {
      logSuccess(`✅ SCAN PASSED - No se encontraron rutas muertas`);
      log(`📊 Tasa de éxito: ${successRate}%`, 'green');
      log(`🚀 Código listo para deployment`, 'green');
      return 0;
    }
  }

  showAnalysisByFileType() {
    console.log();
    log(`📊 ANÁLISIS POR TIPO DE ARCHIVO:`, 'bright');
    
    const byExtension = {};
    
    this.deadPaths.forEach(issue => {
      const ext = path.extname(issue.file) || 'sin_extension';
      if (!byExtension[ext]) {
        byExtension[ext] = 0;
      }
      byExtension[ext]++;
    });
    
    Object.entries(byExtension)
      .sort(([,a], [,b]) => b - a)
      .forEach(([ext, count]) => {
        log(`   ${ext}: ${count} issues`, count > 5 ? 'red' : count > 2 ? 'yellow' : 'green');
      });
  }

  showRecommendations() {
    console.log();
    log(`💡 RECOMENDACIONES:`, 'bright');
    
    if (this.deadPaths.length === 0) {
      log(`   ✅ Excelente! No hay rutas muertas en el código`, 'green');
      log(`   ✅ Todos los imports están correctamente resueltos`, 'green');
    } else {
      log(`   🔧 Revisar y reparar las ${this.deadPaths.length} rutas muertas encontradas`, 'yellow');
      
      if (criticalIssues.length > 0) {
        log(`   🚨 URGENTE: ${criticalIssues.length} imports críticos faltantes`, 'red');
        log(`   📝 Crear los archivos faltantes o corregir los imports`, 'red');
      }
      
      if (mediumIssues.length > 0) {
        log(`   📁 Verificar ${mediumIssues.length} referencias de archivos`, 'yellow');
      }
      
      log(`   🧹 Ejecutar 'pnpm install' para dependencias faltantes`, 'cyan');
      log(`   🔄 Re-ejecutar este scan después de los fixes`, 'cyan');
    }
    
    // Recomendaciones específicas por lenguaje
    const languageIssues = {};
    this.deadPaths.forEach(issue => {
      if (!languageIssues[issue.language]) {
        languageIssues[issue.language] = 0;
      }
      languageIssues[issue.language]++;
    });
    
    Object.entries(languageIssues).forEach(([lang, count]) => {
      switch (lang) {
        case 'typescript':
          log(`   📘 TypeScript: Verificar tsconfig.json paths y baseUrl`, 'blue');
          break;
        case 'python':
          log(`   🐍 Python: Verificar PYTHONPATH y __init__.py files`, 'blue');
          break;
        case 'rust':
          log(`   🦀 Rust: Verificar Cargo.toml dependencies y mod declarations`, 'blue');
          break;
      }
    });
  }
}

// ==================================================================================
// EJECUCIÓN
// ==================================================================================

async function main() {
  try {
    const scanner = new DeadPathScanner();
    const exitCode = await scanner.scanAllFiles();
    process.exit(exitCode);
  } catch (error) {
    logError(`Error crítico en dead paths scanner: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { DeadPathScanner };