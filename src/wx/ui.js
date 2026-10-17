/* ---- weather v2 (Bite closure): fresh-flow gauge for this system, storm/drizzle day badges ---- */
let _fresh={k:null,at:0,v:null};
/* flood-cycle state from this system's fresh-flow gauge record (Baffle: Mimdale 539132 archive + 7-day table; other systems:
   their BoM upstream gauge from data/sysg/arch — every archived month) + BoM flood classes (data/sysg/flood_class.json) */
async function getFresh(){const k=FT.SYS||'baffle';if(_fresh.k===k&&Date.now()-_fresh.at<30*60e3)return _fresh.v;let v=null;
  const txt=async u=>{try{const r=await fetch(u+(u.includes('?')?'&':'?')+'t='+Date.now(),{cache:'no-store'});return r.ok?await r.text():null;}catch(e){return null;}};
  const js=async u=>{const t=await txt(u);try{return t?JSON.parse(t):null;}catch(e){return null;}};
  try{const MP=new Map();let id,name;
    if(!GENB){id='539132';name='Mimdale';const j=await js('data/gauges.json');for(const x of (j&&j.series&&j.series.mimdale)||[])MP.set(x[0],x[1]);
      const c=await txt('data/539132_mimdale.csv');if(c)for(const l of c.split('\n').slice(1)){const m=/^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d),(-?[\d.]+)/.exec(l);if(m)MP.set(Math.round((Date.UTC(+m[1],m[2]-1,+m[3],+m[4],+m[5])-36e6-E0)/60e3),+m[6]);}}
    else{const F=BT.SYS&&BT.SYS.fresh;if(F){id=F.id;name=String(F.name).replace(/^.* at /,'').replace(/\s*\(.*\)\s*$/,'');const ix=await js('data/sysg/index.json');
      for(const m of ((ix&&ix.st||{})[F.id]||{}).months||[]){const c=await txt(`data/sysg/arch/${F.id}/${m}.csv`);if(c)for(const l of c.split('\n')){if(!l||l[0]==='#')continue;const p=l.split(',');if(p[1]!==''&&isFinite(+p[0])&&isFinite(+p[1]))MP.set(+p[0],+p[1]);}}}}
    if(id){const fc=await js('data/sysg/flood_class.json');const M=[...MP.entries()].sort((a,b)=>a[0]-b[0]);
      v=MJ.floodState(M,fc&&fc.stations&&fc.stations[id]||null);v.gauge=name;v.id=id;}}
  catch(e){console.error('flood',e);v=null;}
  _fresh={k,at:Date.now(),v};return v;}
function wxDayTxt(d,short){const s=d.wxDay;if(!s)return '';const tz=state.tz,o=[];
  if(s.lightning.length)o.push(`⚠ thunder ${fmtT(s.lightning[0],tz)}`);
  if(s.storm&&s.storm.v>=0.3)o.push(`⛈️ ${s.storm.v>=0.5?'storm building':'storm potential'} ~${fmtT(s.storm.t,tz)}${!short&&s.storm.cape!=null&&s.storm.cape>=100?' (CAPE '+Math.round(s.storm.cape/50)*50+')':''}`);
  if(s.drizzleH>=0.5)o.push(`🌦️ drizzle ${s.drizzleH>=1?Math.round(s.drizzleH)+' h':'<1 h'}${!short&&s.drizzleFirst?' from '+fmtT(s.drizzleFirst,tz):''}`);
  if(!short&&s.heavyH)o.push(`🌧️ very heavy rain ${s.heavyH} h`);
  if(s.fresh)o.push(short?esc(s.fresh.chip):`<b>${esc(s.fresh.chip)}</b>`);
  if(!short&&!s.fresh&&state.fresh&&state.fresh.kind==='none')o.push(state.fresh.known?'🌊 no recent flood':'🌊 no flood seen ('+esc(state.fresh.note.replace(/ — .*/,''))+')');
  return o.join(short?' · ':'<br>');}
/* Gauges tab: flood-cycle read-out for this system (shared with the bite score) */
const fDate=t=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',weekday:'short',day:'numeric',month:'short'}).format(new Date(t));
FT.floodInfo=async()=>{const F=await getFresh();if(!F)return '';const now=Date.now(),a=MJ.floodAdj(F,now),g=esc(F.gauge||'fresh gauge');let cls='info',h;
  const C=F.cls?` BoM flood classes: minor ${F.cls.minor} m, moderate ${F.cls.moderate} m, major ${F.cls.major} m.`:' (no BoM flood classes for this gauge — thresholds relative to its base level.)';
  if(F.kind==='nodata'||F.kind==='stale')h=`no recent readings from ${g} — flood cycle unknown.`;
  else if(F.kind==='none')h=F.known?`no flood or runoff in the last ${Math.round(F.spanD)} days of record (base ≈ ${F.base.toFixed(2)} m, now ${F.level.toFixed(2)} m) — normal conditions, no flood-cycle effect.`
    :`no flood or runoff in the record — but ${esc(F.note)}. Now ${F.level.toFixed(2)} m (base ≈ ${F.base.toFixed(2)} m).`;
  else{const ev=F.kind==='big'?`<b>flood</b> peaked ${F.peak.toFixed(2)} m${F.peakCls&&F.peakCls!=='below minor'?' ('+F.peakCls+')':''} on ${fDate(F.peakT)}`:`<b>light flood / runoff</b> from ${fDate(F.onsetT)} (+${F.rise.toFixed(2)} m, peak ${F.peak.toFixed(2)} m ${fDate(F.peakT)})`;
    if(a){h=`${ev}. <b>${esc(a.chip.replace(/^🌊 /,''))}</b>.`;
      if(a.phase==='prime'){cls='ok';h='⭐ <b>PRIME POST-FLOOD WINDOW</b> — '+h;}else if(a.phase==='clearing'){h+=` Prime window from ${fDate(F.peakT+7*864e5)} to ${fDate(F.peakT+14*864e5)}.`;}
      else if(a.phase==='dirty'||a.phase==='rising'){cls='';h+=` Expect the prime window ${fDate(F.peakT+7*864e5)} – ${fDate(F.peakT+14*864e5)}.`;}
      else if(F.kind==='light')cls='ok';}
    else h=`${ev}. Flood cycle over — back to normal conditions.`;
    if(F.peakAtStart)h+=` <i>${esc(F.note)}.</i>`;}
  return `<div class="notice ${cls}">🌊 <b>Flood cycle (${g}):</b> ${h}${C} <span class="mut">Bite score: light floods/runoff are good from the onset for ~10–14 days; after a big flood ~3–5 days of dirty water (small penalty), then prime ~day 7–14 even with the river running, tapering by ~day 21.</span></div>`;};
/* Calendar tab: shared flood-cycle state */
FT.getFresh=getFresh;
