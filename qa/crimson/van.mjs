// The VEHICLES package: the van, its doors and seats, the physics, the people rule, traffic and the drivers.
// - Enter and exit by the driver's door (E through S.interact) and the passenger's door; exit is refused
//   above 4 m/s; 40 seeded landing spots beside walls, parked vans and rails are never in a collider, a
//   vehicle or over a drop.
// - The autopilot drives Canyon Fleet to Slide Rock along roads.route in under 150 s, never more than 4 m
//   off the road and never under surface() - 0.2.
// - 200 seeded approaches at 28 m/s into boulders, buildings and bridge rails: no tunnelling (the van never
//   ends on the far side, never deep inside), speed and position finite.
// - 10 seats fill with seat(); only S0 and S1 show; damage 100 emits 'wrecked' once.
// - A person 20 m ahead at 20 m/s dives clear, or (when they cannot) the van stops: never closer than 0.8 m;
//   the hero's hp is unchanged.
// - A protected van takes 3 bumps at 2 m/s without failing and emits 'hitProtected' on a 7 m/s hit; with
//   maxContact 1 (E4) a 2 m/s touch emits it.
// - S.hitstop = 0.2 does not change the van's travelled distance over 1 s.
// - Traffic at Q2: 14 cars, kinematic beyond 72 m and full physics within 60 m (C7). A convoy keeps its
//   gaps and a pursuer lands side rams. The van's draw calls; the vehicles' CONTRACT members; no page errors.
// VAN_SHOT=/tmp/van.png saves a frame of the chase camera at the end.
import { open, step, stepUntil, finish, storyReady, shot, freeRoam } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const t0 = Date.now();

const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", width: 640, height: 360 });
const r = await storyReady(page, { maxSec: 60 });
check(r.ok, `the story is ready (${r.sec} s stepped)`);
await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 20 });
// leave the chapter's mission for free roam: nothing modal, Sedona showing
const roam = await freeRoam(page);
check(roam.ok, "free roam: playing, not frozen, Sedona showing");

const contract = await page.evaluate(() => __crimson.story.contract().filter((l) => /^S\.(vehicles|drive|traffic|drivers|test\.van)\b/.test(l)));
check(contract.length === 0, `S.vehicles, S.drive, S.traffic, S.drivers and S.test.van hold every CONTRACT member${contract.length ? ": " + contract.join(", ") : ""}`);

// traffic at Q2 (C2, C7), before the tests turn it off (cars come and go: wait for the full count)
await step(page, 3);
// (free roam sets the traffic density by region and hour once a second; the Q2 count is density 1: set it after)
await page.evaluate(() => __crimson.story.S.traffic.setDensity(1));
await stepUntil(page, () => __crimson.story.S.traffic.cars.length === 14, { maxSec: 12, realMs: 0 });
const tr = await page.evaluate(() => {
  const S = __crimson.story.S, H = S.hero.pos, cars = S.traffic.cars;
  const bad = cars.filter((v) => { const d = Math.hypot(v.pos.x - H.x, v.pos.z - H.z); return (d > 72 && !v.kinematic && S.time - v.contactT > 3) || (d < 60 && v.kinematic); });
  return { n: cars.length, kin: cars.filter((v) => v.kinematic).length, bad: bad.length, finite: cars.every((v) => Number.isFinite(v.pos.x + v.pos.y + v.pos.z + v.speed)) };
});
check(tr.n === 14 && tr.bad === 0 && tr.finite, `ambient traffic: ${tr.n} cars at Q2 (14), ${tr.kin} kinematic; beyond 72 m kinematic, within 60 m full physics`);
await page.evaluate(() => { const S = __crimson.story.S; S.traffic.setDensity(0); S.traffic.clear(); });

// shared helpers in the page
await page.evaluate(() => {
  window.__R = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  window.__ticks = (n) => { for (let k = 0; k < n; k++) __crimson.step(1 / 60, false); };
  const S = __crimson.story.S, p = S.world.roads.sample("a89w", 200, 1);
  window.__road = p;
  window.__van = S.vehicles.spawn("van", { pos: { x: p.x, z: p.z }, yaw: p.yaw, player: true });
  window.__out = () => { const S = __crimson.story.S; if (S.drive.riding) { S.drive.riding.speed = 0; if (!S.drive.exit()) { const v = S.drive.riding; v.setPose(window.__road.x, window.__road.z, window.__road.yaw); S.drive.exit(); } } };
  const d = window.__van.doorPoint("driver");
  S.hero.place(d.x + 1.2, d.z + 0.6);
});
await step(page, 0.3);

