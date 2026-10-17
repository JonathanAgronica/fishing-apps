# Mac's Jacks (fishing-apps)

A single-file PWA served by GitHub Pages from this repo's root (`index.html`, `sw.js`, `data/`, ...).
Everything served is generated. The sources and tools live in:

| path | what |
|---|---|
| `src/` | app sources and `build.py`; `src/upstream/` holds the two original apps (Baffle tides with embedded model, and bite times) that build.py merges |
| `src/scripts/` | box routine scripts (`update_sys_gauges.py`, `flood_state.py`, ...); build.py copies some into `scripts/` |
| `src/push_gauges.sh`, `src/push_catches.sh` | hourly box routine: refresh `data/`, then commit and push **only** data |
| `tools/multisys/` | river-system data pipeline and canonical generated data (see its README) |
| `tools/baffle-tides/` | Baffle model research and fit scripts (big raw CSV/PDF inputs not committed) |
| `tools/tests/` | puppeteer-core UI and regression tests (`buildtest.sh` builds to `/tmp/site-test`) |

Private data is never committed: user spots (`/workspace/private/`) and catch-inbox state stay on the box.

## Build
```
python3 src/build.py       # writes index.html, sw.js, manifest, data/systems ... into the repo root (new build id)
bash tools/tests/buildtest.sh   # same build into /tmp/site-test, for testing
```

## Restore the box from this repo
```
git clone https://github.com/JonathanAgronica/fishing-apps.git /workspace/fishing-site
gh auth login          # GitHub CLI; git uses `gh auth git-credential`
git -C /workspace/fishing-site config user.name JonathanAgronica
git -C /workspace/fishing-site config user.email JonathanAgronica@users.noreply.github.com
ln -sfn /workspace/fishing-site/src /workspace/fishing-site-src          # paths used by the routine and old notes
mkdir -p /workspace/multisys && ln -sfn /workspace/fishing-site/tools/multisys/out /workspace/multisys/out \
  && ln -sfn /workspace/fishing-site/tools/multisys/build /workspace/multisys/build
mkdir -p /workspace/tools && (cd /workspace/tools && npm i puppeteer-core) \
  && ln -sfn /workspace/tools/node_modules /workspace/fishing-site/tools/tests/node_modules
python3 /workspace/fishing-site/tools/multisys/build/regen_check.py   # sanity check
```
Local test server: serve a directory that contains `fishing-apps -> /workspace/fishing-site` and
`test-apps -> /tmp/site-test` on port 18080. Chrome is expected at `/usr/bin/google-chrome`.
