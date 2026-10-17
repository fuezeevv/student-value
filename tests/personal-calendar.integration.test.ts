import { describe, it, expect } from "vitest";
import { randomUUID, randomBytes } from "node:crypto";
import { prisma } from "../src/lib/db/prisma";
import type { SessionUser } from "../src/lib/auth/session";
import {
  sealCalendarValue,
  openCalendarValue,
  makeCalendarFlow,
  readCalendarFlow,
} from "../src/server/calendar/crypto";
import {
  attachPersonalCalendar,
  disconnectPersonalCalendar,
  recoverPersonalCalendar,
  saveCalendarReminders,
  retryCalendarCreationAfterReview,
} from "../src/server/calendar/connections";
import {
  loadDesiredCalendarEvents,
  stableCalendarEventId,
} from "../src/server/calendar/desired-events";
import { syncPersonalCalendar } from "../src/server/calendar/sync";
import {
  CalendarProviderError,
  type CalendarTransport,
  type CalendarEventBody,
} from "../src/server/calendar/google-transport";
import { updateOwnProgress } from "../src/server/domain/progress";
import { rescheduleDeadline } from "../src/server/domain/deadlines";
import { enqueuePersonalCalendar } from "../src/server/calendar/queue";
const now = () => new Date("2026-11-01T09:00:00Z");
function fakeProvider() {
  const events = new Map<string, CalendarEventBody>();
  const markers = new Map<string, string>();
  let creations = 0,
    puts = 0,
    failPut = false,
    failCreate = false,
    revocations = 0;
  const transport: CalendarTransport = {
    async refresh() {
      return "isolated-access";
    },
    async createCalendar(_token, marker) {
      creations++;
      const id = "[TEST] calendar-" + randomUUID();
      markers.set(id, marker);
      if (failCreate) throw new CalendarProviderError("TEMPORARY");
      return id;
    },
    async checkCalendar(_token, id, marker) {
      return markers.get(id) === marker;
    },
    async putEvent(_token, calendarId, eventId, body) {
      if (failPut) throw new CalendarProviderError("TEMPORARY");
      puts++;
      events.set(calendarId + ":" + eventId, structuredClone(body));
    },
    async removeEvent(_token, calendarId, eventId) {
      events.delete(calendarId + ":" + eventId);
    },
    async muteEvent(_token, calendarId, eventId) {
      const event = events.get(calendarId + ":" + eventId);
      if (event) event.reminders.overrides = [];
    },
    async revoke() {
      revocations++;
    },
  };
  return {
    transport,
    events,
    markers,
    get creations() {
      return creations;
    },
    get puts() {
      return puts;
    },
    get revocations() {
      return revocations;
    },
    set failPut(value: boolean) {
      failPut = value;
    },
    set failCreate(value: boolean) {
      failCreate = value;
    },
  };
}
async function fixture() {
  const key = randomBytes(32).toString("base64"),
    sub = "[TEST] " + randomUUID();
  const group = await prisma.studyGroup.create({
    data: { code: "TEST-CAL-" + randomUUID(), name: "[TEST] Calendar group" },
  });
  const user = await prisma.user.create({
    data: {
      nickname: "[TEST] cal-" + randomUUID(),
      identities: {
        create: {
          provider: "GOOGLE",
          providerUserId: sub,
          email: randomUUID() + "@example.invalid",
        },
      },
      memberships: { create: { groupId: group.id, isOwner: true } },
      enrollments: {
        create: {
          groupId: group.id,
          fullName: "[TEST] Calendar person",
          status: "CLAIMED",
          subgroup: 1,
        },
      },
    },
  });
  const semester = await prisma.semester.create({
    data: { name: "[TEST] Calendar term" },
  });
  const definition = await prisma.courseDefinition.create({
    data: {
      code: "TEST-CAL-" + randomUUID(),
      title: "[TEST] Calendar subject",
      shortTitle: "[TEST] Subject",
    },
  });
  const course = await prisma.courseOffering.create({
    data: {
      semesterId: semester.id,
      courseDefinitionId: definition.id,
      groups: { create: { groupId: group.id } },
    },
  });
  const task = await prisma.task.create({
    data: {
      title: "[TEST] Evidence-backed work",
      type: "HOMEWORK",
      courseOfferingId: course.id,
      createdById: user.id,
      updatedById: user.id,
      audiences: { create: { targetType: "GROUP", groupId: group.id } },
      progress: {
        create: {
          userId: user.id,
          studentNotes: "[TEST] PRIVATE_NOTE_NEVER_EXPORT",
        },
      },
    },
  });
  const id = randomUUID();
  const source = await prisma.source.create({
    data: {
      groupId: group.id,
      type: "HEADMAN_RECORD",
      title: "[TEST] Exact deadline source",
    },
  });
  const reference = await prisma.sourceReference.create({
    data: {
      sourceId: source.id,
      entityType: "DEADLINE",
      entityId: id,
      confidence: "CONFIRMED",
      quoteText: "[TEST] Explicit date for this isolated check",
    },
  });
  const deadline = await prisma.deadline.create({
    data: {
      id,
      taskId: task.id,
      courseOfferingId: course.id,
      date: new Date("2026-11-20T20:59:59.999Z"),
      isTimeStrict: false,
      createdById: user.id,
      provenance: "HEADMAN_CONFIRMED",
      sourceReferenceId: reference.id,
    },
  });
  const actor: SessionUser = {
    id: user.id,
    groupId: group.id,
    nickname: user.nickname,
    avatarUrl: null,
    bio: null,
    isOwner: true,
    isSystemAdmin: false,
    permissions: [],
  };
  await attachPersonalCalendar(user.id, sub, "[TEST] refresh-secret", key);
  return { key, sub, user, group, course, task, deadline, actor };
}
describe("Calendar consent encryption and boundaries", () => {
  it("authenticates ciphertext, binds it to the exact user and purpose, and expires flow state", () => {
    const key = randomBytes(32).toString("base64");
    const cipher = sealCalendarValue("isolated-refresh", key, "one");
    expect(cipher).not.toContain("isolated-refresh");
    expect(openCalendarValue(cipher, key, "one")).toBe("isolated-refresh");
    expect(() => openCalendarValue(cipher, key, "two")).toThrow();
    expect(() => openCalendarValue(cipher, key, "one", "oauth-flow")).toThrow();
    expect(() =>
      openCalendarValue(cipher.slice(0, -4) + "aaaa", key, "one"),
    ).toThrow();
    const grant = makeCalendarFlow("one", key, 1000);
    expect(
      readCalendarFlow(grant.cookie, grant.flow.state, "one", key, 2000).userId,
    ).toBe("one");
    expect(() =>
      readCalendarFlow(grant.cookie, grant.flow.state, "two", key, 2000),
    ).toThrow();
    expect(() =>
      readCalendarFlow(grant.cookie, grant.flow.state, "one", key, 700000),
    ).toThrow();
    expect(() =>
      readCalendarFlow(
        grant.cookie,
        randomBytes(32).toString("base64url"),
        "one",
        key,
        2000,
      ),
    ).toThrow();
  });
  it("binds a calendar grant to the already linked Google sub and keeps credentials encrypted", async () => {
    const f = await fixture();
    await expect(
      attachPersonalCalendar(
        f.user.id,
        "[TEST] Other Google sub",
        "test",
        f.key,
      ),
    ).rejects.toThrow();
    const c = await prisma.personalCalendarConnection.findUniqueOrThrow({
      where: { userId: f.user.id },
    });
    expect(c.refreshTokenEncrypted).not.toContain("refresh-secret");
    expect(openCalendarValue(c.refreshTokenEncrypted!, f.key, f.user.id)).toBe(
      "[TEST] refresh-secret",
    );
    expect(
      JSON.stringify(
        await prisma.auditLog.findMany({ where: { userId: f.user.id } }),
      ),
    ).not.toContain("refresh-secret");
  });
});
describe("Personal academic mirror", () => {
  it("creates one app calendar, performs once-only event upserts, and preserves event identity across reschedules", async () => {
    const f = await fixture(),
      fake = fakeProvider();
    const deps = { transport: fake.transport, tokenKey: f.key, now };
    expect((await syncPersonalCalendar(f.user.id, deps)).state).toBe("SYNCED");
    const event = await prisma.personalCalendarEvent.findUniqueOrThrow({
      where: { userId_taskId: { userId: f.user.id, taskId: f.task.id } },
    });
    expect(fake.creations).toBe(1);
    expect(fake.events.size).toBe(1);
    const original = fake.events.get(event.calendarId + ":" + event.eventId)!;
    expect(original.start).toEqual({ date: "2026-11-20" });
    expect(original.end).toEqual({ date: "2026-11-21" });
    expect(JSON.stringify(original)).not.toContain("PRIVATE_NOTE_NEVER_EXPORT");
    await syncPersonalCalendar(f.user.id, deps);
    expect(fake.creations).toBe(1);
    expect(fake.puts).toBe(1);
    const version = (
      await prisma.personalCalendarConnection.findUniqueOrThrow({
        where: { userId: f.user.id },
      })
    ).requestedVersion;
    await rescheduleDeadline(
      f.actor,
      f.deadline.id,
      "2026-11-24",
      undefined,
      "[TEST] Teacher changed the date for this task",
    );
    expect(
      (
        await prisma.personalCalendarConnection.findUniqueOrThrow({
          where: { userId: f.user.id },
        })
      ).requestedVersion,
    ).toBeGreaterThan(version);
    await syncPersonalCalendar(f.user.id, deps);
    expect(fake.events.size).toBe(1);
    expect(
      (
        await prisma.personalCalendarEvent.findUniqueOrThrow({
          where: { id: event.id },
        })
      ).eventId,
    ).toBe(event.eventId);
    expect(
      fake.events.get(event.calendarId + ":" + event.eventId)!.start,
    ).toEqual({ date: "2026-11-24" });
  });
  it("personal readiness suppresses reminders without accepting the work and resumes them when needed", async () => {
    const f = await fixture(),
      fake = fakeProvider();
    const deps = { transport: fake.transport, tokenKey: f.key, now };
    await syncPersonalCalendar(f.user.id, deps);
    const current = () => [...fake.events.values()][0];
    expect(current().reminders.overrides).toHaveLength(3);
    await updateOwnProgress(f.actor, f.task.id, "READY");
    await syncPersonalCalendar(f.user.id, deps);
    expect(current().reminders.overrides).toEqual([]);
    const progress = await prisma.studentTaskProgress.findUniqueOrThrow({
      where: { taskId_userId: { taskId: f.task.id, userId: f.user.id } },
    });
    expect(progress.isVerified).toBe(false);
    expect(progress.acceptedAt).toBeNull();
    expect(progress.studentNotes).toBe("[TEST] PRIVATE_NOTE_NEVER_EXPORT");
    await updateOwnProgress(f.actor, f.task.id, "IN_PROGRESS");
    await saveCalendarReminders(f.user.id, [1440]);
    await syncPersonalCalendar(f.user.id, deps);
    expect(current().reminders.overrides).toEqual([
      { method: "popup", minutes: 1440 },
    ]);
  });
  it("filters exact audiences, unknown/draft facts and revoked memberships before export or reconciliation", async () => {
    const f = await fixture(),
      fake = fakeProvider();
    for (const [name, audience] of [
      [
        "subgroup",
        { targetType: "SUBGROUP", groupId: f.group.id, subgroupNumber: 2 },
      ],
      ["none", null],
    ] as const) {
      const t = await prisma.task.create({
        data: {
          title: "[TEST] Hidden " + name,
          type: "HOMEWORK",
          courseOfferingId: f.course.id,
          createdById: f.user.id,
          updatedById: f.user.id,
          ...(audience ? { audiences: { create: audience } } : {}),
        },
      });
      await prisma.deadline.create({
        data: {
          taskId: t.id,
          courseOfferingId: f.course.id,
          date: f.deadline.date,
          createdById: f.user.id,
          provenance: "HEADMAN_CONFIRMED",
          sourceReferenceId: f.deadline.sourceReferenceId,
        },
      });
    }
    const desired = await loadDesiredCalendarEvents(f.user.id, [0], now());
    expect(desired.map((x) => x.taskId)).toEqual([f.task.id]);
    await syncPersonalCalendar(f.user.id, {
      transport: fake.transport,
      tokenKey: f.key,
      now,
    });
    expect(fake.events.size).toBe(1);
    await prisma.enrollment.updateMany({
      where: { groupId: f.group.id, userId: f.user.id },
      data: { status: "ARCHIVED" },
    });
    await syncPersonalCalendar(f.user.id, {
      transport: fake.transport,
      tokenKey: f.key,
      now,
    });
    expect(fake.events.size).toBe(0);
    expect(
      await prisma.personalCalendarEvent.findFirst({
        where: { userId: f.user.id },
      }),
    ).toMatchObject({ removed: true });
  });
  it("does not claim synchronization after provider failure and safely retries the same stable event", async () => {
    const f = await fixture(),
      fake = fakeProvider();
    fake.failPut = true;
    const deps = { transport: fake.transport, tokenKey: f.key, now };
    const failed = await syncPersonalCalendar(f.user.id, deps);
    expect(failed.state).toBe("FAILED");
    expect(
      await prisma.personalCalendarConnection.findUnique({
        where: { userId: f.user.id },
      }),
    ).toMatchObject({
      syncedVersion: 0,
      lastSyncedAt: null,
      lastErrorCode: "TEMPORARY",
    });
    fake.failPut = false;
    expect((await syncPersonalCalendar(f.user.id, deps)).state).toBe("SYNCED");
    expect(fake.events.size).toBe(1);
    expect(fake.creations).toBe(1);
    expect([...fake.events.keys()][0]).toContain(
      stableCalendarEventId(f.user.id, f.task.id),
    );
  });
  it("serializes concurrent workers and keeps changes queued during a synchronization", async () => {
    const f = await fixture(),
      fake = fakeProvider();
    let advanced = false;
    const transport = {
      ...fake.transport,
      async putEvent(...args: Parameters<CalendarTransport["putEvent"]>) {
        await fake.transport.putEvent(...args);
        if (!advanced) {
          advanced = true;
          await enqueuePersonalCalendar(prisma, f.user.id);
        }
      },
    };
    const deps = { transport, tokenKey: f.key, now };
    const results = await Promise.all([
      syncPersonalCalendar(f.user.id, deps),
      syncPersonalCalendar(f.user.id, deps),
    ]);
    expect(fake.creations).toBe(1);
    expect(results.some((r) => r.state === "BUSY_OR_DISCONNECTED")).toBe(true);
    const c = await prisma.personalCalendarConnection.findUniqueOrThrow({
      where: { userId: f.user.id },
    });
    expect(c.requestedVersion).toBeGreaterThan(c.syncedVersion);
    expect(c.leaseToken).toBeNull();
    await syncPersonalCalendar(f.user.id, deps);
    const final = await prisma.personalCalendarConnection.findUniqueOrThrow({
      where: { userId: f.user.id },
    });
    expect(final.requestedVersion).toBe(final.syncedVersion);
  });
  it("never automatically creates a duplicate after an ambiguous calendar creation; recovery verifies its marker", async () => {
    const f = await fixture(),
      fake = fakeProvider();
    fake.failCreate = true;
    const deps = { transport: fake.transport, tokenKey: f.key, now };
    await syncPersonalCalendar(f.user.id, deps);
    expect(fake.creations).toBe(1);
    await syncPersonalCalendar(f.user.id, deps);
    expect(fake.creations).toBe(1);
    expect(
      await prisma.personalCalendarConnection.findUnique({
        where: { userId: f.user.id },
      }),
    ).toMatchObject({
      provisioning: "UNCERTAIN",
      lastErrorCode: "CREATE_UNCERTAIN",
    });
    await expect(
      recoverPersonalCalendar(f.user.id, "another-calendar", {
        transport: fake.transport,
        key: f.key,
      }),
    ).rejects.toThrow();
    await recoverPersonalCalendar(f.user.id, [...fake.markers.keys()][0], {
      transport: fake.transport,
      key: f.key,
    });
    fake.failCreate = false;
    expect((await syncPersonalCalendar(f.user.id, deps)).state).toBe("SYNCED");
    expect(fake.creations).toBe(1);
  });
  it("pauses revoked consent and reconnects to its existing calendar without duplicates", async () => {
    const f = await fixture(),
      fake = fakeProvider();
    const deps = { transport: fake.transport, tokenKey: f.key, now };
    await syncPersonalCalendar(f.user.id, deps);
    const broken = {
      ...fake.transport,
      async refresh() {
        throw new CalendarProviderError("REAUTH_REQUIRED");
      },
    };
    expect(
      (await syncPersonalCalendar(f.user.id, { ...deps, transport: broken }))
        .state,
    ).toBe("FAILED");
    expect(
      await prisma.personalCalendarConnection.findUnique({
        where: { userId: f.user.id },
      }),
    ).toMatchObject({ state: "REAUTH_REQUIRED", refreshTokenEncrypted: null });
    await attachPersonalCalendar(
      f.user.id,
      f.sub,
      "[TEST] refreshed-consent",
      f.key,
    );
    await syncPersonalCalendar(f.user.id, deps);
    expect(fake.creations).toBe(1);
    expect(fake.events.size).toBe(1);
  });
  it("requires an explicit Google-side human check before retrying an ambiguous creation", async () => {
    const f = await fixture(),
      fake = fakeProvider();
    fake.failCreate = true;
    const deps = { transport: fake.transport, tokenKey: f.key, now };
    await syncPersonalCalendar(f.user.id, deps);
    await expect(
      retryCalendarCreationAfterReview(f.user.id, false),
    ).rejects.toThrow();
    expect(fake.creations).toBe(1);
    await retryCalendarCreationAfterReview(f.user.id, true);
    fake.failCreate = false;
    await syncPersonalCalendar(f.user.id, deps);
    expect(fake.creations).toBe(2);
  });
  it("still removes a stored credential when a rotated key cannot decrypt it", async () => {
    const f = await fixture(),
      fake = fakeProvider();
    const result = await disconnectPersonalCalendar(f.user.id, {
      transport: fake.transport,
      key: randomBytes(32).toString("base64"),
    });
    expect(result).toEqual({ remindersMuted: false, revoked: false });
    expect(
      await prisma.personalCalendarConnection.findUnique({
        where: { userId: f.user.id },
      }),
    ).toMatchObject({
      state: "DISCONNECTED",
      refreshTokenEncrypted: null,
      lastErrorCode: "DISCONNECTED_CHECK_GOOGLE",
    });
  });
  it("disconnects without deleting academic data, removes its credential and mutes its own Google reminders", async () => {
    const f = await fixture(),
      fake = fakeProvider();
    const deps = { transport: fake.transport, tokenKey: f.key, now };
    await syncPersonalCalendar(f.user.id, deps);
    const before = await prisma.studentTaskProgress.findUnique({
      where: { taskId_userId: { taskId: f.task.id, userId: f.user.id } },
    });
    expect(
      await disconnectPersonalCalendar(f.user.id, {
        transport: fake.transport,
        key: f.key,
      }),
    ).toEqual({ remindersMuted: true, revoked: true });
    expect(
      await prisma.personalCalendarConnection.findUnique({
        where: { userId: f.user.id },
      }),
    ).toMatchObject({ state: "DISCONNECTED", refreshTokenEncrypted: null });
    expect([...fake.events.values()][0].reminders.overrides).toEqual([]);
    expect(fake.revocations).toBe(1);
    expect(
      await prisma.studentTaskProgress.findUnique({
        where: { taskId_userId: { taskId: f.task.id, userId: f.user.id } },
      }),
    ).toEqual(before);
    expect((await syncPersonalCalendar(f.user.id, deps)).state).toBe(
      "BUSY_OR_DISCONNECTED",
    );
  });
});
