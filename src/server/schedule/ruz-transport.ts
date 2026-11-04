import {
  RUZ_ORIGIN,
  validDay,
  weekStartFor,
  extractRuzPagePayload,
} from "@/lib/schedule/ruz";
export class RuzProviderError extends Error {
  constructor(readonly code: string) {
    super("RUZ provider request failed");
  }
}
const MAX_BYTES = 512 * 1024;
async function readText(
  url: string,
  request: typeof fetch,
  accept = "application/json",
) {
  let response: Response;
  try {
    response = await request(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(6000),
      redirect: "error",
      headers: { Accept: accept },
    });
  } catch (error) {
    throw new RuzProviderError(
      ["TimeoutError", "AbortError"].includes((error as Error)?.name)
        ? "TIMEOUT"
        : "NETWORK",
    );
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    throw new RuzProviderError(`HTTP_${response.status}`);
  }
  if (!response.body) throw new RuzProviderError("EMPTY_RESPONSE");
  const reader = response.body.getReader(),
    chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      size += r.value.byteLength;
      if (size > MAX_BYTES) throw new RuzProviderError("TOO_LARGE");
      chunks.push(r.value);
    }
  } catch (error) {
    if (error instanceof RuzProviderError) throw error;
    throw new RuzProviderError(
      ["TimeoutError", "AbortError"].includes((error as Error)?.name)
        ? "TIMEOUT"
        : "NETWORK",
    );
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
export async function fetchRuzPayload(
  url: string,
  request: typeof fetch = fetch,
): Promise<unknown> {
  if (
    (process.env.NODE_ENV === "test" || process.env.SV_TEST_ISOLATED === "1") &&
    request === fetch
  )
    throw Error("Real RUZ requests are forbidden in tests");
  const u = new URL(url),
    id = /^\/api\/v1\/ruz\/scheduler\/(\d+)$/.exec(u.pathname)?.[1],
    week = u.searchParams.get("date");
  if (
    u.origin !== RUZ_ORIGIN ||
    u.username ||
    u.password ||
    !id ||
    !Number.isSafeInteger(Number(id)) ||
    Number(id) <= 0 ||
    !week ||
    !validDay(week) ||
    weekStartFor(week) !== week
  )
    throw new RuzProviderError("INVALID_REQUEST");
  // The public page responds reliably from our production region and carries
  // the same official JSON. The API remains a fallback if the page format changes.
  // All configured groups belong to institute 125; validate identity/week later.
  try {
    return extractRuzPagePayload(
      await readText(
        `${RUZ_ORIGIN}/faculty/125/groups/${id}?date=${week}`,
        request,
        "text/html",
      ),
      Number(id),
    );
  } catch {
    try {
      const text = await readText(
        `${RUZ_ORIGIN}/api/v1/ruz/scheduler/${id}?date=${week}`,
        request,
      );
      try {
        return JSON.parse(text);
      } catch {
        throw new RuzProviderError("INVALID_JSON");
      }
    } catch (error) {
      throw new RuzProviderError(
        error instanceof RuzProviderError
          ? `API_${error.code}`
          : "API_INVALID_RESPONSE",
      );
    }
  }
}
