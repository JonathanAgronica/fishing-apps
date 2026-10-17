import numpy as np, json, datetime as dt
from fit import EPOCH
from fit2 import predict
from validate import extrema
c=json.load(open('harmonics_bundaberg.json'))
def th(d): return (d-EPOCH).total_seconds()/3600
def fmt(t): return (EPOCH+dt.timedelta(hours=float(t))).strftime('%a %d %b %H:%M')
# Bundaberg observed DES 7-day
bt=[];bo=[];bp=[]
for line in open('des_tide7.csv'):
    p=[x.strip() for x in line.split(',')]
    if p[0]=='bundaberg':
        bt.append(th(dt.datetime.strptime(p[2],'%Y-%m-%dT%H:%M')));bo.append(float(p[3]));bp.append(float(p[4]))
bt=np.array(bt);bo=np.array(bo);bp=np.array(bp)
ok=(bo>-1)&(bo<6)&(bp>-1)&(bp<6);print("dropped",(~ok).sum());bt,bo,bp=bt[ok],bo[ok],bp[ok]
mm=predict(bt,c)
print('DES bundaberg n=%d %s..%s'%(len(bt),fmt(bt[0]),fmt(bt[-1])))
print('held-out obs vs my harmonic: RMS %.3f m; obs vs MSQ prediction RMS %.3f; my vs MSQ RMS %.3f; mean residual obs-MSQ %.3f'%(np.sqrt(np.mean((bo-mm)**2)),np.sqrt(np.mean((bo-bp)**2)),np.sqrt(np.mean((mm-bp)**2)),np.mean(bo-bp)))
# smooth obs (30 min running mean) then interpolate to 1 min
k=np.ones(3)/3;bos=np.convolve(bo,k,'same')
t1=np.arange(bt[1],bt[-2],1/60);EO=extrema(t1,np.interp(t1,bt,bos));EM=extrema(t1,predict(t1,c));EP=extrema(t1,np.interp(t1,bt,bp))
EO=[e for e in EO if True]
def clean(E):
    out=[]
    for e in E:
        if out and out[-1][2]==e[2]:
            if (e[2] and e[1]>out[-1][1]) or ((not e[2]) and e[1]<out[-1][1]): out[-1]=e
        elif out and abs(out[-1][1]-e[1])<0.3: out.pop()
        else: out.append(e)
    return out
EO=clean(EO);EP=clean(EP)
# timing error of my model vs observed
def match(A,B):
    r=[]
    for a in A:
        j=min(B,key=lambda b:abs(b[0]-a[0]))
        if j[2]==a[2] and abs(j[0]-a[0])<2: r.append(((j[0]-a[0])*60,j[1]-a[1],a[2]))
    return r
for nm,E2 in (('my harmonic',EM),('MSQ official',EP)):
    r=match(EO,E2)
    for hi in (True,False):
        x=np.array([q[0] for q in r if q[2]==hi]);y=np.array([q[1] for q in r if q[2]==hi])
        print('%s vs observed %s: n=%d time RMS %.1f min (mean %.1f), height RMS %.3f'%(nm,'HW' if hi else 'LW',len(x),np.sqrt(np.mean(x**2)),x.mean(),np.sqrt(np.mean(y**2))))
print('Bundaberg observed extremes:')
for e in EO: print('  ',('HW' if e[2] else 'LW'),fmt(e[0]),'%.2f'%e[1])
json.dump(dict(obs=[[float(a),float(b),bool(h)] for a,b,h in EO],t=bt.tolist(),h=bo.tolist(),p=bp.tolist()),open('bund_week.json','w'))
