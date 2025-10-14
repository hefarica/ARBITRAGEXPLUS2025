#!/usr/bin/env node
const fs = require('fs'); const toml = require('@iarna/toml');
if (!fs.existsSync('fly.toml')) { console.error('Missing fly.toml'); process.exit(1); }
const cfg = toml.parse(fs.readFileSync('fly.toml','utf8'));
let ok = true;
function assert(cond, msg){ if(!cond){console.error('❌ '+msg); ok=false;} else console.log('✅ '+msg); }
assert(cfg.app === 'arbitragexplus-api', 'app is "arbitragexplus-api"');
assert(cfg.build && cfg.build.dockerfile === 'services/api-server/Dockerfile', 'build.dockerfile points to services/api-server/Dockerfile');
assert(cfg.http_service && cfg.http_service.internal_port === 3000, 'internal_port is 3000');
assert(cfg.http_service?.healthcheck?.path === '/health', 'healthcheck.path is /health');
if(!ok){ console.error('🚨 fly.toml invalid'); process.exit(1); }
console.log('🎯 fly.toml OK');
