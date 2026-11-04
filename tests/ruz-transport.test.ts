import { describe, it, expect } from "vitest";
import { fetchRuzPayload } from "../src/server/schedule/ruz-transport";
import { parseRuzWeek } from "../src/lib/schedule/ruz";
const url = "https://ruz.spbstu.ru/api/v1/ruz/scheduler/45591?date=2026-11-02";
const raw = {
  group: { id: 45591, name: "5130901/40102", faculty: { id: 125 } },
  week: { date_start: "2026.11.02", date_end: "2026.11.08" },
  days: [
    {
      date: "2026-11-05",
      lessons: [
        {
          subject: "[TEST] Пара",
          time_start: "10:00",
          time_end: "11:40",
          groups: [{ id: 45591, name: "5130901/40102" }],
        },
      ],
    },
  ],
};
function page(data = raw) {
  return `<html><script>window.__INITIAL_STATE__ = ${JSON.stringify({ lessons: { group: data.group, week: data.week, data: { 45591: data.days } } })};</script></html>`;
}
describe("bounded official RUZ transport", () => {
  it("recovers an API timeout through the same official public timetable", async () => {
    let calls = 0;
    const request: typeof fetch = async () => {
      if (++calls === 1)
        throw Object.assign(new Error("timeout details are private"), {
          name: "TimeoutError",
        });
      return new Response(page());
    };
    const result = parseRuzWeek(
      await fetchRuzPayload(url, request),
      45591,
      "5130901/40102",
      "2026-11-02",
    );
    expect(result.days[3].lessons).toHaveLength(1);
    expect(calls).toBe(2);
  });
  it("uses API directly when it responds", async () => {
    let calls = 0;
    const request: typeof fetch = async (_input, init) => {
      calls++;
      expect(init?.redirect).toBe("error");
      return Response.json(raw);
    };
    expect(await fetchRuzPayload(url, request)).toEqual(raw);
    expect(calls).toBe(1);
  });
  it("falls back to the official public page and validates its same group/week without executing scripts", async () => {
    const urls: string[] = [];
    const request: typeof fetch = async (input) => {
      urls.push(String(input));
      return urls.length === 1
        ? new Response("unavailable", { status: 503 })
        : new Response(
            page() + "<script>throw new Error('never execute')</script>",
          );
    };
    const result = parseRuzWeek(
      await fetchRuzPayload(url, request),
      45591,
      "5130901/40102",
      "2026-11-02",
    );
    expect(result.days[3].lessons[0].subject).toBe("[TEST] Пара");
    expect(urls).toEqual([
      url,
      "https://ruz.spbstu.ru/faculty/125/groups/45591?date=2026-11-02",
    ]);
  });
  it("enforces the size bound on both attempts", async () => {
    const request: typeof fetch = async () =>
      new Response("x".repeat(512 * 1024 + 1));
    await expect(fetchRuzPayload(url, request)).rejects.toMatchObject({
      code: "PAGE_TOO_LARGE",
    });
  });
  it("rejects executable/non-JSON state and never treats it as an empty timetable", async () => {
    let calls = 0;
    const request: typeof fetch = async () => {
      calls++;
      return calls === 1
        ? new Response("down", { status: 502 })
        : new Response(
            "<script>window.__INITIAL_STATE__ = (()=>{throw Error('unsafe')})();</script>",
          );
    };
    await expect(fetchRuzPayload(url, request)).rejects.toMatchObject({
      code: "PAGE_INVALID_RESPONSE",
    });
  });
  it("blocks other origins and real network access in tests", async () => {
    let calls = 0;
    const request: typeof fetch = async () => {
      calls++;
      return Response.json(raw);
    };
    await expect(
      fetchRuzPayload(
        "https://evil.test/api/v1/ruz/scheduler/45591?date=2026-11-02",
        request,
      ),
    ).rejects.toMatchObject({ code: "INVALID_REQUEST" });
    expect(calls).toBe(0);
    await expect(fetchRuzPayload(url)).rejects.toThrow(
      "Real RUZ requests are forbidden",
    );
  });
});
