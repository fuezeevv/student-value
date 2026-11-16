# Мобильная авторизация и защищённый офлайн-прогресс: Threat Review & Протокол (Этап B)

**Дата:** 16 ноября 2026  
**Контекст:** Реализация этапа B спецификации `docs/handoff/ANTIGRAVITY_NATIVE_APP_SPEC_2026-11-16.md` и архитектуры `docs/MOBILE_ARCHITECTURE_2026-11-16.md`.  
**Статус:** Согласование архитектуры безопасности перед кодированием адаптеров.

---

## 1. Архитектурная модель доверия и границы

```
+--------------------------------------------------------------------------+
| ПУБЛИЧНЫЙ КЛИЕНТ (Смартфон Android / Samsung Galaxy S23+)                |
| - Декомпилируемый бинарник (APK) без секретов сервера                    |
| - Память приложения: short-lived access token                            |
| - Аппаратное защищённое хранилище (Android KeyStore / SecureStore):     |
|     opaque refresh token (never in SQLite or AsyncStorage)               |
| - Долговременный локальный SQLite:                                       |
|     кэш публичного расписания + очередь офлайн-операций (outbox)         |
+------------------------------------+-------------------------------------+
                                     |
                                     | HTTPS + PKCE / Bearer Session
                                     v
+--------------------------------------------------------------------------+
| СЕРВЕРНЫЙ БРОКЕР И ДОМЕННОЕ ЯДРО (Next.js / Node.js)                     |
| - /api/v1/auth/mobile/start    - Валидация redirect_uri, генерация PKCE  |
| - /api/v1/auth/mobile/exchange - Проверка verifier, выдача сессии        |
| - /api/v1/auth/mobile/logout   - Отзыв сессии в PostgreSQL               |
| - /api/v1/progress             - Идемпотентная личная отметка (READY)     |
| - Существующие инварианты: requireTaskAudience, reconcileCompletionXp    |
| - PostgreSQL: Session (tokenHash), User, Enrollment                      |
+------------------------------------+-------------------------------------+
                                     |
                                     | OAuth 2.0 (server-to-server)
                                     v
+--------------------------------------------------------------------------+
| GOOGLE IDENTITY PROVIDER                                                 |
| - Системный браузер устройства (Chrome / Custom Tabs)                    |
| - Запрет WebView (RFC 8252)                                              |
| - Проверка Google ID token, audience и привязка к Enrollment             |
+--------------------------------------------------------------------------+
```

---

## 2. Анализ угроз (STRIDE)

| Категория | Угроза | Сценарий атаки | Архитектурная защита (Mitigation) |
|---|---|---|---|
| **Spoofing (Подмена)** | Подделка сессии или пользователя | Злоумышленник генерирует произвольный токен или подделывает `userId` в запросе к `/api/v1/progress`. | Сессия идентифицируется только по криптографическому bearer токену (256 бит энтропии). Сервер ищет сессию по `SHA-256(token)` в таблице `Session`. Идентичность пользователя извлекается **исключительно** из серверной строки сессии, входные параметры клиента с `userId` игнорируются. |
| **Spoofing** | Перехват authorization code через Custom URI Scheme | Вредоносное приложение регистрирует на устройстве схему `cc.eu.studentvalue1984.dev://` и перехватывает deep link с кодом авторизации. | **RFC 7636 (PKCE)**: Клиент генерирует `code_verifier`. Сервер сохраняет `code_challenge = S256(verifier)`. Код обмена (`exchange_code`) бесполезен без `verifier`, который остаётся в памяти нашего приложения. Кроме того, `exchange_code` является **одноразовым** (TTL 60 с). В release-версии используется verified Android App Links с `assetlinks.json`. |
| **Tampering (Искажение)** | Изменение параметров отметки или чужого задания | Клиент пытается отметить работу другого студента или изменить статус чужого задания. | Серверная проверка `requireTaskAudience(user, taskId)`: проверяется привязка задания к группе/подгруппе студента через его подтверждённый `Enrollment`. Студент может менять только свой прогресс. Статус `ACCEPTED` запрещён даже для владельца платформы (только `READY` / `SUBMITTED`). |
| **Tampering** | Накрутка очков (XP farming) через офлайн-очередь | Многократная отправка отметки «Выполнено» и её отмены для бесконечного начисления XP. | Функция `reconcileCompletionXp` выполняется в одной транзакции под блокировкой строки пользователя (`SELECT ... FOR UPDATE`). Она вычисляет совокупный объём XP до операции и сравнивает с целевым (20 XP + 5 XP за соблюдение срока). Повторный вызов даёт $\Delta = 0$ и не добавляет баллов. |
| **Repudiation** | Оспаривание действий или сбои доставки | Пользователь заявляет, что работа была сдана вовремя, но сеть пропала; либо запрос упал после сохранения в БД, но до ответа клиенту. | Очередь `pending_operations` хранит `operation_id` (UUID), `created_at` (по часам устройства) и `base_revision`. На сервере операция идемпотентна: повтор с тем же `operation_id` возвращает результат существующей записи без повторного начисления XP. |
| **Information Disclosure** | Утечка токенов через URL, логи или бэкап | Токен сессии попадает в URL адресной строки, logcat или резервную копию Google Drive. | Токены передаются **только в теле POST-ответа** по HTTPS. Refresh token сохраняется исключительно в `expo-secure-store` (Android KeyStore + EncryptedSharedPreferences). В `AndroidManifest.xml` прописано `android:allowBackup="false"`. Токены никогда не сохраняются в незашифрованном SQLite или AsyncStorage. |
| **Denial of Service** | Засорение очереди / бесконечный retry | Зависшая невалидная операция блокирует очередь синхронизации. | Лимит размера очереди (не более 50 операций). Ошибки авторизации (401) и прав (403) останавливают очередь с явным уведомлением пользователя. Экспоненциальный backoff для сетевых ошибок. |
| **Elevation of Privilege** | Самоподтверждение (Self-acceptance) | Студент или староста пытается выставить статус `ACCEPTED`. | Схема валидации статуса на сервере допускает только `selfStatus = z.enum(["NOT_STARTED", "IN_PROGRESS", "READY", "SUBMITTED"])`. Попытка передать `ACCEPTED` отклоняется валидатором с кодом 400. |

