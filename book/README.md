# Claw Core — Documentation (mdBook)

This folder is the source for the [mdBook](https://rust-lang.github.io/mdBook/) documentation site deployed to GitHub Pages.

**Languages:** English, 简体中文 (Simplified Chinese), 繁體中文 (Traditional Chinese). Translations live in `po/` (gettext). See `po/README.md` for how to extract strings and update translations.

## Build locally

```bash
# Install mdBook and i18n helpers (one-time)
cargo install mdbook mdbook-i18n-helpers

# Build the book (output in book/book/)
mdbook build book

# Build a specific language
MDBOOK_BOOK__LANGUAGE=zh_CN mdbook build book -d book/book/zh-CN
MDBOOK_BOOK__LANGUAGE=zh_TW mdbook build book -d book/book/zh-TW

# Serve locally (optional)
mdbook serve book
# Then open http://localhost:3000
```

## Structure

- **book.toml** — mdBook config (title, theme, search, gettext preprocessor)
- **src/SUMMARY.md** — Table of contents (chapter list)
- **src/*.md** — Chapter content (introduction, architecture, API, etc.)
- **po/** — Translations (zh_CN.po, zh_TW.po); see `po/README.md`

## Deploy

On push to `main` (when `book/**` or the workflow changes), GitHub Actions builds the book and deploys `book/book/` to GitHub Pages. Enable **Settings → Pages → Source: GitHub Actions**.
