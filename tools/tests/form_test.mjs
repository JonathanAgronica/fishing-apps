import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const SH=process.env.SHOTS||'/workspace/multisys/shots/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await (await b.createBrowserContext()).newPage();const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.setViewport({width:390,height:844,deviceScaleFactor:3,isMobile:true,hasTouch:true});
await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
await p.goto(BASE+'#log',{waitUntil:'domcontentloaded'});await p.evaluate(()=>localStorage.clear());
await p.reload({waitUntil:'networkidle0'});await p.waitForSelector('body[data-log-ready="1"]',{timeout:60000});
const sl=ms=>new Promise(r=>setTimeout(r,ms));const tap=async s=>{await p.$eval(s,e=>e.scrollIntoView({block:'center'}));await p.tap(s);await sl(250);};
const ok=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)process.exitCode=1;};
const msg=()=>p.$eval('#cFormMsg',e=>e.textContent);const open=()=>p.$eval('#cFormCard',e=>!e.hidden);
const vis=s=>p.$eval(s,e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0;});
const pick=(s,v)=>p.$eval(s,(e,v)=>{e.focus();e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.blur();},v); // = what the iOS date/time wheel does
const typ=async(s,v)=>{await p.$eval(s,e=>e.value='');await p.type(s,v);};
const spot=async()=>{const o=await p.$eval('#cSpotSel',e=>[...e.options].find(o=>/^L/.test(o.value)).value);await p.select('#cSpotSel',o);await sl(150);};
const LOG=()=>p.evaluate(()=>FT.catchLog.log.map(s=>({id:s.id,s:s.start,e:s.end,nb:!!s.noBites,co:!!s.co,c:s.catches.map(x=>({t:x.t,len:x.len,sp:x.sp,note:x.note})),ctx:!!s.ctx})));
const L=t=>Date.parse(t+':00+10:00');
await tap('nav.tabs a[data-tab=log]');
// 1) blank session
await tap('#cPastBtn');await spot();await pick('#cS0','2026-10-11T05:30');await pick('#cS1','2026-10-11T08:00');
ok(!(await vis('#cAddCatch')),'past session: fish fields hidden until “Yes”');await tap('#cSave');ok(await open()&&/Caught anything/.test(await msg()),'neither chosen → asks Yes/No: '+await msg());
await tap('#cNoBites');ok(!(await vis('#cAddCatch'))&&!(await vis('#cLen')),'“No — blank session” → no fish fields');
await p.$eval('#cFormCard',e=>e.scrollIntoView());await p.screenshot({path:SH+'form-blank-session.png'});
await tap('#cSave');let G=await LOG();
ok(!(await open())&&G.length===1&&G[0].nb&&G[0].c.length===0&&G[0].ctx&&G[0].s===L('2026-10-11T05:30'),'blank session saves cleanly (no fish, noBites) '+await msg());
// 2) yes but nothing → message; typed but not added → auto-added
await tap('#cPastBtn');await spot();await pick('#cS0','2026-10-10T16:00');await pick('#cS1','2026-10-10T18:00');await tap('#cYesBites');
ok(await vis('#cLen'),'“Yes” shows fish fields');await tap('#cSave');ok(await open()&&/added no fish/.test(await msg()),'Yes + no fish → clear message: '+await msg());
await pick('#cCt','2026-10-10T17:10');await typ('#cLen','44');await tap('#cSave');G=await LOG();
ok(!(await open())&&G.length===2&&G.find(x=>x.c.length&&x.c[0].len===44),'typed fish auto-added on save (no “Add” tap needed)');
// 3) catch-only
await tap('#cCatchOnlyBtn');
for(const s of ['#cS0','#cS1','#cNoBites','#cYesBites','#cBaitCat','#cNote','#cAddCatch','#cCatchList'])ok(!(await vis(s)),'catch-only hides '+s);
for(const s of ['#cCt','#cSpotSel','#cLen','#cSp','#cCnote','#cSave'])ok(await vis(s),'catch-only shows '+s);
await pick('#cCt','2031-01-01T10:00');await spot();await tap('#cSave');ok(await open()&&/future/.test(await msg()),'future catch time rejected: '+await msg());
await pick('#cCt','2015-02-14T19:20');await typ('#cLen','51.5');await p.select('#cSp','MJ');await typ('#cCnote','on the turn');
await p.$eval('#cFormCard',e=>e.scrollIntoView());await p.screenshot({path:SH+'form-catch-only.png'});
await tap('#cSave');G=await LOG();const co=G.find(x=>x.co);
ok(!(await open())&&co&&co.e-co.s===30*6e4&&co.s<=L('2015-02-14T19:20')&&co.e>=L('2015-02-14T19:20')&&co.c.length===1&&co.c[0].len===51.5&&co.c[0].note==='on the turn'&&co.ctx,'catch-only → hidden 30-min session around 19:20, 1 fish 51.5 cm '+await msg());
// 4) edit catch-only
await p.evaluate(id=>document.querySelector(`[data-ed="${id}"]`).click(),co.id);await sl(300);
ok(!(await vis('#cS0'))&&(await p.$eval('#cLen',e=>e.value))==='51.5'&&(await p.$eval('#cCt',e=>e.value))==='2015-02-14T19:20','edit catch-only: catch fields only, prefilled');
await typ('#cLen','53');await pick('#cCt','2015-02-14T20:05');await tap('#cSave');G=await LOG();const co2=G.find(x=>x.id===co.id);
ok(G.length===3&&co2.c.length===1&&co2.c[0].len===53&&co2.s<=L('2015-02-14T20:05')&&co2.e>=L('2015-02-14T20:05'),'edit catch-only updates the fish and moves the session');
// 5) edit blank session
const bl=G.find(x=>x.nb);await p.evaluate(id=>document.querySelector(`[data-ed="${id}"]`).click(),bl.id);await sl(300);
ok(await p.$eval('#cNoBites',e=>e.checked)&&!(await vis('#cLen')),'edit blank session: “No” preselected, no fish fields');
await pick('#cS1','2026-10-11T09:00');await tap('#cSave');G=await LOG();ok(!(await open())&&G.find(x=>x.id===bl.id).e===L('2026-10-11T09:00')&&G.find(x=>x.id===bl.id).nb,'edit blank session saves');
// 6) change blank → yes with fish
await p.evaluate(id=>document.querySelector(`[data-ed="${id}"]`).click(),bl.id);await sl(300);await tap('#cYesBites');await pick('#cCt','2026-10-11T07:00');await typ('#cLen','38');await tap('#cAddCatch');await tap('#cSave');
G=await LOG();ok(G.find(x=>x.id===bl.id).c.length===1&&!G.find(x=>x.id===bl.id).nb,'blank → Yes + fish via Add works');
ok(errs.length===0,'no JS errors '+errs.join('|'));await b.close();
