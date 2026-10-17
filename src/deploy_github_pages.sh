#!/usr/bin/env bash
# Run AFTER `gh auth login` (GitHub device flow). Creates public repo fishing-apps, pushes, enables Pages.
set -euo pipefail
cd /workspace/fishing-site
python3 /workspace/fishing-site-src/build.py >/dev/null
git add -A; git -c user.name="$(gh api user -q .login)" -c user.email="$(gh api user -q .id)+$(gh api user -q .login)@users.noreply.github.com" commit -qm "${MSG:-Update site}" || true
OWNER=$(gh api user -q .login)
gh repo view "$OWNER/fishing-apps" >/dev/null 2>&1 || gh repo create fishing-apps --public --source=. --remote=origin --description "Mangrove jack bite times + Baffle Creek tides"
git remote get-url origin >/dev/null 2>&1 || git remote add origin "https://github.com/$OWNER/fishing-apps.git"
gh auth setup-git; git pull -q --rebase origin main; git push -u origin main
gh api -X POST "repos/$OWNER/fishing-apps/pages" -f "source[branch]=main" -f "source[path]=/" 2>/dev/null || echo "Pages already enabled"
URL="https://$OWNER.github.io/fishing-apps/"
for i in $(seq 1 30); do c=$(curl -s -o /dev/null -w '%{http_code}' "$URL"); echo "$URL -> $c"; [ "$c" = 200 ] && break; sleep 20; done
for p in mangrove-jack/ baffle-tides/; do echo "$URL$p -> $(curl -s -o /dev/null -w '%{http_code}' "$URL$p")"; done
