import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertNeonMigrationEnvironment } from "./lib/production-env.mjs";
import {
  applyReviewedImport,
  parseReviewedImport,
} from "./lib/reviewed-import.mjs";

async function main() {
  const [file, digest] = process.argv.slice(2);
  if (
    !file ||
    !/^[a-f0-9]{64}$/.test(digest ?? "") ||
    path.dirname(path.resolve(file)) !== path.resolve("secrets")
  )
    throw Error("Use a reviewed manifest under secrets/ and its exact SHA-256");
  const { plan } = parseReviewedImport(fs.readFileSync(file), digest);
  const env = assertNeonMigrationEnvironment(process.env);
  const client = new PrismaClient({ datasourceUrl: env.DATABASE_URL });
  try {
    const result = await applyReviewedImport(client, plan, digest);
    console.log(
      result.alreadyApplied
        ? "Import already applied; no data changed."
        : "Reviewed initial import committed; counts and provenance recorded in AuditLog.",
    );
  } finally {
    await client.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Reviewed import refused or rolled back. No diagnostics containing data or credentials are logged.",
  );
  process.exitCode = 1;
});
