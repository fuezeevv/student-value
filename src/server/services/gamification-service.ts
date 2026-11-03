import { createHash, randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { moscowDate, effectiveDeadline } from "@/server/domain/deadline-date";
import {
  isTrustedAccepted,
  progressEvidenceInclude,
} from "@/server/domain/trust";
import { confirmedDeadlineWhere } from "@/server/domain/deadline-visibility";

export interface AwardXpParams {
  userId: string;
  taskId?: string;
  ruleCode: string;
  reason: string;
  overridePoints?: number;
}
const eventId = (p: AwardXpParams) =>
  "xp-" +
  createHash("sha256")
    .update(JSON.stringify([p.userId, p.taskId ?? null, p.ruleCode]))
    .digest("hex");
export async function awardXpInTransaction(
  tx: Prisma.TransactionClient,
  p: AwardXpParams,
) {
  const old = await tx.xpEvent.findFirst({
    where: { userId: p.userId, taskId: p.taskId ?? null, ruleCode: p.ruleCode },
  });
  if (old) return { awarded: false, xpEvent: old, reason: "Already awarded" };
  const points =
    p.overridePoints ??
    (await tx.xpRule.findUnique({ where: { code: p.ruleCode } }))?.points;
  if (points === undefined)
    return { awarded: false, reason: "Rule not configured" };
  const id = eventId(p);
  const inserted = await tx.xpEvent.createMany({
    data: {
      id,
      userId: p.userId,
      taskId: p.taskId ?? null,
      ruleCode: p.ruleCode,
      points,
      reason: p.reason,
    },
    skipDuplicates: true,
  });
  if (!inserted.count) return { awarded: false, reason: "Already awarded" };
  const now = new Date();
  const previous = await tx.userGamificationProfile.findUnique({
    where: { userId: p.userId },
  });
  const day = moscowDate(now),
    yesterday = moscowDate(new Date(now.getTime() - 86400000));
  const lastDay = previous?.lastActivityDate
    ? moscowDate(previous.lastActivityDate)
    : null;
  const streak =
    points <= 0
      ? (previous?.currentStreak ?? 0)
      : lastDay === day
        ? (previous?.currentStreak ?? 1)
        : lastDay === yesterday
          ? (previous?.currentStreak ?? 0) + 1
          : 1;
  const total = (previous?.totalXp ?? 0) + points;
  const profile = await tx.userGamificationProfile.upsert({
    where: { userId: p.userId },
    create: {
      userId: p.userId,
      totalXp: total,
      level: Math.max(1, Math.floor(Math.sqrt(Math.max(0, total) / 50)) + 1),
      currentStreak: streak,
      longestStreak: streak,
      isLeaderboardOptIn: false,
      lastActivityDate: points > 0 ? now : null,
    },
    update: {
      totalXp: { increment: points },
      level: Math.max(1, Math.floor(Math.sqrt(Math.max(0, total) / 50)) + 1),
      currentStreak: streak,
      longestStreak: Math.max(previous?.longestStreak ?? 0, streak),
      ...(points > 0 ? { lastActivityDate: now } : {}),
    },
  });
  return {
    awarded: true,
    xpEvent: await tx.xpEvent.findUniqueOrThrow({ where: { id } }),
    newTotalXp: profile.totalXp,
    newLevel: profile.level,
  };
}
export async function awardXp(p: AwardXpParams) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${p.userId} FOR UPDATE`;
    return awardXpInTransaction(tx, p);
  });
}
export const completionMilestones = [
  { code: "WORK_1", title: "Первый результат", count: 1 },
  { code: "WORK_3", title: "Войти в ритм", count: 3 },
  { code: "WORK_5", title: "Пять работ позади", count: 5 },
  { code: "WORK_10", title: "Десятка", count: 10 },
  { code: "WORK_20", title: "Уверенный семестр", count: 20 },
  { code: "WORK_40", title: "Большой путь", count: 40 },
];
async function unlock(
  tx: Prisma.TransactionClient,
  userId: string,
  code: string,
) {
  const achievement = await tx.achievementDefinition.findUnique({
    where: { code },
  });
  if (!achievement) return false;
  const created = await tx.userAchievement.createMany({
    data: { userId, achievementCode: code },
    skipDuplicates: true,
  });
  if (!created.count) return false;
  await awardXpInTransaction(tx, {
    userId,
    ruleCode: "ACHIEVEMENT:" + code,
    reason: achievement.title,
    overridePoints: achievement.points,
  });
  await tx.notification.create({
    data: {
      userId,
      title: achievement.title,
      message: achievement.description,
      type: "ACHIEVEMENT",
      link: "/leaderboard",
    },
  });
  return true;
}
export async function checkAndUnlockAchievement(userId: string, code: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    return unlock(tx, userId, code);
  });
}
/** Called under the user's row lock, in the same transaction as progress. Immutable compensating events prevent toggle farming. */
export async function reconcileCompletionXp(
  tx: Prisma.TransactionClient,
  userId: string,
  taskId: string,
  complete: boolean,
  completedAt: Date | null,
) {
  const before = await tx.xpEvent.aggregate({
    where: { userId, taskId, ruleCode: { startsWith: "COMPLETION:" } },
    _sum: { points: true },
  });
  const deadline = await tx.deadline.findFirst({
    where: { ...confirmedDeadlineWhere, taskId, type: "HARD" },
    orderBy: { date: "asc" },
  });
  const onTime =
    complete &&
    completedAt &&
    deadline &&
    completedAt <= effectiveDeadline(deadline.date, deadline.isTimeStrict);
  const target = complete ? 20 + (onTime ? 5 : 0) : 0;
  const delta = target - (before._sum.points ?? 0);
  if (delta)
    await awardXpInTransaction(tx, {
      userId,
      taskId,
      ruleCode: "COMPLETION:" + randomUUID(),
      overridePoints: delta,
      reason:
        delta < 0
          ? "Отметка выполнения отменена"
          : onTime
            ? "Работа выполнена до срока · 20 + 5 XP"
            : "Работа выполнена · 20 XP",
    });
  if (!complete) return;
  const rows = await tx.studentTaskProgress.findMany({
    where: { userId, status: { in: ["READY", "SUBMITTED", "ACCEPTED"] } },
    include: progressEvidenceInclude,
  });
  const count = rows.filter(
    (p) =>
      p.status === "READY" || p.status === "SUBMITTED" || isTrustedAccepted(p),
  ).length;
  await tx.achievementDefinition.createMany({
    data: completionMilestones.map((m) => ({
      code: m.code,
      title: m.title,
      description: `Отметить выполнение ${m.count} работ.`,
      badgeIcon: "check",
      points: 0,
      category: "WORK",
    })),
    skipDuplicates: true,
  });
  for (const m of completionMilestones) {
    if (count >= m.count) await unlock(tx, userId, m.code);
  }
}
export async function awardActivation(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
  await awardXpInTransaction(tx, {
    userId,
    ruleCode: "PROFILE_ACTIVATED",
    reason: "Профиль активирован",
    overridePoints: 20,
  });
}
