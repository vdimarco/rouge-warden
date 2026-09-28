// Talking mouths and the costume's hats (cast/talk.js, cast/props.js, cast/cast.js).
// - In a dialogue box the speaker's mouth opens and closes during the line (several times, wider on the
//   vowels, shut on the pauses), a stressed word nods the head, a non-speaker's mouth never moves, the
//   mouth is shut when the line has been said, and the box shows its ▼ only then. Skipping the typing to
//   the end shuts the mouth at the end of the word. A thought in parentheses moves no mouth.
// - Subtitles and cine lines move the line's speaker (a cine line names no one: its LINES speaker talks),
//   on a GLB body, the arena Gabe and a code-built body alike; the mouth is a few dozen triangles.
// - Hats: each chapter's costume and kasa follow the rule (costume from F3 to I5 and in C0 and I0; the kasa
//   worn on the nights out F3 and F5, off (not drawn) the morning after and after the fight; day clothes
//   in F1, F2 and the present), one hat each (the body's own cap folds away under a worn kasa, and back when
//   it comes off), nothing carries over between chapters, the arena ronin gets no second hat in C0, and
//   the crew put the kasa on for the E1 photo ("Kasa hats on.").
// Pass --shots to save pictures to /tmp/talk_*.png.
import { open, step, stepUntil, storyReady, freeRoam, shot, finish } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails.push(msg); };
const SHOTS = process.argv.includes("--shots");
const T = await import(new URL("../../public/crimson/js/story/types.js", import.meta.url).href);
const { CINES } = await import(new URL("../../public/crimson/js/story/content/cines.js", import.meta.url).href);
const { MISSIONS: EPI } = await import(new URL("../../public/crimson/js/story/content/m_epilogue.js", import.meta.url).href);

/* ---------------- Node: the content ---------------- */
const roninKasa = (CINES.c0.actors || []).filter((c) => c.who === "ronin" && c.do === "prop" && /kasa/.test((c.args && c.args.name) || ""));
check(!roninKasa.length, "C0 puts no kasa on the arena ronin (he wears a headband; the pick's kasa is on his back)");
const e1 = EPI.e1.steps, iPhoto = e1.findIndex((s) => s.type === "script" && s.fn === "kasaOn" && /e1\.photo/.test(JSON.stringify(s.args)));
check(iPhoto >= 0 && e1[iPhoto + 1] && e1[iPhoto + 1].type === "photo", "E1: 'Kasa hats on.' is said and the crew put the kasa on, then the photo");

/* ---------------- the page ---------------- */
const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&god&nomusic&q=2", width: 640, height: 360 });
check((await storyReady(page)).ok, "the story is ready");
await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 30 });
check((await freeRoam(page)).ok, "free roam");

// Vance and Fifty-One face to face, away from the hero, a camera on Vance
const ready = await page.evaluate(async () => {
  const S = __crimson.story.S, T3 = S.THREE, H = S.hero;
  S.cast.preload(["vance", "fifty", "civA"]);
  const t0 = performance.now();
  while (!["vance", "fifty", "civA"].every((id) => S.cast.ready(id)) && performance.now() - t0 < 60000) await new Promise((r) => setTimeout(r, 100));
  for (const f of [...S.cast.followers.list]) S.cast.followers.remove(f.a || f);
  const x = H.pos.x + 30, z = H.pos.z + 30;
  const v = window.__v = S.cast.spawn("vance", { pos: { x, z }, yaw: 0 });
  const f = window.__f = S.cast.spawn("fifty", { pos: { x: x + 0.9, z: z + 0.8 }, yaw: -2.2 });
  const c = window.__c = S.cast.spawn("civA", { variant: 1, pos: { x: x - 1.2, z: z + 0.6 }, yaw: 2.4 });
  for (const a of [v, f, c]) a.play("idle", { fade: 0 });
  S.cameras.add("qa", 1000, () => !!window.__qaOn, () => {
    const a = window.__qaOn; a.root.updateMatrixWorld(true);
    const p = a.bone("Head").getWorldPosition(new T3.Vector3()), yaw = a.root.rotation.y;
    S.camera.position.set(p.x + Math.sin(yaw) * 0.8, p.y + 0.03, p.z + Math.cos(yaw) * 0.8); S.camera.lookAt(p); S.focus.copy(p);
  });
  window.__qaOn = v;
  return { v: !!v.body, f: !!f.body, c: !!c.body };
});
await step(page, 1);
check(ready.v && ready.f && ready.c, `Vance, Fifty-One and a code-built body are loaded (${JSON.stringify(ready)})`);

