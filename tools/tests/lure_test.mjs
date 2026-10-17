import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const SH=process.env.SHOTS||'/workspace/multisys/shots/lure/';fs.mkdirSync(SH,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await (await b.createBrowserContext()).newPage();const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load|tile/.test(m.text()))errs.push(m.text());});p.on('dialog',d=>d.accept());
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
const ok=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)process.exitCode=1;};const sl=ms=>new Promise(r=>setTimeout(r,ms));
await p.goto(BASE+'?sys=baffle#bite',{waitUntil:'networkidle0',timeout:120000});await p.evaluate(()=>localStorage.clear());
await p.goto(BASE+'?sys=baffle#bite',{waitUntil:'networkidle0',timeout:120000});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:90000});
// unit: chart cells + lore
const U=await p.evaluate(()=>{const A=o=>FTLure.advise(o);return{
  brightClear:A({stage:'ri',range:1.2,rangeMax:2,km:2,maxKm:40,alt:50,cloud:10,moon:0.5}),
  roOvercastStained:A({stage:'ro',range:1.6,rangeMax:2,km:15,maxKm:40,alt:40,cloud:90,moon:0.5}),
  floodMuddy:A({stage:'bot',range:1.8,rangeMax:2,km:20,maxKm:40,alt:40,cloud:20,flood:{phase:'dirty',day:2},rain24:30}),
  nightStained:A({stage:'ro',range:1.6,rangeMax:2,km:25,maxKm:40,alt:-30,cloud:50,moon:0.1}),
  tanninBright:A({stage:'tot',range:1,rangeMax:2,km:34,maxKm:40,alt:50,cloud:10})};});
