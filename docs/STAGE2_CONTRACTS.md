# Stage 2 — Contracts and Boundaries

Status: in progress on `atlas-stage2-contracts`.

## Implemented foundation

- Shared Zod 4 contract module at `packages/contracts`.
- Strict schemas for module IDs, module manifests, event envelopes, idempotency keys, cursor pagination and RFC 9457 problem details.
- Eight non-Qur'an module manifests in the web layer.
- A dependency-boundary checker for module-to-module imports.
- Contract tests for strictness and core envelopes.

## Remaining Stage 2 work

1. Register a strict request schema for every non-Qur'an API route and validate path, query and body inputs before handlers execute.
2. Convert all API errors to `application/problem+json`, including authentication, rate limits, validation, conflicts and unexpected failures.
3. Mount `/api/v1` aliases for non-Qur'an routes while preserving the existing `/api` paths; Qur'an endpoints retain their current paths and behaviour.
4. Add `GET /api/v1/bootstrap` with a shared response schema and move the web client to it where appropriate.
5. Enforce module dependency rules in CI and prove that every API route is covered by a contract.
6. Run the full CI suite and staging QA before marking the stage complete.

## Protected scope

No Qur'an reader, Tajweed, Qur'an font, recitation, route implementation or faith-record code is to be changed as part of this stage. The Qur'an route remains shell-owned and outside the eight-module registry.

## Release boundary

Changes are developed on `atlas-stage2-contracts`, reviewed into `atlas-next`, and tested on staging. Production branch `audit-and-hardening` and production Supabase remain untouched.
