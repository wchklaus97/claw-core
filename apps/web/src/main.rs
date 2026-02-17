//! Claw Core — Web entry (Dioxus/WASM)
//! Path-based locale: /en, /zh-Hans, /zh-Hant
//! i18n via dioxus-i18n + Fluent .ftl files
mod layout;
mod routes;
use dioxus::prelude::*;
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;

use dioxus_i18n::prelude::{i18n, use_init_i18n, I18nConfig};
use dioxus_i18n::t;
use routes::Route;
use unic_langid::langid;

pub(crate) fn locale_label(loc: &str) -> &'static str {
    match loc {
        "zh-CN" => "简",
        "zh-TW" => "繁",
        _ => "EN",
    }
}

/// URL path segment for book: /en/book/, /zh-Hans/book/, /zh-Hant/book/
pub(crate) fn locale_to_book_path(loc: &str) -> &'static str {
    match loc {
        "zh-CN" => "zh-Hans",
        "zh-TW" => "zh-Hant",
        _ => "en",
    }
}

fn main() {
    launch(app);
}

fn app() -> Element {
    use_init_i18n(|| {
        I18nConfig::new(langid!("en-US"))
            .with_locale((langid!("en-US"), include_str!("../locales/en-US.ftl")))
            .with_locale((langid!("zh-CN"), include_str!("../locales/zh-CN.ftl")))
            .with_locale((langid!("zh-TW"), include_str!("../locales/zh-TW.ftl")))
    });

    rsx! { Router::<Route> {} }
}

pub(crate) fn route_for_locale(loc: &str) -> Route {
    match loc {
        "zh-CN" => Route::ZhHans,
        "zh-TW" => Route::ZhHant,
        _ => Route::En,
    }
}

pub(crate) fn route_for_privacy(loc: &str) -> Route {
    match loc {
        "zh-CN" => Route::ZhHansPrivacy,
        "zh-TW" => Route::ZhHantPrivacy,
        _ => Route::EnPrivacy,
    }
}

pub(crate) fn route_for_terms(loc: &str) -> Route {
    match loc {
        "zh-CN" => Route::ZhHansTerms,
        "zh-TW" => Route::ZhHantTerms,
        _ => Route::EnTerms,
    }
}

/// Shown when the app is loaded at /book (e.g. single-page serve). No redirect to avoid infinite loop when server returns SPA for /book/.
#[component]
pub(crate) fn BookRedirect() -> Element {
    rsx! {
        div { class: "landing-page", style: "padding: 2rem; text-align: center; max-width: 36rem; margin: 0 auto;",
            h2 { style: "margin-bottom: 1rem;", "Documentation" }
            p { style: "margin-bottom: 1rem;",
                "You're seeing this because the server is in single-page mode (-s), so /book/ returns the app instead of the book."
            }
            div { style: "text-align: left; margin: 1.5rem 0; padding: 1rem; background: #f5f5f5; border-radius: 8px; font-size: 0.9rem;",
                p { style: "margin: 0 0 0.5rem 0; font-weight: bold;", "To view the book:" }
                ol { style: "margin: 0; padding-left: 1.25rem;",
                    li { "Stop the server (Ctrl+C in the terminal)." }
                    li { "Start it without -s: " code { "npx serve dist -p 3000" } }
                    li { "Open " a { href: "http://localhost:3000/en/book/", target: "_blank", rel: "noopener noreferrer", "http://localhost:3000/en/book/" } " (or run " code { "./scripts/serve-dist.sh" } " from the repo root)." }
                }
            }
            a { href: "/en/book/", target: "_blank", rel: "noopener noreferrer", class: "hero-primary", style: "display: inline-block; margin-top: 0.5rem;", "Open /en/book/ in new tab" }
        }
    }
}

/// Map route locale string to Fluent langid
fn locale_to_langid(loc: &str) -> unic_langid::LanguageIdentifier {
    match loc {
        "zh-CN" => langid!("zh-CN"),
        "zh-TW" => langid!("zh-TW"),
        _ => langid!("en-US"),
    }
}

