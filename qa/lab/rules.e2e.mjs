// Drives the House Rules editor in a real browser: NODE_PATH=$(npm root -g) node qa/lab/rules.e2e.mjs (serve public/)
// 1. A phone: every tool is in sight, a finger digs a tunnel, two fingers zoom without painting, critters go down and
//    come back up (a tap 6 px off still finds them), sand settles with the game's own rules, a pinch and a drag
//    during Settle keep it running, a new name keeps a clear, the status counts your tries, the zoom tip shows on
//    the first visit only, and Test it opens the layer in Down the Drain.
// 2. A tank by lava in Settle: its fuse hisses, then it blows with a flash and a boom.
// 3. A friend's remix: /lab/rules/#L=<code> opens that layer, says what to do, and asks first if you have a layer.
// 4. A computer: number keys pick paints, the mouse paints and the wheel zooms, the draft survives a reload, and a
//    clear of this exact layer unlocks Share, until the next edit locks it again.
// SHOTS=<folder> saves screenshots. Exit code 1 on failure.
import { open, until, pointer, shot, sleep, report, PHONE, DESK } from "./lib.mjs";
import { blank, encode, decode } from "../../public/lab/rules/layer.js";

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
async function tapAt(page, x, y, kind = "touch", dx = 0, dy = 0) {
  const [sx, sy] = await page.evaluate(([x, y]) => QA.toScreen(x, y), [x, y]);
  await pointer(page, "pointerdown", sx + dx, sy + dy, 1, kind);
  await pointer(page, "pointerup", sx + dx, sy + dy, 1, kind);
  await sleep(200);
}
// two fingers spread apart around (cx, cy), in screen pixels
async function pinch(page, cx, cy) {
  await pointer(page, "pointerdown", cx - 30, cy, 1);
  await pointer(page, "pointerdown", cx + 30, cy, 2);
  for (let k = 1; k <= 8; k++) { await pointer(page, "pointermove", cx - 30 - k * 12, cy, 1); await pointer(page, "pointermove", cx + 30 + k * 12, cy, 2); }
  await pointer(page, "pointerup", cx - 126, cy, 1);
  await pointer(page, "pointerup", cx + 126, cy, 2);
  await sleep(150);
}
const fitView = async (page) => { await page.evaluate(() => { QA.view.s = 0; dispatchEvent(new Event("resize")); }); await sleep(100); };
// the editor's ground against a fresh build of the same layer
const matchesBuild = (page) => page.evaluate(async () => {
  const [L, K] = await Promise.all([import("/lab/rules/layer.js"), import("/lab/kit/rng.js")]);
  return K.fnv1a(QA.mat) === K.fnv1a(L.build(QA.L));
});
// open pixels in a box of the preview (Settle) or of the layer as painted
const openIn = (page, x0, y0, x1, y1) => page.evaluate(([x0, y0, x1, y1]) => {
  const m = QA.settling ? QA.sand.mat : QA.mat;
  let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (m[y * 1024 + x] === 0) n++;
  return n;
}, [x0, y0, x1, y1]);
const toastText = (page) => page.evaluate(() => { const t = document.querySelector(".toast.on"); return t ? t.textContent : ""; });
// the layer as the editor keeps it, from a decoded link
const asDraft = (L) => JSON.stringify(Object.assign(blank(L.seed), L));

