# Atlas v2 baseline capture

The baseline must be captured from the unchanged `atlas-next` application before accepting Phase 0.

## 1. Install the browser once

```bash
npx playwright install chromium
```

## 2. Save an authenticated browser state locally

Use the existing staging URL (it currently tracks `atlas-next`):

```bash
npm run baseline:auth
```

A visible Chromium window opens. Sign in normally in that browser. When the authenticated workspace is visible, return to the terminal and press Enter. The session is saved to `e2e/.auth/user.json`, which is git-ignored. No password is entered into a script or committed.

If staging is later pointed at another unchanged baseline deployment, set `BASELINE_ORIGIN` before running the command.

## 3. Capture the baseline set

```bash
npm run baseline:screenshots
```

The script captures:
- Qur'an: 390×844, 768×1024 and 1440×900 in light and dark.
- Residence: all four theme mappings at all three viewports.
- Today, Actions, Calendar, Growth and Settings: light and dark at all three viewports.

Screenshots are written to `docs/frozen/baseline/`. Review them before committing. Do not capture from `atlas-v2`; these are the unchanged-app reference images.

## Notes

- Override the source URL with `BASELINE_ORIGIN=https://...` if needed.
- Keep `e2e/.auth/user.json` private; it contains a live browser session.
- The capture runner is deliberately manual so a developer can authenticate without sharing credentials with CI or ChatGPT.
