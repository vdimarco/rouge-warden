// Draws the game at every graphics setting, by day and by night, and checks the picture:
// no shader errors, and the image is neither blank, washed out, nor black.
import { open, newGame } from "./lib.mjs";

const { browser, page, errors } = await open({ width: 480, height: 270 });
const shaderErrors = [];
page.on("console", (m) => { if (/Shader Error|not compiled|program not valid/i.test(m.text())) shaderErrors.push(m.text().slice(0, 300)); });
await newGame(page);
await page.evaluate(() => { G.paused = false; document.querySelector("#hud").hidden = true; });
const fails = [];
for (const q of ["high", "medium", "low"]) {
  for (const clock of [0.4, 0.72, 0.95]) {
    await page.evaluate(([q, clock]) => { G.setGraphics(q); G.clock = clock; const c = G.world.cottage; G.player.place(c.x + 4, c.z - 22); G.cam.yaw = 0.3; G.cam.pitch = 0.2; }, [q, clock]);
    await page.waitForTimeout(2500);
    const png = await page.screenshot({ timeout: 240000 });
    const st = await page.evaluate(async (b64) => {
      const im = new Image(); im.src = "data:image/png;base64," + b64; await im.decode();
      const c = document.createElement("canvas"); c.width = 96; c.height = 54; const x = c.getContext("2d"); x.drawImage(im, 0, 0, 96, 54);
      const d = x.getImageData(0, 0, 96, 54).data; let s = 0, s2 = 0, n = 0;
      for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255; s += l; s2 += l * l; n++; }
      const mean = s / n; return { mean, sd: Math.sqrt(s2 / n - mean * mean) };
    }, png.toString("base64"));
    const night = clock > 0.9;
    const ok = st.sd > 0.05 && st.mean < 0.92 && st.mean > (night ? 0.03 : 0.2);
    console.log(`${q} clock ${clock}: mean ${st.mean.toFixed(2)} spread ${st.sd.toFixed(2)} ${ok ? "ok" : "BAD"}`);
    if (!ok) fails.push(`${q} at ${clock}: mean ${st.mean.toFixed(2)} spread ${st.sd.toFixed(2)}`);
  }
}
if (shaderErrors.length) fails.push("shader errors: " + shaderErrors[0]);
if (errors.length) fails.push("errors: " + errors.join(" | "));
await browser.close();
console.log(fails.length ? "FAIL\n" + fails.join("\n") : "PASS: render");
process.exit(fails.length ? 1 : 0);
