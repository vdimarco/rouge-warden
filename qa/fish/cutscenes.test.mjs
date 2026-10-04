// The cutscene scripts of Reel It In (public/fish/js/cutscenes.js), in node: how long each lasts, where the camera goes,
// the captions, and the ids the save keeps. The page itself (the player, the skip, the hold, the replay) is checked by
// qa/fish/cutscenes.e2e.mjs.
// Run: node qa/fish/cutscenes.test.mjs   (exit code 1 on failure)
import { opening, arrival, reveal, landed, finale, ringSpot, poseAt, arriveId, revealId, landedId } from "../../public/fish/js/cutscenes.js";
import { CUTS } from "../../public/fish/js/save.js";
import { PLACES } from "../../public/fish/js/places.js";
import { ORDER, JOURNEY } from "../../public/fish/js/journey.js";
import { fishingOf } from "../../public/fish/js/fishing.js";
import { byId } from "../../public/fish/js/species.js";

const fails = [];
let passes = 0;
function check(ok, msg) { if (ok) passes++; else fails.push(msg); console.log((ok ? "  ok   " : "  FAIL ") + msg); }
const DEG = Math.PI / 180;
const fin = (p) => [p.x, p.y, p.z].every(Number.isFinite);

// what the world tells the camera: the cast view of the place on a phone held upright (and on a wide screen), the camera
// when the cutscene began (the cast view itself), and the loon in the middle of its loop
const ctxFor = (place, aspect = 0.46) => {
  const eye = place.stand.eye, pitch = (aspect <= 1.15 ? -11 : -5) * DEG, fov = aspect <= 1.15 ? 70 : 42;
  const look = { x: eye.x, y: eye.y + Math.tan(pitch) * 30, z: eye.z - 30 };
  return { cast: { pos: eye, pitch, fov }, aspect, start: { pos: eye, look, fov }, loon: { x: 12, y: 0, z: -44 }, world: null };
};
const scriptsOf = (id) => {
  const P = PLACES[id], sp = byId(fishingOf(id).legend.id);
  return [arrival(P), reveal(P, ringSpot(P)), landed(P, { id: sp.id, kg: sp.kg[0], cm: sp.cm[0] }), finale(P)];
};
const all = ORDER.flatMap(scriptsOf).concat([opening(PLACES.loon)]);

console.log("\nthe ids and the lengths");
{
  const ids = new Set(ORDER.flatMap(scriptsOf).map((s) => s.id));
  check([...ids].every((id) => CUTS.includes(id)) && CUTS.every((id) => ids.has(id)), "every script's id is one the save keeps, and every id the save keeps has a script (" + [...ids].join(" ") + ")");
  check(opening(PLACES.loon).id === "open" && arrival(PLACES.loon).id === "open" && arriveId("loon") === "open" && arriveId("sea") === "arrive.sea" && revealId("river") === "reveal.river" && landedId("stumps") === "landed.stumps", "Loon Lake's arrival is the opening");
  const bad = all.filter((s) => !(s.len >= 4 && s.len <= 9)).map((s) => s.id + " " + s.len);
  check(bad.length === 0, "each lasts 4 to 9 s (" + all.map((s) => s.id + " " + s.len).join(", ") + ")" + (bad.length ? ": " + bad.join(", ") : ""));
  const arr = ORDER.map((id) => arrival(PLACES[id]).len);
  check(arr.slice(1).every((l) => l >= 5 && l <= 7), "the fly-ins at the three new places last 5 to 7 s (" + arr.join(", ") + ")");
}

