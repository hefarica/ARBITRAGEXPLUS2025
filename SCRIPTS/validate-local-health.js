#!/usr/bin/env node
const {spawn} = require('child_process'); const http = require('http');
(async () => {
  const build = spawn('npm',['run','build'],{cwd:'services/api-server',stdio:'inherit'});
  await new Promise((res,rej)=>build.on('close',c=>c?rej(c):res()));
  const srv = spawn('npm',['start'],{cwd:'services/api-server',stdio:'inherit'});
  await new Promise(r=>setTimeout(r,4000));
  await new Promise((resolve,reject)=>{
    const req = http.request({host:'127.0.0.1',port:3000,path:'/health',timeout:5000},res=>{
      if(res.statusCode===200) resolve(); else reject(new Error('HTTP '+res.statusCode)); });
    req.on('error',reject); req.end();
  });
  console.log('🎯 Local health OK'); srv.kill();
})().catch(e=>{ console.error('🚨 Local health failed',e); process.exit(1); });
