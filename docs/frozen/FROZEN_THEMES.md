# Frozen theme values and reader-facing variables

Baseline commit: `0c41e0f797c472a23af6c982ed992133330ec28f`.

The reader consumes the legacy `data-theme` attribute and existing custom properties. A new theme system must use `data-a-theme` and mirror a supported legacy `data-theme` value and `color-scheme`; do not replace the reader's legacy mechanism.

## Existing explicit theme values

- `abyssal-trench` — --accent, --accent-strong, --accent-wash
- `crimson-velvet` — --accent, --accent-strong, --accent-wash
- `light-lavender` — --accent, --accent-strong, --accent-wash
- `light-porcelain` — --bg, --sidebar, --surface, --surface-raised, --line, --line-soft, --text, --muted, --subtle, --accent, --accent-strong, --accent-wash
- `light-sage` — --accent, --accent-strong, --accent-wash
- `light-sandstone` — --accent, --accent-strong, --accent-wash
- `light-sky` — --accent, --accent-strong, --accent-wash
- `nocturnal-amethyst` — --accent, --accent-strong, --accent-wash
- `shadowed-alchemist` — --accent, --accent-strong, --accent-wash
- `whispering-woods` — --accent, --accent-strong, --accent-wash

## Wildcard and fallback selectors

- `:root[data-theme^="light-"]` and related descendants select all light themes.
- `:root:not([data-theme^="light-"])` selects the legacy dark family.
- `:root` defines shared defaults before theme-specific overrides.

The stylesheet hash is authoritative; this inventory is a human-readable audit index.
