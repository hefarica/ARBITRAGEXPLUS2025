/**
 * ============================================================================
 * ARCHIVO: ./ARBITRAGEXPLUS2025/scripts/scan-dead-paths.js
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

#!/usr/bin/env node
/**
 * Recursively scan TypeScript and JavaScript files under services/ for broken relative imports.
 */
const fs = require('fs');
const path = require('path');
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'dist') {
      yield* walk(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
      yield full;
    }
  }
}
let broken = false;
for (const file of walk('services')) {
  const content = fs.readFileSync(file, 'utf8');
  const dir = path.dirname(file);
  const regex = /from\s+['"](\.\.\/[^'"]+)['"]|require\(\s*['"](\.\.\/[^'"]+)['"]\s*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const importPath = match[1] || match[2];
    // Remove extension and check possible resolutions
    const candidate = importPath.replace(/\.(js|ts)$/, '');
    const possibilities = [
      path.resolve(dir, candidate + '.ts'),
      path.resolve(dir, candidate + '.js'),
      path.resolve(dir, candidate, 'index.ts'),
      path.resolve(dir, candidate, 'index.js'),
    ];
    if (!possibilities.some((p) => fs.existsSync(p))) {
      console.error(`Broken import in ${file}: ${importPath}`);
      broken = true;
    }
  }
}
if (broken) process.exit(1);
console.log('No broken imports found');
