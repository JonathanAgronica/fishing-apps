import puppeteer from 'puppeteer-core';
import {execSync} from 'child_process';
const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';
const LIVE=!!process.env.LIVE;
const OUT='/workspace/fishing-site-src/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));
p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text()+' @'+(m.location()?.url||''));});
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const R={};
if(!LIVE){
  // ---- Phase A: old separate apps (git HEAD) with their SWs, user data seeded through old UI ----
  await p.goto(BASE+'baffle-tides/',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-ready="1"]');
  await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.select('#lm','0');await p.click('#bNow');await p.select('#bType','HW');await p.type('#bNote','legacy test obs');await p.click('#bAdd');
  await p.goto(BASE+'mangrove-jack/',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-ready="1"]');
  await p.evaluate(()=>navigator.serviceWorker.ready);
  await p.evaluate(()=>{localStorage.setItem('mj_tideoff','20');});
  R.old=await p.evaluate(async()=>({caches:await caches.keys(),regs:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope),bench:JSON.parse(localStorage.getItem('bt_bench')||'[]').length}));
  // ---- swap served dir to new build ----
  execSync('ln -sfn /workspace/fishing-site /tmp/srv/fishing-apps');
}
// ---- Phase B: legacy URL (old SW still controls it) -> redirect ----
await p.goto(BASE+'mangrove-jack/',{waitUntil:'networkidle0'});
await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
R.legacyBite=p.url();
await sleep(2000);
await p.goto(BASE+'baffle-tides/',{waitUntil:'networkidle0'});
await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});
R.legacyBaffle={url:p.url(),tab:await p.evaluate(()=>document.body.dataset.tab)};
await p.evaluate(()=>navigator.serviceWorker.ready);await sleep(2500);
R.afterMigration=await p.evaluate(async()=>({caches:await caches.keys(),regs:(await navigator.serviceWorker.getRegistrations()).map(r=>r.scope),
  bench:JSON.parse(localStorage.getItem('bt_bench')||'[]').length,benchRows:document.querySelectorAll('#bt-bTable tr').length,tideoff:document.querySelector('#mj-tideOff').value,
  manifest:(await (await fetch('manifest.webmanifest')).json()).name}));
// ---- Phase C: bite tab default (Burnett Heads), then Baffle spots ----
const biteInfo=async()=>p.evaluate(()=>{const S=window.__MJ_STATE;const d=S.days[0];
  const f=t=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',hour:'numeric',minute:'2-digit'}).format(new Date(t));
  return{loc:document.querySelector('#mj-locInfo').innerText.split(' · ')[0],src:document.querySelector('#mj-tideSrc').innerText.slice(0,140),
    tides:d.dayExt.map(x=>(x.high?'H ':'L ')+f(x.t)+' '+x.h.toFixed(2)).join(', '),rating:d.rating,
    windows:document.querySelector('#mj-windows').innerText.split('\n').filter(s=>/–|-/.test(s)&&/\d:\d\d/.test(s)).slice(0,4).join(' | '),
    offDisabled:document.querySelector('#mj-tideOff').disabled};});
await p.goto(BASE+'#bite',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bite-ready="1"]');
await p.click('#mj-defBtn');await sleep(300);await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
R.burnett=await biteInfo();
const pick=async name=>{const v=await p.evaluate(n=>{const o=[...document.querySelectorAll('#mj-bafSel option')].find(o=>o.textContent.startsWith(n));return o&&o.value;},name);
  await p.select('#mj-bafSel',v);await sleep(300);await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});return biteInfo();};
