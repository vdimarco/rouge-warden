// Street life (js/street.js), with no browser: people on the sidewalks round the player, the walk lights, the people who
// stand, the reactions to the hero, and the neon shop signs. Run from the repo root: node qa/vr/street.test.mjs
import assert from "node:assert/strict";
import { generate } from "../../public/vr/js/city.js";
import { createStreet, walkOn, STREET, POSE, NEON } from "../../public/vr/js/street.js";

const city = generate();
let fails = 0;
const test = (name, fn) => { try { fn(); console.log("PASS: " + name); } catch (e) { fails++; console.log("FAIL " + name + "\n  " + (e && e.message)); } };
const DT = 1 / 30;
// run the street for secs at focus f (hero: an object, or null), calling each(t) after every frame
function run(S, secs, f, hero = null, t0 = S.time || 0, each = null) {
  let t = t0;
  for (let i = 0; i < secs / DT; i++) { t += DT; S.update(DT, t, f, typeof hero === "function" ? hero(t) : hero); if (each) each(t); }
  return t;
}
const out = (S) => S.people.filter((p) => p.on);
// a point on the middle of a sidewalk of the z = 14 avenue, 200 m east of the start avenue
const onStreet = { x: 110, y: 0, z: 14 - 15 + 2 };

test("people fill the sidewalks round the player, all on a sidewalk or a zebra", () => {
  const S = createStreet(city);
  run(S, 60, onStreet);
  const ps = out(S), near = ps.filter((p) => Math.hypot(p.x - onStreet.x, p.z - onStreet.z) < 80);
  assert.ok(ps.length >= 120 && ps.length <= STREET.max, "people out: " + ps.length);
  assert.ok(near.length >= 25, "people within 80 m: " + near.length);
  const off = ps.filter((p) => !S.onWalk(p) || city.isWater(p.x, p.z) || city.collideSphere(p.x, 0.9, p.z, 0.3));
  assert.equal(off.length, 0, "people off the sidewalks: " + JSON.stringify(off.slice(0, 3).map((p) => [p.x, p.z, p.state])));
  const speeds = new Set(ps.map((p) => Math.round(p.speed * 10)));
  assert.ok(speeds.size >= 5 && ps.every((p) => p.speed >= 1 && p.speed <= 1.7), "paces vary between 1.0 and 1.7 m/s");
  const looks = new Set(ps.map((p) => p.shirt.join() + p.pants.join() + p.skin.join()));
  assert.ok(looks.size >= 30, "different clothes: " + looks.size);
});

test("a 500 m move: the people left behind go, new ones show, nobody is over 150 m away", () => {
  const S = createStreet(city);
  run(S, 20, onStreet);
  const before = new Set(out(S).map((p) => p.id + ":" + Math.round(p.x)));
  const far = { x: onStreet.x - 500, y: 0, z: onStreet.z };
  run(S, 20, far);
  const ps = out(S);
  assert.ok(ps.length >= 100, "people round the new spot: " + ps.length);
  assert.ok(ps.every((p) => Math.hypot(p.x - far.x, p.z - far.z) <= STREET.keep + 2), "someone is over 150 m away");
  assert.ok(S.stats.dropped >= 50, "dropped: " + S.stats.dropped);
  assert.ok(before.size > 0);
});

test("crossings: a person starts over a road only while its walk light is on, and waits at the kerb otherwise", () => {
  const S = createStreet(city);
  const was = new Map();
  let starts = 0, bad = 0, waitsOnRoad = 0;
  run(S, 120, onStreet, null, 0, (t) => {
    for (const p of out(S)) {
      const c = p.crossing;
      if (c && was.get(p.id) !== c) { starts++; if (!walkOn(c.street.axis, t)) bad++; }
      was.set(p.id, c);
      if (p.state === "wait") {
        const along = p.strip.axis === "x" ? p.z : p.x;
        if (p.strip.cross.some((q) => Math.abs(along - q.along) < q.road)) waitsOnRoad++;
      }
    }
  });
  assert.ok(starts >= 20 && S.stats.crossed >= 20, "crossings: " + starts + " started, " + S.stats.crossed + " done");
  assert.ok(S.stats.waited >= 5, "waits at a red light: " + S.stats.waited);
  assert.equal(bad, 0, "crossings started on a red light");
  assert.equal(waitsOnRoad, 0, "people waiting on the road");
  assert.ok(walkOn("x", 1) !== walkOn("z", 1) && walkOn("x", 1) !== walkOn("x", 1 + STREET.light), "the two directions take turns, 14 s each");
});

