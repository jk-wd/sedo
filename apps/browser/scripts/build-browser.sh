#!/usr/bin/env bash
# Download Ungoogled Chromium for macOS, copy src/ into the tree, apply the
# Sedo patches, compile an ad-hoc signed browser, and copy the start page into
# the app before it is signed. The result is Chromium.app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECKOUT="$ROOT/build/ungoogled-chromium-macos"
PATCH_SRC="$ROOT/patches/extra/sedo"
REQUIRED_PATCHES=(hook-feed-blocker.patch hook-start-page.patch hook-short-form-video.patch hook-endless-scroll.patch)
# Drop the previous bundle name and the patch that moved into src/.
OBSOLETE_SERIES_LINES=(
  "extra/givebacktheweb/add-feed-blocker.patch"
  "extra/givebacktheweb/hook-feed-blocker.patch"
  "extra/sedo/add-feed-blocker.patch"
)

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This build script is for macOS." >&2
  exit 1
fi

case "$(uname -m)" in
  arm64) ARCH="arm64" ;;
  x86_64) ARCH="x86_64" ;;
  *)
    echo "Unsupported CPU: $(uname -m)" >&2
    exit 1
    ;;
esac

if ! command -v brew >/dev/null 2>&1; then
  echo "The browser build needs Homebrew (https://brew.sh)." >&2
  exit 1
fi

export PATH="/opt/homebrew/opt/python@3.13/bin:/opt/homebrew/bin:$PATH"

brew_formulas=(ninja coreutils readline node esbuild typescript)
to_install=()
for formula in "${brew_formulas[@]}"; do
  if ! brew list --formula "$formula" >/dev/null 2>&1; then
    to_install+=("$formula")
  fi
