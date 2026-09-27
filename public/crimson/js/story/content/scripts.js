// js/story/content/scripts.js : the bespoke steps of the story, as generator functions (m, step) that a
// 'script' step runs (types.js MissionRuntime m). They run on story time: they yield seconds, predicates,
// handles with `done` or null, never setTimeout or promises (G2). Each one guards the packages it uses,
// so it runs on stubs as well as on the real packages, and on autopilot (QA) it finishes at once.
//
// Some scripts start a background task (the dawn at the Y, a late subtitle, the FBI block): those belong
// to the mission that started them and end with it. Everything a script spawns (seated passengers, a
// kazoo shower) is tracked here and removed when its mission ends, the chapter changes or the story exits.
//
// This file also runs the crew on foot (ChapterDef.crew): the friends follow the hero, take seats when
// the hero gets into a vehicle, and get out again with him.
import { CREW_IDS } from '../types.js';

/* ------------------------------------------------------------------ the runtime (one per S) */
const RT = new WeakMap();
export const rt = (S) => RT.get(S);

// Autopilot: MISSIONS keeps it on S.missions (the stub's `auto`). CONTRACT REQUEST: a readable
// S.missions.auto flag; until then these two names are read.
export const isAuto = (S) => !!(S && S.missions && (S.missions.auto === true || S.missions.autopilotOn === true));

export function createRuntime(S) {
  const K = {
    S, bg: new Set(), owned: new Set(), handles: new Set(), crew: [], crewFor: null, crewPending: false, riding: null,
    timeScaled: false, hintTimer: 0, introDone: null,
    // a background task of the running mission; its errors are logged, never shown as the error card
    bgStart(name, gen) {
      const task = S.co.start((function* guard() {
        try { yield* gen; } catch (e) { console.warn(`[content] ${name}:`, e); }
      })(), `content:${name}`);
      K.bg.add(task);
      return task;
    },
    own(a) { if (a) K.owned.add(a); return a; },
    hold(h) { if (h) K.handles.add(h); return h; },
    // the mission ended (passed, failed, retried) or the chapter changed: stop what the scripts left running
    endMission() {
      for (const t of K.bg) if (!t.done) t.cancel();
      K.bg.clear();
      for (const h of K.handles) { try { if (h.stop) h.stop(); } catch (e) { /* already gone */ } }
      K.handles.clear();
      for (const a of K.owned) {
        try { if (S.drive && S.drive.unseat) S.drive.unseat(a, { keep: true }); if (S.cast) S.cast.despawn(a); } catch (e) { /* already gone */ }
      }
      K.owned.clear();
      if (K.timeScaled) { S.timeScale = 1; K.timeScaled = false; }
      if (S.ui && S.ui.hint) S.ui.hint(null);
      if (S.ui && S.ui.clearMeter) { S.ui.clearMeter('rock'); S.ui.clearMeter('rocks'); }
    },
    clearCrew() {
      for (const a of K.crew) {
        try { if (S.drive && S.drive.unseat) S.drive.unseat(a, { keep: true }); if (S.cast) { S.cast.followers.remove(a); S.cast.despawn(a); } } catch (e) { /* already gone */ }
      }
      K.crew = []; K.riding = null;
    },
  };
  RT.set(S, K);

  S.bus.on('mission', (e) => { if (e && e.state && e.state !== 'start') K.endMission(); });
  S.bus.on('fail', () => K.endMission());
  S.bus.on('chapter', (e) => {
    K.endMission(); K.clearCrew();
    const C = S.content && S.content.CHAPTERS[e && e.id];
    K.crewFor = C && C.crew && C.crew.length && !C.arena ? C : null;
    K.crewPending = !!K.crewFor;
    if (S.ui && S.ui.stamp) S.ui.stamp(null);
  });
  S.bus.on('pass', (e) => { if (e && e.id === K.introDone) K.introDone = null; });
  S.bus.on('start', () => { K.endMission(); K.clearCrew(); K.crewFor = null; K.crewPending = false; K.introDone = null; });
  S.bus.on('exit', () => { K.endMission(); K.clearCrew(); K.crewFor = null; K.crewPending = false; K.introDone = null; if (S.ui && S.ui.stamp) S.ui.stamp(null); });

  // the crew on foot: spawn them once the hero stands in the chapter's world, seat them when he rides
  S.register('control', () => {
    if (K.crewPending) spawnCrew(K);
    if (!K.crew.length || !S.drive) return;
    const v = S.drive.riding || null;
    if (v && K.riding !== v) { K.riding = v; seatCrew(K, v); }
    else if (!v && K.riding && S.hero && S.hero.mode === 'foot') { K.riding = null; unseatCrew(K); }
  }, 5);
  return K;
}

