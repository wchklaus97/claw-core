//! Shared layout components: header and footer for landing and legal pages.
use crate::routes::Route;
use crate::{
    locale_label, locale_to_book_path, route_for_locale, route_for_privacy, route_for_terms,
};
use dioxus::prelude::*;
use dioxus_i18n::t;

/// Which page we're on — locale switcher stays on the same page when changing language.
#[derive(Clone, Copy, PartialEq)]
pub enum PageKind {
    Landing,
    Privacy,
    Terms,
}

fn route_for_locale_on_page(page: PageKind, loc: &str) -> Route {
    match page {
        PageKind::Landing => route_for_locale(loc),
        PageKind::Privacy => route_for_privacy(loc),
        PageKind::Terms => route_for_terms(loc),
    }
}

#[component]
pub fn LandingHeader(#[props(into)] locale: String, page_kind: PageKind) -> Element {
    let mut locale_open = use_signal(|| false);
    rsx! {
        header { class: "landing-header", role: "banner",
            div { class: "landing-header-inner",
                div { class: "nav-left",
                    Link { to: route_for_locale(locale.as_str()),
                        img {
                            src: "icon-192.png",
                            alt: "",
                            class: "brand-mark-img",
                            width: "48",
                            height: "48"
                        }
                    }
                    div { class: "brand-text",
                        h1 { { t!("brand-title") } }
                        p { class: "tagline", { t!("brand-tagline") } }
                    }
                }
                nav { class: "nav-links", role: "navigation", aria_label: "Main",
                    a { href: "#features", { t!("nav-features") } }
                    a { href: "#who", { t!("nav-who") } }
                    a { href: "#origin", { t!("nav-origin") } }
                    a { href: "#how", { t!("nav-how") } }
                    a { href: "#setup", { t!("nav-setup") } }
                    a { href: "#quickstart", { t!("nav-quickstart") } }
                    a { href: "#pricing", { t!("nav-pricing") } }
                    a { href: "#faq", { t!("nav-faq") } }
                    a { href: "https://github.com/wchklaus97/claw-core", target: "_blank", rel: "noopener", "GitHub" }
                    if locale_open() {
                        div {
                            class: "nav-locale-backdrop",
                            onclick: move |_| locale_open.set(false),
                        }
                    }
                    div {
                        class: if locale_open() { "nav-locale-dropdown open" } else { "nav-locale-dropdown" },
                        aria_label: "Language",
                        button {
                            r#type: "button",
                            class: "nav-locale-btn",
                            aria_haspopup: "listbox",
                            aria_expanded: if locale_open() { "true" } else { "false" },
                            onclick: move |e| { e.stop_propagation(); locale_open.set(!locale_open()); },
                            span { class: "nav-locale-globe", "🌐" }
                            span { class: "nav-locale-label", "{locale_label(locale.as_str())}" }
                            span { class: "nav-locale-arrow", "▾" }
                        }
                        ul {
                            class: "nav-locale-menu",
                            role: "listbox",
                            hidden: !locale_open(),
                            li { role: "option", Link { to: route_for_locale_on_page(page_kind, "en"), class: if locale.as_str() == "en" { "nav-locale-opt current" } else { "nav-locale-opt" }, onclick: move |_| locale_open.set(false), "English" } }
                            li { role: "option", Link { to: route_for_locale_on_page(page_kind, "zh-CN"), class: if locale.as_str() == "zh-CN" { "nav-locale-opt current" } else { "nav-locale-opt" }, onclick: move |_| locale_open.set(false), "简体中文" } }
                            li { role: "option", Link { to: route_for_locale_on_page(page_kind, "zh-TW"), class: if locale.as_str() == "zh-TW" { "nav-locale-opt current" } else { "nav-locale-opt" }, onclick: move |_| locale_open.set(false), "繁體中文" } }
                        }
                    }
                    a { href: "{locale_to_book_path(locale.as_str())}/book/", class: "nav-cta nav-docs-link", target: "_blank", rel: "noopener noreferrer", { t!("nav-open-docs") } }
                }
            }
        }
    }
}

#[component]
pub fn LandingFooter(#[props(into)] locale: String) -> Element {
    rsx! {
        footer { class: "landing-footer", role: "contentinfo",
            div { class: "landing-footer-inner",
                div { class: "footer-grid",
                    div { class: "footer-brand",
                        img { src: "icon-192.png", alt: "", class: "brand-mark-img", width: "48", height: "48" }
                        div {
                            p { class: "footer-brand-title", { t!("brand-title") } }
                            p { class: "footer-brand-desc", { t!("brand-tagline") } }
                        }
                    }
                    nav { class: "footer-col", "aria-label": "Products",
                        h3 { class: "footer-col-title", { t!("footer-products") } }
                        ul { class: "footer-links",
                            li { a { href: "#features", { t!("nav-features") } } }
                            li { a { href: "#who", { t!("nav-who") } } }
                            li { a { href: "#origin", { t!("nav-origin") } } }
                            li { a { href: "#how", { t!("footer-how-works") } } }
                            li { a { href: "#setup", { t!("nav-setup") } } }
                            li { a { href: "#quickstart", { t!("nav-quickstart") } } }
                            li { a { href: "#pricing", { t!("nav-pricing") } } }
                            li { a { href: "#faq", { t!("nav-faq") } } }
                        }
                    }
                    nav { class: "footer-col", "aria-label": "Resources",
                        h3 { class: "footer-col-title", { t!("footer-resources") } }
                        ul { class: "footer-links",
                            li { a { href: "{locale_to_book_path(locale.as_str())}/book/", class: "nav-docs-link", target: "_blank", rel: "noopener noreferrer", "Docs" } }
                            li { a { href: "https://github.com/wchklaus97/claw-core", target: "_blank", rel: "noopener", "GitHub" } }
                            li { a { href: "https://github.com/wchklaus97/claw-core/issues", target: "_blank", rel: "noopener", "Issues" } }
                        }
                    }
                    nav { class: "footer-col", "aria-label": "Legal",
                        h3 { class: "footer-col-title", { t!("footer-legal") } }
                        ul { class: "footer-links",
                            li { Link { to: route_for_privacy(locale.as_str()), { t!("footer-privacy") } } }
                            li { Link { to: route_for_terms(locale.as_str()), { t!("footer-terms") } } }
                            li { a { href: "https://opensource.org/license/mit/", target: "_blank", rel: "noopener", { t!("footer-mit") } } }
                        }
                    }
                }
            }
        }
    }
}
