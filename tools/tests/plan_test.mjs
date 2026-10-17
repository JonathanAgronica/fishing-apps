import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const SH=process.env.SHOTS||'/workspace/multisys/shots/plan/';fs.mkdirSync(SH,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ck=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)fails++;};
const PRIV=JSON.parse(fs.readFileSync('/workspace/private/user-spots.json','utf8')).spots;const TYPES=['ri','ri','ro','ri','ro','ri','ri'];
const ONLY=process.env.ONLY||'';
async function page(sys,o={}){const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[],reqs=[];
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::/.test(m.text()))errs.push('console: '+m.text());});
  p.on('request',r=>reqs.push(r.url()));await p.setBypassServiceWorker(true);
  await p.setViewport({width:400,height:860,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await p.goto(BASE+'?sys='+sys+(o.q||'')+'#'+(o.tab||'bite'),{waitUntil:'networkidle0',timeout:180000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:90000});
  return{p,ctx,errs,reqs};}
const waitPlan=(p,ds)=>p.waitForFunction(ds=>document.body.dataset.planReady===ds,{timeout:240000,polling:200},ds);
const fmt=t=>new Date(t+10*36e5).toISOString().slice(11,16);
const dump=P=>P.blocks.map(b=>`${fmt(b.t0)}-${fmt(b.t1)} ${b.ty.padEnd(4)} ${P.spots[b.loc].name.padEnd(24)} ${b.ty==='fish'?`pk ${b.peak} avg ${b.avg}${b.optional?' opt':''} | ${b.why.map(w=>w.replace(/@T(\d+)/g,(m,x)=>fmt(+x))).join('; ')}`:b.ty==='move'?`${b.km} km ${b.min}m`:''}`).join('\n');
async function shotSheet(p,name){await p.evaluate(()=>{document.querySelector('#planSheet .calsheet-in').scrollTop=0;});await p.screenshot({path:SH+name+'.png'});
  const h=await p.evaluate(()=>document.querySelector('#planSheet .calsheet-in').scrollHeight);await p.setViewport({width:400,height:Math.min(6000,h+60),deviceScaleFactor:2,isMobile:true,hasTouch:true});await sleep(250);await p.screenshot({path:SH+name+'-full.png'});await p.setViewport({width:400,height:860,deviceScaleFactor:2,isMobile:true,hasTouch:true});}
// ===== 1. Baffle + the 7 throwaway test spots, Monday 12 Oct =====
if(!ONLY||ONLY==='baffle'){const {p,ctx,errs,reqs}=await page('baffle');
 const ids=await p.evaluate((S,T)=>S.map((s,i)=>FT.spots.add({name:s.name,lat:s.lat,lng:s.lng,type:T[i]})).map(s=>({id:s.id,km:s.km,type:s.type})),PRIV,TYPES);
 console.log('   test spots km',ids.map(x=>x.km.toFixed(2)+x.type).join(' '));
 await p.evaluate(()=>{document.getElementById('mj-date').value='2026-10-12';});
 const nreq0=reqs.length;const t0=Date.now();await p.click('#mj-planBtn');await waitPlan(p,'2026-10-12');const wall=Date.now()-t0;
 const P=await p.evaluate(()=>FT.plan.cur.plan);console.log(dump(P));console.log('   thr',P.thr,'med',P.med,'fishH',P.fishH,'moveKm',P.moveKm,'mode',P.mode,P.ms+'ms wall',wall);
 console.log('   one',fmt(P.one.t0),fmt(P.one.t1),'solo',P.solo&&[P.spots[P.solo.loc].name,fmt(P.solo.t0),fmt(P.solo.t1)].join(' '),'early',P.early&&fmt(P.early.t0)+' '+P.spots[P.early.loc].name,'late',P.late&&fmt(P.late.t0)+' '+P.spots[P.late.loc].name);
 console.log('   bench',P.bench.map(x=>x.kind+' '+P.spots[x.loc].name+' '+(x.t?fmt(x.t):'')).join(' | '));
 ck(P.mode==='Web Worker','Bite tab button → plan computed in the Web Worker ('+P.ms+' ms, wall '+wall+' ms)');
 ck(P.spots.filter(s=>s.custom).length===7&&P.spots.length<=8,'defaults to the 7 typed spots (+ launch ramp '+P.spots[P.launch].name+')');
 const fish=P.blocks.filter(b=>b.ty==='fish');ck(fish.length>=3,'≥3 fishing blocks ('+fish.length+')');
 ck(P.blocks.some(b=>b.ty==='rest'&&b.next),'has a REST block with "be back at"');
 ck(fish.some(b=>{const h=+fmt(b.t0).slice(0,2);return h>=4&&h<9;}),'has a dawn/morning block');
 const eve0=fish.filter(b=>+fmt(b.t0).slice(0,2)>=16);const eve=eve0.slice(Math.max(0,eve0.findIndex(b=>b.why.some(w=>/run-in/i.test(w)))));const kms=eve.map(b=>P.spots[b.loc].km);ck(eve.length>=2&&kms.every((k,i)=>i===0||k>=kms[i-1]-0.01),'evening run-in leg moves progressively upstream: '+eve.map(b=>P.spots[b.loc].name+' '+fmt(b.t0)).join(' → '));
 ck(eve.some(b=>b.why.some(w=>/run-in/i.test(w))),'evening reasons cite run-in starts');
 ck(!!(P.late||P.early),'late-night/early option offered');ck(P.bench.length>=2,'benchmark checks ('+P.bench.length+')');
 const ui=await p.evaluate(()=>({rows:document.querySelectorAll('.ptl tr').length,svg:!!document.querySelector('#planB svg.pchart polyline'),one:document.querySelector('.pone').innerText,txt:document.getElementById('planB').innerText,w:document.documentElement.scrollWidth}));
 ck(ui.rows===2*P.blocks.length-P.blocks.filter(b=>b.ty==='move').length+1&&ui.svg,'timeline table + mini chart rendered');ck(/be back at/.test(ui.txt)&&!/@T\d/.test(ui.txt)&&!/NaN|undefined/.test(ui.txt),'text formatted (no placeholders/NaN)');ck(ui.w<=400,'no horizontal page overflow at 400 px ('+ui.w+')');
 await shotSheet(p,'plan-baffle-mon12');
 const ic=await p.evaluate(()=>{document.getElementById('planIcs').click();return FT.calLastIcs;});
 const leak=PRIV.some(s=>ic.txt.toLowerCase().includes(s.name.toLowerCase()));ck(/BEGIN:VCALENDAR/.test(ic.txt)&&(ic.txt.match(/BEGIN:VEVENT/g)||[]).length===fish.length&&!leak&&/my spot \(km/.test(ic.txt),'.ics: '+fish.length+' events, "★ my spot (km x)", no names');
 const sh=await p.evaluate(async()=>{navigator.share=undefined;document.getElementById('planShare').click();await new Promise(r=>setTimeout(r,300));return{t:FT.planLastShare,box:document.getElementById('planShareBox').innerText};});
 ck(PRIV.some(s=>sh.t.includes(s.name))&&/keep them to yourself/.test(sh.t)&&/trust/.test(sh.box),'share text includes names + privacy note');
 // options: remembered + replan
 await p.evaluate(()=>{const s=document.getElementById('poThr');s.value='70';s.dispatchEvent(new Event('change'));});await waitPlan(p,'2026-10-12');const P2=await p.evaluate(()=>FT.plan.cur.plan);
 ck(P2.thr===70&&P2.fishH<=P.fishH+0.01,'threshold 70 → less fishing ('+P2.fishH+' h vs '+P.fishH+')');
 await p.evaluate(()=>{const s=document.getElementById('poEnd');s.value='1620';s.dispatchEvent(new Event('change'));});await waitPlan(p,'2026-10-12');const P3=await p.evaluate(()=>FT.plan.cur.plan);
 ck(P3.t1-P3.t0>=23*36e5-1,'end 3am (past midnight) extends the grid');console.log(dump(P3).split('\n').slice(-4).join('\n'));
 const kept=await p.evaluate(()=>JSON.parse(localStorage.getItem(FT.k('ft_plan'))));ck(kept.thr===70&&kept.end===1620,'options remembered in localStorage');
 await p.evaluate(()=>{localStorage.removeItem(FT.k('ft_plan'));});
 await p.evaluate(()=>{Object.assign(FT.plan.set,{thr:'auto',end:1440,dd:true});FT.plan.run();});await waitPlan(p,'2026-10-12');const P4=await p.evaluate(()=>FT.plan.cur.plan);
 ck(P4.blocks.filter(b=>b.ty==='fish').every(b=>{const h=+fmt(b.t0).slice(0,2);return h<=9||h>=15;})||P4.fishH<=P.fishH,'dawn & dusk focus shifts fishing to the ends of the day');
 await p.evaluate(()=>{Object.assign(FT.plan.set,{dd:false,thr:'auto',end:1440});FT.plan.run();});await waitPlan(p,'2026-10-12');
 // Start session
 await p.evaluate(()=>document.getElementById('planStart').click());await sleep(800);
 const cl=await p.evaluate(()=>({tab:document.body.dataset.tab,hidden:document.getElementById('planSheet').hidden,txt:(document.getElementById('tab-log')||document.body).innerText.slice(0,400)}));
 ck(cl.tab==='log'&&cl.hidden,'Start session → Catch log ('+cl.tab+')');await p.screenshot({path:SH+'plan-baffle-startsession.png'});
 // privacy: no network request carries spot coordinates/names
 const bad=reqs.slice(nreq0).filter(u=>PRIV.some(s=>u.includes(s.lat.toFixed(3))||u.includes(encodeURIComponent(s.name))));ck(!bad.length,'no request carried spot coords/names ('+bad.length+')');
 // entry from calendar day sheet
 await p.evaluate(()=>FT.showTab('cal'));await p.waitForFunction(()=>document.body.dataset.calDone,{timeout:600000,polling:300});
 await p.evaluate(()=>FT.cal.openDay('2026-10-13'));await p.waitForFunction(()=>document.body.dataset.calSheet==='2026-10-13',{timeout:60000});
 await p.evaluate(()=>document.getElementById('calPlan').click());await waitPlan(p,'2026-10-13');const P5=await p.evaluate(()=>FT.plan.cur.plan);
 ck(P5.date==='2026-10-13'&&P5.blocks.length>0,'Calendar day sheet → Plan my day for that date');await shotSheet(p,'plan-baffle-from-cal-tue13');
 ck(!errs.length,'no JS errors '+errs.join(' | '));await ctx.close();}
// ===== 2. Maroochy (landmarks) and Elliott (C grade) =====
for(const [sys,ds] of [['maroochy-river','2026-10-12'],['elliott-river','2026-10-12']]){if(ONLY&&!sys.startsWith(ONLY))continue;const {p,ctx,errs}=await page(sys);
 await p.evaluate(ds=>{document.getElementById('mj-date').value=ds;},ds);await p.click('#mj-planBtn');await waitPlan(p,ds);
 const P=await p.evaluate(()=>FT.plan.cur.plan);console.log('--',sys);console.log(dump(P));console.log('   thr',P.thr,'fishH',P.fishH,'launch',P.spots[P.launch].name,P.ms+'ms',P.mode);
 ck(P.spots.length>=3&&P.blocks.some(b=>b.ty==='fish'),sys+': '+P.spots.length+' default landmark spots, '+P.blocks.filter(b=>b.ty==='fish').length+' fish blocks');
 const t=await p.evaluate(()=>document.getElementById('planB').innerText);ck(!/@T\d|NaN|undefined/.test(t),sys+': formatted');
 await shotSheet(p,'plan-'+sys);ck(!errs.length,sys+': no JS errors '+errs.join(' | '));await ctx.close();}
// ===== 3. main-thread fallback + offline =====
if(!ONLY||ONLY==='fallback'){const {p,ctx,errs}=await page('baffle',{q:'&calmain=1'});
 await p.emulateCPUThrottling(4);const t0=Date.now();await p.evaluate(()=>FT.planDay('2026-10-14'));await waitPlan(p,'2026-10-14');const P=await p.evaluate(()=>FT.plan.cur.plan);
 ck(P.mode==='main thread','fallback on main thread at 4× CPU throttle: '+P.ms+' ms (wall '+(Date.now()-t0)+')');
 await p.emulateCPUThrottling(1);await p.setOfflineMode(true);await p.evaluate(()=>{FT.plan.close();FT.planDay('2026-10-20');});await waitPlan(p,'2026-10-20');
 const P2=await p.evaluate(()=>FT.plan.cur.plan);ck(P2.blocks.length>0,'works offline (outlook day 20 Oct)');ck(!errs.length,'no JS errors '+errs.join(' | '));await ctx.close();}
await b.close();console.log(fails?`${fails} FAIL`:'ALL OK');process.exit(fails?1:0);
