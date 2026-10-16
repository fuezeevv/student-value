# Production: Vercel Hobby + Neon Free

Цель: https://studentvalue1984.eu.cc. Выбор владельца окончательный; платные ресурсы и upgrades запрещены без отдельного согласия. Прежний Render Blueprint удалён.

## Runtime и сборка

- Node 24.x, npm ci, существующие Next.js 15 / Prisma 6. Регион Vercel fra1, Neon AWS Frankfurt (eu-central-1), PostgreSQL 17, Free.
- Локальные проверки/CI/CLI закреплены на Node 24.22.0. Vercel управляет patch-версией Node 24.x самостоятельно (первая облачная сборка: 24.21.0); engines закрепляет major, не обещает одинаковый patch у провайдера.
- vercel.json задаёт install/build/region/duration. Автоматические Git deployments отключены. Изменение main не публикует непроверенный код.
- npm run build:vercel требует production origin и постоянный action key. В build DATABASE_URL заменяется на недоступный локальный placeholder, DIRECT_DATABASE_URL удаляется. Generate и next build не выполняют миграции или seed.
- Vercel не вызывает npm start. Build target vercel закреплён в artifact, поэтому отключение системной переменной VERCEL не отключает guards. src/instrumentation.ts валидирует настройки server instance; lazy Prisma повторяет проверку перед инициализацией. На неверной конфигурации запросы блокируются. Preview и development Vercel environments сейчас отключены, чтобы не получить случайный доступ к production DB.
- Runtime URL должен быть Neon pooled endpoint во Frankfurt; sslmode=require + sslaccept=strict, 3 соединения, 15 s connect/pool timeout. Query-параметры, переопределяющие host/schema/TLS roots, запрещены. Readiness ждёт wake-up до 17 s; максимальная функция 30 s.
- /api/health/live не обращается к БД. /api/health проверяет SELECT 1; не ставить DB-readiness на частый uptime polling, иначе Neon не засыпает.
- .vercelignore исключает .env, dumps, test fixtures, .test-work и служебные файлы из CLI upload. .vercel/ игнорируется Git. Vercel должен упаковать только traced server dependencies; проверить actual function artifacts после привязки аккаунта.
- Next outputFileTracingExcludes дополнительно исключает env, secrets, fixtures и test/browser tooling. scripts/check-function-traces.mjs выполняется внутри каждой Vercel сборки после next build и отказывает при запрещённых файлах, отсутствии Prisma native engine или non-Linux engine в Linux build. Vercel Files API показывает source tree и карту lambda bundles, но не выдаёт их внутренний архив через File Contents API; не считать просмотр source tree полным аудитом архива провайдера.

## Аккаунты и инструменты

Версии CLI закреплены в scripts/cloud-cli.mjs: Vercel 64.4.0, neonctl 8.7.2, Node 24.22.0. Они устанавливаются в npm cache, не входят в runtime dependencies.

Из корня проекта:

~~~sh
npm run cloud:vercel -- login
npm run cloud:neon -- login
~~~

Авторизация выполняется владельцем через браузер. Пароли, access tokens и client secrets не передавать в чат. После авторизации агент может создать/настроить бесплатные проекты, не запрашивая владельца об обычных технических шагах. До создания проверить, что выбраны личный Hobby и Neon Free, без платной организации/upgrade.

## Production secrets

Настройки смотреть в .env.production.example. Постоянный NEXT_SERVER_ACTIONS_ENCRYPTION_KEY — случайные 32 bytes base64; один и тот же key в build/runtime, не генерировать заново при каждом build. Secrets только в provider secret storage и, при необходимости, в локальных ignored файлах mode 0600. Никаких NEXT_PUBLIC secrets.

APP_ORIGIN=https://studentvalue1984.eu.cc; ALLOW_DEV_AUTH=false. TZ — зарезервированная переменная Vercel: не добавлять её в Project Env, runtime устанавливает Europe/Moscow сам, а арифметика сроков использует явную зону. VERCEL и VERCEL_ENV предоставляет платформа. DATABASE_URL — pooled connection ограниченной роли приложения. DIRECT_DATABASE_URL с migration role не передаётся Vercel runtime, previews или test CI. Создание роли приложения/выдача grants выполняются после доступа к реальному Neon, до публикации.

