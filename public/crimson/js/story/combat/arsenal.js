import * as THREE from 'three';
import { LOADOUT, GUNS, raySphere, reloadMagazine } from './arsenal-data.js';
import { WEAPONS } from './playermoves.js';

export function createArsenal(K) {
  const { S } = K;
  const ammo = {}, effects = [];
  let cooldown = 0, reload = 0, reloading = null, hitTime = 0, shots = 0, policeShots = 0;
  const random = S.rng('arsenal');
  const direction = new THREE.Vector3(), center = new THREE.Vector3();
  const localRotation = new THREE.Quaternion(), aimRotation = new THREE.Quaternion(), forward = new THREE.Vector3(0, 0, 1);
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
    const hero = S.hero, origin = hero.pos.clone().add(new THREE.Vector3(0, 1.35, 0));
    S.camera.getWorldDirection(direction);
    const spread = spec.spread * (S.input.held('parry') ? 0.3 : 1);
    direction.x += (random() - 0.5) * spread; direction.y += (random() - 0.5) * spread; direction.z += (random() - 0.5) * spread; direction.normalize();
    hero.face = Math.atan2(direction.x, direction.z);
    const end = S.camera.position.clone().addScaledVector(direction, spec.range);
    let nearest = spec.range, victim = null;
    for (const target of targets()) {
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
    tracer(origin, end, spec.spray); K.sfx(spec.spray ? 'bearSpray' : hero.weapon, origin);
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
  function reset() {
    for (const [id, spec] of Object.entries(GUNS)) ammo[id] = { loaded: spec.magazine, reserve: spec.reserve };
    for (const effect of effects) { effect.object.removeFromParent(); effect.object.geometry.dispose(); effect.object.material.dispose(); }
    effects.length = 0; cooldown = reload = hitTime = shots = policeShots = 0; reloading = null;
  }
  S.arsenal = { ammo, equip, beginReload, get ranged() { return !!GUNS[S.hero.weapon]; }, get reload() { return reload; }, get shots() { return shots; }, get policeShots() { return policeShots; } };
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
    for (const effect of effects.slice()) {
      effect.life -= dt;
      if (effect.life <= 0) { effect.object.removeFromParent(); effect.object.geometry.dispose(); effect.object.material.dispose(); effects.splice(effects.indexOf(effect), 1); }
    }
    if (S.lockControl || S.cine?.active || !S.world.visible || S.hero.hp <= 0) return;
    for (const foe of K.enemies) {
      if (!foe.lawUnit || foe.downed || foe.gone || foe.tied || !foe.alert || foe.returnToVehicle) continue;
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
  S.register('anim', () => {
    if (S.mode !== 'play' || S.freeze || S.cine?.active || S.hero?.mode !== 'foot' || !GUNS[S.hero.weapon]) return;
    if (['move', 'guard'].includes(S.hero.state)) {
      K.drawWeapon(true);
      const prop = S.hero.actor?.props?.[S.hero.weapon];
      if (prop?.parent) {
        S.camera.getWorldDirection(direction);
        prop.parent.getWorldQuaternion(localRotation).invert(); aimRotation.setFromUnitVectors(forward, direction);
        prop.quaternion.copy(localRotation).multiply(aimRotation);
      }
    }
  }, 90);
  S.bus.on('start', reset); S.bus.on('exit', reset); reset();
}
