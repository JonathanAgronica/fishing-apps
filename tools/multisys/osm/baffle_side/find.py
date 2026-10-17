import os
import json,math,collections
s=open(os.path.join(os.path.dirname(os.path.abspath('find.py')),'../../../../src/upstream/baffle-tides/index.html')).read()
i=s.index('window.BAFFLE_DATA=')+len('window.BAFFLE_DATA=');j=s.index('</script>',i);D=json.loads(s[i:j].rstrip().rstrip(';'))
M=D['main'];E=D['euleilah'];EJ=D['euleilahJunctionKm']
def hav(a,b):
  R=6371;p1,p2=math.radians(a[0]),math.radians(b[0]);dp=p2-p1;dl=math.radians(b[1]-a[1])
  return 2*R*math.asin(math.sqrt(math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2))
def cum(L):
  c=[0]
  for k in range(1,len(L)):c.append(c[-1]+hav(L[k-1],L[k]))
  return c
MC=cum(M);EC=cum(E)
def proj(L,C,p):
  kx=111.32*math.cos(math.radians(p[0]));ky=110.54;best=(1e9,0)
  for k in range(len(L)-1):
    ax=(L[k][1]-p[1])*kx;ay=(L[k][0]-p[0])*ky;bx=(L[k+1][1]-p[1])*kx;by=(L[k+1][0]-p[0])*ky
    dx,dy=bx-ax,by-ay;l2=dx*dx+dy*dy;t=max(0,min(1,-(ax*dx+ay*dy)/l2 if l2 else 0))
    d=math.hypot(ax+t*dx,ay+t*dy)
    if d<best[0]:best=(d,C[k]+t*(C[k+1]-C[k]))
  return best
d=json.load(open('ways.json'))
ww=[e for e in d['elements'] if e['type']=='way' and 'waterway' in e.get('tags',{}) and e['tags']['waterway'] in('river','stream','tidal_channel','canal')]
by=collections.defaultdict(list)
for e in ww:by[e['tags'].get('name','(unnamed)')].append(e)
