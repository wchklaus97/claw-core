#!/usr/bin/env bash
# Download claw_core binary from GitHub Releases (one-command install).
# Runs during npm postinstall. Places binary in plugin/bin/ for daemon to use.
#
# Requires: curl or wget. Skips if binary already present or on unsupported platform.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIN_DIR="$PLUGIN_ROOT/bin"
BINARY_NAME="claw_core"

# Get version from package.json
VERSION="0.1.0"
if [ -f "$PLUGIN_ROOT/package.json" ]; then
  VERSION=$(node -p "require('$PLUGIN_ROOT/package.json').version" 2>/dev/null || echo "0.1.0")
fi

REPO="wchklaus97/claw-core"
BASE_URL="https://github.com/$REPO/releases/download/v${VERSION}"

# Detect OS and arch, map to release artifact
detect_artifact() {
  local os arch
  os=$(uname -s 2>/dev/null || echo "")
  arch=$(uname -m 2>/dev/null || echo "")

  case "$os" in
    Darwin)
      case "$arch" in
        arm64|aarch64) echo "claw_core-aarch64-apple-darwin.tar.gz" ;;
        x86_64|amd64)  echo "claw_core-x86_64-apple-darwin.tar.gz" ;;
        *) return 1 ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64|amd64)  echo "claw_core-x86_64-unknown-linux-gnu.tar.gz" ;;
        aarch64|arm64) echo "claw_core-aarch64-unknown-linux-gnu.tar.gz" ;;
        *) return 1 ;;
      esac
      ;;
    MINGW*|MSYS*|CYGWIN*)
      # Windows not supported yet (claw_core uses Unix domain sockets, rlimit, etc.)
      return 1
      ;;
    *)
      return 1
      ;;
  esac
}

# Skip if binary already exists
mkdir -p "$BIN_DIR"
if [ -x "$BIN_DIR/$BINARY_NAME" ] 2>/dev/null || [ -x "$BIN_DIR/$BINARY_NAME.exe" ] 2>/dev/null; then
  echo "claw_core binary already present, skipping download"
  exit 0
fi

ARTIFACT=$(detect_artifact) || true
if [ -z "$ARTIFACT" ]; then
  case "$(uname -s)" in
    MINGW*|MSYS*|CYGWIN*) echo "claw_core: Windows is not yet supported, skip binary download" ;;
    *) echo "claw_core: unsupported platform ($(uname -s) $(uname -m)), skip binary download" ;;
  esac
  exit 0
fi

# Download
URL="$BASE_URL/$ARTIFACT"
TMP=$(mktemp -d 2>/dev/null || mktemp -d -t claw_core)
trap "rm -rf '$TMP'" EXIT

echo "claw_core: downloading binary from GitHub Releases (v$VERSION)..."
if command -v curl >/dev/null 2>&1; then
  curl -fsSL -o "$TMP/$ARTIFACT" "$URL" 2>/dev/null || true
elif command -v wget >/dev/null 2>&1; then
  wget -q -O "$TMP/$ARTIFACT" "$URL" 2>/dev/null || true
else
  echo "claw_core: neither curl nor wget found, skipping binary download"
  exit 0
fi

if [ ! -s "$TMP/$ARTIFACT" ]; then
  echo "claw_core: download failed (release v$VERSION may not exist yet), skipping"
  exit 0
fi

# Extract
if [[ "$ARTIFACT" == *.tar.gz ]]; then
  tar -xzf "$TMP/$ARTIFACT" -C "$TMP"
  mv "$TMP/$BINARY_NAME" "$BIN_DIR/$BINARY_NAME"
  chmod +x "$BIN_DIR/$BINARY_NAME"
elif [[ "$ARTIFACT" == *.zip ]]; then
  (cd "$TMP" && unzip -o -q "$ARTIFACT")
  mv "$TMP/$BINARY_NAME.exe" "$BIN_DIR/$BINARY_NAME.exe"
fi

echo "claw_core: binary installed to $BIN_DIR/"
