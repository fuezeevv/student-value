import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  publicGroupDefinition,
  publicGroups,
} from "@/lib/groups/public-groups";
import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";

/** Fail closed for missing, mixed, foreign, subgroup or individual audiences. */
export function publicTaskWhere(groupId: string): Prisma.TaskWhereInput {
  return {
    status: "PUBLISHED",
    mergedIntoId: null,
    courseOffering: {
      status: "ACTIVE",
      mergedIntoId: null,
      semester: { isCurrent: true },
      groups: { some: { groupId } },
    },
    audiences: {
      some: { targetType: "GROUP", groupId },
      none: {
        OR: [
          { targetType: { not: "GROUP" } },
          { groupId: { not: groupId } },
          { groupId: null },
          { subgroupNumber: { not: null } },
          { enrollmentId: { not: null } },
        ],
      },
    },
  };
}
export async function loadPublicGroups() {
  const available = await prisma.studyGroup.findMany({
    where: { code: { in: publicGroups.map((g) => g.code) } },
    select: { code: true },
  });
  return publicGroups.filter((g) => available.some((a) => a.code === g.code));
}
export async function loadPublicWorkspace(slug: string) {
  const definition = publicGroupDefinition(slug);
  if (!definition) return null;
  const group = await prisma.studyGroup.findUnique({
    where: { code: definition.code },
    select: { id: true, code: true },
  });
  if (!group) return null;
  // Explicit projection: never query user/progress/identity/variant/notes/source
  // bodies, recordings, file bytes or original material URLs for anonymous readers.
  const courses = await prisma.courseOffering.findMany({
    where: {
      status: "ACTIVE",
      mergedIntoId: null,
      semester: { isCurrent: true },
      groups: { some: { groupId: group.id } },
    },
    select: {
      id: true,
      courseDefinition: { select: { title: true, shortTitle: true } },
      semester: { select: { name: true } },
      _count: { select: { sessions: { where: { status: "PUBLISHED" } } } },
      tasks: {
        where: publicTaskWhere(group.id),
        orderBy: [{ number: "asc" }, { publishedAt: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          deadlines: {
            where: confirmedDeadlineWhere,
            orderBy: { date: "asc" },
            select: { date: true, title: true, isTimeStrict: true, type: true },
          },
          materials: {
            select: {
              material: { select: { courseOfferingId: true, title: true } },
            },
          },
        },
      },
    },
    orderBy: { courseDefinition: { shortTitle: "asc" } },
  });
  return {
    group: { ...definition },
    courses: courses.map((course) => ({
      id: course.id,
      title: course.courseDefinition.title,
      shortTitle: course.courseDefinition.shortTitle,
      semester: course.semester.name,
      lessonCount: course._count.sessions,
      tasks: course.tasks.map(({ materials, ...task }) => ({
        ...task,
        courseId: course.id,
        courseTitle: course.courseDefinition.shortTitle,
        materials: materials
          .filter((m) => m.material.courseOfferingId === course.id)
          .map((m) => ({ title: m.material.title })),
      })),
    })),
  };
}
export type PublicWorkspace = NonNullable<
  Awaited<ReturnType<typeof loadPublicWorkspace>>
>;
export type PublicTask = PublicWorkspace["courses"][number]["tasks"][number];
