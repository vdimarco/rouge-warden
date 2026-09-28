// js/story/vehicles/vehicles.js : the VEHICLES package (design 4.1). init(S) fills S.vehicles, S.drive,
// S.traffic, S.drivers and S.test.van.
// - S.vehicles.spawn(kind, {pos | place, yaw, tint, look, protect, bumpLimit, maxSpeed, maxContact, seats,
//   player, gang, enterable}) -> Vehicle. player:true makes it S.vehicles.player (the crew's van); the
//   player's vehicle (and any enterable one) gets 'GET IN' at its driver's and passenger's doors.
// - Protected vehicles (P9): a touch under 4 m/s is a bump ('bump'); a hit at maxSpeed (6) or more, or more
//   than bumpLimit (3) bumps, emits 'hitProtected'. maxContact (E4: 1 m/s for the van with people in it)
//   makes any contact faster than that a 'hitProtected'.
// - Physics: 1/120 s substeps on the story's rdt (never the combat dt, so hitstop leaves vehicles alone),
//   up to 8 a frame. Vehicles within 60 m of the hero or in a mission get full physics; ambient traffic
//   farther out moves kinematically on its lane (C7).
// - People: every 'ai' tick CAST and COMBAT push soft circles {x, z, r, dive(dir), id?} into
//   S.vehicles.people; physics reads them and empties the list. Anyone in a vehicle's path (the next 2 s)
//   above 3 m/s is asked to dive clear (dir: a unit {x, z} away from the path); if dive() returns false,
//   or it is too late, they are a soft wall: the vehicle stops 1.5 m short. No damage, no push, nobody hit.
//   dive() may be called again on later ticks while the person is still in the path; it must be idempotent.
//   S.vehicles.sweeps lists each moving vehicle's path ahead {v, x, z, dx, dz, len, hw, speed} for dodging.
// - Events (per vehicle with v.on, or every vehicle with S.vehicles.on, which adds {v}): 'hit' {other,
//   speed}, 'bump' {by, speed, bumps}, 'hitProtected' {by, speed, reason}, 'wrecked', plus 'enter', 'exit',
//   'seat', 'unseat', 'land', 'pit', 'horn', 'noticed', 'raceDone', 'drowned'.
import { VEHICLE_KINDS, VAN_LOOKS } from '../types.js';
import { SUBSTEP, MAX_SUBSTEPS, DAMAGE, specOf } from './specs.js';
import { createVehicle, stepVehicle, stepSuspension, collidePair, addDamage } from './vehicle.js';
import { createVehicleMesh } from './meshes.js';
import { createDrive } from './drive.js';
import { createDriveCam } from './drivecam.js';
import { createTraffic } from './traffic.js';
import { createDrivers } from './drivers.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

