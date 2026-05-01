# Dual Language (EN ⇄ AR) — Implementation Notes

This app now supports English and Arabic with a runtime language switch
in the Topbar (and on the Signup / Signin pages).

## What was added

src/i18n/
├── LanguageContext.jsx   # React context, useT() hook, RTL handling
├── LanguageToggle.jsx    # The EN/ع pill toggle component
├── LanguageToggle.css
├── dictionary.js         # Curated EN -> AR translations for known UI strings
├── autoTranslate.js      # Runtime DOM walker — translates anything not in dict
└── rtl.css               # Right-to-left layout adjustments

src/index.js was wrapped in <LanguageProvider>.
Topbar, Sidemenu, Navbar, Signin and Signup pages explicitly call t().

## How translation works

1. **Static (instant, offline)** — strings in `dictionary.js` are translated
   instantly with no network call. Add more keys there for the highest quality.

2. **Runtime auto-translate (catches everything else, including Supabase data)**
   — when the user switches to Arabic, a MutationObserver walks the DOM and
   sends any English text it finds (including text fetched from Supabase) to
   the free MyMemory translation API. Results are cached in `localStorage`
   so subsequent loads are instant.

3. **Switching back to English** restores the original English from each
   text node — nothing is lost.

## How to mark something as "do not translate"

Add `data-no-translate="true"` to any element. Useful for brand names,
emails, codes, etc. Already applied to the language toggle itself.

## Add a manual translation

Open `src/i18n/dictionary.js` and add a key:

  "Some English string": "النص العربي",

That overrides the auto-translator's API result.

## Notes

- MyMemory API has a generous anonymous quota; for production volume
  consider replacing with Google Translate, DeepL, or a self-hosted
  LibreTranslate. Only the URL in `autoTranslate.js -> ENDPOINT` needs to
  change.
- RTL flips: the `<html dir="rtl">` attribute is set automatically; rules
  in `rtl.css` mirror common layout patterns. If a specific page looks
  off in Arabic, add a selector under `[dir="rtl"]` in that file.