## Миграции и release

1. Создать/проверить Neon Free project во Frankfurt, PostgreSQL 17, compute 0.25 CU, autoscaling cap по результатам smoke test, scale-to-zero 5 минут. Не включать compute keepalive.
2. Сохранить backup перед изменениями существующей production DB. Для новой БД сначала проверить, что она действительно пустая. Не выполнять reset, db push, автоматический seed или restore dev dump.
3. Отдельный доверенный release-процесс получает pooled DATABASE_URL и direct DIRECT_DATABASE_URL того же endpoint/database, canonical origin и action key. npm run db:migrate:production выполняет только prisma migrate deploy. Validation отказывает при pooler migration URL или несовпадении endpoint/database. Прикладные роли и data import проверяются отдельно.
4. Typecheck, lint, runtime audit, unit/integration, E2E, fresh migrations, build, production-auth/health/artifact и Vercel-runtime checks должны пройти. Тесты используют только отдельную локальную studentvalue_test_* DB; production credentials в Verify CI не передаются.
5. Публиковать проверенный Git commit с production environment, сначала без подключения целевого домена. Проверить реально собранные Functions, Prisma query/transaction, headers, auth denial и DB readiness. Локальные проверки не являются облачным smoke test.
6. Подключить домен точными DNS-значениями из Vercel Project Domains, затем проверить TLS и canonical origin. Не угадывать CNAME/IP и не переносить NS без необходимости.
7. Настроить независимые зашифрованные backups/restore и уведомления о quota; backup traffic также входит в Neon egress.

## Данные и вход студентов

Публикация существующей закрытой страницы login не означает готовый запуск. Google OAuth реализован: PKCE S256, state/nonce, зашифрованная HttpOnly cookie, проверка RS256/JWKS, issuer/audience/expiry/verified email. Первый вход требует одноразового кода, связанного с Enrollment, текущим userId, email получателя и сроком 72 часа; в БД только хеши. Повторный вход — по Google sub, без email/name merge. Транзакция привязывает identity, создаёт обычное membership и хешированную сессию на 14 дней. Она не выдаёт owner/admin/teacher права. Архивирование Enrollment отзывает доступ даже для существующих сессий. Не привязывать по совпадению имени/email, не создавать default owner и не включать production dev-auth. Без Google client credentials вход остаётся закрытым. OAuth callback/credentials оформляются после подготовки соответствующего кода и Google Cloud приложения; владелец вводит секреты напрямую, не в чат.

Учебные данные переносить только после отдельной проверки набора: source references и provenance сохраняются; sessions, LOCAL_DEV identities, fixtures и технические пользователи не попадают в production автоматически. bootstrap и сырой локальный dump не являются планом миграции реальных данных.

## Состояние этого checkpoint

2026-10-16: Vercel Hobby project studentvalue1984 (prj_nkpqq729cG5o6eeoLDJ3bqq8azfS) и Neon Free project still-haze-41105849 созданы. PostgreSQL 17, Frankfurt, fixed 0.25 CU; suspend_timeout_seconds=0 означает default плана, фактическое засыпание наблюдалось примерно через 5 минут. Все шесть миграций применены. Runtime role studentvalue_app не имеет CREATE/owner/migration permissions; pooled TLS и read transaction проверены на реальной Neon. В Vercel настроены только production variables, два секрета типа sensitive; direct migration credential в runtime отсутствует.

Первая облачная сборка c00b488, dpl_2jrCjHPtX1Nkf5yGdQVvQYjZXbpW — READY, promoted. Публичный технический адрес: https://studentvalue1984-fuezeev-2459.vercel.app. Readiness вернул 200 через реальную Neon; HTTP x-vercel-id и deployment metadata подтверждают runtime fra1. Live/login/privacy отвечают 200, корень/admin с поддельными dev/session cookies отправляют на login, calendar export возвращает 401, Google start без credentials — 503. Истинный студенческий вход ещё не проверен. Проверены защитные headers и адаптивная страница login в браузере. Preview и уникальные deployment URLs сохраняют Vercel Authentication; текущий production alias публичен.

