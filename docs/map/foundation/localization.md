# Foundation — Localization (AR default / EN)

## Setup

- i18next + react-i18next + browser-languagedetector; persisted in localStorage (`lang`).
- **Arabic is the default** language and the primary demo language (client is Arabic-speaking).
- Locale files: `src/lib/i18n/locales/ar.json`, `en.json`. Nested keys by module:
  `common.*`, `landing.*`, `apply.*`, `track.*`, `admin.nav.*`, `applications.*`, `status.*`,
  `scoring.*`, `interviews.*`, `contracts.*`, `disbursement.*`, `followUp.*`, `reports.*`, `notifications.*`, `validation.*`.

## RTL

- `<html dir>` + `lang` switch on language change (effect in `I18nProvider`).
- Tailwind: use **logical properties** (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`) — never `ml/mr/pl/pr/left/right` for layout.
- Directional icons (chevrons/arrows) flip with `rtl:rotate-180` where semantically needed.
- DataTable, sidebar, sheets must be verified in both directions.

## Fonts

- Arabic: **IBM Plex Sans Arabic** (weights 400/500/600/700).
- English: **Inter** (400/500/600/700).
- Self-host via `@fontsource/ibm-plex-sans-arabic` + `@fontsource-variable/inter` (no CDN flicker).
- `font-family` switches by `:lang()` / html[lang] CSS: `html[lang='ar'] { font-family: 'IBM Plex Sans Arabic', … }`.

## Rules

- Every user-visible string via `t()`. Zod error messages localized through `validation.*` keys
  (pass `t` into schema factory functions: `makeApplySchema(t)`).
- Numbers: keep Western digits (٠١٢ not required); currency `SAR` formatted with `Intl.NumberFormat(locale, {style:'currency', currency:'SAR'})`.
- Dates: `Intl.DateTimeFormat` with active locale.
- `LangSwitch` component in both layouts (portal header + admin sidebar footer).
