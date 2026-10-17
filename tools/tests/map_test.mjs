import puppeteer from 'puppeteer-core';
import fs from 'fs';
const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';
const SH='/workspace/fishing-site-src/shot-map';const SUF=process.env.SUF||'';
const UD='/tmp/mapprof'+SUF;fs.rmSync(UD,{recursive:true,force:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const R={};const errs=[];
async function launch(extra=[]){const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',userDataDir:UD,args:['--no-sandbox',...extra]});
  const p=(await b.pages())[0]||await b.newPage();await p.evaluateOnNewDocument(()=>{window.__DC_OPEN=1;});p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_NAME_NOT_RESOLVED|ERR_INTERNET|Failed to load resource/.test(m.text()))errs.push('console: '+m.text());});
  p.on('dialog',d=>d.accept());await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});return{b,p};}
let {b,p}=await launch();
await b.defaultBrowserContext().overridePermissions(new URL(BASE).origin,['geolocation']);
await p.goto(BASE+'#map',{waitUntil:'domcontentloaded'});
await p.waitForSelector('body[data-map-ready="1"]',{timeout:30000});await p.evaluate(()=>navigator.serviceWorker.ready);
await sleep(2500);
R.keys0=await p.evaluate(()=>Object.keys(localStorage).sort());
R.tabs=await p.$$eval('nav.tabs a',as=>as.map(a=>a.innerText));
R.tiles=await p.$$eval('.leaflet-tile-loaded',t=>t.length);
R.paths=await p.$$eval('#mMap path',t=>t.length);
await p.screenshot({path:SH+'-sat'+SUF+'.png'});
// --- add spot #1 via the real UI: ➕ then tap near the creek at km 12 (60 m off centreline)
const pt=await p.evaluate(()=>{const m=FT.mapDebug.map;const ll=FT.spots.pointAt(12,'B');m.setView([ll[0]+0.0005,ll[1]],15,{animate:false});const c=m.latLngToContainerPoint([ll[0]+0.0005,ll[1]]);const r=document.getElementById('mMap').getBoundingClientRect();return{x:r.left+c.x,y:r.top+c.y};});
await sleep(800);
await p.click('#mAdd');await sleep(200);await p.touchscreen.tap(pt.x,pt.y);await sleep(600);
await p.type('.leaflet-popup .mnm','Snag bend');await p.type('.leaflet-popup .mnt','big fallen gum');
await p.click('.leaflet-popup .mtype button[data-t=ri]');await p.select('.leaflet-popup .mdp','m');await p.click('.leaflet-popup [data-x=ok]');await sleep(900);
R.afterAdd=await p.evaluate(()=>FT.spots.customs());
R.popup=await p.$eval('.leaflet-popup .mpop',e=>e.innerText.replace(/\n/g,' | ')).catch(()=>null);
await p.screenshot({path:SH+'-popup'+SUF+'.png'});
// --- spot #2 via long-press path (contextmenu) at km 30
await p.evaluate(()=>{const ll=FT.spots.pointAt(30,'B');FT.mapDebug.map.fire('contextmenu',{latlng:FT.mapDebug.LF.latLng(ll[0],ll[1])});});await sleep(400);
await p.type('.leaflet-popup .mnm','Upper hole');await p.$eval('.leaflet-popup [data-x=ok]',e=>e.click());await sleep(800);
// too-far tap
await p.evaluate(()=>FT.mapDebug.map.fire('contextmenu',{latlng:FT.mapDebug.LF.latLng(-24.40,152.10)}));await sleep(300);
R.tooFar=await p.$eval('.leaflet-popup .mpop',e=>e.innerText);await p.evaluate(()=>FT.mapDebug.map.closePopup());
const id1=R.afterAdd[0].id;
// --- popup numbers vs Baffle tab: same km, same opts
R.info=await p.evaluate(id=>{const l=FT.spots.get(id);const I=FT.mapDebug.spotInfo(l);const f=h=>BT.fmtT(h);return{km:l.km,hi:I.hi&&f(I.hi.t),lo:I.lo&&f(I.lo.t),hiU:I.hi&&I.hi.u,nxt:I.nxt&&f(I.nxt.t),cur:I.cur&&f(I.cur.t),sc:I.sc&&I.sc.score};},id1);
// --- rename via popup edit
await p.evaluate(id=>FT.mapDebug.openSpot(id),id1);await sleep(300);
await p.click('.leaflet-popup [data-a=edit]');await sleep(200);
await p.$eval('.leaflet-popup .mnm',e=>e.value='');await p.type('.leaflet-popup .mnm','Snag bend 2');await p.click('.leaflet-popup [data-x=ok]');await sleep(600);
// --- move by dragging the pin (mouse)
const km0=await p.evaluate(id=>FT.spots.get(id).km,id1);
const pin=await p.evaluate(id=>{const s=FT.spots.get(id),m=FT.mapDebug.map;m.closePopup();m.setView([s.lat,s.lng],15,{animate:false});const c=m.latLngToContainerPoint([s.lat,s.lng]);const r=document.getElementById('mMap').getBoundingClientRect();return{x:r.left+c.x,y:r.top+c.y-12};},id1);
await sleep(500);
await p.mouse.move(pin.x,pin.y);await p.mouse.down();await p.mouse.move(pin.x-60,pin.y+10,{steps:8});await p.mouse.move(pin.x-120,pin.y+20,{steps:8});await p.mouse.up();await sleep(600);
R.moved=await p.evaluate(id=>{const s=FT.spots.get(id);return{km:s.km,lat:s.lat,lng:s.lng};},id1);R.km0=km0;
await p.evaluate(()=>FT.mapDebug.map.closePopup());
// --- alias a built-in (b4 Flat Rock Rd ramp)
await p.$eval('#mBuiltDet',e=>e.open=true);
await p.$eval('[data-al="b4"]',e=>{e.value='Home ramp';e.dispatchEvent(new Event('change'));});await sleep(300);
// --- appears everywhere
R.everywhere=await p.evaluate(()=>({bite:[...document.querySelectorAll('#mj-bafSel option')].map(o=>o.textContent).filter(t=>/★|Home ramp/.test(t)),
  baffle:[...document.querySelectorAll('#bt-lm option')].map(o=>o.textContent).filter(t=>/★|Home ramp/.test(t)),
  log:[...document.querySelectorAll('#cSpotSel option')].map(o=>o.textContent).filter(t=>/★|Home ramp/.test(t)),
  ids:BT.LANDMARKS.filter(l=>/Home ramp|Snag|Upper/.test(l.name)).map(l=>l.id+':'+l.name+(l.base?' ('+l.base+')':'')),
  keys:Object.keys(localStorage).filter(k=>k.startsWith('mbj_')),alias:localStorage.getItem('mbj_alias')}));