// sample the mouths every tick while fn's line plays: [{t, v, f, c, nod, nx}]
const sample = (sec) => page.evaluate((n) => {
  const S = __crimson.story.S, st = (a) => S.cast.talk.state(a), out = [];
  for (let i = 0; i < n; i++) {
    __crimson.step(1 / 60, false);
    const nx = document.querySelector("#sSay .nx");
    out.push({ v: st(window.__v).h, f: st(window.__f).h, c: st(window.__c).h, nod: st(window.__v).nod, fnod: st(window.__f).nod, nx: nx ? nx.textContent : "", say: !!S.test.ui.say, typing: !!(S.test.ui.say && S.test.ui.say.typing) });
  }
  return out;
}, Math.round(sec * 60));
// open/close cycles: crossings of a high and a low mark
const cycles = (hs, hi = 0.2, lo = 0.08) => { let n = 0, up = false; for (const h of hs) { if (!up && h > hi) { up = true; n++; } else if (up && h < lo) up = false; } return n; };
// syllables: rises and falls of at least d (the mouth need not shut between them, as in speech)
const peaks = (hs, d = 0.08) => { let n = 0, lo = hs[0] || 0, hi = -1; for (const h of hs) { if (hi < 0) { if (h < lo) lo = h; else if (h > lo + d) hi = h; } else { if (h > hi) hi = h; else if (h < hi - d) { n++; lo = h; hi = -1; } } } return n; };

/* 1. a dialogue box line */
const LINE = "I need a face, a place, and a date. Photos. From far away. DO NOT go near that ranch!";
await page.evaluate((t) => { window.__h = __crimson.story.S.ui.say([{ who: "vance", text: t }]); }, LINE);
const s1 = await sample(7);
const hv = s1.map((s) => s.v), typedAt = s1.findIndex((s) => !s.typing), endAt = s1.findIndex((s, i) => i > 10 && s.nx === "■");
check(Math.max(...hv) > 0.3 && cycles(hv) >= 5 && peaks(hv) >= 14, `the speaker's mouth opens and closes during the line (max ${Math.max(...hv).toFixed(2)}, ${peaks(hv)} syllables, shut ${cycles(hv)} times)`);
const mid = hv.slice(20, 200);
check(mid.some((h) => h < 0.05) && mid.some((h) => h > 0.3), "it eases between shut (the pauses) and wide open (the vowels), not a fixed opening");
let snaps = 0; for (let i = 1; i < hv.length; i++) if (Math.abs(hv[i] - hv[i - 1]) > 0.2) snaps++;
check(snaps === 0, `the mouth eases between shapes, never snapping in one tick (${snaps} jumps over 0.2)`);
check(Math.max(...s1.map((s) => s.f)) === 0 && Math.max(...s1.map((s) => s.c)) === 0 && Math.max(...s1.map((s) => s.fnod)) === 0, "a non-speaker's mouth (Fifty-One, a code-built body) does not move");
check(Math.max(...s1.map((s) => s.nod)) > 0.02, `a stressed word nods the head (${Math.max(...s1.map((s) => s.nod)).toFixed(3)} rad)`);
check(typedAt > 0 && endAt > typedAt && hv.slice(endAt).every((h) => h === 0), `the box waits (■) once the line is said, and the mouth is shut from then on (typed at ${(typedAt / 60).toFixed(2)} s, said at ${(endAt / 60).toFixed(2)} s)`);
check(endAt / 60 > 3 && endAt / 60 < 6.5, `the line is said at a speaking pace (${(endAt / 60).toFixed(2)} s for ${LINE.length} characters)`);
const mouthTris = await page.evaluate(() => { let n = 0; const S = __crimson.story.S, M = S.cast.talk.mouthOf(window.__v); M.g.traverse((o) => { if (o.isMesh) n += o.geometry.index ? o.geometry.index.count / 3 : o.geometry.attributes.position.count / 3; }); return n; });
check(mouthTris <= 60, `the mouth is ${mouthTris} triangles`);
await page.evaluate(() => __crimson.story.S.ui.advanceAll());

