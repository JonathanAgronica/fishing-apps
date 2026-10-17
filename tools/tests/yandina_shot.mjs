import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const OUT=process.env.OUT||'/workspace/multisys/shots/maroochy-yandina-map.png';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const c=await b.createBrowserContext();const p=await c.newPage();await p.setBypassServiceWorker(true);await p.setViewport({width:430,height:900,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'?sys=maroochy-river#map',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});
await p.evaluate(()=>FT.showTab('map'));await sleep(2000);await p.evaluate(()=>FT.mapDebug.map.setView([-26.5642,152.9612],15));await sleep(3500);
const box=await p.evaluate(()=>{const r=document.getElementById('map')?document.getElementById('map').getBoundingClientRect():null;return r&&{x:r.x,y:r.y+scrollY,w:r.width,h:r.height};});
await p.screenshot({path:OUT,clip:box?{x:box.x,y:box.y,width:box.w,height:box.h}:undefined});console.log('saved',OUT,box);await b.close();
