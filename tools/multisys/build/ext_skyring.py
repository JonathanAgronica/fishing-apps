#!/usr/bin/env python3
"""Burnett River: add Skyring Creek (Skyringville) as a two-entrance channel (2026-10-18).

Geography (checked on OSM, QLD watercourse lines and imagery): the creek leaves the Burnett's north bank 2.1 km above the
mouth through the 'Hole in the Wall' (a shallow cut in the old training wall, by the port marina), runs north behind
Barubbra Island and then west along the lagoon behind the sand spit to its own bar mouth on the open coast. OSM has no line
for it, so the centreline is: Queensland Government watercourse lines (QSpatial 'Watercourse lines', CC BY 4.0) for the main
channel and bend, plus a trace on Esri World Imagery for the Hole-in-the-Wall arm and the lagoon (base/geo/skyring_parts.json).

Tides: the generalised two-entrance engine (src/systems/engine.js, twoEnt.line = 'T7'): Burnett wave through the junction
(Burnett nodes interpolated at the Hole in the Wall) and a sea wave from the creek's own mouth (open coast ≈ Burnett Heads:
MSQ Bargara is +0/+0, ratio 1.00), both with the region's generic lag growth (HW +2.2, LW +3.3 min/km) and blended around a
tidal node assumed 0.6 km inside the Hole (the cut is shallow and dries near low water, so most of the creek fills and drains
through its own mouth). No gauge: estimated, grade C, wide ±.

usage: python3 ext_skyring.py [--check]
"""
import sys, os, copy, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from side_creeks import *
from newsys import *

SID = 'burnett-river'
F_BASE = f'{BASE}/{SID}.pre-skyring.json'; F_IDX = f'{BASE}/{SID}.pre-skyring.index.json'; F_GEO = f'{BASE}/geo/skyring_parts.json'
NODE_IN, W, RATES = 0.6, 0.35, (2.2, 3.3)

