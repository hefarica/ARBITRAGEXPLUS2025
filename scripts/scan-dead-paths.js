#!/usr/bin/env node
/**
 * scan-dead-paths.js
 * 
 * Script para detectar imports/requires que apuntan a archivos inexistentes.
 * 
 * RESPONSABILIDADES:
 * - Escanear todos los archivos .js/.ts/.py/.rs en el proyecto
 * - Extraer imports/requires usando regex y AST parsing
 * - Verificar que cada import apunte a un archivo real
 * - Detectar dependencias circulares
 * - Generar reporte de rutas muertas y referencias rotas
 * 
 * INTEGRACIÓN:
 * - Hook pre-commit automático
 * - CI/CD pipeline validation
 * - Monitoreo continuo de integridad
 * 
 * EJECUCIÓN:
 * node SCRIPTS/scan-dead-paths.js
 * 
 * EXIT CODES:
 * 0 = No hay rutas muertas detectadas
 * 1 = Se encontraron imports rotos o dependencias muertas
 * 
 * @author ARBITRAGEXPLUS2025 Core Team
 * @version 1.0.0
 * @criticality BLOQUEANTE
 * @integration-with sheets:LOG_ERRORES_EVENTOS
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const chalk = require('chalk');

// ============================================================================
// CONFIGURACIÓN DE ESCANEO
// ============================================================================

const SCAN_PATTERNS = {
  TYPESCRIPT: '**/*.ts',
  JAVASCRIPT: '**/*.js',
  PYTHON: '**/*.py',
  RUST: '**/*.rs'
};

const IGNORE_PATTERNS = [
  'node_modules/**',
  'target/**',
  '.git/**',
  'dist/**',
  'build/**',
  '*.min.js',
  'vendor/**'
];