for(const[k,v]of Object.entries(U))console.log('   ',k.padEnd(18),v.line,'|',v.profile);
ok(U.brightClear.clarity==='clear'&&U.brightClear.keys.includes('prawn'),'bright clear run-in → natural colours');
ok(U.roOvercastStained.clarity==='stained'&&U.roOvercastStained.keys[0]==='chart','stained run-out overcast → chartreuse first');
ok(U.floodMuddy.clarity==='muddy'&&U.floodMuddy.keys[0]==='black'&&U.floodMuddy.rattle,'flood muddy → black + rattle');
ok(U.nightStained.light==='night'&&U.nightStained.keys.includes('purple'),'night stained → purple');
ok(U.tanninBright.keys[0]==='gold','upper-creek tannin bright → gold first');
// Bite tab card
await p.evaluate(()=>{const s=document.getElementById('mj-bafSel');const o=[...s.options].find(o=>/Private spot 8|Bottle|km/.test(o.textContent)&&o.value!=='');s.value=[...s.options][8].value;s.dispatchEvent(new Event('change',{bubbles:true}));});
await p.waitForFunction(()=>document.body.dataset.lure,{timeout:60000});await sl(800);
const card=await p.$eval('#mj-lure',e=>({t:e.innerText,n:e.querySelectorAll('.lsw').length}));
ok(card.n===3&&/guide/.test(card.t)&&/Profile/.test(card.t),'Bite tab lure card: 3 swatches, guide label, profile — '+card.t.split('\n').slice(0,3).join(' / '));
const before=card.t;const box=await p.$eval('#mj-chart',e=>{const r=e.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height};});
await p.$eval('#mj-chart',e=>e.scrollIntoView({block:'center'}));const box2=await p.$eval('#mj-chart',e=>{const r=e.getBoundingClientRect();return{x:r.left,y:r.top,w:r.width,h:r.height};});
await p.touchscreen.tap(box2.x+box2.w*0.85,box2.y+box2.h*0.5);await sl(300);
const after=await p.$eval('#mj-lure',e=>e.innerText);ok(after!==before,'chart touch updates lure time: '+after.split('\n')[0]);
await p.$eval('#mj-lure',e=>e.scrollIntoView({block:'center'}));await p.screenshot({path:SH+'bite-lure.png'});
// custom spot → My spots + popup + plan + calendar
const id=await p.evaluate(()=>FT.spots.add({name:'TEST spot',lat:-24.5195,lng:152.0262,type:'ri'}).id);await sl(1500);
const ms=await p.$eval('#mj-mySpots',e=>e.querySelectorAll('.lure1').length);ok(ms>=1,'My spots today rows carry lure line');
await p.evaluate(()=>FT.showTab('map'));await sl(2500);await p.evaluate(id=>FT.mapDebug.openSpot(id),id);await sl(700);
const pop=await p.$eval('.leaflet-popup',e=>({t:e.innerText,n:e.querySelectorAll('.lsw').length})).catch(()=>({t:'',n:0}));ok(pop.n===3&&/Lure now/.test(pop.t),'map popup shows lure now');
await p.screenshot({path:SH+'map-popup-lure.png'});
await p.evaluate(()=>FT.showTab('bite'));const ds=await p.evaluate(()=>document.getElementById('mj-date').value);
await p.evaluate(d=>FT.planDay(d),ds);await p.waitForFunction(d=>document.body.dataset.planReady===d,{timeout:240000},ds);
const pl=await p.$eval('#planB',e=>e.querySelectorAll('.lure1').length);ok(pl>=1,'Plan my day fish stops show lure ('+pl+')');
await p.evaluate(()=>FT.plan.close());await p.evaluate(()=>FT.showTab('cal'));await sl(500);
await p.evaluate(d=>FT.cal.openDay(d),ds);await p.waitForFunction(d=>document.body.dataset.calSheet===d,{timeout:120000},ds);
const cal=await p.$eval('#calSheetB',e=>e.querySelectorAll('.lure1').length);ok(cal>=1,'Calendar day detail shows lure ('+cal+')');
await p.evaluate(()=>document.querySelector('#calSheetB .lure1').scrollIntoView({block:'center'}));await p.screenshot({path:SH+'cal-lure.png'});
// catch log colour (catch-only + CSV)
await p.evaluate(()=>FT.showTab('log'));await sl(300);await p.$eval('#cCatchOnlyBtn',e=>e.click());await sl(200);
ok(await p.$eval('#cColour',e=>e.getBoundingClientRect().height>0),'catch-only form has lure colour field');
await p.select('#cSpotSel',await p.$eval('#cSpotSel',e=>[...e.options].find(o=>/^L/.test(o.value)).value));
await p.$eval('#cCt',e=>{e.value='2016-03-05T18:10';e.dispatchEvent(new Event('change',{bubbles:true}));});await p.type('#cLen','47');await p.type('#cColour','Chartreuse');
await p.$eval('#cSave',e=>e.click());await sl(400);
const r=await p.evaluate(()=>{FT.catchLog.importCSV('date,time,km,caught,count,size,colour\n2012-01-08,dusk,12,y,1,50,gold\n');return FT.catchLog.log.map(s=>s.catches.map(c=>c.colour)).flat();});
ok(r.includes('Chartreuse')&&r.includes('gold'),'colour saved from catch-only + CSV import: '+r);
await p.evaluate(()=>FT.catchLog.exportCSV());const ex=await p.evaluate(()=>window.__MBJ_LAST_EXPORT);ok(/lure_colour/.test(ex)&&/Chartreuse/.test(ex),'export has lure_colour');
const priv=await p.evaluate(()=>document.documentElement.outerHTML.includes('TEST spot')&&!!localStorage);
// ---- depth classes
const D=await p.evaluate(()=>{const S=FT.spots;const a=S.add({name:'TEST shallow',lat:-24.5195,lng:152.0262,type:'ri',depth:'s'}),d=S.add({name:'TEST deep',lat:-24.5195,lng:152.0262,type:'ri',depth:'d'}),m=S.add({name:'TEST mid',lat:-24.5195,lng:152.0262,type:'ri',depth:'m'});
  const out={};for(const ds of ['2026-10-09','2026-10-14','2026-10-18','2026-10-22','2026-10-25']){const r=BT.baffleTide?null:null;}
  const day=(c,ds)=>{const rr=FT.cal&&null;return null;};
  const ex=S.exportData();const back=ex.spots.filter(x=>/TEST (shallow|deep)/.test(x.name)).map(x=>x.depth);
  return{ids:[a.id,d.id,m.id],dep:[a.depth,d.depth,m.depth],back};});
