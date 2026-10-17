import json,datetime as dt,collections
TZ=dt.timezone(dt.timedelta(hours=10));f=lambda ms:dt.datetime.fromtimestamp(ms/1000,TZ);ft=lambda ms:f(ms).strftime('%-I:%M%p').lower()
LM=json.load(open('lm.json'))
def near(km):
    l=min(LM,key=lambda l:abs(l['km']-km));return l['name'] if abs(l['km']-km)<1.2 else f"km {km:g} (nr {l['name']})"
R=[json.loads(l) for l in open('scan.jsonl')];W=[json.loads(l) for l in open('scan_wx.jsonl')]
N={(r['date'],r['km']):r for r in R}
by=collections.defaultdict(list)
for r in W: by[r['date']].append(r)
print('NEXT 14 DAYS with real Open-Meteo weather (+SST to 18 Oct):')
for d in sorted(by):
    b=max(by[d],key=lambda r:r['best']['unc']);n=max((N[(d,r['km'])] for r in by[d]),key=lambda r:r['best']['unc'])
    x=b['best'];print(f"{f(x['t']).strftime('%a %d %b')} | {ft(x['t'])} | {x['score']} ({x['unc']}) | {near(b['km'])} | {x['T']} | {x['S'] or '-'} | {x['L']} | SST {x['sst'] and round(x['sst'],1)} TF {x['TF']} | WX {x['WX']} {';'.join(x['wxn'])} | neutral-wx best {n['best']['unc']} @ {near(n['km'])}")
# dates with 100 per month (neutral)
c=collections.Counter(r['date'][:7] for r in {r['date']:r for r in R if r['best']['score']>=100}.values())
print('\n100-days per month:',sorted(c.items()))
# Hills Rd / Euleilah and Essendean best
for km,name in ((25.24,'Hills Rd'),(16.38,'Euleilah jn'),(35.25,'Essendean'),(15.87,'Wartburg')):
    L=sorted([r for r in R if abs(r['km']-km)<0.02],key=lambda r:-r['best']['unc'])[:4]
    print(name,[(r['date'],ft(r['best']['t']),r['best']['score'],r['best']['unc'],r['phase'],r['best']['S'][:18]) for r in L])
# moon-phase relation detail: at new/full lower creek dawn; quarter upper creek dusk
