// In Full Swing: missions and odd jobs. Mission 1, "Sludge Run" (the story's fast start): a gang runner with a clog bomb runs the
// streets to the Market drain; catch him before the timer runs out, beat his crew, and the bomb is defused. Odd jobs wait at
// markers round the city and pay Loonies: catch a falling person, carry a stranded window washer down, a pizza rush, a balloon
// chase, a rooftop brawl. One job runs at a time; walk or swing into a marker to take it. Nobody gets hurt when a job fails: it
// is a cartoon city. Pure: no three, no DOM; streetview.js draws the people, jobsview the markers and the balloon.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const JOB = {
  offers: 4, near: [90, 420], refresh: 650, markerR: 4.5, markerUp: 3, leave: 700, // a job is dropped when you go this far away
  catch: { fall: 7, fallMax: 22, reach: 2.8, delay: 1.5, reward: 30 },
  washer: { grip: 60, reach: 2.6, reward: 40 },
  pizza: { speed: 12, spare: 18, reach: 4.5, reward: 25, bonus: 15 },
  balloon: { rise: 2.4, drift: 1.1, top: 170, reach: 2.6, back: 4.5, reward: 20 },
  brawl: { time: 120, wave1: 4, wave2: 3, reward: 35 },
  sludge: { speed: 5.4, crew: 3, runnerHp: 2, reward: 50, spare: 6 },
};
export const JOB_NAMES = { sludge: "Sludge Run", catch: "Catch!", washer: "Window Washer", pizza: "Pizza Rush", balloon: "Balloon Chase", brawl: "Rooftop Brawl" };
// what the marker says, and the toast when you take the job
export const JOB_LINES = {
  catch: "Someone is falling off a roof! Catch them.",
  washer: "A window washer's platform broke. Get him down.",
  pizza: "Pizza Rush: deliver it hot.",
  balloon: "A kid lost a balloon. Get it back!",
  brawl: "The Sludge Gang took this roof. Clear it.",
  sludge: "Mission 1: catch the runner before he blows the Market drain!",
};
const KID = { shirt: [0.95, 0.5, 0.2], pants: [0.2, 0.3, 0.6], skin: [0.85, 0.62, 0.45] };
const WASHER = { shirt: [0.2, 0.55, 0.85], pants: [0.25, 0.25, 0.3], skin: [0.66, 0.45, 0.3] };
const FALLER = { shirt: [0.95, 0.9, 0.3], pants: [0.3, 0.2, 0.15], skin: [0.96, 0.78, 0.62] };

