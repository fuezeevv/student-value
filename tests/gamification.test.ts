import { describe, it, expect } from "vitest";
import { awardXp } from "../src/server/services/gamification-service";
import { prisma } from "../src/lib/db/prisma";

describe("Gamification & XP Ledger Service", () => {
  const testUserId = "user-dev-student";
  const testTaskId = "task-otu-lab1";
  const testRuleCode = "TASK_ACCEPTED";

  it("prevents double XP awarding for the same task and rule (idempotent ledger)", async () => {
    const testRule = `TEST_IDEMPOTENT_${Date.now()}`;
    const res1 = await awardXp({
      userId: testUserId,
      taskId: testTaskId,
      ruleCode: testRule,
      overridePoints: 50,
      reason: "Первая сдача задания",
    });
    expect(res1.awarded).toBe(true);

    const res2 = await awardXp({
      userId: testUserId,
      taskId: testTaskId,
      ruleCode: testRule,
      overridePoints: 50,
      reason: "Повторная попытка сдачи того же задания",
    });
    expect(res2.awarded).toBe(false);
    expect(res2.reason).toBe("Already awarded");

    // Clean up
    await prisma.xpEvent.deleteMany({ where: { userId: testUserId, ruleCode: testRule } });
  });

  it("awards XP for a unique domain event", async () => {
    const uniqueRule = `CUSTOM_BONUS_${Date.now()}`;

    const res = await awardXp({
      userId: testUserId,
      ruleCode: uniqueRule,
      reason: "Уникальный бонус",
      overridePoints: 40,
    });

    expect(res.awarded).toBe(true);
    expect(res.xpEvent?.points).toBe(40);

    // Clean up
    if (res.xpEvent?.id) {
      await prisma.xpEvent.delete({ where: { id: res.xpEvent.id } });
    }
  });
});