// Patrones de regex para extraer imports
const IMPORT_REGEX = {
  // TypeScript/JavaScript
  ES6_IMPORT: /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]((?:\.\/|\.\.\/|@\/)[^'"]*|[^'"]*)['"]/g,
  REQUIRE: /require\s*\(\s*['"]((?:\.\/|\.\.\/|@\/)[^'"]*|[^'"]*)['"]\s*\)/g,
  DYNAMIC_IMPORT: /import\s*\(\s*['"]((?:\.\/|\.\.\/|@\/)[^'"]*|[^'"]*)['"]\s*\)/g,
  
  // Python
  PYTHON_IMPORT: /(?:from\s+([a-zA-Z_][a-zA-Z0-9_.]*)\s+import|import\s+([a-zA-Z_][a-zA-Z0-9_.]*(?:\s*,\s*[a-zA-Z_][a-zA-Z0-9_.]*)?))/g,
  
  // Rust
  RUST_USE: /use\s+(?:crate::)?([a-zA-Z_][a-zA-Z0-9_]*(?:::[a-zA-Z_][a-zA-Z0-9_]*)*)/g,
  RUST_MOD: /mod\s+([a-zA-Z_][a-zA-Z0-9_]*)/g
};

// ============================================================================
// CLASES Y ESTRUCTURAS DE DATOS
// ============================================================================

class ImportAnalyzer {
  constructor() {
    this.deadPaths = [];
    this.circularDeps = [];
    this.importGraph = new Map();
    this.scannedFiles = new Set();
    this.totalImports = 0;
    this.validImports = 0;
  }

  /**
   * Escanea todo el proyecto en busca de imports rotos
   */
  async scanProject() {
    console.log(chalk.bold.blue('🔍 Iniciando escaneo de rutas muertas...\n'));
    
    try {
      // Obtener todos los archivos a escanear
      const allFiles = await this.getAllSourceFiles();
      console.log(chalk.gray(`📁 Archivos encontrados: ${allFiles.length}`));
      
      // Procesar cada archivo
      for (const filePath of allFiles) {
        await this.processFile(filePath);
      }
      
      // Detectar dependencias circulares
      this.detectCircularDependencies();
      
      return this.generateReport();
      
    } catch (error) {
      console.error(chalk.red('❌ Error durante el escaneo:'), error.message);
      return false;
    }
  }

  /**
   * Obtiene lista de todos los archivos fuente del proyecto
   */
  async getAllSourceFiles() {
    const files = [];
    
    for (const pattern of Object.values(SCAN_PATTERNS)) {
      const matches = glob.sync(pattern, { 
        ignore: IGNORE_PATTERNS,
        absolute: true
      });
      files.push(...matches);
    }
    
    return [...new Set(files)]; // Eliminar duplicados
  }

  /**
   * Procesa un archivo individual extrayendo sus imports
   */
  async processFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const ext = path.extname(filePath);
      const imports = this.extractImports(content, ext, filePath);
      
      this.scannedFiles.add(filePath);
      this.importGraph.set(filePath, imports);
      
      // Validar cada import
      for (const importInfo of imports) {
        this.totalImports++;
        
        const resolvedPath = this.resolveImportPath(importInfo.path, filePath);
        
        if (resolvedPath && fs.existsSync(resolvedPath)) {
          this.validImports++;
        } else {
          this.deadPaths.push({
            file: filePath,
            import: importInfo.path,
            line: importInfo.line,
            resolvedPath: resolvedPath || 'NO_RESUELTO'
          });
        }
      }
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  No se pudo procesar ${filePath}: ${error.message}`));
    }
  }

  /**
   * Extrae imports de un archivo según su extensión
   */
  extractImports(content, extension, filePath) {
    const imports = [];
    const lines = content.split('\n');
    
    let patterns = [];
    
    // Seleccionar patrones según la extensión
    switch (extension) {
      case '.ts':
      case '.js':
        patterns = [
          IMPORT_REGEX.ES6_IMPORT,
          IMPORT_REGEX.REQUIRE,
          IMPORT_REGEX.DYNAMIC_IMPORT
        ];
        break;
        
      case '.py':
        patterns = [IMPORT_REGEX.PYTHON_IMPORT];
        break;
        
      case '.rs':
        patterns = [
          IMPORT_REGEX.RUST_USE,
          IMPORT_REGEX.RUST_MOD
        ];
        break;
        
      default:
        return imports;
    }
    
    // Extraer imports línea por línea
    lines.forEach((line, lineIndex) => {
      for (const pattern of patterns) {
        let match;
        const regex = new RegExp(pattern.source, pattern.flags);
        
        while ((match = regex.exec(line)) !== null) {
          const importPath = match[1] || match[2];
          
          if (importPath && this.isLocalImport(importPath)) {
            imports.push({
              path: importPath,
              line: lineIndex + 1,
              fullLine: line.trim()
            });
          }
        }
      }
    });
    
    return imports;
  }

  /**
   * Determina si un import es local al proyecto (no es dependencia externa)
   */
  isLocalImport(importPath) {
    return (
      importPath.startsWith('./') ||
      importPath.startsWith('../') ||
      importPath.startsWith('@/') ||
      importPath.startsWith('src/') ||
      importPath.startsWith('crate::')
    );
  }

  /**
   * Resuelve la ruta completa de un import relativo
   */
  resolveImportPath(importPath, fromFile) {
    const fromDir = path.dirname(fromFile);
    
    try {
      // Manejo especial para diferentes tipos de imports
      if (importPath.startsWith('@/')) {
        // Alias para src/
        const srcPath = importPath.replace('@/', 'src/');
        return path.resolve(process.cwd(), srcPath);
      }
      
      if (importPath.startsWith('crate::')) {
        // Rust crate path - buscar en src/
        const rustPath = importPath.replace('crate::', '').replace('::', '/');
        return path.resolve(process.cwd(), 'src', rustPath + '.rs');
      }
      
      // Import relativo normal
      const resolved = path.resolve(fromDir, importPath);
      
      // Intentar diferentes extensiones si no se especifica
      if (!path.extname(resolved)) {
        const extensions = ['.ts', '.js', '.py', '.rs', '/mod.rs', '/index.ts', '/index.js'];
        
        for (const ext of extensions) {
          const withExt = resolved + ext;
          if (fs.existsSync(withExt)) {
            return withExt;
          }
        }
      }
      
      return resolved;
      
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  Error resolviendo ${importPath}: ${error.message}`));
      return null;
    }
  }

  /**
   * Detecta dependencias circulares en el grafo de imports
   */
  detectCircularDependencies() {
    const visited = new Set();
    const recursionStack = new Set();
    
    for (const [file, imports] of this.importGraph.entries()) {
      if (!visited.has(file)) {
        this.detectCircularDFS(file, visited, recursionStack, []);
      }
    }
  }

  /**
   * DFS para detectar ciclos en el grafo de dependencias
   */
  detectCircularDFS(file, visited, recursionStack, path) {
    visited.add(file);
    recursionStack.add(file);
    
    const imports = this.importGraph.get(file) || [];
    
    for (const importInfo of imports) {
      const resolvedPath = this.resolveImportPath(importInfo.path, file);
      
      if (resolvedPath && this.importGraph.has(resolvedPath)) {
        if (recursionStack.has(resolvedPath)) {
          // Ciclo detectado
          const cycle = [...path, file, resolvedPath];
          this.circularDeps.push({
            cycle: cycle.map(f => path.relative(process.cwd(), f)),
            files: cycle
          });
        } else if (!visited.has(resolvedPath)) {
          this.detectCircularDFS(
            resolvedPath, 
            visited, 
            recursionStack, 
            [...path, file]
          );
        }
      }
    }
    
    recursionStack.delete(file);
  }

  /**
   * Genera reporte final consolidado
   */
  generateReport() {
    console.log(chalk.bold.cyan('\n' + '='.repeat(70)));
    console.log(chalk.bold.cyan('📊 REPORTE DE ANÁLISIS DE RUTAS MUERTAS'));
    console.log(chalk.bold.cyan('='.repeat(70) + '\n'));
    
    // Estadísticas generales
    console.log(chalk.bold('📈 Estadísticas Generales:'));
    console.log(`  Archivos escaneados: ${chalk.cyan(this.scannedFiles.size)}`);
    console.log(`  Total imports procesados: ${chalk.cyan(this.totalImports)}`);
    console.log(`  Imports válidos: ${chalk.green(this.validImports)}`);
    console.log(`  Imports rotos: ${chalk.red(this.deadPaths.length)}`);
    console.log(`  Dependencias circulares: ${chalk.yellow(this.circularDeps.length)}\n`);
    
    let hasErrors = false;
    
    // Reporte de rutas muertas
    if (this.deadPaths.length > 0) {
      hasErrors = true;
      
      console.log(chalk.bold.red('❌ IMPORTS ROTOS DETECTADOS:\n'));
      
      this.deadPaths.forEach(deadPath => {
        const relativePath = path.relative(process.cwd(), deadPath.file);
        console.log(chalk.red(`  📄 ${relativePath}:${deadPath.line}`));
        console.log(chalk.red(`     Import: ${deadPath.import}`));
        console.log(chalk.red(`     Ruta esperada: ${deadPath.resolvedPath}`));
        console.log('');
      });
    }
    
    // Reporte de dependencias circulares
    if (this.circularDeps.length > 0) {
      hasErrors = true;
      
      console.log(chalk.bold.yellow('🔄 DEPENDENCIAS CIRCULARES DETECTADAS:\n'));
      
      this.circularDeps.forEach((circular, index) => {
        console.log(chalk.yellow(`  ${index + 1}. Ciclo detectado:`));
        circular.cycle.forEach((file, i) => {
          const arrow = i < circular.cycle.length - 1 ? ' → ' : '';
          console.log(chalk.yellow(`     ${file}${arrow}`));
        });
        console.log('');
      });
    }
    
    // Resultado final
    if (!hasErrors) {
      console.log(chalk.bold.green('✅ ESCANEO COMPLETADO - NO SE DETECTARON PROBLEMAS'));
      console.log(chalk.green('   Todos los imports son válidos y no hay dependencias circulares.\n'));
      
      console.log(chalk.bold.cyan('📋 SIGUIENTE PASO:'));
      console.log(chalk.cyan('   node SCRIPTS/check-fly-config.js\n'));
    } else {
      console.log(chalk.bold.red('❌ ESCANEO COMPLETADO - PROBLEMAS DETECTADOS'));
      console.log(chalk.red('   Corrige los imports rotos antes de continuar.\n'));
      
      console.log(chalk.bold.yellow('🔧 ACCIONES REQUERIDAS:'));
      console.log(chalk.yellow('   1. Revisa cada import roto listado arriba'));
      console.log(chalk.yellow('   2. Corrige las rutas o crea los archivos faltantes'));
      console.log(chalk.yellow('   3. Resuelve dependencias circulares'));
      console.log(chalk.yellow('   4. Ejecuta nuevamente: node SCRIPTS/scan-dead-paths.js\n'));
    }
    
    // Guardar reporte
    this.saveReportToFile(hasErrors);
    
    return !hasErrors;
  }

  /**
   * Guarda reporte detallado en JSON
   */
  saveReportToFile(hasErrors) {
    const report = {
      timestamp: new Date().toISOString(),
      scan_status: hasErrors ? 'FAILED' : 'PASSED',
      statistics: {
        files_scanned: this.scannedFiles.size,
        total_imports: this.totalImports,
        valid_imports: this.validImports,
        broken_imports: this.deadPaths.length,
        circular_dependencies: this.circularDeps.length
      },
      dead_paths: this.deadPaths,
      circular_dependencies: this.circularDeps,
      scanned_files: Array.from(this.scannedFiles)
    };
    
    const reportPath = path.join(process.cwd(), 'SCRIPTS', 'dead-paths-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(chalk.gray(`📄 Reporte detallado guardado en: ${reportPath}\n`));
  }
}

