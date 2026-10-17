import puppeteer from 'puppeteer-core';import fs from 'fs';
const NEW=process.env.NEW||'http://localhost:18080/test-apps/',PREV=process.env.PREV||'http://localhost:18080/prev-apps/';
const SH=process.env.SHOTS||'/workspace/multisys/shots/flood/';fs.mkdirSync(SH,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const R={};
const E0=Date.UTC(2025,11,31,14),NOW=Date.now(),DAY=864e5,mins=t=>Math.round((t-E0)/60e3);
/* synthetic Mimdale-like records (base 0.8 m; BoM classes minor 10 / moderate 12 / major 14), hourly for 25 days */
function rec(fn){const M=[];for(let t=NOW-25*DAY;t<=NOW;t+=3600e3)M.push([mins(t),+fn((t-NOW)/DAY).toFixed(2)]);return M;}
const hump=(d,on,pk,peakLvl,decay)=>d<on?0.8:d<pk?0.8+(peakLvl-0.8)*(d-on)/(pk-on):0.8+(peakLvl-0.8)*Math.exp(-(d-pk)/decay);
const CASES={
  light_runoff:rec(d=>hump(d,-4,-3,3.0,1.5)),           // +2.2 m runoff, onset 4 d ago (below minor)
  big_day2:rec(d=>hump(d,-3.5,-2,12.8,2.5)),             // moderate flood, peak 2 d ago
  big_day9:rec(d=>hump(d,-10.5,-9,12.8,3)),              // peak 9 d ago, river still running ~1.7 m
  big_day20:rec(d=>hump(d,-21.5,-20,12.8,3)),
  none:rec(d=>0.8+0.02*Math.sin(d*3))};
const CLS={minor:10,moderate:12,major:14};
/* the previous build's classifier (last 24 h rise & height above the 7-day low) */
function oldFresh(M){const L=M[M.length-1],d24=M.filter(x=>x[0]<=L[0]-1440).slice(-1)[0],w=M.filter(x=>x[0]>=L[0]-7*1440);const mn=Math.min(...w.map(x=>x[1]));
  const rise24=d24?L[1]-d24[1]:0,above=L[1]-mn;return{lvl:above>0.5||rise24>0.3?'flood':above>0.1||rise24>0.08?'fresh':null,name:'Mimdale',level:L[1],rise24,above,at:Date.UTC(2025,11,31,14)+L[0]*60e3};}
async function page(intercept){const ctx=await b.createBrowserContext();const p=await ctx.newPage();p.errs=[];
  p.on('pageerror',e=>p.errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|tile|ERR_|404/i.test(m.text()))p.errs.push(m.text());});
  if(intercept){await p.setBypassServiceWorker(true);await p.setRequestInterception(true);p.on('request',r=>{const h=intercept(r.url());if(h)r.respond(h);else r.continue();});}
  await p.setViewport({width:420,height:900,deviceScaleFactor:2,isMobile:true,hasTouch:true});return p;}
const ready=async p=>{await p.waitForSelector('body[data-bite-ready="1"]',{timeout:90000});await sleep(300);};
const today=new Date(NOW+36e6).toISOString().slice(0,10);
// 1) synthetic cases: new model vs previous build (same day, Private spot 8 position, tide model on, no weather -> isolates the flood term)
async function scores(base,mk){const p=await page();await p.goto(base+'?r='+Date.now()+'#bite',{waitUntil:'domcontentloaded'});await ready(p);
  const out=await p.evaluate((CASES,CLS,today,mkSrc)=>{const mk=eval(mkSrc);const [la,ln]=BT.pointAtKm(19.97);const o={};
    for(const k in CASES){const F=mk(CASES[k],CLS);const run=(fr,ds)=>MJ.computeDay({dateStr:ds,tz:'Australia/Brisbane',lat:la,lng:ln,fresh:fr});
      const days=[0,1,2,3,4,5,6].map(i=>MJ.addDays(today,i));
      o[k]={state:F&&(F.kind||F.lvl)||null,day:F&&F.peakT?((Date.now()-F.peakT)/864e5).toFixed(1):null,
        with:days.map(ds=>run(F,ds).rating),without:days.map(ds=>run(null,ds).rating),
        chip:(()=>{const d=run(F,today);return d.wxDay&&d.wxDay.fresh?(d.wxDay.fresh.chip||d.wxDay.fresh.note):null;})()};}
    return o;},CASES,CLS,today,mk);
  const e=p.errs;await p.browserContext().close();return{out,errs:e};}
