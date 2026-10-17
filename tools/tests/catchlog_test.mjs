import puppeteer from 'puppeteer-core';
import fs from 'fs';
const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';
const PH=process.env.PHASE||'local';   // local: log/export/import/share(TEST) ; com: view community only
const SH='/workspace/fishing-site-src/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const ctx=await b.createBrowserContext();
const origin=new URL(BASE).origin;
await ctx.overridePermissions(origin,['geolocation']);
const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon/.test(m.text()))errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept());
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.setGeolocation({latitude:-24.5195,longitude:152.0262,accuracy:12}); // ~km 5 on Baffle Ck
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const R={};
const relay=[];p.on('request',r=>{if(r.url().includes('ntfy.sh'))relay.push({m:r.method(),body:r.postData()});});
await p.goto(BASE+'#bite',{waitUntil:'domcontentloaded'});
await p.evaluate(()=>{localStorage.clear();localStorage.setItem('mj_loc',JSON.stringify({name:'Flat Rock Rd ramp — Baffle Ck',lat:-24.5187,lng:152.0258,tz:'Australia/Brisbane',baffleKm:5.77}));
  if(location.search.includes('t'))0;});
if(PH==='local'||process.env.TESTVIEW)await p.evaluate(()=>localStorage.setItem('mbj_test','1'));
await p.reload({waitUntil:'networkidle0'});
await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
await p.waitForSelector('body[data-log-ready="1"]');
R.keys0=await p.evaluate(()=>Object.keys(localStorage).sort());
const H=async(sel)=>{await p.$eval(sel,e=>e.scrollIntoView({block:'center'}));await p.click(sel);};
const setv=(sel,v)=>p.$eval(sel,(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));},v);
const local=ms=>{const d=new Date(ms+36e6);return d.toISOString().slice(0,16);};
await p.click('nav.tabs a[data-tab=log]');await sleep(300);
R.tab=await p.evaluate(()=>document.body.dataset.tab);
if(PH==='local'){
  // 1) live session via GPS
  await H('#cStart');await p.waitForSelector('#cBite',{timeout:20000});
  R.active=await p.$eval('#cActive',e=>e.innerText.replace(/\n/g,' | '));
  await H('#cBite');await sleep(200);
  await p.select('#cSp','MJ');await setv('#cLen','42');await p.select('#cFate','released');
  await H('#cAddCatch');await sleep(100);
  await p.select('#cSp','MJ');await setv('#cN','1');await p.select('#cFate','bite');await H('#cAddCatch');
  await p.select('#cBaitCat','plastic');await p.type('#cBait','3" prawn');
  // pretend we started 2 h ago (edit start)
  await setv('#cS0',local(Date.now()-2*3600e3));
  await H('#cSave');await sleep(300);
  R.formMsg=await p.$eval('#cFormMsg',e=>e.textContent);
  await p.screenshot({path:SH+'shot-catchlog-active.png'});
  await H('#cEnd');await sleep(800);
  // 2) past no-bite session at a landmark (yesterday evening)
  await H('#cPastBtn');await sleep(200);
  const li=await p.$$eval('#cSpotSel option',os=>os.find(o=>/Bottle Creek/.test(o.textContent)).value);
  await p.select('#cSpotSel',li);
  const y=Date.now()-864e5;const y0=Math.floor(y/9e5)*9e5;
  await setv('#cS0',local(y0-3*3600e3));await setv('#cS1',local(y0));
  await H('#cNoBites');await H('#cSave');await sleep(500);
  // 3) past off-creek session (Burnett River area) with 2 bream kept
  await H('#cPastBtn');await sleep(200);
  await p.select('#cSpotSel','Rburnett');await p.type('#cSpotName','Secret rock wall');
  await setv('#cS0',local(y0-30*3600e3));await setv('#cS1',local(y0-28*3600e3));
  await H('#cYesBites');await setv('#cCt',local(y0-29*3600e3));await p.select('#cSp','BR');await setv('#cN','2');await setv('#cLen','28');await p.select('#cFate','kept');await H('#cAddCatch');
  await p.type('#cNote','private note');await H('#cSave');await sleep(500);
  // 4) invalid: end before start
  await H('#cPastBtn');await sleep(100);await setv('#cS1',local(y0-40*3600e3));await H('#cSave');await sleep(200);
  R.invalidMsg=await p.$eval('#cFormMsg',e=>e.textContent);await H('#cCancel');
  R.log=await p.evaluate(()=>FT.catchLog.log.map(s=>({start:s.start,end:s.end,spot:{kind:s.spot.kind,km:s.spot.km,line:s.spot.line,name:s.spot.name},n:s.catches.length,noBites:s.noBites,
     ctx:s.ctx&&{src:s.ctx.src,tideSrc:s.ctx.tideSrc,wx:s.ctx.wx,slots:s.ctx.slots.length,first:s.ctx.slots[0]},share:s.share})));
  R.list=await p.$eval('#cList',e=>e.innerText.replace(/\n/g,' | '));
  R.mine=await p.$eval('#cMyCharts',e=>e.innerText.replace(/\n/g,' | ').slice(0,300));
  for(const v of ['score','runin','light','moon','stretch','sol']){await p.$eval(`#cMyViews [data-v=${v}]`,e=>e.click());await sleep(100);R['my_'+v]=await p.$$eval('#cMyCharts svg rect[opacity]',rs=>rs.map(r=>r.querySelector('title')&&r.querySelector('title').textContent));}
  await p.$eval('#cMyViews [data-v=score]',e=>e.click());
  await p.$eval('#cMyCharts',e=>e.scrollIntoView({block:'start'}));await sleep(200);
  await p.screenshot({path:SH+'shot-catchlog-mine.png'});
  // export
  await p.evaluate(()=>FT.catchLog.exportCSV());R.export=await p.evaluate(()=>window.__MBJ_LAST_EXPORT);
  fs.writeFileSync('/tmp/mbj_export.csv',R.export);
  // share (TEST mode)
  await H('#cShareOn');await sleep(300);
  R.shareInfo1=await p.$eval('#cShareInfo',e=>e.innerText);
  await p.evaluate(()=>document.getElementById('cShareOld')&&document.getElementById('cShareOld').click());
  await sleep(4000);
  R.shareInfo2=await p.$eval('#cShareInfo',e=>e.innerText);
  R.shares=await p.evaluate(()=>FT.catchLog.log.map(s=>s.share));
  R.relay=relay.map(x=>({m:x.m,body:x.body&&x.body.slice(0,400)}));
  // delete the off-creek session (shared) -> del message
  const offId=await p.evaluate(()=>FT.catchLog.log.find(s=>s.spot.kind==='region').id);
  await p.$eval(`[data-rm="${offId}"]`,e=>e.click());await sleep(2500);
  R.relayAfterDel=relay.slice(-1).map(x=>x.body);
  R.queue=await p.evaluate(()=>localStorage.getItem('mbj_shareq'));
  await p.$eval('#cList',e=>e.scrollIntoView({block:'start'}));await sleep(200);
  await p.screenshot({path:SH+'shot-catchlog-list.png'});
  // import into a clean profile
  const p2=await (await b.createBrowserContext()).newPage();await p2.goto(BASE+'#log',{waitUntil:'domcontentloaded'});await p2.waitForSelector('body[data-log-ready="1"]');
  R.import=await p2.evaluate(t=>{const r=FT.catchLog.importCSV(t);return{r,n:FT.catchLog.log.length,ctx:FT.catchLog.log.map(s=>s.ctx&&s.ctx.slots.length)};},R.export);
  R.importAgain=await p2.evaluate(t=>FT.catchLog.importCSV(t),R.export);
  // other tabs still fine
  for(const t of ['bite','baffle','gauges']){await p.click(`nav.tabs a[data-tab=${t}]`);await sleep(200);}
  R.keys1=await p.evaluate(()=>Object.keys(localStorage).sort());
}else{
  await p.waitForFunction(()=>document.querySelector('#cComCharts svg')||document.querySelector('#cComCharts .cempty'),{timeout:30000});
  await sleep(500);
  R.comSum=await p.$eval('#cComSum',e=>e.textContent);R.com=await p.$eval('#cComCharts',e=>e.innerText.replace(/\n/g,' | ').slice(0,400));R.comNote=await p.$eval('#cComNote',e=>e.innerText);
  for(const v of ['score','runin','light','moon','stretch','sol']){await p.$eval(`#cComViews [data-v=${v}]`,e=>e.click());await sleep(100);R['com_'+v]=await p.$$eval('#cComCharts svg rect[opacity] title',ts=>ts.map(t=>t.textContent));}
  await p.$eval('#cComViews [data-v=stretch]',e=>e.click());
  await p.$eval('#cComHead',e=>e.parentElement.scrollIntoView({block:'start'}));await sleep(200);
  await p.screenshot({path:SH+'shot-catchlog-community'+(process.env.SUF||'')+'.png'});
  R.ver=await p.evaluate(()=>document.querySelector('meta[name=app-version]').content);
}
R.errs=errs;
console.log(JSON.stringify(R,null,1));
await b.close();
