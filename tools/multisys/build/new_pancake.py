#!/usr/bin/env python3
"""New system: Pancake Creek – Middle Creek – Jenny Lind Creek (Middle Island / Bustard Head, north of 1770), 2026-10-18.

Geography (QLD watercourse lines + gazetteer, OSM, Esri World Imagery, Copernicus DEM via Open-Meteo; Australian Wetlands
Directory QLD127 'Middle Island, Pancake & Middle Creeks'): three estuaries around Middle Island. Pancake Creek (entrance by
Clews Point/Pancake Point) runs SSE through the anchorage basin into a narrow natural watercourse that meets the head of
Middle Creek, which drains SE to its own mouth on Bustard Bay ('regularly connected at high tide'). Jenny Lind Creek has
its own entrance under Bustard Head and 'connects with Pancake Creek several times per month' across the mangrove/saltpan
flats; that spring-tide link is not a channel, so Jenny Lind is a separate line with its own entrance. DEM: everything
along the lines is < 4 m (no hard limits); Jenny Lind is kept to the end of the QLD perennial reach.

Tides (no gauge anywhere in the network): two-entrance blend on M (engine twoEnt, PL = 'M'):
  south = Pancake Creek entrance, MSQ 2025 secondary place Pancake Creek (HW/LW -0:35 on Gladstone, ratio 0.75)
  north = Middle Creek mouth ≈ MSQ Seventeen Seventy (nearest Bustard Bay place, HW -0:35 LW -0:22, ratio 0.70)
  both with the Agnes-region generic lag growth (HW +2.0, LW +3.2 min/km), node assumed at the divide (km ≈ 11.9).
  Jenny Lind entrance ≈ MSQ Pancake Creek (3.9 km away along the coast). Grade C.

usage: python3 new_pancake.py [--check]
"""
import sys, os, tempfile, shutil
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from side_creeks import *
from newsys import *

SID = 'pancake-creek'; F_GEO = f'{BASE}/geo/pancake_parts.json'; TEMPLATE = 'round-hill-creek'   # Gladstone port block + ref
DIVIDE = [-24.099, 151.72]; JL_PERENNIAL_END = [-24.0628, 151.7517]; CAMP = [-24.1247, 151.7833]; MSQ_PANCAKE = [-24.0167, 151.7333]
RATES = (2.0, 3.2); W = 1.0
PLANES = {'Pancake Creek': (3.01, 2.37, 1.22, 0.58), 'Seventeen Seventy': (2.81, 2.21, 1.14, 0.54)}