R.section("A phone");
{
  const { page, errors, close } = await open("rules/", PHONE);
  await page.waitForSelector(".card.start .go");
  R.check(true, "the first visit shows how it works");
  await shot(page, "rules-phone-title");
  await page.click(".card.start .go");
  await sleep(300);
  const out = await page.evaluate(() => [...document.querySelectorAll("#tools button, #tools select")].filter((b) => { const r = b.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).map((b) => b.textContent.trim()));
  const chips = await page.$$eval("#paints button", (bs) => bs.length);
  R.check(chips === 11 && out.length === 0, `all ${chips} paint chips and every tool button are inside the screen width${out.length ? " (not: " + out.join(", ") + ")" : ""}`);
  let tip = "";
  try { await until(page, () => { const t = document.querySelector(".toast.on"); return t && /Pinch/.test(t.textContent); }, null, 5000); tip = await toastText(page); } catch (e) { /* no tip */ }
  R.check(/Pinch with two fingers/.test(tip), "on the first visit, a tip says how to zoom");
  // dig from the hole down to the left drain
  await page.evaluate(() => QA.setSize(2));
  await paintPath(page, [[512, 50], [512, 160], [420, 260], [360, 420], [362, 690]]);
  const dug = await page.evaluate(() => ({ n: QA.L.strokes.length, p: QA.L.strokes[0].p, open: [[512, 120], [420, 260], [361, 500]].every(([x, y]) => QA.mat[y * 1024 + x] === 0) }));
  R.check(dug.n === 1 && dug.p === 0 && dug.open, "a finger drag with Dig cuts one tunnel along its path");
  R.check(await matchesBuild(page), "what you see is exactly what the link builds");
  // two fingers: zoom, and no paint
  const s0 = await page.evaluate(() => QA.view.s), cx = PHONE.width / 2, cy = 330;
  await pinch(page, cx, cy);
  const z = await page.evaluate(() => ({ s: QA.view.s, n: QA.L.strokes.length }));
  R.check(z.s > s0 * 2 && z.n === 1, `two fingers spread zoom in (${(z.s / s0).toFixed(1)} times) and paint nothing`);
  await shot(page, "rules-phone-zoom");
  await fitView(page);
  // a moose in the tunnel, then gone again with a second tap
  await page.selectOption("#critter", "5");
  await tapAt(page, 420, 262);
  R.check(await page.evaluate(() => QA.L.critters.length === 1 && QA.L.critters[0].k === 5), "picking Moose and tapping the layer puts a moose there");
  await tapAt(page, 420, 262);
  R.check(await page.evaluate(() => QA.L.critters.length === 0), "a second tap on it takes it away");
  await page.click("#undo");
  await sleep(150);
  R.check(await page.evaluate(() => QA.L.critters.length === 1), "Undo brings it back");
  // a finger is not a pixel: a tap 6 px to the side of a moose finds it
  await tapAt(page, 640, 420);
  const mark = await page.evaluate(() => { const s = QA.view.s; return { n: QA.L.critters.length, w: 10 * s, h: 12 * s, reach: QA.reach() * s }; });
  await tapAt(page, 640, 420, "touch", 6, -3);
  const n6 = await page.evaluate(() => QA.L.critters.length);
  R.check(mark.n === 2 && n6 === 1, `a tap 6 px off the moose takes it away (the moose is ${mark.w.toFixed(1)} by ${mark.h.toFixed(1)} px, and a tap finds a thing ${mark.reach.toFixed(0)} px away)`);
  await shot(page, "rules-phone-moose");
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
  // while Settle runs: a pinch zooms and Settle goes on; a drag digs into the preview, and the layer stays as painted
  const strokes0 = await page.evaluate(() => JSON.stringify(QA.L.strokes));
  await page.click('#paints button[data-p="dig"]');
  await page.evaluate(() => QA.setSize(2));
  const [px0, py0] = await page.evaluate(() => QA.toWorld(195 - 30, 330));
  const under = () => openIn(page, px0 - 12, py0 - 12, px0 + 12, py0 + 12);
  const open0 = await under(), sp = await page.evaluate(() => QA.view.s);
  await pinch(page, 195, 330);
  const pz = await page.evaluate(() => ({ settling: QA.settling, s: QA.view.s }));
  const open1 = await under();
  R.check(pz.settling && pz.s > sp * 2 && open1 === open0, `a pinch during Settle zooms (${(pz.s / sp).toFixed(1)} times), Settle keeps running, and the first finger digs nothing (${open0} open pixels under it, then ${open1})`);
  await fitView(page);
  const box = [700, 480, 860, 520], hole0 = await openIn(page, ...box);
  await paintPath(page, [[710, 500], [850, 500]]);
  const hole1 = await openIn(page, ...box);
  const poke = await page.evaluate(() => ({ settling: QA.settling, strokes: JSON.stringify(QA.L.strokes) }));
  R.check(poke.settling && poke.strokes === strokes0 && hole1 > hole0 + 1500, `a drag during Settle keeps it running, leaves the strokes as they were, and opens ${hole1 - hole0} pixels in the preview`);
  R.check(/preview only/.test(await toastText(page)), "the first drag says that the brush changes the preview only");
  await shot(page, "rules-phone-poke");
  await page.click("#settle");
  R.check(await page.evaluate(() => !QA.settling), "Stop goes back to the layer as painted");
  R.check(await openIn(page, ...box) === hole0, "and the hole the drag dug in the preview is not in the layer");
  const meter = await page.textContent("#size");
  R.check(/^\d+ \/ 2,000$/.test(meter) && await page.isDisabled("#share"), `the meter shows the length of the link (${meter}), and Share waits for a clear`);
  // a clear, then a name: the name changes the code, and the clear goes with it
  const code0 = await page.evaluate(() => QA.relink());
  await page.evaluate(async (code) => { (await import("/lab/rules/layer.js")).recordClear(code, 47); dispatchEvent(new Event("pageshow")); }, code0);
  await sleep(100);
  R.check(!(await page.isDisabled("#share")), "a clear of this layer opens Share");
  await page.fill("#name", "Dam Trap");
  await sleep(400);
  const named = await page.evaluate(() => ({ code: QA.code, name: QA.L.name, share: !document.getElementById("share").disabled, status: document.getElementById("status").textContent }));
  R.check(named.name === "Dam Trap" && named.code !== code0 && named.share && /0:47/.test(named.status), `Share stays open after a name is typed ("${named.status}")`);
  // your test runs of this layer, as Down the Drain records them
  await page.evaluate(async (code) => { const L = await import("/lab/rules/layer.js"); for (const [c, p] of [["lava", 30], ["lava", 55], ["moose", 20], ["lava", 78]]) L.recordTry(code, c, p); dispatchEvent(new Event("pageshow")); }, named.code);
  await sleep(100);
  const status = await page.textContent("#status");
  R.check(/^4 tries: 3 lava, 1 moose\. You cleared this layer in 0:47\./.test(status), `the status counts your tries and what got you ("${status}")`);
  await shot(page, "rules-phone-painted");
  // come back later: the layer is there, and no tip covers it
  await page.reload();
  await page.waitForFunction(() => window.QA && QA.code);
  await sleep(1200);
  R.check(!/Pinch/.test(await toastText(page)) && await page.evaluate(() => QA.L.name === "Dam Trap"), "the next visit keeps the layer and shows no zoom tip");
  // Test it: the layer opens in Down the Drain
  const code = await page.evaluate(() => QA.relink());
  await Promise.all([page.waitForURL(/\/fall\/#L=/, { timeout: 15000 }), page.click("#test")]);
  const url = page.url();
  R.check(url.endsWith("/fall/#L=" + code + "&edit=1"), "Test it opens Down the Drain with the layer in the link");
  for (const e of errors.filter((e) => !/\/fall\//.test(e))) R.check(false, e);
  await close();
}

R.section("A tank by lava in Settle");
{
  // a pocket with lava in it and a propane tank beside the lava, as a draft
  const L = blank(777);
  L.name = "Hot Tank";
  L.strokes.push({ p: 0, r: 1, pts: [[512, 50], [512, 690]] });
  L.strokes.push({ p: 0, r: 3, pts: [[600, 150], [700, 150]] });
  L.strokes.push({ p: 7, r: 2, pts: [[640, 160], [690, 160]] });
  L.tanks.push({ x: 620, y: 168 });
  const draft = { content: `(() => { if (sessionStorage.getItem("qa-d")) return; localStorage.setItem("lab.rules.seen", "1"); localStorage.setItem("lab.rules.draft", ${JSON.stringify(JSON.stringify(L))}); sessionStorage.setItem("qa-d", "1"); })();` };
  const { page, errors, close } = await open("rules/", { ...PHONE, init: draft });
  await page.waitForFunction(() => window.QA && QA.code);
  // watch every frame for the blast's flash
  await page.evaluate(() => { window.__flash = 0; const look = () => { window.__flash = Math.max(window.__flash, QA.sand.flashes.length); requestAnimationFrame(look); }; look(); });
  await page.click("#settle");
  await until(page, () => QA.heard.includes("boom"), null, 15000);
  await sleep(400);
  const got = await page.evaluate(() => ({ heard: QA.heard.slice(), dead: QA.sand.props[0].dead, metal: QA.sand.mat.reduce((n, v) => n + (v === 24), 0), flash: window.__flash, settling: QA.settling }));
  R.check(got.heard.indexOf("sizzle") >= 0 && got.heard.indexOf("sizzle") < got.heard.indexOf("boom"), "the fuse hisses before the tank blows");
  R.check(got.dead && got.metal === 0 && got.flash > 0 && got.settling, `the tank blows: its metal is gone, a flash shows, and Settle goes on (${got.metal} metal pixels left)`);
  await shot(page, "rules-phone-boom");
  for (const e of errors) R.check(false, e);
  await close();
}

R.section("A friend's remix");
{
  // the layer a friend sends: "Remix this layer" on the clear card opens /lab/rules/#L=<code>
  const F = blank(31337);
  F.name = "Dam Trap";
  F.strokes.push({ p: 0, r: 2, pts: [[512, 50], [512, 300], [362, 690]] }, { p: 5, r: 3, pts: [[600, 200], [700, 200]] });
  F.critters.push({ k: 5, x: 450, y: 400 });
  const code = await encode(F);
  const { page, errors, close } = await open("rules/", { ...PHONE, hash: "#L=" + code });
  await page.waitForSelector(".card.start .go");
  await page.click(".card.start .go");
  R.check(await page.evaluate(() => QA.remixed), "a link with #L= opens its layer in the editor");
  await sleep(150);
  const got = await page.evaluate(() => ({ L: JSON.stringify(QA.L), share: document.getElementById("share").disabled, hash: location.hash }));
  R.check(got.L === asDraft(await decode(code)), "the editor holds exactly the layer in the link");
  R.check(got.share, "Share is closed: you clear the layer yourself before you send it");
  R.check(/Add your trap and send it back/.test(await toastText(page)) && got.hash === "", "a tip says to add your trap and send it back, and the link leaves the address bar");
  await shot(page, "rules-phone-remix");
  // a second link while you have a layer: the editor asks first, and Undo brings your layer back
  const G = blank(4242);
  G.name = "Second";
  G.strokes.push({ p: 0, r: 1, pts: [[300, 100], [300, 400]] });
  const code2 = await encode(G);
  let asked = "";
  page.once("dialog", (d) => { asked = d.message(); d.accept(); });
  await page.goto(page.url().replace(/#.*$/, "") + "#L=" + code2);
  await page.reload();
  await page.waitForFunction(() => window.QA && QA.code);
  await page.evaluate(() => QA.remixed);
  await sleep(150);
  const second = await page.evaluate(() => JSON.stringify(QA.L));
  R.check(/goes away/.test(asked) && second === asDraft(await decode(code2)), "with a layer of your own, the editor asks before it opens another");
  await page.click("#undo");
  await sleep(150);
  R.check(await page.evaluate(() => QA.L.name) === "Dam Trap", "Undo brings back the layer you had");
  for (const e of errors) R.check(false, e);
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
