#!/usr/bin/env bash
# Mac's Baffle Jacks — shared catch-log ingestion step (run hourly, e.g. right after push_gauges.sh).
# Polls the public ntfy.sh relay topic (messages kept ~12 h there), validates, merges into data/catches.csv,
# commits & pushes ONLY that file when it changed. Box-only state/raw archive: /workspace/catch-inbox/.
set -euo pipefail
cd /workspace/fishing-site
git pull -q --rebase --autostash origin main || true
python3 scripts/ingest_catches.py --state /workspace/catch-inbox "$@"
git add data/catches.csv
if git diff --cached --quiet -- data/catches.csv; then echo "catches: no change"; exit 0; fi
git -c user.name="JonathanAgronica" -c user.email="JonathanAgronica@users.noreply.github.com" commit -q -m "catches: update $(TZ=Australia/Brisbane date +%Y-%m-%dT%H:%M+10:00) (box)" -- data/catches.csv
git push -q origin main && echo "catches: pushed $(git rev-parse --short HEAD)"
