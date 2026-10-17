import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'#bite',{waitUntil:'networkidle0'});await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const grab=()=>p.evaluate(()=>{const S=window.__MJ_STATE;const f=t=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',hour:'numeric',minute:'2-digit'}).format(new Date(t)).replace(' ','');
  return S.days.slice(0,2).map(d=>({date:d.dateStr,rating:d.rating,wins:d.windows.map(w=>`${f(w.start)}–${f(w.end)} (${w.score}${w.peak.T?', '+w.peak.T.label:''})`),runIn:(d.runIns||[]).map(r=>f(r.t)+' ±'+Math.round(r.u)+'′'+(r.kind==='rise'?' rise':''))}));});
const R={};
await p.click('#mj-defBtn');await sleep(300);await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});R['Burnett Heads']=await grab();
for(const n of ['Mouth / entrance','Winfield (MSQ','Wartburg','Hills Rd gauge','Essendean']){
  const v=await p.evaluate(n=>[...document.querySelectorAll('#mj-bafSel option')].find(o=>o.textContent.startsWith(n)).value,n);
  await p.select('#mj-bafSel',v);await sleep(300);await p.waitForSelector('body[data-bite-ready="1"]',{timeout:60000});R[n]=await grab();}
if(process.env.SHOT){await p.screenshot({path:process.env.SHOT});await p.$eval('#mj-chartWrap',e=>e.scrollIntoView());await sleep(200);await p.screenshot({path:process.env.SHOT.replace('.png','-chart.png')});}
R.errs=errs;console.log(JSON.stringify(R,null,1));await b.close();
