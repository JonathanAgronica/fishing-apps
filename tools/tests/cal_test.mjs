import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const SH=process.env.SHOTS||'/workspace/multisys/shots/cal/';
import fs from 'fs';fs.mkdirSync(SH,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ck=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)fails++;};
const PERF={};
async function page(sys,o={}){const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[],reqs=[];
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::/.test(m.text()))errs.push('console: '+m.text());});
  p.on('request',r=>reqs.push(r.url()));
  if(!o.sw)await p.setBypassServiceWorker(true);await p.setViewport({width:400,height:860,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  if(o.cpu)await p.emulateCPUThrottling(o.cpu);
  await p.goto(BASE+'?sys='+sys+'#'+(o.tab||'cal'),{waitUntil:o.cpu?'domcontentloaded':'networkidle0',timeout:180000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:90000});
  return{p,ctx,errs,reqs};}
const waitDone=async(p,ms=900000)=>{await p.waitForFunction(()=>document.body.dataset.calDone&&document.body.dataset.calDone===String(FT.cal.st.gen),{timeout:ms,polling:200});};
const plus=n=>{const d=new Date(Date.now()+10*3600e3+n*864e5);return d.toISOString().slice(0,10);};
async function biteMatch(p,ds,pred,label){ /* click 'Bite times here' for the sheet target matching pred, compare windows with the Bite tab */
  const info=await p.evaluate((pred)=>{const sh=FT.cal.st.sheet;const f=new Function('x','return '+pred);const all=sh.top.map(x=>({x,src:'top'})).concat(sh.mine.filter(m=>m.w).map(m=>({x:m.w,src:'mine'})));
    const hit=all.find(a=>f(a.x));if(!hit)return null;const k=sh.targets.indexOf(hit.x.pt);return{k,score:hit.x.score,start:hit.x.w.start,end:hit.x.w.end,name:hit.x.pt.name,km:hit.x.pt.km,src:hit.src};},pred);
  if(!info||info.k<0){ck(false,label+': no sheet target');return null;}
  await p.evaluate(k=>{document.querySelectorAll('#calSheetB [data-act="bite"]')[0];const b=[...document.querySelectorAll('#calSheetB [data-act="bite"]')].find(x=>+x.dataset.k===k);b.click();},info.k);
  await sleep(300);await p.waitForFunction(ds=>document.body.dataset.biteReady==='1'&&window.__MJ_STATE&&window.__MJ_STATE.dateStr===ds,{timeout:90000},ds);await sleep(300);
  const bite=await p.evaluate(()=>{const s=window.__MJ_STATE,d=s.days[0];return{tab:document.body.dataset.tab,loc:document.getElementById('mj-locInfo').innerText.slice(0,80),wins:d.windows.map(w=>({score:w.score,start:w.start,end:w.end})),best:Math.max(...d.pts.map(q=>q.score)),spotType:s.spotType||null};});
  const m=bite.wins.find(w=>w.start===info.start&&w.end===info.end);
  console.log('   ',label,JSON.stringify({cal:{score:info.score,start:new Date(info.start).toISOString(),name:info.name,src:info.src},bite:{tab:bite.tab,loc:bite.loc,wins:bite.wins.map(w=>w.score+'@'+new Date(w.start).toISOString().slice(11,16)),spotType:bite.spotType}}));
  ck(bite.tab==='bite'&&m&&m.score===info.score,`${label}: Bite tab shows the same window ${new Date(info.start).toISOString().slice(11,16)}Z score ${info.score} (Bite: ${m?m.score:'none'})`);
  return{info,bite};}
// ============ 1. Baffle whole system + test spots + month nav + detail/bite match + ics + privacy ============
{const t0=Date.now();const {p,ctx,errs,reqs}=await page('baffle');
 await waitDone(p);const P0=await p.evaluate(()=>FT.cal.st.perf);PERF.baffle_sys={wall:Date.now()-t0,...P0,blocks:P0.blocks.slice(0,2)};
 ck(P0.mode==='Web Worker','Baffle: computed in a Web Worker ('+P0.mode+')');ck(P0.days>=365&&P0.pts>=25,`Baffle whole system: ${P0.days} days × ${P0.pts} points in ${(P0.totalMs/1000).toFixed(1)} s`);
 const g=await p.evaluate(()=>({cells:document.querySelectorAll('#calGrid button.cc[data-d]').length,withScore:document.querySelectorAll('#calGrid .cs').length,stars:document.querySelectorAll('#calGrid .cb').length,moon:document.querySelectorAll('#calGrid .cm').length,month:document.getElementById('calMonth').textContent,fc:document.querySelectorAll('#calGrid .cf').length,wk:document.querySelectorAll('#calGrid .cc.wk').length}));
 console.log('   grid',JSON.stringify(g));ck(g.withScore===g.cells&&g.cells>0&&g.moon>=g.cells,'month grid: every day has score + moon icon');ck(g.fc>0,'forecast days marked');
 await p.screenshot({path:SH+'cal-baffle-month.png'});
 // month navigation (arrows + swipe) to 12 months ahead
 const nav=await p.evaluate(async()=>{const o=[];for(let i=0;i<12;i++){document.getElementById('calNext').click();await new Promise(r=>setTimeout(r,30));o.push([document.getElementById('calMonth').textContent,document.querySelectorAll('#calGrid .cs').length]);}
   const nextDisabled=document.getElementById('calNext').disabled;for(let i=0;i<12;i++)document.getElementById('calPrev').click();return{o,nextDisabled,back:document.getElementById('calMonth').textContent,prevDisabled:document.getElementById('calPrev').disabled};});
 console.log('   nav',JSON.stringify(nav.o.map(x=>x.join(':'))));ck(nav.o.length===12&&nav.o.every(x=>x[1]>0)&&nav.nextDisabled&&nav.prevDisabled,'month navigation: 12 months ahead all filled; arrows clamp at both ends');
 ck(/April 2027/.test(nav.o.map(x=>x[0]).join()),'covers the jack season to April 2027 and beyond ('+nav.o[nav.o.length-1][0]+')');
 // swipe left = next month
 const box=await (await p.$('#calGridWrap')).boundingBox();await p.touchscreen.touchStart(box.x+300,box.y+150);await p.touchscreen.touchMove(box.x+120,box.y+160);await p.touchscreen.touchEnd();await sleep(200);
 const sw=await p.evaluate(()=>document.getElementById('calMonth').textContent);ck(sw!==g.month,'swipe changes month ('+g.month+' → '+sw+')');await p.evaluate(()=>FT.calNav(-1));
 // filters
 const f=await p.evaluate(async()=>{const s=document.getElementById('calMin');s.value='90';s.onchange();const dim=document.querySelectorAll('#calGrid .cc.dim').length;s.value='0';s.onchange();
   const dd=document.getElementById('calDD');dd.checked=true;dd.onchange();const v1=[...document.querySelectorAll('#calGrid .ct')].map(x=>x.textContent);dd.checked=false;dd.onchange();
   const wk=document.getElementById('calWk');wk.checked=false;wk.onchange();const w0=document.querySelectorAll('#calGrid .cc.wk').length;wk.checked=true;wk.onchange();return{dim,v1:v1.slice(0,10),w0};});
 console.log('   filters',JSON.stringify(f));ck(f.dim>0&&f.w0===0,'min-score dims, weekend highlight toggles');
 const ddOk=await p.evaluate(()=>{const C=FT.cal;C.set.dd=true;let ok=true;for(const d of Object.keys(C.st.data)){const v=C.cellVal(d);const h=+new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',hour:'numeric',hour12:false}).format(new Date(v.t));if(!(h<=8||h>=16))ok=false;}C.set.dd=false;return ok;});
 ck(ddOk,'dawn/dusk filter: every day’s best time is in the early morning or evening');
 // best days list
 const bl=await p.evaluate(()=>{document.querySelector('#calViewSeg [data-v=list]').click();const a=[...document.querySelectorAll('#calList .cbr .cbs')].map(x=>+x.textContent);document.querySelector('#calRange [data-r=season]').click();const s=[...document.querySelectorAll('#calList .cbr .cbs')].map(x=>+x.textContent);return{a,s};});
 await p.screenshot({path:SH+'cal-baffle-bestdays.png'});await p.evaluate(()=>document.querySelector('#calViewSeg [data-v=grid]').click());
 console.log('   best days',JSON.stringify(bl));ck(bl.a.length===10&&bl.s.length===10&&bl.s.every((v,i)=>i===0||v<=bl.s[i-1]),'Best days: top 10 of month and of season, sorted');
 // add throwaway test spots (this headless profile only), My spots scope
 const sp=await p.evaluate(()=>{const a=BT.pointAtKm(12.0),b2=BT.pointAtKm(29.5);const s1=FT.spots.add({name:'CalTest RI',lat:a[0]+0.0004,lng:a[1],type:'ri'});const s2=FT.spots.add({name:'CalTest RO',lat:b2[0],lng:b2[1]+0.0003,type:'ro'});const s3=FT.spots.add({name:'CalTest TOT',lat:BT.pointAtKm(20)[0],lng:BT.pointAtKm(20)[1],type:'tot'});return [s1,s2,s3].map(s=>({id:s.id,km:s.km,lat:s.lat,lng:s.lng,type:s.type}));});
 await p.evaluate(()=>{const s=document.getElementById('calScope');s.value='mine';s.onchange();});const t1=Date.now();await waitDone(p);
 const P1=await p.evaluate(()=>FT.cal.st.perf);PERF.baffle_mine={wall:Date.now()-t1,...P1,blocks:P1.blocks.slice(0,2)};ck(P1.pts===3,`My spots scope: ${P1.pts} spots, ${P1.days} days in ${(P1.totalMs/1000).toFixed(1)} s`);
 await p.screenshot({path:SH+'cal-baffle-myspots.png'});
 // detail sheet for an outlook day (no weather → identical to Bite times regardless of weather cell)
 const dOut=plus(30);await p.evaluate(d=>FT.cal.openDay(d),dOut);await p.waitForFunction(d=>document.body.dataset.calSheet===d,{},dOut);
 const sh=await p.evaluate(()=>{const s=FT.cal.st.sheet;return{top:s.top.map(x=>[x.score,x.pt.name,x.stage,x.reasons.length]),mine:s.mine.map(x=>[x.p.name,x.p.type,x.w&&x.w.score,x.w&&x.w.stage]),ms:Math.round(s.ms),txt:document.getElementById('calSheetB').innerText.slice(0,300)};});
 console.log('   sheet',JSON.stringify(sh));ck(sh.top.length===3&&sh.mine.length===3&&sh.top.every(x=>x[2]&&x[3]>=2),'detail sheet: 3 top windows with stage + reasons, 3 ranked spots');
 ck(/OUTLOOK/.test(sh.txt),'outlook day labelled');
 await p.screenshot({path:SH+'cal-baffle-detail.png'});
 const nReqCal=reqs.length;const bm1=await biteMatch(p,dOut,"x.pt.custom&&x.pt.type==='ri'",'Baffle typed RI spot, outlook day '+dOut);
 // single-high day: Sun 18 Oct at ~27.7 km should show a stand somewhere upstream
 await p.evaluate(()=>FT.showTab('cal'));await p.evaluate(()=>{const s=document.getElementById('calScope');s.value='sys';s.onchange();});await waitDone(p);
 ck(await p.evaluate(()=>FT.cal.st.perf.cached===0&&FT.cal.st.pts.filter(x=>x.custom).length===3),'whole system recomputed after the spots changed (3 spots now included)');
 await p.evaluate(()=>{const s=document.getElementById('calScope');s.value='mine';s.onchange();});await waitDone(p);
 ck(await p.evaluate(()=>FT.cal.st.perf.cached>=365),'switching back to My spots: all days from the IndexedDB cache (no recompute)');
 await p.evaluate(()=>{const s=document.getElementById('calScope');s.value='sys';s.onchange();});await waitDone(p);
 await p.evaluate(()=>FT.cal.openDay('2026-10-18'));await p.waitForFunction(()=>document.body.dataset.calSheet==='2026-10-18');
 const st18=await p.evaluate(()=>{const C=FT.cal,pt=C.st.pts.find(x=>x.km>27&&x.km<29&&x.line==='B');const R=C.refine(pt,'2026-10-18');const s0=Date.parse('2026-10-17T14:00:00Z');return{pt:pt.name,stands:(R.T.stands||[]).filter(s=>s.t>=s0&&s.t<s0+864e5).length,txt:document.getElementById('calSheetB').innerText.match(/Single-high[^\n]*/)};});
 console.log('   18 Oct',JSON.stringify(st18));ck(st18.stands>=1,'Baffle single-high stand present in the calendar model on 18 Oct ('+st18.pt+')');
 // ics: day + month
 const ic=await p.evaluate(()=>{document.getElementById('calIcsDay').click();const d=FT.calLastIcs;FT.cal.closeSheet();return d;});
 ck(/BEGIN:VCALENDAR/.test(ic.txt)&&(ic.txt.match(/BEGIN:VEVENT/g)||[]).length===3&&!/CalTest/.test(ic.txt),'day .ics: 3 events, no private spot names ('+ic.name+')');
 await p.evaluate(()=>document.getElementById('calIcsMonth').click());await sleep(1500);const im=await p.evaluate(()=>FT.calLastIcs);
 const n90=await p.evaluate(()=>Object.keys(FT.cal.st.data).filter(d=>d.slice(0,7)===FT.cal.st.month&&FT.cal.cellVal(d).s>=90).length);
 ck(im&&/90plus/.test(im.name)&&(im.txt.match(/BEGIN:VEVENT/g)||[]).length===n90,`month .ics: ${n90} events for the 90+ days`);
 fs.writeFileSync(SH+'sample-day.ics',ic.txt);
 // privacy: no request carried a test spot's coordinates
 const leaks=reqs.slice(0,nReqCal).filter(u=>sp.some(s=>u.includes(s.lat.toFixed(4))||u.includes(s.lng.toFixed(4))));ck(leaks.length===0,'Calendar sent no request containing a test spot coordinate ('+reqs.slice(0,nReqCal).filter(u=>/open-meteo/.test(u)).length+' open-meteo requests, all for the fixed public point) '+leaks.slice(0,2).join(' '));
 console.log('    (after “Bite times here” the Bite tab itself fetched weather for the spot as it always has: '+reqs.slice(nReqCal).filter(u=>/open-meteo/.test(u)&&sp.some(s=>u.includes(s.lat.toFixed(4)))).length+' request(s))');
 ck(errs.length===0,'Baffle: no page errors '+JSON.stringify(errs.slice(0,3)));await ctx.close();}
// ============ 2. Forecast-day exact match on a built-in landmark (weather fetched at that landmark, like Bite times) ============
{const {p,ctx,errs}=await page('baffle');await waitDone(p);
 const lm=await p.evaluate(()=>{const l=FT.spots.builtins().find(x=>/Wartburg/.test(x.name))||FT.spots.builtins()[3];const s=document.getElementById('calScope');s.value='lm:'+l.id;s.onchange();return l.name;});
 await waitDone(p);const d2=plus(2);await p.evaluate(d=>FT.cal.openDay(d),d2);await p.waitForFunction(d=>document.body.dataset.calSheet===d,{},d2);
 ck(await p.evaluate(()=>/FORECAST/.test(document.getElementById('calSheetB').innerText)),'forecast day labelled FORECAST');
 await biteMatch(p,d2,'true','Baffle landmark '+lm+', forecast day '+d2);ck(errs.length===0,'no page errors '+JSON.stringify(errs.slice(0,3)));await ctx.close();}
// ============ 3. Maroochy + a C-grade system ============
for(const sys of ['maroochy-river','elliott-river']){const t0=Date.now();const {p,ctx,errs}=await page(sys);await waitDone(p);
 const P=await p.evaluate(()=>FT.cal.st.perf);PERF[sys]={wall:Date.now()-t0,...P,blocks:P.blocks.slice(0,2)};
 const g=await p.evaluate(()=>({withScore:document.querySelectorAll('#calGrid .cs').length,cells:document.querySelectorAll('#calGrid button.cc[data-d]').length,sys:document.getElementById('calSys').textContent,lines:[...new Set(FT.cal.st.pts.map(x=>x.line))].length,maxkm:Math.max(...FT.cal.st.pts.filter(x=>x.line==='M').map(x=>x.km))}));
 ck(g.withScore===g.cells&&g.cells>0,`${sys}: grid filled (${P.pts} points on ${g.lines} channel(s), main to km ${g.maxkm}) in ${(P.totalMs/1000).toFixed(1)} s`);
 await p.screenshot({path:SH+`cal-${sys}-month.png`});
 const dd=plus(25);await p.evaluate(d=>FT.cal.openDay(d),dd);await p.waitForFunction(d=>document.body.dataset.calSheet===d,{},dd);
 if(sys==='maroochy-river')await p.screenshot({path:SH+'cal-maroochy-detail.png'});
 await biteMatch(p,dd,'true',sys+' top window, outlook day '+dd);
 // Tides button
 await p.evaluate(()=>FT.showTab('cal'));await p.evaluate(d=>FT.cal.openDay(d),dd);await p.waitForFunction(d=>document.body.dataset.calSheet===d,{},dd);
 const tb=await p.evaluate(()=>{const b=document.querySelector('#calSheetB [data-act=tides]');b.click();return{tab:document.body.dataset.tab,date:document.getElementById('bt-date').value};});
 ck(tb.tab==='baffle'&&tb.date===dd,`${sys}: Tides button opens Tides on ${tb.date}`);
 await p.evaluate(()=>FT.showTab('cal'));await p.evaluate(d=>FT.cal.openDay(d),dd);await p.waitForFunction(d=>document.body.dataset.calSheet===d,{},dd);
 await p.evaluate(()=>document.querySelector('#calSheetB [data-act=map]').click());await sleep(2500);ck(await p.evaluate(()=>document.body.dataset.tab==='map'&&!!FT.mapDebug.map&&FT.mapDebug.map.getZoom()>=15),`${sys}: Map button centres the map`);
 ck(errs.length===0,`${sys}: no page errors `+JSON.stringify(errs.slice(0,3)));await ctx.close();}
// ============ 4. Phone-class CPU (4× throttle): Baffle whole system first month + total ============
{const t0=Date.now();const {p,ctx}=await page('baffle&calmain=1',{cpu:4});await p.waitForFunction(()=>FT.cal&&FT.cal.st.perf&&FT.cal.st.perf.blocks&&FT.cal.st.perf.blocks.length>=1,{timeout:600000,polling:200});
 const first=Date.now()-t0;await waitDone(p);const P=await p.evaluate(()=>FT.cal.st.perf);PERF.baffle_cpu4_mainthread={firstMonthWallMs:first,totalMs:P.totalMs,pts:P.pts,days:P.days,firstBlockMs:P.blocks[0].ms};
 const resp=await p.evaluate(async()=>{const t=performance.now();await new Promise(r=>setTimeout(r,0));return performance.now()-t;});
 ck(P.totalMs>0,`4× CPU throttle (main-thread fallback, as CDP can't throttle workers): first month on screen after ${(first/1000).toFixed(1)} s (incl. page load), all ${P.days} days in ${(P.totalMs/1000).toFixed(1)} s`);
 const det=await p.evaluate(async d=>{const t=performance.now();await FT.cal.openDay(d);return performance.now()-t;},plus(5));PERF.baffle_cpu4_mainthread.detailMs=Math.round(det);ck(det<4000,`4× CPU: day detail (15-min refine) in ${Math.round(det)} ms`);await ctx.close();}
// ============ 5. Offline: SW-installed profile, go offline, reload → calendar from cache; new scope still computes ============
{const {p,ctx,errs}=await page('baffle',{sw:true});await waitDone(p);await p.evaluate(()=>navigator.serviceWorker.ready);await p.reload({waitUntil:'networkidle0'});await waitDone(p);
 await p.setOfflineMode(true);await p.reload({waitUntil:'domcontentloaded'});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await waitDone(p,120000);
 const P=await p.evaluate(()=>({perf:FT.cal.st.perf,scored:document.querySelectorAll('#calGrid .cs').length,cells:document.querySelectorAll('#calGrid button.cc[data-d]').length,leg:document.getElementById('calLegend').innerText}));
 ck(P.perf.cached>=365&&P.scored===P.cells,`offline reload: ${P.perf.cached} days from the on-phone cache, grid filled`);
 const dd=await p.evaluate(()=>{const d=document.getElementById('calDD');d.checked=true;d.onchange();return document.querySelectorAll('#calGrid .cs').length;});ck(dd>0,'offline: dawn/dusk filter works');
 await p.evaluate(()=>{const l=FT.spots.builtins()[5];const s=document.getElementById('calScope');s.value='lm:'+l.id;s.onchange();});await waitDone(p,300000);
 const P2=await p.evaluate(()=>FT.cal.st.perf);ck(P2.days>=365&&P2.mode==='Web Worker',`offline: new single-spot scope computed in the worker (${(P2.totalMs/1000).toFixed(1)} s)`);
 ck(errs.filter(e=>!/Failed to fetch|ERR_INTERNET|network/i.test(e)).length===0,'offline: no page errors '+JSON.stringify(errs.slice(0,3)));await ctx.close();}
console.log('PERF',JSON.stringify(PERF));
console.log(fails?fails+' FAILED':'ALL OK');await b.close();
