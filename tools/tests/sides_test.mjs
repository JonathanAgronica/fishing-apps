import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';const LIVE='https://jonathanagronica.github.io/fishing-apps/';const SH='/workspace/multisys/shots/sides/';fs.mkdirSync(SH,{recursive:true});
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let fails=0;const ck=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)fails++;};
async function page(url,o={}){const ctx=await b.createBrowserContext();const p=await ctx.newPage();await p.evaluateOnNewDocument(()=>{window.__DC_OPEN=1;});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|net::/.test(m.text()))errs.push(m.text());});
  await p.setBypassServiceWorker(true);await p.setViewport({width:400,height:860,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await p.goto(url+'?sys=baffle#'+(o.tab||'baffle'),{waitUntil:'networkidle0',timeout:180000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:90000});return{p,ctx,errs};}
const sample=()=>{const out={};const h0=BT.dateToH(2026,10,12,0,0);const C=[];for(let k=0;k<=40;k+=0.5)C.push([k,'B']);for(let k=16.5;k<=31.4;k+=0.5)C.push([k,'E']);C.push([25.24,'E'],[31.44,'E']);
  for(const [km,line] of C)for(const o of [{line},{}]){const P=BT.predictAt(km,h0,h0+24*14,o);const R=BT.runInStarts(km,h0,h0+24*14,o);out[km+'|'+(o.line||'-')]={e:P.inWin.map(e=>[+e.t.toFixed(4),+e.h.toFixed(4),!!e.hi,!!e.weak,!!e.stand]),c:[1,50,100,200].map(t=>{const v=P.curve(h0+t);return v==null?null:+v.toFixed(4)}),r:R.map(x=>[+x.t.toFixed(4),Math.round(x.u),x.kind]),snap:null};}
  const S=[[-24.52,151.95],[-24.50,151.90],[-24.47,151.86]];out.snaps=S.map(([a,c])=>{const s=BT.snap(a,c);return[+s.km.toFixed(3),s.lineId||s.line,+s.offKm.toFixed(3)];});return out;};
// 1. no regression: main + lower Euleilah identical to live
{const L=await page(LIVE),T=await page(BASE);const a=await L.p.evaluate(sample),c=await T.p.evaluate(sample);let diff=[];
 for(const k in a)if(k!=='snaps'&&JSON.stringify(a[k])!==JSON.stringify(c[k]))diff.push(k);console.log('   snaps live',JSON.stringify(a.snaps),'new',JSON.stringify(c.snaps));ck(diff.length===0,'Baffle main (0–40 km) + Euleilah ≤31.44 km predictions/run-ins identical to live ('+Object.keys(a).length+' cases; diffs: '+diff.slice(0,5).join(', ')+')');
 await L.ctx.close();
 const p=T.p;
 const info=await p.evaluate(()=>({sides:BT.SIDES.map(s=>[s.id,s.short,s.parent,s.jk,+s.len.toFixed(2),s.max]),eu:[BT.EUCAL,BT.EUMAX],lm:BT.LANDMARKS.filter(l=>/junction|tidal limit/.test(l.name)).map(l=>[l.name,l.km,l.line]),ch:FT.spots.channels().map(c=>c.id+':'+c.min.toFixed(1)+'-'+c.max.toFixed(1))}));
 console.log(JSON.stringify(info,null,0));ck(info.sides.length===11&&info.eu[1]>34,'11 side creeks + Euleilah to '+info.eu[1]+' km');
 // side predictions
 const sp=await p.evaluate(()=>{const h0=BT.dateToH(2026,10,12,0,0);const f=(km,line)=>{const P=BT.predictAt(km,h0,h0+24,{line});const R=BT.runInStarts(km,h0,h0+24,{line});return{hi:P.inWin.filter(e=>e.hi&&!e.weak).map(e=>BT.fmtT(e.t)+' '+e.h.toFixed(2)),lo:P.inWin.filter(e=>!e.hi).map(e=>BT.fmtT(e.t)+' '+e.h.toFixed(2)),ri:R.filter(r=>r.t>=h0&&r.t<h0+24).map(r=>BT.fmtT(r.t)+'±'+Math.round(r.u)),est:!!P.cal.est,side:P.cal.side,stands:P.ext.filter(e=>e.stand).length};};
   return{jB:f(19.64,'B'),jNoSup:f(19.64,'E'),m0:f(19.64,'mosq'),m2:f(21.64,'mosq'),m4:f(24.3,'mosq'),sandy:f(35.0,'sandy'),e31:f(31.44,'E'),e33:f(33.4,'E'),oy:f(36,'oyster')};});
 for(const k in sp)console.log('   ',k,JSON.stringify(sp[k]));
 ck(sp.m0.hi.join()===sp.jNoSup.hi.join()&&sp.m2.est&&sp.m2.ri.length>0,'Mosquito Ck at its junction = junction model (no suppression); 2 km up = est. with run-ins');
 ck(sp.e33.est&&!sp.e31.est===!sp.e31.est,'upper Euleilah est.');
 // snapping custom spot on Mosquito Ck
 const sn=await p.evaluate(()=>{const s=BT.SIDES.find(x=>x.id==='mosq');const q=BT.pointOnSide(s.jk+2,'mosq');const a=FT.spots.snap(q[0]+0.0003,q[1]);const z=FT.spots.snap(...BT.pointAtKm(10));return{a,z};});
 console.log('   snap',JSON.stringify(sn));ck(sn.a.line==='mosq'&&Math.abs(sn.a.km-21.64)<0.15&&sn.z.line==='B','GPS/custom-spot snapping onto Mosquito Ck (km '+sn.a.km+'); main stays main');
 // Tides tab channel picker
 await p.evaluate(()=>{const s=document.getElementById('bt-line');s.value='mosq';s.dispatchEvent(new Event('change'));});await sleep(400);
 const tt=await p.evaluate(()=>({info:document.getElementById('bt-locInfo').innerText.slice(0,200),warn:document.body.innerText.includes('Estimate — benchmark me'),min:document.getElementById('bt-km').min,max:document.getElementById('bt-km').max}));
 console.log('   tides',JSON.stringify(tt));ck(/Mosquito Ck/.test(tt.info)&&tt.warn,'Tides tab: channel picker → Mosquito Ck, est. warning');
 await p.screenshot({path:SH+'tides-mosquito.png'});
 // Bite from Tides
 await p.evaluate(()=>document.getElementById('bt-toBite').click());await p.waitForFunction(()=>document.body.dataset.biteReady==='1',{timeout:90000});await sleep(300);
 const bt=await p.evaluate(()=>document.getElementById('mj-tideSrc').innerText.slice(0,260));console.log('   bite',bt);ck(/Mosquito Ck/.test(bt)&&/est\./.test(bt),'Bite tab tide source names Mosquito Ck (est.)');
 // map
 await p.evaluate(()=>FT.showTab('map'));await p.waitForFunction(()=>document.body.dataset.mapReady==='1',{timeout:60000});
 await p.evaluate(()=>{const s=BT.SIDES.find(x=>x.id==='mosq');const q=BT.pointOnSide(s.jk+2,'mosq');FT.mapDebug.map.setView(q,14);});await sleep(4000);
 const lab=await p.evaluate(()=>[...document.querySelectorAll('.mkms')].map(e=>e.textContent).filter(t=>/Mosquito/.test(t)));console.log('   map labels',lab.join(', '));ck(lab.some(t=>/Mosquito Ck 2 km/.test(t)),'map shows "Mosquito Ck 2 km" marker');
 await p.screenshot({path:SH+'map-mosquito.png'});
 await p.evaluate(()=>FT.mapDebug.map.setView([-24.475,151.86],13));await sleep(3500);await p.screenshot({path:SH+'map-upper-euleilah.png'});
 // gauges + calendar channel lists
 const cal=await p.evaluate(()=>FT.calApi.lineList().map(l=>l.id).join(','));ck(/mosq/.test(cal),'Calendar channel list includes side creeks ('+cal+')');
 // catch log band
 const band=await p.evaluate(()=>{const q=BT.pointOnSide(BT.sideOf('mosq').jk+2.5,'mosq');FT.showTab('log');return null;});
 ck(!T.errs.length,'no JS errors '+T.errs.join(' | '));await T.ctx.close();}
await b.close();console.log(fails?fails+' FAIL':'ALL OK');process.exit(fails?1:0);
