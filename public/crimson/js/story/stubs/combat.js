// Stub COMBAT (frozen; the combat package replaces combat/combat.js, not this file).
// A capsule hero on WASD with a follow camera and E for the nearest option; spawned enemies fall on any
// light attack; stealth never spots anyone.
import { CREW_IDS, FOE_IDS, WEAPON_IDS, HERO_MODES, CAMERA_PRIO } from '../types.js';

export function init(S) {
  const { THREE } = S;
  const pos = new THREE.Vector3();
  const H = S.hero = {
    mode: 'foot', pos, face: 0, actor: null, body: null, crouch: false, hp: 100, maxHp: 100, st: 100, canteen: 5, canteenMax: 5, weapon: 'fists',
    setBody(crewId) {
      if (!CREW_IDS.includes(crewId)) throw new Error(`S.hero.setBody: unknown crew id '${crewId}'`);
      if (H.body === crewId && H.actor) return;
      if (H.actor) S.cast.despawn(H.actor);
      H.body = crewId; H.actor = S.cast.spawn(crewId, { pos, yaw: H.face });
      H.actor.visible = H.mode === 'foot' || H.mode === 'photo';
    },
    place(x, z, yaw) { pos.set(x, S.world.surface(x, z, pos.y + 1), z); if (yaw != null) { H.face = yaw; camYaw = yaw; camInit = false; } sync(); },
    setMode(m) { if (!HERO_MODES.includes(m)) throw new Error(`S.hero.setMode: unknown mode '${m}'`); H.mode = m; if (H.actor) H.actor.visible = m === 'foot' || m === 'photo'; },
    get down() { return H.hp <= 0; },
  };
  function sync() { if (H.actor) { H.actor.root.position.copy(pos); H.actor.root.rotation.y = H.face; } if (H.mode === 'foot') S.focus.copy(pos); }

  // on foot: camera-relative WASD, E uses the nearest option
  let camYaw = 0;
  S.register('control', (cdt) => {
    if (H.mode !== 'foot' || !S.world.visible) return;
    const cur = S.interact.current;
    if (cur && S.input.pressed('use') && cur.act) { cur.act(); return; }
    if (S.input.pressed('light')) for (const f of C.enemies) if (!f.downed) knock(f);
    if (S.lockControl) return;
    const m = S.input.axis('move'), fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const dx = fx * m.y - fz * m.x, dz = fz * m.y + fx * m.x, len = Math.hypot(dx, dz);
    if (len > 0.05) {
      const speed = (S.input.held('dodge') ? 8 : 5.5) * Math.min(1, len);
      pos.x = Math.max(-S.world.HALF, Math.min(S.world.HALF, pos.x + dx / len * speed * cdt));
      pos.z = Math.max(-S.world.HALF, Math.min(S.world.HALF, pos.z + dz / len * speed * cdt));
      H.face = Math.atan2(dx, dz);
      if (H.actor) H.actor.play('run');
    } else if (H.actor) H.actor.play('idle');
    pos.y = S.world.surface(pos.x, pos.z, pos.y + 1);
    sync();
  });

  // the foot camera: behind and above the hero, turning slowly toward where the hero faces
  const camPos = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3();
  let camInit = false;
  S.cameras.add('foot', CAMERA_PRIO.foot, () => H.mode === 'foot' && S.world.visible, (rdt) => {
    const lk = S.input.axis('look');
    camYaw -= lk.x * 2.4 * rdt;
    if (Math.abs(lk.x) < 0.05 && S.input.axis('move').y > 0.3) { let d = H.face - camYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); camYaw += d * Math.min(1, rdt * 1.5); }
    want.set(pos.x - Math.sin(camYaw) * 5.5, pos.y + 2.4, pos.z - Math.cos(camYaw) * 5.5);
    if (!camInit) { camPos.copy(want); camInit = true; } else camPos.lerp(want, 1 - Math.exp(-rdt * 8));
    look.set(pos.x, pos.y + 1.3, pos.z);
    S.camera.position.copy(camPos); S.camera.lookAt(look);
    if (S.camera.fov !== 55) { S.camera.fov = 55; S.camera.updateProjectionMatrix(); }
  });

  // fights: spawned foes stand still and fall on the first light attack
  const listeners = new Map();
  const on = (evt, fn) => { if (!listeners.has(evt)) listeners.set(evt, []); listeners.get(evt).push(fn); return () => { const a = listeners.get(evt), i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); }; };
  const emit = (evt, d) => { for (const f of (listeners.get(evt) || []).slice()) f(d); };
  let fid = 0;
  function knock(f) { f.hp = 0; f.downed = true; f.state = 'down'; if (f.a) f.a.root.rotation.z = Math.PI / 2; emit('down', f); }
  const C = S.combat = {
    player: null, enemies: [], active: false, boss: null,
    begin() { C.active = true; },
    spawn(foeId, o = {}) {
      if (!FOE_IDS.includes(foeId)) throw new Error(`S.combat.spawn: unknown foe '${foeId}'`);
      const at = o.place ? S.world.place(o.place) : o.pos || { x: pos.x + 4, z: pos.z + 4 };
      const a = S.cast.spawn('gang', { pos: at, yaw: o.yaw || 0 });
      const f = { id: `f${++fid}`, a, pos: a.root.position, face: o.yaw || 0, hp: 100, maxHp: 100, posture: 0, state: 'idle', team: 'foe', def: { id: foeId }, group: o.group || 'main', alert: !!o.alert, tied: false, downed: false, nextHit: null };
      C.enemies.push(f);
      return f;
    },
    clear(group) { for (const f of C.enemies.slice()) if (!group || f.group === group) { S.cast.despawn(f.a); C.enemies.splice(C.enemies.indexOf(f), 1); } },
    end() { C.active = false; for (const f of C.enemies) if (f.downed) { f.tied = true; emit('tied', f); } },
    setWeapon(id) { if (!WEAPON_IDS.includes(id)) throw new Error(`S.combat.setWeapon: unknown weapon '${id}'`); H.weapon = id; },
    give(id) { if (WEAPON_IDS.includes(id)) H.weapon = id; },
    lockCycle() {},
    on,
  };
  const watchers = [];
  S.stealth = { list: watchers, spotted: false, exposure: 1, watch(f, cfg) { watchers.push({ f, cfg }); }, unwatch(f) { const i = watchers.findIndex((w) => w.f === f); if (i >= 0) watchers.splice(i, 1); }, level: () => 0, on: (evt, fn) => on(`stealth:${evt}`, fn) };

  // the hero's body comes with the story; the story Gabe and every foe go with it
  S.bus.on('start', () => { if (!H.actor) H.setBody(CREW_IDS[S.ctx.crewPick] || 'shades'); H.setMode('foot'); H.hp = H.maxHp; camInit = false; });
  S.bus.on('exit', () => { C.clear(); C.active = false; watchers.length = 0; H.actor = null; H.body = null; H.mode = 'foot'; });
  S.test.combat = {
    get enemies() { return C.enemies; },
    spawn: (id, x, z) => C.spawn(id, { pos: { x, z } }),
    ko: (i) => { const f = C.enemies[i]; if (f) knock(f); },
    tokens: () => 0, lock: () => null,
  };
}
