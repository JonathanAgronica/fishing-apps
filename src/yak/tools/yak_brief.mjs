#!/usr/bin/env node
/* Mac's Yak morning brief for a server-side routine (no keys). Prints a plain-English message (or JSON with --json).
   Usage: node tools/yak_brief.mjs --spot burnett-heads|"lat,lng" [--exp open|mouth|estuary] [--facing 90] [--days tue,thu] [--when today|tomorrow|next] [--json]
   Settings default to the app's defaults; pass --set windGreen=8,windRed=12 to override. Spots passed on the command line are never written anywhere. */
import dns from 'node:dns';dns.setDefaultResultOrder('ipv4first');import fs from 'node:fs';import vm from 'node:vm';import path from 'node:path';import {fileURLToPath} from 'node:url';
const R=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const rd=p=>fs.readFileSync(path.join(R,p),'utf8');
const base=fs.existsSync(path.join(R,'src/core.js'))?'src/':'';
vm.runInThisContext(rd(base+'astro.js')+'\n;globalThis.PORTS='+rd('data/ports.json')+';globalThis.SYSTEMS='+rd('data/systems.json')+';\n'+rd(base+'core.js')+'\n;globalThis.__astro={sunAlt,tzParts,ymd,dayStart,addDays};');
const Y=globalThis.YAK,{ymd,addDays,tzParts}=globalThis.__astro,TZ=Y.TZ;
const A={};for(let i=2;i<process.argv.length;i++){const k=process.argv[i];if(k.startsWith('--')){const v=process.argv[i+1]&&!process.argv[i+1].startsWith('--')?process.argv[++i]:true;A[k.slice(2)]=v;}}
let spot=Y.LAUNCHES.find(l=>l.id===(A.spot||'burnett-heads'));
if(!spot&&/^-?\d/.test(A.spot||'')){const [lat,lng]=A.spot.split(',').map(Number);const s=Y.nearestSys(lat,lng);spot={id:'custom',name:A.name||'your launch',lat,lng,exp:A.exp||'estuary',facing:A.facing!=null?+A.facing:null,sys:s&&s.id};}
if(!spot)throw new Error('unknown spot');if(A.exp)spot.exp=A.exp;if(A.facing!=null)spot.facing=+A.facing;
const S=Object.assign({},Y.DEFAULTS);if(A.set)for(const kv of String(A.set).split(',')){const [k,v]=kv.split('=');S[k]=+v;}
const DOW=['sun','mon','tue','wed','thu','fri','sat'];const days=String(A.days||'mon,tue,wed,thu,fri,sat,sun').toLowerCase().split(',').map(s=>s.slice(0,3));
const today=ymd(Date.now(),TZ);const dow=d=>DOW[new Date(d+'T12:00:00Z').getUTCDay()];
let target;if(A.when==='today')target=today;else if(A.when==='tomorrow')target=addDays(today,1);else{for(let i=0;i<14;i++){const d=addDays(today,i);if(days.includes(dow(d))){target=d;break;}}}
const F=await Y.fetchForecast(spot,14);const day=Y.analyseDay(F,target,spot,S,null);
const fmtT=ms=>{const p=tzParts(ms,TZ);return (p.h%12||12)+':'+String(p.mi).padStart(2,'0')+(p.h<12?'am':'pm');};
const fd=new Date(day.d0+12*36e5).toLocaleDateString('en-AU',{timeZone:TZ,weekday:'long',day:'numeric',month:'short'});
const chosen=days.includes(dow(target));
let msg=`${Y.EMO[day.lvl]} ${fd} at ${spot.name}: ${Y.LV[day.lvl]}. `;
msg+=`Wind ${Math.round(day.wind[0])}–${Math.round(day.wind[1])} kn (gusts to ${Math.round(day.gust)})`+(day.wave!=null&&spot.exp!=='estuary'?`, waves up to ${day.wave.toFixed(1)} m`:'')+`, ${day.rainDay!=null?day.rainDay.toFixed(0)+' mm rain':''}, top ${Math.round(day.tmax)}°C, UV ${Math.round(day.uvmax)}. `;
if(day.win)msg+=`Best ${day.lvl===0?'green':'amber'} window ${fmtT(day.win.t0)}–${fmtT(day.win.t1+36e5)}. `;
if(day.fishWin)msg+=`Best fishing in it ${fmtT(day.fishWin.t0)}–${fmtT(day.fishWin.t1)} (bite ${Math.round(day.fishWin.avg)}/100). `;
if(day.turn&&day.turn.change)msg+=`${day.turn.change.kind} about ${fmtT(day.turn.change.t)} (${day.turn.change.from.join(' ')} kn → ${day.turn.change.to.join(' ')} kn)`+(day.turn.by?`, head back by ${fmtT(day.turn.by)}. `:'. ');
msg+='Tides: '+day.ext.map(x=>(x.hi?'high ':'low ')+fmtT(x.t)+' '+x.z.toFixed(1)+' m').join(', ')+'.';
if(day.lvl>0&&day.worst.length)msg+=' Watch: '+day.worst.map(w=>w[1]).join('; ')+'.';
if(A.json)console.log(JSON.stringify({date:target,chosenDay:chosen,level:Y.LV[day.lvl],message:msg,window:day.win&&[day.win.t0,day.win.t1+36e5],fishWindow:day.fishWin,turn:day.turn,spot:{name:spot.name,exp:spot.exp}},null,1));else console.log(msg);
