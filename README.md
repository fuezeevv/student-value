# Student Value 1.984

Учебная платформа группы СПбПУ 5130901/40102: работы, сроки, материалы и личный прогресс. [Учебное ядро](docs/RELIABLE_CORE.md), [ежедневный интерфейс](docs/daily-student-ux.md), [production deployment](docs/DEPLOYMENT.md). Google OAuth, Telegram и Calendar API ещё не реализованы.

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

Подготовлен `render.yaml`: постоянно работающий Node-сервис и managed PostgreSQL в Frankfurt, HTTPS на `studentvalue1984.eu.cc`, secrets через Render, CI перед deployment. **Применение создаёт платные ресурсы; аккаунт, стоимость и DNS должен подтвердить владелец.** Внешний вход пока не реализован: инфраструктурный deployment не означает готовность студенческого пилота.

Команды: `npm run build:production`, `npm run db:migrate:production`, `npm run start:production`. Не использовать `dev`, локальную `.env`, fixture seed или dev-вход в production. Secrets и порядок создания ресурсов описаны в [DEPLOYMENT.md](docs/DEPLOYMENT.md).
