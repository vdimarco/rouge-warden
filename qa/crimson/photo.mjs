// The phone camera (design 4.3, MISSIONS acceptance, D7):
// 1. A person framed at 0.15 of the screen height, facing the lens, scores 70 or more. The same person
//    behind a building (the Red Rock Motor Lodge) scores under 40. At night with no light on them the
//    score drops by 40 and the viewfinder says 'Too dark'.
// 2. The zoom runs 1x to 8x: the field of view goes from 52 to 7 degrees.
// 3. A shot becomes a 256x144 JPEG that is not blank, kept in IndexedDB 'crimson.photos' and listed in the
//    gallery; the save keeps its record and a small copy for an evidence slot.
// 4. A photo match: a shot within 6 m and 12 degrees of a place's reference pose matches; one from 12 m
//    away does not.
// 5. With IndexedDB missing, or throwing, photos still work for the session, the save keeps the small
//    copies the story needs, and Gabe's wall shows a 'photo lost' card for a picture that is gone.
// Run: NODE_PATH=/opt/node22/lib/node_modules node qa/crimson/photo.mjs (CRIMSON_URL for a worktree).
import { open, step, stepUntil, finish } from "./lib.mjs";

const fails = [], errs = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const ready = (page) => stepUntil(page, () => __crimson.story && __crimson.story.ready && __crimson.story.chapter === "f1" && __crimson.story.mode === "play", { maxSec: 60 });

// the subject (a townsperson) just south of the Red Rock Motor Lodge, and two camera poses 35 m away: one
// with a clear view (searched round the subject), one on the far side of the motel
const SETUP = () => {
  const S = __crimson.story.S, T = S.test.photo;
  S.missions.quit();
  for (let i = 0; i < 5; i++) __crimson.step(1 / 60, false);
  S.traffic.setDensity(0); S.traffic.clear();
  S.hero.place(-330, 240, 0);
  const B = { x: -300, z: 170, d: 10 }; // the motel (places.js BUILDINGS, 40 x 10 m, 5 m high)
  const sx = B.x, sz = B.z + B.d / 2 + 4;
  const a = window.__qaSubject || (window.__qaSubject = S.cast.spawn("civA", { pos: { x: sx, z: sz }, yaw: 0, variant: 0 }));
  a.root.position.set(sx, S.world.surface(sx, sz), sz);
  a.root.updateMatrixWorld(true);
  T.subject("qa:person", { actor: a, kind: "face", label: "THE PERSON" });
  const y = a.root.position.y, head = a.bone && a.bone("Head");
  const top = head ? head.getWorldPosition(new S.THREE.Vector3()).y + 0.08 : y + 1.7;
  const span = top - (y + 0.12);
  const d = 35, zoom = Math.tan(26 * Math.PI / 180) / (span / (0.15 * 2 * d));
  const pose = (x, z) => { const cy = S.world.surface(x, z) + 1.6; return { x, y: cy, z, yaw: Math.atan2(sx - x, sz - z), pitch: Math.atan2(y + 0.12 + span / 2 - cy, Math.hypot(sx - x, sz - z)), zoom }; };
  const clear = (p) => [0.12, span * 0.62, span].every((h) => { const t = S.world.colliders.raycast({ x: p.x, y: p.y, z: p.z }, { x: sx, y: y + h, z: sz }); return t == null || t > 0.98; });
  let open = null;
  for (let k = 0; k < 24 && !open; k++) { const ang = k * Math.PI / 12, p = pose(sx + Math.sin(ang) * d, sz + Math.cos(ang) * d); if (Math.abs(Math.sin(ang)) < 0.95 && Math.cos(ang) < -0.2) continue; if (clear(p)) open = p; }
  return { open, behind: pose(sx, B.z - B.d / 2 - (d - (sz - B.z) - B.d / 2)), y, span };
};

