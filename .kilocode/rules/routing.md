# Routing Patterns

## Overview

Claw uses path-based locale routing with Dioxus Router:

- `/en` -- English landing
- `/zh` -- Simplified Chinese (zh-CN)
- `/ch` -- Traditional Chinese (zh-TW)
- `/` -- Redirects to `/en`

## Route Enum

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

## Planned: Legal Routes

Locale-prefixed legal routes following the remind-me-pwa pattern:

```rust
#[route("/:locale/privacy")]
Privacy { locale: String },

#[route("/:locale/terms")]
Terms { locale: String },
```

URL format: `/{locale}/privacy`, `/{locale}/terms`

## Helper Functions

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

## Navigation

- Use `Link { to: Route::Zh, ... }` for locale switching (dioxus-router)
- Footer links should use route-based paths (`/en/privacy`), not static HTML

## Rules

- Use `Link` or `route_for_locale()` for locale-aware navigation
- Set `i18n().set_language()` when locale changes
- Keep locale in URL for shareable links
- Do NOT hardcode locale in links
- Do NOT use static HTML for legal pages when Dioxus routes are available
