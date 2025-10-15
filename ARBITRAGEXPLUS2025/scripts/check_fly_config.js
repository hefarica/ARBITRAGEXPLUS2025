#!/usr/bin/env node
/**
 * Parse and validate fly.toml settings.
 */
const fs = require('fs');
const toml = require('@iarna/toml');
try {
  const content = fs.readFileSync('fly.toml', 'utf8');
  const config = toml.parse(content);
  const errors = [];
  if (config.app !== 'arbitragexplus-api') errors.push('app name must be arbitragexplus-api');
  if (!config.build || config.build.dockerfile !== 'services/api-server/Dockerfile') errors.push('build.dockerfile must point to services/api-server/Dockerfile');
  if (!config.http_service || config.http_service.internal_port !== 3000) errors.push('http_service.internal_port must be 3000');
  if (!config.http_service || !config.http_service.healthcheck || config.http_service.healthcheck.path !== '/health') errors.push('healthcheck.path must be /health');
  if (errors.length) {
    console.error('fly.toml validation failed:\n' + errors.join('\n'));
    process.exit(1);
  } else {
    console.log('fly.toml is valid!');
  }
} catch (err) {
  console.error('Error reading fly.toml:', err.message);
  process.exit(1);
}
