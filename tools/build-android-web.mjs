import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "android-web");

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await cp(path.join(root, "src"), path.join(out, "src"), { recursive: true });
await cp(path.join(root, "assets"), path.join(out, "assets"), { recursive: true });
await writeFile(
  path.join(out, "index.html"),
  '<!doctype html><meta charset="utf-8"><title>DualRing Clock</title><script>location.replace("./src/app/index.html");</script>\n'
);

console.log(`[android] staged web assets at ${out}`);
