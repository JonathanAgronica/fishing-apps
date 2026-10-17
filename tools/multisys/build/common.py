"""Shared helpers for the river-system build scripts (recreated 2026-10-18 after a box restore lost the originals).
Conventions reverse-engineered from the published data/systems/*.json and verified by regen_check.py:
  * channel geometry = OSM waterway nodes simplified with Douglas-Peucker, tolerance 12 m (local equirectangular metres),
    coordinates rounded to 5 dp (the Yandina extension used 6 dp);
  * chainage = cumulative haversine km (R = 6371.0088 km);
  * side channel = [projection of its first OSM node onto the parent] + OSM chain, cut at the tidal limit;
  * DEM tidal limit = first sample (every 0.2 km along the creek) from which the rolling minimum of the
    Copernicus GLO-90 elevations over the next 1 km (truncated at the end of the line) is >= 4 m; min 0.6 km;
    if that is beyond the mapped length the limit is 'end of mapped waterway';
  * system JSON written compact (separators ',' ':'), UTF-8, ensure_ascii=False, no trailing newline.
"""
import json, math, os
HERE = os.path.dirname(os.path.abspath(__file__))
MS = os.path.dirname(HERE)                      # tools/multisys
OUT = os.path.join(MS, 'out')                   # canonical generated data (copied into data/ by src/build.py)
OSM = os.path.join(MS, 'osm')
BASE = os.path.join(MS, 'base')

def load(p): return json.load(open(p, encoding='utf-8'))
def dumps(o, ascii=False): return json.dumps(o, separators=(',', ':'), ensure_ascii=ascii)
def save(p, o, ascii=False):
    with open(p, 'w', encoding='utf-8') as f: f.write(dumps(o, ascii))

def hav(a, b):
    R = 6371.0088; p1, p2 = math.radians(a[0]), math.radians(b[0]); dp = p2 - p1; dl = math.radians(b[1] - a[1])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))
def cum(P):
    c = [0.0]
    for i in range(1, len(P)): c.append(c[-1] + hav(P[i - 1], P[i]))
    return c
def xy(p, lat0):
    return (math.radians(p[1]) * 6371008.8 * math.cos(math.radians(lat0)), math.radians(p[0]) * 6371008.8)
def rdp_idx(pts, eps=12.0):
    """Douglas-Peucker on (lat,lng) points, eps in metres; returns kept indices (iterative, segment distance)."""
    if len(pts) < 3: return list(range(len(pts)))
    lat0 = pts[0][0]; P = [xy(p, lat0) for p in pts]; keep = {0, len(P) - 1}; st = [(0, len(P) - 1)]
    while st:
        i, j = st.pop(); ax, ay = P[i]; bx, by = P[j]; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy; dm = -1; km = None
        for k in range(i + 1, j):
            px, py = P[k]
            if L == 0: d = math.hypot(px - ax, py - ay)
            else:
                t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L)); d = math.hypot(px - ax - t * dx, py - ay - t * dy)
            if d > dm: dm, km = d, k
        if km is not None and dm > eps: keep.add(km); st += [(i, km), (km, j)]
    return sorted(keep)
def simplify(pts, eps=12.0): return [pts[i] for i in rdp_idx(pts, eps)]
def r5(p): return [round(p[0], 5), round(p[1], 5)]
def r6(p): return [round(p[0], 6), round(p[1], 6)]
def proj(P, q, C=None):
    """nearest point of polyline P to q (cos-scaled planar): (dist_km, chainage_km, point)"""
    C = C or cum(P); kx = math.cos(math.radians(q[0])); best = (1e9, 0.0, None)
    for i in range(len(P) - 1):
        ax, ay = P[i][1] * kx, P[i][0]; bx, by = P[i + 1][1] * kx, P[i + 1][0]; qx, qy = q[1] * kx, q[0]
        dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, ((qx - ax) * dx + (qy - ay) * dy) / L))
        pt = [P[i][0] + t * (P[i + 1][0] - P[i][0]), P[i][1] + t * (P[i + 1][1] - P[i][1])]
        d = hav(pt, q)
        if d < best[0]: best = (d, C[i] + t * (C[i + 1] - C[i]), pt)
    return best
def cut(P, km):
    """polyline truncated at chainage km (interpolated end point)"""
    C = cum(P); out = [P[0]]
    for i in range(1, len(P)):
        if C[i] < km - 1e-9: out.append(P[i]); continue
        t = (km - C[i - 1]) / (C[i] - C[i - 1]) if C[i] > C[i - 1] else 0
        out.append([P[i - 1][0] + t * (P[i][0] - P[i - 1][0]), P[i - 1][1] + t * (P[i][1] - P[i - 1][1])]); return out
    return out
def dem_limit(elev, step=0.2, win=1.0, thr=4.0, min_km=0.6, length=None):
    """elev = elevations sampled every `step` km from the junction. Returns (km, 'dem'|'end')."""
    n = int(round(win / step))
    for i in range(len(elev)):
        w = elev[i:i + n + 1]
        if w and min(w) >= thr:
            km = max(min_km, round(i * step, 2))
            if length is not None and km >= length: return round(length, 2), 'end'
            return km, 'dem'
    return (round(length, 2) if length is not None else None), 'end'
def osm_ways(path, pred):
    return [e for e in load(path)['elements'] if e['type'] == 'way' and e.get('geometry') and pred(e)]
def way_pts(e): return [[p['lat'], p['lon']] for p in e['geometry']]

def bbox(sysj):
    pts = [p for L in sysj['lines'] for p in L['coords']]
    return [min(p[0] for p in pts), min(p[1] for p in pts), max(p[0] for p in pts), max(p[1] for p in pts)]
def max_km(sysj):
    return round(max((L['junctionKm'] if L.get('parent') else 0) + L['limitKm'] for L in sysj['lines']), 2)
def index_entry(sysj, ov, port=None, km=None, bb=None):
    """data/systems/index.json entry. `ov` (map overview polylines, 4 dp) is carried over: it was simplified from the
    unrounded geometry, which is no longer available (≈ RDP 60 m; regen_check.py measures it)."""
    return {'id': sysj['id'], 'name': sysj['name'], 'area': sysj['area'], 'mouth': sysj['mouth'],
            'bbox': bb or [round(v, 4) for v in bbox(sysj)], 'conf': sysj['confidence']['grade'],
            'port': port or sysj['port']['name'], 'km': km if km is not None else round(sysj['lines'][0]['limitKm'], 1),
            'n': len(sysj['lines']), 'g': len(sysj['gauges']), 'ov': ov}
