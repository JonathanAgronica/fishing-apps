"""Re-route channel centrelines along the persistent low-tide channel (thalweg proxy).
For each line: cost = 1 + A(1-F)^2 + B(d/buf)^2 inside a buffer around the current line (F = low-tide water frequency,
0.6 x 2024-26 + 0.4 x all years; d = distance to the current line), least-cost path between the line's own end points
(skimage MCP), smoothed; points where the channel is not resolved at 10 m (local F < 0.35, i.e. creeks narrower than
~20-30 m or no clear low-tide water) are put back on the current line, so narrow creeks keep their mapped geometry.
km scale: every new vertex gets the km of its projection on the current line (made monotone) — "kc", so all km-keyed
data (tide nodes, gauges, landmarks, junctions, crossings, calibration) keep their km and physical place; only the drawn
line, snapping and marker positions move onto the channel. Migration: the same route per epoch; offsets > 60 m between
the 2018-20 and 2024-26 routes in resolved water are reported."""
import json, os, sys, math, hashlib
import numpy as np
import beacons
from pyproj import Transformer
from skimage.graph import route_through_array
from scipy import ndimage
from lines import system_lines, all_systems, cum, hav
from imagery import WORK, load_clusters, EPOCHS
HERE = os.path.dirname(os.path.abspath(__file__)); OVL = os.path.join(HERE, 'out')
T_LL = Transformer.from_crs('EPSG:4326', 'EPSG:32756', always_xy=True); T_UTM = Transformer.from_crs('EPSG:32756', 'EPSG:4326', always_xy=True)
A, Bp, BUF, FRES, MINV = 30.0, 6.0, 300.0, 0.35, 4

def sha(coords): return hashlib.sha1(json.dumps(coords, separators=(',', ':')).encode()).hexdigest()[:12]

class Comp:
    def __init__(self, cid):
        d = f'{WORK}/{cid}'; Z = np.load(f'{d}/comp.npz'); J = json.load(open(f'{d}/comp.json')); self.G = J['grid']; self.meta = J
        self.Fe = []
        for i in range(len(EPOCHS)):
            w, v = Z[f'w{i}'].astype(np.float32), Z[f'v{i}'].astype(np.float32)
            self.Fe.append(np.where(v >= MINV, w / np.maximum(v, 1), np.nan))
        w = sum(Z[f'w{i}'].astype(np.float32) for i in range(len(EPOCHS))); v = sum(Z[f'v{i}'].astype(np.float32) for i in range(len(EPOCHS)))
        self.Fall = np.where(v >= MINV, w / np.maximum(v, 1), np.nan); r = self.Fe[-1]
        self.F = np.where(np.isnan(r), self.Fall, 0.6 * np.nan_to_num(r) + 0.4 * np.nan_to_num(self.Fall)); self.F = np.nan_to_num(self.F)
        # cost field: half low-tide frequency, half 'very low tide' frequency (only the deepest channel stays wet), so inside wide
        # estuaries / mouths that are all water at ordinary low tide the route still follows the thalweg
        self.Fc = self.F
        if 'wl0' in Z:
            wl = sum(Z[f'wl{i}'].astype(np.float32) for i in range(len(EPOCHS))); vl = sum(Z[f'vl{i}'].astype(np.float32) for i in range(len(EPOCHS)))
            wr, vr = Z[f'wl{len(EPOCHS) - 1}'].astype(np.float32), Z[f'vl{len(EPOCHS) - 1}'].astype(np.float32)
            Fl_all = np.where(vl >= 3, wl / np.maximum(vl, 1), np.nan); Fl_r = np.where(vr >= 3, wr / np.maximum(vr, 1), np.nan)
            Fl = np.where(np.isnan(Fl_r), Fl_all, 0.6 * np.nan_to_num(Fl_r) + 0.4 * np.nan_to_num(Fl_all)); self.Flow = Fl
            self.Fc = np.where(np.isnan(Fl), self.F, 0.5 * self.F + 0.5 * np.nan_to_num(Fl)).astype(np.float32)
        # depth proxy inside water: scene-normalised green brightness of water pixels (shoals bright, deep channel dark)
        self.Dp = None
        if 'gs0' in Z:
            gs = sum(Z[f'gs{i}'].astype(np.float32) for i in range(len(EPOCHS))); gn = sum(Z[f'gn{i}'].astype(np.float32) for i in range(len(EPOCHS)))
            gr = np.where(gn >= 6, gs / np.maximum(gn, 1), np.nan); gr = ndimage.median_filter(np.nan_to_num(gr, nan=1.25), size=3)
            self.Dp = np.clip((1.25 - gr) / 0.6, 0, 1).astype(np.float32)
            self.Fc = (self.Fc * (0.45 + 0.55 * self.Dp)).astype(np.float32)
        self.lab, _ = ndimage.label(self.F >= FRES, structure=np.ones((3, 3)))
        dist, (ri, ci) = ndimage.distance_transform_edt(self.lab == 0, return_indices=True); self.wd = (dist * self.G['res']).astype(np.float32); self.wl = self.lab[ri, ci]
    def at(self, arr, rc):
        ii = np.clip(np.round(rc[:, 0]).astype(int), 0, arr.shape[0] - 1); jj = np.clip(np.round(rc[:, 1]).astype(int), 0, arr.shape[1] - 1); return arr[ii, jj]
    def px(self, P):
        x, y = T_LL.transform([p[1] for p in P], [p[0] for p in P]); G = self.G
        return np.array([(G['y1'] - np.array(y)) / G['res'] - 0.5, (np.array(x) - G['x0']) / G['res'] - 0.5]).T  # row, col (float)
    def ll(self, rc):
        G = self.G; x = G['x0'] + (rc[:, 1] + 0.5) * G['res']; y = G['y1'] - (rc[:, 0] + 0.5) * G['res']; lo, la = T_UTM.transform(x, y)
        return [[float(a), float(b)] for a, b in zip(la, lo)]

