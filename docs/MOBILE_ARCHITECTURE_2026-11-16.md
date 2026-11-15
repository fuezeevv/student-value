# Mobile application decision — 16 November 2026

Status: architecture selected for a technical proof, not a completed native application. No production, database, APK, signing or hosting changes are authorized by this document itself.

## Current implementation: verified findings

`android/app/src/main/java/cc/eu/studentvalue1984/MainActivity.kt` loads the production website in an Android WebView. Its layout contains a WebView, refresh/error controls; there is no native timetable UI, Room/SQLite academic repository or durable application synchronization queue. `loadApp()` requests the remote `/offline.html` even when offline. Existing browser/service-worker caching may help, but is not a native application's durable offline data model. Google authorization hosts are allowed inside the WebView. `android/app/build.gradle.kts` signs release with the debug signing configuration. These are release blockers for the intended mobile product, not evidence that all existing sessions or website data are broken.

## Decision

Use React Native with Expo development/release builds, native platform views and SQLite. Keep Next.js for the website and the current server/domain implementation. Do not render the website as the mobile application's core UI; do not rewrite the desktop website into React Native Web.

The choice fits the existing TypeScript/React project, enables a shared Android/iOS mobile codebase, and permits native modules where needed. Kotlin/Compose is a strong Android-only option, but would mean a separate UI implementation for a later iOS app. Flutter introduces a separate Dart ecosystem without removing the need for the same API, offline storage and authentication work. Capacitor/TWA would retain the web-rendered core that the owner explicitly rejects. Expo is tooling, not an obligation to buy a cloud build plan: Android builds must be reproducible locally/under controlled CI. Exact compatible stable Expo/RN versions will be pinned together for the proof, with no independent speculative upgrades.

This is an engineering choice, not a guarantee against future changes. Validate the difficult integrations before building all screens.

## Boundaries that prevent expensive rewrites

1. **Mobile UI**: Flow, full timetable, courses, work, profile. Independent navigation, gestures, accessibility and loading/error/empty/offline states. Mobile screens read repositories, never HTML or website component state.
2. **Device data**: versioned SQLite schema; repositories expose saved data immediately, then refresh it. Store group/date/lesson identities, source and fetch timestamps, downloaded work and explicitly saved material metadata. Keep public caches separate from account-specific caches. Bound storage and downloads. The local DB is the UI's reading source; it is not the authority for academic facts.
3. **Sync**: use an outbox with operation UUIDs and durable delivery states. Server-side idempotency must prevent duplicate progress/XP on retries. Updates use server revisions and explicit conflict handling, not device-clock last-write-wins. Offline personal completion is pending until the server confirms it; it cannot confer acceptance or authoritative XP. Never automatically merge competing deadlines, variants, teacher statements or permissions.
4. **Application API**: introduce versioned `/api/v1` route handlers around the existing permission-checked domain operations. Return explicit bounded DTOs, revisions, deletion/archive markers and structured errors. Mobile does not call Next Server Actions, scrape rendered pages, connect to PostgreSQL or import Prisma/server-only modules. Existing web pages keep working during extraction. Add contract tests and retain compatibility for already-installed client versions.
5. **Shared code**: extract pure DTO schemas, academic date arithmetic and safe formatting into small packages. Keep database access, Google secrets, authorization decisions, acceptance and XP issuance on the server. Use separate mobile/web build and TypeScript configurations; sharing TypeScript does not mean sharing DOM screens or mixing incompatible React/native dependencies.

Suggested eventual structure: existing Next app plus `apps/mobile`, `packages/contracts`, `packages/study-domain`. Do not perform a repository-wide move just to establish these names.

## Authentication and private data

Use the system browser for Google login, not an embedded WebView. Preserve Google verification, PKCE/state/nonce and recipient-bound enrollment. Implement a separate mobile-session adapter: an app-initiated PKCE-bound flow receives a short-lived, single-use exchange code through a verified app link; redeem it with the device verifier for revocable device credentials. No reusable access/refresh credentials in callback URLs, no copying browser cookie jars, no Google client secret in the APK. Review the full broker protocol before coding; an app-link redirect alone is not secure authentication.

