import { load } from "cheerio";

// Exact public source pages; never fetch a caller-supplied URL or use account cookies.
export const FEED_SOURCES = [
  {
    id: "studentvalue",
    label: "Student Value",
    kind: "telegram",
    url: "https://t.me/studentvalue",
    evidence: "https://t.me/studentvalue",
  },
  {
    id: "sss_iccs",
    label: "СНО ИКНК · сообщество",
    kind: "telegram",
    url: "https://t.me/sss_iccs",
    evidence: "https://t.me/sss_iccs",
  },
  {
    id: "polyctf",
    label: "PolyCTF · кибербезопасность",
    kind: "telegram",
    url: "https://t.me/polyctf",
    evidence: "https://iccs.spbstu.ru/polyctf/",
  },
  {
    id: "hsse-vk",
    label: "СНО ВШПИ · ВКонтакте",
    kind: "vk",
    url: "https://vk.com/sss_hsse_spbstu",
    evidence: "https://www.spbstu.ru/studorg/",
  },
  {
    id: "ai-vk",
    label: "СНО ВШТИИ · ВКонтакте",
    kind: "vk",
    url: "https://vk.com/sss_ai_spbstu",
    evidence: "https://www.spbstu.ru/studorg/",
  },
  {
    id: "hsc-vk",
    label: "СНО ВШК · ВКонтакте",
    kind: "vk",
    url: "https://vk.com/sss_hsc_spbstu",
    evidence: "https://www.spbstu.ru/studorg/",
  },
  {
    id: "iccs-vk",
    label: "ИКНК · ВКонтакте",
    kind: "vk",
    url: "https://vk.com/iccs.spbstu",
    evidence: "https://iccs.spbstu.ru/",
  },
] as const;
export type FeedPost = {
  id: string;
  sourceId: string;
  url: string;
  publishedAt: string;
  text: string;
};
export type FeedSource = {
  id: string;
  label: string;
  kind: string;
  url: string;
  evidence: string;
  status: "OK" | "UNAVAILABLE" | "NOT_CONFIGURED";
  fetchedAt: string | null;
};
export type CommunityFeed = {
  fetchedAt: string;
  posts: FeedPost[];
  sources: FeedSource[];
};

export function parseTelegramPosts(html: string, channel: string): FeedPost[] {
  if (!FEED_SOURCES.some((s) => s.kind === "telegram" && s.id === channel))
    throw new Error("Unknown channel");
  const $ = load(html);
  const posts: FeedPost[] = [];
  $(".js-widget_message[data-post]").each((_, element) => {
    const node = $(element);
    const id = node.attr("data-post") ?? "";
    if (!new RegExp(`^${channel}/[1-9][0-9]*$`).test(id)) return;
    const datetime = node.find("time[datetime]").first().attr("datetime");
    if (!datetime || !Number.isFinite(Date.parse(datetime))) return;
    const content = node.find(".js-message_text").first().clone();
    content.find("script,style").remove();
    content.find("br").replaceWith("\n");
    const text = content.text().trim();
    // Photos/videos without a caption are represented as links to the actual post.
    if (
      !text &&
      !node.find(
        ".tgme_widget_message_photo_wrap,.tgme_widget_message_video_player",
      ).length
    )
      return;
    posts.push({
      id,
      sourceId: channel,
      url: `https://t.me/${id}`,
      publishedAt: new Date(datetime).toISOString(),
      text: (text || "Медиапубликация — открыть оригинал").slice(0, 12000),
    });
  });
  return [...new Map(posts.map((p) => [p.id, p])).values()];
}

async function boundedPublicHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: { Accept: "text/html" },
      cache: "no-store",
    });
    if (!response.ok || !response.body) throw new Error("Source unavailable");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        total += chunk.value.byteLength;
        if (total > 1024 * 1024) throw new Error("Source too large");
        chunks.push(chunk.value);
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timer);
  }
}

// Per-instance single flight + TTL; no student data, identity, or academic writes.
let cached: { at: number; value: CommunityFeed } | undefined;
let pending: Promise<CommunityFeed> | undefined;
export async function getCommunityFeed(): Promise<CommunityFeed> {
  if (cached && Date.now() - cached.at < 300_000) return cached.value;
  if (pending) return pending;
  // Test suites must provide HTML fixtures, never contact a live provider.
  if (process.env.NODE_ENV === "test" || process.env.SV_TEST_ISOLATED === "1")
    throw new Error("Live feed disabled in tests");
  pending = (async () => {
    const fetchedAt = new Date().toISOString();
    const results = await Promise.all(
      FEED_SOURCES.map(async (source) => {
        if (source.kind === "vk")
          return {
            source: {
              ...source,
              status: "NOT_CONFIGURED" as const,
              fetchedAt: null,
            },
            posts: [] as FeedPost[],
          };
        try {
          const html = await boundedPublicHtml(`https://t.me/s/${source.id}`);
          const posts = parseTelegramPosts(html, source.id);
          if (!posts.length) throw new Error("No public posts parsed");
          return {
            source: { ...source, status: "OK" as const, fetchedAt },
            posts,
          };
        } catch {
          return {
            source: {
              ...source,
              status: "UNAVAILABLE" as const,
              fetchedAt: null,
            },
            posts: [] as FeedPost[],
          };
        }
      }),
    );
    const value: CommunityFeed = {
      fetchedAt,
      sources: results.map((r) => r.source),
      posts: results
        .flatMap((r) => r.posts)
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
        .slice(0, 100),
    };
    cached = { at: Date.now(), value };
    return value;
  })();
  try {
    return await pending;
  } finally {
    pending = undefined;
  }
}
