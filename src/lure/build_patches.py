# lure colour guide: core (global), Bite-closure hook, Bite card, chart touch
LURE_CORE=open(f'{SRC}/lure/core.js').read();LURE_CSS=open(f'{SRC}/lure/lure.css').read()
mj_ui=patch(mj_ui,"FT.biteRefreshIfBaffle=()=>{if(loc.baffleKm!=null)run();};\n","FT.biteRefreshIfBaffle=()=>{if(loc.baffleKm!=null)run();};\n"+open(f'{SRC}/lure/hook.js').read()+"\n")
mj_ui=patch(mj_ui,"drawChart(d);try{renderMySpots();}catch(e){console.error('myspots',e);}","drawChart(d);try{renderMySpots();}catch(e){console.error('myspots',e);}try{renderLure();}catch(e){console.error('lure',e);}")
mj_ui=patch(mj_ui,"tip.style.display='block';","tip.style.display='block';try{renderLure(p);}catch(e){}")
mj_main=patch(mj_main,'<div id="windows"><span class="spin"></span> Loading…</div>','<div id="windows"><span class="spin"></span> Loading…</div>\n    <div id="lure"></div>')
# ---- spot depth class: tide-range adjustment (±8%) + reason
mj_core=patch(mj_core,"stepMin=15,weekRange,runIn,spotType,fresh}=opts;","stepMin=15,weekRange,runIn,spotType,fresh,spotDepth}=opts;")
mj_core=patch(mj_core,"  const pts=[];\n  for(let t=t0;t<t1;t+=stepMin*60e3){\n    const wx=wxFn",
"""  /* depth class: shallow (1–3 m) likes big/spring tides, deep (6 m+) likes neaps; 3–6 m neutral. ±8% max, scaled by today's range vs the period's biggest */
  const DEP=(()=>{if(!(spotDepth==='s'||spotDepth==='d')||range==null||!weekRange||!weekRange.max)return null;const dev=Math.max(-1,Math.min(1,(range/weekRange.max-0.75)/0.25));
    const adj=(spotDepth==='s'?1:-1)*0.08*dev;if(Math.abs(adj)<0.005)return null;
    return{adj,depth:spotDepth,label:`${spotDepth==='s'?'Shallow (1–3 m)':'Deep (6 m+)'} spot on a ${dev>0?'big / spring':'small / neap'} tide ${adj>0?'+':'−'}${Math.round(Math.abs(adj)*100)}%`};})();
  const pts=[];
  for(let t=t0;t<t1;t+=stepMin*60e3){
    const wx=wxFn""")
mj_core=patch(mj_core,"    let score=clamp((raw*mult-0.25)/0.70)*100;\n","    let score=clamp((raw*mult-0.25)/0.70)*100;if(T&&DEP)score=Math.max(0,Math.min(100,score*(1+DEP.adj)));\n")
mj_core=patch(mj_core,"pts.push({t,score:Math.round(score),L,T,","pts.push({t,score:Math.round(score),DEP:T?DEP:null,L,T,")
mj_core=patch(mj_core,"return{dateStr,t0,t1,ev,illum,","return{dep:DEP,dateStr,t0,t1,ev,illum,")
mj_ui=patch(mj_ui,"  if(p.S.v>0.3)r.push(p.S.label+' '+fmtT(p.S.ev.t,tz));","  if(p.DEP)r.push(p.DEP.label);\n  if(p.S.v>0.3)r.push(p.S.label+' '+fmtT(p.S.ev.t,tz));")
mj_ui=patch(mj_ui,"const SPT=curSpotType(BZ);","const SPT=curSpotType(BZ);const SPD=curSpotDepth(BZ);")
mj_ui=patch(mj_ui,"spotType:SPT,fresh})","spotType:SPT,fresh,spotDepth:SPD})")
mj_ui=patch(mj_ui,"hasTide:!!tideFn,spotType:SPT,","hasTide:!!tideFn,spotType:SPT,spotDepth:SPD,")

# Bite tab: same red→dark-green score ramp as the map/calendar
mj_ui=patch(mj_ui,"function scoreColor(s){const h=s<50?lerp(s,0,50,210,45):lerp(s,50,100,45,135);const l=s<20?40:52;return `hsl(${h},75%,${l}%)`;}","function scoreColor(s){return window.FTRamp?FTRamp(s):'#888';}")
mj_ui=patch(mj_ui,"""<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff6b3d" stop-opacity=".75"/><stop offset="1" stop-color="#f0a03a" stop-opacity=".08"/></linearGradient>""",
"""<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${y(100)}" y2="${y(0)}">${(()=>{const B=window.FTRamp?FTRamp.bands:[[0,'#f0a03a']];let s='';for(let i=B.length-1;i>=0;i--){const hi=i===B.length-1?100:B[i+1][0],lo=B[i][0];s+=`<stop offset="${(100-hi)/100}" stop-color="${B[i][1]}" stop-opacity=".8"/><stop offset="${(100-lo)/100}" stop-color="${B[i][1]}" stop-opacity=".8"/>`;}return s;})()}</linearGradient><linearGradient id="gl" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${y(100)}" y2="${y(0)}">${(()=>{const B=window.FTRamp?FTRamp.bands:[[0,'#f0a03a']];let s='';for(let i=B.length-1;i>=0;i--){const hi=i===B.length-1?100:B[i+1][0],lo=B[i][0];s+=`<stop offset="${(100-hi)/100}" stop-color="${B[i][1]}"/><stop offset="${(100-lo)/100}" stop-color="${B[i][1]}"/>`;}return s;})()}</linearGradient>""")
mj_ui=patch(mj_ui,"""fill="none" stroke="#f0a03a" stroke-width="2.5"/>`;""","""fill="none" stroke="url(#gl)" stroke-width="2.5"/>`;""")
