// Drives the House Rules editor in a real browser: NODE_PATH=$(npm root -g) node qa/lab/rules.e2e.mjs (serve public/)
// 1. A phone: a finger digs a tunnel, two fingers zoom without painting, critters go down and come back up, sand
//    settles with the game's own rules, and Test it opens the layer in Down the Drain.
// 2. A computer: number keys pick paints, the mouse paints and the wheel zooms, the draft survives a reload, and a
//    clear of this exact layer unlocks Share, until the next edit locks it again.
// SHOTS=<folder> saves screenshots. Exit code 1 on failure.
import { open, until, pointer, shot, sleep, report, PHONE, DESK } from "./lib.mjs";

const R = report("rules.e2e");

// a drag through layer points, in steps, as a finger or a mouse
async function paintPath(page, pts, kind = "touch", id = 1) {
  const scr = await page.evaluate((pts) => pts.map(([x, y]) => QA.toScreen(x, y)), pts);
  await pointer(page, "pointerdown", scr[0][0], scr[0][1], id, kind);
  for (let i = 1; i < scr.length; i++) for (let k = 1; k <= 8; k++) {
    await pointer(page, "pointermove", scr[i - 1][0] + ((scr[i][0] - scr[i - 1][0]) * k) / 8, scr[i - 1][1] + ((scr[i][1] - scr[i - 1][1]) * k) / 8, id, kind);
  }
  await pointer(page, "pointerup", scr[scr.length - 1][0], scr[scr.length - 1][1], id, kind);
  await sleep(250);
}
async function tapAt(page, x, y, kind = "touch") {
  const [sx, sy] = await page.evaluate(([x, y]) => QA.toScreen(x, y), [x, y]);
  await pointer(page, "pointerdown", sx, sy, 1, kind);
  await pointer(page, "pointerup", sx, sy, 1, kind);
  await sleep(200);
}
// the editor's ground against a fresh build of the same layer
const matchesBuild = (page) => page.evaluate(async () => {
  const [L, K] = await Promise.all([import("/lab/rules/layer.js"), import("/lab/kit/rng.js")]);
  return K.fnv1a(QA.mat) === K.fnv1a(L.build(QA.L));
});

