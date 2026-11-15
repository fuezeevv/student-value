# Student Value 1.984

## Companion phase, authorized 15 November 2026

The owner now requests the frameless mobile Flow concept, university personal-service integrations and preparation for Russian hosting. This supersedes the older Vercel/Neon-only target; it does not authorize payment. Do not claim a server migration or background university sync from code readiness or the owner's browser login. Paid resources still require separate explicit approval. Google Calendar/login and academic permissions remain intact.

The authenticated my.spbstu.ru portal was inspected through the owner's browser: recordbook, study plan, directory and messenger exist. Do not extract/reuse the browser cookie jar or store the owner's master university password. The current companion implementation supports user-selected local recordbook/study-plan copies, not an authenticated university API connection. Keep these private, device-local, separated by Student Value user, excluded from XP/teacher acceptance, and clear the current copy through the profile logout control. General institutional links are not completed integrations. Do not publish personal portal data or use real marks as fixtures.

Work in this existing repository. Preserve functioning architecture. Product requirements and direct user instructions take precedence over older reports and design proposals.

## Academic truth

Source hierarchy: official document or ledger; literal teacher statement in a transcript; explicit headman confirmation; interpretation; unknown. Repository code, seed, database rows, AI output and previous agent reports are audit objects, never primary academic evidence.

Never invent deadlines, names, rooms, variants, assignment issuance, required software, acceptance, or admission rules. Keep missing values null or UNVERIFIED. Curriculum existence does not mean a task was assigned. An available ModelSim lecture or Optgr.m file does not establish mandatory use. Read the academic corpus and linked Drive materials only; never relocate or edit them for app convenience.

A SourceReference must identify the actual relevant source and fact. Do not borrow a source from another course. Preserve uncertainty and conflicting teacher candidates. A teacher relation without evidence must not be shown as documentarily confirmed.

## Database safety

Before major work create a Git checkpoint and a safe PostgreSQL backup. Never run migrate reset, dropdb, destructive db push, mass deletion of real data, rm -rf, git reset --hard or git clean without explicit separate user approval. Prefer audited deactivation or archival of doubtful data. Identify test artifacts by exact evidence, not name prefixes alone.

All schema changes require saved migrations, verified on a separate fresh database. Do not edit applied migrations. Data repair is separate, explicit, idempotent and audited. Seed is create-only: it never resets real progress, XP, achievements, membership links, deadlines or existing academic facts. Bootstrap includes no privileged login or demo student.

## Authentication and authorization

Dev authentication is enabled only when NODE_ENV is exactly development AND ALLOW_DEV_AUTH is exactly true. No default user. Never bypass this policy in a production build or runtime. Google OAuth uses real signed ID tokens, PKCE, state/nonce and recipient-bound one-time enrollment invitations. It stays unavailable until the owner configures the Google Cloud client. Never merge by matching display name/email; issue no session before the enrollment transaction succeeds.

Enforce scope on the server: current group, course offering, task publication and explicit audience. Missing TaskAudience grants no access. Resolve subgroup/individual recipients from Enrollment, never from caller-supplied identity. Apply the same visibility to direct URLs, mutations, search and calendar export. Do not serialize private Enrollment fields unless the viewer has view_private_member_identity and the screen needs them.

## Progress and deadlines

Task lifecycle and personal progress are separate. Users cannot accept their own work, including a headman with verification permission. ACCEPTED requires an independent actor, timestamps, method and a confirmed source tied to that student's task result. Headman recording a teacher statement differs from direct teacher confirmation. Ownership is not teacher authority. Never count incomplete acceptance as trusted analytics. Saving private notes must preserve verification.

A personal variant requires an explicit confirmed assignment and source. Never fall back to the first variant.

All deadline arithmetic uses Europe/Moscow regardless of host timezone. Date-only deadlines end at 23:59:59.999 Moscow time. Changing a strict deadline's day preserves its local time. A reschedule supersedes the old record, creates a linked new one, records evidence and audit, and notifies the actual audience once. No-op changes do not notify. Unknown/unverified deadlines are not student-facing academic facts.

## Tests

Tests MUST use a separate local studentvalue_test_* PostgreSQL database. scripts/test-db.mjs and the runtime guard enforce this. Never point E2E at an existing app on port 3000. E2E starts its own server/build directory with isolated fixtures and verifies the working database stayed unchanged. Test fixtures are separate from academic bootstrap. No production-mode test-auth backdoor is allowed.

