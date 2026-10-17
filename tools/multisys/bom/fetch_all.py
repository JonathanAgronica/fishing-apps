import json,os,time,urllib.request,re
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
S=json.load(open('stations.json'));seen=set()
for s in S:
  b,tab,sid=s[0],s[1],s[2]
  if sid in seen:continue
  seen.add(sid)
  if b=='60289' and not re.search(r'Baffle|Euleilah|Three Mile|Oyster|Gladstone|Auckland',s[3] if len(s)>3 else ''):continue
  fn='tbl/%s.html'%sid
  if os.path.exists(fn):continue
  try:
    r=urllib.request.Request('https://www.bom.gov.au/fwo/%s/%s.%s.tbl.shtml'%(tab,tab,sid),headers={'User-Agent':UA,'Referer':'https://www.bom.gov.au/qld/flood/'})
    open(fn,'wb').write(urllib.request.urlopen(r,timeout=60).read())
  except Exception as e:print('ERR',sid,e,flush=True)
  time.sleep(1.2)
print('done',len(seen))
