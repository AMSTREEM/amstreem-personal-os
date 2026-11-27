# Amstreem Intelligence & Memory — Foundation

## Product contract
Amstreem memory is user-directed, transparent, editable and removable. A thought is not automatically a memory. No background extraction, profiling, or silent promotion of conversations into long-term memory is permitted.

## Memory record
- `id`: stable record identifier
- `content`: user-authored or explicitly user-confirmed content (1–8,000 characters)
- `kind`: fact, preference, goal, project, experience, or other
- `sensitivity`: ordinary or sensitive, explicitly selected by the user
- `source`: user_created, user_confirmed, or imported
- `consentedAt`: timestamp of the user's explicit save/confirmation
- `createdAt`, `updatedAt`: ISO timestamps

## Storage stages
1. **Local foundation (this branch):** browser-local records, clear provenance, explicit save, edit, delete, search, export. No network sync.
2. **Identity & cloud sync:** only after authentication is in place; use the existing dedicated `amstreem` schema, never unrelated Personal OS/Atlas tables. Enable and verify ownership RLS before connecting.
3. **Intelligence:** connect a server-side model provider only after secrets, request limits, privacy controls, retention and user consent are designed. Never ship provider secrets to the browser.
4. **Agency:** actions begin in prepare-only mode. Execution requires scoped user permission and confirmation for consequential changes.

## Non-goals / safeguards
- No inferred sensitive memories.
- No automatic import of existing browser captures.
- No claim that local records are backed up or synced.
- No use of memory content for advertising.
- Users must be able to inspect, edit, export and delete their records.
- Do not modify the existing Personal OS or Atlas schemas/data as part of this work.

## Deployment
Work on `amstreem/intelligence-memory-foundation`. Do not change the live Render service's branch or build settings in this phase. Review and test before merging or deploying.
