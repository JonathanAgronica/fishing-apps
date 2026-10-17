"""Baffle Ck side creeks (OSM waterway centrelines, ODbL) + Euleilah Ck upstream extension -> baffle_sides.json.
Tidal limits (est.): first point where the Copernicus 90 m DEM (Open-Meteo) stays >= 12 m for the next 1.5 km
(canopy-biased: the lower Euleilah reads 2-8 m), min 1 km, capped at the mapped length. Source: tools/multisys/osm/baffle_side (in the repo).
usage: python3 make_sides.py [out.json]  (default: src/sides/baffle_sides.json)"""
import json,math,os,sys
HERE=os.path.dirname(os.path.realpath(__file__));REPO=os.path.dirname(os.path.dirname(HERE))
W=REPO+'/tools/multisys/osm/baffle_side/';os.chdir(W)
OUTF=sys.argv[1] if len(sys.argv)>1 else HERE+'/baffle_sides.json'
exec(open(W+'find.py').read())
R=json.load(open(W+'side.json'));P=json.load(open(W+'dem_prof.json'))
def lim_of(n,thr=12,minkm=1.0):
  L=P[n];lim=L[-1][0]
  for k in range(len(L)):
    w=[e for s,e in L if L[k][0]<=s<=L[k][0]+1.5]
    if len(w)>=5 and min(w)>=thr:lim=L[k][0];break
  return max(minkm,min(lim,cum([tuple(p) for p in R[n]['pts']])[-1]))
def trim(Pts,lim):
  C=cum(Pts);out=[Pts[0]]
  for k in range(1,len(Pts)):
    if C[k]<=lim:out.append(Pts[k])
    else:
      f=(lim-C[k-1])/(C[k]-C[k-1]);out.append((Pts[k-1][0]+f*(Pts[k][0]-Pts[k-1][0]),Pts[k-1][1]+f*(Pts[k][1]-Pts[k-1][1])));break
  return out
def simp(Pts,tol=0.012):
  if len(Pts)<3:return Pts
  a,b=Pts[0],Pts[-1];kx=111.32*math.cos(math.radians(a[0]));ky=110.54;best=(0,0)
  for i in range(1,len(Pts)-1):
    p=Pts[i];ax,ay=(a[1]-p[1])*kx,(a[0]-p[0])*ky;bx,by=(b[1]-p[1])*kx,(b[0]-p[0])*ky;dx,dy=bx-ax,by-ay;l2=dx*dx+dy*dy
    t=max(0,min(1,-(ax*dx+ay*dy)/l2)) if l2 else 0;d=math.hypot(ax+t*dx,ay+t*dy)
    if d>best[0]:best=(d,i)
  if best[0]<tol:return [a,b]
  return simp(Pts[:best[1]+1],tol)[:-1]+simp(Pts[best[1]:],tol)
def pa(L,C,s):
  for k in range(1,len(C)):
    if C[k]>=s:f=(s-C[k-1])/max(1e-9,C[k]-C[k-1]);return (L[k-1][0]+f*(L[k][0]-L[k-1][0]),L[k-1][1]+f*(L[k][1]-L[k-1][1]))
  return tuple(L[-1])
IDS={'Duck Creek':'duck','Bottle Creek':'bottle','Mosquito Creek':'mosq','Little Mosquito Creek':'lmosq','Cattle Creek':'cattle','Sleepy Creek':'sleepy',
     'Halfway Creek':'halfway','Manning Creek':'manning','Grevillea Creek':'grev','Sandy Creek':'sandy','Oyster Creek':'oyster'}
out=[]
for n,i in IDS.items():
  r=R[n];pts=[tuple(p) for p in r['pts']]
  par=r['line'];jk=r['jk']
  jp=pa(M,MC,jk) if par=='B' else pa(E,EC,jk-EJ)
  if hav(jp,pts[0])>0.02:pts=[jp]+pts      # connect to the parent centreline
  lim=round(lim_of(n),1);tp=simp(trim(pts,lim))
  out.append(dict(id=i,name=n,short=n.replace(' Creek',' Ck'),parent=par,jk=round(jk,2),len=round(cum(tp)[-1],2),pts=[[round(a,5),round(b,5)] for a,b in tp],
                  src='OSM waterway (ODbL); tidal limit est. from DEM (Copernicus 90 m) ≥12 m'))
# Euleilah upstream extension (beyond the current app line end, 15.06 km up Euleilah)
eu=[tuple(p) for p in R['Euleilah Creek']['pts']];EC2=cum(eu);elim=lim_of('Euleilah Creek')
k0=min(range(len(eu)),key=lambda k:hav(eu[k],tuple(E[-1])))
elim=max(elim,EC2[k0]+0.5)
ext=simp(trim(eu,elim)[k0:])
elimM=EC[-1]+cum(ext)[-1]  # along Euleilah on the app's own line
assert hav(ext[0],tuple(E[-1]))<0.01,hav(ext[0],tuple(E[-1]))
json.dump(dict(sides=out,euExt=[[round(a,5),round(b,5)] for a,b in ext[1:]],euCalEnd=round(EJ+EC[-1],2),euLim=round(elimM,2)),open(OUTF,'w'),separators=(',',':'))
for o in out:print('%-22s %-7s %s jk %6.2f len %5.2f pts %d'%(o['name'],o['id'],o['parent'],o['jk'],o['len'],len(o['pts'])))
print('Euleilah ext pts',len(ext)-1,'old end mouth-km %.2f, new limit %.1f km up Euleilah = mouth-km %.2f'%(EJ+EC[-1],elimM,EJ+elimM))
