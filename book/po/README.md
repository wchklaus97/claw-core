# Translations (gettext PO)

This directory holds translations for the Claw Core book using [mdbook-i18n-helpers](https://github.com/google/mdbook-i18n-helpers).

- **zh_CN** — 简体中文 (Simplified Chinese)
- **zh_TW** — 繁體中文 (Traditional Chinese)

## One-time setup

```bash
cargo install mdbook-i18n-helpers
# Optional, for creating/updating PO files:
# - GNU gettext (msginit, msgmerge): brew install gettext
# - Or use a PO editor like Poedit (https://poedit.net/)
```

## Extract source strings (English → messages.pot)

From the repo root:

```bash
MDBOOK_OUTPUT='{"xgettext": {}}' mdbook build book -d book/po
# Creates book/po/messages.pot (add po/ to .gitignore if you don’t commit it)
```

## Start a new translation

```bash
msginit -i book/po/messages.pot -l zh_CN -o book/po/zh_CN.po
msginit -i book/po/messages.pot -l zh_TW -o book/po/zh_TW.po
```

Or copy `messages.pot` to `zh_CN.po` / `zh_TW.po` and set the header `Language:` to `zh_CN` or `zh_TW`.

## Update existing PO after source changes

```bash
msgmerge --update book/po/zh_CN.po book/po/messages.pot
msgmerge --update book/po/zh_TW.po book/po/messages.pot
```

## Build a translated book locally

```bash
# English (default)
mdbook build book -d book/book/en

# Simplified Chinese
MDBOOK_BOOK__LANGUAGE=zh_CN mdbook build book -d book/book/zh-CN

# Traditional Chinese
MDBOOK_BOOK__LANGUAGE=zh_TW mdbook build book -d book/book/zh-TW
```

If a language’s `.po` file is missing or empty, that build still runs and shows the original English text until you add translations.
