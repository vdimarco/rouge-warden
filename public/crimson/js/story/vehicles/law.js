import * as THREE from 'three';
import { createWantedState } from './wanted-state.js';

export function createLaw(S) {
  const wanted = createWantedState(), state = wanted.state;
  const units = [], retained = new Set(), lastKnown = new THREE.Vector3();
  let helicopter = null, reinforcement = 0, siren = null, rotorSound = null, custody = 0;
  const target = () => S.drive.riding || S.hero;
  const toast = (text) => { S.ui?.toast(text); S.audio?.sfx('radio'); };
  function visible(from, to, range) {
    const distance = Math.hypot(from.x - to.x, from.z - to.z);
    if (distance > range) return false;
    for (let along = 5; along < distance; along += 5) {
      const fraction = along / distance;
      const height = from.y + 1.8 + (to.y - from.y - 0.8) * fraction;
      if (S.world.height(from.x + (to.x - from.x) * fraction, from.z + (to.z - from.z) * fraction) > height) return false;
    }
    return S.world.colliders.raycast({ x: from.x, y: from.y + 1.8, z: from.z },
      { x: to.x, y: to.y + 1, z: to.z }, { terrain: true }) == null;
  }
  function disposeObject(root) {
    const geometries = new Set(), materials = new Set();
    root.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) for (const material of [].concat(object.material)) materials.add(material);
    });
    root.removeFromParent();
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
  }
  function label(vehicle, sheriff) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 96;
    const context = canvas.getContext('2d');
    context.fillStyle = sheriff ? '#c4ae79' : '#f6f0df'; context.fillRect(0, 0, 256, 96);
    context.fillStyle = sheriff ? '#263b2d' : '#14202d'; context.textAlign = 'center';
    context.font = 'bold 36px sans-serif'; context.fillText(sheriff ? '★ SHERIFF' : 'POLICE', 128, 45);
    context.font = '16px sans-serif'; context.fillText('SEDONA • COUNTY', 128, 75);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
    const group = new THREE.Group();
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.56), material);
      panel.position.set(side * 1.012, 1.05, 0.2); panel.rotation.y = side * Math.PI / 2; group.add(panel);
    }
    vehicle.view.chassis.add(group);
    return () => { texture.dispose(); disposeObject(group); };
  }
  function spawnUnit() {
    const focus = target()?.pos; if (!focus) return;
    const roads = S.world.roads;
    let pose = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = attempt * Math.PI / 6 + units.length * 1.4;
      const road = roads.nearest(focus.x + Math.sin(angle) * 110, focus.z + Math.cos(angle) * 110);
      if (!road.road) continue;
      const point = roads.sample(road.road, road.s, attempt % 2 ? 1 : -1);
      if (!point || Math.hypot(point.x - focus.x, point.z - focus.z) < 65) continue;
      if (S.vehicles.list.some((vehicle) => Math.hypot(point.x - vehicle.pos.x, point.z - vehicle.pos.z) < 9)) continue;
      let blocked = false;
      S.world.colliders.query(point.x, point.z, 2.8, () => { blocked = true; return false; });
      if (!blocked) { pose = point; break; }
    }
    if (!pose) return;
    const sheriff = state.stars >= 2 && units.length % 2 === 1;
    const vehicle = S.vehicles.spawn('suv_fbi', { pos: pose, yaw: pose.yaw, tint: sheriff ? 0xc4ae79 : 0xf1eee4, siren: true, enterable: true });
    const unit = { vehicle, sheriff, target: null, search: false, deputy: null, stolen: false, parking: false, group: `law:${vehicle.id}`, dispose: label(vehicle, sheriff) };
    vehicle.lawUnit = unit; vehicle.seats[0] = 'officer';
    vehicle.on('enter', ({ who, seat }) => {
      if (who !== 'hero' || seat !== 0 || unit.stolen) return;
      unit.stolen = true; retained.add(unit);
      vehicle.controller?.stop();
      S.bus.emit('pedestrianCrime', { fatal: true, pos: vehicle.pos.clone() });
      toast('PATROL VEHICLE STOLEN — COUNTY ALERT');
    });
    units.push(unit);
    S.drivers.pursue(vehicle, target(), { ram: true, max: 36, speed: 31 + state.stars });
    unit.target = target();
  }
  function makeHelicopter() {
    const root = new THREE.Group(); root.name = 'county-helicopter';
    const paint = new THREE.MeshStandardMaterial({ color: 0x172b34, roughness: 0.48 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x79b9cc, metalness: 0.45, roughness: 0.16 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xddddcf, roughness: 0.6 });
    const mesh = (geometry, material, position, scale) => {
      const object = new THREE.Mesh(geometry, material); object.position.set(...position);
      if (scale) object.scale.set(...scale); root.add(object); return object;
    };
    mesh(new THREE.SphereGeometry(1, 14, 10), paint, [0, 0, 0], [1.35, 1.25, 2.5]);
    mesh(new THREE.SphereGeometry(1, 12, 8), glass, [0, 0.15, 1.25], [1.25, 1, 1.45]);
    mesh(new THREE.BoxGeometry(0.38, 0.45, 5), paint, [0, 0.35, -3.6]);
    mesh(new THREE.BoxGeometry(0.15, 1.8, 1), metal, [0, 1, -5.8]);
    for (const side of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.13, 0.13, 4.5), metal, [side * 1.3, -1.6, 0]);
      mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), metal, [side * 1.1, -1, 0.8]);
      mesh(new THREE.BoxGeometry(0.1, 1.2, 0.1), metal, [side * 1.1, -1, -0.8]);
    }
    const rotor = new THREE.Group(); rotor.position.y = 1.6; root.add(rotor);
    for (const angle of [0, Math.PI / 2]) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.07, 0.25), metal); blade.rotation.y = angle; rotor.add(blade);
    }
    const tail = mesh(new THREE.BoxGeometry(0.08, 2, 0.15), metal, [0.25, 0.65, -5.8]);
    const light = new THREE.SpotLight(0xffedb3, 100, 85, 0.35, 0.65, 1);
    light.position.set(0, -1, 1); root.add(light);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 34, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffedb3, transparent: true, opacity: 0.055, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = -18; root.add(beam);
    S.scene.add(root, light.target);
    root.position.copy(lastKnown); root.position.x += 95; root.position.y += 38;
    helicopter = { root, rotor, tail, light, pos: root.position, orbit: 0 };
    toast('AIR SUPPORT INBOUND — BREAK LINE OF SIGHT');
  }
  function clearUnits() {
    for (const unit of units) {
      S.combat?.clear(unit.group); unit.deputy = null;
      if (unit.stolen) { unit.vehicle.siren = false; continue; }
      unit.dispose(); S.vehicles.despawn(unit.vehicle);
    }
    units.length = 0;
    if (helicopter) { helicopter.light.target.removeFromParent(); disposeObject(helicopter.root); helicopter = null; }
    siren?.stop(0.2); rotorSound?.stop(0.2); siren = rotorSound = null;
  }
  function reset() {
    clearUnits(); wanted.reset(); reinforcement = 0; custody = 0;
    for (const unit of retained) { unit.dispose(); S.vehicles.despawn(unit.vehicle); }
    retained.clear();
  }
  S.law = { get state() { return state; }, get units() { return units; }, get helicopter() { return helicopter; }, reset };
  S.bus.on('pedestrianCrime', ({ fatal, pos }) => {
    const before = state.stars;
    wanted.report(fatal); lastKnown.copy(pos);
    if (before !== state.stars) toast(state.stars >= 2 ? 'COUNTY ALERT — SHERIFF REINFORCEMENTS' : '911 REPORT — UNITS DISPATCHED');
  });
  S.register('ai', (combatDt, realDt) => {
    if (!S.world.visible || !S.hero || S.lockControl || S.cine?.active) return;
    const dt = Math.min(realDt, 0.1), suspect = target();
    if (custody > 0) {
      custody -= dt;
      if (S.drive.riding) { S.drive.riding.vel.set(0, 0, 0); Object.assign(S.drive.riding.controls, { throttle: 0, brake: 1 }); }
      else { S.hero.state = 'hit'; S.hero.t = 0; }
      return;
    }
    if (!state.stars) return;
    const movement = S.input.axis('move');
    const resisting = Math.hypot(movement.x, movement.y) > 0.1 || ['attack', 'dodge'].includes(S.hero.state);
    let seen = false, held = false;
    for (const unit of units) {
      const vehicle = unit.vehicle;
      if (vehicle.gone && !unit.deputy) continue;
      const officer = unit.deputy;
      const disabled = officer && (officer.downed || officer.tied || officer.gone);
      const sight = !disabled && visible(officer ? officer.pos : vehicle.pos, suspect.pos, 100);
      seen ||= sight;
      const distance = vehicle.pos.distanceTo(suspect.pos);
      held ||= !officer && !unit.stolen && sight && !!S.drive.riding && distance < 12 && Math.abs(suspect.speed) < 2 && Math.abs(vehicle.speed) < 5;
      if (!officer && !unit.stolen && !vehicle.wrecked && !S.drive.riding && sight && distance < 22) {
        if (!unit.parking) { S.drivers.stop(vehicle); unit.parking = true; }
        if (Math.abs(vehicle.speed) < 0.8) {
          const door = S.drive.landingSpot(vehicle, 'driver');
          if (door) {
            unit.deputy = S.combat.spawn('driver', { pos: door, cast: unit.sheriff ? 'sheriff' : 'police', group: unit.group });
            unit.deputy.lawUnit = unit; unit.deputy.speed = 4.8;
            vehicle.seats[0] = null;
          }
        }
      }
      if (officer && !disabled) {
        const gap = officer.pos.distanceTo(suspect.pos);
        held ||= sight && gap < 4.5 && (S.drive.riding ? Math.abs(suspect.speed) < 2 : !resisting);
        if (!unit.stolen && !vehicle.wrecked && S.drive.riding && gap > 25) {
          const door = S.drive.landingSpot(vehicle, 'driver');
          officer.returnToVehicle = door; officer.alert = false; officer.token = false; officer.atk = null; officer.state = 'idle';
          if (door && officer.pos.distanceTo(door) < 1.2) {
            S.combat.clear(unit.group); unit.deputy = null; vehicle.seats[0] = 'officer';
            unit.parking = false; unit.target = null;
          }
        } else { officer.returnToVehicle = null; officer.alert = true; }
      }
      if (unit.parking && !unit.deputy && (S.drive.riding || distance > 30)) { unit.parking = false; unit.target = null; }
    }
    if (helicopter) {
      seen ||= visible(helicopter.pos, suspect.pos, 95);
      helicopter.orbit += dt * 0.55;
      const aim = lastKnown.clone();
      aim.x += Math.sin(helicopter.orbit) * 20; aim.z += Math.cos(helicopter.orbit) * 20;
      aim.y = Math.max(lastKnown.y + 32, S.world.surface(aim.x, aim.z) + 30);
      const delta = aim.sub(helicopter.pos); delta.clampLength(0, dt * 30); helicopter.pos.add(delta);
      helicopter.root.rotation.y = Math.atan2(lastKnown.x - helicopter.pos.x, lastKnown.z - helicopter.pos.z);
      helicopter.rotor.rotation.y += dt * 44; helicopter.tail.rotation.x += dt * 65;
      helicopter.light.target.position.copy(lastKnown);
    }
    if (seen) lastKnown.copy(suspect.pos);
    const result = wanted.tick(dt, { seen, held });
    if (result) {
      clearUnits();
      if (result === 'busted') { custody = 3; toast('BUSTED — RELEASED WITH A WARNING'); }
      else toast('PURSUIT EVADED');
      return;
    }
    if (state.dispatch > 0) return;
    reinforcement -= dt;
    for (let index = units.length - 1; index >= 0; index--) {
      const unit = units[index];
      if (unit.vehicle.wrecked || unit.vehicle.gone || unit.vehicle.pos.distanceTo(suspect.pos) > 420) {
        if (unit.deputy && !unit.deputy.gone && unit.deputy.pos.distanceTo(suspect.pos) < 100) continue;
        S.combat.clear(unit.group); unit.deputy = null;
        if (!unit.stolen) { unit.dispose(); S.vehicles.despawn(unit.vehicle); }
        units.splice(index, 1);
      }
    }
    if (state.status === 'pursuit' && reinforcement <= 0 && units.length < Math.min(4, state.stars + 1)) { spawnUnit(); reinforcement = 4; }
    if (state.status === 'pursuit' && state.stars >= 3 && !helicopter) makeHelicopter();
    for (const unit of units) {
      if (unit.deputy || unit.parking || unit.stolen) continue;
      const searching = state.status === 'search';
      if (unit.target !== suspect || unit.search !== searching) {
        unit.search = searching; unit.target = suspect;
        if (searching) S.drivers.route(unit.vehicle, { x: lastKnown.x, z: lastKnown.z }, { speed: 20 });
        else S.drivers.pursue(unit.vehicle, suspect, { ram: !!S.drive.riding, max: 36, speed: 31 + state.stars });
      }
    }
    if (!siren && S.audio) siren = S.audio.loop('siren');
    const nearest = units.reduce((distance, unit) => Math.min(distance, unit.vehicle.pos.distanceTo(suspect.pos)), Infinity);
    siren?.set({ level: Math.max(0, 1 - nearest / 180) });
    if (helicopter && !rotorSound && S.audio) rotorSound = S.audio.loop('helicopter');
    rotorSound?.set({ level: helicopter ? Math.max(0, 1 - helicopter.pos.distanceTo(suspect.pos) / 150) : 0 });
  }, 40);
  S.bus.on('start', reset); S.bus.on('exit', reset);
  S.register('hud', () => {
    if (S.mode !== 'play' || S.freeze || !S.world.visible || S.cine?.active) {
      siren?.set({ level: 0 }); rotorSound?.set({ level: 0 });
    }
  });
}
