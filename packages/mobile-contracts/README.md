# Mobile contracts — initial implementation

Pure TypeScript/Zod contract for an explicit v1 public timetable projection. Root tooling resolves the existing pinned Zod dependency; this is not yet registered as an npm workspace and has no separate install/lockfile. No mobile framework dependency is added to the website.

This is **not** an implemented `/api/v1` endpoint or an Expo application. The future server adapter must resolve the requested group through the existing official catalog/allowlist, call the validated RUZ service and explicitly map the permitted public fields. Syntax validation alone does not establish official group identity. Never return raw Prisma/provider objects or manufacture a SessionUser.

FRESH/STALE snapshots carry exactly seven ordered calendar days and source age. UNAVAILABLE/UNCONFIGURED carry no successful empty week. Unknown dates are not classified as free days. Preserve `scheduledEnd`; 90-minute lesson progress is a separate display policy. Occurrence IDs must be deterministic in the adapter, not generated randomly on each read; they are not academic task identities.

Verification from the repository root: `npm test -- tests/mobile-contracts.test.ts`, `npm run typecheck`. Tests use the existing isolated test runner and do not contact RUZ. Continue according to `docs/handoff/ANTIGRAVITY_NATIVE_APP_SPEC_2026-11-16.md`.

The v1 projection is strict and frozen: do not silently add wire fields to an already-distributed v1 client. New versions/capabilities require a separately negotiated projection while the server retains the old shape. This applies to server serialization and client validation alike.
