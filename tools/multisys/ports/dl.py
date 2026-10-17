import json,urllib.request,os,re
from concurrent.futures import ThreadPoolExecutor
P=['gladstone-auckland-point','bundaberg','urangan','kingfisher-bay-jetty','tin-can-bay-snapper-creek','noosa-head','mooloolaba','military-jetty-pumicestone-passage','scarborough','shorncliffe','deep-water-bend-pine-river','brisbane-bar','pinkenba','port-office-brisbane-river','waddy-point-k-gari','burnett-heads']
jobs=[]
for p in P:
  for kind in ('predicted-interval-data','predicted-high-low-data'):
    try:d=json.load(urllib.request.urlopen('https://www.data.qld.gov.au/api/3/action/package_show?id=%s-tide-gauge-%s'%(p,kind)))
    except Exception as e: print('ERR',p,kind,e);continue
    for r in d['result']['resources']:
      m=re.search(r'(2026|2027)',r['name']+r['url'].rsplit('/',1)[-1])
      if m and r.get('datastore_active'):
        jobs.append(('%s_%s_%s.json'%(p,'10min' if 'interval' in kind else 'hilo',m.group(1)),r['id']))
def get(j):
  fn,rid=j
  if os.path.exists(fn):return
  recs=[];off=0
  while True:
    d=json.load(urllib.request.urlopen('https://www.data.qld.gov.au/api/3/action/datastore_search?resource_id=%s&limit=32000&offset=%d'%(rid,off)))['result']
    recs+=d['records'];off+=len(d['records'])
    if not d['records'] or off>=d['total']:break
  json.dump([[r.get('Date'),r.get('Time'),r.get('Reading') or r.get('Height') ,r.get('Ind') or r.get('Type') or ''] for r in recs],open(fn,'w'))
  print(fn,len(recs),list(recs[0].keys()) if recs else None,flush=True)
with ThreadPoolExecutor(6) as ex: list(ex.map(get,jobs))
