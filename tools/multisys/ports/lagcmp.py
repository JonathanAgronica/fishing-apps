import sys,json,numpy as np
sys.path.insert(0,'/workspace/baffle-tides/research')
from fit import SPEEDS
from fit2 import predict
from validate import extrema
H=json.load(open('harm_ports.json'))
def ext(p,t0=6000,t1=7000):
    c=dict(H[p]);tt=np.arange(t0,t1,1/30);return extrema(tt,predict(tt,c))
def lag(a,b):
    A=ext(a);B=ext(b);out={True:[],False:[]}
    for e in B:
        c=[x for x in A if x[2]==e[2] and -3<e[0]-x[0]<4]
        if c:x=min(c,key=lambda x:abs(e[0]-x[0]));out[e[2]].append((e[0]-x[0])*60)
    return {('HW' if k else 'LW'):round(float(np.median(v)),0) for k,v in out.items()}
for a,b in [('bundaberg','tin-can-bay-snapper-creek'),('urangan','tin-can-bay-snapper-creek'),('urangan','kingfisher-bay-jetty'),('bundaberg','kingfisher-bay-jetty'),('bundaberg','urangan'),('brisbane-bar','port-office-brisbane-river'),('brisbane-bar','pinkenba'),('brisbane-bar','deep-water-bend-pine-river'),('brisbane-bar','shorncliffe'),('brisbane-bar','scarborough'),('mooloolaba','noosa-head'),('gladstone-auckland-point','bundaberg')]:
    print(a,'->',b,lag(a,b))
