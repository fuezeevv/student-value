import type { ClassSession } from "@prisma/client";
import { formatInTimeZone } from "date-fns-tz";
import { OperationForm } from "./OperationForm";
import { inputClass } from "./styles";
import {
  saveLessonAction,
  addMaterialAction,
} from "@/server/actions/lesson-actions";
export function LessonForm({
  courseId,
  tasks,
  session,
}: {
  courseId: string;
  tasks: { id: string; title: string }[];
  session?: ClassSession & { tasks: { taskId: string }[] };
}) {
  return (
    <OperationForm
      action={saveLessonAction}
      label={session ? "Сохранить изменения" : "Сохранить занятие"}
    >
      <input type="hidden" name="courseOfferingId" value={courseId} />
      {session && (
        <>
          <input type="hidden" name="id" value={session.id} />
          <input type="hidden" name="version" value={session.version} />
        </>
      )}
      <label className="block text-sm">
        Тема занятия
        <input
          name="topic"
          required
          minLength={2}
          maxLength={240}
          defaultValue={session?.topic ?? ""}
          className={inputClass}
        />
      </label>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="text-sm">
          Дата
          <input
            type="date"
            name="day"
            required
            defaultValue={formatInTimeZone(
              session?.sessionDate ?? new Date(),
              "Europe/Moscow",
              "yyyy-MM-dd",
            )}
            className={inputClass}
          />
        </label>
        <label className="text-sm">
          Вид занятия
          <select
            name="type"
            defaultValue={session?.type ?? "OTHER"}
            className={inputClass}
          >
            <option value="OTHER">Занятие · вид уточняется</option>
            <option value="LECTURE">Лекция</option>
            <option value="PRACTICE">Практика</option>
            <option value="LAB">Лабораторное занятие</option>
            <option value="ORGANIZATIONAL">Организационное</option>
          </select>
        </label>
      </div>
      <details>
        <summary className="cursor-pointer min-h-11 text-sm">
          Время, аудитория и преподаватель
        </summary>
        <div className="grid sm:grid-cols-2 gap-4 mt-3">
          <label className="text-sm">
            Начало · Москва
            <input
              type="time"
              name="time"
              defaultValue={
                session?.isTimeKnown
                  ? formatInTimeZone(
                      session.sessionDate,
                      "Europe/Moscow",
                      "HH:mm",
                    )
                  : ""
              }
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Окончание
            <input
              type="time"
              name="endTime"
              defaultValue={
                session?.endsAt
                  ? formatInTimeZone(session.endsAt, "Europe/Moscow", "HH:mm")
                  : ""
              }
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Аудитория или место
            <input
              name="room"
              maxLength={160}
              defaultValue={session?.room ?? ""}
              className={inputClass}
            />
          </label>
          <label className="text-sm">
            Кто проводил
            <input
              name="taughtBy"
              maxLength={160}
              defaultValue={session?.taughtBy ?? ""}
              className={inputClass}
            />
          </label>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Если время или преподаватель неизвестны, оставьте поле пустым.
        </p>
      </details>
      <label className="block text-sm">
        Что проходили и что важно помнить
        <textarea
          name="summary"
          maxLength={20000}
          rows={5}
          defaultValue={session?.summary ?? ""}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Дополнительные сведения для группы
        <textarea
          name="notes"
          maxLength={10000}
          rows={3}
          defaultValue={session?.notes ?? ""}
          className={inputClass}
        />
      </label>
      <details open={Boolean(session?.recordingUrl)}>
        <summary className="cursor-pointer min-h-11 text-sm">
          Запись занятия и транскрипция
        </summary>
        <label className="block text-sm mt-3">
          Ссылка на запись в Google Drive или другом сервисе
          <input
            type="url"
            name="recordingUrl"
            defaultValue={session?.recordingUrl ?? ""}
            className={inputClass}
            placeholder="https://drive.google.com/…"
          />
        </label>
        <p className="text-xs text-slate-400 mt-2">
          Доступ к файлу настраивается в Drive. Файл остаётся там; Student Value
          хранит ссылку.
        </p>
        <label className="block text-sm mt-5">
          Текст транскрипции
          <textarea
            name="transcriptText"
            rows={8}
            maxLength={200000}
            className={inputClass}
            placeholder={
              session
                ? "Новая версия текста (необязательно)"
                : "Вставьте текст записи"
            }
          />
        </label>
        <p className="text-xs text-slate-400 mt-2">
          Новая версия сохранится отдельно от предыдущей. Слова в тексте не
          публикуют задания или сроки автоматически.
        </p>
      </details>
      {tasks.length > 0 && (
        <details>
          <summary className="cursor-pointer min-h-11 text-sm">
            Связанные работы
          </summary>
          <div className="space-y-3 mt-3">
            {tasks.map((task) => (
              <label
                key={task.id}
                className="flex gap-3 text-sm leading-relaxed"
              >
                <input
                  type="checkbox"
                  name="taskIds"
                  value={task.id}
                  defaultChecked={session?.tasks.some(
                    (link) => link.taskId === task.id,
                  )}
                  className="w-5 h-5 shrink-0 accent-blue-500"
                />
                {task.title}
              </label>
            ))}
          </div>
        </details>
      )}
      <label className="block text-sm">
        Откуда сведения
        <input
          name="sourceNote"
          required
          minLength={8}
          maxLength={4000}
          defaultValue={session?.sourceNote ?? ""}
          className={inputClass}
          placeholder="Например, запись занятия или уточнение преподавателя"
        />
      </label>
      <label className="block text-sm">
        Доступность
        <select
          name="status"
          defaultValue={session?.status ?? "PUBLISHED"}
          className={inputClass}
        >
          <option value="PUBLISHED">Показывать группе</option>
          <option value="DRAFT">Черновик · только редакторам предмета</option>
          <option value="CANCELLED">Занятие отменено · сообщить группе</option>
        </select>
      </label>
    </OperationForm>
  );
}
export function MaterialForm({
  courseId,
  sessionId,
}: {
  courseId: string;
  sessionId?: string;
}) {
  return (
    <OperationForm action={addMaterialAction} label="Добавить ссылку" reset>
      <input type="hidden" name="courseOfferingId" value={courseId} />
      {sessionId && <input type="hidden" name="sessionId" value={sessionId} />}
      <label className="block text-sm">
        Название
        <input
          name="title"
          required
          minLength={2}
          maxLength={240}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Ссылка
        <input
          type="url"
          name="url"
          required
          className={inputClass}
          placeholder="https://…"
        />
      </label>
      <label className="block text-sm">
        Откуда материал
        <input
          name="sourceNote"
          required
          minLength={8}
          maxLength={4000}
          className={inputClass}
        />
      </label>
      <label className="block text-sm">
        Пояснение
        <textarea
          name="description"
          maxLength={4000}
          rows={3}
          className={inputClass}
        />
      </label>
    </OperationForm>
  );
}
