# Timetable refinement — 13 November 2026

The owner clarified that a pair is 90 minutes. The daily timetable now uses that activity duration, a vertical progress fill on the active lesson and full teaching-format labels. The original RUZ interval is retained in the payload and expandable lesson details; no schedule, ClassSession or deadline is rewritten. Countdown/current/next badges and break blocks have been removed.

Building names prefer the official full RUZ name. Existing cached abbreviations and numbered room prefixes are expanded for display; unknown names are preserved. Network controls are shown only while the browser reports offline. Cached source age is distinct from the device-copy timestamp.

The owner's requested institute → direction → course → archive browsing uses the official faculties and groups catalogs. Course levels come from RUZ metadata; direction codes and `_YYYY` archive suffixes are not invented or converted into academic groups. Two numeric inputs have a literal slash between them. Only the two already verified IVT/ISiT program labels are expanded; other direction codes retain their official catalog text. All sixteen official institute catalogs were read successfully during source verification (some contain no groups).

Comparison remains public and read-only, with up to three selected groups plus one teacher. Every additional group is checked against its exact institute catalog and the response's group ID, full code, faculty and requested week. Historical comparison is bounded to five years back and six months ahead; ordinary workspace week limits remain unchanged. Selecting the first archived group moves comparison to the corresponding week in that archive year; the date picker allows another week. Missing upstream data is never claimed to be no assignments or no classes.

No schema, enrollment, account, progress, deadline, Google OAuth scope or Calendar change. Academic guest browsing remains limited to the original eight approved groups. The expanded public timetable does not grant private course or roster access. No new native APK is necessary: the existing hybrid app uses the deployed interface.
