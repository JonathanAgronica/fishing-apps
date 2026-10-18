/* ===== Spots registry: built-in Baffle landmarks (+ personal aliases) and the user's own custom spots =====
   Custom spots/aliases live ONLY in this phone's localStorage (mbj_spots, mbj_alias). BT.LANDMARKS is updated
   in place (sorted by km) so every tab that lists landmarks also lists custom spots. Built-ins keep stable ids
   b0…bN (index in the shipped list) and their original name in .base; aliases only change .name. */
(function(){'use strict';
const FT=window.FT,B=window.BT,D=window.BAFFLE_DATA;
const KS='mbj_spots',KA='mbj_alias';
/* Multi-system: B.generic = a non-Baffle river system. Custom spots carry .sys (missing = 'baffle'); only this system's
   spots are shown, the rest are kept untouched in storage. Built-in ids: Baffle b0…bN (unchanged), others '<sys>~bN'. */
const GEN=!!B.generic,SYS=FT.SYS||'baffle';const AL=GEN?new RegExp('^'+SYS.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'~b\\d+$'):/^b\d+$/;
const LM=B.LANDMARKS;
LM.forEach((l,i)=>{l.id=(GEN?SYS+'~b':'b')+i;l.base=l.name;l.builtin=true;if(!GEN)l.line=l.line||(/Hills Rd gauge/.test(l.name)?'E':'B');});
const BUILTIN=LM.slice();
const load=(k,d)=>{try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v;}catch(e){return d;}};
let allCustom=load(KS,[]);/* after migrate() */if(!Array.isArray(allCustom))allCustom=[];
const mine=c=>(c.sys||'baffle')===SYS;let custom=allCustom.filter(mine);let alias=load(KA,{});if(!alias||typeof alias!=='object')alias={};
const COLORS=['#ffb020','#ff5d8f','#7bd88f','#5cc8ff','#b48cff','#ff7a45','#ffffff'];
/* Spot types (stage the spot fishes best on) — drive the pin colour/glyph and the spot's bite-score tide preference.
   .color is kept in sync (= type colour) for backward-compatible exports; general spots keep white. */
const TYPES={ri:{n:'Run-in',s:'RI',g:'↗',col:'#ffd21f'},tot:{n:'Top of tide',s:'TOT',g:'▲',col:'#3ddc84'},bot:{n:'Bottom of tide',s:'BOT',g:'▼',col:'#a46bff'},ro:{n:'Run-out',s:'RO',g:'↘',col:'#ff4fa3'}};
const GENCOL='#ffffff',KM='mbj_spot_mig';
const typeCol=t=>TYPES[t]?TYPES[t].col:null;
/* colour -> type (one-off migration of the old free colour picker): yellow/amber -> run-in, pink/magenta -> run-out, else general */
function typeFromColor(c){if(typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c))return '';c=c.toLowerCase();for(const k in TYPES)if(TYPES[k].col===c)return k;
  const r=parseInt(c.slice(1,3),16)/255,g=parseInt(c.slice(3,5),16)/255,b=parseInt(c.slice(5,7),16)/255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;if(d<0.25||mx<0.45)return '';
  let h=mx===r?((g-b)/d)%6:mx===g?(b-r)/d+2:(r-g)/d+4;h*=60;if(h<0)h+=360;
  if(h>=30&&h<=70)return 'ri';if(h>=285&&h<=352)return 'ro';return '';}
(function migrate(){let a;try{a=JSON.parse(localStorage.getItem(KS));}catch(e){a=null;}if(!Array.isArray(a))return;let ch=[];
  for(const c of a){if(!c||typeof c!=='object'||c.type!==undefined)continue;const t=typeFromColor(c.color);ch.push({name:String(c.name||'Spot').slice(0,60),sys:c.sys||'baffle',from:c.color||'',to:t});c.type=t;if(t)c.color=TYPES[t].col;}
  if(!ch.length)return;try{localStorage.setItem(KS,JSON.stringify(a));const old=JSON.parse(localStorage.getItem(KM)||'null');
    localStorage.setItem(KM,JSON.stringify({at:Date.now(),items:((old&&!old.seen&&old.items)||[]).concat(ch).slice(-200),seen:false}));}catch(e){}})();
