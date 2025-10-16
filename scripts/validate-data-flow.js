#!/usr/bin/env node

/**
 * Script de Validación de Flujo de Datos
 * 
 * Valida que la información generada por un archivo:
 * 1. Sea consumida por otros archivos (no es código muerto)
 * 2. Llegue por arrays dinámicos (no hardcoded)
 * 3. Fluya correctamente en la arquitectura
 * 
 * Marca en ROJO si:
 * - El archivo genera datos pero nadie los consume
 * - Los datos no llegan por arrays dinámicos
 * - Hay hardcoding en la cadena de flujo
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// Patrones de exports/outputs
const EXPORT_PATTERNS = {
  ts: [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+(?:const|let|var)\s+(\w+)/g,
    /export\s+class\s+(\w+)/g,
    /export\s+interface\s+(\w+)/g,
    /export\s+type\s+(\w+)/g,
    /export\s+default\s+(\w+)/g,
  ],
  py: [
    /def\s+(\w+)\s*\(/g,
    /class\s+(\w+)/g,
  ],
  rs: [
    /pub\s+fn\s+(\w+)/g,
    /pub\s+struct\s+(\w+)/g,
    /pub\s+enum\s+(\w+)/g,
  ],
  sol: [
    /function\s+(\w+)/g,
    /event\s+(\w+)/g,
  ]
};

// Patrones de arrays dinámicos
const DYNAMIC_ARRAY_PATTERNS = [
  /\.map\s*\(/,
  /\.filter\s*\(/,
  /\.reduce\s*\(/,
  /\.forEach\s*\(/,
  /for\s+\w+\s+in\s+/,
  /for\s*\(\s*(?:let|const|var)\s+\w+\s+of\s+/,
  /\[\s*\.\.\./,  // Spread operator
  /Array\.from\s*\(/,
  /Object\.entries\s*\(/,
  /Object\.keys\s*\(/,
  /Object\.values\s*\(/,
];

function extractExports(content, ext) {
  const patterns = EXPORT_PATTERNS[ext] || [];
  const exports = [];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      exports.push(match[1]);
    }
  });
  
  return exports;
}

function findConsumers(exportName, filePath) {
  const ext = path.extname(filePath).substring(1);
  const allFiles = glob.sync(`${ROOT_DIR}/**/*.{ts,js,py,rs,sol}`, {
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**']
  });
  
  const consumers = [];
  
  allFiles.forEach(file => {
    if (file === path.join(ROOT_DIR, filePath)) return; // Skip self
    
    const content = fs.readFileSync(file, 'utf-8');
    
    // Check if this file imports/uses the export
    const relativePath = path.relative(ROOT_DIR, file);
    
    if (content.includes(exportName)) {
      // Verify it's actually importing/using it, not just mentioning it
      const importRegex = new RegExp(`(?:import|from|use|require).*${exportName}`, 'i');
      const usageRegex = new RegExp(`${exportName}\\s*\\(|${exportName}\\.`, 'g');
      
      if (importRegex.test(content) || usageRegex.test(content)) {
        consumers.push(relativePath);
      }
    }
  });
  
  return consumers;
}

function validateDynamicArrayUsage(content) {
  const hasDynamicArrays = DYNAMIC_ARRAY_PATTERNS.some(pattern => pattern.test(content));
  
  const arrayUsages = [];
  DYNAMIC_ARRAY_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      arrayUsages.push(...matches);
    }
  });
  
  return { hasDynamicArrays, arrayUsages };
}

function analyzeDataFlow(filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  
  if (!fs.existsSync(fullPath)) {
    return {
      status: 'MISSING',
      exports: [],
      consumers: {},
      dynamicArrays: { hasDynamicArrays: false, arrayUsages: [] },
      issues: ['Archivo no existe']
    };
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const ext = path.extname(filePath).substring(1);
  
  const exports = extractExports(content, ext);
  const dynamicArrays = validateDynamicArrayUsage(content);
  
  const consumers = {};
  exports.forEach(exp => {
    consumers[exp] = findConsumers(exp, filePath);
  });
  
  const issues = [];
  
  // Check if exports are consumed
  const unconsumedExports = exports.filter(exp => consumers[exp].length === 0);
  if (unconsumedExports.length > 0) {
    issues.push(`⚠️ Exports no consumidos: ${unconsumedExports.join(', ')}`);
  }
  
  // Check if uses dynamic arrays
  if (!dynamicArrays.hasDynamicArrays && exports.length > 0) {
    issues.push('❌ No usa arrays dinámicos (map, filter, reduce, etc.)');
  }
  
  // Check for hardcoded data
  const hardcodedPatterns = [
    /const\s+\w+\s*=\s*\[.*0x[a-fA-F0-9]{40}/,
    /const\s+CHAINS\s*=\s*\[/,
    /const\s+DEXES\s*=\s*\[/,
  ];
  
  const hasHardcoding = hardcodedPatterns.some(pattern => pattern.test(content));
  if (hasHardcoding) {
    issues.push('🔴 HARDCODING DETECTADO');
  }
  
  // Determine status
  let status = 'GREEN';
  if (issues.some(i => i.includes('🔴'))) {
    status = 'RED';
  } else if (issues.some(i => i.includes('❌'))) {
    status = 'RED';
  } else if (issues.some(i => i.includes('⚠️'))) {
    status = 'YELLOW';
  }
  
  return { status, exports, consumers, dynamicArrays, issues };
}

function main() {
  console.log('🔍 VALIDACIÓN DE FLUJO DE DATOS\n');
  console.log('Valida que cada archivo:');
  console.log('1. Genere datos que sean consumidos por otros archivos');
  console.log('2. Use arrays dinámicos (map, filter, reduce, etc.)');
  console.log('3. No tenga hardcoding en el flujo de datos');
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
    const analysis = analyzeDataFlow(filePath);
    results[analysis.status].push({ filePath, ...analysis });
  });
  
  // Print results
  Object.entries(results).forEach(([status, files]) => {
    if (files.length === 0) return;
    
    const icon = { GREEN: '✅', YELLOW: '🟡', RED: '🔴' }[status];
    
    console.log(`\n${icon} ${status} (${files.length} archivos):`);
    console.log('-'.repeat(100));
    
    files.forEach(({ filePath, exports, consumers, dynamicArrays, issues }) => {
      console.log(`\n  📄 ${filePath}`);
      
      if (exports.length > 0) {
        console.log(`     📤 Exports: ${exports.length} (${exports.join(', ')})`);
        
        exports.forEach(exp => {
          const consumerList = consumers[exp];
          if (consumerList.length > 0) {
            console.log(`        ✅ ${exp} → consumido por ${consumerList.length} archivo(s)`);
            consumerList.slice(0, 3).forEach(c => console.log(`           - ${c}`));
            if (consumerList.length > 3) {
              console.log(`           ... y ${consumerList.length - 3} más`);
            }
          } else {
            console.log(`        ⚠️  ${exp} → NO consumido`);
          }
        });
      } else {
        console.log(`     📤 Exports: 0 (archivo de utilidad o configuración)`);
      }
      
      if (dynamicArrays.hasDynamicArrays) {
        console.log(`     ✅ Usa arrays dinámicos: ${dynamicArrays.arrayUsages.length} usos`);
      } else {
        console.log(`     ❌ NO usa arrays dinámicos`);
      }
      
      if (issues.length > 0) {
        console.log(`     ⚠️  Issues:`);
        issues.forEach(issue => console.log(`        ${issue}`));
      }
    });
  });
  
  // Summary
  console.log('\n' + '='.repeat(100));
  console.log('\n📊 RESUMEN:');
  console.log(`   ✅ VERDE (Flujo correcto):      ${results.GREEN.length} archivos`);
  console.log(`   🟡 AMARILLO (Advertencias):     ${results.YELLOW.length} archivos`);
  console.log(`   🔴 ROJO (Flujo incorrecto):     ${results.RED.length} archivos`);
  
  if (results.RED.length > 0) {
    console.log('\n🔴 VALIDACIÓN FALLIDA - Archivos con flujo de datos incorrecto');
    process.exit(1);
  } else if (results.YELLOW.length > 0) {
    console.log('\n🟡 ADVERTENCIA - Algunos archivos tienen advertencias');
    process.exit(0);
  } else {
    console.log('\n✅ VALIDACIÓN EXITOSA - Flujo de datos correcto en todos los archivos');
    process.exit(0);
  }
}

main();

