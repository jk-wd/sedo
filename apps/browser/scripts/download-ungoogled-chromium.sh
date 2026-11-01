#!/usr/bin/env bash
# Download Ungoogled Chromium for macOS into build/ without compiling.
# Source lands in build/ungoogled-chromium-macos/build/src.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHECKOUT="$ROOT/build/ungoogled-chromium-macos"
UPSTREAM="https://github.com/ungoogled-software/ungoogled-chromium-macos.git"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This download script is for macOS." >&2
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

missing=()
if [[ ! -d /Applications/Xcode.app ]]; then
  missing+=("Xcode.app (the full app from the App Store, not only Command Line Tools)")
fi
if ! command -v brew >/dev/null 2>&1; then
  missing+=("Homebrew (https://brew.sh)")
fi
if ! command -v git >/dev/null 2>&1; then
  missing+=("git")
fi
if ((${#missing[@]})); then
  echo "The Ungoogled Chromium download cannot start yet. Install:" >&2
  printf '  - %s\n' "${missing[@]}" >&2
  echo "Then run: $0" >&2
  exit 1
fi

export PATH="/opt/homebrew/opt/python@3.13/bin:/opt/homebrew/bin:$PATH"

if ! brew list --formula python@3.13 >/dev/null 2>&1; then
  echo "Installing python@3.13"
  brew install python@3.13
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is not on PATH after installing python@3.13." >&2
  exit 1
fi
python_version="$(python3 -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")')"
python_major="${python_version%%.*}"
python_minor="${python_version#*.}"
if ((python_major != 3 || python_minor > 13)); then
  echo "depot_tools needs Python 3.13 or earlier. Found Python $python_version." >&2
  exit 1
fi

if [[ ! -d "$CHECKOUT/.git" ]]; then
  mkdir -p "$ROOT/build"
  git clone --recurse-submodules "$UPSTREAM" "$CHECKOUT"
fi

if [[ ! -d "$CHECKOUT/ungoogled-chromium/utils" ]]; then
  git -C "$CHECKOUT" submodule update --init --recursive
fi

src="$CHECKOUT/build/src"
if [[ -f "$src/out/Default/build.ninja" ]]; then
  version="$(tr -d '[:space:]' < "$CHECKOUT/ungoogled-chromium/chromium_version.txt")"
  echo "Keeping the existing Chromium checkout. A compile is already in progress at $src/out/Default."
  echo "Chromium version: $version"
  exit 0
fi

echo "Downloading Chromium source for $ARCH. This is a large checkout and does not compile."
python3 "$CHECKOUT/retrieve_and_unpack_resource.py" -g "$ARCH"

src="$CHECKOUT/build/src"
if [[ ! -f "$src/DEPS" ]]; then
  echo "Download finished but Chromium source was not found at $src" >&2
  exit 1
fi

version="$(tr -d '[:space:]' < "$CHECKOUT/ungoogled-chromium/chromium_version.txt")"
echo "Ungoogled Chromium source ready: $src"
echo "Chromium version: $version"
echo "Compile it with: $ROOT/scripts/build-browser.sh"