R.synthNew=await scores(NEW,'(M,C)=>MJ.floodState(M,C)');
R.synthPrev=await scores(PREV,'('+oldFresh.toString()+')');
// 2) real data, new build: Baffle + Burnett bite chips + Gauges tab text
for(const [nm,q] of [['baffle',''],['burnett','?sys=burnett-river']]){const p=await page();await p.goto(NEW+(q||'?')+(q?'&':'')+'r='+Date.now()+'#bite',{waitUntil:'domcontentloaded'});await ready(p);
  if(nm==='baffle'){await p.evaluate(()=>{document.body.dataset.biteReady='';const [la,ln]=BT.pointAtKm(19.97);FT.biteSetLoc({name:'km 20 — Baffle Ck',lat:la,lng:ln,tz:'Australia/Brisbane',baffleKm:19.97});});await ready(p);}
  R['real_'+nm]=await p.evaluate(()=>({fresh:window.__MJ_STATE.fresh,stat:[...document.querySelectorAll('#mj-stats .stat')].map(x=>x.innerText.replace(/\s+/g,' ')).find(x=>/Storm/.test(x))}));
  await p.evaluate(()=>{location.hash='#gauges';});await sleep(4000);
  R['gauges_'+nm]=await p.evaluate(()=>{const e=document.querySelector('#gFresh .gflood');return e&&e.innerText.replace(/\s+/g,' ');});
  R['errs_'+nm]=p.errs;await p.browserContext().close();}
// 3) UI with a synthetic big flood 9 days ago on Mimdale (intercepted data) -> prime chip, window reason, outlook badge, Gauges flag
{const M=CASES.big_day9;const csv='time_aest,level_m\n'+M.map(([m,v])=>new Date(E0+m*60e3+36e6).toISOString().slice(0,16).replace('T',' ')+','+v.toFixed(3)).join('\n');
 const G=JSON.parse(fs.readFileSync('/tmp/site-test/data/gauges.json','utf8'));G.series.mimdale=M.slice(-200);G.latest.mimdale=M[M.length-1];
 const p=await page(u=>/data\/539132_mimdale\.csv/.test(u)?{status:200,contentType:'text/csv',body:csv}:/data\/gauges\.json/.test(u)?{status:200,contentType:'application/json',body:JSON.stringify(G)}:null);
 await p.goto(NEW+'?r='+Date.now()+'#bite',{waitUntil:'domcontentloaded'});await ready(p);
 await p.evaluate(()=>{document.body.dataset.biteReady='';const [la,ln]=BT.pointAtKm(19.97);FT.biteSetLoc({name:'km 20 — Baffle Ck',lat:la,lng:ln,tz:'Australia/Brisbane',baffleKm:19.97});});await ready(p);
 R.ui9=await p.evaluate(()=>{const S=window.__MJ_STATE;return{fresh:{kind:S.fresh.kind,peak:S.fresh.peak,peakCls:S.fresh.peakCls},
   stat:[...document.querySelectorAll('#mj-stats .stat')].map(x=>x.innerText.replace(/\s+/g,' ')).find(x=>/Storm/.test(x)),
   reason:[...document.querySelectorAll('#mj-windows li')].map(x=>x.innerText).find(x=>/flood/i.test(x)),
   badges:[...document.querySelectorAll('#mj-days .day .wxb')].map(x=>x.innerText)};});
 await p.evaluate(()=>document.getElementById('mj-stats').scrollIntoView());await p.screenshot({path:SH+'bite-postflood-day9.png'});
 await p.evaluate(()=>document.getElementById('mj-days').scrollIntoView());await p.screenshot({path:SH+'week-postflood-day9.png'});
 await p.evaluate(()=>{location.hash='#gauges';});await sleep(4000);
 R.gauges9=await p.evaluate(()=>{const e=document.querySelector('#gFresh .gflood');return e&&e.innerText.replace(/\s+/g,' ');});
 await p.evaluate(()=>document.getElementById('gFresh').scrollIntoView());await p.screenshot({path:SH+'gauges-prime.png'});
 R.errs_ui9=p.errs;await p.browserContext().close();}
console.log(JSON.stringify(R,null,1));await b.close();
