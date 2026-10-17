// Live-adjustment regression: with data/baffle_adj.json unavailable (adjustments zero) the new build must give identical
// Baffle predictions / UI to the base build; with the live file it must differ only by the expected adjustment terms.
import puppeteer from 'puppeteer-core';
const BASE=process.argv[2]||'http://localhost:18080/fishing-apps/',TEST=process.argv[3]||'http://localhost:18080/test-apps/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function grab(url,blockAdj){const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  if(blockAdj){await p.setRequestInterception(true);p.on('request',r=>/baffle_adj\.json/.test(r.url())?r.respond({status:404,body:''}):r.continue());}
  await p.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await p.goto(url+'#baffle',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});await sleep(800);
  const model=await p.evaluate(()=>{const B=window.BT,o=window.FT.baffleOpts();const out={};const nh=Math.floor(B.nowH()/24)*24;
    for(const h0 of [nh-120,nh-48,nh,nh+24,nh+72,B.dateToH(2026,12,24,0,0),B.dateToH(2027,3,15,0,0)]){
      for(const [km,line] of [[0,null],[3.4,null],[8,null],[15.9,null],[20,null],[25.24,'E'],[28,'E'],[30,null],[35.25,null],[37,null],[33,'E']]){const oo=Object.assign({},o,line?{line}:{});const P=B.predictAt(km,h0,h0+48,oo);
        out[h0+'@'+km+(line||'')]={ext:P.inWin.map(e=>[+e.t.toFixed(4),+e.h.toFixed(4),e.hi,e.u,!!e.weak,!!e.stand]),ri:B.runInStarts(km,h0,h0+48,oo).map(r=>[+r.t.toFixed(4),r.u,r.kind]),c:[P.curve(h0+5.5),P.curve(h0+17.25)].map(v=>v==null?null:+v.toFixed(4))};}}
    for(const s of (B.SIDES||[]).slice(0,4)){const P=B.predictAt(s.jk+0.5,nh,nh+48,Object.assign({},o,{line:s.id}));out['side '+s.id]=P.inWin.map(e=>[+e.t.toFixed(4),+e.h.toFixed(4),e.hi]);}
    return out;});
  const ui=await p.evaluate(()=>({stretch:document.querySelector('#bt-stretch').innerText.slice(0,3000),stats:document.querySelector('#bt-stats').innerText,warn:document.querySelector('#bt-locWarn').innerText}));
  await ctx.close();return{model,ui,errs};}
const A=await grab(BASE,false),Z=await grab(TEST,true),L=await grab(TEST,false);
let dz=0,dl=0,dlf=0;for(const k in A.model){const a=JSON.stringify(A.model[k]);if(a!==JSON.stringify(Z.model[k])){dz++;if(dz<3)console.log('ZERO-ADJ DIFF',k,a.slice(0,160),'\n  ',JSON.stringify(Z.model[k]).slice(0,160));}
  if(a!==JSON.stringify(L.model[k])){dl++;if(+k.split('@')[0]>Date.now()/36e5)dlf++;}}
console.log('keys',Object.keys(A.model).length,'| adj zero: diffs',dz,'| live adj: diffs',dl);
console.log('adj zero UI same: stretch',A.ui.stretch===Z.ui.stretch,'stats',A.ui.stats===Z.ui.stats,'warn',A.ui.warn===Z.ui.warn);
// far-future windows must be unchanged even with live data
const hs=[...new Set(Object.keys(A.model).filter(k=>/^\d/.test(k)).map(k=>+k.split('@')[0]))].sort((a,b)=>a-b);const far=Object.keys(A.model).filter(k=>/^\d/.test(k)&&+k.split("@")[0]>=hs[5]);
console.log('live adj, far-future windows (Dec, Mar) unchanged:',far.every(k=>JSON.stringify(A.model[k])===JSON.stringify(L.model[k])),far.length);
console.log('live warn:',L.ui.warn.slice(0,300));
console.log('errs',A.errs,Z.errs,L.errs);
await b.close();process.exit(dz?1:0);