function spawnCrew(K) {
  const S = K.S, H = S.hero, C = K.crewFor;
  if (!C || !H || !H.actor || !S.world || !S.world.visible || S.mode !== 'play' || (S.cine && S.cine.active)) return;
  K.crewPending = false;
  const body = H.body || CREW_IDS[S.ctx.crewPick];
  const ids = C.crew.filter((id) => id !== body);
  const f = H.face || 0;
  ids.forEach((id, i) => {
    const row = Math.floor(i / 2) + 1, side = i % 2 ? -1 : 1;
    const x = H.pos.x - Math.sin(f) * 1.8 * row + Math.cos(f) * 1.1 * side, z = H.pos.z - Math.cos(f) * 1.8 * row - Math.sin(f) * 1.1 * side;
    const a = S.cast.spawn(id, { pos: { x, y: H.pos.y, z }, yaw: f });
    if (!a) return;
    a.crewId = id;
    K.crew.push(a);
    S.cast.followers.add(a, { slot: i });
  });
}
function seatCrew(K, v) {
  const S = K.S;
  for (const a of K.crew) {
    S.cast.followers.remove(a);
    const k = v.seats ? v.seats.findIndex((s, j) => j >= 1 && !s) : -1;
    if (k >= 1 && S.drive.seat) S.drive.seat(a, v, k); else a.visible = false;
  }
}
function unseatCrew(K) {
  const S = K.S;
  for (const a of K.crew) {
    if (S.drive.unseat) S.drive.unseat(a);
    a.visible = true;
    const H = S.hero, dx = a.root.position.x - H.pos.x, dz = a.root.position.z - H.pos.z;
    if (!Number.isFinite(dx) || Math.hypot(dx, dz) > 12) a.root.position.set(H.pos.x - Math.sin(H.face || 0) * 2, H.pos.y, H.pos.z - Math.cos(H.face || 0) * 2);
    S.cast.followers.add(a);
  }
}

/* ------------------------------------------------------------------ helpers */
const near = (a, b, r) => !!a && !!b && Math.hypot(a.x - b.x, a.z - b.z) <= r;
// a place id, a spawn or cairn id, or {x, z}
function pt(S, ref) {
  if (!ref) return null;
  if (typeof ref === 'string') { const p = S.world && S.world.place ? S.world.place(ref) : null; return p ? { x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0, r: p.r || 8 } : null; }
  return { x: ref.x, y: ref.y, z: ref.z, yaw: ref.yaw || 0, r: ref.r || 8 };
}
// a spawn of this mission (spawning it if the engine has not), else the player's vehicle for 'van'
function get(m, ref) {
  if (!ref) return null;
  const o = (m.get && m.get(ref)) || (m.spawn && m.spawn(ref)) || null;
  if (o) return o;
  return ref === 'van' || ref === 'player' ? m.S.vehicles.player : null;
}
const argsOf = (s) => (s && s.args) || {};
const lineText = (S, id) => (S.content && S.content.line ? S.content.line(id) : String(id));
// wait for a handle; on autopilot finish every open dialogue and card at once
function* waitH(S, h) { while (h && !h.done) { if (isAuto(S) && S.ui && S.ui.advanceAll) S.ui.advanceAll(); yield null; } }
function say(m, lines, o) { const S = m.S; return m.say ? m.say([].concat(lines), o) : S.ui.say([].concat(lines), o); }
function cineOf(m, id) { const S = m.S; return m.cine ? m.cine(id) : S.cine.play(id); }
const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
// drive v along a route by the mission drivers; returns the handle, or null on stubs without drivers
function routeTo(K, v, to, o = {}) {
  const S = K.S;
  if (!v || !S.drivers || !S.drivers.route) return null;
  try { return K.hold(S.drivers.route(v, to, { lane: true, ...o })); } catch (e) { console.warn('[content] route', e); return null; }
}
// a soft round glow for sprites (made once, in the page; this file also loads in Node for the QA lint)
let glow = null;
function glowTex(THREE) {
  if (glow) return glow;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glow = new THREE.CanvasTexture(c);
  return glow;
}
function stopV(S, v) { if (!v) return; try { if (S.drivers && S.drivers.stop) S.drivers.stop(v); } catch (e) { /* no driver */ } v.controls.throttle = 0; v.controls.brake = 1; }
function teleportV(S, v, p, yaw) { if (v && p && v.setPose) v.setPose(p.x, p.z, yaw ?? p.yaw ?? v.yaw, p.y); }

