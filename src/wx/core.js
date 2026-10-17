/* --- weather v2: drizzle & storm triggers (local angler: "drizzle rain and potential storm activity are a trigger") ---
   Positive triggers: drizzle / light rain (~0.1–2 mm/h, or drizzle weather codes), overcast, falling barometer, warm humid air,
   and the build-up to storms (CAPE, lifted index, shower/thunder codes, rain probability) 0–3 h ahead and at the onset.
   Penalties only for: very heavy rain (> ~8 mm/h), strong wind (> 30 km/h) and big fresh/flood flow (dirty water).
   Lightning at the spot itself = ⚠ safety note (marked, small damping of the boost), not a big score penalty. */
const THUNDER=c=>c===95||c===96||c===99;
function stormPot(code,cape,li,pp){
  const c=THUNDER(code)?1:code===82?0.5:code===81?0.4:code===80?0.3:0;
  const a=cape!=null?clamp((cape-300)/1700):null,b=li!=null?clamp(-li/5):null;
  const inst=a!=null&&b!=null?0.6*a+0.4*b:a!=null?a:b!=null?b:0;
  const ppF=pp==null?0.7:0.4+0.6*clamp(pp/100);
  return Math.max(c,inst*ppF);}
function drizzleOf(rain,code){let d=0;if(rain!=null){d=rain<0.05?0:rain<0.1?(rain-0.05)/0.05:rain<=2?1:rain<4?(4-rain)/2:0;}
  if(code!=null&&code>=51&&code<=57)d=Math.max(d,0.85);else if(code===61||code===80)d=Math.max(d,rain!=null&&rain>4?0:0.7);return clamp(d);}
/* hourly Open-Meteo forecast -> wx(t) incl. 0–3 h storm look-ahead; any missing field is simply ignored */
function makeWxFn(tt,h){const has=k=>Array.isArray(h[k])&&h[k].some(v=>v!=null);const S=k=>has(k)?makeSeries(tt,h[k]):()=>null;
  const n=tt.length,at=(k,i)=>has(k)&&i>=0&&i<n?h[k][i]:null;
  const P=S('pressure_msl'),Wd=S('wind_speed_10m'),G=S('wind_gusts_10m'),C=S('cloud_cover'),RH=S('relative_humidity_2m'),T=S('temperature_2m'),CAPE=S('cape'),LI=S('lifted_index'),PP=S('precipitation_probability');
  const iN=t=>Math.round((t-tt[0])/3600e3),iC=t=>Math.ceil((t-tt[0])/3600e3-1e-9); /* precipitation & codes = the hour ending at the timestamp */
  const codeAt=t=>at('weather_code',iC(t)),rainAt=t=>{const v=at('precipitation',iC(t));return v==null?null:Math.max(0,v);};
  const spAt=t=>stormPot(codeAt(t),CAPE(t),LI(t),PP(t));
  return t=>{const p=P(t),wind=Wd(t);if(p==null&&wind==null&&rainAt(t)==null)return null;const p3=P(t-3*3600e3);
    let best=0,bk=0;for(let k=0;k<=6;k++){const s=spAt(t+k*1800e3)*(1-0.05*k);if(s>best){best=s;bk=k/2;}}
    const tp=t+bk*3600e3;let stormAhead6=false;for(let k=1;k<=6;k++)if(THUNDER(codeAt(t+k*3600e3)))stormAhead6=true;
    const cl=v=>v==null?null:Math.max(0,v);
    return{p,dp3:p!=null&&p3!=null?p-p3:null,wind:cl(wind),gust:cl(G(t)),cloud:C(t)==null?null:clamp(C(t)/100)*100,rain:rainAt(t),rh:RH(t),temp:T(t),code:codeAt(t),pp:PP(t)==null?null:clamp(PP(t)/100)*100,
      cape:cl(CAPE(t)),li:LI(t),storm:{v:best,inH:bk,cape:cl(CAPE(tp)),li:LI(tp),pp:PP(tp),code:codeAt(tp)},stormAhead:stormAhead6};};}
