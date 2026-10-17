#!/usr/bin/env python3
"""Mac's Jacks: BoM Queensland flood-classification levels (minor / moderate / major, gauge height in m) for every
fresh-flow gauge the app uses (data/sysg/stations.json role 'fresh' + Baffle's Mimdale 539132), from
https://www.bom.gov.au/qld/flood/networks/section4.shtml (fixed-width table). Writes data/sysg/flood_class.json.
Run occasionally (levels rarely change):  python3 scripts/flood_class.py [--file section4.html]"""
import argparse, html, json, os, re, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
URL = 'https://www.bom.gov.au/qld/flood/networks/section4.shtml'
def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--file'); a = ap.parse_args()
    if a.file: raw = open(a.file, errors='ignore').read()
    else: raw = urllib.request.urlopen(urllib.request.Request(URL, headers={'User-Agent': UA, 'Referer': 'https://www.bom.gov.au/qld/flood/'}), timeout=60).read().decode('utf-8', 'ignore')
    L = html.unescape(re.sub('<[^>]+>', '', raw)).splitlines()
    hdr = next(l for l in L if 'Fld Ht' in l and 'Grazg' in l)
    cols = [m.start() for m in re.finditer(r'Fld Ht\.', hdr)]           # minor, moderate, towns, major (value ends near the label end)
    def val(l, end):
        m = re.search(r'(-?\d+\.\d+)\s*$', l[:end]); return float(m.group(1)) if m and len(l[:end]) - len(l[:end].rstrip()) < 3 and m.end() > end - 9 else None
    rows = {}
    for l in L:
        m = re.match(r'^.{20,30}?\s(\d{6}[A-Z]?)\s+(\S.*?)\s{2,}', l)
        if not m: continue
        sid = m.group(1); cut = lambda i: cols[i] + 7
        mi, mo, ma = val(l, cut(0)), val(l, cut(1)), val(l, cut(3))
        if mi is None and mo is None and ma is None: continue
        rows[sid] = {'name': m.group(2).strip().title(), 'minor': mi, 'moderate': mo, 'major': ma}
    st = json.load(open(os.path.join(REPO, 'data', 'sysg', 'stations.json')))['stations']
    want = {s['id'] for s in st if s.get('role') == 'fresh'} | {'539132'}
    out = {'source': URL, 'note': 'gauge height (m, local gauge datum) at which BoM minor / moderate / major flooding commences', 'stations': {k: rows[k] for k in sorted(want) if k in rows}}
    out['missing'] = sorted(want - set(out['stations']))
    p = os.path.join(REPO, 'data', 'sysg', 'flood_class.json'); json.dump(out, open(p, 'w'), indent=1)
    print(f"flood classes: {len(out['stations'])} of {len(want)} fresh gauges; missing {out['missing']}")
if __name__ == '__main__': main()
