import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function grab(url){const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
  await p.setViewport({width:400,height:850,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await p.goto(url,{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
  const model=await p.evaluate(()=>{const B=window.BT,o=window.FT.baffleOpts();const out={};
    for(const ds of [[2026,10,10],[2026,11,3],[2026,12,24],[2027,3,15]]){const h0=B.dateToH(ds[0],ds[1],ds[2],0,0);
      for(const km of [0,3.4,8,15.9,20,25.24,30,35.25,37]){const P=B.predictAt(km,h0,h0+48,o);
        out[ds.join('-')+'@'+km]={ext:P.inWin.map(e=>[+e.t.toFixed(4),+e.h.toFixed(4),e.hi,e.u,!!e.weak]),ri:B.runInStarts(km,h0,h0+48,o).map(r=>[+r.t.toFixed(4),r.u,r.kind]),c:[P.curve(h0+5.5),P.curve(h0+17.25)].map(v=>v==null?null:+v.toFixed(4))};}}
    return out;});
  const ui=await p.evaluate(()=>({stretch:document.querySelector('#bt-stretch').innerText.slice(0,3000),stats:document.querySelector('#bt-stats').innerText,lm:document.querySelector('#bt-lm').options.length,bafSel:document.querySelector('#mj-bafSel').options.length}));
  // bite at Wartburg
  await p.evaluate(()=>{const km=15.9,pt=window.BT.pointAtKm(km);window.FT.biteSetLoc({name:'Wartburg test — Baffle Ck',lat:pt[0],lng:pt[1],tz:'Australia/Brisbane',baffleKm:km});});
  await sleep(500);await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
  const bite=await p.evaluate(()=>{const S=window.__MJ_STATE;return{src:document.querySelector('#mj-tideSrc').innerText,days:S.days.slice(0,3).map(d=>({ds:d.dateStr,ri:(d.runIns||[]).map(r=>[r.t,r.u,r.kind]),sc:d.pts.filter((x,i)=>i%8===0).map(x=>x.score)}))};});
  await ctx.close();return{model,ui,bite,errs};}
const A=await grab('http://localhost:18080/base-apps/#baffle');
const B=await grab('http://localhost:18080/test-apps/#baffle');
let diff=0;for(const k in A.model){if(JSON.stringify(A.model[k])!==JSON.stringify(B.model[k])){diff++;if(diff<4)console.log('MODEL DIFF',k,JSON.stringify(A.model[k]).slice(0,200),'\n   ',JSON.stringify(B.model[k]).slice(0,200));}}
console.log('model keys',Object.keys(A.model).length,'diffs',diff);
console.log('stretch same',A.ui.stretch===B.ui.stretch,'stats same',A.ui.stats===B.ui.stats,'lm',A.ui.lm,B.ui.lm,'bafSel',A.ui.bafSel,B.ui.bafSel);
if(A.ui.stats!==B.ui.stats)console.log(A.ui.stats,'\n---\n',B.ui.stats);
console.log('bite src same',A.bite.src===B.bite.src);if(A.bite.src!==B.bite.src)console.log(A.bite.src,'\n',B.bite.src);
console.log('bite days same',JSON.stringify(A.bite.days)===JSON.stringify(B.bite.days));
if(JSON.stringify(A.bite.days)!==JSON.stringify(B.bite.days))console.log(JSON.stringify(A.bite.days).slice(0,300),'\n',JSON.stringify(B.bite.days).slice(0,300));
console.log('errs base',A.errs,'\nerrs new',B.errs);
await b.close();
