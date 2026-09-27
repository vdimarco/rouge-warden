// js/story/missions/cine.js : S.cine, the cut-scene player (design 4.3, types.js CineDef).
// play(id, {cast}) runs a CineDef on story time as a task (the handle is the task: {done}). Tracks:
// - shots {at, dur, from, to, look, fov, ease, shake}: the camera (priority 100) moves from -> to over dur.
//   A point is {x, y, z} in the world, a place id (eye height above it), {who, x, y, z} in that actor's
//   own frame (+z ahead of it, +x to its left) or {at: placeId, x, y, z}. look is a point the same way
//   (an actor's point defaults to 1.5 m up). ease: 'inOut' (default), 'in', 'out', 'linear'. Between
//   shots the last one holds; with no shot yet, the camera that was already running keeps the view.
// - actors {at, who, do, args}: play (clip | {clip, loop, speed, fade}), moveTo (place | {x, z} |
//   {to, speed, run}: a walk with the procedural stride), face (yaw | {who} | {x, z}), pose (name |
//   {name, k}), prop ({name, on, bone}), show, hide, glow (k), drain (k | {k, dur}: Gabe's neon over 2 s),
//   place (place | {x, z, yaw}), say (line id: a subtitle).
//   who: a key of o.cast or def.cast (a cast id, or {id, place, pos, yaw, props, costume}), 'hero' (the
//   hero's body), 'pick' (the player's friend), 'crew' (every crew member in the scene), 'van', or a cast
//   id (a live or arena actor, else one is spawned for the cine and removed after it).
// - lines {at, who, line, block}: a subtitle; block:true holds the timeline on a dialogue box.
// - looks {at, set, dur}, cards {at, kind, title, sub, kanji}, fx {at, kind, pos}, sfx {at, name}.
// - film {at, src}: the film plays through S.film and holds the timeline; if it cannot play (no codec, a
//   404, not buffered in 1.5 s) the engine does a white flash instead.
// - end {actors: {who: {place|pos, yaw, pose, clip, hide, show}}, hero: {place|pos, yaw}, van: {...},
//   look}: applied when the cine ends or is skipped. A skip also applies every actor cue it jumped over.
// The letterbox is body.cine. The hero ignores move input (S.lockControl) while a cine plays. The UI owns
// the hold-to-skip (0.8 s); S.cine.skip() ends the cine at once.
import { CAMERA_PRIO, CAST_IDS, CREW_IDS } from '../types.js';

