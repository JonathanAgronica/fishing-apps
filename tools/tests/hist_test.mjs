import puppeteer from 'puppeteer-core';
const BASE=process.env.BASE||'http://localhost:18080/fishing-apps/';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const p=await (await b.createBrowserContext()).newPage();const errs=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load/.test(m.text()))errs.push(m.text());});
p.on('dialog',d=>d.accept());
await p.setViewport({width:400,height:850,deviceScaleFactor:2,isMobile:true,hasTouch:true});
await p.goto(BASE+'#log',{waitUntil:'domcontentloaded'});await p.evaluate(()=>localStorage.clear());
await p.reload({waitUntil:'networkidle0'});await p.waitForSelector('body[data-log-ready="1"]',{timeout:60000});
const ok=(c,m)=>{console.log((c?'  ok  ':'  FAIL ')+m);if(!c)process.exitCode=1;};
const csv=`Date,Time,Spot,KM,Line,Caught,Count,Size,Species,Hours,Notes
2014-03-08,6pm,Flat Rock Rd ramp,,,y,2,48cm,jack,3,"run-in, good"
12/01/2009,dawn,,22.5,,n,,,,2,
5/6/98,~7ish,,4,,yes,1,18 inch,,,old one
1995-02-30,10:00,,5,,y,1,,,,
1989-12-31,10:00,,5,,y,1,,,,
2031-01-01,10:00,,5,,y,1,,,,
2016-11-20,arvo,Nowhere Special,,,y,1,,,,
2018-07-14,1830,,2,mosq,y,1,40,,,side creek
2019-01-05,7:15am,,10,,y,1,,,,,
2020-02-02,dusk,,6,,y,1,,,,Maroochy
`;
const r=await p.evaluate(c=>{const r=FT.catchLog.importCSV(c);return r;},csv);
console.log(JSON.stringify(r));
const r2=await p.evaluate(c=>FT.catchLog.importCSV(c),csv);
ok(r.added>=5,'imported '+r.added+' historical sessions');ok(r2.added===0,'re-import skips duplicates');
const L=await p.evaluate(()=>FT.catchLog.log.map(s=>({d:new Date(s.start).toISOString(),km:s.spot.km,ln:s.spot.line,n:(s.catches||[]).reduce((a,x)=>a+x.n,0),len:(s.catches[0]||{}).len,ctx:!!s.ctx,wx:s.ctx&&s.ctx.wx,ts:s.ctx&&s.ctx.tideSrc,sl:s.ctx&&s.ctx.slots.length,sc:s.ctx&&s.ctx.slots[0].score,wind:s.ctx&&s.ctx.slots[0].wind,moon:s.ctx&&s.ctx.moon.phase,rough:s.rough})));
console.table(L);
ok(L.every(s=>s.ctx&&s.ts==='baffle'&&s.sl>0&&!s.wx&&s.wind==null),'all have model tide/moon ctx, weather unknown');
ok(L.some(s=>s.ln==='mosq'),'side-creek line resolved');ok(L.some(s=>s.len===45.5),'18 inch → 45.5 cm');
ok(/before 1990/.test(r.errs.join())||r.errs.length>=3,'1989/2031/bad date rejected: '+r.errs.join(' | '));
const T=await p.evaluate(()=>{FT.catchLog.reload();return document.getElementById('cList').innerText;});
ok(/historical/.test(T)&&/weather unknown/.test(T),'list flags historical + weather unknown');
const CO=await p.evaluate(()=>FT.catchLog.log.filter(s=>s.co).map(s=>({s:new Date(s.start).toISOString(),e:(s.end-s.start)/6e4,c:new Date(s.catches[0].t).toISOString()})));
console.log(JSON.stringify(CO));ok(CO.length>=4&&CO.every(x=>x.e===30),'CSV catch w/o hours → 30-min catch-only');
await p.click('nav.tabs a[data-tab=log]');await p.waitForSelector('#cCatchOnlyBtn');await p.$eval('#cCatchOnlyBtn',e=>e.click());
ok(await p.$eval('#cSessRow',e=>e.hidden),'catch-only form hides session times');
await p.select('#cSpotSel',await p.$eval('#cSpotSel',e=>[...e.options].find(o=>/^L/.test(o.value)).value));await p.$eval('#cSpotSel',e=>e.dispatchEvent(new Event('change',{bubbles:true})));
await p.$eval('#cCt',e=>{e.value='2011-05-21T17:40';});await p.$eval('#cLen',e=>e.value='52');
await p.$eval('#cSave',e=>e.click());await new Promise(r=>setTimeout(r,500));
const M=await p.evaluate(()=>{const s=FT.catchLog.log.find(s=>s.co&&new Date(s.start).getUTCFullYear()===2011);return s&&{s:new Date(s.start).toISOString(),e:new Date(s.end).toISOString(),n:s.catches.length,len:s.catches[0].len,ctx:!!s.ctx};});
console.log(JSON.stringify(M),await p.$eval('#cFormMsg',e=>e.textContent));ok(M&&M.ctx&&M.len===52&&M.s==='2011-05-21T07:30:00.000Z','manual catch-only saved: 30 min centred on 17:40');
await p.evaluate(()=>{const b=[...document.querySelectorAll('#cMyViews button')][0];b&&b.click();});
await p.evaluate(()=>FT.catchLog.reload());const MC=await p.$eval('#cMyCharts',e=>e.textContent);console.log(MC.slice(0,300));ok(/catch-only entr/.test(MC),'charts: catch-only presence-only note');
await p.click('nav.tabs a[data-tab=log]');
ok(errs.length===0,'no JS errors '+errs.join('|'));
await p.evaluate(()=>document.getElementById('cList').scrollIntoView());await p.screenshot({path:'/workspace/multisys/shots/hist-import.png'});
await b.close();
