export async function publicRuzJson(path: string) {
  if (process.env.NODE_ENV === "test" || process.env.SV_TEST_ISOLATED === "1")
    throw Error("Real RUZ forbidden in tests");
  if (
    !/^teachers\/\d{1,7}\/scheduler\?date=\d{4}-\d{2}-\d{2}$/.test(path) &&
    !/^search\/teachers\?q=[^\s]{1,600}$/.test(path)
  )
    throw Error("Invalid RUZ path");
  const r = await fetch("https://ruz.spbstu.ru/api/v1/ruz/" + path, {
    next: { revalidate: 300 },
    redirect: "error",
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok || !r.body) throw Error("RUZ unavailable");
  const reader = r.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const v = await reader.read();
      if (v.done) break;
      size += v.value.byteLength;
      if (size > 512000) throw Error("RUZ response too large");
      chunks.push(v.value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}
