#!/usr/bin/env python3
"""Mac's Jacks: flood-cycle state per river system -> data/flood_state.json (for notifications).
Same rules as the app's bite score (MJ.floodState / floodAdj): latest rise on each system's fresh-flow gauge
(Baffle: data/539132_mimdale.csv + data/gauges.json; others: data/sysg/arch/<id>/*.csv), BoM flood classes from
data/sysg/flood_class.json. Big flood = peak >= moderate class (or >= 3 m rise without classes); otherwise light flood/runoff.
Phases (days after the big-flood peak): rising/dirty (<4 d), clearing (4-7), PRIME (7-14), tapering (14-21).
Light flood/runoff: good from onset for ~10-14 days. 'entering_prime' = a system whose prime window starts within the
next 24 h or started in the last 24 h -> lists them in 'alerts'. Stdlib only; read-only except the output file.
Usage: python3 scripts/flood_state.py [--now ISO] [--out PATH]"""
import argparse, csv, datetime as dt, glob, json, os
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
E0 = dt.datetime(2026, 1, 1); DAY = 1440
def lerp(x, x0, x1, y0, y1): f = max(0.0, min(1.0, (x - x0) / (x1 - x0))); return y0 + (y1 - y0) * f
def state(M, cls, now):
    M = sorted((m, v) for m, v in M.items())
    if len(M) < 3: return {'kind': 'nodata', 'known': False}
    first, last = M[0][0], M[-1][0]; span = (last - first) / DAY
    if now - last > 3 * DAY: return {'kind': 'stale', 'known': False, 'span_days': round(span, 1)}
    rec = sorted(v for m, v in M if m >= last - 30 * DAY); base = rec[int(len(rec) * 0.1)]
    C = cls if cls and cls.get('minor') is not None else None
    light_thr = max(0.3, 0.05 * (C['minor'] - base)) if C else 0.3
    big_lvl = (C['moderate'] if C.get('moderate') is not None else C['minor']) if C else None
    jump = max(0.3, 0.6 * light_thr); K = []
    for i, (m, v) in enumerate(M):
        if 0 < i < len(M) - 1 and m - M[i-1][0] <= 720 and M[i+1][0] - m <= 720:
            hi = max(M[i-1][1], M[i+1][1])
            if v - hi > jump and abs(M[i-1][1] - M[i+1][1]) < 0.5 * (v - hi): continue
        K.append((m, v))
    M = K
    segs = []; seg = None
    for m, v in M:
        if v - base >= 0.6 * light_thr:
            if seg and m - seg['e'] <= DAY:
                seg['e'] = m
                if v > seg['pk']: seg['pk'], seg['pt'] = v, m
            else: seg = {'s': m, 'e': m, 'pk': v, 'pt': m}; segs.append(seg)
    ev = [g for g in segs if g['pk'] - base >= light_thr]
    out = {'known': True, 'span_days': round(span, 1), 'base': round(base, 2), 'level': M[-1][1]}
    if not ev:
        out['kind'] = 'none'
        if span < 21: out['known'] = False; out['note'] = f'gauge history only {span:.0f} days - cannot rule out a flood 1-3 weeks ago'
        return out
    ev = ev[-1]; big = ev['pk'] >= big_lvl if big_lvl is not None else ev['pk'] - base >= 3.0
    pre = [v for m, v in M if ev['pt'] - 3 * DAY <= m < ev['pt']]
    if not (pre and min(pre) <= ev['pk'] - light_thr):
        at_start = ev['s'] <= first + 360; big_start = ev['pk'] >= C['minor'] if C else ev['pk'] - base >= 3.0
        if not (at_start and big_start):
            out['kind'] = 'none'; out['known'] = span >= 21 and not at_start
            if not out['known']: out['note'] = (f'record ({span:.0f} days) starts {ev["pk"]-base:.2f} m above base and falls - earlier rise not in record' if at_start else f'gauge history only {span:.0f} days - cannot rule out a flood 1-3 weeks ago')
            return out
    on = ev['s']
    for m, v in M:
        if m > ev['pt']: break
        if m >= ev['s'] - 3 * DAY and v - base >= 0.25 * (ev['pk'] - base): on = m; break
    out.update(kind='big' if big else 'light', peak=ev['pk'], peak_aest=(E0 + dt.timedelta(minutes=ev['pt'])).strftime('%Y-%m-%d %H:%M'),
               onset_aest=(E0 + dt.timedelta(minutes=on)).strftime('%Y-%m-%d %H:%M'), peak_min=ev['pt'], onset_min=on, peak_at_record_start=ev['s'] <= first + 360)
    return out
