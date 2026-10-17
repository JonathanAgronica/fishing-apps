import json,os,time,urllib.request,re,sys
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
S=json.load(open('stations.json'));seen=set();n=0
for s in S:
  b,tab,sid=s[0],s[1],s[2]
  if sid in seen:continue
  seen.add(sid)
  if b=='60289' and not re.search(r'Baffle|Euleilah|Three Mile|Oyster|Gladstone|Auckland',s[3] if len(s)>3 else ''):continue
  fn='tbl2/%s.html'%sid
  if os.path.exists(fn) and os.path.getsize(fn)>2000:continue
  for k in range(2):
    try:
      r=urllib.request.Request('https://www.bom.gov.au/fwo/%s/%s.%s.tbl.shtml'%(tab,tab,sid),headers={'User-Agent':UA,'Referer':'https://www.bom.gov.au/qld/flood/','Accept-Language':'en-AU,en;q=0.9'})
      open(fn,'wb').write(urllib.request.urlopen(r,timeout=40).read());n+=1;break
    except Exception as e:print('ERR',sid,e,flush=True);time.sleep(3)
  time.sleep(0.8)
print('done',n,flush=True)
