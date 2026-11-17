export class MobileRuzRequestError extends Error {
  constructor(
    readonly reason: "TIMEOUT" | "UNAVAILABLE" | "SCHEMA_ERROR" | "OFFLINE",
  ) {
    super(reason);
  }
}
const MAX_BYTES = 512 * 1024;
function utf8Bytes(text: string) {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    if (char < 0x80) count++;
    else if (char < 0x800) count += 2;
    else if (
      char >= 0xd800 &&
      char <= 0xdbff &&
      i + 1 < text.length &&
      text.charCodeAt(i + 1) >= 0xdc00 &&
      text.charCodeAt(i + 1) <= 0xdfff
    ) {
      count += 4;
      i++;
    } else count += 3;
  }
  return count;
}
// Native XHR progress lets us abort oversized transfers before loading all bytes.
// Deadline covers the complete body, not just response headers.
export function mobileRuzJson(
  path: string,
  create = () => new XMLHttpRequest(),
): Promise<unknown> {
  if (
    !/^(?:teachers\/\d+\/scheduler|scheduler\/\d+)\?date=\d{4}-\d{2}-\d{2}$/.test(
      path,
    ) &&
    !/^search\/(?:teachers|groups)\?q=[^\s]{1,600}$/.test(path)
  ) {
    return Promise.reject(new MobileRuzRequestError("SCHEMA_ERROR"));
  }
  return new Promise((resolve, reject) => {
    const xhr = create();
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const fail = (reason: MobileRuzRequestError["reason"]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new MobileRuzRequestError(reason));
      xhr.abort();
    };
    timer = setTimeout(() => fail("TIMEOUT"), 8000);
    xhr.open("GET", `https://ruz.spbstu.ru/api/v1/ruz/${path}`);
    xhr.timeout = 8000;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.onprogress = (event) => {
      if (
        event.loaded > MAX_BYTES ||
        (event.lengthComputable && event.total > MAX_BYTES)
      )
        fail("SCHEMA_ERROR");
    };
    xhr.onerror = () => fail("OFFLINE");
    xhr.ontimeout = () => fail("TIMEOUT");
    xhr.onload = () => {
      if (settled) return;
      if (xhr.status < 200 || xhr.status >= 300) return fail("UNAVAILABLE");
      try {
        if (
          xhr.responseURL &&
          new URL(xhr.responseURL).origin !== "https://ruz.spbstu.ru"
        )
          return fail("SCHEMA_ERROR");
        const raw = xhr.responseText;
        if (raw.length > MAX_BYTES || utf8Bytes(raw) > MAX_BYTES)
          return fail("SCHEMA_ERROR");
        const value: unknown = JSON.parse(raw);
        settled = true;
        clearTimeout(timer);
        resolve(value);
      } catch {
        fail("SCHEMA_ERROR");
      }
    };
    xhr.send();
  });
}
