// js/story/missions/steps.js : every step type in types.js STEP_TYPES, as generators run by the mission VM
// (vm.js). Each gets (m, s): the mission runtime and the StepDef. A step ends by returning; it fails with
// m.fail(reason) (the VM ends it at the next wait). Every step also has its autopilot (m.auto): QA and
// story.mjs play the whole story with it, so each one finishes in a few ticks by the shortest honest route
// (teleports, knock-outs, a framed photo).
// Params (types.js STEP_PARAMS), and how they read:
// - cine {id, cast}: cast maps a cine's who to a mission spawn id or a cast id.
// - talk {lines, block, who}: block:false plays subtitles and goes on at once (lines keep playing).
// - card {title, kind, sub, kanji, dur}. goto {to, r, mode ('any' | 'foot' | 'drive'), label}.
// - drive {to, r, vehicle, route, park, maxDamage}: the GPS follows the objective marker; route is a list of
//   places or points to pass first; park asks for a stop inside the box; maxDamage fails above it.
// - enter {vehicle, seat}, exit {vehicle}: vehicle is a spawn id ('player' or none: the crew's van).
// - wait {sec | until 'h:mm', lapse}: until time-lapses the clock (x60) to that time.
// - stakeout {zone, until, r, events, lapse}: hold the zone while the clock runs x60; events [{at 'h:mm',
//   lines, block, card, cine, look, set, fn (a SCRIPTS name), step (a StepDef run inline)}] stop the lapse.
// - photo {subject, kind, min, slot, store, count, match, window}: subject is a spawn id, a place id, a cast
//   id, {x, z, h} or a list of them; count of them must be photographed at min (50) or better; slot fills an
//   evidence slot, store names a flag that keeps the photo id; match is a place whose reference picture the
//   player takes again (6 m, 12 degrees); window is the seconds allowed.
// - tail {target, to, near, far, notice}: follow 25-140 m back; closer than near for notice (6) s, or
//   beyond far x 1.3 for 8 s, or out of sight for 12 s fails.
// - lose {pursuers, sec, dist}: break their sight for sec (10) s or get dist (250) m away.
// - chase {target, goal, hits, pit, protect, bumpLimit, maxSpeed, maxContact}: goal 'disable' (hits rams,
//   default 3, or a PIT), 'stop' or 'boxIn' (it stands still near you for 2 s), 'catch' (within 8 m) or a
//   place (it gets there: fail). protect: spawn ids of vehicles with people inside (bump meter, E4).
// - race {gates, target, void, vehicle, rubber}: gates are places or points; target is the time in
//   seconds (over it fails); void ends the race after that gate (F2 gate 7).
// - fight {waves, arena, legend, music, boss, pickups, until}: waves [[{foe, variant, place | pos, ...}]];
//   boss is the foe id with the boss bar (a boss must be tied: hold E); until 'half' ends at half life;
//   pickups [{weapon, place | pos, uses}].
// - defend {protect, waves, boss, arena}: protect {place | pos, hp (100), label}; it loses life while
//   enemies stand near it and the hero is away from it.
// - stealth {guards, onSpotted ('fail' | 'fight'), to, r, deepInk}: guards are spawn ids or foe entries;
//   pass by reaching `to`, or with no `to`, by taking every guard down.
// - interact {at, label, hold, window, watchers, mode}. escort {followers, to, cover, drive, smooth,
//   vehicle}: on foot the followers move from cover to cover on the hero's SIGNAL; with drive they board
//   the van and the drive is scored for smoothness (a meter; S.flags['<mission>:smooth']).
// - collect {items [{id, at, label, lines, flag, min}], need, photo}. choice {title, options [label |
//   {label, set, lines, flag}]}: the pick goes in S.flags['choice:<step id or mission>'].
// - set: SetOps. script {fn, args}: S.content.SCRIPTS[fn](m, s).
import { toHour } from '../../core/clock.js';
import { CAST_IDS, CREW_IDS, EVIDENCE, LOOKS, VAN_LOOKS, WEAPON_IDS } from '../types.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const WEAPON_NAMES = { fists: 'FISTS', foamKatana: 'FOAM KATANA', cue: 'POOL CUE', stool: 'BAR STOOL', staff: "RANGER'S STAFF" };

