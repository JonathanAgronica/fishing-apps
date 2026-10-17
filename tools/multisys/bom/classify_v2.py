"""Classify every BoM water-level station (old tbl + fresh tbl2 merged, ~14 days):
tidal / partial (truncated lows or damped) / none / nodata.
Metrics: harmonic LSQ (M2,S2,N2,K1,O1,M4,MS4 on 25h-detrended 10-min grid), tidal range,
max lagged correlation (0-12h) vs harmonic predictions of the reference ports, floor fraction."""
import re,json,glob,os,sys,datetime as dt,numpy as np
sys.path.insert(0,'/workspace/baffle-tides/research')
from fit2 import predict
HP=json.load(open('../ports/harm_ports.json'))
S=json.load(open('stations.json'));names={}
for s in S:names.setdefault(s[2],dict(name=s[3],tab=s[1],b=s[0],datum=s[7] if len(s)>7 else ''))
EP=dt.datetime(2026,1,1)
def parse(fn):
    if not os.path.exists(fn):return {}
    txt=open(fn,errors='ignore').read();out={}
    for d,v in re.findall(r'(\d\d/\d\d/\d{4} \d\d:\d\d)\s*(?:</td>\s*<td[^>]*>)?\s*(-?\d+\.\d+)',txt):
        out[(dt.datetime.strptime(d,'%d/%m/%Y %H:%M')-EP).total_seconds()/3600]=float(v)
    return out
SP={'M2':28.9841042,'K1':15.0410686,'O1':13.9430356,'M4':57.9682084}   # separable in 7 days (S2/N2 are not)
BASES=['bundaberg','urangan','kingfisher-bay-jetty','tin-can-bay-snapper-creek','noosa-head','mooloolaba','scarborough','brisbane-bar','gladstone-auckland-point']
def movavg(x,k):
    c=np.convolve(x,np.ones(k)/k,'same');n=np.convolve(np.ones_like(x),np.ones(k)/k,'same');return c/n
res={}
ids=sorted({os.path.basename(f)[:-5] for f in glob.glob('tbl/*.html')+glob.glob('tbl2/*.html')})
for sid in ids:
    D=parse('tbl/%s.html'%sid);D.update(parse('tbl2/%s.html'%sid));P=sorted(D.items())
    meta=names.get(sid,dict(name='',tab='',b='',datum=''))
    r=dict(n=len(P),name=meta['name'],tab=meta['tab'],datum=meta['datum'])
    if len(P)<40:r['cls']='nodata';res[sid]=r;continue
    t=np.array([p[0] for p in P]);h=np.array([p[1] for p in P])
    tg=np.arange(t[0],t[-1],1/6.)
    gap=np.interp(tg,t[1:],np.diff(t));hg=np.interp(tg,t,h)
    r.update(days=round((t[-1]-t[0])/24,1),start=round(t[0],2),end=round(t[-1],2),last=float(h[-1]),med=round(float(np.median(h)),3),maxgap=round(float(np.diff(t).max()),1))
    if len(tg)<6*36:r['cls']='nodata';res[sid]=r;continue
    ok=gap<=3
    tr=movavg(hg,151)               # ~25 h
    d=hg-tr
    X=[np.ones_like(tg)]
    for w in SP.values():X+=[np.cos(np.radians(w)*tg),np.sin(np.radians(w)*tg)]
    X=np.column_stack(X);c,*_=np.linalg.lstsq(X[ok],d[ok],rcond=None)
    fit=X@c;r2=1-np.var((d-fit)[ok])/max(1e-9,np.var(d[ok]))
    amp={k:float(np.hypot(c[1+2*i],c[2+2*i])) for i,k in enumerate(SP)}
    rng=float(np.percentile(fit[ok],98)-np.percentile(fit[ok],2))
    # correlation with base-port predictions (lag search 0..12h, 10-min)
    best=(-1,None,None)
    for b in BASES:
        pt=np.arange(tg[0]-12.5,tg[-1]+0.1,1/6.);pp=predict(pt,dict(HP[b]));pp=pp-movavg(pp,151)
        for L in range(0,73):
            seg=np.interp(tg-L/6.,pt,pp)
            x=d[ok];y=seg[ok]
            if np.std(x)<1e-6:break
            cc=float(np.corrcoef(x,y)[0,1])
            if cc>best[0]:best=(cc,b,L*10)
    # floor fraction: share of time within 3 cm of the rolling 25 h minimum
    from numpy.lib.stride_tricks import sliding_window_view as sw
    pad=np.pad(hg,(75,75),mode='edge');rmin=sw(pad,151).min(axis=1);rmax=sw(pad,151).max(axis=1)
    live=(rmax-rmin)>0.06
    floor=float(np.mean((hg-rmin<0.03)[ok&live])) if (ok&live).any() else 1.0
    ceil=float(np.mean((rmax-hg<0.03)[ok&live])) if (ok&live).any() else 1.0
    r.update(r2=round(float(r2),2),m2=round(amp['M2'],3),k1=round(amp['K1'],3),m4=round(amp['M4'],3),rng=round(rng,2),corr=round(best[0],2),cbase=best[1],clag=best[2],floor=round(floor,2),ceil=round(ceil,2),
             trend=round(float(np.ptp(tr)),2))
    tidal=0.04<=amp['M2']<5 and r2>=0.35 and best[0]>=0.6 and rng>=0.15 and amp['M2']<5
    weak=amp['M2']>=0.03 and best[0]>=0.6 and r2>=0.3 and rng>=0.15 and amp['M2']<5
    if tidal and floor<0.22:cls='tidal'
    elif tidal or weak:cls='partial'
    else:cls='none'
    r['cls']=cls;res[sid]=r
json.dump(res,open('classify_v2.json','w'),indent=0)
from collections import Counter
print(Counter(v['cls'] for v in res.values()))
for k,v in sorted(res.items(),key=lambda x:(x[1].get('tab',''),x[1]['cls'])):
    if v['cls'] in('tidal','partial'):print(k,v['tab'],v['name'][:44].ljust(44),v['cls'].ljust(7),'M2',v['m2'],'r2',v['r2'],'rng',v['rng'],'corr',v['corr'],v['cbase'],v['clag'],'floor',v['floor'],'d',v['days'])
