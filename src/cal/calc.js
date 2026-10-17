/* ===== Bite calendar compute core =====
   Shared by the Calendar tab's Web Worker (built at runtime from this page's own mj-core / bt-data / bt-core / bt-runin /
   ft-engine script texts + this file, so the scoring is byte-for-byte the Bite tab's code) and by its main-thread fallback
   and exact day refinement. No DOM, no storage, no network: everything it needs arrives in cfg. */
(function(G){'use strict';
const TZ='Australia/Brisbane',E0=Date.UTC(2025,11,31,14),HR=36e5;
const DDLO=-12,DDHI=10; /* "dawn/dusk": sun between 12° below and 10° above the horizon */
function makeCore(B,MJ,cfg){
  const GEN=!!B.generic;
  const wxFn=cfg.wx?MJ.makeWxFn(cfg.wx.tt,cfg.wx.h):null;
  const sstFn=cfg.sst?MJ.makeSeries(cfg.sst.tt,cfg.sst.v):null;
  const wxT1=cfg.wx&&cfg.wx.tt.length?cfg.wx.tt[cfg.wx.tt.length-1]:-Infinity,wxT0=cfg.wx&&cfg.wx.tt.length?cfg.wx.tt[0]:Infinity;
  const fresh=cfg.fresh||null;
  const P3=s=>s.split('-').map(Number);
  const optsFor=pt=>Object.assign({},cfg.opts||{},GEN?{line:pt.line||'M'}:pt.line?{line:pt.line}:{});
  /* = the Bite tab's baffleTide(dateStr,km,line), stretched over [d0−1 day, d1+8 days] */
  function tide(pt,d0,d1){const [y,m,d]=P3(d0),[y1,m1,e1]=P3(d1||d0);const h0=B.dateToH(y,m,d-1,0,0),h1=B.dateToH(y1,m1,e1+8,0,0);
    const o=optsFor(pt);const P=B.predictAt(pt.km,h0,h1,o);
    const fn=t=>{const v=P.curve((t-E0)/3.6e6);return v==null?null:v;};
    const ext=P.ext.filter(e=>!e.weak).map(e=>({t:E0+e.t*3.6e6,h:e.h,high:!!e.hi,u:e.u}));
    const stands=P.ext.filter(e=>e.stand).map(e=>({t:E0+e.t*3.6e6,t0:E0+e.standT0*3.6e6,t1:E0+e.standT1*3.6e6}));
    const runIn=B.runInStarts(pt.km,h0,h1,o).map(r=>({t:E0+r.t*3.6e6,u:r.u,kind:r.kind}));
    return{fn,ext,stands,runIn,cal:P.cal,h0,h1};}
  const wrOf=ext=>{if(!ext||ext.length<2)return null;let mx=0;for(let i=1;i<ext.length;i++)mx=Math.max(mx,Math.abs(ext[i].h-ext[i-1].h));return{max:mx};};
  /* forecast status of a day: weather forecast covers it (≥ 12 h of it) or it is an outlook day (tide + sun/moon, neutral weather) */
  function fcOf(ds){const t0=MJ.dayStart(ds,TZ);return wxFn&&wxT0<=t0+12*HR&&wxT1>=t0+12*HR;}
  function day(pt,T,ds,stepMin,ev){
    return MJ.computeDay({dateStr:ds,tz:TZ,lat:pt.lat,lng:pt.lng,tideFn:T.fn,ext:T.ext,wxFn,sstFn,fresh,weekRange:T.wr||wrOf(T.ext),runIn:T.runIn,spotType:pt.type&&MJ.STYPES&&MJ.STYPES[pt.type]?pt.type:null,spotDepth:pt.depth||null,stepMin,ev});}
  /* coarse (30-min) day summary for one point: [best, minute-of-day of best, best in dawn/dusk, its minute] */
  function coarse(pt,T,ds,ev){const t0=MJ.dayStart(ds,TZ),a=MJ.dayStart(MJ.addDays(ds,-1),TZ)-6*HR,b=MJ.dayStart(MJ.addDays(ds,8),TZ)+6*HR;
    const sub=T.ext.filter(x=>x.t>=a&&x.t<=b);const dd=day(pt,Object.assign({},T,{wr:wrOf(sub)}),ds,30,ev);
    let b0=-1,t0b=0,b1=-1,t1b=0;for(const p of dd.pts){if(p.score>b0){b0=p.score;t0b=p.t;}if(p.alt>=DDLO&&p.alt<=DDHI&&p.score>b1){b1=p.score;t1b=p.t;}}
    return[b0,Math.round((t0b-t0)/6e4),b1,Math.round((t1b-t0)/6e4)];}
  /* exact: identical inputs to the Bite tab for this spot & date (15-min steps, own sun/moon events) */
  function refine(pt,ds){const T=tide(pt,ds,ds);const dd=day(pt,T,ds,15,null);return{dd,T};}
  return{tide,coarse,refine,fcOf,day,GEN,B,MJ};}
/* block scheduler: one calendar month per block, every point's tide predicted once per block; yields between points */
function makeRunner(core,pts,post){let Q=[],busy=false,dead=false;const MJ=core.MJ;
  const evC={};function evFor(pt,ds){const k=ds+'|'+Math.round(pt.lat*20)+'|'+Math.round(pt.lng*20);let e=evC[k];
    if(!e){const t0=MJ.dayStart(ds,TZ),t1=MJ.dayStart(MJ.addDays(ds,1),TZ);e=evC[k]=MJ.sunMoonEvents(t0-4*HR,t1+4*HR,Math.round(pt.lat*20)/20,Math.round(pt.lng*20)/20);}return e;}
  const tick=()=>new Promise(r=>setTimeout(r,0));
  async function loop(){busy=true;
    while(Q.length&&!dead){const blk=Q.shift(),ms0=Date.now();const out={};for(const d of blk.dates)out[d]={fc:core.fcOf(d),p:new Array(pts.length)};
      for(let i=0;i<pts.length&&!dead;i++){let T=null;try{T=core.tide(pts[i],blk.dates[0],blk.dates[blk.dates.length-1]);}catch(e){T=null;}
        for(const d of blk.dates){try{out[d].p[i]=T?core.coarse(pts[i],T,d,evFor(pts[i],d)):[-1,0,-1,0];}catch(e){out[d].p[i]=[-1,0,-1,0];}}
        post({type:'prog',key:blk.key,i:i+1,n:pts.length,left:Q.length});await tick();}
      for(const k in evC)delete evC[k];
      if(!dead)post({type:'block',key:blk.key,days:out,ms:Date.now()-ms0,n:pts.length});}
    busy=false;if(!dead)post({type:'idle'});}
  return{add(blocks){for(const b of blocks)if(!Q.some(q=>q.key===b.key))Q.push(b);if(!busy)loop();},
    prio(key){const i=Q.findIndex(b=>b.key===key);if(i>0)Q.unshift(Q.splice(i,1)[0]);},
    stop(){dead=true;Q=[];}};}
/* ===== "Plan my day": optimal fish / move / rest schedule over the day's exact 15-min scores =====
   Dynamic programme over time (15-min steps) × location (spots + launch) [× fished steps when max hours is set]:
   fish a block of ≥ minBlock at a spot (gain Σ score − threshold), rest in place (gain 0) or move along the creek
   (km / boat speed + 3 min, rounded up to 15 min). Maximises summed score above the rest threshold. */
function planDay(core,R){const MJ=core.MJ,GEN=core.GEN,STEP=15,SM=STEP*6e4;
  const day0=MJ.dayStart(R.date,TZ),t0=day0+R.startMin*6e4,t1=day0+R.endMin*6e4,K=Math.round((R.endMin-R.startMin)/STEP);
  const ex0=Math.max(0,R.startMin-240),ex1=R.endMin+180;   /* early / late option scan */
  const nDays=ex1>1440?2:1,dates=[R.date];if(nDays>1)dates.push(MJ.addDays(R.date,1));
  const SP=R.spots;
  /* exact per-spot day scores (identical inputs to Bite times for that spot & date) */
  const ser=SP.map(pt=>{const M=new Map();let runIn=[],stands=[],ext=[],U=null;
    for(const ds of dates){const r=core.refine(pt,ds);for(const q of r.dd.pts)M.set(q.t,q);if(!U)U=r.T.cal;
      for(const x of r.T.runIn)if(!runIn.some(y=>Math.abs(y.t-x.t)<6e5))runIn.push(x);for(const x of r.T.stands||[])if(!stands.some(y=>Math.abs(y.t-x.t)<6e5))stands.push(x);
      for(const x of r.T.ext)if(!ext.some(y=>Math.abs(y.t-x.t)<6e5))ext.push(x);}
    runIn.sort((a,b)=>a.t-b.t);ext.sort((a,b)=>a.t-b.t);return{M,runIn,stands,ext,cal:U};});
  const sc=(i,t)=>{const q=ser[i].M.get(t);return q?q.score:0;};
  const inDD=q=>q&&q.alt>=DDLO&&q.alt<=DDHI;
  const best=[],bestI=[];for(let k=0;k<K;k++){const t=t0+k*SM;let b=-1,bi=-1;for(let i=0;i<SP.length;i++){const v=sc(i,t);if(v>b){b=v;bi=i;}}best.push(b);bestI.push(bi);}
  const med=(()=>{const a=best.slice().sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0;})();
  const thr=R.thr==null||R.thr==='auto'?Math.max(55,med):+R.thr;
  const gain=SP.map((p,i)=>{const g=new Float64Array(K+1);for(let k=0;k<K;k++){const q=ser[i].M.get(t0+k*SM);let v=(q?q.score:0)-thr;if(R.dd)v+=inDD(q)?8:-8;g[k+1]=g[k]+v;}return g;});
  /* locations: spots 0..n-1, launch = n (or the matching spot) */
  const n=SP.length;let L0=SP.findIndex(p=>R.launch&&Math.abs(p.km-R.launch.km)<0.05&&p.line===R.launch.line);const NL=L0>=0?n:n+1;if(L0<0)L0=n;
  const LOC=SP.concat(L0===n?[R.launch]:[]);
  const dist=(a,b)=>{if(a.line===b.line)return Math.abs(a.km-b.km);const ja=a.j||0,jb=b.j||0;
    if(a.main)return Math.abs(a.km-jb)+Math.abs(b.km-jb);if(b.main)return Math.abs(b.km-ja)+Math.abs(a.km-ja);return Math.abs(a.km-ja)+Math.abs(ja-jb)+Math.abs(b.km-jb);};
  const mv=LOC.map(a=>LOC.map(b=>{if(a===b)return{km:0,min:0,st:0};const km=dist(a,b),min=km/(R.speed||25)*60+3;return{km,min,st:Math.max(1,Math.ceil(min/STEP))};}));
  const Lmin=Math.max(1,Math.ceil((R.minBlock||30)/STEP-1e-9)),FM=R.maxFishH>0?Math.round(R.maxFishH*60/STEP):0,F=FM?FM+1:1;
  const IDX=(k,l,f)=>(k*NL+l)*F+f,NS=(K+1)*NL*F;const V=new Float64Array(NS).fill(-Infinity),BP=new Int32Array(NS).fill(-1),BT=new Int8Array(NS);
  const XB=R.xb||null; /* shallow crossings: closed windows per location pair (from the phone's private crossings) */
  V[IDX(0,L0,0)]=0;const MP=-0.02; /* tiny cost per move step: no pointless moves */
  const relax=(to,val,from,ty)=>{if(val>V[to]+1e-9){V[to]=val;BP[to]=from;BT[to]=ty;}};
  for(let k=0;k<K;k++)for(let l=0;l<NL;l++)for(let f=0;f<F;f++){const id=IDX(k,l,f),v=V[id];if(v===-Infinity)continue;
    relax(IDX(k+1,l,f),v,id,0);                                       /* rest */
    if(l<n){const g=gain[l];for(let L=Lmin;k+L<=K;L++){const nf=FM?f+L:0;if(FM&&nf>FM)break;relax(IDX(k+L,l,nf),v+g[k+L]-g[k]+1e-4*L,id,1);}} /* fish */
    for(let j=0;j<n;j++){if(j===l)continue;const m=mv[l][j].st;if(XB){const w=XB[l+'_'+j];if(w){const a=t0+k*SM,b=t0+(k+m)*SM;if(w.some(x=>x[0]<b&&x[1]>a))continue;}}if(k+m<=K)relax(IDX(k+m,j,f),v+MP*m,id,2);}}            /* move */
  let end=-1,bv=-Infinity;for(let l=0;l<NL;l++)for(let f=0;f<F;f++){const id=IDX(K,l,f);if(V[id]>bv){bv=V[id];end=id;}}
  const steps=[];for(let id=end;BP[id]>=0;id=BP[id]){const p=BP[id];const k=Math.floor(id/(NL*F)),l=Math.floor(id/F)%NL,pk=Math.floor(p/(NL*F)),pl=Math.floor(p/F)%NL;steps.push({ty:BT[id],k0:pk,k1:k,from:pl,to:l});}
  steps.reverse();
  /* merge into blocks */
  const raw=[];for(const s of steps){const ty=s.ty===1?'fish':s.ty===2?'move':'rest';const last=raw[raw.length-1];
    if(last&&last.ty===ty&&last.loc===s.to&&ty!=='move'&&last.k1===s.k0){last.k1=s.k1;continue;}raw.push({ty,k0:s.k0,k1:s.k1,loc:s.to,from:s.from});}
  /* wait at the old spot rather than arriving early: move → rest becomes rest → move */
  for(let i=0;i+1<raw.length;i++){const a=raw[i],b=raw[i+1];if(a.ty==='move'&&b.ty==='rest'){const rl=b.k1-b.k0,ml=a.k1-a.k0;
    raw[i]={ty:'rest',k0:a.k0,k1:a.k0+rl,loc:a.from,from:a.from};raw[i+1]={ty:'move',k0:a.k0+rl,k1:a.k0+rl+ml,loc:a.loc,from:a.from};
    if(i>0&&raw[i-1].ty==='rest'&&raw[i-1].loc===raw[i].loc){raw[i-1].k1=raw[i].k1;raw.splice(i,1);i--;}i=Math.max(-1,i-2);}}
  const fmtU=u=>'±'+Math.round(u)+'′';
  const blocks=raw.map(b=>{const o={ty:b.ty,t0:t0+b.k0*SM,t1:t0+b.k1*SM,loc:b.loc,from:b.from};
    if(b.ty==='move'){o.km=+mv[b.from][b.loc].km.toFixed(1);o.min=Math.round(mv[b.from][b.loc].min);}
    if(b.ty==='fish'){const i=b.loc,S=ser[i];let pk=null,sum=0,c=0;for(let k=b.k0;k<b.k1;k++){const q=S.M.get(t0+k*SM);if(!q)continue;sum+=q.score;c++;if(!pk||q.score>pk.score)pk=q;}
      o.avg=c?Math.round(sum/c):0;o.peak=pk?pk.score:0;o.peakT=pk?pk.t:o.t0;const why=[];
      const ri=S.runIn.find(r=>r.t>=o.t0-75*6e4&&r.t<=o.t1);if(ri)why.push(`${ri.kind==='rise'?'Water '+(ri.t<o.t0?'started':'starts')+' rising':'Run-in '+(ri.t<o.t0?'started':'starts')} ~${'@T'+Math.round(ri.t)} ${fmtU(ri.u)}`);
      if(pk){if(pk.L&&/twilight|Sunrise|sunset|Low sun|Night/i.test(pk.L.label))why.push(pk.L.label);if(pk.T&&!ri)why.push(pk.T.label);else if(pk.T&&pk.T.stype)why.push(pk.T.label);
        if(pk.DEP)why.push(pk.DEP.label);if(pk.S&&pk.S.v>=0.3)why.push(pk.S.label);if(pk.WX&&pk.WX.notes)for(const nn of pk.WX.notes.slice(0,2))why.push(nn);}
      const sd=S.stands.find(x=>x.t1>o.t0&&x.t0<o.t1);if(sd)why.push(`Tide stand ${'@T'+Math.round(sd.t0)}–${'@T'+Math.round(sd.t1)} (single-high day — no rise from the small high)`);
      const u=ri?ri.u:(S.cal&&S.cal.hwU)||null;o.u=u;if(u!=null&&u>=45)why.push(`Timing ${fmtU(u)} this far up — allow slack`);
      o.why=why;o.optional=o.avg<thr+4||o.peak<thr+6;o.ri=ri||null;}
    return o;});
  /* rest blocks: be back at the next fishing spot by its start */
  blocks.forEach((b,i)=>{if(b.ty!=='rest')return;const nx=blocks.slice(i+1).find(x=>x.ty==='fish');b.next=nx?{loc:nx.loc,t:nx.t0}:null;
    const nm=blocks.slice(i+1).find(x=>x.ty!=='rest');b.leaveT=nm&&nm.ty==='move'?nm.t0:null;});
  /* chart series */
  const chosen=new Array(K).fill(null);for(const b of blocks)if(b.ty==='fish')for(let t=b.t0;t<b.t1;t+=SM){const k=Math.round((t-t0)/SM);chosen[k]=sc(b.loc,t);}
  /* sessions (fishing + moves between rests ≥ 45 min) → one-session pick */
  const sess=[];let cur=null;for(const b of blocks){if(b.ty==='rest'&&b.t1-b.t0>=45*6e4){cur=null;continue;}if(b.ty==='rest')continue;if(!cur){cur={t0:b.t0,t1:b.t1,blocks:[],gain:0,fish:0};sess.push(cur);}cur.t1=b.t1;cur.blocks.push(b);
    if(b.ty==='fish'){const k0=Math.round((b.t0-t0)/SM),k1=Math.round((b.t1-t0)/SM);cur.gain+=gain[b.loc][k1]-gain[b.loc][k0];cur.fish+=(b.t1-b.t0);}}
  sess.forEach(s=>{while(s.blocks.length&&s.blocks[s.blocks.length-1].ty==='move')s.blocks.pop();s.t1=s.blocks.length?s.blocks[s.blocks.length-1].t1:s.t1;});
  const one=sess.filter(s=>s.fish>0).sort((a,b)=>b.gain-a.gain)[0]||null;
  /* single best spot window (1.5–2.5 h) as an alternative one-session pick */
  let solo=null;for(let i=0;i<n;i++)for(let k=0;k+8<=K;k++){const g=gain[i][k+8]-gain[i][k];if(!solo||g>solo.g)solo={g,loc:i,t0:t0+k*SM,t1:t0+(k+8)*SM};}
  if(solo){let s=0;for(let t=solo.t0;t<solo.t1;t+=SM)s+=sc(solo.loc,t);solo.avg=Math.round(s/8);}
  /* early / late options outside the chosen hours */
  const opt=(a,b)=>{let o=null;for(let i=0;i<n;i++)for(let m=a;m+90<=b;m+=STEP){let s=0,c=0,pk=0;for(let x=m;x<m+90;x+=STEP){const v=sc(i,day0+x*6e4);s+=v;c++;pk=Math.max(pk,v);}const av=s/c;if(av>=thr+5&&(!o||av>o.avg))o={loc:i,t0:day0+m*6e4,t1:day0+(m+90)*6e4,avg:Math.round(av),peak:pk};}return o;};
  const early=R.startMin>0?opt(ex0,R.startMin):null,late=opt(R.endMin,ex1);
  if(early){const ri=ser[early.loc].runIn.find(r=>r.t>=early.t0-45*6e4&&r.t<=early.t1);early.ri=ri||null;}
  if(late){const ri=ser[late.loc].runIn.find(r=>r.t>=late.t0-45*6e4&&r.t<=late.t1);late.ri=ri||null;}
  /* benchmark checks along the route */
  const vis=[...new Set(blocks.filter(b=>b.ty==='fish').map(b=>b.loc))];const bench=[];
  /* only turns you will actually be there for (fishing at that spot, or within 1 h before you get there), plus one single/both-highs check */
  const fb=blocks.filter(b=>b.ty==='fish');let hi=null;
  for(const i of vis){const S=ser[i];for(const r of S.runIn)if(r.t>=t0-30*6e4&&r.t<=t1&&fb.some(b=>b.loc===i&&r.t>=b.t0-60*6e4&&r.t<=b.t1))bench.push({loc:i,t:Math.round(r.t),u:r.u,kind:r.kind==='rise'?'rise':'low'});
    if(!GEN&&(SP[i].line||'B')==='B'&&SP[i].km>=20){const sd=S.stands.filter(x=>x.t>=day0&&x.t<day0+864e5);const c={loc:i,t:sd.length?Math.round(sd[0].t0):day0+12*36e5,kind:sd.length?'single':'both',sd:sd[0]||null};if(!hi||(c.kind==='single'&&hi.kind!=='single'))hi=c;}}
  if(hi)bench.push(hi);
  bench.sort((a,b)=>a.t-b.t);
  const fishMs=blocks.filter(b=>b.ty==='fish').reduce((a,b)=>a+b.t1-b.t0,0),moveKm=blocks.filter(b=>b.ty==='move').reduce((a,b)=>a+b.km,0);
  return{date:R.date,t0,t1,thr,med,auto:R.thr==null||R.thr==='auto',blocks,best,bestI,chosen,one,solo,early,late,bench,fishH:fishMs/36e5,moveKm:+moveKm.toFixed(1),
    spots:LOC.map(p=>({name:p.name,km:p.km,line:p.line,custom:!!p.custom,id:p.id||null,type:p.type||'',lat:p.lat,lng:p.lng,lm:!!p.lm})),launch:L0,value:+bv.toFixed(1),
    runIns:ser.map(S=>S.runIn.filter(r=>r.t>=t0-36e5&&r.t<=t1).map(r=>({t:r.t,u:r.u,kind:r.kind}))),stands:ser.map(S=>S.stands.filter(x=>x.t1>=t0&&x.t0<=t1))};}
G.FTCalc={makeCore,makeRunner,planDay,TZ,DDLO,DDHI};
/* ---- Web Worker entry (only when this text runs inside the worker built by the Calendar tab) ---- */
if(typeof document==='undefined'&&typeof importScripts==='function'&&G.__ftCalWorker){let run=null,gen=0;
  G.onmessage=e=>{const m=e.data||{};
    if(m.type==='init'){if(run)run.stop();gen=m.gen;const g=gen;let B;
      try{B=m.cfg.sys?G.FT.makeSystemBT(m.cfg.sys):G.BT;}catch(err){G.postMessage({type:'error',gen:g,msg:String(err&&err.message||err)});return;}
      const core=makeCore(B,G.MJ,m.cfg);run=makeRunner(core,m.pts,x=>{x.gen=g;G.postMessage(x);});G.postMessage({type:'ready',gen:g});}
    else if(m.type==='add'&&run&&m.gen===gen)run.add(m.blocks);
    else if(m.type==='prio'&&run&&m.gen===gen)run.prio(m.key);
    else if(m.type==='stop'&&run){run.stop();run=null;}
    else if(m.type==='plan'){try{const B=m.cfg.sys?G.FT.makeSystemBT(m.cfg.sys):G.BT;const core=makeCore(B,G.MJ,m.cfg);const t=Date.now();const P=planDay(core,m.req);P.ms=Date.now()-t;G.postMessage({type:'plan',id:m.id,plan:P});}
      catch(err){G.postMessage({type:'plan',id:m.id,error:String(err&&err.message||err)});}}};}
})(typeof window!=='undefined'?window:globalThis);