def densify(rc, step=0.5):
    out = [rc[0]]
    for a, b in zip(rc[:-1], rc[1:]):
        n = max(1, int(np.ceil(np.hypot(*(b - a)) / step)))
        for k in range(1, n + 1): out.append(a + (b - a) * k / n)
    return np.array(out)

def proj_s(P, C, q):
    """chainage (km) of the projection of q onto polyline P (planar local)"""
    kx = math.cos(math.radians(q[0])); best = (1e9, 0.0)
    for i in range(len(P) - 1):
        ax, ay = P[i][1] * kx, P[i][0]; bx, by = P[i + 1][1] * kx, P[i + 1][0]; qx, qy = q[1] * kx, q[0]; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, ((qx - ax) * dx + (qy - ay) * dy) / L)); d = (ax + t * dx - qx) ** 2 + (ay + t * dy - qy) ** 2
        if d < best[0]: best = (d, C[i] + t * (C[i + 1] - C[i]))
    return best[1]

def dist_to_line_m(P, q):
    kx = math.cos(math.radians(q[0])); best = 1e18
    for i in range(len(P) - 1):
        ax, ay = P[i][1] * kx, P[i][0]; bx, by = P[i + 1][1] * kx, P[i + 1][0]; qx, qy = q[1] * kx, q[0]; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy
        t = 0 if L == 0 else max(0, min(1, ((qx - ax) * dx + (qy - ay) * dy) / L)); best = min(best, (ax + t * dx - qx) ** 2 + (ay + t * dy - qy) ** 2)
    return math.sqrt(best) * 111320.0