function weatherFactor(w,fr){ // w from makeWxFn (older {p,dp3,wind,rain,cloud,rh,temp,code} objects also work); fr = fresh-flow {adj,note}
  const notes=[];let v=0.5;const o={dz:0,storm:0,lightning:false,heavy:false,windy:false};
  const fin=x=>clamp(clamp(x)+(fr&&fr.adj||0),0,1.35);if(fr&&fr.note)notes.push(fr.note);o.flood=fr||null;
  if(!w)return Object.assign(o,{v:fin(v),notes});
  let pf=0;
  if(w.dp3!=null&&w.dp3<=-0.6){pf=clamp((-w.dp3-0.6)/1.8);v+=clamp((-w.dp3-0.6)/2.4)*0.25+0.05;notes.push('Falling barometer ('+w.dp3.toFixed(1)+' hPa/3h)');}
  const wh=w.temp!=null&&w.rh!=null&&w.temp>=24&&w.rh>=65;if(wh){v+=0.08;notes.push('Warm & humid');}
  /* drizzle / light rain = trigger (also darkens the light — see lightFactor) */
  const dz=drizzleOf(w.rain,w.code);o.dz=dz;
  if(dz>0.2){v+=0.22*dz;const r=w.rain;notes.push((r!=null&&r>=1?'Light rain':'Drizzle')+(r!=null&&r>=0.1?` (${r.toFixed(1)} mm/h)`:'')+(w.cloud!=null&&w.cloud>=80?', overcast':''));}
  else if(w.cloud!=null&&w.cloud>=70)v+=0.03;
  /* storms: build-up 0–3 h ahead and the onset */
  const st=w.storm||(w.stormAhead?{v:0.4,inH:3}:null);
  if(THUNDER(w.code)){o.lightning=true;notes.push('⚠ Thunderstorm forecast at the spot — lightning risk: get off the water');}
  if(st&&st.v>=0.15){let b=0.4*st.v*(0.65+0.2*pf+0.15*(wh?1:0));if(o.lightning)b*=0.7;v+=b;o.storm=st.v;
    const det=[st.cape!=null&&st.cape>=100?'CAPE '+Math.round(st.cape/50)*50:null,st.li!=null&&st.li<0?'LI '+st.li.toFixed(1):null,st.pp!=null?Math.round(st.pp)+'% rain chance':null,pf>0?'pressure falling':null].filter(Boolean);
    const parts=(st.inH>=1?['peak in ~'+Math.round(st.inH)+' h']:[]).concat(det);
    if(!o.lightning)notes.push((st.v>=0.5?'Storm building':'Storm potential')+(parts.length?' ('+parts.join(', ')+')':''));}
  /* penalties */
  if(w.rain!=null&&w.rain>8){o.heavy=true;v-=lerp(w.rain,8,15,0.12,0.25);notes.push(`Very heavy rain (${w.rain.toFixed(0)} mm/h)`);}
  if(w.wind!=null){if(w.wind>30){o.windy=true;v-=lerp(w.wind,30,45,0.15,0.3);notes.push('Strong wind '+Math.round(w.wind)+' km/h');}else if(w.wind<12)v+=0.03;}
  return Object.assign(o,{v:fin(v),notes});}
/* ---- flood cycle (local knowledge: "about 1 to 2 weeks after the flood, even if the river is running, performs well for
   jack; light floods or runoff are also very good") — driven by the system's fresh-flow gauge record (archive + 7-day tables).
   M = [[minute since 2026-01-01 AEST, level m]] sorted; cls = BoM flood classes {minor,moderate,major} (gauge height) or null. */
