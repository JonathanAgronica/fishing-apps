/* ---- spot types in Bite times (injected into the Bite closure) ---- */
const STYC=t=>FT.spots&&FT.spots.TYPES[t]?FT.spots.TYPES[t]:null;
function stTag(t){const T=STYC(t);return T?`<span class="sttag" style="background:${T.col}">${T.s}</span>`:'';}
/* type of the selected bite location: the custom spot picked (loc.spotId), else a custom spot at exactly this creek point */
function curSpotType(BZ){if(BZ==null||!FT.spots||!MJ.STYPES)return null;if((loc.sys||'baffle')!==(FT.SYS||'baffle'))return null;
  let l=loc.spotId?FT.spots.get(loc.spotId):null;
  if(l&&!(Math.abs(l.km-BZ)<0.02&&(!GENB||(l.line||'M')===(loc.baffleLine||'M'))))l=null;
  if(!l)l=FT.spots.customs().find(c=>Math.abs(c.km-BZ)<0.011&&(!GENB||(c.line||'M')===(loc.baffleLine||'M'))&&(loc.name||'').indexOf(c.name)===0)||null;
  return l&&MJ.STYPES[l.type]?l.type:null;}
function curSpotDepth(BZ){if(BZ==null||!FT.spots)return null;if((loc.sys||'baffle')!==(FT.SYS||'baffle'))return null;const l=loc.spotId?FT.spots.get(loc.spotId):null;return l&&l.custom&&Math.abs(l.km-BZ)<0.02&&(l.depth==='s'||l.depth==='d'||l.depth==='m')?l.depth:null;}
function spotTypeNote(t){const T=STYC(t);if(!T)return '';
  const what={ri:'from the run-in start through mid run-in (peak ~30–120 min after the turn)',tot:'about 1 h either side of the high — slack and the first of the run-out',bot:'about 1 h either side of the low / resting low — the last of the run-out and the first push',ro:'through the run-out, best mid-to-last'}[t];
  return `<div class="src">${stTag(t)} <b>Your ${esc(T.n.toLowerCase())} spot</b> — tide score = 65% this spot’s preferred stage (${what}, from this spot’s own predicted tide, widened by its ± timing) + 35% the general tide curve. Change the type on the 🗺️ Map tab.</div>`;}