def build():
    S = load(F_BASE); g = load(F_GEO)
    M = S['lines'][0]['coords']
    src = g['east_traced'] + g['qld'][1:] + g['lagoon_traced']
    coords, jk = build_side(M, src, ('end', None))
    L = round(jk + cum(coords)[-1], 2); jk = round(jk, 3)
    line = {'id': 'T7', 'name': 'Skyring Creek (Skyringville)', 'parent': 'M', 'junctionKm': jk, 'limitKm': round(cum(coords)[-1], 2),
            'limitSrc': f'two entrances: Burnett River via the Hole in the Wall (km {jk:.1f}) → own bar mouth on the open coast north of Barubbra Island (km {L:.1f})',
            'weir': False, 'coords': coords}
    S['lines'].append(line)
    Mn = S['nodes']['M']; port = S['port']
    jn = interp_node(Mn, jk, 'Hole in the Wall (Burnett junction)')
    jn['km'] = jk  # exact junction chainage, so the two-entrance south nodes (km <= X0) include it
    sea = {'km': L, 'name': 'Skyring Creek mouth (sea, ≈ Burnett Heads)', 'hwLag': 0, 'lwLag': 0, 'hwU': 15, 'lwU': 20,
           'hw': [-port['harm']['z0'], 1.0], 'lw': [-port['harm']['z0'], 1.0], 'kind': 'port',
           'src': 'Open coast 5 km NW of the Burnett Heads gauge: same tide assumed (MSQ Bargara, also on this coast, is +0/+0 min, ratio 1.00 on Burnett Heads)'}
    S['nodes']['T7'] = [n for n in Mn if n['km'] < jk] + [jn, sea]
    node = round(jk + NODE_IN, 2)
    S['twoEnt'] = {'line': 'T7', 'north': {'id': port['id'], 'name': port['name'], 'harm': port['harm']},
                   'south': {'name': 'Burnett River via the Hole in the Wall'}, 'X0': jk, 'X1': L, 'L': L, 'node': node, 'w': W,
                   'sx': {'hwRate': RATES[0], 'lwRate': RATES[1], 'att': 0.01}, 'nx': {'hwRate': RATES[0], 'lwRate': RATES[1], 'att': 0.01},
                   'nn': [{'y': 0, 'hwLag': 0, 'lwLag': 0, 'hw': sea['hw'], 'lw': sea['lw']}], 'nnames': ['Skyring Creek mouth (≈ Burnett Heads open coast)'],
                   'fit': 'Not fitted (no gauge in Skyring Creek): Burnett wave through the Hole in the Wall and sea wave through the creek mouth, both '
                          f'Burnett Heads harmonics with generic lag growth (HW +{RATES[0]}, LW +{RATES[1]} min/km, 1 %/km attenuation), blended by a logistic '
                          f'weight centred {NODE_IN} km inside the Hole (width {W} km) because the cut is shallow and dries near low water. Benchmark me.',
                   'sName': 'Burnett Heads, via the Hole in the Wall', 'nName': 'Skyring Creek mouth', 'sWord': 'Burnett', 'nWord': 'sea mouth',
                   'sTide': 'Burnett Heads tide', 'nTide': 'open-coast tide ≈ Burnett Heads', 'sAb': 'km', 'nAb': 'to sea', 'est': True, 'gradeCap': 'C',
                   'u0': [20, 30], 'nodeBand': [jk, round(jk + 2.0, 2)],
                   'gNote': 'The Burnett gauges are not on Skyring Creek: its tides are an estimate (no gauge there).'}
    # landmarks: junction on the Burnett (sorted into the main-channel list) + Skyring Creek points
    lm = S['landmarks']; mi = [i for i, x in enumerate(lm) if x['line'] == 'M' and x['km'] <= jk]
    lm.insert(mi[-1] + 1, {'name': 'Hole in the Wall – Skyring Creek junction', 'km': round(jk, 2), 'line': 'M',
                           'note': 'shallow cut into Skyring Creek: small boats only, about 2 h either side of high water on springs (local advice)'})
    shack = proj(coords, [-24.7345, 152.3793])
    lm += [{'name': 'Tidal node (est.) – Skyring Creek', 'km': node, 'line': 'T7', 'note': 'both entrances meet here: small range, late flattened highs (assumed position)'},
           {'name': 'Barubbra Island shacks', 'km': round(jk + shack[1], 2), 'line': 'T7', 'note': 'on the sand spit, north bank'},
           {'name': 'Skyring Creek mouth (sea)', 'km': L, 'line': 'T7', 'note': 'bar entrance north of Barubbra Island; moves with the sand spit'}]
    S['confidence'] = dict(S['confidence'], why=S['confidence']['why'] + '; Skyring Creek: two-entrance estimate, no gauge (C)')
    S['sources'] = S['sources'] + ['Skyring Creek: Queensland Government watercourse lines (QSpatial, CC BY 4.0) + trace on Esri World Imagery (Hole-in-the-Wall arm, lagoon)']
    S['maxKm'] = max_km(S); S['bbox'] = [round(v, 5) for v in bbox(S)]
    return S

def apply(out_dir):
    S = build(); save(f'{out_dir}/systems/{SID}.json', S)
    X = load(f'{out_dir}/systems/index.json'); e0 = load(F_IDX)
    for i, e in enumerate(X['systems']):
        if e['id'] == SID: X['systems'][i] = index_entry(S, e0['ov'] + [ov_line(S['lines'][-1]['coords'])], port=e0['port'])
    save(f'{out_dir}/systems/index.json', X)
    return S

def pre_tree(tmp):
    os.makedirs(f'{tmp}/systems')
    for f in os.listdir(f'{OUT}/systems'): shutil.copy(f'{OUT}/systems/{f}', f'{tmp}/systems/{f}')
    shutil.copy(F_BASE, f'{tmp}/systems/{SID}.json'); X = load(f'{OUT}/systems/index.json'); e0 = load(F_IDX)
    X['systems'] = [e0 if e['id'] == SID else e for e in X['systems']]; save(f'{tmp}/systems/index.json', X)

if __name__ == '__main__':
    if '--check' in sys.argv:
        tmp = tempfile.mkdtemp(); pre_tree(tmp); apply(tmp); bad = 0
        for rel in (f'systems/{SID}.json', 'systems/index.json'):
            same = open(f'{tmp}/{rel}', 'rb').read() == open(f'{OUT}/{rel}', 'rb').read(); bad += not same
            print(('IDENTICAL ' if same else 'DIFFERS   ') + rel)
        sys.exit(1 if bad else 0)
    S = apply(OUT); T = S['lines'][-1]; print('applied ->', OUT, '| T7 junction km', T['junctionKm'], 'length', T['limitKm'], 'end km', S['twoEnt']['L'])
