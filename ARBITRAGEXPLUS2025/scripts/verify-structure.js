/**
 * ============================================================================
 * ARCHIVO: ./ARBITRAGEXPLUS2025/scripts/verify-structure.js
 * SERVICIO: scripts
 * ============================================================================
 * 
 * 📥 ENTRADA DE DATOS:
 * 
 * 🔄 TRANSFORMACIÓN:
 * 
 * 📤 SALIDA DE DATOS:
 * 
 * 🔗 DEPENDENCIAS:
 * 
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = '/home/ubuntu/ARBITRAGEXPLUS2025';

console.log('Current working directory:', process.cwd());
console.log('Project root:', PROJECT_ROOT);

const paths = [
  'fly.toml',
  'services/api-server/package.json',
  'services/api-server/Dockerfile',
  'services/api-server/src/server.ts',
  'scripts/verify-structure.js',
  'scripts/check_fly_config.js',
  'scripts/scan-dead-paths.js',
  'scripts/guard-node-engines.js',
  'scripts/validate-local-health.js',
  'scripts/validate-deployment.js',
  '.github/workflows/manu-fly-ops.yml',
];

let missing = [];
for (const p of paths) {
  const fullPath = path.join(PROJECT_ROOT, p);
  console.log('Checking for file:', fullPath);
  if (!fs.existsSync(fullPath)) {
    missing.push(p);
  }
}

if (missing.length) {
  console.error('Missing required files:\n', missing.join('\n'));
  process.exit(1);
} else {
  console.log('Structure looks good!');
}

