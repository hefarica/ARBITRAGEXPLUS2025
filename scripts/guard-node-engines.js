#!/usr/bin/env node
/**
 * Ensure that package.json defines a Node engine compatible with Fly.io (Node 20+).
 */
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('services/api-server/package.json', 'utf8'));
const engines = pkg.engines || {};
if (!engines.node || !/^>=?\s*20/.test(engines.node)) {
  console.error('Error: services/api-server/package.json must specify "engines.node" >= 20.x');
  process.exit(1);
}
console.log('Node engine version is compatible');