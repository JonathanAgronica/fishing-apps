import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const SH=process.env.SH||'/workspace/multisys/shots/pumice';
import fs from 'fs';fs.mkdirSync(SH,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const ok=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)process.exitCode=1;};const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|tile/i.test(m.text()))errs.push(m.text());});
await p.evaluateOnNewDocument(()=>{window.__DC_OPEN=1;});
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'?sys=pumicestone-passage#baffle',{waitUntil:'networkidle0',timeout:120000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});
const info=await p.evaluate(()=>({sys:FT.SYS,two:!!BT.TWO,lines:BT.LINES.map(l=>l.name),max:BT.lineMax('M'),lm:BT.LANDMARKS.length}));
ok(info.two&&info.max>40,'two-entrance passage loaded, '+info.max.toFixed(1)+' km, '+info.lines.length+' channels, '+info.lm+' landmarks');
ok(['Coochin Creek','Bells Creek','Hussey Creek','Halls Creek','Mellum Creek','Ningi Creek','Elimbah Creek','Glass Mountain Creek','Bullock Creek','Lamerough Canal'].every(n=>info.lines.includes(n)),'side creeks present');
// Tides tab at Coochin Ck 1.5 km up
await p.evaluate(()=>{const ls=document.getElementById('bt-line');if(ls){ls.value='T5';ls.dispatchEvent(new Event('change'));}});await sleep(400);
await p.evaluate(()=>{const k=document.getElementById('bt-km');if(k){k.value=(BT.LINES.find(l=>l.id==='T5').j+1.5).toFixed(2);k.dispatchEvent(new Event('input'));k.dispatchEvent(new Event('change'));}});await sleep(800);
const tide=await p.evaluate(()=>{const f=document.querySelector('#tab-baffle .fed');return{fed:f?f.innerText:null,tbl:(document.getElementById('bt-table')||document.body).innerText.slice(0,200)};});
ok(tide.fed&&/north \d+% \/ south \d+%/.test(tide.fed)&&/est\./.test(tide.fed),'Tides tab Fed-from note at Coochin: '+(tide.fed||'').replace(/\s+/g,' ').slice(0,140));
const el=await p.$('#tab-baffle section.card');await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:SH+'/tides-coochin.png',fullPage:false});
await p.evaluate(()=>{const e=document.querySelector('#tab-baffle .fed');e&&e.scrollIntoView({block:'center'});});await sleep(200);await p.screenshot({path:SH+'/tides-coochin-fed.png'});
// passage km both ways
await p.evaluate(()=>{const ls=document.getElementById('bt-line');ls.value='M';ls.dispatchEvent(new Event('change'));const k=document.getElementById('bt-km');k.value='30';k.dispatchEvent(new Event('input'));k.dispatchEvent(new Event('change'));});await sleep(600);
const both=await p.evaluate(()=>document.getElementById('tab-baffle').innerText);ok(/from the Caloundra bar/.test(both)&&/Fed from/.test(both),'passage spot shows km both ways + fed note');
// stretch table has gauges & node landmark
ok(/Tidal node/.test(both)&&/Halls Bay/.test(both)&&/Caloundra bar/.test(both),'landmarks: tidal node, Halls Bay gauge, Caloundra bar');
// Gauges
await p.goto(BASE+'#gauges',{waitUntil:'networkidle0'});await sleep(5000);
const g=await p.evaluate(()=>({fed:(document.getElementById('gFed')||{}).innerText,lat:document.getElementById('gLatest').innerText,leg:document.getElementById('gLegend').innerText}));
ok(g.fed&&/Fed from/.test(g.fed),'Gauges tab fed note: '+(g.fed||'').split('\n')[0].slice(0,120));
ok(/Halls Bay/.test(g.lat+g.leg)&&/Golden Beach/.test(g.lat+g.leg),'Gauges: Halls Bay + Golden Beach gauges shown');
await p.screenshot({path:SH+'/gauges.png'});
// Map around Coochin
await p.goto(BASE+'?sys=pumicestone-passage#map',{waitUntil:'domcontentloaded'});await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('body[data-map-ready="1"]',{timeout:60000});
await p.evaluate(()=>FT.mapDebug.map.setView([-26.905,153.07],13,{animate:false}));await sleep(3500);
const mp=await p.evaluate(()=>{const L=[...document.querySelectorAll('.mkm')].map(e=>e.textContent);return{n:L.length,both:L.filter(t=>/S · \d+ N/.test(t)).length,side:L.filter(t=>/Coochin Ck \d km/.test(t)).length};});
ok(mp.both>=3&&mp.side>=3,'map km labels both ways ('+mp.both+') + Coochin Ck side labels ('+mp.side+')');
await p.screenshot({path:SH+'/map-coochin.png'});
// Bite / Plan / Calendar smoke at a Coochin spot
await p.goto('about:blank');await p.goto(BASE+'?sys=pumicestone-passage#bite',{waitUntil:'domcontentloaded',timeout:90000});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
await p.evaluate(()=>{const km=BT.LINES.find(l=>l.id==='T5').j+1.5,pt=BT.pointOnLine(km,'T5');FT.biteSetLoc({name:'Coochin test',lat:pt[0],lng:pt[1],tz:'Australia/Brisbane',baffleKm:km,baffleLine:'T5',sys:FT.SYS});});
await sleep(1500);await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
const bite=await p.evaluate(()=>({lure:(document.getElementById('mj-lure')||{}).innerText||'',days:(window.__MJ_STATE&&__MJ_STATE.days||[]).length}));
ok(bite.days>0&&bite.lure.length>10,'Bite tab computes at Coochin (days '+bite.days+', lure card)');
const sid=await p.evaluate(()=>{const km=BT.LINES.find(l=>l.id==='T5').j+1.5,pt=BT.pointOnLine(km,'T5');const s=FT.spots.add({name:'TEST Coochin',lat:pt[0],lng:pt[1],type:'ri',depth:'s'});return s.id;});
const sp=await p.evaluate(id=>{const s=FT.spots.get(id);return{line:s.line,km:s.km,depth:s.depth,lbl:FT.spots.kmLabel(s.km,s.line)};},sid);
ok(sp.line==='T5'&&sp.depth==='s','custom spot snaps to Coochin Ck: '+sp.lbl);
const ds=await p.evaluate(()=>document.getElementById('mj-date').value);
await p.evaluate(d=>FT.planDay(d),ds);await p.waitForFunction(d=>document.body.dataset.planReady===d,{timeout:240000},ds);
const pl=await p.$eval('#planB',e=>({n:e.querySelectorAll('.lure1').length,t:e.innerText.slice(0,120)}));ok(pl.n>=1,'Plan my day works with lure ('+pl.n+')');
await p.evaluate(()=>FT.plan.close());await p.evaluate(()=>FT.showTab('cal'));await sleep(500);
await p.evaluate(d=>FT.cal.openDay(d),ds);await p.waitForFunction(d=>document.body.dataset.calSheet===d,{timeout:180000},ds);
const cal=await p.$eval('#calSheetB',e=>e.innerText.length);ok(cal>50,'Calendar day detail renders');
const band=await p.evaluate(()=>{const km=BT.LINES.find(l=>l.id==='T5').j+1.5;return FT.catchBand?FT.catchBand(km,'T5'):'n/a';});console.log('  catch band',band);
ok(!errs.length,'no JS errors '+errs.slice(0,3).join(' | '));
// merged system alias
const p2=await (await b.createBrowserContext()).newPage();await p2.goto(BASE+'?sys=hussey-creek#baffle',{waitUntil:'networkidle0'});await sleep(1000);
const aliasNow=await p2.evaluate(()=>{localStorage.setItem('ft_sys','halls-creek');return FT.SYS;});await p2.reload({waitUntil:'networkidle0'});const al2=await p2.evaluate(()=>FT.SYS);
ok(al2==='pumicestone-passage','old halls-creek/hussey-creek selection redirects to the merged passage ('+aliasNow+' / '+al2+')');
await b.close();