def build():
    g = load(F_GEO); T = load(f'{OUT}/systems/{TEMPLATE}.json'); port = T['port']; pn = port['name']; mHW = port['meanHW']
    Mraw = g['pancake_traced'] + g['middle_qld'] + g['middle_estuary_traced']
    M = [r5(p) for p in simplify(Mraw, 12.0)]; L = round(cum(M)[-1], 2); kd = round(proj(M, DIVIDE)[1], 2)
    Jraw = g['jl_traced'] + g['jl_qld']; jl_lim = proj(Jraw, JL_PERENNIAL_END)[1]
    J = [r5(p) for p in simplify(cut(Jraw, jl_lim), 12.0)]
    Tn, tj = build_side(M, g['tanti_qld'], ('end', None))
    lines = [{'id': 'M', 'name': 'Pancake Creek – Middle Creek', 'parent': None, 'junctionKm': 0, 'limitKm': L,
              'limitSrc': f'two entrances: Pancake Creek entrance (km 0) → Middle Island divide (km ≈ {kd:.1f}) → Middle Creek mouth on Bustard Bay (km {L:.1f})',
              'weir': False, 'coords': M},
             {'id': 'T1', 'name': 'Jenny Lind Creek', 'parent': None, 'junctionKm': 0, 'limitKm': round(cum(J)[-1], 2),
              'limitSrc': 'own entrance under Bustard Head; modelled to the end of the perennial reach (QLD watercourse lines; DEM all < 4 m)', 'weir': False, 'coords': J},
             {'id': 'T2', 'name': 'Tanti Creek', 'parent': 'M', 'junctionKm': round(tj, 3), 'limitKm': round(cum(Tn)[-1], 2),
              'limitSrc': 'end of mapped waterway (QLD watercourse lines; DEM all < 4 m)', 'weir': False, 'coords': Tn}]
    ent = msq_node(0, 'Entrance (≈ MSQ Pancake Creek)', 'Pancake Creek', -35, -35, 0.75, 0.0, 1.80, PLANES['Pancake Creek'], pn, 12, 15)
    mid = msq_node(L, 'Middle Creek mouth (≈ MSQ Seventeen Seventy)', 'Seventeen Seventy', -35, -22, 0.70, 0.0, 1.66, PLANES['Seventeen Seventy'], pn, 15, 20,
                   'nearest MSQ place on Bustard Bay, ≈ 8 km SE of this mouth')
    # divide: base node only (inside the blend the two-entrance engine sets lags/heights); not truncated, so the passage
    # never shows 'pool level' lows — highs 0.15 m lower and lows 0.30 m higher than the entrance at mean HW/LW (assumed)
    bH = round(ent['hw'][1] * 0.7, 4); aH = round(ent['hw'][0] + ent['hw'][1] * mHW - 0.15 - bH * mHW, 3)
    aL = round(ent['lw'][0] + ent['lw'][1] * port['meanLW'] + 0.30 - bH * port['meanLW'], 3)
    dv = {'km': kd, 'name': 'Middle Island divide (est.)', 'hwLag': round(-35 + RATES[0] * kd), 'lwLag': round(-35 + RATES[1] * kd),
          'hwU': round(12 + 10 + 3.5 * kd), 'lwU': round(15 + 15 + 5.5 * kd), 'hw': [aH, bH], 'lw': [aL, bH], 'kind': 'generic', 'generic': True,
          'src': f'Divide between the two entrances (Pancake and Middle creeks connect over it at high tide): generic lag growth {kd:.1f} km from the '
                 f'Pancake Creek entrance (HW +{RATES[0]:.1f}, LW +{RATES[1]:.1f} min/km); highs 0.15 m lower, lows 0.30 m higher (assumed)'}
    nodes = {'M': [ent, dv, mid], 'T1': [dict(ent, name='Jenny Lind entrance (≈ MSQ Pancake Creek)', hwU=15, lwU=20,
                                              src=ent['src'] + ' — Jenny Lind entrance is ≈ 3.9 km along the coast from the Pancake Creek place')]}
    tjn = round(tj, 3); dT = cum(Tn)[-1]
    nodes['T1'].append(limit_node(nodes['T1'][0], lines[1]['limitKm'], lines[1]['limitKm'], mHW, RATES, 'the Agnes Water region'))
    # Tanti joins inside the blended reach: its own nodes are a base only (the engine shifts the blended junction tide up it)
    jT = {'km': tjn, 'name': 'Tanti Creek junction', 'hwLag': -35 + round(RATES[0] * (L - tj)) - 0, 'lwLag': -22 + round(RATES[1] * (L - tj)),
          'hwU': 20, 'lwU': 26, 'hw': mid['hw'], 'lw': mid['lw'], 'kind': 'junction', 'src': f'Middle Creek side of the passage, {L - tj:.1f} km inside its mouth (generic lag growth)'}
    nodes['T2'] = [ent, jT, limit_node(jT, round(tj + dT, 2), dT, mHW, RATES, 'the Agnes Water region')]
    lm = [{'name': 'Mouth / entrance (Pancake Creek)', 'km': 0, 'line': 'M', 'note': 'between Clews Point and Pancake Point; popular yacht anchorage inside'},
          {'name': 'MSQ tide place Pancake Creek', 'km': round(proj(M, MSQ_PANCAKE)[1], 2), 'line': 'M', 'cal': True},
          {'name': 'Middle Island divide (est.)', 'km': kd, 'line': 'M', 'note': 'narrow natural channel: Pancake and Middle creeks join over it at high tide; dries at low (assumed)'},
          {'name': 'Tanti Creek junction', 'km': round(tj, 2), 'line': 'M'},
          {'name': 'Middle Creek camping area', 'km': round(proj(M, CAMP)[1], 2), 'line': 'M', 'note': 'off the south bank (no ramp)'},
          {'name': 'Middle Creek mouth (Bustard Bay)', 'km': L, 'line': 'M', 'note': 'shallow bar onto Bustard Bay'},
          {'name': 'Jenny Lind Creek entrance', 'km': 0, 'line': 'T1', 'note': 'under Bustard Head (lighthouse on the headland); links to Pancake Creek over the flats on bigger spring tides'},
          {'name': 'Tidal limit (est.)', 'km': lines[1]['limitKm'], 'line': 'T1'},
          {'name': 'End of mapped waterway', 'km': round(tj + dT, 2), 'line': 'T2'}]
    lm.sort(key=lambda x: ({'M': 0, 'T1': 1, 'T2': 2}[x['line']], x['km']))
    ref = dict(T['ref'], dist=round(hav(M[0], [T['ref']['lat'], T['ref']['lng']]), 1))
    S = {'v': 1, 'id': SID, 'name': 'Pancake, Middle & Jenny Lind Creeks', 'area': 'Agnes Water / 1770', 'mouth': M[0], 'bbox': None, 'port': port,
         'datum': T['datum'], 'lines': lines, 'nodes': nodes, 'maxKm': None, 'landmarks': lm, 'gauges': [], 'ref': ref, 'fresh': None,
         'confidence': {'grade': 'C', 'why': 'no gauge in the network: two-entrance estimate from MSQ secondary places (Pancake Creek, Seventeen Seventy) with generic lag growth and an assumed divide — benchmark me', 'cover': 0.0},
         'built': '2026-10-18',
         'sources': ['Geometry: Queensland Government watercourse lines (QSpatial, CC BY 4.0) + trace on Esri World Imagery (Pancake Creek basin, estuary mouths); OpenStreetMap checked (© OpenStreetMap contributors, ODbL)',
                     'Tides: MSQ 2025 Tidal Planes secondary places Pancake Creek and Seventeen Seventy on Gladstone (Auckland Point); Gladstone harmonics fitted offline to MSQ 2026 predictions (data.qld.gov.au, CC-BY 4.0)',
                     'Connections: Australian Wetlands Directory QLD127 (Middle Island, Pancake & Middle creeks); Copernicus GLO-90 DEM (via Open-Meteo)'],
         'twoEnt': {'north': {'id': port['id'], 'name': pn, 'harm': port['harm']}, 'south': {'name': 'Pancake Creek entrance (MSQ Pancake Creek)'},
                    'X0': 0, 'X1': L, 'L': L, 'node': kd, 'w': W, 'sx': {'hwRate': RATES[0], 'lwRate': RATES[1], 'att': 0.005}, 'nx': {'hwRate': RATES[0], 'lwRate': RATES[1], 'att': 0.005},
                    'nn': [{'y': 0, 'hwLag': -35, 'lwLag': -22, 'hw': mid['hw'], 'lw': mid['lw']}], 'nnames': ['Middle Creek mouth (≈ MSQ Seventeen Seventy)'],
                    'fit': f'Not fitted (no gauge): south wave = MSQ Pancake Creek, north wave = MSQ Seventeen Seventy, generic lag growth (HW +{RATES[0]}, LW +{RATES[1]} min/km), '
                           f'blended by a logistic weight centred at the assumed divide (km {kd}, width {W} km). Benchmark me.',
                    'sName': 'Pancake Creek entrance', 'nName': 'Middle Creek mouth', 'sWord': 'Pancake Ck', 'nWord': 'Middle Ck', 'sTide': 'MSQ Pancake Creek',
                    'nTide': 'MSQ Seventeen Seventy', 'sAb': 'Pancake', 'nAb': 'Middle', 'est': True, 'gradeCap': 'C', 'u0': [15, 20],
                    'nodeBand': [round(kd - 3, 2), round(kd + 3, 2)], 'gNote': 'No gauges in this network: tides are estimates from MSQ secondary places.'}}
    S['bbox'] = [round(v, 5) for v in bbox(S)]; S['maxKm'] = max_km(S)
    return S