/* ------------------------------------------------------------------ the scripts */
export const SCRIPTS = {
  // The chapter card (CHAPTER n, the title, the time), the memory camcorder stamp, then the chapter's intro
  // cine when it has one (skipped on autopilot).
  // A RETRY of the chapter does not show them again.
  *intro(m, s) {
    const S = m.S, K = rt(S), C = (S.content.CHAPTERS[m.def.chapter] || {}), a = argsOf(s);
    if (S.ui.stamp) S.ui.stamp(C.stamp || null);
    if (K.introDone === m.def.chapter) return;
    K.introDone = m.def.chapter;
    const h = S.ui.card('chapter', { n: C.n, title: String(C.title || '').toUpperCase(), sub: C.sub || '', kanji: C.kanji || '', dur: 3.2 });
    yield* waitH(S, h);
    // an error card (or the menu) came up over the card: no intro cine; RETRY restarts the chapter anyway
    let cut = false;
    while (S.ui.modalOpen && S.ui.modalOpen()) { cut = true; yield null; }
    if (cut) { yield null; yield null; return; }
    if (a.cine && S.content.CINES[a.cine] && !isAuto(S)) yield cineOf(m, a.cine);
  },

  // E1: "Kasa hats on." (args.lines), then the hero and the crew on foot put the kasa on for the last photo
  // (each one's own cap folds away under it: one hat each)
  *kasaOn(m, s) {
    const S = m.S, K = rt(S), args = argsOf(s);
    if (args.lines) yield* waitH(S, say(m, args.lines));
    if (!S.cast || !S.cast.props) return;
    for (const a of new Set([S.hero && S.hero.actor, ...(K ? K.crew : [])])) if (a && a.root && CREW_IDS.includes(a.id) && !(a.props && a.props.kasa)) S.cast.props.attach(a, 'kasa');
  },

  // The credits roll on story time (design 2.5 E1); KEEP PLAYING goes on to free roam.
  *credits(m) {
    const S = m.S, C = S.content.CREDITS;
    let again = false;
    S.mode = 'credits';
    const st = (S.save && S.save.get && S.save.get().stats) || null;
    const result = { ...C.result };
    if (st && (st.deflects || st.takedowns || st.photos)) result.stats = `${st.deflects || 0} DEFLECTS · ${st.takedowns || 0} TAKEDOWNS · ${st.photos || 0} PHOTOS`;
    const roll = S.ctx.rollCredits({ crew: S.ctx.CREW, pick: S.ctx.crewPick, touch: document.body.classList.contains('touch'), result, blocks: C.blocks, note: C.note, againLabel: C.againLabel, now: () => S.time * 1000, onAgain: () => { again = true; } });
    S.test.credits = roll;
    try {
      while (!again) {
        if (S.input.pressed('skip') || S.input.pressed('use') || S.input.pressed('pause')) { S.input.consume('skip', 'use', 'exit', 'pause'); if (roll.atEnd) again = true; else roll.skip(); }
        yield null;
      }
    } finally { roll.stop(); S.test.credits = null; S.mode = 'play'; }
  },

  // F1: the roof box pops at Mask & Mayhem and 51 party kazoos scatter over Sedona (E8)
  *kazooScatter(m) {
    const S = m.S, K = rt(S), v = S.vehicles.player || get(m, 'van'), THREE = S.THREE;
    S.flags.kazoosOut = true;
    if (S.audio) S.audio.sfx('kazoo', v ? { at: v.pos } : {});
    say(m, ['f1.kazoos', 'f1.toast'], { block: false });
    if (S.ui.toast) S.ui.toast(lineText(S, 'f1.kazooRule'));
    if (!v || isAuto(S) || !S.cast || !S.cast.props || !S.world || !S.world.group) return;
    // a short shower of kazoos off the roof box; the collectibles themselves are free roam's
    const bits = [];
    for (let i = 0; i < 14; i++) {
      let g = null;
      try { g = S.cast.props.make('kazoo'); } catch (e) { break; }
      g.position.set(v.pos.x, v.pos.y + 2.7, v.pos.z);
      g.userData.vel = new THREE.Vector3(Math.sin(i * 2.4) * (2 + (i % 3)), 4 + (i % 4), Math.cos(i * 2.4) * (2 + (i % 3)));
      g.userData.spin = new THREE.Vector3((i % 5) - 2, (i % 3) - 1, (i % 4) - 1.5).multiplyScalar(3);
      S.world.group.add(g); bits.push(g);
    }
    K.bgStart('kazoos', (function* shower() {
      let t = 0; const t0 = S.time;
      try {
        while ((t = S.time - t0) < 2.2) {
          const dt = 1 / 60;
          for (const g of bits) {
            const u = g.userData, fl = S.world.surface(g.position.x, g.position.z, g.position.y + 0.5) + 0.03;
            if (g.position.y > fl || u.vel.y > 0) { u.vel.y -= 9.8 * dt; g.position.addScaledVector(u.vel, dt); g.rotation.x += u.spin.x * dt; g.rotation.y += u.spin.y * dt; g.rotation.z += u.spin.z * dt; }
            if (g.position.y < fl) { g.position.y = fl; u.vel.set(0, 0, 0); }
          }
          yield null;
        }
      } finally { for (const g of bits) { g.removeFromParent(); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } }
    })());
  },

  // F1: the slow drift over Midgley Bridge (cinematic time on the deck) and Fifty-One's line
  *bridgeDrift(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), A = pt(S, a.from), B = pt(S, a.to), v = S.vehicles.player;
    if (!A || !B || !v) return;
    if (isAuto(S)) { teleportV(S, v, B, yawTo(A, B)); return; }
    const mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
    const t0 = S.time;
    while (!near(v.pos, mid, 42) && S.time - t0 < 90) { if (near(v.pos, B, 20)) break; yield null; }
    try {
      if (near(v.pos, mid, 42)) {
        K.timeScaled = true; S.timeScale = 0.45;
        if (a.line) say(m, [a.line], { block: false });
        yield 1.4; // story seconds: about 3 real seconds at 0.45
      }
    } finally { S.timeScale = 1; K.timeScaled = false; }
    const t1 = S.time;
    while (!near(v.pos, B, 22) && S.time - t1 < 40) yield null;
  },

  // F2: Gabe drives the orange tour jeep up Schnebly Hill; the hero rides and films
  *rideAlong(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), v = get(m, a.vehicle), to = pt(S, a.to), gabe = get(m, 'gabe');
    if (!v || !to) return;
    if (gabe && S.drive && S.drive.seat && !v.seats[0]) S.drive.seat(gabe, v, 0);
    if (isAuto(S)) { teleportV(S, v, to); return; }
    const h = routeTo(K, v, a.to, { r: 10, speed: 13 });
    const t0 = S.time;
    while (!(h && h.done) && !near(v.pos, to, 14) && S.time - t0 < 170) yield null;
    stopV(S, v);
    while (Math.abs(v.speed) > 0.5 && S.time - t0 < 175) yield null;
    if (gabe && S.drive && S.drive.unseat) S.drive.unseat(gabe);
  },

  // F2: the black SUV drives along 89A below the race (Gabe stops at gate 7 to shoot it)
  *suvBelow(m, s) {
    const S = m.S, K = rt(S), v = get(m, argsOf(s).vehicle);
    if (!v || isAuto(S)) return;
    routeTo(K, v, [{ x: 230, z: -95 }, { x: 330, z: -170 }, { x: 390, z: -300 }], { speed: 11, r: 8 });
  },

  // step into or out of an interior (the bar, the Airstream) behind a quick fade
  *room(m, s) {
    const S = m.S, a = argsOf(s), I = S.world && S.world.interiors;
    if (!I || !S.hero) return;
    const auto = isAuto(S);
    if (!auto && S.ui.fade) yield S.ui.fade(1, 0.35);
    const p = a.enter ? I.enter(a.id) : I.exit(a.id);
    if (p) { S.hero.place(p.x, p.z, p.yaw, p.y ?? undefined); if (S.hero.resetGround) S.hero.resetGround(); }
    if (a.look && S.look) S.look.set(a.look, { dur: 0 });
    if (S.ui.fade) { const h = S.ui.fade(0, auto ? 0 : 0.45); if (!auto) yield h; }
  },

  // F4: the hangover look; a sip from the canteen clears it
  *hangover(m) {
    const S = m.S, H = S.hero;
    if (!H) return;
    H.hp = Math.min(H.hp, Math.round(H.maxHp * 0.6));
    const c0 = H.canteen;
    if (S.ui.hint) S.ui.hint('Your head hurts. Press {canteen} to drink.');
    const t0 = S.time;
    while (!(H.canteen < c0 || H.hp >= H.maxHp * 0.95) && !isAuto(S) && S.time - t0 < 120) yield null;
    if (S.ui.hint) S.ui.hint(null);
    if (S.look) S.look.set('MEMORY', { dur: 2.5 });
  },

  // F4: rock the van out of Oak Creek. A swing meter; hit the gas on each forward swing. The bumper stays.
  *rockVan(m, s) {
    const S = m.S, a = argsOf(s), v = get(m, a.vehicle) || S.vehicles.player, to = pt(S, a.to), need = a.rocks || 4;
    if (!v) return;
    const finish = () => {
      if (to) teleportV(S, v, { x: to.x + 4, z: to.z - 8, y: to.y }, 2.6);
      if (v.setLook) v.setLook({ noBumper: true });
      if (S.audio) S.audio.sfx('bump', { at: v.pos });
    };
    if (isAuto(S)) { finish(); return; }
    let good = 0, cool = 0, misses = 0, last = S.time;
    const band = { near: 0.72, far: 0.97 }, hold = { x: v.pos.x, z: v.pos.z, y: v.pos.y, yaw: v.yaw }, t0 = S.time;
    try {
      while (good < need) {
        teleportV(S, v, hold, hold.yaw); // stuck nose-down until it rocks free
        const t = S.time - t0; cool -= S.time - last; last = S.time;
        const ph = 0.5 + 0.5 * Math.sin(t * 2.6); // the swing, about 2.4 s a rock
        S.ui.meter('rock', ph, { kind: 'band', near: band.near, far: band.far, max: 1, label: 'ROCK', text: '', crimson: true });
        S.ui.meter('rocks', good, { pips: need, label: 'OUT' });
        if (S.input.pressed('gas') || S.input.pressed('light') || S.input.pressed('use')) {
          S.input.consume('gas', 'light');
          if (cool <= 0 && ph >= band.near) { good++; cool = 0.6; if (S.audio) S.audio.sfx('bump', { at: v.pos }); if (S.ctx.fx && S.ctx.fx.dust) S.ctx.fx.dust({ x: v.pos.x, y: v.pos.y, z: v.pos.z, groundY: v.pos.y }, 8); }
          else if (cool <= 0) { misses++; cool = 0.4; if (S.ui.toast) S.ui.toast('Too early. Wait for the swing.'); }
        }
        if (misses > 6 && good === 0 && S.ui.hint) S.ui.hint('Press the gas when the dot is in the red band.');
        yield null;
      }
    } finally { S.ui.clearMeter('rock'); S.ui.clearMeter('rocks'); if (S.ui.hint) S.ui.hint(null); }
    if (S.ui.fade) yield S.ui.fade(1, 0.3);
    finish();
    if (S.ui.fade) yield S.ui.fade(0, 0.4);
  },

  // P1: the dawn drains the ink from the ground up as the van crosses the Y (a background task)
  *dawnAtY(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), at = pt(S, a.at), r = a.r || 90;
    if (!at) return;
    K.bgStart('dawn', (function* dawn() {
      const t0 = S.time;
      while (!near(S.hero.pos, at, r) && S.time - t0 < 600 && !isAuto(S)) yield 0.25;
      if (S.look && S.look.dawn) S.look.dawn(a.dur || 6);
    })());
  },

  // subtitles now, or after a while (a background task); the step itself does not wait
  *subs(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), lines = [].concat(a.lines || []);
    if (!lines.length) return;
    if (!(a.after > 0) || isAuto(S)) { say(m, lines, { block: false }); return; }
    K.bgStart('subs', (function* later() { yield a.after; say(m, lines, { block: false }); })());
  },

  // P1: pin the player's F5 photo on Gabe's wall, beside his photo of their van, and the note
  *pinWall(m, s) {
    const S = m.S, a = argsOf(s), id = S.flags[a.photo || 'f5Photo'] || null;
    S.flags.wallPins = [id || 'lost', 'gabe:van'];
    // CONTRACT REQUEST: S.evidence.pin(photoId) for MISSIONS' wall; until then content composes the board
    if (S.evidence && typeof S.evidence.pin === 'function') { S.evidence.pin(id); return; }
    const wall = S.world && S.world.interiors && S.world.interiors.wall ? S.world.interiors.wall('airstream') : null;
    if (!wall || !wall.material || (wall.userData && wall.userData.composedBy === 'missions')) return;
    composeWall(S, wall, id);
  },

  // dialogue that depends on who the player is: byPick[crewId] replaces the lines for that pick (a friend
  // never tells the player's own body to drive, and the one who stays at the ranch is never the driver)
  *sayPick(m, s) {
    const S = m.S, a = argsOf(s), body = (S.hero && S.hero.body) || CREW_IDS[S.ctx.crewPick];
    const lines = (a.byPick && a.byPick[body]) || a.lines || [];
    yield* waitH(S, say(m, lines, a.block === false ? { block: false } : undefined));
  },

  // P1: who speaks first after the note (the choice sets S.flags.p1First)
  *firstWords(m, s) {
    const S = m.S, a = argsOf(s), order = (a.order && a.order[S.flags.p1First]) || (a.order && Object.values(a.order)[0]) || [];
    yield* waitH(S, say(m, order));
  },

  // a hint line for a while (key names follow the device: {bearcall} is G, the d-pad up or 熊)
  *hint(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s);
    if (!S.ui.hint) return;
    S.ui.hint(a.text || null);
    const mine = ++K.hintTimer;
    K.bgStart('hint', (function* off() { yield a.sec || 6; if (K.hintTimer === mine) S.ui.hint(null); })());
  },

  // a vehicle drives in and stops (Voss's SUV, Rattler's pickup, Vance's FBI SUV); show: an actor steps out
  *arrive(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), v = get(m, a.vehicle), to = pt(S, a.to);
    if (!v || !to) return;
    if (a.lights) v.lights = true;
    if (isAuto(S)) teleportV(S, v, to, yawTo(v.pos, to));
    else {
      const h = routeTo(K, v, a.to, { r: 5, speed: 12 });
      const t0 = S.time;
      while (!(h && h.done) && !near(v.pos, to, 7) && S.time - t0 < 30) yield null;
      if (!near(v.pos, to, 30)) teleportV(S, v, to, yawTo(v.pos, to));
      stopV(S, v);
    }
    const who = a.show ? get(m, a.show) : null;
    if (who && who.root) {
      const side = { x: v.pos.x + Math.cos(v.yaw) * 1.8, z: v.pos.z - Math.sin(v.yaw) * 1.8 };
      who.root.position.set(side.x, S.world.surface(side.x, side.z, v.pos.y + 1), side.z);
      who.root.rotation.y = v.yaw + Math.PI / 2;
      who.visible = true;
    }
  },

  // P9: the convoy leaves for FR 9 (Voss's SUV leads, the van with four people, the guard pickup)
  *convoy(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), list = (a.vehicles || []).map((id) => get(m, id)).filter(Boolean);
    if (list.length < 2 || !S.drivers || !S.drivers.convoy || isAuto(S)) return;
    try { K.hold(S.drivers.convoy(list, a.to, { speed: 13, gap: 20 })); } catch (e) { console.warn('[content] convoy', e); }
  },

  // P9: the rule on screen: do not touch the white van (E4)
  *rule(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), text = lineText(S, a.line);
    if (S.ui.toast) S.ui.toast(text, true);
    if (S.ui.hint) {
      S.ui.hint(text);
      const mine = ++K.hintTimer;
      K.bgStart('rule', (function* off() { yield a.sec || 10; if (K.hintTimer === mine) S.ui.hint(null); })());
    }
  },

  // P9: Gabe's orange jeep sideways across Midgley Bridge; he roars down the pipe; the SUV turns back and
  // the van with the people rolls to a stop at the block (E4: a slow follow, no ramming)
  *bridgeBlock(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), at = pt(S, a.at), jeep = get(m, a.jeep), gabe = get(m, a.gabe), suv = get(m, a.suv), van = get(m, a.van);
    if (!at) return;
    const S0 = pt(S, 'midgley_deck_s'), N0 = pt(S, 'midgley_deck_n');
    const along = S0 && N0 ? yawTo(S0, N0) : 3.05;
    if (jeep) teleportV(S, jeep, at, along + Math.PI / 2);
    if (gabe && gabe.root) { gabe.root.position.set(at.x + 2.5 * Math.cos(along), at.y ?? S.world.surface(at.x, at.z, 70), at.z - 2.5 * Math.sin(along)); gabe.root.rotation.y = along + Math.PI; gabe.visible = true; }
    const stopAt = { x: at.x - Math.sin(along) * 14, z: at.z - Math.cos(along) * 14, y: at.y };
    if (isAuto(S)) {
      if (van) { teleportV(S, van, stopAt, along); stopV(S, van); }
      if (suv) teleportV(S, suv, { x: at.x - Math.sin(along) * 60, z: at.z - Math.cos(along) * 60, y: at.y }, along + Math.PI);
      return;
    }
    const lead = suv || van, t0 = S.time;
    while (lead && !near(lead.pos, at, 70) && S.time - t0 < 180) yield null;
    say(m, ['p9.jeep'], { block: false });
    // Gabe's bear call: the pipe, the roar, neon rings
    if (gabe && S.cast && S.cast.props) { try { S.cast.props.attach(gabe, 'pvcPipe', 'RightHand'); } catch (e) { /* no prop */ } }
    if (gabe && gabe.play) gabe.play('gabe:call', { loop: false, restart: true });
    if (S.audio) { S.audio.sfx('pipe', { at }); S.audio.sfx('roar', { at }); }
    if (S.ctx.fx && S.ctx.fx.ring) for (const r of [4, 7, 10]) S.ctx.fx.ring({ x: at.x, y: at.y, z: at.z, groundY: at.y ?? 0 }, r, 0.9);
    yield 0.8;
    if (suv) { routeTo(K, suv, [{ x: suv.pos.x - Math.sin(along) * 30, z: suv.pos.z - Math.cos(along) * 30 }, 'uptown'], { speed: 16 }); say(m, ['p9.uturn'], { block: false }); }
    if (van) routeTo(K, van, [stopAt], { speed: 5, r: 3 });
    const t1 = S.time;
    while (van && !near(van.pos, stopAt, 4) && S.time - t1 < 40) yield null;
    if (van) stopV(S, van);
    if (gabe && S.cast && S.cast.props) { try { S.cast.props.detach(gabe, 'pvcPipe'); } catch (e) { /* no prop */ } }
  },

  // P10: the generator is cut: the floodlights die, deep ink, guards see half as far
  *ranchDark(m) {
    const S = m.S;
    if (S.world && S.world.ranch) S.world.ranch.lights(false);
    if (S.look) S.look.set('DEEP_INK', { dur: 1 });
    if (S.stealth) S.stealth.deepInk = true;
    S.flags.ranchDark = true;
    if (S.audio) S.audio.sfx('bump', { at: S.hero.pos });
  },

  // P11: the boss is down after the finisher; zip-tie him
  *tieBoss(m) {
    const S = m.S, C = S.combat;
    if (!C) return;
    const b = C.boss || (C.enemies || []).find((f) => f.boss && !f.tied);
    if (b && !b.tied && C.tie) C.tie(b);
  },

  // P12: at the FR 9 junction a gang pickup tries to cut in; two FBI SUVs block it (a background task)
  *fbiBlock(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), at = pt(S, a.at), pk = get(m, a.pickup), fbi = (a.fbi || []).map((id) => get(m, id)).filter(Boolean);
    if (!at || !pk) return;
    for (const f of fbi) f.lights = true;
    K.bgStart('fbi', (function* block() {
      const P = () => S.vehicles.player;
      while (!(P() && near(P().pos, at, 150)) && !isAuto(S)) yield 0.2;
      const pl = P();
      if (pl && S.drivers && S.drivers.pursue && !isAuto(S)) { try { K.hold(S.drivers.pursue(pk, pl, { ram: false })); } catch (e) { /* no driver */ } }
      fbi.forEach((f, i) => { f.siren = true; routeTo(K, f, [{ x: at.x + (i ? 8 : -6), z: at.z + 18 + i * 6 }], { speed: 20, r: 4 }); });
      if (S.audio) S.audio.sfx('siren', { at });
      const t0 = S.time;
      while (!fbi.some((f) => near(f.pos, pk.pos, 10)) && S.time - t0 < 14 && !isAuto(S)) yield null;
      stopV(S, pk);
      if (a.line) say(m, [a.line], { block: false });
    })());
  },

  // seat people in a vehicle for a drive (hidden behind the tinted glass except the front seat)
  // args: {vehicle, list: [{seat, who}]}; who: a cast id, 'civ' (a civilian body) or 'pick'
  *seats(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), v = get(m, a.vehicle || 'van') || S.vehicles.player;
    if (!v || !S.drive || !S.drive.seat) return;
    let civ = 0;
    for (const e of a.list || []) {
      let id = e.who === 'pick' ? CREW_IDS[S.ctx.crewPick] : e.who, variant;
      if (e.who === 'civ') { const k = civ++; id = k % 2 ? 'civB' : 'civA'; variant = Math.floor(k / 2) % Math.max(1, S.cast.variants ? S.cast.variants(id) : 1); }
      if (id === (S.hero && S.hero.body)) continue;
      const act = K.own(S.cast.spawn(id, { pos: v.pos, yaw: v.yaw, costume: false, ...(variant != null ? { variant } : {}) }));
      if (act) S.drive.seat(act, v, e.seat);
    }
  },

  // P12: ten seats full. The pick drives; Tank Top stays at the ranch to guard (E7), or New Balance when
  // the player is Tank Top; the other three friends and the six freed people fill the van.
  *tenSeats(m, s) {
    const S = m.S, a = argsOf(s), body = (S.hero && S.hero.body) || CREW_IDS[S.ctx.crewPick];
    const stays = body === 'tanktop' ? 'newbalance' : 'tanktop';
    const friends = CREW_IDS.filter((id) => id !== body && id !== stays);
    const list = [{ seat: 1, who: friends[0] }, ...[2, 3, 4, 5, 6, 7].map((seat) => ({ seat, who: 'civ' })), { seat: 8, who: friends[1] }, { seat: 9, who: friends[2] }];
    S.flags.stayed = stays;
    yield* SCRIPTS.seats(m, { args: { vehicle: a.vehicle || 'whale', list } });
  },

  // friends who wait at a spot (the campfire, the ranch yard): every listed crew id but the hero's own
  // body stands in a ring around `at`, facing in; pose: a procedural pose (sit, talk). They go when the
  // mission ends.
  *crew(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), at = pt(S, a.at), body = (S.hero && S.hero.body) || CREW_IDS[S.ctx.crewPick];
    if (!at || !S.cast) return;
    const ids = (a.ids || []).filter((id) => id !== body), r = a.r || 2.2;
    ids.forEach((id, i) => {
      const ang = (a.from || 0) + (i / Math.max(1, ids.length)) * (a.arc || Math.PI * 1.2);
      const x = at.x + Math.sin(ang) * r, z = at.z + Math.cos(ang) * r;
      const act = K.own(S.cast.spawn(id, { pos: { x, y: at.y, z }, yaw: ang + Math.PI }));
      if (act && a.pose) S.cast.pose(act, a.pose, 1);
    });
  },

  // P6: a campfire by the A-frame (logs and three flickering flames, the crackle); it goes with the mission
  *campfire(m, s) {
    const S = m.S, K = rt(S), a = argsOf(s), at = pt(S, a.at), THREE = S.THREE;
    if (!at || !S.world || !S.world.group) return;
    const g = new THREE.Group(), y = S.world.surface(at.x, at.z, (at.y ?? 60) + 1);
    g.position.set(at.x, y, at.z);
    const wood = new THREE.MeshLambertMaterial({ color: 0x3a2a1e });
    for (let i = 0; i < 5; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.9, 6), wood);
      log.rotation.set(Math.PI / 2 - 0.35, (i / 5) * Math.PI * 2, 0); log.position.set(Math.sin(i * 1.26) * 0.18, 0.16, Math.cos(i * 1.26) * 0.18);
      g.add(log);
    }
    const stones = new THREE.MeshLambertMaterial({ color: 0x6d625a });
    for (let i = 0; i < 9; i++) { const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13, 0), stones); st.position.set(Math.sin(i * 0.7) * 0.62, 0.06, Math.cos(i * 0.7) * 0.62); g.add(st); }
    // soft flames: warm glow sprites over two thin cones (orange, never the neon hue)
    const flames = [0xff5a1e, 0xff7a2a, 0xe8401a].map((c, i) => {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.16 - i * 0.03, 0.55 - i * 0.1, 7, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      f.position.set((i - 1) * 0.08, 0.38, (i % 2) * 0.06); g.add(f); return f;
    });
    for (const [sc, yy, op] of [[1.5, 0.5, 0.55], [0.9, 0.42, 0.8]]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(THREE), color: 0xff6a24, transparent: true, opacity: op, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(sc); sp.position.y = yy; g.add(sp); flames.push(sp);
    }
    S.world.group.add(g);
    let crackle = null;
    try { if (S.audio && S.audio.loop) crackle = S.audio.loop('fire', { at: g.position }); } catch (e) { /* no sound */ }
    K.bgStart('campfire', (function* burn() {
      try {
        for (;;) {
          const t = S.time;
          flames.forEach((f, i) => {
            const k = 0.85 + 0.2 * Math.sin(t * (9 + i * 3.1) + i) + 0.08 * Math.sin(t * 23 + i * 2);
            if (f.isSprite) f.material.opacity = (i === 3 ? 0.5 : 0.75) * k; else { f.scale.set(1, k, 1); f.rotation.y = t * (0.6 + i * 0.3); }
          });
          if (crackle && crackle.set) crackle.set({ level: 0.6 });
          yield null;
        }
      } finally {
        if (crackle && crackle.stop) crackle.stop(0.4);
        g.removeFromParent(); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); // the shared glow texture stays
      }
    })());
  },

  // one actor of the mission: a prop on or off, a pose
  *actor(m, s) {
    const S = m.S, a = argsOf(s), act = get(m, a.who);
    if (!act || !S.cast) return;
    if (a.prop) { try { if (a.on === false) S.cast.props.detach(act, a.prop); else S.cast.props.attach(act, a.prop, a.bone); } catch (e) { /* no prop */ } }
    if (a.pose) S.cast.pose(act, a.pose, a.k ?? 1);
  },

  // side content: the cairn's line before a Legend fight
  *cairn(m, s) {
    const S = m.S, a = argsOf(s);
    if (S.audio) S.audio.sfx('cairn', { at: S.hero.pos });
    yield* waitH(S, say(m, ['side.cairn', a.line].filter(Boolean)));
  },
};

