// node scripts/render-fish-guide.mjs
// Requires sharp and ffmpeg. Generates both silent, inline intro videos from
// the exact scene renderer used by the in-game guide. No API keys or paid calls.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { INTRO, LENGTH, sceneFrame } from "../public/fish/js/guide.js";
const sharp = createRequire(import.meta.url)("sharp");
const output = fileURLToPath(new URL("../public/fish/clips/", import.meta.url));
mkdirSync(output, { recursive: true });
const FPS = 30, W = 414, H = 246;
const style = `.g-dot{fill:#ff7866;stroke:#ffe7de;stroke-width:2}.g-trail{fill:none;stroke:#e8b64a;stroke-width:2.5;stroke-linecap:round;stroke-dasharray:3 5}.g-pause{fill:#ffb0a8}`;
function frame(kind, motion, t) {
  return sceneFrame(kind, motion, t).replace('<svg ', `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" `)
    .replace('aria-hidden="true">', `aria-hidden="true"><style>${style}</style><rect width="138" height="82" fill="#092229"/>`);
}
const contact = [];
for (const motion of [false, true]) {
  const mode = motion ? "motion" : "touch";
  const ff = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-", "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "22", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output + `guide-${mode}.mp4`], { stdio: ["pipe", "inherit", "inherit"] });
  const done = once(ff, "close");
  for (let i = 0; i < Math.round(INTRO.length * LENGTH * FPS); i++) {
    const t = i / FPS, kind = INTRO[Math.floor(t / LENGTH)];
    const png = await sharp(Buffer.from(frame(kind, motion, t % LENGTH))).png().toBuffer();
    if (!ff.stdin.write(png)) await once(ff.stdin, "drain");
  }
  ff.stdin.end();
  const [code] = await done;
  if (code !== 0) throw new Error(`ffmpeg exited ${code}`);
  for (const kind of INTRO) {
    const label = `<svg width="300" height="30"><text x="10" y="21" fill="#f6efd9" font-size="15" font-family="sans-serif">${mode}: ${kind}</text></svg>`;
    const image = await sharp(Buffer.from(frame(kind, motion, 1.35))).resize(300, 178).png().toBuffer();
    contact.push({ image, label: Buffer.from(label) });
  }
  console.log(`Rendered guide-${mode}.mp4 (${INTRO.length * LENGTH}s)`);
}
if (process.env.GUIDE_CONTACT) {
  const layers = contact.flatMap((f, i) => {
    const left = (i % 3) * 300, top = Math.floor(i / 3) * 210;
    return [{ input: f.label, left, top }, { input: f.image, left, top: top + 30 }];
  });
  await sharp({ create: { width: 900, height: Math.ceil(contact.length / 3) * 210, channels: 3, background: "#092229" } }).composite(layers).png().toFile(process.env.GUIDE_CONTACT);
}
