# Student Value 1.984

Work in this existing repository. Preserve functioning architecture. Product requirements and direct user instructions take precedence over older reports and design proposals.

## Academic truth

Source hierarchy: official document or ledger; literal teacher statement in a transcript; explicit headman confirmation; interpretation; unknown. Repository code, seed, database rows, AI output and previous agent reports are audit objects, never primary academic evidence.

Never invent deadlines, names, rooms, variants, assignment issuance, required software, acceptance, or admission rules. Keep missing values null or UNVERIFIED. Curriculum existence does not mean a task was assigned. An available ModelSim lecture or Optgr.m file does not establish mandatory use. Read the academic corpus and linked Drive materials only; never relocate or edit them for app convenience.

A SourceReference must identify the actual relevant source and fact. Do not borrow a source from another course. Preserve uncertainty and conflicting teacher candidates. A teacher relation without evidence must not be shown as documentarily confirmed.

## Database safety

Before major work create a Git checkpoint and a safe PostgreSQL backup. Never run migrate reset, dropdb, destructive db push, mass deletion of real data, rm -rf, git reset --hard or git clean without explicit separate user approval. Prefer audited deactivation or archival of doubtful data. Identify test artifacts by exact evidence, not name prefixes alone.

All schema changes require saved migrations, verified on a separate fresh database. Do not edit applied migrations. Data repair is separate, explicit, idempotent and audited. Seed is create-only: it never resets real progress, XP, achievements, membership links, deadlines or existing academic facts. Bootstrap includes no privileged login or demo student.

## Authentication and authorization

Dev authentication is enabled only when NODE_ENV is exactly development AND ALLOW_DEV_AUTH is exactly true. No default user. Never bypass this policy in a production build or runtime. Google OAuth is not implemented; do not call the session reader a complete production login.

Enforce scope on the server: current group, course offering, task publication and explicit audience. Missing TaskAudience grants no access. Resolve subgroup/individual recipients from Enrollment, never from caller-supplied identity. Apply the same visibility to direct URLs, mutations, search and calendar export. Do not serialize private Enrollment fields unless the viewer has view_private_member_identity and the screen needs them.

## Progress and deadlines

Task lifecycle and personal progress are separate. Users cannot accept their own work, including a headman with verification permission. ACCEPTED requires an independent actor, timestamps, method and a confirmed source tied to that student's task result. Headman recording a teacher statement differs from direct teacher confirmation. Ownership is not teacher authority. Never count incomplete acceptance as trusted analytics. Saving private notes must preserve verification.

A personal variant requires an explicit confirmed assignment and source. Never fall back to the first variant.

All deadline arithmetic uses Europe/Moscow regardless of host timezone. Date-only deadlines end at 23:59:59.999 Moscow time. Changing a strict deadline's day preserves its local time. A reschedule supersedes the old record, creates a linked new one, records evidence and audit, and notifies the actual audience once. No-op changes do not notify. Unknown/unverified deadlines are not student-facing academic facts.

## Tests

Tests MUST use a separate local studentvalue_test_* PostgreSQL database. scripts/test-db.mjs and the runtime guard enforce this. Never point E2E at an existing app on port 3000. E2E starts its own server/build directory with isolated fixtures and verifies the working database stayed unchanged. Test fixtures are separate from academic bootstrap. No production-mode test-auth backdoor is allowed.

Run typecheck, lint, unit/integration tests, isolated critical E2E, migration reproducibility and production build/auth checks for core changes. Failed checks are not verification. Report limitations explicitly.

## UX and scope

The product helps students understand what to do now, nearby deadlines, changes, progress and course materials. Use natural Russian, calm navy/blue styling, usable desktop and mobile layouts. Keep administrative details secondary. Preserve adaptive sections and avoid giant components. The reliable-core phase is complete. The daily UX phase may change information architecture, navigation, layout and visual design. Keep OAuth, Calendar API, Telegram and new AI ingestion out of this phase. Never claim a simulated integration works. Highlight untrusted text with React nodes, never unsafe HTML.


## Daily student interface

Primary navigation is Сегодня / Предметы / Сроки, with a persistent bottom bar on phones. Group tools and administration are secondary. The daily page prioritizes an actionable near-term submission or current work, keeps old overdue dates visible without making them the permanent focus, and distinguishes self-reported work from trusted acceptance. Do not infer that an empty application means no assignment was issued in class. Explain missing dates, materials and personal variants honestly.

Use the navy shell, cold light work surfaces, blue actions and restrained burgundy accents; the abstract fluid mark is code-native SVG. Avoid neon, glow, graduation-cap imagery, giant coefficient tiles and repeated dashboard card grids. Inspect actual browser output on desktop and mobile after substantial layout changes. Read-only screenshots of real local data are separate from isolated E2E fixtures; do not change real progress for presentation.
