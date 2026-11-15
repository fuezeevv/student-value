import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import {
  createReadStream,
  createWriteStream,
  readFileSync,
  statSync,
  renameSync,
  appendFileSync,
} from "node:fs";
import { Transform, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = "/srv/studentvalue";
const keyPath = `${root}/secrets/backup-key.base64`;
const mode = statSync(keyPath).mode & 0o777;
if (mode & 0o077)
  throw Error("Backup key must be private to the service owner");
const keyString = readFileSync(keyPath, "utf8").trim();
const key = Buffer.from(keyString, "base64");
if (key.length !== 32 || key.toString("base64") !== keyString)
  throw Error("Invalid backup key");
const output = `${root}/backups/${new Date().toISOString().replaceAll(":", "-")}.pgdump.gcm`;
const partial = output + ".partial";
const iv = randomBytes(12);
const header = Buffer.concat([Buffer.from("SVPG1"), iv]);
const cipher = createCipheriv("aes-256-gcm", key, iv);
cipher.setAAD(header);
const hash = createHash("sha256");
const digest = new Transform({
  transform(chunk, _encoding, done) {
    hash.update(chunk);
    done(null, chunk);
  },
});
const child = spawn(
  "docker",
  [
    "compose",
    "--env-file",
    `${root}/secrets/release.env`,
    "-f",
    path.join(path.dirname(fileURLToPath(import.meta.url)), "compose.yml"),
    "run",
    "--rm",
    "-T",
    "backup",
  ],
  { stdio: ["ignore", "pipe", "ignore"] },
);
const completion = new Promise((resolve) => {
  child.once("error", () => resolve(-1));
  child.once("close", (code) => resolve(code));
});
const stream = createWriteStream(partial, { flags: "wx", mode: 0o600 });
stream.write(header);
try {
  await pipeline(child.stdout, digest, cipher, stream);
  const status = await completion;
  if (status !== 0) throw Error("Database backup failed");
  const tag = cipher.getAuthTag();
  appendFileSync(partial, tag);
  // Authenticate the entire archive and compare its plaintext digest without writing plaintext.
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  const check = createHash("sha256");
  await pipeline(
    createReadStream(partial, {
      start: header.length,
      end: statSync(partial).size - 17,
    }),
    decipher,
    new Writable({
      write(chunk, _encoding, done) {
        check.update(chunk);
        done();
      },
    }),
  );
  if (hash.digest("hex") !== check.digest("hex"))
    throw Error("Backup round-trip failed");
  renameSync(partial, output);
  console.log(`Verified encrypted PostgreSQL backup: ${path.basename(output)}`);
} catch {
  child.kill("SIGTERM");
  console.error(
    "Backup failed; the partial archive was retained for diagnosis, not marked successful",
  );
  process.exitCode = 1;
}
