#!/usr/bin/env python3
"""Build Mac's Yak into /workspace/fishing-site/yak/ (served at https://jonathanagronica.github.io/fishing-apps/yak/).
Inlines src/app.css + src/app.js into index.html, writes astro.js/core.js/data.js (shared with the service worker and tools/yak_brief.mjs),
stamps a build id into sw.js, and copies icons, manifest and Leaflet."""
import json, os, shutil, sys, time
R = os.path.dirname(os.path.abspath(__file__)); S = lambda p: open(os.path.join(R, p), encoding='utf8').read()
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.normpath(os.path.join(R, '../../yak'))
BUILD = time.strftime('%Y%m%d%H%M')
os.makedirs(OUT, exist_ok=True)
html = S('src/app.html').replace('/*BUILD*/', BUILD)
for k, v in {'/*CSS*/': S('src/app.css'), '/*APP*/': S('src/app.js')}.items():
    assert html.count(k) == 1, k; html = html.replace(k, v)
w = lambda p, t: open(os.path.join(OUT, p), 'w', encoding='utf8').write(t)
w('index.html', html)
w('astro.js', S('src/astro.js')); w('core.js', S('src/core.js'))
w('data.js', '/* Mac\'s Jacks base-port tide harmonics (MSQ, CC-BY 4.0) + system mouths, copied from Mac\'s Jacks */\nself.PORTS=' +
  json.dumps(json.load(open(os.path.join(R, 'data/ports.json'))), separators=(',', ':')) + ';\nself.SYSTEMS=' + S('data/systems.json') + ';\n')
w('sw.js', S('src/sw.js').replace('__BUILD__', BUILD))
shutil.copy(os.path.join(R, 'manifest.webmanifest'), OUT)
shutil.copy(os.path.join(R, 'favicon.ico'), OUT)
for d in ('icons', 'vendor'):
    shutil.copytree(os.path.join(R, d), os.path.join(OUT, d), dirs_exist_ok=True, ignore=shutil.ignore_patterns('source-*'))
print('built', BUILD, len(html) // 1024, 'KB ->', OUT)
