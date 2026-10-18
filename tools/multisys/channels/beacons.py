"""Independent check of a channel line against lateral navigation marks (OpenStreetMap seamark data, ODbL; mapped from
MSQ beacons). A 'gate' is a port (red) + starboard (green) lateral mark pair <= 350 m apart; a navigation line near a
gate (<= 250 m from its midpoint) should pass BETWEEN the two marks. Direction-agnostic (works for passages buoyed from
both ends). Data: /workspace/multisys/work/channels/seamarks.json (Overpass query of seamark:type lateral/cardinal)."""
import json, math, os
SM = '/workspace/multisys/work/channels/seamarks.json'
def _xy(p, la0): return ((p[1]) * 111.32 * math.cos(math.radians(la0)), p[0] * 110.574)
def _cross(a, b, c, d):
    def o(p, q, r): return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    return o(a, b, c) * o(a, b, d) < 0 and o(c, d, a) * o(c, d, b) < 0
def marks(bbox=None):
    if not os.path.exists(SM): return []
    M = [m for m in json.load(open(SM)) if m['t'] and 'lateral' in m['t'] and m['cat'] in ('port', 'starboard')]
    if bbox: s, w, n, e = bbox; M = [m for m in M if s - 0.01 <= m['lat'] <= n + 0.01 and w - 0.01 <= m['lon'] <= e + 0.01]
    return M
def gates(M):
    P = [m for m in M if m['cat'] == 'port']; S = [m for m in M if m['cat'] == 'starboard']; G = []
    for p in P:
        best = None
        for s in S:
            la0 = p['lat']; a = _xy((p['lat'], p['lon']), la0); b = _xy((s['lat'], s['lon']), la0); d = math.hypot(a[0] - b[0], a[1] - b[1])
            if d <= 0.35 and (best is None or d < best[0]): best = (d, s)
        if best: G.append((p, best[1]))
    return G
def check(coords, G):
    """-> (n gates near the line, n passed, [failing gate midpoints])"""
    if not coords or not G: return 0, 0, []
    la0 = coords[0][0]; X = [_xy(c, la0) for c in coords]; n = ok = 0; bad = []
    for p, s in G:
        a = _xy((p['lat'], p['lon']), la0); b = _xy((s['lat'], s['lon']), la0); m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        ds = [math.hypot(x[0] - m[0], x[1] - m[1]) for x in X]; k = min(range(len(X)), key=ds.__getitem__)
        if ds[k] > 0.25: continue
        # only gates ACROSS the channel: >= 25 m wide and at >= 40 deg to the line's local direction
        i0, i1 = max(0, k - 2), min(len(X) - 1, k + 2); vx, vy = X[i1][0] - X[i0][0], X[i1][1] - X[i0][1]; gx, gy = b[0] - a[0], b[1] - a[1]
        gw = math.hypot(gx, gy); vl = math.hypot(vx, vy)
        if gw < 0.025 or vl == 0 or abs(vx * gx + vy * gy) / (vl * gw) > math.cos(math.radians(40)): continue
        n += 1
        # extend the gate a little (marks sit on the channel edge) and test crossing
        ux, uy = b[0] - a[0], b[1] - a[1]; L = math.hypot(ux, uy) or 1; ext = 0.03
        A = (a[0] - ux / L * ext, a[1] - uy / L * ext); B = (b[0] + ux / L * ext, b[1] + uy / L * ext)
        if any(_cross(X[i], X[i + 1], A, B) for i in range(len(X) - 1)): ok += 1
        else: bad.append([round((p['lat'] + s['lat']) / 2, 5), round((p['lon'] + s['lon']) / 2, 5)])
    return n, ok, bad
if __name__ == '__main__':
    import sys
    from lines import system_lines
    for sid in sys.argv[1:]:
        LL = system_lines(sid); la = [p[0] for l in LL for p in l['coords']]; lo = [p[1] for l in LL for p in l['coords']]
        G = gates(marks([min(la), min(lo), max(la), max(lo)]))
        for l in LL:
            n, ok, bad = check(l['coords'], G)
            if n: print(sid, l['id'], l['name'], f'gates {ok}/{n} passed', bad[:6])
