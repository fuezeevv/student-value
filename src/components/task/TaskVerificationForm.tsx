"use client";
import React, { useState, useTransition } from "react";
import { recordTaskVerificationAction } from "@/server/actions/task-actions";
import { Button } from "@/components/ui/Button";
/** Record a teacher result as headman; never label this as direct teacher action. */
export function TaskVerificationForm({
  taskId,
  students,
}: {
  taskId: string;
  students: Array<{ id: string; nickname: string }>;
}) {
  const [student, setStudent] = useState(students[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [quote, setQuote] = useState("");
  const [type, setType] = useState<"TEACHER_STATEMENT" | "OFFICIAL_DOCUMENT">(
    "TEACHER_STATEMENT",
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  return (
    <form
      className="p-5 border border-slate-800 rounded-lg space-y-3 text-xs"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          try {
            await recordTaskVerificationAction(taskId, student, {
              title,
              quoteText: quote,
              type,
            });
            setMessage("Подтверждение преподавателя записано старостой");
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "Не удалось записать результат",
            );
          }
        });
      }}
    >
      <h3 className="font-semibold text-sm">
        Записать подтверждение преподавателя
      </h3>
      <p className="text-slate-400">
        Источник относится к результату выбранного студента. Автор записи в
        системе — староста.
      </p>
      <label className="block">
        Студент
        <select
          aria-label="Студент для подтверждения"
          className="block w-full bg-slate-800 p-2 mt-1 rounded"
          value={student}
          onChange={(e) => setStudent(e.target.value)}
        >
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nickname}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Вид источника
        <select
          aria-label="Вид источника подтверждения"
          className="block w-full bg-slate-800 p-2 mt-1 rounded"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
        >
          <option value="TEACHER_STATEMENT">Слова преподавателя</option>
          <option value="OFFICIAL_DOCUMENT">
            Официальная ведомость или документ
          </option>
        </select>
      </label>
      <label className="block">
        Документ или занятие
        <input
          aria-label="Источник подтверждения"
          required
          minLength={3}
          maxLength={300}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Кто подтвердил, когда и где"
          className="block w-full bg-slate-800 p-2 mt-1 rounded"
        />
      </label>
      <label className="block">
        Основание результата
        <textarea
          aria-label="Основание подтверждения"
          required
          minLength={12}
          maxLength={6000}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          placeholder="Цитата или запись в ведомости о приёме этой работы"
          className="block w-full bg-slate-800 p-2 mt-1 rounded"
        />
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        Записать результат с источником
      </Button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
