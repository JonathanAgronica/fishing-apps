import json,re,urllib.request,urllib.parse,time,os
C=json.load(open('classify.json'))
T={k:v for k,v in C.items() if v.get('tidal') and v['n']>=100 and v['r2']>=0.5}
cache=json.load(open('geo_cache.json')) if os.path.exists('geo_cache.json') else {}
def nom(q):
    if q in cache:return cache[q]
    u='https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode({'q':q,'format':'json','limit':3,'countrycodes':'au','viewbox':'151.5,-24.0,153.6,-27.7','bounded':1})
    r=urllib.request.Request(u,headers={'User-Agent':'MacsBaffleJacks-research/1.0 (gauge geocoding, one-off)'})
    try:res=json.load(urllib.request.urlopen(r,timeout=30))
    except Exception as e:res=[];print('ERR',e)
    cache[q]=[(float(x['lat']),float(x['lon']),x.get('display_name','')[:80],x.get('type')) for x in res];time.sleep(1.2);return cache[q]
out={}
for k,v in T.items():
    nm=v['name'];m=re.match(r'(.+?) at (.+?)(?: \((.+)\))?$',nm)
    qs=[]
    if m:
        river,place,road=m.groups()
        if road:qs.append('%s, %s, Queensland'%(road,place))
        qs.append('%s, Queensland'%place)
    else:
        qs.append(nm.replace(' Tide','')+', Queensland')
    res=None
    for q in qs:
        r=nom(q)
        if r:res=(q,r[0]);break
    out[k]=dict(name=nm,tab=v['tab'],river=m.group(1) if m else None,geo=res,m2=v['m2'],r2=v['r2'],n=v['n'])
    print(k,nm,'->',res)
json.dump(cache,open('geo_cache.json','w'));json.dump(out,open('tidal_geo.json','w'),indent=0)
