// Pancake network junctions (2026-10-18): model checks, iPhone 390x844 shots, and the 📋 Copy coordinates buttons
import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const DIR=process.env.OUT||'/workspace/multisys/shots/turkey/junction/';fs.mkdirSync(DIR,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const sleep=ms=>new Promise(r=>setTimeout(r,ms));const errs=[];
const c=await b.createBrowserContext();const origin=new URL(BASE).origin;
if(!process.env.NOCLIP)await c.overridePermissions(origin,['clipboard-read','clipboard-write','clipboard-sanitized-write']);
const p=await c.newPage();await p.setBypassServiceWorker(true);
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console: '+m.text());});
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'?sys=pancake-creek#baffle',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await sleep(1500);
const chk=await p.evaluate(()=>{const B=BT,o=FT.baffleOpts();let n=0,badAlt=0,nul=0;const h00=B.dateToH(2026,10,18,0,0);
  for(const id of ['M','T1','T3']){const L=B.LINES.find(l=>l.id===id),a=id==='M'?0:L.j,mx=B.lineMax(id);
    for(let km=a;km<=mx+1e-9;km+=0.2)for(let d=0;d<60;d+=3){const h0=h00+24*d,P=B.predictAt(km,h0,h0+72,Object.assign({},o,{line:id}));n++;
      for(let i=1;i<P.inWin.length;i++)if(P.inWin[i].hi===P.inWin[i-1].hi){badAlt++;break;}
      for(let t=h0;t<h0+72;t+=1){const v=P.curve(t);if(v==null||!isFinite(v)){nul++;break;}}}}
  return{n,badAlt,nul,lines:B.LINES.map(l=>[l.id,l.name,+l.j.toFixed(2),+B.lineMax(l.id).toFixed(2)]),twos:(B.TWOS||[]).map(N=>[N.line,N.sAb,N.nAb,N.node])};});
console.log('model check',JSON.stringify(chk));
const PTS=[['T3',6.71,'junction'],['T3',5.2,'pancake-arm'],['T3',7.6,'jl-arm'],['T1',1.56,'jl-channel-mouth'],['T1',4.0,'jl-partway'],['M',11.44,'middle-pancake-junction']];const txt=[];
for(const [line,km,tag] of PTS){const r=await p.evaluate(async(line,km)=>{const s=document.getElementById('bt-line');s.value=line;s.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,300));
    const k=document.getElementById('bt-km');k.value=km;k.dispatchEvent(new Event('input'));k.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,700));
    const q=s=>{const e=document.querySelector(s);return e?e.innerText.replace(/\n+/g,' | '):''};const P=BT.predictAt(+k.value,BT.dateToH(2026,10,18,0,0),BT.dateToH(2026,10,19,0,0),Object.assign({},FT.baffleOpts(),{line}));
    return{line,km:+k.value,loc:q('#bt-locInfo'),warn:q('#bt-locWarn').slice(0,200),ext18Oct:P.inWin.map(e=>(e.hi?'H ':'L ')+String(Math.floor(e.t%24)).padStart(2,'0')+':'+String(Math.round((e.t%1)*60)%60).padStart(2,'0')+' '+e.h.toFixed(2)+' ±'+Math.round(e.u)),ow:document.documentElement.scrollWidth};},line,km);
  txt.push(r);await p.evaluate(()=>{const e=document.getElementById('bt-locInfo');window.scrollTo(0,e.getBoundingClientRect().top+scrollY-60);});await sleep(300);
  await p.screenshot({path:`${DIR}tides-${tag}-${line}-km${km}.png`});}
fs.writeFileSync(DIR+'tides.json',JSON.stringify(txt,null,1));console.log(JSON.stringify(txt,null,1));
// a custom spot + a crossing near the Jenny Lind–Pancake channel, for the copy buttons
const ids=await p.evaluate(()=>{const pt=BT.pointOnLine(7.2,'T3');const s=FT.spots.add({name:'Copy test spot',lat:pt[0]+0.0003,lng:pt[1]});const q=BT.pointOnLine(5.6,'T3');const x=FT.cross.add({name:'Copy test crossing',lat:q[0],lng:q[1]});return{s:s&&s.id,x:x&&x.id,sp:[pt[0]+0.0003,pt[1]],xp:[x.lat,x.lng]};});
await p.evaluate(()=>FT.showTab('map'));await sleep(2000);
await p.evaluate(()=>FT.mapDebug.map.setView([-24.0406342,151.7468052],15,{animate:false}));await sleep(4000);await p.screenshot({path:DIR+'map-jl-pancake-junction.png'});
await p.evaluate(()=>FT.mapDebug.map.setView([-24.0392,151.7480],14,{animate:false}));await sleep(4000);await p.screenshot({path:DIR+'map-jl-pancake-channel.png'});
await p.evaluate(()=>FT.mapDebug.map.setView([-24.0980148,151.7178078],15,{animate:false}));await sleep(4000);await p.screenshot({path:DIR+'map-middle-pancake-junction.png'});
const labs=await p.evaluate(()=>[...document.querySelectorAll('#mMap .mkm')].map(e=>e.innerText).filter(t=>/Jenny|Middle/.test(t)).slice(0,20));console.log('km labels',JSON.stringify(labs));
// copy: custom spot
await p.evaluate(id=>{FT.mapDebug.map.setView([-24.039,151.749],15,{animate:false});FT.mapDebug.openSpot(id);},ids.s);await sleep(800);
const hasBtn=await p.evaluate(()=>!!document.querySelector('.leaflet-popup [data-a="copy"]'));await p.click('.leaflet-popup [data-a="copy"]');await sleep(600);
const r1=await p.evaluate(async()=>({box:document.querySelector('.leaflet-popup .mcopy').innerText,input:(document.querySelector('.leaflet-popup .ccopy')||{}).value||null,clip:await navigator.clipboard.readText().catch(e=>'(read blocked)')}));
await p.screenshot({path:DIR+'popup-spot-copy.png'});console.log('spot copy',hasBtn,JSON.stringify(r1),'expected',ids.sp.map(v=>v.toFixed(6)).join(', '));
// built-in landmark popup has no copy button
// copy: crossing
await p.evaluate(()=>FT.mapDebug.map.closePopup());await p.evaluate(()=>{FT.mapDebug.map.setView([-24.0425,151.744],15,{animate:false});});await sleep(800);
await p.evaluate(()=>{const m=[...document.querySelectorAll('.leaflet-marker-icon')].find(e=>e.title==='Copy test crossing');m&&m.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await sleep(800);
const hasX=await p.evaluate(()=>!!document.querySelector('.leaflet-popup [data-xa="copy"]'));if(hasX){await p.click('.leaflet-popup [data-xa="copy"]');await sleep(600);}
const r2=await p.evaluate(async()=>({box:(document.querySelector('.leaflet-popup .xcopy')||{}).innerText,input:(document.querySelector('.leaflet-popup .ccopy')||{}).value||null,clip:await navigator.clipboard.readText().catch(e=>'(read blocked)')}));
await p.screenshot({path:DIR+'popup-crossing-copy.png'});console.log('crossing copy',hasX,JSON.stringify(r2),'expected',ids.xp.map(v=>(+v).toFixed(6)).join(', '));
console.log('ERRORS',JSON.stringify(errs));await b.close();
