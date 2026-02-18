# Page Templates and Legal Pages

## Overview

Use a page template pattern for consistent layouts on public pages like Privacy Policy and Terms of Service. Adapted from remind-me-pwa.

## Public Page Template

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

## Component Pattern

```rust
#[component]
pub fn PrivacyPolicyPage(locale: String) -> Element {
    i18n().set_language(locale_to_langid(&locale));
    rsx! {
        div { class: "landing-page",
            // Reuse landing header/nav
            main {
                section { class: "public-page-card legal-prose",
                    h1 { { t!("legal-privacy-title") } }
                    p { class: "legal-updated", { t!("legal-privacy-last-updated") } }
                    h2 { { t!("legal-privacy-summary-title") } }
                    // ... sections from i18n
                }
            }
            // Reuse landing footer
        }
    }
}
```

## Legal Content Structure

**Privacy Policy sections**: Summary, Definitions, Introduction, Data Collection, Local Storage, Network Requests, Third-Party Services, Data Retention, Security, Children's Privacy, International Users, Open Source, Changes, Contact

**Terms of Service sections**: Summary, Acceptance, Eligibility, Description, License (MIT), User Responsibilities, Acceptable Use, Data Storage, Intellectual Property, Disclaimer, Limitation of Liability, Termination, Governing Law, Changes, Contact

## CSS Classes

```css
.legal-prose { max-width: 800px; margin: 0 auto; }
.legal-updated { font-size: 0.9em; color: var(--muted); }
.public-page-card { padding: 2rem; border-radius: 12px; }
```

## Rules

- Use i18n for all legal text (`t!()` macro)
- Reuse landing navbar and footer (`LandingHeader`, `LandingFooter`)
- Keep content in semantic HTML (`h2`, `p`, `ul`, `li`)
- Link to GitHub repo, MIT license, Issues
- Do NOT hardcode legal text
- Do NOT create separate navbar/footer for legal pages
- Do NOT use static HTML files when you have Dioxus routes