def apply(out_dir):
    S = build(); save(f'{out_dir}/systems/{SID}.json', S)
    X = load(f'{out_dir}/systems/index.json'); X['systems'] = [e for e in X['systems'] if e['id'] != SID]
    X['systems'].insert(0, index_entry(S, [ov_line(l['coords']) for l in S['lines']]))   # northernmost of the Agnes Water group
    save(f'{out_dir}/systems/index.json', X); return S

if __name__ == '__main__':
    if '--check' in sys.argv:
        tmp = tempfile.mkdtemp(); os.makedirs(f'{tmp}/systems')
        for f in os.listdir(f'{OUT}/systems'): shutil.copy(f'{OUT}/systems/{f}', f'{tmp}/systems/{f}')
        apply(tmp); bad = 0
        for rel in (f'systems/{SID}.json', 'systems/index.json'):
            same = open(f'{tmp}/{rel}', 'rb').read() == open(f'{OUT}/{rel}', 'rb').read(); bad += not same; print(('IDENTICAL ' if same else 'DIFFERS   ') + rel)
        sys.exit(1 if bad else 0)
    S = apply(OUT); print('applied', SID, [(l['id'], l['name'], l['junctionKm'], l['limitKm']) for l in S['lines']], 'node', S['twoEnt']['node'])
