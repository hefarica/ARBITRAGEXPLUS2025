/**
 * ============================================================================
 * ARCHIVO: ./scripts/trace-data-sources.js
 * SERVICIO: trace-data-sources.js
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 *   FUENTE: Google Sheets - ROUTES, ASSETS, BLOCKCHAINS, DEXES, POOLS
 *     - Formato: JSON array
 *     - Frecuencia: Tiempo real / Polling
 *   DEPENDENCIAS: path, fs, url
 * 
 * 🔄 TRANSFORMACIÓN:
 *   FUNCIONES: main, resolveImportPath, detectDataSources
 * 
 * 📤 SALIDA DE DATOS:
 *   DESTINO: Google Sheets (actualización)
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
 * Script de Rastreo de Fuentes de Datos
 * 
 * Rastrea la cadena de dependencias de datos de cada archivo:
 * - ✅ VERDE: Datos provienen de Google Sheets o fuentes externas válidas (APIs)
 * - 🟡 AMARILLO: Datos provienen de archivos intermedios que sí consumen de Sheets
 * - 🔴 ROJO: Datos hardcodeados o sin fuente dinámica clara
 * 
 * Valida:
 * 1. ¿De dónde consume este archivo?
 * 2. ¿La cadena de dependencias llega a Sheets o APIs externas?
 * 3. ¿Hay hardcoding en la cadena?
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// Fuentes de datos válidas (origen legítimo)
const VALID_SOURCES = {
  SHEETS: [
    'sheetsService',
    'sheets.client',
    'config_reader',
    'BLOCKCHAINS',
    'DEXES',
    'ASSETS',
    'POOLS',
    'ROUTES',
    'CONFIG_GENERAL',
    'MODULOS_REGISTRADOS'
  ],
  EXTERNAL_APIS: [
    'pyth',
    'defillama',
    'publicnodes',
    'chainlink',
    'uniswap.subgraph',
    'thegraph.com'
  ],
  ENV_VARS: [
    'process.env',
    'os.getenv',
    'std::env'
  ]
};

// Patrones de hardcoding (origen ilegítimo)
const HARDCODING_PATTERNS = [
  /const\s+\w+\s*=\s*\[\s*["']0x[a-fA-F0-9]{40}["']/,  // Array de direcciones
  /const\s+\w+\s*=\s*\{\s*["']ethereum["']/,            // Objeto con chains hardcoded
  /const\s+CHAINS\s*=\s*\[/,                            // Constante CHAINS
  /const\s+DEXES\s*=\s*\[/,                             // Constante DEXES
  /\[\s*["'](ethereum|arbitrum|base)["']\s*,/,          // Array de nombres de chains
];

function extractImports(content, filePath) {
  const ext = path.extname(filePath);
  const imports = [];
  
  if (ext === '.ts' || ext === '.js') {
    // TypeScript/JavaScript imports
    const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      imports.push({ type: 'import', source: match[1] });
    }
    
    // Require statements
    const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      imports.push({ type: 'require', source: match[1] });
    }
  } else if (ext === '.py') {
    // Python imports
    const importRegex = /(?:from\s+([^\s]+)\s+import|import\s+([^\s]+))/g;
    let match;
    while ((match = importRegex.exec(content)) !== null) {
      const source = match[1] || match[2];
      imports.push({ type: 'import', source });
    }
  } else if (ext === '.rs') {
    // Rust use statements
    const useRegex = /use\s+([^;]+);/g;
    let match;
    while ((match = useRegex.exec(content)) !== null) {
      imports.push({ type: 'use', source: match[1] });
    }
  }
  
  return imports;
}

function detectDataSources(content, filePath) {
  const sources = {
    sheets: [],
    externalAPIs: [],
    envVars: [],
    hardcoded: [],
    intermediate: []
  };
  
  // Check for Sheets sources
  VALID_SOURCES.SHEETS.forEach(pattern => {
    if (content.includes(pattern)) {
      sources.sheets.push(pattern);
    }
  });
  
  // Check for External APIs
  VALID_SOURCES.EXTERNAL_APIS.forEach(pattern => {
    if (content.includes(pattern)) {
      sources.externalAPIs.push(pattern);
    }
  });
  
  // Check for Environment Variables
  VALID_SOURCES.ENV_VARS.forEach(pattern => {
    if (content.includes(pattern)) {
      sources.envVars.push(pattern);
    }
  });
  
  // Check for hardcoding
  HARDCODING_PATTERNS.forEach(pattern => {
    if (pattern.test(content)) {
      const match = content.match(pattern);
      if (match) {
        sources.hardcoded.push(match[0].substring(0, 50) + '...');
      }
    }
  });
  
  return sources;
}

function traceDataChain(filePath, visited = new Set()) {
  const fullPath = path.join(ROOT_DIR, filePath);
  
  if (!fs.existsSync(fullPath)) {
    return { status: 'MISSING', chain: [], sources: {} };
  }
  
  if (visited.has(filePath)) {
    return { status: 'CIRCULAR', chain: [filePath], sources: {} };
  }
  
  visited.add(filePath);
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const imports = extractImports(content, filePath);
  const sources = detectDataSources(content, filePath);
  
  // Determine status
  let status = 'RED';
  const chain = [filePath];
  
  if (sources.sheets.length > 0 || sources.externalAPIs.length > 0) {
    status = 'GREEN';
  } else if (sources.hardcoded.length > 0) {
    status = 'RED';
  } else if (imports.length > 0) {
    // Check if imports lead to valid sources
    let hasGreenImport = false;
    
    for (const imp of imports) {
      const importPath = resolveImportPath(imp.source, filePath);
      if (importPath) {
        const importTrace = traceDataChain(importPath, new Set(visited));
        chain.push(...importTrace.chain);
        
        if (importTrace.status === 'GREEN') {
          hasGreenImport = true;
          break;
        }
      }
    }
    
    status = hasGreenImport ? 'YELLOW' : 'RED';
  }
  
  return { status, chain, sources };
}

function resolveImportPath(importSource, fromFile) {
  // Resolve relative imports
  if (importSource.startsWith('.')) {
    const dir = path.dirname(fromFile);
    const resolved = path.join(dir, importSource);
    
    // Try different extensions
    const extensions = ['.ts', '.js', '.py', '.rs'];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      if (fs.existsSync(path.join(ROOT_DIR, withExt))) {
        return withExt;
      }
    }
    
    // Try index files
    for (const ext of extensions) {
      const indexPath = path.join(resolved, 'index' + ext);
      if (fs.existsSync(path.join(ROOT_DIR, indexPath))) {
        return indexPath;
      }
    }
  }
  
  // Resolve package imports (look in services/)
  if (!importSource.startsWith('.') && !importSource.startsWith('/')) {
    const parts = importSource.split('/');
    const possiblePaths = [
      `services/${parts[0]}/src/${parts.slice(1).join('/')}.ts`,
      `services/${parts[0]}/src/${parts.slice(1).join('/')}.py`,
      `services/${parts[0]}/src/${parts.slice(1).join('/')}.rs`,
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(path.join(ROOT_DIR, p))) {
        return p;
      }
    }
  }
  
  return null;
}

function main() {
  console.log('🔍 RASTREO DE FUENTES DE DATOS\n');
  console.log('Leyenda:');
  console.log('✅ VERDE: Datos de Google Sheets o APIs externas válidas');
  console.log('🟡 AMARILLO: Datos de archivos intermedios que consumen de Sheets');
  console.log('🔴 ROJO: Datos hardcodeados o sin fuente dinámica');
  console.log('\n' + '='.repeat(100) + '\n');
  
  const CRITICAL_FILES = [
    'services/python-collector/src/sheets/client.py',
    'services/python-collector/src/sheets/config_reader.py',
    'services/api-server/src/services/sheetsService.ts',
    'services/api-server/src/services/arbitrageService.ts',
    'services/api-server/src/adapters/ws/uniswap.ts',
    'services/python-collector/src/connectors/pyth.py',
    'services/python-collector/src/connectors/defillama.py',
  ];
  
  const results = {
    GREEN: [],
    YELLOW: [],
    RED: []
  };
  
  CRITICAL_FILES.forEach(filePath => {
    const trace = traceDataChain(filePath);
    results[trace.status].push({ filePath, ...trace });
  });
  
  // Print results
  Object.entries(results).forEach(([status, files]) => {
    if (files.length === 0) return;
    
    const icon = { GREEN: '✅', YELLOW: '🟡', RED: '🔴' }[status];
    
    console.log(`\n${icon} ${status} (${files.length} archivos):`);
    console.log('-'.repeat(100));
    
    files.forEach(({ filePath, chain, sources }) => {
      console.log(`\n  📄 ${filePath}`);
      
      if (sources.sheets && sources.sheets.length > 0) {
        console.log(`     ✅ Consume de Sheets: ${sources.sheets.join(', ')}`);
      }
      
      if (sources.externalAPIs && sources.externalAPIs.length > 0) {
        console.log(`     🌐 Consume de APIs: ${sources.externalAPIs.join(', ')}`);
      }
      
      if (sources.hardcoded && sources.hardcoded.length > 0) {
        console.log(`     🔴 HARDCODING DETECTADO:`);
        sources.hardcoded.forEach(h => console.log(`        ${h}`));
      }
      
      if (chain.length > 1) {
        console.log(`     📊 Cadena de dependencias: ${chain.join(' → ')}`);
      }
    });
  });
  
  // Summary
  console.log('\n' + '='.repeat(100));
  console.log('\n📊 RESUMEN:');
  console.log(`   ✅ VERDE (Fuentes válidas):     ${results.GREEN.length} archivos`);
  console.log(`   🟡 AMARILLO (Intermedios):      ${results.YELLOW.length} archivos`);
  console.log(`   🔴 ROJO (Hardcoded/Inválido):   ${results.RED.length} archivos`);
  
  if (results.RED.length > 0) {
    console.log('\n🔴 VALIDACIÓN FALLIDA - Archivos con hardcoding o fuentes inválidas detectados');
    process.exit(1);
  } else {
    console.log('\n✅ VALIDACIÓN EXITOSA - Todas las fuentes de datos son dinámicas');
    process.exit(0);
  }
}

main();