/* "My spots today": the user's typed spots in this system ranked by their best window on the selected day */
let msCache={};
function renderMySpots(){const el=$('mySpots');if(!el||!state||!state.days||!window.BT)return;const d=state.days[state.sel];if(!d)return;
  const L=(FT.spots?FT.spots.customs():[]).filter(c=>MJ.STYPES[c.type]);
  const M0=FT.spots&&FT.spots.migration&&FT.spots.migration();const mig=M0?M0.items.filter(x=>(x.sys||'baffle')===(FT.SYS||'baffle')):null;
  const migH=mig&&mig.length?`<div class="notice">🎨 Your spot colours were turned into <b>spot types</b>: ${mig.slice(0,12).map(m=>`${esc(m.name)} → <b>${m.to?esc(FT.spots.TYPES[m.to].n):'General'}</b>`).join(', ')}${mig.length>12?' …':''}. Wrong? Fix it on the 🗺️ Map tab (✏️ Edit → Spot type). <button class="sm" id="msMigOk">Got it</button></div>`:'';
  if(!L.length){el.innerHTML=migH+`<p class="mut" style="margin:0">Give your own spots a <b>type</b> on the 🗺️ Map tab (✏️ Edit → Spot type: ${['ri','tot','bot','ro'].map(stTag).join(' ')} Run-in, Top of tide, Bottom of tide, Run-out) and they’re ranked here by their best window for the selected day.</p>`;}
  else{const key=d.dateStr+'|'+state.runId+'|'+L.map(c=>c.id+c.type+(c.depth||'')+c.km+(c.line||'')).join(',');
    let R=msCache[key];
    if(!R){R=L.map(c=>{try{const r=baffleTide(d.dateStr,c.km,c.line);let mx=0;for(let i=1;i<r.ext.length;i++)mx=Math.max(mx,Math.abs(r.ext[i].h-r.ext[i-1].h));
        const dd=MJ.computeDay({dateStr:d.dateStr,tz:state.tz,lat:c.lat,lng:c.lng,tideFn:r.fn,ext:r.ext,wxFn:state.wxFn,sstFn:state.sstFn,fresh:state.fresh,weekRange:r.ext.length>1?{max:mx}:null,runIn:r.runIn,spotType:c.type,spotDepth:c.depth||null});
        const W=dd.windows.slice().sort((a,b)=>b.score-a.score);const dS=Date.UTC(+d.dateStr.slice(0,4),+d.dateStr.slice(5,7)-1,+d.dateStr.slice(8,10))-10*3600e3;return{c,w:W[0]||null,more:W.slice(1,3),rating:dd.rating,stand:(r.stands||[]).find(x=>x.t>=dS&&x.t<dS+864e5)||null};}catch(e){console.error('myspots',e);return{c,w:null,more:[],rating:0};}})
        .sort((a,b)=>(b.w?b.w.score:-1)-(a.w?a.w.score:-1)||b.rating-a.rating);msCache={[key]:R};}
    const tz=state.tz;
    el.innerHTML=migH+`<div class="mys">${R.map((x,i)=>{const w=x.w,T=w&&w.peak.T;const sel=loc.spotId===x.c.id;
      return `<div class="myrow${sel?' on':''}" data-id="${esc(x.c.id)}"><div class="myrk">${i+1}</div><div class="mysc rbadge" style="${w?`background:${FTRamp(w.score)};color:${FTRamp.ink(w.score)}`:'color:#9db5b1'}">${w?w.score:'—'}</div><div class="myb"><div>${stTag(x.c.type)} <b>${esc(x.c.name)}</b> <small class="mut">km ${(+x.c.km).toFixed(1)}</small></div>`+
        `<div class="mut">${w?`<b style="color:#e8f1ef">${fmtT(w.start,tz)} – ${fmtT(w.end,tz)}</b> · ${esc(T&&T.stageL?T.stageL:T?T.label:'')}${x.stand?` · <span title="single-high day: the small high doesn’t reach this spot">🌗 stand ${fmtT(x.stand.t0,tz)}–${fmtT(x.stand.t1,tz)} (no rise)</span>`:''}${x.more.length?` · also ${x.more.map(m=>fmtT(m.start,tz)+' ('+m.score+')').join(', ')}`:''}`:'no good window'}</div>${w&&FT.lureHtml?FT.lureHtml({depth:x.c.depth,km:x.c.km,line:x.c.line||null,lat:x.c.lat,lng:x.c.lng},w.peak.t):''}${FT.cross&&w?FT.cross.reachNote(x.c,w.start,w.end):''}</div><button class="sm">🎣</button></div>`;}).join('')}</div><p class="mut" style="margin:6px 0 0;font-size:.78rem">Each spot scored on its own predicted tide and type for ${esc(d.dateStr)}; same weather &amp; water temp. Tap a spot to open its full bite times.</p>`;
    el.querySelectorAll('.myrow').forEach(r=>r.onclick=()=>{const c=FT.spots.get(r.dataset.id);if(!c)return;
      setLoc(Object.assign({name:c.name+SFX,lat:c.lat,lng:c.lng,tz:'Australia/Brisbane',baffleKm:c.km,spotId:c.id},GENB?{baffleLine:c.line||'M',sys:FT.SYS}:c.line?{baffleLine:c.line}:{}));});}
  if($('msMigOk'))$('msMigOk').onclick=()=>FT.spots.migrationSeen();}
/* spot edited (type / position) → re-score if it is the selected location; refresh the ranking */
if(FT.spots)FT.spots.onChange.push(()=>{msCache={};try{const BZ=(loc.baffleKm!=null&&window.BT)?loc.baffleKm:null;
  if(state&&state.days&&((curSpotType(BZ)||null)!==(state.spotType||null)||(curSpotDepth(BZ)||null)!==(state.spotDepth||null)))run();else renderMySpots();}catch(e){console.error(e);}});
