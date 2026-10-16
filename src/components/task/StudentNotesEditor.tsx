"use client";

import { useState, useTransition } from "react";
import { saveStudentNotesAction } from "@/server/actions/task-actions";
import type { StudentTaskProgressStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Loader2, Check } from "lucide-react";

export function StudentNotesEditor({
  taskId,
  initialNotes,
}: {
  taskId: string;
  initialNotes: string | null;
  currentStatus: StudentTaskProgressStatus;
}) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [saved, setSaved] = useState(initialNotes || "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const handleSave = () =>
    startTransition(async () => {
      setError("");
      try {
        await saveStudentNotesAction(taskId, notes);
        setSaved(notes);
        setMessage("Сохранено");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Не удалось сохранить заметку. Попробуйте ещё раз.",
        );
      }
    });
  return (
    <div className="space-y-3">
      <textarea
        aria-label="Мои личные заметки"
        rows={4}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setMessage("");
        }}
        placeholder="Ссылка на отчёт, черновик или вопросы к защите…"
        className="w-full bg-[#111f34] border border-slate-600 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-400 focus:border-blue-400 transition-colors"
      />
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-slate-400">Видны только вам</span>
        <Button
          onClick={handleSave}
          size="sm"
          variant="secondary"
          disabled={pending || notes === saved}
          className="min-h-11"
        >
          {pending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : message ? (
            <Check size={15} />
          ) : null}
          <span role="status">
            {pending ? "Сохраняю…" : message || "Сохранить"}
          </span>
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-rose-300 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