/* ---------------- enter and exit */
{
  const pick = await page.evaluate(() => { const S = __crimson.story.S; S.interact.update(S.hero); const c = S.interact.current; return c ? c.id : null; });
  await page.evaluate(() => __crimson.story.S.input.set({ use: true }));
  await step(page, 1 / 60);
  await page.evaluate(() => __crimson.story.S.input.clear());
  await step(page, 0.8);
  const a = await page.evaluate(() => { const S = __crimson.story.S, v = window.__van; return { riding: S.drive.riding === v, mode: S.hero.mode, seat: v.seats[0], cam: S.cameras.current && S.cameras.current.name }; });
  check(!!pick && /driver/.test(pick) && a.riding && a.mode === "drive" && a.seat === "hero" && a.cam === "drive", `E at the driver's door (${pick}) gets in: drive mode in S0, the chase camera (${a.cam})`);
  const b = await page.evaluate(() => {
    const S = __crimson.story.S, v = window.__van, spot = S.drive.exit(), d = v.doorPoint("driver"), p = { x: S.hero.pos.x, z: S.hero.pos.z };
    return { spot, mode: S.hero.mode, riding: !!S.drive.riding, dd: spot ? Math.hypot(spot.x - d.x, spot.z - d.z) : null, clear: spot ? !S.world.colliders.resolveCircle(p, 0.4, S.hero.pos.y) : false };
  });
  check(!!b.spot && b.spot.door === "driver" && b.dd < 3.2 && b.mode === "foot" && !b.riding && b.clear, `exit by the driver's door: on foot ${b.dd != null ? b.dd.toFixed(2) : "?"} m from it, clear of colliders`);
  await step(page, 0.8);
  const c = await page.evaluate(() => { const S = __crimson.story.S, v = window.__van; const ok = S.drive.enter(v, 1); return { ok, mode: S.hero.mode, seat: v.seats[1] }; });
  await step(page, 0.8);
  const c2 = await page.evaluate(() => {
    const S = __crimson.story.S, v = window.__van, spot = S.drive.exit(), d = v.doorPoint("passenger");
    return { spot, dd: spot ? Math.hypot(spot.x - d.x, spot.z - d.z) : null, mode: S.hero.mode, seat: v.seats[1] };
  });
  check(c.ok && c.mode === "passenger" && c.seat === "hero" && !!c2.spot && c2.spot.door === "passenger" && c2.dd < 3.2 && c2.mode === "foot" && c2.seat === null, `the passenger's door: in as a passenger in S1, out by the same door (${c2.dd != null ? c2.dd.toFixed(2) : "?"} m)`);
  await page.evaluate(() => { const S = __crimson.story.S; S.drive.enter(window.__van, 0); });
  await step(page, 0.8);
  await page.evaluate(() => __crimson.story.van.drive(1, 0, false, 3));
  await step(page, 3);
  const f = await page.evaluate(() => { const S = __crimson.story.S, sp = S.drive.riding.speed, spot = S.drive.exit(); return { sp, spot, riding: S.drive.riding === window.__van, mode: S.hero.mode }; });
  check(f.sp > 4 && f.spot === null && f.riding && f.mode === "drive", `exit refused at ${f.sp.toFixed(1)} m/s (over 4): still driving`);
  await page.evaluate(() => __crimson.story.van.drive(-1, 0, false, 1.3));
  await step(page, 2.5);
  const g = await page.evaluate(() => { const S = __crimson.story.S, sp = S.drive.riding ? S.drive.riding.speed : 99; const spot = S.drive.exit(); return { sp, spot }; });
  check(Math.abs(g.sp) < 4 && !!g.spot, `braked to ${g.sp.toFixed(2)} m/s: exit works`);
}

