// iPhone 390x844 shots + checks for the 2026-10-18 additions (Skyring Creek on the Burnett; Pancake/Middle/Jenny Lind network)
import puppeteer from 'puppeteer-core';import fs from 'fs';
const BASE=process.env.BASE||'http://localhost:18080/test-apps/';
const JOBS=[{sys:'burnett-river',dir:'/workspace/multisys/shots/skyring/',lines:['T7'],pts:[['M',2.0],['T7',2.3],['T7',2.67],['T7',3.5],['T7',6.0],['T7',8.0]],view:[[-24.765,152.345],[-24.73,152.405]]},
  {sys:'pancake-creek',dir:'/workspace/multisys/shots/turkey/',lines:['M','T1','T2'],pts:[['M',0.9],['M',6],['M',11.94],['M',16],['M',21],['T1',2],['T1',6],['T2',21.5]],view:[[-24.15,151.70],[-24.0,151.80]]}];
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const errs=[];
for(const J of JOBS){fs.mkdirSync(J.dir,{recursive:true});
  const c=await b.createBrowserContext();const p=await c.newPage();await p.setBypassServiceWorker(true);
  p.on('pageerror',e=>errs.push(J.sys+' pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push(J.sys+' console: '+m.text());});
  await p.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await p.goto(BASE+'?sys='+J.sys+'#baffle',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await sleep(1500);
  // model sanity: alternating H/L and curve always drawn, 60 days, every 0.25 km of the new lines
  const chk=await p.evaluate(lines=>{const B=BT,o=FT.baffleOpts();let n=0,badAlt=0,nul=0,ex=[];const h00=B.dateToH(2026,10,18,0,0);
    for(const id of lines){const L=B.LINES.find(l=>l.id===id),a=id==='M'?0:L.j,mx=B.lineMax(id);
      for(let km=a;km<=mx+1e-9;km+=0.25)for(let d=0;d<60;d+=3){const h0=h00+24*d,P=B.predictAt(km,h0,h0+72,Object.assign({},o,{line:id}));n++;
        for(let i=1;i<P.inWin.length;i++)if(P.inWin[i].hi===P.inWin[i-1].hi){badAlt++;if(ex.length<3)ex.push([id,km,d]);break;}
        for(let t=h0;t<h0+72;t+=1){const v=P.curve(t);if(v==null||!isFinite(v)){nul++;break;}}}}
    return{n,badAlt,nul,ex};},J.lines);
  console.log(J.sys,'model check',JSON.stringify(chk));
  const txt=[];let i=0;
  for(const [line,km] of J.pts){i++;
    const r=await p.evaluate(async(line,km)=>{const s=document.getElementById('bt-line');if(s){s.value=line;s.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,300));}
      const k=document.getElementById('bt-km');k.value=km;k.dispatchEvent(new Event('input'));k.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,700));
      const q=s=>{const e=document.querySelector(s);return e?e.innerText.replace(/\n+/g,' | '):''};
      const P=BT.predictAt(+k.value,BT.dateToH(2026,10,18,0,0),BT.dateToH(2026,10,19,0,0),Object.assign({},FT.baffleOpts(),{line}));
      return{line,km:+k.value,loc:q('#bt-locInfo'),warn:q('#bt-locWarn').slice(0,260),stats:q('#bt-stats').slice(0,260),ext18Oct:P.inWin.map(e=>(e.hi?'H ':'L ')+String(Math.floor(e.t%24)).padStart(2,'0')+':'+String(Math.round((e.t%1)*60)%60).padStart(2,'0')+' '+e.h.toFixed(2)+' ±'+Math.round(e.u)),ow:document.documentElement.scrollWidth};},line,km);
    txt.push(r);await p.evaluate(()=>window.scrollTo(0,0));
    await p.screenshot({path:`${J.dir}tides-${String(i).padStart(2,'0')}-${line}-km${km}.png`});
    await p.evaluate(()=>{const e=document.getElementById('bt-locInfo');window.scrollTo(0,e.getBoundingClientRect().top+scrollY-60);});await sleep(300);
    await p.screenshot({path:`${J.dir}tides-${String(i).padStart(2,'0')}-${line}-km${km}-chart.png`});}
  fs.writeFileSync(J.dir+'tides.json',JSON.stringify(txt,null,1));console.log(JSON.stringify(txt,null,1));
  // spot support: a spot on each new line snaps to that line
  const sp=await p.evaluate(lines=>lines.map(id=>{const L=BT.LINES.find(l=>l.id===id);const km=(id==='M'?0:L.j)+(BT.lineMax(id)-(id==='M'?0:L.j))*0.6;const pt=BT.pointOnLine(km,id);
    const s=FT.spots.add({name:'Test spot '+id,lat:pt[0],lng:pt[1]});const all=JSON.parse(localStorage.getItem('mbj_spots')||'[]');const x=all.find(z=>z.name==='Test spot '+id);return{id,want:+km.toFixed(2),got:x&&{sys:x.sys,line:x.line,km:x.km}};}),J.lines);
  console.log('spots',JSON.stringify(sp));
  await p.evaluate(()=>FT.showTab('map'));await sleep(2000);
  await p.evaluate(v=>FT.mapDebug.map.fitBounds(FT.mapDebug.LF.latLngBounds(v),{animate:false}),J.view);await sleep(4000);
  await p.screenshot({path:J.dir+'map-overview.png'});
  const z=J.sys==='burnett-river'?[[-24.745,152.37],14]:[[-24.09,151.735],13];
  await p.evaluate(z=>FT.mapDebug.map.setView(z[0],z[1],{animate:false}),z);await sleep(4000);await p.screenshot({path:J.dir+'map-zoom.png'});
  const m=await p.evaluate(()=>({paths:document.querySelectorAll('#mMap path').length,ticks:[...document.querySelectorAll('#mMap .leaflet-tooltip, #mMap .kmlab, #mMap .leaflet-marker-icon')].map(e=>e.innerText).filter(Boolean).slice(0,30)}));console.log('map',JSON.stringify(m));
  for(const t of ['cal','plan']){try{await p.evaluate(t=>FT.showTab(t),t);await sleep(1500);await p.screenshot({path:J.dir+t+'.png'});}catch(e){errs.push(t+' '+e.message);}}
  await c.close();}
console.log('ERRORS',JSON.stringify(errs));await b.close();
