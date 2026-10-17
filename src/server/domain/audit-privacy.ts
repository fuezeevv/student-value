import type { Prisma } from "@prisma/client";
const privateKeys = new Set([
  "studentnotes",
  "claimtoken",
  "refreshtokenencrypted",
  "tokenhash",
  "accesstoken",
  "refreshtoken",
  "clientsecret",
  "invite",
]);
/** Historical technical snapshots may contain private fields. Academic editor access never permits serializing those values. */
export function redactGroupAudit(value: Prisma.JsonValue): Prisma.JsonValue {
  if (Array.isArray(value)) return value.map(redactGroupAudit);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !privateKeys.has(key.toLowerCase()))
        .map(([key, child]) => [key, redactGroupAudit(child ?? null)]),
    );
  return value;
}
