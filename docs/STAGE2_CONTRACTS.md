# Stage 2 — Contracts and Boundaries

Status: **complete**. Merged into `atlas-next`, deployed to `amstreem-atlas-staging`, and passed authenticated staging QA on 2026-11-27.

## Delivered

- Shared Zod 4 schemas for module IDs/manifests, event envelopes, idempotency keys, pagination, bootstrap responses, JSON success-response shape and RFC 9457 Problem Details.
- Eight non-Qur’an module manifests and CI-enforced dependency boundaries.
- Explicit method/path-specific request-field contracts for all 100 non-Qur’an API routes. Request bodies, query parameters and path parameters are validated before route handlers; unknown fields are rejected and supported scalar fields are type-checked.
- Dedicated validation for checksummed and legacy backup imports.
- `/api/v1` aliases for non-Qur’an API endpoints while preserving existing `/api` compatibility. Qur’an reader endpoints remain unversioned and excluded.
- Request IDs and `application/problem+json` for API validation, authentication, authorization, rate limits, conflicts, not-found, parser and unexpected errors.
- Authenticated bootstrap endpoint with strict shared response schema; the web auth provider hydrates through `/api/v1/bootstrap`.
- Shared JSON success-response shape validation for non-Qur’an API responses.
- CI checks for route-to-contract completeness, strict request validation, response contracts, module boundaries and Qur’an/Tajweed file protection.

## Verification

Both repository CI workflows passed on the merged Stage 2 changes. Render staging deployment reached `live` and the service started successfully.

Authenticated staging QA passed all nine checks:

| Check | Result |
|---|---|
| Health endpoint | PASS |
| Readiness endpoint | PASS |
| Bootstrap endpoint | PASS |
| Legacy `/api/session` compatibility | PASS |
| Versioned `/api/v1/session` | PASS |
| Unknown request body field rejected | PASS |
| Unknown query field rejected | PASS |
| Existing unversioned Qur’an endpoint works | PASS |
| Versioned Qur’an endpoint remains excluded | PASS |

## Protected scope

The Qur’an reader, Tajweed rendering, Qur’an fonts, recitation and existing `/api/quran/*` route implementation remain outside Stage 2. No production branch or production Supabase project was modified.

## Release boundary

Stage 2 is merged into `atlas-next` and live on staging. Production branch `audit-and-hardening` and production Supabase remain untouched. Stage 2 is signed off; subsequent architecture work should begin as a separate stage/branch.
