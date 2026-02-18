# Claw Core

Claw Core is a terminal runtime layer with agent teams, multi-bot Telegram setup, and a Dioxus WASM web app. This file provides project-wide instructions for any AI coding tool (Kilo Code, Cursor, Windsurf).

## Project Overview

- **Web app**: Dioxus (Rust) compiled to WASM, located in `apps/web/`
- **Plugin system**: OpenClaw plugin with 17 skills, 2 agent templates (developer, assistant)
- **Documentation**: mdBook in `book/` (separate repo)
- **Protocol crate**: `crates/claw-core-protocol/` for ZeroClaw integration (experimental)
- **Workspace**: Cargo workspace with `apps/web` as the sole member

## Directory Structure

```
claw/
├── apps/
│   └── web/                    # Dioxus web app (WASM)
│       ├── src/
│       │   ├── main.rs         # Entry, Router, Landing component
│       │   ├── routes.rs       # Route enum, locale routes
│       │   └── layout.rs       # LandingHeader, LandingFooter (shared layout)
│       ├── locales/            # i18n translations (Fluent .ftl)
│       │   ├── en-US.ftl
│       │   ├── zh-CN.ftl
│       │   └── zh-TW.ftl
│       ├── public/             # Static assets (CSS, icons)
│       ├── assets/             # Dioxus asset pipeline
│       ├── Cargo.toml
│       ├── Dioxus.toml
│       └── index.html
├── plugin/                     # OpenClaw plugin (skills, templates)
│   ├── openclaw.plugin.json
│   ├── skills/                 # 17 registered skills
│   └── templates/              # Agent templates (developer, assistant)
├── book/                       # mdBook documentation
├── crates/
│   └── claw-core-protocol/     # ZeroClaw protocol (excluded from workspace)
├── Cargo.toml                  # Workspace root
└── README.md
```

## Code Style

- **Components**: `PascalCase` (e.g. `Landing`, `En`, `Zh`, `PrivacyPolicyPage`)
- **Functions**: `snake_case` (e.g. `route_for_locale`, `locale_to_langid`)
- **i18n keys**: `kebab-case` (e.g. `footer-privacy`, `brand-title`, `legal-privacy-title`)
- **CSS classes**: `kebab-case` (e.g. `landing-page`, `legal-prose`, `public-page-card`)
- Use Rust 2021 edition
- Optimize release builds: `opt-level = "z"`, LTO, single codegen unit, strip symbols

## Routing

Claw uses path-based locale routing with Dioxus Router:

| Path | Description |
|------|-------------|
| `/` | Redirects to `/en` |
| `/en` | English landing |
| `/zh` | Simplified Chinese (zh-CN) |
| `/ch` | Traditional Chinese (zh-TW) |
| `/{locale}/privacy` | Privacy Policy page |
| `/{locale}/terms` | Terms of Service page |

### Route Enum

```rust
#[derive(Clone, Debug, PartialEq, Routable)]
pub enum Route {
    #[route("/")]
    Home,
    #[route("/en")]
    En,
    #[route("/zh")]
    Zh,
    #[route("/ch")]
    Ch,
}
```

### Helper Functions

```rust
fn route_for_locale(loc: &str) -> Route {
    match loc {
        "zh-CN" => Route::Zh,
        "zh-TW" => Route::Ch,
        _ => Route::En,
    }
}

fn locale_to_langid(loc: &str) -> unic_langid::LanguageIdentifier {
    match loc {
        "zh-CN" => langid!("zh-CN"),
        "zh-TW" => langid!("zh-TW"),
        _ => langid!("en-US"),
    }
}
```

### Routing Rules

- Use `Link` or `route_for_locale()` for locale-aware navigation
- Set `i18n().set_language()` when locale changes
- Keep locale in URL for shareable links
- Do NOT hardcode locale in links
- Do NOT use static HTML for legal pages when Dioxus routes are available

## Internationalization (i18n)

Claw supports 3 locales using Fluent (.ftl) files:

| Locale | Path | LangId |
|--------|------|--------|
| English (default) | `/en` | `en-US` |
| Simplified Chinese | `/zh` | `zh-CN` |
| Traditional Chinese | `/ch` | `zh-TW` |

### File Location

`apps/web/locales/` contains `en-US.ftl`, `zh-CN.ftl`, `zh-TW.ftl`

### Usage

```rust
use dioxus_i18n::t;
i18n().set_language(locale_to_langid(locale.as_str()));
rsx! { { t!("footer-privacy") } }
```

### i18n Rules

- Use translation keys for ALL user-facing text
- Add keys to all 3 locale files when adding new strings
- Keep key names consistent across locales
- Key format: flat `kebab-case` (e.g. `footer-privacy`, `brand-title`)
- Do NOT hardcode strings in components
- Do NOT skip any locale when adding keys
- Do NOT mix Fluent and JSON in the same project

## Page Templates

Legal pages (Privacy Policy, Terms of Service) use a shared template pattern:

```
landing-page
└── landing-container
    └── landing-shell
        ├── Navbar (brand, nav links, locale switcher)
        ├── main (public-page-main)
        │   └── section (public-page-card)
        │       ├── h1 (page title)
        │       └── div (legal-prose content)
        └── Footer
```

### Rules

- Use i18n for all legal text (`t!()` macro)
- Reuse landing navbar and footer components (`LandingHeader`, `LandingFooter`)
- Keep content in semantic HTML (`h2`, `p`, `ul`, `li`)
- Link to GitHub repo, MIT license, Issues
- Do NOT hardcode legal text
- Do NOT create separate navbar/footer for legal pages

### CSS Classes

```css
.legal-prose { max-width: 800px; margin: 0 auto; }
.legal-updated { font-size: 0.9em; color: var(--muted); }
.public-page-card { padding: 2rem; border-radius: 12px; }
```

## Development Workflow

### Coding Tasks

1. **Understand**: Read relevant files, understand the codebase
2. **Plan**: Break down into steps, identify affected files
3. **Implement**: Make changes, use multi-file edits for complex work
4. **Test**: Run `cargo test`, `cargo clippy`, `cargo fmt --check`
5. **Report**: Summarize changes, tests, remaining issues

### Build Commands

- `dx serve` -- run Dioxus dev server (WASM)
- `dx build --release` -- production build
- `cargo build` -- build workspace
- `cargo test` -- run tests
- `cargo clippy` -- lint
- `cargo fmt` -- format

### CI/CD

The project has 4 GitHub Actions workflows:
- `ci.yml` -- format, clippy, build, test on push/PR to main
- `github-pages.yml` -- deploy Dioxus + mdBook to GitHub Pages
- `release-openclaw.yml` -- cross-platform binary release on `v*` tags
- `release-zeroclaw-crate.yml` -- publish protocol crate on `crate-v*` tags

## Agent Roles

The project has 2 agent personalities. When using custom modes:

### Developer (claw-developer mode)

Senior full-stack developer. Methodical: understand, plan, implement, test. Has full code/edit/command access. Focuses on coding, shell execution, DevOps.

### Assistant (claw-assistant mode)

Helpful Q&A assistant. Quick, accurate answers with web search capability. Read-only plus browser access. Focuses on research and information retrieval.

## Security

- Never commit API keys or secrets
- `.env` files are gitignored
- Validate all user inputs
- Handle sensitive config values carefully (don't display API keys in full)
