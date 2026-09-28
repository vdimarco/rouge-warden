// js/story/vehicles/drive.js : S.drive, the hero in vehicles (design 4.1).
// - Getting in: E within 3.2 m of a door (S.interact 'GET IN' at the driver's and the passenger's door).
//   The hero steps to the door (or snaps there when something is in the way), the door opens, and 0.6 s
//   later the hero sits in S0 (sitDrive) or S1 (sitPass). From the passenger door with nobody driving,
//   the hero slides over and drives.
// - Getting out: E again, only below 4 m/s ("Slow down to get out."). The landing spot is a ring search
//   (16 angles x 3 radii) around the seat's door, then the other doors, clear of every collider, vehicle,
//   drop and deep water; with none, the hero stays in.
// - seat(actor, v, i) / unseat(actor): the crew and others in seats S0..S9. Only S0 and S1 show through
//   the tinted glass of a van; an open jeep shows everyone.
// - The hero drives with S.input: steer axis, gas, brake, handbrake, horn (H: the kazoo horn once all 51
//   kazoos are found, E8); S.drive.autoGas holds the gas for touch players. autopilot(on, route) drives the
//   hero's vehicle along a route (QA and missions).
import * as THREE from 'three';
import { PHASE_ORDER } from '../types.js';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const ENTER = 0.6, EXIT_MAX = 4;
// Integration: seat nodes are on the floor and the hips belong about 0.45 m above them. CAST's seated poses
// put the actor's root on the seat surface with the Hips bone about 0.11 m above it (measured on the crew
// and gang bodies), so the root goes up 0.34 m: hips 0.45 m over the floor, feet on the floor.
const SEAT_LIFT = 0.34;

