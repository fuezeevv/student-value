import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getMobileSessionUser } from "./mobile-auth";
import { resolveGroupCode } from "./timetable-v1";
import { taskVisibilityWhere } from "@/server/domain/access";
import { publicTaskWhere } from "@/server/queries/public-workspace";

export interface MobileTaskDeadline {
  id: string;
  date: string;
  dateMoscowStr: string;
  status: string;
}

export interface MobileTaskMaterial {
  id: string;
  title: string;
  filename: string;
  byteSize: number;
  mimeType: string;
  sha256: string;
}

export interface MobileTaskProgress {
  status: string;
  isVerified: boolean;
  studentNotes: string | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface MobileTaskItem {
  id: string;
  title: string;
  subject: string;
  type: string;
  deadline: MobileTaskDeadline | null;
  material: MobileTaskMaterial | null;
  progress: MobileTaskProgress | null;
  materialTitles?: string[];
}

function formatMoscowDate(d: Date, strict = false): string {
  // Format as DD.MM.YYYY in Europe/Moscow timezone
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(strict
      ? {
          hour: "2-digit" as const,
          minute: "2-digit" as const,
          hourCycle: "h23" as const,
        }
      : {}),
  });
  return formatter.format(d) + (strict ? " МСК" : "");
}

export async function handleGetMobileTasks(
  request: NextRequest,
): Promise<NextResponse> {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null;

  let sessionUser = token ? await getMobileSessionUser(token) : null;
  const rawGroup = request.nextUrl.searchParams.get("group") || "";
  if (token && !sessionUser) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (sessionUser && rawGroup) {
    const membership = sessionUser.groups?.find(
      (group) => group.code === rawGroup,
    );
    // A timetable selection never grants membership or chooses another group's
    // private assignments. Nonmember groups use only the strict public projection.
    sessionUser = membership
      ? await getMobileSessionUser(token!, membership.id)
      : null;
  }

  if (sessionUser) {
    // Authenticated path: use authoritative taskVisibilityWhere
    const visibleWhere = await taskVisibilityWhere(sessionUser);
    const tasks = await prisma.task.findMany({
      where: {
        AND: [
          visibleWhere,
          { courseOffering: { semester: { isCurrent: true } } },
        ],
      },
      select: {
        id: true,
        title: true,
        type: true,
        courseOffering: {
          select: {
            courseDefinition: { select: { title: true, shortTitle: true } },
          },
        },
        deadlines: {
          where: confirmedDeadlineWhere,
          orderBy: { date: "asc" },
          take: 1,
          select: {
            id: true,
            date: true,
            isTimeStrict: true,
            status: true,
          },
        },
        materials: {
          take: 1,
          select: {
            material: {
              select: {
                id: true,
                title: true,
                file: {
                  select: {
                    filename: true,
                    byteSize: true,
                    mimeType: true,
                    sha256: true,
                  },
                },
              },
            },
          },
        },
        progress: {
          where: { userId: sessionUser.id },
          take: 1,
          select: {
            status: true,
            isVerified: true,
            studentNotes: true,
            completedAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const items: MobileTaskItem[] = tasks.map((t) => {
      const activeDl = t.deadlines[0] ?? null;
      const mat = t.materials[0]?.material ?? null;
      const prog = t.progress[0] ?? null;

      return {
        id: t.id,
        title: t.title,
        subject: t.courseOffering.courseDefinition.title,
        type: t.type,
        deadline: activeDl
          ? {
              id: activeDl.id,
              date: activeDl.date.toISOString(),
              dateMoscowStr: formatMoscowDate(
                activeDl.date,
                activeDl.isTimeStrict,
              ),
              status: activeDl.status,
            }
          : null,
        material:
          mat && mat.file
            ? {
                id: mat.id,
                title: mat.title,
                filename: mat.file.filename,
                byteSize: mat.file.byteSize,
                mimeType: mat.file.mimeType,
                sha256: mat.file.sha256,
              }
            : null,
        progress: prog
          ? {
              status: prog.status,
              isVerified: prog.isVerified,
              studentNotes: prog.studentNotes,
              completedAt: prog.completedAt?.toISOString() ?? null,
              updatedAt: prog.updatedAt.toISOString(),
            }
          : null,
      };
    });

    return NextResponse.json(
      { tasks: items },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Guest path: strict read-only group projection (per AGENTS.md)
  if (!rawGroup) {
    return NextResponse.json(
      {
        error: "Требуется указать группу (параметр ?group=)",
        code: "MISSING_GROUP",
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const resolution = resolveGroupCode(rawGroup);
  if (resolution.kind === "NOT_FOUND") {
    return NextResponse.json(
      { error: "Группа не найдена", code: "GROUP_NOT_FOUND" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (resolution.kind === "AMBIGUOUS") {
    return NextResponse.json(
      {
        error: "Неоднозначный код группы",
        code: "AMBIGUOUS_GROUP_CODE",
        candidates: resolution.matches,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const group = await prisma.studyGroup.findUnique({
    where: { code: resolution.code },
  });
  if (!group) {
    return NextResponse.json(
      { tasks: [] },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  // Published, active tasks addressed to the group (strictly filtered per AGENTS.md)
  const tasks = await prisma.task.findMany({
    where: publicTaskWhere(group.id),
    select: {
      id: true,
      title: true,
      type: true,
      courseOffering: {
        select: {
          courseDefinition: { select: { title: true, shortTitle: true } },
        },
      },
      deadlines: {
        where: confirmedDeadlineWhere,
        orderBy: { date: "asc" },
        take: 1,
        select: {
          id: true,
          date: true,
          isTimeStrict: true,
          status: true,
        },
      },
      materials: {
        take: 20,
        select: { material: { select: { title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const items: MobileTaskItem[] = tasks.map((t) => {
    const activeDl = t.deadlines[0] ?? null;
    const mat = t.materials[0]?.material ?? null;

    return {
      id: t.id,
      title: t.title,
      subject: t.courseOffering.courseDefinition.title,
      type: t.type,
      deadline: activeDl
        ? {
            id: activeDl.id,
            date: activeDl.date.toISOString(),
            dateMoscowStr: formatMoscowDate(
              activeDl.date,
              activeDl.isTimeStrict,
            ),
            status: activeDl.status,
          }
        : null,
      material: null,
      materialTitles: t.materials.map((link) => link.material.title),
      progress: null, // Guests never receive progress
    };
  });

  return NextResponse.json(
    { tasks: items },
    { headers: { "Cache-Control": "no-store" } },
  );
}
