#!/usr/bin/env python3
"""30-day refit of the Baffle along-creek gauge nodes (Hills Rd 539135, Essendean 039267) from the hourly archive.
Reads data/gauges.json (observed HW/LW events matched to Bundaberg highs/lows) and data/baffle_adj.json (calibration mask).

Calibration rule (README "Live adjustments"): periods affected by fresh or coastal surge are EXCLUDED (default) or
down-weighted (--weight W, e.g. 0.2), so the static node fit describes dry, calm conditions and the live adjustment
terms carry the rest. An hour is flagged when, in it or the previous 24 h,
  - Mimdale is > 0.05 m above its dry baseline M0 (14-day 10th percentile), or rising > 0.02 m in 12 h, or
  - |Bundaberg 25 h mean residual| > 0.04 m (centred mean where available).
Prints proposed lag / level-regression values next to the ones in the app (NODES in the Baffle core); it does not edit the app.
usage: refit_nodes.py [--days 30] [--weight 0] [--data DIR]"""
import json, os, sys, math
a=sys.argv[1:];arg=lambda k,d:type(d)(a[a.index(k)+1]) if k in a else d
DATA=arg('--data',os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','data'));DAYS=arg('--days',30);WBAD=arg('--weight',0.0)
G=json.load(open(os.path.join(DATA,'gauges.json')));J=json.load(open(os.path.join(DATA,'baffle_adj.json')))
ic=J['cols'].index('cal');S=J['series'];T=[r[0] for r in S]
def calw(m):
    import bisect
    i=bisect.bisect_right(T,m)-1
    if i<0: return 1.0
    return 1.0 if S[i][ic] else WBAD
APP={'hillsrd':dict(HW_lag=179,LW_lag=277,HW=(-0.981,0.613),LW=(0.225,-0.220)),'essendean':dict(HW_lag=339,LW_lag=415,HW=(-0.520,0.423),LW=(0.738,-0.384))}
def wfit(x,y,w):
    sw=sum(w)
    if sw<=0 or len(x)<3: return None
    mx=sum(wi*xi for wi,xi in zip(w,x))/sw;my=sum(wi*yi for wi,yi in zip(w,y))/sw
    sxx=sum(wi*(xi-mx)**2 for wi,xi in zip(w,x));sxy=sum(wi*(xi-mx)*(yi-my) for wi,xi,yi in zip(w,x,y))
    b=sxy/sxx if sxx>1e-9 else 0.0;return my-b*mx,b
last=max(G['series'][k][-1][0] for k in ('essendean','hillsrd'))
for gk in ('hillsrd','essendean'):
    print(f'\n{gk}: last {DAYS} d, flagged periods weight {WBAD}')
    for k in ('HW','LW'):
        ev=[e for e in G['events'][gk] if e['k']==k and e['t']>=last-DAYS*1440 and e.get('lag') is not None]
        w=[calw(e['t']) for e in ev];n=sum(1 for x in w if x>0)
        if n<3: print(f'  {k}: only {n} usable events — keep the app values');continue
        sw=sum(w);lag=sum(wi*e['lag'] for wi,e in zip(w,ev))/sw
        f=wfit([e['bh'] for e in ev],[e['v'] for e in ev],w)
        app=APP[gk]
        print(f"  {k}: n {n}/{len(ev)} used; lag {lag:.0f} min (app {app[k+'_lag']}); level = {f[0]:+.3f} {f[1]:+.3f}·Bundaberg (app {app[k][0]:+.3f} {app[k][1]:+.3f})")
