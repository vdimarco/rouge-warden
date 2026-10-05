// Downloads the painted machine art listed in higgsfield/arcade-key-art.json and writes public/arcade/key/<id>.webp
// (640 x 360, under 100 KB). The machines and the SWITCH GAME list show these pictures. Needs curl, ImageMagick and ffmpeg.
// ImageMagick 6 ignores -quality for WebP, so ffmpeg (libwebp) writes the WebP.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const { art } = JSON.parse(fs.readFileSync("higgsfield/arcade-key-art.json", "utf8"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "key-art-"));
fs.mkdirSync("public/arcade/key", { recursive: true });
for (const a of art) {
  const png = path.join(tmp, a.id + ".png"), small = path.join(tmp, a.id + "-640.png"), out = `public/arcade/key/${a.id}.webp`;
  execFileSync("curl", ["-sSf", "--retry", "3", "-o", png, a.url]);
  execFileSync("convert", [png, "-resize", "640x360^", "-gravity", "center", "-extent", "640x360", small]);
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", small, "-c:v", "libwebp", "-quality", "75", out]);
  console.log(`${out} ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
}
