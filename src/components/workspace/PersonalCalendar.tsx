import { prisma } from "@/lib/db/prisma";
import { formatInTimeZone } from "date-fns-tz";
import { calendarEnabled } from "@/server/calendar/crypto";
import { refreshCalendarAfterVisit } from "@/server/calendar/background";
import { OperationForm } from "./OperationForm";
import { inputClass } from "./styles";
import {
  saveCalendarRemindersAction,
  syncCalendarNowAction,
  disconnectCalendarAction,
  recoverCalendarAction,
  retryCalendarCreationAction,
  replaceDeletedCalendarAction,
} from "@/server/actions/calendar-actions";
const messages: Record<string, string> = {
  CALENDAR_CHANGED:
    "Не удалось подтвердить календарь Student Value в Google. Сообщите владельцу; создание дубликата остановлено.",
  REAUTH_REQUIRED:
    "Google отозвал доступ или срок разрешения закончился. Подключите календарь ещё раз.",
  API_DISABLED:
    "Google Calendar API ещё не включён в проекте Google Cloud. Владелец должен включить API; ваши учебные данные сохранены.",
  PERMISSION:
    "Google не разрешил эту операцию. Проверьте разрешение на отдельный календарь Student Value.",
  TEMPORARY:
    "Google временно недоступен или ограничил частоту запросов. Повторная попытка запланирована.",
  CREATE_UNCERTAIN:
    "Google не подтвердил создание календаря. Чтобы не создавать дубликаты, автоматическая повторная попытка остановлена.",
  NOT_FOUND:
    "Google не нашёл календарь. Он мог быть удалён; автоматическое создание замены остановлено.",
  GONE: "Календарь удалён в Google. Автоматическое создание замены остановлено.",
  INTERNAL:
    "Обновление не завершено. Повторная попытка запланирована; при повторении сообщите владельцу.",
  DISCONNECTED_CHECK_GOOGLE:
    "Проверьте отключение напоминаний в Google Calendar и доступ Student Value в Google Account.",
};
export async function PersonalCalendar({
  userId,
  error,
  connected,
}: {
  userId: string;
  error?: string;
  connected?: string;
}) {
  const connection = await prisma.personalCalendarConnection.findUnique({
    where: { userId },
    select: {
      state: true,
      provisioning: true,
      reminderMinutes: true,
      calendarId: true,
      lastErrorCode: true,
      lastSyncedAt: true,
      requestedVersion: true,
      syncedVersion: true,
      retryAt: true,
    },
  });
  const enabled = calendarEnabled(),
    active = connection?.state === "ACTIVE";
  if (enabled && active && connection.retryAt <= new Date())
    refreshCalendarAfterVisit(userId);
  return (
    <section className="border-b border-slate-700 pb-8 mb-9 space-y-5 max-w-3xl">
      <h2 className="text-xl">Личный Google Calendar</h2>
      <p className="text-sm text-slate-300 leading-relaxed">
        Сроки ваших групп — в отдельном календаре Student Value. Для готовых и
        сданных работ личные напоминания выключаются.
      </p>
      <details className="text-xs text-slate-400 leading-relaxed">
        <summary className="cursor-pointer text-link min-h-11">
          Доступ и обновление данных
        </summary>
        <p className="mt-3">
          В Google передаются название работы, предмет, группа, срок и ваш этап.
          Личные заметки, списки студентов и другие календари не читаются.
          Изменения в Google не меняют учебные сведения здесь. Обновление
          запускается после действий и при открытии календаря; незавершённые
          запросы проверяются также ежедневно. Статус «готово» не подтверждает
          зачёт преподавателем.
        </p>
      </details>
      {error && (
        <p role="alert" className="text-sm text-rose-200">
          Подключение не завершено. Выберите тот же Google аккаунт, которым
          входите в Student Value, и разрешите создание отдельного календаря.
          Вход на сайт продолжает работать.
        </p>
      )}
      {connected && connection?.state === "ACTIVE" && (
        <p role="status" className="text-sm text-blue-200">
          Разрешение получено. Календарь и события создаются после
          подтверждённых ответов Google.
        </p>
      )}
      {!enabled ? (
        <p className="quiet-empty">
          Подключение пока не настроено владельцем. Разовый экспорт ниже
          доступен.
        </p>
      ) : (
        <>
          {(!active || !connection) && (
            <form method="post" action="/api/calendar/connect">
              <button className="action-primary">
                {connection && connection.state !== "DISCONNECTED"
                  ? "Повторно подключить Google Calendar"
                  : "Подключить Google Calendar"}
              </button>
            </form>
          )}
          {connection && (
            <div className="space-y-4">
              <p className="text-sm text-slate-200">
                {connection.state === "DISCONNECTED"
                  ? "Синхронизация отключена"
                  : connection.state === "REAUTH_REQUIRED"
                    ? "Нужно повторное разрешение Google"
                    : connection.provisioning === "UNCERTAIN"
                      ? "Нужно проверить создание календаря"
                      : connection.lastErrorCode
                        ? "Обновление требует внимания"
                        : connection.requestedVersion > connection.syncedVersion
                          ? "Изменения ожидают обновления в Google"
                          : connection.lastSyncedAt
                            ? "Google Calendar обновлён"
                            : "Подключение выполняется"}
              </p>
              {connection.calendarId && (
                <a
                  href="https://calendar.google.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                >
                  Открыть Google Calendar ↗
                </a>
              )}
              {connection.lastSyncedAt && (
                <p className="text-xs text-slate-400">
                  Обновлено:{" "}
                  {formatInTimeZone(
                    connection.lastSyncedAt,
                    "Europe/Moscow",
                    "dd.MM.yyyy HH:mm",
                  )}{" "}
                  · Москва
                </p>
              )}
              {connection.lastErrorCode && (
                <p className="text-sm text-rose-200">
                  {messages[connection.lastErrorCode] ??
                    "Google не подтвердил обновление. Попробуйте позже или сообщите владельцу."}
                </p>
              )}
              {active && (
                <>
                  <OperationForm
                    action={saveCalendarRemindersAction}
                    label="Сохранить напоминания"
                  >
                    <fieldset className="space-y-3">
                      <legend className="text-sm mb-4">
                        Напоминать о невыполненной работе
                      </legend>
                      {[
                        [4320, "За 3 дня"],
                        [1440, "За день"],
                        [0, "В день срока"],
                      ].map(([minutes, label]) => (
                        <label
                          key={minutes}
                          className="flex gap-3 text-sm items-center min-h-11"
                        >
                          <input
                            type="checkbox"
                            name="reminder"
                            value={minutes}
                            defaultChecked={connection.reminderMinutes.includes(
                              Number(minutes),
                            )}
                            className="w-5 h-5 accent-blue-500"
                          />
                          {label}
                        </label>
                      ))}
                    </fieldset>
                    <p className="text-xs text-slate-400">
                      Если время срока неизвестно, событие занимает весь день, а
                      напоминания отсчитываются от начала дня по Москве. Для
                      точного срока — от указанного времени. Можно выключить все
                      напоминания.
                    </p>
                  </OperationForm>
                  <OperationForm
                    action={syncCalendarNowAction}
                    label="Обновить сейчас"
                  >
                    <p className="text-xs text-slate-400">
                      Сроки и этапы работы обновляются автоматически. Если
                      изменение ещё не появилось, запросите обновление.
                    </p>
                  </OperationForm>
                  {connection.provisioning === "UNCERTAIN" &&
                    !connection.calendarId && (
                      <details>
                        <summary className="text-link cursor-pointer min-h-11">
                          Восстановить созданный календарь
                        </summary>
                        <OperationForm
                          action={recoverCalendarAction}
                          label="Проверить первоначальный календарь"
                        >
                          <p className="text-xs text-slate-400">
                            В Google Calendar откройте настройки календаря
                            «Student Value 1.984» → Интеграция календаря →
                            Идентификатор. Приложение проверит, что этот
                            календарь создан им именно для вас.
                          </p>
                          <input
                            name="calendarId"
                            aria-label="Идентификатор календаря Student Value"
                            required
                            className={inputClass}
                          />
                        </OperationForm>
                        <details className="mt-4">
                          <summary className="text-sm text-slate-400 cursor-pointer min-h-11">
                            Календарь не появился в Google
                          </summary>
                          <OperationForm
                            action={retryCalendarCreationAction}
                            label="Повторить после моей проверки"
                          >
                            <label className="flex gap-3 text-sm min-h-11 items-start">
                              <input
                                required
                                type="checkbox"
                                name="checked"
                                value="yes"
                                className="w-5 h-5 shrink-0 accent-blue-500"
                              />
                              Я проверил Google Calendar: календарь Student
                              Value не был создан.
                            </label>
                            <p className="text-xs text-slate-400">
                              Если календарь существует, используйте его
                              идентификатор выше. Повторное создание без
                              проверки может создать дубликат.
                            </p>
                          </OperationForm>
                        </details>
                      </details>
                    )}
                  {connection.calendarId &&
                    ["NOT_FOUND", "GONE"].includes(
                      connection.lastErrorCode ?? "",
                    ) && (
                      <OperationForm
                        action={replaceDeletedCalendarAction}
                        label="Заменить удалённый календарь"
                      >
                        <p className="text-xs text-slate-400">
                          Google сначала должен подтвердить удаление прежнего
                          календаря. Существующий календарь не заменяется.
                        </p>
                      </OperationForm>
                    )}
                  <details>
                    <summary className="text-sm text-slate-400 min-h-11 cursor-pointer">
                      Отключить синхронизацию
                    </summary>
                    <OperationForm
                      action={disconnectCalendarAction}
                      label="Отключить Google Calendar"
                    >
                      <p className="text-xs text-slate-400">
                        Приложение снимет свои напоминания, отзовёт разрешение и
                        удалит сохранённый токен. Сам календарь и учебная
                        история останутся. Если Google недоступен, потребуется
                        проверить отключение в Google вручную.
                      </p>
                    </OperationForm>
                  </details>
                </>
              )}
            </div>
          )}
        </>
      )}
      <p className="text-xs text-slate-500">
        Будущие подтверждённые сроки и последние 30 дней. Время — по Москве.
      </p>
    </section>
  );
}