export function init(S) {
  let seq = 0, allArr = [], dirty = true;
  const list = [], hooks = new Map();
  const emitG = (evt, d) => { for (const f of (hooks.get(evt) || []).slice()) f(d); };
  const onG = (evt, fn) => { if (!hooks.has(evt)) hooks.set(evt, []); hooks.get(evt).push(fn); return () => { const a = hooks.get(evt), i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; };

  // every vehicle mesh lives in this group, shown with Sedona (not inside S.world.group, which the world
  // package counts against its own draw budget)
  const root = new S.THREE.Group(); root.name = 'vehicles'; root.visible = false;
  S.scene.add(root);

  /* ---------------- the internal api the parts share */
  const V = {
    root,
    all() { if (dirty) { allArr = list.concat(traffic ? traffic.api.cars : []); dirty = false; } return allArr; },
    make(kind, o = {}) { // a vehicle with no mesh of its own (traffic draws with instances)
      const v = createVehicle(S, `t${++seq}`, kind, { ...o, traffic: true }, null);
      v.hooks = emitG; dirty = true; return v;
    },
    drop(v) { dirty = true; if (v.controller && v.controller.stop) v.controller.stop(); drive.release(v); },
    alive: (v) => list.includes(v) || (traffic && traffic.api.cars.includes(v)),
    park(v) { const c = v.controls; c.throttle = 0; c.brake = 1; c.steer = 0; c.handbrake = Math.abs(v.speed) < 0.5; c.reverse = false; },
    qa: null,
    drivers: null,
  };
  const drivers = createDrivers(S, V); V.drivers = drivers.api;
  const drive = createDrive(S, V);
  const cam = createDriveCam(S, drive.api);
  const traffic = createTraffic(S, V);

  /* ---------------- spawn and despawn */
  function spawn(kind, o = {}) {
    if (!VEHICLE_KINDS.includes(kind)) throw new Error(`S.vehicles.spawn: unknown kind '${kind}'. Use one of: ${VEHICLE_KINDS.join(', ')}`);
    const view = createVehicleMesh(kind, { tint: o.tint, gang: o.gang, look: o.look });
    view.obj.rotation.order = 'YXZ';
    V.root.add(view.obj);
    const v = createVehicle(S, `v${++seq}`, kind, o, view);
    v.hooks = emitG;
    if (Number.isInteger(o.seats) && o.seats > 0) v.seats = new Array(Math.min(10, o.seats)).fill(null);
    if (o.lights != null) v.lightsForced = !!o.lights;
    if (o.siren) v.siren = true;
    list.push(v); dirty = true;
    if (o.player) { S.vehicles.player = v; v.enterable = true; }
    if (v.enterable) addDoors(v);
    sync(v, 0);
    return v;
  }
  function addDoors(v) {
    const can = () => !drive.api.riding && !v.wrecked && Math.abs(v.speed) < 3 && S.world.visible && v.enterable;
    const at = (door) => () => v.doorPoint(door);
    S.interact.add({ id: `getin:${v.id}:driver`, tag: 'vehicles', label: 'GET IN', r: 3.2, mode: 'foot', pos: at('driver'), when: can, act: () => drive.api.enter(v, 0, { door: 'driver' }) });
    S.interact.add({ id: `getin:${v.id}:passenger`, tag: 'vehicles', label: v.seats[0] ? 'RIDE' : 'GET IN', r: 3.2, mode: 'foot', pos: at('passenger'), when: can,
      act: () => drive.api.enter(v, v.seats[0] && v.seats[0] !== 'hero' ? 1 : 0, { door: 'passenger' }) });
  }
  function despawn(v) {
    if (!v) return;
    const i = list.indexOf(v);
    if (i < 0) { if (traffic.api.cars.includes(v)) traffic.remove(v); return; }
    drive.release(v);
    if (v.controller && v.controller.stop) v.controller.stop();
    list.splice(i, 1); dirty = true;
    if (S.vehicles.player === v) S.vehicles.player = null;
    S.interact.remove(`getin:${v.id}:driver`); S.interact.remove(`getin:${v.id}:passenger`);
    if (v.view) v.view.dispose();
    v.gone = true;
  }

  S.vehicles = { spawn, despawn, list, player: null, sweeps: [], people: [], on: onG };
  S.drive = drive.api;
  S.traffic = traffic.api;
  S.drivers = drivers.api;

  /* ---------------- people in the road */
  const asked = new Map(); // person key -> { t, ok }
  function collectPeople() {
    const P = S.vehicles.people.slice();
    const H = S.hero;
    // the hero on foot counts even if nobody pushed them (they never dive: the traffic stops for them)
    if (H && H.mode === 'foot' && S.world.visible && !P.some((p) => Math.hypot(p.x - H.pos.x, p.z - H.pos.z) < 0.8)) P.push({ x: H.pos.x, z: H.pos.z, r: 0.45, hero: true, dive: () => false });
    return P;
  }
  // once a tick: who is in which vehicle's way; ask them to dive, or mark them as a wall
  function planPeople(phys, P) {
    for (const v of phys) {
      v.walls = null;
      const sp = v.speed, as = Math.abs(sp); if (as < 0.3 || !P.length) continue;
      const dir = sp > 0 ? 1 : -1;
      for (const p of P) {
        const [lx, lz] = v.toLocal(p.x, p.z), r = p.r ?? 0.4;
        if (Math.abs(lx) > v.hw + r + 0.35) continue;
        const along = dir * lz - v.hd - r;
        if (along < -v.hd || along > as * 2 + 2) continue;
        let wall = true;
        if (as > 3 && typeof p.dive === 'function') {
          const key = p.id ?? p.actor ?? p, prev = asked.get(key);
          let ok = prev && S.time - prev.t < 1.2 ? prev.ok : null;
          if (ok == null) {
            // away from the path: to the side they are already on (seen from the vehicle)
            const side = lx >= 0 ? 1 : -1, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
            try { ok = p.dive({ x: side * c, z: -side * s }) !== false; } catch (e) { ok = false; }
            asked.set(key, { t: S.time, ok });
          }
          // a dive takes 0.4 s: trust it only with time to spare
          wall = !ok || along < as * 0.45 + 1.2;
        }
        if (wall) (v.walls || (v.walls = [])).push(p);
      }
    }
    for (const [k, a] of asked) if (S.time - a.t > 3) asked.delete(k);
  }
  // before each substep: no faster than can stop 1.5 m short of a wall of people (a soft stop, no damage)
  function softStop(v) {
    if (!v.walls) return;
    const sp = v.speed, dir = sp > 0 ? 1 : -1;
    let allowed = Infinity;
    for (const p of v.walls) {
      const [, lz] = v.toLocal(p.x, p.z), along = dir * lz - v.hd - (p.r ?? 0.4);
      allowed = Math.min(allowed, Math.sqrt(2 * 12 * Math.max(0, along - 1.5)));
    }
    if (Math.abs(sp) > allowed) {
      const f = [Math.sin(v.yaw), Math.cos(v.yaw)], cut = (Math.abs(sp) - allowed) * dir;
      v.vel.x -= f[0] * cut; v.vel.z -= f[1] * cut;
      v.controls.throttle = 0;
      v.peopleStop = S.time;
    }
  }

  /* ---------------- physics */
  let lastSteps = 0;
  S.register('physics', (cdt, rdt) => {
    if (!S.world.ready) return;
    const dt = Math.min(rdt, 0.1); if (!(dt > 0)) return;
    const n = Math.min(MAX_SUBSTEPS, Math.max(1, Math.ceil(dt / SUBSTEP - 1e-6))), h = dt / n;
    lastSteps = n;
    const all = V.all(), phys = all.filter((v) => !v.kinematic);
    // who drives: the hero (drive.js set the controls), a driver or traffic, the QA override, else parked
    const Dr = drive.api;
    for (const v of phys) {
      if (V.qa && V.qa.v === v && S.time < V.qa.until) { const q = V.qa, c = v.controls; c.throttle = Math.max(0, q.th); c.brake = Math.max(0, -q.th); c.steer = q.st; c.handbrake = !!q.hb; c.reverse = true; v.driven = true; continue; }
      if (Dr.riding === v && Dr.heroSeat === 0 && !Dr.anim) { v.driven = true; continue; }
      if (v.controller || v.tr) { v.driven = true; continue; }
      v.driven = false; V.park(v);
    }
    if (V.qa && S.time >= V.qa.until) V.qa = null;
    const P = collectPeople();
    planPeople(phys, P);
    for (let k = 0; k < n; k++) {
      for (const v of phys) { softStop(v); stepVehicle(S, v, h); }
      for (let i = 0; i < phys.length; i++) for (let j = i + 1; j < phys.length; j++) collidePair(S, phys[i], phys[j]);
    }
    // the paths ahead, for anyone who wants to get out of the way
    const sw = S.vehicles.sweeps; sw.length = 0;
    for (const v of all) {
      const sp = v.speed; if (Math.abs(sp) < 1) continue;
      const dir = sp > 0 ? 1 : -1, fx = Math.sin(v.yaw) * dir, fz = Math.cos(v.yaw) * dir;
      sw.push({ v, x: v.pos.x + fx * v.hd, z: v.pos.z + fz * v.hd, dx: fx, dz: fz, len: Math.abs(sp) * 2, hw: v.hw + 0.4, speed: Math.abs(sp) });
    }
    S.vehicles.people.length = 0;
  }, 0);

  // ai: drivers, then traffic (after CAST and COMBAT pushed this tick's people)
  S.register('ai', (cdt, rdt) => { if (!S.world.ready) return; drivers.update(rdt); traffic.update(rdt); }, 50);

  /* ---------------- the look of it: meshes, lamps, smoke, sound */
  const night = () => (S.day && S.day.night) || (S.look && S.look.active && S.look.ink > 0.6);
  const camPos = () => S.camera.position;
  function sync(v, dt) {
    const o = v.view.obj, s = v.susp;
    o.position.set(v.pos.x, v.pos.y, v.pos.z);
    o.rotation.set(-s.slopeP, v.yaw, s.slopeR);
    v.view.chassis.position.y = s.lift; v.view.chassis.rotation.set(s.pitch, 0, s.roll);
    for (const w of v.view.wheels) { if (w.front) w.steer.rotation.y = v.steerAngle; w.spin.rotation.x = v.spin; }
  }
  const fx = () => S.ctx && S.ctx.fx;
  function smoke(v, dt) {
    const F = fx(); if (!F) return;
    const d = v.pos.distanceTo(camPos()); if (d > 90) return;
    v.fxT -= dt;
    const stage = v.wrecked ? 3 : v.damage >= DAMAGE.smoke ? 2 : v.damage >= DAMAGE.light ? 1 : 0;
    if (!stage || v.fxT > 0) return;
    const [hx, hz] = v.toWorld(0, v.hd - 0.8), hy = v.pos.y + v.h * 0.55;
    if (stage === 1) { F.dust({ x: hx, y: hy, z: hz, groundY: hy }, 1, 0.25); v.fxT = 0.35; }
    else { F.ink({ x: hx, y: hy + 0.2, z: hz, groundY: hy - 0.4 }, stage === 3 ? 3 : 1, 0.35, 1.3); v.fxT = stage === 3 ? 0.12 : 0.25; }
  }
  let loops = null;
  function sound(v, dt) {
    const A = S.audio; if (!A) return;
    if (!v) { if (loops) { for (const l of Object.values(loops)) l.stop(0.3); loops = null; } return; }
    if (!loops) loops = { engine: A.loop('engine', { at: v.pos }), skid: A.loop('skid', { at: v.pos }), gravel: A.loop('gravel', { at: v.pos }) };
    const sp = Math.abs(v.speed), gears = [0, 7, 13, 19, 25, 40];
    let g = 0; while (g < 4 && sp > gears[g + 1]) g++;
    const rpm = v.wrecked || v.drowned ? 0 : clamp(0.18 + 0.82 * (sp - gears[g]) / (gears[g + 1] - gears[g]) * 0.85 + (v.controls.throttle > 0 ? 0.08 : 0), 0, 1);
    loops.engine.set({ rpm, throttle: v.controls.throttle, at: v.pos });
    loops.skid.set({ slip: v.airborne ? 0 : clamp((v.slip - 2) / 5, 0, 1) * (sp > 4 ? 1 : 0), at: v.pos });
    const rough = v.surface !== 'asphalt' && !v.airborne;
    loops.gravel.set({ speed: rough ? clamp(sp / 20, 0, 1) : 0, at: v.pos });
  }
  // the two spots are the van's while it needs them; turned off once when it stops (so a scene may borrow them)
  let lampsOn = false;
  function headlights(on, v) {
    const L = S.look; if (!L || !L.lights || !L.lights.spots) return;
    if (!on || !v || !v.view) { if (lampsOn && L.headlights) L.headlights(false); lampsOn = false; return; }
    if (L.headlights) L.headlights(true);
    lampsOn = true;
    const info = v.view.info, sp = L.lights.spots;
    for (let i = 0; i < 2; i++) {
      const [hx, hy, hz] = info.head[i];
      const [wx, wz] = v.toWorld(hx, hz + 0.2);
      sp[i].position.set(wx, v.pos.y + hy, wz);
      const [tx, tz] = v.toWorld(hx * 1.6, hz + 26);
      sp[i].target.position.set(tx, v.pos.y + Math.sin(v.susp.slopeP) * 26 - 0.6, tz);
      sp[i].target.updateMatrixWorld();
      if (i === 0 && v.damage >= DAMAGE.light) sp[i].intensity = 0; // the left lamp is out
    }
  }
  let sirenT = 0;
  // (world phase: Sedona's visibility can change in a task or at leave; the group follows it before the draw)
  // the traffic batch is written here, after the camera moved: cars out of view (and of shadow reach) are left out
  S.register('world', () => { root.visible = !!S.world.visible; if (root.visible) traffic.draw(night(), S.camera); }, 50);
  S.register('anim', (cdt, rdt) => {
    const dt = Math.min(rdt, 0.1);
    const nt = night();
    sirenT += dt;
    for (const v of list) {
      stepSuspension(v, dt);
      sync(v, dt);
      v.lights = v.lightsForced ?? (nt && !v.wrecked);
      v.view.setLights(v.lights);
      v.view.setBrake(v.controls.brake > 0.1 && v.driven && Math.abs(v.speed) > 0.3);
      v.view.lightOut(v.damage >= DAMAGE.light);
      if (v.view.bar) v.view.siren(!!v.siren, sirenT);
      smoke(v, dt);
    }
    for (const v of traffic.api.cars) if (!v.kinematic) stepSuspension(v, dt);
    const r = drive.api.riding;
    const lampV = r || (S.vehicles.player && S.vehicles.player.pos.distanceTo(camPos()) < 60 ? S.vehicles.player : null);
    headlights(!!lampV && lampV.lights && S.world.visible, lampV);
    sound(r && S.world.visible ? r : null, dt);
    // dust behind the wheels off the asphalt
    if (r && fx() && r.surface !== 'asphalt' && r.surface !== 'water' && Math.abs(r.speed) > 6 && !r.airborne) {
      r.dustT = (r.dustT || 0) - dt;
      if (r.dustT <= 0) { r.dustT = 0.13; r.dustSide = -(r.dustSide || 1); const [x, z] = r.toWorld(r.dustSide * r.spec.track / 2, -r.spec.wheelbase / 2 - 0.3); fx().dust({ x, y: r.pos.y, z, groundY: r.pos.y }, 1, 0.4); }
    }
  }, 50);
  // the hero's vehicle: bumps are heard
  onG('hit', (e) => { const r = drive.api.riding; if (e.v === r && e.speed > 1.5 && S.audio) S.audio.sfx('bump', { at: e.v.pos, gain: clamp(e.speed / 12, 0.2, 1) }); });

  // the driving HUD: speed, damage, the ten seats
  S.register('hud', () => {
    const r = drive.api.riding;
    if (!r || !S.ui) return;
    if (S.ui.speed) S.ui.speed(Math.abs(r.speed));
    if (S.ui.damage) S.ui.damage(r.damage / 100);
    if (S.ui.seats) S.ui.seats(r.seats.map((x) => (x === 'hero' ? (S.hero && S.hero.body) || 'hero' : x ? x.id || 'crew' : null)));
  }, 10);

  /* ---------------- the session */
  function clearAll() {
    sound(null, 0); headlights(false);
    drivers.clear(); traffic.clear(); drive.reset(); cam.reset();
    for (const v of [...list]) despawn(v);
    S.vehicles.player = null; S.vehicles.sweeps.length = 0; S.vehicles.people.length = 0;
    asked.clear(); V.qa = null; drive.api.autoGas = false; dirty = true; root.visible = false;
  }
  S.bus.on('start', () => { clearAll(); traffic.api.setDensity(1); });
  S.bus.on('exit', clearAll);

  /* ---------------- QA */
  const pv = () => S.vehicles.player;
  S.test.van = {
    enter: () => drive.api.enter(pv(), 0), exit: () => drive.api.exit(),
    // throttle (-1 brakes and reverses), steer (+1 right), handbrake, for sec seconds of story time
    drive(th, st = 0, hb = false, sec = 1) { const v = drive.api.riding || pv(); if (!v) return; V.qa = { v, th: +th || 0, st: +st || 0, hb: !!hb, until: S.time + sec }; },
    teleport: (x, z, yaw) => { const v = pv(); if (v) v.setPose(x, z, yaw ?? v.yaw); },
    get pos() { const v = pv(); return v ? v.pos : null; }, get yaw() { const v = pv(); return v ? v.yaw : null; },
    get speed() { const v = pv(); return v ? v.speed : 0; }, get damage() { const v = pv(); return v ? v.damage : 0; },
    get seats() { const v = pv(); return v ? v.seats : []; },
  };
  S.test.vehicles = {
    get all() { return V.all(); }, get steps() { return lastSteps; }, get traffic() { return traffic.api.cars.length; },
    get kinematic() { return traffic.api.cars.filter((v) => v.kinematic).length; },
    draws() { let n = 0; for (const v of list) v.view.obj.traverse((o) => { if (o.isMesh && o.visible) n++; }); return { vehicles: n, traffic: traffic.batch ? traffic.batch.draws : 0 }; },
    damage: (v, k) => addDamage(S, v, k),
    landingSpot: (v, door) => drive.landingSpot(v, door),
    specs: (kind) => specOf(kind), looks: VAN_LOOKS,
  };
}