done
if ((${#to_install[@]})); then
  echo "Installing ${to_install[*]}"
  brew install "${to_install[@]}"
fi

for tool in greadlink ninja node esbuild; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Missing $tool. Install the Homebrew packages and run this script again." >&2
    exit 1
  fi
done

for patch in "${REQUIRED_PATCHES[@]}"; do
  if [[ ! -f "$PATCH_SRC/$patch" ]]; then
    echo "Missing $PATCH_SRC/$patch" >&2
    exit 1
  fi
done
if [[ ! -d "$ROOT/src/chrome" ]]; then
  echo "Blocker sources are missing in $ROOT/src" >&2
  exit 1
fi

"$ROOT/scripts/download-ungoogled-chromium.sh"

engine="$CHECKOUT/ungoogled-chromium"
dest="$engine/patches/extra/sedo"
mkdir -p "$dest"
rm -rf "$engine/patches/extra/givebacktheweb"
rm -f "$dest/add-feed-blocker.patch"
cp "$PATCH_SRC/"*.patch "$dest/"

series="$engine/patches/series"
touch "$series"
grep -vxF -e "${OBSOLETE_SERIES_LINES[0]}" -e "${OBSOLETE_SERIES_LINES[1]}" -e "${OBSOLETE_SERIES_LINES[2]}" "$series" >"$series.tmp" || true
mv "$series.tmp" "$series"
for patch in "${REQUIRED_PATCHES[@]}"; do
  line="extra/sedo/$patch"
  if ! grep -qxF "$line" "$series"; then
    printf '%s\n' "$line" >>"$series"
  fi
done

if ! xcrun metal --version >/dev/null 2>&1; then
  echo "Downloading the Xcode Metal toolchain."
  if ! xcodebuild -downloadComponent MetalToolchain; then
    echo "xcodebuild could not download the Metal toolchain." >&2
    echo "Xcode's system packages are older than Xcode 26.6. Run this, then rerun the build:" >&2
    echo "  sudo xcodebuild -runFirstLaunch" >&2
    exit 1
  fi
fi
if ! xcrun metal --version >/dev/null 2>&1; then
  metal_toolchain="$(xcodebuild -showComponent MetalToolchain | awk '/Toolchain Identifier/ { print $NF; exit }')"
  if [[ -n "$metal_toolchain" ]]; then
    export TOOLCHAINS="$metal_toolchain"
  fi
fi
if ! xcrun metal --version >/dev/null 2>&1; then
  echo "The Metal compiler is still missing. In Xcode, open Settings, Components, install Metal Toolchain, then run this script again." >&2
  exit 1
fi

src="$CHECKOUT/build/src"
if [[ "$(uname -m)" == "arm64" ]]; then
  dawn_go="$src/third_party/dawn/tools/golang/mac-arm64/bin/go"
else
  dawn_go="$src/third_party/dawn/tools/golang/mac-amd64/bin/go"
fi
if [[ -e "$dawn_go" ]]; then
  echo "Fetching the Go 1.26 toolchain Dawn's code generator needs."
  fetched=0
  for _attempt in 1 2 3; do
    if (cd "$src/third_party/dawn" && GO111MODULE=on CGO_ENABLED=0 "$dawn_go" version >/dev/null); then
      fetched=1
      break
    fi
    echo "Go toolchain download failed. Retrying." >&2
    sleep 3
  done
  if ((fetched != 1)); then
    echo "Could not download the Go toolchain from proxy.golang.org. Check the network, then run this script again." >&2
    exit 1
  fi
fi

export MACOS_AD_HOC_SIGNING=1
if [[ -f "$src/out/Default/build.ninja" ]]; then
  echo "Resuming the browser compile. Expect a long compile."
  "$ROOT/scripts/copy-chromium-sources.sh" "$src"
  # A resumed checkout is not patched again. Apply a Sedo patch that is not in
  # the tree yet. hook-feed-blocker.patch is already present; its source list
  # must still name the YouTube blocker or the framework link fails.
  if ! grep -q 'youtube_recommendation_feed.cc' "$src/chrome/renderer/BUILD.gn"; then
    echo "The renderer build is missing youtube_recommendation_feed.cc." >&2
    echo "Re-apply extra/sedo/hook-feed-blocker.patch, then run this script again." >&2
    exit 1
  fi
  if ! grep -q 'chrome://sedo/' "$src/chrome/common/webui_url_constants.h"; then
    patch -p1 -d "$src" -i "$PATCH_SRC/hook-start-page.patch"
  fi
  if ! grep -q 'sedo_short_form_video' "$src/chrome/common/renderer_configuration.mojom"; then
    patch -p1 -d "$src" -i "$PATCH_SRC/hook-short-form-video.patch"
  fi
  if ! grep -q 'sedo_endless_scroll' "$src/chrome/common/renderer_configuration.mojom"; then
    patch -p1 -d "$src" -i "$PATCH_SRC/hook-endless-scroll.patch"
  fi
  ninja -C "$src/out/Default" chrome chromedriver
  "$ROOT/scripts/install-start-page.sh" "$src/out/Default/Chromium.app"
  CHROMIUM_SRC_DIR="$src" "$CHECKOUT/sign_and_package_app.sh"
else
  echo "Building the browser. Expect a long compile."
  # Upstream build.sh unpacks, applies patches, then compiles. Copy src/ after
  # the patch step and before gn runs, and copy the start page after ninja and
  # before the app is signed. The wrapper stays inside the checkout so build.sh
  # still finds its own directory from $0.
  build_script="$CHECKOUT/build-with-feed-blocker.sh"
  awk -v copy="$ROOT/scripts/copy-chromium-sources.sh" \
      -v install="$ROOT/scripts/install-start-page.sh" '
    /sign_and_package_app\.sh/ {
      print "\"" install "\" \"$_src_dir/out/Default/Chromium.app\""
    }
    { print }
    /patches\.py" apply/ { print "\"" copy "\"" }
  ' "$CHECKOUT/build.sh" >"$build_script"
  inserted="$(grep -c -F "$ROOT/scripts/copy-chromium-sources.sh" "$build_script" || true)"
  if [[ "$inserted" != 1 ]]; then
    echo "Could not insert the source copy into the Ungoogled Chromium build." >&2
    exit 1
  fi
  inserted="$(grep -c -F "$ROOT/scripts/install-start-page.sh" "$build_script" || true)"
  if [[ "$inserted" != 1 ]]; then
    echo "Could not insert the start page copy into the Ungoogled Chromium build." >&2
    exit 1
  fi
  chmod +x "$build_script"
  (
    cd "$CHECKOUT"
    ./build-with-feed-blocker.sh "$ARCH"
  )
  rm -f "$build_script"
fi

app="$CHECKOUT/build/src/out/Default/Chromium.app"
if [[ ! -d "$app" ]]; then
  echo "Compile finished but Chromium.app was not found at $app" >&2
  exit 1
fi

echo "Browser ready: $app"
echo "Launch it with: open \"$app\""