/* ---------------- landing spots beside walls, parked vans and rails */
{
  const res = await page.evaluate(() => {
    const S = __crimson.story.S, v = window.__van, C = S.world.colliders, W = S.world, R = window.__R(99);
    const boxes = new Set();
    for (const [x, z] of [[200, -90], [260, -120], [-470, 150], [-560, 90], [-300, 150], [150, 930]]) C.query(x, z, 60, (it) => { if (it.kind === "box" && it.tag === "building" && it.hw > 3 && it.hd > 3) boxes.add(it); });
    C.query(-620, 176, 25, (it) => { if (it.tag === "parked") boxes.add(it); });
    const B = [...boxes], tries = [];
    for (let i = 0; i < 26; i++) {
      const it = B[Math.floor(R() * B.length)], side = R() < 0.5 ? 1 : -1, along = (R() * 2 - 1) * Math.max(0, it.hd - 3), gap = 0.25 + R() * 0.35;
      const lx = side * (it.hw + 1.025 + gap);
      // the van's +x (its driver's side) toward the wall, running along it
      tries.push({ x: it.x + lx * it.c + along * it.s, z: it.z - lx * it.s + along * it.c, yaw: Math.atan2(-side * it.s, -side * it.c) });
    }
    const deck = W.roads.net.byId.a89c.spans.find((s) => s.id === "midgley");
    // on Midgley's deck and on the canyon road, pushed over to the rail (the deck's rails are 4.45 m out)
    for (let i = 0; i < 14; i++) {
      const onDeck = i < 8, s = onDeck ? deck.s0 + 15 + R() * (deck.s1 - deck.s0 - 30) : (R() < 0.5 ? 150 + R() * 140 : 460 + R() * 380), p = W.roads.sample("a89c", s, R() < 0.5 ? 1 : -1);
      const off = onDeck ? 0.85 : 0.6, fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      tries.push({ x: p.x - fz * off, z: p.z + fx * off, yaw: p.yaw, y: onDeck ? 62 : undefined });
    }
    const out = { n: 0, found: 0, bad: [] };
    for (const t of tries) {
      v.setPose(t.x, t.z, t.yaw, t.y);
      S.drive.enter(v, 0); window.__ticks(45);
      if (S.drive.riding !== v) continue;
      out.n++;
      const y0 = v.pos.y, spot = S.drive.exit();
      if (!spot) continue;
      out.found++;
      const gy = W.surface(spot.x, spot.z, y0 + 1.2), inCol = C.resolveCircle({ x: spot.x, z: spot.z }, 0.4, gy);
      const [lx, lz] = v.toLocal(spot.x, spot.z), inVan = Math.abs(lx) < v.hw + 0.3 && Math.abs(lz) < v.hd + 0.3, drop = Math.abs(gy - y0) > 1.4;
      if (inCol || inVan || drop) out.bad.push(`${spot.x.toFixed(1)},${spot.z.toFixed(1)}${inCol ? " in a collider" : ""}${inVan ? " in the van" : ""}${drop ? " over a drop" : ""}`);
    }
    window.__out();
    return out;
  });
  check(res.n >= 36 && res.found >= res.n - 4 && res.bad.length === 0, `landing spots: ${res.found} of ${res.n} seeded exits beside walls, parked vans and rails found room, none in a collider, a vehicle or over a drop${res.bad.length ? ": " + res.bad.slice(0, 4).join("; ") : ""}`);
}

/* ---------------- the autopilot: Canyon Fleet to Slide Rock */
{
  await page.evaluate(() => { const S = __crimson.story.S, v = window.__van; window.__out(); v.setPose(-620, 160, Math.PI); v.damage = 0; S.drive.enter(v, 0); });
  await step(page, 0.8);
  const ap = await page.evaluate(() => {
    const S = __crimson.story.S, route = S.world.roads.route("canyon_fleet", "slide_rock");
    let len = 0; for (let i = 1; i < route.length; i++) len += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
    S.drive.autopilot(true, route);
    window.__ap = { t: 0, off: 0, offAt: null, under: -1, underAt: null, done: false };
    return { len };
  });
  const goal = await page.evaluate(() => __crimson.story.S.world.place("slide_rock"));
  let stat = null;
  for (let chunk = 0; chunk < 40; chunk++) {
    stat = await page.evaluate(([gx, gz]) => {
      const S = __crimson.story.S, v = window.__van, A = window.__ap, W = S.world, list = W.roads.list;
      for (let k = 0; k < 300 && !A.done; k++) {
        __crimson.step(1 / 60, false); A.t += 1 / 60;
        const q = W.roads.nearest(v.pos.x, v.pos.z), road = list.find((x) => x.id === q.road), off = q.dist - (road ? road.width / 2 : 4);
        if (off > A.off) { A.off = off; A.offAt = [v.pos.x.toFixed(1), v.pos.z.toFixed(1), q.road]; }
        const under = W.surface(v.pos.x, v.pos.z) - 0.2 - v.pos.y;
        if (under > A.under) { A.under = under; A.underAt = [v.pos.x.toFixed(1), v.pos.z.toFixed(1)]; }
        // arrived: the autopilot stopped at the end of the route (the road by Slide Rock: the last hop to
        // the pools crosses the guardrail, so it ends on the road)
        if (S.drive.auto && S.drive.auto.done) { A.done = true; A.arrived = true; }
        if (A.t > 150) A.done = true;
      }
      return { t: A.t, done: A.done, arrived: !!A.arrived, off: A.off, offAt: A.offAt, under: A.under, underAt: A.underAt, dmg: v.damage, dist: Math.hypot(v.pos.x - gx, v.pos.z - gz), unstuck: S.drive.auto ? S.drive.auto.unstuck || 0 : -1 };
    }, [goal.x, goal.z]);
    if (stat.done) break;
  }
  check(stat.arrived && stat.t < 150 && stat.dist < 30, `autopilot: Canyon Fleet to Slide Rock (${ap.len.toFixed(0)} m by roads.route) in ${stat.t.toFixed(1)} s (under 150), stopped ${stat.dist.toFixed(1)} m from the pools, damage ${stat.dmg.toFixed(1)}`);
  check(stat.off <= 4, `autopilot: never more than 4 m off the road (worst ${stat.off.toFixed(2)} m${stat.offAt ? " at " + stat.offAt.join(",") : ""})`);
  check(stat.under <= 0, `autopilot: never under surface() - 0.2 (lowest ${(stat.under + 0.2).toFixed(3)} m under the surface${stat.underAt ? " at " + stat.underAt.join(",") : ""})`);
  await page.evaluate(() => { __crimson.story.S.drive.autopilot(false); window.__out(); });
}

