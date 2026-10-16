# Student Value 1.984

Учебная платформа группы СПбПУ 5130901/40102: работы, сроки, материалы и личный прогресс. [Учебное ядро](docs/RELIABLE_CORE.md), [ежедневный интерфейс](docs/daily-student-ux.md), [production deployment](docs/DEPLOYMENT.md). Google OAuth реализован и ожидает настройки клиента Google Cloud; Telegram и Calendar API не подключены.

## Локальный запуск

1. Использовать Node из `.node-version`, установить зависимости: `npm ci`.
2. Настроить DATABASE_URL в `.env` для отдельной PostgreSQL БД.
3. Выполнить `npx prisma migrate deploy`, затем `npm run prisma:seed`.
4. Для существующей базы из checkpoint перед исправлениями: после резервной копии выполнить `npm run db:repair-academic`.
5. Запустить `npm run dev`.

Dev-вход требует одновременно NODE_ENV=development и ALLOW_DEV_AUTH=true. Автоматического владельца нет. Create-only seed не создаёт пользователей с привилегиями; в текущей локальной БД сохраняются ранее существовавшие LOCAL_DEV identities. Новая установка имеет только академический bootstrap, без рабочего production-входа.

## Проверки

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run test:e2e`
- `node scripts/check-migrations.mjs`
- `npm run build`

Тесты создают отдельную локальную studentvalue_test_core, используя соединение из DATABASE_URL с другим именем базы. Альтернатива — явный TEST_DATABASE_URL; имя обязано начинаться с studentvalue_test_, соединение должно быть локальным и отличаться от рабочей БД. Раннер не сбрасывает и не удаляет базы. Для создания тестовой БД требуются PostgreSQL CLI и право CREATEDB.

Для проверки production-auth используется сборка с NEXT_DIST_DIR=.next-production-check и DATABASE_URL тестовой БД. Затем `node scripts/check-production-auth.mjs`; даже при ALLOW_DEV_AUTH=true dev-cookie должна отклоняться.


## Production

Выбран Vercel Hobby + Neon Free (Frankfurt), домен `studentvalue1984.eu.cc`. `vercel.json` закрепляет build и регион, автоматические Git deployments отключены. Runtime guards выполняются внутри Vercel Functions, а не только через `npm start`.

`npm run build:vercel` не соединяется с БД. `npm run db:migrate:production` использует отдельный direct Neon URL и выполняется перед release, не в build/preview/CI. `npm run test:vercel-runtime` проверяет guards на production-сборке без `npm start`. Secrets и порядок релиза — в [DEPLOYMENT.md](docs/DEPLOYMENT.md).

Облачный deployment и Google OAuth пока не выполнены: не выдавать закрытую страницу входа за готовый пилот. Не использовать dev-вход, fixture seed или автоматическое восстановление локального dump в production.
