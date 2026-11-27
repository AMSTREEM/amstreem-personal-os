# Frozen theme values and reader-facing variables

Baseline commit: `0c41e0f797c472a23af6c982ed992133330ec28f`.

The reader consumes the legacy `data-theme` attribute and existing custom properties. A new theme system must use `data-a-theme` and mirror a supported legacy `data-theme` value and `color-scheme`; do not replace the reader's legacy mechanism.

## Existing explicit theme selectors and variables

- Selector: `:root[data-theme="nocturnal-amethyst"]`\n  - Variables: 
- Selector: `:root[data-theme="abyssal-trench"]`\n  - Variables: 
- Selector: `:root[data-theme="whispering-woods"]`\n  - Variables: 
- Selector: `:root[data-theme="crimson-velvet"]`\n  - Variables: 
- Selector: `:root[data-theme^="light-"]`\n  - Variables: 
- Selector: `:root[data-theme="light-sandstone"]`\n  - Variables: 
- Selector: `:root[data-theme="light-sage"]`\n  - Variables: 
- Selector: `:root[data-theme="light-lavender"]`\n  - Variables: 
- Selector: `:root[data-theme="light-sky"]`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] body`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .field-input`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .topbar`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .auth-visual`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .auth-message-block h1`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .auth-message-block p,.auth-footnote`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .auth-brand`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .auth-brand b`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .auth-panel`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .field__label`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .nav-link:hover`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .profile-trigger:hover`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .profile-popover`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .calendar-cell`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .calendar-cell--active`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .button--primary`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .auth-panel h2`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .auth-subtitle,.auth-legal`\n  - Variables: 
- Selector: `:root[data-theme="shadowed-alchemist"]`\n  - Variables: 
- Selector: `:root[data-theme="nocturnal-amethyst"]`\n  - Variables: 
- Selector: `:root[data-theme="abyssal-trench"]`\n  - Variables: 
- Selector: `:root[data-theme="whispering-woods"]`\n  - Variables: 
- Selector: `:root[data-theme="crimson-velvet"]`\n  - Variables: 
- Selector: `:root[data-theme="light-porcelain"]`\n  - Variables: 
- Selector: `:root[data-theme="light-sandstone"]`\n  - Variables: 
- Selector: `:root[data-theme="light-sage"]`\n  - Variables: 
- Selector: `:root[data-theme="light-lavender"]`\n  - Variables: 
- Selector: `:root[data-theme="light-sky"]`\n  - Variables: 
- Selector: `:root[data-theme^="light-"]`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .brand-symbol`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .brand-symbol`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .auth-brand img,
:root[data-theme^="light-"] .auth-mobile-brand img,
:root[data-theme^="light-"] .brand-symbol-wrap img`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .button--primary`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .nav-link--active`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .topbar`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .surface-card,
:root[data-theme^="light-"] .profile-popover`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .tour-launcher`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .atlas-tour`\n  - Variables: 
- Selector: `:root[data-theme^="light-"]`\n  - Variables: 
- Selector: `:root[data-theme^="light-"]`\n  - Variables: 
- Selector: `:root[data-theme^="light-"]`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"])`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .daily-rhythm-sanctuary .card,
:root[data-theme^="light-"] .daily-rhythm-sanctuary .surface-card`\n  - Variables: 
- Selector: `:root[data-theme^="light-"]`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .atlas-card`\n  - Variables: 
- Selector: `:root[data-theme^="light-"] .atlas-card:hover`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .atlas-spatial-tilt__foil`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-silent`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-madd-normal,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-madd`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-madd-permissible`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-madd-obligatory,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-madd-wajib`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-madd-necessary`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-qalqalah`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-ikhfa,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-ikhfa-shafawi,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-iqlab,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-idgham-shafawi,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-idgham-ghunnah,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-idgham-no-ghunnah,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-idgham-mutajanisayn,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-idgham-mutaqaribayn,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-idgham,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-ghunnah`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-tafkhim,
:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-heavy`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-madd-obligatory`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-madd-obligatory-connected`\n  - Variables: 
- Selector: `:root:not([data-theme^="light-"]) .quran-mobile-shell .tj-madd-obligatory-separated`\n  - Variables: 

## Wildcard and fallback selectors

- `:root[data-theme^="light-"]` and related descendants select all light themes.
- `:root:not([data-theme^="light-"])` selects the legacy dark family.
- `:root` defines shared defaults before theme-specific overrides.

The stylesheet hash is authoritative; this inventory is a human-readable audit index.
