import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
await p.setViewport({width:1000,height:1200,deviceScaleFactor:1});
await p.goto('http://localhost:8766/index.html',{waitUntil:'networkidle0'});
await p.waitForSelector('body[data-ready="1"]');
// log a benchmark: Essendean HW turn observed today ~12:25 (from BoM gauge plateau) and gauge reading
await p.evaluate(()=>{localStorage.removeItem('bt_bench');});
const idx=await p.evaluate(()=>BT.LANDMARKS.findIndex(l=>l.name.startsWith('Essendean')));
await p.select('#lm',String(idx));
await p.$eval('#bTime',e=>e.value='2026-10-09T12:25');await p.select('#bType','HW');await p.type('#bNote','From BoM gauge 039267: 0.77 plateau 11:12–13:37 (example)');await p.click('#bAdd');
await p.$eval('#bTime',e=>e.value='2026-10-09T12:18');await p.select('#bType','LVL_AHD');await p.type('#bVal','0.77');await p.click('#bAdd');
await p.click('#live');await p.waitForFunction(()=>!/Loading/.test(document.querySelector('#liveOut').textContent),{timeout:60000});
const info=await p.evaluate(()=>({stats:document.querySelector('#stats').innerText,bench:document.querySelector('#bTable').innerText,live:document.querySelector('#liveOut').innerText,warn:document.querySelector('#locWarn').innerText}));
console.log(JSON.stringify(info,null,1));
await p.screenshot({path:'/workspace/baffle-tides/screenshot.png',fullPage:true});
await p.setViewport({width:400,height:900,deviceScaleFactor:1});await p.screenshot({path:'/workspace/baffle-tides/research/screenshot-mobile.png',fullPage:false});
console.log('errors',errs);await b.close();