const names=await p.evaluate(()=>[...document.querySelectorAll('#mj-bafSel option')].map(o=>o.textContent));
R.landmarks=names;
const wart=names.find(n=>/Wartburg/i.test(n)),ess=names.find(n=>/Essendean/i.test(n)),mouth=names.find(n=>/mouth/i.test(n));
if(mouth)R.mouth=await pick(mouth.split(' (')[0]);
if(wart)R.wartburg=await pick(wart.split(' (')[0]);
R.essendean=await pick(ess.split(' (')[0]);
await p.screenshot({path:OUT+'shot-fishtimes-bite.png'});
await p.screenshot({path:OUT+'shot-fishtimes-bite-full.png',fullPage:true});
// GPS-style snap: search result coords near the creek (simulate geolocation at Essendean bridge-ish point)
await p.evaluate(()=>FT.biteSetLoc({name:'GPS test on creek',lat:BT.pointAtKm(20)[0]+0.001,lng:BT.pointAtKm(20)[1],tz:'Australia/Brisbane'}));
await sleep(300);await p.waitForSelector('body[data-bite-ready="1"]');R.gpsSnap=await biteInfo();
await p.evaluate(()=>FT.biteSetLoc({name:'Off creek (Agnes Water)',lat:-24.21,lng:151.90,tz:'Australia/Brisbane'}));
await sleep(300);await p.waitForSelector('body[data-bite-ready="1"]');R.offCreek=await biteInfo();
// jump bite -> baffle
await pick(ess.split(' (')[0]);
await p.click('#openBaffle');await sleep(800);
R.jumpToBaffle=await p.evaluate(()=>({tab:document.body.dataset.tab,hash:location.hash,km:document.querySelector('#bt-km').value,lm:document.querySelector('#bt-lm').selectedOptions[0]?.textContent,title:document.querySelector('#bt-dayTitle').innerText,stats:document.querySelector('#bt-stats').innerText.replace(/\n/g,' ').slice(0,200)}));
await p.screenshot({path:OUT+'shot-fishtimes-baffle.png'});
await p.screenshot({path:OUT+'shot-fishtimes-baffle-full.png',fullPage:true});
// baffle -> bite at Wartburg, and shared date
const tom=await p.evaluate(()=>{const d=new Date(Date.now()+864e5+10*36e5);return d.toISOString().slice(0,10);});
await p.evaluate(v=>{const e=document.querySelector('#bt-date');e.value=v;e.dispatchEvent(new Event('change'));},tom);
if(wart){const i=await p.evaluate(n=>[...document.querySelectorAll('#bt-lm option')].find(o=>o.textContent.startsWith(n))?.value,wart.split(' (')[0]);await p.select('#bt-lm',i);}
await p.click('#bt-toBite');await sleep(300);await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
R.jumpToBite={...(await biteInfo()),tab:await p.evaluate(()=>document.body.dataset.tab),date:await p.evaluate(()=>document.querySelector('#mj-date').value),expect:tom};
// ---- Phase D: offline reload ----
await p.evaluate(()=>navigator.serviceWorker.ready);
await p.setOfflineMode(true);
for(const tab of ['bite','baffle']){
  await p.goto(BASE+'#'+tab,{waitUntil:'domcontentloaded'}).catch(e=>R['offErr'+tab]=e.message);
  await p.waitForSelector(tab==='bite'?'body[data-bite-ready="1"]':'body[data-bt-ready="1"]',{timeout:30000}).catch(e=>R['offWait'+tab]=e.message);
  R['offline_'+tab]=await p.evaluate(()=>({tab:document.body.dataset.tab,biteReady:document.body.dataset.biteReady,btReady:document.body.dataset.btReady,src:document.querySelector('#mj-tideSrc').innerText.slice(0,80),notices:document.querySelector('#mj-notices').innerText.slice(0,200)}));
}
await p.goto(BASE+'mangrove-jack/',{waitUntil:'domcontentloaded'}).catch(e=>R.offLegacyErr=e.message);await sleep(2000);R.offline_legacy=p.url();
await p.setOfflineMode(false);
R.errs=errs.filter(e=>!/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR/.test(e));R.allErrs=errs;
console.log(JSON.stringify(R,null,1));await b.close();
