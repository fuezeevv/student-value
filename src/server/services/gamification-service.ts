import { prisma } from "@/lib/db/prisma";

export interface AwardXpParams {
  userId: string;
  taskId?: string;
  ruleCode: string;
  reason: string;
  overridePoints?: number;
}

export async function awardXp({
  userId,
  taskId,
  ruleCode,
  reason,
  overridePoints,
}: AwardXpParams) {
  // 1. Check if this exact event already exists (Ledger idempotency: no double XP)
  if (taskId) {
    const existing = await prisma.xpEvent.findUnique({
      where: {
        userId_taskId_ruleCode: {
          userId,
          taskId,
          ruleCode,
        },
      },
    });
    if (existing) {
      return { awarded: false, xpEvent: existing, reason: "Already awarded" };
    }
  }

  // 2. Fetch rule points
  let points = overridePoints;
  if (points === undefined) {
    const rule = await prisma.xpRule.findUnique({
      where: { code: ruleCode },
    });
    points = rule?.points ?? 50;
  }

  // 3. Create XP Event in transaction and update profile
  const result = await prisma.$transaction(async (tx) => {
    const xpEvent = await tx.xpEvent.create({
      data: {
        userId,
        taskId: taskId || null,
        ruleCode,
        points,
        reason,
      },
    });

    // Fetch or create user profile
    const profile = await tx.userGamificationProfile.upsert({
      where: { userId },
      update: {
        totalXp: { increment: points },
        lastActivityDate: new Date(),
      },
      create: {
        userId,
        totalXp: points,
        level: 1,
        currentStreak: 1,
        longestStreak: 1,
        isLeaderboardOptIn: true,
        lastActivityDate: new Date(),
      },
    });

    // Level calculation: 100 XP per level with mild scaling
    const newLevel = Math.max(1, Math.floor(Math.sqrt(profile.totalXp / 50)) + 1);
    if (newLevel !== profile.level) {
      await tx.userGamificationProfile.update({
        where: { userId },
        data: { level: newLevel },
      });
    }

    return { xpEvent, newTotalXp: profile.totalXp, newLevel };
  });

  return { awarded: true, ...result };
}

export async function checkAndUnlockAchievement(
  userId: string,
  achievementCode: string
) {
  const existing = await prisma.userAchievement.findUnique({
    where: {
      userId_achievementCode: {
        userId,
        achievementCode,
      },
    },
  });

  if (existing) return false;

  const achievement = await prisma.achievementDefinition.findUnique({
    where: { code: achievementCode },
  });

  if (!achievement) return false;

  await prisma.userAchievement.create({
    data: {
      userId,
      achievementCode,
    },
  });

  // Also create in-app notification
  await prisma.notification.create({
    data: {
      userId,
      title: `Новое достижение: ${achievement.title}!`,
      message: achievement.description,
      type: "ACHIEVEMENT",
      link: "/leaderboard",
    },
  });

  return true;
}
