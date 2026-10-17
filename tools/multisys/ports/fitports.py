import sys,json,glob,datetime as dt,numpy as np
sys.path.insert(0,'/workspace/baffle-tides/research')
from fit import SPEEDS,EPOCH
from fit2 import design,predict
from validate import extrema
def load(fn):
  T=[];H=[];seen=set()
  for d,t,h,ind in json.load(open(fn)):
    try:x=dt.datetime.strptime(d+' '+t,'%d/%m/%Y %H:%M');v=float(h)
    except:continue
    k=(x-EPOCH).total_seconds()/3600
    if k in seen or abs(v)>20:continue
    seen.add(k);T.append(k);H.append(v)
  return np.array(T),np.array(H)
def hilo(fn):
  H=[]
  for d,t,h,ind in json.load(open(fn)):
    try:x=dt.datetime.strptime(d+' '+t,'%d/%m/%Y %H:%M')
    except:continue
    H.append(((x-EPOCH).total_seconds()/3600,float(h),ind))
  # classify hi/lo by neighbours
  out=[]
  for i,(t,h,ind) in enumerate(H):
    nb=[H[j][1] for j in (i-1,i+1) if 0<=j<len(H)]
    out.append((t,h,all(h>n for n in nb)))
  return out
res={}
for p in sorted(set(f.split('_')[0] for f in glob.glob('*_10min_*.json'))):
  T=[];Hh=[]
  for f in sorted(glob.glob(p+'_10min_*.json')):
    t,h=load(f);T.append(t);Hh.append(h)
  t=np.concatenate(T);h=np.concatenate(Hh);o=np.argsort(t);t=t[o];h=h[o]
  names=list(SPEEDS);X=design(t,names);coef,*_=np.linalg.lstsq(X,h,rcond=None)
  amp=[float(np.hypot(coef[1+2*i],coef[2+2*i])) for i in range(len(names))]
  pha=[float(np.degrees(np.arctan2(coef[2+2*i],coef[1+2*i]))%360) for i in range(len(names))]
  c=dict(names=names,amp=[round(a,4) for a in amp],pha=[round(x,2) for x in pha],z0=round(float(coef[0]),4))
  rms=float(np.sqrt(np.mean((h-predict(t,c))**2)))
  # vs official hilo
  s=''
  for f in glob.glob(p+'_hilo_2026.json'):
    HL=hilo(f);tt=np.arange(-24,366*24,1/60.);E=extrema(tt,predict(tt,c));Et=np.array([e[0] for e in E])
    for hi in (True,False):
      d=[];dh=[]
      for t0,h0,isH in HL:
        if isH!=hi:continue
        j=np.argmin(np.abs(Et-t0));e=E[j]
        if e[2]==hi and abs(e[0]-t0)<2:d.append((e[0]-t0)*60);dh.append(e[1]-h0)
      d=np.array(d);dh=np.array(dh);s+=' %s n=%d dt rms %.1f min dh rms %.3f m;'%('HW' if hi else 'LW',len(d),np.sqrt(np.mean(d**2)),np.sqrt(np.mean(dh**2)))
  c['fit']='MSQ official predicted 10-min %s (%d pts), resid RMS %.3f m;%s'%('+'.join(sorted(f.split('_')[-1][:4] for f in glob.glob(p+'_10min_*.json'))),len(t),rms,s)
  res[p]=c;print(p,c['z0'],c['fit'],flush=True)
json.dump(res,open('harm_ports.json','w'))