/* ---------------- 200 seeded approaches at 28 m/s */
{
  await page.evaluate(() => {
    const S = __crimson.story.S, C = S.world.colliders, W = S.world;
    const rocks = new Set(), boxes = new Set();
    for (let gx = -900; gx <= 900; gx += 150) for (let gz = -900; gz <= 900; gz += 150) C.query(gx, gz, 80, (it) => {
      if (it.kind === "circle" && (it.tag === "rock" || it.tag === "boulder") && it.r >= 0.8 && it.r < 7) rocks.add(it);
      if (it.kind === "box" && it.tag === "building" && it.hw > 2.5 && it.hd > 2.5) boxes.add(it);
    });
    // a straight run-up on gentle, open, dry ground
    const clearRun = (x, z, fx, fz, len, rough = 0) => { let y0 = W.height(x, z); for (let d = 0; d <= len; d += 2) { const px = x + fx * d, pz = z + fz * d, h = W.height(px, pz); if (Math.abs(h - y0) > 2.2 + rough || W.normal(px, pz).y < 0.85 - rough * 0.1 || W.water(px, pz)) return false; let hit = false; C.query(px, pz, 2.5, () => { hit = true; return false; }); if (hit) return false; y0 = h; } return true; };
    const T = window.__tun = { R: window.__R(2024), RK: [...rocks], BX: [...boxes], deck: W.roads.net.byId.a89c.spans.find((s) => s.id === "midgley"), clearRun, i: 0, out: { n: 0, far: [], deep: 0, nonfinite: 0, hits: 0, kinds: { rock: 0, building: 0, rail: 0 }, skipped: 0 } };
    // one approach, of the kind run least so far; false when this try was skipped
    T.one = () => {
      const R = T.R, v = window.__van, out = T.out, k = out.kinds, kind = ["rail", "rock", "building"].reduce((a, b) => (k[b] < k[a] ? b : a));
      let start, yaw, y, test;
      if (kind === "rail") {
        // on Midgley's deck, 12 to 40 degrees toward a rail, far enough from the ends to meet it on the span
        const s = T.deck.s0 + 30 + R() * (T.deck.s1 - T.deck.s0 - 60), c = W.roads.sample("a89c", s, 0), side = R() < 0.5 ? 1 : -1, ang = (0.21 + R() * 0.49) * side;
        const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = -fz, rz = fx, sgn = ang < 0 ? 1 : -1; // a right turn (ang < 0) heads for the right rail
        start = { x: c.x, z: c.z }; yaw = c.yaw + ang; y = 62;
        test = { line: { x: c.x + rx * sgn * 4.45, z: c.z + rz * sgn * 4.45, nx: rx * sgn, nz: rz * sgn, ax: fx, az: fz, s0: (T.deck.s0 + 2 - s), s1: (T.deck.s1 - 2 - s), cx: c.x, cz: c.z } };
      } else if (kind === "rock") {
        const it = T.RK[Math.floor(R() * T.RK.length)], ang = R() * Math.PI * 2, fx = Math.sin(ang), fz = Math.cos(ang), d = it.r + 16;
        start = { x: it.x - fx * d, z: it.z - fz * d }; yaw = ang;
        if (!clearRun(start.x, start.z, fx, fz, d - it.r - 3.2, 1)) { out.skipped++; return false; }
        const j = (R() - 0.5) * 0.5; start.x += -fz * j; start.z += fx * j;
        test = { c: it };
      } else {
        // square on to one face of a building (skewed up to 26 degrees), anywhere along it
        const it = T.BX[Math.floor(R() * T.BX.length)], face = Math.floor(R() * 4);
        const lx = face === 0 ? it.hw : face === 1 ? -it.hw : (R() * 2 - 1) * (it.hw - 1), lz = face === 2 ? it.hd : face === 3 ? -it.hd : (R() * 2 - 1) * (it.hd - 1);
        const nlx = face === 0 ? 1 : face === 1 ? -1 : 0, nlz = face === 2 ? 1 : face === 3 ? -1 : 0;
        const px = it.x + lx * it.c + lz * it.s, pz = it.z - lx * it.s + lz * it.c, nx = nlx * it.c + nlz * it.s, nz = -nlx * it.s + nlz * it.c;
        const sk = (R() - 0.5) * 0.9, fx = -(nx * Math.cos(sk) - nz * Math.sin(sk)), fz = -(nx * Math.sin(sk) + nz * Math.cos(sk));
        start = { x: px - fx * 17, z: pz - fz * 17 }; yaw = Math.atan2(fx, fz);
        if (!clearRun(start.x, start.z, fx, fz, 13)) { out.skipped++; return false; }
        test = { plane: { x: px, z: pz, nx, nz }, box: it };
      }
      v.setPose(start.x, start.z, yaw, y); v.damage = 0; v.wrecked = false; v.speed = 28;
      S.test.van.drive(1, 0, false, 2.2);
      const side0 = test.line ? (start.x - test.line.x) * test.line.nx + (start.z - test.line.z) * test.line.nz : 0;
      const fin = () => Number.isFinite(v.pos.x + v.pos.y + v.pos.z + v.speed + v.yaw);
      let deep = false, hit = false, crossed = false;
      for (let k = 0; k < 120; k++) {
        __crimson.step(1 / 60, false);
        if (!fin()) break;
        if (S.time - v.contactT < 0.02) hit = true;
        // alongside the deck, the van's centre never crosses a rail and never drops off the deck
        if (test.line) {
          const L = test.line, a = (v.pos.x - L.cx) * L.ax + (v.pos.z - L.cz) * L.az;
          // (only where the canyon falls away under the deck: near the north abutment the world's terrain
          // rises through the deck's west edge, and a van on that bank is on the ground, not over the rail)
          const bank = W.height(v.pos.x, v.pos.z) > 60.5;
          if (a > L.s0 && a < L.s1 && !bank && !test.bank) { const sd = (v.pos.x - L.x) * L.nx + (v.pos.z - L.z) * L.nz; if (Math.sign(sd) !== Math.sign(side0) || v.pos.y < 60) crossed = true; }
          if (bank) test.bank = true;
        }
        // a van that flies over a low boulder off a crest is not in it: only count it while below the top
        const below = !test.c || v.pos.y + 0.3 < test.c.y1 - 0.05;
        if (test.c && !below && Math.hypot(v.pos.x - test.c.x, v.pos.z - test.c.z) < test.c.r + 3) test.over = true;
        if (test.c && below && Math.hypot(v.pos.x - test.c.x, v.pos.z - test.c.z) < test.c.r * 0.6) deep = true;
        if (test.box) { const dx = v.pos.x - test.box.x, dz = v.pos.z - test.box.z, lx = dx * test.box.c - dz * test.box.s, lz = dx * test.box.s + dz * test.box.c; if (Math.abs(lx) < test.box.hw - 0.2 && Math.abs(lz) < test.box.hd - 0.2) deep = true; }
      }
      out.n++; out.kinds[kind]++;
      if (!fin()) { out.nonfinite++; return true; }
      if (hit) out.hits++;
      if (deep) out.deep++;
      let far = false;
      if (test.c && !test.over) { const fx = Math.sin(yaw), fz = Math.cos(yaw); far = (v.pos.x - test.c.x) * fx + (v.pos.z - test.c.z) * fz > test.c.r && Math.hypot(v.pos.x - test.c.x, v.pos.z - test.c.z) < test.c.r + 4; }
      if (test.over) out.over = (out.over || 0) + 1;
      if (test.plane) far = (v.pos.x - test.plane.x) * test.plane.nx + (v.pos.z - test.plane.z) * test.plane.nz < -0.5;
      if (test.line) far = crossed;
      if (far || deep) out.far.push(`${kind}${deep ? " (deep)" : ""} at ${v.pos.x.toFixed(1)},${v.pos.z.toFixed(1)}${test.c ? ` r ${test.c.r.toFixed(2)} ${test.c.tag}` : ""} from ${start.x.toFixed(1)},${start.z.toFixed(1)} yaw ${yaw.toFixed(2)}`);
      return true;
    };
  });
  let res = null;
  for (let chunk = 0; chunk < 40; chunk++) {
    res = await page.evaluate(() => { const T = window.__tun; for (let k = 0; k < 400 && T.out.n < 200; k++) { if (T.one() && T.out.n % 20 === 0) break; } return T.out; });
    if (res.n >= 200) break;
  }
  await page.evaluate(() => __crimson.story.S.test.van.drive(0, 0, false, 0.01));
  check(res.n === 200 && res.nonfinite === 0, `200 seeded approaches at 28 m/s (rails ${res.kinds.rail}, boulders ${res.kinds.rock}, buildings ${res.kinds.building}; ${res.hits} hit something): speed and position stay finite`);
  check(res.far.length === 0 && res.deep === 0, `no tunnelling: the van never ends on the far side of a boulder, a building or a bridge rail, and never sinks into one${res.far.length ? ": " + res.far.slice(0, 5).join("; ") : ""}`);
}

