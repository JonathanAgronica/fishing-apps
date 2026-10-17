import numpy as np, json, datetime as dt
from fit import load, EPOCH
from fit2 import predict
c=json.load(open('harmonics_bundaberg.json'))
def extrema(t,h):
    out=[]
    for i in range(1,len(h)-1):
        if (h[i]>h[i-1] and h[i]>=h[i+1]) or (h[i]<h[i-1] and h[i]<=h[i+1]):
            a,b,cc=h[i-1],h[i],h[i+1];den=a-2*b+cc;off=0.5*(a-cc)/den if den else 0
            dtm=t[i]-t[i-1];out.append((t[i]+off*dtm,b-0.25*(a-cc)*off,h[i]>h[i-1]))
    return out
# official 2026 interval predictions
if __name__=="__main__":
    tp,hp=load('bund_pred_2026.csv');mp=predict(tp,c)
    print('vs official 2026 10-min predictions: n=%d RMS=%.3f m, max=%.3f'%(len(tp),np.sqrt(np.mean((hp-mp)**2)),np.abs(hp-mp).max()))
    # official hilo
    H=[]
    for line in open('bund_hilo_2026.csv'):
        p=[x.strip() for x in line.split(',')]
        if len(p)==4 and p[0][2:3]=='/':
            d=dt.datetime.strptime(p[0]+' '+p[1],'%d/%m/%Y %H:%M');H.append(((d-EPOCH).total_seconds()/3600,float(p[3]),p[2]=='1'))
    tt=np.arange(-24,366*24,1/60.);hh=predict(tt,c);E=extrema(tt,hh)
    Et=np.array([e[0] for e in E])
    dts={True:[],False:[]};dhs={True:[],False:[]}
    for t0,h0,hi in H:
        j=np.argmin(np.abs(Et-t0));e=E[j]
        if e[2]==hi and abs(e[0]-t0)<2: dts[hi].append((e[0]-t0)*60);dhs[hi].append(e[1]-h0)
    for k in (True,False):
        a=np.array(dts[k]);b=np.array(dhs[k])
        print('HW' if k else 'LW','n=%d timing RMS %.1f min, mean %.1f, max %.1f; height RMS %.3f m mean %.3f'%(len(a),np.sqrt(np.mean(a**2)),a.mean(),np.abs(a).max(),np.sqrt(np.mean(b**2)),b.mean()))
    print('official hilo count',len(H))
    