// --- Tides here -> Baffle tab; compare stretch row & cards
await p.evaluate(id=>FT.mapDebug.openSpot(id),id1);await sleep(300);await p.click('.leaflet-popup [data-a=tides]');await sleep(800);
R.baffle=await p.evaluate(()=>({tab:document.body.dataset.tab,lm:document.getElementById('bt-lm').selectedOptions[0].textContent,title:document.getElementById('bt-dayTitle').textContent,
  cards:document.getElementById('bt-stats')?document.getElementById('bt-stats').innerText.replace(/\n/g,' | '):null,
  row:[...document.querySelectorAll('#bt-stretch tr')].map(r=>r.innerText.replace(/\s+/g,' ')).filter(t=>/Snag|Home ramp/.test(t))}));
await p.$eval('#bt-stretch',e=>e.scrollIntoView({block:'center'}));await sleep(200);await p.screenshot({path:SH+'-baffle-table'+SUF+'.png'});
// popup numbers re-evaluated with the same opts as Baffle tab, and Baffle tab's own next-high from its model
R.match=await p.evaluate(id=>{const l=FT.spots.get(id);const o=FT.baffleOpts();const nh=BT.nowH();const P=BT.predictAt(l.km,nh-3,nh+30,o);const I=FT.mapDebug.spotInfo(l);
  const hi=P.ext.find(e=>e.hi&&!e.weak&&e.t>nh);return{same:Math.abs(hi.t-I.hi.t)<1e-9,hi:BT.fmtT(hi.t),popupHi:BT.fmtT(I.hi.t),inBaffleCards:(document.getElementById('bt-stats')||document.body).innerText.includes(BT.fmtT(hi.t))};},id1);
