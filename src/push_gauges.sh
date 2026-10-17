#!/usr/bin/env bash
# Box fallback for the Mac's Baffle Jacks gauge pipeline (until the repo has a GitHub Actions workflow).
# Fetches BoM 039267/539135/539132 + DES Bundaberg, merges into data/, commits & pushes ONLY data/ when changed.
# Optional: also ingest the routine's archive dir. Safe to run as often as hourly.
set -euo pipefail
cd /workspace/fishing-site
git pull -q --rebase --autostash origin main || true
ARGS=()
[ -d /workspace/baffle-tides/archive ] && ARGS+=(--ingest /workspace/baffle-tides/archive)
python3 scripts/update_gauges.py "${ARGS[@]}" | cut -c1-600
# Baffle live tide adjustments (surge + Mimdale fresh) for the app -> data/baffle_adj.json (non-fatal)
[ -f scripts/baffle_adj.py ] && { python3 scripts/baffle_adj.py | cut -c1-300 || echo "baffle_adj: failed (non-fatal)"; }
# multi-system gauges (BoM tables for every river system; self-throttled to one fetch per ~3 h, ~1 min when it runs)
[ -f scripts/update_sys_gauges.py ] && { python3 scripts/update_sys_gauges.py | cut -c1-300 || echo "sysgauges: failed (non-fatal)"; }
git add data
if git diff --cached --quiet -- data; then echo "gauges: no change"; exit 0; fi
git -c user.name="JonathanAgronica" -c user.email="JonathanAgronica@users.noreply.github.com" commit -q -m "gauges: update $(TZ=Australia/Brisbane date +%Y-%m-%dT%H:%M+10:00) (box)" -- data
git push -q origin main && echo "gauges: pushed $(git rev-parse --short HEAD)"
