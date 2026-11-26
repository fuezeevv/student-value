import { describe, it, expect } from "vitest";
import { parseTelegramPosts, getCommunityFeed } from "../src/server/community/feed";
describe("public community feed", () => {
  it("refuses live sources in the test runtime", async () => {
    await expect(getCommunityFeed()).rejects.toThrow("Live feed disabled in tests");
  });
  it("keeps actual publisher identity/date, strips markup and rejects foreign post IDs", () => {
    const html = `<div class="js-widget_message" data-post="studentvalue/42"><time datetime="2026-11-17T10:00:00+03:00"></time><div class="js-message_text">Занятие &amp; новости<br>Вторая строка<script>bad()</script></div></div><div class="js-widget_message" data-post="other/1"><time datetime="2026-11-17"></time><div class="js-message_text">fake</div></div>`;
    expect(parseTelegramPosts(html, "studentvalue")).toEqual([
      {
        id: "studentvalue/42",
        sourceId: "studentvalue",
        url: "https://t.me/studentvalue/42",
        publishedAt: "2026-11-17T07:00:00.000Z",
        text: "Занятие & новости\nВторая строка",
      },
    ]);
  });
  it("does not fabricate undated/missing posts or accept arbitrary sources", () => {
    expect(
      parseTelegramPosts(
        '<div class="js-widget_message" data-post="studentvalue/1"><div class="js-message_text">No date</div></div>',
        "studentvalue",
      ),
    ).toEqual([]);
    expect(() => parseTelegramPosts("", "attacker")).toThrow();
  });
});
