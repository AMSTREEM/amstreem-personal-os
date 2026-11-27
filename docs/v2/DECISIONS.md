# Atlas v2 — Decision log

| # | Decision | Reason |
|---|---|---|
| D1 | Keep the four-room IA and all routes/redirects | Proven mental model; protects deep links. |
| D2 | Colour = one accent per room; neutral surfaces; 4 themes | Calm, legible, orientation by colour; AA verified. |
| D3 | New `data-a-theme` + mirrored legacy `data-theme` | Lets the frozen reader keep its exact theme CSS. |
| D4 | All new tokens/classes namespaced `--a-*`, `a-*`, `atlas-*` | Makes collisions with frozen CSS impossible. |
| D5 | Per-route `v2` opt-in + containment reset | Incremental migration; legacy and frozen pages untouched. |
| D6 | Hash lock + pixel-diff for the Qur'an | "Never touched" becomes machine-checkable. |
| D7 | Desktop rail + mobile bottom bar with capture FAB | Fast thumb navigation; capture always one tap away; rail shows full IA on large screens. |
| D8 | View Transitions replace "portal" FX | Native, cheap, interruptible; easy to disable on the reader. |
| D9 | Remove cursor aura, tilt cards, shader backdrop | Cost/accessibility/touch conflicts. |
| D10 | shadcn/ui (copy-in) + Radix | Accessible primitives we own; no runtime lock-in. |
| D11 | Query-key factory with frozen aliases | Consistent invalidation without breaking the reader's invalidations. |
| D12 | Keep snapshot persistence; add revision CAS later | Scale safely without a rewrite; v3 stays compatible. |
| D13 | Evidence everywhere (SourceChip/WhyChip), no composite scores | Upholds "evidence before claims". |
| D14 | Time-zone setting (default browser, Lagos for existing) | Removes hard-coded zone risk. |
| D15 | Vite 8 upgrade optional and last | Tooling risk must not threaten gates. |

## Out of scope

Native apps, multi-user/teams, social features, public sharing, AI chat, offline data sync, calendar drag-resize, third-party calendar sync, and any change to the Qur'an reader or its data providers.
