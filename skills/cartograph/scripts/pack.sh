#!/usr/bin/env bash
# Pack the Cartograph skill assets from the source dirs. Author/release tool —
# end users never run this; they get the already-packed assets/ in the skill.
#
#   assets/engine/            <- cartograph/generate/*.ts (minus tests) + package.json
#   assets/viewer-template.html <- a fresh CARTO_TEMPLATE=1 build of cartograph/viewer
#
# Run from anywhere: skills/cartograph/scripts/pack.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SKILL="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$SKILL/../.." && pwd)"

echo "==> packing engine"
mkdir -p "$SKILL/assets/engine"
rm -f "$SKILL/assets/engine/"*.ts
for f in "$ROOT/cartograph/generate/"*.ts; do
  case "$f" in *.test.ts) continue ;; esac
  cp "$f" "$SKILL/assets/engine/"
done
cp "$ROOT/cartograph/generate/package.json" "$SKILL/assets/engine/package.json"

echo "==> building viewer template"
( cd "$ROOT/cartograph/viewer" && npm run build:template >/dev/null )
cp "$ROOT/cartograph/viewer/dist-template/viewer.html" "$SKILL/assets/viewer-template.html"

echo "==> packed:"
ls -lh "$SKILL/assets/viewer-template.html" | awk '{print "    template", $5}'
echo "    engine  $(ls "$SKILL/assets/engine/"*.ts | wc -l | tr -d ' ') modules"
