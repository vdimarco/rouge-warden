// js/story/missions/cine.js : S.cine, the cut-scene player (design 4.3, types.js CineDef).
// play(id, {cast}) runs a CineDef on story time as a task (the handle is the task: {done}). Tracks:
// - shots {at, dur, from, to, look, fov, ease, shake}: the camera (priority 100) moves from -> to over dur.
//   A point is {x, y, z} in the world (y above the ground there), a place id (eye height above it), {who,
//   x, y, z} in that actor's own frame (+z ahead of it, +x to its right), {at | place: placeId, x, y, z}
//   (offset from the place) or {bridge: true, y} (the arena's bridge silhouette in an arena cine, the
//   Midgley deck elsewhere; y above the deck). look is a point the same way
//   (an actor's point defaults to 1.5 m up). ease: 'inOut' (default), 'in', 'out', 'linear'. Between
//   shots the last one holds; with no shot yet, the camera that was already running keeps the view.
// - actors {at, who, do, args}: play (clip | {clip, loop, speed, fade}), moveTo (place | {x, z} |
//   {to, speed, run}: a walk with the procedural stride), face (yaw | {who} | {x, z}), pose (name |
//   {name, k}), prop ({name, on, bone}), show, hide, glow (k), drain (k | {k, dur}: Gabe's neon over 2 s),
//   place (place | {x, z, yaw} | {at: point, yaw, face: who}), say (line id: a subtitle).
//   who: a key of o.cast or def.cast (a cast id, or {id, place, pos, yaw, props, costume}), 'hero' (the
//   hero's body), 'pick' (the player's friend), 'crew' (every crew member in the scene), 'van', or a cast
//   id (a live or arena actor, else one is spawned for the cine and removed after it).
// - lines {at, who, line, block}: a subtitle; block:true holds the timeline on a dialogue box.
// - looks {at, set, dur}, cards {at, kind, title, sub, kanji}, fx {at, kind, pos}, sfx {at, name}.
// - film {at, src}: the film plays through S.film and holds the timeline; if it cannot play (no codec, a
//   404, not buffered in 1.5 s) the engine does a white flash instead.
// - end {actors: {who: {place|pos, yaw, pose, clip, hide, show}}, hero: {place|pos, yaw}, van: {...},
//   look}: applied when the cine ends or is skipped. A skip also applies every actor cue it jumped over.
// The lens (design 2.2): at each cut the shot's path is tested against the ground, the colliders, the
// vehicles and the bodies; a blocked shot moves as a whole (in along its line of sight, then round what it
// looks at, then up), found once per shot. A cast entry with a place stands its actor there even when it
// is already in the scene (a follower comes to the mark), and the actors a cine places or walks keep their
// marks until it ends. While a cine plays the bodies draw in full (lod.js) and the render scale goes up
// (look.js cineQuality).
// The letterbox is body.cine. The hero ignores move input (S.lockControl) while a cine plays. The UI owns
// the hold-to-skip (0.8 s); S.cine.skip() ends the cine at once.
import { ARENA_CAST, CAMERA_PRIO, CAST_IDS, CREW_IDS } from '../types.js';

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
      let id = typeof spec === 'string' ? spec : spec.id;
      if (id === 'pick') id = pickId; // content: cast {pick: {id: 'pick', costume}}
      if (!CAST_IDS.includes(id)) return null;
      // (an arena cine takes only the arena's own actors as they are: the Sedona group, with the hero, is hidden there)
      if (id === S.hero.body && S.hero.actor && !run.def.arena) return S.hero.actor;
      const live = typeof spec === 'string' || !spec.fresh ? S.cast.get(id) : null;
      if (live && (run.def.arena ? ARENA_CAST.includes(id) : live.visible)) return live;
      const p = typeof spec === 'object' ? (spec.place ? S.world.place(spec.place) : spec.pos || castAt(spec.at)) : null;
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
    else if (who === 'pick') a = S.hero.body === pickId && !run.def.arena ? S.hero.actor : fromSpec(pickId);
    else if (who === 'van') a = S.vehicles.player ? vanWrap(S.vehicles.player) : null;
    else if (CAST_IDS.includes(who)) a = fromSpec(who);
    // a cast entry with a mark stands its actor there, even one already in the scene: a follower, or the
    // mission's own spawn that the mission hands in (F5's Gabe stood on the Perch, 20 m off the shots)
    if (a && a.root && !a.isVan && a !== S.hero.actor && !run.def.arena && dc && typeof dc === 'object' && (dc.place || dc.pos || dc.at)) {
      const mark = dc.place ? S.world.place(dc.place) : dc.pos || castAt(dc.at);
      // (out of a seat first: a seated actor rides wherever the vehicle is)
      if (mark && Number.isFinite(mark.x)) { if (S.drive && S.drive.unseat) S.drive.unseat(a); placeActor(a, { x: mark.x, y: mark.y, z: mark.z, yaw: dc.yaw ?? mark.yaw }); hold(a); }
    }
    // the arena Gabe standing in a story scene (the Perch, the wedding) idles in his boss-fight stance: in a
    // cine he stands as a person does, unless a cue says otherwise
    if (a && !run.def.arena && a.kind === 'arena' && a.play && !(a.cur && String(a.cur).startsWith('lib:')) && !a.pose) S.cast.pose(a, 'idle', 1);
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
      // the hero at the wheel (a chapter that opens in the van): the shot is on the vehicle, framed as far
      // out again as a person's (a person's 3 m puts the lens against the door)
      const v = p.who === 'hero' && S.drive && S.drive.riding && S.hero && (S.hero.mode === 'drive' || S.hero.mode === 'passenger') ? S.drive.riding : null;
      if (v && v.pos) {
        const yaw = v.yaw, lx = (p.x || 0) * 2.4, lz = (p.z || 0) * 2.4;
        return out.set(v.pos.x - lx * Math.cos(yaw) + lz * Math.sin(yaw), v.pos.y + (p.y ?? lookY) + 0.4, v.pos.z + lx * Math.sin(yaw) + lz * Math.cos(yaw));
      }
      const a = actorOf(p.who); if (!a || !a.root) return null;
      const r = a.root.position, yaw = a.root.rotation.y, lx = p.x || 0, lz = p.z || 0;
      return out.set(r.x - lx * Math.cos(yaw) + lz * Math.sin(yaw), r.y + (p.y ?? lookY) * heightOf(a), r.z + lx * Math.sin(yaw) + lz * Math.cos(yaw));
    }
    const pl = typeof p.at === 'string' ? p.at : typeof p.place === 'string' ? p.place : null;
    if (pl) {
      const q = S.world.place(pl); if (!q) return null;
      const x = q.x + (p.x || 0), z = q.z + (p.z || 0), y = p.y ?? 1.7;
      // (y is above the place's ground; where the ground rises within the offset, above the ground there: a
      // wide shot 20 m off the P12 lot sat 5.7 m inside the hill)
      const h = q.y > -200 && S.world.height ? S.world.height(x, z) : -Infinity;
      return out.set(x, q.y + y < h + 0.4 ? h + y : q.y + y, z);
    }
    if (p.bridge) {
      const b = run && run.def.arena ? (S.ctx.arena || S.scene).getObjectByName('bridgeSilhouette') : null;
      if (b) return out.set(b.position.x, b.position.y + 34 + (p.y || 0), b.position.z);
      return out.set(430, 62 + (p.y || 0), -510); // Midgley Bridge deck (world/roads.js)
    }
    // a world point: y above the ground there (the hero's height picks the floor inside an interior)
    if (Number.isFinite(p.x) && Number.isFinite(p.z)) return out.set(p.x, ground(p.x, p.z, (S.hero.pos.y || 0) + 3) + (Number.isFinite(p.y) ? p.y : 1.7), p.z);
    return null;
  }
  // the heights in an actor's frame are written for a person whose eyes are at 1.62 m; a body well off that
  // (the arena Gabe on the Perch in F5, 2.1 m) scales them, so a close-up still finds the face. Measured once,
  // standing (an arena cine keeps its own numbers: they were set on the arena bodies)
  const hv = new THREE.Vector3(), hv2 = new THREE.Vector3();
  function heightOf(a) {
    if (run && run.def.arena) return 1;
    if (a.cineH != null) return a.cineH;
    const h = a.bone && a.bone('Head');
    if (!h || a.isVan || (a.pose && a.pose !== 'idle')) return 1;
    a.root.updateMatrixWorld(true);
    const k = (h.getWorldPosition(hv).y - a.root.getWorldPosition(hv2).y) / 1.62;
    return (a.cineH = Number.isFinite(k) && Math.abs(k - 1) > 0.1 ? Math.max(0.8, Math.min(1.4, k)) : 1);
  }
  // a cast entry's at (content): a point; a world point's y is a floor hint (-300: an interior)
  function castAt(at) {
    if (!at) return null;
    if (typeof at === 'string') return S.world.place(at);
    if (!at.who && !at.place && !at.at && !at.bridge && Number.isFinite(at.x)) return { x: at.x, z: at.z, y: ground(at.x, at.z, Number.isFinite(at.y) ? at.y + 2 : (S.hero.pos.y || 0) + 3) };
    const q = point({ ...at, y: at.y ?? 0 }, new THREE.Vector3()); return q ? { x: q.x, y: q.y, z: q.z } : null;
  }
  // a cue's target: a place id, a point in any of the forms above, or {x, z}
  function target(g) {
    if (g == null) return null;
    if (typeof g === 'string') return S.world.place(g);
    if (g.who || g.place || g.at || g.bridge) { const q = point({ ...g, y: g.y ?? 0 }, new THREE.Vector3()); return q ? { x: q.x, y: q.y, z: q.z, yaw: g.yaw } : null; }
    return g;
  }

  // an actor the cine places or walks keeps its mark (a follower does not walk back to the hero mid-cine)
  function hold(a) { if (!run || !a || a.isVan || a === S.hero.actor) return; a.cineHeld = true; run.held.add(a); }

  /* ---------------- the lens ---------------- */
  const e3 = new THREE.Vector3(), f3 = new THREE.Vector3(), g3 = new THREE.Vector3(), dv3 = new THREE.Vector3(), seg = new THREE.Line3(), q3 = new THREE.Vector3();
  const shownActor = (a) => { if (!a || !a.root || !a.root.parent || a.visible === false) return false; for (let o = a.root; o; o = o.parent) if (!o.visible) return false; return !a.lodHidden; };
  // the body's axis, feet to the top of the head
  function axisOf(a) {
    const r = a.root.getWorldPosition(e3), h = a.bone && a.bone('Head');
    const top = h ? h.getWorldPosition(f3).add(g3.set(0, 0.2, 0)) : f3.copy(r).add(g3.set(0, 1.85, 0));
    return seg.set(r, top);
  }
  // what is wrong with a camera at p looking at L (fov: the shot's, degrees; own: the actors the shot is
  // on, who may stand close): null when the lens is clear
  function blocked(p, L, fov = 50, own = []) {
    const d = p.distanceTo(L);
    if (!run.def.arena) {
      if (p.y < ground(p.x, p.z, p.y + 0.5) + 0.3) return 'ground';
      let hit = null;
      const C = S.world.colliders;
      // down in the rooms (y -300) the lens stays inside one, under its ceiling (its volume ends 1 m above it)
      if (p.y < -200) { const vol = C.inVolume ? C.inVolume(p.x, p.y, p.z) : null; if (!vol) return 'outside'; if (p.y > vol.y1 - 1.25) return 'ceiling'; }
      // the lens, and its line of sight: the first stretch of it (a wall between the lens and the people), or
      // in a shot under 12 m all of it but the last 0.6 m (a parked jeep between the lens and a face)
      const far = d < 12 ? Math.max(0, d - 0.6) : Math.min(1.5, d * 0.5), n = Math.max(1, Math.ceil(far / 0.4));
      for (let i = 0; i <= n && !hit; i++) {
        const q = q3.copy(p).lerp(L, i ? far * i / n / d : 0);
        // (a rock formation's collider has no height, and its columns stand 12 to 58 m: the whole column counts)
        C.query(q.x, q.z, i ? 0.05 : 0.5, (it) => { if (it.kind !== 'volume' && q.y > it.y0 && q.y < it.y1) { hit = it.tag || it.kind; return false; } });
      }
      if (hit) return hit;
      // the ground across the line of sight (a trail on a slope: the hill between the lens and the people)
      if (p.y > -200) for (let i = 1, k = Math.min(40, Math.ceil(d / 0.5)); i < k; i++) { const q = q3.copy(p).lerp(L, i / k); if (q.y < S.world.height(q.x, q.z) + 0.05) return 'terrain'; }
      // a vehicle at the lens or across the same line of sight (a jeep's roll cage across a face); the one
      // the shot looks into (the hero at the wheel) is the subject: the lens keeps 1.2 m off it
      for (const v of S.vehicles.list || []) {
        if (!v.toLocal || !v.pos) continue;
        const inside = (q, m) => { const [lx, lz] = v.toLocal(q.x, q.z); return Math.abs(lx) < v.hw + m && Math.abs(lz) < v.hd + m && q.y < v.pos.y + (v.h || 2) + m && q.y > v.pos.y - 0.5; };
        const subject = inside(L, 0);
        if (inside(p, subject ? 1.2 : 0.35)) return 'vehicle';
        if (!subject) for (let i = 1; i <= n; i++) if (inside(q3.copy(p).lerp(L, far * i / n / d), 0.1)) return 'vehicle';
      }
    }
    // a body at the lens, across the first metre of the line of sight, or a head within 1.3 m in the frame
    const dir = dv3.copy(L).sub(p).normalize(), half = (fov * Math.PI / 360) * 1.25;
    for (const a of S.cast.all()) {
      if (!shownActor(a) || a.isVan) continue;
      const ax = axisOf(a);
      if (ax.closestPointToPoint(p, true, q3).distanceTo(p) < 0.42) return 'actor';
      if (d > 1.6) { const m = g3.copy(p).lerp(L, 0.9 / d); if (ax.closestPointToPoint(m, true, q3).distanceTo(m) < 0.3) return 'actor'; }
      if (!own.includes(a)) {
        const h = q3.copy(ax.end).sub(p), hd = h.length();
        if (hd < 1.3 && hd > 1e-3 && Math.acos(Math.min(1, h.dot(dir) / hd)) < half) return 'actor';
      }
    }
    return null;
  }
  // the moves a blocked shot tries, in order: [pull in, swing (rad), rise (m)]
  const MOVES = [[1, 0, 0], [0.85, 0, 0], [0.7, 0, 0], [1, 0.35, 0], [1, -0.35, 0], [0.85, 0.6, 0], [0.85, -0.6, 0], [1, 0, 0.7], [0.8, 0.35, 0.5], [0.8, -0.35, 0.5],
    [0.55, 0, 0], [1, 0.9, 0.3], [1, -0.9, 0.3], [0.7, 0, 1.2], [0.45, 0, 0.4]];
  function moved(p, L, m, out) {
    const vx = (p.x - L.x) * m[0], vy = (p.y - L.y) * m[0], vz = (p.z - L.z) * m[0], c = Math.cos(m[1]), s = Math.sin(m[1]);
    return out.set(L.x + vx * c + vz * s, L.y + vy + m[2], L.z - vx * s + vz * c);
  }
  // the move for this shot: the first that clears the start, the middle and the end of its path
  function solveShot(s) {
    const from = point(s.from, new THREE.Vector3()), to = s.to ? point(s.to, new THREE.Vector3()) : null, L = s.look != null ? point(s.look, new THREE.Vector3(), 1.5) : null;
    if (!from || !L) return MOVES[0];
    const keep = from.distanceTo(L) < 1.2; // (a close-up is not pulled in further)
    const own = [s.look && s.look.who, s.from && s.from.who].filter(Boolean).map((w) => actorOf(w)).filter(Boolean);
    const P = [0, 0.5, 1].map((k) => (to ? from.clone().lerp(to, k) : from.clone())), t = new THREE.Vector3();
    // (none clears it all: the one that clears most of the path)
    let best = MOVES[0], bestN = -1;
    for (const m of MOVES) {
      if (keep && m[0] < 1) continue;
      const clear = P.filter((p) => { moved(p, L, m, t); return t.distanceTo(L) > 0.7 && !blocked(t, L, s.fov || 50, own); }).length;
      if (clear === P.length) return m;
      if (clear > bestN) { best = m; bestN = clear; }
    }
    return best;
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
    if (run.shot !== s) { run.shot = s; run.move = solveShot(s); }
    if (L && run.move !== MOVES[0]) moved(camPos, L, run.move, camPos);
    // (not under the ground; an interior far below it, 300 m down, is left alone)
    if (!run.def.arena) { const g = ground(camPos.x, camPos.z, camPos.y + 0.5) + 0.3; if (camPos.y < g && camPos.y > g - 30) camPos.y = g; }
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
          case 'play': { const o = typeof g === 'string' ? { clip: g } : g || {}; if (a.play) a.play(o.clip, { loop: o.loop, speed: o.speed, fade: o.fade ?? 0.25, restart: o.restart, at: o.at }); break; }
          case 'moveTo': {
            const o = typeof g === 'string' || (g && Number.isFinite(g.x)) ? { to: g } : g || {};
            const p = target(o.to);
            if (!p) break;
            const walk = { a, x: p.x, z: p.z, yaw: p.yaw, speed: o.speed || (o.run ? 4.6 : 1.45) };
            hold(a);
            if (skipping) finishWalk(walk); else { run.walks = run.walks.filter((w) => w.a !== a); run.walks.push(walk); }
            break;
          }
          case 'face': {
            let yaw = null;
            if (Number.isFinite(g)) yaw = g;
            else if (g && g.to) { const q = target(g.to); if (q) yaw = Math.atan2(q.x - a.root.position.x, q.z - a.root.position.z); }
            else if (g && g.who) { const b = actorOf(g.who); if (b && b.root) yaw = Math.atan2(b.root.position.x - a.root.position.x, b.root.position.z - a.root.position.z); }
            else if (g && Number.isFinite(g.x)) yaw = Math.atan2(g.x - a.root.position.x, g.z - a.root.position.z);
            else if (typeof g === 'string') { const q = S.world.place(g); if (q) yaw = Math.atan2(q.x - a.root.position.x, q.z - a.root.position.z); }
            if (yaw != null) { hold(a); if (skipping) a.root.rotation.y = yaw; else { run.turns = run.turns.filter((w) => w.a !== a); run.turns.push({ a, yaw }); } }
            break;
          }
          case 'pose': { const o = typeof g === 'string' ? { name: g } : g || {}; if (!a.isVan) S.cast.pose(a, o.name, o.k ?? 1); break; }
          case 'prop': { const o = typeof g === 'string' ? { name: g } : g || {}; if (a.isVan) break; if (o.on === false) S.cast.props.detach(a, o.name); else S.cast.props.attach(a, o.name, o.bone); break; }
          case 'show': {
            // content: {replace: who} stands this actor where that one is and hides it (C0: the ronin to the pick)
            const from = g && g.replace ? actorOf(g.replace) : null;
            if (from && from !== a && from.root || g && g.at) hold(a);
            if (from && from !== a && from.root) { placeActor(a, { x: from.root.position.x, y: from.root.position.y, z: from.root.position.z, yaw: from.root.rotation.y }); from.visible = false; }
            else if (g && g.at) placeActor(a, { ...target(g.at), ...(g.yaw != null ? { yaw: g.yaw } : {}) });
            a.visible = true; break;
          }
          case 'hide': a.visible = false; break;
          case 'glow': if (a.setGlow) a.setGlow(+g || 0); break;
          case 'drain': {
            const o = Number.isFinite(g) ? { k: g } : g || {};
            const to = clamp(o.k ?? 1, 0, 1), dur = o.dur ?? 2;
            if (skipping || dur <= 0) S.cast.drain(a, to);
            else { run.drains = run.drains.filter((w) => w.a !== a); run.drains.push({ a, from: a.drainK ?? 0, to, t: 0, dur }); }
            break;
          }
          case 'place': {
            hold(a); placeActor(a, g);
            // content: {at, face: who}: stood on the mark facing another actor
            const b = g && g.face ? actorOf(g.face) : null;
            if (b && b.root && b !== a) { const yaw = Math.atan2(b.root.position.x - a.root.position.x, b.root.position.z - a.root.position.z); if (a.isVan) a.vehicle.setPose(a.vehicle.pos.x, a.vehicle.pos.z, yaw); else a.root.rotation.y = yaw; }
            break;
          }
          case 'say': if (!skipping) S.ui.subs(who, S.content.line(typeof g === 'string' ? g : g && g.line), undefined, who); break;
          default: console.warn(`[cine] unknown do '${c.do}'`);
        }
      } catch (e) { console.error(`[cine] ${run.def.id}: ${c.do} on ${who}`, e); }
    }
  }
  function placeActor(a, g) {
    if (!a || !g) return;
    let p = typeof g === 'string' ? S.world.place(g) : g;
    if (p && p.at != null && !Number.isFinite(p.x)) { const q = target(p.at); p = q ? { ...q, ...(g.yaw != null ? { yaw: g.yaw } : {}) } : null; } // content: {at: point, yaw}
    else if (p && (p.who || p.place || p.bridge)) p = target(p);
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
        else S.ui.subs(e.who, text, Math.min(e.dur ?? Math.max(1.6, 0.7 + String(text).length * 0.045), Math.max(0.1, run.def.dur - run.t)), e.who || lineWho(e.line)); // (the line's speaker talks, even with no name shown)
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
  const lineWho = (id) => { const L = S.content && S.content.LINES && S.content.LINES[id]; return (L && typeof L === 'object' && L.who) || ''; };
  const TRACKS = ['lines', 'looks', 'cards', 'fx', 'sfx'];

  /* ---------------- the run ---------------- */
  function* play(def, o) {
    const r = run = { def, o, t: 0, actors: new Map(), temp: [], walks: [], turns: [], drains: [], hold: null, card: null, skip: false, next: {}, film: null, done: false, held: new Set(), shot: null, move: null,
      chapterDrain: (S.content.CHAPTERS[S.missions.chapter] || {}).drain };
    for (const k of ['actors', ...TRACKS]) r.next[k] = 0;
    const sorted = {};
    for (const k of ['actors', ...TRACKS]) sorted[k] = (def[k] || []).slice().sort((a, b) => a.at - b.at);
    r.sorted = sorted;
    P.active = true; S.lockControl = true;
    document.body.classList.add('cine');
    // the cast placed in the scene stands there from the first frame, not only once a shot or a cue names it
    // (E1's bride, Christian and Ryu; P12's Dana: no shot names them, so they never came)
    for (const [who, spec] of Object.entries(def.cast || {})) if (spec && typeof spec === 'object' && (spec.at || spec.place || spec.pos)) actorOf(who);
    if (def.look) S.look.set(def.look, { dur: 0 });
    if (S.look.cineQuality) S.look.cineQuality(true);
    if (!def.arena) stepOut();
    r.soundLoops = [];
    if (def.id === 'c0' || def.id === 'i0') {
      S.audio.cue('night');
      r.soundLoops.push(S.audio.loop('creek', { level: 0.45 }), S.audio.loop('crickets', { level: 0.35 }));
    }
    K.log('cine', def.id, 'start');
    let last = S.timers.now;
    try {
      for (;;) {
        if (r.skip) break;
        const now = S.timers.now, dt = Math.max(0, now - last); last = now;
        if (r.hold) { if (K.auto) S.ui.advanceAll(); if (!r.hold.done) { yield null; continue; } r.hold = null; }
        if (r.film) {
          if (!r.film.done) { if (r.def.id === 'c0' && S.film.active && !r.morphSound) r.morphSound = S.audio.loop('gabeMorph'); if (K.auto) S.film.skip(); yield null; continue; }
          if (!r.film.played && S.look && S.look.base) S.look.base.flash = 1; // the engine's white flash stands in
          if (r.morphSound) { r.morphSound.stop(0.15); r.morphSound = null; }
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
        if (K.auto && r.t > 0.04) { r.skip = true; break; } // (between the 2nd and 3rd tick: 3 ticks of 1/60 land on 0.05 give or take the float rounding)
        yield null;
      }
      finish(r);
    } finally {
      if (!r.done) finish(r, true);
    }
  }
  // A chapter opens with the hero on its start place, and the mission then parks the van on the same place
  // (F5's bar lot, P1's Midgley lot, P3's watch, P9's diner): on foot inside the van's body, the intro filmed
  // him through its side. He steps out to the driver's door first.
  function stepOut() {
    const H = S.hero;
    if (!H || H.mode !== 'foot' || !H.pos) return;
    for (const v of S.vehicles.list || []) {
      if (!v.toLocal || !v.pos || !v.doorPoint) continue;
      const [lx, lz] = v.toLocal(H.pos.x, H.pos.z);
      if (Math.abs(lx) > v.hw + 0.2 || Math.abs(lz) > v.hd + 0.2 || Math.abs(H.pos.y - v.pos.y) > 2) continue;
      const d = v.doorPoint('driver'), yaw = Math.atan2(d.x - v.pos.x, d.z - v.pos.z); // (facing away from the van)
      H.place(d.x, d.z, yaw, d.y + 1);
      if (H.actor) { H.actor.root.position.set(d.x, d.y, d.z); H.actor.root.rotation.y = yaw; }
      return;
    }
  }
  // the end state: every cue it skipped, then def.end
  function finish(r, aborted = false) {
    if (r.done) return;
    r.done = true;
    if (r.morphSound) r.morphSound.stop(0.1);
    for (const h of r.soundLoops || []) h.stop(0.25);
    if (r.def.id === 'c0' || r.def.id === 'i0') S.audio.cue('auto');
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
    for (const a of r.held) a.cineHeld = false;
    if (run === r) run = null;
    P.active = false; S.lockControl = false;
    if (S.look.cineQuality) S.look.cineQuality(false);
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
    actor(who) { return (run && run.actors.get(who)) || null; }, // (the actor a cast name stands for now, QA)
  };
  return { P, stop() { if (run) { run.skip = true; finish(run, true); } } };
}
