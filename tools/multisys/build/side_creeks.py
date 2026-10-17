"""Side-creek / channel generation from OSM + DEM (recreated 2026-10-18).
build_side(parent_coords, src_pts, limit) -> (coords, junctionKm_on_parent)
  parent_coords : published (5 dp) coordinates of the parent line
  src_pts       : OSM node chain of the creek, starting at its mouth end
  limit         : ('cut', km) to truncate at the tidal limit, or ('end', None) to keep the mapped length
dem_profile(P, elev_lookup) samples every 0.2 km and returns elevations for common.dem_limit().
chain_by_name(ways, start) joins OSM ways greedily end-to-end (gap <= 250 m) from `start`.
"""
from common import *

def build_side(parent, src, limit, eps=12.0, rnd=r5, junction=True):
    d, jk, jp = proj(parent, src[0])
    P = ([jp] if junction else []) + src
    if limit[0] == 'cut' and limit[1] < cum(P)[-1] - 1e-9: P = cut(P, limit[1])
    return [rnd(p) for p in simplify(P, eps)], jk

def chain_by_name(ways, start, gap_km=0.25):
    segs = [way_pts(e) for e in ways]; pts = [start]; cur = start; used = set()
    while True:
        bi = None; bd = gap_km
        for k, s in enumerate(segs):
            if k in used: continue
            for q in (s, s[::-1]):
                dd = hav(cur, q[0])
                if dd < bd: bd, bi = dd, (k, q)
        if not bi: break
        used.add(bi[0]); pts += bi[1][1:]; cur = pts[-1]
    return pts

def resample(P, step=0.2):
    C = cum(P); out = []; k = 0.0; i = 1
    while k <= C[-1] + 1e-9:
        while i < len(P) - 1 and C[i] < k: i += 1
        t = 0 if C[i] == C[i - 1] else (k - C[i - 1]) / (C[i] - C[i - 1]); t = max(0, min(1, t))
        out.append([P[i - 1][0] + t * (P[i][0] - P[i - 1][0]), P[i - 1][1] + t * (P[i][1] - P[i - 1][1])]); k += step
    return out

def dem_profile(P, dem, step=0.2):
    """dem: dict 'lat,lng' (4 dp) -> metres (cache of Open-Meteo elevation API answers). Missing samples -> None."""
    return [dem.get('%.4f,%.4f' % (p[0], p[1])) for p in resample(P, step)]
