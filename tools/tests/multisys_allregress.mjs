// All systems: model (predictAt/calAt/fedFrom on every line, 5 points, 2 dates) + Tides UI text, fishing-apps (current) vs test-apps (candidate). IDS=a,b to limit.
import puppeteer from 'puppeteer-core';import fs from 'fs';
const X=JSON.parse(fs.readFileSync('/workspace/fishing-site/data/systems/index.json'));
const ids=(process.env.IDS?process.env.IDS.split(','):X.systems.map(s=>s.id));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
async function grab(base,id){const ctx=await b.createBrowserContext();const p=await ctx.newPage();const errs=[];
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource|ERR_|404/.test(m.text()))errs.push('console: '+m.text());});
  await p.setViewport({width:390,height:844,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await p.goto(base+'?sys='+id+'#baffle',{waitUntil:'networkidle0',timeout:90000});
  await p.waitForSelector('body[data-bt-ready="1"]',{timeout:60000});
  const r=await p.evaluate(()=>{const B=window.BT,o=window.FT.baffleOpts();const out={};const lines=B.LINES?B.LINES.filter(L=>L.id!=='T7'||FT.SYS!=='burnett-river'):[{id:'M',j:0,len:B.MAXKM}];
    for(const ds of [[2026,10,20],[2027,1,5]]){const h0=B.dateToH(ds[0],ds[1],ds[2],0,0);
      for(const L of lines){const a=L.id==='M'?0:L.j,mx=B.lineMax?B.lineMax(L.id):B.MAXKM;for(let i=0;i<=4;i++){const km=+(a+(mx-a)*i/4).toFixed(3);const op=Object.assign({},o,{line:L.id});
        const P=B.predictAt(km,h0,h0+36,op);const c=B.calAt?B.calAt(km,op):null;
        out[ds.join('-')+'|'+L.id+'@'+km]={ext:P.inWin.map(e=>[+e.t.toFixed(4),+e.h.toFixed(4),e.hi,e.u]),c:[P.curve(h0+5.5),P.curve(h0+17.25)].map(v=>v==null?null:+v.toFixed(4)),
          cal:c?[c.hwLag,c.lwLag,c.hwU,c.lwU,!!c.est].map(v=>typeof v==='number'?+v.toFixed(3):v):null,fed:B.fedFrom?(B.fedFrom(km,L.id)||null):null};}}}
    const q=s=>{const e=document.querySelector(s);return e?e.innerText:null};
    return {out,stats:q('#bt-stats'),loc:q('#bt-locInfo'),conf:q('.sysconf')};});
  await ctx.close();return{r,errs};}
let bad=0,n=0;const Q=[...ids];
async function worker(){while(Q.length){const id=Q.shift();try{const A=await grab('http://localhost:18080/fishing-apps/',id),B=await grab('http://localhost:18080/test-apps/',id);let d=0;
  for(const k in A.r.out)if(JSON.stringify(A.r.out[k])!==JSON.stringify(B.r.out[k])){d++;if(d<2){const a=A.r.out[k],bb=B.r.out[k];for(const f in a)if(JSON.stringify(a[f])!==JSON.stringify(bb[f]))console.log(id,k,f,JSON.stringify(a[f]).slice(0,300),"||",JSON.stringify(bb[f]).slice(0,300));}}
  const ui=['stats','loc','conf'].filter(k=>A.r[k]!==B.r[k]);n++;for(const k of ui)console.log(id,k,'\nA:',A.r[k],'\nB:',B.r[k]);
  if(d||ui.length||B.errs.length){bad++;console.log(id,'keys',Object.keys(A.r.out).length,'diffs',d,'ui',ui.join(','),'errs',B.errs.slice(0,2));}}catch(e){bad++;console.log(id,'ERROR',e.message);}}}
await Promise.all([worker(),worker(),worker(),worker()]);console.log('systems',n,'with differences',bad);await b.close();
