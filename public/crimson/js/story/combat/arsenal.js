import * as THREE from 'three';
import { LOADOUT, GUNS, raySphere, reloadMagazine } from './arsenal-data.js';
import { WEAPONS } from './playermoves.js';
import { aimWeapon } from '../cast/weapon-aim.js';

export function createArsenal(K) {
  const { S } = K;
  const ammo = {}, effects = [], drops = [];
  let dropSeq = 0;
  let cooldown = 0, reload = 0, reloading = null, hitTime = 0, shots = 0, policeShots = 0;
  const random = S.rng('arsenal');
  const direction = new THREE.Vector3(), center = new THREE.Vector3();
  const panel = document.createElement('div'); panel.className = 'sArsenal';
  panel.innerHTML = '<strong></strong><span></span><div><button type="button" aria-label="Next weapon">B · WEAPON</button><button type="button" aria-label="Reload">T · RELOAD</button></div>';
  document.body.append(panel);
  const reticle = document.createElement('div'); reticle.className = 'sReticle'; reticle.textContent = '+'; document.body.append(reticle);
  for (const [index, action] of ['weaponNext', 'reload'].entries()) {
    const button = panel.querySelectorAll('button')[index];
    button.addEventListener('pointerdown', (event) => event.stopPropagation());
    button.addEventListener('click', (event) => { event.stopPropagation(); S.input.touch.hits.add(action); });
  }
  function blocked(from, to) {
    const wall = S.world.colliders.raycast(from, to);
    if (wall != null && wall < 0.99) return true;
    const distance = from.distanceTo(to);
    for (let along = 0.5; along < distance; along += 0.5) {
      const fraction = along / distance;
      if (S.world.height(from.x + (to.x - from.x) * fraction, from.z + (to.z - from.z) * fraction) > from.y + (to.y - from.y) * fraction) return true;
    }
    return false;
  }
  function tracer(from, to, spray = false, hostile = false) {
    const geometry = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: hostile ? 0xff5345 : spray ? 0xffa249 : 0xffdf8b, transparent: true, opacity: 0.95 }));
    S.scene.add(line); effects.push({ object: line, life: spray ? 0.3 : 0.09 });
    S.ctx.fx.flash(from, spray ? 0.15 : 0.45, 0.06);
    if (spray) S.ctx.fx.dust({ ...to, groundY: to.y - 1 }, 5, 0.8);
  }
  function targets() {
    return [...K.enemies.filter((foe) => !foe.gone && !foe.downed && !foe.tied && !foe.invuln && !['phase', 'vanish'].includes(foe.state)), ...S.cast.crowd.list.filter((person) => !person.dead)];
  }
  function damage(target, spec) {
    if (target.ln) {
      if (spec.spray) {
        target.flinch = 2; S.cast.crowd.scatter(target.pos.x, target.pos.z, 15);
        S.bus.emit('pedestrianCrime', { fatal: false, pos: target.pos.clone() });
      } else S.cast.crowd.hit(target, { impactDamage: spec.damage, speed: 10, face: S.hero.face, cooldown: 0.08 });
    } else {
      if (target.lawUnit) S.bus.emit('pedestrianCrime', { fatal: !spec.spray && target.hp <= spec.damage, pos: target.pos.clone() });
      target.hp = Math.max(0, target.hp - spec.damage);
      if (!target.hp && target.phase2Pending) target.hp = 1;
      if (!target.hp) K.resolve.knockOut(target, 'shot');
      else {
        target.state = 'stagger'; target.t = 0; target.stunT = spec.spray ? 2.3 : 0.35;
        target.atk = null; target.queue = []; target.alert = true;
        target.a?.play('gabe:hit', { loop: false, fade: 0.05, restart: true });
      }
    }
    hitTime = 0.22; K.sfx('hit', target.pos);
  }
  function fire(spec) {
    const hero = S.hero, chest = hero.pos.clone().add(new THREE.Vector3(0, 1.35, 0)), origin = chest.clone();
    S.camera.getWorldDirection(direction);
    K.drawWeapon(true);
    const prop = hero.actor?.props?.[hero.weapon];
    if (prop) {
      aimWeapon(hero.actor, prop, direction, hero.weapon);
      prop.getObjectByName('muzzle')?.getWorldPosition(origin);
    }
    const muzzleBlocked = blocked(chest, origin);
    const spread = spec.spread * (S.input.held('parry') ? 0.3 : 1);
    direction.x += (random() - 0.5) * spread; direction.y += (random() - 0.5) * spread; direction.z += (random() - 0.5) * spread; direction.normalize();
    hero.face = Math.atan2(direction.x, direction.z);
    const end = S.camera.position.clone().addScaledVector(direction, spec.range);
    let nearest = spec.range, victim = null;
    for (const target of muzzleBlocked ? [] : targets()) {
      center.copy(target.pos); center.y += 1;
      if (spec.spray) {
        const offset = center.clone().sub(origin), distance = offset.length();
        if (distance < spec.range && offset.normalize().dot(direction) > 0.86 && !blocked(origin, center)) damage(target, spec);
      } else {
        const distance = raySphere(S.camera.position, direction, center, 0.75);
        if (distance < nearest && !blocked(S.camera.position, center) && !blocked(origin, center)) { nearest = distance; victim = target; }
      }
    }
    if (victim) { end.copy(victim.pos); end.y += 1; damage(victim, spec); }
    else { const wall = S.world.colliders.raycast(origin, end); if (wall != null) end.lerpVectors(origin, end, Math.max(0, wall)); }
    if (spec.spray) end.copy(origin).addScaledVector(direction, spec.range);
    if (!muzzleBlocked) tracer(origin, end, spec.spray);
    K.sfx(spec.spray ? 'bearSpray' : hero.weapon, origin);
    K.cam.pitch -= spec.recoil; K.cam.shake = Math.max(K.cam.shake, spec.recoil * 3);
    K.drawWeapon(true); shots++; S.cast.crowd.scatter(hero.pos.x, hero.pos.z, 25);
    if (!spec.spray && !victim) S.bus.emit('pedestrianCrime', { fatal: false, pos: hero.pos.clone() });
  }
  function equip(id) {
    if (!LOADOUT.includes(id)) return;
    reload = 0; reloading = null; cooldown = 0.2;
    S.hero.atk = null; S.hero.state = 'move'; K.lock = null;
    S.combat.give(id); K.drawWeapon(true);
  }
  function beginReload() {
    const id = S.hero.weapon, spec = GUNS[id], current = ammo[id];
    if (!spec || reload || !current.reserve || current.loaded === spec.magazine) return;
    reload = spec.reload; reloading = id; K.sfx('reload', S.hero.pos);
  }
  function removeDrop(drop) {
    S.interact.remove(drop.id); drop.object.removeFromParent();
    drop.object.traverse(o => { if (o.isMesh && !o.geometry.userData.shared) o.geometry.dispose(); });
    const index = drops.indexOf(drop); if (index >= 0) drops.splice(index, 1);
  }
  S.combat.on('down', foe => {
    if (!foe.lawUnit || foe.gunDropped) return;
    foe.gunDropped = true;
    const held = foe.a?.props?.pistol, at = foe.pos.clone(); at.y += 1.1;
    if (held) held.getWorldPosition(at);
    S.cast.props.detach(foe.a, 'pistol');
    const object = S.cast.props.make('pistol'); object.position.copy(at); S.world.group.add(object);
    const drop = { id: `police-gun:${++dropSeq}`, object, t: 0, ground: S.world.surface(at.x, at.z, foe.pos.y + 1), vy: 1.5, landed: false };
    drops.push(drop);
    S.interact.add({ id: drop.id, tag: 'police-guns', label: 'TAKE PISTOL', mode: 'foot', r: 2.2, prio: 3,
      pos: () => object.position, when: () => drop.landed && S.world.visible,
      act: () => {
        if (!drop.landed || !drops.includes(drop)) return;
        ammo.pistol.reserve = Math.min(GUNS.pistol.reserve, ammo.pistol.reserve + GUNS.pistol.magazine);
        reloadMagazine(ammo.pistol, GUNS.pistol.magazine); equip('pistol');
        K.sfx('pickup', object.position); removeDrop(drop);
      },
    });
  });
  function reset() {
    for (const drop of drops.slice()) removeDrop(drop);
    for (const [id, spec] of Object.entries(GUNS)) ammo[id] = { loaded: spec.magazine, reserve: spec.reserve };
    for (const effect of effects) { effect.object.removeFromParent(); effect.object.geometry.dispose(); effect.object.material.dispose(); }
    effects.length = 0; cooldown = reload = hitTime = shots = policeShots = 0; reloading = null;
  }
  S.arsenal = { ammo, drops, equip, beginReload, get ranged() { return !!GUNS[S.hero.weapon]; }, get reload() { return reload; }, get shots() { return shots; }, get policeShots() { return policeShots; } };
  S.register('control', (dt) => {
    if (!S.hero || !S.world.visible || S.lockControl || S.cine?.active) return;
    cooldown = Math.max(0, cooldown - dt); hitTime = Math.max(0, hitTime - dt);
    if (reload > 0) { reload = Math.max(0, reload - dt); if (!reload && reloading) { reloadMagazine(ammo[reloading], GUNS[reloading].magazine); reloading = null; } }
    if (S.hero.mode !== 'foot' || S.hero.hp <= 0) return;
    const input = S.input;
    for (let index = 0; index < LOADOUT.length; index++) if (input.pressed(`weapon${index + 1}`)) { input.consume(`weapon${index + 1}`); equip(LOADOUT[index]); }
    if (input.pressed('weaponNext')) { input.consume('weaponNext'); equip(LOADOUT[(LOADOUT.indexOf(S.hero.weapon) + 1) % LOADOUT.length]); }
    if (input.pressed('reload')) { input.consume('reload'); beginReload(); }
    const spec = GUNS[S.hero.weapon]; if (!spec) return;
    const trigger = input.pressed('light') || spec.automatic && input.held('light'); input.consume('light', 'heavy');
    if (trigger && !cooldown && !reload && ['move', 'guard', 'deflect'].includes(S.hero.state)) {
      if (!ammo[S.hero.weapon].loaded) { cooldown = 0.25; K.sfx('reload', S.hero.pos); return; }
      ammo[S.hero.weapon].loaded--; cooldown = spec.interval; fire(spec);
    }
  }, -5);
  S.register('combat', (dt) => {
    for (const drop of drops.slice()) {
      drop.t += dt;
      if (drop.t > 120) { removeDrop(drop); continue; }
      if (!drop.landed) {
        drop.vy -= 12 * dt; drop.object.position.y += drop.vy * dt;
        drop.object.rotation.set(0.3, drop.t * 4, Math.min(Math.PI / 2, drop.t * 5));
        if (drop.object.position.y <= drop.ground + .055) {
          drop.object.position.y = drop.ground + .055; drop.object.rotation.set(0, drop.t * 4, Math.PI / 2); drop.landed = true;
        }
      }
    }
    for (const effect of effects.slice()) {
      effect.life -= dt;
      if (effect.life <= 0) { effect.object.removeFromParent(); effect.object.geometry.dispose(); effect.object.material.dispose(); effects.splice(effects.indexOf(effect), 1); }
    }
    if (S.lockControl || S.cine?.active || !S.world.visible || S.hero.hp <= 0) return;
    for (const foe of K.enemies) {
      if (!foe.lawUnit || foe.downed || foe.gone || foe.tied || foe.carjacked || !foe.alert || foe.returnToVehicle) continue;
      const from = foe.pos.clone(); from.y += 1.4;
      const to = S.hero.pos.clone(); to.y += 1.2;
      const distance = from.distanceTo(to);
      if (distance < 9 || distance > 48 || blocked(from, to) || ['stagger', 'hit', 'broken'].includes(foe.state)) { foe.gunTell = 0; continue; }
      foe.gunCooldown = Math.max(0, (foe.gunCooldown ?? 1.8) - dt);
      if (foe.gunCooldown > 0) continue;
      if (!foe.gunTell) { foe.gunTell = 0.75; S.ui.toast('OFFICER AIMING — DODGE OR FIND COVER'); }
      foe.gunTell -= dt;
      if (foe.gunTell > 0) continue;
      foe.gunTell = 0; foe.gunCooldown = 1.8 + random(); policeShots++;
      tracer(from, to, false, true); K.sfx('pistol', from);
      if (!S.hero.iframe && S.hero.state !== 'dodge' && !blocked(from, to)) K.resolve.hurtHero(9 + S.law.state.stars * 2, false, false, foe);
    }
  }, 30);
  S.register('hud', () => {
    const shown = S.mode === 'play' && S.world.visible && S.hero?.mode === 'foot' && !S.cine?.active && !S.freeze;
    panel.hidden = !shown; reticle.hidden = !shown || !GUNS[S.hero?.weapon];
    if (!shown) return;
    const id = S.hero.weapon, current = ammo[id];
    panel.querySelector('strong').textContent = WEAPONS[id]?.name || id;
    const aimHint = S.input.device === 'touch' ? 'HOLD AIM' : S.input.device === 'pad' ? 'LT AIM' : 'RMB AIM';
    panel.querySelector('span').textContent = current ? reload ? `RELOADING ${reload.toFixed(1)}s` : `${current.loaded} / ${current.reserve} · ${aimHint}` : 'J COMBO · K HEAVY · F BLOCK';
    reticle.classList.toggle('hit', hitTime > 0); reticle.classList.toggle('aim', S.input.held('parry'));
  });
  S.register('anim', (cdt, rdt) => {
    if (S.mode !== 'play' || S.freeze || S.cine?.active || S.hero?.mode !== 'foot' || !GUNS[S.hero.weapon]) return;
    if (['move', 'guard'].includes(S.hero.state)) {
      K.drawWeapon(true);
      const prop = S.hero.actor?.props?.[S.hero.weapon];
      if (prop?.parent) {
        S.camera.getWorldDirection(direction);
        aimWeapon(S.hero.actor, prop, direction, S.hero.weapon, rdt);
      }
    }
  }, 90);
  S.bus.on('start', reset); S.bus.on('exit', reset); reset();
}