Store refresh credentials in OS-backed secure storage, keep access credentials short-lived, rotate/revoke refresh credentials and support device logout. The backend resolves the same user/group principal for both web and mobile, then applies the existing domain permissions. Invites remain required for membership; guest group browsing stays anonymous/read-only.

Private cached data must be partitioned by account, excluded from inappropriate OS/cloud backups, and cleared on logout/account removal according to an explicit retention policy. Encrypt sensitive personal snapshots with keys outside ordinary SQLite storage. Group/platform ownership does not grant access to another person's grades, notes or tokens. A server cannot instantly withdraw bytes already downloaded onto an offline device: communicate freshness and authorization limitations honestly. A university snapshot is not a teacher-verified result or a source of XP.

## Background work, notifications and integrations

Schedule local reminders from downloaded deadlines. Reconcile them when authoritative data changes. Use a server-backed durable queue for remote deadline-change notifications; FCM/APNs credentials and delivery require separate setup. Expo Push is optional, not a required additional intermediary. Android/iOS limit background execution; neither a framework nor a VPS guarantees continuous polling or exact delivery while offline/force-stopped. Show last successful synchronization and distinguish loss of connectivity from a provider failure.

The app must start and show previously downloaded public timetable data after process termination, device restart and loss of the website/backend. New or never-downloaded data still requires a connection. Offline private access is a separate security decision, not permission to persist a web session indefinitely.

RUZ remains a validated public source, separate from documented lesson/task facts. University recordbook/directory/messenger, Moodle/OpenEdu and corporate mail each need their actual supported authentication and data interfaces. A successful browser login, IMAP access, Russian hosting or switching UI frameworks does not establish access to all of them. Do not promise those integrations until a vertical proof works with explicit per-user authorization. Do not harvest master university passwords or reuse the owner's account as every student's integration.

## Signing and rollout

Create and privately back up a proper release signing identity before distributing a replacement. Verify the signing certificate on the existing distributed APK first. A new certificate generally cannot update an installed APK signed with the old debug key; plan an explicit reinstall/migration if required. Preserve server-side Google identity, memberships and progress; do not promise automatic transfer of WebView cookies/localStorage into native storage. Development builds need a distinct application ID and isolated backend data, unlike the current empty debug applicationIdSuffix. App-link association must bind the actual release certificate. No keys in Git.

## First implementation: a vertical proof, not another wrapper

Before all-screen development, deliver a native Android build with:

- one real public group's today/tomorrow timetable, native navigation and Flow/full-list transition;
- a SQLite-backed cold start in airplane mode, including after force-stop/reboot, with visible source age;
- recovery from timeouts/backend downtime and correct Moscow midnight/week rollover;
- Google login through the system browser and an isolated, revocable mobile session;
- one guarded personal-progress operation with offline retry, duplicate delivery, account switching and lost-access tests;
- a local reminder, a saved bounded/integrity-checked material, and accessible gestures with button alternatives.

Use isolated test databases/fixtures for mutations, never production test users or forged production sessions. Verify signed APK installation and the upgrade/reinstall path on a real Android device. Use an iOS simulator early to expose platform assumptions, without promising App Store distribution or buying accounts. Only after this proof passes, port remaining screens and wire provider integrations individually. The website/backend stay available throughout. A Russian-hosting migration can proceed independently after the owner's separate spending approval; it is not a prerequisite for proving native offline UI.

## Primary references checked

- React Native native platform components: https://reactnative.dev/docs/native-platform
- Expo local-first architecture: https://docs.expo.dev/guides/local-first/
- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/
- Android offline-first data architecture: https://developer.android.com/topic/architecture/data-layer/offline-first
- Google OAuth policy on embedded user agents: https://developers.google.com/identity/protocols/oauth2/policies
- Expo local builds: https://docs.expo.dev/build-reference/local-builds/
- Expo notifications and secure storage: https://docs.expo.dev/versions/latest/sdk/notifications/ and https://docs.expo.dev/versions/latest/sdk/securestore/
