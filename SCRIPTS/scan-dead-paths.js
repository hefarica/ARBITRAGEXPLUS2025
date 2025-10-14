#!/usr/bin/env node
const fs = require('fs'); const path = require('path');
function* walk(dir){ for(const e of fs.readdirSync(dir,{withFileTypes:true})) {
  const p = path.join(dir,e.name);
  if(e.isDirectory() && e.name!=='node_modules' && e.name!=='dist') yield* walk(p);
  else if(e.isFile() && (p.endsWith('.ts')||p.endsWith('.js'))) yield p;
}}
let errors=0;
for(const file of walk('services')){
  const src = fs.readFileSync(file,'utf8');
  const re = /from\s+['"](\.\.?\/[^'"]+)['"]|require\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g;
  let m; while((m=re.exec(src))){
    const rel = (m[1]||m[2]); const base = path.dirname(file);
    const cand = [rel+'.ts', rel+'.js', rel+'/index.ts', rel+'/index.js'].map(s=>path.resolve(base,s));
    if(!cand.some(fs.existsSync)){ console.error(`❌ Broken import in ${file} -> ${rel}`); errors++; }
  }
}
if(errors){ console.error(`🚨 ${errors} broken imports.`); process.exit(1); }
console.log('🎯 No broken relative imports.');
