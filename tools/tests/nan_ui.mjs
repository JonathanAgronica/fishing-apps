import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'#bite',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const R={ver:await p.evaluate(()=>document.querySelector('meta[name=app-version]').content)};
for(const [name,date] of [['Essendean','2026-10-17'],['Sandy Creek','2026-10-16']]){
  const v=await p.evaluate(n=>[...document.querySelectorAll('#mj-bafSel option')].find(o=>o.textContent.startsWith(n)).value,name);
  await p.select('#mj-bafSel',v);await sleep(300);await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
  await p.evaluate(d=>{const e=document.querySelector('#mj-date');e.value=d;e.dispatchEvent(new Event('change'));},date);await sleep(300);await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
  R[name+' '+date]=await p.evaluate(()=>({title:document.querySelector('#mj-dayTitle').innerText,wins:document.querySelector('#mj-windows').innerText.split('\n').slice(0,3).join(' | '),nan:/NaN/.test(document.querySelector('#tab-bite').innerText)}));}
await p.screenshot({path:'/workspace/fishing-site-src/shot-nanfix-sandy.png'});
R.errs=errs;console.log(JSON.stringify(R,null,1));await b.close();