---

## 3. Протокол мобильной авторизации (System Browser + PKCE Broker)

### Шаг 1: Инициализация на клиенте
1. Мобильное приложение генерирует `code_verifier`: 32 байта криптографически стойких случайных данных, закодированных в `base64url` (43 символа).
2. Вычисляет `code_challenge = base64url(SHA-256(code_verifier))`.
3. Генерирует одноразовый случайный `state` (защита от CSRF).
4. Запоминает `code_verifier` и `state` в защищённом хранилище/памяти клиента.
5. Открывает системный браузер (Custom Tabs) по адресу:
   ```
   GET https://studentvalue1984.eu.cc/api/v1/auth/mobile/start
       ?challenge=<code_challenge>
       &state=<state>
       &redirect_uri=cc.eu.studentvalue1984.dev://auth/callback
   ```

### Шаг 2: Валидация брокером на сервере
1. Сервер проверяет `redirect_uri` по строгому белому списку:
   - `cc.eu.studentvalue1984.dev://auth/callback` (Dev build)
   - `cc.eu.studentvalue1984://auth/callback` (Release build)
2. Сервер сохраняет flow во временный зашифрованный cookie `__Host-mobile-pkce` (AES-256-GCM, TTL 300 секунд) с полями:
   `{ challenge, state, redirectUri, expiresAt }`.
3. Перенаправляет пользователя на существующий серверный Google flow (`/api/auth/google`).

### Шаг 3: Вход через Google и связывание с пользователем
1. Пользователь выполняет вход в аккаунт Google в системном браузере.
2. Google возвращает `code` на `/api/auth/google/callback`.
3. Сервер проводит стандартную строгую проверку:
   - верификация подписи Google ID token через JWKS;
   - проверка audience и email;
   - поиск подтверждённого `Enrollment` (студенческого членства);
   - связывание с аккаунтом `User`.
4. Если обнаружен cookie `__Host-mobile-pkce`:
   - Сервер генерирует криптографический одноразовый `exchange_code` (32 байта base64url, TTL 60 секунд).
   - Сохраняет `MobileExchangeCode` в БД с привязкой к `challenge`, `userId` и `redirectUri`.
   - Выполняет HTTP 302 Redirect на:
     ```
     cc.eu.studentvalue1984.dev://auth/callback?code=<exchange_code>&state=<state>
     ```

### Шаг 4: Обмен кода на сессию (Exchange)
1. Системный браузер перенаправляет управление в нативное Android-приложение через deep link.
2. Приложение сверяет возвращённый `state` с сохранённым ранее (защита от CSRF).
3. Приложение выполняет POST-запрос на сервер:
   ```http
   POST /api/v1/auth/mobile/exchange
   Content-Type: application/json

   {
     "code": "<exchange_code>",
     "verifier": "<code_verifier>"
   }
   ```
