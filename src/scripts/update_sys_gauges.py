#!/usr/bin/env python3
"""Mac's Jacks multi-system gauge archive (stdlib only; box routine or GitHub Actions).
Stations come from data/sysg/stations.json (written by the system builder): every BoM tidal / part-tidal gauge
in the 84 systems, upstream fresh-flow gauges, BoM coastal tide stations, and the Qld DES storm-tide sites used as
reference ports. Each run fetches the BoM 7-day tables + the DES 7-day feed and merges them into append-only,
de-duplicated monthly CSVs:  data/sysg/arch/<station>/<YYYY-MM>.csv  (rows "minute,level[,prediction]").
  minute = minutes since 2026-01-01 00:00 AEST (same epoch as data/gauges.json); level in the gauge's own datum (m).
Thinning keeps archives small: repeated equal readings keep only the first/last of each run (step plateaus survive),
1-minute tide stations are reduced to 10-minute readings. data/sysg/index.json lists months/latest per station.
Throttled: does nothing when the last fetch was < --every minutes ago (default 170), so it is safe to run hourly.
Usage: update_sys_gauges.py [--every MIN] [--force] [--ingest DIR ...] [--no-fetch]"""
import argparse, datetime as dt, glob, json, os, re, sys, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
OUT = os.path.join(REPO, 'data', 'sysg'); ARCH = os.path.join(OUT, 'arch')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
DES_URL = 'https://apps.des.qld.gov.au/data-sets/storm-tides/stdtide-7dayopdata.csv'
EPOCH = dt.datetime(2026, 1, 1)
START = 0  # keep everything since the epoch