R.section("A phone");
{
  const { page, errors, close } = await open("rules/", PHONE);
  await page.waitForSelector(".card.start .go");
  R.check(true, "the first visit shows how it works");
  await shot(page, "rules-phone-title");
  await page.click(".card.start .go");
  await sleep(300);
  // dig from the hole down to the left drain
  await page.evaluate(() => QA.setSize(2));
  await paintPath(page, [[512, 50], [512, 160], [420, 260], [360, 420], [362, 690]]);
  const dug = await page.evaluate(() => ({ n: QA.L.strokes.length, p: QA.L.strokes[0].p, open: [[512, 120], [420, 260], [361, 500]].every(([x, y]) => QA.mat[y * 1024 + x] === 0) }));
  R.check(dug.n === 1 && dug.p === 0 && dug.open, "a finger drag with Dig cuts one tunnel along its path");
  R.check(await matchesBuild(page), "what you see is exactly what the link builds");
  // two fingers: zoom, and no paint
  const s0 = await page.evaluate(() => QA.view.s), cx = PHONE.width / 2, cy = 330;
  await pointer(page, "pointerdown", cx - 30, cy, 1);
  await pointer(page, "pointerdown", cx + 30, cy, 2);
  for (let k = 1; k <= 8; k++) { await pointer(page, "pointermove", cx - 30 - k * 12, cy, 1); await pointer(page, "pointermove", cx + 30 + k * 12, cy, 2); }
  await pointer(page, "pointerup", cx - 126, cy, 1);
  await pointer(page, "pointerup", cx + 126, cy, 2);
  await sleep(150);
  const z = await page.evaluate(() => ({ s: QA.view.s, n: QA.L.strokes.length }));
  R.check(z.s > s0 * 2 && z.n === 1, `two fingers spread zoom in (${(z.s / s0).toFixed(1)} times) and paint nothing`);
  await shot(page, "rules-phone-zoom");
  await page.evaluate(() => { QA.view.s = 0; dispatchEvent(new Event("resize")); });
  await sleep(100);
  // a moose in the tunnel, then gone again with a second tap
  await page.selectOption("#critter", "5");
  await tapAt(page, 420, 262);
  R.check(await page.evaluate(() => QA.L.critters.length === 1 && QA.L.critters[0].k === 5), "picking Moose and tapping the layer puts a moose there");
  await tapAt(page, 420, 262);
  R.check(await page.evaluate(() => QA.L.critters.length === 0), "a second tap on it takes it away");
  await page.click("#undo");
  await sleep(150);
  R.check(await page.evaluate(() => QA.L.critters.length === 1), "Undo brings it back");
  // sand in the tunnel settles
  await page.click('#paints button[data-p="sand"]');
  await page.evaluate(() => QA.setSize(1));
  await paintPath(page, [[512, 70], [512, 110]]);
  const sandY = () => page.evaluate(() => { let n = 0, sy = 0; const m = QA.settling ? QA.sand.mat : QA.mat; for (let i = 0; i < m.length; i++) if (m[i] === 4) { n++; sy += (i / 1024) | 0; } return sy / n; });
  const before = await sandY();
  await page.click("#settle");
  await sleep(1500);
  const after = await sandY();
  R.check(after > before + 20, `Settle lets the sand fall down the tunnel (its middle moved from row ${before.toFixed(0)} to ${after.toFixed(0)})`);
  await shot(page, "rules-phone-settle");
  await page.click("#settle");
  R.check(await page.evaluate(() => !QA.settling), "Stop goes back to the layer as painted");
  const meter = await page.textContent("#size");
  R.check(/^\d+ \/ 2,000$/.test(meter) && await page.isDisabled("#share"), `the meter shows the length of the link (${meter}), and Share waits for a clear`);
  await shot(page, "rules-phone-painted");
  // Test it: the layer opens in Down the Drain
  const code = await page.evaluate(() => QA.relink());
  await Promise.all([page.waitForURL(/\/fall\/#L=/, { timeout: 15000 }), page.click("#test")]);
  const url = page.url();
  R.check(url.endsWith("/fall/#L=" + code + "&edit=1"), "Test it opens Down the Drain with the layer in the link");
  for (const e of errors.filter((e) => !/\/fall\//.test(e))) R.check(false, e);
  await close();
}

R.section("A computer");
{
  const { page, errors, close } = await open("rules/", DESK);
  await page.waitForSelector(".card.start .go");
  await page.click(".card.start .go");
  await sleep(200);
  await page.keyboard.press("4");
  await page.keyboard.press("]");
  const st = await page.evaluate(() => ({ sand: document.querySelector('#paints button[data-p="sand"]').getAttribute("aria-pressed"), size: document.querySelector('#sizes button[data-i="2"]').getAttribute("aria-pressed") }));
  R.check(st.sand === "true" && st.size === "true", "key 4 picks Sand, and ] makes the brush bigger");
  await paintPath(page, [[200, 200], [300, 220], [400, 200]], "mouse");
  R.check(await page.evaluate(() => QA.L.strokes.length === 1 && QA.L.strokes[0].p === 3 && QA.L.strokes[0].r === 2), "the mouse paints a stroke of sand");
  const s0 = await page.evaluate(() => QA.view.s);
  await page.mouse.move(640, 300);
  await page.mouse.wheel(0, -400);
  await sleep(150);
  R.check(await page.evaluate((s0) => QA.view.s > s0 * 1.3, s0), "the wheel zooms in");
  await page.fill("#name", "Sand Trap");
  await sleep(300);
  await page.reload();
  await page.waitForFunction(() => window.QA && QA.code);
  const kept = await page.evaluate(() => ({ n: QA.L.strokes.length, name: QA.L.name, card: !!document.querySelector(".card.start:not([hidden])") }));
  R.check(kept.n === 1 && kept.name === "Sand Trap" && !kept.card, "a reload keeps the layer and its name, and skips the start card");
  // a clear of this layer, as Down the Drain records it, unlocks Share
  const code = await page.evaluate(() => QA.relink());
  await page.evaluate(async (code) => { (await import("/lab/rules/layer.js")).recordClear(code, 47); dispatchEvent(new Event("pageshow")); }, code);
  await sleep(100);
  R.check(!(await page.isDisabled("#share")) && /0:47/.test(await page.textContent("#status")), "after a clear of this exact layer, Share opens and says the time");
  await shot(page, "rules-desk-cleared");
  await page.evaluate(() => { window.__shared = null; navigator.share = (d) => { window.__shared = d; return Promise.resolve(); }; });
  await page.click("#share");
  await sleep(200);
  const shared = await page.evaluate(() => window.__shared);
  R.check(shared && shared.url.includes("/fall/#L=" + code + "&c=47-") && /Sand Trap/.test(shared.text), "Share sends a link to the layer with the clear stamp");
  await paintPath(page, [[600, 300], [640, 320]], "mouse");
  await sleep(300);
  R.check(await page.isDisabled("#share"), "the next stroke locks Share again: it is a new layer now");
  for (const e of errors) R.check(false, e);
  await close();
}

R.done();
