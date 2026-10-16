# Production: Vercel Hobby + Neon Free

Цель: https://studentvalue1984.eu.cc. Выбор владельца окончательный; платные ресурсы и upgrades запрещены без отдельного согласия. Прежний Render Blueprint удалён.

## Runtime и сборка

- Node 24.x, npm ci, существующие Next.js 15 / Prisma 6. Регион Vercel fra1, Neon AWS Frankfurt (eu-central-1), PostgreSQL 17, Free.
- vercel.json задаёт install/build/region/duration. Автоматические Git deployments отключены. Изменение main не публикует непроверенный код.
- npm run build:vercel требует production origin и постоянный action key. В build DATABASE_URL заменяется на недоступный локальный placeholder, DIRECT_DATABASE_URL удаляется. Generate и next build не выполняют миграции или seed.
- Vercel не вызывает npm start. Build target vercel закреплён в artifact, поэтому отключение системной переменной VERCEL не отключает guards. src/instrumentation.ts валидирует настройки server instance; lazy Prisma повторяет проверку перед инициализацией. На неверной конфигурации запросы блокируются. Preview и development Vercel environments сейчас отключены, чтобы не получить случайный доступ к production DB.
- Runtime URL должен быть Neon pooled endpoint во Frankfurt; sslmode=require + sslaccept=strict, 3 соединения, 15 s connect/pool timeout. Query-параметры, переопределяющие host/schema/TLS roots, запрещены. Readiness ждёт wake-up до 17 s; максимальная функция 30 s.
- /api/health/live не обращается к БД. /api/health проверяет SELECT 1; не ставить DB-readiness на частый uptime polling, иначе Neon не засыпает.
- .vercelignore исключает .env, dumps, test fixtures, .test-work и служебные файлы из CLI upload. .vercel/ игнорируется Git. Vercel должен упаковать только traced server dependencies; проверить actual function artifacts после привязки аккаунта.

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

Конфигурация и локальные проверки подготовлены. Vercel Hobby project studentvalue1984 и Neon Free project still-haze-41105849 созданы. PostgreSQL 17, Frankfurt, fixed 0.25 CU; suspend_timeout_seconds=0 означает default плана, фактическое засыпание наблюдалось примерно через 5 минут. Все шесть миграций применены. Runtime role studentvalue_app не имеет CREATE/owner/migration permissions; pooled TLS и read transaction проверены на реальной Neon. В Vercel настроены только production variables, два секрета типа sensitive. Production data import, Google client credentials, cloud deployment smoke test и DNS ещё предстоят. Не объявлять сайт запущенным до проверки фактического публичного URL и реального входа.

## Приглашения

scripts/issue-google-invite.ts — только доверенный release-инструмент, не веб-API. Получает точный Enrollment ID и email, отказывает для чужой группы/архивной/уже связанной записи и пишет код только в ignored secrets/ mode 0600. Использовать direct migration environment; production URL не передавать тестовому CI. При переносе существующих реальных профилей сначала отдельно проверить соответствие Enrollment и сохранить реальный progress; не классифицировать тестовые данные по одному префиксу ID.