export function createJobs({ city, combat, seed = 4711 }) {
  const r = rng(seed);
  const J = {
    active: null, offers: [], events: [], people: [], balloons: [], done: {}, failed: {}, story: { sludge: false }, offersOn: true,
    stats: { started: 0, done: 0, failed: 0 },
  };
  let nextId = 1, offerAt = null;
  const emit = (e) => { J.events.push(e); if (J.events.length > 64) J.events.shift(); };
  const tops = city.buildings.map((b) => ({ b, t: b.tiers[b.tiers.length - 1] }));
  const ground = (x, z) => (city.isWater(x, z) ? 0 : Math.max(0, city.groundY(x, z)));
  const roofCentre = (b) => { const t = b.tiers[b.tiers.length - 1]; return { x: (t.minX + t.maxX) / 2, y: b.roofY, z: (t.minZ + t.maxZ) / 2 }; };
  // a street point near (x, z): the nearest road centre line (the street model of street.js)
  function streetNear(x, z) {
    const S = city.streets;
    let best = null, bd = Infinity;
    for (const at of S.xs) { const d = Math.abs(x - at); if (d < bd && z < 260) { bd = d; best = { x: at + 6, y: 0, z }; } }
    for (const at of S.zs) { const d = Math.abs(z - at); if (d < bd) { bd = d; best = { x, y: 0, z: at + 6 }; } }
    if (best && (city.collideSphere(best.x, 1, best.z, 0.8) || city.isWater(best.x, best.z))) return null;
    return best;
  }
  function pickRoof(fx, fz, lo, hi, minY, maxY) {
    for (let k = 0; k < 60; k++) {
      const { b, t } = tops[Math.floor(r() * tops.length)];
      if (b.roofY < minY || b.roofY > maxY || t.maxX - t.minX < 10 || t.maxZ - t.minZ < 10) continue;
      const c = roofCentre(b), d = Math.hypot(c.x - fx, c.z - fz);
      if (d < lo || d > hi) continue;
      if (city.collideSphere(c.x, c.y + 1, c.z, 0.8)) continue;
      return { b, ...c };
    }
    return null;
  }

  /* ---------------- offers: markers round the player ---------------- */
  function makeOffer(type, fx, fz) {
    const [lo, hi] = JOB.near;
    let at = null, extra = {};
    if (type === "catch") { const q = pickRoof(fx, fz, lo, hi, 45, 150); if (q) { at = { x: q.x, y: q.y, z: q.z }; extra.bid = q.b.id; } }
    else if (type === "brawl") { const q = pickRoof(fx, fz, lo, hi, 14, 70); if (q) { at = { x: q.x, y: q.y, z: q.z }; extra.bid = q.b.id; } }
    else if (type === "washer") {
      const q = pickRoof(fx, fz, lo, hi, 55, 200);
      if (q) {
        // the washer hangs on the face that looks on to a street, at 40 to 70 % of the height
        const t = q.b.tiers[0], faces = [[t.maxX, (t.minZ + t.maxZ) / 2, 1, 0], [t.minX, (t.minZ + t.maxZ) / 2, -1, 0], [(t.minX + t.maxX) / 2, t.maxZ, 0, 1], [(t.minX + t.maxX) / 2, t.minZ, 0, -1]];
        for (const [x, z, nx, nz] of faces) {
          const sx = x + nx * 8, sz = z + nz * 8;
          if (city.collideSphere(sx, 1, sz, 1) || city.isWater(sx, sz)) continue;
          const h = Math.min(t.y1, q.b.roofY) * (0.4 + 0.3 * r());
          at = { x: sx, y: ground(sx, sz), z: sz }; extra.hang = { x: x + nx * 0.45, y: h, z: z + nz * 0.45, nx, nz };
          break;
        }
      }
    } else {
      // the pizza shop and the kid with the balloon are on a street
      for (let k = 0; k < 40 && !at; k++) {
        const a = r() * Math.PI * 2, d = lo + r() * (hi - lo);
        at = streetNear(fx + Math.cos(a) * d, fz + Math.sin(a) * d);
      }
    }
    if (!at) return null;
    return { id: nextId++, type, name: JOB_NAMES[type], x: at.x, y: at.y, z: at.z, ...extra };
  }
  function refreshOffers(fx, fz) {
    offerAt = { x: fx, z: fz };
    J.offers = [];
    const types = ["catch", "washer", "pizza", "balloon", "brawl"].sort(() => r() - 0.5).slice(0, JOB.offers);
    for (const t of types) { const o = makeOffer(t, fx, fz); if (o) J.offers.push(o); }
  }

  /* ---------------- starting and ending ---------------- */
  function card(title, detail, goal, extra = {}) { return { title, detail, short: extra.short || title, n: extra.n || 0, of: extra.of || 0, goal: goal ? { x: goal.x, y: goal.y, z: goal.z } : null }; }
  // start a job of type at the offer o (or at the hero, for the story and the tests)
  J.start = function start(type, o, h) {
    if (J.active) end(false, "dropped", true);
    // with no offer (the story, the tests): one made round the hero, or the hero's own spot
    o = o || (type !== "sludge" && makeOffer(type, h.x, h.z)) || { id: nextId++, type, name: JOB_NAMES[type], x: h.x, y: h.y, z: h.z };
    const A = { type, o, t: 0, phase: "go", timer: 0, data: {}, card: null };
    J.active = A;
    J.offers = J.offers.filter((q) => q !== o);
    J.stats.started++;
    setup[type](A, h);
    emit({ type: "start", job: type, line: JOB_LINES[type] });
    return A;
  };
  function end(ok, why, quiet) {
    const A = J.active;
    if (!A) return;
    combat.clearGroup("job");
    for (const p of J.people) p.on = false;
    J.people = []; J.balloons = [];
    J.active = null;
    if (ok) { J.done[A.type] = (J.done[A.type] || 0) + 1; J.stats.done++; if (A.type === "sludge") J.story.sludge = true; }
    else if (!quiet) { J.failed[A.type] = (J.failed[A.type] || 0) + 1; J.stats.failed++; }
    if (!quiet) emit({ type: ok ? "done" : "failed", job: A.type, why, reward: ok ? A.reward : 0, x: A.o.x, y: A.o.y, z: A.o.z });
    offerAt = null; // fresh offers round wherever you are
  }
  J.cancel = () => end(false, "cancelled", true);
  const person = (look, x, y, z, pose, extra = {}) => {
    const p = { on: true, x, y, z, yaw: r() * 6.28, phase: 0, stride: 0, pose, poseT: 0, height: extra.height || 1, shirt: look.shirt, pants: look.pants, skin: look.skin, bp: 0, br: 0, lift: 0, ...extra };
    J.people.push(p);
    return p;
  };

  const setup = {
    sludge(A, h) {
      // the runner's path: from the street under the start roof along the z = 110 street, up the -234 street, along the z = 14
      // avenue to the Market drain under the -306 avenue
      const S = city.start;
      const path = [{ x: S.x, z: 110 }, { x: -234, z: 110 }, { x: -234, z: 14 }, { x: -300, z: 14 }, { x: -306, z: -40 }].map((p) => ({ x: p.x, y: 0, z: p.z }));
      let len = 0;
      for (let i = 1; i < path.length; i++) len += Math.hypot(path[i].x - path[i - 1].x, path[i].z - path[i - 1].z);
      const g = combat.spawn(path[0].x, 0, path[0].z, "job", { runner: true, hp: JOB.sludge.runnerHp, path: path.slice(1), speed: JOB.sludge.speed });
      A.data = { runner: g, drain: path[path.length - 1], crew: false };
      A.timer = len / JOB.sludge.speed + JOB.sludge.spare;
      A.reward = JOB.sludge.reward;
    },
    catch(A) {
      // someone slips off the edge of this roof, on the side away from the marker's middle
      const b = city.buildings.find((q) => q.id === A.o.bid);
      const t = b.tiers[b.tiers.length - 1], a = r() * Math.PI * 2;
      const ex = clamp(A.o.x + Math.cos(a) * 99, t.minX, t.maxX), ez = clamp(A.o.z + Math.sin(a) * 99, t.minZ, t.maxZ);
      const nx = ex === t.minX ? -1 : ex === t.maxX ? 1 : 0, nz = nx ? 0 : ez === t.minZ ? -1 : 1;
      A.data = { p: person(FALLER, ex - nx * 0.6, b.roofY, ez - nz * 0.6, 14), out: { x: ex + nx * 1.2, z: ez + nz * 1.2 }, vy: 0, falling: false, caught: false };
      A.timer = JOB.catch.delay;
      A.reward = JOB.catch.reward;
    },
    washer(A) {
      const H = A.o.hang;
      A.data = { p: person(WASHER, H.x, H.y - 1.6, H.z, 14, { yaw: Math.atan2(H.nx, H.nz) }), caught: false };
      A.timer = JOB.washer.grip;
      A.reward = JOB.washer.reward;
    },
    pizza(A, h) {
      const q = pickRoof(A.o.x, A.o.z, 250, 460, 18, 90) || pickRoof(A.o.x, A.o.z, 150, 600, 10, 120);
      A.data = { drop: q ? { x: q.x, y: q.y, z: q.z } : { x: city.start.x, y: city.start.y, z: city.start.z } };
      const d = Math.hypot(A.data.drop.x - A.o.x, A.data.drop.z - A.o.z);
      A.timer = A.data.limit = d / JOB.pizza.speed + JOB.pizza.spare;
      A.reward = JOB.pizza.reward;
    },
    balloon(A) {
      const kid = person(KID, A.o.x, A.o.y, A.o.z, 14, { height: 0.62 });
      const a = r() * Math.PI * 2;
      A.data = { kid, b: { x: A.o.x + 0.3, y: A.o.y + 1.4, z: A.o.z, vx: Math.cos(a) * JOB.balloon.drift, vz: Math.sin(a) * JOB.balloon.drift, held: false, color: [0.95, 0.15, 0.25] } };
      J.balloons = [A.data.b];
      A.reward = JOB.balloon.reward;
    },
    brawl(A) {
      A.data = { wave: 1 };
      spawnRing(A.o, JOB.brawl.wave1);
      A.timer = JOB.brawl.time;
      A.reward = JOB.brawl.reward;
    },
  };
  function spawnRing(o, n) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + r(), d = 3 + r() * 3;
      const g = combat.spawn(o.x + Math.cos(a) * d, o.y, o.z + Math.sin(a) * d, "job");
      g.aggro = true;
    }
  }

  /* ---------------- the frame ---------------- */
  // h: the hero { x, y, z, vx, vy, vz, onGround, busy (driving or in a scene) }. Returns nothing; read J.events and J.card.
  J.update = function update(dt, t, h) {
    dt = clamp(dt || 0, 0, 0.1);
    if (!h) return;
    if (J.offersOn && !J.active && (!offerAt || Math.hypot(h.x - offerAt.x, h.z - offerAt.z) > JOB.refresh)) refreshOffers(h.x, h.z);
    // a marker you walk or swing into starts its job
    if (!J.active && J.offersOn && !h.busy) {
      for (const o of J.offers) if (Math.hypot(h.x - o.x, h.z - o.z) < JOB.markerR && Math.abs(h.y - o.y) < JOB.markerUp) { J.start(o.type, o, h); break; }
    }
    const A = J.active;
    for (const p of J.people) p.poseT += dt;
    if (!A) { J.card = null; return; }
    A.t += dt;
    if (A.type !== "sludge" && Math.hypot(h.x - A.o.x, h.z - A.o.z) > JOB.leave && !A.data.caught) { end(false, "left"); return; }
    run[A.type](A, dt, h);
  };
  const fmt = (s) => Math.max(0, Math.ceil(s)) + " s";
  const near3 = (a, b, d) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 < d * d;
  // carrying someone: they ride over the hero's left shoulder, and a landing on anything sets them down
  function carry(p, h) {
    const yaw = h.yaw || 0, rx = Math.cos(yaw), rz = -Math.sin(yaw);
    p.x = h.x - rx * 0.28; p.y = h.y + 1.25; p.z = h.z - rz * 0.28; p.yaw = yaw + Math.PI / 2;
    p.pose = 13; p.bp = 1.5; p.lift = 0; p.stride = 0;
  }
  function setDown(p, h) {
    const yaw = h.yaw || 0, rx = Math.cos(yaw), rz = -Math.sin(yaw);
    p.x = h.x - rx * 1.2; p.z = h.z - rz * 1.2; p.y = h.y; p.bp = 0; p.pose = 4; p.poseT = 0;
  }
  const run = {
    sludge(A, dt, h) {
      A.timer -= dt;
      const D = A.data, g = D.runner;
      if (!D.crew && (!g.on || !combat.alive(g))) {
        // the runner is down: his crew jumps in
        D.crew = true;
        for (let i = 0; i < JOB.sludge.crew; i++) { const a = (i / JOB.sludge.crew) * 6.28; const q = combat.spawn(g.x + Math.cos(a) * 5, g.y, g.z + Math.sin(a) * 5, "job"); q.aggro = true; }
        A.timer = Math.max(A.timer, 40);
        emit({ type: "say", line: "Get him, boys!" });
      }
      const crew = combat.group("job");
      const left = crew.filter((q) => combat.alive(q)).length;
      if (D.crew && left === 0) { end(true, "defused"); return; }
      if (!D.crew && combat.events.some((e) => e.type === "arrived" && e.id === g.id)) { end(false, "drain"); return; }
      if (A.timer <= 0) { end(false, "time"); return; }
      const goal = D.crew ? (crew.find((q) => combat.alive(q)) || h) : g;
      A.card = card("SLUDGE RUN " + fmt(A.timer), D.crew ? "Beat his crew: " + left + " left" : "Catch the runner, " + Math.round(Math.hypot(g.x - h.x, g.z - h.z)) + " m", goal, { short: fmt(A.timer) });
      J.card = A.card;
    },
    catch(A, dt, h) {
      const D = A.data, p = D.p, C = JOB.catch;
      if (!D.falling && !D.caught) {
        A.timer -= dt;
        p.pose = 14;
        if (A.timer <= 0) { D.falling = true; p.x = D.out.x; p.z = D.out.z; p.pose = 12; emit({ type: "say", line: "Aaah! Help!" }); }
      } else if (D.falling && !D.caught) {
        D.vy = Math.max(-C.fallMax, D.vy - C.fall * dt);
        p.y += D.vy * dt;
        const g = ground(p.x, p.z), tb = city.topBelow(p.x, p.y + 0.5, p.z, 0.3), floor = Math.max(g, tb ? tb.y : -Infinity);
        if (near3(p, { x: h.x, y: h.y + 1, z: h.z }, C.reach)) { D.caught = true; emit({ type: "caught", job: "catch" }); }
        else if (p.y <= floor + 0.3) { p.y = floor; p.pose = 11; p.bp = -1.4; end(false, "dumpster"); return; }
      }
      if (D.caught) {
        carry(p, h);
        if (h.onGround) { setDown(p, h); end(true, "safe"); return; }
      }
      A.card = card("CATCH!", D.caught ? "Land anywhere to set them down" : D.falling ? "Catch them before they hit the street!" : "Get ready...", D.caught ? null : p);
      J.card = A.card;
    },
    washer(A, dt, h) {
      const D = A.data, p = D.p;
      if (!D.caught) {
        A.timer -= dt;
        if (near3(p, { x: h.x, y: h.y + 1, z: h.z }, JOB.washer.reach)) { D.caught = true; emit({ type: "caught", job: "washer" }); }
        else if (A.timer <= 0) { p.pose = 11; end(false, "drainpipe"); return; }
      } else {
        carry(p, h);
        if (h.onGround && h.y < 1.5) { setDown(p, h); end(true, "safe"); return; }
      }
      A.card = card("WINDOW WASHER" + (D.caught ? "" : " " + fmt(A.timer)), D.caught ? "Take him down to the street" : "Reach him before his grip goes", D.caught ? { x: h.x, y: 0, z: h.z } : p, { short: D.caught ? "Down" : fmt(A.timer) });
      J.card = A.card;
    },
    pizza(A, dt, h) {
      A.timer -= dt;
      const D = A.data;
      if (near3(h, D.drop, JOB.pizza.reach)) { A.reward += Math.round(JOB.pizza.bonus * clamp(A.timer / D.limit, 0, 1) * 2); end(true, "delivered"); return; }
      if (A.timer <= 0) { end(false, "cold"); return; }
      A.card = card("PIZZA RUSH " + fmt(A.timer), "Deliver to the roof, " + Math.round(Math.hypot(D.drop.x - h.x, D.drop.z - h.z)) + " m", D.drop, { short: fmt(A.timer) });
      J.card = A.card;
    },
    balloon(A, dt, h) {
      const D = A.data, b = D.b, C = JOB.balloon;
      if (!b.held) {
        b.y += C.rise * dt; b.x += b.vx * dt; b.z += b.vz * dt;
        if (near3(b, { x: h.x, y: h.y + 1.6, z: h.z }, C.reach)) { b.held = true; emit({ type: "caught", job: "balloon" }); }
        else if (b.y > C.top) { end(false, "gone"); return; }
      } else {
        b.x = h.x; b.y = h.y + 2.6; b.z = h.z;
        if (Math.hypot(h.x - D.kid.x, h.z - D.kid.z) < C.back && Math.abs(h.y - D.kid.y) < 2) { D.kid.pose = 4; D.kid.poseT = 0; end(true, "returned"); return; }
      }
      A.card = card("BALLOON CHASE", b.held ? "Give it back to the kid" : "Grab it before it floats away, " + Math.round(b.y) + " m up", b.held ? D.kid : b);
      J.card = A.card;
    },
    brawl(A, dt, h) {
      A.timer -= dt;
      const crew = combat.group("job"), left = crew.filter((q) => combat.alive(q)).length;
      if (left === 0 && A.data.wave === 1) { A.data.wave = 2; spawnRing(A.o, JOB.brawl.wave2); emit({ type: "say", line: "More of them!" }); }
      else if (left === 0 && A.data.wave === 2) { end(true, "cleared"); return; }
      if (A.timer <= 0) { end(false, "time"); return; }
      A.card = card("ROOFTOP BRAWL " + fmt(A.timer), "Wave " + A.data.wave + " of 2: " + left + " left", crew.find((q) => combat.alive(q)) || A.o, { short: fmt(A.timer), n: left });
      J.card = A.card;
    },
  };
  // the hero was knocked out: a fight job is lost
  J.knockedOut = () => { if (J.active && (J.active.type === "brawl" || J.active.type === "sludge")) end(false, "knockout"); };
  // a rope that catches a falling person or the balloon catches them
  J.ropeTargets = function ropeTargets(h) {
    const A = J.active, out = [];
    if (!A) return out;
    if (A.type === "catch" && A.data.falling && !A.data.caught) out.push({ id: "person", tag: "person", pos: A.data.p, radius: 1.4 });
    if (A.type === "balloon" && !A.data.b.held) out.push({ id: "balloon", tag: "balloon", pos: A.data.b, radius: 1.4 });
    return out;
  };
  J.ropeCaught = function ropeCaught(id) {
    const A = J.active;
    if (!A) return false;
    if (id === "person" && A.type === "catch" && A.data.falling) { A.data.caught = true; emit({ type: "caught", job: "catch", rope: true }); return true; }
    if (id === "balloon" && A.type === "balloon") { A.data.b.held = true; emit({ type: "caught", job: "balloon", rope: true }); return true; }
    return false;
  };
  J.carrying = () => !!(J.active && J.active.data.caught && (J.active.type === "catch" || J.active.type === "washer"));
  J.info = () => ({
    active: J.active ? { type: J.active.type, phase: J.active.phase, timer: J.active.timer, t: J.active.t, data: { caught: !!J.active.data.caught, falling: !!J.active.data.falling, crew: !!J.active.data.crew } } : null,
    offers: J.offers.map((o) => ({ id: o.id, type: o.type, x: o.x, y: o.y, z: o.z })), done: { ...J.done }, failed: { ...J.failed }, story: { ...J.story }, stats: { ...J.stats }, card: J.card,
  });
  return J;
}
