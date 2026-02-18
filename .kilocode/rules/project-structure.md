# Claw Core -- Project Structure

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
│       │   ├── en-US.ftl       # English
│       │   ├── zh-CN.ftl       # Simplified Chinese
│       │   └── zh-TW.ftl       # Traditional Chinese
│       ├── public/             # Static assets (CSS, icons)
│       ├── assets/             # Dioxus asset pipeline
│       ├── Cargo.toml
│       ├── Dioxus.toml
│       └── index.html
├── plugin/                     # OpenClaw plugin
│   ├── openclaw.plugin.json    # Plugin manifest (17 skills)
│   ├── skills/                 # Plugin skills
│   └── templates/              # Agent templates (developer, assistant)
├── book/                       # mdBook documentation (separate repo)
├── crates/
│   └── claw-core-protocol/     # ZeroClaw protocol (excluded from workspace)
├── Cargo.toml                  # Workspace root
└── README.md
```

## apps/web Layout

| Path | Purpose |
|------|---------|
| `apps/web/src/main.rs` | App root, i18n init, Router, Landing, PrivacyPolicyPage, TermsOfUsePage |
| `apps/web/src/routes.rs` | Route enum, Home/En/Zh/Ch + legal route components |
| `apps/web/src/layout.rs` | LandingHeader, LandingFooter (shared layout) |
| `apps/web/locales/*.ftl` | Fluent translations |
| `apps/web/public/` | Static files (CSS, icons) |
| `apps/web/assets/` | Dioxus asset pipeline |

## Agent Workspace

| Path | Purpose |
|------|---------|
| `~/Documents/claw_core/` | Default root workspace for agents |
| `shared_memory/` | Persistent memory shared across sessions and agents |
| `shared_skills/` | Skills available to all agents in this workspace |

## Naming Conventions

- **Components**: `PascalCase` (e.g. `Landing`, `En`, `Zh`)
- **Functions**: `snake_case` (e.g. `route_for_locale`, `locale_to_langid`)
- **i18n keys**: `kebab-case` (e.g. `footer-privacy`, `brand-title`)
- **CSS classes**: `kebab-case` (e.g. `landing-page`, `legal-prose`)