export function createDrive(S, V) {
  const seated = new Map(); // actor -> { v, i }
  const doorAnims = [];
  const wp = new THREE.Vector3(), wq = new THREE.Quaternion(), tmpV = new THREE.Vector3();
  const D = {
    riding: null, heroSeat: -1, anim: null, auto: null, autoGas: false,
    get state() { return D.anim ? D.anim.type : D.riding ? 'riding' : 'foot'; },
    // v: the vehicle; seat: 0 drives, 1 rides in front; o.door: the door used (default by seat)
    enter(v, seat = 0, o = {}) {
      if (!v || !S.hero) return false;
      if (D.riding === v) return true;
      if (D.riding || v.wrecked || v.traffic) return false;
      seat = clamp(seat | 0, 0, v.seats.length - 1);
      if (v.seats[seat] && v.seats[seat] !== 'hero') {
        if (seat === 0) return false;
        const free = v.seats.findIndex((x, i) => i > 0 && !x);
        if (free < 0) return false;
        seat = free;
      }
      const door = o.door || doorFor(v, seat);
      D.riding = v; D.heroSeat = seat; v.seats[seat] = 'hero';
      if (seat === 0) { v.driven = true; if (v.controller && v.controller.stop) v.controller.stop(); }
      S.hero.setMode(seat === 0 ? 'drive' : 'passenger');
      const a = S.hero.actor, dp = v.doorPoint(door), hp = S.hero.pos;
      const far = Math.hypot(dp.x - hp.x, dp.z - hp.z) > 4 || blocked(hp, dp);
      D.anim = { type: 'enter', t: 0, dur: ENTER, v, door, from: far ? dp.clone() : hp.clone() };
      if (a) a.visible = true;
      openDoor(v, door, ENTER + 0.25);
      if (S.audio) S.audio.sfx(door === 'slide' ? 'doorSlide' : 'doorOpen', { at: v.pos });
      v.emit('enter', { who: 'hero', seat });
      return true;
    },
    // out of the hero's vehicle: {x, z} or null (too fast, or no room); o.door picks the door to try first
    exit(o = {}) {
      const v = D.riding; if (!v) return null;
      if (Math.abs(v.speed) > EXIT_MAX) { if (S.ui && S.ui.toast) S.ui.toast('Slow down to get out.'); return null; }
      const first = o.door || doorFor(v, D.heroSeat);
      const spot = landingSpot(v, first);
      if (!spot) { if (S.ui && S.ui.toast) S.ui.toast('No room to get out here.'); return null; }
      const seat = D.heroSeat;
      v.seats[seat] = null; D.riding = null; D.heroSeat = -1; D.anim = null;
      if (D.auto && D.auto.v === v) { D.auto.stop(); D.auto = null; }
      if (seat === 0) { v.driven = false; V.park(v); }
      if (V.qa && V.qa.v === v) V.qa = null;
      const a = S.hero.actor;
      S.hero.setMode('foot');
      const yaw = Math.atan2(spot.x - v.pos.x, spot.z - v.pos.z);
      S.hero.place(spot.x, spot.z, yaw, spot.y + 0.4);
      if (a) { if (S.cast && S.cast.pose) S.cast.pose(a, seat === 0 ? 'sitDrive' : 'sitPass', 0); a.visible = true; a.root.quaternion.identity(); a.root.rotation.set(0, yaw, 0); a.root.position.copy(S.hero.pos); }
      openDoor(v, spot.door, 0.8);
      if (S.audio) S.audio.sfx(spot.door === 'slide' ? 'doorSlide' : 'doorClose', { at: v.pos });
      v.emit('exit', { who: 'hero', seat, door: spot.door });
      return { x: spot.x, z: spot.z, door: spot.door };
    },
    seat(actor, v, i) {
      if (!actor || !v || i < 0 || i >= v.seats.length) return;
      if (v.seats[i] === 'hero') return;
      D.unseat(actor, { keep: true });
      if (v.seats[i] && v.seats[i] !== actor) D.unseat(v.seats[i]);
      v.seats[i] = actor; seated.set(actor, { v, i });
      sitStill(actor);
      if (S.cast && S.cast.pose) S.cast.pose(actor, i === 0 ? 'sitDrive' : 'sitPass', 1);
      actor.visible = i < v.spec.shown;
      place(actor, v, i);
      v.emit('seat', { actor, seat: i });
    },
    unseat(actor, o = {}) {
      const rec = seated.get(actor); if (!rec) return;
      seated.delete(actor);
      const { v, i } = rec;
      if (v.seats[i] === actor) v.seats[i] = null;
      if (o.keep) return;
      if (S.cast && S.cast.pose) S.cast.pose(actor, i === 0 ? 'sitDrive' : 'sitPass', 0);
      actor.visible = true;
      const spot = landingSpot(v, doorFor(v, i));
      if (spot && actor.root) { actor.root.quaternion.identity(); actor.root.position.set(spot.x, spot.y, spot.z); actor.root.rotation.set(0, Math.atan2(spot.x - v.pos.x, spot.z - v.pos.z), 0); }
      v.emit('unseat', { actor, seat: i });
    },
    seatsOf: (v) => (v ? v.seats : []),
    // the hero's vehicle drives itself along `route` (points, a place id or {x,z}); off gives control back
    autopilot(on, route) {
      if (D.auto) { D.auto.stop(); D.auto = null; }
      const v = D.riding || S.vehicles.player;
      if (!on || !v) return null;
      if (D.riding === v && D.heroSeat !== 0) return null;
      D.auto = V.drivers.route(v, route || nearestMarker() || v.pos, { lane: true, trim: true });
      return D.auto;
    },
    get seated() { return seated; },
  };
  const nearestMarker = () => { const m = S.markers3d && S.markers3d.list && S.markers3d.list[0]; return m ? { x: m.x, z: m.z } : null; };
  function doorFor(v, seat) {
    const doors = v.view ? v.view.info.doors : null;
    if (seat === 0) return 'driver';
    if (seat === 1) return 'passenger';
    if (doors && doors.slide) return seat >= 8 && doors.rearL ? 'rear' : 'slide';
    return 'passenger';
  }
  function blocked(a, b) { const t = S.world.colliders.raycast({ x: a.x, y: a.y + 0.9, z: a.z }, { x: b.x, y: b.y + 0.9, z: b.z }, { terrain: false }); return t != null && t < 0.95; }
  function openDoor(v, door, dur) {
    const name = door === 'rear' ? 'rearL' : door;
    if (!v.view || !v.view.doors[name] || !v.view.doors[name].pivot) return;
    const prev = doorAnims.find((d) => d.v === v && d.name === name);
    if (prev) { prev.t = Math.min(prev.t, 0.25); prev.dur = Math.max(prev.dur, dur); return; }
    doorAnims.push({ v, name, t: 0, dur });
  }
  // somewhere clear to stand next to door (then the other doors)
  function landingSpot(v, first) {
    const order = [first, 'driver', 'passenger', 'slide', 'rear'].filter((d, i, a) => a.indexOf(d) === i);
    const W = S.world, C = W.colliders;
    const ok = (x, z) => {
      const y = W.surface(x, z, v.pos.y + 1.2);
      if (!Number.isFinite(y) || Math.abs(y - v.pos.y) > 1.4) return null;
      const w = W.water(x, z); if (w && w.y - y > 0.45) return null;
      const top = C.walkTop ? C.walkTop(x, z, y + 0.2) : null;
      if (top == null || Math.abs(top - y) > 0.05) { const n = W.normal(x, z, tmpV); if (n.y < 0.72) return null; }
      const p = { x, z };
      if (C.resolveCircle(p, 0.42, y)) return null;
      for (const o of V.all()) { const [lx, lz] = o.toLocal(x, z); if (Math.abs(lx) < o.hw + 0.45 && Math.abs(lz) < o.hd + 0.45) return null; }
      if (Math.abs(x) > W.HALF - 2 || Math.abs(z) > W.HALF - 2) return null;
      return y;
    };
    for (const door of order) {
      if (door === 'rear' && !(v.view && v.view.info.doors.rearL)) continue;
      const p = v.doorPoint(door);
      let y = ok(p.x, p.z);
      if (y != null) return { x: p.x, y, z: p.z, door };
      for (const r of [0.8, 1.6, 2.4]) for (let k = 0; k < 16; k++) {
        const a = k / 16 * Math.PI * 2, x = p.x + Math.sin(a) * r, z = p.z + Math.cos(a) * r;
        y = ok(x, z);
        if (y != null) return { x, y, z, door };
      }
    }
    // last: anywhere on a wider ring round the vehicle (a door wedged shut on every side)
    for (const r of [v.hd + 1.2, v.hd + 2.5]) for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2, x = v.pos.x + Math.sin(a) * r, z = v.pos.z + Math.cos(a) * r, y = ok(x, z);
      if (y != null) return { x, y, z, door: first };
    }
    return null;
  }
  // A seated actor does not walk. CAST's procedural locomotion lays a stride over whatever clip plays, at
  // full weight while the actor's speed is set, so a crew member still walking when seated (a follower
  // taken off mid-step by seatCrew) stood up through the sitting pose: hips 0.95 m over the seat and the
  // head 0.5 m through the white van's roof. The speed and the stride's weight go to zero at once.
  function sitStill(actor) {
    const L = actor && actor.loco;
    if (!L || (!L.w && !(L.speed > 0) && !L.turn && !L.crouch)) return;
    if (actor.move) actor.move(0); else { L.speed = 0; L.turn = 0; L.crouch = 0; }
    L.w = 0;
  }
  // an actor's world transform from its seat node (actors live in the world group, so no reparenting)
  function place(actor, v, i) {
    if (!actor || !actor.root || !v.view) return;
    const node = v.view.seats[i]; if (!node) return;
    node.updateWorldMatrix(true, false);
    node.getWorldPosition(wp); node.getWorldQuaternion(wq);
    actor.root.position.copy(wp).add(tmpV.set(0, SEAT_LIFT, 0).applyQuaternion(wq)); actor.root.quaternion.copy(wq);
  }

  /* ---------------- per tick */
  // control (PHASE_ORDER.control.vehicles, before the hero): E gets out; the driver's input
  function control(rdt) {
    const v = D.riding;
    if (!v) return;
    const I = S.input;
    if (!D.anim && I.pressed('exit') && S.hero.mode !== 'photo') { I.consume('exit', 'use'); D.exit(); return; }
    if (D.heroSeat !== 0) return;
    if (I.pressed('horn')) { I.consume('horn'); v.horn(); }
    const c = v.controls;
    if (D.anim || D.auto) { if (D.anim) V.park(v); return; }
    if (V.qa && V.qa.v === v && S.time < V.qa.until) return; // S.test.van.drive holds the controls
    if (S.lockControl) { c.throttle = 0; c.brake = 0.3; c.steer = 0; c.handbrake = false; return; }
    const st = I.axis('steer');
    const gas = I.held('gas') || (D.autoGas && !I.held('brake')), brake = I.held('brake');
    c.steer = clamp(st.x, -1, 1); c.throttle = gas ? 1 : 0; c.brake = brake ? 1 : 0; c.handbrake = I.held('handbrake'); c.reverse = true;
  }
  // anim (late): the enter animation, doors, and everyone in a seat follows the vehicle
  function anim(rdt) {
    for (let k = doorAnims.length - 1; k >= 0; k--) {
      const d = doorAnims[k]; d.t += rdt;
      const t = d.t, e = d.dur, open = t < 0.22 ? t / 0.22 : t > e - 0.3 ? Math.max(0, (e - t) / 0.3) : 1;
      if (d.v.view) d.v.view.setDoor(d.name, open * open * (3 - 2 * open));
      if (t >= e) { if (d.v.view) d.v.view.setDoor(d.name, 0); doorAnims.splice(k, 1); if (d.v === D.riding && S.audio) S.audio.sfx('doorClose', { at: d.v.pos }); }
    }
    const v = D.riding, a = S.hero && S.hero.actor;
    if (v && D.anim) {
      const A = D.anim; A.t += rdt;
      const k = clamp(A.t / A.dur, 0, 1), dp = v.doorPoint(A.door);
      if (a && a.root) {
        if (k < 0.45) { const q = k / 0.45; a.root.position.set(A.from.x + (dp.x - A.from.x) * q, A.from.y + (dp.y - A.from.y) * q, A.from.z + (dp.z - A.from.z) * q); a.root.rotation.set(0, Math.atan2(v.pos.x - dp.x, v.pos.z - dp.z), 0); }
        else { place(a, v, D.heroSeat); const q = 1 - (k - 0.45) / 0.55; a.root.position.lerp(dp, q * q); }
        a.visible = true;
      }
      if (k >= 1) {
        D.anim = null;
        if (a && S.cast && S.cast.pose) S.cast.pose(a, D.heroSeat === 0 ? 'sitDrive' : 'sitPass', 1);
      }
    } else if (v && a && a.root) { sitStill(a); place(a, v, D.heroSeat); a.visible = D.heroSeat < v.spec.shown; }
    for (const [actor, rec] of seated) {
      if (!V.alive(rec.v)) { seated.delete(actor); continue; }
      sitStill(actor); // (whoever sets a seated actor walking again, it stays seated)
      place(actor, rec.v, rec.i);
    }
    // the hero is where the vehicle is (regions, audio, traffic and the look follow)
    if (v && S.hero) { S.hero.pos.set(v.pos.x, v.pos.y, v.pos.z); S.hero.face = v.yaw; S.focus.copy(v.pos); }
  }
  function reset() {
    if (D.auto) D.auto.stop();
    D.riding = null; D.heroSeat = -1; D.anim = null; D.auto = null;
    seated.clear(); doorAnims.length = 0;
  }
  // the vehicle is going away: the hero steps out wherever there is room, seated actors come out
  function release(v) {
    if (D.riding === v) {
      const spot = landingSpot(v, doorFor(v, D.heroSeat)) || { x: v.pos.x + 3, y: v.pos.y, z: v.pos.z };
      v.seats[D.heroSeat] = null; D.riding = null; D.heroSeat = -1; D.anim = null;
      if (D.auto) { D.auto.stop(); D.auto = null; }
      S.hero.setMode('foot'); S.hero.place(spot.x, spot.z, 0, spot.y + 0.4);
      const a = S.hero.actor; if (a) { a.visible = true; a.root.quaternion.identity(); if (S.cast && S.cast.pose) S.cast.pose(a, 'sitDrive', 0); }
    }
    for (const [actor, rec] of [...seated]) if (rec.v === v) D.unseat(actor);
    for (let k = doorAnims.length - 1; k >= 0; k--) if (doorAnims[k].v === v) doorAnims.splice(k, 1);
  }
  S.register('control', (cdt, rdt) => control(rdt), PHASE_ORDER.control.vehicles);
  S.register('anim', (cdt, rdt) => anim(rdt), 60);
  return { api: D, reset, release, landingSpot, doorFor };
}
