#!/usr/bin/env python3
"""Multi-system gauges: fetch the BoM tide/river gauge tables used by data/systems/*.json and keep the last 72 h
of readings in data/sysgauges/<gauge id>.json (one point per line → small git diffs) + data/sysgauges/index.json.
Throttled: does nothing if the last fetch was < --every minutes ago (default 170), so it is safe to call hourly.
Times are stored as UTC epoch minutes; levels in the gauge's own datum (m)."""
import argparse, datetime as dt, glob, json, os, re, sys, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
SYSDIR = os.path.join(REPO, 'data', 'systems'); OUT = os.path.join(REPO, 'data', 'sysgauges')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
KEEP_MIN = 72 * 60

def fetch(tab, sid):
    url = f'https://www.bom.gov.au/fwo/{tab}/{tab}.{sid}.tbl.shtml'
    r = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,*/*', 'Accept-Language': 'en-AU,en;q=0.9', 'Referer': 'https://www.bom.gov.au/qld/flood/'})
    return urllib.request.urlopen(r, timeout=40).read().decode('utf-8', 'ignore')

def parse(txt):
    out = {}
    for d, v in re.findall(r'(\d\d/\d\d/\d{4} \d\d:\d\d)\s*(?:</td>\s*<td[^>]*>)?\s*(-?\d+\.\d+)', txt):
        t = dt.datetime.strptime(d, '%d/%m/%Y %H:%M').replace(tzinfo=dt.timezone(dt.timedelta(hours=10)))  # QLD = AEST, no DST
        out[int(t.timestamp() // 60)] = round(float(v), 3)
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--every', type=int, default=170); ap.add_argument('--force', action='store_true')
    a = ap.parse_args(); os.makedirs(OUT, exist_ok=True)
    ip = os.path.join(OUT, 'index.json')
    idx = json.load(open(ip)) if os.path.exists(ip) else {'fetched': 0, 'gauges': {}}
    now = int(time.time() // 60)
    if not a.force and now - idx.get('fetched', 0) < a.every:
        print(f"sysgauges: skipped (last fetch {now - idx['fetched']} min ago)"); return
    G = {}
    for f in sorted(glob.glob(os.path.join(SYSDIR, '*.json'))):
        if f.endswith('index.json'): continue
        J = json.load(open(f, encoding='utf-8'))
        for g in J.get('gauges', []):
            e = G.setdefault(g['id'], {'tab': g['tab'], 'name': g['name'], 'systems': []}); e['systems'].append(J['id'])
    ok = bad = 0
    for sid, g in sorted(G.items()):
        p = os.path.join(OUT, sid + '.json')
        old = {}
        if os.path.exists(p):
            try: old = {int(t): h for t, h in json.load(open(p))['pts']}
            except Exception: old = {}
        try: new = parse(fetch(g['tab'], sid)); ok += 1
        except Exception as e: print('sysgauges: ERR', sid, e, file=sys.stderr); new = {}; bad += 1
        old.update(new)
        pts = sorted((t, h) for t, h in old.items() if t >= now - KEEP_MIN)
        th, seen = [], set()
        for t, h in pts:                      # thin 1-min tide stations to one reading per 5 min
            if t // 5 in seen: continue
            seen.add(t // 5); th.append((t, h))
        pts = th
        txt = '{"id":"%s","name":%s,"tab":"%s","pts":[\n%s\n]}\n' % (sid, json.dumps(g['name']), g['tab'], ',\n'.join('[%d,%s]' % (t, h) for t, h in pts))
        if not os.path.exists(p) or open(p).read() != txt: open(p, 'w').write(txt)
        idx['gauges'][sid] = {'name': g['name'], 'systems': g['systems'], 'n': len(pts), 'last': list(pts[-1]) if pts else None}
        time.sleep(1.0)
    idx['fetched'] = now
    json.dump(idx, open(ip, 'w'), separators=(',', ':'))
    print(f'sysgauges: {ok} fetched, {bad} failed, {len(G)} gauges')

if __name__ == '__main__':
    main()