Run typecheck, lint, unit/integration tests, isolated critical E2E, migration reproducibility and production build/auth checks for core changes. Failed checks are not verification. Report limitations explicitly.

## UX and scope

The product helps students understand what to do now, nearby deadlines, changes, progress and course materials. Use natural Russian, calm navy/blue styling, usable desktop and mobile layouts. Keep administrative details secondary. Preserve adaptive sections and avoid giant components. The reliable-core phase is complete. The daily UX phase may change information architecture, navigation, layout and visual design. The current authorized phase adds independent groups, lessons, structured proposals, contextual search and personal Google Calendar. Telegram and uncontrolled AI publishing remain out of scope. Never claim a simulated integration works. Highlight untrusted text with React nodes, never unsafe HTML.


## Daily student interface

Primary navigation is Сегодня / Предметы / Сроки, with a persistent bottom bar on phones. Group tools and administration are secondary. The daily page prioritizes an actionable near-term submission or current work, keeps old overdue dates visible without making them the permanent focus, and distinguishes self-reported work from trusted acceptance. Do not infer that an empty application means no assignment was issued in class. Explain missing dates, materials and personal variants honestly.

Use the navy shell, cold light work surfaces, blue actions and restrained burgundy accents; the abstract fluid mark is code-native SVG. Avoid neon, glow, graduation-cap imagery, giant coefficient tiles and repeated dashboard card grids. Inspect actual browser output on desktop and mobile after substantial layout changes. Read-only screenshots of real local data are separate from isolated E2E fixtures; do not change real progress for presentation.


## Production deployment

Target domain is studentvalue1984.eu.cc. The owner selected Vercel Hobby + Neon Free, both in Frankfurt. Do not create paid resources or upgrade without separate explicit consent. render.yaml has been retired. Production login with Google OAuth and explicit student identity binding is now part of the authorized launch scope; Personal Google Calendar is now authorized as a separate-consent integration; Telegram and uncontrolled AI ingestion remain deferred. Never treat a localhost preview or a successful local build as a deployed site. Keep production login closed until a real session issuer and student identity binding are implemented; do not replace them with shared passwords, seeded owners or user-id cookies.

Use pinned Node from .node-version and npm ci. Production build must not mutate/connect to the academic DB, migrate deploy runs separately before release using a matching direct Neon endpoint. Vercel uses scripts/vercel-build.mjs and validates each server instance with src/instrumentation.ts; the lazy Prisma client also validates before initialization. scripts/production-start.mjs remains the portable Node entrypoint. Vercel previews and automatic Git deployments are disabled; release only a checked commit after migrations and smoke tests. Do not automatically seed or restore a local development dump into production. Secrets belong in provider environment/secret storage, never Git, logs or chat. Keep deployment checks isolated; CI never receives production DB credentials. Vercel must package only traced production code; verify the actual function artifact after account access. Never deploy .env, fixtures, dumps, browser/test tooling or .test-work. PostCSS/deepmerge-ts overrides are security fixes: removing them requires an audit and compatibility checks. Paid plans, external uploads, DNS and credentials remain explicit owner-controlled steps.

Production is live as of 2026-10-17: real Google login preserves the existing owner's enrollment, group ownership and progress; no global admin or LOCAL_DEV identity was imported. The reviewed initial data transfer is create-only, digest-bound and audited; never rerun bootstrap/dev restore against this populated database. New student invitations require an explicit Enrollment and recipient Google email. Never create production test users, forged identities or manual test sessions to simulate cloud auth checks. Real second-student login and scheduled independent backups remain separate launch follow-ups; manual encrypted snapshots are not an automated backup service.


## Group learning context

Platform ownership is separate from academic permissions and never grants access to private student notes or another group's roster/content. One mutable CourseOffering belongs to one group. Selected-group cookies must be resolved against active enrolled memberships. Existing Google identities may join another explicitly invited group without duplicate profiles or automatic ownership. Headman invitations must bind group + recipient + privileged intent; a reissue cannot change the recipient.

Student proposals and literal transcript cues are unconfirmed until an authorized human review. Publication and proposal status change must be atomic and once-only. Preserve exact quote/version links and previous summaries/task text/deadlines. Cross-group briefs are explicitly shared snapshots; applicability always requires local confirmation. Never manufacture production groups, lessons, transcripts or OAuth sessions for demonstration or testing.

