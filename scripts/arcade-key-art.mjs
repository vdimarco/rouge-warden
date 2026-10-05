// Downloads the painted machine art listed in higgsfield/arcade-key-art.json and writes public/arcade/key/<id>.webp
// (640 x 360, under 80 KB). The machines and the SWITCH GAME list show these pictures. Needs curl and ImageMagick.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { art } = JSON.parse(fs.readFileSync("higgsfield/arcade-key-art.json", "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "key-art-"));
fs.mkdirSync("public/arcade/key", { recursive: true });
for (const a of art) {
  const png = path.join(tmp, a.id + ".png"), out = `public/arcade/key/${a.id}.webp`;
  execFileSync("curl", ["-sSf", "--retry", "3", "-o", png, a.url]);
  execFileSync("convert", [png, "-resize", "640x360^", "-gravity", "center", "-extent", "640x360", "-quality", "82", out]);
  console.log(`${out} ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
}
