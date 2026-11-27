# Qur’an reader visual baseline — Stage 3

Recorded from `atlas-next` before the Stage 3 token and shell rollout.

## Protected source fingerprints

These Git blob hashes are enforced by `test/design-system.test.js`. A change to any of these files fails the test suite.

| File | Baseline Git blob SHA |
|---|---|
| `client/src/components/QuranMushafReader.tsx` | `c8c4dee0592ed52b1867d58cd0d6b365fb213662` |
| `client/src/pages/QuranPage.tsx` | `275c9c75d00c79c46be680e9270539100ebcab6f` |
| `client/src/data/quranSurahs.ts` | `9f487f164568aec386aac208f073708c8e3e7995` |

The existing CI path guard remains in place as a second protection layer.

## Reader-owned CSS contract

The reader's global stylesheet currently reads these legacy custom properties. The Stage 3 design system must not redefine them or target the reader's selectors.

```text
--accent
--accent-strong
--bg
--bg-canvas
--bg-surface
--border-hairline
--mushaf-user-font-size
--muted
--text
--text-primary
--text-secondary
```

The reader's source-level class inventory covers 94 classes across the desktop Mushaf, mobile reader, Tajweed guide and navigation controls. The complete inventory is retained in the baseline test metadata and is guarded by the source hashes above.

## Visual capture matrix

The source fingerprint and CSS contract are recorded. Pixel screenshots still need to be captured in a signed-in browser session before the Stage 3 production promotion gate:

| View | Appearance | State |
|---|---|---|
| iPhone-sized viewport (390 × 844) | Dark | Capture baseline required |
| iPhone-sized viewport (390 × 844) | Light | Capture baseline required |
| Desktop (1440 × 900) | Dark | Capture baseline required |
| Desktop (1440 × 900) | Light | Capture baseline required |
| Tablet (768 × 1024) | Dark and light | Capture baseline required |

The comparison must use the same account, same reader settings, same surah/page and same browser/device scale. A zero-difference result is required for the reader content. Shell-only changes may alter the outer navigation frame, but not the reader's own content, fonts, Tajweed colours, reading controls or scroll position.
