// The story save 'crimson.story.v1' (MISSIONS acceptance): a written save reads back as a valid SaveV1, and
// every damaged save repairs to a playable state:
// - corrupted (not JSON), truncated (cut mid-write), wrong version (v 2, v 0, no v), hostile (prototype
//   keys, huge and wrong-typed values, script text, positions far outside the world, unknown ids).
// Each repaired save passes types.js validateSave, keeps positions inside the world, keeps unknown chapter,
// mission and finished ids in save.quarantine (not dropped), never pollutes Object.prototype, rebuilds the
// title summary from the content, and CONTINUE from it reaches play with the hero inside the world.
// Run: NODE_PATH=/opt/node22/lib/node_modules node qa/crimson/save.mjs (CRIMSON_URL for a worktree).
import { open, step, stepUntil, invariants, finish } from "./lib.mjs";

const fails = [], errs = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };

const big = "x".repeat(200000);
const hostile = JSON.stringify({
  v: 1, seed: "7; drop table", pick: 99, chapter: "p99", mission: { id: "zz_unknown", step: 7 }, done: ["f1", "p99", "<script>alert(1)</script>", "f1", 42, null],
  flags: JSON.parse('{"__proto__": {"polluted": true}, "constructor": 1, "ok": true, "big": "' + big.slice(0, 5000) + '", "nested": {"a": 1}, "n": 3}'),
  evidence: { face: "<img src=x onerror=alert(1)>", place: "ph0012ab", date: 5, link: null },
  day: "someday", time: 1e9, hero: { x: 5e9, z: -5e9, yaw: "north", mode: "flying" }, van: { kind: "tank", x: 0, z: 0 },
  seats: new Array(40).fill("gabe"), hp: -5, canteen: -3, canteenMax: 99, weapons: ["nuke", "staff", "staff"], weapon: "nuke", abilities: { bearCall: "yes" },
  kazoos: big, cairns: ["cairn_bell", "hack", "cairn_bell"], revealed: new Array(1000).fill("aframe"), trials: { trial_schnebly: -1, x: "fast", "__proto__": 3 },
  photos: [{ id: "ph001ab", subject: "gabe", kind: "face", score: 900, mission: "p3", t: 10 }, { id: "<b>", score: 1 }, "junk"],
  thumbs: JSON.parse('{"ph001ab": "javascript:alert(1)", "__proto__": "data:image/jpeg;base64,AAAA", "ph002": "data:image/jpeg;base64,' + "A".repeat(30000) + '"}'),
  stats: { deaths: -1, deflects: "many", takedowns: 1e20, photos: NaN, km: 3, playTime: 12 }, assist: "true", quarantine: "none",
  summary: { chapter: 999, title: "<img src=x onerror=alert(1)> CHAPTER" }, updated: "now", extra: { anything: true },
});
const CASES = [
  { name: "corrupted (not JSON)", raw: "{{{ this is not a save" },
  { name: "truncated", raw: '{"v":1,"seed":7,"pick":3,"chapter":"p3","mission":null,"done":["f1","f2","i1"],"flags":{"f5Photo":"ph0' },
  { name: "wrong version 2", raw: JSON.stringify({ v: 2, chapter: "f3", pick: 1, done: ["f1", "f2"], hero: { x: 100, z: 50, yaw: 0, mode: "foot" }, newField: [1, 2] }) },
  { name: "wrong version 0", raw: JSON.stringify({ v: 0, chapter: "i0", kazoos: "1".repeat(51) }) },
  { name: "no version, an array", raw: JSON.stringify([1, 2, 3]) },
  { name: "hostile", raw: hostile },
];

