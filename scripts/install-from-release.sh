#!/bin/bash
# Download claw_core from GitHub Releases (no Rust required)
# Usage: ./install-from-release.sh [VERSION] [DEST_DIR]
#   VERSION: e.g. v0.1.0 (default: latest)
#   DEST_DIR: where to put the binary (default: $HOME/.local/bin)
# Env: CLAW_REPO=owner/repo (default: wchklaus97/claw-core)
#
# Example: CLAW_REPO=myorg/claw ./install-from-release.sh v0.1.0

set -e
REPO="${CLAW_REPO:-wchklaus97/claw-core}"
VERSION="${1:-latest}"
DEST="${2:-${HOME}/.local/bin}"

# Detect platform (see .github/workflows/release.yml for built targets)
case "$(uname -s)" in
  Linux)
    case "$(uname -m)" in
      x86_64) ASSET="claw_core-x86_64-unknown-linux-gnu.tar.gz" ;;
      aarch64|arm64) ASSET="claw_core-aarch64-unknown-linux-gnu.tar.gz" ;;
      *) echo "Unsupported arch: $(uname -m)"; exit 1 ;;
    esac ;;
  Darwin)
    case "$(uname -m)" in
      x86_64) ASSET="claw_core-x86_64-apple-darwin.tar.gz" ;;
      arm64) ASSET="claw_core-aarch64-apple-darwin.tar.gz" ;;
      *) echo "Unsupported arch: $(uname -m)"; exit 1 ;;
    esac ;;
  *) echo "Unsupported OS: $(uname -s)"; exit 1 ;;
esac

if [ "$VERSION" = "latest" ]; then
  URL="https://github.com/${REPO}/releases/latest/download/${ASSET}"
else
  URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"
fi

mkdir -p "$DEST"
echo "Downloading $ASSET to $DEST..."
curl -sSL "$URL" | tar -xzf - -C "$DEST"
chmod +x "$DEST/claw_core"
echo "✓ claw_core installed to $DEST/claw_core"
echo "  Add to PATH: export PATH=\"$DEST:\$PATH\""