/* ---------------- ten seats, and the wreck */
{
  const res = await page.evaluate(() => {
    const S = __crimson.story.S, v = window.__van, p = window.__road;
    v.setPose(p.x, p.z, p.yaw); v.damage = 0; v.wrecked = false;
    const actors = [];
    for (let i = 0; i < 10; i++) { const a = S.cast.spawn("gang", { pos: { x: p.x + 4, z: p.z + i } }); actors.push(a); S.drive.seat(a, v, i); }
    window.__ticks(10);
    const w = new S.THREE.Vector3();
    const full = v.seats.every((s, i) => s === actors[i]), shown = actors.map((a) => !!a.root.visible);
    // (the root, CAST's seat surface, sits 0.34 m above the seat node on the floor)
    const near = actors.every((a, i) => { const n = v.view.seats[i].getWorldPosition(w), d = a.root.position.distanceTo(n); return Math.hypot(a.root.position.x - n.x, a.root.position.z - n.z) < 0.08 && d > 0.28 && d < 0.4; });
    for (const a of actors) { S.drive.unseat(a); S.cast.despawn(a); }
    return { full, shown, near, empty: v.seats.every((s) => s === null), n: v.seats.length };
  });
  check(res.n === 10 && res.full && res.near && res.empty, "10 seats fill with seat(), each actor rides its seat node, and unseat() empties them");
  check(res.shown.every((s, i) => s === i < 2), `only S0 and S1 show through the glass (${res.shown.map((s) => (s ? 1 : 0)).join("")})`);
  const w = await page.evaluate(() => {
    const S = __crimson.story.S, v = window.__van, T = window.__tun, R = window.__R(5);
    // (read the van as the event fires: in free roam MISSIONS then tows a wrecked van home and repairs it)
    let wrecked = 0, at = null; const off = v.on("wrecked", () => { wrecked++; if (!at) at = { dmg: v.damage, flag: v.wrecked }; });
    v.damage = 0; v.wrecked = false;
    let hits = 0;
    for (let k = 0; k < 40 && !wrecked; k++) {
      const it = T.BX[Math.floor(R() * T.BX.length)], nx = it.c, nz = -it.s, px = it.x + it.hw * it.c, pz = it.z - it.hw * it.s;
      if (!T.clearRun(px + nx * 17, pz + nz * 17, -nx, -nz, 13)) continue;
      v.setPose(px + nx * 17, pz + nz * 17, Math.atan2(-nx, -nz)); v.speed = 28;
      S.test.van.drive(1, 0, false, 1.5); window.__ticks(90); hits++;
    }
    window.__ticks(30);
    off();
    return { wrecked, dmg: at ? at.dmg : v.damage, flag: at ? at.flag : v.wrecked, hits };
  });
  await stepUntil(page, () => { const S = __crimson.story.S; if (S.modal) S.ui.advanceAll(); return !S.lockControl && !S.modal; }, { maxSec: 6 }); // (the tow, if it ran)
  check(w.wrecked === 1 && w.flag && w.dmg === 100, `damage 100 emits 'wrecked' once (${w.hits} hits at 28 m/s; damage ${w.dmg.toFixed(1)})`);
  await page.evaluate(() => { const v = window.__van; v.damage = 0; v.wrecked = false; v.drowned = false; v.view.clearDents(); });
}

