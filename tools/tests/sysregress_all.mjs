import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
async function run(base,ids){const p=await (await b.createBrowserContext()).newPage();await p.goto(base+'#baffle',{waitUntil:'networkidle0',timeout:120000});
  await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});
  return p.evaluate(async(ids)=>{const out={};const I=ids||(await (await fetch('data/systems/index.json')).json()).systems.map(s=>s.id);
    for(const id of I){let S;try{S=await (await fetch('data/systems/'+id+'.json')).json();}catch(e){out[id]='missing';continue;}
      const B=window.FT.makeSystemBT(S);const r={};
      for(const L of S.lines){const top=L.junctionKm+L.limitKm;for(const f of [0,0.3,0.6,1]){const km=+(L.junctionKm+(L.id==='M'?f*top:f*L.limitKm)).toFixed(3);
        for(const h0 of [7000,7400,8500]){const P=B.predictAt(km,h0,h0+30,{line:L.id});r[L.id+'@'+km+'@'+h0]={e:P.inWin.map(e=>[+e.t.toFixed(4),+e.h.toFixed(4),e.hi,e.u]),ri:B.runInStarts(km,h0,h0+30,{line:L.id}).map(x=>+x.t.toFixed(4)),c:B.calAt(km,{line:L.id}).hwLag};}}}
      out[id]=r;}
    return{ids:I,out};},ids);}
const A=await run('http://localhost:18080/fishing-apps/');
const B=await run('http://localhost:18080/test-apps/',A.ids);
let same=0,diff=[],pum={same:0,diff:0,diffKeys:[]};
for(const id of A.ids){const a=A.out[id],c=B.out[id];
  if(id==='pumicestone-passage'){for(const k in a){if(!(k in c))continue;const [ln,km]=k.split('@');const eq=JSON.stringify(a[k])===JSON.stringify(c[k]);if(eq)pum.same++;else{pum.diff++;pum.diffKeys.push(k);}}continue;}
  if(c==='missing'){diff.push(id+' (merged/removed)');continue;}
  if(JSON.stringify(a)===JSON.stringify(c))same++;else diff.push(id);}
console.log('systems identical',same,'of',A.ids.length-1,'| differing:',diff.join(', ')||'none');
console.log('pumicestone keys identical',pum.same,'changed',pum.diff,'changed keys (should all be passage km >14.83 or side creeks off it):',[...new Set(pum.diffKeys.map(k=>k.split('@').slice(0,2).join('@')))].join(' '));
await b.close();
