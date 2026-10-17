import numpy as np, json, datetime as dt
SPEEDS={'SA':0.0410686,'SSA':0.0821373,'MM':0.5443747,'MSF':1.0158958,'MF':1.0980331,
'2Q1':12.8542862,'Q1':13.3986609,'RHO1':13.4715145,'O1':13.9430356,'M1':14.4966939,'P1':14.9589314,'S1':15.0,'K1':15.0410686,'J1':15.5854433,'OO1':16.1391017,
'2N2':27.8953548,'MU2':27.9682084,'N2':28.4397295,'NU2':28.5125831,'M2':28.9841042,'LAM2':29.4556253,'L2':29.5284789,'T2':29.9589333,'S2':30.0,'R2':30.0410667,'K2':30.0821373,'2SM2':31.0158958,
'MO3':42.9271398,'M3':43.4761563,'MK3':44.0251729,'SK3':45.0410686,
'MN4':57.4238337,'M4':57.9682084,'MS4':58.9841042,'MK4':59.0662415,'S4':60.0,
'2MN6':86.4079380,'M6':86.9523127,'2MS6':87.9682084,'2SM6':88.9841042,'M8':115.9364166}
EPOCH=dt.datetime(2026,1,1)  # AEST
def load(fn):
    T=[];H=[]
    for line in open(fn,errors='ignore'):
        p=[x.strip() for x in line.split(',')]
        if len(p)>=4 and len(p[0])==10 and p[0][2]=='/':
            try:
                d=dt.datetime.strptime(p[0]+' '+p[1],'%d/%m/%Y %H:%M');h=float(p[3])
            except: continue
            if h<-50 or h>50: continue
            T.append((d-EPOCH).total_seconds()/3600);H.append(h)
    return np.array(T),np.array(H)
def design(t,names):
    cols=[np.ones_like(t)]
    for n in names:
        w=np.radians(SPEEDS[n]);cols+= [np.cos(w*t),np.sin(w*t)]
    return np.column_stack(cols)
def predict(t,c):
    names=c['names'];h=np.full_like(t,c['z0'],dtype=float)
    for n,A,G in zip(names,c['amp'],c['pha']):
        w=np.radians(SPEEDS[n]);h+=A*np.cos(w*t-np.radians(G))
    return h
if __name__=='__main__':
    t24,h24=load('bund_obs_2024.csv');t25,h25=load('bund_obs_2025.csv')
    print('2024',len(t24),h24.min(),h24.max(),'2025',len(t25))
    t=np.concatenate([t24,t25]);h=np.concatenate([h24,h25])
    names=list(SPEEDS)
    X=design(t,names);coef,*_=np.linalg.lstsq(X,h,rcond=None)
    res=h-X@coef;
    # robust refit removing outliers (storm surge etc)
    m=np.abs(res)<4*res.std();coef,*_=np.linalg.lstsq(X[m],h[m],rcond=None)
    amp=[];pha=[]
    for i,n in enumerate(names):
        a,b=coef[1+2*i],coef[2+2*i];amp.append(float(np.hypot(a,b)));pha.append(float(np.degrees(np.arctan2(b,a))%360))
    c=dict(names=names,speeds=[SPEEDS[n] for n in names],amp=amp,pha=pha,z0=float(coef[0]),epoch='2026-01-01T00:00+10:00',datum='LAT (Bundaberg/Burnett Heads port gauge 051011A)',fit='2024-01-01..2025-12-31 observed 10-min, %d pts'%m.sum())
    json.dump(c,open('harmonics_bundaberg.json','w'),indent=1)
    for n,A,G in sorted(zip(names,amp,pha),key=lambda x:-x[1])[:14]:print(f'{n:5s} {A:.3f} {G:6.1f}')
    print('Z0',c['z0'],'fit resid rms',np.sqrt(np.mean((h-predict(t,c))**2)))
