// The WORLD package (Sedona): terrain, roads, places, colliders, interiors, water, map and budgets.
// - The generator is deterministic: two runs in Node give the same heights, and the page's worker agrees.
// - 500 seeded points give finite heights and unit normals; the Midgley deck is 62 m and the wash below it
//   keeps its own height; inside the Rattlesnake Room the floor is -300 (C3).
// - Every road holds its grade (asphalt <= 9 %, dirt <= 14 %); every place resolves and is reachable from
//   Canyon Fleet by the road graph with a finite length; every kazoo is on dry, walkable, open ground.
// - The worker builds Sedona in under 2.5 s; ticks that stream tiles and refill flora never block over 50 ms
//   (long-task observer), and each assembly slice stays under 50 ms.
// - Draw budgets at 6 viewpoints: the world's draws <= 45 at Q2 and <= 30 at Q1 (terrain, flora, town,
//   water and bridges, counted as three.js culls them).
// - Colliders, roads, surface types, water, the map, the ranch lights (no new programs), the doors and
//   30 s of walking inside the bar all behave; the world palette passes the neon test; S.world holds every
//   CONTRACT member; no page errors.
import { open, step, stepUntil, finish, storyReady, canvasRGBA, freeRoam } from "./lib.mjs";

const fails = [];
const check = (ok, msg) => { if (ok) console.log("ok   " + msg); else { console.log("FAIL " + msg); fails.push(msg); } };
const G = await import(new URL("../../public/crimson/js/story/world/gen.worker.js", import.meta.url).href);
const T = await import(new URL("../../public/crimson/js/story/types.js", import.meta.url).href);
const SED = await import(new URL("../../public/crimson/js/story/world/places.js", import.meta.url).href);