Домен добавлен к проекту и подтверждён Vercel; DNS пока не изменён, TLS целевого домена ещё не проверен. Vercel считает studentvalue1984.eu.cc apex доменом. Актуальный ответ Domains Config рекомендует A 216.198.79.1 / 64.29.17.1 (rank 1); точные DNS нужно повторно проверить перед изменением. Не ставить обычный CNAME на apex. Авторитетные NS a6.share-dns.com / b6.share-dns.net остаются у владельца.

Google client credentials, reviewed production data import, привязка настоящего владельца без потери прогресса, независимые backups/restore и проверка реального студенческого входа ещё предстоят. В production нет demo пользователей, fixtures или автоматически скопированных local identities. Не объявлять сайт запущенным до проверки целевого HTTPS URL и реального входа.

Последующий release 9d85a15: dpl_5DVHzcXN4RGCNz2bMeAGFGw8tkZ5, READY. В облачной Linux build прошёл аудит 26 traces / 139 files, native Prisma engine включён. Повторный публичный smoke test после публикации: Neon readiness 200, runtime fra1, login/privacy 200, dev cookie не открывает корень/admin. Files API подтвердил 94 исходных файла с build-аудитом, без env/secrets/fixtures/test trees. Приватный протокол .test-work/final-cloud-smoke.json. Screenshots фактического закрытого cloud login на desktop/mobile сохранены в outputs текущего чата; проверка полноценного Google-входа ожидает credentials.

Следующее действие владельца: A @ → 216.198.79.1 в существующей GNAME zone, без смены NS; создать Google Web OAuth client с callback https://studentvalue1984.eu.cc/api/auth/google/callback и ввести credentials в ignored secrets/google-oauth.env (0600). Не выводить содержимое файла в лог или чат. После ответа владельца проверить DNS/TLS, передать оба Google значения как sensitive production env, выпустить checked release и продолжить reviewed data import/onboarding. До реального подтверждённого входа владельца не выдавать права случайному Google аккаунту и не открывать регистрацию по одному email.

## Приглашения

scripts/issue-google-invite.ts — только доверенный release-инструмент, не веб-API. Получает точный Enrollment ID и email, отказывает для чужой группы/архивной/уже связанной записи и пишет код только в ignored secrets/ mode 0600. Использовать direct migration environment; production URL не передавать тестовому CI. При переносе существующих реальных профилей сначала отдельно проверить соответствие Enrollment и сохранить реальный progress; не классифицировать тестовые данные по одному префиксу ID.

Для уже существующего проверенного профиля команда требует третий аргумент EXPLICIT_EXISTING_USER_ID, точно совпадающий с текущим Enrollment.userId. Код связан с этим userId и подтверждённым Google email; существующая Google identity не заменяется. Привязка сохраняет прежние progress, nickname, membership и статус VERIFIED. Обычный новый участник не получает owner/admin роли.

## Первый перенос данных в Neon — 2026-10-17

Перед переносом: Git tag checkpoint-before-neon-data-20261017, отдельные проверенные custom pg_dump локальной БД и Neon. Для PostgreSQL 17 использован keg-only libpq client 18 с verify-full/system root CAs; локальный PostgreSQL 16 не обновлялся и не перезапускался.

scripts/import-reviewed-academic.mjs принимает только приватный reviewed manifest под secrets/ и точный SHA-256. Проверяет production Neon endpoint, пустоту всех application tables, выполняет только CREATE в единой serializable transaction, записывает digest/counts/exclusions/transformations в AuditLog. Повтор с тем же digest — no-op, не перезаписывает последующую работу; другой digest/непустая база без marker отклоняются. Идентичности, sessions, локальные claim tokens и интеграционные credentials не импортируются. Инструмент и приватный manifest исключены из Vercel upload.

