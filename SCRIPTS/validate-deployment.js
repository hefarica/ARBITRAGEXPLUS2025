#!/usr/bin/env node
const { execSync } = require('child_process');
const wait = ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const url='https://arbitragexplus-api.fly.dev/health';
  for(let i=1;i<=15;i++){
    try{
      const out = execSync(`curl -s -f ${url}`,{encoding:'utf8'});
      const j = JSON.parse(out); if(j.status==='ok'){ console.log('🎯 Production health OK'); return; }
      throw new Error('Invalid JSON');
    }catch(e){ console.log(`Attempt ${i}/15 failed. Retrying in 10s...`); await wait(10000); }
  }
  console.error('🚨 Production health failed after retries'); process.exit(1);
})();
