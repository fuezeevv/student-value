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
