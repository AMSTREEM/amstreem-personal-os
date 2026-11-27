# Amstreem backend preparation

This directory contains the initial private-memory schema for the clean-start Amstreem app.

## Status
- Schema is a draft and has **not** been applied to a Supabase project.
- No existing Supabase project has been modified.
- Account registration, login, cloud sync, and memory import are not active yet.
- Never put a Supabase secret/service-role key in browser code.

## Intended behavior
- Every memory belongs to one authenticated user.
- Row Level Security is enabled and all CRUD policies enforce ownership.
- Anonymous users receive no table privileges.
- Existing browser captures must remain local until the signed-in user explicitly chooses to import them.
- Sensitive memories are distinguishable from ordinary captures; the product must request clear consent before retaining sensitive content.

## Blocker
The current Supabase organization has reached its two-active-free-project limit. Create a dedicated clean-start project or make an explicit billing/project-lifecycle decision before applying this schema.
