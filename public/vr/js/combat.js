// In Full Swing: the fights. The Porcelain King's Sludge Gang: goons that stand guard on roofs and streets, see the hero, walk up,
// wind up and punch. The hero punches (punch, punch, kick) in reach, yanks a goon off his feet with a rope, flattens the ones
// round a dive or roll landing, and knocks them over with a car. The hero's health (hearts) comes back after a quiet while; at
// zero it is a knock-out (main wakes the hero on a safe roof). A goon that winds up near the hero is a threat: a dodge in that
// window makes his blow miss. From above, out of a guard's sight, a rope takes him down quietly: he is lifted and left hanging.
// Blows fill the focus meter; a full meter finishes the goons in reach at once. Pure: no three, no DOM; streetview.js draws them.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export const FIGHT = {
  hp: 5, regenAfter: 6, regen: 0.5, // the hero's hearts; they come back one every 2 s after 6 quiet seconds
  reach: 2.4, // a goon this close (and within 1.6 m up or down) can be punched
  combo: 0.7, // a press within this of the last blow carries the combo on (punch, punch, kick)
  punch: { dmg: 1, cool: 0.28, push: 0.45 }, kick: { dmg: 2, cool: 0.45, push: 3.5 },
  pull: { dmg: 1, time: 0.45 }, // a rope yanks the goon to the hero's feet over this time, and he goes down
  slam: { r: 4.5, dmg: 2 }, // a dive or roll landing flattens the goons this close
  car: { r: 2.2, speed: 4 }, // a car faster than this knocks over the goons it touches
  goon: { hp: 3, speed: 3.1, run: 4.4, sight: 24, up: 5, reach: 1.5, windup: 0.55, swing: 0.3, cool: 1.3, dmg: 1, stagger: 0.5, down: 2.6, out: 1.2 },
  keep: 220, // a goon this far from the hero, not fighting, goes
  // the dodge: a goon this close (m) that winds up or swings is a threat; a dodge keeps every blow off for time s, and pushes the
  // hero speed m/s sideways (hop m/s up). A dodge during a wind-up is a perfect one.
  dodge: { near: 4, time: 0.5, speed: 7.5, hop: 2.5, cool: 0.35 },
  // the perch takedown: a guard who has not seen the hero, at least above m under him and within range m, can be roped; he is
  // lifted rise m (never higher than under m below the hero) over time s and hangs for hang s
  perch: { above: 5, range: 34, rise: 5, under: 1.5, time: 0.5, hang: 7 },
  // the focus meter (0..1): what each blow adds; a full meter finishes the goons within r m of the hero
  // the group pull: a rope pull also drags up to n goons within r m of the one it caught; they land in a heap and each takes dmg
  heap: { r: 3.5, n: 2, dmg: 2 },
  // the throw: something from the street (a trash-can lid, a vent cap) at a goon min to max m away and within cone degrees of
  // the facing; it flies time s and takes dmg; one throw every cool s
  throw: { min: 3, max: 18, cone: 40, time: 0.45, dmg: 2, push: 2, cool: 2.5 },
  focus: { punch: 0.1, kick: 0.16, rope: 0.12, slam: 0.12, takedown: 0.25, dodge: 0.08, perfect: 0.2, r: 3.5 },
};
// the gang's clothes: sludge-green hoodies, dark trousers, a green sludge mask; the runner wears hazard yellow
const GANG = { shirt: [0.2, 0.46, 0.18], pants: [0.12, 0.12, 0.15], skin: [0.55, 0.8, 0.22] };
const RUNNER = { shirt: [0.9, 0.82, 0.12], pants: [0.14, 0.14, 0.16], skin: [0.55, 0.8, 0.22] };

