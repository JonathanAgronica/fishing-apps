# ---------- Baffle live adjustments (src/adj/adj.js + data/baffle_adj.json from scripts/baffle_adj.py) ----------
# exec'd by build.py after the sides/lure patches (before ID namespacing). With no adjustment data (or opts.adj===null)
# predictAt output is byte-identical to the unadjusted model; generic systems use their own engine and are never touched.
ADJ_JS=open(f'{SRC}/adj/adj.js').read()
# core: add surge (+ fresh on main-channel highs) to every shifted extreme before stands/curve; time-varying single-high threshold
bt_core=patch(bt_core,"ext.sort((a,b)=>a.t-b.t);",
 "ext.sort((a,b)=>a.t-b.t);\n  const AJ=opts.adj!==undefined?opts.adj:(root.BT_ADJ||null),AJL=lineOf(km,opts);if(AJ)for(const e of ext){const d=AJ.dh(km,e.t,e.hi,AJL,cal.trunc);if(d){e.h+=d;e.adj=d;}}")
assert bt_core.count("const AJ=opts.adj")==1 and bt_core.index("const AJ=opts.adj")>bt_core.index("function predictAt(")
bt_core=patch(bt_core,"if(!e.hi||e.src.h+hoff>=thr)continue;","const thrE=thr+(AJ?AJ.sup(km,e.t,AJL):0);if(!e.hi||e.src.h+hoff>=thrE)continue;")
bt_core=patch(bt_core,"e.sup={H:e.src.h+hoff,thr}","e.sup={H:e.src.h+hoff,thr:thrE}")
# Tides: compact badge + flood warning in the spot notices; detail line in "Accuracy & method"; re-render when new data arrives
bt_ui=patch(bt_ui,"below the ${cal.supThr.toFixed(2)} m needed","below the ${sd[0].sup.thr.toFixed(2)} m needed")
bt_ui=patch(bt_ui,"$('locWarn').innerHTML=warn;",
 """if(!GEN&&window.FTADJ&&FTADJ.cur){const nh=B.nowH(),tq=nh>=t0&&nh<t0+24?nh:t0+12,AL=(!st.bline||st.bline==='B')?'B':'X';
    warn+=FTADJ.floodHtml();const bd=FTADJ.badge(tq,km,AL);if(bd)warn+=`<div class="adjrow">${bd}</div>`;
    const ai=document.getElementById('bt-adjInfo');if(ai){const I=FTADJ.info(tq,km,AL);ai.innerHTML=`⚖ <b>${esc(FTADJ.line(tq,km,AL))}</b> (${tq===nh?'now':B.fmtDay(tq)}). Coastal surge = Bundaberg observed − MSQ predicted, 25 h mean (gain 1, capped ±0.3 m), added to every reach incl. Euleilah and side creeks. Fresh = Mimdale ${I.mim!=null?I.mim.toFixed(2):'?'} m vs its dry baseline ${I.M0!=null?I.M0.toFixed(2):'?'} m (14-day 10th percentile, 3 h lag): highs + 0.5 × fresh × a weight rising from 0 at the Euleilah junction (16.4 km) to 1 at Essendean, single-high threshold +${I.sup.toFixed(2)} m here; lows unchanged. Both fade out ahead (surge gone after 48 h, fresh after 72 h), so later dates are pure harmonic predictions. Data ${esc(I.gen||'')}.`;}}
  else{const ai=document.getElementById('bt-adjInfo');if(ai)ai.textContent='';}
  $('locWarn').innerHTML=warn;""")
bt_ui=patch(bt_ui,"FT.baffleOpts=opts;","FT.baffleOpts=opts;if(!GEN&&window.FTADJ)FTADJ.onChange.push(()=>{render();FT.biteRefreshIfBaffle&&FT.biteRefreshIfBaffle();});")
bt_main=patch(bt_main,"<h2>🧪 How predictions are made</h2>","<h2>🧪 How predictions are made</h2>\n    <p class=\"mut\" id=\"adjInfo\" style=\"margin-top:0\"></p>")
mj_css+="\n.adjb{display:inline-block;font-size:.78rem;padding:2px 8px;border-radius:999px;background:#1d3a44;border:1px solid #2e6a7a;color:#cfeeff;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}\n.adjrow{margin:6px 0}\n"
bt_main=patch(bt_main,"Wind, pressure and swell can shift real levels by 0.1–0.3 m (use the live residual).","Wind, pressure and swell can shift real levels by 0.1–0.3 m — the live surge adjustment (top of this section) adds the measured Bundaberg residual for the next ~2 days; small Mimdale freshes raise the upper-creek highs (live fresh adjustment). Big floods are not modelled.")