console.log("\nthe captions: short, plain, no em dashes");
{
  const bad = [];
  for (const s of all) {
    const C = s.caption;
    if (!C || !C.title || C.title.length > 26) bad.push(s.id + ": title " + JSON.stringify(C && C.title));
    if (C && C.line && (C.line.length > 44 || !/\.$/.test(C.line) && !/kg$/.test(C.line))) bad.push(s.id + ": line " + JSON.stringify(C.line));
    if (C && /[—–!]/.test(C.title + " " + (C.line || ""))) bad.push(s.id + ": a dash or a bang in " + JSON.stringify(C));
    if (C && !(C.at >= 0 && C.at < s.len - 1.5)) bad.push(s.id + ": the caption shows for under 1.5 s");
  }
  check(bad.length === 0, "every caption has a short title and one short line that ends in a full stop, shows 1.5 s or more" + (bad.length ? ": " + bad.join("; ") : ""));
  check(opening(PLACES.loon).caption.title === "Loon Lake" && opening(PLACES.loon).caption.line === "The fish are rising.", "the opening names Loon Lake: \"The fish are rising.\"");
  check(ORDER.slice(1).every((id) => arrival(PLACES[id]).caption.title === JOURNEY[id].name), "each fly-in names its place");
  check(ORDER.every((id) => reveal(PLACES[id], ringSpot(PLACES[id])).caption.title === byId(fishingOf(id).legend.id).name), "each reveal names its legend: " + ORDER.map((id) => byId(fishingOf(id).legend.id).name).join(", "));
  const l = landed(PLACES.sea, { id: "bigblue", kg: 88.4, cm: 180 });
  check(l.caption.title === "Big Blue" && l.caption.line === "88.4 kg" && l.keys === null, "the hero shot names the legend and its weight, in the game's own catch camera (" + JSON.stringify(l.caption) + ")");
  check(finale(PLACES.river).caption.title === "You fished them all.", "the finale says \"You fished them all.\"");
}