def rdp(P, eps_m):
    if len(P) < 3: return P
    lat0 = P[0][0]; X = [(math.radians(p[1]) * 6371008.8 * math.cos(math.radians(lat0)), math.radians(p[0]) * 6371008.8) for p in P]; keep = {0, len(P) - 1}; st = [(0, len(P) - 1)]
    while st:
        i, j = st.pop(); ax, ay = X[i]; bx, by = X[j]; dx, dy = bx - ax, by - ay; L = dx * dx + dy * dy; dm, km_ = -1, None
        for k in range(i + 1, j):
            px_, py_ = X[k]; t = 0 if L == 0 else max(0, min(1, ((px_ - ax) * dx + (py_ - ay) * dy) / L)); d = math.hypot(px_ - ax - t * dx, py_ - ay - t * dy)
            if d > dm: dm, km_ = d, k
        if km_ is not None and dm > eps_m: keep.add(km_); st += [(i, km_), (km_, j)]
    return [P[i] for i in sorted(keep)]

def route_line(C, coords, F, buf=BUF):
    rc = densify(C.px(coords)); H, W = F.shape; pad = int(buf / C.G['res']) + 3
    r0, c0 = max(0, int(rc[:, 0].min()) - pad), max(0, int(rc[:, 1].min()) - pad); r1, c1 = min(H, int(rc[:, 0].max()) + pad + 1), min(W, int(rc[:, 1].max()) + pad + 1)
    if r1 - r0 < 3 or c1 - c0 < 3: return None
    sub = F[r0:r1, c0:c1]; mask = np.ones(sub.shape, bool); ii = np.clip(np.round(rc[:, 0] - r0).astype(int), 0, sub.shape[0] - 1); jj = np.clip(np.round(rc[:, 1] - c0).astype(int), 0, sub.shape[1] - 1)
    mask[ii, jj] = False; d = ndimage.distance_transform_edt(mask) * C.G['res']
    cost = 1 + A * (1 - sub) ** 2 + Bp * (d / buf) ** 2; cost[d > buf] = 1e6
    path, _ = route_through_array(cost, (ii[0], jj[0]), (ii[-1], jj[-1]), fully_connected=True, geometric=True)
    p = np.array(path, float); p[:, 0] += r0; p[:, 1] += c0
    return p, (r0, c0, sub, d)

def smooth(p, win=5):
    if len(p) < win + 2: return p
    k = np.ones(win) / win; q = p.copy()
    for j in (0, 1): q[win // 2:-(win // 2), j] = np.convolve(p[:, j], k, mode='valid')
    return q

def local_F(F, rc):
    Fm = ndimage.maximum_filter(F, size=3); ii = np.clip(np.round(rc[:, 0]).astype(int), 0, F.shape[0] - 1); jj = np.clip(np.round(rc[:, 1]).astype(int), 0, F.shape[1] - 1)
    return Fm[ii, jj]

def interp(P, C, s):
    i = max(1, min(len(P) - 1, int(np.searchsorted(C, s)))); a, b = P[i - 1], P[i]; f = 0 if C[i] == C[i - 1] else (s - C[i - 1]) / (C[i] - C[i - 1])
    return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])]

def sample_F(C, F, coords, step_km=0.01):
    rc = densify(C.px(coords)); return local_F(F, rc)

