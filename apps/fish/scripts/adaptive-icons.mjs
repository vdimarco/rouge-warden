#!/usr/bin/env node
// Runs after capacitor-assets (npm run assets). @capacitor/assets 3 writes the Android adaptive icon layers at 48 dp
// and stretches them to 72 dp with an inset, so they look soft on sharp screens. This script writes both layers again
// at the full 108 dp from resources/, with the same picture in the same place, and an adaptive-icon XML with no inset.
// The visible 72 dp in the middle shows the whole source picture, as before.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sharp = createRequire(import.meta.url)(path.join(APP, "node_modules", "sharp"));
const RES = path.join(APP, "android/app/src/main/res");
const DENSITIES = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const FG = path.join(APP, "resources/icon-foreground.png");
const BG = path.join(APP, "resources/icon-background.png");

for (const [name, k] of Object.entries(DENSITIES)) {
  const dir = path.join(RES, `mipmap-${name}`);
  if (!fs.existsSync(dir)) continue;
  const visible = Math.round(72 * k), layer = Math.round(108 * k);
  const pad = (layer - visible) / 2;
  const edges = { top: Math.floor(pad), bottom: Math.ceil(pad), left: Math.floor(pad), right: Math.ceil(pad) };
  await sharp(FG).resize(visible, visible, { kernel: "lanczos3" })
    .extend({ ...edges, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 }).toFile(path.join(dir, "ic_launcher_foreground.png"));
  // the water reaches past the mask, so a launcher that moves the layers never shows an edge
  await sharp(BG).resize(visible, visible, { kernel: "lanczos3" })
    .extend({ ...edges, extendWith: "mirror" })
    .removeAlpha().png({ compressionLevel: 9 }).toFile(path.join(dir, "ic_launcher_background.png"));
  console.log(`  mipmap-${name}: layers ${layer}x${layer}, visible ${visible}x${visible}`);
}

const xml = `<?xml version="1.0" encoding="utf-8"?>
<!-- Written by scripts/adaptive-icons.mjs: full 108 dp layers, so no inset is needed. -->
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
for (const f of ["ic_launcher.xml", "ic_launcher_round.xml"]) fs.writeFileSync(path.join(RES, "mipmap-anydpi-v26", f), xml);
console.log("adaptive-icons: wrote mipmap-anydpi-v26/ic_launcher.xml and ic_launcher_round.xml");
