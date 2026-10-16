import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

// Run inside the release build, before Vercel packages Next's traced functions.
const root = process.cwd();
const server = path.resolve(process.env.NEXT_DIST_DIR || ".next", "server");
const traces = fs
  .readdirSync(server, { recursive: true })
  .filter((file) => file.endsWith(".nft.json"));
assert(traces.length > 0, "No server function traces to audit");
const files = new Set();
for (const trace of traces) {
  const source = path.join(server, trace);
  for (const file of JSON.parse(fs.readFileSync(source, "utf8")).files) {
    const relative = path.relative(
      root,
      path.resolve(path.dirname(source), file),
    );
    assert(!relative.startsWith("../"), "Function trace leaves the project");
    files.add(relative.split(path.sep).join("/"));
  }
}
const forbidden =
  /(^|\/)(\.env[^/]*|secrets|\.test-work|tests|test-fixtures\.ts|puppeteer[^/]*|@puppeteer|vitest|@vitest|eslint[^/]*|@eslint[^/]*)(\/|$)|\.(dump|backup)$/;
assert(
  ![...files].some((file) => forbidden.test(file)),
  "Function trace contains secrets, fixtures, backups or development tools",
);
const engines = [...files].filter((file) =>
  /libquery_engine.*\.node$/.test(file),
);
assert(engines.length > 0, "Prisma native engine missing from function traces");
if (process.platform === "linux") {
  assert(
    engines.every(
      (file) => !file.includes("darwin") && !file.includes("windows"),
    ),
    "Function traces contain a non-Linux Prisma engine",
  );
}
console.log(
  `PASS ${traces.length} function traces / ${files.size} files: no secrets, fixtures, backups or development tools; Prisma engine included.`,
);
