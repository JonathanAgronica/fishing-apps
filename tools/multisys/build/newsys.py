"""Helpers for systems/channels added after the 2026-10-17 restore (ext_skyring.py, new_pancake.py), following the
conventions of the published data (see common.py):
  * junction node  = linear interpolation of the parent's nodes at the junction (lags rounded to whole minutes);
  * MSQ node       = MSQ 2025 Tidal Planes secondary place: lag HW/LW on the standard port, height
                     h_AHD = ratio * H_port + cons - MSL_local (local MSL taken as ≈ AHD);
  * generic limit  = last calibrated node + median QLD lag growth per km (region rates), highs 0.15 m lower than the
                     calibrated node at the port's mean HW, lows drained to a pool level (trunc) ~0.2 x that high;
  * overview line  = Douglas-Peucker 60 m, 4 dp (index.json 'ov')."""
from common import *

def interp_node(nodes, km, name, src='interpolated on the parent channel at the junction', kind='junction'):
    a = max([n for n in nodes if n['km'] <= km + 1e-9], key=lambda n: n['km'])
    bs = [n for n in nodes if n['km'] > km + 1e-9]
    b = min(bs, key=lambda n: n['km']) if bs else a
    f = 0 if b is a else (km - a['km']) / (b['km'] - a['km'])
    L = lambda x, y: x + (y - x) * f
    return {'km': round(km, 2), 'name': name, 'hwLag': round(L(a['hwLag'], b['hwLag'])), 'lwLag': round(L(a['lwLag'], b['lwLag'])),
            'hwU': round(L(a['hwU'], b['hwU'])), 'lwU': round(L(a['lwU'], b['lwU'])),
            'hw': [round(L(a['hw'][0], b['hw'][0]), 4), round(L(a['hw'][1], b['hw'][1]), 4)],
            'lw': [round(L(a['lw'][0], b['lw'][0]), 4), round(L(a['lw'][1], b['lw'][1]), 4)], 'kind': kind, 'src': src}

def msq_node(km, name, place, hwLag, lwLag, ratio, cons, msl, planes, port_name, hwU=15, lwU=20, note=''):
    a = round(cons - msl, 3)
    return {'km': km, 'name': name, 'hwLag': hwLag, 'lwLag': lwLag, 'hwU': hwU, 'lwU': lwU, 'hw': [a, ratio], 'lw': [a, ratio], 'kind': 'msq',
            'src': f'MSQ 2025 Tidal Planes secondary place {place}: HW {hwLag:+d} min, LW {lwLag:+d} min on {port_name}; ratio {ratio:.2f}, cons {cons:+.2f}; '
                   f'planes MHWS {planes[0]:.2f} MHWN {planes[1]:.2f} MLWN {planes[2]:.2f} MLWS {planes[3]:.2f}, MSL {msl:.2f} m LAT' + (note and ' — ' + note)}

def limit_node(base, km, dist, meanHW, rates=(2.0, 3.2), region='this region'):
    hw_at = base['hw'][0] + base['hw'][1] * meanHW
    b = round(base['hw'][1] * 0.7, 4); hl = hw_at - 0.15; a = round(hl - b * meanHW, 3); fl = round(0.2 * hl, 3)
    return {'km': round(km, 2), 'name': 'Tidal limit (est.)', 'hwLag': round(base['hwLag'] + rates[0] * dist), 'lwLag': round(base['lwLag'] + rates[1] * dist),
            'hwU': round(base['hwU'] + 10 + 3.5 * dist), 'lwU': round(base['lwU'] + 15 + 5.5 * dist), 'kind': 'generic', 'generic': True,
            'src': f'Generic extrapolation {dist:.1f} km beyond the last calibration: median lag growth of calibrated QLD places/gauges in {region} '
                   f'(HW +{rates[0]:.1f}, LW +{rates[1]:.1f} min/km); at a natural tidal limit highs ≈ 0.15 m lower than downstream and lows drain out '
                   f'(pool level {fl:.2f} m, assumed)', 'hw': [a, b], 'lw': [fl, 0.0], 'trunc': True, 'floor': fl}

def ov_line(coords): return [[round(p[0], 4), round(p[1], 4)] for p in simplify(coords, 60.0)]
