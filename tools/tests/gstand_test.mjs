import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const OUT=process.env.OUT||'/workspace/multisys/shots/stand-gauges.png';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console: '+m.text());});
await p.setBypassServiceWorker(true);await p.setViewport({width:900,height:1100,deviceScaleFactor:1.5});
await p.evaluateOnNewDocument(()=>localStorage.setItem('ft_gauge_on',JSON.stringify({ess_m:true,hills_m:true,win:false,bundaberg_pred:false})));
await p.goto(BASE+'#gauges',{waitUntil:'networkidle0'});await p.evaluate(()=>FT.showTab('gauges'));await p.waitForSelector('body[data-gauges-ready="1"]',{timeout:60000});await new Promise(r=>setTimeout(r,800));
const m=(d,h)=>(Date.UTC(2026,9,d,h)-Date.UTC(2025,11,31,14))/60000-600;
await p.evaluate((a,b)=>FT.gaugesView(a,b),m(2,0),m(6,12));await new Promise(r=>setTimeout(r,600));
const r=await p.evaluate(()=>({nrows:document.querySelectorAll('#gEvents tr').length,stands:(document.querySelector('#gChart').innerHTML.match(/>stand</g)||[]).length,x:(document.querySelector('#gChart').innerHTML.match(/l7,7m0,-7l-7,7/g)||[]).length,
  stats:document.querySelector('#gStats').innerText,note:document.querySelector('#gStatsNote').innerText.slice(-330),ev:[...document.querySelectorAll('#gEvents tr')].map(t=>t.textContent.replace(/\s+/g,' ')).filter(t=>/stand/.test(t)),latest:document.querySelector('#gLatest').innerText.replace(/\n/g,' | ').slice(0,500)}));
console.log(JSON.stringify(r,null,1));
const el=await p.$('#gChart');await el.screenshot({path:OUT});
await p.evaluate((a,b)=>FT.gaugesView(a,b),m(16,0),m(21,0));await new Promise(r=>setTimeout(r,600));
console.log('16-20 Oct stands on chart',await p.evaluate(()=>(document.querySelector('#gChart').innerHTML.match(/>stand</g)||[]).length));
await el.screenshot({path:OUT.replace('.png','-16-20oct.png')});
console.log('errs',errs);await b.close();
