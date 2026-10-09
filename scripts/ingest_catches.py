#!/usr/bin/env python3
"""Mac's Baffle Jacks — ingest anonymous shared catch sessions into data/catches.csv.

Phones that opt in POST a small JSON message per fishing session to a public, no-account ntfy.sh topic
(append-only relay, ~12 h retention). This script (run hourly on the maintainer's box) polls the topic,
VALIDATES every message against a strict whitelist (scripts/catch_schema.json), clips/rejects bad values,
rate-limits per anonymous id, applies delete requests (which must carry the session's secret token), and
rewrites data/catches.csv: one row per 15-minute slot fished, creek stretch (~2 km band) or broad off-creek
area only -- the message format has no GPS field, and nothing outside the whitelist is ever written.

Stdlib only. State (seen message ids, tombstones, raw archive) lives outside the repo (--state dir).
  python3 scripts/ingest_catches.py [--state DIR] [--keep-test] [--file msgs.jsonl] [--no-poll]
TEST submissions (anon 'TEST-…' or test=1) are dropped from the published CSV unless --keep-test.
"""
import argparse, csv, datetime as dt, hashlib, io, json, os, re, sys, time, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
SCH = json.load(open(os.path.join(HERE, 'catch_schema.json')))
OUT = os.path.join(REPO, 'data', 'catches.csv')
AEST = dt.timezone(dt.timedelta(hours=10))
COLS = ['session','anon','slot_start','band_km','line','band','region','score','tide','min_from_runin','light','solunar','moon_phase',
        'tide_source','wind_kmh','dp3_hpa','bites','fish','mj','kept','max_len_cm','species','bait','received','system']
PH = ['New','Wax cres','1st qtr','Wax gib','Full','Wan gib','Last qtr','Wan cres']
SPECIES = [c for c,_ in SCH['species']]; BAIT = [c for c,_ in SCH['bait']]
REGIONS = {r[0]: r[1] for r in SCH['regions']}
SYSDIR = os.path.join(REPO, 'data', 'systems'); _SYS = {}
def system_info(sy):
    """Multi-system: {'name', lines:{id:(name, maxKm)}} for a non-Baffle river system, or None if unknown."""
    if not isinstance(sy, str) or not re.fullmatch(r'[a-z0-9-]{2,40}', sy) or sy == 'baffle': return None
    if sy not in _SYS:
        try:
            J = json.load(open(os.path.join(SYSDIR, sy + '.json'), encoding='utf-8'))
            _SYS[sy] = {'name': J['name'], 'lines': {l['id']: (l['name'], l['junctionKm'] + l['limitKm']) for l in J['lines']}}
        except Exception: _SYS[sy] = None
    return _SYS[sy]
MAX_SESS_PER_ANON_DAY = 12; MAX_NEW_PER_RUN = 600; MAX_SLOTS = 64

def band_label(bk, ln):
    if bk < 0: return None
    if ln == 'E' and str(bk) in SCH['bandsE']: return f"km {bk}–{bk+2}, {SCH['bandsE'][str(bk)]}"
    return f"km {bk}–{bk+2}, {SCH['bands'][str(bk)]}"

def iso(ts): return dt.datetime.fromtimestamp(ts, AEST).strftime('%Y-%m-%dT%H:%M+10:00')
def num(v, lo, hi, nd=0, allow_none=True):
    if v is None or v == '':
        if allow_none: return None
        raise ValueError('missing')
    if isinstance(v, bool) or not isinstance(v, (int, float)): raise ValueError('not a number')
    if v != v: raise ValueError('nan')
    v = max(lo, min(hi, v))
    return int(round(v)) if nd == 0 else round(v, nd)