Personal Calendar uses separate, current-user-bound consent with only calendar.app.created. Never widen normal sign-in scopes or request access to primary calendars. Persist refresh credentials only as authenticated ciphertext under a separate production key; no secrets in UI/audit/logs. Personal event IDs are stable per user/task; academic mutations queue dirty versions in the same transaction. Google errors, partial passes and ambiguous calendar creation never become SYNCED. Real consent and Google readback are required to claim a live integration; test transport assertions are not cloud proof. Vercel Hobby daily cron is the fallback, no paid worker/service account. Group audit must redact private studentNotes and credentials, including legacy nested snapshots; independent verification must not copy private notes into audit.

The owner's real Calendar consent and Google Calendar API were enabled on 2026-10-17. Provider readback verified one secondary calendar and six existing deadlines, stable IDs, private events, reminders and no private notes; academic tables remained unchanged. The ambiguous initial calendar creation was recovered through the normal marker-verified production form, not a duplicate creation or manual DB patch. At initial release Google OAuth was External/Testing. On 2026-11-02 the owner connection was observed REAUTH_REQUIRED since 2026-10-25, last successful sync 2026-10-24; current Google publishing status is not verified. Do not infer an active grant or SYNCED from old release proofs. Never delete or recreate this real calendar as a test.

Later on 2026-11-02 the existing owner connection was observed ACTIVE again. Fresh Google API readback at 00:16 UTC verified seven current events against the scoped desired bodies, reminders, dates and stable IDs; requested/synced versions matched. This is a point-in-time proof, not a guarantee of future authorization. Both architecture task records now have live Calendar events: the unused-duplicate repair correctly refused archival and remains deferred; do not bypass that guard or silently delete the Google event.

## Confirmed context corrections, 2026-11-02

The owner explicitly confirmed that САПР and «Системный анализ и принятие решений» are one subject taught by Sidnev. In СОВД Semenov teaches lectures and Kadrgulov teaches practice/calculation work. Multiple teachers, groups or teaching formats alone are not conflicting evidence. Academic repair requires exact scoped checks, retained original records, sourced role confirmation, unchanged personal progress and audit; see docs/ACADEMIC_RECONCILIATION.md. Archived aliases must not become edit targets or bypass target audience checks. Google Sheets as an editorial surface with human publication, independent readable copies, daily schedule and theory practice are authorized directions; do not claim unfinished integrations work or automatically publish AI/table drafts as academic truth.

The owner also directed inspection of local Downloads/Documents/Desktop and Telegram/AyuGram download folders. A large academic corpus exists in Documents/Файлы/Политех, Downloads/Telegram Desktop, Downloads/AyuGram Desktop and Downloads/потом разберусь/Транскрипции. Inventory and partial source reading are recorded in the current Codex workspace outputs/student-value-local-materials-2026-11-02.md. This is not a claim that all files were read. Current and historical LabN sets coexist; match document contents, period and DL module before using one as an assigned task. Preserve original files. Personal reports, roster/grades, noisy transcripts and official assignments have different evidentiary roles; do not publish private results or contacts from local ledgers.

## Lesson history, authorized 2026-11-02

The owner requested reconstructing the current semester through today using group 45591's official RUZ schedule, local transcripts, teaching files and DL. The course now opens on a lesson journal; deadlines alone are not its structure. Keep schedule-only gaps distinct from documented content; a timetable is not proof a class happened. Dates on ZIPs and presentation numbers are not class dates. Related/assumed links and generated overviews/guides must remain visibly distinct from teacher originals. Do not turn transcript mentions into verified deadlines, personal variants or acceptance. See docs/LESSON_JOURNAL.md.

The owner explicitly confirmed that Downloads/New Recording 5.txt is from 7 October. It overlaps the existing OTU lecture transcription and is an alternative text, not a second lecture. New Recording 8 and statistics meeting recordings 1–3 remain undated. Do not publish their personal results or assign dates by file modification time. The RUZ link for compilers points to an inaccessible course labelled fourth year; do not substitute it for the group's actual teaching materials.

MaterialFile originals are private database content, served only through group-checked bounded downloads with client integrity checks; never move them into public or Git. Normal course queries must not load file bodies. LessonContext imports are explicit, audited, digest-bound and create-only; refuse edited/conflicting rows. The first snapshot ends 02.11.2026 and is not an automatically updating future schedule. Keep the local working DB unchanged while testing and use only isolated studentvalue_test_* databases.

