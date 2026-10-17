import re,json,glob,os,datetime as dt,numpy as np
S=json.load(open('stations.json'));names={}
for s in S:names.setdefault(s[2],(s[3] if len(s)>3 else '',s[1],s[0]))
EP=dt.datetime(2026,1,1)
def parse(fn):
    txt=open(fn,errors='ignore').read()
    out={}
    for d,v in re.findall(r'(\d\d/\d\d/\d{4} \d\d:\d\d)\s*(?:</td>\s*<td[^>]*>)?\s*(-?\d+\.\d+)',txt):
        out[(dt.datetime.strptime(d,'%d/%m/%Y %H:%M')-EP).total_seconds()/3600]=float(v)
    return sorted(out.items())
res={}
for fn in sorted(glob.glob('tbl/*.html')):
    sid=os.path.basename(fn)[:-5];P=parse(fn)
    if len(P)<30:res[sid]=dict(n=len(P),tidal=False);continue
    t=np.array([p[0] for p in P]);h=np.array([p[1] for p in P])
    tg=np.arange(t[0],t[-1],0.25);hg=np.interp(tg,t,h)
    if len(tg)<96:res[sid]=dict(n=len(P),tidal=False);continue
    sp={'M2':28.9841042,'S2':30.0,'K1':15.0410686,'O1':13.9430356,'M4':57.968}
    X=[np.ones_like(tg),tg-tg.mean(),(tg-tg.mean())**2]
    for w in sp.values():X+=[np.cos(np.radians(w)*tg),np.sin(np.radians(w)*tg)]
    X=np.column_stack(X);c,*_=np.linalg.lstsq(X,hg,rcond=None)
    fit=X@c;r2=1-np.var(hg-fit)/max(1e-9,np.var(hg))
    # tidal part only
    tid=X[:,3:]@c[3:];amp={k:float(np.hypot(c[3+2*i],c[4+2*i])) for i,k in enumerate(sp)}
    rng=float(np.percentile(tid,98)-np.percentile(tid,2))
    res[sid]=dict(n=len(P),r2=round(float(r2),2),m2=round(amp['M2'],3),k1=round(amp['K1'],3),rng=round(rng,2),tidal=bool(amp['M2']>0.04 and r2>0.35),name=names.get(sid,('',))[0],tab=names.get(sid,('','',''))[1],last=P[-1][1])
json.dump(res,open('classify.json','w'),indent=0)
for k,v in res.items():
    if v.get('tidal') or v.get('m2',0)>0.02:print(k,v.get('name'),v.get('tab'),'M2',v.get('m2'),'r2',v.get('r2'),'rng',v.get('rng'),'n',v['n'],'TIDAL' if v['tidal'] else '')
