#!/usr/bin/env bash
# Store screenshots in all 7 languages, light and dark, from the local demo:
# e2e/shots/store/<lang>/<n>-<what>-<scheme>.png (1280×800).
set -euo pipefail
cd "$(dirname "$0")/.."
HIBIRA_DEMO=1 HIBIRA_BASE=http://localhost:5174 node scripts/build.mjs
rm -rf e2e/shots
for lang in en-US zh-TW zh-CN ja ko th vi; do
  for scheme in light dark; do
    node demo/server.mjs >/dev/null & pid=$!
    sleep 1
    SHOTS=e2e/shots LANG_TAG=$lang SCHEME=$scheme node e2e/run.cjs || { kill $pid; exit 1; }
    kill $pid; wait $pid 2>/dev/null || true
  done
done
python3 scripts/stitch.py e2e/shots e2e/shots/flat
for f in e2e/shots/flat/*.png; do
  n=$(basename "$f" .png)            # 3-approval-zh-TW-dark
  scheme=${n##*-}; rest=${n%-*}       # dark, 3-approval-zh-TW
  for lang in en-US zh-TW zh-CN ja ko th vi; do
    case $rest in *-$lang) shot=${rest%-$lang}; d=${lang%-US}; mkdir -p e2e/shots/store/$d; mv "$f" "e2e/shots/store/$d/$shot-$scheme.png";; esac
  done
done
rmdir e2e/shots/flat
