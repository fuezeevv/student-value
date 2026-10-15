import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { calculateDeadlineStatus } from "@/server/services/deadline-service";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusSelect } from "@/components/task/StatusSelect";
import { CreateTaskModal } from "@/components/task/CreateTaskModal";
import {
  BookOpen,
  User,
  Cpu,
  Layers,
  ArrowRight,
  Calendar,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface CoursePageProps {
  params: Promise<{ id: string }>;
}

export default async function CourseDetailPage({ params }: CoursePageProps) {
  const { id } = await params;
  const user = await getCurrentUser();

  const offering = await prisma.courseOffering.findUnique({
    where: { id },
    include: {
      courseDefinition: true,
      teachers: {
        include: { teacher: true },
      },
      tasks: {
        orderBy: [{ type: "asc" }, { number: "asc" }],
        include: {
          deadlines: {
            where: { status: "ACTIVE" },
            orderBy: { date: "asc" },
          },
          variants: {
            include: {
              assignments: {
                include: { enrollment: true },
              },
            },
          },
          progress: user ? { where: { userId: user.id } } : false,
          sourceReference: true,
        },
      },
      materials: true,
    },
  });

  if (!offering) {
    notFound();
  }

  // Find user's enrollment
  const userEnrollment = user
    ? await prisma.enrollment.findFirst({
        where: { userId: user.id, group: { code: "5130901/40102" } },
      })
    : null;

  // Separate tasks by type
  const labs = offering.tasks.filter((t) => t.type === "LABORATORY");
  const homeworks = offering.tasks.filter(
    (t) => t.type === "HOMEWORK" || t.type === "EXERCISE" || t.type === "CALCULATION_WORK"
  );
  const otherTasks = offering.tasks.filter(
    (t) => t.type !== "LABORATORY" && t.type !== "HOMEWORK" && t.type !== "EXERCISE" && t.type !== "CALCULATION_WORK"
  );

  const totalLabs = labs.length;
  const acceptedLabs = labs.filter(
    (l) => l.progress?.[0]?.status === "ACCEPTED"
  ).length;

  const canManageTasks = user?.permissions.includes("manage_tasks") ?? false;
  const canVerifyProgress = user?.permissions.includes("verify_progress") ?? false;

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Link href="/" className="hover:text-slate-200">Главная</Link>
        <span>/</span>
        <Link href="/courses" className="hover:text-slate-200">Дисциплины</Link>
        <span>/</span>
        <span className="text-slate-200 font-medium">{offering.courseDefinition.shortTitle}</span>
      </div>

      {/* Course Header */}
      <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="default" className="font-mono text-xs font-bold">
                {offering.courseDefinition.shortTitle}
              </Badge>
              {offering.format && (
                <Badge variant="secondary" className="text-xs">
                  {offering.format}
                </Badge>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-100">
              {offering.courseDefinition.title}
            </h1>
          </div>

          {canManageTasks && (
            <CreateTaskModal
              courseOfferingId={offering.id}
              courses={[{
                id: offering.id,
                title: offering.courseDefinition.title,
                shortTitle: offering.courseDefinition.shortTitle,
              }]}
            />
          )}
        </div>

        {/* Teachers & Software Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-800 text-xs text-slate-300">
          <div className="space-y-1.5">
            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
              Преподавательский состав:
            </span>
            {offering.teachers.length > 0 ? (
              offering.teachers.map((ct) => (
                <div key={ct.id} className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-medium text-slate-200">{ct.teacher.fullName}</span>
                  {ct.role && <span className="text-slate-400">({ct.role})</span>}
                  {ct.status === "DISPUTED" && (
                    <Badge variant="warning" className="text-[9px] px-1 py-0">
                      Конфликт данных
                    </Badge>
                  )}
                </div>
              ))
            ) : (
              <span className="text-slate-500 italic">Преподаватель уточняется</span>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
              Среда и инструменты:
            </span>
            <div className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>{offering.softwareRequired || "Специальное ПО не зафиксировано"}</span>
            </div>
          </div>
        </div>

        {/* Requirements / Lab Progression Bar */}
        {totalLabs > 0 && (
          <div className="pt-3 border-t border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">
                Условие аттестации: сдача лабораторного практикума
              </span>
              <span className="font-bold text-sky-400">
                Зачтено {acceptedLabs} из {totalLabs} ЛР
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(acceptedLabs / totalLabs) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ADAPTIVE SECTION 1: Laboratory Works */}
      {labs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-400" />
            Лабораторный практикум ({labs.length})
          </h2>

          <div className="space-y-3">
            {labs.map((task) => {
              const userProg = task.progress?.[0];
              const isAccepted = userProg?.status === "ACCEPTED";
              const deadline = task.deadlines[0];
              const deadlineCalc = calculateDeadlineStatus(
                deadline ? deadline.date : null,
                new Date(),
                isAccepted
              );

              // Assigned variant for current student
              const assignedVariant = task.variants.find((v) =>
                v.assignments.some((a) => a.enrollmentId === userEnrollment?.id)
              ) || task.variants[0];

              return (
                <Card
                  key={task.id}
                  className="border-slate-800 bg-slate-900/60 p-4 sm:p-5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Task Info */}
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="default" className="text-xs font-semibold">
                          ЛР #{task.number || "—"}
                        </Badge>
                        <Badge variant={deadlineCalc.badgeVariant}>
                          {deadlineCalc.badgeLabel}
                        </Badge>
                        {assignedVariant && (
                          <Badge variant="secondary" className="font-mono text-xs">
                            {assignedVariant.variantNumber}
                          </Badge>
                        )}
                      </div>

                      <Link href={`/tasks/${task.id}`}>
                        <h3 className="font-bold text-base text-slate-100 hover:text-sky-400 transition-colors">
                          {task.title}
                        </h3>
                      </Link>

                      {task.description && (
                        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                          {task.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Дедлайн: {deadlineCalc.formattedDate}
                        </span>
                        {task.sourceReference && (
                          <span className="text-sky-400/80">
                            Источник: {task.sourceReference.quoteText?.slice(0, 45)}...
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status & Actions Control */}
                    <div className="flex flex-col items-start md:items-end gap-3 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                      <StatusSelect
                        taskId={task.id}
                        targetUserId={user?.id || ""}
                        currentStatus={userProg?.status || "NOT_STARTED"}
                        isVerified={userProg?.isVerified || false}
                        verifiedAt={userProg?.verifiedAt?.toISOString()}
                        verificationSource={userProg?.verificationSource}
                        canVerify={canVerifyProgress}
                        isCurrentUser={Boolean(user)}
                      />

                      <Link href={`/tasks/${task.id}`}>
                        <span className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1">
                          Открыть задание
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* ADAPTIVE SECTION 2: Homeworks and Exercises */}
      {homeworks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-sky-400" />
            Домашние задания и упражнения ({homeworks.length})
          </h2>

          <div className="space-y-3">
            {homeworks.map((task) => {
              const userProg = task.progress?.[0];
              const isAccepted = userProg?.status === "ACCEPTED";
              const deadline = task.deadlines[0];
              const deadlineCalc = calculateDeadlineStatus(
                deadline ? deadline.date : null,
                new Date(),
                isAccepted
              );

              return (
                <Card
                  key={task.id}
                  className="border-slate-800 bg-slate-900/60 p-4 sm:p-5 hover:border-slate-700 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {task.type === "HOMEWORK" ? "Домашняя работа" : "Упражнение"}
                        </Badge>
                        <Badge variant={deadlineCalc.badgeVariant}>
                          {deadlineCalc.badgeLabel}
                        </Badge>
                      </div>

                      <Link href={`/tasks/${task.id}`}>
                        <h3 className="font-bold text-base text-slate-100 hover:text-sky-400 transition-colors">
                          {task.title}
                        </h3>
                      </Link>

                      {task.description && (
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
                      <StatusSelect
                        taskId={task.id}
                        targetUserId={user?.id || ""}
                        currentStatus={userProg?.status || "NOT_STARTED"}
                        isVerified={userProg?.isVerified || false}
                        verifiedAt={userProg?.verifiedAt?.toISOString()}
                        verificationSource={userProg?.verificationSource}
                        canVerify={canVerifyProgress}
                        isCurrentUser={Boolean(user)}
                      />

                      <Link href={`/tasks/${task.id}`}>
                        <span className="text-xs text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1">
                          Подробнее
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State if no tasks */}
      {offering.tasks.length === 0 && (
        <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center space-y-2">
          <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">
            По этому предмету пока нет опубликованных заданий
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Преподаватель еще не выдавал заданий, либо староста добавит их после следующего занятия.
          </p>
        </div>
      )}
    </div>
  );
}