#[component]
fn Landing(#[props(into)] locale: String) -> Element {
    let mut expanded_faq = use_signal(|| None::<usize>);
    let mut hero_video_muted = use_signal(|| true);
    let mut hero_video_failed = use_signal(|| false);
    let mut sound_toast_text = use_signal(|| String::new());
    let mut sound_toast_seq = use_signal(|| 0_u32);
    let quickstart_copied_line = use_signal(|| None::<usize>);
    i18n().set_language(locale_to_langid(locale.as_str()));

    rsx! {
        div { class: "landing-page",
            layout::LandingHeader { locale: locale.clone(), page_kind: layout::PageKind::Landing }
            main { class: "landing-shell",
                section { class: "hero-section", "aria-labelledby": "hero-title", "data-motion": "section",
                    div { class: "hero-card",
                        div { id: "hero-video-anchor", class: "hero-video-anchor",
                            if hero_video_failed() {
                                img { src: "icon-192.png", alt: "", class: "hero-icon-tile", width: "100", height: "100" }
                            } else {
                                video {
                                    id: "hero-video",
                                    class: "hero-icon-tile-video",
                                    src: "claw-shrimp-box-breakout-v1.mp4",
                                    autoplay: true,
                                    muted: hero_video_muted(),
                                    loop: true,
                                    playsinline: true,
                                    preload: "metadata",
                                    oncanplay: move |_| {
                                        hero_video_failed.set(false);
                                        if let Some(window) = web_sys::window() {
                                            if let Some(document) = window.document() {
                                                if let Some(target) = document.get_element_by_id("hero-video") {
                                                    if let Ok(video) = target.dyn_into::<web_sys::HtmlVideoElement>() {
                                                        let should_mute = hero_video_muted();
                                                        video.set_muted(should_mute);
                                                        if !should_mute {
                                                            let _ = video.play();
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    onerror: move |_| hero_video_failed.set(true),
                                }
                            }
                        }
                        div { class: "hero-chip-stack",
                            p { class: "hero-chip", { t!("hero-chip-line1") } }
                            p { class: "hero-chip hero-chip-secondary", { t!("hero-chip-line2") } }
                        }
                        h1 { id: "hero-title", class: "hero-title", { t!("brand-title") } }
                        p { class: "hero-description", { t!("hero-description") } }
                        div { class: "hero-actions",
                            a { href: "{locale_to_book_path(locale.as_str())}/book/", class: "hero-primary nav-docs-link", "data-motion": "button", target: "_blank", rel: "noopener noreferrer", { t!("nav-open-docs") } }
                            a { href: "https://github.com/wchklaus97/claw-core", class: "hero-secondary", "data-motion": "button", target: "_blank", rel: "noopener", "GitHub" }
                        }
                        div { class: "hero-highlights",
                            span { class: "hero-highlight-card", "data-motion": "card", { t!("hero-highlight-sessions") } }
                            span { class: "hero-highlight-card", "data-motion": "card", { t!("hero-highlight-workers") } }
                            span { class: "hero-highlight-card", "data-motion": "card", { t!("hero-highlight-cli") } }
                            span { class: "hero-highlight-card", "data-motion": "card", { t!("hero-highlight-integrations") } }
                        }
                    }
                }

                section { id: "who", class: "who-section", "data-motion": "section",
                    h2 { class: "section-title", { t!("who-title") } }
                    p { class: "section-subtitle", { t!("who-subtitle") } }
                    p { class: "who-desc", { t!("who-desc") } }
                    div { class: "who-grid",
                        div { class: "who-card", "data-motion": "card",
                            img { class: "who-card-icon-img", src: "icons/plan.svg", alt: "" }
                            p { class: "who-card-text", { t!("who-card1") } }
                        }
                        div { class: "who-card", "data-motion": "card",
                            img { class: "who-card-icon-img", src: "icons/timeout.svg", alt: "" }
                            p { class: "who-card-text", { t!("who-card2") } }
                        }
                        div { class: "who-card", "data-motion": "card",
                            img { class: "who-card-icon-img", src: "icons/flow.svg", alt: "" }
                            p { class: "who-card-text", { t!("who-card3") } }
                        }
                        div { class: "who-card", "data-motion": "card",
                            img { class: "who-card-icon-img", src: "icons/mobile.svg", alt: "" }
                            p { class: "who-card-text", { t!("who-card4") } }
                        }
                    }
                }

                section { id: "origin", class: "origin-section", "data-motion": "section",
                    h2 { class: "section-title", { t!("origin-title") } }
                    p { class: "section-subtitle", { t!("origin-subtitle") } }
                    p { class: "origin-desc", { t!("origin-desc") } }
                    div { class: "origin-grid",
                        div { class: "origin-card", "data-motion": "card",
                            h3 { { t!("origin-card1-title") } }
                            p { { t!("origin-card1-desc") } }
                        }
                        div { class: "origin-card", "data-motion": "card",
                            h3 { { t!("origin-card2-title") } }
                            p { { t!("origin-card2-desc") } }
                        }
                        div { class: "origin-card", "data-motion": "card",
                            h3 { { t!("origin-card3-title") } }
                            p { { t!("origin-card3-desc") } }
                        }
                        div { class: "origin-card", "data-motion": "card",
                            h3 { { t!("origin-card4-title") } }
                            p { { t!("origin-card4-desc") } }
                        }
                    }
                }

                section { id: "features", class: "features-section", "data-motion": "section",
                    h2 { class: "section-title", { t!("features-title") } }
                    p { class: "section-subtitle", { t!("features-subtitle") } }
                    div { class: "features-grid",
                        div { class: "feature-card", "data-motion": "card",
                            img { class: "feature-icon-img", src: "icons/session.svg", alt: "" }
                            h3 { { t!("features-sessions-title") } }
                            p { { t!("features-sessions-desc") } }
                        }
                        div { class: "feature-card", "data-motion": "card",
                            img { class: "feature-icon-img", src: "icons/timeout.svg", alt: "" }
                            h3 { { t!("features-timeouts-title") } }
                            p { { t!("features-timeouts-desc") } }
                        }
                        div { class: "feature-card", "data-motion": "card",
                            img { class: "feature-icon-img", src: "icons/api.svg", alt: "" }
                            h3 { { t!("features-api-title") } }
                            p { { t!("features-api-desc") } }
                        }
                        div { class: "feature-card", "data-motion": "card",
                            img { class: "feature-icon-img", src: "icons/secrets.svg", alt: "" }
                            h3 { { t!("features-secrets-title") } }
                            p { { t!("features-secrets-desc") } }
                        }
                        div { class: "feature-card", "data-motion": "card",
                            img { class: "feature-icon-img", src: "icons/cli.svg", alt: "" }
                            h3 { { t!("features-cli-title") } }
                            p { { t!("features-cli-desc") } }
                        }
                        div { class: "feature-card", "data-motion": "card",
                            img { class: "feature-icon-img", src: "icons/integrations.svg", alt: "" }
                            h3 { { t!("features-integrations-title") } }
                            p { { t!("features-integrations-desc") } }
                        }
                        div { class: "feature-card", "data-motion": "card",
                            img { class: "feature-icon-img", src: "icons/binary.svg", alt: "" }
                            h3 { { t!("features-binary-title") } }
                            p { { t!("features-binary-desc") } }
                        }
                    }
                }

                section { id: "how", class: "how-section", "data-motion": "section",
                    h2 { class: "section-title", { t!("how-title") } }
                    p { class: "section-subtitle", { t!("how-subtitle") } }
                    div { class: "how-content",
                        div { class: "how-steps",
                            div { class: "how-step", "data-motion": "card",
                                img { class: "how-step-icon-img", src: "icons/api.svg", alt: "" }
                                h3 { { t!("how-step1-title") } }
                                p { { t!("how-step1-desc") } }
                            }
                            div { class: "how-step", "data-motion": "card",
                                img { class: "how-step-icon-img", src: "icons/cli.svg", alt: "" }
                                h3 { { t!("how-step2-title") } }
                                p { { t!("how-step2-desc") } }
                            }
                            div { class: "how-step", "data-motion": "card",
                                img { class: "how-step-icon-img", src: "icons/flow.svg", alt: "" }
                                h3 { { t!("how-step3-title") } }
                                p { { t!("how-step3-desc") } }
                            }
                        }
                    }
                }

                section { id: "setup", class: "setup-section", "data-motion": "section",
                    h2 { class: "section-title", { t!("setup-title") } }
                    p { class: "section-subtitle", { t!("setup-subtitle") } }
                    p { class: "setup-desc", { t!("setup-desc") } }
                    div { class: "setup-grid",
                        div { class: "setup-card", "data-motion": "card",
                            img { class: "setup-card-icon-img", src: "icons/plan.svg", alt: "" }
                            h3 { { t!("setup-card1-title") } }
                            p { { t!("setup-card1-desc") } }
                        }
                        div { class: "setup-card", "data-motion": "card",
                            img { class: "setup-card-icon-img", src: "icons/cli.svg", alt: "" }
                            h3 { { t!("setup-card2-title") } }
                            p { { t!("setup-card2-desc") } }
                        }
                        div { class: "setup-card", "data-motion": "card",
                            img { class: "setup-card-icon-img", src: "icons/integrations.svg", alt: "" }
                            h3 { { t!("setup-card3-title") } }
                            p { { t!("setup-card3-desc") } }
                        }
                        div { class: "setup-card", "data-motion": "card",
                            img { class: "setup-card-icon-img", src: "icons/flow.svg", alt: "" }
                            h3 { { t!("setup-card4-title") } }
                            p { { t!("setup-card4-desc") } }
                        }
                    }
                }

                section { id: "quickstart", class: "quickstart-section", "data-motion": "section",
                    h2 { class: "section-title", { t!("quickstart-title") } }
                    p { class: "section-subtitle", { t!("quickstart-subtitle") } }
                    div { class: "quickstart-terminal", "data-motion": "card",
                        div { class: "quickstart-terminal-top",
                            div { class: "quickstart-dots",
                                span { class: "quickstart-dot quickstart-dot-red" }
                                span { class: "quickstart-dot quickstart-dot-yellow" }
                                span { class: "quickstart-dot quickstart-dot-green" }
                            }
                            span { class: "quickstart-chip", { t!("quickstart-chip") } }
                            span { class: "quickstart-os", { t!("quickstart-os") } }
                        }
                        p { class: "quickstart-comment", { t!("quickstart-comment") } }
                        div { class: "quickstart-code",
                            div { class: "quickstart-code-line",
                                code { { t!("quickstart-command") } }
                                button {
                                    r#type: "button",
                                    class: if quickstart_copied_line() == Some(0) { "quickstart-copy-btn copied" } else { "quickstart-copy-btn" },
                                    onclick: move |_| {
                                        let cmd = t!("quickstart-command").to_string();
                                        let mut copied = quickstart_copied_line;
                                        spawn(async move {
                                            if let Some(window) = web_sys::window() {
                                                let clipboard = window.navigator().clipboard();
                                                let future = JsFuture::from(clipboard.write_text(&cmd));
                                                let _ = future.await;
                                                copied.set(Some(0));
                                            }
                                        });
                                    },
                                    if quickstart_copied_line() == Some(0) { "Copied!" } else { "Copy" }
                                }
                            }
                            div { class: "quickstart-code-line",
                                code { { t!("quickstart-command-2") } }
                                button {
                                    r#type: "button",
                                    class: if quickstart_copied_line() == Some(1) { "quickstart-copy-btn copied" } else { "quickstart-copy-btn" },
                                    onclick: move |_| {
                                        let cmd = t!("quickstart-command-2").to_string();
                                        let mut copied = quickstart_copied_line;
                                        spawn(async move {
                                            if let Some(window) = web_sys::window() {
                                                let clipboard = window.navigator().clipboard();
                                                let future = JsFuture::from(clipboard.write_text(&cmd));
                                                let _ = future.await;
                                                copied.set(Some(1));
                                            }
                                        });
                                    },
                                    if quickstart_copied_line() == Some(1) { "Copied!" } else { "Copy" }
                                }
                            }
                        }
                    }
                    p { class: "quickstart-note",
                        { t!("quickstart-note-prefix") }
                        a { href: "https://wchklaus97.github.io/claw-core/en/book/", target: "_blank", rel: "noopener noreferrer", { t!("quickstart-note-docs") } }
                        { t!("quickstart-note-suffix") }
                    }
                    p { class: "quickstart-cursor-note",
                        strong { { t!("quickstart-cursor-label") } }
                        " "
                        { t!("quickstart-cursor-text") }
                        " "
                        code { { t!("quickstart-cursor-cmd") } }
                        { t!("quickstart-cursor-then") }
                        " "
                        code { { t!("quickstart-cursor-restart") } }
                        ". "
                        a {
                            href: "https://wchklaus97.github.io/claw-core/{locale_to_book_path(locale.as_str())}/book/openclaw-integration.html#cursor-cli-integration",
                            target: "_blank",
                            rel: "noopener noreferrer",
                            { t!("quickstart-cursor-docs") }
                        }
                    }
                }

                section { id: "pricing", class: "pricing-section", "data-motion": "section",
                    h2 { class: "section-title", { t!("pricing-title") } }
                    div { class: "pricing-card", "data-motion": "card",
                        p { class: "pricing-pill", { t!("pricing-pill") } }
                        p { class: "pricing-price", { t!("pricing-price") } }
                        p { class: "pricing-label", { t!("pricing-label") } }
                        ul {
                            li { { t!("pricing-li1") } }
                            li { { t!("pricing-li2") } }
                            li { { t!("pricing-li3") } }
                        }
                        div { class: "pricing-actions",
                            a { href: "https://github.com/wchklaus97/claw-core", class: "hero-primary", "data-motion": "button", target: "_blank", rel: "noopener", { t!("pricing-view-github") } }
                        }
                    }
                }

                section { id: "faq", class: "faq-section", "data-motion": "section",
                    h2 { class: "faq-title-main", { t!("faq-title") } }
                    p { class: "faq-subtitle-main", { t!("faq-subtitle") } }
                    div { class: "faq-content",
                        div { class: "faq-list",
                            div {
                                class: if expanded_faq() == Some(0) { "faq-item expanded" } else { "faq-item" },
                                "data-motion": "card",
                                onclick: move |_| {
                                    let cur = expanded_faq();
                                    expanded_faq.set(if cur == Some(0) { None } else { Some(0) });
                                },
                                div { class: "faq-item-header",
                                    p { class: "faq-q", { t!("faq1-q") } }
                                    span { class: "faq-chevron", "▼" }
                                }
                                p { class: "faq-a", { t!("faq1-a") } }
                            }
                            div {
                                class: if expanded_faq() == Some(1) { "faq-item expanded" } else { "faq-item" },
                                "data-motion": "card",
                                onclick: move |_| {
                                    let cur = expanded_faq();
                                    expanded_faq.set(if cur == Some(1) { None } else { Some(1) });
                                },
                                div { class: "faq-item-header",
                                    p { class: "faq-q", { t!("faq2-q") } }
                                    span { class: "faq-chevron", "▼" }
                                }
                                p { class: "faq-a",
                                    { t!("faq2-a-prefix") }
                                    code { "openclaw plugins install @wchklaus97hk/claw-core" }
                                    { t!("faq2-a-suffix") }
                                }
                            }
                            div {
                                class: if expanded_faq() == Some(2) { "faq-item expanded" } else { "faq-item" },
                                "data-motion": "card",
                                onclick: move |_| {
                                    let cur = expanded_faq();
                                    expanded_faq.set(if cur == Some(2) { None } else { Some(2) });
                                },
                                div { class: "faq-item-header",
                                    p { class: "faq-q", { t!("faq3-q") } }
                                    span { class: "faq-chevron", "▼" }
                                }
                                p { class: "faq-a", { t!("faq3-a") } }
                            }
                            div {
                                class: if expanded_faq() == Some(3) { "faq-item expanded" } else { "faq-item" },
                                "data-motion": "card",
                                onclick: move |_| {
                                    let cur = expanded_faq();
                                    expanded_faq.set(if cur == Some(3) { None } else { Some(3) });
                                },
                                div { class: "faq-item-header",
                                    p { class: "faq-q", { t!("faq4-q") } }
                                    span { class: "faq-chevron", "▼" }
                                }
                                p { class: "faq-a", { t!("faq4-a") } }
                            }
                            div {
                                class: if expanded_faq() == Some(4) { "faq-item expanded" } else { "faq-item" },
                                "data-motion": "card",
                                onclick: move |_| {
                                    let cur = expanded_faq();
                                    expanded_faq.set(if cur == Some(4) { None } else { Some(4) });
                                },
                                div { class: "faq-item-header",
                                    p { class: "faq-q", { t!("faq5-q") } }
                                    span { class: "faq-chevron", "▼" }
                                }
                                p { class: "faq-a", { t!("faq5-a") } }
                            }
                            div {
                                class: if expanded_faq() == Some(5) { "faq-item expanded" } else { "faq-item" },
                                "data-motion": "card",
                                onclick: move |_| {
                                    let cur = expanded_faq();
                                    expanded_faq.set(if cur == Some(5) { None } else { Some(5) });
                                },
                                div { class: "faq-item-header",
                                    p { class: "faq-q", { t!("faq6-q") } }
                                    span { class: "faq-chevron", "▼" }
                                }
                                p { class: "faq-a", { t!("faq6-a") } }
                            }
                            div {
                                class: if expanded_faq() == Some(6) { "faq-item expanded" } else { "faq-item" },
                                "data-motion": "card",
                                onclick: move |_| {
                                    let cur = expanded_faq();
                                    expanded_faq.set(if cur == Some(6) { None } else { Some(6) });
                                },
                                div { class: "faq-item-header",
                                    p { class: "faq-q", { t!("faq7-q") } }
                                    span { class: "faq-chevron", "▼" }
                                }
                                p { class: "faq-a", { t!("faq7-a") } }
                            }
                            div {
                                class: if expanded_faq() == Some(7) { "faq-item expanded" } else { "faq-item" },
                                "data-motion": "card",
                                onclick: move |_| {
                                    let cur = expanded_faq();
                                    expanded_faq.set(if cur == Some(7) { None } else { Some(7) });
                                },
                                div { class: "faq-item-header",
                                    p { class: "faq-q", { t!("faq8-q") } }
                                    span { class: "faq-chevron", "▼" }
                                }
                                p { class: "faq-a", { t!("faq8-a") } }
                            }
                        }
                    }
                }

                section { class: "cta-final", "data-motion": "section",
                    h2 { class: "cta-final-title", { t!("cta-title") } }
                    p { class: "cta-final-description", { t!("cta-desc") } }
                    div { class: "cta-final-actions",
                        a { href: "{locale_to_book_path(locale.as_str())}/book/", class: "hero-primary nav-docs-link", "data-motion": "button", target: "_blank", rel: "noopener noreferrer", { t!("nav-open-docs") } }
                        a { href: "https://github.com/wchklaus97/claw-core", class: "hero-secondary", "data-motion": "button", target: "_blank", rel: "noopener", "GitHub" }
                    }
                }

                layout::LandingFooter { locale: locale.clone() }
            }

            if !hero_video_failed() {
                button {
                    class: "sound-fab",
                    r#type: "button",
                    aria_label: if hero_video_muted() { "Unmute hero video" } else { "Mute hero video" },
                    title: if hero_video_muted() { "Turn sound on" } else { "Turn sound off" },
                    onclick: move |_| {
                        let next_muted = !hero_video_muted();
                        hero_video_muted.set(next_muted);
                        sound_toast_text.set(if next_muted {
                            "Sound Off".to_string()
                        } else {
                            "Sound On".to_string()
                        });
                        sound_toast_seq.set(sound_toast_seq().wrapping_add(1));

                        // Keep the actual DOM media element in sync so sound toggles reliably.
                        if let Some(window) = web_sys::window() {
                            if let Some(document) = window.document() {
                                if let Some(el) = document.get_element_by_id("hero-video") {
                                    if let Ok(video) = el.dyn_into::<web_sys::HtmlVideoElement>() {
                                        video.set_muted(next_muted);
                                        if next_muted {
                                            video.set_volume(0.0);
                                        } else {
                                            video.set_volume(1.0);
                                            let _ = video.play();
                                        }
                                    }
                                }
                            }
                        }
                    },
                    img {
                        class: "sound-fab-icon",
                        src: if hero_video_muted() { "icons/sound-off.svg" } else { "icons/sound-on.svg" },
                        alt: ""
                    }
                }
            }

            if sound_toast_seq() > 0 {
                div {
                    key: "{sound_toast_seq()}",
                    class: "sound-toast",
                    "{sound_toast_text()}"
                }
            }
        }
    }
}

#[component]
pub(crate) fn PrivacyPolicyPage(#[props(into)] locale: String) -> Element {
    i18n().set_language(locale_to_langid(locale.as_str()));
    rsx! {
        div { class: "landing-page",
            layout::LandingHeader { locale: locale.clone(), page_kind: layout::PageKind::Privacy }
            main { class: "landing-shell",
                section { class: "public-page-card legal-prose", "data-motion": "legal",
                    h1 { class: "public-page-title", { t!("legal-privacy-title") } }
                    p { class: "legal-updated", { t!("legal-privacy-last-updated") } }
                    h2 { { t!("legal-privacy-summary-title") } }
                    ul {
                        li { strong { { t!("legal-privacy-summary-no-data") } } " " { t!("legal-privacy-summary-no-data-text") } }
                        li { strong { { t!("legal-privacy-summary-local") } } " " { t!("legal-privacy-summary-local-text") } }
                        li { strong { { t!("legal-privacy-summary-opensource") } } " " { t!("legal-privacy-summary-opensource-text") } }
                    }
                    h2 { { t!("legal-privacy-intro-title") } }
                    p { { t!("legal-privacy-intro-text") } }
                    h2 { { t!("legal-privacy-data-title") } }
                    p { { t!("legal-privacy-data-text") } }
                    h2 { { t!("legal-privacy-thirdparty-title") } }
                    p { { t!("legal-privacy-thirdparty-text") } }
                    h2 { { t!("legal-privacy-contact-title") } }
                    p { { t!("legal-privacy-contact-text") } }
                    a {
                        href: "https://github.com/wchklaus97/claw-core/issues",
                        target: "_blank",
                        rel: "noopener noreferrer",
                        { t!("legal-privacy-contact-link") }
                    }
                }
            }
            layout::LandingFooter { locale: locale.clone() }
        }
    }
}

#[component]
pub(crate) fn TermsOfUsePage(#[props(into)] locale: String) -> Element {
    i18n().set_language(locale_to_langid(locale.as_str()));
    rsx! {
        div { class: "landing-page",
            layout::LandingHeader { locale: locale.clone(), page_kind: layout::PageKind::Terms }
            main { class: "landing-shell",
                section { class: "public-page-card legal-prose", "data-motion": "legal",
                    h1 { class: "public-page-title", { t!("legal-terms-title") } }
                    p { class: "legal-updated", { t!("legal-terms-last-updated") } }
                    h2 { { t!("legal-terms-summary-title") } }
                    ul {
                        li { { t!("legal-terms-summary-free") } }
                        li { { t!("legal-terms-summary-mit") } }
                        li { { t!("legal-terms-summary-disclaimer") } }
                    }
                    h2 { { t!("legal-terms-acceptance-title") } }
                    p { { t!("legal-terms-acceptance-text") } }
                    h2 { { t!("legal-terms-license-title") } }
                    p { { t!("legal-terms-license-text") } }
                    h2 { { t!("legal-terms-disclaimer-title") } }
                    p { { t!("legal-terms-disclaimer-text") } }
                    h2 { { t!("legal-terms-contact-title") } }
                    p { { t!("legal-terms-contact-text") } }
                    a {
                        href: "https://github.com/wchklaus97/claw-core/issues",
                        target: "_blank",
                        rel: "noopener noreferrer",
                        { t!("legal-terms-contact-link") }
                    }
                }
            }
            layout::LandingFooter { locale: locale.clone() }
        }
    }
}
