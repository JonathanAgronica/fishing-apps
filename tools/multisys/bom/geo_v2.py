"""Geocode v2: all tidal/partial stations (classify_v2) + non-tidal stations on rivers that are systems (fresh-flow candidates)."""
import json,re,urllib.request,urllib.parse,time,os,sys
C=json.load(open('classify_v2.json'));OLD=json.load(open('tidal_geo.json'))
cache=json.load(open('geo_cache.json')) if os.path.exists('geo_cache.json') else {}
RIVERS=set(json.load(open('/workspace/multisys/build/rivernames.json')))
def nom(q):
    if q in cache:return cache[q]
    u='https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode({'q':q,'format':'json','limit':3,'countrycodes':'au','viewbox':'151.5,-24.0,153.6,-27.7','bounded':1})
    r=urllib.request.Request(u,headers={'User-Agent':'MacsJacks-research/1.1 (gauge geocoding, one-off)'})
    try:res=json.load(urllib.request.urlopen(r,timeout=30))
    except Exception as e:res=[];print('ERR',e)
    cache[q]=[(float(x['lat']),float(x['lon']),x.get('display_name','')[:80],x.get('type')) for x in res];time.sleep(1.1);return cache[q]
out={}
for k,v in C.items():
    nm=v.get('name') or '';m=re.match(r'(.+?) at (.+?)(?: \((.+)\))?$',nm)
    river=m.group(1).replace(' Mouth','') if m else None
    want=v['cls'] in('tidal','partial') or (v['cls'] in('none','nodata') and v['n']>=5 and river in RIVERS)
    if not want:continue
    if k in OLD and OLD[k].get('geo'):res=OLD[k]['geo']
    else:
        qs=[]
        if m:
            r_,place,road=m.groups()
            if road:qs.append('%s, %s, Queensland'%(road,place))
            qs.append('%s, Queensland'%place)
        else:qs.append(nm.replace(' Tide','')+', Queensland')
        res=None
        for q in qs:
            r=nom(q)
            if r:res=(q,r[0]);break
    out[k]=dict(v,river=river,geo=res)
json.dump(cache,open('geo_cache.json','w'));json.dump(out,open('geo_v2.json','w'),indent=0)
from collections import Counter
print(len(out),Counter(v['cls'] for v in out.values()),'no geo',[k for k,v in out.items() if not v['geo'] and v['cls']!='none'])
