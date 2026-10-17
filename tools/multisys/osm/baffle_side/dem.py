import json,math,urllib.request,time,os
exec(open('find.py').read())
R=json.load(open('side.json'))
# Euleilah full chain from its junction
v=by['Euleilah Creek'];st=E[0]
def chain(ways,start):
  segs=[[(p['lat'],p['lon']) for p in e['geometry']] for e in ways];pts=[start];cur=start;used=set()
  while True:
    bi=None;bd=0.25
    for k,s in enumerate(segs):
      if k in used:continue
      for rev in(0,1):
        q=s[::-1] if rev else s
        if hav(cur,q[0])<bd:bd=hav(cur,q[0]);bi=(k,q)
    if not bi:break
    used.add(bi[0]);pts+=bi[1][1:];cur=pts[-1]
  return pts
R['Euleilah Creek']=dict(line='B',jk=EJ,pts=chain(v,tuple(E[0])))
def pa(P,C,s):
  for k in range(1,len(C)):
    if C[k]>=s:f=(s-C[k-1])/max(1e-9,C[k]-C[k-1]);return (P[k-1][0]+f*(P[k][0]-P[k-1][0]),P[k-1][1]+f*(P[k][1]-P[k-1][1]))
  return P[-1]
cache=json.load(open('dem_cache.json'))
prof={}
for n,r in R.items():
  P=[tuple(p) for p in r['pts']];C=cum(P);s=0;L=[]
  while s<=C[-1]:L.append((round(s,2),)+tuple(round(x,5) for x in pa(P,C,s)));s+=0.3
  prof[n]=L
need=sorted({'%.5f,%.5f'%(a,b) for L in prof.values() for _,a,b in L}-set(cache))
print('need',len(need))
for i in range(0,len(need),100):
  ch=need[i:i+100]
  url='https://api.open-meteo.com/v1/elevation?latitude=%s&longitude=%s'%(','.join(c.split(',')[0] for c in ch),','.join(c.split(',')[1] for c in ch))
  e=json.load(urllib.request.urlopen(url,timeout=60))['elevation']
  for c,x in zip(ch,e):cache[c]=x
  time.sleep(0.5)
json.dump(cache,open('dem_cache.json','w'))
out={}
for n,L in prof.items():
  el=[cache['%.5f,%.5f'%(a,b)] for _,a,b in L]
  out[n]=[(s,e) for (s,_,_),e in zip(L,el)]
  print(n, ' '.join('%g:%.0f'%(s,e) for (s,e) in out[n][::2])[:600])
json.dump(out,open('dem_prof.json','w'));json.dump(R,open('side.json','w'))