test("some people stand (window, phone, talk) and then walk on", () => {
  const S = createStreet(city);
  run(S, 10, onStreet);
  const seen = new Map(), walkedOn = new Set(), kinds = new Set();
  run(S, 30, onStreet, null, S.time, () => {
    for (const p of out(S)) {
      if (p.state === "idle") { seen.set(p.id, true); kinds.add(p.pose); }
      else if (p.state === "walk" && seen.get(p.id)) walkedOn.add(p.id);
    }
  });
  assert.ok(walkedOn.size >= 5, "people who stood and walked on: " + walkedOn.size);
  assert.ok(kinds.has(POSE.stand) && kinds.has(POSE.phone) && kinds.has(POSE.talk), "stand, phone and talk all seen: " + [...kinds]);
});

test("a landing near people: they stop, face the hero and cheer", () => {
  const S = createStreet(city);
  run(S, 30, onStreet);
  const p0 = out(S).find((p) => p.state === "walk" && Math.hypot(p.x - onStreet.x, p.z - onStreet.z) < 60);
  assert.ok(p0, "a walker near the spot");
  const L = { x: p0.x + 9, y: 0, z: p0.z };
  const r = S.land(L.x, L.y, L.z, -6);
  assert.ok(r.cheer && r.n >= 1 && !r.gasp, "the landing is seen: " + JSON.stringify(r));
  run(S, 0.5, L, { x: L.x, y: 0, z: L.z, vx: 0, vy: 0, vz: 0, onGround: true });
  assert.equal(p0.state, "cheer");
  assert.equal(p0.pose, POSE.cheer);
  const want = Math.atan2(-(L.x - p0.x), -(L.z - p0.z)), d = Math.abs(Math.atan2(Math.sin(p0.yaw - want), Math.cos(p0.yaw - want)));
  assert.ok(d < 0.2, "faces the hero (off by " + d.toFixed(2) + " rad)");
  run(S, 5, L, { x: L.x, y: 0, z: L.z, vx: 0, vy: 0, vz: 0, onGround: true });
  assert.ok(p0.state === "walk" || p0.state === "idle" || p0.state === "wait", "walks on after: " + p0.state);
  // a landing high on a roof is not seen from the street
  const roof = S.land(L.x, 40, L.z, -6);
  assert.equal(roof.n, 0);
});

test("a hard landing next to a person: a jump back first, then the cheer, and a gasp", () => {
  const S = createStreet(city);
  run(S, 30, onStreet);
  const p0 = out(S).find((p) => p.state === "walk" && Math.hypot(p.x - onStreet.x, p.z - onStreet.z) < 60);
  const st = p0.strip, L = st.axis === "x" ? { x: p0.x, z: p0.z + 3 } : { x: p0.x + 3, z: p0.z };
  const d0 = Math.hypot(p0.x - L.x, p0.z - L.z);
  const r = S.land(L.x, 0, L.z, -15);
  assert.ok(r.gasp && r.fled >= 1, "a gasp: " + JSON.stringify(r));
  assert.equal(p0.state, "flee");
  const hero = { x: L.x, y: 0, z: L.z, vx: 0, vy: 0, vz: 0, onGround: true };
  run(S, 1.3, L, hero);
  const d1 = Math.hypot(p0.x - L.x, p0.z - L.z);
  assert.ok(d1 - d0 >= 1.8, "ran away " + (d1 - d0).toFixed(2) + " m");
  assert.equal(p0.state, "cheer");
  assert.ok(S.onWalk(p0), "still on the sidewalk");
});

test("a low fast swing over people: they look up and point", () => {
  const S = createStreet(city);
  run(S, 30, onStreet);
  const p0 = out(S).find((p) => p.state === "walk" && Math.hypot(p.x - onStreet.x, p.z - onStreet.z) < 60);
  const hero = { x: p0.x + 6, y: 10, z: p0.z, vx: 18, vy: 0, vz: 0, onGround: false };
  run(S, 0.5, onStreet, hero);
  assert.equal(p0.state, "look");
  assert.equal(p0.pose, POSE.look);
  // high over the street (60 m), nobody looks
  const S2 = createStreet(city);
  run(S2, 30, onStreet);
  const before = S2.stats.looks;
  run(S2, 1, onStreet, { x: onStreet.x, y: 60, z: onStreet.z, vx: 18, vy: 0, vz: 0, onGround: false });
  assert.equal(S2.stats.looks, before);
});

