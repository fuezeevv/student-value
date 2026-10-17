import { formatInTimeZone } from "date-fns-tz";
import { canEditCourse } from "@/server/domain/lessons";
import { OperationForm } from "@/components/workspace/OperationForm";
import { inputClass } from "@/components/workspace/styles";
import {
  editTaskContentAction,
  moveTaskDeadlineAction,
} from "@/server/actions/task-context-actions";
import { assignedVariants } from "@/server/domain/variants";
import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";
import { TaskVerificationForm } from "@/components/task/TaskVerificationForm";
import { hasPermission } from "@/lib/permissions/checker";
import { audienceMemberIds } from "@/server/domain/access";
import { taskVisibilityWhere } from "@/server/domain/access";
import {
  isTrustedAccepted,
  progressEvidenceInclude,
} from "@/server/domain/trust";
import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { requireCurrentUser } from "@/lib/auth/session";
import { calculateDeadlineStatus } from "@/server/services/deadline-service";
import { StatusSelect } from "@/components/task/StatusSelect";
import { StudentNotesEditor } from "@/components/task/StudentNotesEditor";
import { ArrowLeft } from "lucide-react";
import { formatDeadlineProvenance } from "@/lib/utils/formatters";

interface TaskPageProps {
  params: Promise<{ id: string }>;
}

