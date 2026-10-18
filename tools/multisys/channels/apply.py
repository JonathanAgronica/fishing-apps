"""Apply the channel re-route overlays (tools/multisys/channels/out/<sys>.json, written by route.py) at build time.

The generated system files in tools/multisys/out/systems and BAFFLE_DATA are NOT modified (so the system builders'
--check / regen checks stay byte-identical); src/build.py calls these helpers while assembling the site.

A changed line gets new `coords` plus `kc`: the km of every new vertex on the scale of the line it replaces (projection
onto the old line, made monotone). Nodes, gauges, landmarks, junction km, two-entrance params, calibration and every
other km-keyed value therefore keep their km, and predictions stay identical by construction; only the drawn channel,
snapping and the map position of km markers move (by the line's lateral shift). An overlay is applied only if its
`orig` hash still matches the line it was computed from (stale overlays are skipped and reported)."""
import json, os, hashlib, math
HERE = os.path.dirname(os.path.abspath(__file__)); OVL = os.path.join(HERE, 'out')

def sha(coords): return hashlib.sha1(json.dumps(coords, separators=(',', ':')).encode()).hexdigest()[:12]
def hav(a, b):
    R = 6371.0088; p1, p2 = math.radians(a[0]), math.radians(b[0]); dp = p2 - p1; dl = math.radians(b[1] - a[1])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))
def cum(P):
    c = [0.0]
    for i in range(1, len(P)): c.append(c[-1] + hav(P[i - 1], P[i]))
    return c
def point_at(P, C, s):
    s = max(0.0, min(C[-1], s))
    for i in range(1, len(C)):
        if C[i] >= s:
            f = (s - C[i - 1]) / ((C[i] - C[i - 1]) or 1); return [P[i - 1][0] + f * (P[i][0] - P[i - 1][0]), P[i - 1][1] + f * (P[i][1] - P[i - 1][1])]
    return list(P[-1])

def load(sid):
    fn = os.path.join(OVL, sid + '.json')
    return json.load(open(fn, encoding='utf-8')) if os.path.exists(fn) else None

def _apply_lines(lines, O, log):
    """lines: [{id, parent, jk (km on parent scale, relative to parent's own start), coords, kc?}] mutated in place.
    jk_rel(parent) gives the junction position along the parent line (its own chainage scale)."""
    if not O: return 0
    by = {l['id']: l for l in lines}; old = {l['id']: [list(p) for p in l['coords']] for l in lines}; oldC = {k: cum(v) for k, v in old.items()}; n = 0
    for l in lines:
        r = O['lines'].get(l['id'])
        if not r or r.get('status') != 'changed': continue
        if r['orig'] != sha(l['coords']): log.append(f"{O['sys']}/{l['id']}: overlay stale (line changed since route.py) - skipped"); continue
        assert len(r['kc']) == len(r['coords']) and all(b >= a for a, b in zip(r['kc'], r['kc'][1:])), 'bad kc'
        l['coords'] = [list(p) for p in r['coords']]; l['kc'] = r['kc']; n += 1
    # side lines start on their parent: re-attach the first vertex to the parent's (possibly moved) point at the junction km
    for l in lines:
        p = by.get(l.get('parent'))
        if not p or (p['id'] not in O['lines'] or O['lines'][p['id']].get('status') != 'changed') or 'kc' not in p: continue
        s = l['jrel']
        oldJ = point_at(old[p['id']], oldC[p['id']], s)
        if hav(old[l['id']][0], oldJ) > 0.03: continue   # did not start on the parent line: leave it alone
        newJ = point_at(p['coords'], p['kc'], s)
        if hav(newJ, l['coords'][0]) < 0.002: continue   # parent did not move at the junction
        l['coords'] = [[round(newJ[0], 5), round(newJ[1], 5)]] + [list(q) for q in l['coords'][1:]]
        if 'kc' not in l: l['kc'] = [round(v, 4) for v in oldC[l['id']]]
    return n

def apply_system(S, log):
    """generic system dict (out/systems/<id>.json) -> same dict with re-routed lines (in place); returns #changed lines"""
    O = load(S['id'])
    if not O: return 0
    by = {l['id']: l for l in S['lines']}
    for l in S['lines']:
        p = by.get(l.get('parent')); l['jrel'] = (l.get('junctionKm') or 0) - ((p.get('junctionKm') or 0) if p and p.get('parent') else 0) if p else 0
    n = _apply_lines(S['lines'], O, log)
    for l in S['lines']: l.pop('jrel', None)
    if n:
        la = [p[0] for l in S['lines'] for p in l['coords']]; lo = [p[1] for l in S['lines'] for p in l['coords']]; b = S['bbox']
        S['bbox'] = [round(min(b[0], min(la)), 5), round(min(b[1], min(lo)), 5), round(max(b[2], max(la)), 5), round(max(b[3], max(lo)), 5)]
    return n

def apply_baffle(D, X, log):
    """D: BAFFLE_DATA with D['euleilah'] already extended by X['euExt']; X: baffle_sides.json (sides mutated in place).
    Returns the JS assignments to append (main/euleilah coords + kc, side pts + kc)."""
    O = load('baffle')
    if not O: return {}
    EJ = D['euleilahJunctionKm']
    lines = [{'id': 'B', 'parent': None, 'jrel': 0, 'coords': D['main']}, {'id': 'E', 'parent': 'B', 'jrel': EJ, 'coords': D['euleilah']}]
    for s in X['sides']: lines.append({'id': s['id'], 'parent': s['parent'], 'jrel': s['jk'] - (EJ if s['parent'] == 'E' else 0), 'coords': s['pts'], 'side': s})
    n = _apply_lines(lines, O, log); out = {}
    if not n: return out
    by = {l['id']: l for l in lines}
    if 'kc' in by['B']: out['main'] = by['B']['coords']; out['mainKc'] = by['B']['kc']
    if 'kc' in by['E']: out['euleilah'] = by['E']['coords']; out['euKc'] = by['E']['kc']
    out['sides'] = {l['id']: {'pts': l['coords'], 'kc': l['kc']} for l in lines if 'side' in l and 'kc' in l}
    return out

def summary():
    res = {}
    for f in sorted(os.listdir(OVL)):
        if f.endswith('.json'): O = json.load(open(os.path.join(OVL, f))); res[O['sys']] = {k: v['status'] for k, v in O['lines'].items()}
    return res
