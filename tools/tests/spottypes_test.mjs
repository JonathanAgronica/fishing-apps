import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const SH=process.env.SHOTS||'/workspace/multisys/shots/spottypes/';fs.mkdirSync(SH,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.evaluateOnNewDocument(()=>{window.__DC_OPEN=1;});const errs=[];const R={};
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|ntfy|ERR_FAILED|tile/i.test(m.text()))errs.push('console: '+m.text());});
p.on('dialog',d=>d.accept());
await p.setRequestInterception(true);const relay=[];
p.on('request',r=>{if(r.url().includes('ntfy.sh')){relay.push(r.postData());r.abort();}else r.continue();});
await p.setViewport({width:420,height:900,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ready=async()=>{await p.waitForSelector('body[data-bite-ready="1"]',{timeout:90000});await sleep(300);};
// 1) blank profile -> seed OLD-format custom spots (colour only, no type) exactly like the phone's backup
await p.goto(BASE+'?r='+Date.now()+'#bite',{waitUntil:'domcontentloaded'});await ready();
await p.evaluate(()=>{const mk=(id,name,km,color)=>{const [lat,lng]=BT.pointAtKm(km);return{id,name,lat,lng,km,line:'B',offKm:0,color,note:'',created:Date.now()};};
  localStorage.clear();localStorage.setItem('mbj_spots',JSON.stringify([mk('cwake01','Private spot 8',19.97,'#ffb020'),mk('chugh01',"Private spot 4",33.55,'#ff5d8f'),mk('cblue01','Blue test',10.2,'#5cc8ff'),mk('cwhite1','White test',27.1,'#ffffff')]));});
await p.goto(BASE+'?r='+Date.now()+'#bite',{waitUntil:'domcontentloaded'});await ready();
R.migrated=await p.evaluate(()=>JSON.parse(localStorage.getItem('mbj_spots')).map(c=>[c.name,c.type,c.color]));
R.migRecord=await p.evaluate(()=>JSON.parse(localStorage.getItem('mbj_spot_mig')));
R.biteBanner=await p.evaluate(()=>{const e=document.querySelector('#mj-mySpots .notice');return e&&e.innerText;});
R.mySpots0=await p.evaluate(()=>[...document.querySelectorAll('#mj-mySpots .myrow')].map(r=>r.innerText.replace(/\s+/g,' ')));
await p.evaluate(()=>{location.hash='#map';});await sleep(2500);
R.mapBanner=await p.evaluate(()=>document.getElementById('mMig')&&document.getElementById('mMig').innerText);
R.legend=await p.evaluate(()=>{const e=document.querySelector('.mtleg');return e&&e.innerText.replace(/\s+/g,' ');});
R.pins=await p.evaluate(()=>[...document.querySelectorAll('.mpin-t')].map(e=>e.textContent));
await p.screenshot({path:SH+'map-migration.png'});
await p.evaluate(()=>document.getElementById('mMigOk').click());await sleep(300);
R.migSeen=await p.evaluate(()=>[JSON.parse(localStorage.getItem('mbj_spot_mig')).seen,document.getElementById('mMig').innerText.trim()]);
// export keeps colour + adds type
R.exportSpots=await p.evaluate(()=>FT.spots.exportData().spots.map(c=>({n:c.name,color:c.color,type:c.type})));
// 2) scoring by type at Private spot 8 (km 19.97), Sun 11 + Mon 12 Oct 2026
async function dayInfo(){return p.evaluate(()=>{const S=window.__MJ_STATE;const fmt=t=>new Date(t+36e6).toISOString().slice(11,16);
  return{spotType:S.spotType||'',days:S.days.slice(0,2).map(d=>({date:d.dateStr,rating:d.rating,
    windows:d.windows.slice().sort((a,b)=>b.score-a.score).slice(0,3).map(w=>({t:fmt(w.start)+'–'+fmt(w.end),score:w.score,tide:w.peak.T&&w.peak.T.label,pref:w.peak.T&&w.peak.T.pref!=null?+w.peak.T.pref.toFixed(2):null})),
    hourly:d.hourly.map(h=>h.score)})),
   src:document.getElementById('mj-tideSrc').innerText.split('\n').slice(-1)[0].slice(0,160),
   reasons:[...document.querySelectorAll('#mj-windows .win')].slice(0,2).map(w=>w.innerText.replace(/\s+/g,' ').slice(0,260))};});}
await p.evaluate(()=>{location.hash='#bite';});await sleep(500);
await p.evaluate(()=>{const l=FT.spots.get('cwake01');FT.biteSetLoc({name:l.name+' — Baffle Ck',lat:l.lat,lng:l.lng,tz:'Australia/Brisbane',baffleKm:l.km,spotId:l.id});});
await sleep(300);await ready();
await p.evaluate(()=>FT.biteSetDate('2026-10-11'));await sleep(300);await ready();
const T={};
for(const ty of ['ro','tot','bot','','ri']){await p.evaluate(t=>{document.body.dataset.biteReady='';FT.spots.update('cwake01',{type:t});},ty);await ready();T[ty||'general']=await dayInfo();
  if(ty==='ri'||ty==='ro'){await p.evaluate(()=>document.getElementById('mj-windows').scrollIntoView());await p.screenshot({path:SH+'bite-privspot-'+ty+'.png'});}}
R.scores=T;
// general typed vs untyped built-in model at the same km must be identical
R.generalEqualsUntyped=await p.evaluate(()=>{const S=window.__MJ_STATE;return S.spotType==null||S.spotType==='';});
// 3) ranking — Private spot 8 run-in, Hugh's run-out, + a TOT and a BOT test spot
await p.evaluate(()=>{FT.spots.update('cwake01',{type:'ri'});FT.spots.update('chugh01',{type:'ro'});FT.spots.update('cblue01',{type:'tot'});
  const [la,ln]=BT.pointAtKm(5.8);FT.spots.add({name:'BOT test',lat:la,lng:ln,type:'bot'});});await sleep(400);await ready();
R.ranking=await p.evaluate(()=>[...document.querySelectorAll('#mj-mySpots .myrow')].map(r=>r.innerText.replace(/\s+/g,' ')));
await p.evaluate(()=>document.getElementById('mj-mySpots').scrollIntoView());await sleep(200);await p.screenshot({path:SH+'bite-myspots.png'});
// click Hugh's row -> becomes the bite location, run-out scoring
await p.evaluate(()=>{document.body.dataset.biteReady='';[...document.querySelectorAll('#mj-mySpots .myrow')].find(r=>/Hugh/.test(r.innerText)).click();});await ready();
R.afterClick=await p.evaluate(()=>({loc:window.__MJ_STATE.spotType,name:document.getElementById('mj-locInfo').innerText.slice(0,80),bafSel:document.getElementById('mj-bafSel').selectedOptions[0].textContent}));
// landmark (built-in) = generic model
await p.evaluate(()=>{document.body.dataset.biteReady='';const s=document.getElementById('mj-bafSel');s.value=[...s.options].find(o=>/Winfield/.test(o.textContent)).value;s.dispatchEvent(new Event('change'));});await ready();
R.landmark=await p.evaluate(()=>({st:window.__MJ_STATE.spotType,label:window.__MJ_STATE.days[0].windows[0]&&window.__MJ_STATE.days[0].windows[0].peak.T.label}));
// 4) map pins after typing
await p.evaluate(()=>{location.hash='#map';});await sleep(2000);
await p.evaluate(()=>{const b=[...document.querySelectorAll('button,label')].find(x=>/bite/i.test(x.textContent)&&/colou?r/i.test(x.textContent));b&&b.click();});await sleep(1500);
R.pins2=await p.evaluate(()=>[...document.querySelectorAll('.leaflet-marker-icon')].map(e=>e.innerText.replace(/\s+/g,' ')).filter(Boolean));
await p.screenshot({path:SH+'map-types.png'});
// 5) catch log at Private spot 8 (run-in) — past session Sun evening + share in TEST mode (relay aborted)
await p.evaluate(()=>{localStorage.setItem('mbj_test','1');});
await p.evaluate(()=>{location.hash='#log';});await sleep(800);
const H=async sel=>{await p.$eval(sel,e=>e.scrollIntoView({block:'center'}));await p.click(sel);};
const setv=(sel,v)=>p.$eval(sel,(e,v)=>{e.value=v;e.dispatchEvent(new Event('change',{bubbles:true}));},v);
const now=Date.now(),q=Math.floor(now/9e5)*9e5,local=ms=>new Date(ms+36e6).toISOString().slice(0,16);
await H('#cPastBtn');await sleep(200);
const li=await p.$$eval('#cSpotSel option',os=>os.find(o=>/Private spot 8/.test(o.textContent)).value);await p.select('#cSpotSel',li);
await setv('#cS0',local(q-4*3600e3));await setv('#cS1',local(q-1*3600e3));await H('#cYesBites');await setv('#cCt',local(q-2*3600e3));
await p.select('#cSp','MJ');await setv('#cLen','44');await p.select('#cFate','released');await H('#cAddCatch');await H('#cSave');await sleep(800);
R.session=await p.evaluate(()=>{const s=FT.catchLog.log.find(s=>s.spot&&/Private spot 8/.test(s.spot.name));return s&&{spot:{name:s.spot.name,spotId:s.spot.spotId,stype:s.spot.stype},ctxStype:s.ctx&&s.ctx.stype,stg:s.ctx&&s.ctx.slots.map(x=>x.stg).join(','),tl:s.ctx&&s.ctx.slots[0].tl};});
await H('#cShareOn');await sleep(300);await p.evaluate(()=>document.getElementById('cShareOld')&&document.getElementById('cShareOld').click());await sleep(1500);
R.relay=relay.map(x=>{try{const m=JSON.parse(x);return{st:m.st,slotLen:m.sl&&m.sl[0].length,stage:m.sl&&m.sl.map(s=>s[13]),keys:Object.keys(m)};}catch(e){return x&&x.slice(0,100);}});
fs.writeFileSync('/tmp/spt_msgs.jsonl',relay.filter(Boolean).map(x=>JSON.stringify({id:'t'+Math.random().toString(16).slice(2),time:Math.floor(Date.now()/1000),message:x})).join('\n')+'\n');
await p.evaluate(()=>{const b=document.querySelector('#cMyViews [data-v="stype"]');b&&b.click();});await sleep(300);
R.analysis=await p.evaluate(()=>document.getElementById('cMyCharts').innerText.replace(/\s+/g,' ').slice(0,400));
await p.evaluate(()=>document.getElementById('cMyCharts').scrollIntoView());await p.screenshot({path:SH+'log-stype.png'});
await p.evaluate(()=>FT.catchLog&&document.querySelector('[id=cExport]')&&document.getElementById('cExport').click());await sleep(300);
R.csv=await p.evaluate(()=>{const t=window.__MBJ_LAST_EXPORT||'';const L=t.split('\n');return [L[0].split(',').slice(-4).join(','),...L.filter(l=>/^spot,|^session,/.test(l)).map(l=>l.split(',').slice(-4).join(',')).slice(0,6)];});
// 6) gauge spot card bite button
await p.evaluate(()=>{location.hash='#gauges';});await sleep(2500);
await p.evaluate(()=>{const d=document.querySelector('#gSpots details');if(d)d.open=true;const bt=[...document.querySelectorAll('#gSpots [data-sp]')].find(x=>/Hugh/.test(x.textContent));bt&&bt.click();});await sleep(1500);
R.gcard=await p.evaluate(()=>[...document.querySelectorAll('.gsp-card')].map(c=>c.innerText.replace(/\s+/g,' ').slice(0,200)));
await p.evaluate(()=>{document.body.dataset.biteReady='';const b=document.querySelector('.gsp-card [data-gbite]');b&&b.click();});await ready();
R.gbite=await p.evaluate(()=>({tab:document.body.dataset.tab,st:window.__MJ_STATE.spotType,loc:document.getElementById('mj-locInfo').innerText.slice(0,60)}));
R.errs=errs;console.log(JSON.stringify(R,null,1));await b.close();
