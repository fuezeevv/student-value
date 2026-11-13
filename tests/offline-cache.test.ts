import { describe, it, expect } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
const source = fs.readFileSync(
  new URL("../public/sw.js", import.meta.url),
  "utf8",
);
function runtime() {
  const handlers: Record<string, Function> = {};
  vm.runInNewContext(source, {
    self: {
      location: { origin: "https://studentvalue1984.eu.cc" },
      addEventListener: (type: string, fn: Function) => (handlers[type] = fn),
    },
    URL,
  });
  return handlers;
}
describe("offline cache must never intercept personal endpoints", () => {
  for (const route of [
    "/api/auth/google/callback",
    "/api/materials/file",
    "/api/calendar/export",
    "/settings",
    "/courses",
    "/tasks/private",
  ])
    it(route, () => {
      let intercepted = false;
      runtime().fetch({
        request: {
          method: "GET",
          mode: "navigate",
          url: "https://studentvalue1984.eu.cc" + route,
        },
        respondWith: () => {
          intercepted = true;
        },
      });
      expect(intercepted).toBe(false);
    });
  it("never intercepts mutations or third-party requests", () => {
    for (const request of [
      {
        method: "POST",
        url: "https://studentvalue1984.eu.cc/browse/5130901-40102",
      },
      { method: "GET", url: "https://example.com/browse/5130901-40102" },
    ]) {
      let intercepted = false;
      runtime().fetch({ request, respondWith: () => (intercepted = true) });
      expect(intercepted).toBe(false);
    }
  });
});
