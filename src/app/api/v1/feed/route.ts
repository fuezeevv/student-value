import { getCommunityFeed } from "@/server/community/feed";
export const dynamic = "force-dynamic";
export async function GET() {
  const feed = await getCommunityFeed();
  const unavailable = feed.sources.every((s) => s.status !== "OK");
  return Response.json(feed, {
    status: unavailable ? 503 : 200,
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
