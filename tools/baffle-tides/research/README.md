# Baffle Creek tide research (2026-10-09)
- harm_A.json – harmonic constants (41 constituents, nodal f/u) fitted to MSQ Bundaberg gauge 051011A observed 10-min 2021–2025 (embedded in app)
- bund_*.csv – MSQ Bundaberg observed/predicted data (data.qld.gov.au); des_tide7.csv – DES 7-day near-real-time (2–9 Oct 2026)
- ess_bom_20261009.txt (BoM 039267 Essendean Bridge), bom_539135_20261009.txt (Euleilah Ck @ Hills Rd), bom_539132 (Mimdale) – BoM 7-day tables saved 9 Oct 2026
- gauge_events.json / stats.json – extracted peaks/troughs and lag/level regressions; chainage.json – OSM centreline + landmark chainages
- planes2025.pdf – MSQ 2025 Semidiurnal Tidal Planes (Baffle Creek (Winfield) secondary place); datum2019.pdf – TMR standard port datum levels (Bundaberg AHD = LAT 1.693)
- scripts: fit*.py, validate.py, analyse.py, ess.py, stats.py, chart.py, chain.py

- Live adjustments + calibration mask: see the repo README "Live adjustments"; `../refit_nodes.py` (30-day node refit that excludes fresh/surge periods), `../adj_validate.mjs` (archive replay)