const EASE = {
  linear: (t) => t, in: (t) => t * t, out: (t) => 1 - (1 - t) * (1 - t),
  inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
};
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createCine(S, K) {
  const { THREE } = S;
  let run = null;
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), c3 = new THREE.Vector3(), d3 = new THREE.Vector3();
  const ground = (x, z, y) => (run && run.def.arena && S.ctx.groundHeight ? S.ctx.groundHeight(x, z) : S.world.surface(x, z, y ?? Infinity));

  /* ---------------- who is who ---------------- */
  function actorOf(who) {
    if (!run) return null;
    if (run.actors.has(who)) return run.actors.get(who);
    let a = null;
    const oc = run.o.cast && run.o.cast[who], dc = run.def.cast && run.def.cast[who];
    const pickId = CREW_IDS[S.ctx.crewPick] || 'shades';
    const fromSpec = (spec) => {
      if (!spec) return null;
      if (spec.root || spec.a) return spec.a || spec; // an actor or a fighter
      if (spec.pos && spec.kind && spec.setPose) return vanWrap(spec);
      const id = typeof spec === 'string' ? spec : spec.id;
      if (!CAST_IDS.includes(id)) return null;
      if (id === S.hero.body && S.hero.actor) return S.hero.actor;
      const live = typeof spec === 'string' || !spec.fresh ? S.cast.get(id) : null;
      if (live && (live.visible || run.def.arena)) return live;
      const p = typeof spec === 'object' ? (spec.place ? S.world.place(spec.place) : spec.pos) : null;
      const at = p || { x: S.hero.pos.x, y: S.hero.pos.y, z: S.hero.pos.z };
      // (in the arena, a body joins the arena scene: the Sedona group is hidden there)
      const parent = run.def.arena ? S.ctx.arena || S.scene : undefined;
      const b = S.cast.spawn(id, { pos: { x: at.x, y: at.y ?? ground(at.x, at.z, (S.hero.pos.y || 0) + 2), z: at.z }, yaw: (typeof spec === 'object' && spec.yaw) ?? at.yaw ?? 0, props: spec.props, costume: spec.costume, arenaScale: !!run.def.arena, parent });
      if (id === 'gabe' && run.chapterDrain != null) S.cast.drain(b, run.chapterDrain);
      run.temp.push(b);
      return b;
    };
    if (oc) a = fromSpec(oc);
    else if (dc) a = fromSpec(dc);
    else if (who === 'hero') a = S.hero.actor;
    else if (who === 'pick') a = S.hero.body === pickId ? S.hero.actor : fromSpec(pickId);
    else if (who === 'van') a = S.vehicles.player ? vanWrap(S.vehicles.player) : null;
    else if (CAST_IDS.includes(who)) a = fromSpec(who);
    run.actors.set(who, a);
    return a;
  }
  // a vehicle seen as an actor: place and face move it; the rest does nothing
  function vanWrap(v) {
    return { vehicle: v, root: { get position() { return v.pos; }, rotation: { get y() { return v.yaw; }, set y(x) { v.setPose(v.pos.x, v.pos.z, x); } } }, play() {}, move() {}, isVan: true,
      set visible(x) { if (v.view && v.view.obj) v.view.obj.visible = x; else if (v.obj) v.obj.visible = x; } };
  }
  const whoList = (who) => (who === 'crew' ? CREW_IDS.filter((id) => run.actors.has(id) || (run.def.cast && run.def.cast[id]) || S.cast.get(id)) : [who]);

  /* ---------------- points ---------------- */
  function point(p, out, lookY = 0) {
    if (p == null) return null;
    if (typeof p === 'string') { const q = S.world.place(p); if (!q) return null; return out.set(q.x, q.y + 1.7, q.z); }
    if (p.who) {
      const a = actorOf(p.who); if (!a || !a.root) return null;
      const r = a.root.position, yaw = a.root.rotation.y, lx = p.x || 0, lz = p.z || 0;
      return out.set(r.x + lx * Math.cos(yaw) + lz * Math.sin(yaw), r.y + (p.y ?? lookY), r.z - lx * Math.sin(yaw) + lz * Math.cos(yaw));
    }
    if (p.at) { const q = S.world.place(p.at); if (!q) return null; return out.set(q.x + (p.x || 0), q.y + (p.y ?? 1.7), q.z + (p.z || 0)); }
    if (Number.isFinite(p.x) && Number.isFinite(p.z)) return out.set(p.x, Number.isFinite(p.y) ? p.y : ground(p.x, p.z) + 1.7, p.z);
    return null;
  }

  /* ---------------- the camera ---------------- */
  function shotAt(t) {
    const shots = run.def.shots || [];
    let cur = null;
    for (const s of shots) if (s.at <= t + 1e-6) cur = s;
    return cur;
  }
  function updateCamera() {
    if (!run) return;
    const s = shotAt(run.t);
    if (!s) return;
    const k = s.dur > 0 ? clamp((run.t - s.at) / s.dur, 0, 1) : 1, e = (EASE[s.ease] || EASE.inOut)(k);
    const from = point(s.from, a3), to = s.to ? point(s.to, b3) : null;
    if (!from) return;
    camPos.copy(from); if (to) camPos.lerp(to, e);
    const L = s.look != null ? point(s.look, c3, 1.5) : null;
    if (L) camLook.copy(L); else camLook.copy(camPos).add(d3.set(0, -0.05, -1));
    S.camera.position.copy(camPos);
    if (s.shake) S.camera.position.add(d3.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(s.shake * 0.12));
    S.camera.lookAt(camLook);
    const fov = s.fov || 50;
    if (Math.abs(S.camera.fov - fov) > 1e-3) { S.camera.fov = fov; S.camera.updateProjectionMatrix(); }
    S.focus.copy(camLook);
  }
  S.cameras.add('cine', CAMERA_PRIO.cine, () => !!run && !!shotAt(run.t), () => updateCamera());

  /* ---------------- actor cues ---------------- */
  function cue(c, skipping = false) {
    for (const who of whoList(c.who)) {
      const a = actorOf(who); if (!a) continue;
      const g = c.args;
      try {
        switch (c.do) {
          case 'play': { const o = typeof g === 'string' ? { clip: g } : g || {}; if (a.play) a.play(o.clip, { loop: o.loop, speed: o.speed, fade: o.fade ?? 0.25, restart: o.restart }); break; }
          case 'moveTo': {
            const o = typeof g === 'string' || (g && Number.isFinite(g.x)) ? { to: g } : g || {};
            const p = typeof o.to === 'string' ? S.world.place(o.to) : o.to;
            if (!p) break;
            const walk = { a, x: p.x, z: p.z, yaw: p.yaw, speed: o.speed || (o.run ? 4.6 : 1.45) };
            if (skipping) finishWalk(walk); else { run.walks = run.walks.filter((w) => w.a !== a); run.walks.push(walk); }
            break;
          }
          case 'face': {
            let yaw = null;
            if (Number.isFinite(g)) yaw = g;
            else if (g && g.who) { const b = actorOf(g.who); if (b && b.root) yaw = Math.atan2(b.root.position.x - a.root.position.x, b.root.position.z - a.root.position.z); }
            else if (g && Number.isFinite(g.x)) yaw = Math.atan2(g.x - a.root.position.x, g.z - a.root.position.z);
            else if (typeof g === 'string') { const q = S.world.place(g); if (q) yaw = Math.atan2(q.x - a.root.position.x, q.z - a.root.position.z); }
            if (yaw != null) { if (skipping) a.root.rotation.y = yaw; else { run.turns = run.turns.filter((w) => w.a !== a); run.turns.push({ a, yaw }); } }
            break;
          }
          case 'pose': { const o = typeof g === 'string' ? { name: g } : g || {}; if (!a.isVan) S.cast.pose(a, o.name, o.k ?? 1); break; }
          case 'prop': { const o = typeof g === 'string' ? { name: g } : g || {}; if (a.isVan) break; if (o.on === false) S.cast.props.detach(a, o.name); else S.cast.props.attach(a, o.name, o.bone); break; }
          case 'show': a.visible = true; break;
          case 'hide': a.visible = false; break;
          case 'glow': if (a.setGlow) a.setGlow(+g || 0); break;
          case 'drain': {
            const o = Number.isFinite(g) ? { k: g } : g || {};
            const to = clamp(o.k ?? 1, 0, 1), dur = o.dur ?? 2;
            if (skipping || dur <= 0) S.cast.drain(a, to);
            else { run.drains = run.drains.filter((w) => w.a !== a); run.drains.push({ a, from: a.drainK ?? 0, to, t: 0, dur }); }
            break;
          }
          case 'place': placeActor(a, g); break;
          case 'say': if (!skipping) S.ui.subs(who, S.content.line(typeof g === 'string' ? g : g && g.line)); break;
          default: console.warn(`[cine] unknown do '${c.do}'`);
        }
      } catch (e) { console.error(`[cine] ${run.def.id}: ${c.do} on ${who}`, e); }
    }
  }
  function placeActor(a, g) {
    if (!a || !g) return;
    const p = typeof g === 'string' ? S.world.place(g) : g;
    if (!p) return;
    if (a.isVan) { a.vehicle.setPose(p.x, p.z, p.yaw ?? a.vehicle.yaw); return; }
    const y = Number.isFinite(p.y) ? p.y : ground(p.x, p.z, (a.root.position.y || 0) + 2);
    a.root.position.set(p.x, y, p.z);
    if (p.yaw != null) a.root.rotation.y = p.yaw;
    if (a === S.hero.actor) { S.hero.pos.set(p.x, y, p.z); if (p.yaw != null) S.hero.face = p.yaw; }
  }
  function finishWalk(w) { const a = w.a; if (w.a.isVan) { a.vehicle.setPose(w.x, w.z, w.yaw ?? a.vehicle.yaw); return; } a.root.position.set(w.x, ground(w.x, w.z, a.root.position.y + 2), w.z); if (w.yaw != null) a.root.rotation.y = w.yaw; if (a.move) a.move(0); }
  function stepMotion(dt) {
    for (const w of run.walks.slice()) {
      const a = w.a, r = a.root.position, dx = w.x - r.x, dz = w.z - r.z, d = Math.hypot(dx, dz);
      if (d < 0.12 || a.isVan) { finishWalk(w); run.walks.splice(run.walks.indexOf(w), 1); continue; }
      const stepL = Math.min(d, w.speed * dt);
      r.x += dx / d * stepL; r.z += dz / d * stepL; r.y = ground(r.x, r.z, r.y + 1.5);
      a.root.rotation.y += wrap(Math.atan2(dx, dz) - a.root.rotation.y) * Math.min(1, dt * 8);
      if (a.move) a.move(d < 0.5 ? w.speed * d / 0.5 : w.speed);
    }
    for (const w of run.turns.slice()) {
      const r = w.a.root.rotation, dy = wrap(w.yaw - r.y);
      if (Math.abs(dy) < 0.01) { r.y = w.yaw; run.turns.splice(run.turns.indexOf(w), 1); continue; }
      r.y += dy * Math.min(1, dt * 6);
    }
    for (const w of run.drains.slice()) {
      w.t += dt; const k = clamp(w.t / w.dur, 0, 1);
      S.cast.drain(w.a, w.from + (w.to - w.from) * k);
      if (k >= 1) run.drains.splice(run.drains.indexOf(w), 1);
    }
  }

  /* ---------------- other tracks ---------------- */
  function fire(kind, e) {
    try {
      if (kind === 'lines') {
        const text = S.content.line(e.line);
        if (e.block) { run.hold = S.ui.say([{ who: e.who, line: e.line }], { block: true }); if (K.auto) S.ui.advanceAll(); }
        else S.ui.subs(e.who, text);
      } else if (kind === 'looks') { S.look.set(e.set, { dur: e.dur ?? 1 }); }
      else if (kind === 'cards') { run.card = S.ui.card(e.kind || 'title', { title: e.title, sub: e.sub, kanji: e.kanji, n: e.n, dur: e.dur }); }
      else if (kind === 'fx') { fxAt(e); }
      else if (kind === 'sfx') { if (S.audio) S.audio.sfx(e.name, e.pos ? { at: point(e.pos, a3) } : {}); }
    } catch (err) { console.error(`[cine] ${run.def.id}: ${kind}`, err); }
  }
  function fxAt(e) {
    if (e.kind === 'flash') { if (S.look && S.look.base) S.look.base.flash = 1; return; }
    const F = S.ctx.fx; if (!F || typeof F[e.kind] !== 'function') return;
    const p = point(e.pos || 'hero', a3) || (S.hero ? a3.copy(S.hero.pos) : a3.set(0, 0, 0));
    const g = ground(p.x, p.z, p.y + 1);
    const at = { x: p.x, y: e.pos && Number.isFinite(e.pos.y) ? p.y : g + 0.6, z: p.z, groundY: g };
    if (e.kind === 'ring' || e.kind === 'blast') F[e.kind](at, e.size || 2, 0.6); else if (e.kind === 'splat') F.splat(at, e.size || 2, g); else F[e.kind](at, e.n || 14, e.size || 1);
  }
  const TRACKS = ['lines', 'looks', 'cards', 'fx', 'sfx'];

  /* ---------------- the run ---------------- */
  function* play(def, o) {
    const r = run = { def, o, t: 0, actors: new Map(), temp: [], walks: [], turns: [], drains: [], hold: null, card: null, skip: false, next: {}, film: null, done: false,
      chapterDrain: (S.content.CHAPTERS[S.missions.chapter] || {}).drain };
    for (const k of ['actors', ...TRACKS]) r.next[k] = 0;
    const sorted = {};
    for (const k of ['actors', ...TRACKS]) sorted[k] = (def[k] || []).slice().sort((a, b) => a.at - b.at);
    r.sorted = sorted;
    P.active = true; S.lockControl = true;
    document.body.classList.add('cine');
    if (def.look) S.look.set(def.look, { dur: 0 });
    K.log('cine', def.id, 'start');
    let last = S.timers.now;
    try {
      for (;;) {
        if (r.skip) break;
        const now = S.timers.now, dt = Math.max(0, now - last); last = now;
        if (r.hold) { if (K.auto) S.ui.advanceAll(); if (!r.hold.done) { yield null; continue; } r.hold = null; }
        if (r.film) {
          if (!r.film.done) { if (K.auto) S.film.skip(); yield null; continue; }
          if (!r.film.played && S.look && S.look.base) S.look.base.flash = 1; // the engine's white flash stands in
          r.film = null;
        }
        r.t += dt;
        for (const k of ['actors', ...TRACKS]) {
          const list = sorted[k];
          while (r.next[k] < list.length && list[r.next[k]].at <= r.t + 1e-6) { const e = list[r.next[k]++]; if (k === 'actors') cue(e); else fire(k, e); if (r.hold) break; }
        }
        if (def.film && !r.filmDone && def.film.at <= r.t + 1e-6) { r.filmDone = true; r.film = S.film.play(def.film.src, { wait: def.film.wait ?? 1.5 }); }
        stepMotion(dt);
        if (r.t >= def.dur && !r.hold && !r.film) break;
        if (K.auto && r.t > 0.05) { r.skip = true; break; }
        yield null;
      }
      finish(r);
    } finally {
      if (!r.done) finish(r, true);
    }
  }
  // the end state: every cue it skipped, then def.end
  function finish(r, aborted = false) {
    if (r.done) return;
    r.done = true;
    try {
      if (r.hold && !r.hold.done) S.ui.advanceAll();
      if (r.film && !r.film.done) S.film.skip();
      if (!aborted) {
        for (const e of r.sorted.actors.slice(r.next.actors)) if (e.do !== 'say') cue(e, true);
        for (const w of r.walks) finishWalk(w);
        for (const w of r.drains) S.cast.drain(w.a, w.to);
        for (const w of r.turns) w.a.root.rotation.y = w.yaw;
        const looks = r.sorted.looks, lastLook = looks.length && r.next.looks < looks.length ? looks[looks.length - 1].set : null;
        const end = r.def.end || {};
        if (end.look) S.look.set(end.look, { dur: 0.4 }); else if (lastLook) S.look.set(lastLook, { dur: 0.4 });
        for (const [who, st] of Object.entries(end.actors || {})) for (const w of whoList(who)) applyEnd(actorOf(w), st, who);
        if (end.hero && S.hero) { const p = typeof end.hero === 'string' ? S.world.place(end.hero) : end.hero.place ? { ...S.world.place(end.hero.place), ...(end.hero.yaw != null ? { yaw: end.hero.yaw } : {}) } : end.hero.pos || end.hero; if (p && Number.isFinite(p.x)) S.hero.place(p.x, p.z, p.yaw ?? S.hero.face, Number.isFinite(p.y) ? p.y + 1 : undefined); }
        if (end.van && S.vehicles.player) { const p = typeof end.van === 'string' ? S.world.place(end.van) : end.van.place ? S.world.place(end.van.place) : end.van.pos || end.van; if (p && Number.isFinite(p.x)) S.vehicles.player.setPose(p.x, p.z, end.van.yaw ?? p.yaw ?? S.vehicles.player.yaw); }
        if (r.card && !r.card.done && r.skip) S.ui.advanceAll();
      }
      // actors the cine brought in go (unless the end state keeps them)
      const keep = new Set(Object.keys((r.def.end && r.def.end.actors) || {}).filter((w) => r.def.end.actors[w] && r.def.end.actors[w].keep).map((w) => actorOf(w)));
      for (const a of r.temp) if (!keep.has(a)) S.cast.despawn(a); else K.adopt(a);
      if (S.hero && S.hero.actor && S.hero.mode === 'foot' && S.hero.resetGround) { S.hero.pos.copy(S.hero.actor.root.position); S.hero.resetGround(); }
    } catch (e) { console.error(`[cine] ${r.def.id}: end state`, e); }
    if (run === r) run = null;
    P.active = false; S.lockControl = false;
    document.body.classList.remove('cine');
    K.log('cine', r.def.id, r.skip ? 'skipped' : 'end');
  }
  function applyEnd(a, st, who) {
    if (!a || !st) return;
    if (st.place || st.pos) placeActor(a, st.place ? { ...S.world.place(st.place), ...(st.yaw != null ? { yaw: st.yaw } : {}) } : { ...st.pos, yaw: st.yaw ?? st.pos.yaw });
    else if (st.yaw != null) a.root.rotation.y = st.yaw;
    if (st.clip && a.play) a.play(st.clip, { fade: 0.2 });
    if (st.pose) S.cast.pose(a, st.pose, 1);
    if (st.hide) a.visible = false;
    if (st.show) a.visible = true;
    if (st.drain != null) S.cast.drain(a, st.drain);
  }

  const P = S.cine = {
    active: false,
    play(id, o = {}) {
      const def = typeof id === 'object' ? id : S.content.CINES[id];
      if (!def) { console.warn(`[cine] no cine '${id}'`); return { done: true, missing: true }; }
      if (run) { run.skip = true; finish(run); }
      return S.co.start(play(def, o), `cine:${def.id}`);
    },
    skip() { if (run) { run.skip = true; if (run.hold && !run.hold.done) S.ui.advanceAll(); if (run.film && !run.film.done) S.film.skip(); } },
    // extras: the cine now playing and its clock (QA)
    get current() { return run ? run.def.id : null; }, get t() { return run ? run.t : 0; },
  };
  return { P, stop() { if (run) { run.skip = true; finish(run, true); } } };
}
