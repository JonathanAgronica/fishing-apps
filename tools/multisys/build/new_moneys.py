#!/usr/bin/env python3
"""New system: Moneys Creek (Kellys Beach, Bargara, Bundaberg), 2026-10-24.

Geography: a small creek feeding Moneys Creek Lagoon, which is closed off by 'The Causeway' road (OSM way 36986696) with
council tide gates (Bundaberg Regional Council 'Moneys Creek Causeway Gate Operation Guidelines'). Seaward of the causeway is
a sandy tidal basin (OSM way 51547158, the patrolled swimming hole) that drains to Kellys Beach over a sand bar. Not a gazetted
place name (QLD Place Names has none) — identified from council pages and OSM. Not connected to any other system.
Line M = sea edge → over the bar → basin channel → causeway (trace on Esri World Imagery z18, pinned in base/geo/moneys_parts.json).
The causeway point is the narrowest gap between lagoon and basin on the road (exact gate/culvert position not mapped: estimate).

Heights (QLD LiDAR DEM, QldDem ImageServer, m AHD, 2026-10-24): road crest at the causeway 2.51; lagoon surface 0.955; basin surface
0.745 (perched behind the bar); beach bar 1.16. So the road itself only overtops in a big storm tide; water passes THROUGH the
gates/culverts when they are open, running in while the sea-side level is above the lagoon level and out while it is below.
Default flow threshold = lagoon level 0.95 m AHD (estimate; user can override on the phone).

Tides: no MSQ place or gauge at Bargara. Mouth ≈ interpolated between Bundaberg (Burnett Heads) standard port (7.8 km N, HW/LW 0)
and MSQ Elliott River Entrance (19 km S, HW/LW -9 min, ratio 1.05): HW/LW -3 min, ratio 1.016. Causeway node: +5 min HW,
lows held at the perched basin level 0.75 m AHD (trunc floor). Grade C.

usage: python3 new_moneys.py [--check]
"""
import sys, os, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from newsys import *

SID = 'moneys-creek'; F_GEO = f'{BASE}/geo/moneys_parts.json'; TEMPLATE = 'coonarr-creek'   # Bundaberg port block + ref
LAGOON = 0.95; ROAD = 2.51; BASIN = 0.75; BAR = 1.16
GATES_2026 = [['02-02', '02-05'], ['02-16', '02-20'], ['03-02', '03-05'], ['03-17', '03-20'], ['03-30', '04-01'], ['05-18', '05-20'], ['06-15', '06-18'],
              ['07-13', '07-16'], ['08-10', '08-14'], ['09-08', '09-11'], ['10-07', '10-08'], ['10-26', '10-29'], ['11-09', '11-10'], ['11-23', '11-27'], ['12-08', '12-09']]

