import numpy as np, json
from fit import SPEEDS, load
from nodal import fu
def design(t,names):
    cols=[np.ones_like(t)]
    for n in names:
        f,u=fu(n,t);a=np.radians(SPEEDS[n])*t+np.radians(u);cols+=[f*np.cos(a),f*np.sin(a)]
    return np.column_stack(cols)
def predict(t,c):
    h=np.full_like(t,c['z0'],dtype=float)
    for n,A,G in zip(c['names'],c['amp'],c['pha']):
        f,u=fu(n,t);h+=f*A*np.cos(np.radians(SPEEDS[n])*t+np.radians(u)-np.radians(G))
    return h
if __name__=='__main__':
    t24,h24=load('bund_obs_2024.csv');t25,h25=load('bund_obs_2025.csv')
    t=np.concatenate([t24,t25]);h=np.concatenate([h24,h25]);names=list(SPEEDS)
    X=design(t,names);coef,*_=np.linalg.lstsq(X,h,rcond=None);res=h-X@coef
    m=np.abs(res)<4*res.std();coef,*_=np.linalg.lstsq(X[m],h[m],rcond=None)
    amp=[float(np.hypot(coef[1+2*i],coef[2+2*i])) for i in range(len(names))]
    pha=[float(np.degrees(np.arctan2(coef[2+2*i],coef[1+2*i]))%360) for i in range(len(names))]
    c=dict(names=names,speeds=[SPEEDS[n] for n in names],amp=amp,pha=pha,z0=float(coef[0]),epoch='2026-01-01T00:00 AEST (UTC+10)',datum='LAT, Bundaberg (Burnett Heads) port gauge 051011A',nodal='f,u via Schureman-style formulas, node longitude N',fit='MSQ observed 10-min 2024+2025, %d points'%int(m.sum()))
    json.dump(c,open('harmonics_bundaberg.json','w'),indent=1)
    for n,A,G in sorted(zip(names,amp,pha),key=lambda x:-x[1])[:12]:print(f'{n:5s} {A:.3f} {G:6.1f}')
    print('Z0',c['z0'],'fit resid rms',np.sqrt(np.mean((h-predict(t,c))**2)))
