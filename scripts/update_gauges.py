#!/usr/bin/env python3
"""Fish Times gauge pipeline (stdlib only; runs on GitHub Actions or the box).
Fetches BoM 7-day tables (039267 Essendean Br, 539135 Euleilah Ck @ Hills Rd, 539132 Mimdale) and the Qld DES
7-day storm-tide feed (Bundaberg 051011A), merges into append-only CSVs in data/, recomputes peaks/lags and writes
data/gauges.json for the app. Exit 0 always unless nothing could be fetched AND nothing exists.
Usage: update_gauges.py [--ingest DIR ...] [--no-fetch]   (DIR: BoM .html/.shtml/.txt tables or DES .csv files)"""
import csv, json, os, re, sys, glob, time, datetime as dt, urllib.request
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__))); DATA=os.path.join(ROOT,'data')
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
EPOCH=dt.datetime(2026,1,1)            # AEST (UTC+10, no DST); app uses the same epoch
START=dt.datetime(2026,10,2)           # series start
LAT2AHD=1.693                          # Bundaberg LAT -> AHD (TMR)
BOM={'039267':('essendean','Baffle Ck @ Essendean Bridge'),'539135':('hillsrd','Euleilah Ck @ Hills Rd'),'539132':('mimdale','Baffle Ck @ Mimdale')}
DES_URL='https://apps.des.qld.gov.au/data-sets/storm-tides/stdtide-7dayopdata.csv'
MODEL={'hillsrd':{'HW':179,'LW':277},'essendean':{'HW':339,'LW':415}}  # lags (min) currently used by the app model
def mins(d): return int(round((d-EPOCH).total_seconds()/60))
def get(url):
    r=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html,text/csv,*/*','Accept-Language':'en-AU,en;q=0.9','Referer':'https://www.bom.gov.au/qld/flood/'})
    with urllib.request.urlopen(r,timeout=60) as f: return f.status,f.read().decode('utf-8','replace')
def parse_bom(txt):
    out={}
    for d,v in re.findall(r'(\d\d/\d\d/\d{4} \d\d:\d\d)\s*(?:</td>\s*<td[^>]*>)?\s*(-?\d+\.\d+)',txt):
        out[dt.datetime.strptime(d,'%d/%m/%Y %H:%M')]=float(v)
    return out
def parse_des(txt):
    out={}
    for line in txt.splitlines():
        p=[x.strip() for x in line.split(',')]
        if len(p)>=5 and p[0]=='bundaberg':
            try: t=dt.datetime.strptime(p[2],'%Y-%m-%dT%H:%M');h=float(p[3]);pr=float(p[4])
            except ValueError: continue
            out[t]=(h if -1<h<7 else None, pr if -1<pr<7 else None)
    return out
def load_csv(fn,n):
    out={}
    if os.path.exists(fn):
        for r in csv.reader(open(fn)):
            if not r or r[0].startswith('time'): continue
            t=dt.datetime.strptime(r[0],'%Y-%m-%d %H:%M');vals=[float(x) if x not in ('',None) else None for x in r[1:1+n]]
            out[t]=vals[0] if n==1 else tuple(vals)
    return out
def save_csv(fn,hdr,d,n):
    tmp=fn+'.tmp'
    with open(tmp,'w',newline='') as f:
        w=csv.writer(f);w.writerow(hdr)
        for t in sorted(d):
            v=d[t];vals=[v] if n==1 else list(v)
            w.writerow([t.strftime('%Y-%m-%d %H:%M')]+['' if x is None else ('%.3f'%x) for x in vals])
    os.replace(tmp,fn)
# ---------- events ----------
def step_events(R):
    """Peaks/troughs of an event-reported (5 cm step) series. Plateau = first time at value .. first time at next value."""
    runs=[]
    for t,v in R:
        if runs and abs(runs[-1][2]-v)<1e-6: runs[-1][1]=t
        else: runs.append([t,t,v])
    out=[]
    for i in range(1,len(runs)-1):
        a,b,c=runs[i-1][2],runs[i][2],runs[i+1][2]
        if b>a and b>c: k='HW'
        elif b<a and b<c: k='LW'
        else: continue
        s=runs[i][0];e=runs[i+1][0];out.append(dict(kind=k,start=s,end=e,mid=(s+e)/2,val=b))
    return out
def quadfit(xs,ys):
    n=len(xs);Sx=[sum(x**k for x in xs) for k in range(5)];Sy=[sum(y*x**k for x,y in zip(xs,ys)) for k in range(3)]
    M=[[Sx[0],Sx[1],Sx[2]],[Sx[1],Sx[2],Sx[3]],[Sx[2],Sx[3],Sx[4]]]
    def det(m): return m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0])
    D=det(M)
    if abs(D)<1e-12: return None
    sol=[]
    for j in range(3):
        Mj=[row[:] for row in M]
        for i in range(3): Mj[i][j]=Sy[i]
        sol.append(det(Mj)/D)
    return sol
def bund_extremes(B):
    """B: sorted [(min,h)] 10-min. 3-pt smooth, local extreme within ±150 min, quadratic refine over ±60 min."""
    T=[t for t,_ in B];H=[h for _,h in B];n=len(T);S=H[:]
    for i in range(1,n-1):
        if T[i+1]-T[i-1]<=25: S[i]=(H[i-1]+H[i]+H[i+1])/3
    out=[]
    for i in range(n):
        lo=i;hi=i
        while lo>0 and T[i]-T[lo-1]<=150: lo-=1
        while hi<n-1 and T[hi+1]-T[i]<=150: hi+=1
        if T[i]-T[lo]<120 or T[hi]-T[i]<120 or hi-lo<20: continue
        w=S[lo:hi+1];ismax=S[i]==max(w);ismin=S[i]==min(w)
        if not(ismax or ismin): continue
        if out and abs(out[-1][0]-T[i])<180 and out[-1][2]==ismax: continue
        xs=[T[j]-T[i] for j in range(n) if abs(T[j]-T[i])<=60];ys=[H[j] for j in range(n) if abs(T[j]-T[i])<=60]
        q=quadfit(xs,ys) if len(xs)>=9 else None
        if q and q[2]!=0 and abs(-q[1]/(2*q[2]))<=40:
            x0=-q[1]/(2*q[2]);t0=T[i]+x0;h0=q[0]+q[1]*x0+q[2]*x0*x0
        else: t0=T[i];h0=S[i]
        out.append([round(t0,1),round(h0,3),ismax])
    clean=[]
    for e in out:
        if clean and clean[-1][2]==e[2]:
            if (e[2] and e[1]>clean[-1][1]) or (not e[2] and e[1]<clean[-1][1]): clean[-1]=e
        elif clean and abs(clean[-1][1]-e[1])<0.3: clean.pop()
        else: clean.append(e)
    return clean
def lag_events(key,R,BE):
    ev=step_events(R);rows=[];prev=None
    for e in ev:
        want=e['kind']=='HW'
        c=[b for b in BE if b[2]==want and 0<e['mid']-b[0]<8*60]
        amp=None
        if prev is not None: amp=round(e['val']-prev['val'],3)
        prev=e
        if not c: continue
        b=max(c,key=lambda b:b[0])
        rows.append(dict(k=e['kind'],bt=b[0],bh=b[1],s=e['start'],e=e['end'],t=e['mid'],v=e['val'],lag=round(e['mid']-b[0],1),u=round((e['end']-e['start'])/2,1),amp=amp))
    return rows
def stats(rows,kind,since=None):
    L=[r['lag'] for r in rows if r['k']==kind and (since is None or r['bt']>=since)]
    U=sorted(r['u'] for r in rows if r['k']==kind and (since is None or r['bt']>=since))
    if not L: return dict(n=0)
    m=sum(L)/len(L);sd=(sum((x-m)**2 for x in L)/(len(L)-1))**.5 if len(L)>1 else None
    return dict(n=len(L),mean=round(m,1),sd=None if sd is None else round(sd,1),min=min(L),max=max(L),u_med=U[len(U)//2])
def main(argv):
    os.makedirs(DATA,exist_ok=True);log=[];now=dt.datetime.now(dt.timezone.utc).replace(tzinfo=None)+dt.timedelta(hours=10)
    files={k:os.path.join(DATA,f'{sid}_{k}.csv') for sid,(k,_) in BOM.items()};fb=os.path.join(DATA,'051011A_bundaberg.csv')
    S={k:load_csv(fn,1) for k,fn in files.items()};Bd=load_csv(fb,2)
    before={k:dict(v) for k,v in S.items()};bb=dict(Bd)
    def add_bom(k,d):
        for t,v in d.items():
            if t>=START: S[k][t]=v
    def add_des(d):
        for t,(h,p) in d.items():
            if t<START: continue
            old=Bd.get(t)
            if h is None and old and old[0] is not None: h=old[0]
            Bd[t]=(h,p)
    ingest=[a for i,a in enumerate(argv) if i>0 and argv[i-1]=='--ingest']
    for d in ingest:
        for fn in sorted(glob.glob(os.path.join(d,'**','*'),recursive=True)):
            if not os.path.isfile(fn): continue
            txt=open(fn,errors='replace').read();base=os.path.basename(fn)
            if 'bundaberg,' in txt: add_des(parse_des(txt));continue
            for sid,(k,_) in BOM.items():
                if sid in base or (sid=='039267' and base.startswith('ess')): add_bom(k,parse_bom(txt))
    fetch={}
    if '--no-fetch' not in argv:
        for sid,(k,_) in BOM.items():
            url=f'https://www.bom.gov.au/fwo/IDQ65392/IDQ65392.{sid}.tbl.shtml'
            try:
                st,txt=get(url);d=parse_bom(txt);add_bom(k,d);fetch[sid]=dict(status=st,n=len(d))
            except Exception as e: fetch[sid]=dict(error=str(e)[:200])
            time.sleep(2)
        try:
            st,txt=get(DES_URL);d=parse_des(txt);add_des(d);fetch['051011A']=dict(status=st,n=len(d))
        except Exception as e: fetch['051011A']=dict(error=str(e)[:200])
    changed=False
    for k,fn in files.items():
        if S[k]!=before[k] or not os.path.exists(fn): save_csv(fn,['time_aest','level_m' if k=='mimdale' else 'level_m_ahd'],S[k],1);changed=True
    if Bd!=bb or not os.path.exists(fb): save_csv(fb,['time_aest','level_m_lat','prediction_m_lat'],Bd,2);changed=True
    # derived
    ser={k:[[mins(t),v] for t,v in sorted(d.items())] for k,d in S.items()}
    B=[(mins(t),h) for t,(h,p) in sorted(Bd.items()) if h is not None]
    ser['bundaberg']=[[m,round(h-LAT2AHD,3)] for m,h in B]
    ser['bundaberg_pred']=[[mins(t),round(p-LAT2AHD,3)] for t,(h,p) in sorted(Bd.items()) if p is not None]
    BE=bund_extremes(B)
    ev={k:lag_events(k,[(m,v) for m,v in ser[k]],BE) for k in ('essendean','hillsrd')}
    last7=mins(now)-7*1440
    st={f'{k}_{kind}':dict(all=stats(ev[k],kind),last7d=stats(ev[k],kind,last7),model=MODEL[k][kind]) for k in ev for kind in ('HW','LW')}
    latest={k:(ser[k][-1] if ser[k] else None) for k in ('essendean','hillsrd','mimdale','bundaberg')}
    out=dict(schema=1,epoch='2026-01-01T00:00+10:00',time_unit='minutes',datum='m AHD (Bundaberg converted from LAT -1.693)',
        generated=now.strftime('%Y-%m-%dT%H:%M+10:00'),start=START.strftime('%Y-%m-%d'),fetch=fetch,latest=latest,
        names={k:n for _,(k,n) in BOM.items()}|{'bundaberg':'Bundaberg (Burnett Heads) 051011A'},
        series=ser,bund_ext=BE,events=ev,stats=st)
    gj=os.path.join(DATA,'gauges.json');old=None
    if os.path.exists(gj):
        try: old=json.load(open(gj))
        except Exception: old=None
    def core(o): return None if o is None else json.dumps({k:o.get(k) for k in ('series','events','bund_ext')},sort_keys=True)
    if changed or core(old)!=core(out) or old is None:
        tmp=gj+'.tmp';json.dump(out,open(tmp,'w'),separators=(',',':'));os.replace(tmp,gj);changed=True
    print(json.dumps(dict(changed=changed,fetch=fetch,latest=latest,n={k:len(v) for k,v in ser.items()},stats={k:v['all'] for k,v in st.items()})))
    ok=any('n' in v and v['n']>0 for v in fetch.values()) or '--no-fetch' in argv
    return 0 if ok else 2
if __name__=='__main__': sys.exit(main(sys.argv))
