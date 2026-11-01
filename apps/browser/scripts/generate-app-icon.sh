#!/usr/bin/env bash
# Build the macOS app icon from design/icon-dark-bg.png in the sibling
# sedo-site repo. Writes app.icns and Assets.car into
# src/chrome/app/theme/chromium/mac/, which copy-chromium-sources.sh copies
# over Chromium's own icon before the compile.
# The dock thumbnail uses a black plate so the dark-background artwork sits
# flush with it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$ROOT/../.." && pwd)"
SOURCE="$REPO/../sedo-site/design/icon-dark-bg.png"
DEST="$ROOT/src/chrome/app/theme/chromium/mac"

if [[ ! -f "$SOURCE" ]]; then
  echo "Missing $SOURCE" >&2
  exit 1
fi
for tool in swift iconutil xcrun; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "The app icon build needs $tool (Xcode)." >&2
    exit 1
  fi
done

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

swift "$ROOT/scripts/render-app-icon.swift" "$SOURCE" "$work"

iconset="$work/app.iconset"
mkdir -p "$iconset"
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$work/tile.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  double=$((size * 2))
  sips -z "$double" "$double" "$work/tile.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done

catalog="$work/Assets.xcassets"
appiconset="$catalog/AppIcon.appiconset"
mkdir -p "$appiconset"
printf '{\n  "info" : { "author" : "xcode", "version" : 1 }\n}\n' >"$catalog/Contents.json"
images=""
for size in 16 32 128 256 512; do
  double=$((size * 2))
  cp "$iconset/icon_${size}x${size}.png" "$appiconset/"
  cp "$iconset/icon_${size}x${size}@2x.png" "$appiconset/"
  images+="    { \"filename\" : \"icon_${size}x${size}.png\", \"idiom\" : \"mac\", \"scale\" : \"1x\", \"size\" : \"${size}x${size}\" },"$'\n'
  images+="    { \"filename\" : \"icon_${size}x${size}@2x.png\", \"idiom\" : \"mac\", \"scale\" : \"2x\", \"size\" : \"${size}x${size}\" },"$'\n'
done
printf '{\n  "images" : [\n%s  ],\n  "info" : { "author" : "xcode", "version" : 1 }\n}\n' \
  "${images%,$'\n'}"$'\n' >"$appiconset/Contents.json"

composer="$work/AppIcon.icon"
mkdir -p "$composer/Assets"
cp "$work/layer.png" "$composer/Assets/shield.png"
cat >"$composer/icon.json" <<'JSON'
{
  "fill" : {
    "solid" : "extended-srgb:0.00000,0.00000,0.00000,1.00000"
  },
  "groups" : [
    {
      "layers" : [
        {
          "glass" : false,
          "image-name" : "shield.png",
          "name" : "shield"
        }
      ],
      "shadow" : {
        "kind" : "neutral",
        "opacity" : 0.5
      },
      "translucency" : {
        "enabled" : false,
        "value" : 0.5
      }
    }
  ],
  "supported-platforms" : {
    "squares" : [
      "macOS"
    ]
  }
}
JSON

mkdir -p "$work/car"
xcrun actool \
  --compile "$work/car" \
  --platform macosx \
  --minimum-deployment-target 13.0 \
  --app-icon AppIcon \
  --output-partial-info-plist "$work/partial.plist" \
  --output-format human-readable-text \
  --warnings --errors \
  "$composer" "$catalog" >"$work/actool.log"
if [[ ! -f "$work/car/Assets.car" ]]; then
  cat "$work/actool.log" >&2
  echo "actool did not write Assets.car." >&2
  exit 1
fi

mkdir -p "$DEST"
iconutil --convert icns --output "$DEST/app.icns" "$iconset"
cp "$work/car/Assets.car" "$DEST/Assets.car"
echo "App icon written to $DEST"
