#!/usr/bin/env bash
# Copies the Secretary core (the agent loop, page tools, policy, panel
# strings) from a pusher-server checkout into vendor/, and records
# the commit it came from. The extension and the Secretary SDK share this
# code; change it in pusher-server, then run this.
#
#   scripts/sync-core.sh ../pusher-server [git-ref]
set -euo pipefail
src="${1:?path to a pusher-server checkout}"
ref="${2:-HEAD}"
root="$(cd "$(dirname "$0")/.." && pwd)/vendor"
dest="$root/secretary"
rm -rf "$root"
# The same layout as pusher-server's web/, so relative imports resolve.
mkdir -p "$dest/core" "$root/shared"
for f in $(git -C "$src" ls-tree --name-only "$ref" web/secretary/core/); do
  case "$f" in *.test.ts) continue ;; esac
  git -C "$src" show "$ref:$f" > "$dest/core/$(basename "$f")"
done
git -C "$src" show "$ref:web/shared/marks.ts" > "$root/shared/marks.ts"
echo "hibira-io/pusher-server $(git -C "$src" rev-parse "$ref")" > "$root/SOURCE"
echo "synced $(cat "$root/SOURCE")"
