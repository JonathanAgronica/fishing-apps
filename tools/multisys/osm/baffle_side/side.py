exec(open('find.py').read())
NAMES=['Duck Creek','Bottle Creek','Mosquito Creek','Little Mosquito Creek','Cattle Creek','Sleepy Creek','Halfway Creek','Manning Creek','Grevillea Creek','Sandy Creek','Oyster Creek']
mg=json.load(open('../mang_-24.6.json'))
MP=[]
for e in mg['elements']:
  if e['type']=='way' and 'geometry' in e:
    for p in e['geometry']:
      if -24.62<p['lat']<-24.38 and 151.65<p['lon']<152.12:MP.append((p['lat'],p['lon'],e['tags'].get('wetland')))
  elif e['type']=='relation':
    for m in e.get('members',[]):
      for p in m.get('geometry',[]) or []:
        if -24.62<p['lat']<-24.38 and 151.65<p['lon']<152.12:MP.append((p['lat'],p['lon'],e['tags'].get('wetland')))
print('mangrove pts',len(MP))
import bisect
MP.sort()
def nearM(p,r=0.12):
  lo=bisect.bisect_left(MP,(p[0]-0.002,));best=9
  for q in MP[lo:]:
    if q[0]>p[0]+0.002:break
    if abs(q[1]-p[1])<0.003:best=min(best,hav(p,q[:2]))
  return best
cross=[]
for e in d['elements']:
  t=e.get('tags',{})
  if e['type']=='way' and 'highway' in t:cross.append((t.get('name',t['highway']),[(p['lat'],p['lon']) for p in e['geometry']],'bridge' if 'bridge' in t else 'ford'))
  if e['type']=='node':cross.append((t.get('name',t.get('waterway',t.get('ford') and 'ford' or t.get('leisure'))),[(e['lat'],e['lon'])],t.get('waterway') or ('ford' if 'ford' in t else t.get('leisure'))))
def chain(ways,start):
  segs=[[(p['lat'],p['lon']) for p in e['geometry']] for e in ways];pts=[start];cur=start;used=set()
  while True:
    bi=None;bd=0.25
    for k,s in enumerate(segs):
      if k in used:continue
      for rev in(0,1):
        q=s[::-1] if rev else s
        dd=hav(cur,q[0])
        if dd<bd:bd=dd;bi=(k,q)
    if not bi:break
    used.add(bi[0]);pts+=bi[1][1:];cur=pts[-1]
  return pts
res={}
for n in NAMES:
  v=by[n];best=None
  for e in v:
    g=[(p['lat'],p['lon']) for p in e['geometry']]
    for p in(g[0],g[-1]):
      dm=proj(M,MC,p);de=proj(E,EC,p)
      c=('B',dm[0],dm[1],p) if dm[0]<=de[0] else ('E',de[0],EJ+de[1],p)
      if not best or c[1]<best[1]:best=c
  line,off,jk,start=best
  P=chain(v,start);C=cum(P)
  # mangrove proximity along chain
  prof=[];last=0
  for k,p in enumerate(P):
    dm=nearM(p);prof.append(dm)
    if dm<0.15:last=C[k]
  cr=[]
  for nm,g,ty in cross:
    for q in g:
      pr=proj(P,C,q)
      if pr[0]<0.03:cr.append((round(pr[1],2),nm,ty));break
  res[n]=dict(line=line,jk=round(jk,2),off=round(off,2),len=round(C[-1],2),mangLast=round(last,2),cross=sorted(set(cr)),pts=P)
  print(f"{n:22s} {line} jk {jk:6.2f} len {C[-1]:5.1f} mangrove-to {last:5.2f}  crossings {sorted(set(cr))[:6]}")
json.dump(res,open('side.json','w'))
