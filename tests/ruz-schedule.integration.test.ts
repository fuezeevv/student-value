import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma as p } from "../src/lib/db/prisma";
import type { SessionUser } from "../src/lib/auth/session";
import { loadRuzSchedule } from "../src/server/schedule/ruz";
const groupId = randomUUID(),
  code = "[TEST] RUZ " + groupId,
  ruzId = parseInt(groupId.slice(0, 7), 16) + 1;
const user: SessionUser = {
  id: "user-dev-owner",
  nickname: "test",
  avatarUrl: null,
  bio: null,
  isSystemAdmin: false,
  isOwner: true,
  isPlatformOwner: false,
  groupId,
  permissions: [],
};
const now = new Date("2026-11-04T08:00:00Z");
function payload(id = ruzId) {
  return {
    week: { date_start: "2026.11.02", date_end: "2026.11.08" },
    group: { id, name: code, faculty: { id: 125 } },
    days: [
      {
        date: "2026-11-05",
        lessons: [
          {
            subject: "[TEST] Теория",
            time_start: "10:00",
            time_end: "11:40",
            groups: [{ id, name: code }],
          },
        ],
      },
    ],
  };
}
beforeAll(async () => {
  await p.studyGroup.create({
    data: {
      id: groupId,
      code,
      name: "[TEST] RUZ",
      ruzGroupId: ruzId,
      members: { create: { userId: user.id, isOwner: true } },
      enrollments: {
        create: {
          userId: user.id,
          fullName: "[TEST] Owner",
          subgroup: 2,
          status: "CLAIMED",
        },
      },
    },
  });
});
describe("isolated RUZ cache and access", () => {
  it("fetches once, reuses a fresh snapshot and preserves it through upstream failure", async () => {
    let calls = 0;
    const fetcher = async (url: string) => {
      expect(url).toBe(
        `https://ruz.spbstu.ru/api/v1/ruz/scheduler/${ruzId}?date=2026-11-02`,
      );
      calls++;
      return payload();
    };
    const first = await loadRuzSchedule(user, undefined, { now, fetcher });
    expect(first.state).toBe("FRESH");
    expect(first.subgroup).toBe(2);
    expect(first.data?.days[3].lessons[0].subject).toBe("[TEST] Теория");
    await loadRuzSchedule(user, undefined, {
      now: new Date(now.getTime() + 5000),
      fetcher,
    });
    expect(calls).toBe(1);
    const stale = await loadRuzSchedule(user, undefined, {
      now: new Date(now.getTime() + 11 * 60000),
      fetcher: async () => {
        throw Error("upstream");
      },
    });
    expect(stale.state).toBe("STALE");
    expect(stale.fetchedAt).toEqual(now);
    expect(stale.data).toEqual(first.data);
    await loadRuzSchedule(user, undefined, {
      now: new Date(now.getTime() + 11 * 60000 + 1000),
      fetcher,
    });
    expect(calls).toBe(1);
    expect(
      await p.task.count({
        where: { courseOffering: { groups: { some: { groupId } } } },
      }),
    ).toBe(0);
    expect(await p.enrollment.count({ where: { groupId } })).toBe(1);
  });
  it("does not accept a foreign response or let platform flags cross group membership", async () => {
    const result = await loadRuzSchedule(user, undefined, {
      now: new Date(now.getTime() + 13 * 60000),
      fetcher: async () => payload(999),
    });
    expect(result.state).toBe("STALE");
    expect(result.data?.groupId).toBe(ruzId);
    await expect(
      loadRuzSchedule(
        { ...user, id: "user-dev-student", isPlatformOwner: true },
        undefined,
        { now, fetcher: async () => payload() },
      ),
    ).rejects.toThrow();
  });
  it("shares a fetch lease across concurrent readers and never treats missing data as no classes", async () => {
    const start = new Date(now.getTime() + 16 * 60000);
    let calls = 0;
    const reads = await Promise.all(
      Array.from({ length: 10 }, () =>
        loadRuzSchedule(user, undefined, {
          now: start,
          fetcher: async () => {
            calls++;
            await new Promise((r) => setTimeout(r, 80));
            return payload();
          },
        }),
      ),
    );
    expect(calls).toBe(1);
    expect(reads.every((r) => r.data !== null)).toBe(true);
    const other = randomUUID();
    await p.studyGroup.create({
      data: {
        id: other,
        code: "[TEST] Empty " + other,
        name: "[TEST] Empty",
        ruzGroupId: ruzId + 1,
        members: { create: { userId: user.id } },
        enrollments: {
          create: {
            userId: user.id,
            fullName: "[TEST] Owner",
            status: "CLAIMED",
          },
        },
      },
    });
    const missing = await loadRuzSchedule(
      { ...user, groupId: other },
      undefined,
      {
        now,
        fetcher: async () => {
          throw Error("down");
        },
      },
    );
    expect(missing.state).toBe("UNAVAILABLE");
    expect(missing.data).toBeNull();
  });
});
