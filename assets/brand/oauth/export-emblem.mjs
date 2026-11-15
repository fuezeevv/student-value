import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { stat } from "node:fs/promises";

const master = fileURLToPath(new URL("student-value-oauth-emblem.svg", import.meta.url));
for (const size of [1024, 120]) {
  const name = size === 120 ? "student-value-oauth-120.png" : "student-value-oauth-preview-1024.png";
  const output = fileURLToPath(new URL(name, import.meta.url));
  await sharp(master, { density: 144 }).resize(size, size, { kernel: "lanczos3" }).toColourspace("srgb").png().toFile(output);
  const meta = await sharp(output).metadata();
  if (meta.width !== size || meta.height !== size || !meta.hasAlpha) throw Error("Invalid PNG export");
  console.log(JSON.stringify({ output, width: meta.width, height: meta.height, bytes: (await stat(output)).size, alpha: meta.hasAlpha }));
}
