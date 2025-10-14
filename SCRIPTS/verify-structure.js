#!/usr/bin/env node
const fs = require('fs');

const REQUIRED = [
  'fly.toml',
  '.github/workflows/manu-fly-ops.yml',
  'SCRIPTS/package.json',
  'SCRIPTS/verify-structure.js',
  'SCRIPTS/check_fly_config.js',
  'SCRIPTS/scan-dead-paths.js',
  'SCRIPTS/validate-local-health.js',
  'SCRIPTS/validate-deployment.js',
  'services/api-server/package.json',
  'services/api-server/tsconfig.json',
  'services/api-server/Dockerfile',
  'services/api-server/src/server.ts'
];

let ok = true;
for (const p of REQUIRED) {
  if (!fs.existsSync(p)) { console.error(`❌ Missing: ${p}`); ok = false; }
  else console.log(`✅ ${p}`);
}
if (!ok) { console.error("🚨 Structure invalid. Create missing paths before continue."); process.exit(1); }
console.log("🎯 Structure validated.");