export function createSteps(S, K) {
  const M = S.missions;
  const R = () => S.rng('story');

  /* ---------------- shared helpers ---------------- */
  // a destination: a place id, a spawn id (it moves), a cast id, or {x, z}. Returns () => {x, y, z, r, yaw}.
  function target(m, to, r0) {
    if (to == null) return null;
    if (typeof to === 'string') {
      const p = S.world.place(to);
      if (p) return () => p;
      const o = m.get(to) || (m.def.spawns || []).some((x) => x.id === to) && m.spawn(to) || (CAST_IDS.includes(to) ? S.cast.get(to) : null);
      if (o) return () => posOf(o, r0);
      console.warn(`[steps] unknown target '${to}'`);
      return () => ({ x: S.hero.pos.x, y: S.hero.pos.y, z: S.hero.pos.z, r: r0 || 4, yaw: 0 });
    }
    if (Number.isFinite(to.x) && Number.isFinite(to.z)) { const p = { x: to.x, y: Number.isFinite(to.y) ? to.y : levelY(to.x, to.z), z: to.z, r: to.r || r0 || 6, yaw: to.yaw || 0 }; return () => p; }
    return null;
  }
  // a point given without a height stands on the level nearest the hero's: F4's clues under the creek
  // bridge are on the creek bed where the van is, not on the deck above them
  function levelY(x, z) {
    const top = S.world.surface(x, z), hy = heroAt().y;
    if (!Number.isFinite(hy)) return top;
    const low = S.world.surface(x, z, hy + 1);
    return Number.isFinite(low) && low > S.world.height(x, z) - 1 && Math.abs(low - hy) < Math.abs(top - hy) ? low : top;
  }
  function posOf(o, r0 = 4) {
    const p = o.pos || (o.a && o.a.root && o.a.root.position) || (o.root && o.root.position) || o;
    const yaw = o.yaw ?? o.face ?? (o.root ? o.root.rotation.y : 0);
    return { x: p.x, y: p.y ?? 0, z: p.z, r: r0, yaw };
  }
  const vehicleOf = (m, ref) => (ref && ref !== 'player' ? m.get(ref) || m.spawn(ref) : S.vehicles.player);
  const riding = () => (S.drive && S.drive.riding) || null;
  // where the hero is: the vehicle when riding
  const heroAt = () => { const v = riding(); return v ? v.pos : S.hero.pos; };
  // the hero's vehicle goes somewhere (autopilot)
  function jumpVehicle(v, x, z, yaw) { v.setPose(x, z, yaw ?? v.yaw); v.speed = 0; }
  function jumpHero(x, z, yaw) {
    const v = riding();
    if (v) { jumpVehicle(v, x, z, yaw ?? Math.atan2(x - v.pos.x, z - v.pos.z)); return; }
    S.hero.place(x, z, yaw ?? S.hero.face);
  }
  // off the road ahead of a place: a spot `back` meters before it, facing it
  function approach(p, back = 3) {
    const h = heroAt(), a = Math.atan2(p.x - h.x, p.z - h.z), d = Math.max(0, flat(h, p) - back);
    return { x: h.x + Math.sin(a) * d, z: h.z + Math.cos(a) * d, yaw: a };
  }
  function getOut(v) { if (!riding()) return true; const r = riding(); r.speed = 0; S.drive.exit(); if (riding()) K.forceOut(r); return !riding(); }
  const lineText = (l) => (typeof l === 'string' ? l : l && l.line ? l.line : l);
  // a hint the first time something is asked of the player (UI fills {camera} and friends with the key)
  const hinted = new Set();
  const hintOnce = (k, text) => { if (hinted.has(k)) return; hinted.add(k); if (S.ui.hint) S.ui.hint(text); S.timers.after(6, () => { if (S.ui.hint) S.ui.hint(null); }, 'missions:hint'); };
  // foe options from a wave entry or a guard: every FoeOpts field goes on (a legend needs its variant, E9)
  function foeOpts(m, f, i, n, center) {
    const at = f.place ? S.world.place(f.place) : f.pos || null;
    let pos = at;
    if (!pos) { // a ring around the arena or the hero, spaced by the seeded story stream
      const c = center || S.hero.pos, a = R()() * Math.PI * 2 + (i / Math.max(1, n)) * Math.PI * 2, d = 7 + R()() * 3;
      pos = { x: c.x + Math.sin(a) * d, z: c.z + Math.cos(a) * d };
    }
    return { pos, yaw: f.yaw ?? (at && at.yaw), group: f.group || `m:${m.def.id}`, alert: f.alert, patrol: f.patrol, weapon: f.weapon, flashlight: f.flashlight, variant: f.variant };
  }
  function spawnFoe(m, f, i, n, center) {
    const F = S.combat.spawn(f.foe, foeOpts(m, f, i, n, center));
    m.track(F);
    return F;
  }
  const isDown = (f) => !f || f.downed || f.gone || f.tied;
  // knock a fighter out for the autopilot (through the combat package's QA handle)
  function ko(f) {
    if (isDown(f)) return;
    const list = S.combat.enemies, i = list.indexOf(f);
    if (S.test.combat && S.test.combat.ko && i >= 0) S.test.combat.ko(i);
    else { f.hp = 0; f.downed = true; }
  }
  function tieBoss(f) { if (f && !f.tied && S.combat.tie) S.combat.tie(f); if (f) f.tied = true; }
  // a SetOps object (the set step, choice options, stakeout events)
  function* applySet(m, o) {
    if (!o) return;
    if (o.flags) for (const [k, v] of Object.entries(o.flags)) if (k !== '__proto__') S.flags[k] = v;
    if (o.clock) S.day.set(o.clock.day, o.clock.time);
    if (o.day) S.day.set(o.day, null);
    if (o.look && LOOKS.includes(o.look)) S.look.set(o.look, { dur: o.lookDur ?? 1.2 });
    if (o.evidence) for (const [k, v] of Object.entries(o.evidence)) if (EVIDENCE.includes(k)) S.evidence.set(k, typeof v === 'string' && v.startsWith('flag:') ? S.flags[v.slice(5)] ?? null : v);
    if (o.weapon && WEAPON_IDS.includes(o.weapon)) { try { if (S.hero.weapons && S.hero.weapons.includes(o.weapon)) S.combat.setWeapon(o.weapon); else S.combat.give(o.weapon); } catch (e) { console.warn('[steps] weapon', e); } }
    if (o.ability === 'bearCall' && !S.flags.bearCall) { S.flags.bearCall = true; S.ui.toast('BEAR CALL'); hintOnce('bearcall', 'Press {bearcall} to roar like a bear.'); }
    if (o.seats) { const v = S.vehicles.player; if (v) for (const e of o.seats) { const who = typeof e === 'string' ? e : e.cast || e.id; const seat = typeof e === 'object' && Number.isInteger(e.seat) ? e.seat : v.seats.findIndex((x, i) => i >= 1 && !x); if (!who || seat < 0) continue; const a = m.get(who) || (CAST_IDS.includes(who) ? m.castSpawn(who) : null); if (a && a.root) S.drive.seat(a, v, seat); } }
    if (o.vanLook && S.vehicles.player && S.vehicles.player.setLook) S.vehicles.player.setLook(o.vanLook);
    if (o.unlock) for (const id of o.unlock) K.unlock(id);
    if (o.spawn) for (const id of o.spawn) m.spawn(id);
    if (o.despawn) for (const id of o.despawn) m.despawn(id);
    if (o.traffic != null) K.density.traffic = o.traffic;
    if (o.crowd != null) K.density.crowd = o.crowd;
    if (o.save) S.save.write();
    yield null;
  }
  // wait for a handle, advancing it on autopilot
  function* await_(h, auto = true) { while (h && !h.done) { if (auto && M.auto) S.ui.advanceAll(); yield null; } return h; }

  /* ---------------- the steps ---------------- */
  const STEPS = {
    *cine(m, s) {
      const cast = { ...m.castMap() };
      for (const [who, ref] of Object.entries(s.cast || {})) cast[who] = (typeof ref === 'string' && m.get(ref)) || ref;
      const h = S.cine.play(s.id, { cast });
      yield h;
    },

    *talk(m, s) {
      const lines = [].concat(s.lines).map((l) => (typeof l === 'string' && s.who && !(S.content.LINES && l in S.content.LINES) ? { who: s.who, text: l } : l));
      const h = S.ui.say(lines, { block: s.block !== false });
      if (s.block === false) { m.subsHandle = h; return; } // subtitles run on under the next step
      yield* await_(h);
    },

    *card(m, s) {
      const C = S.content.CHAPTERS[M.chapter] || {};
      const h = S.ui.card(s.kind || 'title', { title: s.title, sub: s.sub, kanji: s.kanji, dur: s.dur, n: s.kind === 'chapter' ? C.n : undefined });
      yield* await_(h);
    },

    *goto(m, s) {
      const T = target(m, s.to, s.r); if (!T) return;
      const mode = s.mode || 'any';
      try {
        for (;;) {
          const p = T(), r = s.r ?? p.r ?? 4;
          m.marker('goal', { x: p.x, z: p.z, y: p.y, r, label: s.label });
          const ok = mode === 'any' || (mode === 'foot' ? S.hero.mode === 'foot' : !!riding());
          if (ok && flat(heroAt(), p) <= r) return;
          if (M.auto) {
            if (mode === 'foot' && riding()) getOut(riding());
            const a = approach(p, Math.min(1.5, r * 0.5)); jumpHero(a.x, a.z, a.yaw);
          }
          yield null;
        }
      } finally { m.unmark('goal'); }
    },

    *drive(m, s) {
      const v = vehicleOf(m, s.vehicle);
      const T = target(m, s.to, s.r); if (!T) return;
      const via = [].concat(s.route || []).map((x) => target(m, x, 12)).filter(Boolean);
      let leg = 0, told = false;
      try {
        for (;;) {
          if (!v || v.gone) { m.fail(s.fail || 'The van is gone.'); yield null; continue; }
          if (v.wrecked) { m.fail('The van is wrecked.'); yield null; continue; }
          if (s.maxDamage != null && v.damage > s.maxDamage) { m.fail(s.fail || 'The van took too much damage.'); yield null; continue; }
          const goal = leg < via.length ? via[leg]() : T(), last = leg >= via.length;
          const r = last ? s.r ?? goal.r ?? 10 : 14;
          m.marker('goal', { x: goal.x, z: goal.z, y: goal.y, r: Math.min(r, 16), kind: last ? 'both' : 'pillar', mapKind: last ? 'objective' : 'waypoint' });
          const inIt = riding() === v;
          if (!inIt) {
            m.marker('van', { x: v.pos.x, z: v.pos.z, y: v.pos.y, r: 3.4, kind: 'ring', mapKind: 'van' });
            if (!told) { told = true; m.objectiveOverride('Get back in the van.'); }
          } else if (told) { told = false; m.unmark('van'); m.objectiveOverride(null); }
          const near = flat(v.pos, goal) <= r;
          if (inIt && near && (!last || !s.park || Math.abs(v.speed) < 0.8)) {
            if (!last) { leg++; continue; }
            return;
          }
          if (inIt && near && last && s.park) m.objectiveOverride('Stop in the box.');
          if (M.auto) {
            if (!inIt) { if (riding() && riding() !== v) getOut(riding()); if (!riding()) S.drive.enter(v, 0); if (S.drive.anim) S.drive.anim.t = S.drive.anim.dur || 9; }
            else {
              const g = last ? T() : goal, a = Math.atan2(g.x - v.pos.x, g.z - v.pos.z);
              const d = flat(v.pos, g), k = d > 2 ? Math.min(d, Math.max(2, d - r * 0.4)) : 0;
              jumpVehicle(v, v.pos.x + Math.sin(a) * k, v.pos.z + Math.cos(a) * k, a);
            }
          }
          yield null;
        }
      } finally { m.unmark('goal'); m.unmark('van'); m.objectiveOverride(null); }
    },

    *enter(m, s) {
      const v = vehicleOf(m, s.vehicle); if (!v) return;
      const want = s.seat;
      try {
        for (;;) {
          const r = riding();
          if (r === v && !S.drive.anim && (want == null || (want === 0 ? S.drive.heroSeat === 0 : S.drive.heroSeat >= 1))) return;
          m.marker('van', { x: v.pos.x, z: v.pos.z, y: v.pos.y, r: 3.4, kind: 'ring', mapKind: 'van' });
          if (v.wrecked) { m.fail('The van is wrecked.'); }
          if (M.auto) {
            if (r && r !== v) getOut(r);
            if (!riding()) { const dp = v.doorPoint(want > 0 ? 'passenger' : 'driver'); S.hero.place(dp.x, dp.z); S.drive.enter(v, want || 0); }
            if (S.drive.anim) S.drive.anim.t = S.drive.anim.dur || 9;
          }
          yield null;
        }
      } finally { m.unmark('van'); }
    },

    *exit(m, s) {
      const v = s.vehicle ? vehicleOf(m, s.vehicle) : null;
      for (;;) {
        const r = riding();
        if (!r || (v && r !== v)) { if (!S.drive.anim && S.hero.mode === 'foot') return; }
        if (M.auto && r) getOut(r);
        yield null;
      }
    },

    *wait(m, s) {
      if (s.until) { yield* lapseTo(m, toHour(s.until), s.lapse ?? 60); return; }
      yield M.auto ? 0 : s.sec ?? 1;
    },

    *stakeout(m, s) {
      const Z = target(m, s.zone, s.r); if (!Z) return;
      const until = toHour(s.until), lapse = s.lapse ?? 60;
      const ev = (s.events || []).map((e) => ({ ...e, h: toHour(e.at) }));
      const ahead = (h) => ((h - S.day.hour + 24) % 24);
      ev.sort((a, b) => ahead(a.h) - ahead(b.h));
      let away = false;
      const stU = {};
      try {
        for (;;) {
          const z = Z(), r = s.r ?? z.r ?? 12;
          m.marker('zone', { x: z.x, z: z.z, y: z.y, r: Math.min(r, 18), kind: 'ring' });
          const inZone = flat(heroAt(), z) <= r;
          if (!inZone) {
            M.timeScale = 1;
            if (!away) { away = true; m.objectiveOverride('Go back to the lookout.'); }
            if (M.auto) jumpHero(z.x, z.z);
          } else {
            if (away) { away = false; m.objectiveOverride(null); }
            M.timeScale = lapse;
            if (M.auto) { const nx = ev.length ? ev[0].h : until; S.day.set(null, nx); }
          }
          // the next event, or the end of the watch
          const next = ev[0];
          if (next && reached(next.h, next)) {
            ev.shift(); M.timeScale = 1;
            yield* runEvent(m, next);
            continue;
          }
          if (!ev.length && reached(until, stU)) return;
          yield null;
        }
      } finally { M.timeScale = 1; m.unmark('zone'); m.objectiveOverride(null); }
    },

    *photo(m, s) {
      const list = [].concat(s.subject);
      const ids = [];
      list.forEach((ref, i) => {
        if (ref === 'any') return;
        const id = `ms:${typeof ref === 'string' ? ref : `pt${i}`}`;
        const spec = subjectSpec(m, ref, s);
        if (spec) { K.photo.subject(id, spec); ids.push(id); }
      });
      // subject 'any' (F2's three photos): every picture counts, count of them. A subject that is not
      // there counts any picture too, so the step never waits on nothing (and never passes on nothing).
      const anyShot = !s.match && (list.includes('any') || !ids.length);
      const timer = s.kind === 'timer'; // P7, E1: prop the phone, the shutter starts ten seconds, run in
      const need = s.match ? 1 : anyShot ? Math.max(1, s.count ?? 1) : Math.min(ids.length, s.count ?? ids.length);
      const min = s.min ?? 50;
      const got = new Set();
      let best = null, refShown = false, tries = 0;
      if (s.match) {
        const h = S.ui.card('text', { title: 'FIND THE SPOT', sub: 'Take the same picture.', dur: 1.4 });
        K.photo.captureReference(s.match);
        yield* await_(h);
        K.showReference(s.match);
        refShown = true;
      }
      const off = K.photo.P.onShot((p) => {
        if (s.match) { if (p.match === s.match) { got.add(s.match); best = p; } else S.ui.toast('Not the same spot. Look at the picture.'); return; }
        if (timer && min <= 0) { got.add(p.id); if (!best || p.score > best.score) best = p; return; } // a keepsake: whatever the timer caught
        if (anyShot) { if (p.score >= min) { got.add(p.id); if (!best || p.score > best.score) best = p; if (need > 1 && got.size < need) S.ui.toast(`${got.size}/${need}`); } else S.ui.toast(`SCORE ${p.score}. YOU NEED ${min}.`); return; }
        if (ids.includes(p.subject) && p.score >= min) { got.add(p.subject); if (!best || p.score > best.score) best = p; }
        else if (ids.includes(p.subject)) S.ui.toast(`SCORE ${p.score}. YOU NEED ${min}.`);
      });
      const label = s.objective || '';
      if (timer) hintOnce('timer', 'Press {camera} to prop the phone. The shutter starts ten seconds: run into the picture.');
      else hintOnce('camera', 'Press {camera} for the phone camera.');
      if (s.window) m.timer(s.window, s.fail || 'You missed the shot.');
      try {
        while (got.size < need) {
          // the timer photo: {camera} props the phone where the hero stands (the step reads it before the camera does)
          if (timer && !M.auto && !K.photo.active && S.input.pressed('camera') && !K.photoLocked()) { S.input.consume('camera'); K.photo.open({ timer: 10, min, subject: label }); }
          if (K.photo.active) K.photo.open({ min, subject: label });
          if (M.auto) {
            tries++;
            if (anyShot) { K.photo.open({ force: true, min }); K.photo.shoot({ force: true, score: Math.max(min, 60) }); }
            else if (s.match) { const r = K.photo.P.reference(s.match); if (r) { K.photo.open({ force: true, min }); K.photo.pose({ x: r.x, y: r.y, z: r.z, yaw: r.yaw, pitch: r.pitch || 0, zoom: 1 }); K.photo.shoot({ force: true }); } }
            else {
              const id = ids.find((x) => !got.has(x));
              if (id) {
                K.aimAt(id);
                const p = K.photo.shoot({ force: true, ...(tries > 2 ? { score: min } : {}) });
                if (p && tries > 2 && !got.has(id)) { p.subject = id; got.add(id); best = p; }
              } else break;
            }
          }
          yield null;
        }
      } finally {
        off();
        for (const id of ids) K.photo.unsubject(id);
        if (refShown) K.showReference(null);
        m.clearTimer();
        if (K.photo.active) { if (M.auto || got.size >= need) K.photo.close(); }
      }
      if (best) {
        best.mission = m.def.id;
        if (s.slot) S.evidence.set(s.slot, best.id);
        if (s.store) S.flags[s.store] = best.id;
        m.lastPhoto = best;
      }
    },

    *tail(m, s) {
      const tv = vehicleOf(m, s.target); if (!tv) return;
      const dest = target(m, s.to, 20); if (!dest) return;
      const near = s.near ?? 25, far = s.far ?? 140, notice = s.notice ?? 6;
      const d0 = dest();
      const h = S.drivers.tail(tv, { x: d0.x, z: d0.z }, { notice: near, noticeFor: notice, onNotice: () => { if (!M.auto) m.fail(s.fail || 'They saw you. Stay back.'); } });
      let farT = 0, hidT = 0;
      const lost = (k) => { if (!M.auto) m.fail(k); };
      try {
        for (;;) {
          const hp = heroAt(), d = flat(hp, tv.pos);
          S.ui.meter('tail', d, { kind: 'band', near, far, max: far * 1.4, label: 'DISTANCE' });
          m.marker('target', { x: tv.pos.x, z: tv.pos.z, y: tv.pos.y, r: 4, kind: 'pillar', mapKind: 'danger' });
          farT = d > far * 1.3 ? farT + m.dt : 0;
          const seen = d < far * 1.3 && clearLine(hp, tv.pos);
          hidT = seen ? 0 : hidT + m.dt;
          if (farT > 8) lost(s.fail || 'You lost them.');
          if (hidT > 12) lost(s.fail || 'You lost them.');
          if (h.done || flat(tv.pos, dest()) < 12 && Math.abs(tv.speed) < 1.5) return;
          if (M.auto) {
            if (h.stop) h.stop();
            const p = dest(); jumpVehicle(tv, p.x, p.z, tv.yaw);
            const v = riding() || S.vehicles.player; if (v) jumpVehicle(v, p.x - Math.sin(tv.yaw) * 60, p.z - Math.cos(tv.yaw) * 60, tv.yaw);
            return;
          }
          yield null;
        }
      } finally { S.ui.clearMeter('tail'); m.unmark('target'); }
    },

    *lose(m, s) {
      const list = [].concat(s.pursuers).map((ref) => vehicleOf(m, ref)).filter(Boolean);
      const sec = s.sec ?? 10, dist = s.dist ?? 250;
      const heroTarget = { get pos() { return heroAt(); }, get vel() { const v = riding(); return v ? v.vel : null; }, get speed() { const v = riding(); return v ? v.speed : 0; }, get yaw() { const v = riding(); return v ? v.yaw : S.hero.face; } };
      // the pursuers top out a little under the hero's vehicle (a pickup's 32 m/s would outrun the van's 28):
      // good driving loses them
      const mine = riding() || S.vehicles.player, cap = (mine && mine.spec ? mine.spec.top : 28) * 0.93;
      const hs = list.map((v) => (v.controller ? v.controller : S.drivers.pursue(v, heroTarget, { ram: false, max: cap })));
      let hid = 0;
      try {
        for (;;) {
          const hp = heroAt();
          let seen = false, allFar = true;
          for (const v of list) { const d = flat(v.pos, hp); if (d < dist) allFar = false; if (d < 130 && clearLine(v.pos, hp)) seen = true; }
          hid = seen ? 0 : hid + m.dt;
          S.ui.meter('lose', hid, { max: sec, label: 'OUT OF SIGHT', crimson: true });
          if (allFar || hid >= sec) return;
          if (M.auto) { list.forEach((v, i) => { S.drivers.stop(v); jumpVehicle(v, clamp(hp.x + 320 + i * 12, -990, 990), clamp(hp.z + 40, -990, 990)); }); }
          yield null;
        }
      } finally { for (const v of list) if (!v.gone) S.drivers.stop(v); void hs; S.ui.clearMeter('lose'); }
    },

    *chase(m, s) {
      const tv = vehicleOf(m, s.target); if (!tv) return;
      // goal 'takedown' (content, P9): the target is a foe on foot; catch him and knock him down
      if (s.goal === 'takedown' || typeof tv.on !== 'function') {
        if (!(tv.a && tv.def)) return;
        S.combat.begin({ music: false });
        try {
          while (!isDown(tv)) {
            if (S.hero.down) m.fail(s.fail || 'The crew pulls you out.');
            m.marker('target', { x: tv.pos.x, z: tv.pos.z, y: tv.pos.y, r: 3, kind: 'pillar', mapKind: 'danger' });
            if (M.auto) { if (riding()) getOut(riding()); ko(tv); }
            yield null;
          }
        } finally { m.unmark('target'); }
        return;
      }
      const goal = s.goal || 'disable', need = s.hits ?? 3;
      const prot = [].concat(s.protect || []).map((ref) => vehicleOf(m, ref)).filter(Boolean);
      const offs = [];
      let hits = 0, lastHit = -9, disabled = false, still = 0, gone = 0, pitted = false, closed = false;
      for (const p of prot) {
        p.protect = true; p.bumps = 0;
        if (s.bumpLimit != null) p.bumpLimit = s.bumpLimit;
        if (s.maxSpeed != null) p.maxSpeed = s.maxSpeed;
        if (s.maxContact != null) p.maxContact = s.maxContact;
        offs.push(p.on('hitProtected', () => { if (!M.auto) m.fail(s.fail || 'Do not ram the white van. There are people inside.'); }));
        offs.push(p.on('bump', (e) => { S.ui.toast(`CAREFUL · ${e.bumps ?? p.bumps}/${p.bumpLimit}`, true); }));
      }
      offs.push(tv.on('hit', (e) => { const mine = riding(); if (mine && e.other === mine && (e.speed ?? 0) > 3 && S.time - lastHit > 1) { hits++; lastHit = S.time; S.ui.toast(`HIT ${Math.min(hits, need)}/${need}`); } }));
      offs.push(tv.on('pit', () => { pitted = true; }));
      const placeGoal = typeof goal === 'string' && S.world.place(goal) ? S.world.place(goal) : null;
      if (!tv.controller && goal !== 'boxIn' && goal !== 'stop') {
        const ends = [{ x: -990, z: 170 }, { x: 560, z: -990 }, { x: 180, z: 990 }, { x: 900, z: 60 }];
        const hp = heroAt(), far = placeGoal || ends.reduce((a, b) => (flat(b, hp) > flat(a, hp) ? b : a));
        S.drivers.flee(tv, { x: far.x, z: far.z });
      }
      try {
        for (;;) {
          const hp = heroAt(), d = flat(tv.pos, hp);
          m.marker('target', { x: tv.pos.x, z: tv.pos.z, y: tv.pos.y, r: 4, kind: 'pillar', mapKind: 'danger' });
          if (goal === 'disable') {
            S.ui.meter('hits', Math.min(hits, need), { pips: need, label: 'RAMS' });
            if (!disabled && (hits >= need || (pitted && s.pit !== false))) { disabled = true; S.drivers.stop(tv); tv.damage = Math.max(tv.damage || 0, 85); S.ui.toast('DISABLED'); }
            if (disabled && Math.abs(tv.speed) < 1) return;
          } else if (goal === 'stop' || goal === 'boxIn') {
            // (25 m: on P9's bridge the stopped pickup can stand between the van and you)
            still = Math.abs(tv.speed) < 0.5 && d < 25 ? still + m.dt : 0;
            if (still >= 2) return;
          } else if (goal === 'catch') { if (d < 8) return; }
          else if (placeGoal && flat(tv.pos, placeGoal) < (placeGoal.r || 10)) m.fail(s.fail || 'They got away.');
          // they get away only once you have caught up with them (P9's convoy leaves from across town)
          if (d < 300) closed = true;
          gone = closed && d > 400 ? gone + m.dt : 0;
          if (gone > 10) m.fail(s.fail || 'They got away.');
          if (M.auto) {
            if (goal === 'disable') { hits = need; S.drivers.stop(tv); tv.speed = 0; }
            else if (goal === 'stop' || goal === 'boxIn') { S.drivers.stop(tv); tv.speed = 0; const v = riding() || S.vehicles.player; if (v) jumpVehicle(v, tv.pos.x - Math.sin(tv.yaw) * 9, tv.pos.z - Math.cos(tv.yaw) * 9, tv.yaw); }
            else if (goal === 'catch') { const v = riding(); if (v) jumpVehicle(v, tv.pos.x - Math.sin(tv.yaw) * 6, tv.pos.z - Math.cos(tv.yaw) * 6, tv.yaw); else S.hero.place(tv.pos.x + 3, tv.pos.z); }
            else if (placeGoal) { hits = need; S.drivers.stop(tv); return; }
          }
          yield null;
        }
      } finally { for (const f of offs) f(); S.ui.clearMeter('hits'); m.unmark('target'); }
    },

    *race(m, s) {
      const gates = [].concat(s.gates).map((g) => { const T = target(m, g, 10); return T ? T() : null; }).filter(Boolean);
      const v = vehicleOf(m, s.vehicle);
      const limit = s.target, voidAt = s.void;
      let i = 0, t = 0, started = false;
      let rival = null;
      // the rival: s.rival names a spawn (F2: Gabe in the tour jeep), else a spawn called 'rival'
      const rv = m.get(s.rival || 'rival');
      if (s.rubber != null && s.rubber !== false && rv && !rv.gone) rival = S.drivers.race(rv, gates, { rubber: s.rubber === true ? 0.1 : +s.rubber });
      try {
        while (i < gates.length) {
          const g = gates[i], nx = gates[i + 1];
          m.marker('gate', { x: g.x, z: g.z, y: g.y, r: Math.min(12, g.r || 10), label: `GATE ${i + 1}/${gates.length}` });
          if (nx) m.marker('gate2', { x: nx.x, z: nx.z, y: nx.y, r: 6, kind: 'pillar', mapKind: 'waypoint', hidden: false }); else m.unmark('gate2');
          const inIt = v && riding() === v;
          if (!started && inIt) { started = true; S.ui.toast('GO'); }
          if (started) { t += m.dt; if (limit) S.ui.timer(Math.max(0, limit - t)); else S.ui.timer(t); }
          if (v && v.wrecked) m.fail('The jeep is wrecked.');
          if (limit && t > limit && voidAt == null) m.fail(s.fail || 'Too slow.');
          if (inIt && flat(v.pos, g) <= (g.r || 10) + 2) {
            i++;
            if (S.audio) S.audio.sfx('pickup', { at: v.pos });
            if (voidAt != null && i >= voidAt) { S.flags[`${m.def.id}:raceVoid`] = true; return; }
            continue;
          }
          if (M.auto) {
            if (!inIt && v) { if (riding()) getOut(riding()); S.drive.enter(v, 0); if (S.drive.anim) S.drive.anim.t = 9; }
            else if (v) jumpVehicle(v, g.x, g.z, Math.atan2(g.x - v.pos.x, g.z - v.pos.z));
          }
          yield null;
        }
        m.result.time = t;
        const key = s.trial || m.def.trial || m.def.id;
        if (!K.trials[key] || t < K.trials[key]) K.trials[key] = Math.round(t * 100) / 100;
      } finally { m.unmark('gate'); m.unmark('gate2'); S.ui.timer(null); if (rival && rival.stop) rival.stop(); }
    },

    *fight(m, s) {
      const waves = [].concat(s.waves || []).map((w) => [].concat(w));
      S.combat.begin({ arena: s.arena, legend: s.legend, music: s.music ?? !!s.boss });
      const pk = pickups(m, s.pickups);
      let boss = null, half = false;
      const offPhase = S.combat.on('bossPhase', (e) => { if (s.until === 'half' && e && e.f === boss) { half = true; if (e.cancel) e.cancel(); } });
      const center = s.arena ? target(m, s.arena, 12) : null;
      try {
        for (const wave of waves) {
          const fs = wave.map((f, i) => { const F = spawnFoe(m, f, i, wave.length, center ? center() : null); if (s.boss && f.foe === s.boss && !boss) boss = F; return F; });
          if (boss && s.until === 'half') boss.noPhase2 = true;
          for (;;) {
            if (S.hero.down) m.fail(s.fail || 'The crew pulls you out.');
            const bossDone = boss && fs.includes(boss) ? (s.until === 'half' ? half || boss.hp <= boss.maxHp * 0.5 + 0.01 || isDown(boss) : boss.tied || boss.gone) : true;
            const rest = fs.every((f) => f === boss || isDown(f));
            if (boss && fs.includes(boss) && boss.downed && !boss.tied && s.until !== 'half') { m.objectiveOverride('Tie him up.'); hintOnce(`tie:${boss.id}`, 'Hold {use} to tie him up.'); }
            if (rest && bossDone) break;
            if (M.auto) { for (const f of fs) if (f !== boss) ko(f); if (boss && fs.includes(boss)) { if (s.until === 'half') boss.hp = Math.min(boss.hp, boss.maxHp * 0.5); else { ko(boss); tieBoss(boss); } } }
            yield null;
          }
          m.objectiveOverride(null);
        }
        S.combat.end();
        yield null;
      } finally { offPhase(); pk(); m.objectiveOverride(null); if (S.combat.active) S.combat.end(); }
    },

    *defend(m, s) {
      const pr = typeof s.protect === 'object' && !Array.isArray(s.protect) ? s.protect : { place: s.protect };
      const T = target(m, pr.place || pr.pos || pr.at || pr.ref, pr.r || 3); if (!T) return;
      const max = pr.hp ?? 100, label = pr.label || 'PROTECT';
      let hp = max;
      const waves = [].concat(s.waves || []).map((w) => [].concat(w));
      S.combat.begin({ arena: s.arena || (() => { const p = T(); return { x: p.x, z: p.z, r: 16 }; })(), music: !!s.boss });
      let boss = null;
      try {
        for (const wave of waves) {
          const p0 = T();
          const fs = wave.map((f, i) => { const F = spawnFoe(m, f, i, wave.length, { x: p0.x, z: p0.z }); if (s.boss && f.foe === s.boss && !boss) boss = F; return F; });
          for (;;) {
            const p = T();
            m.marker('protect', { x: p.x, z: p.z, y: p.y, r: 3, kind: 'ring' });
            if (S.hero.down) m.fail('The crew pulls you out.');
            const heroFar = flat(S.hero.pos, p) > 9;
            let near = 0;
            for (const f of fs) if (!isDown(f) && f.alert !== false && flat(f.pos, p) < 10) near++;
            if (heroFar && near) { hp -= near * 4 * m.dt; m.objectiveOverride(`Stay near the ${label.toLowerCase()}.`); } else m.objectiveOverride(null);
            S.ui.meter('protect', Math.max(0, hp), { max, label, crimson: true, hot: max * 0.3, hotBelow: true });
            if (hp <= 0) m.fail(s.fail || `They got to the ${label.toLowerCase()}.`);
            const bossDone = !boss || !fs.includes(boss) || boss.tied || boss.gone;
            if (fs.every((f) => f === boss || isDown(f)) && bossDone) break;
            if (M.auto) { for (const f of fs) if (f !== boss) ko(f); if (boss && fs.includes(boss)) { ko(boss); tieBoss(boss); } }
            yield null;
          }
        }
        S.combat.end();
      } finally { S.ui.clearMeter('protect'); m.unmark('protect'); m.objectiveOverride(null); if (S.combat.active) S.combat.end(); }
    },

    *stealth(m, s) {
      const guards = [].concat(s.guards || []).map((g, i, all) => {
        if (typeof g === 'string') return watcherOf(m.get(g) || m.spawn(g));
        // {spawn, flashlight}: the mission's own spawn (P3's lookout, F5's Gabe, P5's patrol, P10's six), not a
        // new guard dropped beside the hero; a cast actor (F5's Gabe) watches through a stand-in
        if (g && typeof g.spawn === 'string') return watcherOf(m.get(g.spawn) || m.spawn(g.spawn));
        return spawnFoe(m, { ...g, foe: g.foe || 'guard', alert: g.alert ?? false }, i, all.length);
      }).filter(Boolean);
      const cfgOf = (g) => (typeof g === 'object' ? { flashlight: g.flashlight, mirrors: g.mirrors, range: g.range, sharp: g.sharp, vehicle: g.vehicle } : {});
      [].concat(s.guards || []).forEach((g, i) => { if (guards[i]) S.stealth.watch(guards[i], cfgOf(g)); });
      const setInk = !!s.deepInk && !S.stealth.deepInk;
      if (setInk) S.stealth.deepInk = true;
      const hadFlag = S.flags.stealth; S.flags.stealth = true;
      let spotted = false;
      const off = S.stealth.on('spotted', () => { spotted = true; });
      const T = s.to ? target(m, s.to, s.r) : null;
      hintOnce('crouch', 'Press {crouch} to crouch. Stay out of their light.');
      const standIns = guards.filter((f) => f.standIn);
      try {
        for (;;) {
          for (const f of standIns) standInTick(f);
          if (spotted) {
            if (s.onSpotted === 'fight') {
              spotted = false;
              S.combat.begin({});
              for (const f of guards) f.alert = true;
              while (!guards.every((g) => g.standIn || isDown(g))) { if (S.hero.down) m.fail('The crew pulls you out.'); if (M.auto) guards.forEach(ko); yield null; }
              S.combat.end();
              if (!T) return;
            } else if (!M.auto) m.fail(s.fail || 'They saw you.');
          }
          if (T) {
            const p = T(), r = s.r ?? p.r ?? 5;
            m.marker('goal', { x: p.x, z: p.z, y: p.y, r });
            if (flat(S.hero.pos, p) <= r) return;
            if (M.auto) { S.hero.place(p.x, p.z); }
          } else {
            if (guards.every((g) => g.standIn || isDown(g))) return;
            if (M.auto) guards.forEach(ko);
          }
          yield null;
        }
      } finally {
        off(); for (const f of guards) S.stealth.unwatch(f);
        for (const f of standIns) if (f.beam) { f.beam.removeFromParent(); f.beam.material.dispose(); f.beam = null; }
        if (setInk) S.stealth.deepInk = false;
        S.flags.stealth = hadFlag; if (hadFlag === undefined) delete S.flags.stealth;
        m.unmark('goal');
      }
    },

    *interact(m, s) {
      const T = target(m, s.at, 2); if (!T) return;
      let done = false, spotted = false;
      const id = `mission:${m.def.id}:${m.index}`;
      S.interact.add({ id, tag: 'mission', label: s.label, r: 2.4, hold: s.hold || 0, mode: s.mode || 'foot', prio: 5, pos: () => { const p = T(); return { x: p.x, y: p.y, z: p.z }; }, act: () => { done = true; } });
      const watchers = [].concat(s.watchers || []).map((ref) => { const id = ref && typeof ref === 'object' ? ref.spawn : ref; return watcherOf(m.get(id) || m.spawn(id)); }).filter((f) => f && f.pos);
      for (const f of watchers) S.stealth.watch(f, {});
      const off = watchers.length ? S.stealth.on('spotted', (e) => { if (!e || watchers.includes(e.f || e)) spotted = true; }) : () => {};
      if (s.window) m.timer(s.window, s.fail || 'Too late.');
      try {
        while (!done) {
          const p = T();
          m.marker('use', { x: p.x, z: p.z, y: p.y, r: 1.4, kind: 'both' });
          if (spotted && !M.auto) m.fail(s.fail || 'They saw you.');
          if (M.auto) { if (riding() && (s.mode || 'foot') === 'foot') getOut(riding()); S.hero.place(p.x + 0.8, p.z + 0.8); done = true; }
          yield null;
        }
        if (S.audio) S.audio.sfx('pickup', { at: T() });
      } finally { S.interact.remove(id); off(); for (const f of watchers) S.stealth.unwatch(f); m.unmark('use'); m.clearTimer(); }
    },

    *escort(m, s) {
      const fol = [].concat(s.followers || []).map((ref) => (typeof ref === 'string' ? m.get(ref) || m.spawn(ref) || (CAST_IDS.includes(ref) ? m.castSpawn(ref) : null) : ref)).filter((a) => a && a.root);
      const D = target(m, s.to, 10); if (!D) return;
      if (s.drive) { yield* escortDrive(m, s, fol, D); return; }
      const cover = [].concat(s.cover || []).map((c) => { const T = target(m, c, 3); return T ? T() : null; }).filter(Boolean);
      const walks = [];
      const walkTo = (p) => fol.forEach((a, i) => { const k = i - (fol.length - 1) / 2; walks.push({ a, x: p.x + Math.cos(p.yaw || 0) * k * 0.9, z: p.z - Math.sin(p.yaw || 0) * k * 0.9, speed: 3.6 }); });
      const moveAll = (dt) => {
        for (const w of walks.slice()) {
          const r = w.a.root.position, dx = w.x - r.x, dz = w.z - r.z, d = Math.hypot(dx, dz);
          if (d < 0.2 || M.auto) { r.x = w.x; r.z = w.z; r.y = S.world.surface(r.x, r.z, r.y + 1.5); if (w.a.move) w.a.move(0); walks.splice(walks.indexOf(w), 1); continue; }
          const st = Math.min(d, w.speed * dt); r.x += dx / d * st; r.z += dz / d * st; r.y = S.world.surface(r.x, r.z, r.y + 1.5);
          w.a.root.rotation.y = Math.atan2(dx, dz); if (w.a.move) w.a.move(w.speed);
        }
      };
      const signalId = `mission:${m.def.id}:signal`;
      try {
        for (let k = 0; k < cover.length; k++) {
          const c = cover[k];
          let go = false;
          S.interact.add({ id: signalId, tag: 'mission', label: 'SIGNAL', r: 4, mode: 'foot', prio: 6, pos: () => ({ x: c.x, y: c.y, z: c.z }), act: () => { go = true; } });
          m.objectiveOverride(k === 0 ? 'Go to the first cover. Then signal.' : 'Go to the next cover. Then signal.');
          while (!go) { m.marker('cover', { x: c.x, z: c.z, y: c.y, r: 3 }); moveAll(m.dt); if (M.auto) { S.hero.place(c.x + 1, c.z); go = true; } yield null; }
          S.interact.remove(signalId);
          walkTo(c);
          m.objectiveOverride('Wait for them.');
          while (walks.length) { moveAll(m.dt); yield null; }
        }
        m.unmark('cover'); // the last cover is done: only the goal shows now
        for (const a of fol) S.cast.followers.add(a);
        m.objectiveOverride(null);
        for (;;) {
          const p = D(), r = s.r ?? p.r ?? 8;
          m.marker('goal', { x: p.x, z: p.z, y: p.y, r });
          const all = fol.every((a) => flat(a.root.position, p) < r + 6);
          if (flat(S.hero.pos, p) <= r && all) break;
          if (M.auto) { S.hero.place(p.x, p.z); fol.forEach((a, i) => { a.root.position.set(p.x + 1 + i * 0.7, S.world.surface(p.x, p.z), p.z + 1); }); }
          yield null;
        }
      } finally { S.interact.remove(signalId); m.unmark('cover'); m.unmark('goal'); m.objectiveOverride(null); for (const a of fol) S.cast.followers.remove(a); }
    },

    *collect(m, s) {
      // items: {id, at | place | pos, subject?, slot?, lines | line?, label} (content writes pos, subject, slot and line)
      const items = [].concat(s.items || []).map((it, i) => { const o = typeof it === 'string' ? { id: it, at: it } : { ...it }; if (o.lines == null && o.line != null) o.lines = o.line; return { ...o, i, got: false }; });
      const need = Math.min(items.length, s.need ?? items.length);
      let n = 0, sayH = null;
      const got = (it, photo) => {
        if (it.got) return; it.got = true; n++;
        if (it.slot && photo) S.evidence.set(it.slot, photo.id);
        S.interact.remove(`clue:${m.def.id}:${it.id}`); m.unmark(`clue:${it.id}`); K.photo.unsubject(`clue:${it.id}`);
        S.flags[it.flag || `clue:${it.id}`] = true;
        S.ui.toast(`${n}/${need}`);
        if (it.lines) sayH = S.ui.say([].concat(it.lines), { block: true });
        if (S.audio) S.audio.sfx('pickup', {});
      };
      const offShot = s.photo ? K.photo.P.onShot((p) => { const it = items.find((x) => `clue:${x.id}` === p.subject); if (it && p.score >= (it.min ?? s.min ?? 45)) got(it, p); }) : () => {};
      for (const it of items) {
        const ref = it.at || it.place || it.pos || it.id;
        const T = target(m, ref, 1.5); if (!T) { it.got = true; continue; }
        it.T = T;
        if (s.photo) K.photo.subject(`clue:${it.id}`, { ...((it.subject && subjectSpec(m, it.subject, { kind: it.kind || 'thing' })) || subjectSpec(m, typeof ref === 'string' ? ref : T(), { kind: it.kind || 'thing' })), label: it.label || '' });
        else S.interact.add({ id: `clue:${m.def.id}:${it.id}`, tag: 'mission', label: it.label || 'LOOK', r: it.r || 2.2, mode: 'foot', prio: 4, pos: () => { const p = T(); return { x: p.x, y: p.y, z: p.z }; }, act: () => got(it) });
      }
      try {
        while (n < need) {
          for (const it of items) if (!it.got && it.T) { const p = it.T(); m.marker(`clue:${it.id}`, { x: p.x, z: p.z, y: p.y, r: 1.3, kind: 'ring', mapKind: 'objective' }); }
          S.ui.meter('clues', n, { pips: need, label: s.photo ? 'PHOTOS' : 'CLUES' });
          if (sayH && !sayH.done) { if (M.auto) S.ui.advanceAll(); yield null; continue; }
          if (M.auto) { const it = items.find((x) => !x.got && x.T); if (it) { const p = it.T(); if (riding()) getOut(riding()); S.hero.place(p.x + 0.6, p.z + 0.6); let ph = null; if (s.photo && it.slot) { K.aimAt(`clue:${it.id}`); ph = K.photo.shoot({ force: true, score: s.min ?? 60 }); if (K.photo.active) K.photo.close(); } got(it, ph); } }
          yield null;
        }
        while (sayH && !sayH.done) { if (M.auto) S.ui.advanceAll(); yield null; }
      } finally {
        offShot();
        for (const it of items) { S.interact.remove(`clue:${m.def.id}:${it.id}`); m.unmark(`clue:${it.id}`); K.photo.unsubject(`clue:${it.id}`); }
        S.ui.clearMeter('clues');
      }
    },

    *choice(m, s) {
      const opts = [].concat(s.options || []);
      const h = S.ui.choose(s.title, opts.map((o) => (typeof o === 'string' ? o : o.label)));
      yield* await_(h);
      const i = clamp(h.index >= 0 ? h.index : h.choice >= 0 ? h.choice : 0, 0, opts.length - 1);
      S.flags[`choice:${s.id || m.def.id}`] = i;
      const o = opts[i];
      if (o && typeof o === 'object') {
        if (o.flag) S.flags[o.flag] = true;
        if (o.set) yield* applySet(m, o.set);
        if (o.lines) yield* await_(S.ui.say([].concat(o.lines), { block: true }));
      }
      m.result.choice = i;
    },

    *set(m, s) { yield* applySet(m, s); },

    *script(m, s) {
      const fn = S.content.SCRIPTS && S.content.SCRIPTS[s.fn];
      if (!fn) { console.warn(`[steps] no script '${s.fn}'`); return; }
      const r = fn(m, s);
      if (r && typeof r.next === 'function') yield* r;
    },
  };

  /* ---------------- parts the steps share ---------------- */
  // the clock runs x lapse until it reaches the hour (autopilot jumps)
  function* lapseTo(m, want, lapse) {
    const prev = M.timeScale;
    try {
      M.timeScale = lapse;
      const st = {};
      while (!reached(want, st)) { if (M.auto) S.day.set(null, want); yield null; }
    } finally { M.timeScale = prev === lapse ? 1 : prev; }
  }
  // has the clock reached the hour (going forward, across midnight)? st keeps the last distance
  function reached(want, st) {
    const left = ((want - S.day.hour) % 24 + 24) % 24;
    const was = st._left;
    st._left = left;
    return left < 1 / 60 || left > 23.9 || (was != null && left > was + 6);
  }
  function* runEvent(m, e) {
    if (e.set) yield* applySet(m, e.set);
    // look: a LOOKS preset; content also writes a place id there ({at, line, look: 'perch', sfx, fx}), a hint only
    if (e.look && LOOKS.includes(e.look)) S.look.set(e.look, { dur: 1 });
    if (e.sfx && S.audio) S.audio.sfx(e.sfx);
    if (e.fx === 'flash' && S.look && S.look.base) S.look.base.flash = 1;
    if (e.card) yield* await_(S.ui.card(e.card.kind || 'time', e.card));
    if (e.line && !e.lines) e = { ...e, lines: e.line };
    if (e.lines) { const h = S.ui.say([].concat(e.lines), { block: e.block ?? true }); if (e.block !== false) yield* await_(h); }
    if (e.cine) yield S.cine.play(e.cine, { cast: m.castMap() });
    if (e.fn) { const fn = S.content.SCRIPTS && S.content.SCRIPTS[e.fn]; if (fn) { const r = fn(m, e); if (r && r.next) yield* r; } }
    if (e.step) yield* m.run(e.step);
  }
  // a line of sight between two points 1.4 m up (vehicles and walls, the ground)
  function clearLine(a, b) {
    const t = S.world.colliders.raycast({ x: a.x, y: (a.y || 0) + 1.4, z: a.z }, { x: b.x, y: (b.y || 0) + 1.4, z: b.z });
    return t == null || t > 0.97;
  }
  // a photo subject from a step's subject ref
  function subjectSpec(m, ref, s = {}) {
    if (ref && typeof ref === 'object') { if (ref.root || ref.a) return ref.a ? { fighter: ref, kind: s.kind || 'face' } : { actor: ref, kind: s.kind || 'face' }; return { x: ref.x, y: ref.y, z: ref.z, h: ref.h, kind: s.kind || 'place', lit: ref.lit }; }
    if (typeof ref !== 'string') return null;
    if (ref === 'crew') { const g = crewGroup(); return g.length ? { group: g, kind: 'face' } : null; }
    const o = m.get(ref) || ((m.def.spawns || []).some((x) => x.id === ref) ? m.spawn(ref) : null);
    if (o) {
      if (o.a && o.def) return { fighter: o, kind: s.kind || 'face' };
      if (o.root) return { actor: o, kind: s.kind || 'face' };
      if (o.pos && o.kind) return { vehicle: o, kind: s.kind || 'thing' };
    }
    if (S.world.place(ref)) return { place: ref, kind: s.kind || 'place' };
    if (CAST_IDS.includes(ref)) { const a = S.cast.get(ref); if (a) return { actor: a, kind: s.kind || 'face' }; }
    return null;
  }
  // A cast actor as a stealth watcher (F5's Gabe on the trail): the stealth rules read pos, face and the
  // fighter flags, so it watches through a stand-in. It looks left and right from where it stands (as a posted
  // guard does), its flashlight cone follows it, and it cannot be taken down (it is not a fighter).
  function watcherOf(o) {
    if (!o || (o.a && o.def) || !o.root || o.standIn) return o;
    const a = o, home = a.root.rotation.y, t0 = S.time;
    return { id: `watch:${a.id}`, standIn: true, actor: a, home, t0, downed: false, gone: false, tied: false, alert: false, state: 'calm', t: 0, cooldown: 0, idleClip: 'idle',
      get pos() { return a.root.position; }, get face() { return a.root.rotation.y; }, set face(v) { a.root.rotation.y = v; }, get yaw() { return a.root.rotation.y; } };
  }
  function standInTick(f) {
    if (!f.alert) f.face = f.home + Math.sin((S.time - f.t0) * 0.35) * 0.7;
    if (f.beam) { f.beam.visible = S.world.visible; f.beam.position.set(f.pos.x + Math.sin(f.yaw) * 0.3, f.pos.y + 1.25, f.pos.z + Math.cos(f.yaw) * 0.3); f.beam.rotation.set(0.12, f.yaw, 0, 'YXZ'); }
  }
  // the crew in the scene for a group photo: the hero and every crew body within 40 m
  function crewGroup() {
    const out = new Set(), H = S.hero;
    for (const a of [H && H.actor, ...CREW_IDS.map((id) => S.cast.get(id)), ...((S.cast.followers && S.cast.followers.list) || [])]) {
      if (a && a.root && a.visible !== false && CREW_IDS.includes(a.id) && flat(a.root.position, H.pos) < 40) out.add(a);
    }
    return [...out];
  }
  // weapons on the floor to pick up (F3: the pool cue, the bar stool)
  function pickups(m, list) {
    const ids = [], props = [];
    for (const [i, p] of [].concat(list || []).entries()) {
      if (!p || !WEAPON_IDS.includes(p.weapon)) continue;
      const T = target(m, p.place || p.pos || p.at, 1.5); if (!T) continue;
      const at = T(), id = `pickup:${m.def.id}:${i}`;
      let prop = null;
      try { prop = S.cast.props.make(p.weapon); if (prop) { prop.position.set(at.x, at.y + 0.08, at.z); prop.rotation.set(Math.PI / 2, 0, i * 1.3); (S.world.group || S.scene).add(prop); props.push(prop); } } catch (e) { prop = null; }
      S.interact.add({ id, tag: 'mission', label: `TAKE THE ${WEAPON_NAMES[p.weapon] || p.weapon.toUpperCase()}`, r: 2.2, mode: 'foot', prio: 3, pos: () => ({ x: at.x, y: at.y, z: at.z }),
        act: () => { try { S.combat.give(p.weapon, p.uses != null ? { uses: p.uses } : {}); } catch (e) { console.warn('[steps] give', e); } S.interact.remove(id); if (prop) prop.removeFromParent(); } });
      ids.push(id);
    }
    return () => { for (const id of ids) S.interact.remove(id); for (const p of props) p.removeFromParent(); };
  }
  // P12: the freed people get in the van, then a smooth drive (jerk costs points; no fail but a wreck)
  function* escortDrive(m, s, fol, D) {
    const v = vehicleOf(m, s.vehicle); if (!v) return;
    for (const a of fol) S.cast.followers.add(a);
    S.cast.followers.board(v);
    let wait = 0;
    m.objectiveOverride('Let them get in.');
    while (fol.some((a) => !v.seats.includes(a)) && wait < 10) { wait += m.dt; if (M.auto) wait = 10; yield null; }
    // anyone not seated yet takes a seat now
    for (const a of fol) if (!v.seats.includes(a)) { const k = v.seats.findIndex((x, i) => i >= 2 && !x); if (k >= 0) { S.cast.followers.remove(a); S.drive.seat(a, v, k); } }
    m.objectiveOverride(null);
    let score = 100, lastV = null, lastA = null;
    const key = `${m.def.id}:smooth`;
    try {
      yield* STEPS.enter(m, { vehicle: s.vehicle, seat: 0 });
      for (;;) {
        const p = D(), r = s.r ?? p.r ?? 12;
        m.marker('goal', { x: p.x, z: p.z, y: p.y, r: Math.min(r, 16) });
        if (v.wrecked) m.fail('The van is wrecked.');
        if (riding() === v && m.dt > 0) {
          // jerk: the change of the van's acceleration, forward and sideways
          const vel = { x: v.vel.x, z: v.vel.z };
          if (lastV) {
            const ax = (vel.x - lastV.x) / m.dt, az = (vel.z - lastV.z) / m.dt;
            if (lastA) { const j = Math.hypot(ax - lastA.x, az - lastA.z) / m.dt; if (j > 25) score -= Math.min(4, (j - 25) * 0.004) * m.dt * 60; }
            lastA = { x: ax, z: az };
          }
          lastV = vel;
          score = clamp(score, 0, 100);
          if (s.smooth !== false) S.ui.meter('smooth', score, { max: 100, label: 'SMOOTH', crimson: true, text: `${Math.round(score)}` });
        }
        if (riding() === v && flat(v.pos, p) <= r && Math.abs(v.speed) < 1.2) break;
        if (M.auto) { if (riding() !== v) { if (riding()) getOut(riding()); S.drive.enter(v, 0); if (S.drive.anim) S.drive.anim.t = 9; } else jumpVehicle(v, p.x, p.z, v.yaw); }
        yield null;
      }
    } finally { S.ui.clearMeter('smooth'); m.unmark('goal'); m.objectiveOverride(null); }
    S.flags[key] = Math.round(score);
    m.result.smooth = Math.round(score);
  }

  return { STEPS, applySet, lapseTo, reached, target, vehicleOf, subjectSpec, foeOpts, await_ };
}
