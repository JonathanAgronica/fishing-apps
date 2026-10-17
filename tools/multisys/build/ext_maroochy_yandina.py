#!/usr/bin/env python3
"""Maroochy River -> Yandina extension (recreated 2026-10-18; original lost in the 2026-10-17 box restore).
Re-run after any rebuild of the systems (src/build.py refuses to build if Maroochy M ends before km 28.5).

The per-system builder stopped the Maroochy main line at an estimated tidal limit (km 26.4). This extension continues
M up the South Maroochy River (OSM way 780661025, cached in osm/yandina.json) from the North/South confluence
(km 26.39) to the natural rock ford at the James Low Bridge, Yandina (km 28.67, head of navigation; BoM 540092 at
Yandina shows no tide). New vertices = the OSM way nodes (reversed, 6 dp, not simplified) up to the ford; the final
point on the ford (pinned in the spec) was placed by hand on the bridge line and is not reproducible from the cache.
Curated values (nodes, landmarks, confidence, sources, M.ext) live in base/maroochy-river.spec.json.

usage: python3 ext_maroochy_yandina.py [--check | --extract]
"""
import sys, copy, os, shutil, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

SID = 'maroochy-river'; WAY = 780661025; NBASE = 97
F_BASE = f'{BASE}/{SID}.pre-yandina.json'; F_SPEC = f'{BASE}/{SID}.spec.json'

def ext_points(end):
    w = osm_ways(f'{OSM}/yandina.json', lambda e: e['id'] == WAY)[0]; g = way_pts(w)[::-1]   # confluence -> upstream
    C = cum(g); kend = proj(g, end, C)[1]
    return [r6(p) for p, c in zip(g[1:], C[1:]) if c < kend] + [end]

def apply(out_dir):
    base = load(F_BASE); spec = load(F_SPEC); S = copy.deepcopy(base); M = S['lines'][0]
    M['coords'] = base['lines'][0]['coords'] + ext_points(spec['M']['end'])
    M['limitKm'] = spec['M']['limitKm']; M['limitSrc'] = spec['M']['limitSrc']; M['ext'] = spec['M']['ext']
    S['lines'][0] = {k: M[k] for k in spec['M']['order']}
    for k in ('nodes', 'landmarks', 'confidence', 'sources'): S[k] = spec[k]
    S['maxKm'] = max_km(S); S['bbox'] = [round(v, 5) for v in bbox(S)]
    S = {k: S[k] for k in spec['key_order']}
    save(f'{out_dir}/systems/{SID}.json', S, ascii=True)  # this script always wrote \uXXXX escapes
    X = load(f'{out_dir}/systems/index.json')
    for i, e in enumerate(X['systems']):
        if e['id'] == SID: X['systems'][i] = index_entry(S, spec['index']['ov'], km=spec['index']['km'])
    save(f'{out_dir}/systems/index.json', X)

def extract():
    live = load(f'{OUT}/systems/{SID}.json'); pre = f'/workspace/multisys/out_pre_gauges/systems/{SID}.json'
    old = load(pre) if os.path.exists(pre) else None
    base = copy.deepcopy(live); M = base['lines'][0]; M.pop('ext', None)
    M['coords'] = live['lines'][0]['coords'][:NBASE]
    M['limitKm'] = old['lines'][0]['limitKm'] if old else 26.4; M['limitSrc'] = old['lines'][0]['limitSrc'] if old else 'reconstructed'
    base['nodes'] = copy.deepcopy(live['nodes']); base['nodes']['M'] = [n for n in live['nodes']['M'] if n['km'] < 26.0]
    if old:
        for k in ('landmarks', 'confidence', 'sources'): base[k] = old[k]
    base['maxKm'] = max_km(base); base['bbox'] = [round(v, 5) for v in bbox(base)]
    save(F_BASE, base)
    L = live['lines'][0]; X = load(f'{OUT}/systems/index.json'); e = [x for x in X['systems'] if x['id'] == SID][0]
    spec = {'M': {'end': L['coords'][-1], 'limitKm': L['limitKm'], 'limitSrc': L['limitSrc'], 'ext': L['ext'], 'order': list(L.keys())},
            **{k: live[k] for k in ('nodes', 'landmarks', 'confidence', 'sources')}, 'key_order': list(live.keys()),
            'index': {'km': e['km'], 'ov': e['ov']}}
    save(F_SPEC, spec); print('extracted', SID)

if __name__ == '__main__':
    if '--extract' in sys.argv: extract(); sys.exit()
    if '--check' in sys.argv:
        tmp = tempfile.mkdtemp(); os.makedirs(f'{tmp}/systems')
        shutil.copy(f'{OUT}/systems/index.json', f'{tmp}/systems/index.json'); shutil.copy(F_BASE, f'{tmp}/systems/{SID}.json')
        apply(tmp); bad = 0
        for rel in (f'systems/{SID}.json', 'systems/index.json'):
            same = open(f'{tmp}/{rel}', 'rb').read() == open(f'{OUT}/{rel}', 'rb').read(); bad += not same
            print(('IDENTICAL ' if same else 'DIFFERS   ') + rel)
        sys.exit(1 if bad else 0)
    apply(OUT); print('applied ->', OUT)
