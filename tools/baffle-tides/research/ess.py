import numpy as np, json, datetime as dt
from fit import EPOCH
def th(s): return (dt.datetime.strptime(s,'%d/%m/%Y %H:%M')-EPOCH).total_seconds()/3600
def fmt(t): return (EPOCH+dt.timedelta(hours=float(t))).strftime('%a %d %H:%M')
def loadstep(fn):
    R=[]
    for l in open(fn):
        p=l.split()
        if len(p)==3: R.append((th(p[0]+' '+p[1]),float(p[2])))
    R.sort();return R
def events(R):
    """Return peaks and troughs of a step (event-reported) series.
    For each run of equal values that is a local max/min: start=first time at value, end=time of first different value."""
    # collapse to runs
    runs=[]
    for t,v in R:
        if runs and abs(runs[-1][2]-v)<1e-6: runs[-1][1]=t
        else: runs.append([t,t,v])
    out=[]
    for i in range(1,len(runs)-1):
        a,b,c=runs[i-1][2],runs[i][2],runs[i+1][2]
        if b>a and b>c: kind='HW'
        elif b<a and b<c: kind='LW'
        else: continue
        s=runs[i][0];e=runs[i+1][0]  # value left at time of next run start
        # onset of rise before a peak: start of the run after the preceding trough
        out.append(dict(kind=kind,start=s,end=e,mid=(s+e)/2,val=b,prev=runs[i-1]))
    return out,runs
W=json.load(open('bund_week.json'));B=[(t,h,hi) for t,h,hi in W['obs']]
res={}
for name,fn in (('Essendean','ess_bom_20261009.txt'),('HillsRd','bom_539135_20261009.txt')):
    R=loadstep(fn);E,runs=events(R);rows=[]
    print('==',name,'n readings',len(R))
    for e in E:
        # match to most recent Bundaberg extreme of same kind before e.mid within 0..8h
        cands=[b for b in B if b[2]==(e['kind']=='HW') and 0<e['mid']-b[0]<8]
        if not cands: continue
        b=max(cands,key=lambda b:b[0])
        lag_mid=(e['mid']-b[0]);lag_start=e['start']-b[0];lag_end=e['end']-b[0]
        # rise amplitude: peak minus the preceding trough level
        prevtr=[x for x in E if x['kind']!=e['kind'] and x['mid']<e['mid']]
        amp=(e['val']-prevtr[-1]['val']) if prevtr else None
        rows.append(dict(kind=e['kind'],bund_t=b[0],bund_h=b[1],start=e['start'],end=e['end'],mid=e['mid'],val=e['val'],lag_mid_h=lag_mid,lag_start_h=lag_start,lag_end_h=lag_end,amp=amp))
        print(f"{e['kind']} gauge {fmt(e['start'])}-{fmt(e['end'])} mid {fmt(e['mid'])} {e['val']:.2f}  Bund {fmt(b[0])} {b[1]:.2f}  lag mid {lag_mid*60:.0f} min (plateau {lag_start*60:.0f}..{lag_end*60:.0f})  amp {amp if amp is None else round(amp,2)}")
    res[name]=rows
json.dump(res,open('gauge_events.json','w'),indent=1)