## Actionable work and four groups, authorized 2026-11-02

The owner explicitly requested student self-completion, per-work XP, optional headman review, a platform-wide account directory, and shared general assignments for headmen of 101/102/201/202. READY means self-reported completion; SUBMITTED retains that completion. Neither is teacher acceptance. ACCEPTED keeps all independent verification and evidence checks. Completion XP uses compensating immutable entries; undo/recheck cannot multiply points. Old progress dates are not fabricated during backfill.

Course pages open on work and its files, with the lesson journal available as a separate tab. Undated assigned work must remain visible. Cancelling a deadline and archiving a task are audited, reversible operations that enqueue Calendar reconciliation and preserve personal results.

Platform owners may view group/account counts and enrollment names across groups; this exception does not grant private-note, Google identity, calendar-token or academic-edit access. Headmen may read opted-in published group-wide work/materials through the separate exchange scope; subgroup/individual tasks and personal results are excluded. Empty groups gain no owner until the recipient-bound Google invitation is redeemed. Original Windows teaching programs are linked from the existing shared course Drive folder, not stored as large objects in Neon or deployed in the application bundle.

## Live timetable and community, authorized 2026-11-04

The owner requested direct use of public RUZ data and a link to the project's Telegram channel https://t.me/studentvalue. A channel link does not authorize Telegram bot login, reading chats, or posting messages. Official RUZ confirms IVT 5130901/40101, /40102, /40201, /40202 and ISiT 5130902/40201–40204. Keep full codes visible where short group names overlap.

Live timetable snapshots are separate from documented ClassSession history. A scheduled pair does not establish attendance, assigned homework, a deadline, or teacher acceptance. Fetch only fixed official HTTPS endpoints (the public timetable page and its API), validate group identity/week/lesson audience, bound response size/time and use a shared lease/cache. Show age and stale/unavailable state explicitly. Send no student identities, notes, progress or Google credentials to RUZ. Test and E2E environments must never call the real timetable API. Source mappings and new empty groups require exact official evidence and audited idempotent operations; no fake enrollments or copied academic data.

## Guest group browsing, authorized 2026-11-04

The owner explicitly requested viewing any of the eight existing groups without Google or an invitation, without XP or completion actions. `/browse` is an anonymous read-only projection, never an account, enrollment, guest user or privileged session. Only the fixed eight officially verified codes are public. Published, active, current-semester tasks need an explicit matching GROUP audience; mixed, subgroup, individual, missing, malformed and ALL_COURSE audiences are excluded from this public projection. The public query explicitly selects general descriptions, confirmed active deadlines and material titles, never personal progress, variants, member identities, source quotations, recordings, transcript bodies, material URLs or file bytes. Original downloads and all authenticated routes/actions retain their existing guards. Public schedule access uses a separate allowlisted entrypoint to the same bounded, validated RUZ cache; it never manufactures a SessionUser. The anonymous root redirects to `/login`, with full sign-in first and guest group selection below; authenticated users still reach their normal workspace. Empty groups stay empty and can show their own public timetable. No browsing action creates user/progress/XP records or grants group membership.


## Login-first entry and live subject catalog, authorized 2026-11-04

The owner corrected the entry order: full Google sign-in is primary; scroll down to choose a guest group on the same entry page. Anonymous `/browse` also shows that entry, and `#groups` links jump directly to the selector. Members retain their normal account. The fixed catalog is configuration for the eight already verified groups, not academic seed data or membership.

Public group pages must show useful actual schedules and subjects even without internal course offerings. Build a read-only subject catalog from the selected group's validated RUZ snapshots for the requested week and the next two weeks (to cover alternating classes and holiday gaps). Preserve source period, fetch ages and partial failures; do not claim a complete semester curriculum. Match internal courses only by exact normalized titles and the explicitly confirmed aliases. Other subjects get scoped read-only RUZ detail routes, not fabricated CourseOffering/Task records. Show teachers by lesson type and retain subgroup notes, scheduled dates and rooms. Public compact timetables show the next teaching day when today has no classes. RUZ timetable metadata never establishes homework issuance, deadlines, attendance, personal results or teacher acceptance. Tests use isolated caches/fixtures and never query the real provider; official-source inspection and visual QA are separate.