// ============================================================================
// EJECUCIÓN PRINCIPAL
// ============================================================================

async function main() {
  console.log(chalk.bold.magenta('\n╔════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║  ARBITRAGEXPLUS2025 - Escaneo de Rutas Muertas ║'));
  console.log(chalk.bold.magenta('║  Detector de Imports Rotos y Deps Circulares   ║'));
  console.log(chalk.bold.magenta('╚════════════════════════════════════════════════╝\n'));
  
  console.log(chalk.gray(`🔍 Directorio de trabajo: ${process.cwd()}`));
  console.log(chalk.gray(`📅 Fecha de ejecución: ${new Date().toLocaleString('es-ES')}`));
  console.log(chalk.gray(`👤 Usuario: ${process.env.USER || 'unknown'}\n`));
  
  const analyzer = new ImportAnalyzer();
  const success = await analyzer.scanProject();
  
  // Exit con código apropiado para CI/CD
  process.exit(success ? 0 : 1);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.bold.red('\n❌ ERROR CRÍTICO:'));
    console.error(chalk.red(error.message));
    console.error(chalk.gray(error.stack));
    process.exit(1);
  });
}

// Exportar para testing
module.exports = {
  ImportAnalyzer,
  SCAN_PATTERNS,
  IMPORT_REGEX
};