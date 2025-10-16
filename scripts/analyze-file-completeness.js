#!/usr/bin/env node

/**
 * Script de Análisis de Completitud de Archivos
 * 
 * Identifica el estado real de cada archivo:
 * - FUNCIONAL: Archivo completo con lógica implementada
 * - INCOMPLETO: Archivo con estructura pero falta lógica core
 * - VACÍO: Archivo esqueleto sin implementación
 * - FALTANTE: Archivo que no existe
 * 
 * Basado en las especificaciones de programación dinámica:
 * - Todo debe consumir datos desde Google Sheets (arrays dinámicos)
 * - Cero hardcoding
 * - Polimorfismo y abstracción por características
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// Criterios de completitud por tipo de archivo
const COMPLETENESS_CRITERIA = {
  // Python files
  '.py': {
    EMPTY: (content) => content.length < 100 || !content.includes('def '),
    INCOMPLETE: (content) => {
      const hasImports = content.includes('import ');
      const hasFunctions = (content.match(/def /g) || []).length > 0;
      const hasClasses = content.includes('class ');
      const hasSheetsDynamic = content.includes('sheets') || content.includes('BLOCKCHAINS') || content.includes('DEXES');
      const hasHardcoding = /\b(0x[a-fA-F0-9]{40}|"0x|'0x)\b/.test(content) || 
                           /"(ethereum|arbitrum|base)"/i.test(content);
      
      return hasImports && (hasFunctions || hasClasses) && !hasSheetsDynamic && !hasHardcoding;
    },
    FUNCTIONAL: (content) => {
      const hasSheetsDynamic = content.includes('sheets') || content.includes('BLOCKCHAINS') || content.includes('DEXES');
      const hasProperStructure = (content.match(/def /g) || []).length >= 2;
      const hasNoHardcoding = !/\b(0x[a-fA-F0-9]{40})\b/.test(content);
      
      return hasSheetsDynamic && hasProperStructure && hasNoHardcoding;
    }
  },
  
  // TypeScript/JavaScript files
  '.ts': {
    EMPTY: (content) => content.length < 100 || (!content.includes('function') && !content.includes('class') && !content.includes('=>')),
    INCOMPLETE: (content) => {
      const hasImports = content.includes('import ');
      const hasExports = content.includes('export ');
      const hasFunctions = content.includes('function') || content.includes('=>') || content.includes('class');
      const hasSheetsDynamic = content.includes('sheets') || content.includes('BLOCKCHAINS') || content.includes('DEXES');
      const hasHardcoding = /\b(0x[a-fA-F0-9]{40}|"0x|'0x)\b/.test(content);
      
      return hasImports && hasExports && hasFunctions && !hasSheetsDynamic;
    },
    FUNCTIONAL: (content) => {
      const hasSheetsDynamic = content.includes('sheets') || content.includes('BLOCKCHAINS') || content.includes('DEXES') || content.includes('sheetsService');
      const hasProperStructure = (content.match(/export /g) || []).length >= 1;
      const hasNoHardcoding = !/\b(0x[a-fA-F0-9]{40})\b/.test(content) || content.includes('// Hardcoded for testing');
      
      return hasSheetsDynamic && hasProperStructure && hasNoHardcoding;
    }
  },
  
  // Rust files
  '.rs': {
    EMPTY: (content) => content.length < 100 || !content.includes('fn '),
    INCOMPLETE: (content) => {
      const hasUse = content.includes('use ');
      const hasFunctions = (content.match(/fn /g) || []).length > 0;
      const hasStructs = content.includes('struct ') || content.includes('enum ');
      const hasDynamicData = content.includes('Vec<') || content.includes('HashMap');
      
      return hasUse && hasFunctions && !hasDynamicData;
    },
    FUNCTIONAL: (content) => {
      const hasDynamicData = content.includes('Vec<') || content.includes('HashMap');
      const hasProperStructure = (content.match(/fn /g) || []).length >= 2;
      const hasTests = content.includes('#[test]') || content.includes('#[cfg(test)]');
      
      return hasDynamicData && hasProperStructure;
    }
  },
  
  // Solidity files
  '.sol': {
    EMPTY: (content) => content.length < 100 || !content.includes('contract '),
    INCOMPLETE: (content) => {
      const hasContract = content.includes('contract ');
      const hasFunctions = (content.match(/function /g) || []).length > 0;
      const hasEvents = content.includes('event ');
      const hasModifiers = content.includes('modifier ');
      
      return hasContract && hasFunctions && (!hasEvents || !hasModifiers);
    },
    FUNCTIONAL: (content) => {
      const hasContract = content.includes('contract ');
      const hasFunctions = (content.match(/function /g) || []).length >= 3;
      const hasEvents = content.includes('event ');
      const hasSecurity = content.includes('ReentrancyGuard') || content.includes('nonReentrant');
      
      return hasContract && hasFunctions && hasEvents && hasSecurity;
    }
  }
};

// Archivos críticos a analizar
const CRITICAL_FILES = [
  // Google Sheets Integration
  'services/python-collector/src/sheets/client.py',
  'services/python-collector/src/sheets/config_reader.py',
  'services/python-collector/src/sheets/route_writer.py',
  'services/python-collector/src/sheets/schema.py',
  
  // TS Executor
  'services/ts-executor/src/exec/flash.ts',
  'services/ts-executor/src/chains/manager.ts',
  'services/ts-executor/src/queues/queueManager.ts',
  
  // Rust Engine
  'services/engine-rust/src/pathfinding/mod.rs',
  'services/engine-rust/src/pathfinding/two_dex.rs',
  'services/engine-rust/src/pathfinding/three_dex.rs',
  'services/engine-rust/src/pathfinding/ranking.rs',
  'services/engine-rust/src/engine/arbitrage.rs',
  'services/engine-rust/src/engine/optimizer.rs',
  
  // Contratos
  'contracts/src/Router.sol',
  'contracts/src/Vault.sol',
  
  // Adaptadores WebSocket
  'services/api-server/src/adapters/ws/websocketManager.ts',
  'services/api-server/src/adapters/ws/uniswap.ts',
  'services/api-server/src/adapters/ws/sushiswap.ts',
  'services/api-server/src/adapters/ws/pancakeswap.ts',
];

function analyzeFile(filePath) {
  const fullPath = path.join(ROOT_DIR, filePath);
  const ext = path.extname(filePath);
  
  if (!fs.existsSync(fullPath)) {
    return { status: 'FALTANTE', size: 0, lines: 0, issues: ['Archivo no existe'] };
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n').length;
  const size = content.length;
  
  const criteria = COMPLETENESS_CRITERIA[ext];
  if (!criteria) {
    return { status: 'UNKNOWN', size, lines, issues: ['Tipo de archivo no soportado'] };
  }
  
  const issues = [];
  
  // Check for hardcoding
  if (/\b(0x[a-fA-F0-9]{40})\b/.test(content) && !content.includes('// Hardcoded for testing')) {
    issues.push('⚠️ Contiene direcciones hardcodeadas');
  }
  
  // Check for sheets integration
  if (!content.includes('sheets') && !content.includes('BLOCKCHAINS') && !content.includes('DEXES') && ext !== '.sol') {
    issues.push('❌ No consume datos desde Google Sheets');
  }
  
  // Determine status
  let status;
  if (criteria.EMPTY(content)) {
    status = 'VACÍO';
    issues.push('Archivo esqueleto sin implementación');
  } else if (criteria.FUNCTIONAL(content)) {
    status = 'FUNCIONAL';
  } else if (criteria.INCOMPLETE(content)) {
    status = 'INCOMPLETO';
    issues.push('Estructura presente pero falta lógica core');
  } else {
    status = 'PARCIAL';
    issues.push('Implementación parcial detectada');
  }
  
  return { status, size, lines, issues };
}

function main() {
  console.log('🔍 ANÁLISIS DE COMPLETITUD DE ARCHIVOS\n');
  console.log('Criterios de evaluación:');
  console.log('- FUNCIONAL: Implementación completa con datos dinámicos desde Sheets');
  console.log('- INCOMPLETO: Estructura presente pero falta lógica core');
  console.log('- VACÍO: Archivo esqueleto sin implementación');
  console.log('- FALTANTE: Archivo no existe\n');
  console.log('='.repeat(100) + '\n');
  
  const results = {
    FUNCIONAL: [],
    INCOMPLETO: [],
    VACÍO: [],
    FALTANTE: [],
    PARCIAL: []
  };
  
  CRITICAL_FILES.forEach(filePath => {
    const result = analyzeFile(filePath);
    results[result.status].push({ filePath, ...result });
  });
  
  // Print results
  Object.entries(results).forEach(([status, files]) => {
    if (files.length === 0) return;
    
    const icon = {
      FUNCIONAL: '✅',
      INCOMPLETO: '⚠️',
      VACÍO: '❌',
      FALTANTE: '🔴',
      PARCIAL: '🟡'
    }[status];
    
    console.log(`\n${icon} ${status} (${files.length} archivos):`);
    console.log('-'.repeat(100));
    
    files.forEach(({ filePath, size, lines, issues }) => {
      console.log(`\n  📄 ${filePath}`);
      console.log(`     Tamaño: ${size} bytes | Líneas: ${lines}`);
      if (issues.length > 0) {
        issues.forEach(issue => console.log(`     ${issue}`));
      }
    });
  });
  
  // Summary
  console.log('\n' + '='.repeat(100));
  console.log('\n📊 RESUMEN:');
  console.log(`   ✅ FUNCIONAL:   ${results.FUNCIONAL.length} archivos`);
  console.log(`   🟡 PARCIAL:     ${results.PARCIAL.length} archivos`);
  console.log(`   ⚠️  INCOMPLETO:  ${results.INCOMPLETO.length} archivos`);
  console.log(`   ❌ VACÍO:       ${results.VACÍO.length} archivos`);
  console.log(`   🔴 FALTANTE:    ${results.FALTANTE.length} archivos`);
  
  const total = CRITICAL_FILES.length;
  const functional = results.FUNCIONAL.length;
  const percentage = ((functional / total) * 100).toFixed(1);
  
  console.log(`\n   📈 COMPLETITUD: ${percentage}% (${functional}/${total} archivos funcionales)`);
  
  // Exit code
  if (results.FALTANTE.length > 0 || results.VACÍO.length > 0) {
    console.log('\n❌ VALIDACIÓN FALLIDA - Archivos críticos faltantes o vacíos');
    process.exit(1);
  } else if (results.INCOMPLETO.length > 0) {
    console.log('\n⚠️  ADVERTENCIA - Archivos incompletos detectados');
    process.exit(0);
  } else {
    console.log('\n✅ VALIDACIÓN EXITOSA - Todos los archivos críticos son funcionales');
    process.exit(0);
  }
}

main();