def phase(S, now):
    if S.get('kind') == 'light':
        d = (now - S['onset_min']) / DAY
        return ('runoff' if 0 <= d < 14 else None), d
    if S.get('kind') == 'big':
        d = (now - S['peak_min']) / DAY
        return ('rising' if d < 0 else 'dirty' if d < 4 else 'clearing' if d < 7 else 'prime' if d <= 14 else 'tapering' if d < 21 else None), d
    return None, None
def series_baffle():
    M = {}
    p = os.path.join(REPO, 'data', '539132_mimdale.csv')
    if os.path.exists(p):
        for r in csv.DictReader(open(p)):
            try: M[int(round((dt.datetime.strptime(r['time_aest'], '%Y-%m-%d %H:%M') - E0).total_seconds() / 60))] = float(r['level_m'])
            except (ValueError, KeyError): pass
    try:
        for m, v in json.load(open(os.path.join(REPO, 'data', 'gauges.json')))['series'].get('mimdale', []): M[int(m)] = float(v)
    except Exception: pass
    return M
def series_arch(sid):
    M = {}
    for f in sorted(glob.glob(os.path.join(REPO, 'data', 'sysg', 'arch', sid, '*.csv'))):
        for line in open(f):
            if not line.strip() or line[0] == '#': continue
            p = line.strip().split(',')
            try: M[int(p[0])] = float(p[1])
            except (ValueError, IndexError): pass
    return M
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--now'); ap.add_argument('--out', default=os.path.join(REPO, 'data', 'flood_state.json')); a = ap.parse_args()
    nowdt = dt.datetime.fromisoformat(a.now) if a.now else dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) + dt.timedelta(hours=10)
    now = (nowdt.replace(tzinfo=None) - E0).total_seconds() / 60
    try: FC = json.load(open(os.path.join(REPO, 'data', 'sysg', 'flood_class.json')))['stations']
    except Exception: FC = {}
    systems = {'baffle': ('539132', 'Baffle Ck @ Mimdale', series_baffle())}
    for f in sorted(glob.glob(os.path.join(REPO, 'data', 'systems', '*.json'))):
        try: S = json.load(open(f))
        except Exception: continue
        fr = S.get('fresh')
        if fr and fr.get('id'): systems[S['id']] = (fr['id'], fr.get('name', ''), None)
    out = {'generated_aest': nowdt.strftime('%Y-%m-%dT%H:%M+10:00'), 'rules': 'big flood: dirty <4 d, clearing 4-7 d, PRIME 7-14 d, tapering 14-21 d after peak; light flood/runoff: good 0-14 d from onset', 'systems': {}, 'alerts': []}
    cache = {}
    for sysid, (gid, gname, M) in systems.items():
        if M is None: M = cache.setdefault(gid, series_arch(gid))
        S = state(M, FC.get(gid), now); ph, d = phase(S, now)
        rec = {'gauge': gid, 'gauge_name': gname, **{k: v for k, v in S.items() if not k.endswith('_min')}, 'phase': ph, 'day': None if d is None else round(d, 1)}
        if S.get('kind') == 'big':
            ps = S['peak_min'] + 7 * DAY
            rec['prime_from_aest'] = (E0 + dt.timedelta(minutes=ps)).strftime('%Y-%m-%d'); rec['prime_to_aest'] = (E0 + dt.timedelta(minutes=ps + 7 * DAY)).strftime('%Y-%m-%d')
            rec['entering_prime'] = abs(now - ps) <= DAY
            if rec['entering_prime']: out['alerts'].append({'system': sysid, 'msg': f"{sysid}: prime post-flood window (day 7-14 after the {S['peak']:.1f} m peak on {gname}) from {rec['prime_from_aest']} to {rec['prime_to_aest']}"})
        out['systems'][sysid] = rec
    json.dump(out, open(a.out, 'w'), indent=1)
    n = {}
    for r in out['systems'].values(): n[r.get('phase') or r['kind']] = n.get(r.get('phase') or r['kind'], 0) + 1
    print(f"flood_state: {len(out['systems'])} systems {n}; alerts {len(out['alerts'])}")
if __name__ == '__main__': main()
