import { describe, it, expect, beforeAll } from "vitest";
import { NextRequest } from "next/server";
import {
  handleTimetableRequest,
  buildDeterministicOccurrenceId,
  resolveGroupCode,
} from "../src/server/adapters/timetable-v1";
import {
  mobileTimetableSchema,
  mobileDayView,
} from "../packages/mobile-contracts/src";
import { prisma } from "../src/lib/db/prisma";
import { seedPublicPreview } from "./fixtures/public-preview";

beforeAll(async () => {
  await seedPublicPreview(prisma);
});

describe("GET /api/v1/timetable (Mobile Timetable Contract v1)", () => {
  it("rejects unknown or unlisted groups with 404", async () => {
    const req = new NextRequest(
      "http://localhost/api/v1/timetable?group=unknown-group",
    );
    const res = await handleTimetableRequest(req);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.code).toBe("GROUP_NOT_FOUND");
  });

  it("rejects ambiguous shorthand group code with 400 and returns candidates", async () => {
    const req = new NextRequest(
      "http://localhost/api/v1/timetable?group=201",
    );
    const res = await handleTimetableRequest(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("AMBIGUOUS_GROUP_CODE");
    expect(body.candidates).toContain("5130901/40201");
    expect(body.candidates).toContain("5130902/40201");
  });

  it("resolves unambiguous shorthand or full group codes", () => {
    expect(resolveGroupCode("102")).toEqual({
      kind: "OK",
      code: "5130901/40102",
      ruzId: 45591,
    });
    expect(resolveGroupCode("5130901/40102")).toEqual({
      kind: "OK",
      code: "5130901/40102",
      ruzId: 45591,
    });
    expect(resolveGroupCode("5130901-40102")).toEqual({
      kind: "OK",
      code: "5130901/40102",
      ruzId: 45591,
    });
    expect(resolveGroupCode("45591")).toEqual({
      kind: "OK",
      code: "5130901/40102",
      ruzId: 45591,
    });
    expect(resolveGroupCode("201")).toEqual({
      kind: "AMBIGUOUS",
      matches: ["5130901/40201", "5130902/40201"],
    });
    expect(resolveGroupCode("nonexistent")).toEqual({ kind: "NOT_FOUND" });
  });

  it("rejects invalid date formats with 400", async () => {
    const req = new NextRequest(
      "http://localhost/api/v1/timetable?group=5130901/40102&date=invalid-date",
    );
    const res = await handleTimetableRequest(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("INVALID_DATE");
  });

  it("returns a strict v1 MobileTimetable snapshot for group 102", async () => {
    const req = new NextRequest(
      "http://localhost/api/v1/timetable?group=5130901/40102&date=2026-11-16",
    );
    const res = await handleTimetableRequest(req);
    const body = await res.json();

    // Must strictly validate against schema without extra or missing fields
    const parsed = mobileTimetableSchema.safeParse(body);
    expect(parsed.success).toBe(true);

    if (parsed.success) {
      expect(parsed.data.schemaVersion).toBe(1);
      expect(parsed.data.group.code).toBe("5130901/40102");
      expect(parsed.data.group.ruzId).toBe(45591);
      expect(parsed.data.weekStart).toBe("2026-11-16");

      if (parsed.data.state === "FRESH" || parsed.data.state === "STALE") {
        expect(res.status).toBe(200);
        expect(parsed.data.data.days).toHaveLength(7);
        expect(parsed.data.data.days[0].date).toBe("2026-11-16");
        expect(parsed.data.data.days[6].date).toBe("2026-11-22");
      } else {
        expect(res.status).toBe(503);
        expect(parsed.data.data).toBeNull();
      }
    }
  });

  it("generates deterministic, stable occurrence IDs independent of array order", () => {
    const id1 = buildDeterministicOccurrenceId(
      "5130901-40102",
      "2026-11-16",
      "10:00",
      "11:40",
      "Математическое моделирование",
      null,
    );
    const id2 = buildDeterministicOccurrenceId(
      "5130901-40102",
      "2026-11-16",
      "10:00",
      "11:40",
      "Математическое моделирование",
      null,
    );
    expect(id1).toBe(id2);
    expect(id1).toContain("2026-11-16");
    expect(id1).toContain("10001140");

    // Subgroup distinguishes parallel labs at same time slot
    const idSub1 = buildDeterministicOccurrenceId(
      "5130901-40102",
      "2026-11-16",
      "12:00",
      "13:40",
      "САПР",
      "подгруппа 1",
    );
    const idSub2 = buildDeterministicOccurrenceId(
      "5130901-40102",
      "2026-11-16",
      "12:00",
      "13:40",
      "САПР",
      "подгруппа 2",
    );
    expect(idSub1).not.toBe(idSub2);
  });
});
