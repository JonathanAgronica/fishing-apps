"""QA overlays (box only): low-tide water frequency (grey) + Esri imagery, current line red, refined line cyan.
usage: python3 viz.py <sys> [n crops per line] -> /workspace/multisys/work/channels/viz/<sys>_<line>_<k>.png"""
import sys, os, json, math, urllib.request
import numpy as np
from PIL import Image, ImageDraw
from route import Comp, cluster_of, OVL, dist_to_line_m
from lines import system_lines
OUTD = '/workspace/multisys/work/channels/viz'; TILES = '/workspace/multisys/work/tiles'
def t2(lat, lon, z): n = 2 ** z; return (lon + 180) / 360 * n, (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
def tile(z, x, y):
    fn = f'{TILES}/{z}_{x}_{y}.jpg'
    if not os.path.exists(fn):
        u = f'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        open(fn, 'wb').write(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'research'}), timeout=60).read())
    return Image.open(fn).convert('RGB')
def esri(bb, z):
    s, w, n, e = bb; x0, y0 = t2(n, w, z); x1, y1 = t2(s, e, z); X0, Y0 = int(x0), int(y0)
    im = Image.new('RGB', ((int(x1) - X0 + 1) * 256, (int(y1) - Y0 + 1) * 256))
    for x in range(X0, int(x1) + 1):
        for y in range(Y0, int(y1) + 1):
            try: im.paste(tile(z, x, y), ((x - X0) * 256, (y - Y0) * 256))
            except Exception: pass
    P = lambda la, lo: ((t2(la, lo, z)[0] - X0) * 256, (t2(la, lo, z)[1] - Y0) * 256)
    c0 = P(n, w); c1 = P(s, e); return im.crop((int(c0[0]), int(c0[1]), int(c1[0]), int(c1[1]))), lambda la, lo: (P(la, lo)[0] - c0[0], P(la, lo)[1] - c0[1])
def panel(C, bb, lines, z=16):
    im, P = esri(bb, z); W, H = im.size
    # F panel at the same extent
    s, w, n, e = bb; rc = C.px([[n, w], [s, e]]); r0, c0_, r1, c1 = int(rc[0][0]), int(rc[0][1]), int(rc[1][0]) + 1, int(rc[1][1]) + 1
    sub = C.F[max(0, r0):r1, max(0, c0_):c1]; g = Image.fromarray((np.clip(sub, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.NEAREST).convert('RGB')
    for img in (im, g):
        d = ImageDraw.Draw(img)
        for pts, col, wd in lines: d.line([P(a, b) for a, b in pts], fill=col, width=wd)
    out = Image.new('RGB', (W * 2 + 6, H), 'white'); out.paste(im, (0, 0)); out.paste(g, (W + 6, 0)); return out
if __name__ == '__main__':
    sid = sys.argv[1]; ncrop = int(sys.argv[2]) if len(sys.argv) > 2 else 2; os.makedirs(OUTD, exist_ok=True)
    C = Comp(cluster_of(sid)); O = json.load(open(f'{OVL}/{sid}.json')); L0 = {l['id']: l for l in system_lines(sid)}
    for lid, r in O['lines'].items():
        if r['status'] != 'changed': continue
        old = L0[lid]['coords']; new = r['coords']; offs = [(dist_to_line_m(old, q), q) for q in new]; offs.sort(key=lambda x: -x[0]); picked = []
        for dd, q in offs:
            if len(picked) >= ncrop or dd < 15: break
            if all(math.hypot(q[0] - p[0], (q[1] - p[1]) * 0.91) > 0.012 for p in picked): picked.append(q)
        for k, q in enumerate(picked):
            h = 0.006; bb = [q[0] - h, q[1] - h * 1.1, q[0] + h, q[1] + h * 1.1]
            panel(C, bb, [(old, (255, 60, 60), 3), (new, (0, 255, 255), 3)]).save(f'{OUTD}/{sid}_{lid}_{k}.png')
            print(f'{OUTD}/{sid}_{lid}_{k}.png', round(offs[0][0]))
