#!/usr/bin/env bash
# Build the start page and copy it into Chromium.app before the app is signed.
# The running browser reads this directory as chrome://sedo/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
APP="${1:-$ROOT/build/ungoogled-chromium-macos/build/src/out/Default/Chromium.app}"

if ! command -v pnpm >/dev/null 2>&1; then
  echo "The start page build needs pnpm." >&2
  exit 1
fi

echo "Building the start page."
(cd "$REPO" && pnpm --filter @sedo/start build)

if [[ ! -d "$APP" ]]; then
  echo "Chromium.app is not built yet, so the start page was not copied." >&2
  exit 1
fi

dest="$APP/Contents/Frameworks/Chromium Framework.framework/Resources/sedo-start"
rm -rf "$dest"
mkdir -p "$dest"
cp -R "$REPO/apps/start/dist/." "$dest/"
echo "Start page copied to $dest"
