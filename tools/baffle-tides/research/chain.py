import json,math
d=json.load(open('osm_baffle.json'))
main=[e for e in d['elements'] if e['id']==837497710][0]['geometry']
pts=[(p['lat'],p['lon']) for p in main][::-1]  # mouth first
def hav(a,b):
    R=6371008.8;la1,lo1,la2,lo2=map(math.radians,(a[0],a[1],b[0],b[1]))
    return 2*R*math.asin(math.sqrt(math.sin((la2-la1)/2)**2+math.cos(la1)*math.cos(la2)*math.sin((lo2-lo1)/2)**2))
cum=[0]
for i in range(1,len(pts)):cum.append(cum[-1]+hav(pts[i-1],pts[i]))
def proj(lat,lon):
    best=(1e18,0,None)
    kx=111320*math.cos(math.radians(lat));ky=110540
    for i in range(len(pts)-1):
        ax,ay=(pts[i][1]-lon)*kx,(pts[i][0]-lat)*ky;bx,by=(pts[i+1][1]-lon)*kx,(pts[i+1][0]-lat)*ky
        dx,dy=bx-ax,by-ay;L=dx*dx+dy*dy;t=max(0,min(1,-(ax*dx+ay*dy)/L)) if L else 0
        px,py=ax+t*dx,ay+t*dy;dd=math.hypot(px,py)
        if dd<best[0]:best=(dd,cum[i]+t*(cum[i+1]-cum[i]),(pts[i][0]+t*(pts[i+1][0]-pts[i][0]),pts[i][1]+t*(pts[i+1][1]-pts[i][1])))
    return best
print('total km',cum[-1]/1000, 'npts',len(pts))
L=[('Mouth (entrance)',pts[0][0],pts[0][1],'OSM way 837497710 end'),
('Rules Beach (hamlet)',-24.49397,152.037,'OSM place'),
('Slipway near Flat Rock Rd',-24.51141,152.02153,'OSM slipway 3100213199'),
('Rocky Point boat ramp',-24.51688,152.01379,'OSM slipway 3106934192; WMIP 1340046'),
('Winfield village slipway',-24.53198,152.02702,'OSM slipway 3106935244'),
('MSQ Baffle Ck (Winfield) tidal station',-24.5333,152.0333,'MSQ tidal planes 24 32S 152 02E (1 arc-min precision)'),
('Baffle Ck Caravan Park slipway',-24.51187,152.00208,'OSM slipway 3100213207'),
('Newton Rd (WMIP 1340008)',-24.515097,151.974167,'WMIP site'),
('Wartburg / Boat Ramp Rd',-24.50612,151.92949,'OSM road end'),
('Essendean Bridge (Tableland Rd) gauge',-24.601073,151.844864,'BoM 039267 / WMIP 1340040'),
('Christensens (WMIP 1340002)',-24.6022143,151.8216455,'WMIP'),
('Mimdale gauge (Gorge Rd)',-24.513631,151.736280,'BoM 539132 / WMIP 134001B'),
]
tri=json.load(open('osm_trib.json'))['elements']
for t in tri:
    g=t['geometry'];best=None
    for end in (g[0],g[-1]):
        r=proj(end['lat'],end['lon'])
        if best is None or r[0]<best[0]:best=r+(end,)
    L.append((t['tags']['name']+' junction',best[3]['lat'],best[3]['lon'],'OSM way %d endpoint'%t['id']))
res=[]
for n,la,lo,src in L:
    dd,ch,sn=proj(la,lo);res.append(dict(name=n,lat=la,lon=lo,chain_km=round(ch/1000,2),off_m=round(dd),src=src))
for r in sorted(res,key=lambda r:r['chain_km']):print(r)
json.dump(dict(line=[[round(a,5),round(b,5)] for a,b in pts],cum=[round(c) for c in cum],landmarks=sorted(res,key=lambda r:r['chain_km'])),open('chainage.json','w'))
