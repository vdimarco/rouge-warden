// Stub VEHICLES (frozen; the vehicles package replaces vehicles/vehicles.js, not this file).
// Box vehicles moved kinematically: W/S drive, A/D steer, E gets in and out at once. Ten seats, events,
// a chase camera, and an autopilot that follows a route.
import { VEHICLE_KINDS, CAMERA_PRIO } from '../types.js';

const SIZE = { van: [2.05, 2.6, 6.0], jeep: [1.8, 1.8, 4.2], suv: [2.0, 1.9, 5.0], suv_fbi: [2.0, 1.9, 5.0], pickup: [2.0, 1.9, 5.6], sedan: [1.8, 1.4, 4.6], rv: [2.5, 3.2, 9.0], whitevan: [2.05, 2.6, 6.0] };
const COLOR = { van: 0xe8e6e0, jeep: 0xe0782a, suv: 0x1a1a1c, suv_fbi: 0x1c2230, pickup: 0x6a5a48, sedan: 0x8a8e94, rv: 0xd8d2c4, whitevan: 0xe8e6e0 };
const TOP = 28, ACCEL = 6, BRAKE = 10, REVERSE = 7;

export function init(S) {
  const { THREE } = S;
  let seq = 0;
  const list = [], hooks = new Map();
  const on = (map, evt, fn) => { if (!map.has(evt)) map.set(evt, []); map.get(evt).push(fn); return () => { const a = map.get(evt), i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; };
  const emit = (map, evt, d) => { for (const f of (map.get(evt) || []).slice()) f(d); };

  function spawn(kind, o = {}) {
    if (!VEHICLE_KINDS.includes(kind)) throw new Error(`S.vehicles.spawn: unknown kind '${kind}'`);
    const [w, h, l] = SIZE[kind];
    const obj = new THREE.Group(); obj.name = `vehicle:${kind}`;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.5, l), new THREE.MeshLambertMaterial({ color: o.tint ?? COLOR[kind] }));
    body.position.y = 0.5 + (h - 0.5) / 2;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.6, 0.1), new THREE.MeshLambertMaterial({ color: 0x151515 }));
    glass.position.set(0, h - 0.6, l / 2 + 0.02);
    obj.add(body, glass);
    (S.world.group || S.scene).add(obj);
    const at = o.place ? S.world.place(o.place) : o.pos || { x: 0, z: 0 };
    const own = new Map();
    const v = {
      id: `v${++seq}`, kind, pos: new THREE.Vector3(at.x, 0, at.z), yaw: o.yaw ?? (at && at.yaw) ?? 0, vel: new THREE.Vector3(), speed: 0,
      damage: 0, wrecked: false, protect: !!o.protect, bumpLimit: o.bumpLimit ?? 3, bumps: 0, look: { ...(o.look || {}) },
      controls: { throttle: 0, brake: 0, steer: 0, handbrake: false }, seats: new Array(10).fill(null), lights: false, route: null, routeSpeed: 20,
      horn() { S.audio.sfx('horn', { at: v.pos }); },
      setPose(x, z, yaw = v.yaw) { v.pos.set(x, S.world.surface(x, z), z); v.yaw = yaw; sync(v); },
      doorPoint(side = 'driver') { const s = side === 'passenger' ? 1 : -1, back = side === 'rear' ? -l / 2 - 0.8 : side === 'slide' ? -0.6 : 0.8; const c = Math.cos(v.yaw), sn = Math.sin(v.yaw); const lx = side === 'rear' ? 0 : s * (w / 2 + 0.8); return new THREE.Vector3(v.pos.x + lx * c + back * sn, v.pos.y, v.pos.z - lx * sn + back * c); },
      setLook(lk) { Object.assign(v.look, lk); },
      obj, on: (evt, fn) => on(own, evt, fn), emit: (evt, d) => { emit(own, evt, d); emit(hooks, evt, { v, ...d }); },
    };
    list.push(v); sync(v);
    if (o.player) {
      S.vehicles.player = v;
      S.interact.add({ id: `getin:${v.id}`, tag: 'vehicles', pos: () => v.pos, r: 4.5, mode: 'foot', label: 'GET IN', act: () => S.drive.enter(v, 0) });
    }
    return v;
  }
  function sync(v) { v.obj.position.copy(v.pos); v.obj.rotation.y = v.yaw; }
  function despawn(v) {
    if (!v) return;
    const i = list.indexOf(v); if (i >= 0) list.splice(i, 1);
    if (S.drive.riding === v) { S.drive.riding = null; S.hero.setMode('foot'); }
    if (S.vehicles.player === v) S.vehicles.player = null;
    S.interact.remove(`getin:${v.id}`);
    v.obj.removeFromParent(); v.obj.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
  S.vehicles = { spawn, despawn, list, player: null, sweeps: [], people: [], on: (evt, fn) => on(hooks, evt, fn) };

  const D = S.drive = {
    riding: null, auto: false,
    enter(v, seat = 0) {
      if (!v || D.riding || !S.hero) return false;
      v.seats[seat] = 'hero'; D.riding = v;
      S.hero.setMode(seat === 0 ? 'drive' : 'passenger');
      return true;
    },
    exit() {
      const v = D.riding; if (!v) return null;
      if (Math.abs(v.speed) > 4) { S.ui.toast('Slow down to get out.'); return null; }
      const i = v.seats.indexOf('hero'); if (i >= 0) v.seats[i] = null;
      D.riding = null; D.auto = false;
      const p = v.doorPoint('driver'); S.hero.place(p.x, p.z, v.yaw); S.hero.setMode('foot');
      return { x: p.x, z: p.z };
    },
    seat(actor, v, i) { v.seats[i] = actor; if (actor && actor.root) actor.visible = false; },
    unseat(actor) { for (const v of list) { const i = v.seats.indexOf(actor); if (i >= 0) v.seats[i] = null; } if (actor && actor.root) actor.visible = true; },
    seatsOf: (v) => v.seats,
    autopilot(on, route) { D.auto = !!on; const v = D.riding || S.vehicles.player; if (v) { v.route = on ? route || null : null; v.routeSpeed = 22; } },
  };
  S.traffic = { cars: [], setDensity() {}, clear() {} };
  const route = (v, points, o = {}) => { v.route = points.map((p) => ({ x: p.x, z: p.z })); v.routeSpeed = o.speed || 14; };
  S.drivers = { route, tail: route, convoy: (vs, points, o) => { for (const v of vs) route(v, points, o); }, pursue() {}, flee: route, race: route, stop: (v) => { v.route = null; v.speed = 0; } };

  // follow the route kinematically; the player's van reads W/S/A/D (gas, brake, steer)
  function drive(v, dt) {
    if (v.route && v.route.length) {
      const t = v.route[0], dx = t.x - v.pos.x, dz = t.z - v.pos.z, d = Math.hypot(dx, dz);
      if (d < 6) { v.route.shift(); if (!v.route.length) { v.speed = 0; v.route = null; return; } }
      v.yaw = Math.atan2(dx, dz); v.speed = Math.min(v.routeSpeed, d * 2);
    } else if (D.riding === v && S.hero.mode === 'drive' && !S.lockControl) {
      const gas = S.input.held('gas'), brake = S.input.held('brake'), steer = S.input.axis('steer').x;
      if (gas) v.speed = Math.min(TOP, v.speed + ACCEL * dt);
      else if (brake) v.speed = v.speed > 0.5 ? Math.max(0, v.speed - BRAKE * dt) : Math.max(-REVERSE, v.speed - ACCEL * 0.6 * dt);
      else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (2 + 0.02 * v.speed * v.speed) * dt);
      if (S.input.held('handbrake')) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 12 * dt);
      v.yaw -= steer * 1.6 * Math.max(-1, Math.min(1, v.speed / 6)) * dt / (1 + Math.abs(v.speed) / 18);
    } else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 8 * dt);
    const fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    v.vel.set(fx * v.speed, 0, fz * v.speed);
    v.pos.x = Math.max(-S.world.HALF, Math.min(S.world.HALF, v.pos.x + v.vel.x * dt));
    v.pos.z = Math.max(-S.world.HALF, Math.min(S.world.HALF, v.pos.z + v.vel.z * dt));
    v.pos.y = S.world.surface(v.pos.x, v.pos.z);
    sync(v);
  }
  S.register('physics', (cdt, rdt) => { for (const v of list) drive(v, rdt); });
  // in the driver's seat: E gets out. This runs before the hero's control (order 0), so the same key
  // press that gets in never gets straight back out.
  S.register('control', () => {
    const v = D.riding; if (!v) return;
    if (S.input.pressed('exit') && S.hero.mode !== 'photo') D.exit();
  }, -5);
  S.register('ai', () => { const v = D.riding; if (v) { S.hero.pos.copy(v.pos); S.focus.copy(v.pos); } });

  // the chase camera: 8.5 m back, 3 m up, looking 6 m ahead
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3();
  let camInit = false;
  S.cameras.add('drive', CAMERA_PRIO.drive, () => !!D.riding && S.world.visible, (rdt) => {
    const v = D.riding, fx = Math.sin(v.yaw), fz = Math.cos(v.yaw);
    want.set(v.pos.x - fx * 8.5, v.pos.y + 3, v.pos.z - fz * 8.5);
    if (!camInit) { camPos.copy(want); camInit = true; } else camPos.lerp(want, 1 - Math.exp(-rdt * 6));
    look.set(v.pos.x + fx * 6, v.pos.y + 1.2, v.pos.z + fz * 6);
    S.camera.position.copy(camPos); S.camera.lookAt(look);
    S.camera.fov = 60 + Math.min(10, Math.abs(v.speed) * 0.35); S.camera.updateProjectionMatrix();
  });
  S.bus.on('exit', () => { for (const v of [...list]) despawn(v); D.riding = null; D.auto = false; camInit = false; });

  S.test.van = {
    enter: () => D.enter(S.vehicles.player, 0), exit: () => D.exit(),
    drive(th, st, hb, sec) { const v = S.vehicles.player; if (!v) return; const end = S.time + sec; const off = S.register('physics', () => { if (S.time >= end) { off(); return; } v.speed = Math.max(-REVERSE, Math.min(TOP, v.speed + th * ACCEL / 60)); v.yaw -= st * 0.02; }, -1); },
    teleport: (x, z, yaw) => { const v = S.vehicles.player; if (v) v.setPose(x, z, yaw); },
    get pos() { return S.vehicles.player && S.vehicles.player.pos; }, get yaw() { return S.vehicles.player && S.vehicles.player.yaw; },
    get speed() { return S.vehicles.player ? S.vehicles.player.speed : 0; }, get damage() { return S.vehicles.player ? S.vehicles.player.damage : 0; },
    get seats() { return S.vehicles.player ? S.vehicles.player.seats : []; },
  };
}
