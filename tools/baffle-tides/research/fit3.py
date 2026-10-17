import numpy as np, json, sys
from fit import SPEEDS, load
from fit2 import design, predict
from validate import extrema
import datetime as dt
from fit import EPOCH
def fitfiles(files,label):
    T=[];H=[]
    for f in files:
        t,h=load(f);T.append(t);H.append(h)
    t=np.concatenate(T);h=np.concatenate(H);names=list(SPEEDS)
    X=design(t,names);coef,*_=np.linalg.lstsq(X,h,rcond=None);res=h-X@coef
    m=np.abs(res)<4*res.std();coef,*_=np.linalg.lstsq(X[m],h[m],rcond=None)
    amp=[float(np.hypot(coef[1+2*i],coef[2+2*i])) for i in range(len(names))]
    pha=[float(np.degrees(np.arctan2(coef[2+2*i],coef[1+2*i]))%360) for i in range(len(names))]
    return dict(names=names,speeds=[SPEEDS[n] for n in names],amp=amp,pha=pha,z0=float(coef[0]),epoch='2026-01-01T00:00 AEST (UTC+10)',datum='LAT, Bundaberg (Burnett Heads) port gauge 051011A',fit=label+', %d points'%int(m.sum()))
H=[]
for line in open('bund_hilo_2026.csv'):
    p=[x.strip() for x in line.split(',')]
    if len(p)==4 and p[0][2:3]=='/':
        d=dt.datetime.strptime(p[0]+' '+p[1],'%d/%m/%Y %H:%M');H.append(((d-EPOCH).total_seconds()/3600,float(p[3]),p[2]=='1'))
def vs_hilo(c):
    tt=np.arange(-24,366*24,1/60.);E=extrema(tt,predict(tt,c));Et=np.array([e[0] for e in E]);r={}
    for hi in (True,False):
        d=[];dh=[]
        for t0,h0,h in H:
            if h!=hi: continue
            j=np.argmin(np.abs(Et-t0));e=E[j]
            if e[2]==hi and abs(e[0]-t0)<2:d.append((e[0]-t0)*60);dh.append(e[1]-h0)
        d=np.array(d);dh=np.array(dh);r['HW' if hi else 'LW']='n=%d dt RMS %.1f min (mean %+.1f, max %.1f), dh RMS %.3f m (mean %+.3f)'%(len(d),np.sqrt(np.mean(d**2)),d.mean(),np.abs(d).max(),np.sqrt(np.mean(dh**2)),dh.mean())
    return r
W=json.load(open('bund_week.json'));wt=np.array(W['t']);wh=np.array(W['h'])
def vs_week(c):
    m=predict(wt,c);t1=np.arange(wt[1],wt[-2],1/60);EM=extrema(t1,predict(t1,c))
    out=[]
    for e in W['obs']:
        j=min(EM,key=lambda b:abs(b[0]-e[0]))
        if j[2]==e[2]:out.append(((j[0]-e[0])*60,j[1]-e[1],e[2]))
    s='RMS %.3f m;'%np.sqrt(np.mean((wh-m)**2))
    for hi in (True,False):
        x=np.array([q[0] for q in out if q[2]==hi]);y=np.array([q[1] for q in out if q[2]==hi])
        s+=' %s n=%d dt RMS %.1f min (mean %+.1f) dh RMS %.3f;'%('HW' if hi else 'LW',len(x),np.sqrt(np.mean(x**2)),x.mean(),np.sqrt(np.mean(y**2)))
    return s
if __name__=='__main__':
    A=fitfiles(['bund_obs_20%d.csv'%y for y in range(21,26)],'MSQ observed 10-min 2021-2025')
    B=fitfiles(['bund_pred_2025.csv','bund_pred_2026.csv'],'MSQ official predicted 10-min 2025+2026')
    B1=fitfiles(['bund_pred_2025.csv'],'MSQ official predicted 2025 only (holdout test)')
    for nm,c in (('A obs21-25',A),('B pred25+26',B),('B1 pred25 only',B1)):
        print(nm,'Z0 %.3f'%c['z0']);print('  vs official 2026 HiLo:',vs_hilo(c));print('  vs held-out observed Oct 2-9 2026:',vs_week(c))
        json.dump(c,open('harm_%s.json'%nm.split()[0],'w'))
