"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  Shield,
  Bot,
  BookOpen,
  Calendar,
  Megaphone,
  Users,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  ArrowRight,
  Clock,
  Edit3,
  Save,
  Check,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  reviewSuggestionAction,
  createAnnouncementAction,
  updateTeacherCourseAction,
  linkEnrollmentAction,
  updateDeadlineAction,
} from "@/server/actions/admin-actions";
import {
  formatDeadlineType,
  formatDeadlineProvenance,
} from "@/lib/utils/formatters";

export interface AdminData {
  deadlines: Array<{
    id: string;
    taskId: string;
    taskTitle: string;
    courseShortTitle: string;
    date: string;
    type: string;
    provenance: string;
  }>;
  suggestions: Array<{
    id: string;
    entityType: string;
    title: string;
    confidence: number;
    suggestedData: any;
    status: string;
    reviewNotes: string | null;
    createdAt: string;
  }>;
  courses: Array<{
    id: string;
    code: string;
    title: string;
    shortTitle: string;
    format: string | null;
    softwareRequired: string | null;
    teachers: Array<{
      id: string;
      teacherId: string;
      fullName: string;
      role: string | null;
      status: string;
      notes: string | null;
    }>;
  }>;
  announcements: Array<{
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    priority: string;
    publishedAt: string;
  }>;
  enrollments: Array<{
    id: string;
    fullName: string;
    subgroup: number | null;
    studentIdNumber: string | null;
    status: string;
    userId: string | null;
    userNickname: string | null;
  }>;
  auditLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    details: any;
    createdAt: string;
    userNickname: string | null;
  }>;
  users: Array<{
    id: string;
    nickname: string;
  }>;
}

