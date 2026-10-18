"""box-only QA: Esri | cost field around a point, lines + lateral marks (red=port, green=starboard).
usage: python3 qa_marks.py <sys> <lat> <lon> <half deg> <name>"""
import sys, json
from PIL import ImageDraw
import viz
from route import Comp, cluster_of, OVL
from lines import system_lines
import beacons
sid, la, lo, hs, nm = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
C = Comp(cluster_of(sid)); C.F = C.Fc; bb = [la - hs, lo - hs * 1.1, la + hs, lo + hs * 1.1]
O = json.load(open(f'{OVL}/{sid}.json'))['lines'] if len(sys.argv) < 7 else {}
lines = []
for l in system_lines(sid):
    lines.append((l['coords'], (255, 60, 60), 3))
    r = O.get(l['id'])
    if r and r.get('status') == 'changed': lines.append((r['coords'], (0, 230, 255), 2))
im = viz.panel(C, bb, lines, z=16 if hs < 0.01 else 15)
W = (im.size[0] - 6) // 2; _, P = viz.esri(bb, 16 if hs < 0.01 else 15); d = ImageDraw.Draw(im)
for m in beacons.marks(bb):
    x, y = P(m['lat'], m['lon']); col = (255, 0, 0) if m['cat'] == 'port' else (0, 255, 0)
    for dx in (0, W + 6): d.ellipse([x + dx - 5, y - 5, x + dx + 5, y + 5], fill=col, outline=(255, 255, 255))
im.save(f'{viz.OUTD}/marks_{nm}.png'); print('ok')
