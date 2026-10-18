"""Channel lines of every system as the app draws them (generic systems: tools/multisys/out/systems/*.json;
Baffle: BAFFLE_DATA in src/upstream/baffle-tides/index.html + src/sides/baffle_sides.json, as src/build.py assembles them).
Each line: {sys, id, name, parent, jk (km on parent), coords [[lat,lng]...], km0 (km of coords[0] in the system scale)}."""
import json, os, re, math
HERE = os.path.dirname(os.path.abspath(__file__)); MS = os.path.dirname(HERE); REPO = os.path.dirname(os.path.dirname(MS))
OUT = os.path.join(MS, 'out', 'systems')

def hav(a, b):
    R = 6371.0088; p1, p2 = math.radians(a[0]), math.radians(b[0]); dp = p2 - p1; dl = math.radians(b[1] - a[1])
    return 2 * R * math.asin(math.sqrt(math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2))
def cum(P):
    c = [0.0]
    for i in range(1, len(P)): c.append(c[-1] + hav(P[i - 1], P[i]))
    return c

def baffle_data():
    s = open(os.path.join(REPO, 'src/upstream/baffle-tides/index.html'), encoding='utf-8').read()
    m = re.search(r'window.BAFFLE_DATA=(\{.*?\});?\s*</script>', s, re.S)
    D = json.loads(m.group(1).rstrip(';')); X = json.load(open(os.path.join(REPO, 'src/sides/baffle_sides.json'), encoding='utf-8'))
    return D, X

def system_lines(sid):
    if sid == 'baffle':
        D, X = baffle_data()
        L = [{'sys': 'baffle', 'id': 'B', 'name': 'Baffle Creek', 'parent': None, 'jk': 0, 'coords': D['main'], 'km0': 0},
             {'sys': 'baffle', 'id': 'E', 'name': 'Euleilah Creek', 'parent': 'B', 'jk': D['euleilahJunctionKm'], 'coords': D['euleilah'] + X['euExt'], 'km0': D['euleilahJunctionKm']}]
        for s in X['sides']:
            L.append({'sys': 'baffle', 'id': s['id'], 'name': s['name'], 'parent': s['parent'], 'jk': s['jk'], 'coords': s['pts'], 'km0': s['jk']})
        return L
    S = json.load(open(os.path.join(OUT, sid + '.json'), encoding='utf-8'))
    return [{'sys': sid, 'id': l['id'], 'name': l['name'], 'parent': l.get('parent'), 'jk': l.get('junctionKm') or 0, 'coords': l['coords'],
             'km0': (l.get('junctionKm') or 0) if l.get('parent') else 0} for l in S['lines']]

def all_systems():
    X = json.load(open(os.path.join(OUT, 'index.json'), encoding='utf-8'))['systems']
    return [e['id'] for e in X]