const FE0=Date.UTC(2025,11,31,14),DAY=864e5;
function floodState(M,cls,now){now=now==null?Date.now():now;M=(M||[]).filter(x=>x&&isFinite(x[0])&&isFinite(x[1]));if(M.length<3)return{kind:'nodata',known:false,spanD:0};
  const tms=m=>FE0+m*60e3,first=tms(M[0][0]),last=tms(M[M.length-1][0]),spanD=(last-first)/DAY;
  if(now-last>3*DAY)return{kind:'stale',known:false,spanD,lastT:last};
  const recent=M.filter(x=>tms(x[0])>=last-30*DAY).map(x=>x[1]).sort((a,b)=>a-b);const base=recent[Math.floor(recent.length*0.1)];
  const C=cls&&cls.minor!=null?cls:null;
  const lightThr=C?Math.max(0.3,0.05*(C.minor-base)):0.3,bigLvl=C?(C.moderate!=null?C.moderate:C.minor):null,bigRise=3.0;
  /* despike: drop isolated single readings far above both neighbours (gauge glitches, e.g. one 7.1 m reading between 0.05 m) */
  {const jump=Math.max(0.3,0.6*lightThr);M=M.filter((x,i)=>{const p=M[i-1],q=M[i+1];if(!p||!q||x[0]-p[0]>720||q[0]-x[0]>720)return true;const hi=Math.max(p[1],q[1]);return !(x[1]-hi>jump&&Math.abs(p[1]-q[1])<0.5*(x[1]-hi));});}
  /* latest event = last run of readings ≥ base + 0.6·threshold (gaps < 1 day merged) */
  let seg=null,segs=[];for(const x of M){const t=tms(x[0]);if(x[1]-base>=0.6*lightThr){if(seg&&t-seg.e<=DAY){seg.e=t;if(x[1]>seg.pk){seg.pk=x[1];seg.pt=t;}}else{seg={s:t,e:t,pk:x[1],pt:t};segs.push(seg);}}}
  const ev=segs.filter(g=>g.pk-base>=lightThr).pop();
  const lvl=M[M.length-1][1],cname=v=>!C?null:C.major!=null&&v>=C.major?'major':C.moderate!=null&&v>=C.moderate?'moderate':v>=C.minor?'minor':'below minor';
  const out={known:true,spanD,base,level:lvl,lastT:last,cls:C,clsNow:cname(lvl)};
  if(!ev){if(spanD<21){out.known=false;out.kind='none';out.note=`gauge history only ${spanD.toFixed(0)} days — can’t rule out a flood 1–3 weeks ago`;}else out.kind='none';return out;}
  const big=bigLvl!=null?ev.pk>=bigLvl:ev.pk-base>=bigRise;
  /* the rise must be in the record; a record that simply starts high (e.g. a weir drawing down) is not an observed event */
  const pre=M.filter(x=>tms(x[0])<ev.pt&&tms(x[0])>=ev.pt-3*DAY).map(x=>x[1]),risen=pre.length&&Math.min(...pre)<=ev.pk-lightThr;
  if(!risen){const atStart=ev.s<=first+6*3600e3,bigStart=C?ev.pk>=C.minor:ev.pk-base>=bigRise;
    if(!(atStart&&bigStart)){out.kind='none';out.known=spanD>=21&&!atStart;if(!out.known)out.note=atStart?`gauge record (${spanD.toFixed(0)} days) starts ${(ev.pk-base).toFixed(2)} m above base and falls — an earlier rise isn’t in the record`:`gauge history only ${spanD.toFixed(0)} days — can’t rule out a flood 1–3 weeks ago`;return out;}}
  /* onset = start of the rise (first reading ≥ base + 25% of the rise before the peak) */
  let on=ev.s;for(const x of M){const t=tms(x[0]);if(t>ev.pt)break;if(t>=ev.s-3*DAY&&x[1]-base>=0.25*(ev.pk-base)){on=t;break;}}
  Object.assign(out,{kind:big?'big':'light',peak:ev.pk,peakT:ev.pt,onsetT:on,rise:ev.pk-base,peakCls:cname(ev.pk),rising:ev.pt>=last-3*3600e3&&lvl>=ev.pk-0.01,
    peakAtStart:ev.s<=first+6*3600e3});
  if(out.peakAtStart){out.note='the flood peak may be before the start of the gauge record — day count is a minimum';}
  return out;}
/* flood-cycle conditions term at time t (added on top of the weather factor) */
function floodAdj(F,t){if(!F||!(F.kind==='big'||F.kind==='light'))return null;const g=F.gauge||'fresh gauge';
  if(F.kind==='light'){const d=(t-F.onsetT)/DAY;if(d<0)return null;const a=d<3?lerp(d,0,3,0.12,0.22):d<=10?0.22:d<14?lerp(d,10,14,0.22,0):0;if(a<=0.005)return null;
    const n=Math.floor(d)+1;return{adj:a,phase:'runoff',day:n,chip:`🌊 Runoff day ${n} — ${d<10?'good':'tapering'}`,note:`Light flood / runoff day ${n} (${g} +${F.rise.toFixed(1)} m) — very good for jacks`};}
  const d=(t-F.peakT)/DAY,n=Math.max(0,Math.floor(d));let a,ph,lab;
  if(d<0){a=-0.08;ph='rising';lab='flood rising — dirty water';}
  else if(d<4){a=-0.1;ph='dirty';lab='dirty water / debris';}
  else if(d<7){a=lerp(d,4,7,-0.05,0.3);ph='clearing';lab='clearing — prime from day 7';}
  else if(d<=14){a=0.3;ph='prime';lab='prime';}
  else if(d<21){a=lerp(d,14,21,0.3,0);ph='tapering';lab='still good, tapering';}
  else return null;
  return{adj:a,phase:ph,day:n,chip:`🌊 Post-flood day ${n} — ${lab}`,note:`Post-flood day ${n}${F.peakAtStart?'+':''} (${g} peaked ${F.peak.toFixed(1)} m${F.peakCls&&F.peakCls!=='below minor'?', '+F.peakCls+' flood':''}) — ${ph==='prime'?'prime: 1–2 weeks after a flood fishes well for jacks even with the river running':ph==='tapering'?'post-flood bite tapering':ph==='clearing'?'water clearing, prime window from day 7':'dirty water & debris, modest penalty'}`};}
const freshAdj=floodAdj;
