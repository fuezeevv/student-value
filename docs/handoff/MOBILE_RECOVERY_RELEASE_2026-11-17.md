# Production/API и APK — 17.11.2026

Проверенный runtime commit: 712ae5b. GitHub draft PR: https://github.com/fuezeevv/student-value/pull/1 . Основная ветка не перезаписана. Рабочая ветка: codex/mobile-safety-review-2026-11-17.

Vercel deployment: dpl_CY7MNhgSRixdkhFRFFffA3zyHacj, alias https://studentvalue1984.eu.cc . Предыдущий deployment для rollback: dpl_7eRZjofUFhSzHuVFayUvU7ysErZb. Новый платный ресурс, тариф, credential или DNS-запись не создавались. Миграции production PostgreSQL не требовались и не запускались. Build использовал фиктивный недоступный DB URL; удалённая проверка 67 function traces прошла.

Проверки после выкладки, без создания production sessions/users и без изменения личного прогресса:

- HTTPS `/api/health`: 200, status ok (production DB readiness).
- `/api/v1/tasks?group=5130901/40102`: 200, 38 работ, 18 подтверждённых дат; progress и файловые descriptors у гостей отсутствуют.
- `/api/v1/timetable?...date=2026-11-16`: 200, FRESH, правильные группа/неделя, 15 пар.
- `/api/v1/auth/mobile/start` с корректным случайным challenge/state: 303 на accounts.google.com, scopes openid email profile. Google code не обменивался, Google login на Android НЕ доказан этой проверкой.
- Невалидный `/api/v1/auth/mobile/exchange`: 400; приватные progress и material metadata без bearer: 401.
- Privacy/terms: 200. CUA визуально проверил production guest view на desktop и 390×844, включая открытие полного расписания; временный viewport override снят.

APK собран через настоящий `:app:assembleDebug`, содержит assets/index.android.bundle (2260476 байт). Размер APK: 159622502 байт; SHA-256 `2aabce30a6d170454a85de0ddb78b720fa9f8c1123e2ff42e769768964ac3b3d`. Копия для владельца: `/Users/fuezeev/Documents/Codex/2026-10-16/files-mentioned-by-the-user-antigravity/outputs/StudentValue-preview-2026-11-17.apk`.

Это debug preview с applicationId cc.eu.studentvalue1984.dev, не стабильный публичный Android release. На телефон в этой работе не устанавливался, GitHub APK release не заменён. После обновления может потребоваться повторный вход: SecureStore теперь разделён по API origin. Старый бесконтекстный task cache не используется, сохранённые расписания остаются.

До стабильного APK проверить на реальном Android: Google login существующего участника, cold start в авиарежиме, цепочку офлайн-отметок, конфликт с веб-изменением, два аккаунта, PDF/DOCX viewer, logout во время скачивания и Android reminders. Проверить сценарий нескольких активных членств отдельно: native mutation/read-progress пока используют основную группу bearer-сессии; не считать весь multi-membership UX завершённым из проверки публичного переключателя расписания.

Собственная native theme system, нативная панель старосты, наложение расписаний, полноценный перенос всех материалов/Calendar и рассчитанный по источникам учебный минимум не завершены. Существующие веб-разделы доступны по явно обозначенным ссылкам профиля. Синтетические записи local polytech_study требуют отдельного аудируемого исправления и не переносились в Neon.