/* 2. mid-line shots, 3 ticks apart */
if (SHOTS) {
  await page.evaluate(() => { window.__h = __crimson.story.S.ui.say([{ who: "vance", text: "That is a date. Good work. Now go to bed, all of you." }]); });
  await step(page, 0.5, { draw: true });
  for (let i = 0; i < 3; i++) { await shot(page, `/tmp/talk_vance_${i}.png`); await step(page, 3 / 60, { draw: true }); }
  await page.evaluate(() => __crimson.story.S.ui.advanceAll());
}

/* 3. skipping the typing ends the word, then the mouth shuts */
await page.evaluate(() => { window.__h = __crimson.story.S.ui.say([{ who: "vance", text: "Labor is our biggest cost. Nobody gets paid at the ranch. Nobody." }]); });
await step(page, 0.4);
await page.keyboard.press("KeyE");
const s3 = await sample(0.6);
check(s3.slice(24).every((s) => s.v < 0.01) && s3[s3.length - 1].nx === "■", `skipping the typing shuts the mouth within 0.4 s and the box waits (${s3.slice(24).map((s) => s.v.toFixed(2)).slice(0, 4).join(" ")})`);
await page.evaluate(() => __crimson.story.S.ui.advanceAll());

/* 4. a thought moves no mouth; a subtitle moves its speaker */
await page.evaluate(() => { __crimson.story.S.ui.say([{ who: "vance", text: "(What box?)" }]); });
const s4 = await sample(1);
check(s4.every((s) => s.v === 0), "a line in parentheses (a thought) moves no mouth");
await page.evaluate(() => __crimson.story.S.ui.advanceAll());
await page.evaluate(() => { __crimson.story.S.ui.say(["f1.box", { who: "fifty", text: "Saturday stuff. Don't open it." }], { block: false }); });
const s5 = await sample(9);
check(peaks(s5.map((s) => s.f)) >= 4 && s5.every((s) => s.v === 0), `a subtitle line moves its speaker (Fifty-One: ${peaks(s5.map((s) => s.f))} syllables) and no one else`);
await page.evaluate(() => { __crimson.story.S.ui.subs("civA", "Nice van. Real nice van. Is it yours?"); window.__qaOn = window.__c; });
const s6 = await sample(2);
check(peaks(s6.map((s) => s.c)) >= 4, `a code-built body talks with its painted face (${peaks(s6.map((s) => s.c))} syllables)`);
await step(page, 3);

/* 5. a cine line (it names no speaker; the line's own speaker talks): I1 under the bridge, Gabe */
const cine = await page.evaluate(() => {
  const S = __crimson.story.S;
  window.__qaOn = null;
  window.__cine = S.cine.play("i1");
  const out = []; let gabe = null;
  for (let i = 0; i < 60 * 8; i++) {
    __crimson.step(1 / 60, false);
    gabe = gabe || S.cast.get("gabe");
    const f = S.cast.all().find((a) => a.id === "fifty" && a !== window.__f && a.visible);
    out.push({ g: gabe ? S.cast.talk.state(gabe).h : 0, f: f ? S.cast.talk.state(f).h : -1, subs: document.getElementById("sSubs").textContent });
  }
  return out;
});
const gl = cine.filter((s) => /89A|Keep going/.test(s.subs));
check(gl.length > 30 && peaks(gl.map((s) => s.g)) >= 4, `in a cine the line's speaker talks (Gabe: ${peaks(gl.map((s) => s.g))} syllables over ${gl.length} ticks of his lines)`);
check(cine.some((s) => s.f >= 0) && cine.every((s) => s.f <= 0), "the crew under the bridge who are not speaking keep their mouths shut");
await page.evaluate(() => { const S = __crimson.story.S; if (S.cine.active) S.cine.skip(); });
await step(page, 1);

