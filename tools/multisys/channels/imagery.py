"""Low-tide water-frequency composites from Sentinel-2 L2A (Copernicus data via the Earth Search STAC, AWS open data;
contains modified Copernicus Sentinel data). Cache: /workspace/multisys/work/channels/<cluster>/ (not in the repo).
  clusters  : systems grouped into windows <= ~0.3 deg (bbox of every line + 600 m)
  scenes    : STAC search (cloud < 50 %), one item per (MGRS tile, date) (latest processing)
  tides     : port height at each scene time from the app's own tide model (tools/multisys/channels/tide_at.mjs)
  composite : per epoch (2018-20, 2021-23, 2024-26) the N lowest-tide scenes (port height in the lowest 40 % of all scene
              times) with >= 60 % clear pixels; water = NDWI(B03,B08) > 0 or SCL water; valid = SCL in {2,4,5,6,7}.
              Saves water/valid counts per epoch on the 10 m UTM 56S grid, plus the same for the NLOW lowest-tide days only
              (where only the deepest channel stays wet: the thalweg proxy inside wide estuaries)."""
import json, os, sys, math, time, concurrent.futures as cf
import numpy as np
from lines import system_lines, all_systems
WORK = '/workspace/multisys/work/channels'
EPOCHS = [(2018, 2020), (2021, 2023), (2024, 2026)]
NLOW = 8   # days per epoch in the 'very low tide' composite
os.environ.setdefault('GDAL_DISABLE_READDIR_ON_OPEN', 'EMPTY_DIR'); os.environ.setdefault('AWS_NO_SIGN_REQUEST', 'YES')
os.environ.setdefault('GDAL_HTTP_MAX_RETRY', '4'); os.environ.setdefault('GDAL_HTTP_RETRY_DELAY', '2')

def sys_bbox(sid, pad_km=0.6):
    P = [p for L in system_lines(sid) for p in L['coords']]
    la = [p[0] for p in P]; lo = [p[1] for p in P]; dla = pad_km / 111.0; dlo = pad_km / (111.0 * math.cos(math.radians(sum(la) / len(la))))
    return [min(la) - dla, min(lo) - dlo, max(la) + dla, max(lo) + dlo]

def clusters(maxdeg=0.3):
    B = {s: sys_bbox(s) for s in all_systems()}; left = sorted(B, key=lambda s: -(B[s][2] - B[s][0]) * (B[s][3] - B[s][1])); C = []
    while left:
        s = left.pop(0); bb = list(B[s]); mem = [s]
        changed = True
        while changed:
            changed = False
            for t in list(left):
                u = [min(bb[0], B[t][0]), min(bb[1], B[t][1]), max(bb[2], B[t][2]), max(bb[3], B[t][3])]
                if u[2] - u[0] <= maxdeg and u[3] - u[1] <= maxdeg: bb = u; mem.append(t); left.remove(t); changed = True
        C.append({'id': 'c%02d' % len(C), 'bbox': [round(v, 5) for v in bb], 'systems': mem})
    os.makedirs(WORK, exist_ok=True); json.dump(C, open(f'{WORK}/clusters.json', 'w'), indent=0); return C

def load_clusters(): return json.load(open(f'{WORK}/clusters.json'))

def scenes(c):
    from pystac_client import Client
    d = f"{WORK}/{c['id']}"; os.makedirs(d, exist_ok=True); fn = f'{d}/scenes.json'
    if os.path.exists(fn): return json.load(open(fn))
    s, w, n, e = c['bbox']; cl = Client.open('https://earth-search.aws.element84.com/v1'); out = {}
    for y0, y1 in [(2017, 2019), (2020, 2022), (2023, 2026)]:
        for it in cl.search(collections=['sentinel-2-l2a'], bbox=[w, s, e, n], datetime=f'{y0}-01-01/{y1}-12-31', query={'eo:cloud_cover': {'lt': 50}}, max_items=5000).items():
            tile = it.properties.get('grid:code') or it.id.split('_')[1]; day = it.datetime.strftime('%Y%m%d'); k = (tile, day)
            ver = it.id.split('_')[-2]
            if k in out and out[k]['ver'] >= ver: continue
            out[k] = {'id': it.id, 'ver': ver, 'tile': tile, 'dt': it.datetime.strftime('%Y-%m-%dT%H:%M:%SZ'), 'cloud': it.properties.get('eo:cloud_cover'),
                      'green': it.assets['green'].href, 'nir': it.assets['nir'].href, 'scl': it.assets['scl'].href}
    L = sorted(out.values(), key=lambda x: x['dt']); json.dump(L, open(fn, 'w')); return L

def grid(c, res=10.0):
    from pyproj import Transformer
    s, w, n, e = c['bbox']; tr = Transformer.from_crs('EPSG:4326', 'EPSG:32756', always_xy=True)
    xs, ys = zip(*[tr.transform(lo, la) for la, lo in ((s, w), (s, e), (n, w), (n, e))])
    x0 = math.floor(min(xs) / 20) * 20; y1 = math.ceil(max(ys) / 20) * 20; x1 = math.ceil(max(xs) / 20) * 20; y0 = math.floor(min(ys) / 20) * 20
    return {'x0': x0, 'y1': y1, 'W': int((x1 - x0) / res), 'H': int((y1 - y0) / res), 'res': res}

