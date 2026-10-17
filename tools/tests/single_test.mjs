import puppeteer from 'puppeteer-core';
const NEW=process.env.NEW||'http://localhost:18080/test-apps/',OLD=process.env.OLD||'http://localhost:18080/fishing-apps/';
const SH='/workspace/multisys/shots/single/';const SYS=(process.env.SYSL||'burnett-river,mary-river,noosa-river,brisbane-river,kolan-river').split(',');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function page(url,fakeNow){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.evaluateOnNewDocument(()=>{window.__DC_OPEN=1;});const errs=[];
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::/.test(m.text()))errs.push('console: '+m.text());});
  await p.setBypassServiceWorker(true);
  if(fakeNow)await p.evaluateOnNewDocument(T=>{const D=Date,off=T-D.now();class FD extends D{constructor(...a){super(...(a.length?a:[D.now()+off]));}static now(){return D.now()+off;}}window.Date=FD;},fakeNow);
  await p.setViewport({width:400,height:850,deviceScaleFactor:1.5,isMobile:true,hasTouch:true});
  await p.goto(url,{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:90000});
  return{p,ctx,errs};}
const modelDump=p=>p.evaluate(()=>{const B=window.BT,o=window.FT.baffleOpts();const out={};const kms=B.generic?[0,5,B.REFKM||10,20,30]:[];
  for(const ds of [[2026,10,5],[2026,10,18],[2026,12,24]]){const h0=B.dateToH(ds[0],ds[1],ds[2],0,0);
    for(const km of kms){const P=B.predictAt(km,h0,h0+48,o);out[ds.join('-')+'@'+km]={e:P.inWin.map(e=>[+e.t.toFixed(4),+e.h.toFixed(4),e.hi,!!e.weak]),r:B.runInStarts(km,h0,h0+48,o).map(r=>[+r.t.toFixed(4),r.kind]),c:[P.curve(h0+5.5),P.curve(h0+17.25)]};}}
  return{out,stats:document.querySelector('#bt-stats').innerText,stretch:document.querySelector('#bt-stretch').innerText};});
let fails=0;const ck=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)fails++;};
// ---- A: other systems unaffected
for(const id of SYS){const A=await page(OLD+'?sys='+id+'#baffle'),N=await page(NEW+'?sys='+id+'#baffle');
  const a=await modelDump(A.p),n=await modelDump(N.p);let d=0;for(const k in a.out)if(JSON.stringify(a.out[k])!==JSON.stringify(n.out[k]))d++;
  ck(d===0&&Object.keys(a.out).length>0,`${id}: model ${Object.keys(a.out).length} cases, ${d} diffs; tides stats same ${a.stats===n.stats}; stretch same ${a.stretch===n.stretch}; errs ${N.errs.length}`);
  if(N.errs.length)console.log(N.errs);await A.ctx.close();await N.ctx.close();}