4. Сервер:
   - Находит запись `MobileExchangeCode` по `SHA-256(code)`.
   - Проверяет, что код не использован (`usedAt === null`) и не истёк (`expiresAt > now`).
   - Помечает код как использованный (`usedAt = now`).
   - Проверяет: `base64url(SHA-256(verifier)) === challenge`. При несовпадении — отказ HTTP 400 `INVALID_VERIFIER`.
   - Создаёт сессию в таблице `Session`:
     - `token = randomBytes(32).toString("base64url")`
     - `tokenHash = SHA-256(token)`
     - `userId = exchangeRecord.userId`
     - `expiresAt = now + 30 days`
     - `userAgent = "StudentValue-Mobile/1.0 (Android ...)"`
   - Возвращает клиенту токен сессии и данные профиля (id, nickname, groupCode, permissions).

### Шаг 5: Выход (Logout) и изоляция пользователей
1. Приложение вызывает `POST /api/v1/auth/mobile/logout` с `Authorization: Bearer <token>`.
2. Сервер удаляет строку `Session` по `tokenHash`.
3. Приложение:
   - Удаляет токен из `SecureStore`.
   - Предупреждает о наличии неотправленных операций в `pending_operations`.
   - Очищает пользовательский кэш SQLite (`user_tasks`, `user_progress`, `pending_operations`).
   - Возвращается в гостевой режим расписания.

---

## 4. Протокол защищённого сценария: личная отметка прогресса (Этап B)

### 4.1. Локальная очередь (Outbox) в SQLite
Таблица `pending_operations`:
```sql
CREATE TABLE IF NOT EXISTS pending_operations (
  id TEXT PRIMARY KEY,           -- UUID операции
  user_id TEXT NOT NULL,         -- ID студента (изоляция двух пользователей)
  task_id TEXT NOT NULL,         -- ID учебного задания
  action TEXT NOT NULL,          -- 'SET_STATUS' | 'SAVE_NOTES'
  payload TEXT NOT NULL,         -- JSON с параметрами (newStatus: "READY", notes)
  created_at TEXT NOT NULL,      -- ISO-8601 создания отметки
  status TEXT NOT NULL DEFAULT 'PENDING' -- 'PENDING' | 'SYNCING' | 'FAILED'
);
```

### 4.2. Алгоритм синхронизации очереди
1. Пользователь нажимает «Отметить выполненным» в UI:
   - Запись немедленно сохраняется в `pending_operations` с уникальным `operation_id = UUID()`.
   - Локальный статус задания обновляется оптимистично с пометкой «Ожидает синхронизации».
2. Сетевой воркер (при наличии связи):
   - Отправляет `POST /api/v1/progress`:
     ```json
     {
       "operationId": "c4b8e219-...",
       "taskId": "task-uuid-...",
       "status": "READY",
       "createdAt": "2026-11-16T07:45:00.000Z"
     }
     ```
   - Заголовок: `Authorization: Bearer <sessionToken>`.
3. Сервер:
   - Проверяет аутентификацию по токену сессии (`getCurrentUser`).
   - Проверяет право доступа: `await requireTaskAudience(user, taskId)`.
   - Проводит обновление через `updateOwnProgress` в единой транзакции с `reconcileCompletionXp`.
   - Возвращает подтверждённый результат: `{ success: true, progress: { status: "READY", isVerified: false, xpAwarded: 20 } }`.
4. Клиент:
   - Удаляет операцию из `pending_operations`.
   - Обновляет локальный кэш статуса на «Синхронизировано».

---

## 5. План контрольных испытаний (Gate B Verification Checklist)

1. **Тесты криптографического брокера**:
   - Попытка обмена с неверным `verifier` → отказ 400.
   - Повторная попытка использовать один и тот же `code` → отказ 400 (Single-use replay protection).
   - Истечение 60-секундного TTL → отказ 400 (Expired code).
   - Подмена `redirect_uri` на неразрешённую схему → отказ 400.
2. **Тесты идемпотентности и защиты от накрутки XP**:
   - Повторная отправка одной и той же операции `operationId` 3 раза подряд → XP не удваивается ($\Delta = 0$).
   - Цикл «Выполнено» → «Снять отметку» → «Выполнено» → итоговые баллы строго равны целевым 20 XP.
3. **Тесты изоляции двух пользователей**:
   - Пользователь А сохраняет отложенную отметку офлайн.
   - Пользователь А выходит (logout).
   - Входит Пользователь Б.
   - Очередь Пользователя А не отправляется под сессией Пользователя Б.
4. **Тесты утраты прав (403 Forbidden)**:
   - Студент исключён из аудитории задания после создания отложенной операции.
   - При синхронизации сервер возвращает 403.
   - Приложение корректно помечает операцию сбоем и снимает отметку в интерфейсе.