def get(url, timeout=40):
    r = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,text/csv,*/*', 'Accept-Language': 'en-AU,en;q=0.9', 'Referer': 'https://www.bom.gov.au/qld/flood/'})
    return urllib.request.urlopen(r, timeout=timeout).read().decode('utf-8', 'ignore')

def mins(d): return int(round((d - EPOCH).total_seconds() / 60))
def month_of(m): return (EPOCH + dt.timedelta(minutes=m)).strftime('%Y-%m')

def parse_bom(txt):
    out = {}
    for d, v in re.findall(r'(\d\d/\d\d/\d{4} \d\d:\d\d)\s*(?:</td>\s*<td[^>]*>)?\s*(-?\d+\.\d+)', txt):
        out[mins(dt.datetime.strptime(d, '%d/%m/%Y %H:%M'))] = (round(float(v), 3),)
    return out

def parse_des(txt, sites):
    out = {s: {} for s in sites}
    for line in txt.splitlines():
        p = [x.strip() for x in line.split(',')]
        if len(p) < 5 or p[0] not in out: continue
        try: t = dt.datetime.strptime(p[2], '%Y-%m-%dT%H:%M'); h = float(p[3]); pr = float(p[4])
        except ValueError: continue
        out[p[0]][mins(t)] = (round(h, 3) if -2 < h < 9 else None, round(pr, 3) if -2 < pr < 9 else None)
    return out

def load_month(fn):
    d = {}
    if os.path.exists(fn):
        for line in open(fn):
            if not line.strip() or line[0] == '#': continue
            f = line.strip().split(',')
            d[int(f[0])] = tuple(float(x) if x != '' else None for x in f[1:])
    return d

def thin(items, ten):
    """items: sorted [(m, vals)]. Keep first+last of runs of equal values; optionally 10-min resample."""
    if ten: items = [(m, v) for m, v in items if m % 10 == 0]
    out = []
    for i, (m, v) in enumerate(items):
        if 0 < i < len(items) - 1 and items[i - 1][1] == v and items[i + 1][1] == v and items[i + 1][0] - items[i - 1][0] <= 360:
            continue
        out.append((m, v))
    return out

def fmt(v): return ','.join('' if x is None else ('%.3f' % x).rstrip('0').rstrip('.') if x != 0 else '0' for x in v)

def merge(st, new, idx):
    """merge new readings {m: vals} into the station's monthly archives; returns number of changed months."""
    if not new: return 0
    sid = st['id']; d = os.path.join(ARCH, sid); os.makedirs(d, exist_ok=True); ch = 0
    bym = {}
    for m, v in new.items():
        if m >= START: bym.setdefault(month_of(m), {})[m] = v
    for mo, nv in sorted(bym.items()):
        fn = os.path.join(d, mo + '.csv'); old = load_month(fn); cur = dict(old)
        for m, v in nv.items():
            o = cur.get(m)
            if o is not None and len(v) > 1 and v[0] is None and o[0] is not None: v = (o[0],) + tuple(v[1:])
            cur[m] = v
        items = sorted(cur.items())
        ten = st.get('ten', False)
        if not ten and len(items) > 50:
            dts = sorted(b[0] - a[0] for a, b in zip(items, items[1:]))
            ten = dts[len(dts) // 2] < 5
        items = thin(items, ten)
        hdr = '# %s %s | minutes since 2026-01-01 00:00 AEST, %s\n' % (sid, st.get('name', ''), st.get('cols', 'level m (%s)' % st.get('datum', 'gauge datum')))
        txt = hdr + ''.join('%d,%s\n' % (m, fmt(v)) for m, v in items)
        if not os.path.exists(fn) or open(fn).read() != txt:
            tmp = fn + '.tmp'; open(tmp, 'w').write(txt); os.replace(tmp, fn); ch += 1
    return ch

def index_station(sid, idx):
    d = os.path.join(ARCH, sid)
    months = sorted(os.path.basename(f)[:-4] for f in glob.glob(os.path.join(d, '*.csv')))
    last = None
    if months:
        L = load_month(os.path.join(d, months[-1] + '.csv'))
        lv = [(m, v) for m, v in sorted(L.items()) if v[0] is not None]
        if lv: last = [lv[-1][0], lv[-1][1][0]]
    idx['st'][sid] = dict(months=months, last=last)

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--every', type=int, default=170); ap.add_argument('--force', action='store_true')
    ap.add_argument('--ingest', action='append', default=[]); ap.add_argument('--no-fetch', action='store_true')
    a = ap.parse_args(); os.makedirs(ARCH, exist_ok=True)
    sp = os.path.join(OUT, 'stations.json')
    if not os.path.exists(sp): print('sysg: no stations.json'); return 0
    ST = json.load(open(sp))['stations']
    ip = os.path.join(OUT, 'index.json')
    idx = json.load(open(ip)) if os.path.exists(ip) else {}
    idx.setdefault('st', {}); idx.setdefault('fetched', None)
    nowm = mins(dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) + dt.timedelta(hours=10))
    if not a.force and not a.ingest and idx.get('fetchedM') is not None and nowm - idx['fetchedM'] < a.every:
        print('sysg: skipped (last fetch %d min ago)' % (nowm - idx['fetchedM'])); return 0
    t0 = time.time(); ok = bad = ch = 0; errs = []
    bom = [s for s in ST if s['src'] == 'bom']; des = [s for s in ST if s['src'] == 'des']
    for d in a.ingest:   # one-off seeding from saved BoM tables (<id>.html) / DES csv
        for fn in sorted(glob.glob(os.path.join(d, '*'))):
            b = os.path.basename(fn).split('.')[0]
            for s in bom:
                if s['id'] == b: ch += merge(s, parse_bom(open(fn, errors='ignore').read()), idx)
            if fn.endswith('.csv') and des:
                P = parse_des(open(fn, errors='ignore').read(), [s['id'] for s in des])
                for s in des: ch += merge(s, P[s['id']], idx)
    if not a.no_fetch:
        for s in bom:
            try: new = parse_bom(get('https://www.bom.gov.au/fwo/%s/%s.%s.tbl.shtml' % (s['tab'], s['tab'], s['id']))); ok += 1
            except Exception as e: errs.append('%s:%s' % (s['id'], str(e)[:60])); bad += 1; new = {}
            ch += merge(s, new, idx); time.sleep(0.5)
        if des:
            try:
                P = parse_des(get(DES_URL, 90), [s['id'] for s in des]); ok += 1
                for s in des: ch += merge(s, P[s['id']], idx)
            except Exception as e: errs.append('DES:%s' % str(e)[:60]); bad += 1
        idx['fetchedM'] = nowm
        idx['fetched'] = (EPOCH + dt.timedelta(minutes=nowm)).strftime('%Y-%m-%dT%H:%M+10:00')
    for s in ST: index_station(s['id'], idx)
    idx['st'] = {k: v for k, v in idx['st'].items() if k in {s['id'] for s in ST}}
    tmp = ip + '.tmp'; json.dump(idx, open(tmp, 'w'), separators=(',', ':'), sort_keys=True); os.replace(tmp, ip)
    print('sysg: %d fetched, %d failed, %d month files changed, %d stations, %.0f s%s' % (ok, bad, ch, len(ST), time.time() - t0, (' ERR ' + ' '.join(errs[:6])) if errs else ''))
    return 0

if __name__ == '__main__':
    sys.exit(main())