// ---- B: Baffle UI on a single-high day
{const {p,ctx,errs}=await page(NEW+'#baffle');
 await p.evaluate(()=>{FT.setDate('2026-10-18','x');FT.baffleSelect(27.68,'Sleepy Creek junction','B');});await sleep(800);
 const r=await p.evaluate(()=>({stats:document.querySelector('#bt-stats').innerText,warn:document.querySelector('#bt-locWarn').innerText,week:document.querySelector('#bt-week').innerText,stretch:[...document.querySelectorAll('#bt-stretch tr')].map(t=>t.innerText.replace(/\s+/g,' ')),chart:document.querySelector('#bt-chart').innerHTML.includes('stand (no rise)')}));
 ck(/Tide stand/.test(r.stats),'Tides day cards show a tide stand at 27.68 km on 18 Oct');ck(/Single-high day here/.test(r.warn),'single-high notice');ck(/stand \(no rise\)/.test(r.week),'week view stand');ck(r.chart,'chart stand marker');
 const row=n=>r.stretch.find(x=>x.includes(n))||'';console.log('   stretch:',['Wartburg','Hills Rd','Sleepy','Essendean'].map(n=>row(n).slice(0,90)).join('\n            '));
 ck(/stand/.test(row('Essendean'))&&/stand/.test(row('Sleepy'))&&!/stand/.test(row('Hills Rd'))&&!/stand/.test(row('Wartburg')),'whole-creek table: stand at Sleepy/Essendean, not Hills Rd (Euleilah) / Wartburg');
 await p.screenshot({path:SH+'tides-18oct.png',fullPage:true});
 // Hills Rd selected: no stand
 await p.evaluate(()=>FT.baffleSelect(25.24,'Hills Rd gauge (Euleilah Ck)','E'));await sleep(500);ck(!/Tide stand/.test(await p.evaluate(()=>document.querySelector('#bt-stats').innerText)),'Hills Rd (Euleilah) keeps both highs');
 // benchmark types
 await p.evaluate(()=>FT.baffleSelect(23.05,null,'B'));await sleep(300);
 const bt=await p.evaluate(()=>{const s=document.querySelector('#bt-bType');s.value='SH1';document.querySelector('#bt-bTime').value='2026-10-05T10:00';document.querySelector('#bt-bAdd').click();
   s.value='SH2';document.querySelector('#bt-bTime').value='2026-10-06T10:00';document.querySelector('#bt-bAdd').click();
   s.value='SH1';document.querySelector('#bt-bTime').value='2026-10-07T10:00';document.querySelector('#bt-bAdd').click();
   return{rows:[...document.querySelectorAll('#bt-bTable tr')].map(t=>t.innerText.replace(/\s+/g,' ')),sum:document.querySelector('#bt-bSummary').innerText};});
 bt.rows.forEach(x=>console.log('   bench:',x.slice(0,200)));console.log('   ',bt.sum);
 ck(bt.rows.filter(x=>/✓ match/.test(x)).length===2&&bt.rows.some(x=>/✗ threshold/.test(x)),'benchmarks: 5 Oct single ✓, 6 Oct both ✓, 7 Oct single ✗');
 // apply the mismatch → threshold rises near 23 km
 const thr=await p.evaluate(()=>{const B=BT,h=B.dateToH(2026,10,7,0,0);const before=B.supThr(23.05,FT.baffleOpts());const cb=[...document.querySelectorAll('#bt-bTable [data-a]')];cb[2].click();
   const o=FT.baffleOpts();return{before,after:B.supThr(23.05,o),corr:o.corr,stand7:B.predictAt(23.05,h,h+24,o).ext.filter(e=>e.stand&&e.t>=h&&e.t<h+24).length};});
 console.log('   apply:',JSON.stringify(thr));ck(thr.after>thr.before&&thr.stand7===1,'applied single-high benchmark raises threshold & makes 7 Oct single at 23 km');
 await p.evaluate(()=>{document.querySelector('#bt-bClear');window.confirm=()=>true;document.querySelector('#bt-bClear').click();});
 // bite times
 await p.evaluate(()=>{const km=27.68,pt=BT.pointAtKm(km);FT.biteSetLoc({name:'Sleepy test — Baffle Ck',lat:pt[0],lng:pt[1],tz:'Australia/Brisbane',baffleKm:km,baffleLine:'B'});FT.setDate('2026-10-18','bite');});
 await sleep(800);await p.waitForSelector('body[data-bite-ready="1"]',{timeout:90000});
 const bi=await p.evaluate(()=>{const S=window.__MJ_STATE;const d=S.days.find(x=>x.dateStr==='2026-10-18')||S.days[S.sel];return{src:document.querySelector('#mj-tideSrc').innerText,ri:(d.runIns||[]).map(r=>new Date(r.t+36e6).toISOString().slice(11,16)+' '+r.kind),ext:(d.ext||[]).length};});
 console.log('   bite src:',bi.src.slice(-330));console.log('   run-ins 18 Oct:',bi.ri);
 ck(/Single-high day here/.test(bi.src),'bite tide-source note');ck(bi.ri.length===1,'one run-in start on the single-high day');
 await p.evaluate(()=>FT.showTab('bite'));await sleep(500);await p.screenshot({path:SH+'bite-18oct.png'});
 ck(errs.length===0,'no page errors '+JSON.stringify(errs));await ctx.close();}
// ---- C: map popup + gauge spots with "now" = 18 Oct 04:00 AEST
{const {p,ctx,errs}=await page(NEW+'#gauges',Date.UTC(2026,9,17,18,0));
 await p.evaluate(()=>FT.showTab('gauges'));await sleep(2500);
 const g=await p.evaluate(async()=>{document.querySelector('#gSpots details').open=true;const btn=[...document.querySelectorAll('#gSpots [data-sp]')].find(x=>/Sleepy/.test(x.textContent));if(btn)btn.click();await new Promise(r=>setTimeout(r,1500));
   return{cards:[...document.querySelectorAll('.gsp-card')].map(c=>c.innerText.replace(/\s+/g,' ')),svg:document.body.innerHTML.includes('>stand</text>')};});
 console.log('   gauge cards:',g.cards);ck(g.cards.some(c=>/stand/.test(c)),'gauge spot card shows the stand');ck(g.svg,'gauge chart stand marker');
 await p.screenshot({path:SH+'gauges-18oct.png'});
 await p.evaluate(()=>FT.showTab('map'));await sleep(3000);
 const m=await p.evaluate(async()=>{const l0=BT.LANDMARKS.find(l=>/Sleepy Creek junction/.test(l.name));FT.mapDebug.openSpot(l0.id);await new Promise(r=>setTimeout(r,1200));const el=document.querySelector('.mpop');return el?el.innerText.replace(/\s+/g,' '):null;});
 console.log('   map popup:',m);ck(m&&/Tide stand/.test(m),'map popup shows the tide stand');await p.screenshot({path:SH+'map-18oct.png'});
 const pop=await p.evaluate(async()=>{const mk=[...document.querySelectorAll('#mMap .leaflet-interactive')];return mk.length;});console.log('   map interactive layers',pop);
 ck(errs.length===0,'no page errors (fake-now) '+JSON.stringify(errs));await ctx.close();}
console.log(fails?`\n${fails} FAILED`:'\nALL OK');await b.close();