test("the hero walks into a person: the person steps aside", () => {
  const S = createStreet(city);
  run(S, 30, onStreet);
  const p0 = out(S).find((p) => p.state === "walk" && Math.hypot(p.x - onStreet.x, p.z - onStreet.z) < 60);
  const x0 = p0.x, z0 = p0.z;
  const hero = { x: p0.x + 0.3, y: 0, z: p0.z + 0.3, vx: 1, vy: 0, vz: 0, onGround: true };
  run(S, 0.1, onStreet, hero);
  assert.equal(p0.state, "aside");
  run(S, 0.5, onStreet, hero);
  assert.ok(Math.hypot(p0.x - hero.x, p0.z - hero.z) > Math.hypot(x0 - hero.x, z0 - hero.z), "moved away");
  assert.ok(S.onWalk(p0));
});

test("the crowd level: people near on the street, none on a high roof", () => {
  const S = createStreet(city);
  run(S, 30, onStreet);
  assert.ok(S.crowd > 0, "crowd on the street: " + S.crowd);
  run(S, 1, { ...onStreet, y: 60 });
  assert.equal(S.crowd, 0);
});

test("shop signs: boards and blades on the street floors, in neon, some flickering, none in a building or the road", () => {
  const S = createStreet(city);
  const sg = S.signs, boards = sg.filter((s) => s.kind === 0), blades = sg.filter((s) => s.kind === 1);
  assert.ok(boards.length >= 1000 && blades.length >= 400, "boards " + boards.length + ", blades " + blades.length);
  const flick = sg.filter((s) => s.flicker > 0).length / sg.length;
  assert.ok(flick > 0.07 && flick < 0.18, "flickering share " + flick.toFixed(3));
  assert.ok(NEON.every((c) => Math.max(...c) > 1.5), "neon colours go over 1 for the bloom");
  for (const b of blades) {
    assert.ok(b.y - b.h / 2 >= 3.5 && b.y + b.h / 2 <= 7.01, "blade from " + (b.y - b.h / 2) + " to " + (b.y + b.h / 2));
    // its outer end over the sidewalk, never inside a building
    const ox = b.x + Math.cos(b.yaw) * 0.7, oz = b.z - Math.sin(b.yaw) * 0.7;
    const ix = b.x - Math.cos(b.yaw) * 0.7, iz = b.z + Math.sin(b.yaw) * 0.7;
    assert.ok(!city.collideSphere(ox, b.y, oz, 0.1) || !city.collideSphere(ix, b.y, iz, 0.1), "blade sign inside a building at " + b.x + ", " + b.z);
  }
  // every sign hangs on a street floor that faces a street: a point 1.5 m out is in no building
  let inside = 0;
  for (const s of boards) { const ox = s.x + Math.sin(s.yaw) * 1.5, oz = s.z + Math.cos(s.yaw) * 1.5; if (city.collideSphere(ox, 2, oz, 0.2)) inside++; }
  assert.ok(inside / boards.length < 0.01, "boards facing a wall: " + inside);
  // the Market and Old Town have signs
  const dist = (s) => city.districtAt(s.x, s.z);
  assert.ok(sg.some((s) => dist(s) === 3) && sg.some((s) => dist(s) === 2) && sg.some((s) => dist(s) === 5), "Market, Old Town and Warehouse signs");
});

test("the frame costs little", () => {
  const S = createStreet(city);
  run(S, 5, onStreet);
  const t0 = performance.now();
  run(S, 20, onStreet, (t) => ({ x: onStreet.x + Math.sin(t) * 20, y: 8, z: onStreet.z, vx: 15, vy: 0, vz: 0, onGround: false }));
  const ms = (performance.now() - t0) / (20 / DT);
  assert.ok(ms < 0.5, ms.toFixed(3) + " ms a frame");
});

console.log(fails ? "FAIL: street (" + fails + " failed)" : "PASS: street");
process.exitCode = fails ? 1 : 0;
