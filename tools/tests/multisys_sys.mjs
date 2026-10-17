import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';
const SH=process.env.SHOTS||'/workspace/multisys/shots/';
const SYS=(process.env.SYSL||'burnett-river,mary-river,noosa-river,brisbane-river').split(',');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];
p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text());});
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
const tab=async t=>{await p.evaluate(t=>window.FT.showTab(t),t);await sleep(400);};
for(const id of SYS){
  await p.goto(BASE+'?sys='+id+'#baffle',{waitUntil:'networkidle0'});
  await p.waitForSelector('body[data-sys-ready="'+id+'"]',{timeout:60000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:90000});
  const r=await p.evaluate(()=>({sys:FT.SYS,gen:BT.generic,title:document.querySelector('header p').innerText,conf:document.querySelector('.sysconf').innerText,
    loc:document.querySelector('#bt-locInfo').innerText,warn:document.querySelector('#bt-locWarn').innerText.slice(0,200),stats:document.querySelector('#bt-stats').innerText.replace(/\n/g,' | ').slice(0,400),
    stretchRows:document.querySelectorAll('#bt-stretch tr').length,lines:BT.LINES.length,lineSel:!!document.getElementById('bt-line'),
    bite:document.querySelector('#mj-tideSrc').innerText.slice(0,260),biteLoc:document.querySelector('#mj-locInfo').innerText.slice(0,120),
    day0:(()=>{const d=window.__MJ_STATE.days[0];return{ri:(d.runIns||[]).map(r=>new Date(r.t).toISOString().slice(11,16)+'Z ±'+Math.round(r.u)+' '+r.kind),max:Math.max(...d.pts.map(x=>x.score))};})()}));
  console.log('\n=== '+id,JSON.stringify(r,null,1));
  await p.screenshot({path:SH+id+'-tides.png'});
  await tab('bite');await p.screenshot({path:SH+id+'-bite.png'});
  await tab('map');await p.waitForSelector('#mMap .leaflet-pane',{timeout:30000}).catch(()=>{});await sleep(2500);
  const m=await p.evaluate(()=>({paths:document.querySelectorAll('#mMap path').length,markers:document.querySelectorAll('#mMap .leaflet-marker-icon').length}));console.log('map',JSON.stringify(m));
  await p.screenshot({path:SH+id+'-map.png'});
  await tab('gauges');await sleep(3000);const g=await p.evaluate(()=>({head:(document.querySelector('#sgHead')||{}).innerText,cards:[...document.querySelectorAll('#sgList section')].map(s=>s.innerText.replace(/\n/g,' | ').slice(0,260))}));console.log('gauges',JSON.stringify(g,null,1));
  await p.screenshot({path:SH+id+'-gauges.png',fullPage:false});
  await tab('log');const l=await p.evaluate(()=>({opts:document.querySelector('#cSpotSel').options.length,grp:[...document.querySelectorAll('#cSpotSel optgroup')].map(o=>o.label)}));console.log('log',JSON.stringify(l));
}
// Brisbane: pick a tributary line in Tides
if(SYS.includes('brisbane-river')){await tab('baffle');
  const t=await p.evaluate(async()=>{const s=document.getElementById('bt-line');const L=BT.LINES.find(l=>/Oxley/.test(l.name));s.value=L.id;s.dispatchEvent(new Event('change'));await new Promise(r=>setTimeout(r,300));
    return{line:L.id,loc:document.querySelector('#bt-locInfo').innerText,warn:document.querySelector('#bt-locWarn').innerText.slice(0,300),stats:document.querySelector('#bt-stats').innerText.replace(/\n/g,' | ').slice(0,300),km:document.querySelector('#bt-km').value,max:document.querySelector('#bt-km').max};});
  console.log('\nbrisbane oxley',JSON.stringify(t,null,1));await p.screenshot({path:SH+'brisbane-river-oxley.png'});
  // spot + catch-log band
  const c=await p.evaluate(()=>{const L=BT.LINES.find(l=>/Oxley/.test(l.name));const pt=BT.pointOnLine(L.j+3,L.id);const sp=FT.spots.add({name:'Test Oxley spot',lat:pt[0],lng:pt[1]});
    const all=JSON.parse(localStorage.getItem('mbj_spots')||'[]');return{added:!!sp,stored:all.map(x=>({sys:x.sys,line:x.line,km:x.km,name:x.name})),lm:BT.LANDMARKS.filter(l=>l.custom).length};});
  console.log('spot',JSON.stringify(c));
}
console.log('\nERRORS',JSON.stringify(errs,null,1));
await b.close();
