import { prepareTestDatabase, run } from "./test-db.mjs";
const env = prepareTestDatabase();
run("node", ["node_modules/tsx/dist/cli.mjs", "prisma/test-fixtures.ts"], env);
console.log("Isolated test database ready.");
