// iPhone 390x844 shots + checks for Moneys Creek (Bargara) and its causeway flow panel
import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/',DIR='/workspace/multisys/shots/moneys/';fs.mkdirSync(DIR,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errs=[];const c=await b.createBrowserContext();const p=await c.newPage();await p.setBypassServiceWorker(true);
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console: '+m.text());});
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'?sys=moneys-creek#baffle',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await sleep(1500);
const chk=await p.evaluate(()=>{const B=BT,o=FT.baffleOpts();let n=0,badAlt=0,nul=0;const h00=B.dateToH(2026,10,24,0,0);
  for(let km=0;km<=B.lineMax('M')+1e-9;km+=0.05)for(let d=0;d<60;d+=3){const h0=h00+24*d,P=B.predictAt(km,h0,h0+72,Object.assign({},o,{line:'M'}));n++;
    for(let i=1;i<P.inWin.length;i++)if(P.inWin[i].hi===P.inWin[i-1].hi){badAlt++;break;}for(let t=h0;t<h0+72;t++){const v=P.curve(t);if(v==null||!isFinite(v)){nul++;break;}}}
  const W=FT.causeway.phases(h00,h00+48).map(w=>w.k+' '+(w.a-h00).toFixed(2)+'-'+(w.b-h00).toFixed(2)+' head '+w.head.toFixed(2));return{n,badAlt,nul,W,thr:FT.causeway.thr()};});
console.log('model',JSON.stringify(chk));
const sel=async km=>p.evaluate(async km=>{const k=document.getElementById('bt-km');k.value=km;k.dispatchEvent(new Event('input'));k.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,800));
  const q=s=>{const e=document.querySelector(s);return e?e.innerText.replace(/\n+/g,' | '):''};return{km:+k.value,loc:q('#bt-locInfo'),cw:q('#cwTides').slice(0,900),shades:document.querySelectorAll('.cwshade').length,ow:document.documentElement.scrollWidth};},km);
const r0=await sel(0);console.log(JSON.stringify(r0));await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:DIR+'tides-01-mouth.png'});
const r1=await sel(0.34);console.log(JSON.stringify(r1));await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:DIR+'tides-02-causeway.png'});
await p.evaluate(()=>{const e=document.getElementById('bt-chart');scrollTo(0,e.getBoundingClientRect().top+scrollY-60);});await sleep(300);await p.screenshot({path:DIR+'tides-03-causeway-chart.png'});
await p.evaluate(()=>{const e=document.getElementById('cwTides');scrollTo(0,e.getBoundingClientRect().top+scrollY-40);});await sleep(300);await p.screenshot({path:DIR+'tides-04-causeway-flow.png'});
// override then reset
const ov=await p.evaluate(async()=>{FT.causeway.setThr(1.3);await new Promise(r=>setTimeout(r,600));const a=document.querySelectorAll('.cwshade').length,t=document.getElementById('cwThr').value;FT.causeway.setThr(null);await new Promise(r=>setTimeout(r,600));return{a,t,after:document.getElementById('cwThr').value,ls:localStorage.getItem('mbj_cw')};});
console.log('override',JSON.stringify(ov));
await p.evaluate(()=>FT.showTab('map'));await sleep(2000);
await p.evaluate(()=>FT.mapDebug.map.setView([-24.8261,152.4655],17,{animate:false}));await sleep(4000);await p.evaluate(()=>scrollTo(0,0));
await p.screenshot({path:DIR+'map-01.png'});
await p.evaluate(()=>{const m=document.querySelector('.mcw');m&&m.closest('.leaflet-marker-icon').dispatchEvent(new MouseEvent('click',{bubbles:true}));});await sleep(800);
await p.screenshot({path:DIR+'map-02-causeway-popup.png'});
console.log('errors',errs.length,errs.slice(0,5));await b.close();
