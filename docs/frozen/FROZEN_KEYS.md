# Frozen Qur'an keys and query invalidations

Baseline commit: `0c41e0f797c472a23af6c982ed992133330ec28f`.

## Reader-local persistence identifiers

- `atlas_mushaf_page_v18_`
- `atlas_hifz_bookmark_v2`
- `atlas_murajaah_bookmark_v2`
- `atlas_mushaf_starred_ayahs_v1`
- `atlas_mushaf_layout_v1`
- `atlas_mushaf_tajweed_v1`
- `atlas_mushaf_transliteration_v1`
- `atlas_mushaf_font_family_v1`
- `atlas_mushaf_font_size_v1`
- `atlas_quran_auto_logged_pages_`

These cache and bookmark identifiers are frozen. Do not rename, migrate, clear or reinterpret them.

## Query keys in `QuranPage.tsx`

- Settings read: `['settings']`
- Deen invalidation after a log: `['deen']`
- Rhythm summary invalidation after a log: `['rhythm-summary']`
- Overview invalidation after a log: `['overview']`

Any future query-key factory must re-export aliases that compare equal to these exact arrays.
