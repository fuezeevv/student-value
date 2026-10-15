import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BookOpen, User, Cpu, ArrowRight } from "lucide-react";

export default async function CoursesIndexPage() {
  const user = await getCurrentUser();

  const offerings = await prisma.courseOffering.findMany({
    where: {
      semester: { isCurrent: true },
      groups: { some: { group: { code: "5130901/40102" } } },
    },
    include: {
      courseDefinition: true,
      teachers: {
        include: { teacher: true },
      },
      tasks: {
        include: {
          progress: user ? { where: { userId: user.id } } : false,
        },
      },
    },
    orderBy: { courseDefinition: { shortTitle: "asc" } },
  });

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
          <BookOpen className="w-6 h-6 text-sky-400" />
          Дисциплины 5-го семестра
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Все активные курсы группы 5130901/40102, получаемые динамически из базы данных.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {offerings.map((offering) => {
          const totalTasks = offering.tasks.length;
          const acceptedTasks = offering.tasks.filter(
            (t) => t.progress?.[0]?.status === "ACCEPTED"
          ).length;

          return (
            <Link
              key={offering.id}
              href={`/courses/${offering.id}`}
              className="block group"
            >
              <Card className="h-full border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-sky-500/50 transition-all flex flex-col justify-between p-5 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="default" className="font-mono text-xs font-bold">
                      {offering.courseDefinition.shortTitle}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {totalTasks} {totalTasks === 1 ? "задание" : "заданий"}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-slate-100 group-hover:text-sky-400 transition-colors leading-snug">
                    {offering.courseDefinition.title}
                  </h3>

                  {/* Teachers */}
                  {offering.teachers.length > 0 && (
                    <div className="space-y-1 text-xs text-slate-400">
                      {offering.teachers.map((ct) => (
                        <div key={ct.id} className="flex items-center gap-1.5 truncate">
                          <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span className="truncate">
                            {ct.teacher.fullName}
                            {ct.role ? ` (${ct.role})` : ""}
                          </span>
                          {ct.status === "DISPUTED" && (
                            <Badge variant="warning" className="text-[9px] px-1 py-0">
                              Конфликт источников
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Software */}
                  {offering.softwareRequired && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-950/60 px-2.5 py-1.5 rounded border border-slate-800">
                      <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="truncate">{offering.softwareRequired}</span>
                    </div>
                  )}
                </div>

                {/* Progress Mini Bar */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Сдано: {acceptedTasks} / {totalTasks}</span>
                  <div className="flex items-center gap-1 text-sky-400 font-medium group-hover:translate-x-0.5 transition-transform">
                    <span>Открыть курс</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