/* re-read: the migration above rewrote the stored spots (types + synced colours) */
allCustom=load(KS,[]);if(!Array.isArray(allCustom))allCustom=[];custom=allCustom.filter(mine);
/* line-aware centreline geometry */
const RAD=Math.PI/180;const hav=(a,b)=>{const la1=a[0]*RAD,la2=b[0]*RAD,dl=(b[0]-a[0])*RAD,dn=(b[1]-a[1])*RAD;const x=Math.sin(dl/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dn/2)**2;return 2*6371.0088*Math.asin(Math.sqrt(x));};
const EU=D.euleilah,EUC=[0];for(let i=1;i<EU.length;i++)EUC.push(EUC[i-1]+hav(EU[i-1],EU[i]));
const EJ=D.euleilahJunctionKm;
function pointAt(km,line){if(GEN)return B.pointOnLine(km,line||'M');if(B.isSide&&B.isSide(line))return B.pointOnSide(km,line);if(line!=='E'||km<EJ)return B.pointAtKm(Math.max(0,Math.min(B.MAXKM,km)));const s=km-EJ;
  for(let i=1;i<EU.length;i++)if(EUC[i]>=s){const f=(s-EUC[i-1])/(EUC[i]-EUC[i-1]);return[EU[i-1][0]+f*(EU[i][0]-EU[i-1][0]),EU[i-1][1]+f*(EU[i][1]-EU[i-1][1])];}return EU[EU.length-1];}
const EUMAX=EJ+EUC[EUC.length-1];
function snapPt(lat,lng){if(GEN){const s=B.snap(lat,lng);return{km:+Math.max(0,Math.min(B.lineMax(s.lineId),s.km)).toFixed(2),line:s.lineId,offKm:s.offKm,slat:s.lat,slng:s.lon};}const s=B.snap(lat,lng);const line=s.lineId||(s.line==='Euleilah Creek'?'E':'B');return{km:+Math.min(B.lineMaxKm?B.lineMaxKm(line):B.MAXKM,Math.max(0,s.km)).toFixed(2),line,offKm:s.offKm,slat:s.lat,slng:s.lon};}
function apply(){BUILTIN.forEach(l=>{const a=alias[l.id];l.name=a||l.base;l.alias=!!a;});
  const C=custom.map(c=>Object.assign(c,{custom:true}));
  const all=BUILTIN.concat(C).sort((a,b)=>a.km-b.km||(a.builtin?-1:1));LM.length=0;LM.push(...all);}
function save(){try{allCustom=load(KS,[]);if(!Array.isArray(allCustom))allCustom=[];allCustom=allCustom.filter(c=>!mine(c)).concat(custom.map(({custom:_c,...c})=>GEN?Object.assign(c,{sys:SYS}):c));localStorage.setItem(KS,JSON.stringify(allCustom));localStorage.setItem(KA,JSON.stringify(alias));}catch(e){}apply();
  S.onChange.forEach(f=>{try{f()}catch(e){console.error('spots hook',e)}});}
const rid=()=>{const a=new Uint8Array(5);crypto.getRandomValues(a);return 'c'+Array.from(a,b=>b.toString(16).padStart(2,'0')).join('');};
const clean=s=>String(s==null?'':s).replace(/[\u0000-\u001f]/g,' ').trim();
const lineLabel=(id,short)=>{if(!GEN&&B.bLineName)return B.bLineName(id,short);if(!GEN)return id==='E'?(short?'Euleilah':'Euleilah Ck'):(short?'Baffle':'Baffle Ck');const n=B.lineName(id);return short?n.replace(/ (Creek|River|Passage)$/,''):n.replace(/ Creek$/,' Ck').replace(/ River$/,' R');};
/* channels of this system: [{id,name,short,min,max,main,est,parent,j}] (km from the mouth; side creeks: junction km + distance up) */
const channels=()=>GEN?B.LINES.map(L=>({id:L.id,name:lineLabel(L.id),short:lineLabel(L.id,true),min:L.id==='M'?0:L.j,max:B.lineMax(L.id),main:L.id==='M',est:false,parent:L.id==='M'?null:'M',j:L.id==='M'?0:L.j,...(L.id!=='M'&&!L.parent?{own:true}:{})}))
  :[{id:'B',name:'Baffle Ck',short:'Baffle',min:0,max:B.MAXKM,main:true,est:false,parent:null,j:0},{id:'E',name:'Euleilah Ck',short:'Euleilah',min:EJ,max:EUMAX,main:false,est:false,estFrom:B.EUCAL,parent:'B',j:EJ}]
    .concat((B.SIDES||[]).map(s=>({id:s.id,name:s.short,short:s.short.replace(/ Ck$/,''),min:s.jk,max:s.max,main:false,est:true,parent:s.parent,j:s.jk})));
