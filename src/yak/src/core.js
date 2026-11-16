/* Mac's Yak core: kayak traffic light, bite score, tides, wind-turn + paddle planner.
   Shared by the page, the service worker (importScripts) and node (tools/yak_brief.mjs). Needs astro.js + PORTS + SYSTEMS globals. */
(function(G){'use strict';
const YAK={};const TZ=YAK.TZ='Australia/Brisbane';
/* ---- defaults (sources in the Safety tab / README) ---- */
YAK.DEFAULTS={windGreen:10,windRed:15,gustGreen:15,gustRed:20,waveGreen:0.8,waveRed:1.2,offshoreFactor:0.7,
  rainAmber:2,popAmber:60,visAmber:2,sessionStart:5,sessionEnd:12,minWindow:2,speed:3.5,fishHours:2,current:1.0,grace:30};
YAK.LAUNCHES=[
 {id:'burnett-heads',name:'Burnett Heads boat ramp (Burnett mouth)',lat:-24.762,lng:152.401,exp:'mouth',facing:45,sys:'burnett-river'},
 {id:'bargara',name:'Bargara (Kellys Beach)',lat:-24.825,lng:152.464,exp:'open',facing:90,sys:'moneys-creek'},
 {id:'elliott-heads',name:'Elliott Heads (Elliott River mouth)',lat:-24.918,lng:152.489,exp:'mouth',facing:90,sys:'elliott-river'},
 {id:'moore-park',name:'Moore Park Beach',lat:-24.716,lng:152.268,exp:'open',facing:30,sys:'kolan-river'},
 {id:'burnett-town',name:'Burnett River, Bundaberg town reach',lat:-24.864,lng:152.348,exp:'estuary',facing:null,sys:'burnett-river'},
 {id:'kolan',name:'Kolan River (lower reaches)',lat:-24.660,lng:152.170,exp:'estuary',facing:null,sys:'kolan-river'},
 {id:'baffle',name:'Baffle Creek (lower reaches)',lat:-24.530,lng:152.040,exp:'estuary',facing:null,sys:'baffle'},
 {id:'elliott-river',name:'Elliott River (inside)',lat:-24.935,lng:152.470,exp:'estuary',facing:null,sys:'elliott-river'},
 {id:'theodolite',name:'Theodolite Creek',lat:-25.065,lng:152.540,exp:'estuary',facing:null,sys:'theodolite-creek'},
 {id:'woodgate',name:'Woodgate Beach',lat:-25.108,lng:152.564,exp:'open',facing:80,sys:'theodolite-creek'},
 {id:'burrum-heads',name:'Burrum Heads (Burrum River mouth)',lat:-25.184,lng:152.616,exp:'mouth',facing:60,sys:'burrum-river'}];
YAK.EXPOSURE={open:'Open coast / beach',mouth:'River mouth / bar',estuary:'Estuary / river (sheltered)'};
/* ---- helpers ---- */
const RAD=Math.PI/180;
YAK.angDiff=(a,b)=>{let d=Math.abs(((a-b)%360+360)%360);return d>180?360-d:d;};
YAK.compass=d=>d==null?'':['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(((d%360)+360)%360/22.5)%16];
YAK.distNm=(a,b)=>{const R=3440.065,dl=(b.lat-a.lat)*RAD,dn=(b.lng-a.lng)*RAD;const x=Math.sin(dl/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(dn/2)**2;return 2*R*Math.asin(Math.sqrt(x));};
YAK.bearing=(a,b)=>{const p1=a.lat*RAD,p2=b.lat*RAD,dl=(b.lng-a.lng)*RAD;return (Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))/RAD+360)%360;};
YAK.nearestSys=(lat,lng)=>{let b=null,bd=1e9;for(const s of (G.SYSTEMS||[])){const d=(s[2]-lat)**2+((s[3]-lng)*0.9)**2;if(d<bd){bd=d;b=s;}}return b?{id:b[0],name:b[1],lat:b[2],lng:b[3],km:Math.sqrt(bd)*111}:null;};
YAK.isOffshore=(dir,facing)=>facing!=null&&dir!=null&&YAK.angDiff(dir,(facing+180)%360)<=60;
YAK.isOnshore=(dir,facing)=>facing!=null&&dir!=null&&YAK.angDiff(dir,facing)<=60;
/* ---- tides: Mac's Jacks base-port harmonics (MSQ predictions fitted offline, CC-BY 4.0) + nodal corrections; same code as Mac's Jacks / Mac's Crabs ---- */
const EPOCH_UTC=Date.UTC(2025,11,31,14,0);YAK.H2MS=h=>EPOCH_UTC+h*3.6e6;YAK.MS2H=ms=>(ms-EPOCH_UTC)/3.6e6;
function nodeN(h){const d0=(EPOCH_UTC-Date.UTC(2000,0,1,12))/864e5;return (125.0445-0.0529538*(d0+h/24))*RAD;}
function fuAll(h){const N=nodeN(h),c=Math.cos,s=Math.sin;
  const fM2=1.0004-0.0373*c(N)+0.0002*c(2*N),uM2=-2.14*s(N);
  const fK1=1.0060+0.1150*c(N)-0.0088*c(2*N)+0.0006*c(3*N),uK1=-8.86*s(N)+0.68*s(2*N)-0.07*s(3*N);
  const fO1=1.0089+0.1871*c(N)-0.0147*c(2*N)+0.0014*c(3*N),uO1=10.80*s(N)-1.34*s(2*N)+0.19*s(3*N);
  const fK2=1.0241+0.2863*c(N)+0.0083*c(2*N)-0.0015*c(3*N),uK2=-17.74*s(N)+0.68*s(2*N)-0.04*s(3*N);
  return {SA:[1,0],SSA:[1,0],MM:[1-0.13*c(N),0],MSF:[fM2,-uM2],MF:[1.0429+0.4135*c(N)-0.004*c(2*N),-23.74*s(N)+2.68*s(2*N)-0.38*s(3*N)],
  '2Q1':[fO1,uO1],Q1:[fO1,uO1],RHO1:[fO1,uO1],O1:[fO1,uO1],M1:[fO1,uO1],P1:[1,0],S1:[1,0],K1:[fK1,uK1],
  J1:[1.0129+0.1676*c(N)-0.017*c(2*N),-12.94*s(N)+1.34*s(2*N)-0.19*s(3*N)],OO1:[1.1027+0.6504*c(N)+0.0317*c(2*N)-0.0014*c(3*N),-36.68*s(N)+4.02*s(2*N)-0.57*s(3*N)],
  '2N2':[fM2,uM2],MU2:[fM2,uM2],N2:[fM2,uM2],NU2:[fM2,uM2],M2:[fM2,uM2],LAM2:[fM2,uM2],L2:[fM2,uM2],T2:[1,0],S2:[1,0],R2:[1,0],K2:[fK2,uK2],'2SM2':[fM2,-uM2],
  MO3:[fM2*fO1,uM2+uO1],M3:[Math.pow(fM2,1.5),1.5*uM2],MK3:[fM2*fK1,uM2+uK1],SK3:[fK1,uK1],
  MN4:[fM2*fM2,2*uM2],M4:[fM2*fM2,2*uM2],MS4:[fM2,uM2],MK4:[fM2*fK2,uM2+uK2],S4:[1,0],
  '2MN6':[fM2**3,3*uM2],M6:[fM2**3,3*uM2],'2MS6':[fM2*fM2,2*uM2],'2SM6':[fM2,uM2],M8:[fM2**4,4*uM2]};}
const portFn={};
YAK.portFor=sys=>(G.PORTS.sysPort[sys]||'bundaberg');
YAK.tideFn=function(portId){if(portFn[portId])return portFn[portId];const H=G.PORTS.ports[portId].harm;let fc={k:null,v:null};
  const f=h=>{const k=Math.floor(h/24);if(fc.k!==k)fc={k,v:fuAll(k*24+12)};const F=fc.v;let z=H.z0;for(let i=0;i<H.names.length;i++){const fu=F[H.names[i]]||[1,0];z+=fu[0]*H.amp[i]*Math.cos((H.speeds[i]*h+fu[1]-H.pha[i])*RAD);}return z;};
  return portFn[portId]=f;};
YAK.extremes=function(portId,h0,h1){const f=YAK.tideFn(portId),st=0.1,out=[];let a=f(h0-st),b=f(h0);
  for(let t=h0+st;t<=h1;t+=st){const c=f(t);if((b>a&&b>=c)||(b<a&&b<=c)){const den=a-2*b+c,off=den?0.5*(a-c)/den:0;out.push({h:t-st+off*st,z:b-0.25*(a-c)*off,hi:b>a});}a=b;b=c;}
  const r=[];for(const x of out){const l=r[r.length-1];if(l&&l.hi===x.hi){if((x.hi&&x.z>l.z)||(!x.hi&&x.z<l.z))r[r.length-1]=x;}else if(l&&Math.abs(l.z-x.z)<0.05)r.pop();else r.push(x);}
  return r.map(x=>({t:YAK.H2MS(x.h),z:x.z,hi:x.hi}));};
/* tide rate (m/h, + rising) and stage label */
YAK.tideAt=function(portId,ms){const f=YAK.tideFn(portId),h=YAK.MS2H(ms);const z=f(h),r=(f(h+0.25)-f(h-0.25))*2;
  const E=YAK.extremes(portId,h-8,h+8);let prev=null,next=null;for(const x of E){if(x.t<=ms)prev=x;else{next=x;break;}}
  let stage='';if(prev&&next){const fr=(ms-prev.t)/(next.t-prev.t);stage=fr<0.15?(prev.hi?'Top of the tide':'Bottom of the tide'):fr>0.85?(prev.hi?'Bottom of the run-out':'Top of the run-in'):(prev.hi?'Run-out':'Run-in');}
  return {z,rate:r,stage,rising:r>0};};
/* ---- weather fetch (Open-Meteo forecast + marine, keyless, CORS) ---- */
YAK.fetchForecast=async function(spot,days){days=days||14;
  const q=`latitude=${spot.lat.toFixed(4)}&longitude=${spot.lng.toFixed(4)}&timeformat=unixtime&timezone=Australia%2FBrisbane`;
  const fu=`https://api.open-meteo.com/v1/forecast?${q}&hourly=temperature_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,uv_index,visibility,cape&daily=sunrise,sunset,uv_index_max,precipitation_sum,temperature_2m_max&wind_speed_unit=kn&forecast_days=${days}&past_days=3`;
  const mu=`https://marine-api.open-meteo.com/v1/marine?${q}&hourly=wave_height,wave_period,wave_direction,wind_wave_height,swell_wave_height,swell_wave_period,sea_surface_temperature&forecast_days=${days}&past_days=3&cell_selection=sea`;
  const gj=async(u,n)=>{try{const r=await fetch(u);if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}catch(x){if((n||0)<1){await new Promise(z=>setTimeout(z,1500));return gj(u,1);}throw x;}};
  const [W,M]=await Promise.all([gj(fu),gj(mu).catch(e=>({error:String(e)}))]);
  const H=W.hourly,out={at:Date.now(),spot:{lat:spot.lat,lng:spot.lng},t:H.time.map(x=>x*1000),wind:H.wind_speed_10m,gust:H.wind_gusts_10m,dir:H.wind_direction_10m,temp:H.temperature_2m,rain:H.precipitation,pop:H.precipitation_probability,code:H.weather_code,uv:H.uv_index,vis:H.visibility,cape:H.cape,
    daily:{t:W.daily.time.map(x=>x*1000),sunrise:W.daily.sunrise.map(x=>x*1000),sunset:W.daily.sunset.map(x=>x*1000),uvmax:W.daily.uv_index_max,rain:W.daily.precipitation_sum,tmax:W.daily.temperature_2m_max},marine:!!(M&&M.hourly),marineCell:M&&M.latitude!=null?[M.latitude,M.longitude]:null};
  if(M&&M.hourly){const mt=M.hourly.time.map(x=>x*1000),idx=new Map(mt.map((t,i)=>[t,i]));const pick=k=>out.t.map(t=>{const i=idx.get(t);return i==null?null:M.hourly[k][i];});
    out.wave=pick('wave_height');out.wper=pick('wave_period');out.wdir=pick('wave_direction');out.wwave=pick('wind_wave_height');out.swell=pick('swell_wave_height');out.sper=pick('swell_wave_period');out.sst=pick('sea_surface_temperature');}
  return out;};
/* ---- traffic light: 0 green, 1 amber, 2 red ---- */
const THUNDER=c=>c>=95;
YAK.rateHour=function(F,i,spot,S){const why=[];let lvl=0;const up=(l,w)=>{if(l>lvl)lvl=l;why.push([l,w]);};
  const w=F.wind[i],g=F.gust[i],d=F.dir[i],off=YAK.isOffshore(d,spot.facing),fac=off?S.offshoreFactor:1;
  const wg=S.windGreen*fac,wr=S.windRed*fac,gg=S.gustGreen*fac,gr=S.gustRed*fac;
  if(w!=null){if(w>=26)up(2,`Wind ${Math.round(w)} kn: BOM strong-wind-warning level (26 kn+)`);else if(w>wr)up(2,`Wind ${Math.round(w)} kn > ${+wr.toFixed(1)}${off?' (offshore limit)':''}`);else if(w>=wg)up(1,`Wind ${Math.round(w)} kn (${+wg.toFixed(1)}–${+wr.toFixed(1)} amber${off?', offshore':''})`);}
  if(g!=null){if(g>gr)up(2,`Gusts ${Math.round(g)} kn > ${+gr.toFixed(1)}`);else if(g>=gg)up(1,`Gusts ${Math.round(g)} kn${off?" (offshore limit "+(+gg.toFixed(1))+")":""}`);}
  if(off&&w!=null&&w>=5)why.push([lvl,`Offshore ${YAK.compass(d)} wind: blows you out to sea (limits ×${S.offshoreFactor})`]);
  const c=F.code[i];if(c!=null&&THUNDER(c))up(2,'Thunderstorm forecast: get off the water');
  else if(F.cape&&F.cape[i]>1500&&(F.pop[i]||0)>=40)up(1,'Unstable air, storm risk');
  if(spot.exp!=='estuary'&&F.wave&&F.wave[i]!=null){const h=F.wave[i];if(h>S.waveRed)up(2,`Waves ${h.toFixed(1)} m > ${S.waveRed}`);else if(h>=S.waveGreen)up(1,`Waves ${h.toFixed(1)} m`);
    const p=F.wper&&F.wper[i];if(p&&p<5&&h>=0.6)up(1,`Short steep chop (${h.toFixed(1)} m @ ${p.toFixed(0)} s)`);
    if(spot.exp==='mouth'&&F.swell&&F.swell[i]>=0.8)up(1,`Swell ${F.swell[i].toFixed(1)} m: bar may break (MSQ: don't cross in heavy swell)`);}
  if((F.rain[i]||0)>=S.rainAmber)up(1,`Rain ${F.rain[i].toFixed(1)} mm/h`);else if((F.pop[i]||0)>=S.popAmber&&(F.rain[i]||0)>=0.5)up(1,`Showers likely (${F.pop[i]}%)`);
  if(F.vis&&F.vis[i]!=null&&F.vis[i]<S.visAmber*1000)up(1,`Poor visibility ${(F.vis[i]/1000).toFixed(1)} km`);
  return {lvl,why,off,on:YAK.isOnshore(d,spot.facing)};};
/* ---- fishing (bite) score: Mac's Jacks solunar/moon/light/tide logic, general estuary/inshore species ---- */
YAK.BW={sol:35,tide:30,light:25,moon:10};
const evCache={};
YAK.events=(d0,lat,lng)=>{const k=d0+'|'+lat.toFixed(2)+'|'+lng.toFixed(2);return evCache[k]||(evCache[k]=sunMoonEvents(d0-3*3.6e6,d0+27*3.6e6,lat,lng));};
YAK.bite=function(ms,spot,ev,port,P){const sf=solunarFactor(ms,ev);const T=YAK.tideAt(port,ms);
  const mv=clamp(Math.abs(T.rate)/0.35);const alt=sunAlt(ms,spot.lat,spot.lng);const light=alt>=-8&&alt<=12?1:alt<-8?0.45:0.35;
  const ph=moonIllum(ms).phase,mo=moonPhaseFactor(ph);
  const F={sol:sf.v,tide:0.25+0.75*mv,light,moon:mo};let s=0;for(const k in YAK.BW)s+=YAK.BW[k]*F[k];
  let pm=1;if(P&&P.ok){const b=YAK.bins({sol:sf.v>0?(sf.major?'major':'minor'):'none',stg:T.stage,alt});pm=P.m.sol[b.sol]*P.m.stg[b.stg]*P.m.light[b.light];pm=Math.max(0.8,Math.min(1.2,pm));}
  return {s:Math.min(100,s*pm),F,sol:sf,T,alt,pm};};
/* personal adjustment from the yak catch log (bins, shrunk toward 1) */
YAK.bins=c=>({sol:c.sol||'none',stg:/run-in/i.test(c.stg||'')?'in':/run-out/i.test(c.stg||'')?'out':'slack',light:c.alt==null?'day':c.alt<-8?'night':c.alt<=12?'lowlight':'day'});
YAK.personal=function(log){const ses=(log||[]).filter(s=>s.ctx&&s.ctx.slots&&s.ctx.slots.length&&s.t1);const tot={h:0,n:0};const B={sol:{},stg:{},light:{}};
  for(const s of ses){const n=s.ctx.slots.length;for(const sl of s.ctx.slots){const b=YAK.bins(sl);const hrs=0.25;tot.h+=hrs;for(const k in B){const o=B[k][b[k]]||(B[k][b[k]]={h:0,n:0});o.h+=hrs;}}
    for(const c of (s.catches||[])){const sl=s.ctx.slots.reduce((a,x)=>Math.abs(x.t-c.t)<Math.abs(a.t-c.t)?x:a,s.ctx.slots[0]);const b=YAK.bins(sl);tot.n++;for(const k in B){const o=B[k][b[k]]||(B[k][b[k]]={h:0,n:0});o.n++;}}}
  const ok=ses.length>=5&&tot.h>=6&&tot.n>=3,rate=tot.n/Math.max(1,tot.h),K=4;const m={sol:{},stg:{},light:{}};
  for(const k in B)for(const v of {sol:['major','minor','none'],stg:['in','out','slack'],light:['lowlight','day','night']}[k]){const o=B[k][v]||{h:0,n:0};m[k][v]=ok?Math.max(0.85,Math.min(1.15,(o.n+K*rate)/(o.h*rate+K*rate||1))):1;}
  return {ok,sessions:ses.length,hours:tot.h,fish:tot.n,m};};
/* ---- whole-day analysis ---- */
YAK.dayKeys=(F)=>{const s=new Set();F.t.forEach(t=>s.add(ymd(t,TZ)));return [...s];};
YAK.analyseDay=function(F,dateStr,spot,S,P){const d0=dayStart(dateStr,TZ),d1=d0+864e5,port=YAK.portFor(spot.sys||'burnett-river');
  const ev=YAK.events(d0,spot.lat,spot.lng);const hrs=[];
  for(let i=0;i<F.t.length;i++){const t=F.t[i];if(t<d0||t>=d1)continue;const r=YAK.rateHour(F,i,spot,S);const b=YAK.bite(t+18e5,spot,ev,port,P);
    const hl=tzParts(t,TZ).h,alt=sunAlt(t+18e5,spot.lat,spot.lng);const ses=hl>=S.sessionStart&&hl<S.sessionEnd&&alt>-6;hrs.push({i,t,h:hl,r,b,ses});}
  if(!hrs.length)return null;
  const S_=hrs.filter(x=>x.ses);const run=(ok)=>{let best=null,cur=null;for(const x of S_){if(ok(x)){if(!cur||x.t-cur.t1>36e5+1)cur={t0:x.t,t1:x.t,n:0,bite:0,hs:[]};cur.t1=x.t;cur.n++;cur.bite+=x.b.s;cur.hs.push(x);if(!best||cur.n>best.n||(cur.n===best.n&&cur.bite>best.bite))best=Object.assign({},cur,{hs:cur.hs.slice()});}else cur=null;}return best;};
  const g=run(x=>x.r.lvl===0),ga=run(x=>x.r.lvl<=1);let lvl,win;
  if(g&&g.n>=S.minWindow){lvl=0;win=g;}else if(ga&&ga.n>=S.minWindow){lvl=1;win=ga;}else{lvl=2;win=ga||g||null;}
  /* best fishing sub-window (2–3 h) inside the safe window */
  let fishWin=null;if(win&&win.hs.length){const L=Math.min(3,win.hs.length);for(let k=0;k+L<=win.hs.length;k++){const seg=win.hs.slice(k,k+L),avg=seg.reduce((a,x)=>a+x.b.s,0)/L;if(!fishWin||avg>fishWin.avg)fishWin={t0:seg[0].t,t1:seg[L-1].t+36e5,avg,lvl:Math.max(...seg.map(x=>x.r.lvl))};}}
  const pick=k=>S_.map(x=>F[k]&&F[k][x.i]).filter(v=>v!=null);const mx=a=>a.length?Math.max(...a):null,mn=a=>a.length?Math.min(...a):null;
  const di=F.daily.t.findIndex(t=>ymd(t,TZ)===dateStr);
  const ext=YAK.extremes(port,YAK.MS2H(d0),YAK.MS2H(d1));
  const sol=[];for(const x of ev.transits)if(x.t>=d0&&x.t<d1)sol.push({t0:x.t-36e5,t1:x.t+36e5,major:true,label:'Major (moon '+(x.over?'overhead':'underfoot')+')'});
  for(const x of ev.moonRiseSet)if(x.t>=d0&&x.t<d1)sol.push({t0:x.t-18e5,t1:x.t+18e5,major:false,label:'Minor ('+(x.rising?'moonrise':'moonset')+')'});sol.sort((a,b)=>a.t0-b.t0);
  const reasons={};for(const x of S_)for(const [l,w] of x.r.why)if(l>=1){const k=w.replace(/[\d.]+/g,'#');if(!reasons[k]||reasons[k][0]<l)reasons[k]=[l,w];}
  const day={date:dateStr,d0,lvl,win,fishWin,hrs,sess:S_,port,ext,sol,
    wind:[mn(pick('wind')),mx(pick('wind'))],gust:mx(pick('gust')),wave:mx(pick('wave')),rainDay:di>=0?F.daily.rain[di]:null,tmax:di>=0?F.daily.tmax[di]:null,uvmax:di>=0?F.daily.uvmax[di]:null,
    sunrise:di>=0?F.daily.sunrise[di]:null,sunset:di>=0?F.daily.sunset[di]:null,moon:moonIllum(d0+12*36e5),
    worst:Object.values(reasons).sort((a,b)=>b[0]-a[0]).slice(0,4),bestBite:S_.length?Math.max(...S_.map(x=>x.b.s)):null};
  day.turn=YAK.windTurn(F,day,spot,S);return day;};
/* ---- wind-turn / sea-breeze / southerly change detection + head-back-by ---- */
YAK.windTurn=function(F,day,spot,S,trip){const H=day.sess;if(H.length<2)return null;const out=[];
  for(let k=1;k<H.length;k++){const a=H[Math.max(0,k-3)],b=H[k];const wa=F.wind[a.i],wb=F.wind[b.i],da=F.dir[a.i],db=F.dir[b.i];if(wb==null||da==null||db==null)continue;
    const dd=YAK.angDiff(da,db);
    const southerly=YAK.angDiff(db,180)<=40&&(YAK.angDiff(da,180)>50||wb-wa>=6)&&wb>=10;
    const seab=spot.facing!=null&&YAK.isOnshore(db,spot.facing)&&!YAK.isOnshore(da,spot.facing)&&wb>=8&&b.h>=9;
    const shift=dd>=60&&wb>=8;const ramp=wb-wa>=7&&wb>=10;
    if(southerly||seab||shift||ramp){out.push({t:b.t,kind:southerly?'Southerly change':seab?'Sea breeze kicks in':shift?'Wind shift':'Wind picking up',from:[YAK.compass(da),Math.round(wa)],to:[YAK.compass(db),Math.round(wb)]});break;}}
  const firstBad=H.find((x,k)=>k>0&&x.r.lvl>H[0].r.lvl&&x.r.lvl>=1);
  let backLeg=30*6e4;if(trip&&trip.backMin)backLeg=trip.backMin*6e4;
  let headwind=null;if(trip&&trip.retBrg!=null){for(const x of H){const d=F.dir[x.i],w=F.wind[x.i];if(d!=null&&w>=8&&YAK.angDiff(d,trip.retBrg)<=60){headwind=x.t;break;}}}
  const lim=[firstBad&&firstBad.t,out[0]&&out[0].t,headwind].filter(Boolean);
  const by=lim.length?Math.min(...lim)-backLeg:null;
  return (out.length||firstBad||headwind)?{change:out[0]||null,firstBad:firstBad?{t:firstBad.t,lvl:firstBad.r.lvl}:null,headwind,by}:null;};
/* ---- paddle planner: speed over ground with tide current + wind ---- */
YAK.legSpeed=function(F,ms,spot,brg,dirSign,S){const i=Math.max(0,Math.min(F.t.length-1,Math.round((ms-F.t[0])/36e5)));
  const port=YAK.portFor(spot.sys||'burnett-river'),T=YAK.tideAt(port,ms);const cur=S.current*clamp(Math.abs(T.rate)/0.45)*(spot.exp==='open'?0.3:1);
  const tideHelp=dirSign===0?0:(T.rising===(dirSign>0)?1:-1)*cur; /* dirSign +1 = heading upstream (flood helps), -1 = heading seaward (ebb helps) */
  const w=F.wind[i]||0,d=F.dir[i];let wind=0;if(d!=null){const head=Math.cos(YAK.angDiff(d,brg)*RAD);/* +1 = wind from where you're heading */wind=head>0?-head*Math.max(0,w-4)*0.07:-head*Math.max(0,w-4)*0.03;}
  return {v:Math.max(0.8,S.speed+tideHelp+wind),tide:tideHelp,wind};};
YAK.legTime=function(F,t0,spot,from,to,dirSign,S){const D=YAK.distNm(from,to),brg=YAK.bearing(from,to);let t=t0,left=D,guard=0;
  while(left>1e-3&&guard++<200){const v=YAK.legSpeed(F,t,spot,brg,dirSign,S).v;const step=Math.min(left,v*0.25);t+=step/v*36e5;left-=step;}return {min:(t-t0)/6e4,dist:D,brg};};
YAK.planTrip=function(F,day,spot,target,S){if(!target||!day.sess.length)return null;
  const mouth=spot.sys?(G.SYSTEMS||[]).find(s=>s[0]===spot.sys):null;let sign=0;
  if(spot.exp!=='open'&&mouth){const dm=p=>YAK.distNm(p,{lat:mouth[2],lng:mouth[3]});sign=dm(target)>dm(spot)+0.05?1:dm(target)<dm(spot)-0.05?-1:0;}
  if(target.dir==='up')sign=1;else if(target.dir==='down')sign=-1;else if(target.dir==='none')sign=0;
  const st=day.sess[0].t,en=day.sess[day.sess.length-1].t+36e5;let best=null;
  for(let t=st;t<=en-36e5;t+=15*6e4){const o=YAK.legTime(F,t,spot,spot,target,sign,S);const tf=t+o.min*6e4+S.fishHours*36e5;const b=YAK.legTime(F,tf,spot,target,spot,-sign,S);const home=tf+b.min*6e4;if(home>en+18e5)continue;
    const lv=day.hrs.filter(x=>x.t+36e5>t&&x.t<home).reduce((a,x)=>Math.max(a,x.r.lvl),0);const bite=day.hrs.filter(x=>x.t+36e5>t+o.min*6e4&&x.t<tf).reduce((a,x,_,A)=>a+x.b.s/A.length,0);
    const cost=o.min+b.min+lv*120-bite*0.6;if(!best||cost<best.cost)best={cost,leave:t,outMin:o.min,arrive:t+o.min*6e4,fishTill:tf,backMin:b.min,home,lvl:lv,bite,dist:o.dist,brg:o.brg,retBrg:(o.brg+180)%360,sign};}
  return best;};
/* ---- water quality: Mac's Jacks flood_state.json phase for the launch's system + recent rain ---- */
YAK.WQ={flood:[2,'River in flood: dirty, fast water and debris. Stay off it.'],rising:[2,'River rising after rain: dirty water, debris and strong ebb.'],dirty:[2,'Big fresh, dirty water (<4 days): poor visibility, bull sharks more active.'],
  runoff:[1,'Fresh runoff coming through: discoloured water near the mouth.'],clearing:[1,'Clearing after a flood (4–7 days).'],prime:[0,'Post-flood (7–14 days): water mostly clear, fish feeding.'],tapering:[0,'Fresh tapering off (14–21 days).']};
YAK.waterQuality=function(st,F){const out=[];if(st&&st.phase&&YAK.WQ[st.phase])out.push(YAK.WQ[st.phase].concat([st.gauge_name||'']));
  if(F&&F.daily){const now=Date.now();let r=0;F.daily.t.forEach((t,i)=>{if(t<now&&t>now-3*864e5)r+=F.daily.rain[i]||0;});if(r>=50)out.push([2,`${Math.round(r)} mm of rain in the last 3 days: expect dirty water, debris and runoff.`]);else if(r>=20)out.push([1,`${Math.round(r)} mm of rain in the last 3 days: water may be discoloured near creek mouths.`]);}
  return out;};
YAK.stinger=function(ms,lat){const m=tzParts(ms,TZ).mo;const season=m>=11||m<=5;if(!season)return null;
  return lat>-25.9?'Marine stinger season (Nov–May). Irukandji occur north of southern K\'gari and SLSQ lists dangerous stingers from Bustard Heads north. Wear a stinger suit if you might end up in the water, carry vinegar, and call 000 if stung.':'Marine stinger season (Nov–May): bluebottles and Morbakka possible. Carry vinegar.';};
YAK.LV=['GREEN','AMBER','RED'];YAK.EMO=['🟢','🟠','🔴'];
G.YAK=YAK;})(typeof globalThis!=='undefined'?globalThis:self);