const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic" });
{
  const r = await stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.chapter === "f1" && __crimson.story.mode === "play", { maxSec: 60 });
  check(r.ok, `the story is up (${r.sec} s)`);
  // a written save reads back
  const rt = await page.evaluate(async () => {
    const T = await import(new URL("js/story/types.js", location.href).href);
    const S = __crimson.story.S;
    // (in free roam: inside a mission the save holds the mission's checkpoint instead of the live state)
    S.missions.quit(); for (let i = 0; i < 3; i++) __crimson.step(1 / 60, false);
    S.flags.qaFlag = "kept"; S.evidence.set("date", "ph0099xy"); S.hero.place(-600, 180, 1);
    const ok = S.save.write(), raw = JSON.parse(localStorage.getItem("crimson.story.v1")), got = S.save.get();
    return { ok, bad: T.validateSave(raw), flag: got.flags.qaFlag, date: got.evidence.date, chapter: got.chapter, x: Math.round(got.hero.x), sum: got.summary };
  });
  check(rt.ok && !rt.bad.length && rt.flag === "kept" && rt.date === "ph0099xy" && rt.chapter === "f1" && rt.x === -600, `a written save reads back as a valid SaveV1${rt.bad.length ? ": " + rt.bad.join("; ") : ""}`);
  check(rt.sum && rt.sum.chapter === 3 && typeof rt.sum.title === "string", `its summary comes from the content (CHAPTER ${rt.sum && rt.sum.chapter} · ${rt.sum && rt.sum.title})`);

  for (const c of CASES) {
    const res = await page.evaluate(async (raw) => {
      const T = await import(new URL("js/story/types.js", location.href).href);
      const S = __crimson.story.S;
      localStorage.setItem("crimson.story.v1", raw);
      const s = S.save.get(), H = S.world.HALF;
      return {
        has: S.save.has(), bad: T.validateSave(s), chapter: s.chapter, pick: s.pick, q: s.quarantine, polluted: ({}).polluted !== undefined || Object.prototype.hasOwnProperty.call(Object.prototype, "polluted"),
        inWorld: Math.abs(s.hero.x) <= H && Math.abs(s.hero.z) <= H && (!s.van || (Math.abs(s.van.x) <= H && Math.abs(s.van.z) <= H)),
        summary: s.summary, kaz: s.kazoos.length, size: JSON.stringify(s).length, hp: s.hp, cmax: s.canteenMax, weapons: s.weapons, weapon: s.weapon,
        thumbs: Object.keys(s.thumbs), flags: s.flags, done: s.done, mission: s.mission, v: s.v,
      };
    }, c.raw);
    check(res.has && res.v === 1 && !res.bad.length, `${c.name}: repairs to a valid SaveV1${res.bad.length ? ": " + res.bad.slice(0, 4).join("; ") : ""} (chapter ${res.chapter})`);
    check(res.inWorld && !res.polluted, `${c.name}: positions inside the world, no prototype pollution`);
    check(/^[A-Za-z0-9 '.,!?-]*$/.test(res.summary.title) && res.summary.chapter >= 1 && res.summary.chapter <= 99, `${c.name}: a clean title summary (CHAPTER ${res.summary.chapter} · ${res.summary.title})`);
    if (c.name === "hostile") {
      const qv = JSON.stringify(res.q);
      check(qv.includes('"chapter"') && qv.includes("p99") && qv.includes("zz_unknown"), `hostile: the unknown chapter, mission and finished ids are quarantined, not dropped (${qv.slice(0, 160)})`);
      check(res.size < 60000 && res.kaz === 51 && res.hp >= 1 && res.cmax === 8 && res.weapon === "fists" && res.weapons.join() === "fists,staff", `hostile: sizes and values are clamped (${res.size} bytes, hp ${res.hp}, gourd ${res.cmax}, ${res.weapons.join("+")})`);
      check(res.thumbs.length === 0 && !("__proto__" in res.flags && typeof res.flags.__proto__ !== "object") && res.flags.ok === true && !("nested" in res.flags), `hostile: bad pictures and nested or prototype flags are dropped (${res.thumbs.join(",")})`);
      check(res.done.join() === "f1" && res.mission === null, `hostile: done keeps the known ids (${res.done.join(",")})`);
    }
    if (c.name === "truncated") check(res.chapter === "p3" && res.pick === 3 && res.done.includes("f2"), `truncated: the chapter, pick and done list are salvaged (${res.chapter}, ${res.pick}, ${res.done.join(",")})`);
    if (c.name === "wrong version 2") check(res.chapter === "f3" && JSON.stringify(res.q).includes('"v"'), "wrong version 2: kept what fits, and the version is quarantined");
    if (c.name === "wrong version 0") check(res.chapter === "f1" && res.kaz === 51, `wrong version 0: the cold open is never a resume point (${res.chapter})`);
    // CONTINUE from it
    await page.evaluate(() => __crimson.storyApi.begin({ reason: "continue" }));
    const go = await stepUntil(page, () => { const S = __crimson.story.S; return !!S.missions.chapter && (S.mode === "play" || S.mode === "credits"); }, { maxSec: 30 });
    await step(page, 1);
    const inv = await invariants(page);
    const st = await page.evaluate(() => ({ chapter: __crimson.story.S.missions.chapter, mode: __crimson.story.S.mode }));
    check(go.ok && !inv.length, `${c.name}: CONTINUE plays (${st.chapter}, ${st.mode})${inv.length ? ": " + inv.join("; ") : ""}`);
  }
  // write() waits for a chapter: during the boot it writes nothing
  const boot = await page.evaluate(() => {
    const S = __crimson.story.S, before = localStorage.getItem("crimson.story.v1"), out = {};
    const off = S.bus.on("start", () => { out.mode = S.mode; out.chapter = S.missions.chapter; out.wrote = S.save.write(); out.same = localStorage.getItem("crimson.story.v1") === before; });
    __crimson.storyApi.begin({ reason: "jump", chapter: "f1" });
    off();
    return out;
  });
  check(boot.mode === "boot" && boot.chapter === null && !boot.wrote && boot.same, `write() writes nothing until a chapter runs (${JSON.stringify(boot)})`);
  // NEW STORY's cold open never replaces a stored save (a hide in c0 wrote the old chapter with nothing done)
  await stepUntil(page, () => { const S = __crimson.story.S; return !!S.missions.chapter && S.mode === "play"; }, { maxSec: 30 });
  const cold = await page.evaluate(() => {
    const S = __crimson.story.S, M = S.missions, old = JSON.stringify({ v: 1, chapter: "f3", done: ["f1", "f2"], flags: { kept: true } });
    localStorage.setItem("crimson.story.v1", old);
    const ch = M.chapter; M.chapter = "c0";
    let wrote; try { wrote = S.save.write(); } finally { M.chapter = ch; }
    return { wrote, same: localStorage.getItem("crimson.story.v1") === old };
  });
  check(!cold.wrote && cold.same, `the cold open leaves a stored save as it was (${JSON.stringify(cold)})`);
  // the title offers CONTINUE for any stored save: the story repairs it (truncated, another version)
  const title = await page.evaluate((raw) => {
    localStorage.setItem("crimson.story.v1", raw);
    __crimson.showTitle();
    return !document.getElementById("modeContinue").hidden && __crimson.focusMode === "continue";
  }, CASES[1].raw);
  check(title, "the title offers CONTINUE for a truncated save");
}
errs.push(...errors);
await browser.close();
await finish("save", fails, null, errs);
