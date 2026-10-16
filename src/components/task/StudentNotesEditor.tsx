"use client";

import React, { useState, useTransition } from "react";
import { saveStudentNotesAction } from "@/server/actions/task-actions";
import { StudentTaskProgressStatus } from "@prisma/client";
import { Button } from "@/components/ui/Button";
import { Save, Loader2, Check } from "lucide-react";

interface StudentNotesEditorProps {
  taskId: string;
  initialNotes: string | null;
  currentStatus: StudentTaskProgressStatus;
}

export function StudentNotesEditor({ taskId, initialNotes, currentStatus }: StudentNotesEditorProps) {
  const [notes, setNotes] = useState(initialNotes || "");
  const [isPending, startTransition] = useTransition();
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      await saveStudentNotesAction(taskId, notes);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    });
  };

  return (
    <div className="space-y-2">
      <textarea
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Личные ссылки на черновик отчета, репозиторий GitHub, заметки к защите (видны только вам)..."
        className="w-full bg-slate-950/80 border border-slate-800 rounded-md p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500">Приватно</span>
        <Button
          onClick={handleSave}
          size="sm"
          variant="secondary"
          disabled={isPending || notes === (initialNotes || "")}
          className="gap-1.5 h-7 text-xs"
        >
          {isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isSaved ? (
            <Check className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>{isSaved ? "Сохранено" : "Сохранить"}</span>
        </Button>
      </div>
    </div>
  );
}