def refine(C, L, parent=None, G=None):
    old = L['coords']; Cold = cum(old)
    if Cold[-1] < 0.3: return {'status': 'unchanged', 'why': 'too short'}
    r = route_line(C, old, C.Fc)
    if r is None: return {'status': 'unchanged', 'why': 'outside imagery'}
    p, _ = r; p = smooth(p, 7); lf = local_F(C.F, p); res = lf >= FRES; lfc = local_F(C.Fc, p)
    pts = C.ll(p); oldF = sample_F(C, C.F, old)
    frac_res = float(res.mean())
    if frac_res < 0.1: return {'status': 'unchanged', 'why': f'channel not resolved at 10 m ({frac_res:.0%} of the route)', 'Fold': float(np.mean(oldF))}
    # splice: resolved runs (>= 100 m of channel) follow the channel; everything between them is the current line's own
    # geometry (so narrow / dry stretches keep every mapped bend — no short-cuts across land or meander necks)
    runs = []; i = 0; n = len(res)
    while i < n:
        if not res[i]: i += 1; continue
        j = i
        while j + 1 < n and res[j + 1]: j += 1
        if j - i + 1 >= 10:
            # long runs are judged in ~1 km pieces, split where the route touches the mapped line (so a good bend
            # re-route isn't diluted by kilometres of channel the line already follows)
            k = i
            while j - k + 1 > 150:
                lo_, hi_ = k + 70, min(j - 40, k + 150)
                if hi_ <= lo_: break
                cut = min(range(lo_, hi_, 2), key=lambda t: dist_to_line_m(old, pts[t])); runs.append((k, cut)); k = cut
            runs.append((k, j))
        i = j + 1
    out = [list(old[0])]; last = 0.0; used = 0; rej = []
    for i, j in runs:
        sa, sb = proj_s(old, Cold, pts[i]), proj_s(old, Cold, pts[j])
        if sb - sa < 0.05 or sa < last - 0.02: continue
        seg = [list(old[k]) for k in range(len(old)) if sa <= Cold[k] <= sb]
        segp = [interp(old, Cold, sa)] + seg + [interp(old, Cold, sb)]
        fo = float(np.mean(sample_F(C, C.Fc, segp))); fn = float(np.mean(lfc[i:j + 1])); off = max(dist_to_line_m(segp, q) for q in pts[i:j + 1:3])
        if os.environ.get('RDEBUG'): print('  run', L['id'], round(sa + L['km0'], 2), round(sb + L['km0'], 2), 'fo', round(fo, 3), 'fn', round(fn, 3), 'off', round(off))
        if fn < fo + 0.10 or off < 20: continue
        kr = [r for r in KEEP_KM.get(f"{L['sys']}/{L['id']}", []) if sa + L['km0'] < r[1] and sb + L['km0'] > r[0]]
        if kr: rej.append(('kept after visual QA: ' + kr[0][2], round(sa + L['km0'], 2))); continue   # this stretch is already on the channel (or no clear gain): keep the mapped line
        # same water body: the mapped stretch must run in / beside (<= 60 m) the water the new route uses (no farm dams,
        # lagoons or the parent river), the route must progress along the mapped stretch and not be much longer than it
        rl = C.at(C.lab, p[i:j + 1]); rl = rl[rl > 0]
        if not len(rl): continue
        comp = np.bincount(rl).argmax(); so = densify(C.px(segp)); near = (C.at(C.wd, so) <= 60) & (C.at(C.wl, so) == comp)
        if near.mean() < 0.4: rej.append(('other water body', round(sa + L['km0'], 2))); continue
        ss = [proj_s(old, Cold, q) for q in pts[i:j + 1:4]]
        if any(ss[k + 1] < ss[k] - 0.03 for k in range(len(ss) - 1)): rej.append(('route doubles back', round(sa + L['km0'], 2))); continue
        if cum(pts[i:j + 1])[-1] > 1.3 * (sb - sa) + 0.05: rej.append(('route much longer than the mapped stretch', round(sa + L['km0'], 2))); continue
        if parent is not None and any(min(dist_to_line_m(pl, q) for pl in parent) < 40 and hav(q, old[0]) > 0.03 for q in pts[i:j + 1:3]): rej.append(('runs along the parent channel', round(sa + L['km0'], 2))); continue
        if parent is not None and fo < 0.05 and fn < 0.5: rej.append(('patchy water (wetland / ponds), not a channel', round(sa + L['km0'], 2))); continue
        if parent is not None and off > 80 and fo >= 0.15: rej.append((f'large jump ({off:.0f} m) for a side creek already in water', round(sa + L['km0'], 2))); continue
        out += [list(old[k]) for k in range(len(old)) if last + 1e-9 < Cold[k] < sa - 0.01]
        out += [[round(a, 5), round(b, 5)] for a, b in rdp([list(q) for q in pts[i:j + 1]], 6.0)]; last = sb; used += j - i + 1   # only the new piece is simplified
    out += [list(old[k]) for k in range(len(old)) if last + 0.01 < Cold[k] < Cold[-1] - 1e-9]; out.append(list(old[-1]))
    if used == 0:
        why = ('candidate re-routes rejected: ' + '; '.join(sorted({r[0] for r in rej}))) if rej else 'already on the persistent channel' if runs else 'no resolved channel run >= 100 m'
        return {'status': 'unchanged', 'why': why, 'rejected': rej[:20], 'Fold': float(np.mean(oldF))}
    new = [list(q) for q in out]   # mapped vertices kept exactly outside the re-routed pieces
    # metrics
    newF = sample_F(C, C.Fc, new); oldF = sample_F(C, C.Fc, old); offs = [dist_to_line_m(old, q) for q in new]; mx = max(offs)
    if mx < 15: return {'status': 'unchanged', 'why': 'already on the channel (max shift < 15 m)', 'Fold': float(np.mean(oldF)), 'Fnew': float(np.mean(newF))}
    gates = None
    if G:   # independent check: lateral navigation-mark gates (OSM seamarks) must not get worse
        n0, ok0, _ = beacons.check(old, G); n1, ok1, bad1 = beacons.check(new, G); gates = {'before': [ok0, n0], 'after': [ok1, n1], 'failing': bad1[:10]}
        if n0 and ok1 < ok0: return {'status': 'unchanged', 'why': f're-route would pass fewer navigation-mark gates ({ok1}/{n1} vs {ok0}/{n0})', 'Fold': float(np.mean(oldF))}
    if False: return {'status': 'unchanged', 'why': f'no gain in low-tide water (F {np.mean(oldF):.2f} → {np.mean(newF):.2f})', 'Fold': float(np.mean(oldF)), 'Fnew': float(np.mean(newF))}
    # km scale anchored to the current line
    kc = [proj_s(old, Cold, q) for q in new]; kc[0] = 0.0; kc[-1] = Cold[-1]
    for i in range(1, len(kc)): kc[i] = max(kc[i], kc[i - 1])
    for i in range(len(kc) - 2, -1, -1): kc[i] = min(kc[i], kc[i + 1])
    Cn = cum(new); i = 0
    while i < len(kc) - 1:   # spread flat runs by the new chainage so km strictly increases
        j = i
        while j + 1 < len(kc) and kc[j + 1] - kc[i] < 1e-6: j += 1
        if j > i:
            k2 = kc[j + 1] if j + 1 < len(kc) else kc[j] + 1e-3; lo, hi = Cn[i], Cn[j + 1] if j + 1 < len(kc) else Cn[j] + 1e-3
            for k in range(i + 1, j + 1): kc[k] = kc[i] + (k2 - kc[i]) * (Cn[k] - lo) / max(hi - lo, 1e-9) * 0.999
        i = j + 1
    kc = [round(v, 4) for v in kc]
    # migration between the first and last epochs
    mig = []
    try:
        pa = route_line(C, old, np.nan_to_num(C.Fe[0]))[0]; pb = route_line(C, old, np.nan_to_num(C.Fe[-1]))[0]
        A_ = C.ll(smooth(pa, 7)); B_ = C.ll(smooth(pb, 7)); lfa = local_F(np.nan_to_num(C.Fe[0]), smooth(pa, 7))
        Bs = rdp(B_, 5.0)
        for q, f in zip(A_[::5], lfa[::5]):
            if f < 0.5: continue
            dd = dist_to_line_m(Bs, q)
            if dd > 60: mig.append([round(q[0], 5), round(q[1], 5), round(dd), round(L['km0'] + proj_s(old, Cold, q), 2)])
    except Exception as ex: mig = [['err', str(ex)]]
    return {'status': 'changed', 'gates': gates, 'rejected': rej[:20], 'coords': new, 'kc': kc, 'orig': sha(old), 'maxShift': round(mx), 'meanShift': round(float(np.mean(offs))),
            'Fold': round(float(np.mean(oldF)), 3), 'Fnew': round(float(np.mean(newF)), 3), 'resolved': round(frac_res, 3),
            'lenOld': round(Cold[-1], 3), 'lenNew': round(Cn[-1], 3), 'migration': mig[:40], 'nMig': len(mig)}

