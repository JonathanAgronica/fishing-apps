import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto((process.env.BASE||'http://localhost:18080/fishing-apps/')+'#baffle',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]');
const rows=await p.evaluate(()=>[...document.querySelectorAll('#bt-stretch tr')].map(r=>[...r.cells].map(c=>c.innerText.replace(/\n/g,' / ')).join(' ; ')));
await p.$eval('#bt-stretch',e=>e.scrollIntoView());await p.screenshot({path:'/workspace/fishing-site-src/shot-runin-baffle-stretch.png'});
console.log(rows.join('\n'));console.log('errs',errs);await b.close();