/* 6. hats per chapter */
const HEAD = ["f3", "f5"], BACK = ["c0", "i0", "i1", "i2", "i3", "f4", "i4", "i5"];
const want = (ch) => ({ on: HEAD.includes(ch) || BACK.includes(ch), kasa: HEAD.includes(ch) ? "head" : false }); // BACK days: costume on, no kasa drawn
const hats = await page.evaluate((order) => {
  const S = __crimson.story.S, T3 = S.THREE, M = S.missions, was = M.chapter, out = {};
  const p = S.hero.pos;
  const crew = window.__crew = ["tanktop", "fifty", "shades", "newbalance", "redjersey"].map((id, i) => S.cast.spawn(id, { pos: { x: p.x + 20 + i, z: p.z + 20 }, yaw: 0 }));
  const w = (o) => o.getWorldPosition(new T3.Vector3());
  const skinned = (a) => { let m = null; a.model.traverse((o) => { if (!m && o.isSkinnedMesh && !o.userData.hull) m = o; }); return m; };
  const base = crew.map((a) => skinned(a).geometry);
  for (const ch of order) {
    try { M.chapter = ch; S.bus.emit("chapter", { id: ch }); } catch (e) { /* a getter */ }
    for (let i = 0; i < 3; i++) __crimson.step(1 / 60, false);
    out[ch] = crew.map((a, i) => {
      a.root.updateMatrixWorld(true);
      const c = S.cast.costumeOf(a), head = w(a.bone("Head")), g = skinned(a).geometry;
      const hullSame = a.hulls.every((h) => h.geometry === g);
      const r = { id: a.id, ...c, hats: ["kasa", "kasaBack"].filter((n) => a.props[n]).length, folded: g !== base[i] ? g.userData.folded || 0 : 0, hullSame };
      if (a.props.kasa) { const k = w(a.props.kasa); r.kasaUp = +(k.y - head.y).toFixed(2); r.kasaOff = +Math.hypot(k.x - head.x, k.z - head.z).toFixed(2); }
      if (a.props.kasaBack) { const k = a.root.worldToLocal(w(a.props.kasaBack)); r.backZ = +k.z.toFixed(2); r.backY = +k.y.toFixed(2); }
      return r;
    });
  }
  try { M.chapter = was; S.bus.emit("chapter", { id: was }); } catch (e) { /* a getter */ }
  return out;
}, T.CHAPTER_ORDER);
const bad = [];
for (const ch of T.CHAPTER_ORDER) for (const r of hats[ch]) {
  const w = want(ch);
  if (r.on !== w.on || r.kasa !== w.kasa) bad.push(`${ch} ${r.id}: costume ${r.on} kasa ${r.kasa}, want ${w.on} ${w.kasa}`);
  if (r.hats > 1) bad.push(`${ch} ${r.id}: two kasa`);
  if (r.kasa === "head" && !(r.folded > 20)) bad.push(`${ch} ${r.id}: the cap is not folded under the kasa (${r.folded})`);
  if (r.kasa !== "head" && r.folded) bad.push(`${ch} ${r.id}: the cap is still folded with no kasa on the head`);
  if (!r.hullSame) bad.push(`${ch} ${r.id}: the outline hull does not match the body`);
  if (r.kasa === "head" && !(r.kasaUp > 0.05 && r.kasaUp < 0.3 && r.kasaOff < 0.12)) bad.push(`${ch} ${r.id}: the kasa sits off the head (${r.kasaUp} up, ${r.kasaOff} off)`);
  if (BACK.includes(ch) && r.hats !== 0) bad.push(`${ch} ${r.id}: a kasa draws on a day it stays off (a slung one read as a disc through the body)`);
}
check(!bad.length, `every chapter dresses the crew by the rule, one hat each, nothing carried over (${bad.length ? bad.slice(0, 6).join("; ") : T.CHAPTER_ORDER.map((c) => `${c}:${hats[c][0].on ? hats[c][0].kasa : "day"}`).join(" ")})`);
if (SHOTS) {
  await page.evaluate(() => { const S = __crimson.story.S, T3 = S.THREE, a = window.__crew[1]; window.__qaOn = a; S.cast.costume(a, true, "head"); });
  await step(page, 0.3, { draw: true }); await shot(page, "/tmp/talk_kasa.png");
}

/* 7. the E1 photo: the kasa goes on the crew's heads, one hat each */
const e1k = await page.evaluate(() => {
  const S = __crimson.story.S, sc = S.content.SCRIPTS.kasaOn, a = window.__crew[0];
  S.cast.costume(a, false);
  const was = S.hero.actor; // (the script dresses the hero and the crew on foot)
  const g = sc({ S, def: { chapter: "e1" } }, { args: {} }); let r = g.next(); while (!r.done) r = g.next();
  return { hero: S.cast.costumeOf(S.hero.actor).kasa, hats: ["kasa", "kasaBack"].filter((n) => S.hero.actor.props[n]).length, was: !!was };
});
check(e1k.hero === "head" && e1k.hats === 1, `the E1 script puts one kasa on the hero's head (${JSON.stringify(e1k)})`);

await finish("talk", fails, browser, errors);