/* ---------------- people in the road */
{
  const res = await page.evaluate(() => {
    const S = __crimson.story.S, W = S.world, p = W.roads.sample("a89w", 90, 1), v = window.__van, hp0 = S.hero.hp;
    const run = (id, canDive) => {
      v.setPose(p.x, p.z, p.yaw); v.speed = 20;
      const f = [Math.sin(v.yaw), Math.cos(v.yaw)];
      const P = { id, x: p.x + f[0] * (v.hd + 20), z: p.z + f[1] * (v.hd + 20), r: 0.4, dove: 0, t: -1, dir: null, dive(dir) { if (!canDive) return false; if (P.t < 0) { P.t = 0; P.dir = dir; P.dove++; } return true; } };
      let minGap = Infinity, stopped = false;
      for (let k = 0; k < 240; k++) {
        S.test.van.drive(v.speed < 20 ? 1 : 0.02, 0, false, 0.05);
        S.vehicles.people.push(P);
        __crimson.step(1 / 60, false);
        if (P.t >= 0 && P.t < 0.4) { const d = 3.2 / 0.4 / 60; P.x += P.dir.x * d; P.z += P.dir.z * d; P.t += 1 / 60; }
        const [lx, lz] = v.toLocal(P.x, P.z), gx = Math.max(0, Math.abs(lx) - v.hw), gz = Math.max(0, Math.abs(lz) - v.hd);
        minGap = Math.min(minGap, Math.hypot(gx, gz));
        if (k > 30 && Math.abs(v.speed) < 0.3) stopped = true;
      }
      return { minGap, dove: P.dove, stopped, passed: v.toLocal(P.x, P.z)[1] < -v.hd };
    };
    const a = run("qa-walker-a", true), b = run("qa-walker-b", false);
    return { a, b, hp: S.hero.hp === hp0 };
  });
  check(res.a.dove === 1 && res.a.passed && res.a.minGap >= 0.8, `a walker 20 m ahead at 20 m/s dives clear and the van goes by (closest ${res.a.minGap.toFixed(2)} m)`);
  check(res.b.dove === 0 && res.b.stopped && res.b.minGap >= 0.8, `a walker who cannot dive is a soft wall: the van stops ${res.b.minGap.toFixed(2)} m short (0.8 at least)`);
  check(res.hp, "the hero's hp is unchanged");
}