/* "Mosquito Ck 2.0 km" style label for a km on a side creek (km from its junction); null on the main channel */
const alongLabel=(km,line)=>{if(GEN||!B.isSide||!B.isSide(line))return null;const s=B.sideOf(line);return s.short+' '+Math.max(0,km-s.jk).toFixed(1)+' km';};
const kmLabel=(km,line,d=2)=>{if(GEN&&B.TWO){const NM=B.TWONM,L=B.LINES.find(x=>x.id===(line||'M'));const PN=B.passNM&&B.passNM(line||'M');
    if(PN&&PN!==NM){const kb=B.kmBoth(km,line);return 'km '+(+km).toFixed(1)+' from '+PN.sName+' · '+(kb?kb.n:0).toFixed(1)+' from '+PN.nName;}
    if(NM.line==='M'||(L&&L.id===NM.line)){if(!L||L.id===NM.line)return 'km '+(+km).toFixed(1)+' from '+NM.sName+' · '+Math.max(0,B.TWO.L-km).toFixed(1)+' from '+NM.nName;return B.lineName(L.id)+' '+Math.max(0,km-L.j).toFixed(1)+' km up (est. tides)';}}const a=alongLabel(km,line);return a?a+' up (km '+(+km).toFixed(1)+' from mouth, est. tides)':'km '+(+km).toFixed(d)+' '+lineLabel(line)+(!GEN&&line==='E'&&B.EUCAL&&km>B.EUCAL+1e-6?' (est. tides)':'');};
