import { prepareTestDatabase, run } from "./test-db.mjs";
const env = prepareTestDatabase();
run("node", ["node_modules/tsx/dist/cli.mjs", "prisma/test-fixtures.ts"], env);
run(
  "node",
  ["node_modules/vitest/vitest.mjs", "run", ...process.argv.slice(2)],
  env,
);
