import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto('https://jonathanagronica.github.io/fishing-apps/mangrove-jack/',{waitUntil:'networkidle0'});
await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
const r=await p.evaluate(async()=>({url:location.href,title:document.title,h1:document.querySelector('h1').innerText,apple:document.querySelector('meta[name=apple-mobile-web-app-title]').content,
  ver:document.querySelector('meta[name=app-version]').content,m:(await (await fetch('manifest.webmanifest')).json()).short_name,footer:document.querySelector('footer').innerText.slice(-40)}));
await p.screenshot({path:'/workspace/fishing-site-src/shot-baffle-jacks.png'});
for(const t of ['baffle','gauges']){await p.click(`nav.tabs a[data-tab="${t}"]`);}
await p.waitForSelector('body[data-gauges-ready="1"]',{timeout:60000});
r.errs=errs;console.log(JSON.stringify(r,null,1));await b.close();
