# Scripts

Scripts are split into **GitHub build**, **development**, and **OpenClaw**.

---

## GitHub / production build

| Script | Purpose |
|--------|---------|
| **build-github.sh** | Build the site the same way as the GitHub Pages workflow. Output: `dist/` (Dioxus app + mdBook under `dist/{en,zh-Hans,zh-Hant}/book/`). |

```bash
./scripts/build-github.sh           # full (web + book)
./scripts/build-github.sh --web-only  # Dioxus web app only
./scripts/build-github.sh --gh-pages  # set base_path=/claw (for project site)
./scripts/build-github.sh --no-opt    # skip wasm-opt and performance budget
```

Use this to test the production build locally or to prepare `dist/` for manual deploy.

To serve the built site (including the book at `/en/book/`, `/zh-Hans/book/`, `/zh-Hant/book/`), use **`./scripts/serve-dist.sh`** (or `npx serve dist -p 3000` without `-s`).

**Notes:**
- On macOS, wasm-opt is skipped (binaryen [issue #6391](https://github.com/WebAssembly/binaryen/issues/6391)); the build still succeeds and CI can optimize on deploy.
- If you see `wasm-opt failed ... SIGABRT` during `dx build`, that is the same known issue; `dist/` is still valid.
- The mdBook locale switcher is now provided by mdBook theme files (`book/theme/index.hbs`, `book/theme/css/chrome.css`), not post-build HTML injection.
- To serve locally with the book paths above, run **without** `-s`: `npx serve dist -p 3000`. With `-s`, book paths return the app and show a docs info page (no redirect loop).

---

## Development

| Script | Purpose |
|--------|---------|
| **build-dev.sh** | Build the Dioxus web app in **debug** mode (no server). |
| **run-dev.sh** | Build + start Dioxus dev server with hot reload (landing only). → http://localhost:8080 |
| **serve-dev.sh** | Build + run **both** Dioxus dev server and mdBook server (landing on 8080, book on 3001). |

```bash
./scripts/run-dev.sh      # dev server only
./scripts/serve-dev.sh    # dev server + book
./scripts/build-dev.sh    # build only (debug)
```

---

## OpenClaw

OpenClaw-related scripts (install, remove, verification, daemon) are documented in **[openclaw/README.md](openclaw/README.md)**.

| Script | Purpose |
|--------|---------|
| **install-claw-core-openclaw.sh** | Build binary, install plugin, auto-configure `openclaw.json`. Use `--force` to reinstall, `--link` for dev. |
| **remove-claw-core-openclaw.sh** | Stop daemon, remove plugin + skills, clean `openclaw.json` |
| **verify_integration.sh** | Verify claw_core ↔ OpenClaw (config, skills, hooks, runtime). `--strict` for CI. |
| **claw-core-skills.list** | Canonical list of skills — sourced by install, remove, and verify scripts. |

```bash
./scripts/install-claw-core-openclaw.sh        # install
./scripts/install-claw-core-openclaw.sh --force # reinstall
./scripts/remove-claw-core-openclaw.sh         # remove
./scripts/verify_integration.sh                # verify
```

---

## Other scripts

- **smoke.sh** — local end-to-end smoke test
- **claw_core_*.sh / *.py** — daemon, exec, stats, status (used by OpenClaw plugin or CLI)