def build():
    g = load(F_GEO); T = load(f'{OUT}/systems/{TEMPLATE}.json'); port = T['port']; pn = port['name']; mHW = port['meanHW']
    M = [r5(p) for p in simplify(g['main_traced'], 6.0)]; L = round(cum(M)[-1], 2); CW = g['causeway']
    lines = [{'id': 'M', 'name': 'Moneys Creek (beach basin to the causeway)', 'parent': None, 'junctionKm': 0, 'limitKm': L,
              'limitSrc': 'causeway with tide gates (The Causeway road); the lagoon behind is only tidal while the gates are open', 'weir': True, 'coords': M}]
    mouth = {'km': 0, 'name': 'Mouth, Kellys Beach (≈ Burnett Heads −3 min)', 'hwLag': -3, 'lwLag': -3, 'hwU': 15, 'lwU': 20, 'hw': [-1.82, 1.016], 'lw': [-1.82, 1.016], 'kind': 'mouth',
             'src': f'No MSQ place at Bargara: interpolated between {pn} (standard port, 7.8 km N, HW/LW 0, ratio 1.00) and MSQ Elliott River Entrance '
                    '(19 km S, HW/LW −9 min, ratio 1.05) — open coast, estimate'}
    cw = {'km': L, 'name': 'Causeway (sea side, est.)', 'hwLag': 2, 'lwLag': 25, 'hwU': 25, 'lwU': 45, 'hw': [-1.87, 1.016], 'lw': [-1.82, 1.016], 'kind': 'generic', 'generic': True,
          'trunc': True, 'floor': BASIN,
          'src': f'Basin behind the beach bar: highs ≈ 5 min later and 0.05 m lower than the beach (assumed); lows held at the perched basin level '
                 f'{BASIN:.2f} m AHD (QLD LiDAR water surface) because the bar ({BAR:.2f} m) stops it draining to sea level'}
    lm = [{'name': 'Mouth / Kellys Beach', 'km': 0, 'line': 'M', 'note': 'sand bar onto the beach; council moves sand to open it before summer'},
          {'name': 'Swimming basin', 'km': round(L * 0.55, 2), 'line': 'M', 'note': 'patrolled swimming hole (closed while the gates run)'},
          {'name': 'Moneys Creek causeway (tide gates)', 'km': L, 'line': 'M', 'note': f'road {ROAD:.1f} m AHD; lagoon behind ≈ {LAGOON:.2f} m AHD (LiDAR); strong suction at the pipes — keep clear', 'causeway': True}]
    ref = dict(T['ref'], dist=round(hav(M[0], [T['ref']['lat'], T['ref']['lng']]), 1))
    S = {'v': 1, 'id': SID, 'name': 'Moneys Creek', 'area': 'Bundaberg – Bargara', 'mouth': M[0], 'bbox': None, 'port': port, 'datum': T['datum'],
         'lines': lines, 'nodes': {'M': [mouth, cw]}, 'maxKm': None, 'landmarks': lm, 'gauges': [], 'ref': ref, 'fresh': None,
         'confidence': {'grade': 'C', 'why': 'no gauge or MSQ place at Bargara: tide interpolated between Burnett Heads and Elliott River Entrance; basin and causeway behaviour estimated from LiDAR — benchmark me', 'cover': 0.0},
         'built': '2026-10-24',
         'causeway': {'name': 'Moneys Creek causeway', 'lat': CW[0], 'lng': CW[1], 'km': L, 'line': 'M', 'thr': LAGOON, 'road': ROAD, 'basin': BASIN, 'bar': BAR,
                      'thrSrc': f'estimated: lagoon water level {LAGOON:.2f} m AHD from QLD LiDAR (flow runs in above it, out below it while the gates are open)',
                      'locSrc': 'estimated: narrowest gap between the lagoon and the beach basin on The Causeway road (OSM + Esri imagery); exact gate position not mapped',
                      'gates': {'year': 2026, 'src': 'Bundaberg Regional Council, Moneys Creek Causeway Gate Operation Guidelines 2026 (guide only, subject to change)', 'open': GATES_2026}},
         'sources': ['Geometry: trace on Esri World Imagery; OpenStreetMap water areas and The Causeway road (© OpenStreetMap contributors, ODbL)',
                     'Heights: QLD Government LiDAR DEM (QldDem elevation service, CC BY 4.0), m AHD',
                     f'Tides: {pn} harmonics fitted to MSQ 2026 predictions (data.qld.gov.au, CC-BY 4.0); MSQ 2025 Tidal Planes (Elliott River Entrance) for the offset',
                     'Gate timetable: Bundaberg Regional Council (bundaberg.qld.gov.au, Our beaches)']}
    S['bbox'] = [round(v, 5) for v in bbox(S)]; S['maxKm'] = max_km(S)
    return S

def apply(out_dir):
    S = build(); save(f'{out_dir}/systems/{SID}.json', S)
    X = load(f'{out_dir}/systems/index.json'); X['systems'] = [e for e in X['systems'] if e['id'] != SID]
    i = next(i for i, e in enumerate(X['systems']) if e['id'] == 'burnett-river') + 1
    X['systems'].insert(i, index_entry(S, [ov_line(l['coords']) for l in S['lines']]))
    save(f'{out_dir}/systems/index.json', X); return S

if __name__ == '__main__':
    if '--check' in sys.argv:
        tmp = tempfile.mkdtemp(); os.makedirs(f'{tmp}/systems')
        for f in os.listdir(f'{OUT}/systems'): shutil.copy(f'{OUT}/systems/{f}', f'{tmp}/systems/{f}')
        apply(tmp); bad = 0
        for rel in (f'systems/{SID}.json', 'systems/index.json'):
            same = open(f'{tmp}/{rel}', 'rb').read() == open(f'{OUT}/{rel}', 'rb').read(); bad += not same; print(('IDENTICAL ' if same else 'DIFFERS   ') + rel)
        sys.exit(1 if bad else 0)
    S = apply(OUT); print('applied', SID, S['lines'][0]['limitKm'], 'km', len(S['lines'][0]['coords']), 'pts', S['bbox'])
