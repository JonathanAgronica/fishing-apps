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
   - `build/ext_skyring.py` (2026-10-18): adds Skyring Creek (Skyringville) to the Burnett as line T7, a two-entrance
     channel (Burnett via the Hole in the Wall ↔ its own sea mouth; `twoEnt.line = 'T7'`, estimate, grade C on that line).
     Geometry is pinned in `base/geo/skyring_parts.json` (QLD watercourse lines CC BY 4.0 + imagery trace; OSM has no line).
   - `build/new_pancake.py` (2026-10-18): new system `pancake-creek` (Pancake Ck ↔ Middle Ck two-entrance passage, node at the
     Middle–Pancake junction; Jenny Lind Ck with its own entrance; Tanti Ck; Jenny Lind–Pancake channel as a second
     two-entrance line via `twoEntMore`, node at the Jenny Lind–Pancake junction). MSQ places Pancake Creek and Seventeen Seventy,
     grade C. Geometry pinned in `base/geo/pancake_parts.json`. Helpers shared by both: `build/newsys.py`.
   - `build/new_moneys.py` (2026-10-24): new system `moneys-creek` (Moneys Creek, Kellys Beach, Bargara): line M = beach mouth → sand basin →
     causeway with council tide gates (lagoon behind not modelled as tidal). Tide ≈ Burnett Heads −3 min, ratio 1.016 (interpolated towards
     MSQ Elliott River Entrance), lows held at the perched basin level 0.75 m AHD (QLD LiDAR); grade C. Adds `S.causeway` (location, flow
     line = lagoon level 0.95 m AHD est., road 2.51 m, 2026 council gate timetable) used by `src/causeway/causeway.js` (map marker, Tides
     run-in/out shading + 7-day list, per-phone override `mbj_cw`). Geometry pinned in `base/geo/moneys_parts.json`. Hand trace only: the basin
     channel (~0.3 km, ~50 m wide) is below what the 10 m Sentinel-2 `channels/` re-routing can resolve, so no overlay.
   - Inputs: `base/*.pre-*.json` (pre-extension snapshots, reconstructed from the published output) and
     `base/*.spec.json` (curated or fitted values plus pinned geometry).
   - All four scripts accept `--check`, which applies the extension to a temp copy and compares it byte-for-byte with `out/`.
3. **Baffle side creeks** (Baffle itself is built into the app from `src/upstream/baffle-tides`):
   `src/sides/make_sides.py` with `osm/baffle_side/` → `src/sides/baffle_sides.json` (byte-identical).

## Reproducibility (`python3 build/regen_check.py`, 2026-10-18)
| step | result |
|---|---|
| ext_pumicestone `--check` | system JSON, index.json and stations byte-identical. M regenerated exactly from OSM; 8 of the 13 new side creeks regenerated exactly; 5 pinned (4 differ ≤1.5 m, 1 differs by one vertex) |
| ext_maroochy_yandina `--check` | byte-identical; 42 new vertices from OSM; the end point on the ford is pinned |
| ext_skyring / new_pancake `--check` | byte-identical (geometry and nodes generated from the pinned parts) |
| make_sides.py | byte-identical |
| derived fields (bbox, maxKm, index n/g/km/conf/port) | all 82 systems match, apart from 2 index entries the extensions set deliberately |
| index `ov` overview lines | carried over; it was simplified from unrounded coordinates (DP 60 m of the published coords reproduces 17/82 exactly) |

Conventions are in `build/common.py`: DP 12 m, 5 dp, haversine chainage, DEM tidal limit (rolling min ≥ 4 m over
1 km, at least 0.6 km; the s5 builder used a 3 km window).

## Channel re-routing from multi-year imagery (`channels/`, 2026-10-18)

Moves each system's drawn channel centreline onto the persistent low-tide channel / thalweg, without changing any
prediction. Box work data: `/workspace/multisys/work/channels/` (not in git).

1. `channels/imagery.py clusters|scenes|composite` - systems grouped into ≤0.3° windows; Sentinel-2 L2A scenes from the
   Earth Search STAC (AWS open data, Copernicus licence) 2018-2026; `tide_at.mjs` adds the port tide height at each
   scene time (from the app's own harmonics); per epoch (2018-20, 2021-23, 2024-26) the ≤24 lowest-tide days (port height
   ≤ the 40th percentile) give a low-tide water frequency F (NDWI(B03,B08)>0 or SCL water, SCL-masked), the 8 lowest days a
   very-low-tide frequency, plus a scene-normalised green-brightness depth proxy for water pixels (shoals bright,
   channel dark).
2. `channels/route.py [sys]` - least-cost path along each line within ±300 m (cost from F, very-low F and the depth proxy,
   recent epoch weighted 0.6), smoothed; only resolved stretches are spliced in, judged in ~1 km pieces, and each
   piece must gain clearly, stay in the same water body, not double back, not be >1.3× longer, not run along the parent
   channel (side creeks), not jump >80 m for a side creek already in water and not chase patchy wetland water. Lines
   that fail an OSM lateral-mark gate check (`beacons.py`, seamarks ODbL) more than before are kept. Visual-QA
   exceptions live in `KEEP`. Migration between the first and last epoch is reported per line.
   Output: `channels/out/<sys>.json` (`coords`, `kc`, `orig` hash, shifts, F before/after, gates, rejected pieces).
3. `src/build.py` applies the overlays at build time (`channels/apply.py`): new coords + `kc` = the km of every new vertex
   on the replaced line's scale (monotone). Every km-keyed value (nodes, gauges, landmarks, junction km, two-entrance
   params, calibration, crossings, spot km) keeps its km and predictions are identical by construction; side lines are
   re-attached to the moved parent at their junction km. Overlays whose `orig` hash no longer matches are skipped (build
   prints `channels: ... stale`). The generated `out/systems` files and BAFFLE_DATA are not modified (regen checks stay
   byte-identical). Engine/Baffle/sides/spots use `kc` when present.
4. QA (box): `viz.py`, `qa_along.py`, `qa_marks.py`; tests `tools/tests/channels_snap.mjs` (km/snap consistency),
   `channels_shot.mjs` (before/after shots, views from `views.py`), plus `multisys_allregress.mjs` / `baffle_regress_test.mjs`.