const DEPTHS={s:{n:'1–3 m',s:'1-3',k:'shallow'},m:{n:'3–6 m',s:'3-6',k:'mid'},d:{n:'6 m+',s:'6+',k:'deep'}};
const S={DEPTHS,onChange:[],channels,alongLabel,kmLabel,COLORS,TYPES,GENCOL,typeCol,typeFromColor,pointAt,snap:snapPt,EUMAX,lineLabel,GEN,SYS,
  typeOf:l=>l&&TYPES[l.type]?l.type:'',
  migration:()=>{const m=load(KM,null);return m&&!m.seen&&Array.isArray(m.items)&&m.items.length?m:null;},
  migrationSeen:()=>{const m=load(KM,null);if(m){m.seen=true;try{localStorage.setItem(KM,JSON.stringify(m));}catch(e){}}S.onChange.forEach(f=>{try{f()}catch(e){}});},
  all:()=>LM.slice(),builtins:()=>BUILTIN.slice(),customs:()=>custom.slice(),
  get:id=>LM.find(l=>l.id===id)||null,
  /* lat/lng used for display & light/sun maths: custom = where the user tapped, built-in = centreline point */
  latLng:l=>l.custom?[l.lat,l.lng]:pointAt(l.km,l.line),
  add(o){const sn=snapPt(o.lat,o.lng);if(sn.offKm>(o.maxOff||1.2))throw new Error(`That point is ${sn.offKm.toFixed(1)} km from the creek centreline — tap closer to the creek.`);
    const c={id:rid(),name:clean(o.name).slice(0,60)||('My spot km '+sn.km.toFixed(1)),lat:+(+o.lat).toFixed(6),lng:+(+o.lng).toFixed(6),km:sn.km,line:sn.line,offKm:+sn.offKm.toFixed(3),...(GEN?{sys:SYS}:{}),
      type:TYPES[o.type]?o.type:'',depth:DEPTHS[o.depth]?o.depth:'',color:TYPES[o.type]?TYPES[o.type].col:(COLORS.includes(o.color)?o.color:GENCOL),note:clean(o.note).slice(0,200),created:Date.now()};
    custom.push(c);save();return S.get(c.id);},
  update(id,p){const c=custom.find(x=>x.id===id);if(!c)return null;
    if(p.depth!==undefined&&(p.depth===''||DEPTHS[p.depth]))c.depth=p.depth;if(p.name!=null)c.name=clean(p.name).slice(0,60)||c.name;if(p.note!=null)c.note=clean(p.note).slice(0,200);if(p.type!==undefined&&(p.type===''||TYPES[p.type])){c.type=p.type;c.color=p.type?TYPES[p.type].col:GENCOL;}else if(p.color&&COLORS.includes(p.color))c.color=p.color;
    if(p.lat!=null&&p.lng!=null){const sn=snapPt(p.lat,p.lng);if(sn.offKm>1.2)throw new Error(`${sn.offKm.toFixed(1)} km from the creek — not moved.`);c.lat=+(+p.lat).toFixed(6);c.lng=+(+p.lng).toFixed(6);c.km=sn.km;c.line=sn.line;c.offKm=+sn.offKm.toFixed(3);}
    save();return S.get(id);},
  remove(id){const n=custom.length;custom=custom.filter(x=>x.id!==id);if(custom.length!==n)save();},
  setAlias(id,name){if(!AL.test(id))return;name=clean(name).slice(0,60);const b=BUILTIN.find(l=>l.id===id);if(!b)return;
    if(!name||name===b.base)delete alias[id];else alias[id]=name;save();},
  nearest(km,line,maxKm){let best=null;for(const l of LM){if(GEN){if(line&&l.line&&!B.sameReach(km,line,l.km,l.line))continue;}else if(line&&l.line!==line&&((B.isSide&&(B.isSide(line)||B.isSide(l.line)))||Math.min(km,l.km)>=EJ))continue;const d=Math.abs(l.km-km);if(d<=(maxKm==null?0.5:maxKm)&&(!best||d<best.d||(d===best.d&&l.custom)))best={l,d};}return best?best.l:null;},
  exportData:()=>({v:1,kind:'mbj-spots',spots:(()=>{const a=load(KS,[]);return Array.isArray(a)?a:[];})(),alias:{...alias}}),
  importData(o,merge=true){if(!o||!Array.isArray(o.spots))throw new Error('not a spots backup');let n=0;const impMig=[];
    for(const x of o.spots){if(typeof x.lat!=='number'||typeof x.lng!=='number')continue;if(merge&&custom.some(c=>c.id===x.id))continue;
      if((x.sys||'baffle')!==SYS){/* another system's spot: keep it as-is for when that system is open */
        const a=load(KS,[]);if(Array.isArray(a)&&!a.some(c=>c.id===x.id)&&/^c[0-9a-f]{10}$/.test(x.id||'')){a.push(x);try{localStorage.setItem(KS,JSON.stringify(a));}catch(e){}n++;}continue;}
      try{const sn=snapPt(x.lat,x.lng);if(sn.offKm>1.2)continue;const ty=TYPES[x.type]?x.type:x.type===''?'':typeFromColor(x.color);if(x.type===undefined)impMig.push({name:clean(x.name).slice(0,60)||'Spot',sys:SYS,from:x.color||'',to:ty});custom.push({type:ty,depth:DEPTHS[x.depth]?x.depth:'',id:/^c[0-9a-f]{10}$/.test(x.id)?x.id:rid(),name:clean(x.name).slice(0,60)||'Spot',lat:x.lat,lng:x.lng,km:sn.km,line:sn.line,offKm:+sn.offKm.toFixed(3),...(GEN?{sys:SYS}:{}),color:ty?TYPES[ty].col:(COLORS.includes(x.color)?x.color:GENCOL),note:clean(x.note).slice(0,200),created:x.created||Date.now()});n++;}catch(e){}}
    if(impMig.length){try{const old=load(KM,null);localStorage.setItem(KM,JSON.stringify({at:Date.now(),items:((old&&!old.seen&&old.items)||[]).concat(impMig).slice(-200),seen:false}));}catch(e){}}
    if(o.alias&&typeof o.alias==='object')for(const [k,v] of Object.entries(o.alias))if(AL.test(k)&&BUILTIN.some(b=>b.id===k)&&typeof v==='string'&&clean(v))alias[k]=clean(v).slice(0,60);
    save();return n;}};
apply();
FT.spots=S;
})();
