"""box-only QA: windows along a line, Esri | very-low-tide cost field; current line red, overlay (if changed) cyan.
usage: python3 qa_along.py <sys> <line> <n windows> [half-size deg]"""
import sys, json, numpy as np
from viz import panel, OUTD
from route import Comp, cluster_of, OVL
from lines import system_lines, cum
sid, lid, n = sys.argv[1], sys.argv[2], int(sys.argv[3]); hs = float(sys.argv[4]) if len(sys.argv) > 4 else 0.012
C = Comp(cluster_of(sid)); C.F = C.Fc; L = {l['id']: l for l in system_lines(sid)}[lid]; P = L['coords']; Cc = cum(P)
O = json.load(open(f'{OVL}/{sid}.json'))['lines'][lid]; new = O.get('coords')
for k in range(n):
    s = Cc[-1] * (k + 0.5) / n; i = int(np.searchsorted(Cc, s)); la, lo = P[min(i, len(P) - 1)]
    lines = [(P, (255, 60, 60), 3)] + ([(new, (0, 230, 255), 2)] if new else [])
    panel(C, [la - hs, lo - hs * 1.1, la + hs, lo + hs * 1.1], lines, z=15).save(f'{OUTD}/along_{sid}_{lid}_{k}.png')
print('ok')
