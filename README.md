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

## Live adjustments (Baffle tide model)
The Baffle model (Bundaberg harmonics → calibrated along-creek lag/height) gets two live terms, computed hourly by
`scripts/baffle_adj.py` (source `src/scripts/baffle_adj.py`, run by `src/push_gauges.sh` right after `update_gauges.py`)
into `data/baffle_adj.json`, and applied in the app by `src/adj/adj.js` (core hook patched in by `src/adj/build_patches.py`):

| term | definition | applied |
|---|---|---|
| coastal surge | trailing 25 h mean of Bundaberg 051011A observed − MSQ predicted | gain 1, capped ±0.3 m, all Baffle reaches incl. Euleilah and side creeks, highs and lows (pool-level lows above ~30 km: only a positive surge lifts them) |
| fresh F | max(0, Mimdale(t − 3 h) − M0), M0 = 10th percentile of hourly Mimdale over the previous 14 d | highs + 0.5·F·w(km), w = ((km − 16.4)/18.85)^1.5 clipped 0..1 on the main channel (0 on Euleilah, side creeks and below the junction); single-high threshold + F·w/0.423; lows unchanged |

Past times use the archived hourly series (what was known then), so the Gauges model lines are a fair hindcast.
Ahead of the last value both terms fade: surge e-fold 24 h and gone at 48 h, fresh e-fold 48 h and gone at 72 h, so later
dates (Calendar etc.) are pure harmonic predictions. Mimdale at or above its BoM minor flood level (10.0 m) shows a
"non-tidal / fresh-dominated" warning. No data file (or `opts.adj===null`) means no adjustment and output identical to the
unadjusted model. Other river systems use their own engine and are never adjusted.
Tests: `tools/tests/adj_regress.mjs` (zero-adjustment = base build; far-future unchanged) and
`tools/baffle-tides/adj_validate.mjs` (archive replay: none / hindcast / forecast leave-out RMSE at Essendean and Hills Rd).

### Calibration rule (node refits)
Static node calibrations must describe dry, calm conditions; the live terms carry the rest. Refits (e.g. the 30-day refit,
`tools/baffle-tides/refit_nodes.py [--days 30] [--weight 0]`) exclude, or with `--weight W` down-weight, any time flagged in
the `cal` column of `data/baffle_adj.json`: in that hour or the 24 h before it, Mimdale > M0 + 0.05 m or rising > 0.02 m
in 12 h, or |Bundaberg 25 h mean residual| > 0.04 m. The script prints proposed node values next to the app's; it never
edits the app.

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
