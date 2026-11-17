import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getMobileSessionUser } from "./mobile-auth";
import { hasPermission, ForbiddenError } from "@/lib/permissions/checker";
import { taskVisibilityWhere } from "@/server/domain/access";
import { editTask } from "@/server/domain/task-editing";
import {
  setDeadlineCancelled,
  setTaskArchived,
} from "@/server/domain/work-lifecycle";
import { rescheduleDeadline } from "@/server/domain/deadlines";

async function actor(request: NextRequest) {
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const primary = await getMobileSessionUser(token);
  if (!primary) return null;
  const code = request.nextUrl.searchParams.get("group");
  if (!code) return primary;
  const membership = primary.groups?.find((group) => group.code === code);
  if (!membership)
    throw new ForbiddenError("Вы не состоите в выбранной группе");
  return getMobileSessionUser(token, membership.id);
}
const input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("edit"),
    id: z.string().min(1).max(100),
    title: z.string().trim().min(3).max(240),
    description: z.string().max(20000),
    sourceNote: z.string().trim().min(8).max(4000),
    updatedAt: z.iso.datetime(),
  }),
  z.object({
    action: z.literal("archive"),
    id: z.string().min(1).max(100),
    value: z.boolean(),
    reason: z.string().trim().min(5).max(2000),
  }),
  z.object({
    action: z.literal("cancel-deadline"),
    id: z.string().min(1).max(100),
    value: z.boolean(),
    reason: z.string().trim().min(5).max(2000),
  }),
  z.object({
    action: z.literal("reschedule"),
    id: z.string().min(1).max(100),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    sourceNote: z.string().trim().min(8).max(4000),
  }),
]);
export async function handleMobileManagement(request: NextRequest) {
  try {
    const user = await actor(request);
    if (!user)
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    const tasks = hasPermission(user, "manage_tasks");
    const deadlines = hasPermission(user, "manage_deadlines");
    if (!tasks && !deadlines) throw new ForbiddenError();
    if (request.method === "GET") {
      const visible = await taskVisibilityWhere(user);
      const items = await prisma.task.findMany({
        where: {
          ...visible,
          status: { in: ["PUBLISHED", "ARCHIVED"] },
          mergedIntoId: null,
          courseOffering: {
            status: "ACTIVE",
            groups: { some: { groupId: user.groupId } },
            semester: { isCurrent: true },
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          updatedAt: true,
          courseOffering: {
            select: { courseDefinition: { select: { title: true } } },
          },
          deadlines: {
            where: { status: { in: ["ACTIVE", "CANCELLED"] } },
            select: { id: true, date: true, status: true, isTimeStrict: true },
            orderBy: { date: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return NextResponse.json(
        {
          groupId: user.groupId,
          canEditTasks: tasks,
          canEditDeadlines: deadlines,
          items,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (request.method !== "POST")
      return NextResponse.json(
        { error: "METHOD_NOT_ALLOWED" },
        { status: 405 },
      );
    if (!request.body)
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > 32_768)
          return NextResponse.json({ error: "TOO_LARGE" }, { status: 413 });
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    const text = Buffer.concat(chunks).toString("utf8");
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
    }
    const body = input.parse(raw);
    if ((body.action === "edit" || body.action === "archive") && !tasks)
      throw new ForbiddenError();
    if (
      (body.action === "cancel-deadline" || body.action === "reschedule") &&
      !deadlines
    )
      throw new ForbiddenError();
    // All changes go through the existing audited, scoped, provenance-aware domains.
    switch (body.action) {
      case "edit":
        await editTask(user, body.id, body);
        break;
      case "archive":
        await setTaskArchived(user, body.id, body.value, body.reason);
        break;
      case "cancel-deadline":
        await setDeadlineCancelled(user, body.id, body.value, body.reason);
        break;
      case "reschedule":
        await rescheduleDeadline(
          user,
          body.id,
          body.day,
          undefined,
          body.sourceNote,
        );
        break;
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ForbiddenError)
      return NextResponse.json(
        { error: "FORBIDDEN", message: error.message },
        { status: 403 },
      );
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
    // Domain concurrency/not-found failures must not leak database internals.
    return NextResponse.json(
      {
        error: "UPDATE_FAILED",
        message:
          "Не удалось применить действие. Обновите список и проверьте данные.",
      },
      { status: 409 },
    );
  }
}
