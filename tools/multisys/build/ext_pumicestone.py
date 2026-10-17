#!/usr/bin/env python3
"""Pumicestone Passage two-entrance extension (recreated 2026-10-18; the original ext_pumicestone.py was lost in the
2026-10-17 box restore).

What the extension does to the per-system builder output (base/pumicestone-passage.pre-two.json):
  * main line M = south passage (Bribie Is. bridge, km 0) + north passage to the Caloundra bar (km 40.54):
    OSM 'Pumicestone Passage' ways, each half simplified separately (Douglas-Peucker 12 m), 5 dp;
  * new side creeks T6-T11 (+ T2.1, T5.3, T5.1.1, T8.1, T9.x) from OSM waterways (osm/pumice/ww.json), tidal limits from
    the DEM rule in common.dem_limit (osm/pumice/dem.json cache); hussey-creek and halls-creek systems merged in (T6, T7);
  * landmarks, gauges (Halls Bay DES km 31.04, Golden Beach BoM 540448 km 38.53), two-entrance block `twoEnt`
    (fitted 2026-10-15: node 25.4 km, width 1.5, X0 14.83, X1 31.04; north = Mooloolaba harmonics), confidence, sources;
  * data/systems/index.json: pumicestone entry updated, hussey-creek + halls-creek removed; sysg stations updated.

Curated / fitted values that cannot be recomputed offline (fit results, landmark names, gauge fits, text) live in
base/pumicestone-passage.spec.json. Geometry is regenerated from the cached OSM where that reproduces the published
coordinates exactly; lines where it does not (≤1.5 m junction-point rounding differences) are pinned in the spec.

usage:  python3 ext_pumicestone.py            # apply: base + spec -> out/ (idempotent)
        python3 ext_pumicestone.py --check    # apply to a temp copy and compare byte-for-byte with out/
        python3 ext_pumicestone.py --extract  # (re)create base + spec from the current out/ (how they were made)
"""
import sys, copy, os, shutil, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from side_creeks import *

SID = 'pumicestone-passage'; MERGED = ['hussey-creek', 'halls-creek']; NSOUTH = 72
F_BASE = f'{BASE}/{SID}.pre-two.json'; F_SPEC = f'{BASE}/{SID}.spec.json'
WW = f'{OSM}/pumice/ww.json'
OSM_NAME = {'Bells Ck North Branch': 'Bells Creek (North Branch)'}

def ways_named(n): return osm_ways(WW, lambda e: e.get('tags', {}).get('name') == n)

def main_line(mouth, split, end):
    """M from the OSM 'Pumicestone Passage' ways: mouth -> split (old tidal-limit end of the base M) -> end (Caloundra bar)."""
    ws = [way_pts(e) for e in ways_named('Pumicestone Passage')]
    pts = [mouth]; cur = mouth; used = set()
    while hav(cur, end) > 0.01:
        best = None
        for k, s in enumerate(ws):
            if k in used: continue
            for q in (s, s[::-1]):
                if hav(cur, q[0]) < 0.05:
                    key = hav(q[-1], end)
                    if best is None or key < best[0]: best = (key, k, q)
        if not best: break
        used.add(best[1]); pts += best[2][1:]; cur = pts[-1]
    i = min(range(len(pts)), key=lambda j: hav(pts[j], split))
    south, north = pts[:i + 1], pts[i:]
    return [r5(p) for p in simplify(south)] + [r5(p) for p in simplify(north)][1:]

def regen_side(L, parent):
    nm = OSM_NAME.get(L['name'], L['name']); ws = ways_named(nm)
    if not ws: return None
    ends = [p for e in ws for p in (way_pts(e)[0], way_pts(e)[-1])]
    st = min(ends, key=lambda p: proj(parent, p)[0])
    lim = ('end', None) if L['limitSrc'].startswith('end') else ('cut', L['limitKm'])
    return build_side(parent, chain_by_name(ws, st), lim)[0]

def apply(out_dir):
    base = load(F_BASE); spec = load(F_SPEC); S = copy.deepcopy(base)
    M = S['lines'][0]
    M['coords'] = main_line(S['mouth'], base['lines'][0]['coords'][-1], spec['M']['end'])
    assert M['coords'][:NSOUTH] == base['lines'][0]['coords'], 'south half changed vs base (OSM cache differs?)'
    M['limitKm'] = spec['M']['limitKm']; M['limitSrc'] = spec['M']['limitSrc']
    byid = {L['id']: L for L in S['lines']}
    for item in spec['lines']:
        L = copy.deepcopy(item['line'])
        if 'coords' not in L:
            L['coords'] = regen_side(L, byid[L['parent']]['coords'])
            # keep key order identical to the builder's line objects
            L = {k: L[k] for k in item['order']}
        S['lines'].append(L); byid[L['id']] = L
    for k in ('nodes', 'landmarks', 'gauges', 'ref', 'fresh', 'confidence', 'sources'): S[k] = spec[k]
    S['maxKm'] = max_km(S); S['bbox'] = [round(v, 5) for v in bbox(S)]
    S['twoEnt'] = spec['twoEnt']; S['merged'] = MERGED
    S = {k: S[k] for k in spec['key_order']}
    save(f'{out_dir}/systems/{SID}.json', S)
    for m in MERGED:
        p = f'{out_dir}/systems/{m}.json'
        if os.path.exists(p): os.remove(p)
    X = load(f'{out_dir}/systems/index.json')
    X['systems'] = [e for e in X['systems'] if e['id'] not in MERGED]
    for i, e in enumerate(X['systems']):
        if e['id'] == SID: X['systems'][i] = index_entry(S, spec['index']['ov'], port=spec['index']['port'])
    save(f'{out_dir}/systems/index.json', X)
    st = load(f'{out_dir}/sysg_stations.json'); have = {s['id'] for s in st['stations']}
    for pos, rec in spec['stations']:
        if rec['id'] in have: st['stations'] = [rec if s['id'] == rec['id'] else s for s in st['stations']]
        else: st['stations'].insert(pos, rec)
    open(f'{out_dir}/sysg_stations.json', 'w').write(json.dumps(st, indent=0))
    return S

