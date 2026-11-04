import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { ForbiddenError } from "@/lib/permissions/checker";
import {
  RUZ_ORIGIN,
  parseRuzWeek,
  requestedWeek,
  type RuzWeek,
} from "@/lib/schedule/ruz";

import { fetchRuzPayload, RuzProviderError } from "./ruz-transport";

const TTL = 10 * 60 * 1000;
export type ScheduleResult = {
  subgroup: number | null;
  state: "FRESH" | "STALE" | "UNAVAILABLE" | "UNCONFIGURED";
  data: RuzWeek | null;
  fetchedAt: Date | null;
  weekStart: string;
};
type Dependencies = { now?: Date; fetcher?: (url: string) => Promise<unknown> };

function cachedWeek(
  payload: unknown,
  groupId: number,
  groupCode: string,
  weekStart: string,
): RuzWeek | null {
  // Snapshots are only written by parseRuzWeek; identity/version checks also guard mapping changes.
  const value = payload as RuzWeek | null;
  return value?.version === 1 &&
    value.groupId === groupId &&
    value.groupCode === groupCode &&
    value.weekStart === weekStart &&
    Array.isArray(value.days)
    ? value
    : null;
}
export async function loadRuzSchedule(
  user: SessionUser,
  rawWeek?: string,
  deps: Dependencies = {},
): Promise<ScheduleResult> {
  const now = deps.now ?? new Date(),
    weekStart = requestedWeek(rawWeek, now);
  const group = await prisma.studyGroup.findFirst({
    where: {
      id: user.groupId,
      members: { some: { userId: user.id } },
      enrollments: {
        some: { userId: user.id, status: { in: ["CLAIMED", "VERIFIED"] } },
      },
    },
    select: {
      id: true,
      code: true,
      ruzGroupId: true,
      enrollments: {
        where: { userId: user.id },
        select: { subgroup: true },
        take: 1,
      },
    },
  });
  if (!group) throw new ForbiddenError("Нет доступа к расписанию этой группы");
  const subgroup = group.enrollments[0]?.subgroup ?? null;
  const base = { weekStart, fetchedAt: null, data: null, subgroup };
  if (!group.ruzGroupId) return { ...base, state: "UNCONFIGURED" };
  const where = { groupId_weekStart: { groupId: group.id, weekStart } };
  let cached = await prisma.ruzScheduleCache.findUnique({ where });
  const present = (): ScheduleResult => {
    const data = cachedWeek(
      cached?.payload,
      group.ruzGroupId!,
      group.code,
      weekStart,
    );
    return {
      weekStart,
      subgroup,
      data,
      fetchedAt: data ? (cached?.fetchedAt ?? null) : null,
      state: data
        ? cached?.fetchedAt && now.getTime() - cached.fetchedAt.getTime() < TTL
          ? "FRESH"
          : "STALE"
        : "UNAVAILABLE",
    };
  };
  if (present().state === "FRESH") return present();
  if (cached?.retryAfter && cached.retryAfter > now) return present();
  if (!cached)
    cached = await prisma.ruzScheduleCache.upsert({
      where,
      update: {},
      create: { groupId: group.id, weekStart },
    });
  // Lease value is a compare-and-swap token. Independent Vercel instances share it.
  const lease = new Date(
    now.getTime() + 30000 + (parseInt(randomUUID().slice(0, 4), 16) % 1000),
  );
  const locked = await prisma.ruzScheduleCache.updateMany({
    where: {
      groupId: group.id,
      weekStart,
      AND: [
        { OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
        { OR: [{ retryAfter: null }, { retryAfter: { lte: now } }] },
      ],
    },
    data: { leaseUntil: lease },
  });
  if (!locked.count) {
    cached = await prisma.ruzScheduleCache.findUnique({ where });
    return present();
  }
  try {
    const raw = await (deps.fetcher ?? fetchRuzPayload)(
      `${RUZ_ORIGIN}/api/v1/ruz/scheduler/${group.ruzGroupId}?date=${weekStart}`,
    ).catch((error) => {
      if (error instanceof RuzProviderError) throw error;
      throw new RuzProviderError(
        ["TimeoutError", "AbortError"].includes(error?.name)
          ? "TIMEOUT"
          : "NETWORK",
      );
    });
    let data: RuzWeek;
    try {
      data = parseRuzWeek(raw, group.ruzGroupId, group.code, weekStart);
    } catch {
      throw new RuzProviderError("INVALID_RESPONSE");
    }
    await prisma.ruzScheduleCache.updateMany({
      where: { groupId: group.id, weekStart, leaseUntil: lease },
      data: {
        payload: data as unknown as Prisma.InputJsonValue,
        fetchedAt: now,
        leaseUntil: null,
        retryAfter: null,
        lastErrorCode: null,
      },
    });
    cached = await prisma.ruzScheduleCache.findUnique({ where });
    return present();
  } catch (error) {
    await prisma.ruzScheduleCache.updateMany({
      where: { groupId: group.id, weekStart, leaseUntil: lease },
      data: {
        leaseUntil: null,
        retryAfter: new Date(now.getTime() + 60000),
        lastErrorCode:
          error instanceof RuzProviderError ? error.code : "INTERNAL",
      },
    });
    cached = await prisma.ruzScheduleCache.findUnique({ where });
    return present();
  }
}
