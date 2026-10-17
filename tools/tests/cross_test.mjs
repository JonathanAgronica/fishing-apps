import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';
const SH='/workspace/multisys/shots/cross/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const ok=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)process.exitCode=1;};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'#baffle',{waitUntil:'networkidle0',timeout:120000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await sleep(1500);
const base=await p.evaluate(()=>({x:!!(window.FT&&FT.cross),xt:!!document.querySelector('#xTides .xbox,#xTides table'),shade:document.querySelectorAll('#bt-chart .xshade').length}));
ok(base.x,'FT.cross loaded');ok(!base.shade,'no shading with no crossings');
// add a crossing on Baffle main at km 30 with a threshold that closes around low tide
const r=await p.evaluate(()=>{const B=window.BT,C=FT.cross;const pt=B.pointAtKm(30);const h=B.nowH();const P=B.predictAt(30,h,h+24,FT.baffleOpts());
  let lo=1e9,hi=-1e9;for(let t=h;t<h+24;t+=0.1){const v=P.curve(t);if(v!=null){lo=Math.min(lo,v);hi=Math.max(hi,v);}}
  const thr=+(lo+(hi-lo)*0.35).toFixed(2);const c=C.add({lat:pt[0],lng:pt[1],name:'Test bar',thr,note:'test'});
  const w=C.closed(C.get(c.id),h,h+24*7);return{c,thr,lo,hi,n:w.length,w0:w[0]};});
