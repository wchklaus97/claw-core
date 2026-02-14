//! Route enum and route components for path-based locale: /en, /zh-Hans, /zh-Hant
//! Legal pages: /en/privacy, /zh-Hans/privacy, /zh-Hant/privacy, /en/terms, etc.
use dioxus::prelude::*;

use crate::{PrivacyPolicyPage, TermsOfUsePage};

#[derive(Clone, Debug, PartialEq, Routable)]
pub(crate) enum Route {
    #[route("/")]
    Home,
    #[route("/en")]
    En,
    #[route("/zh-Hans")]
    ZhHans,
    #[route("/zh-Hant")]
    ZhHant,
    /// Docs (mdBook) live at /book/ — full-page nav so server can serve static files.
    #[route("/book")]
    Book,
    #[route("/book/")]
    BookSlash,
    #[route("/book/:..path")]
    BookSubpath { path: Vec<String> },
    // Privacy Policy
    #[route("/en/privacy")]
    EnPrivacy,
    #[route("/zh-Hans/privacy")]
    ZhHansPrivacy,
    #[route("/zh-Hant/privacy")]
    ZhHantPrivacy,
    // Terms of Service
    #[route("/en/terms")]
    EnTerms,
    #[route("/zh-Hans/terms")]
    ZhHansTerms,
    #[route("/zh-Hant/terms")]
    ZhHantTerms,
}

#[component]
fn Home() -> Element {
    use_effect(move || {
        if let Some(window) = web_sys::window() {
            let _ = window.location().set_pathname("/en");
        }
    });
    rsx! { div { class: "landing-page", "Loading…" } }
}

#[component]
fn En() -> Element {
    rsx! { super::Landing { locale: "en" } }
}

#[component]
fn ZhHans() -> Element {
    rsx! { super::Landing { locale: "zh-CN" } }
}

#[component]
fn ZhHant() -> Element {
    rsx! { super::Landing { locale: "zh-TW" } }
}

#[component]
fn Book() -> Element {
    rsx! { super::BookRedirect {} }
}

#[component]
fn BookSlash() -> Element {
    rsx! { super::BookRedirect {} }
}

#[component]
fn BookSubpath(path: Vec<String>) -> Element {
    rsx! { super::BookRedirect {} }
}

#[component]
fn EnPrivacy() -> Element {
    rsx! { PrivacyPolicyPage { locale: String::from("en") } }
}

#[component]
fn ZhHansPrivacy() -> Element {
    rsx! { PrivacyPolicyPage { locale: String::from("zh-CN") } }
}

#[component]
fn ZhHantPrivacy() -> Element {
    rsx! { PrivacyPolicyPage { locale: String::from("zh-TW") } }
}

#[component]
fn EnTerms() -> Element {
    rsx! { TermsOfUsePage { locale: String::from("en") } }
}

#[component]
fn ZhHansTerms() -> Element {
    rsx! { TermsOfUsePage { locale: String::from("zh-CN") } }
}

#[component]
fn ZhHantTerms() -> Element {
    rsx! { TermsOfUsePage { locale: String::from("zh-TW") } }
}
