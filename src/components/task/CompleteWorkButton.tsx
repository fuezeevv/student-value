"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateStudentProgressAction } from "@/server/actions/task-actions";
export function CompleteWorkButton({
  taskId,
  complete,
  accepted = false,
}: {
  taskId: string;
  complete: boolean;
  accepted?: boolean;
}) {
  const [pending, start] = useTransition(),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        disabled={pending || accepted}
        className={
          complete ? "completion-button is-complete" : "completion-button"
        }
        aria-label={complete ? "Вернуть к выполнению" : "Отметить выполненным"}
        onClick={() => {
          setError("");
          start(async () => {
            try {
              await updateStudentProgressAction(
                taskId,
                complete ? "IN_PROGRESS" : "READY",
              );
              router.refresh();
            } catch {
              setError("Не удалось сохранить отметку. Попробуйте ещё раз.");
            }
          });
        }}
      >
        {pending
          ? "Сохраняю…"
          : complete
            ? "✓ Выполнено"
            : "Отметить выполненным"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-300 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