export default async function TaskDetailPage({ params }: TaskPageProps) {
  const { id } = await params;
  const user = await requireCurrentUser();

  const task = await prisma.task.findFirst({
    where: { AND: [await taskVisibilityWhere(user), { id }] },
    include: {
      courseOffering: {
        include: {
          courseDefinition: true,
          teachers: { include: { teacher: true } },
        },
      },
      deadlines: {
        where: confirmedDeadlineWhere,
        orderBy: { date: "asc" },
        include: { sourceReference: { include: { source: true } } },
      },

      audiences: true,
      requirements: {
        include: { sourceReference: { include: { source: true } } },
        orderBy: { createdAt: "asc" },
      },
      sourceReference: {
        include: {
          source: true,
          createdBy: true,
        },
      },
      progress: {
        where: { userId: user.id },
        include: progressEvidenceInclude,
      },
      materials: {
        include: { material: true },
      },
    },
  });

  if (!task) {
    notFound();
  }

  const [deadlineHistory, contentHistory] = await Promise.all([
    prisma.deadline.findMany({
      where: {
        taskId: id,
        status: { in: ["ACTIVE", "SUPERSEDED"] },
        provenance: { not: "UNKNOWN" },
        sourceReference: { confidence: "CONFIRMED" },
      },
      include: {
        sourceReference: {
          include: { source: true, createdBy: { select: { nickname: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: {
        entityType: "TASK",
        entityId: id,
        action: "EDIT_TASK_CONTENT",
        details: { path: ["groupId"], equals: user.groupId },
      },
      include: { user: { select: { nickname: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const personalVariants = await assignedVariants(user, [task.id]);
  const userProgress = task.progress?.[0];
  const isAccepted = isTrustedAccepted(userProgress);
  const primaryDeadline = task.deadlines[0];
  const deadlineCalc = calculateDeadlineStatus(
    primaryDeadline ? primaryDeadline.date : null,
    new Date(),
    isAccepted,
    primaryDeadline?.isTimeStrict ?? true,
  );

  // User's assigned variant
  const assignedVariant = personalVariants.get(task.id);

  const canVerifyProgress = false; // Own results require an independent verifier.
  const canRecordResult =
    hasPermission(user, "verify_progress") ||
    user.permissions.includes(`verify_progress:${task.courseOfferingId}`);
  const recipients = canRecordResult ? await audienceMemberIds(task.id) : [];
  const verificationTargets = recipients.length
    ? await prisma.user.findMany({
        where: { id: { in: recipients.filter((id) => id !== user.id) } },
        select: { id: true, nickname: true },
      })
    : [];

  return (
    <>
      <nav className="breadcrumb" aria-label="Путь">
        <Link href={`/courses/${task.courseOfferingId}`}>
          <ArrowLeft size={14} />
          {task.courseOffering.courseDefinition.shortTitle}
        </Link>
        <span>/</span>
        <span>Работа{task.number ? ` ${task.number}` : ""}</span>
      </nav>
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            {task.courseOffering.courseDefinition.shortTitle} ·{" "}
            {task.type === "LABORATORY"
              ? "Лабораторная работа"
              : task.type === "CALCULATION_WORK"
                ? "Расчётная работа"
                : task.type === "EXERCISE"
                  ? "Упражнение"
                  : "Задание"}
          </p>
          <h1 className="page-title">{task.title}</h1>
        </div>
      </div>
      <div className="task-workspace">
        <div>
          <article className="study-sheet">
            <h2>Что нужно сделать</h2>
            {task.description ? (
              <p className="description">{task.description}</p>
            ) : (
              <p>
                Описание работы ещё не добавлено. Уточните требования по
                источнику задания или у преподавателя.
              </p>
            )}
            {task.requirements.length > 0 && (
              <section className="mt-7">
                <h2>Уточнения к работе</h2>
                {task.requirements.map((requirement) => (
                  <div
                    key={requirement.id}
                    className="border-t border-slate-300 py-4"
                  >
                    <p className="whitespace-pre-wrap text-sm">
                      {requirement.content}
                    </p>
                    <details className="mt-3">
                      <summary className="text-xs cursor-pointer">
                        Источник · проверено редактором группы
                      </summary>
                      <blockquote className="text-xs whitespace-pre-wrap mt-2">
                        {requirement.sourceReference.quoteText}
                      </blockquote>
                      <p className="text-xs mt-2">
                        {requirement.sourceReference.source.title}
                      </p>
                    </details>
                  </div>
                ))}
              </section>
            )}
            <Link
              href={`/proposals/new?course=${task.courseOfferingId}&task=${task.id}`}
              className="text-sm underline mt-5 inline-block"
            >
              Предложить уточнение или сообщить об ошибке
            </Link>
            <div className="sheet-divider" />
            {assignedVariant ? (
              <div className="variant">
                <strong>
                  Ваш индивидуальный вариант: {assignedVariant.variantNumber}
                </strong>
                {assignedVariant.spec &&
                  typeof assignedVariant.spec === "object" && (
                    <pre className="mt-3">
                      {Object.entries(
                        assignedVariant.spec as Record<string, unknown>,
                      )
                        .map(([key, value]) => `${key}: ${String(value)}`)
                        .join("\n")}
                    </pre>
                  )}
              </div>
            ) : (
              <div className="variant">
                <strong>Вариант не назначен</strong>
                <p className="!text-xs !leading-relaxed mt-1">
                  Подтверждённого персонального назначения в приложении нет.
                </p>
              </div>
            )}
            {task.materials.length > 0 && (
              <div className="mt-7">
                <h2>Материалы к работе</h2>
                {task.materials.map(({ material }) => (
                  <a
                    key={material.id}
                    className="block py-3 border-t border-slate-300 text-sm"
                    href={material.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {material.title} ↗
                  </a>
                ))}
              </div>
            )}
          </article>
          <div className="source-details">
            <details>
              <summary>
                Источник задания ·{" "}
                {task.sourceReference?.confidence === "CONFIRMED"
                  ? "подтверждён"
                  : "требует уточнения"}
              </summary>
              {task.sourceReference ? (
                <>
                  <blockquote>{task.sourceReference.quoteText}</blockquote>
                  <p className="source-name">
                    {task.sourceReference.source.title}
                  </p>
                </>
              ) : (
                <p>
                  Источник задания не указан. Описание не заменяет подтверждение
                  преподавателя.
                </p>
              )}
            </details>
            {primaryDeadline && (
              <details className="mt-2">
                <summary>
                  Основание срока ·{" "}
                  {formatDeadlineProvenance(
                    primaryDeadline.provenance,
                  ).label.toLowerCase()}
                </summary>
                <blockquote>
                  {primaryDeadline.sourceReference?.quoteText}
                </blockquote>
                <p className="source-name">
                  {primaryDeadline.sourceReference?.source.title}
                </p>
                <p>
                  {primaryDeadline.type === "HARD"
                    ? "Окончательный срок"
                    : "Рекомендуемый срок"}{" "}
                  ·{" "}
                  {primaryDeadline.isTimeStrict
                    ? "Время по Москве"
                    : "До конца дня по Москве"}
                </p>
              </details>
            )}
          </div>
          {(deadlineHistory.some((d) => d.originalDeadlineId) ||
            contentHistory.length > 0) && (
            <details className="source-details mt-5">
              <summary>Что менялось в работе</summary>
              <div className="space-y-5 mt-4">
                {deadlineHistory
                  .filter((d) => d.originalDeadlineId)
                  .map((d) => {
                    const previous = deadlineHistory.find(
                      (old) => old.id === d.originalDeadlineId,
                    );
                    return (
                      <article
                        key={d.id}
                        className="border-l border-slate-600 pl-4 text-sm"
                      >
                        <p>
                          Срок:{" "}
                          {previous
                            ? formatInTimeZone(
                                previous.date,
                                "Europe/Moscow",
                                "dd.MM.yyyy",
                              )
                            : "предыдущая дата"}{" "}
                          →{" "}
                          {formatInTimeZone(
                            d.date,
                            "Europe/Moscow",
                            "dd.MM.yyyy",
                          )}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">
                          {d.sourceReference?.createdBy?.nickname ?? "Редактор"}{" "}
                          ·{" "}
                          {formatInTimeZone(
                            d.createdAt,
                            "Europe/Moscow",
                            "dd.MM.yyyy HH:mm",
                          )}
                        </p>
                        <blockquote className="whitespace-pre-wrap mt-2">
                          {d.sourceReference?.quoteText}
                        </blockquote>
                      </article>
                    );
                  })}
                {contentHistory.map((event) => {
                  const data = event.details as {
                    before?: { title?: string; description?: string };
                    after?: { title?: string; description?: string };
                    sourceNote?: string;
                  };
                  return (
                    <article
                      key={event.id}
                      className="border-l border-slate-600 pl-4 text-sm"
                    >
                      <p>
                        {event.user?.nickname ?? "Редактор"} уточнил задание ·{" "}
                        {formatInTimeZone(
                          event.createdAt,
                          "Europe/Moscow",
                          "dd.MM.yyyy HH:mm",
                        )}
                      </p>
                      <p className="whitespace-pre-wrap text-slate-400 mt-2">
                        {data.sourceNote}
                      </p>
                      <details className="mt-2">
                        <summary>Текст до изменения</summary>
                        <p className="mt-2 whitespace-pre-wrap">
                          {data.before?.title}
                        </p>
                        <p className="whitespace-pre-wrap">
                          {data.before?.description ??
                            "Описание не было добавлено"}
                        </p>
                      </details>
                    </article>
                  );
                })}
              </div>
            </details>
          )}
          {canEditCourse(user, task.courseOfferingId, "manage_tasks") && (
            <details className="source-details mt-5">
              <summary>Уточнить задание для группы</summary>
              <OperationForm
                action={editTaskContentAction}
                label="Сохранить уточнение"
                className="mt-5"
              >
                <input type="hidden" name="taskId" value={task.id} />
                <input
                  type="hidden"
                  name="updatedAt"
                  value={task.updatedAt.toISOString()}
                />
                <label className="block text-sm">
                  Название
                  <input
                    name="title"
                    defaultValue={task.title}
                    required
                    minLength={3}
                    maxLength={240}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  Что нужно сделать
                  <textarea
                    name="description"
                    defaultValue={task.description ?? ""}
                    rows={7}
                    maxLength={20000}
                    className={inputClass}
                  />
                </label>
                <label className="block text-sm">
                  Основание изменения
                  <textarea
                    name="sourceNote"
                    required
                    minLength={8}
                    maxLength={4000}
                    rows={3}
                    className={inputClass}
                  />
                </label>
              </OperationForm>
            </details>
          )}
          <section className="notes-block">
            <h2>Мои заметки</h2>
            <StudentNotesEditor
              taskId={task.id}
              initialNotes={userProgress?.studentNotes || ""}
              currentStatus={userProgress?.status || "NOT_STARTED"}
            />
          </section>
          {canRecordResult && verificationTargets.length > 0 && (
            <details className="source-details">
              <summary>
                Для старосты · записать результат другого студента
              </summary>
              <div className="mt-4">
                <TaskVerificationForm
                  taskId={task.id}
                  students={verificationTargets}
                />
              </div>
            </details>
          )}
        </div>
        <aside className="task-tracker">
          <h2>Моя работа</h2>
          <p className="eyebrow">Срок сдачи</p>
          <p className="task-date">
            {primaryDeadline ? deadlineCalc.formattedDate : "Срок не указан"}
          </p>
          {primaryDeadline && (
            <p
              className={`text-sm ${deadlineCalc.urgency === "OVERDUE" ? "text-rose-300" : "text-blue-300"}`}
            >
              {deadlineCalc.badgeLabel}
            </p>
          )}
          <p className="text-xs text-slate-400 leading-relaxed mt-3">
            {primaryDeadline
              ? primaryDeadline.isTimeStrict
                ? "Указано московское время."
                : "До конца указанного дня, по Москве."
              : "Подтверждённой даты в приложении нет."}
          </p>
          {primaryDeadline &&
            canEditCourse(user, task.courseOfferingId, "manage_deadlines") && (
              <details className="mt-5">
                <summary className="text-link cursor-pointer min-h-11">
                  Перенести срок
                </summary>
                <OperationForm
                  action={moveTaskDeadlineAction}
                  label="Обновить срок"
                  className="mt-4"
                >
                  <input
                    type="hidden"
                    name="deadlineId"
                    value={primaryDeadline.id}
                  />
                  <label className="block text-sm">
                    Новая дата
                    <input
                      type="date"
                      name="day"
                      required
                      defaultValue={formatInTimeZone(
                        primaryDeadline.date,
                        "Europe/Moscow",
                        "yyyy-MM-dd",
                      )}
                      className={inputClass}
                    />
                  </label>
                  <label className="block text-sm">
                    Что сообщил преподаватель
                    <textarea
                      name="sourceNote"
                      required
                      minLength={8}
                      maxLength={4000}
                      rows={3}
                      className={inputClass}
                    />
                  </label>
                  <p className="text-xs text-slate-400">
                    Старый срок останется в истории, группе придёт уведомление.
                    Точное время и характер срока сохранятся.
                  </p>
                </OperationForm>
              </details>
            )}
          <div className="tracker-separator" />
          <StatusSelect
            taskId={task.id}
            targetUserId={user.id}
            currentStatus={userProgress?.status || "NOT_STARTED"}
            isVerified={isAccepted}
            verifiedAt={
              isAccepted ? userProgress?.verifiedAt?.toISOString() : null
            }
            verificationSource={
              isAccepted ? userProgress?.verificationSource : null
            }
            canVerify={canVerifyProgress}
            isCurrentUser={true}
          />
          <p className="text-xs text-slate-400 leading-relaxed mt-4">
            Отмечайте этап работы для себя. Зачёт появится после подтверждения
            результата.
          </p>
          <Link
            className="text-link mt-5"
            href={`/courses/${task.courseOfferingId}`}
          >
            <ArrowLeft size={14} />
            Все работы по предмету
          </Link>
        </aside>
      </div>
    </>
  );
}