/* ------------------------------------------------------------------ the evidence wall (P1) */
// Composed only when MISSIONS has not textured the wall itself: cork, string, Gabe's photos drawn in ink
// (their van at the pump, the bridge, plates), the note, and the player's own F5 photo (D7: a 'photo lost'
// card when the thumbnail is gone).
function composeWall(S, wall, photoId) {
  const THREE = S.THREE, W = 1024, H = 600;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#9a7650'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(${60 + (i * 37) % 60},${40 + (i * 13) % 30},20,0.18)`; g.fillRect((i * 97) % W, (i * 61) % H, 3, 2); }
  g.strokeStyle = '#5a3f24'; g.lineWidth = 18; g.strokeRect(9, 9, W - 18, H - 18);
  const polaroid = (x, y, w, h, rot, draw, label) => {
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = '#f2ede2'; g.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 44);
    g.fillStyle = '#1b1a1c'; g.fillRect(-w / 2, -h / 2, w, h);
    draw(-w / 2, -h / 2, w, h);
    g.fillStyle = '#2a2622'; g.font = '600 18px sans-serif'; g.textAlign = 'center'; g.fillText(label, 0, h / 2 + 26);
    g.restore();
  };
  const pin = (x, y) => { g.fillStyle = '#d2263f'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill(); };
  const vanInk = (x, y, w, h) => {
    g.fillStyle = '#e8e4da'; g.fillRect(x + w * 0.18, y + h * 0.38, w * 0.62, h * 0.3); g.fillRect(x + w * 0.66, y + h * 0.46, w * 0.16, h * 0.22);
    g.fillStyle = '#111'; for (const k of [0.3, 0.68]) { g.beginPath(); g.arc(x + w * k, y + h * 0.7, h * 0.08, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(210,38,63,0.9)'; g.fillRect(x + w * 0.2, y + h * 0.5, w * 0.58, 3);
  };
  // Gabe's photos
  polaroid(170, 170, 200, 130, -0.05, vanInk, 'SUN 2:54 AM');
  polaroid(430, 150, 180, 120, 0.04, (x, y, w, h) => { g.strokeStyle = '#ddd'; g.lineWidth = 4; g.beginPath(); g.arc(x + w / 2, y + h * 1.1, w * 0.46, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.fillRect(x, y + h * 0.4, w, 4); }, 'MIDGLEY');
  polaroid(170, 430, 170, 110, 0.06, (x, y, w, h) => { g.fillStyle = '#e8e4da'; g.fillRect(x + 20, y + h * 0.4, w - 40, h * 0.28); g.fillStyle = '#111'; g.font = '700 22px monospace'; g.textAlign = 'center'; g.fillText('4471', x + w / 2, y + h * 0.6); }, 'PLATES');
  // the note
  g.save(); g.translate(430, 420); g.rotate(-0.03); g.fillStyle = '#f6f1dc'; g.fillRect(-120, -70, 240, 150);
  g.fillStyle = '#20314f'; g.font = '700 22px sans-serif'; g.textAlign = 'center';
  ['HELP. RANCH. FR 9.', '10 OF US.', 'DANA.'].forEach((t, i) => g.fillText(t, 0, -26 + i * 34)); g.restore();
  // the player's own photo, beside Gabe's photo of the van: "Two photos. Same minute. Wrong people."
  const slot = { x: 780, y: 200, w: 300, h: 170 };
  const drawSlot = (img) => {
    polaroid(slot.x, slot.y, slot.w, slot.h, 0.03, (x, y, w, h) => {
      if (img) g.drawImage(img, x, y, w, h);
      else { g.fillStyle = '#e8e4da'; g.font = '700 26px sans-serif'; g.textAlign = 'center'; g.fillText('PHOTO LOST', x + w / 2, y + h / 2 + 8); }
    }, 'SUN 2:54 AM · YOURS');
    pin(slot.x, slot.y - slot.h / 2 - 4);
    tex.needsUpdate = true;
  };
  g.strokeStyle = '#d2263f'; g.lineWidth = 3; g.beginPath(); g.moveTo(170, 110); g.lineTo(780, 120); g.lineTo(430, 360); g.lineTo(170, 380); g.stroke();
  for (const [x, y] of [[170, 100], [430, 86], [170, 370], [430, 350]]) pin(x, y);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const url = photoId && S.photo && S.photo.thumb ? S.photo.thumb(photoId) : '';
  drawSlot(null);
  if (url) { const img = new Image(); img.onload = () => drawSlot(img); img.src = url; } // asset loading, observed by the texture flag
  const old = wall.material.map;
  wall.material.map = tex; wall.material.needsUpdate = true;
  wall.userData.composedBy = 'content';
  if (old && old !== tex && old.dispose) old.dispose();
}

// every script name the missions reference must be here; content.js checks it at init
export const SCRIPT_NAMES = Object.freeze(Object.keys(SCRIPTS));