export function createCombat(city) {
  const goons = [];
  let nextId = 0;
  const C = {
    goons, hp: FIGHT.hp, quiet: 99, combo: 0, comboT: 9, cool: 0, events: [],
    hits: 0, hitsT: 9, focus: 0, dodgeT: 0, dodgeCool: 0, throwCool: 0, // the combo count (blows with no gap over 2 s), focus 0..1, the dodge clocks
    stats: { punches: 0, kicks: 0, pulls: 0, slams: 0, kos: 0, hurt: 0, knockouts: 0, carHits: 0, dodges: 0, perfect: 0, takedowns: 0, finishers: 0, heaps: 0, throws: 0 },
  };
  const emit = (e) => { C.events.push(e); if (C.events.length > 64) C.events.shift(); };

  // A goon at (x, y, z) on whatever is under him. group: a name to find his crew by (a clog guard, a job). o: { hp, runner, home }.
  C.spawn = function spawn(x, y, z, group = "", o = {}) {
    const tb = city.topBelow(x, y + 1, z, 0.3);
    const gy = tb ? tb.y : Math.max(0, city.groundY(x, z));
    const look = o.runner ? RUNNER : GANG;
    const g = {
      id: nextId++, on: true, group, runner: !!o.runner, x, y: gy, z, yaw: Math.random() * 6.28, hp: o.hp || FIGHT.goon.hp,
      state: "idle", t: 0, home: { x, y: gy, z }, aggro: false, cool: 0.6 + Math.random(), phase: Math.random() * 6, stride: 0,
      pose: 1, poseT: 0, height: 1.02 + Math.random() * 0.12, shirt: look.shirt, pants: look.pants, skin: look.skin,
      bp: 0, br: 0, lift: 0, path: o.path || null, pathI: 0, speed: o.speed || 0, from: null, pullT: 0, hitBy: "",
    };
    goons.push(g);
    return g;
  };
  C.alive = (g) => g.on && g.state !== "down" && g.state !== "out" && g.state !== "pulled" && g.state !== "hung";
  // a blow landed: the combo count goes up and the meter fills
  const scored = (k) => { C.hits = C.hitsT < 2 ? C.hits + 1 : 1; C.hitsT = 0; C.focus = Math.min(1, C.focus + (FIGHT.focus[k] || 0)); };
  C.group = (name) => goons.filter((g) => g.on && g.group === name);
  C.clearGroup = (name) => { for (const g of goons) if (g.group === name) g.on = false; prune(); };
  C.heal = () => { C.hp = FIGHT.hp; C.quiet = 99; };
  function prune() { for (let i = goons.length - 1; i >= 0; i--) if (!goons[i].on) goons.splice(i, 1); }

  // move a goon by (dx, dz) on his own surface: never off an edge, never into a wall
  function walk(g, dx, dz) {
    const nx = g.x + dx, nz = g.z + dz;
    const tb = city.topBelow(nx, g.y + 0.6, nz, 0.25);
    let top = tb ? tb.y : -Infinity;
    if (!city.isWater(nx, nz)) top = Math.max(top, city.groundY(nx, nz));
    if (!(Math.abs(top - g.y) < 0.6)) return false; // an edge (or a step too high)
    if (city.collideSphere(nx, top + 0.9, nz, 0.32)) return false;
    g.x = nx; g.z = nz; g.y = top;
    return true;
  }
  function setPose(g, pose) { if (g.pose !== pose) { g.pose = pose; g.poseT = 0; } }
  function face(g, x, z, k = 1) { const want = Math.atan2(-(x - g.x), -(z - g.z)); g.yaw = wrap(g.yaw + wrap(want - g.yaw) * k); }
  function knock(g, fromX, fromZ, dmg, push, why) {
    if (!C.alive(g)) return false;
    g.hp -= dmg;
    const dx = g.x - fromX, dz = g.z - fromZ, d = Math.hypot(dx, dz) || 1;
    // the push: along the ground, as far as the surface lets him go
    for (let i = 0; i < 6; i++) walk(g, (dx / d) * (push / 6), (dz / d) * (push / 6));
    g.aggro = true; g.hitBy = why;
    if (g.hp <= 0) {
      g.state = "down"; g.t = FIGHT.goon.down; setPose(g, 11); g.bp = -1.45; g.lift = 0.12; g.stride = 0;
      face(g, fromX, fromZ);
      C.stats.kos++;
      emit({ type: "ko", id: g.id, group: g.group, runner: g.runner, x: g.x, y: g.y, z: g.z, why });
    } else {
      g.state = "stagger"; g.t = FIGHT.goon.stagger; setPose(g, 10); g.stride = 0;
      emit({ type: "hit", id: g.id, x: g.x, y: g.y, z: g.z, why });
    }
    return true;
  }

  // the goon the hero can punch now: the nearest living one in reach, preferring the one in front
  C.inReach = function inReach(h) {
    let best = null, bs = Infinity;
    const fx = -Math.sin(h.yaw || 0), fz = -Math.cos(h.yaw || 0);
    for (const g of goons) {
      if (!C.alive(g) || Math.abs(g.y - h.y) > 1.6) continue;
      const dx = g.x - h.x, dz = g.z - h.z, d = Math.hypot(dx, dz);
      if (d > FIGHT.reach) continue;
      const s = d - 0.6 * ((dx * fx + dz * fz) / (d || 1));
      if (s < bs) { bs = s; best = g; }
    }
    return best;
  };
  // A press of the swing input in reach: punch, punch, kick. Returns { kind, side, goon } or null (not in reach, or cooling down).
  C.attack = function attack(h) {
    const g = C.inReach(h);
    if (!g || C.cool > 0) return null;
    C.combo = C.comboT < FIGHT.combo ? (C.combo + 1) % 3 : 0;
    C.comboT = 0;
    const kick = C.combo === 2, A = kick ? FIGHT.kick : FIGHT.punch;
    C.cool = A.cool;
    if (kick) C.stats.kicks++; else C.stats.punches++;
    knock(g, h.x, h.z, A.dmg, A.push, kick ? "kick" : "punch");
    scored(kick ? "kick" : "punch");
    return { kind: kick ? "kick" : "punch", side: C.combo === 1 ? 0 : 1, goon: g };
  };
  // A guard the hero can take down from above: the hero stands on a roof or holds a wall (h.perch, not in a swing, so a guard never
  // steals a swing), the guard has not seen him, and he stands perch.above m or more under him.
  C.perched = (g, h) => !!(g && h && h.perch && C.alive(g) && !g.aggro && !g.runner && h.y - g.y >= FIGHT.perch.above && Math.hypot(g.x - h.x, g.z - h.z) < FIGHT.perch.range);
  // A rope caught goon id: he flies to the hero's feet and goes down. A perched hero lifts him instead (a takedown): he hangs, and
  // the others do not hear it. Returns "pull", "takedown" or false.
  C.pull = function pull(id, h) {
    const g = goons.find((q) => q.id === id);
    if (!g || !C.alive(g)) return false;
    if (C.perched(g, h)) {
      const P = FIGHT.perch;
      C.stats.takedowns++; C.stats.kos++;
      g.state = "hung"; g.pullT = 0; g.t = P.hang; g.hp = 0; g.stride = 0; g.from = { x: g.x, y: g.y, z: g.z };
      g.to = { x: g.x, y: Math.min(g.y + P.rise, h.y - P.under), z: g.z };
      setPose(g, 12);
      scored("takedown");
      emit({ type: "takedown", id: g.id, x: g.x, y: g.y, z: g.z });
      emit({ type: "ko", id: g.id, group: g.group, runner: g.runner, x: g.x, y: g.to.y, z: g.z, why: "takedown", quiet: true });
      return "takedown";
    }
    C.stats.pulls++;
    const dx = g.x - h.x, dz = g.z - h.z, d = Math.hypot(dx, dz) || 1, H = FIGHT.heap;
    // the goons beside him come along on the same rope: a heap at the hero's feet
    const crew = goons.filter((q) => q !== g && C.alive(q) && Math.abs(q.y - g.y) < 1.6 && Math.hypot(q.x - g.x, q.z - g.z) < H.r)
      .sort((a, b) => Math.hypot(a.x - g.x, a.z - g.z) - Math.hypot(b.x - g.x, b.z - g.z)).slice(0, H.n);
    [g, ...crew].forEach((q, k) => {
      q.state = "pulled"; q.pullT = 0; q.from = { x: q.x, y: q.y, z: q.z }; q.heap = crew.length > 0;
      const a = k * 2.1; // spread round the landing point
      q.to = { x: h.x + (dx / d) * 1.4 + Math.cos(a) * 0.6 * (k > 0), y: h.y, z: h.z + (dz / d) * 1.4 + Math.sin(a) * 0.6 * (k > 0) };
      setPose(q, 12);
    });
    if (crew.length) { C.stats.heaps++; emit({ type: "heap", n: crew.length + 1, x: g.x, y: g.y, z: g.z }); }
    emit({ type: "pulled", id: g.id, x: g.x, y: g.y, z: g.z });
    scored("rope");
    return "pull";
  };
  // The goon that threatens the hero now: the nearest one within dodge.near that winds up or is mid-swing (before his blow lands).
  C.threat = function threat(h) {
    if (!h) return null;
    let best = null, bd = FIGHT.dodge.near;
    for (const g of goons) {
      if (!g.on || !(g.state === "windup" || (g.state === "swing" && !g.struck)) || Math.abs(g.y - h.y) > 1.6) continue;
      const d = Math.hypot(g.x - h.x, g.z - h.z);
      if (d < bd) { bd = d; best = g; }
    }
    return best;
  };
  // A dodge: with a threat, every blow misses for dodge.time s. Returns { dx, dz, perfect } (the way to go: sideways from the
  // nearest attacker, to the side of move (mx, mz) when one is held) or null (no threat, or too soon after the last one).
  C.dodge = function dodge(h, mx = 0, mz = 0) {
    const g = C.threat(h);
    if (!g || C.dodgeCool > 0) return null;
    const D = FIGHT.dodge, perfect = g.state === "windup";
    C.dodgeT = D.time; C.dodgeCool = D.time + D.cool;
    C.stats.dodges++; if (perfect) C.stats.perfect++;
    // every blow on its way within reach now misses, however late it lands
    for (const q of goons) if (q.on && (q.state === "windup" || (q.state === "swing" && !q.struck)) && Math.hypot(q.x - h.x, q.z - h.z) < D.near) q.dodged = true;
    C.focus = Math.min(1, C.focus + (perfect ? FIGHT.focus.perfect : FIGHT.focus.dodge));
    const ax = h.x - g.x, az = h.z - g.z, al = Math.hypot(ax, az) || 1;
    let sx = -az / al, sz = ax / al; // to one side of the line from the goon
    if (sx * mx + sz * mz < 0) { sx = -sx; sz = -sz; }
    const dx = sx * 0.8 + (ax / al) * 0.6, dz = sz * 0.8 + (az / al) * 0.6, dl = Math.hypot(dx, dz);
    emit({ type: "dodge", id: g.id, perfect, x: h.x, y: h.y, z: h.z });
    return { dx: dx / dl, dz: dz / dl, perfect, goon: g };
  };
  // The goon a throw would go to: alive, within throw.min..max and the cone of the facing, the nearest to the middle of the view.
  C.throwTarget = function throwTarget(h) {
    if (!h || C.throwCool > 0) return null;
    const T = FIGHT.throw, fx = -Math.sin(h.yaw || 0), fz = -Math.cos(h.yaw || 0), cosC = Math.cos((T.cone * Math.PI) / 180);
    let best = null, bs = -2;
    for (const g of goons) {
      if (!C.alive(g) || Math.abs(g.y - h.y) > 6) continue;
      const dx = g.x - h.x, dz = g.z - h.z, d = Math.hypot(dx, dz);
      if (d < T.min || d > T.max) continue;
      const c = (dx * fx + dz * fz) / d;
      if (c >= cosC && c > bs) { bs = c; best = g; }
    }
    return best;
  };
  // A throw at the goon the hero faces: returns { goon, time } (main flies the object; C.landThrow lands it), or null.
  C.throw = function thrown(h) {
    const g = C.throwTarget(h);
    if (!g) return null;
    C.throwCool = FIGHT.throw.cool; C.stats.throws++;
    emit({ type: "throw", id: g.id, x: h.x, y: h.y, z: h.z });
    return { goon: g, time: FIGHT.throw.time };
  };
  // the thrown object reaches goon id (from where the hero threw it)
  C.landThrow = function landThrow(id, fromX, fromZ) {
    const g = goons.find((q) => q.id === id);
    if (!g || !C.alive(g)) return false;
    knock(g, fromX, fromZ, FIGHT.throw.dmg, FIGHT.throw.push, "throw");
    scored("kick");
    return true;
  };
  // A finisher: with a full meter and a goon in reach, every goon within focus.r goes down. Returns the goons, or null.
  C.finish = function finish(h) {
    if (C.focus < 1 || !C.inReach(h)) return null;
    const out = [];
    for (const g of goons) if (C.alive(g) && Math.abs(g.y - h.y) < 1.6 && Math.hypot(g.x - h.x, g.z - h.z) < FIGHT.focus.r) {
      g.hp = Math.min(g.hp, 1);
      knock(g, h.x, h.z, 9, 3, "finisher");
      out.push(g);
    }
    if (!out.length) return null;
    C.focus = 0; C.stats.finishers++;
    scored("");
    emit({ type: "finisher", n: out.length, x: h.x, y: h.y, z: h.z });
    return out;
  };
  // A dive or roll landing at (x, y, z): the goons round it go down. Returns how many.
  C.slam = function slam(x, y, z, r = FIGHT.slam.r) {
    let n = 0;
    for (const g of goons) if (C.alive(g) && Math.abs(g.y - y) < 1.6 && Math.hypot(g.x - x, g.z - z) < r) { knock(g, x, z, FIGHT.slam.dmg, 2.5, "slam"); n++; }
    if (n) { C.stats.slams++; scored("slam"); emit({ type: "slam", n, x, y, z }); }
    return n;
  };
  // A car at (x, z) moving at (vx, vz): the goons it touches go flying.
  C.carHit = function carHit(x, z, vx, vz) {
    const sp = Math.hypot(vx, vz);
    if (sp < FIGHT.car.speed) return 0;
    let n = 0;
    for (const g of goons) {
      if (!C.alive(g) || g.y > 1.5 || Math.hypot(g.x - x, g.z - z) > FIGHT.car.r) continue;
      g.hp = Math.min(g.hp, 1);
      knock(g, x - vx, z - vz, 2, 4, "car"); n++; C.stats.carHits++;
    }
    return n;
  };
  // the hero takes a blow from (fx, fz); nothing while rolling or in a car
  function hurtHero(h, g) {
    if (h.safe || C.dodgeT > 0) { emit({ type: "miss", id: g.id, dodged: C.dodgeT > 0 }); return; }
    C.hp = Math.max(0, C.hp - FIGHT.goon.dmg);
    C.quiet = 0; C.stats.hurt++;
    emit({ type: "hurt", hp: C.hp, fromX: g.x, fromZ: g.z, x: h.x, y: h.y, z: h.z });
    if (C.hp <= 0) { C.stats.knockouts++; emit({ type: "knockout" }); }
  }

  // One frame. h: the hero { x, y, z, yaw, onGround, safe (rolling, in a car, in a scene) } or null (no fights: the goons stand).
  C.update = function update(dt, h) {
    dt = clamp(dt || 0, 0, 0.1);
    C.cool = Math.max(0, C.cool - dt); C.comboT += dt; C.quiet += dt; C.hitsT += dt;
    C.dodgeT = Math.max(0, C.dodgeT - dt); C.dodgeCool = Math.max(0, C.dodgeCool - dt); C.throwCool = Math.max(0, C.throwCool - dt);
    if (C.hitsT > 2) C.hits = 0;
    if (C.quiet > FIGHT.regenAfter && C.hp < FIGHT.hp && C.hp > 0) C.hp = Math.min(FIGHT.hp, C.hp + FIGHT.regen * dt);
    const G = FIGHT.goon;
    let fighting = 0;
    for (const g of goons) {
      if (!g.on) continue;
      g.poseT += dt; g.cool = Math.max(0, g.cool - dt);
      const dx = h ? h.x - g.x : 0, dz = h ? h.z - g.z : 0, dy = h ? h.y - g.y : 99, d = Math.hypot(dx, dz);
      if (h && d > FIGHT.keep && !g.aggro && !g.path) { g.on = false; continue; }
      switch (g.state) {
        case "pulled": {
          g.pullT += dt;
          const k = clamp(g.pullT / FIGHT.pull.time, 0, 1), arc = Math.sin(Math.PI * k) * 2.5;
          g.x = g.from.x + (g.to.x - g.from.x) * k; g.z = g.from.z + (g.to.z - g.from.z) * k; g.y = g.from.y + (g.to.y - g.from.y) * k + arc;
          g.bp = -1.2 * k;
          if (k >= 1) {
            const tb = city.topBelow(g.x, g.y + 1, g.z, 0.3);
            g.y = tb ? tb.y : Math.max(0, city.groundY(g.x, g.z));
            g.state = "alive";
            if (g.heap) { g.heap = false; knock(g, h ? h.x : g.x, h ? h.z : g.z, FIGHT.heap.dmg, 0.6, "heap"); }
            else { g.hp = Math.min(g.hp, FIGHT.pull.dmg); knock(g, h ? h.x : g.x, h ? h.z : g.z, FIGHT.pull.dmg, 0, "rope"); }
          }
          break;
        }
        case "hung": {
          // lifted on the rope, then hanging upside down, swaying, until he is gone
          g.pullT += dt; g.stride = 0;
          const k = clamp(g.pullT / FIGHT.perch.time, 0, 1), e = k * k * (3 - 2 * k);
          g.y = g.from.y + (g.to.y - g.from.y) * e;
          g.bp = Math.PI * e; g.br = k >= 1 ? Math.sin(g.pullT * 2.2) * 0.12 : 0;
          if (k >= 1 && (g.t -= dt) <= 0) g.on = false;
          break;
        }
        case "down":
          g.t -= dt; g.stride = 0;
          if (g.t <= 0) { g.state = "out"; g.t = G.out; }
          break;
        case "out":
          // sinks into a sludge puddle and is gone
          g.t -= dt; g.lift = -0.5 * (1 - g.t / G.out);
          if (g.t <= 0) g.on = false;
          break;
        case "stagger":
          g.t -= dt; g.stride = 0;
          if (g.t <= 0) { g.state = "chase"; setPose(g, 0); }
          break;
        case "windup":
          g.t -= dt; g.stride = 0;
          if (h) face(g, h.x, h.z, 0.3);
          if (g.t <= 0) { g.state = "swing"; g.t = G.swing; setPose(g, 8); }
          break;
        case "swing":
          g.t -= dt;
          if (h && g.t <= G.swing * 0.5 && !g.struck) {
            g.struck = true;
            if (g.dodged) emit({ type: "miss", id: g.id, dodged: true });
            else if (d < G.reach + 0.5 && Math.abs(dy) < 1.4) hurtHero(h, g); else emit({ type: "miss", id: g.id });
          }
          if (g.t <= 0) { g.state = "chase"; g.cool = G.cool + Math.random() * 0.5; g.struck = false; g.dodged = false; setPose(g, 0); }
          break;
        default: {
          // a runner keeps to his path; the others guard, see the hero, chase and punch
          if (g.path && g.pathI < g.path.length) { runPath(g, dt); break; } // a runner only stops when he is down
          const sees = h && !h.hidden && d < G.sight && Math.abs(dy) < G.up;
          if (sees) g.aggro = true;
          if (g.aggro && h && d < G.sight * 1.6 && Math.abs(dy) < G.up) {
            g.state = "chase"; fighting++;
            face(g, h.x, h.z, 0.25);
            if (d > G.reach) {
              const sp = d > 8 ? G.run : G.speed, st = Math.min(sp * dt, d - G.reach * 0.8);
              const moved = walk(g, (dx / d) * st, (dz / d) * st);
              g.stride = moved ? sp : 0; setPose(g, 0);
            } else {
              g.stride = 0; setPose(g, 1);
              if (g.cool <= 0 && !h.safe) { g.state = "windup"; g.dodged = false; g.t = G.windup; setPose(g, 9); emit({ type: "windup", id: g.id }); }
            }
          } else {
            // back home, or stand guard with a taunt now and then
            g.state = "idle";
            const hx = g.home.x - g.x, hz = g.home.z - g.z, hd = Math.hypot(hx, hz);
            if (hd > 1.5 && g.aggro) { const st = Math.min(G.speed * dt, hd); walk(g, (hx / hd) * st, (hz / hd) * st); g.stride = G.speed; setPose(g, 0); face(g, g.home.x, g.home.z, 0.2); }
            else { g.aggro = false; g.stride = 0; setPose(g, (Math.floor(g.poseT / 4 + g.id) % 3 === 0) ? 3 : 1); if (h && d < 40) face(g, h.x, h.z, 0.05); }
          }
        }
      }
      // goons do not stand inside each other
      if (C.alive(g)) for (const o of goons) {
        if (o === g || !C.alive(o) || Math.abs(o.y - g.y) > 1) continue;
        const ex = g.x - o.x, ez = g.z - o.z, e = Math.hypot(ex, ez);
        if (e > 1e-3 && e < 0.8) walk(g, (ex / e) * (0.8 - e) * 0.5, (ez / e) * (0.8 - e) * 0.5);
      }
    }
    C.fighting = fighting;
    prune();
  };
  // a runner along his path (points on the street), at his own speed; he reports each point and the end
  function runPath(g, dt) {
    const P = g.path, q = P[g.pathI];
    if (!q) { g.stride = 0; setPose(g, 1); return; }
    const dx = q.x - g.x, dz = q.z - g.z, d = Math.hypot(dx, dz), st = Math.min(g.speed * dt, d);
    g.x += (dx / (d || 1)) * st; g.z += (dz / (d || 1)) * st;
    const tb = city.topBelow(g.x, g.y + 0.6, g.z, 0.25);
    g.y = Math.max(tb ? tb.y : 0, city.isWater(g.x, g.z) ? 0 : city.groundY(g.x, g.z));
    g.stride = g.speed; setPose(g, 0); face(g, q.x, q.z, 0.3);
    if (d < 0.6) { g.pathI++; if (g.pathI >= P.length) emit({ type: "arrived", id: g.id, group: g.group }); }
  }
  // the rope targets: the living goons near the hero that are fighting (so a quiet guard never steals a swing), and the guards
  // below a perched hero (a takedown)
  C.targets = function targets(h, R = 40) {
    const out = [];
    for (const g of goons) if (C.alive(g) && (g.aggro || g.runner || C.perched(g, h)) && Math.hypot(g.x - h.x, g.z - h.z) < R) out.push(g);
    return out;
  };
  C.info = () => ({ hp: C.hp, goons: goons.filter((g) => g.on).length, alive: goons.filter(C.alive).length, fighting: C.fighting || 0, stats: { ...C.stats },
    hits: C.hits, focus: C.focus, dodging: C.dodgeT > 0,
    list: goons.map((g) => ({ id: g.id, group: g.group, state: g.state, hp: g.hp, x: g.x, y: g.y, z: g.z, runner: g.runner, aggro: g.aggro })) });
  return C;
}
