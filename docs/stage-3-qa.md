# Stage 3 — Design language and shell

## Implementation delivered to `atlas-next`

- Semantic Atlas tokens for the exact dark/light neutral, brand, semantic and nine module accent tables in Architecture v2.
- Dark (default), light and system theme initialization before first paint; per-device high contrast and system/reduced/full motion preferences.
- Self-hosted Inter Variable, shared typography/spacing/radius/depth tokens, module header ambience and shared spring/duration presets.
- Responsive shell: 264 px desktop sidebar, 72 px tablet rail/overlay, 52 px phone top bar, 64 px phone dock plus safe area, and 1200 px content ceiling.
- Shared active-navigation pill across desktop and phone; phone More launcher shows all nine modules; three phone destinations can be changed and persist per device.
- Phone search entry, keyboard command palette, phone quick-capture bottom sheet, and offline capture queue.
- First-run onboarding, guided tour, and user-approved PWA update flow; updates do not auto-reload while a person is editing.
- PWA theme metadata, standalone manifest, hashed-asset/font caching and API/Qur’an cache exclusions.
- Shell accessibility contracts: landmarks, skip link, live region, keyboard-operable dialogs, focus restoration/trapping, 44 px navigation targets and 16 px form controls.

## Qur’an protection

The Qur’an reader source files retain the Stage 2 byte-for-byte fingerprints enforced in `test/design-system.test.js`. The reader route receives `atlas-quran-shell`; Atlas token and shell styling is scoped to `atlas-standard-shell`. No reader source file was changed in Stage 3.

## Automated release gates

The staging build runs TypeScript, the full Node test suite, npm audit, Vite production build and bundle-budget checks. Module accent contrast is tested at WCAG AA text contrast in both theme contexts. The exact run result and deployed commit are recorded in the staging deployment logs.

## Manual release gates still required

These require a signed-in browser/device session and cannot be honestly certified by source tests alone:

1. Capture and compare the Qur’an reader at 390 × 844 (dark and light), 768 × 1024 (dark and light), and 1440 × 900 (dark and light), with the same account, surah/page, settings and device scale. The reader content must show zero visual difference.
2. Complete a VoiceOver pass on iOS and macOS for navigation, command palette, capture, onboarding, dialogs and settings.
3. Install the staging PWA on iOS, test safe-area/keyboard behaviour, then verify an update is user-approved and never interrupts an unsaved edit.
4. Check 200% text scaling and keyboard-only operation on the key shell screens.

**Release status:** implementation is staged; production promotion remains blocked until the manual gates above are checked. Production has not been modified.
