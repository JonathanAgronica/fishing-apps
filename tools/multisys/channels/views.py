"""Pick before/after screenshot views (largest lateral shifts per changed line) -> views.json for tools/tests/channels_shot.mjs
usage: python3 views.py <sys...>"""
import sys, json, os
from route import OVL, dist_to_line_m
from lines import system_lines, hav
out = []
for sid in sys.argv[1:]:
    O = json.load(open(f'{OVL}/{sid}.json')); L0 = {l['id']: l for l in system_lines(sid)}; picked = []
    for lid, r in O['lines'].items():
        if r['status'] != 'changed': continue
        offs = sorted(((dist_to_line_m(L0[lid]['coords'], q), q) for q in r['coords']), key=lambda x: -x[0]); n = 0
        for d, q in offs:
            if d < 25 or n >= 2: break
            if any(hav(q, p) < 1.0 for p in picked): continue
            picked.append(q); n += 1; out.append({'sys': sid, 'tag': f'{lid}-{n}', 'line': lid, 'name': r['name'], 'lat': q[0], 'lng': q[1], 'shift': round(d)})
json.dump(out, open('/workspace/multisys/work/channels/views.json', 'w'), indent=1); print(len(out), 'views'); [print(v) for v in out]
