"""Per-system summary of the channel overlays -> /workspace/multisys/shots/channels/summary.md (+ .json)
usage: python3 summary.py [sys...]"""
import json, os, sys
OVL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); OUT = '/workspace/multisys/shots/channels'
rows = []; md = ['| system | line | status | max shift m | km range moved | F old→new | migration pts | note |', '|---|---|---|---|---|---|---|---|']
for f in sorted(os.listdir(OVL)):
    O = json.load(open(f'{OVL}/{f}'))
    if sys.argv[1:] and O['sys'] not in sys.argv[1:]: continue
    for lid, r in O['lines'].items():
        ch = r['status'] == 'changed'
        conf = '' if not ch else ('high' if r.get('Fnew', 0) - r.get('Fold', 0) > 0.03 and r.get('resolved', 0) > 0.6 else 'medium')
        rows.append({'sys': O['sys'], 'line': lid, 'name': r['name'], 'status': r['status'], 'maxShift': r.get('maxShift'), 'Fold': r.get('Fold'), 'Fnew': r.get('Fnew'),
                     'nMig': r.get('nMig', 0), 'why': r.get('why', ''), 'conf': conf, 'years': O['imagery']['years'], 'scenes': O['imagery']['scenes']})
        if ch or r.get('nMig'):
            md.append(f"| {O['sys']} | {lid} {r['name']} | {r['status']} | {r.get('maxShift', '')} | | {r.get('Fold', 0):.2f}→{r.get('Fnew', 0) or 0:.2f} | {r.get('nMig', 0)} | {conf or r.get('why', '')[:60]} |")
os.makedirs(OUT, exist_ok=True); json.dump(rows, open(f'{OUT}/summary.json', 'w'), indent=1); open(f'{OUT}/summary.md', 'w').write('\n'.join(md) + '\n')
n = len({r['sys'] for r in rows}); c = [r for r in rows if r['status'] == 'changed']
print(n, 'systems,', len(rows), 'lines,', len(c), 'changed:'); [print(' ', r['sys'], r['line'], r['name'], r['maxShift'], 'm', r['conf']) for r in c]