/* ---------------- a protected van (P9) */
{
  const res = await page.evaluate(() => {
    const S = __crimson.story.S, W = S.world, v = window.__van, q = W.roads.sample("a89w", 312, 1), out = {};
    for (const [name, o] of [["rule", { protect: true, bumpLimit: 3 }], ["e4", { protect: true, maxContact: 1 }]]) {
      const pv = S.vehicles.spawn("whitevan", { pos: { x: q.x, z: q.z }, yaw: q.yaw, ...o });
      const ev = { bump: 0, hit: [], speeds: [] };
      pv.on("bump", (e) => { ev.bump++; ev.speeds.push(+e.speed.toFixed(2)); });
      pv.on("hitProtected", (e) => ev.hit.push(`${e.reason} ${e.speed.toFixed(1)}`));
      const ram = (speed) => {
        pv.setPose(q.x, q.z, q.yaw);
        const f = [Math.sin(q.yaw), Math.cos(q.yaw)], back = v.hd + pv.hd + 1.2;
        v.setPose(q.x - f[0] * back, q.z - f[1] * back, q.yaw);
        let touched = false;
        for (let k = 0; k < 90; k++) {
          if (!touched) { v.speed = speed; S.test.van.drive(0.0001, 0, false, 0.05); }
          __crimson.step(1 / 60, false);
          if (v.lastHit.has(pv.id) && S.time - v.lastHit.get(pv.id) < 0.05) touched = true;
        }
        window.__ticks(40); // past the bump gap
        return touched;
      };
      const t = [];
      if (name === "rule") { for (let i = 0; i < 3; i++) t.push(ram(2)); out.afterBumps = ev.hit.length; t.push(ram(7)); }
      else t.push(ram(2));
      out[name] = { ...ev, touched: t };
      S.vehicles.despawn(pv);
    }
    return out;
  });
  check(res.rule.bump === 3 && res.afterBumps === 0 && res.rule.touched.every(Boolean), `a protected van takes 3 bumps at 2 m/s (at ${res.rule.speeds.join(", ")} m/s) without 'hitProtected'`);
  check(res.rule.hit.length >= 1 && /^hard/.test(res.rule.hit[0]), `then a 7 m/s hit emits 'hitProtected' (${res.rule.hit.join("; ")})`);
  check(res.e4.hit.length === 1 && /^contact/.test(res.e4.hit[0]), `E4: with maxContact 1, a 2 m/s touch emits 'hitProtected' (${res.e4.hit.join("; ")})`);
}