export function AdminClient({ data }: { data: AdminData }) {
  const [activeTab, setActiveTab] = useState<
    "ai" | "deadlines" | "announcements" | "courses" | "members" | "audit"
  >("ai");
  const [isPending, startTransition] = useTransition();

  // Announcement Form State
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annPinned, setAnnPinned] = useState(false);
  const [annPriority, setAnnPriority] = useState<"NORMAL" | "HIGH" | "URGENT">(
    "NORMAL",
  );
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Link Enrollment State
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  // Deadline Editing State
  const [editingDeadlineId, setEditingDeadlineId] = useState<string | null>(
    null,
  );
  const [editDateValue, setEditDateValue] = useState("");
  const [deadlineSourceNote, setDeadlineSourceNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [editTypeValue, setEditTypeValue] = useState<"HARD" | "SOFT">("HARD");

  const handleReview = (
    suggestionId: string,
    status: "APPROVED" | "REJECTED",
    notes: string,
  ) => {
    startTransition(async () => {
      await reviewSuggestionAction(suggestionId, status, notes);
      setActionSuccess(
        `Предложение переведено в статус: ${status === "APPROVED" ? "Одобрено" : "Отклонено"}`,
      );
    });
  };

  const handleCreateAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await createAnnouncementAction({
        title: annTitle,
        content: annContent,
        isPinned: annPinned,
        priority: annPriority,
      });
      setAnnTitle("");
      setAnnContent("");
      setActionSuccess("Объявление успешно опубликовано для всей группы!");
    });
  };

  const handleLinkEnrollment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollmentId || !selectedUserId) return;
    startTransition(async () => {
      await linkEnrollmentAction(selectedEnrollmentId, selectedUserId);
      setActionSuccess("Запись ведомости успешно привязана к аккаунту!");
      setSelectedEnrollmentId("");
      setSelectedUserId("");
    });
  };

  const handleStartEditDeadline = (dl: AdminData["deadlines"][0]) => {
    setEditingDeadlineId(dl.id);
    setDeadlineSourceNote("");
    const dateObj = new Date(dl.date);
    const isoString = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateObj);
    setEditDateValue(isoString);
    setEditTypeValue(dl.type === "HARD" ? "HARD" : "SOFT");
  };

  const handleSaveDeadline = (deadlineId: string) => {
    if (!editDateValue) return;
    startTransition(async () => {
      try {
        setActionError(null);
        await updateDeadlineAction(
          deadlineId,
          editDateValue,
          editTypeValue,
          deadlineSourceNote,
        );
        setActionSuccess("Срок сдачи успешно изменен!");
        setEditingDeadlineId(null);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Не удалось изменить срок",
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <p role="alert" className="text-red-400 text-sm">
          {actionError}
        </p>
      )}
      {actionSuccess && (
        <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-950/30 text-xs text-emerald-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Admin Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("ai")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "ai"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Bot className="w-4 h-4 text-cyan-400" />
          <span>AI Ingestion ({data.suggestions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("deadlines")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "deadlines"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Calendar className="w-4 h-4 text-cyan-400" />
          <span>Дедлайны и сроки ({data.deadlines?.length ?? 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("announcements")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "announcements"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Megaphone className="w-4 h-4 text-cyan-400" />
          <span>Объявления ({data.announcements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("courses")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "courses"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span>Курсы и преподаватели</span>
        </button>

        <button
          onClick={() => setActiveTab("members")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "members"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <Users className="w-4 h-4 text-cyan-400" />
          <span>Студенты и роли ({data.enrollments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
            activeTab === "audit"
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
          }`}
        >
          <History className="w-4 h-4 text-cyan-400" />
          <span>Аудит-лог ({data.auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: AI INGESTION QUEUE */}
      {activeTab === "ai" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Bot className="w-4 h-4 text-cyan-400" />
                Очередь предложений AI Ingestion
              </h2>
              <Badge variant="warning" className="text-[10px]">
                В разработке / ручной импорт
              </Badge>
            </div>
            <span className="text-xs text-slate-400">
              * Это очередь ручного ревью; одобрение не публикует изменения
            </span>
          </div>

          {data.suggestions.length > 0 ? (
            <div className="space-y-3">
              {data.suggestions.map((sug) => (
                <div
                  key={sug.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        {sug.entityType}
                      </Badge>
                      <span className="font-bold text-sm text-white">
                        {sug.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-cyan-400">
                        Уверенность модели: {Math.round(sug.confidence * 100)}%
                      </span>
                      <Badge
                        variant={
                          sug.status === "APPROVED"
                            ? "success"
                            : sug.status === "REJECTED"
                              ? "destructive"
                              : "warning"
                        }
                      >
                        {sug.status === "APPROVED"
                          ? "Одобрено"
                          : sug.status === "REJECTED"
                            ? "Отклонено"
                            : "Ожидает ревью"}
                      </Badge>
                    </div>
                  </div>

                  {/* Human-readable proposal summary */}
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-xs text-slate-300">
                    <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                      <span>Предлагаемые изменения:</span>
                    </div>
                    {sug.suggestedData?.title && (
                      <div>
                        <span className="text-slate-500">
                          Задание / сущность:
                        </span>{" "}
                        <strong className="text-slate-200">
                          {sug.suggestedData.title}
                        </strong>
                      </div>
                    )}
                    {sug.suggestedData?.deadline && (
                      <div>
                        <span className="text-slate-500">Срок сдачи:</span>{" "}
                        <span className="text-cyan-300 font-mono">
                          {new Date(
                            sug.suggestedData.deadline,
                          ).toLocaleDateString("ru-RU")}
                        </span>
                      </div>
                    )}
                    {sug.suggestedData?.description && (
                      <p className="text-slate-400 text-[11px] leading-relaxed pt-1">
                        {sug.suggestedData.description}
                      </p>
                    )}
                  </div>

                  {/* Collapsible raw technical payload */}
                  <details className="text-xs group">
                    <summary className="text-[11px] text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium select-none">
                      Показать технические данные (JSON payload)
                    </summary>
                    <div className="mt-2 p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-300 overflow-x-auto border border-slate-800/60">
                      <pre>{JSON.stringify(sug.suggestedData, null, 2)}</pre>
                    </div>
                  </details>

                  {sug.reviewNotes && (
                    <div className="text-xs text-slate-400">
                      Заметка ревьюера:{" "}
                      <span className="text-slate-200">{sug.reviewNotes}</span>
                    </div>
                  )}

                  {sug.status === "PENDING" && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() =>
                          handleReview(sug.id, "APPROVED", "Одобрено старостой")
                        }
                        disabled={isPending}
                        className="text-xs gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Отметить одобренным</span>
                      </Button>

                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() =>
                          handleReview(
                            sug.id,
                            "REJECTED",
                            "Отклонено старостой",
                          )
                        }
                        disabled={isPending}
                        className="text-xs gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Отклонить</span>
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              В очереди предложений пусто.
            </div>
          )}
        </div>
      )}

      {/* TAB 2: DEADLINES & SCHEDULE MANAGEMENT */}
      {activeTab === "deadlines" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              Управление контрольными сроками группы
            </h2>
            <span className="text-xs text-slate-400">
              Любое изменение срока сразу отображается у студентов и попадает в
              аудит-лог
            </span>
          </div>

          <div className="space-y-2.5">
            {data.deadlines?.map((dl) => {
              const isEditing = editingDeadlineId === dl.id;
              const prov = formatDeadlineProvenance(dl.provenance);

              return (
                <div
                  key={dl.id}
                  data-deadline-id={dl.id}
                  className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px]"
                      >
                        {dl.courseShortTitle}
                      </Badge>
                      <span className="font-bold text-sm text-white truncate">
                        {dl.taskTitle}
                      </span>
                      <Badge variant={prov.variant} className="text-[10px]">
                        {prov.label}
                      </Badge>
                    </div>
                    <div className="text-slate-400 flex items-center gap-3">
                      <span>
                        Текущий срок:{" "}
                        <strong className="text-slate-200">
                          {new Date(dl.date).toLocaleDateString("ru-RU", {
                            timeZone: "Europe/Moscow",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </strong>
                      </span>
                      <span>·</span>
                      <span
                        className={
                          dl.type === "HARD" ? "text-rose-400" : "text-blue-400"
                        }
                      >
                        {formatDeadlineType(dl.type)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <input
                          aria-label="Основание изменения срока"
                          placeholder="Источник и причина переноса"
                          value={deadlineSourceNote}
                          onChange={(e) =>
                            setDeadlineSourceNote(e.target.value)
                          }
                          className="bg-slate-800 text-xs p-2 rounded"
                        />
                        <input
                          type="date"
                          aria-label="Новая дата срока"
                          value={editDateValue}
                          onChange={(e) => setEditDateValue(e.target.value)}
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                        />
                        <select
                          value={editTypeValue}
                          onChange={(e: any) =>
                            setEditTypeValue(e.target.value)
                          }
                          className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                        >
                          <option value="HARD">Жесткий</option>
                          <option value="SOFT">Рекомендуемый</option>
                        </select>
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => handleSaveDeadline(dl.id)}
                          disabled={isPending}
                          className="text-xs h-7 px-2.5 gap-1"
                        >
                          <Save className="w-3 h-3" />
                          <span>Сохранить</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingDeadlineId(null)}
                          disabled={isPending}
                          className="text-xs h-7 px-2"
                        >
                          Отмена
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStartEditDeadline(dl)}
                        disabled={isPending}
                        className="text-xs h-7 px-2.5 gap-1"
                      >
                        <Edit3 className="w-3 h-3 text-cyan-400" />
                        <span>Перенести срок</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ANNOUNCEMENTS */}
      {activeTab === "announcements" && (
        <div className="space-y-6">
          {/* New Announcement Form */}
          <Card className="glass-panel border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-cyan-400" />
              Опубликовать объявление для группы
            </h2>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Заголовок объявления
                </label>
                <input
                  type="text"
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Например: Перенос контрольной недели по ОТУ"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-cyan-400"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Текст объявления
                </label>
                <textarea
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Подробный текст сообщения для группы..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-cyan-400"
                  required
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-xs text-slate-300">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={annPinned}
                      onChange={(e) => setAnnPinned(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-800 text-cyan-500"
                    />
                    <span>Закрепить сверху</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <span>Приоритет:</span>
                    <select
                      value={annPriority}
                      onChange={(e: any) => setAnnPriority(e.target.value)}
                      className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-xs text-white"
                    >
                      <option value="NORMAL">Обычный</option>
                      <option value="HIGH">Высокий</option>
                      <option value="URGENT">Срочный</option>
                    </select>
                  </div>
                </div>

                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  disabled={isPending}
                  className="text-xs"
                >
                  Опубликовать
                </Button>
              </div>
            </form>
          </Card>

          {/* List of existing announcements */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Опубликованные объявления ({data.announcements.length})
            </h3>
            {data.announcements.map((ann) => (
              <div
                key={ann.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-white">
                    {ann.title}
                  </span>
                  <div className="flex items-center gap-2">
                    {ann.isPinned && (
                      <Badge variant="warning">Закреплено</Badge>
                    )}
                    <Badge variant="secondary">
                      {ann.priority === "URGENT"
                        ? "Срочно"
                        : ann.priority === "HIGH"
                          ? "Высокий"
                          : "Обычный"}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-slate-300">{ann.content}</p>
                <div className="text-[11px] text-slate-500 pt-1">
                  {new Date(ann.publishedAt).toLocaleString("ru-RU")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: COURSES & TEACHERS */}
      {activeTab === "courses" && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-cyan-400" />
            Управление курсами и преподавателями
          </h2>

          <div className="space-y-3">
            {data.courses.map((course) => (
              <Card
                key={course.id}
                className="glass-panel border-slate-800 p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-xs">
                      {course.code}
                    </Badge>
                    <span className="font-semibold text-sm text-white">
                      {course.title}
                    </span>
                  </div>
                  <Link
                    href={`/courses/${course.id}`}
                    className="text-xs text-cyan-400 hover:text-cyan-300"
                  >
                    Перейти к курсу →
                  </Link>
                </div>

                <div className="text-xs text-slate-400">
                  Формат: {course.format || "Очный"} · ПО:{" "}
                  {course.softwareRequired || "Не указано"}
                </div>

                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <span className="text-[11px] uppercase font-bold text-slate-500">
                    Преподаватели курса:
                  </span>
                  {course.teachers.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between text-xs py-1 px-2 rounded bg-slate-950/60"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-200">
                          {t.fullName}
                        </span>
                        {t.role && (
                          <span className="text-slate-400">({t.role})</span>
                        )}
                      </div>
                      <Badge
                        variant={
                          t.status === "DISPUTED" ? "destructive" : "success"
                        }
                        className="text-[10px]"
                      >
                        {t.status === "DISPUTED"
                          ? "Конфликт источников"
                          : "Подтвержден"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: MEMBERS & ROLES */}
      {activeTab === "members" && (
        <div className="space-y-6">
          {/* Link Enrollment Form */}
          <Card className="glass-panel border-slate-800 p-5 space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-cyan-400" />
              Привязка записи студента (Enrollment Verification)
            </h2>

            <form
              onSubmit={handleLinkEnrollment}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Студент из ведомости группы:
                </label>
                <select
                  value={selectedEnrollmentId}
                  onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  required
                >
                  <option value="">Выберите студента...</option>
                  {data.enrollments.map((enr) => (
                    <option key={enr.id} value={enr.id}>
                      {enr.fullName} (
                      {enr.status === "VERIFIED"
                        ? "Подтвержден"
                        : "Не привязан"}
                      )
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Аккаунт пользователя:
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white"
                  required
                >
                  <option value="">Выберите аккаунт...</option>
                  {data.users.map((u) => (
                    <option key={u.id} value={u.id}>
                      @{u.nickname}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={isPending}
                className="text-xs h-9"
              >
                Верифицировать привязку
              </Button>
            </form>
          </Card>

          {/* Roster Table */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">ФИО</th>
                  <th className="py-2.5 px-4">Подгруппа</th>
                  <th className="py-2.5 px-4">Номер в ведомости</th>
                  <th className="py-2.5 px-4">Статус</th>
                  <th className="py-2.5 px-4">Аккаунт</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.enrollments.map((enr) => (
                  <tr key={enr.id}>
                    <td className="py-2.5 px-4 font-medium text-white">
                      {enr.fullName}
                    </td>
                    <td className="py-2.5 px-4">{enr.subgroup ?? "—"}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-400">
                      {enr.studentIdNumber || "—"}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge
                        variant={
                          enr.status === "VERIFIED" ? "success" : "muted"
                        }
                      >
                        {enr.status === "VERIFIED"
                          ? "Подтвержден"
                          : "Не привязан"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-cyan-400">
                      {enr.userNickname ? `@${enr.userNickname}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: AUDIT LOG */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
            <History className="w-4 h-4 text-cyan-400" />
            Журнал системных действий (Audit Log)
          </h2>

          <div className="space-y-2">
            {data.auditLogs.map((log) => {
              const actionLabel =
                log.action === "UPDATE_DEADLINE"
                  ? "Перенос дедлайна"
                  : log.action === "CREATE_TASK"
                    ? "Создание задания"
                    : log.action === "CREATE_ANNOUNCEMENT"
                      ? "Публикация объявления"
                      : log.action === "VERIFY_PROGRESS"
                        ? "Верификация сдачи"
                        : log.action === "LINK_ENROLLMENT_USER"
                          ? "Привязка студента к аккаунту"
                          : log.action === "REVIEW_AI_SUGGESTION"
                            ? "Ревью AI предложения"
                            : log.action === "MERGE_EMPTY_COURSE"
                              ? "Объединение записей одного предмета"
                              : log.action === "ARCHIVE_UNUSED_DUPLICATE"
                                ? "Убрана повторная запись задания"
                                : log.action === "CONFIRM_TEACHING_ROLE"
                                  ? "Подтверждён вид занятий преподавателя"
                                  : ((
                                      {
                                        RECONSTRUCT_LESSON:
                                          "Восстановлено занятие",
                                        IMPORT_TEACHING_FILE:
                                          "Добавлен учебный файл",
                                        IMPORT_TEACHING_LINK:
                                          "Добавлена ссылка на материал",
                                        ADD_SCHEDULE_COURSE:
                                          "Добавлен предмет из расписания",
                                      } as Record<string, string>
                                    )[log.action] ?? log.action);

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 text-xs flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white font-mono">
                        {actionLabel}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {log.entityType}
                      </Badge>
                    </div>
                    <div className="text-slate-400 font-mono text-[11px]">
                      Автор:{" "}
                      {log.userNickname ? `@${log.userNickname}` : "Система"}
                    </div>
                  </div>

                  <div className="text-slate-500 font-mono text-[11px]">
                    {new Date(log.createdAt).toLocaleString("ru-RU")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