def extract():
    """Reconstruct the pre-extension base + spec from the published output (done once on 2026-10-18)."""
    live = load(f'{OUT}/systems/{SID}.json'); pre = f'/workspace/multisys/out_pre_gauges/systems/{SID}.json'
    old = load(pre) if os.path.exists(pre) else None
    base = copy.deepcopy(live)
    for k in ('twoEnt', 'merged'): base.pop(k, None)
    base['lines'] = copy.deepcopy(live['lines'][:8]); base['lines'][0]['coords'] = live['lines'][0]['coords'][:NSOUTH]
    base['lines'][0]['limitKm'] = old['lines'][0]['limitKm'] if old else 24.97
    base['lines'][0]['limitSrc'] = old['lines'][0]['limitSrc'] if old else 'reconstructed'
    for k in ('landmarks', 'confidence', 'sources'):
        if old: base[k] = old[k]
    base['maxKm'] = max_km(base); base['bbox'] = [round(v, 5) for v in bbox(base)]
    save(F_BASE, base)
    byid = {L['id']: L for L in live['lines']}; lines = []
    for L in live['lines'][8:]:
        c = regen_side(L, byid[L['parent']]['coords'])
        item = {'order': list(L.keys())}
        if c == L['coords']: item['line'] = {k: v for k, v in L.items() if k != 'coords'}; item['regen'] = 'exact'
        else:
            item['line'] = L
            item['regen'] = 'pinned: OSM regeneration differs ' + (f'by ≤{max(hav(a, b) for a, b in zip(c, L["coords"])) * 1000:.1f} m' if c and len(c) == len(L['coords']) else f'({len(c) if c else 0} vs {len(L["coords"])} points)')
        lines.append(item)
    X = load(f'{OUT}/systems/index.json'); e = [x for x in X['systems'] if x['id'] == SID][0]
    st = load(f'{OUT}/sysg_stations.json')
    spec = {'M': {'end': live['lines'][0]['coords'][-1], 'limitKm': live['lines'][0]['limitKm'], 'limitSrc': live['lines'][0]['limitSrc']},
            'lines': lines, **{k: live[k] for k in ('nodes', 'landmarks', 'gauges', 'ref', 'fresh', 'confidence', 'sources', 'twoEnt')},
            'key_order': list(live.keys()), 'index': {'port': e['port'], 'ov': e['ov']},
            'stations': [[i, s] for i, s in enumerate(st['stations']) if s['id'] in ('540448', 'hallsbay')]}
    save(F_SPEC, spec)
    for m in MERGED:
        src = f'/workspace/multisys/out_pre_gauges/systems/{m}.json'
        if os.path.exists(src): shutil.copy(src, f'{BASE}/{m}.json')
    print('extracted; line regeneration:', {i['line']['id']: i['regen'] for i in lines})

def make_input_tree(tmp):
    """out/ as it was before the extension: base system + merged systems back in index/stations."""
    os.makedirs(f'{tmp}/systems')
    for f in os.listdir(f'{OUT}/systems'): shutil.copy(f'{OUT}/systems/{f}', f'{tmp}/systems/{f}')
    spec = load(F_SPEC)
    st = load(f'{OUT}/sysg_stations.json'); st['stations'] = [s for s in st['stations'] if s['id'] not in ('540448', 'hallsbay')]
    open(f'{tmp}/sysg_stations.json', 'w').write(json.dumps(st, indent=0))
    X = load(f'{OUT}/systems/index.json'); pre = '/workspace/multisys/out_pre_gauges/systems/index.json'
    for m in MERGED:
        if os.path.exists(f'{BASE}/{m}.json'):
            shutil.copy(f'{BASE}/{m}.json', f'{tmp}/systems/{m}.json'); mj = load(f'{BASE}/{m}.json')
            X['systems'].append(index_entry(mj, [[r5(p) for p in L['coords']] for L in mj['lines']]))
    save(f'{tmp}/systems/index.json', X); shutil.copy(F_BASE, f'{tmp}/systems/{SID}.json')

if __name__ == '__main__':
    if '--extract' in sys.argv: extract(); sys.exit()
    if '--check' in sys.argv:
        tmp = tempfile.mkdtemp(); make_input_tree(tmp); apply(tmp); bad = 0
        for rel in (f'systems/{SID}.json', 'systems/index.json', 'sysg_stations.json'):
            same = open(f'{tmp}/{rel}', 'rb').read() == open(f'{OUT}/{rel}', 'rb').read(); bad += not same
            print(('IDENTICAL ' if same else 'DIFFERS   ') + rel)
        for m in MERGED: print(('removed   ' if not os.path.exists(f'{tmp}/systems/{m}.json') else 'LEFT      ') + m)
        sys.exit(1 if bad else 0)
    apply(OUT); print('applied ->', OUT)
