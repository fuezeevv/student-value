import { it, expect, vi, afterEach } from "vitest";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../src/server/schedule/ruz-public-json", () => ({
  publicRuzJson: request,
}));
import { loadFacultyGroups } from "../src/server/schedule/ruz-catalog";
afterEach(() => {
  vi.unstubAllEnvs();
  request.mockReset();
});
it("binds groups to an institute returned by the official catalog", async () => {
  vi.stubEnv("SV_TEST_ISOLATED", "0");
  request
    .mockResolvedValueOnce({
      faculties: [
        { id: 92, name: "Инженерно-строительный институт", abbr: "ИСИ" },
      ],
    })
    .mockResolvedValueOnce({
      faculty: { id: 92, name: "Инженерно-строительный институт", abbr: "ИСИ" },
      groups: [{ id: 123, name: "1234567/40001_2025", level: 3, year: 2026 }],
    });
  expect(await loadFacultyGroups(92)).toEqual([
    {
      id: 123,
      name: "1234567/40001_2025",
      level: 3,
      year: 2026,
      facultyId: 92,
    },
  ]);
  expect(request.mock.calls.map((x) => x[0])).toEqual([
    "faculties",
    "faculties/92/groups",
  ]);
});
it("rejects a caller-invented institute and a mismatching provider response", async () => {
  vi.stubEnv("SV_TEST_ISOLATED", "0");
  const list = { faculties: [{ id: 125, name: "ИКНК", abbr: "ИКНК" }] };
  request.mockResolvedValueOnce(list);
  await expect(loadFacultyGroups(999)).rejects.toThrow("Unknown institute");
  expect(request).toHaveBeenCalledTimes(1);
  request
    .mockResolvedValueOnce(list)
    .mockResolvedValueOnce({
      faculty: { id: 92, name: "ИСИ", abbr: "ИСИ" },
      groups: [],
    });
  await expect(loadFacultyGroups(125)).rejects.toThrow("Institute mismatch");
});
