import json,datetime as dt,collections
TZ=dt.timezone(dt.timedelta(hours=10))
f=lambda ms:dt.datetime.fromtimestamp(ms/1000,TZ)
ft=lambda ms:f(ms).strftime('%-I:%M%p').lower()
def load(fn): return [json.loads(l) for l in open(fn)]
import sys
R=load('scan.jsonl')
LM=json.load(open('lm.json'))
def near(km):
    l=min(LM,key=lambda l:abs(l['km']-km));return l['name'] if abs(l['km']-km)<1.2 else f"km {km:g} (nr {l['name']})"
# theoretical
print('max uncapped:',max(r['best']['unc'] for r in R))
print('spot-days reaching 100:',sum(r['best']['score']>=100 for r in R),'of',len(R),'; dates with any 100:',len({r['date'] for r in R if r['best']['score']>=100}))
# best per date
by=collections.defaultdict(list)
for r in R: by[r['date']].append(r)
days=[]
for d,L in by.items():
    b=max(L,key=lambda r:r['best']['unc']);days.append(b)
days.sort(key=lambda r:-r['best']['unc'])
def row(r):
    b=r['best'];ri=' '.join(ft(x['t'])+('r' if x['k']=='rise' else '')+'±'+str(x['u']) for x in r['runIns'])
    # spread of spots within 2 pts of best that day
    L=[x for x in by[r['date']] if x['best']['unc']>=r['best']['unc']-3]
    span=f"{min(x['km'] for x in L):g}–{max(x['km'] for x in L):g}"
    return f"{f(b['t']).strftime('%a %d %b %Y')} | {ft(b['t'])} | {b['score']} ({b['unc']}) | {near(r['km'])} [{span} km within 3] | {r['phase']} {int(r['illum']*100)}% | {b['L']} | {b['T']} | {b['S'] or '-'} | TF {b['TF']} | rating {r['rating']}"
print('\nTOP 15 days (neutral weather, seasonal SST):')
for r in days[:15]: print(row(r))
print('\nBest per month:')
mon=collections.defaultdict(list)
for r in days: mon[r['date'][:7]].append(r)
for m in sorted(mon): print(row(max(mon[m],key=lambda r:r['best']['unc'])))
# patterns: for top 40 days, phase & km & light & solunar
print('\npattern among top 40 days:')
c=collections.Counter();ck=collections.Counter();cl=collections.Counter();cs=collections.Counter()
for r in days[:40]:
    c[r['phase']]+=1;ck[(5 if r['km']<5 else 15 if r['km']<20 else 25 if r['km']<30 else 35)]+=1;cl[r['best']['L']]+=1;cs[r['best']['S'][:12]]+=1
print(c.most_common(),ck.most_common(),cl.most_common(),cs.most_common())
# where the sweet spot is through lunar cycle: by phase, mean km of daily best
pk=collections.defaultdict(list)
for r in days: pk[r['phase']].append((r['km'],r['best']['unc'],f(r['best']['t']).hour))
for p,v in pk.items(): 
    import statistics as s
    print(p,len(v),'median km',s.median(x[0] for x in v),'mean best',round(s.mean(x[1] for x in v),1),'hours',collections.Counter(x[2] for x in v).most_common(4))
