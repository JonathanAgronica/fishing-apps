import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const SH=process.env.SHOTS||'/workspace/multisys/shots/cal/';
import fs from 'fs';fs.mkdirSync(SH,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ck=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)fails++;};
const PERF={};
async function page(sys,o={}){const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[],reqs=[];
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::/.test(m.text()))errs.push('console: '+m.text());});
  p.on('request',r=>reqs.push(r.url()));
  if(!o.sw)await p.setBypassServiceWorker(true);await p.setViewport({width:400,height:860,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  if(o.cpu)await p.emulateCPUThrottling(o.cpu);
  await p.goto(BASE+'?sys='+sys+'#'+(o.tab||'cal'),{waitUntil:o.cpu?'domcontentloaded':'networkidle0',timeout:180000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:90000});
  return{p,ctx,errs,reqs};}
const waitDone=async(p,ms=900000)=>{await p.waitForFunction(()=>document.body.dataset.calDone&&document.body.dataset.calDone===String(FT.cal.st.gen),{timeout:ms,polling:200});};
const plus=n=>{const d=new Date(Date.now()+10*3600e3+n*864e5);return d.toISOString().slice(0,10);};
async function biteMatch(p,ds,pred,label){ /* click 'Bite times here' for the sheet target matching pred, compare windows with the Bite tab */
  const info=await p.evaluate((pred)=>{const sh=FT.cal.st.sheet;const f=new Function('x','return '+pred);const all=sh.top.map(x=>({x,src:'top'})).concat(sh.mine.filter(m=>m.w).map(m=>({x:m.w,src:'mine'})));
    const hit=all.find(a=>f(a.x));if(!hit)return null;const k=sh.targets.indexOf(hit.x.pt);return{k,score:hit.x.score,start:hit.x.w.start,end:hit.x.w.end,name:hit.x.pt.name,km:hit.x.pt.km,src:hit.src};},pred);
  if(!info||info.k<0){ck(false,label+': no sheet target');return null;}
  await p.evaluate(k=>{document.querySelectorAll('#calSheetB [data-act="bite"]')[0];const b=[...document.querySelectorAll('#calSheetB [data-act="bite"]')].find(x=>+x.dataset.k===k);b.click();},info.k);
  await sleep(300);await p.waitForFunction(ds=>document.body.dataset.biteReady==='1'&&window.__MJ_STATE&&window.__MJ_STATE.dateStr===ds,{timeout:90000},ds);await sleep(300);
  const bite=await p.evaluate(()=>{const s=window.__MJ_STATE,d=s.days[0];return{tab:document.body.dataset.tab,loc:document.getElementById('mj-locInfo').innerText.slice(0,80),wins:d.windows.map(w=>({score:w.score,start:w.start,end:w.end})),best:Math.max(...d.pts.map(q=>q.score)),spotType:s.spotType||null};});
  const m=bite.wins.find(w=>w.start===info.start&&w.end===info.end);
  console.log('   ',label,JSON.stringify({cal:{score:info.score,start:new Date(info.start).toISOString(),name:info.name,src:info.src},bite:{tab:bite.tab,loc:bite.loc,wins:bite.wins.map(w=>w.score+'@'+new Date(w.start).toISOString().slice(11,16)),spotType:bite.spotType}}));
  ck(bite.tab==='bite'&&m&&m.score===info.score,`${label}: Bite tab shows the same window ${new Date(info.start).toISOString().slice(11,16)}Z score ${info.score} (Bite: ${m?m.score:'none'})`);
  return{info,bite};}
// ============ 4. Phone-class CPU (4× throttle): Baffle whole system first month + total ============
{const t0=Date.now();const {p,ctx}=await page('baffle&calmain=1',{cpu:4});await p.waitForFunction(()=>FT.cal&&FT.cal.st.perf&&FT.cal.st.perf.blocks&&FT.cal.st.perf.blocks.length>=1,{timeout:600000,polling:200});
 const first=Date.now()-t0;await waitDone(p);const P=await p.evaluate(()=>FT.cal.st.perf);PERF.baffle_cpu4_mainthread={firstMonthWallMs:first,totalMs:P.totalMs,pts:P.pts,days:P.days,firstBlockMs:P.blocks[0].ms};
 const resp=await p.evaluate(async()=>{const t=performance.now();await new Promise(r=>setTimeout(r,0));return performance.now()-t;});
 ck(P.totalMs>0,`4× CPU throttle (main-thread fallback, as CDP can't throttle workers): first month on screen after ${(first/1000).toFixed(1)} s (incl. page load), all ${P.days} days in ${(P.totalMs/1000).toFixed(1)} s`);
 const det=await p.evaluate(async d=>{const t=performance.now();await FT.cal.openDay(d);return performance.now()-t;},plus(5));PERF.baffle_cpu4_mainthread.detailMs=Math.round(det);ck(det<4000,`4× CPU: day detail (15-min refine) in ${Math.round(det)} ms`);await ctx.close();}
// ============ 5. Offline: SW-installed profile, go offline, reload → calendar from cache; new scope still computes ============
{const {p,ctx,errs}=await page('baffle',{sw:true});await waitDone(p);await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload({waitUntil:'networkidle0'});await waitDone(p);
 await p.setOfflineMode(true);await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await waitDone(p,120000);
 const P=await p.evaluate(()=>({perf:FT.cal.st.perf,scored:document.querySelectorAll('#calGrid .cs').length,cells:document.querySelectorAll('#calGrid button.cc[data-d]').length,leg:document.getElementById('calLegend').innerText}));
 ck(P.perf.cached>=365&&P.scored===P.cells,`offline reload: ${P.perf.cached} days from the on-phone cache, grid filled`);
 const dd=await p.evaluate(()=>{const d=document.getElementById('calDD');d.checked=true;d.onchange();return document.querySelectorAll('#calGrid .cs').length;});ck(dd>0,'offline: dawn/dusk filter works');
 await p.evaluate(()=>{const l=FT.spots.builtins()[5];const s=document.getElementById('calScope');s.value='lm:'+l.id;s.onchange();});await waitDone(p,300000);
 const P2=await p.evaluate(()=>FT.cal.st.perf);ck(P2.days>=365&&P2.mode==='Web Worker',`offline: new single-spot scope computed in the worker (${(P2.totalMs/1000).toFixed(1)} s)`);
 ck(errs.filter(e=>!/Failed to fetch|ERR_INTERNET|network/i.test(e)).length===0,'offline: no page errors '+JSON.stringify(errs.slice(0,3)));await ctx.close();}
console.log('PERF',JSON.stringify(PERF));
console.log(fails?fails+' FAILED':'ALL OK');await b.close();
