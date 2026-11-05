#!/usr/bin/env python3
"""Refit the Baffle along-creek gauge nodes (Hills Rd 539135, Essendean 039267) from the hourly archive.

Reads data/gauges.json (observed HW/LW events matched to Bundaberg highs/lows) and data/baffle_adj.json (the live
surge/fresh series the app adds on top of the nodes, plus the calibration mask).

The fit mirrors what the app actually does, so the new node values absorb only what the live terms don't:
  v - surge - kX*F*w(km)  =  a + b*Bundaberg
with w = ((km-16.4)/18.85)^1.5 clipped 0..1, kH/kL the highs/lows fresh coefficients from the adj params, and
surge clamped to +-cap (and floored at 0 on truncated pool-level lows, as adj.dh does). Essendean's lows are
censored at the node's floor: events sitting on it carry no information about a and b, so they are left out.
Lags come from a straight-line fit of observed lag against F, read at F = 0 (fresh flow advances the turn, so the raw
mean is biased late after a fresh); the median of the dry, calm events (F < 0.2 m, |surge| < 0.04 m) is printed too.
--weight W down-weights fresh/surge-flagged hours (the cal column) instead of dropping them.

Prints the proposed values next to the ones in the app; it does not edit the app. Treat them as a starting point:
adj_validate.mjs (which replays the whole archive through the built model, including the lag change) is the arbiter,
and the values adopted on 5 Nov 2026 sit between this fit's lags and the dry median.
usage: refit_nodes.py [--days 34] [--weight 0] [--data DIR]
"""
import json, os, sys
a=sys.argv[1:];arg=lambda k,d:type(d)(a[a.index(k)+1]) if k in a else d
DATA=arg('--data',os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','data'));DAYS=arg('--days',34);WBAD=arg('--weight',0.0)
G=json.load(open(os.path.join(DATA,'gauges.json')));J=json.load(open(os.path.join(DATA,'baffle_adj.json')))
P=J['params'];C=J['cols'];S=J['series'];T=[r[0] for r in S]
iS=C.index('surge');iF=C.index('F');ic=C.index('cal')
APP={'hillsrd':dict(HW_lag=178,LW_lag=264,HW=(-0.900,0.585),LW=(0.202,-0.158)),
     'essendean':dict(HW_lag=332,LW_lag=424,HW=(-0.544,0.437),LW=(0.640,-0.226))}
FLOOR=0.37
def at(col,t):
    if t<T[0]: return 0.0
    if t>=T[-1]: return S[-1][col] or 0.0
    lo,hi=0,len(T)-1
    while hi-lo>1:
        m=(lo+hi)//2
        if T[m]<=t: lo=m
        else: hi=m
    x,y=S[lo][col] or 0.0,S[hi][col] or 0.0
    return x+(y-x)*(t-T[lo])/(T[hi]-T[lo])
def wgt(t):
    i=0
    while i<len(T)-1 and T[i+1]<=t: i+=1
    return 1.0 if S[i][ic] else WBAD
def w_of(km): return max(0.0,min(1.0,(km-P['w_j'])/P['w_span']))**P['w_pow']
def wfit(x,y,w):
    sw=sum(w)
    if sw<=0 or len(x)<3: return None
    mx=sum(wi*xi for wi,xi in zip(w,x))/sw;my=sum(wi*yi for wi,yi in zip(w,y))/sw
    sxx=sum(wi*(xi-mx)**2 for wi,xi in zip(w,x));sxy=sum(wi*(xi-mx)*(yi-my) for wi,xi,yi in zip(w,x,y))
    return (my-sxy/sxx*mx,sxy/sxx) if sxx>1e-9 else (my,0.0)
def live(km,hi,t):
    s=max(-P['cap'],min(P['cap'],at(iS,t)))
    km_=km;trunc=km>=35.25-1e-9
    if trunc and not hi and s<0: s=0.0
    f=(P['kH'] if hi else P['kL'])*at(iF,t)*w_of(km)
    return s+f
last=max(G['series'][k][-1][0] for k in ('essendean','hillsrd'))
for gk,km in (('hillsrd',25.24),('essendean',35.25)):
    print(f'\n{gk} @ {km} km: last {DAYS} d, flagged hours weight {WBAD}')
    app=APP[gk]
    for k in ('HW','LW'):
        hi=(k=='HW')
        ev=[e for e in G['events'][gk] if e['k']==k and e['t']>=last-DAYS*1440 and e.get('lag') is not None]
        w=[wgt(e['t']) for e in ev]
        dry=[e for e in ev if at(iF,e['t'])<0.2 and abs(at(iS,e['t']))<0.04 and wgt(e['t'])>0]
        lg=wfit([at(iF,e['t']) for e in ev],[e['lag'] for e in ev],[wgt(e['t']) for e in ev])
        lag=lg[0] if lg else None; dmed=sorted(e['lag'] for e in dry)[len(dry)//2] if dry else None
        xs=[];ys=[];ws=[]
        for e in ev:
            y=e['v']-live(km,hi,e['t'])
            if km>=35.25-1e-9 and not hi:
                # censored at the floor: only informative when the model would sit above it
                cur=app[k][0]+app[k][1]*e['bh']
                if cur<=FLOOR+1e-9 and y<=FLOOR+0.02: continue
            xs.append(e['bh']);ys.append(y);ws.append(wgt(e['t']))
        f=wfit(xs,ys,ws)
        if f is None: print(f'  {k}: too few usable events — keep the app values');continue
        la=(f'lag {lag:.0f} min at F=0 (dry median {dmed:.0f}; app {app[k+"_lag"]})' if lag and dmed
            else f'lag n/a (app {app[k+"_lag"]})')
        print(f'  {k}: n {len(xs)}/{len(ev)} used; {la}; level = {f[0]:+.3f} {f[1]:+.3f}·Bundaberg (app {app[k][0]:+.3f} {app[k][1]:+.3f})')
