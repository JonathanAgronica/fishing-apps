import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const SH=process.env.SHOTS||'/workspace/multisys/shots/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ck=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)fails++;};
const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.evaluateOnNewDocument(()=>{window.__DC_OPEN=1;});const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console: '+m.text());});
await p.setBypassServiceWorker(true);await p.setViewport({width:430,height:900,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'?sys=maroochy-river#baffle',{waitUntil:'networkidle0'});
await p.waitForSelector('body[data-sys-ready="maroochy-river"]',{timeout:60000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:90000});
const r=await p.evaluate(async()=>{const B=BT;const pts={nearYandina:[-26.5650,152.9600],bruceHwy:[-26.5633,152.9668],town:[-26.5613,152.9576]};const o={};
  for(const k in pts){const s=B.snap(...pts[k]);o[k]={km:+s.km.toFixed(2),line:s.lineId,off:+s.offKm.toFixed(3)};}
  const N=await FT.nearestSystems(-26.5650,152.9600);o.nearest=N.slice(0,3).map(x=>[x.s.id,+x.d.toFixed(2)]);
  o.lineMax=B.lineMax('M');o.maxKm=B.MAXKM;o.lmk=B.LANDMARKS.filter(l=>(l.line||'M')==='M'&&l.km>26).map(l=>l.name+' @'+l.km);
  const h0=B.dateToH(2026,10,12,0,0);const P=B.predictAt(28.4,h0,h0+24,{line:'M'});o.pred=P.inWin.map(e=>(e.hi?'H':'L')+B.fmtT(e.t)+' '+e.h.toFixed(2)+(e.weak?'w':''));o.cal={hwU:Math.round(P.cal.hwU),lwU:Math.round(P.cal.lwU),est:P.cal.est,trunc:P.cal.trunc};
  o.ri=B.runInStarts(28.4,h0,h0+24,{line:'M'}).map(x=>B.fmtT(x.t)+' '+x.kind);
  const pJ=B.predictAt(26.0,h0,h0+24,{line:'M'});o.pred26=pJ.inWin.map(e=>(e.hi?'H':'L')+B.fmtT(e.t));
  return o;});
console.log(JSON.stringify(r,null,1));
ck(r.nearYandina.line==='M'&&r.nearYandina.km>27.5&&r.nearYandina.off<0.6,'GPS near Yandina snaps to Maroochy main line, km '+r.nearYandina.km);
ck(r.nearest[0][0]==='maroochy-river','nearest system at Yandina is Maroochy');ck(r.lineMax>28.5,'main line now to '+r.lineMax+' km');
ck(r.lmk.some(x=>/James Low/.test(x))&&r.lmk.some(x=>/Bruce Highway/.test(x)),'landmarks on the extension');
// Tides tab at the ford
await p.evaluate(()=>FT.baffleSelect(28.4,null,'M'));await sleep(600);
const t=await p.evaluate(()=>({warn:document.querySelector('#bt-locWarn').innerText,stats:document.querySelector('#bt-stats').innerText.replace(/\n/g,' | ').slice(0,300),stretch:[...document.querySelectorAll('#bt-stretch tr')].map(x=>x.innerText.replace(/\s+/g,' ')).filter(x=>/Yandina|James Low|Bruce|confluence/.test(x))}));
console.log(JSON.stringify(t,null,1));ck(t.stretch.length>=3,'Tides stretch table lists the Yandina reach');
await p.screenshot({path:SH+'maroochy-yandina-tides.png'});
// custom spot near Yandina (throwaway profile) + gauges spot option + catch band
const sp=await p.evaluate(()=>{try{const c=FT.spots.add({name:'Test Yandina spot',lat:-26.5650,lng:152.9600,type:'ri'});const band=FT.catchBandOf?FT.catchBandOf(c.km,c.line):null;return{km:c.km,line:c.line,band};}catch(e){return{err:e.message};}});
console.log('spot',JSON.stringify(sp));ck(sp.km>27.5&&sp.line==='M','custom spot at Yandina snaps (km '+sp.km+')');
await p.evaluate(()=>FT.showTab('gauges'));await sleep(2500);
const g=await p.evaluate(()=>{const d=document.querySelector('#gSpots details');if(d)d.open=true;const k=document.getElementById('gSpKm');return{max:k?k.max:null,hasSpot:[...document.querySelectorAll('#gSpots [data-sp]')].some(x=>/Yandina/.test(x.textContent)),lm:[...document.querySelectorAll('#gSpots [data-sp]')].filter(x=>/James Low|Bruce/.test(x.textContent)).length};});
console.log('gauges',JSON.stringify(g));ck(g.hasSpot&&g.lm>=1,'Gauges spot options include Yandina reach');
// catch log: log a session at the custom spot? check band function via spot select
await p.evaluate(()=>FT.showTab('log'));await sleep(800);
const cl=await p.evaluate(()=>[...document.querySelectorAll('#cSpotSel option')].map(o=>o.textContent).filter(x=>/Yandina|James Low/.test(x)));console.log('catch-log spots',cl);ck(cl.length>0,'catch-log spot list includes Yandina reach');
// map
await p.evaluate(()=>FT.showTab('map'));await sleep(2500);
await p.evaluate(()=>{FT.mapDebug.map.setView([-26.5640,152.9640],15);});await sleep(2500);
await p.screenshot({path:SH+'maroochy-yandina-map.png'});
await p.evaluate(()=>{FT.mapDebug.map.setView([-26.5700,152.9900],13);});await sleep(2500);await p.screenshot({path:SH+'maroochy-yandina-map-wide.png'});
ck(errs.length===0,'no page errors '+JSON.stringify(errs));
console.log(fails?fails+' FAILED':'ALL OK');await b.close();
