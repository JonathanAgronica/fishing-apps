/* --- spot types: a spot's preferred tide stage (Run-in / Top of tide / Bottom of tide / Run-out) ---
   When the bite location is a typed spot, the tide sub-score = 65% that spot's stage preference (from ITS OWN predicted
   tide, blurred by its ± timing) + 35% the general tide curve, so light / solunar / weather still matter. */
const STYPES={ri:{n:'Run-in',s:'RI'},tot:{n:'Top of tide',s:'TOT'},bot:{n:'Bottom of tide',s:'BOT'},ro:{n:'Run-out',s:'RO'}};
const SP_W=0.65,SP_LO=0.2,HR=3600e3;
function spTrap(x,a0,a1,b1,b0){if(x<=a0||x>=b0)return SP_LO;if(x<a1)return SP_LO+(1-SP_LO)*(x-a0)/(a1-a0);if(x<=b1)return 1;return SP_LO+(1-SP_LO)*(b0-x)/(b0-b1);}
function spNearest(ext,t,high){let b=null,bd=Infinity;for(const x of ext){if(x.high!==high)continue;const d=Math.abs(x.t-t);if(d<bd){bd=d;b=x;}}return b;}
function spBracket(ext,t){let prev=null,next=null;for(const x of ext){if(x.t<=t)prev=x;else{next=x;break;}}return[prev,next];}
function stagePrefRaw(type,t,ext,runIn){
  if(type==='ri'){let v=SP_LO;for(const r of runIn||[]){const x=(t-r.t)/HR;if(x<-2||x>7)continue;v=Math.max(v,SP_LO+(1-SP_LO)*clamp((runInKernel(x)-0.45)/0.55));}return v;}
  if(type==='tot'){const h=spNearest(ext,t,true);return h?spTrap((t-h.t)/HR,-2.25,-1,1.25,2.75):SP_LO;}
  if(type==='bot'){const l=spNearest(ext,t,false);let v=l?spTrap((t-l.t)/HR,-2.25,-1,1,2.25):SP_LO;
    for(const r of runIn||[])if(r.kind==='rise')v=Math.max(v,spTrap((t-r.t)/HR,-2.5,-1.25,0.75,1.75));return v;}
  if(type==='ro'){const [p,n]=spBracket(ext,t);if(!p||!n)return SP_LO;
    if(p.high&&!n.high){const f=(t-p.t)/(n.t-p.t);return f<0.35?lerp(f,0,0.35,0.45,1):1;}
    if(!p.high&&n.high){const h=(t-p.t)/HR;return h<1.25?lerp(h,0,1.25,0.9,SP_LO):SP_LO;}
    return SP_LO;}
  return 0.5;}
function spU(t,ext){let u=30,bd=Infinity;for(const x of ext){const d=Math.abs(x.t-t);if(d<bd){bd=d;if(x.u!=null)u=x.u;}}return u;}
/* blurred by the spot's own timing uncertainty, like the run-in kernel */
function stagePref(type,t,ext,runIn){const uh=Math.max(0.2,spU(t,ext)/60);let s=0,n=0;for(let k=-6;k<=6;k++){const w=1-Math.abs(k)/7;s+=w*stagePrefRaw(type,t+uh*k/6*HR,ext,runIn);n+=w;}return s/n;}
/* plain-language stage at time t (and a short code for the catch log) */
function stageAt(t,ext,runIn){const [p,n]=spBracket(ext,t);if(!p||!n)return{c:'',l:''};const ha=(t-p.t)/HR,hb=(n.t-t)/HR;
  if(p.high===n.high)return p.high?{c:'tot',l:'slack high'}:{c:'bot',l:'resting low (pool level)'};
  if(!p.high){let ri=null;for(const r of runIn||[]){const x=(t-r.t)/HR;if(x>=-0.25&&x<=2&&(ri==null||x<ri))ri=x;}
    if(ri!=null)return{c:'ri',l:ri<0.5?'run-in start':'first of the run-in'};
    if(ha<0.75)return{c:'bot',l:'bottom of the tide (first push)'};
    if(hb<1)return{c:'tot',l:'top of the run-in'};return{c:'flood',l:'mid run-in'};}
  if(ha<0.75)return{c:'tot',l:'top of the tide (high turn)'};if(hb<0.75)return{c:'bot',l:'bottom of the tide (last of the run-out)'};
  if(ha<1.75)return{c:'ro',l:'first of the run-out'};if(hb<1.75)return{c:'ro',l:'last of the run-out'};return{c:'ro',l:'mid run-out'};}
function spotTide(T,t,ext,runIn,type){const N=STYPES[type];if(!N||!T)return T;const p=stagePref(type,t,ext,runIn),st=stageAt(t,ext,runIn);
  const v=SP_W*p+(1-SP_W)*T.v;
  if(type==='ri'&&st.c==='bot'){const nx=(runIn||[]).find(r=>r.t>t&&r.t-t<1.5*HR);if(nx)st.l='bottom of the tide — run-in starts soon';}
  const label=p>=0.6?`Your ${N.n.toLowerCase()} spot: ${st.l||T.label.toLowerCase()}`:`${T.label} — off-peak for your ${N.s} spot`;
  return Object.assign({},T,{v,label,gen:T.v,pref:p,stype:type,stage:st.c,stageL:st.l,ri:type==='ri'?T.ri:T.ri*0.3,riRef:type==='ri'?T.riRef:null});}
