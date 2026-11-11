const fs=require('fs'),path=require('path');
const [,,vidsPath,dataDir,outPath]=process.argv;
const vids=JSON.parse(fs.readFileSync(vidsPath,'utf8'));
const quiz={};const errs=[];
for(const f of fs.readdirSync(dataDir).filter(f=>/^quiz\d\.txt$/.test(f))){
  let cur=null;
  for(const raw of fs.readFileSync(path.join(dataDir,f),'utf8').split(/\r?\n/)){
    const l=raw.trim(); if(!l||l.startsWith('#'))continue;
    if(l.startsWith('@')){cur=+l.slice(1); if(quiz[cur])errs.push('dup quiz '+cur); quiz[cur]=[];continue;}
    const p=l.split('|').map(s=>s.trim()); if(p.length!==4||p.some(s=>!s))errs.push(f+': bad line: '+l);
    if(new Set(p.slice(1)).size!==3)errs.push('dup options: '+l);
    quiz[cur].push(p);
  }
}
const excluded=new Set();
const units=[];let u,c;const used=new Set();
for(const raw of fs.readFileSync(path.join(dataDir,'outline.txt'),'utf8').split(/\r?\n/)){
  const l=raw.trim(); if(!l||l.startsWith('#'))continue;
  if(l.startsWith('X ')){l.slice(2).trim().split(/\s+/).forEach(n=>excluded.add(+n));continue;}
  if(l.startsWith('U ')){const [t,d]=l.slice(2).split('|').map(s=>s.trim());u={title:t,desc:d,chapters:[]};units.push(u);continue;}
  if(l.startsWith('C ')){c={title:l.slice(2).trim(),lessons:[]};u.chapters.push(c);continue;}
  for(const n of l.split(/\s+/).map(Number)){
    const v=vids[n]; if(!v){errs.push('no video '+n);continue;}
    if(used.has(n))errs.push('dup '+n); used.add(n);
    if(!quiz[n]||quiz[n].length<3)errs.push('missing/short quiz '+n+' '+v.t);
    c.lessons.push({id:v.id,title:v.t,len:v.s,quiz:(quiz[n]||[]).map(q=>({q:q[0],a:q.slice(1)}))});
  }
}
for(const k in quiz)if(!used.has(+k))errs.push('quiz for unused '+k);
for(const n of excluded)if(used.has(n))errs.push('excluded but used '+n);
if(used.size+excluded.size!==vids.length)errs.push('used '+used.size+' + excluded '+excluded.size+' of '+vids.length);
if(errs.length){console.log(errs.join('\n'));process.exit(1);}
fs.writeFileSync(outPath,'window.COURSE='+JSON.stringify({channel:'ENGLISH with James · engVid',units})+';\n');
console.log('OK',units.length,'units',units.reduce((a,u)=>a+u.chapters.length,0),'chapters',used.size,'lessons',Object.values(quiz).reduce((a,q)=>a+q.length,0),'questions');
