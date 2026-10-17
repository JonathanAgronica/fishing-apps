import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';const SH='/workspace/multisys/shots/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.setRequestInterception(true);p.on('request',r=>{if(/ntfy\.sh/.test(r.url()))r.abort();else r.continue();});
const ready=async id=>{await p.waitForSelector('body[data-sys-ready="'+id+'"]',{timeout:60000});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:90000});};
// 1. default = Baffle; nearest-system offer with GPS on the Mary River at Maryborough
await p.goto(BASE+'#bite',{waitUntil:'networkidle0'});await ready('baffle');
await ctx.overridePermissions(new URL(BASE).origin,['geolocation']);await p.setGeolocation({latitude:-25.5319,longitude:152.7093});
await p.click('#sysGps');await sleep(2500);console.log('nearest msg:',await p.$eval('#sysMsg',e=>e.innerText));await p.screenshot({path:SH+'nearest-offer.png'});
// 2. C-grade system warning
const C=await p.evaluate(()=>FT.SYSIDX.filter(s=>s.conf==='C').map(s=>s.id));console.log('C systems',C.length,C.slice(0,6));
await p.goto(BASE+'?sys='+C[0]+'#baffle',{waitUntil:'networkidle0'});await ready(C[0]);
const lim=await p.evaluate(()=>{const s=document.getElementById('bt-km');s.value=s.max*0.8;s.dispatchEvent(new Event('input'));return{warn:document.querySelector('#bt-locWarn').innerText,stats:document.querySelector('#bt-stats').innerText.replace(/\n/g,' | ').slice(0,300)};});
console.log('C-grade',C[0],JSON.stringify(lim,null,1));await p.screenshot({path:SH+'cgrade-tides.png'});
// 3. catch log on Burnett: past session at a landmark, sharing in TEST mode, relay blocked -> inspect queued message
await p.goto(BASE+'?sys=burnett-river#log',{waitUntil:'networkidle0'});await ready('burnett-river');
await p.evaluate(()=>{localStorage.setItem('mbj_test','1');});
await p.reload({waitUntil:'networkidle0'});await ready('burnett-river');
await p.evaluate(()=>{const c=document.getElementById('cShareOn');c.checked=true;c.dispatchEvent(new Event('change'));});
await p.click('#cPastBtn');await sleep(300);
await p.evaluate(()=>{const s=document.getElementById('cSpotSel');const o=[...s.options].find(o=>/^L/.test(o.value)&&/Bundaberg|ramp/i.test(o.text))||[...s.options].find(o=>/^L/.test(o.value));s.value=o.value;s.dispatchEvent(new Event('change'));document.getElementById('cNoBites').checked=true;});
await sleep(300);console.log('spotinfo:',await p.$eval('#cSpotInfo',e=>e.innerText));
await p.click('#cSave');await sleep(1500);
const q=await p.evaluate(()=>({q:JSON.parse(localStorage.getItem('mbj_shareq')||'[]').map(x=>{const m=JSON.parse(x.body);return{sy:m.sy,bk:m.bk,ln:m.ln,rg:m.rg,ts:m.ts,keys:Object.keys(m)};}),log:JSON.parse(localStorage.getItem('mbj_log')||'[]').map(s=>({spot:s.spot,ctx:!!s.ctx})),msg:document.getElementById('cFormMsg').innerText}));
console.log('catch',JSON.stringify(q,null,1));await p.screenshot({path:SH+'burnett-log.png'});
// 4. offline: Burnett was opened (cached); go offline, reload; then try a never-opened system
await p.evaluate(()=>navigator.serviceWorker.ready);await sleep(1500);
await p.setOfflineMode(true);
await p.goto(BASE+'?sys=burnett-river#baffle',{waitUntil:'domcontentloaded'});await ready('burnett-river');
console.log('offline burnett ok:',await p.$eval('#bt-stats',e=>e.innerText.slice(0,80).replace(/\n/g,' | ')));
await p.goto(BASE+'?sys=kolan-river#baffle',{waitUntil:'domcontentloaded'}).catch(e=>console.log('nav err',e.message));await sleep(3000);
console.log('offline unsaved kolan:',await p.evaluate(()=>{const e=document.getElementById('sysLoading');return e?e.innerText:'(no banner) sysReady='+document.body.dataset.sysReady;}));
await p.screenshot({path:SH+'offline-unsaved.png'});
await p.setOfflineMode(false);
await p.goto(BASE+'?sys=burnett-river#baffle',{waitUntil:'networkidle0'});await ready('burnett-river');
await p.evaluate(()=>{window.confirm=()=>true;});await p.click('#sysOff');
await p.waitForFunction(()=>/All \d+ systems saved|failed/.test(document.getElementById('sysMsg').innerText),{timeout:120000});console.log('download:',await p.$eval('#sysMsg',e=>e.innerText));
await p.setOfflineMode(true);
await p.goto(BASE+'?sys=kolan-river#baffle',{waitUntil:'domcontentloaded'});await ready('kolan-river');console.log('offline kolan after download ok:',await p.$eval('#bt-locInfo',e=>e.innerText.slice(0,90)));
await p.evaluate(()=>FT.showTab('map'));await sleep(2500);await p.screenshot({path:SH+'offline-kolan-map.png'});
await p.setOfflineMode(false);
// 5. back to Baffle: custom spot from Burnett test not shown on Baffle, Baffle keys intact
await p.goto(BASE+'?sys=baffle#baffle',{waitUntil:'networkidle0'});await ready('baffle');
console.log('baffle back:',await p.evaluate(()=>({sys:FT.SYS,lm:BT.LANDMARKS.length,customs:BT.LANDMARKS.filter(l=>l.custom).length,loc:document.querySelector('#bt-locInfo').innerText.slice(0,80),keys:Object.keys(localStorage).sort()})));
console.log('\nERRORS',JSON.stringify(errs.filter(e=>!/ntfy|ERR_INTERNET_DISCONNECTED|Failed to load resource|ERR_FAILED/.test(e)),null,1));
console.log('net-ish errors',errs.length);
await b.close();