console.log("\nthe camera");
{
  for (const aspect of [0.46, 0.56, 2.16, 1.6]) {
    const bad = [];
    for (const id of ORDER) {
      const P = PLACES[id], c = ctxFor(P, aspect);
      for (const s of scriptsOf(id).concat(id === "loon" ? [opening(P)] : []).filter((q) => q.keys)) {
        for (let t = 0; t <= s.len + 1e-9; t += 0.05) {
          const p = poseAt(s, t, c);
          if (!fin(p.pos) || !fin(p.look) || !Number.isFinite(p.fov)) { bad.push(s.id + " at " + t.toFixed(2) + ": not a number"); break; }
          // never under the water or the ground (0.4 m clear), never more than 30 m up, a sane field of view
          const ground = Math.max(0, P.height(p.pos.x, p.pos.z));
          if (p.pos.y < ground + 0.4) { bad.push(s.id + " at " + t.toFixed(2) + ": " + p.pos.y.toFixed(2) + " m over ground at " + ground.toFixed(2)); break; }
          if (p.pos.y > 30 || p.fov < 20 || p.fov > 95) { bad.push(s.id + " at " + t.toFixed(2) + ": y " + p.pos.y.toFixed(1) + " fov " + p.fov.toFixed(1)); break; }
          if (Math.hypot(p.look.x - p.pos.x, p.look.y - p.pos.y, p.look.z - p.pos.z) < 3) { bad.push(s.id + " at " + t.toFixed(2) + ": looks at a point under 3 m away"); break; }
        }
      }
    }
    check(bad.length === 0, `aspect ${aspect}: every camera path is finite, clear of the water and the ground, and looks out` + (bad.length ? ": " + bad.slice(0, 4).join("; ") : ""));
  }
  // the fly-ins and the opening settle on the stand in the cast view: the eye, straight out, the cast pitch and field of view
  const bad = [];
  for (const id of ORDER) {
    const P = PLACES[id], c = ctxFor(P), s = arrival(P), p = poseAt(s, s.len, c), e = P.stand.eye;
    const yaw = Math.atan2(p.look.x - p.pos.x, -(p.look.z - p.pos.z)) / DEG, pitch = Math.atan2(p.look.y - p.pos.y, Math.hypot(p.look.x - p.pos.x, p.look.z - p.pos.z));
    if (Math.hypot(p.pos.x - e.x, p.pos.y - e.y, p.pos.z - e.z) > 1e-6 || Math.abs(yaw) > 0.01 || Math.abs(pitch - c.cast.pitch) > 1e-6 || Math.abs(p.fov - c.cast.fov) > 1e-6) bad.push(id + " " + JSON.stringify(p));
    // and it comes to rest there: no jump on the last frames
    const q = poseAt(s, s.len - 0.05, c);
    if (Math.hypot(q.pos.x - p.pos.x, q.pos.y - p.pos.y, q.pos.z - p.pos.z) > 0.05) bad.push(id + " still moving at the end");
  }
  check(bad.length === 0, "the opening and each fly-in end at rest on the stand, in the cast view" + (bad.length ? ": " + bad.join("; ") : ""));
  // the reveal starts from the camera as it was (no cut) and pushes toward the ring; the finale pulls back and up
  const rb = [];
  for (const id of ORDER) {
    const P = PLACES[id], c = ctxFor(P), ring = ringSpot(P), s = reveal(P, ring), p0 = poseAt(s, 0, c), p1 = poseAt(s, 2.6, c), p2 = poseAt(s, s.len, c);
    const d = (p) => Math.hypot(p.pos.x - ring.x, p.pos.z - ring.z), still = poseAt(s, 0.05, c);
    if (Math.hypot(p0.pos.x - c.start.pos.x, p0.pos.y - c.start.pos.y, p0.pos.z - c.start.pos.z) > 1e-6 || Math.hypot(still.pos.x - p0.pos.x, still.pos.z - p0.pos.z) > 0.15) rb.push(id + ": does not start from the camera, at rest");
    if (!(d(p1) <= 11 && d(p2) < d(p1) && d(p0) > 25)) rb.push(id + ": no push (" + [d(p0), d(p1), d(p2)].map((v) => v.toFixed(1)).join(" ") + ")");
    const breach = (s.events || []).find((e) => e.dur);
    if (!breach || !(breach.t > 2 && breach.t + breach.dur < s.len - 0.5)) rb.push(id + ": no breach inside the cutscene");
    if (!s.fade) rb.push(id + ": does not end through black");
    const f = finale(P), f0 = poseAt(f, 1.3, c), f1 = poseAt(f, f.len, c);
    if (!(f1.pos.y > f0.pos.y + 10 && f1.pos.z > f0.pos.z + 10)) rb.push(id + ": the finale does not pull back and up");
  }
  check(rb.length === 0, "a reveal starts from the camera at rest, pushes to about 10 m from the ring, and the legend breaches inside it; the finale pulls back and up" + (rb.length ? ": " + rb.join("; ") : ""));
  // Stump Bay: the push never runs through a dead tree
  const S = PLACES.stumps, ring = ringSpot(S), s = reveal(S, ring), c = ctxFor(S), hit = [];
  for (let t = 0; t <= s.len; t += 0.05) { const p = poseAt(s, t, c); for (const st of S.props.stumps) if (st.top > p.pos.y - 0.5 && Math.hypot(p.pos.x - st.x, p.pos.z - st.z) < st.r + 0.5) hit.push(t.toFixed(2)); }
  check(hit.length === 0, "at Stump Bay the camera passes no stump taller than itself" + (hit.length ? " (at " + hit.slice(0, 5).join(", ") + " s)" : ""));
  // a still shot for each part of the calm version, from the script's own keys
  const sb = all.filter((q) => q.keys && !(q.stills && q.stills.length && q.stills.every((st) => q.keys[st.key]) && q.stills[q.stills.length - 1].to == null)).map((q) => q.id);
  check(sb.length === 0, "every flying cutscene has its still shots for the calm version" + (sb.length ? ": " + sb.join(", ") : ""));
}

console.log("\nthe ring of a replay");
{
  const bad = [];
  for (const id of ORDER) {
    const P = PLACES[id], L = fishingOf(id).legend, r = ringSpot(P), d = Math.hypot(r.x, r.z), zn = P.zone(r.x, r.z);
    if (!(d >= L.ring[0] && d <= L.ring[1]) || zn === "land" || P.depth(r.x, r.z) < 0.6 || (L.zone && zn !== L.zone)) bad.push(id + " " + JSON.stringify(r) + " " + zn);
  }
  check(bad.length === 0, "a replay's gold ring is where the legend rises: its distance, open water, its own kind of water" + (bad.length ? ": " + bad.join("; ") : ""));
}

console.log(fails.length ? `\n${fails.length} of ${passes + fails.length} checks failed` : `\nAll ${passes} checks passed`);
process.exit(fails.length ? 1 : 0);
