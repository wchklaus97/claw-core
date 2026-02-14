#!/usr/bin/env bash
# Build for GitHub Pages (same layout as .github/workflows/github-pages.yml).
# Run from repo root. Output: dist/
#
# Usage:
#   ./scripts/build-github.sh              # Build with default base_path (local)
#   ./scripts/build-github.sh --gh-pages   # Set base_path=/claw (like project site)
#   ./scripts/build-github.sh --web-only   # Dioxus only (no mdBook)
#   ./scripts/build-github.sh --no-opt    # Skip wasm-opt and performance budget

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

GITHUB_PAGES=false
WEB_ONLY=false
NO_OPT=false
for arg in "$@"; do
  [ "$arg" = "--gh-pages" ] && GITHUB_PAGES=true
  [ "$arg" = "--web-only" ] && WEB_ONLY=true
  [ "$arg" = "--no-opt" ] && NO_OPT=true
done

echo "🔨 Building for GitHub Pages (release)"
echo "   root=$ROOT"
echo ""

# Dioxus CLI + wasm target
if ! command -v dx &>/dev/null; then
  echo "❌ Dioxus CLI (dx) not found. Install: cargo install dioxus-cli --locked"
  exit 1
fi
# Warn if dx version doesn't match project
DX_VER="$(dx --version 2>/dev/null | head -1 || true)"
if echo "$DX_VER" | grep -qE '0\.7\.([3-9]|[1-9][0-9])'; then
  if grep -q '"dioxus.*0\.7\.' Cargo.lock 2>/dev/null; then
    DIOXUS_VER="$(grep -oE '"dioxus"[^"]*"version"[^"]*"[^"]*"' Cargo.lock | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)"
    if [ -n "$DIOXUS_VER" ]; then
      echo "⚠️  dx/dioxus version mismatch: $DX_VER vs project $DIOXUS_VER. Build may still work."
      echo "   To align: cargo install dioxus-cli --version $DIOXUS_VER --locked --force"
      echo ""
    fi
  fi
fi
rustup target add wasm32-unknown-unknown 2>/dev/null || true

# Optional: configure base_path for GitHub Pages (project site e.g. user.github.io/claw-core)
DIOXUS_TOML="apps/web/Dioxus.toml"
if [ "$GITHUB_PAGES" = true ] && [ -f "$DIOXUS_TOML" ]; then
  sed -i.bak 's|base_path = ".*"|base_path = "/claw-core"|' "$DIOXUS_TOML"
  echo "✅ Set base_path to /claw-core in $DIOXUS_TOML"
fi

# Build Dioxus web app (release)
# Known: "wasm-opt failed ... SIGABRT/DWARF" (binaryen#6391) can appear; build still succeeds.
echo "▶ Building Dioxus web app (release)..."
(cd apps/web && dx build --platform web --release)
echo "✅ Dioxus build done"
echo ""

# Find build output (match CI: target/dx/*/release/web/public)
OUTPUT_DIR=""
OUTPUT_DIR="$(ls -d target/dx/*/release/web/public 2>/dev/null | head -1 || true)"
if [ -z "$OUTPUT_DIR" ]; then
  OUTPUT_DIR="$(ls -d target/dx/*/wasm-release/web/public 2>/dev/null | head -1 || true)"
fi
if [ -z "$OUTPUT_DIR" ]; then
  OUTPUT_DIR="$(ls -d target/dx/*/debug/web/public 2>/dev/null | head -1 || true)"
fi

if [ -z "$OUTPUT_DIR" ] || [ ! -d "$OUTPUT_DIR" ]; then
  echo "❌ Build output not found under target/dx/"
  find target/dx -name "*.html" -o -name "*.wasm" 2>/dev/null | head -10
  exit 1
fi

# Prepare dist/
mkdir -p dist
cp -r "$OUTPUT_DIR"/* dist/
echo "✅ Copied build output to dist/"

# Flatten if dx wrote to dist/public
if [ -d "dist/public" ]; then
  mv dist/public/* dist/ 2>/dev/null || true
  rmdir dist/public 2>/dev/null || true
fi

# Optional: extra static files from web/ or apps/web/public
if [ -d "web" ]; then
  [ -f "web/404.html" ] && cp web/404.html dist/
  [ -f "web/icon-192.png" ] && cp web/icon-192.png dist/
  [ -f "web/manifest.json" ] && cp web/manifest.json dist/
  [ -d "web/css" ] && cp -r web/css dist/
elif [ -d "apps/web/public" ]; then
  for f in apps/web/public/*; do [ -e "$f" ] && cp -r "$f" dist/ 2>/dev/null || true; done
fi

# Optional hero video asset
VIDEO_SRC="apps/web/assets/claw-shrimp-box-breakout-v1.mp4"
if [ -f "$VIDEO_SRC" ]; then
  cp "$VIDEO_SRC" dist/claw-shrimp-box-breakout-v1.mp4
  echo "✅ Copied hero video"
fi

# 404.html for client-side routing
if [ -f "dist/index.html" ] && [ ! -f "dist/404.html" ]; then
  cp dist/index.html dist/404.html
  echo "✅ Created 404.html"
fi

# Inject <base href> for GitHub Pages so relative links and SPA routing work
if [ "$GITHUB_PAGES" = true ] && [ -f "dist/index.html" ]; then
  for html in dist/index.html dist/404.html; do
    [ -f "$html" ] && sed -i.bak 's|<head>|<head><base href="/claw-core/">|' "$html" && rm -f "${html}.bak"
  done
  echo "✅ Injected base href=/claw-core/ into HTML"
fi

# SEO: robots.txt and sitemap.xml at root (if present)
for dir in apps/web/assets assets; do
  [ -f "$dir/robots.txt" ] && cp "$dir/robots.txt" dist/robots.txt && echo "✅ Copied robots.txt" && break
done
for dir in apps/web/assets assets; do
  [ -f "$dir/sitemap.xml" ] && cp "$dir/sitemap.xml" dist/sitemap.xml && echo "✅ Copied sitemap.xml" && break
done

# Optional: wasm-opt (non-fatal). Skip on macOS: binaryen wasm-opt SIGABRTs on DWARF (binaryen#6391).
# CI (Linux) may run wasm-opt; local macOS uses unoptimized WASM.
if [ "$NO_OPT" = false ] && command -v wasm-opt &>/dev/null; then
  case "$(uname -s)" in
    Darwin)
      echo "⚠️  wasm-opt skipped on macOS (known DWARF bug); using unoptimized WASM. CI will optimize on deploy."
      ;;
    *)
      FIRST_WASM="$(find dist -name "*.wasm" -type f 2>/dev/null | head -1)"
      if [ -n "$FIRST_WASM" ]; then
        if wasm-opt "$FIRST_WASM" -o "$FIRST_WASM.tmp" -Os 2>/dev/null; then
          mv "$FIRST_WASM.tmp" "$FIRST_WASM"
          echo "▶ Optimizing WASM with wasm-opt (-Os)..."
          echo "   ✅ $(basename "$FIRST_WASM")"
          find dist -name "*.wasm" -type f ! -path "$FIRST_WASM" 2>/dev/null | while read -r wasm_file; do
            if wasm-opt "$wasm_file" -o "$wasm_file.tmp" -Os 2>/dev/null; then
              mv "$wasm_file.tmp" "$wasm_file"
              echo "   ✅ $(basename "$wasm_file")"
            else
              rm -f "$wasm_file.tmp"
              echo "   ⚠️  $(basename "$wasm_file") skipped"
            fi
          done
        else
          rm -f "$FIRST_WASM.tmp"
          echo "⚠️  wasm-opt failed; using unoptimized WASM. Use --no-opt to skip."
        fi
      fi
      ;;
  esac
elif [ "$NO_OPT" = false ]; then
  echo "⚠️  wasm-opt not found; skipping WASM optimization (install binaryen for smaller bundles)"
fi

# Optional: performance budget check
if [ "$NO_OPT" = false ] && [ -f "scripts/check-performance-budgets.sh" ]; then
  chmod +x scripts/check-performance-budgets.sh
  if ./scripts/check-performance-budgets.sh dist; then
    echo "✅ Performance budgets passed"
  else
    echo "⚠️  Performance budgets failed (see above)"
  fi
fi

# Restore Dioxus.toml if we changed it
if [ "$GITHUB_PAGES" = true ] && [ -f "${DIOXUS_TOML}.bak" ]; then
  mv "${DIOXUS_TOML}.bak" "$DIOXUS_TOML"
  echo "✅ Restored $DIOXUS_TOML"
fi

if [ "$WEB_ONLY" = true ]; then
  echo ""
  echo "✅ dist/ ready (web only)"
  echo "   Serve locally: npx serve dist -p 3000  (omit -s so /book/ serves the docs)"
  [ "$GITHUB_PAGES" = true ] && echo "   With base_path: open http://localhost:3000/claw/"
  exit 0
fi

# mdBook: output under dist/{en,zh-Hans,zh-Hant}/book/ so URLs are /en/book/, /zh-Hans/book/, /zh-Hant/book/
if ! command -v mdbook &>/dev/null; then
  echo "⚠️  mdbook not found; skipping book. Install: cargo install mdbook"
  echo ""
  echo "✅ dist/ ready (web only)"
  echo "   Serve locally: npx serve dist -p 3000  (omit -s so /en/book/ serves the docs)"
  exit 0
fi

echo "▶ Building mdBook..."
for loc_dir in en zh-Hans zh-Hant; do
  mkdir -p "dist/$loc_dir/book"
done

build_book_from_src() {
  local lang="$1"
  local src_dir="$2"
  local dest_dir="$3"
  local tmp_dir

  if [ ! -d "$ROOT/book/$src_dir" ]; then
    echo "⚠️  Missing book/$src_dir, fallback to book/src"
    src_dir="src"
  fi

  tmp_dir="$(mktemp -d)"
  cp -R "$ROOT/book/theme" "$tmp_dir/theme"
  cp -R "$ROOT/book/$src_dir" "$tmp_dir/src"

  cat > "$tmp_dir/book.toml" << EOF
[book]
title = "Claw Core"
description = "Agent CLI packing core — terminal runtime for AI agents"
authors = ["Claw Core"]
language = "$lang"
src = "src"

[build]
build-dir = "book"
create-missing = true

[output.html]
default-theme = "rust"
preferred-dark-theme = "navy"
mathjax-support = false
no-section-label = false
cname = ""
git-repository-url = ""
git-repository-icon = "fa-github"
edit-url-template = ""
site-url = ""
input-404 = ""
print.enable = false
fold.enable = false
fold.level = 0
search.enable = true
EOF

  mdbook build "$tmp_dir" -d "$dest_dir"
  rm -rf "$tmp_dir"
}

build_book_from_src "en" "src" "$ROOT/dist/en/book"
build_book_from_src "zh-Hans" "src-zh-Hans" "$ROOT/dist/zh-Hans/book"
# Temporary: zh-Hant reuses translated Chinese source to avoid English fallback.
build_book_from_src "zh-Hant" "src-zh-Hans" "$ROOT/dist/zh-Hant/book"

# So /en, /zh-Hans, /zh-Hant serve the SPA (same app as /)
for loc_dir in en zh-Hans zh-Hant; do
  [ -f "dist/index.html" ] && cp dist/index.html "dist/$loc_dir/index.html"
done

# Redirect /book and /book/ to default locale book
BOOK_BASE=""
[ "$GITHUB_PAGES" = true ] && BOOK_BASE="/claw-core"
BOOK_REDIRECT_URL="${BOOK_BASE}/en/book/"
mkdir -p dist/book
cat > dist/book/index.html << EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claw Core — Documentation</title>
  <meta http-equiv="refresh" content="0; url=${BOOK_REDIRECT_URL}">
</head>
<body>
  <p>Redirecting to <a href="${BOOK_REDIRECT_URL}">documentation</a>. Or choose: <a href="${BOOK_BASE}/en/book/">English</a> · <a href="${BOOK_BASE}/zh-Hans/book/">简体中文</a> · <a href="${BOOK_BASE}/zh-Hant/book/">繁體中文</a>.</p>
</body>
</html>
EOF

echo "✅ Built mdBook with custom theme (no sidebar locale switcher)"

echo ""
echo "✅ dist/ ready (web + book)"
echo "   Book at /en/book/, /zh-Hans/book/, /zh-Hant/book/. Serve WITHOUT -s:"
echo "      ./scripts/serve-dist.sh   OR   npx serve dist -p 3000"
if [ "$GITHUB_PAGES" = true ]; then
  echo "   With base_path: open http://localhost:3000/claw/"
fi