/* ---------------- Node: the generator on its own */
const hashH = (H) => { let h = 2166136261; for (let i = 0; i < H.length; i += 7) { h ^= Math.round(H[i] * 100); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const t0 = Date.now(), g1 = G.generate(51), nodeMs = Date.now() - t0, g2 = G.generate(51);
const nodeHash = hashH(g1.H);
check(nodeHash === hashH(g2.H), `the generator is deterministic (hash ${nodeHash.toString(16)}, ${nodeMs} ms in Node)`);

/* ---------------- the page at Q2 */
const QA_CAM = () => {
  const S = __crimson.story.S;
  if (!window.__qaCam) {
    window.__qaCam = { on: false, pos: [0, 0, 0], look: [0, 0, 0] };
    S.cameras.add("qa", 99, () => window.__qaCam.on, () => { const c = window.__qaCam; S.camera.position.set(...c.pos); S.camera.lookAt(...c.look); });
  }
};
// six viewpoints: Uptown, the Y, the bridge, the canyon, Airport Mesa, West Sedona
const VIEWS = [[160, -30, 1.7, 230, -90], [20, 70, 3, 60, 40], [470, -470, 2, 430, -510], [520, -760, 6, 500, -600], [-150, 215, 2, -240, 310], [-420, 125, 2, -620, 150]];
async function draws(page, q) {
  const out = [];
  for (const [x, z, h, lx, lz] of VIEWS) {
    await page.evaluate(([x, z, h, lx, lz]) => { const S = __crimson.story.S, W = S.world, c = window.__qaCam; c.on = true; c.pos = [x, W.surface(x, z) + h, z]; c.look = [lx, W.surface(lx, lz) + 1.5, lz]; S.focus.set(x, W.surface(x, z), z); }, [x, z, h, lx, lz]);
    for (let k = 0; k < 10; k++) { await step(page, 0.05); await page.waitForTimeout(50); }
    await step(page, 1 / 60, { draw: true });
    out.push(await page.evaluate(() => { const i = __crimson.story.world.info(); return { d: i.draws, calls: i.calls }; }));
  }
  const worst = out.reduce((a, b) => (b.d.total > a.d.total ? b : a));
  console.log(`     Q${q} world draws per view: ${out.map((o) => o.d.total).join(", ")}; scene calls ${out.map((o) => o.calls).join(", ")}; triangles ${out.map((o) => Math.round(o.d.triangles / 1000) + "k").join(", ")}`);
  return worst.d.total;
}

{
  const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=2", width: 640, height: 360 });
  // long tasks, from the start
  await page.evaluate(() => { window.__long = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push({ t: e.startTime, d: e.duration }); }).observe({ type: "longtask", buffered: true }); } catch (e) { window.__long = null; } });
  const r = await storyReady(page, { maxSec: 60 });
  check(r.ok, `the world is ready (${r.sec} s stepped)`);
  await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 20 });
  // free roam, and a second for the crew to join the hero (the first body with neon inks its mask once, a
  // one-off cast cost that is not the world's streaming)
  check((await freeRoam(page)).ok, "free roam: F1's mission quit, nothing modal");
  await step(page, 1);
  const info = await page.evaluate(() => __crimson.story.world.info());
  check(info.build.worker > 0 && info.build.worker < 2500, `the worker builds Sedona in ${info.build.worker} ms (< 2500; heights ${info.build.gen.heights} ms, roads ${info.build.gen.roads} ms)`);
  check(info.build.longest < 50, `every assembly slice on the main thread is under 50 ms (longest ${info.build.longest} ms; steps ${info.build.steps.map(([n, ms]) => n + " " + ms).join(", ")})`);
  const pageHash = await page.evaluate(() => { const H = __crimson.story.world.parts.flora.heightTex.image.data; return H.length; });
  const same = await page.evaluate((nodeSamples) => { const W = __crimson.story.S.world; return nodeSamples.every(([x, z, h]) => Math.abs(W.height(x, z) - h) < 1e-3); }, [[0, 0], [430, -510], [-620, 172], [815, -760], [-900, 900], [123.4, -567.8]].map(([x, z]) => [x, z, G.heightAt(g1.H, x, z)]));
  check(same && pageHash === 401 * 401, "the page's worker built the same heights as Node");

  const core = await page.evaluate(async () => {
    const S = __crimson.story.S, W = S.world, out = {};
    // 500 seeded points
    let a = 7; const R = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let bad = 0; const n = new S.THREE.Vector3();
    for (let i = 0; i < 500; i++) { const x = (R() * 2 - 1) * 999, z = (R() * 2 - 1) * 999, h = W.height(x, z); W.normal(x, z, n); if (!Number.isFinite(h) || !Number.isFinite(n.x + n.y + n.z) || Math.abs(n.length() - 1) > 1e-4 || n.y <= 0) bad++; }
    out.badPoints = bad;
    out.deck = W.surface(430, -510); out.deckS = W.place("p9_bridge_block").y;
    out.wash = W.surface(415, -505, 35); out.washH = W.height(415, -505); out.washPlace = W.place("wash").y;
    out.bar = W.surface(-900, 900, -299); out.barTerrain = W.height(-900, 900);
    // grades along every road, 10 m windows every 5 m, off the bridge spans
    const net = W.roads.net, worst = [];
    const at = (r, s) => { const L = r.len; s = Math.max(0, Math.min(L, s)); let lo = 0, hi = r.line.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.cum[m] <= s) lo = m; else hi = m; } const p = r.line[lo], q = r.line[hi], k = (s - r.cum[lo]) / ((r.cum[hi] - r.cum[lo]) || 1); return { x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k }; };
    for (const r of net.roads) {
      let w = 0, ws = 0;
      for (let s = 0; s + 10 <= r.len; s += 5) {
        if (r.spans.some((sp) => s + 10 > sp.s0 - 1 && s < sp.s1 + 1)) continue;
        const p = at(r, s), q = at(r, s + 10), gp = W.surface(p.x, p.z, W.height(p.x, p.z) + 1), gq = W.surface(q.x, q.z, W.height(q.x, q.z) + 1), gr = Math.abs(gq - gp) / 10;
        if (gr > w) { w = gr; ws = s; }
      }
      worst.push({ id: r.id, surface: r.surface, grade: w, at: ws });
    }
    out.grades = worst;
    // places and routes
    const P = await import(new URL("js/story/world/places.js", location.href).href);
    out.badPlaces = P.ALL_POINT_IDS.filter((id) => { const p = W.place(id); return !p || !Number.isFinite(p.x + p.y + p.z + p.yaw + p.r); });
    out.routes = Object.keys(P.PLACES).map((id) => { const r = W.roads.route("canyon_fleet", id), L = S.test.world.routeLen("canyon_fleet", id); return { id, n: r.length, L }; });
    // kazoos: dry, walkable, not inside anything solid
    out.badKazoos = P.KAZOOS.map((k) => { const y = W.surface(k.x, k.z), nn = W.normal(k.x, k.z); let solid = null; W.colliders.query(k.x, k.z, 0.4, (it) => { if (it.kind !== "volume" && !(it.kind === "box" && it.walk)) solid = it.tag || it.kind; }); const why = !Number.isFinite(y) ? "no ground" : W.water(k.x, k.z) ? "water" : nn.y < 0.72 ? "steep " + nn.y.toFixed(2) : solid ? "inside " + solid : ""; return why ? `${k.id} (${why})` : null; }).filter(Boolean);
    // patrol loops and spawn points stand on open ground (not in a building, not in the creek)
    const blocked = (x, z, r) => { let b = null; W.colliders.query(x, z, r, (it) => { if (it.kind === "box" && !it.walk && it.tag !== "parked") b = it.tag || "box"; }); return b || (W.water(x, z) ? "water" : null); };
    out.badPatrols = Object.entries(P.PATROLS).flatMap(([id, pts]) => pts.map((p, i) => { const b = blocked(p.x, p.z, 0.5); return b ? `${id}[${i}] ${b}` : null; })).filter(Boolean);
    // (f4_van_creek is in the creek on purpose: the van is nose-down in Oak Creek)
    out.badSpawns = Object.entries(P.SPAWNS).map(([id, p]) => { const b = blocked(p.x, p.z, 0.4); return b && !(id === "f4_van_creek" && b === "water") ? `${id} ${b}` : null; }).filter(Boolean);
    out.vanInCreek = !!W.water(P.SPAWNS.f4_van_creek.x, P.SPAWNS.f4_van_creek.z);
    // surface types
    const q = (x, z) => W.surfaceType(x, z);
    out.types = { a89w: q(-380, 110), fr9: q(670, -708), creek: q(-116, 458), wash: q(340, -524) };
    // coverage over a 20 m lattice, and rock on Cathedral Rock
    const cov = {}; let nc = 0;
    for (let x = -990; x < 1000; x += 20) for (let z = -990; z < 1000; z += 20) { const t = q(x, z); cov[t] = (cov[t] || 0) + 1; nc++; }
    for (const k of Object.keys(cov)) cov[k] = Math.round(cov[k] / nc * 1000) / 10;
    out.cover = cov;
    let rk = 0; for (let a = 0; a < 64; a++) for (const r of [30, 45, 60]) if (q(-182 + Math.cos(a / 10) * r, 640 + Math.sin(a / 10) * r) === "rock") rk++;
    out.cathedralRock = rk;
    out.water = { creek: W.water(-116, 458), dry: W.water(225, -95) };
    // roads api
    const nr = W.roads.nearest(-380, 110), sp = W.roads.sample("a89w", 300, 1), c = W.roads.sample("a89w", 300, 0);
    out.roads = { nearest: nr.road, dist: nr.dist, laneOff: Math.hypot(sp.x - c.x, sp.z - c.z), lanes: W.roads.lanes.length, limit: W.roads.speedLimit(-380, 110), roadDist: W.roadDist(-380, 110) };
    // colliders
    const B = P.BUILDINGS[0], p = { x: B.x, z: B.z }, y = W.height(B.x, B.z);
    const hit = W.colliders.resolveCircle(p, 0.4, y);
    const cc = Math.cos(B.yaw), ss = Math.sin(B.yaw), lx = (p.x - B.x) * cc - (p.z - B.z) * ss, lz = (p.x - B.x) * ss + (p.z - B.z) * cc;
    out.pushOut = hit && (Math.abs(lx) >= B.w / 2 + 0.35 || Math.abs(lz) >= B.d / 2 + 0.35);
    const ray = W.colliders.raycast({ x: B.x - 40, y: y + 2, z: B.z }, { x: B.x + 40, y: y + 2, z: B.z });
    out.ray = ray;
    const f = P.PLACES.canyon_fleet, obb = W.colliders.resolveOBB({ x: f.x - 17, z: f.z + 4, hw: 1.2, hd: 3, yaw: Math.PI, y: W.height(f.x - 17, f.z + 4), h: 2 });
    out.obb = obb;
    // map
    const v0 = W.mapVersion; W.reveal("hart_ranch");
    out.map = { w: W.mapImage.width, h: W.mapImage.height, uv: W.toMap(0, 0), revealed: W.revealed.has("hart_ranch"), redrawn: W.mapVersion > v0 };
    out.group = W.group.parent === S.scene && !!W.group.visible;
    out.regions = [W.regionAt(-560, 100), W.regionAt(470, -500), W.regionAt(815, -760)];
    return out;
  });
  const contract = await page.evaluate(async () => { const T = await import(new URL("js/story/types.js", location.href).href); return T.checkContract(__crimson.story.S).filter((l) => /S\.(world|test\.world)\b/.test(l)); });
  check(contract.length === 0, `S.world holds every CONTRACT member${contract.length ? ": " + contract.join("; ") : ""}`);
  check(core.badPoints === 0, `500 seeded points have finite heights and unit normals (${core.badPoints} bad)`);
  check(Math.abs(core.deck - 62) <= 0.3 && Math.abs(core.deckS - 62) <= 0.3, `the Midgley deck surface is 62 +- 0.3 (${core.deck.toFixed(2)}, p9_bridge_block ${core.deckS.toFixed(2)})`);
  check(Math.abs(core.wash - core.washH) < 0.01 && core.wash < 40 && Math.abs(core.washPlace - core.washH) < 0.01, `in Wilson Canyon the surface is the wash (${core.wash.toFixed(2)} = ground ${core.washH.toFixed(2)}; place 'wash' ${core.washPlace.toFixed(2)})`);
  check(core.bar === -300 && core.barTerrain > -100, `inside the Rattlesnake Room the floor is -300 (surface ${core.bar}; the terrain above is ${core.barTerrain.toFixed(1)})`);
  const badGrades = core.grades.filter((g) => g.grade > (g.surface === "dirt" ? 0.14 : 0.09));
  check(badGrades.length === 0, `every road holds its grade (${core.grades.length} roads; steepest asphalt ${(Math.max(...core.grades.filter((g) => g.surface === "asphalt").map((g) => g.grade)) * 100).toFixed(1)} %, dirt ${(Math.max(...core.grades.filter((g) => g.surface === "dirt").map((g) => g.grade)) * 100).toFixed(1)} %)${badGrades.length ? ": " + badGrades.map((g) => `${g.id} ${(g.grade * 100).toFixed(1)}% at ${g.at}`).join("; ") : ""}`);
  check(core.badPlaces.length === 0, `every place, spawn and cairn resolves (${SED.ALL_POINT_IDS.length})${core.badPlaces.length ? ": " + core.badPlaces.join(", ") : ""}`);
  const badRoutes = core.routes.filter((r) => r.n < 2 || !Number.isFinite(r.L));
  check(badRoutes.length === 0, `every place is reachable from canyon_fleet by the road graph (${core.routes.length}; longest ${Math.max(...core.routes.map((r) => r.L)).toFixed(0)} m)${badRoutes.length ? ": " + badRoutes.map((r) => r.id).join(", ") : ""}`);
  check(core.badKazoos.length === 0, `all 51 kazoos lie on dry, walkable, open ground${core.badKazoos.length ? ": " + core.badKazoos.join(", ") : ""}`);
  check(core.badPatrols.length === 0 && core.badSpawns.length === 0 && core.vanInCreek, `patrol points and spawns stand on open ground (and f4_van_creek is in the creek)${core.badPatrols.length + core.badSpawns.length ? ": " + [...core.badPatrols, ...core.badSpawns].join(", ") : ""}`);
  const ty = core.types;
  check(ty.a89w === "asphalt" && ty.fr9 === "dirt" && ty.creek === "water" && ty.wash === "sand", `surface types on 89A, FR 9, the creek and the wash: ${Object.values(ty).join(", ")}`);
  check(core.cover.scrub > 30 && core.cover.rock > 3 && core.cover.water > 0.3 && core.cathedralRock > 40, `surface cover (%): ${JSON.stringify(core.cover)}; Cathedral Rock is rock (${core.cathedralRock}/192)`);
  check(!!core.water.creek && core.water.creek.depth > 0.2 && core.water.dry === null, `water(): the creek is ${core.water.creek ? core.water.creek.depth.toFixed(2) : "?"} m deep; Uptown is dry`);
  const rd = core.roads;
  check(rd.nearest === "a89w" && rd.dist < 3 && Math.abs(rd.laneOff - 2.6) < 0.05 && rd.lanes > 30 && rd.limit === 16 && rd.roadDist < 3, `roads: nearest ${rd.nearest} at ${rd.dist.toFixed(2)} m, lane offset ${rd.laneOff.toFixed(2)} m, ${rd.lanes} lanes, limit ${rd.limit} m/s`);
  check(core.pushOut && core.ray != null && core.ray > 0 && core.ray < 1 && core.obb && core.obb.depth > 0, `colliders: a walker is pushed out of a building, a ray hits it (t ${core.ray && core.ray.toFixed(3)}), a van footprint overlaps a parked van (depth ${core.obb && core.obb.depth.toFixed(2)})`);
  const m = core.map;
  check(m.w === 1024 && m.h === 1024 && m.uv[0] === 0.5 && m.uv[1] === 0.5 && m.revealed && m.redrawn, `the map is a 1024 canvas; toMap(0,0) is the centre; reveal inks a place in`);
  check(core.group, "the Sedona group hangs off the scene, never the arena");
  check(core.regions.join() === "west,canyon,ranch", `regions: ${core.regions.join(", ")}`);

  // the world palette against the neon test (display colours at three exposures)
  const neonOf = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / (mx + 0.02), s = (a, b, v) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); }; return Math.min(1, Math.max(0, s(0.82, 1.02, g / (r + 0.03)) * s(0.12, 0.4, g - b) * s(0.35, 0.6, sat) * s(0.18, 0.4, g))); };
  const SEDONA = await import(new URL("../../public/crimson/js/story/world/sedona.js", import.meta.url).href).catch(() => null);
  const pal = SEDONA ? SEDONA.WORLD_PALETTE : await page.evaluate(async () => (await import(new URL("js/story/world/sedona.js", location.href).href)).WORLD_PALETTE);
  const neon = [];
  for (const [name, c] of Object.entries(pal)) for (const e of [0.5, 1, 1.6]) { const v = neonOf(c.map((x) => Math.min(1, x * e))); if (v > 0.05) neon.push(`${name}@${e}=${v.toFixed(2)}`); }
  check(neon.length === 0, `the world palette passes the neon test at 3 exposures (${Object.keys(pal).length} colours)${neon.length ? ": " + neon.join(", ") : ""}`);

  // streaming: ticks as separate tasks (no drawing) while the camera jumps round the map; no long task
  await page.evaluate(QA_CAM);
  await page.evaluate(() => { window.__long && (window.__long.length = 0); });
  let worstTick = 0;
  for (const [x, z] of [[-800, -600], [800, 800], [-700, 700], [700, -900], [0, 0]]) {
    await page.evaluate(([x, z]) => { const S = __crimson.story.S, W = S.world, c = window.__qaCam; c.on = true; c.pos = [x, W.surface(x, z) + 30, z]; c.look = [x + 50, W.surface(x, z), z + 50]; }, [x, z]);
    for (let k = 0; k < 24; k++) {
      const ms = await page.evaluate(() => { const t = performance.now(); __crimson.step(1 / 60, false); return performance.now() - t; });
      worstTick = Math.max(worstTick, ms);
      await page.waitForTimeout(25);
    }
  }
  const longs = await page.evaluate(() => window.__long);
  const pend = await page.evaluate(() => __crimson.story.world.parts.terrain.pending);
  check(longs !== null && longs.filter((l) => l.d > 50).length === 0 && worstTick < 50, `streaming tiles and flora never blocks over 50 ms (worst tick ${worstTick.toFixed(1)} ms; long tasks ${longs ? longs.length : "n/a"}; ${pend} tile requests pending)`);

  // draw budgets at Q2
  const q2 = await draws(page, 2);
  check(q2 <= 45, `Q2: the world draws at most ${q2} (<= 45) at 6 viewpoints`);

  // the ranch lights change no programs
  const prog = await page.evaluate(async () => {
    const S = __crimson.story.S, W = S.world, c = window.__qaCam; c.on = true; c.pos = [785, W.surface(785, -858) + 2, -858]; c.look = [815, W.surface(815, -760), -760];
    S.look.set("NIGHT"); for (let i = 0; i < 20; i++) __crimson.step(1 / 60, false); __crimson.draw(1);
    const p0 = S.renderer.info.programs.length;
    W.ranch.lights(false); __crimson.step(1 / 60, false); __crimson.draw(1); W.ranch.lights(true); __crimson.step(1 / 60, false); __crimson.draw(1);
    return [p0, S.renderer.info.programs.length, W.ranch.on];
  });
  check(prog[0] === prog[1] && prog[2] === true, `the ranch lights toggle without new programs (${prog[0]} -> ${prog[1]})`);
  // at night, with no gang in view, the ink keeps almost nothing neon (the town's windows glow warm, not green)
  const neonShare = [];
  for (const [x, z, h, lx, lz] of [[160, -30, 1.7, 230, -90], [470, -470, 2, 430, -510], [785, -858, 2, 815, -760], [60, 60, 30, 225, -95]]) {
    await page.evaluate(([x, z, h, lx, lz]) => { const S = __crimson.story.S, W = S.world, c = window.__qaCam; c.on = true; c.pos = [x, W.surface(x, z) + h, z]; c.look = [lx, W.surface(lx, lz) + 1.5, lz]; for (let i = 0; i < 12; i++) __crimson.step(1 / 60, false); }, [x, z, h, lx, lz]);
    const img = await canvasRGBA(page, async () => __crimson.draw(1));
    let n = 0; const d = img.data; for (let i = 0; i < d.length; i += 4) if (d[i + 1] > 90 && d[i + 1] > d[i] * 1.15 && d[i + 1] > d[i + 2] * 1.8) n++;
    neonShare.push(n / (img.width * img.height) * 100);
  }
  check(neonShare.every((p) => p < 0.3), `night: neon pixels under 0.3 % at 4 views (${neonShare.map((p) => p.toFixed(3)).join(", ")} %)`);
  await page.evaluate(() => __crimson.story.S.look.set("DAY"));

  // doors, the interior and 30 s of walking inside the bar
  const inside = await page.evaluate(async () => {
    const S = __crimson.story.S, W = S.world, c = window.__qaCam; c.on = false;
    const sp = W.interiors.enter("rattlesnake_room");
    S.hero.pos.y = sp.y; S.hero.place(sp.x, sp.z, sp.yaw);
    const I = { x0: -912, x1: -888, z0: 892, z1: 908 };
    let out = 0, a = 3;
    const R = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    for (let i = 0; i < 30 * 60; i++) {
      if (i % 90 === 0) S.input.set({ move: { x: R() * 2 - 1, y: R() * 2 - 1 } });
      __crimson.step(1 / 60, false);
      const p = S.hero.pos;
      if (p.x < I.x0 || p.x > I.x1 || p.z < I.z0 || p.z > I.z1 || Math.abs(p.y + 300) > 0.01) out++;
    }
    S.input.set({ move: { x: 0, y: 0 } }); S.input.clear();
    const ex = W.interiors.exit("rattlesnake_room"), wall = W.interiors.wall("airstream");
    // a camera ray inside the bar ignores the ground 350 m above; outdoors a ray under a hill hits it
    const rayIn = W.colliders.raycast({ x: -905, y: -298.4, z: 896 }, { x: -895, y: -298.4, z: 896 });
    const gy = W.height(0, 0), rayOut = W.colliders.raycast({ x: -20, y: gy + 2, z: 0 }, { x: 20, y: gy - 6, z: 0 });
    return { sp, out, ex, rayIn, rayOut, wallOk: !!wall && wall.isMesh, room: W.interiors.roomAt(S.hero.pos.x, S.hero.pos.y, S.hero.pos.z) };
  });
  check(inside.sp && Math.abs(inside.sp.y + 300) < 0.01 && inside.out === 0 && inside.room === "rattlesnake_room", `the hero walks 30 s inside the Rattlesnake Room and never leaves it (${inside.out} ticks outside)`);
  check(inside.ex && Math.hypot(inside.ex.x - SED.PLACES.rattlesnake_room.x, inside.ex.z - SED.PLACES.rattlesnake_room.z) < 3 && inside.ex.y > 0 && inside.wallOk, `the bar's door leads back to Uptown; the Airstream's evidence wall is a mesh`);
  check(inside.rayIn === null && inside.rayOut != null && inside.rayOut > 0 && inside.rayOut < 1, `raycast ignores the ground inside the bar (${inside.rayIn}) and hits it outdoors (t ${inside.rayOut && inside.rayOut.toFixed(2)})`);
  check(errors.length === 0, `no page errors at Q2${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
  await browser.close();
}

/* ---------------- the page at Q1: the tighter draw budget */
{
  const { browser, page, errors } = await open({ query: "?chapter=f1&seed=7&nomusic&q=1", width: 640, height: 360 });
  await storyReady(page, { maxSec: 60 });
  await stepUntil(page, () => __crimson.story.chapter === "f1", { maxSec: 20 });
  await page.evaluate(QA_CAM);
  const q1 = await draws(page, 1);
  check(q1 <= 30, `Q1: the world draws at most ${q1} (<= 30) at 6 viewpoints`);
  await finish("world", fails, browser, errors);
}
