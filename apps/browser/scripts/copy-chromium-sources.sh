#!/usr/bin/env bash
# Copy apps/browser/src into a Chromium source tree. Paths under src/ match
# Chromium's src/ directory. Site READMEs and proof/ stay in this repo.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/build/ungoogled-chromium-macos/build/src}"

if [[ ! -d "$ROOT/src/chrome" ]]; then
  echo "Blocker sources are missing in $ROOT/src" >&2
  exit 1
fi
if [[ ! -d "$DEST/chrome" ]]; then
  echo "Chromium source is missing at $DEST" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "The blocker script generator needs Node.js." >&2
  exit 1
fi

echo "Generating dark-pattern blocker scripts."
node "$ROOT/scripts/generate-blocker-scripts.mjs"

echo "Generating the Sedo app icon."
"$ROOT/scripts/generate-app-icon.sh"

echo "Copying Sedo sources into the Chromium tree."
rsync -a \
  --exclude 'proof/' \
  --exclude 'README.md' \
  --exclude '*.md' \
  --exclude 'selectors.json' \
  --exclude 'block.template.js' \
  --exclude 'block.js' \
  "$ROOT/src/" "$DEST/"
