# River-system data (tools/multisys)

`out/` is the **canonical generated data**: `out/systems/*.json` (82 river systems + `index.json`) and
`out/sysg_stations.json`. `src/build.py` copies them into the served `data/systems/` and `data/sysg/stations.json`.
The app build needs nothing else from here.

## Pipeline
1. **Per-system builder, s1–s5** (original scripts lost in the 2026-10-17 box restore). It fetched OSM waterways
   (`osm/q_*.txt` via `osm/op.py`), port tide predictions (`ports/dl.py`, `ports/fitports.py`) and BoM station tables
   (`bom/*.py`), then fitted tide nodes against MSQ tidal planes and BoM/DES gauges.
   - `build/s5_geometry.py` recreates the **geometry stage** from the 2026-10 OSM snapshot `osm/ww.json.gz`. Of the
     published lines, 69/82 main lines and 38 tributaries match exactly, 18 more match within 2 m, 47 differ
     (13 main, 34 tributaries) and 2 had no named OSM way.
   - The **calibration stage** is NOT recreated: nodes, lags and heights, gauge fits, generic extrapolation,
     landmarks and confidence. Those values live only in `out/systems/*.json`, so treat that as source data. Gauge
     fits used 7–14 day BoM tables that cannot be re-downloaded for the original dates.
2. **Extensions**, which must be re-run in this order after any rebuild of step 1:
   - `build/ext_maroochy_yandina.py`: extends Maroochy M from km 26.39 to Yandina (James Low Bridge ford, km 28.67).
   - `build/ext_pumicestone.py`: adds the Pumicestone two-entrance model (Caloundra bar, side creeks, twoEnt fit)
     and merges hussey-creek and halls-creek into it.
   - Inputs: `base/*.pre-*.json` (pre-extension snapshots, reconstructed from the published output) and
     `base/*.spec.json` (curated or fitted values plus pinned geometry).
   - Both scripts accept `--check`, which applies the extension to a temp copy and compares it byte-for-byte with `out/`.
3. **Baffle side creeks** (Baffle itself is built into the app from `src/upstream/baffle-tides`):
   `src/sides/make_sides.py` with `osm/baffle_side/` → `src/sides/baffle_sides.json` (byte-identical).

## Reproducibility (`python3 build/regen_check.py`, 2026-10-18)
| step | result |
|---|---|
| ext_pumicestone `--check` | system JSON, index.json and stations byte-identical. M regenerated exactly from OSM; 8 of the 13 new side creeks regenerated exactly; 5 pinned (4 differ ≤1.5 m, 1 differs by one vertex) |
| ext_maroochy_yandina `--check` | byte-identical; 42 new vertices from OSM; the end point on the ford is pinned |
| make_sides.py | byte-identical |
| derived fields (bbox, maxKm, index n/g/km/conf/port) | all 82 systems match, apart from 2 index entries the extensions set deliberately |
| index `ov` overview lines | carried over; it was simplified from unrounded coordinates (DP 60 m of the published coords reproduces 17/82 exactly) |

Conventions are in `build/common.py`: DP 12 m, 5 dp, haversine chainage, DEM tidal limit (rolling min ≥ 4 m over
1 km, at least 0.6 km; the s5 builder used a 3 km window).
