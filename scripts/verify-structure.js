#!/usr/bin/env node
/**
 * Validate that all required files and directories exist.
 * Fails the process if any are missing.
 */
const fs = require('fs');
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
  if (!fs.existsSync(p)) missing.push(p);
}
if (missing.length) {
  console.error('Missing required files:\n', missing.join('\n'));
  process.exit(1);
} else {
  console.log('Structure looks good!');
}