Пробный перенос фактического reviewed набора прошёл на отдельной local studentvalue_test_import_20261017: FK/date/JSON, отсутствие auth credentials, сохранность прогресса при повторном запуске, отказ на другой digest/добавление sessions. После проверки неизменности fingerprint локальной БД шесть production migrations проверены (pending нет), initial transfer применён к Neon. Readback каждого импортированного scalar/JSON/date совпал с manifest через ограниченную runtime role.

Перенесены: группа, 30 Enrollment, 10 предметов/offerings, 9 teacher candidates с прежними статусами, 6 Source, 17 SourceReference, 11 Task (10 опубликованных, 1 draft; отсутствие TaskAudience не исправляется догадкой), 10 Audience, 10 Deadline (6 подтверждённых ACTIVE, 4 CANCELLED/UNKNOWN), 3 Announcement с прежним lifecycle, 4 личных Progress владельца, 27 исходных audit records, остальные связанные реальные справочники/настройки. Два прежних назначения вариантов остаются UNVERIFIED и не выдаются за персональные подтверждённые задания.

Исключены только точно установленные прежним repair E2E-задачи/объявления и их зависимости, unbound demo profile без Enrollment с явно DEMO XP и его данные. Локальные строки не удалялись. Сохранены профиль владельца и system-bootstrap как неаутентифицируемый исторический автор. У владельца сохранены group ownership/roles, глобальный isSystemAdmin установлен false; до реального Google-входа ни одной production identity/session нет. Новый Google client/rotated secret прочитаны только из secrets/google-oauth.env и помещены в sensitive production env; старый secret не использовался.

## Опубликованный OAuth release и текущая передача владельцу

Commit 50d582c, deployment dpl_AV64PuaeLCh4P5BdkAZ5WFEiwC9f — READY, promoted на studentvalue1984.eu.cc. DNS A 216.198.79.1 подтверждён Vercel как correct; Let's Encrypt certificate для точного домена проверен стандартной цепочкой доверия, истекает 2027-01-14. HTTPS live/readiness 200 через реальную Neon, runtime fra1. Login показывает Google, secret в HTML отсутствует. Гость/поддельная session/dev cookie не открывают учебные/admin routes; env/secret paths возвращают 404. Настоящий OAuth start использует новый client, canonical callback, PKCE и Secure/HttpOnly cookie. Неверный callback state возвращает отказ без сессии. Приватный протокол .test-work/canonical-production-smoke.json.

Typecheck/lint/format, 105 tests (включая привязку существующего владельца без изменения progress/privileges), 11 isolated E2E и production OAuth HTTP checks прошли; локальная рабочая БД неизменна. Cloud Linux audit: 26 function traces / 139 files, без env/fixtures/dev tools, с native Prisma engine. Import/release operator tools и manifests не отправлены на Vercel.

Приглашение владельца выдано только точному VERIFIED Enrollment и прежнему userId, recipient — email авторизованного аккаунта Vercel. Код находится в приватном secrets/google-invite-<enrollmentId>.txt; не печатать его. В открытой IAB вкладке код уже передан login форме и зашифрован в flow cookie. Google принял client/callback и дошёл до password challenge владельца. Вкладка помечена handoff; требуется человеческий Google login. В flow cookie 10 минут TTL, в invitation 72 часа: если flow истёк, начать заново через /login с тем же ещё не использованным кодом, не ослаблять TTL/state guards.

Полный обмен code → verified Google identity → session и реальные облачные страницы владельца пока не подтверждены; после ответа владельца проверить текущую вкладку и БД (identity/sub, consumed invitation, session hash, прежний progress), затем основные страницы desktop/mobile. Права обычного студента/старосты проверены в изолированном E2E; настоящий второй студенческий Google-вход ещё не выполнялся. Не создавать production test users/sessions для имитации этих проверок. Независимые регулярные encrypted backups/restore ещё не автоматизированы; проверенные ручные backups сохранены приватно.
