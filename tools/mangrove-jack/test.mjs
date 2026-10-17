import fs from 'fs'; import vm from 'vm';
const html=fs.readFileSync('index.html','utf8');
const core=/<script id="core">([\s\S]*?)<\/script>/.exec(html)[1];
vm.runInThisContext(core); const MJ=globalThis.MJ;
const tz='Australia/Brisbane',lat=-24.76,lng=152.40,ds='2026-10-09';
const s=MJ.addDays(ds,-1),e=MJ.addDays(ds,7);
const m=await (await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lng}&hourly=sea_level_height_msl,sea_surface_temperature&timezone=auto&start_date=${s}&end_date=${e}&cell_selection=sea`)).json();
const f=await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=pressure_msl,wind_speed_10m,cloud_cover,precipitation,relative_humidity_2m,temperature_2m,weather_code&timezone=auto&start_date=${s}&end_date=${e}`)).json();
const tt=m.hourly.time.map(x=>MJ.parseLocalIso(x,tz));const tideFn=MJ.makeSeries(tt,m.hourly.sea_level_height_msl);
const ext=MJ.tideExtremes(tideFn,tt[0],tt[tt.length-1]);const sstFn=MJ.makeSeries(tt,m.hourly.sea_surface_temperature);
const ft=f.hourly.time.map(x=>MJ.parseLocalIso(x,tz));const S=k=>MJ.makeSeries(ft,f.hourly[k]);const P=S('pressure_msl');
const wxFn=t=>({p:P(t),dp3:P(t)-P(t-3*3600e3),wind:S('wind_speed_10m')(t),cloud:S('cloud_cover')(t),rain:S('precipitation')(t),rh:S('relative_humidity_2m')(t),temp:S('temperature_2m')(t),code:null});
const fmt=t=>new Date(t).toLocaleString('en-AU',{timeZone:tz,weekday:'short',hour:'numeric',minute:'2-digit'});
let mx=0;for(let i=1;i<ext.length;i++)mx=Math.max(mx,Math.abs(ext[i].h-ext[i-1].h));
for(let i=0;i<7;i++){const d=MJ.computeDay({dateStr:MJ.addDays(ds,i),tz,lat,lng,tideFn,ext,wxFn,sstFn,weekRange:{max:mx}});
 if(i===0){const inD=x=>x.t>=d.t0&&x.t<d.t1;
  console.log('sun',d.ev.sunRiseSet.filter(inD).map(x=>(x.rising?'rise ':'set ')+fmt(x.t)));
  console.log('civil',d.ev.civil.filter(inD).map(x=>fmt(x.t)));
  console.log('moon',d.ev.moonRiseSet.filter(inD).map(x=>(x.rising?'rise ':'set ')+fmt(x.t)),d.ev.transits.filter(inD).map(x=>(x.over?'over ':'under ')+fmt(x.t)));
  console.log('illum',d.illum,MJ.phaseName(d.illum.phase));
  console.log('tides',d.dayExt.map(x=>(x.high?'H ':'L ')+fmt(x.t)+' '+x.h.toFixed(2)));
  console.log('hourly',d.hourly.map(h=>h.score).join(' '));
  for(const w of d.windows)console.log('WIN',fmt(w.start),'-',fmt(w.end),w.score,w.peak.L.label,'|',w.peak.T&&w.peak.T.label,'|',w.peak.S.label,'|',w.peak.TF.label,'|',w.peak.WX.notes.join(','));
 }
 console.log(d.dateStr,'rating',d.rating,'range',d.range&&d.range.toFixed(2));}