def validate(m, now):
    """Return (session_meta, rows) or raise ValueError. Only whitelisted, clipped values survive."""
    if not isinstance(m, dict) or m.get('app') != 'mbj' or m.get('v') != 1: raise ValueError('not mbj v1')
    anon, sid = m.get('anon'), m.get('sid')
    if not isinstance(anon, str) or not re.fullmatch(r'TEST-[0-9a-f]{5}|[0-9a-f]{10}', anon): raise ValueError('bad anon')
    if not isinstance(sid, str) or not re.fullmatch(r'[0-9a-f]{12}', sid): raise ValueError('bad sid')
    test = anon.startswith('TEST-') or m.get('test') == 1
    if test and not anon.startswith('TEST-'): anon = 'TEST-' + anon[:5]
    bk = m.get('bk')
    SI = system_info(m.get('sy')) if m.get('sy') not in (None, '', 'baffle') else None
    if m.get('sy') not in (None, '', 'baffle') and SI is None: raise ValueError('unknown system')
    sysid = m.get('sy') if SI else 'baffle'
    if SI:   # band = 2 km of one channel of that system (never GPS)
        ln = m.get('ln') if m.get('ln') in SI['lines'] else 'M'
        if not isinstance(bk, int) or not (bk == -1 or (0 <= bk <= SI['lines'][ln][1] + 2 and bk % 2 == 0)): raise ValueError('bad band')
        blabel = f"km {bk}–{bk+2}, {SI['lines'][ln][0]}" if bk >= 0 else 'Off-creek: near ' + SI['name']
    else:
        if not isinstance(bk, int) or not (bk == -1 or (0 <= bk <= 38 and bk % 2 == 0)): raise ValueError('bad band')
        ln = m.get('ln') if m.get('ln') in ('B', 'E') else 'B'
        if bk >= 0 and ln == 'E' and str(bk) not in SCH['bandsE']: ln = 'B'
        blabel = None
    rg = ''
    if bk < 0:
        rg = m.get('rg') if (m.get('rg') in REGIONS and not SI) else 'other'
    ts = m.get('ts') if m.get('ts') in SCH['tsrc'] else 'none'
    mp = m.get('mp'); mp = mp if isinstance(mp, int) and 0 <= mp <= 7 else None
    if mp is None: raise ValueError('bad moon')
    bait = m.get('bt') if m.get('bt') in BAIT else ''
    s0 = m.get('s0')
    if not isinstance(s0, int) or s0 % 900: raise ValueError('bad start (must be a 15-min slot)')
    if s0 > now + 3600 or s0 < now - 400 * 86400: raise ValueError('start out of range')
    sl = m.get('sl')
    if not isinstance(sl, list) or not (1 <= len(sl) <= MAX_SLOTS): raise ValueError('bad slots')
    if s0 + 900 * len(sl) > now + 3600: raise ValueError('ends in the future')
    rows = []
    for i, x in enumerate(sl):
        if not isinstance(x, list) or len(x) != 13: raise ValueError('bad slot shape')
        score = num(x[0], 0, 100, allow_none=False)
        tide = SCH['tide'][x[1]] if isinstance(x[1], int) and 0 <= x[1] < len(SCH['tide']) else 'none'
        ri = num(x[2], -60, 13 * 60)
        light = SCH['light'][x[3]] if isinstance(x[3], int) and 0 <= x[3] < len(SCH['light']) else None
        if light is None: raise ValueError('bad light')
        sol = SCH['sol'][x[4]] if isinstance(x[4], int) and 0 <= x[4] < len(SCH['sol']) else 'none'
        wind = num(x[5], 0, 150); dp3 = num(x[6], -15, 15, 1)
        bites = num(x[7], 0, 40, allow_none=False); fish = num(x[8], 0, 40, allow_none=False)
        mj = num(x[9], 0, 40, allow_none=False); kept = num(x[10], 0, 40, allow_none=False)
        fish = min(fish, bites); mj = min(mj, fish); kept = min(kept, fish)
        ml = num(x[11], 1, 150, 1) if fish else None
        sp = x[12] if isinstance(x[12], str) else ''
        sp = ';'.join(dict.fromkeys(c for c in sp.split(';') if c in SPECIES)) if bites else ''
        if ts == 'none': tide, ri = 'none', None
        rows.append({'session': sid, 'anon': anon, 'slot_start': iso(s0 + 900 * i), 'band_km': '' if bk < 0 else bk,
                     'line': '' if bk < 0 else ln, 'band': blabel or band_label(bk, ln) or 'Off-creek: ' + REGIONS[rg], 'region': rg,
                     'score': score, 'tide': tide, 'min_from_runin': '' if ri is None else ri, 'light': light, 'solunar': sol,
                     'moon_phase': PH[mp], 'tide_source': ts, 'wind_kmh': '' if wind is None else wind, 'dp3_hpa': '' if dp3 is None else dp3,
                     'bites': bites, 'fish': fish, 'mj': mj, 'kept': kept, 'max_len_cm': '' if ml is None else ml, 'species': sp, 'bait': bait,
                     'received': dt.datetime.now(AEST).strftime('%Y-%m-%d'), 'system': sysid})
    if sum(r['bites'] for r in rows) > 60: raise ValueError('implausible bite count')
    return {'sid': sid, 'anon': anon, 'test': test, 'day': iso(s0)[:10]}, rows

def poll(topic, since):
    url = f'https://ntfy.sh/{topic}/json?poll=1&since={since}'
    req = urllib.request.Request(url, headers={'User-Agent': 'mbj-ingest/1 (+https://github.com/JonathanAgronica/fishing-apps)'})
    with urllib.request.urlopen(req, timeout=40) as r: body = r.read().decode('utf-8', 'replace')
    out = []
    for line in body.splitlines():
        try: e = json.loads(line)
        except Exception: continue
        if e.get('event') == 'message': out.append(e)
    return out

