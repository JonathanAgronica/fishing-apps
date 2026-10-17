import sys,urllib.request,urllib.parse,time
def q(query,fn):
  for url in ('https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter','https://maps.mail.ru/osm/tools/overpass/api/interpreter'):
    try:
      req=urllib.request.Request(url,data=urllib.parse.urlencode({'data':query}).encode(),headers={'User-Agent':'MacsBaffleJacks-research/1.0 (fishing app build)'})
      b=urllib.request.urlopen(req,timeout=900).read();open(fn,'wb').write(b);print(fn,len(b),url);return
    except Exception as e:print('ERR',url,e,file=sys.stderr);time.sleep(5)
if __name__=='__main__':q(open(sys.argv[1]).read(),sys.argv[2])