/* ---------------- 1-4: scoring, zoom, capture, match ---------------- */
{
  const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic", width: 960, height: 540 });
  const r = await ready(page);
  check(r.ok, `the story is up (${r.sec} s)`);
  const res = await page.evaluate((src) => {
    const P = (0, eval)("(" + src + ")")();
    const S = __crimson.story.S, T = S.test.photo, a = window.__qaSubject;
    S.look.set("DAY", { dur: 0 }); S.day.set("sat", "12:00");
    const out = {};
    T.open();
    // in the open, facing the lens
    a.root.rotation.y = Math.atan2(P.open.x - a.root.position.x, P.open.z - a.root.position.z);
    T.pose(P.open); __crimson.step(1 / 60, false); T.pose(P.open);
    out.open = T.score("qa:person");
    // the same pose with the person turned away: the facing points go
    a.root.rotation.y += Math.PI; T.pose(P.open);
    out.away = T.score("qa:person");
    a.root.rotation.y -= Math.PI;
    // behind the motel
    a.root.rotation.y = Math.atan2(P.behind.x - a.root.position.x, P.behind.z - a.root.position.z);
    T.pose(P.behind);
    out.behind = T.score("qa:person");
    const c = S.camera.position, hit = S.world.colliders.raycast(c.clone(), { x: a.root.position.x, y: a.root.position.y + 1.2, z: a.root.position.z });
    out.blocked = hit != null && hit < 0.95;
    // at night, no light on the person
    a.root.rotation.y = Math.atan2(P.open.x - a.root.position.x, P.open.z - a.root.position.z);
    S.look.set("NIGHT", { dur: 0 }); S.day.set("sat", "1:00");
    for (let i = 0; i < 3; i++) __crimson.step(1 / 60, false);
    T.pose(P.open);
    out.night = T.score("qa:person");
    for (let i = 0; i < 2; i++) __crimson.step(1 / 60, false);
    out.noteShown = T.state.note;
    S.look.set("DAY", { dur: 0 }); S.day.set("sat", "12:00");
    for (let i = 0; i < 3; i++) __crimson.step(1 / 60, false);
    T.pose(P.open);
    out.dayAgain = T.score("qa:person");
    // zoom: 1x and 8x
    T.pose({ ...P.open, zoom: 8 }); out.fov8 = S.camera.fov;
    T.pose({ ...P.open, zoom: 1 }); out.fov1 = S.camera.fov;
    T.pose(P.open);
    return out;
  }, SETUP.toString());
  const o = res.open, n = res.night;
  check(o.score >= 70 && Math.abs(o.size - 0.15) < 0.03, `a person at ${(o.size * 100).toFixed(1)}% of the screen height, facing the lens, scores ${o.score.toFixed(1)} (70 or more)`);
  check(res.away.score < o.score - 10, `turned away they score less (${res.away.score.toFixed(1)})`);
  check(res.blocked && res.behind.score < 40, `behind the motel they score ${res.behind.score.toFixed(1)} (under 40)`);
  check(Math.abs((res.dayAgain.score - n.score) - 40) < 0.6 && n.note === "Too dark" && res.noteShown === "Too dark", `at night with no light the score drops by 40 (${res.dayAgain.score.toFixed(1)} to ${n.score.toFixed(1)}) and says '${n.note}'`);
  check(Math.abs(res.fov1 - 52) < 0.01 && Math.abs(res.fov8 - 6.97) < 0.05, `the zoom runs from 52 to ${res.fov8.toFixed(2)} degrees`);

  // a shot: the picture is copied after the next frame is drawn
  const shotR = await page.evaluate(() => { const S = __crimson.story.S; const p = S.test.photo.shoot(); return p && { id: p.id, score: p.score, subject: p.subject }; });
  await step(page, 1 / 60, { draw: true });
  await page.waitForTimeout(300); // IndexedDB writes on real time
  const cap = await page.evaluate(async (id) => {
    const S = __crimson.story.S, T = S.test.photo, url = T.thumb(id);
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = 0, s2 = 0, n = 0; for (let i = 0; i < d.length; i += 16) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; s += v; s2 += v * v; n++; }
    const sd = Math.sqrt(s2 / n - (s / n) ** 2);
    const stored = await new Promise((res) => { try { const rq = indexedDB.open("crimson.photos"); rq.onsuccess = () => { try { const g = rq.result.transaction("photos").objectStore("photos").get(id); g.onsuccess = () => res(!!(g.result && g.result.url && g.result.url.startsWith("data:image/jpeg"))); g.onerror = () => res(false); } catch (e) { res(false); } }; rq.onerror = () => res(false); } catch (e) { res(false); } });
    S.evidence.set("face", id);
    S.missions.chapter = S.missions.chapter || "f1";
    const wrote = S.save.write(), sv = JSON.parse(localStorage.getItem("crimson.story.v1"));
    return { jpeg: url.startsWith("data:image/jpeg"), w: img.width, h: img.height, sd, stored, listed: S.photo.gallery.some((p) => p.id === id), db: T.db,
      saved: wrote && sv.photos.some((p) => p.id === id), small: !!(sv.thumbs[id] && sv.thumbs[id].startsWith("data:image/jpeg") && sv.thumbs[id].length < 24000), face: sv.evidence.face === id };
  }, shotR.id);
  check(shotR.subject === "qa:person" && shotR.score >= 70, `the shot is of the person (score ${shotR.score})`);
  check(cap.jpeg && cap.w === 256 && cap.h === 144 && cap.sd > 8, `the picture is a ${cap.w}x${cap.h} JPEG and not blank (deviation ${cap.sd.toFixed(1)})`);
  check(cap.stored && cap.db === "ok", `it is stored in IndexedDB 'crimson.photos' (${cap.db})`);
  check(cap.listed && cap.saved, "it is listed in the gallery and in the save");
  check(cap.small && cap.face, "the save keeps a small copy for the FACE slot (D7)");

  // a photo match at the Uptown clock
  const m = await page.evaluate(() => {
    const S = __crimson.story.S, T = S.test.photo;
    const ref = T.capture("uptown_clock");
    __crimson.step(1 / 60, true);
    const near = { x: ref.x + Math.sin(ref.yaw + 1.2) * 2, y: ref.y, z: ref.z + Math.cos(ref.yaw + 1.2) * 2, yaw: ref.yaw + 5 * Math.PI / 180, pitch: 0, zoom: 1 };
    T.pose(near); const a = T.shoot();
    const far = { x: ref.x - Math.sin(ref.yaw) * 12, y: ref.y, z: ref.z - Math.cos(ref.yaw) * 12, yaw: ref.yaw, pitch: 0, zoom: 1 };
    T.pose(far); const b = T.shoot();
    const turned = { ...near, yaw: ref.yaw + 25 * Math.PI / 180 }; T.pose(turned); const c = T.shoot();
    T.close();
    return { thumb: !!(T.reference("uptown_clock") || {}).thumb, a: a.match || null, b: b.match || null, c: c.match || null };
  });
  check(m.a === "uptown_clock" && !m.b && !m.c, `a shot 2 m and 5 degrees from the reference matches; 12 m back or 25 degrees off does not (${m.a}, ${m.b}, ${m.c})`);
  check(m.thumb, "the reference picture was copied from a drawn frame");
  errs.push(...errors);
  await browser.close();
}

