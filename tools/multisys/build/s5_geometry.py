#!/usr/bin/env python3
"""Per-system builder, geometry stage (recreated 2026-10-18; the original s1..s5 builder scripts were lost in the
2026-10-17 box restore). Rebuilds every system's channel polylines from the statewide OSM waterway snapshot
(osm/ww.json.gz = Overpass query osm/q_ww.txt, fetched 2026-10 with osm/op.py) and compares them with the published
data in out/systems/*.json.

Recipe (reverse-engineered; reproduces most lines exactly, see the report):
  main line M : OSM ways carrying the river's name chained end-to-end from the way end nearest the mouth,
                first vertex replaced by the published mouth point, cut at the tidal limit, Douglas-Peucker 12 m, 5 dp
  tributary T : side_creeks.build_side(parent, OSM chain by name from the end nearest the parent, limit)
NOT recreated (needs the lost calibration code + transient inputs): tide nodes/lags/heights from MSQ 2025 tidal planes
(tools/baffle-tides/research/planes2025.txt) and port harmonics (ports/harm_ports.json), BoM/DES gauge fits
(7-14 day tables, not re-downloadable for the original dates), generic extrapolation, landmarks, confidence grades.
Those values are kept verbatim in out/systems/*.json, which is the canonical source used by src/build.py.

usage: python3 s5_geometry.py [system-id ...]   # report only; never writes out/
"""
import sys, os, gzip, json, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from side_creeks import *

def osm_by_name():
    p = f'{OSM}/ww.json.gz'
    data = json.load(gzip.open(p, 'rt', encoding='utf-8')) if os.path.exists(p) else load('/workspace/multisys/osm/ww.json')
    by = collections.defaultdict(list)
    for e in data['elements']:
        if e['type'] == 'way' and e.get('geometry') and e.get('tags', {}).get('name'): by[e['tags']['name']].append(e)
    return by

def main_line(L, ws):
    st = L['coords'][0]
    ends = [p for w in ws for p in (way_pts(w)[0], way_pts(w)[-1])]; s0 = min(ends, key=lambda p: hav(p, st))
    P = chain_by_name(ws, s0)
    outs = []
    for PP in ([st] + (P[1:] if hav(st, s0) < 0.001 else P), P):
        Pc = cut(PP, L['limitKm']) if L['limitKm'] < cum(PP)[-1] - 1e-9 else PP
        outs.append([r5(p) for p in simplify(Pc)])
    return outs

def tributary(L, parent, ws):
    ends = [p for w in ws for p in (way_pts(w)[0], way_pts(w)[-1])]; s0 = min(ends, key=lambda p: proj(parent, p)[0])
    lim = ('end', None) if L['limitSrc'].startswith('end') else ('cut', L['limitKm'])
    return [build_side(parent, chain_by_name(ws, s0), lim)[0]]

def dev_m(a, b): return max(hav(p, q) for p, q in zip(a, b)) * 1000 if len(a) == len(b) else None

if __name__ == '__main__':
    by = osm_by_name(); want = set(sys.argv[1:]); res = collections.Counter(); rows = []
    for e in load(f'{OUT}/systems/index.json')['systems']:
        if e['id'] == 'baffle' or (want and e['id'] not in want): continue
        d = load(f"{OUT}/systems/{e['id']}.json"); LB = {L['id']: L for L in d['lines']}
        for L in d['lines']:
            ws = by.get(L['name'])
            if not ws: res['no OSM way with that name'] += 1; rows.append((e['id'], L['id'], 'no-name')); continue
            cands = main_line(L, ws) if L['parent'] is None else tributary(L, LB[L['parent']]['coords'], ws)
            kind = 'M' if L['parent'] is None else 'T'
            if any(c == L['coords'] for c in cands): res[kind + ' exact'] += 1; rows.append((e['id'], L['id'], 'exact')); continue
            dv = [x for x in (dev_m(c, L['coords']) for c in cands) if x is not None]
            if dv and min(dv) <= 2: res[kind + ' within 2 m'] += 1; rows.append((e['id'], L['id'], f'≤{min(dv):.1f} m'))
            else: res[kind + ' differs'] += 1; rows.append((e['id'], L['id'], 'differs'))
    if want:
        for r in rows: print(*r)
    print(dict(sorted(res.items())))
