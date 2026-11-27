# Frozen Qur'an CSS audit

Baseline commit: `0c41e0f797c472a23af6c982ed992133330ec28f`.

## Locked stylesheet

`client/src/styles.css` is SHA-256 locked as a whole file. This locks every reader selector, global selector, custom property and theme rule together. Do not edit, reformat, reorder, split or remove rules in it during the v2 migration. Add new styling only in the namespaced design system and scope it to `.atlas-v2`.

## Principal reader selector families

- `.quran-mobile-*`: mobile reading shell, header, page canvas, verse rows, settings, Surah drawer, Tajweed legend and navigation.
- `.quran-desktop-*` / `.mushaf-desktop-*`: desktop reader geometry, controls, page typography and sidebar.
- `.quran-tajweed-*` / `.quran-qcf-*`: Tajweed and QCF rendering.
- `.deen-quran-*` / `.rhythm-quran-*`: faith/rhythm logging surfaces that link to the reader's independent log API.
- `.residence-quran-resume`, `.nav-link--quran`, `.atlas-mobile-dock__quran`: reader entry points.

## Global selectors and layout-sensitive rules

Locked global selectors: *, html, body, button, button:disabled, a, button:focus-visible, input, button:not(:disabled), input:not([type="checkbox"]):not([type="radio"]), select, input:not([type="checkbox"]):not([type="radio"]):focus, input::placeholder, input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, *::-webkit-scrollbar, *::-webkit-scrollbar-track, *::-webkit-scrollbar-thumb, *::-webkit-scrollbar-thumb:hover. The stylesheet also contains viewport sizing, overscroll, reduced-motion, fixed/sticky positioning and safe-area-adjacent rules. These remain byte-identical. New shell ancestors must not introduce transforms, filters, perspective, containment, will-change, backdrop filters or overflow changes around the reader.

## CSS custom properties read by the reader


