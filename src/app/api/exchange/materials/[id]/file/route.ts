import { getCurrentUser } from "@/lib/auth/session";
import { sharedMaterialFileChunk } from "@/server/domain/material-files";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (!user?.groupId) return new Response(null, { status: 401, headers });
  const chunk = new URL(request.url).searchParams.get("chunk");
  if (!chunk || !/^(0|[1-9]\d{0,3})$/.test(chunk))
    return new Response(null, { status: 400, headers });
  const data = await sharedMaterialFileChunk(
    user,
    (await params).id,
    Number(chunk),
  );
  if (!data) return new Response(null, { status: 404, headers });
  return new Response(new Uint8Array(data), {
    headers: { ...headers, "Content-Type": "application/octet-stream" },
  });
}