/* ---------------- 5: IndexedDB missing, then throwing ---------------- */
for (const mode of ["missing", "throwing"]) {
  const before = async (page) => page.addInitScript((mode) => {
    if (mode === "missing") Object.defineProperty(window, "indexedDB", { configurable: true, get: () => undefined });
    else Object.defineProperty(window, "indexedDB", { configurable: true, get: () => ({ open() { throw new Error("qa-deliberate IndexedDB failure"); } }) });
  }, mode);
  const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic", width: 960, height: 540, before });
  const r = await ready(page);
  const P = await page.evaluate((src) => { const P = (0, eval)("(" + src + ")")(); const T = __crimson.story.S.test.photo; T.open(); const a = window.__qaSubject; a.root.rotation.y = Math.atan2(P.open.x - a.root.position.x, P.open.z - a.root.position.z); T.pose(P.open); return P; }, SETUP.toString());
  void P;
  const id = await page.evaluate(() => __crimson.story.S.test.photo.shoot().id);
  await step(page, 1 / 60, { draw: true });
  await page.waitForTimeout(200);
  const res = await page.evaluate((id) => {
    const S = __crimson.story.S, T = S.test.photo;
    S.evidence.set("face", id); S.evidence.set("place", "ph999zz"); // a picture that is gone
    const wrote = S.save.write(), sv = JSON.parse(localStorage.getItem("crimson.story.v1"));
    const c = S.test.evidence.paint(), g = c.getContext("2d");
    // the PLACE print's picture area: the dark 'photo lost' card
    const px = g.getImageData(40 + 240 + 60, 110 + 26 + 40, 1, 1).data;
    return { thumb: T.thumb(id).startsWith("data:image/jpeg"), db: T.db, listed: S.photo.gallery.some((p) => p.id === id), wrote, small: !!(sv.thumbs[id]), lost: [px[0], px[1], px[2]] };
  }, id);
  const dark = res.lost[0] < 90 && res.lost[1] < 90 && res.lost[2] < 90;
  check(r.ok && res.thumb && res.listed && res.db !== "ok", `IndexedDB ${mode}: a shot still has its picture for the session (${res.db})`);
  check(res.wrote && res.small, `IndexedDB ${mode}: the save keeps the small copy for the FACE slot`);
  check(dark, `IndexedDB ${mode}: Gabe's wall shows a 'photo lost' card for a missing picture (${res.lost.join(",")})`);
  errs.push(...errors.filter((e) => !/qa-deliberate/.test(e)));
  await browser.close();
}
await finish("photo", fails, null, errs);