def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--state', default='/workspace/catch-inbox'); ap.add_argument('--keep-test', action='store_true')
    ap.add_argument('--file', help='also read relay messages from this jsonl (one ntfy event or raw message per line)'); ap.add_argument('--no-poll', action='store_true')
    a = ap.parse_args(); os.makedirs(a.state, exist_ok=True)
    stp = os.path.join(a.state, 'state.json')
    st = json.load(open(stp)) if os.path.exists(stp) else {'seen': [], 'tomb': [], 'since': 0}
    seen = set(st['seen']); tomb = set(st['tomb'])
    block = set()
    bp = os.path.join(a.state, 'block.txt')
    if os.path.exists(bp): block = {l.strip() for l in open(bp) if l.strip() and not l.startswith('#')}
    events = []
    if not a.no_poll:
        since = 'all' if not st.get('since') else str(max(0, int(st['since']) - 120))
        try: events += poll(SCH['topic'], since)
        except Exception as e: print('catches: relay poll failed:', e, file=sys.stderr)
    if a.file:
        for line in open(a.file):
            try: e = json.loads(line)
            except Exception: continue
            events.append(e if 'message' in e else {'id': hashlib.sha1(line.encode()).hexdigest()[:12], 'time': int(time.time()), 'message': json.dumps(e)})
    new = [e for e in events if e.get('id') not in seen]
    new.sort(key=lambda e: e.get('time', 0))
    if new:
        with open(os.path.join(a.state, 'raw-' + dt.datetime.now(AEST).strftime('%Y-%m') + '.jsonl'), 'a') as f:
            for e in new: f.write(json.dumps(e) + '\n')
    # existing published rows, grouped by session
    sess = {}
    if os.path.exists(OUT):
        for r in csv.DictReader(open(OUT, newline='', encoding='utf-8')):
            sess.setdefault(r['session'], []).append(r)
    per_day = {}
    for rows in sess.values():
        k = (rows[0]['anon'], rows[0]['slot_start'][:10]); per_day[k] = per_day.get(k, 0) + 1
    now = int(time.time()); stats = {'added': 0, 'deleted': 0, 'rejected': 0, 'dup': 0}; added = 0
    for e in new:
        seen.add(e.get('id')); st['since'] = max(st.get('since') or 0, int(e.get('time', 0)))
        try: m = json.loads(e.get('message', ''))
        except Exception: stats['rejected'] += 1; continue
        if isinstance(m, dict) and m.get('op') == 'del':
            tok = m.get('tok')
            if isinstance(tok, str) and re.fullmatch(r'[0-9a-f]{24}', tok):
                sid = hashlib.sha256(('mbj-sid:' + tok).encode()).hexdigest()[:12]
                tomb.add(sid)
                if sess.pop(sid, None) is not None: stats['deleted'] += 1
            else: stats['rejected'] += 1
            continue
        try: meta, rows = validate(m, now)
        except ValueError as err: stats['rejected'] += 1; print('catches: reject', e.get('id'), err, file=sys.stderr); continue
        if meta['sid'] in tomb or meta['anon'] in block: stats['rejected'] += 1; continue
        if meta['sid'] in sess: stats['dup'] += 1; continue          # first version wins; edits = delete + new session id
        k = (meta['anon'], meta['day'])
        if per_day.get(k, 0) >= MAX_SESS_PER_ANON_DAY or added >= MAX_NEW_PER_RUN: stats['rejected'] += 1; continue
        per_day[k] = per_day.get(k, 0) + 1; added += 1
        sess[meta['sid']] = rows; stats['added'] += 1
    tests = 0
    if not a.keep_test:
        for sid in [s for s, rows in sess.items() if rows[0]['anon'].startswith('TEST')]: sess.pop(sid); tests += 1
    for sid in [s for s, rows in sess.items() if rows[0]['anon'] in block]: sess.pop(sid)
    allrows = sorted((r for rows in sess.values() for r in rows), key=lambda r: (r['slot_start'], r['session']))
    buf = io.StringIO(); w = csv.DictWriter(buf, fieldnames=COLS, lineterminator='\n', extrasaction='ignore'); w.writeheader()
    for r in allrows: w.writerow({c: r.get(c, '') for c in COLS})
    txt = buf.getvalue()
    old = open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else None
    if txt != old:
        os.makedirs(os.path.dirname(OUT), exist_ok=True); open(OUT, 'w', encoding='utf-8').write(txt)
    st['seen'] = list(seen)[-20000:]; st['tomb'] = sorted(tomb)
    json.dump(st, open(stp, 'w'))
    print(f"catches: {len(new)} new relay msgs · +{stats['added']} sessions · -{stats['deleted']} deleted · {stats['dup']} dup · {stats['rejected']} rejected"
          f"{' · dropped '+str(tests)+' TEST' if tests else ''} · table {len(sess)} sessions / {len(allrows)} slots{' (changed)' if txt != old else ''}")

if __name__ == '__main__':
    main()
