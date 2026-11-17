# Native delivery, 17 November 2026

## Implemented

- Horizontal day gesture on Flow (one-finger intent threshold; vertical scroll remains separate), previous/next controls and complete day list below the hero.
- Up to three comparison schedules, groups or teachers, mixed chronologically with explicit source labels. Comparisons never change enrollment or private-task permissions. Public RUZ snapshots are saved offline; source age/failures are shown.
- Persisted system/light/dark appearance across native screens and modals. Original brand vector paths have a transparent background. Bottom reflection uses an actual radial gradient.
- Public Telegram feed: studentvalue, sss_iccs, polyctf. Exact publisher URLs, dates and text; offline cache; no generated institutional posts. Per-instance single flight/TTL, bounded HTML responses and fixed source allowlist. VK directory entries are explicitly NOT_CONFIGURED; unauthenticated VK wall.get returned token-required.
- Indoor GUK plans from pinned PolyNavi commit, 417 graph nodes, room search, floor switching, pan/pinch and graph routing. Original plans are CC BY-NC-SA 4.0; graph MIT. Notices retained. No indoor coverage claimed for other buildings.
- Campus map uses the exact Yandex embed published on spbstu.ru/campus-map, inside an isolated map view; online only. No university/Google session, location permission or app bearer token is passed to the map.
- Native headman editor for existing tasks and deadlines. Uses existing audited domain operations: text edit, archive/restore, cancel/restore deadline, reschedule with evidence. Group membership and permissions are rechecked on the server. New-task publication, invitations and other management tools still use the web panel.
- Progress writes/reads support explicitly enrolled secondary groups. Offline queued operations carry their original group context; selecting a public timetable cannot grant it. API-origin-scoped task caches prevent dev fixtures appearing as production work; logout clears the account's scopes.
- Failed offline drafts survive refresh; removed server progress is removed from rendered state. Calendar day dots use actual day's lessons. Military training/foresight/research are excluded from the native display, preserving source snapshots. Hero progress uses the owner's 90-minute policy without elapsed/remaining text.
- Reminder UI shows actual scheduled Moscow time; calculation uses previous Moscow calendar day at 10:00 and does not schedule after the deadline. Removed the test timing override from the app-facing function.
- Network connection state is separate from stale data. Crossed connection icon is shown only when NetInfo explicitly reports no connection.

## Verification

- 49 suites / 291 tests pass on separate local studentvalue_test_native_delivery_20261117; fresh 12-migration replay passed. Test rerun fixture collisions were fixed with per-user unique identifiers.
- 24 isolated web E2E scenarios pass; working database unchanged.
- Root/mobile typecheck and root lint passed; production build/auth rejection checks and function trace scan passed. No production academic writes or synthetic production sessions were used.
- APK build and physical install succeeded during iteration. CUA observed native cold launch, absence of duplicate hero group/military focus, and actual dark-to-light appearance change on the phone. This is not proof of every gesture, map, Google-login or reminder scenario.

## Still requires acceptance/work

- Real Google login completed by the owner and observed in the native profile; native management loaded actual group work and opened the RR3 editor without writes. Two-account and physical in-flight logout/download/reminder acceptance remain.
- Physical swipe/pinch/route, campus map and overlay acceptance on the final APK. Automated interaction with the mirror was interrupted by window changes; no ADB tap/screenshot workaround was used.
- VK API credential/allowed access; remaining verified institute channels. Catalog is not asserted exhaustive.
- Additional buildings' sourced floor plans, current accessibility and routes.
- Complete native parity for invitation/teacher/new-task/verification/Calendar tools.
- Reminder restore/reschedule and late-operation/account race guards are implemented and covered with fake-OS tests against the actual mobile module. Physical delivery after a killed app is not yet proved. Constant-memory large material hashing and admission-based daily minimum sourced per subject remain.
- Android release signing/update policy and a distributable release candidate. Current APK remains a debug preview; do not replace the public release with an unverified build.

The backend is the project's existing custom application/domain backend on Next.js/TypeScript, PostgreSQL and Prisma. No Go/Fiber rewrite or hosting migration is claimed. No paid resources were created.

## Final reliability follow-up

- Focus journal is now scoped to account + API origin in SecureStore. Per-scope writes and logout erasure are serialized; stale mounted sessions cannot repopulate cleared data. Legacy unscoped focus data is not guessed to belong to the current student.
- Hidden running timers update the badge at a lower frequency and finish yesterday's session at Moscow midnight. Logout also dismisses app notifications already shown in the tray.
- Notification IDs include account/session/request identity. Pending create/cancel/logout races cannot cancel a later login's alarm. Cold-start flags consult actual OS registrations; selected-group opt-ins follow changed deadline IDs without another permission prompt, and completed/removed works are reconciled.
- Date-only API deadlines use effective Moscow end-of-day while retaining original DB timestamps. A regression test covers a legacy midnight row.
- A logged-in visitor viewing a nonmember group gets explicit read-only work cards. Native management refreshes academic data after successful changes. Light-theme status/error text uses semantic contrast colors.
- Privacy text now describes native local copies, public feed and the isolated university-published Yandex map.

## Delivery checkpoint

- Latest arm64 debug preview built and installed preserving app data: 56 MB, SHA-256 `ec65ce50c187860538cd939365eafae6c01312de05ac9bedec9edb345b7d77fa`. Public release assets were not replaced.
- Real owner Google login, native profile, headman work list and RR3 editor were observed without academic writes. Final build cold launch was observed; horizontal gestures were not accepted through the unreliable mirror coordinate input.
- Production feed/manage API deployment remains live. Final follow-up rollout (privacy additions and date-only deadline projection) hit Vercel API connection timeouts before a new deployment was created; it is committed but not claimed live. Retry from this branch with `node scripts/cloud-cli.mjs vercel deploy --prod --yes --archive=tgz`, then check health/feed, anonymous manage/progress rejection, privacy text and date-only deadline projection. No migrations are required.
- Two pre-existing untracked colleague screenshots (`docs/images/map.png`, `docs/images/news.png`) were preserved and not included.
- Follow-up transport check: system Node could list deployments, pinned Node timed out; one upload reached 4.4 MB but deployment creation still failed. CLI listing confirmed the previous READY deployment is still latest. This is a deployment transport failure, not a failed server build.
