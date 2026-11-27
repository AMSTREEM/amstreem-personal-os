# Stage 2 — Contracts and Boundaries

Status: implementation in progress on `atlas-stage2-contracts`.

## Implemented

- Shared Zod 4 contract package for module IDs, event envelopes, module manifests, pagination, bootstrap payloads and RFC 9457 Problem Details.
- Eight non-Qur’an module manifests and a CI-enforced dependency boundary check. Feature modules cannot import another module or reach into shell-owned source; the registry and shared module types remain at the module root.
- Explicit request-field registry for all 100 non-Qur’an API routes. Route registration injects strict method/path-specific body, query and path-parameter validation. Unknown fields are rejected; known scalar fields receive type and length checks.
- Dedicated validated backup-envelope and legacy-import request handling.
- `/api/v1` aliases for non-Qur’an endpoints while retaining existing `/api` compatibility. Qur’an reader routes remain excluded and unversioned.
- Standardized `application/problem+json` handling for API validation, authentication, authorization, rate limits, conflicts, not-found, parser and unexpected errors, with request IDs.
- `GET /api/v1/bootstrap` validates against the shared bootstrap response schema; the web auth provider now hydrates from this endpoint.
- Shared success-response shape validation is applied to every non-Qur’an API JSON response; bootstrap additionally has a strict field-level response schema.
- Tests cover request strictness, import payloads, response shape, Qur’an isolation and one-to-one route-to-contract registration.

## Remaining before Stage 2 sign-off

1. Complete full CI verification on the final branch head.
2. Merge to `atlas-next`, deploy staging only, and run authenticated staging QA for v1 aliases, bootstrap, validation failures, response shape and Problem Details content types.
3. Verify no regressions in existing app flows and that the Qur’an reader remains unchanged.

## Protected scope

The Qur’an reader, Tajweed rendering, Qur’an fonts, recitation, and the existing `/api/quran/*` route implementation are outside Stage 2. No production branch or production Supabase project is to be modified.

## Release boundary

Changes are developed on `atlas-stage2-contracts`, reviewed into `atlas-next`, and tested on staging. Production branch `audit-and-hardening` and production Supabase remain untouched.
