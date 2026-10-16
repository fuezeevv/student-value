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
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusSelect } from "@/components/task/StatusSelect";
import { StudentNotesEditor } from "@/components/task/StudentNotesEditor";
import {
  Calendar,
  Layers,
  ArrowLeft,
  Quote,
  ShieldCheck,
  Cpu,
  FileText,
  Clock,
} from "lucide-react";

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
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-200">
          Главная
        </Link>
        <span>/</span>
        <Link
          href={`/courses/${task.courseOfferingId}`}
          className="hover:text-slate-200"
        >
          {task.courseOffering.courseDefinition.shortTitle}
        </Link>
        <span>/</span>
        <span className="text-slate-200 font-medium truncate max-w-xs">
          {task.title}
        </span>
      </div>

      {/* Task Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="default" className="text-xs font-semibold">
            {task.type === "LABORATORY"
              ? `Лабораторная работа #${task.number || "—"}`
              : task.type === "HOMEWORK"
                ? "Домашнее задание"
                : "Учебное задание"}
          </Badge>
          <Badge variant="secondary" className="font-mono text-xs">
            {task.courseOffering.courseDefinition.shortTitle}
          </Badge>
          <Badge variant="info" className="text-xs">
            Для вашей группы
          </Badge>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 leading-tight">
          {task.title}
        </h1>
      </div>

      {/* PROVENANCE / SOURCE CITATION CARD */}
      {task.sourceReference && (
        <div className="p-4 rounded-lg border border-sky-900/40 bg-sky-950/20 text-xs space-y-2">
          <div className="flex items-center gap-2 text-sky-400 font-semibold">
            <Quote className="w-3.5 h-3.5" />
            <span>Источник информации</span>
            <Badge variant="info" className="text-[10px] py-0 px-1.5">
              {task.sourceReference.confidence === "CONFIRMED"
                ? "Подтверждено"
                : "Требует проверки"}
            </Badge>
          </div>
          {task.sourceReference.quoteText && (
            <p className="text-slate-300 italic pl-5 border-l-2 border-sky-500/40 leading-relaxed">
              «{task.sourceReference.quoteText}»
            </p>
          )}
          <div className="text-[11px] text-slate-500 pl-5">
            Первоисточник: {task.sourceReference.source.title}
          </div>
        </div>
      )}

      {/* TWO-COLUMN LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (65%): Task Content, Requirements, Variants */}
        <div className="lg:col-span-8 space-y-6">
          {/* Individual Variant Section */}
          {assignedVariant && (
            <Card className="border-slate-800 bg-slate-900/90 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-sky-400" />
                  Ваш индивидуальный вариант: {assignedVariant.variantNumber}
                </h3>
                <Badge variant="secondary" className="text-[10px]">
                  По ведомости группы
                </Badge>
              </div>

              {assignedVariant.spec &&
                typeof assignedVariant.spec === "object" && (
                  <div className="p-3 bg-slate-950/80 rounded border border-slate-800 text-xs font-mono space-y-1 text-slate-300">
                    {Object.entries(
                      assignedVariant.spec as Record<string, unknown>,
                    ).map(([key, val]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between"
                      >
                        <span className="text-slate-500">{key}:</span>
                        <span className="text-sky-300 font-semibold">
                          {String(val)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </Card>
          )}

          {!assignedVariant && (
            <p className="text-sm text-slate-400">Вариант не назначен</p>
          )}

          {/* Description & Requirements */}
          <Card className="border-slate-800 bg-slate-900/80 p-5 space-y-4">
            <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider text-xs flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              Описание и требования к выполнению
            </h3>

            {task.description ? (
              <div className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                {task.description}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Подробные требования не указаны. Ознакомьтесь с методическими
                указаниями к курсу.
              </p>
            )}

            {task.courseOffering.softwareRequired && (
              <div className="pt-3 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
                <Cpu className="w-3.5 h-3.5 text-slate-500" />
                <span>
                  Используемая среда: {task.courseOffering.softwareRequired}
                </span>
              </div>
            )}
          </Card>

          {/* Materials & Links */}
          {task.materials.length > 0 && (
            <Card className="border-slate-800 bg-slate-900/80 p-5 space-y-3">
              <h3 className="font-bold text-sm text-slate-200 text-xs uppercase tracking-wider">
                Материалы к заданию
              </h3>
              <div className="space-y-2">
                {task.materials.map((tm) => (
                  <a
                    key={tm.materialId}
                    href={tm.material.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded bg-slate-950/60 border border-slate-800 hover:border-slate-700 flex items-center justify-between text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    <span>{tm.material.title}</span>
                    <span className="text-sky-400 text-[11px]">Открыть ↗</span>
                  </a>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right Column (35%): Deadlines & Student Tracker */}
        <div className="lg:col-span-4 space-y-6">
          {/* Deadlines Block */}
          <Card className="border-slate-800 bg-slate-900/90 p-5 space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-400" />
              Сроки сдачи (Дедлайны)
            </h3>

            {primaryDeadline ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Срок сдачи:</span>
                  <Badge variant={deadlineCalc.badgeVariant}>
                    {deadlineCalc.badgeLabel}
                  </Badge>
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  {deadlineCalc.formattedDate}
                </div>
                <div className="text-[11px] text-slate-500">
                  Тип:{" "}
                  {primaryDeadline.type === "HARD"
                    ? "Окончательный срок"
                    : "Рекомендуемый срок"}
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-1">Срок не указан.</div>
            )}
          </Card>

          {/* Student Progress Tracker & Trust Model */}
          <Card className="border-slate-800 bg-slate-900/90 p-5 space-y-4">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Ваш статус прохождения
            </h3>

            <StatusSelect
              taskId={task.id}
              targetUserId={user?.id || ""}
              currentStatus={userProgress?.status || "NOT_STARTED"}
              isVerified={userProgress?.isVerified || false}
              verifiedAt={userProgress?.verifiedAt?.toISOString()}
              verificationSource={userProgress?.verificationSource}
              canVerify={canVerifyProgress}
              isCurrentUser={Boolean(user)}
            />
          </Card>

          {canRecordResult && verificationTargets.length > 0 && (
            <TaskVerificationForm
              taskId={task.id}
              students={verificationTargets}
            />
          )}

          {/* Student Private Notes */}
          {user && (
            <Card className="border-slate-800 bg-slate-900/80 p-5 space-y-3">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                Личные заметки
              </h3>
              <StudentNotesEditor
                taskId={task.id}
                initialNotes={userProgress?.studentNotes || ""}
                currentStatus={userProgress?.status || "NOT_STARTED"}
              />
            </Card>
          )}

          {/* Back link */}
          <Link
            href={`/courses/${task.courseOfferingId}`}
            className="flex items-center justify-center gap-1.5 p-2 rounded-lg border border-slate-800 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Вернуться к курсу</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