def read_scene(sc, G):
    import rasterio
    from rasterio.windows import Window
    def rd(href, res):
        with rasterio.open(href) as ds:
            if ds.crs.to_epsg() != 32756: return None
            T = ds.transform; col = (G['x0'] - T.c) / T.a; row = (T.f - G['y1']) / (-T.e)
            f = G['res'] / res; w = int(round(G['W'] * f)); h = int(round(G['H'] * f))
            return ds.read(1, window=Window(int(round(col)), int(round(row)), w, h), boundless=True, fill_value=0)
    try:
        scl = rd(sc['scl'], 20.0)
        if scl is None: return None
        scl = np.repeat(np.repeat(scl, 2, 0), 2, 1)[:G['H'], :G['W']]
        valid = np.isin(scl, (2, 4, 5, 6, 7)); have = scl > 0
        if have.sum() < 0.2 * scl.size or valid.sum() < 0.6 * have.sum(): return ('skip', None, None)
        g = rd(sc['green'], 10.0).astype(np.float32); nr = rd(sc['nir'], 10.0).astype(np.float32)
        nd = (g - nr) / np.maximum(g + nr, 1); water = ((nd > 0.0) | (scl == 6)) & valid
        # relative green brightness of the water (scene-normalised by the median water pixel): banks / shoals read bright,
        # the deep channel dark - a turbidity- and sun-robust depth proxy for picking the thalweg inside wide water
        if sc['dt'][:10] >= '2022-01-25': g = g - 1000.0   # L2A processing baseline 04.00 radiometric offset
        gw = g[water & (g > 0)]; med = float(np.median(gw)) if gw.size > 200 else 0.0
        gr = np.where(water & (g > 0), g / med, 0).astype(np.float32) if med > 0 else np.zeros(g.shape, np.float32)
        return ('ok', water, valid, gr)
    except Exception as ex:
        return ('err', str(ex), None)

def composite(c, nper=24, threads=8):
    d = f"{WORK}/{c['id']}"; fn = f'{d}/comp.npz'
    if os.path.exists(fn): return
    L = json.load(open(f'{d}/scenes.json')); L = [x for x in L if x.get('h') is not None]
    thr = float(np.percentile([x['h'] for x in L], 40)); G = grid(c); log = []
    acc = {i: [np.zeros((G['H'], G['W']), np.uint16), np.zeros((G['H'], G['W']), np.uint16), [], np.zeros((G['H'], G['W']), np.uint16), np.zeros((G['H'], G['W']), np.uint16), np.zeros((G['H'], G['W']), np.float32), np.zeros((G['H'], G['W']), np.uint16)] for i in range(len(EPOCHS))}
    for ei, (y0, y1) in enumerate(EPOCHS):
        cand = sorted([x for x in L if y0 <= int(x['dt'][:4]) <= y1 and x['h'] <= thr], key=lambda x: x['h'])
        days = set(); i = 0
        with cf.ThreadPoolExecutor(threads) as ex:
            while i < len(cand) and len(days) < nper:
                batch = cand[i:i + threads]; i += threads
                for sc, r in zip(batch, ex.map(lambda s: read_scene(s, G), batch)):
                    if r is None or r[0] != 'ok': log.append((sc['id'], r[0] if r else 'crs', r[1] if r and r[0] == 'err' else '')); continue
                    acc[ei][0] += r[1]; acc[ei][1] += r[2]; acc[ei][2].append([sc['id'], sc['dt'], round(sc['h'], 3)])
                    m = (r[3] > 0) & (r[3] < 4); acc[ei][5][m] += r[3][m]; acc[ei][6] += m
                    if len(days) < NLOW or sc['dt'][:10] in days: acc[ei][3] += r[1]; acc[ei][4] += r[2]   # the very lowest tides (deepest channel)
                    days.add(sc['dt'][:10])
        print(c['id'], 'epoch', y0, y1, 'scenes used', len(acc[ei][2]), 'of', len(cand), flush=True)
    np.savez_compressed(fn, **{f'w{i}': acc[i][0] for i in acc}, **{f'v{i}': acc[i][1] for i in acc}, **{f'wl{i}': acc[i][3] for i in acc}, **{f'vl{i}': acc[i][4] for i in acc}, **{f'gs{i}': acc[i][5] for i in acc}, **{f'gn{i}': acc[i][6] for i in acc})
    json.dump({'grid': G, 'thr': thr, 'used': {i: acc[i][2] for i in acc}, 'log': log[:200]}, open(f'{d}/comp.json', 'w'))

if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'clusters':
        C = clusters(); print(len(C), 'clusters'); [print(c['id'], c['bbox'], c['systems']) for c in C]
    elif cmd == 'scenes':
        for c in load_clusters():
            if len(sys.argv) > 2 and c['id'] not in sys.argv[2:]: continue
            t = time.time(); L = scenes(c); print(c['id'], len(L), 'scenes', round(time.time() - t), 's', flush=True)
    elif cmd == 'composite':
        for c in load_clusters():
            if len(sys.argv) > 2 and c['id'] not in sys.argv[2:]: continue
            t = time.time(); composite(c); print(c['id'], 'composite', round(time.time() - t), 's', flush=True)
