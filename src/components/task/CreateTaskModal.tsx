"use client";

import React, { useState, useTransition } from "react";
import { TaskType, DeadlineType } from "@prisma/client";
import { createTaskAction } from "@/server/actions/task-actions";
import { Button } from "@/components/ui/Button";
import { Plus, X, Loader2 } from "lucide-react";

interface CreateTaskModalProps {
  courseOfferingId?: string;
  courses?: { id: string; title: string; shortTitle: string }[];
}

export function CreateTaskModal({
  courseOfferingId,
  courses,
}: CreateTaskModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState(
    courseOfferingId || (courses?.[0]?.id ?? ""),
  );
  const [sourceNote, setSourceNote] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TaskType>(TaskType.LABORATORY);
  const [number, setNumber] = useState<string>("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineType, setDeadlineType] = useState<DeadlineType>(
    DeadlineType.HARD,
  );
  const [variantNumber, setVariantNumber] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg("Укажите название задания");
      return;
    }

    startTransition(async () => {
      try {
        await createTaskAction({
          courseOfferingId: selectedCourseId,
          title: title.trim(),
          sourceNote,
          description: description.trim() || undefined,
          type,
          number: number ? parseInt(number, 10) : undefined,
          deadlineDate: deadlineDate || undefined,
          deadlineType,
          isTimeStrict: false,
          variantNumber: variantNumber.trim() || undefined,
        });

        // Reset and close
        setTitle("");
        setDescription("");
        setNumber("");
        setDeadlineDate("");
        setVariantNumber("");
        setIsOpen(false);
      } catch (err: unknown) {
        if (err instanceof Error) {
          setErrorMsg(err.message);
        } else {
          setErrorMsg("Произошла ошибка при создании задания");
        }
      }
    });
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        variant="primary"
        size="sm"
        className="gap-1.5"
      >
        <Plus className="w-4 h-4" />
        <span>Новое задание</span>
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-100 mb-1">
              Добавить учебное задание
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Задание сразу появится у всей группы. Общие опубликованные работы
              восьми открытых групп видны и без входа; исходные файлы и личные
              результаты доступны участникам.
            </p>

            {errorMsg && (
              <div className="text-xs text-red-400 bg-red-950/50 border border-red-800 p-2.5 rounded mb-4">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block text-xs text-slate-300">
                Источник задания и срока
                <textarea
                  aria-label="Источник задания и срока"
                  required
                  minLength={8}
                  value={sourceNote}
                  onChange={(e) => setSourceNote(e.target.value)}
                  placeholder="Документ или слова преподавателя, дата и контекст"
                  className="w-full bg-slate-800 p-2 rounded mt-1"
                />
              </label>
              {/* Course Selection if courses array is available */}
              {courses && courses.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Дисциплина *
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} ({c.shortTitle})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Task Type and Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Тип задания *
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TaskType)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="LABORATORY">Лабораторная работа</option>
                    <option value="HOMEWORK">Домашнее задание</option>
                    <option value="CALCULATION_WORK">
                      Расчетная работа (РР)
                    </option>
                    <option value="EXERCISE">Упражнение на паре</option>
                    <option value="PRACTICAL">Практическое задание</option>
                    <option value="TEST">Контрольная работа / тест</option>
                    <option value="COURSEWORK">Курсовая работа</option>
                    <option value="OTHER">Прочее</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Номер (опционально)
                  </label>
                  <input
                    type="number"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Например, 1"
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Название задания *
                </label>
                <input
                  type="text"
                  aria-label="Название задания"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Например: ЛР1: Ознакомительная работа по Lex"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Требования и описание
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Что нужно сделать, какие тесты написать, в какой среде выполнять..."
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Deadline */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded border border-slate-800">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Срок сдачи (Дедлайн)
                  </label>
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  />
                  <span className="text-[10px] text-slate-500">
                    Пусто = Срок не указан
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Тип срока
                  </label>
                  <select
                    value={deadlineType}
                    onChange={(e) =>
                      setDeadlineType(e.target.value as DeadlineType)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500"
                  >
                    <option value="HARD">Жесткий дедлайн (HARD)</option>
                    <option value="SOFT">Рекомендуемый срок (SOFT)</option>
                  </select>
                </div>
              </div>

              {/* Optional Variant */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Вариант (опционально)
                </label>
                <input
                  type="text"
                  value={variantNumber}
                  onChange={(e) => setVariantNumber(e.target.value)}
                  placeholder="Например: Вариант 4 или Общий для всех"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                >
                  Отмена
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isPending}
                  className="gap-2"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Опубликовать задание</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
