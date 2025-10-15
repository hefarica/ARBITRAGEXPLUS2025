#!/usr/bin/env node
/**
 * Build and run the API server locally, then perform a health check.
 */
const { spawn } = require('child_process');
const http = require('http');
const run = (cmd, args, options = {}) => new Promise((resolve, reject) => {
  const proc = spawn(cmd, args, options);
  proc.on('close', (code) => {
    code === 0 ? resolve() : reject(new Error(`${cmd} exited with code ${code}`));
  });
});
(async () => {
  try {
    // Install and build
    await run('npm', ['ci'], { cwd: 'services/api-server', stdio: 'inherit' });
    await run('npm', ['run', 'build'], { cwd: 'services/api-server', stdio: 'inherit' });
    // Start server
    const server = spawn('node', ['dist/server.js'], { cwd: 'services/api-server', stdio: 'inherit' });
    // Wait a bit
    await new Promise((r) => setTimeout(r, 4000));
    // Check health
    const options = { hostname: 'localhost', port: 3000, path: '/health', method: 'GET', timeout: 5000 };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 && data.includes('ok')) {
          console.log('Local health check passed');
        } else {
          console.error('Local health check failed:', res.statusCode, data);
          process.exit(1);
        }
        server.kill();
      });
    });
    req.on('error', (err) => { console.error('Request error', err.message); server.kill(); process.exit(1); });
    req.end();
  } catch (err) {
    console.error('Validation failed:', err.message);
    process.exit(1);
  }
})();
