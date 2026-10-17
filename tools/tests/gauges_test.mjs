import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';
const SHOT=process.env.SHOT||'/workspace/fishing-site-src/shot-fishtimes-gauges.png';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const R={};
await p.goto(BASE+'#gauges',{waitUntil:'networkidle0'});
await p.waitForSelector('body[data-gauges-ready="1"]',{timeout:60000});
await p.evaluate(()=>navigator.serviceWorker.ready);
const info=()=>p.evaluate(()=>({tab:document.body.dataset.tab,latest:document.querySelector('#gLatest').innerText.replace(/\n/g,' | '),upd:document.querySelector('#gUpd').innerText,
  fresh:document.querySelector('#gFresh').innerText.slice(0,160),stats:[...document.querySelectorAll('#gStats tr')].map(r=>r.innerText.replace(/\t/g,' ; ')),
  svgPaths:document.querySelectorAll('#gChart path').length,circles:document.querySelectorAll('#gChart circle').length,view:window.__FT_GAUGES().view,gen:window.__FT_GAUGES().D.generated}));
R.initial=await info();
await p.screenshot({path:SHOT});
await p.screenshot({path:SHOT.replace('.png','-full.png'),fullPage:true});
// interactions
await p.click('.gbar [data-r="all"]');await sleep(200);R.all=(await info()).view;
await p.click('.gbar [data-r="2"]');await sleep(200);R.d2=(await info()).view;
await p.click('#gLegend button[data-s="ess_m"]');await p.click('#gLegend button[data-s="hills_m"]');await sleep(300);R.withModel=(await info()).svgPaths;
await p.$eval('#gWrap',e=>e.scrollIntoView({block:'start'}));await sleep(200);const box=await (await p.$('#gChart')).boundingBox();
await p.touchscreen.tap(box.x+box.width*0.6,box.y+120);await sleep(200);
R.tip=await p.evaluate(()=>document.querySelector('#gTip').innerText.replace(/\n/g,' | '));
await p.screenshot({path:SHOT.replace('.png','-2d-model.png')});

// drag pan (mouse)
const v0=(await info()).view;await p.mouse.move(box.x+300,box.y+100);await p.mouse.down();await p.mouse.move(box.x+150,box.y+100,{steps:5});await p.mouse.up();R.pan=[v0,(await info()).view];
await p.click('.gbar [data-r="7"]');
// other tabs still OK
await p.click('nav.tabs a[data-tab="bite"]');await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
await p.click('nav.tabs a[data-tab="baffle"]');await sleep(300);R.baffleOk=await p.evaluate(()=>document.body.dataset.btReady);
// offline
if(process.env.KILL){(await import('child_process')).execSync(process.env.KILL);}
await p.setOfflineMode(true);
await p.goto(BASE+'#gauges',{waitUntil:'domcontentloaded'});await p.reload({waitUntil:'domcontentloaded'});
await p.waitForSelector('body[data-gauges-ready="1"]',{timeout:30000}).catch(e=>R.offErr=e.message);
R.offline=await p.evaluate(()=>({tabs:document.body.dataset.biteReady+'/'+document.body.dataset.btReady,upd:document.querySelector('#gUpd').innerText,paths:document.querySelectorAll('#gChart path').length}));
await p.setOfflineMode(false);
R.errs=errs.filter(e=>!/INTERNET_DISCONNECTED|Failed to fetch/.test(e));R.allErrs=errs.length;
console.log(JSON.stringify(R,null,1));await b.close();
