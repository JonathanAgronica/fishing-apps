#!/usr/bin/env python3
"""Verify how much of the published river-system data the recreated scripts reproduce.
  1. ext_pumicestone.py / ext_maroochy_yandina.py / ext_skyring.py / new_pancake.py --check (byte-for-byte)
  2. Baffle side creeks: src/sides/make_sides.py -> byte-for-byte vs src/sides/baffle_sides.json
  3. derived fields of every system (bbox, maxKm, index.json n/g/km/conf/port/bbox/mouth)
  4. geometry convention: every line's vertices are OSM waterway nodes (needs the statewide cache
     /workspace/multisys/osm/ww.json, 38 MB, box-only; skipped when absent)
  5. index.json `ov` overview lines vs Douglas-Peucker 60 m of the published coordinates
"""
import os, sys, subprocess, tempfile, filecmp
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *
H = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(MS))
ok = True
for s in ('ext_pumicestone.py', 'ext_maroochy_yandina.py', 'ext_skyring.py', 'new_pancake.py'):
    r = subprocess.run([sys.executable, f'{H}/{s}', '--check'], capture_output=True, text=True)
    print(f'[{s}]', r.stdout.strip().replace('\n', ' | ')); ok &= r.returncode == 0
t = tempfile.mktemp(suffix='.json')
subprocess.run([sys.executable, f'{REPO}/src/sides/make_sides.py', t], capture_output=True)
same = os.path.exists(t) and filecmp.cmp(t, f'{REPO}/src/sides/baffle_sides.json', shallow=False)
print('[make_sides.py] baffle_sides.json', 'IDENTICAL' if same else 'DIFFERS'); ok &= same
X = load(f'{OUT}/systems/index.json'); bad = {}
for e in X['systems']:
    if e['id'] == 'baffle': continue        # Baffle is built into the app (src/upstream/baffle-tides), not a system file
    d = load(f"{OUT}/systems/{e['id']}.json"); bb = bbox(d)
    chk = {'bbox': [round(v, 5) for v in bb] == d['bbox'], 'maxKm': max_km(d) == d['maxKm'],
           'index': {k: v for k, v in index_entry(d, e['ov']).items()} == e}
    for k, v in chk.items():
        if not v: bad.setdefault(k, []).append(e['id'])
print('[derived fields]', len(X['systems']) - 1, 'systems; mismatches:', bad or 'none',
      '(expected: maroochy-river index km 28.67 not 1 dp; pumicestone-passage port label "Scarborough + Mooloolaba (2 entrances)")')
WW = '/workspace/multisys/osm/ww.json'
if os.path.exists(WW):
    nodes = set()
    for el in load(WW)['elements']:
        for p in el.get('geometry') or []: nodes.add((round(p['lat'], 5), round(p['lon'], 5)))
    tot = hit = 0; worst = []
    for e in X['systems']:
        if e['id'] == 'baffle': continue
        d = load(f"{OUT}/systems/{e['id']}.json")
        for L in d['lines']:
            inner = L['coords'][1:-1]; h = sum((p[0], p[1]) in nodes for p in inner); tot += len(inner); hit += h
    print(f'[geometry] interior vertices that are OSM waterway nodes (5 dp): {hit}/{tot} = {100*hit/max(1,tot):.1f}%')
else: print('[geometry] skipped (statewide OSM cache not on this box)')
from side_creeks import rdp_idx as _r
ex = cnt = 0
for e in X['systems']:
    if e['id'] == 'baffle': continue
    d = load(f"{OUT}/systems/{e['id']}.json")
    ov = [[[round(p[0], 4), round(p[1], 4)] for p in (lambda c: [c[i] for i in _r(c, 60)])(L['coords'])] for L in d['lines']]
    ex += ov == e['ov']; cnt += [len(o) for o in ov] == [len(o) for o in e['ov']]
print(f'[index ov] DP 60 m of published coords: same point counts {cnt}/{len(X["systems"])-1}, byte-identical {ex} '
      '(the original simplified unrounded OSM coordinates, so ov is carried over, not regenerated)')
sys.exit(0 if ok else 1)
