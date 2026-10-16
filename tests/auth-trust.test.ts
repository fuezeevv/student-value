import { describe, it, expect } from "vitest";
import { isDevAuthEnabled } from "../src/lib/auth/dev-policy";
import { isTrustedAccepted } from "../src/server/domain/trust";
import {
  moveDeadlineDate,
  parseDateOnly,
} from "../src/server/domain/deadline-date";
import { renderToStaticMarkup } from "react-dom/server";
import { HighlightedText } from "../src/components/text/HighlightedText";
import React from "react";
describe("development authentication", () => {
  for (const env of [
    { NODE_ENV: "production", ALLOW_DEV_AUTH: "true" },
    { NODE_ENV: "test", ALLOW_DEV_AUTH: "true" },
    { NODE_ENV: "development" },
    { NODE_ENV: "development", ALLOW_DEV_AUTH: "false" },
  ])
    it(`fails closed: ${JSON.stringify(env)}`, () =>
      expect(isDevAuthEnabled(env)).toBe(false));
  it("requires both development and explicit opt-in", () =>
    expect(
      isDevAuthEnabled({ NODE_ENV: "development", ALLOW_DEV_AUTH: "true" }),
    ).toBe(true));
});
describe("accepted trust", () => {
  const valid = {
    status: "ACCEPTED",
    isVerified: true,
    taskId: "task",
    userId: "student",
    verifiedById: "headman",
    verifiedAt: new Date(),
    acceptedAt: new Date(),
    verificationSource: "HEADMAN_CONFIRMED",
    verificationSourceReferenceId: "ref",
    verificationEvidence: {
      confidence: "CONFIRMED",
      entityType: "TASK_PROGRESS",
      entityId: "task:student",
      quoteText: "Преподаватель подтвердил",
      source: { type: "TEACHER_STATEMENT" },
    },
  };
  it("accepts an evidenced headman record without claiming direct teacher action", () =>
    expect(isTrustedAccepted(valid)).toBe(true));
  for (const patch of [
    { isVerified: false },
    { verifiedById: "student" },
    { verificationSourceReferenceId: null },
    { verificationEvidence: null },
    { verificationSource: "SELF_REPORTED" },
    { verifiedAt: null },
    { acceptedAt: null },
    {
      verificationEvidence: {
        confidence: "UNVERIFIED",
        source: { type: "TEACHER_STATEMENT" },
      },
    },
  ])
    it(`rejects incomplete evidence: ${JSON.stringify(patch)}`, () =>
      expect(isTrustedAccepted({ ...valid, ...patch })).toBe(false));
});
describe("deadline dates", () => {
  it("preserves strict Moscow time when moving the day", () =>
    expect(
      moveDeadlineDate(
        { date: new Date("2026-10-16T14:35:27.123+03:00"), isTimeStrict: true },
        "2026-11-20",
      ).toISOString(),
    ).toBe("2026-11-20T11:35:27.123Z"));
  it("normalizes date-only to Moscow day end", () =>
    expect(parseDateOnly("2026-11-20").toISOString()).toBe(
      "2026-11-20T20:59:59.999Z",
    ));
  it("rejects invalid calendar dates", () =>
    expect(() => parseDateOnly("2026-02-30")).toThrow());
});
describe("safe transcript highlighting", () => {
  it("escapes HTML rather than creating executable elements", () => {
    const html = renderToStaticMarkup(
      React.createElement(HighlightedText, {
        text: '<img src=x onerror="alert(1)"> <script>bad()</script>',
        query: "img",
      }),
    );
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;");
    expect(html).toContain("<mark");
  });
  it("treats regex metacharacters literally", () => {
    const html = renderToStaticMarkup(
      React.createElement(HighlightedText, {
        text: "Скобка [ и (.*)",
        query: "[",
      }),
    );
    expect(html).toContain(">[</mark>");
  });
});

describe("production switch action guard", () => {
  it("rejects before reading cookies or users even when the dev flag is true", async () => {
    const { vi } = await import("vitest");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_DEV_AUTH", "true");
    try {
      const { setDevUserCookie } = await import("../src/lib/auth/session");
      await expect(setDevUserCookie("user-dev-owner")).rejects.toThrow(
        "forbidden in production",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
