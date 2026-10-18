// Channel re-route check: snap every vertex of the CURRENT build's lines in the CANDIDATE build -> km change (anchored km
// should keep it small) and off-line distance (<= 1.2 km snap limit). Also km-marker map shift. IDS=a,b (default: all changed)
import puppeteer from 'puppeteer-core';import fs from 'fs';
const ids=(process.env.IDS||'').split(',').filter(Boolean);
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
async function page(base,id){const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(base+'?sys='+id+'#baffle',{waitUntil:'networkidle0',timeout:90000});await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});return{ctx,p,errs};}
for(const id of ids){const A=await page('http://localhost:18080/fishing-apps/',id),B=await page('http://localhost:18080/test-apps/',id);
  const lines=await A.p.evaluate(()=>window.BT.LINES?window.BT.LINES.map(L=>({id:L.id,j:L.j,c:L.coords,cc:L.cc})):[{id:'B',j:0,c:window.BAFFLE_DATA.main,cc:null},{id:'E',j:window.BAFFLE_DATA.euleilahJunctionKm,c:window.BAFFLE_DATA.euleilah,cc:null}]);
  const res=await B.p.evaluate(lines=>{const B=window.BT,o=[];for(const L of lines){let mk=0,mo=0,at=null,n=0;const cum=[0];const hv=(a,b)=>{const R=Math.PI/180,x=Math.sin((b[0]-a[0])*R/2)**2+Math.cos(a[0]*R)*Math.cos(b[0]*R)*Math.sin((b[1]-a[1])*R/2)**2;return 2*6371.0088*Math.asin(Math.sqrt(x));};
      for(let i=1;i<L.c.length;i++)cum.push(cum[i-1]+hv(L.c[i-1],L.c[i]));const cc=L.cc||cum;
      for(let i=0;i<L.c.length;i++){const s=B.snap(L.c[i][0],L.c[i][1]);const want=L.j+cc[i];if((s.lineId||'B')!==L.id&&!(L.id==='B'&&!s.lineId))continue;n++;const d=Math.abs(s.km-want);if(d>mk){mk=d;at=+want.toFixed(2);}mo=Math.max(mo,s.offKm);}
      o.push([L.id,n,+mk.toFixed(3),at,+(mo*1000).toFixed(0)]);}return o;},lines);
  console.log(id,'[line, vertices on same line, max Δkm, at km, max off m]',JSON.stringify(res),'errs',B.errs);
  await A.ctx.close();await B.ctx.close();}
await b.close();