ok(r.c.line==='B'&&Math.abs(r.c.km-30)<0.3,'crossing snapped to channel '+r.c.line+' km '+r.c.km.toFixed(2));
ok(r.n>=7,`closed windows over 7 days: ${r.n} (thr ${r.thr}, range ${r.lo.toFixed(2)}..${r.hi.toFixed(2)})`);
// Tides: select km 33 (upstream of crossing)
await p.evaluate(()=>{const k=document.querySelector('#bt-km');k.value=33;k.dispatchEvent(new Event('input'));});await sleep(1500);
const t=await p.evaluate(()=>({shade:document.querySelectorAll('#bt-chart .xshade').length,thr:document.querySelectorAll('#bt-chart .xthr').length,list:(document.querySelector('#xTides')||{}).innerText||''}));
ok(t.shade>0&&t.thr>0,`Tides shading ${t.shade} rects, threshold line ${t.thr}`);ok(/Test bar/.test(t.list)&&/No passage|closed/i.test(t.list),'Tides 7-day list: '+t.list.slice(0,160).replace(/\n/g,' | '));
// downstream spot: no shading
await p.evaluate(()=>{const k=document.querySelector('#bt-km');k.value=20;k.dispatchEvent(new Event('input'));});await sleep(1200);
const t2=await p.evaluate(()=>document.querySelectorAll('#bt-chart .xshade').length);ok(t2===0,'no shading for a spot downstream of the crossing');
await p.evaluate(()=>{const k=document.querySelector('#bt-km');k.value=33;k.dispatchEvent(new Event('input'));});await sleep(1500);
await p.evaluate(()=>document.querySelector('#bt-chart').scrollIntoView({block:'start'}));await p.evaluate(()=>window.scrollBy(0,-70));await sleep(300);
await p.screenshot({path:SH+'tides.png'});
// Gauges
await p.evaluate(()=>document.querySelector('[data-tab=gauges]').click());await sleep(5000);
const g=await p.evaluate(()=>({sh:document.querySelectorAll('#tab-gauges .xgshade').length,thr:document.querySelectorAll('#tab-gauges .xgthr').length,tog:(document.querySelector('#gXTog')||{}).innerText||''}));
ok(g.thr>0,`Gauges threshold lines ${g.thr}, shading ${g.sh}, toggle "${g.tog.replace(/\n/g,' ')}"`);
await p.evaluate(()=>{const s=document.querySelector('#gWrap')||document.querySelector('#tab-gauges svg');s.scrollIntoView({block:'start'});});await sleep(300);
await p.screenshot({path:SH+'gauges.png'});
await p.evaluate(()=>{const bt=document.querySelector('#gXTog button');bt&&bt.click();});await sleep(800);
const g2=await p.evaluate(()=>document.querySelectorAll('#tab-gauges .xgthr').length);ok(g2===0,'toggle hides threshold on Gauges');
await p.evaluate(()=>{const bt=document.querySelector('#gXTog button');bt&&bt.click();});
// Map
await p.evaluate(()=>document.querySelector('[data-tab=map]').click());await sleep(4000);
const m=await p.evaluate(()=>{const M=FT.mapDebug&&FT.mapDebug.map;const c=FT.cross.list()[0];if(M)M.setView([c.lat,c.lng],14);return{pins:document.querySelectorAll('.mx').length,btn:!!document.querySelector('#mXAdd'),card:(document.querySelector('#xCard')||{}).innerText||''};});
await sleep(1500);
ok(m.pins>=1&&m.btn,`map pins ${m.pins}, add button ${m.btn}`);ok(/Test bar/.test(m.card),'map crossings card lists it');
await p.evaluate(()=>{const e=document.querySelector('.mx');e&&e.dispatchEvent(new MouseEvent('click',{bubbles:true}));});await sleep(1000);
const pop=await p.evaluate(()=>(document.querySelector('.leaflet-popup-content')||{}).innerText||'');ok(/stuck/i.test(pop)&&/got over/i.test(pop),'pin popup has stuck/over buttons');
await p.evaluate(()=>{const e=document.querySelector('#map')||document.querySelector('.leaflet-container');e.scrollIntoView({block:'start'});});await sleep(500);
await p.screenshot({path:SH+'map.png'});
// observe
const ob=await p.evaluate(()=>{const c=FT.cross.list()[0];const r1=FT.cross.observe(c.id,'over');return{r1,thr:FT.cross.get(c.id).thr};});
ok(ob.thr<=r.thr+1e-9,`"got over" refines threshold down/keeps: ${r.thr} -> ${ob.thr}`);
await p.evaluate((v)=>{const c=FT.cross.list()[0];FT.cross.update(c.id,{thr:v});},r.thr);
// backup round trip
const bk=await p.evaluate(async()=>{const S=FT.spots;const d=S.exportData();const j=typeof d==='string'?JSON.parse(d):d;const c=FT.cross.list()[0];FT.cross.remove(c.id);const n0=FT.cross.list().length;
  await S.importData(JSON.parse(JSON.stringify(j)));return{has:!!(j.cross&&j.cross.length),draft:j.draft,n0,n1:FT.cross.list().length};});
ok(bk.has&&bk.n0===0&&bk.n1===1,'backup export/import round-trip '+JSON.stringify(bk));
// plan routing: a spot upstream (km 33) and launch downstream; no fishing block upstream during closed windows
const pl=await p.evaluate(async()=>{const C=FT.cross,c=C.list()[0];const H=BT.nowH();const w=C.closed(c,H,H+48);
  const blk=C.planBlocks([{km:20,line:'B',name:'down'},{km:33,line:'B',name:'up'}],Date.now(),Date.now()+48*36e5);return{w:w.length,keys:Object.keys(blk||{}),n:(blk&&blk['0_1']||[]).length};});
ok(pl.keys.includes('0_1')&&pl.keys.includes('1_0')&&pl.n>0,'planBlocks gives closed windows between downstream and upstream: '+JSON.stringify(pl));
const reach=await p.evaluate(()=>{const c=FT.cross.list()[0];const w=FT.cross.closed(c,BT.nowH(),BT.nowH()+48)[0];const E0=Date.UTC(2025,11,31,14);
  return FT.cross.reachNote({km:33,line:'B'},E0+w.a*36e5,E0+w.b*36e5);});
ok(/No passage/.test(reach),'reachNote: '+reach.replace(/<[^>]+>/g,''));
ok(!errs.length,'no JS errors '+errs.join(' | '));
await b.close();
