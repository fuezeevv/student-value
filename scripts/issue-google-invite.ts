import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertNeonMigrationEnvironment } from "./lib/production-env.mjs";
import { APP_GROUP_CODE } from "../src/lib/auth/google";
import { createEnrollmentGrant } from "../src/server/domain/google-login";

// Trusted release operator only. No endpoint exposes this command or migration credentials.
async function main() {
  const env = assertNeonMigrationEnvironment(process.env);
  const [enrollmentId, recipient] = process.argv.slice(2);
  if (!enrollmentId || !recipient)
    throw Error("Usage: issue-google-invite.ts ENROLLMENT_ID RECIPIENT_EMAIL");
  const p = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try {
    const e = await p.enrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: { group: true },
    });
    if (
      e.group.code !== APP_GROUP_CODE ||
      e.status === "ARCHIVED" ||
      e.userId ||
      e.claimToken
    )
      throw Error("Enrollment is not available for a first invitation");
    const grant = createEnrollmentGrant(e.id, recipient, null);
    const dir = path.resolve("secrets");
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = path.join(dir, `google-invite-${e.id}.txt`);
    // Reserve a private destination before changing the database; never overwrite a code.
    const fd = fs.openSync(file, "wx", 0o600);
    try {
      await p.$transaction(async (tx) => {
        const updated = await tx.enrollment.updateMany({
          where: {
            id: e.id,
            userId: null,
            claimToken: null,
            status: { not: "ARCHIVED" },
          },
          data: { claimToken: grant.stored },
        });
        if (updated.count !== 1)
          throw Error("Enrollment changed during invitation issuance");
        await tx.auditLog.create({
          data: {
            action: "ISSUE_GOOGLE_INVITATION",
            entityType: "ENROLLMENT",
            entityId: e.id,
            details: {
              groupId: e.groupId,
              operator: "TRUSTED_RELEASE",
              recipientHash: JSON.parse(grant.stored).recipient,
            },
          },
        });
      });
      fs.writeFileSync(fd, grant.code + "\n");
      console.log(
        "Invitation saved to a private file under secrets; expires in 72 hours. No code logged.",
      );
    } finally {
      fs.closeSync(fd);
    }
  } finally {
    await p.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Invitation was not issued; check enrollment, configuration and private output file.",
  );
  process.exitCode = 1;
});
