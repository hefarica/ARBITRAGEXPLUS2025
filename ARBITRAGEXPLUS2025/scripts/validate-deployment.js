#!/usr/bin/env node
/**
 * Validate production deployment by checking the public health endpoint with retries.
 */
const axios = require('axios');
const MAX_ATTEMPTS = 15;
async function check() {
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    try {
      const res = await axios.get('https://arbitragexplus-api.fly.dev/health', { timeout: 5000 });
      if (res.status === 200 && res.data.status === 'ok') {
        console.log('Production health check successful');
        return;
      }
    } catch (err) {
      console.log(`Attempt ${i} failed:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 10000));
  }
  console.error('Production deployment validation failed');
  process.exit(1);
}
check();