/* ---------------- hitstop never reaches vehicles */
{
  const res = await page.evaluate(() => {
    const S = __crimson.story.S, v = window.__van, p = S.world.roads.sample("a89w", 420, 1);
    const run = (hs) => {
      v.setPose(p.x, p.z, p.yaw); v.speed = 15;
      S.test.van.drive(0.5, 0, false, 5);
      window.__ticks(6);
      const x0 = v.pos.x, z0 = v.pos.z;
      if (hs) S.hitstop = 0.2;
      window.__ticks(60);
      S.hitstop = 0;
      return Math.hypot(v.pos.x - x0, v.pos.z - z0);
    };
    return { a: run(false), b: run(true) };
  });
  check(res.a > 10 && Math.abs(res.a - res.b) < 1e-6, `S.hitstop = 0.2 leaves the van's distance over 1 s unchanged (${res.a.toFixed(4)} m and ${res.b.toFixed(4)} m)`);
}

/* ---------------- drivers: a convoy keeps its gaps; a pursuer rams */
{
  const res = await page.evaluate(() => {
    const S = __crimson.story.S, W = S.world;
    const a = W.roads.sample("a89w", 520, 1), b = W.roads.sample("a89w", 500, 1), c = W.roads.sample("a89w", 480, 1);
    const L = [["suv", a], ["whitevan", b], ["pickup", c]].map(([k, p]) => S.vehicles.spawn(k, { pos: { x: p.x, z: p.z }, yaw: p.yaw }));
    const h = S.drivers.convoy(L, "y_roundabout", { gap: 18, speed: 14 });
    let minGap = Infinity, maxGap = 0;
    for (let k = 0; k < 60 * 22; k++) {
      __crimson.step(1 / 60, false);
      if (k > 60 * 8) for (let i = 1; i < 3; i++) { const g = Math.hypot(L[i].pos.x - L[i - 1].pos.x, L[i].pos.z - L[i - 1].pos.z); minGap = Math.min(minGap, g); maxGap = Math.max(maxGap, g); }
    }
    const moved = Math.hypot(L[0].pos.x - a.x, L[0].pos.z - a.z);
    h.stop();
    // a pursuer with side rams on a target driving away
    const target = L[0], chaser = L[2];
    S.drivers.route(target, W.roads.route({ x: target.pos.x, z: target.pos.z }, "y_roundabout"), { speed: 12 });
    const ph = S.drivers.pursue(chaser, target, { ram: true });
    for (let k = 0; k < 60 * 20 && ph.hits < 1; k++) __crimson.step(1 / 60, false);
    const hits = ph.hits;
    ph.stop();
    for (const v of L) S.vehicles.despawn(v);
    return { minGap, maxGap, moved, hits };
  });
  check(res.moved > 150 && res.minGap > 9 && res.maxGap < 30, `a convoy of three drives on (${res.moved.toFixed(0)} m) keeping its 18 m gaps (${res.minGap.toFixed(1)} to ${res.maxGap.toFixed(1)} m)`);
  check(res.hits >= 1, `a pursuer lands a side ram (${res.hits})`);
}

/* ---------------- the van's draw calls, and a look */
{
  const d = await page.evaluate(() => { const S = __crimson.story.S, v = window.__van, p = S.world.roads.sample("a89w", 200, 1); v.setPose(p.x, p.z, p.yaw); S.drive.enter(v, 0); let n = 0; v.view.obj.traverse((o) => { if (o.isMesh && o.visible) n++; }); return n; });
  await step(page, 1.2);
  await step(page, 1 / 60, { draw: true });
  if (process.env.VAN_SHOT) await shot(page, process.env.VAN_SHOT);
  const info = await page.evaluate(() => { const i = __crimson.story.world.info(); return { calls: i.calls, tris: i.triangles }; });
  check(d <= 24, `the van draws in ${d} meshes (24 at most); the frame: ${info.calls} calls, ${Math.round(info.tris / 1000)}k triangles`);
}

console.log(`     ${((Date.now() - t0) / 1000).toFixed(0)} s`);
await finish("van", fails, browser, errors);