ok(D.dep.join()==='s,d,m'&&D.back.join()==='s,d','depth saved + in spot JSON export: '+D.back);
const rows=await p.evaluate(async(ids)=>{const S=FT.spots;const res=[];for(const ds of ['2026-10-10','2026-10-14','2026-10-18','2026-10-24']){const o={ds};
  for(const [k,id] of [['s',ids[0]],['d',ids[1]],['m',ids[2]]]){const l=S.get(id);const P=FTCalc?null:null;
   const tide=window.__t=null;}
  res.push(o);}return res;},D.ids);
// scoring via Bite tab on each spot (real UI path)
const sc={};for(const [k,i] of [['s',0],['m',2],['d',1]]){await p.evaluate(id=>{FT.showTab('bite');const l=FT.spots.get(id);FT.biteSetLoc({name:l.name+' — Baffle Ck',lat:l.lat,lng:l.lng,tz:'Australia/Brisbane',baffleKm:l.km,spotId:l.id});},D.ids[i]);
  await p.waitForFunction(()=>document.body.dataset['biteReady']==='1',{timeout:60000});await sl(2500);
  sc[k]=await p.evaluate(()=>{const st=FT.__biteState&&FT.__biteState();return [...document.querySelectorAll('#mj-days .day')].map(e=>e.innerText.match(/(\d+)\/100/)?.[1]).join(',')+' | '+document.getElementById('mj-windows').innerText.split('\n').filter(x=>/spot on a/.test(x)).slice(0,1).join('');});}
console.log('   7-day ratings  s:',sc.s,'\n                  d:',sc.d,'\n                  m:',sc.m);
ok(/Shallow \(1–3 m\) spot on a/.test(sc.s)&&/Deep \(6 m\+\) spot on a/.test(sc.d)&&!/spot on a/.test(sc.m),'depth reason shown in Bite windows (shallow/deep; mid neutral)');
const lp=await p.$eval('#mj-lure',e=>e.innerText);ok(/heavier vibe|weighted plastic/.test(lp),'deep spot → heavier vibe/plastic in lure profile');
await p.evaluate(()=>FT.showTab('map'));await sl(1500);await p.evaluate(id=>FT.mapDebug.openSpot(id),D.ids[0]);await sl(600);
const pp=await p.$eval('.leaflet-popup',e=>e.innerText);ok(/1–3 m/.test(pp),'popup depth badge');
const mk=await p.evaluate(()=>[...document.querySelectorAll('.mpin-d')].map(e=>e.textContent));ok(mk.includes('1-3')&&mk.includes('6+'),'map marker depth badges: '+mk);
await p.$eval('.leaflet-popup [data-a=edit]',e=>e.click());await sl(300);await p.select('.leaflet-popup .mdp','m');await p.$eval('.leaflet-popup [data-x=ok]',e=>e.click());await sl(400);
ok(await p.evaluate(id=>FT.spots.get(id).depth,D.ids[0])==='m','spot editor changes depth');await p.screenshot({path:SH+'map-depth.png'});
const imp=await p.evaluate(()=>{const S=FT.spots;const ex=S.exportData();const x=ex.spots.find(s=>s.name==='TEST deep');const c={...x,id:'c0123456789'};return S.importData({v:1,kind:'mbj-spots',spots:[c]})&&S.get('c0123456789').depth;});
ok(imp==='d','spot JSON import keeps depth');
ok(errs.length===0,'no JS errors '+errs.join(' | '));await b.close();
