#!/usr/bin/env python3
"""Baffle tide model live adjustments -> data/baffle_adj.json (stdlib only; run by push_gauges.sh after update_gauges.py).

Two terms the app adds to the Bundaberg-harmonic along-creek model (see README "Live adjustments"):
  surge  = trailing 25 h mean of (Bundaberg observed - MSQ predicted) [m]; app: gain 1, capped +-0.3 m, all Baffle reaches.
  F      = max(0, Mimdale(t-3 h) - M0), M0 = 10th percentile of hourly Mimdale over the previous 14 d (needs >= 7 d,
           else the available record if >= 3 d) [m]; app: highs += 0.5*F*w(km) on the main channel above the Euleilah
           junction, single-high threshold += F*w/0.423 (lows unchanged).
The hourly series (trailing values = what was known at the time) drives the Gauges hindcast and the validation replay.
It also carries the calibration mask used by refits (cal: 1 = clean period, 0 = fresh or surge affected).
Usage: baffle_adj.py [--data DIR] [--out FILE]"""
import csv, json, os, sys, math, datetime as dt
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EPOCH=dt.datetime(2026,1,1)
P=dict(surge_win_h=25,surge_min_frac=0.7,f_lag_h=3,m0_days=14,m0_min_days=7,m0_floor_days=3,m0_pct=10,
       gain=1.0,cap=0.3,kH=0.5,kL=0.0,w_j=16.4,w_span=18.85,w_pow=1.5,sup_div=0.423,
       surge_tau_h=24,surge_cut_h=48,f_tau_h=48,f_cut_h=72,
       mask_fresh=0.05,mask_rise_12h=0.02,mask_surge=0.04,mask_hold_h=24)
def mins(t): return int(round((t-EPOCH).total_seconds()/60))
def rd(fn):
    out=[]
    if not os.path.exists(fn): return out
    for r in csv.reader(open(fn)):
        if not r or r[0].startswith('time'): continue
        try: t=dt.datetime.strptime(r[0],'%Y-%m-%d %H:%M')
        except ValueError: continue
        out.append((t,[float(x) if x not in ('',None) else None for x in r[1:]]))
    out.sort(key=lambda x:x[0]);return out
def pct(a,p):
    a=sorted(a);k=(len(a)-1)*p/100;f=math.floor(k);c=min(len(a)-1,f+1);return a[f]+(a[c]-a[f])*(k-f)
def main():
    a=sys.argv[1:];data=os.path.join(ROOT,'data');out=None
    if '--data' in a: data=a[a.index('--data')+1]
    if '--out' in a: out=a[a.index('--out')+1]
    out=out or os.path.join(data,'baffle_adj.json')
    B=[(t,v[0]-v[1]) for t,v in rd(os.path.join(data,'051011A_bundaberg.csv')) if len(v)>1 and v[0] is not None and v[1] is not None]
    M=[(t,v[0]) for t,v in rd(os.path.join(data,'539132_mimdale.csv')) if v and v[0] is not None]
    minor=None
    try: minor=json.load(open(os.path.join(data,'sysg','flood_class.json')))['stations']['539132']['minor']
    except Exception: pass
    if not B and not M: print('baffle_adj: no data');return
    t0=min(x[0] for x in (B[:1]+M[:1])).replace(minute=0)
    t1=max(x[0] for x in (B[-1:]+M[-1:])).replace(minute=0)
    hrs=[];t=t0
    while t<=t1: hrs.append(t);t+=dt.timedelta(hours=1)
    # Bundaberg residual: trailing and centred 25 h means (10-min data, need >= 70 % coverage)
    import bisect
    bt=[x[0] for x in B];bv=[x[1] for x in B];cs=[0.0]
    for v in bv: cs.append(cs[-1]+v)
    W=dt.timedelta(hours=P['surge_win_h']);need=P['surge_win_h']*6*P['surge_min_frac']
    def mean(a,b):
        i=bisect.bisect_right(bt,a);j=bisect.bisect_right(bt,b);n=j-i
        return (cs[j]-cs[i])/n if n>=need else None
    # Mimdale: hourly step-hold (value <= t, within 6 h)
    mt=[x[0] for x in M];mv=[x[1] for x in M]
    def mim(t):
        i=bisect.bisect_right(mt,t)-1
        return mv[i] if i>=0 and t-mt[i]<=dt.timedelta(hours=6) else None
    mh={h:mim(h) for h in hrs}
    rows=[];flags=[]
    for h in hrs:
        s=mean(h-W,h);sc=mean(h-W/2,h+W/2)
        hist=[mh[x] for x in hrs if h-dt.timedelta(days=P['m0_days'])<=x<=h and mh[x] is not None]
        span=len(hist)/24
        m0=pct(hist,P['m0_pct']) if span>=P['m0_floor_days'] else None
        ml=mim(h-dt.timedelta(hours=P['f_lag_h']));mn=mh[h]
        F=max(0.0,ml-m0) if (ml is not None and m0 is not None) else None
        m12=mim(h-dt.timedelta(hours=12))
        rising=(mn is not None and m12 is not None and mn-m12>P['mask_rise_12h'])
        fresh=(mn is not None and m0 is not None and mn-m0>P['mask_fresh'])
        ss=sc if sc is not None else s
        bad=fresh or rising or (ss is not None and abs(ss)>P['mask_surge'])
        flags.append(bad)
        rows.append([mins(h),None if s is None else round(s,3),None if F is None else round(F,3),None if m0 is None else round(m0,3),mn,1 if fresh else 0,1 if rising else 0,None if sc is None else round(sc,3)])
    hold=P['mask_hold_h']
    for i,r in enumerate(rows):
        r.append(0 if any(flags[max(0,i-hold):i+1]) else 1)
    ls=next((r for r in reversed(rows) if r[1] is not None),None)
    lf=next((r for r in reversed(rows) if r[2] is not None),None)
    lm=M[-1] if M else None
    J={'schema':1,'generated':dt.datetime.now(dt.timezone(dt.timedelta(hours=10))).strftime('%Y-%m-%dT%H:%M+10:00'),
       'epoch':'2026-01-01T00:00+10:00','time_unit':'minutes','params':P,
       'live':{'surge':ls[1] if ls else 0,'surge_t':ls[0] if ls else None,'F':lf[2] if lf else 0,'F_t':lf[0] if lf else None,'M0':lf[3] if lf else None,
               'mimdale':lm[1] if lm else None,'mimdale_t':mins(lm[0]) if lm else None,'mim_minor':minor,
               'flood':bool(lm and minor is not None and lm[1]>=minor)},
       'cols':['t','surge','F','M0','mimdale','fresh','rising','surge_c','cal'],'series':rows}
    tmp=out+'.tmp';json.dump(J,open(tmp,'w'),separators=(',',':'));os.replace(tmp,out)
    L=J['live'];print('baffle_adj: surge %+.3f m @%s, F %.3f m (M0 %s, Mimdale %s), %d h, clean %d h'%(L['surge'] or 0,L['surge_t'],L['F'] or 0,L['M0'],L['mimdale'],len(rows),sum(r[-1] for r in rows)))
if __name__=='__main__': main()