# lines kept as mapped after visual QA against imagery (reason recorded in the overlay)
KEEP = {
    'pumicestone-passage/M': 'kept: wide clear-water passage - seagrass beds read as deep in the optical depth proxy and pulled the route onto the western flats; the mapped line is inside the low-tide channel',
    'burpengary-creek/T1': 'kept: re-route chased residential lakes / ponds beside the creek',
    'eli-creek/M': 'kept: narrow urban creek, the 10 m water mask picks up ponds and drains',
    'eprapah-creek/M': 'kept: re-route jumped to a different branch near the mouth',
    'mary-river/M': 'kept: re-route took the side anabranch around a mid-river island',
    'noosa-river/M': 'kept: re-route short-cut over a vegetated strip into the lake; mapped line follows the channel',
    'burnett-river/T7': 'kept: hand-traced 2026-10 from imagery; the island split and an imagery-tile edge confuse the 10 m water mask',
}

# km ranges kept as mapped after visual QA (system km)
KEEP_KM = {
    'burnett-river/M': [(21.0, 24.3, 'mid-river island with an anabranch beside the McCoy / Splitters creek mouths - the main channel is ambiguous at 10 m')],
}

def cluster_of(sid):
    for c in load_clusters():
        if sid in c['systems']: return c['id']

def run(sid):
    cid = cluster_of(sid); C = Comp(cid); res = {}
    LL = system_lines(sid); BY = {L['id']: L for L in LL}
    la = [p[0] for l in LL for p in l['coords']]; lo = [p[1] for l in LL for p in l['coords']]; G = beacons.gates(beacons.marks([min(la), min(lo), max(la), max(lo)]))
    for L in LL:
        pl = None
        if L['parent'] in BY:
            pl = [BY[L['parent']]['coords']] + ([res[L['parent']]['coords']] if res.get(L['parent'], {}).get('status') == 'changed' else [])
        r = refine(C, L, pl, G) if f"{sid}/{L['id']}" not in KEEP else {'status': 'unchanged', 'why': KEEP[f"{sid}/{L['id']}"]}
        if r['status'] == 'unchanged' and G:
            n0, ok0, bad0 = beacons.check(L['coords'], G)
            if n0: r['gates'] = {'before': [ok0, n0], 'failing': bad0[:10]}
        res[L['id']] = dict(r, name=L['name'], km0=L['km0'])
    used = C.meta['used']; years = sorted({u[1][:4] for k in used for u in used[k]})
    O = {'sys': sid, 'cluster': cid, 'imagery': {'source': 'Sentinel-2 L2A (Copernicus, via Earth Search STAC / AWS open data); nav-mark check: OpenStreetMap seamarks (ODbL)', 'years': years,
         'scenes': sum(len(used[k]) for k in used), 'lowTideThr': round(C.meta['thr'], 3)}, 'params': {'A': A, 'B': Bp, 'buf_m': BUF, 'Fres': FRES}, 'lines': res}
    os.makedirs(OVL, exist_ok=True); json.dump(O, open(f'{OVL}/{sid}.json', 'w'), separators=(',', ':')); return O

if __name__ == '__main__':
    for sid in (sys.argv[1:] or all_systems()):
        O = run(sid)
        for k, v in O['lines'].items():
            print(sid, k, v['name'][:28], v['status'], v.get('why', ''), {x: v[x] for x in ('maxShift', 'meanShift', 'Fold', 'Fnew', 'resolved', 'lenOld', 'lenNew', 'nMig', 'gates') if x in v})