// --- Bite times here
await p.click('nav.tabs a[data-tab=map]');await sleep(400);
await p.evaluate(id=>FT.mapDebug.openSpot(id),id1);await sleep(300);await p.click('.leaflet-popup [data-a=bite]');
await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});await sleep(500);
R.bite=await p.evaluate(()=>({tab:document.body.dataset.tab,loc:JSON.parse(localStorage.getItem('mj_loc')),sel:document.getElementById('mj-bafSel').selectedOptions[0].textContent,src:document.getElementById('mj-tideSrc').innerText.slice(0,90)}));
// --- Log catch here
await p.click('nav.tabs a[data-tab=map]');await sleep(400);
await p.evaluate(id=>FT.mapDebug.openSpot(id),id1);await sleep(300);await p.click('.leaflet-popup [data-a=log]');await sleep(500);
R.log=await p.evaluate(()=>({tab:document.body.dataset.tab,title:document.getElementById('cFormTitle').textContent,spot:document.getElementById('cSpotInfo').innerText.replace(/\n/g,' | ')}));
await p.screenshot({path:SH+'-log'+SUF+'.png'});
// --- Baffle GPS nearest spot
const s1=await p.evaluate(id=>FT.spots.get(id),id1);
await p.setGeolocation({latitude:s1.lat+0.0003,longitude:s1.lng,accuracy:10});
await p.click('nav.tabs a[data-tab=baffle]');await sleep(300);await p.click('#bt-gps');await sleep(1200);
R.gpsNearest=await p.$eval('#bt-locInfo',e=>e.innerText);
// --- colour creek by bite score + tide stage
await p.click('nav.tabs a[data-tab=map]');await sleep(500);
const tc=Date.now();await p.select('#mColour','bite');await sleep(300);R.colourMs=Date.now()-tc;
R.colourBite=await p.evaluate(()=>({legend:document.getElementById('mLegend').innerText,segs:document.querySelectorAll('#mMap path').length,lbl:document.getElementById('mTimeLbl').textContent}));
await p.evaluate(()=>FT.mapDebug.map.fitBounds(FT.mapDebug.LF.latLngBounds(BAFFLE_DATA.main.concat(BAFFLE_DATA.euleilah)),{animate:false}));await sleep(1500);
await p.screenshot({path:SH+'-bite-colour'+SUF+'.png'});
await p.select('#mColour','tide');await p.$eval('#mTime',e=>{e.value=40;e.dispatchEvent(new Event('input'));});await sleep(400);
R.colourTide=await p.evaluate(()=>document.getElementById('mTimeLbl').textContent+' / '+document.getElementById('mLegend').innerText);
await p.click('#mLayers [data-l=osm]');await sleep(2500);await p.screenshot({path:SH+'-osm-tide'+SUF+'.png'});
await p.select('#mColour','off');
// --- CSV backup round trip
const csv=await p.evaluate(()=>{FT.catchLog.exportCSV();return window.__MBJ_LAST_EXPORT;});
R.csvSpotRows=csv.split('\n').filter(l=>/^(spot|alias),/.test(l));
// --- delete spot #2 via list
const id2=await p.evaluate(()=>FT.spots.customs().find(c=>c.name==='Upper hole').id);
await p.$eval(`#mList [data-del="${id2}"]`,e=>e.click());await sleep(300);
R.afterDel=await p.evaluate(()=>({customs:FT.spots.customs().map(c=>c.name),bite:[...document.querySelectorAll('#mj-bafSel option')].some(o=>/Upper hole/.test(o.textContent)),baffle:[...document.querySelectorAll('#bt-lm option')].some(o=>/Upper hole/.test(o.textContent))}));
await p.$eval('#mList',e=>e.scrollIntoView({block:'start'}));await sleep(200);await p.screenshot({path:SH+'-list'+SUF+'.png'});
// --- import into a clean context
const ctx2=await b.createBrowserContext();const p2=await ctx2.newPage();await p2.goto(BASE+'#log',{waitUntil:'domcontentloaded'});await p2.waitForSelector('body[data-log-ready="1"]');
R.import=await p2.evaluate(t=>{const r=FT.catchLog.importCSV(t);return{r,spots:FT.spots.customs().map(c=>c.name+' km'+c.km),alias:localStorage.getItem('mbj_alias')};},csv);
await ctx2.close();
// --- sharing payload never contains spot names / coords (build a message from a session at the custom spot)
R.shareCheck=await p.evaluate(async()=>{const l=FT.spots.customs()[0];FT.catchLogAt(FT.spots.get(l.id));document.getElementById('cSave').click();await new Promise(r=>setTimeout(r,500));
  const s=FT.catchLog.log[FT.catchLog.log.length-1];return{saved:!!s,spotName:s&&s.spot.name,band:s&&s.ctx?'ok':'noctx'};});
await p.evaluate(()=>FT.showTab('map'));await sleep(1000);
await b.close();
// --- offline: same profile, all network blocked (incl. the service worker's) via host resolver
({b,p}=await launch(['--host-resolver-rules=MAP * ~NOTFOUND']));
await p.goto(BASE+'#map',{waitUntil:'domcontentloaded'}).catch(e=>R.offGoto=e.message);
await p.waitForSelector('body[data-map-ready="1"]',{timeout:30000}).catch(e=>R.offWait=e.message);await sleep(2500);
R.offline=await p.evaluate(()=>({ready:document.body.dataset.mapReady,paths:document.querySelectorAll('#mMap path').length,pins:document.querySelectorAll('.mpin').length,tiles:document.querySelectorAll('.leaflet-tile-loaded').length,customs:FT.spots.customs().map(c=>c.name)})).catch(e=>({err:e.message}));
await p.screenshot({path:SH+'-offline'+SUF+'.png'});
await p.click('#mLayers [data-l=none]').catch(()=>{});await sleep(300);await p.screenshot({path:SH+'-offline-none'+SUF+'.png'});
await b.close();
R.errs=errs;console.log(JSON.stringify(R,null,1));
