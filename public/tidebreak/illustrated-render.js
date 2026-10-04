import { structureProtected } from './objectives.js';
import { CreatureBank } from '../arcade/creatures/player.js';
import { player, HEROES } from './sim.js';
import { SIZE, BASES, LANES, PATHS, PORTALS, BRUSH, CENTER, visibleTo, concealed, distance, clamp } from './world.js';
import { LANDMARKS, PLANTS, LANDFORMS, makeScenery } from './scenery.js';
import { paintGround } from './paint-ground.js';
import { attackPose, drawCombatEffect, drawSkillZone, drawCastWarning, drawSkillMissile } from './combat-motion.js';
import { riverSample, riverCrossings, riverGeometry, riverOutline } from './river.js';
import { BASE_STYLES, drawBaseCore } from './bases.js';
import { MARKETPLACE_SPRITES, drawMarketplaceSprite } from './marketplace-sprites.js';
import { combatMarks, controlLabels, recentCombatFeedback, RESULT_COLORS, RESULT_LABELS } from './combat-feedback.js';
import { HERO_IDENTITIES, identityFor, identitySkill } from './hero-identities.js';
const TAU = Math.PI * 2, TEAM = ['#73e0be', '#c167d8'], PIXEL_BUDGET = 2560 * 1440;
const surface = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const load = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error(`Art unavailable: ${src}`)); image.src = src; });
export async function loadArt() {
  const names = ['house-a', 'house-b', 'pines', 'stones', 'tower-enemy', 'tower-ally', 'wisp-ally', 'wisp-enemy', 'bridge', ...LANDMARKS, ...PLANTS, ...LANDFORMS, ...HEROES.flatMap((h,i) => i>=4?[h.slug+'-front']:[h.slug + '-back', h.slug + '-front', ...['back', 'front'].flatMap(view => [0, 1, 2].map(frame => `${h.slug}-attack-${view}-${frame}`))])];
  const images = await Promise.all(names.map(n => load(`./art/illustrated/${n}.webp`)));
  const imported=await Promise.all([...new Set(MARKETPLACE_SPRITES.map(s=>s.file))].map(async file=>['marketplace-'+file,await load('./art/magicpixel/'+file).catch(()=>null)]));
  const identities=await Promise.all(HERO_IDENTITIES.map(async h=>['reference-'+h.slug,await load(`./art/reference/${h.slug}.webp`).catch(()=>null)]));
  return { ...Object.fromEntries(names.map((n, i) => [n, images[i]])),...Object.fromEntries(imported),...Object.fromEntries(identities), ground: await load('./art/toon-ground.webp'), surfaces: await load('./art/illustrated/terrain-surfaces.webp') };
}
// An orthographic 2.5D stage: separate illustrated objects, depth sorting, camera
// tracking and world-space effects. The concept screenshot is never a backdrop.
export class Renderer {
  constructor(canvas, mini, art) {
    this.creatures = new CreatureBank();
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: false }); this.mini = mini; this.art = art;
    this.cam = { x: CENTER.x, y: CENTER.y + 600 }; this.visible = new Set(); this.frames = 0; this.menuTime = 0; this.hitBoxes = [];
    this.tiles = Array.from({ length: 4 }, (_, i) => { const tileSize = i === 3 ? 220 : 300, c = surface(tileSize), size = art.ground.width / 2; c.getContext('2d').drawImage(art.ground, i % 2 * size + 12, Math.floor(i / 2) * size + 12, size - 24, size - 24, 0, 0, tileSize, tileSize); return c; });
    this.sceneSeed = null; this.scenes = []; this.grounds = []; this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches; this.shakeX = this.shakeY = 0; this.lastPoses = []; this.resize();
  }
  setScene(seed) {
    if (seed === this.sceneSeed) return;
    this.sceneSeed = seed; this.scenes = [0, 1].map(phase => makeScenery(seed, phase)); this.bridges = riverCrossings(PATHS, seed);
    this.grounds = this.scenes.map(scene => paintGround(this.tiles, scene, this.art.surfaces));
  }
  // The canvas has a pixel budget: a wide or sharp screen draws fewer backing pixels and the browser scales them up.
  // quality drops when frames are slow (see adapt), so an ultra-wide full screen keeps a smooth frame rate.
  resize() {
    this.width = innerWidth; this.height = innerHeight; this.quality ??= 1;
    const budget = PIXEL_BUDGET * this.quality; this.dpr = Math.max(.5, Math.min(devicePixelRatio || 1, 2, Math.sqrt(budget / (this.width * this.height))));
    this.canvas.width = this.width * this.dpr; this.canvas.height = this.height * this.dpr;
    this.scale = Math.min(this.width / 1200, this.height / 1680);
    this.anchor = this.height < 520 ? .70 : .78;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); this.ctx.imageSmoothingEnabled = true;
  }
  project(x, y, height = 0) { return { x: (x - this.cam.x) * this.scale + this.width / 2 + this.shakeX, y: (y - this.cam.y) * this.scale * .88 + this.height * this.anchor - height * this.scale + this.shakeY }; }
  world(x, y) { return { x: (x - this.width / 2 - this.shakeX) / this.scale + this.cam.x, y: (y - this.height * this.anchor - this.shakeY) / (this.scale * .88) + this.cam.y }; }
  screenDirection(x, y) { const m = Math.hypot(x, y); y /= .88; const f = m / (Math.hypot(x, y) || 1); return { x: x * f, y: y * f }; }
  pick(s, x, y) { return [...this.hitBoxes].reverse().find(b => b.team !== 0 && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h)?.id; }
  drawAsset(name, x, y, height, options = {}) {
    const im = this.art[name], c = this.ctx, pos = this.project(x, y, options.jump || 0), h = height * this.scale, w = h * im.width / im.height;
    if (pos.x + w / 2 < -10 || pos.x - w / 2 > this.width + 10 || pos.y < -10 || pos.y - h > this.height + 10) return null;
    c.save(); c.globalAlpha = options.alpha ?? 1; c.translate(pos.x, pos.y + (options.bob || 0)); if (options.flip) c.scale(-1, 1); if (options.tilt) c.rotate(options.tilt); c.scale(options.stretchX || 1, options.stretchY || 1);
    if (options.wave) {
      const slice = im.height / 20;
      for (let i = 0; i < 20; i++) { const dy = i / 20, offset = Math.sin(options.time * 5 + dy * 5) * options.wave * dy * dy; c.drawImage(im, 0, i * slice, im.width, Math.min(slice + 1, im.height - i * slice), -w / 2 + offset, -h + dy * h, w, h / 20 + .5); }
    } else c.drawImage(im, -w / 2, -h, w, h);
    c.restore(); return { x: pos.x - w / 2, y: pos.y - h, w, h };
  }
  // Screen-space pan in pixels; world motion follows the projection's squash.
  panBy(px, py) { const f = this.freeCam ||= { x: this.cam.x, y: this.cam.y }; f.x += px / this.scale; f.y += py / (this.scale * .88); }
  lookAt(x, y) { this.freeCam = { x, y }; }
  // Mouse look: -1 at the left edge, 1 at the right edge. The view keeps following the hero, pushed toward the pointer.
  setLook(n) { this.look = clamp(n, -1, 1); }
  // Called with each frame's interval while a match runs. Frames well behind the screen's refresh step the pixel budget
  // down; frames back at the refresh rate step it up again after a hold, which grows with each drop so it cannot flicker.
  adapt(ms) {
    if (!(ms > 0 && ms < 500)) return; // a longer gap is a hidden tab or a stall, not the frame rate
    this.frameMs = (this.frameMs ?? ms) * .93 + ms * .07; this.clock = (this.clock ?? 0) + ms;
    this.refreshMs = Math.max(4, Math.min(this.refreshMs ?? 16.7, this.frameMs));
    if (this.clock < (this.nextAdapt ?? 1500)) return; this.nextAdapt = this.clock + 1500;
    const q = this.quality ?? 1;
    if (this.frameMs > Math.max(20, this.refreshMs * 1.5) && q > .35) {
      this.hold = Math.min(60000, (this.hold ?? 5000) * 2); this.raiseAt = this.clock + this.hold; this.quality = Math.max(.35, q * .8); this.resize();
    } else if (this.frameMs < this.refreshMs * 1.15 && q < 1 && this.clock > (this.raiseAt ?? 0)) { this.quality = Math.min(1, q * 1.15); this.resize(); }
  }
  recenter() { this.freeCam = null; }
  ring(x, y, radius, color, alpha = 1, line = 2) {
    const c = this.ctx, p = this.project(x, y); c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = line; c.beginPath(); c.ellipse(p.x, p.y, radius * this.scale, radius * this.scale * .55, 0, 0, TAU); c.stroke(); c.restore();
  }
  draw(s, dt, menu = false, aim = null, waypoint = null) {
    const c = this.ctx, p = player(s); this.setScene(s.seed); this.lastPoses = []; this.menuTime += dt; const time = menu ? this.menuTime : s.time;
    const focus = p.order?.type === 'attack' ? s.units.find(e => e.id === p.order.target) : p.order?.type === 'move' ? p.order : null;
    const dx = focus ? focus.x - p.x : 0, dy = focus ? focus.y - p.y : 0, length = Math.hypot(dx,dy) || 1, lead = Math.min(220, length * .16), damping = 1 - Math.exp(-dt * 8);
    // A free camera (edge scroll or minimap) holds its own target until the player recenters.
    if (this.freeCam && !menu) { const k = 1 - Math.exp(-dt * 14); this.cam.x += (this.freeCam.x - this.cam.x) * k; this.cam.y += (this.freeCam.y - this.cam.y) * k; }
    else {
      // Past a small dead zone, the pointer pushes the view up to a third of the screen width toward its side.
      const look = this.look || 0, reach = Math.max(0, Math.abs(look) - .12) / .88, goal = menu ? 0 : Math.sign(look) * reach * reach * this.width * .34 / this.scale;
      this.push = (this.push || 0) + (goal - (this.push || 0)) * (1 - Math.exp(-dt * 5));
      this.cam.x += (p.x + dx / length * lead + this.push - this.cam.x) * damping; this.cam.y += (p.y + dy / length * lead - this.cam.y) * damping;
    }
    // Keep the complete camera footprint inside the landscape at each viewport.
    const halfW = Math.min(SIZE / 2, this.width / this.scale / 2), top = this.height * this.anchor / (this.scale * .88), bottom = this.height * (1 - this.anchor) / (this.scale * .88);
    this.cam.x = clamp(this.cam.x, halfW, SIZE - halfW); this.cam.y = clamp(this.cam.y, top, SIZE - bottom);
    if (this.freeCam) { this.freeCam.x = clamp(this.freeCam.x, halfW, SIZE - halfW); this.freeCam.y = clamp(this.freeCam.y, top, SIZE - bottom); }
    const impact = this.reducedMotion ? 0 : Math.min(1, s.effects.filter(f => (f.type === 'strike' || f.type === 'spell') && (f.source === p.id || distance(p, f) < 250)).reduce((n, f) => Math.max(n, Math.max(0, f.life / f.maxLife - .55)), 0));
    this.shakeX = Math.sin(time * 103) * impact * 3; this.shakeY = Math.cos(time * 127) * impact * 2;
    c.fillStyle = '#142932'; c.fillRect(0, 0, this.width, this.height);
    const origin = this.project(0, 0); c.drawImage(this.grounds[s.phase], origin.x, origin.y, SIZE * this.scale, SIZE * this.scale * .88);
    this.visible = new Set(s.units.filter(e => visibleTo(s, 0, e)).map(e => e.id)); this.hitBoxes = [];
    this.rememberHeroes(s);
    for (const b of this.bridges) this.drawAsset('bridge', b.x + b.dx * b.span * .43, b.y + b.dy * b.span * .43, b.span, { tilt: -Math.atan2(b.dx, b.dy * .88) });
    for (const gate of PORTALS) { this.ring(gate.x, gate.y, 95, '#79e1d2', .65 + Math.sin(time * 3) * .15, 3); this.ring(gate.x, gate.y, 70, '#88e8bf', .45); }
    if (s.phase) for (const b of BRUSH) { this.ring(b.x, b.y, b.radius, '#a7c794', .4); }
    for (const z of s.zones) drawSkillZone(this,z,time);
    for (const t of s.traps) if (t.team === 0 || distance(p, t) < 110) this.ring(t.x, t.y, 70, TEAM[t.team], .65);
    const drawList = [];
    for (const prop of this.scenes[s.phase].props) {
      const q = this.project(prop.x, prop.y), extent = prop.height * this.scale;
      if (q.x < -extent || q.x > this.width + extent || q.y < -20 || q.y - extent > this.height + 20) continue;
      drawList.push({ depth: prop.y, draw: () => {
        const hero = this.project(p.x, p.y, 190), w = extent * this.art[prop.name].width / this.art[prop.name].height;
        const overlap = prop.y > p.y && Math.abs(q.x - hero.x) < w * .65 && hero.y > q.y - extent && hero.y < q.y;
        this.drawAsset(prop.name, prop.x, prop.y, prop.height, { alpha: overlap && prop.height > 180 ? .28 : 1, flip: prop.flip, tilt: prop.sway && !this.reducedMotion ? Math.sin(time * 1.4 + prop.x * .01) * .012 : 0 });
      } });
    }
    this.creatures.retain(s.units.filter(e => e.hp > 0 && (menu || this.visible.has(e.id))).map(e => e.creatureId).filter(Boolean));
    for (const e of s.units) if (e.hp > 0 && (menu || this.visible.has(e.id))) drawList.push({ depth: e.y, draw: () => this.drawUnit(s, e, time) });
    drawList.sort((a, b) => a.depth - b.depth); for (const entry of drawList) entry.draw();
    for(const e of s.units)if(e.hp>0&&this.visible.has(e.id)){
      const intent=e.castIntent||e.specialIntent;
      if(intent){
        if(e.specialIntent)this.drawWarning(intent,s.time,'#ffc17a');else drawCastWarning(this,intent,s.time,e.team===p.team);
        const identity=identityFor(e),a=this.project(e.x,e.y,(HEROES[e.hero]?.height||325)*.77+32),label=identity&&Number.isInteger(intent.slot)?identitySkill(identity.id,intent.slot).name:intent.label||HEROES[e.hero]?.skills[intent.slot];
        if(label){c.save();c.font='700 11px Barlow';c.textAlign='center';c.strokeStyle='#101c27';c.lineWidth=3;c.strokeText(label,a.x,a.y);c.fillStyle=e.specialIntent?'#ffd09a':e.team===p.team?'#bdebd9':'#ffad90';c.fillText(label,a.x,a.y);c.restore();}
      }
      const exposed=e.exposedUntil>s.time,recovery=e.recoveryUntil>s.time;
      if(exposed||recovery){
        const color=exposed?'#ffd09a':'#c6cbd1',a=this.project(e.x,e.y);c.save();c.setLineDash([4,4]);this.ring(e.x,e.y,e.radius+22,color,.75,2);c.setLineDash([]);c.font='700 10px Barlow';c.textAlign='center';c.strokeStyle='#101c27';c.lineWidth=3;
        const label=`${exposed?'EXPOSED':'RECOVERY'} ${Math.max(0,(exposed?e.exposedUntil:e.recoveryUntil)-s.time).toFixed(1)}s`;c.strokeText(label,a.x,a.y+15);c.fillStyle=color;c.fillText(label,a.x,a.y+15);c.restore();
      }
    }
    for (const f of s.effects) drawCombatEffect(this, f);
    for(const m of s.missiles)if(m.team===0||visibleTo(s,0,m))drawSkillMissile(this,m,time);
    this.drawAtmosphere(s, time);
    if (!menu && p.hp > 0) {
      if (p.recall) this.ring(p.x, p.y, 85 + Math.sin(time * 8) * 10, '#d6ffec', .8);
      if (aim&&!aim.cancelled) {
        if(aim.shape)this.drawWarning({shape:aim.shape,start:s.time,at:s.time+1},s.time,'#a3ead3',true);
        else {const d=Math.hypot(aim.x,aim.y)||1,a=this.project(p.x,p.y),b=this.project(p.x+aim.x/d*(aim.distance??420),p.y+aim.y/d*(aim.distance??420));c.strokeStyle='#e2f3a1';c.lineWidth=2;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke();c.beginPath();c.arc(b.x,b.y,7,0,TAU);c.stroke();}
      }
      if (waypoint) { const a = this.project(p.x, p.y), b = this.project(waypoint.x, waypoint.y), angle = Math.atan2(b.y - a.y, b.x - a.x); this.ring(p.x + Math.cos(angle) * 160, p.y + Math.sin(angle) * 160, 20, '#e4efa9'); }
    }
    for (const f of s.floaters) { const a = this.project(f.x, f.y, 180 + (.8 - f.life) * 50); c.globalAlpha = Math.min(1, f.life * 2); c.font = '700 17px Barlow'; c.textAlign = 'center'; c.strokeStyle = '#101c27'; c.lineWidth = 3; c.strokeText(f.text, a.x, a.y); c.fillStyle = f.color; c.fillText(f.text, a.x, a.y); } c.globalAlpha = 1;
    this.drawResults(s,p);
    if (s.phase) { c.fillStyle = '#192c4429'; c.fillRect(0, 0, this.width, this.height); }
    if (this.frames++ % 6 === 0) this.drawMap(s, this.mini, waypoint);
  }
  drawUnit(s, e, time) {
    const c = this.ctx, hero = e.kind === 'hero', tower = e.kind === 'tower' || e.kind === 'core';
    let name = tower ? e.team ? 'tower-enemy' : 'tower-ally' : e.team === 1 ? 'wisp-enemy' : 'wisp-ally';
    let height = tower ? e.kind === 'core' ? BASE_STYLES[e.team].height : e.tier === 1 ? 315 : 245 : ['boss', 'leviathan'].includes(e.kind) ? 325 : e.kind === 'camp' ? 160 : 120;
    if (e.creatureId) {
      const screen = this.project(e.x, e.y), extent = height * this.scale * 3;
      if (screen.x + extent < 0 || screen.x - extent > this.width || screen.y + extent < 0 || screen.y - extent > this.height) return;
    }
    if (hero) { name = HEROES[e.hero].slug + (e.hero>=4||Math.sin(e.facing)>.2?'-front':'-back'); height = HEROES[e.hero].height*(e.player?1:.77); }
    const pose = hero ? attackPose(e, s.time) : null;
    const direction = (pose?.angle ?? e.facing) + (pose && !pose.casting ? [0, -.45, .25][pose.variant] : 0);
    if (pose && e.hero<4) name = `${HEROES[e.hero].slug}-attack-${Math.sin(direction) > .2 ? 'front' : 'back'}-${pose.stage}`;
    const baseAsset=name,identity=hero?identityFor(e):null,identityAsset=identity&&`reference-${identity.slug}`;
    if (identityAsset&&this.art[identityAsset]) name=identityAsset;
    if (pose) this.lastPoses.push({ id: e.id, hero: e.hero, identity: identity?.id, stage: pose.stage, asset: baseAsset, renderAsset: name });
    let x = e.x, y = e.y, jump = 0;
    if (e.motion) { const t = Math.min(1, (s.time - e.motion.start) / e.motion.duration), ease = t * t * (3 - 2 * t); x = e.motion.x + (e.x - e.motion.x) * ease; y = e.motion.y + (e.y - e.motion.y) * ease; jump = Math.sin(t * Math.PI) * e.motion.arc; }
    const swing = (pose?.power || 0) * (pose && !pose.casting ? [1, .75, 1.35][pose.variant] : 1), recoil = e.hit > 0 ? Math.sin(e.hit / .16 * Math.PI) * 13 : 0;
    x += Math.cos(direction) * swing * (hero && e.hero === 1 ? 42 : 28) + Math.cos(e.hitAngle || 0) * recoil;
    y += Math.sin(direction) * swing * 24 + Math.sin(e.hitAngle || 0) * recoil;
    if (hero && e.hero === 3 && pose) jump += Math.max(0, swing) * 27;
    // Contact shadows establish height during leaps and keep feet on the path.
    const shadow = this.project(x, y); c.save(); c.globalAlpha = .27; c.fillStyle = '#0d2425'; c.beginPath(); c.ellipse(shadow.x, shadow.y, height * this.scale * (hero ? .18 : .24) * (1 - Math.min(.4, jump / 400)), height * this.scale * .055, 0, 0, TAU); c.fill(); c.restore();
    if (e.kind === 'tower' && e.tier === 1) { this.ring(x,y,78,structureProtected(s,e)?'#b9b4ce':'#e8c48f',.65,2); }
    if(e.kind==='tower'&&e.team!==player(s).team&&!structureProtected(s,e)&&distance(e,player(s))<e.range+250)this.ring(x,y,e.range,e.towerTarget===player(s).id?'#ff8f75':'#dcb075',.65,2);
    if (e.shield > 0) this.ring(x, y, 68, '#c3e9ec', .75);
    if (e.kind === 'camp') this.ring(x, y, e.radius + 18, e.leash ? '#a7c794' : e.aggroUntil > s.time ? '#efaa79' : '#e8cc7c', .55);
    if (e.creatureId && e.team >= 0) this.ring(x, y, e.radius + 12, TEAM[e.team], .7);
    if(e.omen?.until>s.time){const p=this.project(x,y,height+jump+32);c.save();c.strokeStyle='#d0b4ff';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y,12,6,0,0,TAU);c.stroke();c.fillStyle='#f3dcff';c.beginPath();c.arc(p.x,p.y,3,0,TAU);c.fill();c.restore();}
    if(e.bleed?.until>s.time){const p=this.project(x,y,height+jump+32);c.save();c.fillStyle=e.bleed.type==='poison'?'#a9df83':e.bleed.type==='fire'?'#ffc16d':'#ff7965';c.beginPath();c.moveTo(p.x,p.y-8);c.quadraticCurveTo(p.x+11,p.y+7,p.x,p.y+8);c.quadraticCurveTo(p.x-11,p.y+7,p.x,p.y-8);c.fill();c.restore();}
    if (player(s).target === e.id) {this.ring(x,y,e.radius+28,'#e8c48f',.9,3);this.ring(x,y,e.radius+40+Math.sin(time*5)*5,'#ffe6a8',.6,2);}
    const moving = e.moving && !pose, gait = Math.sin(time * (hero && e.hero === 2 ? 8 : 11) + e.id);
    const creatureState = e.hit > 0 ? 'hit' : e.attackAnim > 0 ? 'action' : e.moving ? 'walk' : 'idle';
    const creatureTime = creatureState === 'action' ? s.time - (e.attackStarted ?? s.time) : creatureState === 'hit' ? .16 - e.hit : time + e.id * .17;
    const anchor = this.project(x, y, jump);
    const creatureBox = drawMarketplaceSprite(this,e,anchor,time)||(e.creatureId ? this.creatures.draw(c, e.creatureId, { x: anchor.x, y: anchor.y, height: height * this.scale, facing: e.facing, state: creatureState, elapsed: creatureTime, duration: creatureState === 'action' ? e.attackDuration : creatureState === 'hit' ? .16 : undefined }) : null);
    const box = creatureBox || (e.kind === 'core' ? drawBaseCore(this, e, time) : this.drawAsset(name, x, y, height, { jump, time, alpha: concealed(s, e) ? .45 : 1, flip: hero && Math.cos(direction) < -.35, bob: tower ? 0 : moving ? -Math.abs(gait) * 4 : Math.sin(time * 3 + e.id) * 1.1, tilt: tower ? 0 : (moving ? gait * .035 : 0) + swing * (e.hero === 2 ? -.07 : .035), stretchX: pose ? 1 + Math.max(0, swing) * .035 : 1, stretchY: pose ? 1 - Math.max(0, swing) * .025 : 1, wave: hero && e.hero === 1 && !pose ? (e.moving ? 8 : 2) : 0 }));
    if (!box) return; this.hitBoxes.push({ ...box, id: e.id, team: e.team });
    if (tower || hero || e.hp < e.maxHp || e.kind === 'minion' || e.kind === 'camp' || e.kind==='summon') {
      const width = tower ? 50 : hero ? e.player ? 58 : 40 : 15, a = creatureBox ? { x: anchor.x, y: box.y - 9 } : this.project(x, y, height + jump + 9);
      c.fillStyle = '#08151be8'; c.beginPath(); c.roundRect(a.x - width / 2 - 2, a.y - 1, width + 4, 6, 3); c.fill();
      c.fillStyle = structureProtected(s,e) ? '#9693aa' : TEAM[e.team] || '#e8cc7c'; c.beginPath(); c.roundRect(a.x - width / 2, a.y, Math.max(1, width * e.hp / e.maxHp), 4, 2); c.fill();
      if(hero){c.fillStyle='#407caf';c.fillRect(a.x-width/2,a.y+6,width*e.mana/e.maxMana,2);}
      if (e.kind === 'tower') { c.textAlign='center';c.font='700 10px Barlow';c.fillStyle=structureProtected(s,e)?'#ddd2ec':'#ead7a8';c.fillText(structureProtected(s,e)?'INNER · PROTECTED':e.tier===1?'INNER WARD':'OUTER WARD',a.x,a.y-6); }
      this.drawBadges(e,s.time,a);
    }
  }
  drawBadges(e,time,anchor) {
    const c=this.ctx,marks=combatMarks(e,time),controls=controlLabels(e,time);
    const badges=marks.map(m=>({text:`${m.label} ${m.remaining<1?m.remaining.toFixed(1):Math.ceil(m.remaining)}s`,color:m.color}));
    for(const text of controls)badges.push({text,color:'#ffe3a0'});
    if(!badges.length)return;
    c.save();c.font='700 9px Barlow';c.textAlign='center';
    for(let row=0;row<Math.ceil(badges.length/2);row++){
      const group=badges.slice(row*2,row*2+2),widths=group.map(b=>c.measureText(b.text).width+10),total=widths.reduce((a,b)=>a+b,0)+(group.length-1)*4,y=anchor.y-8-row*15;
      let x=anchor.x-total/2;
      group.forEach((b,i)=>{c.fillStyle='#0b1b24ee';c.beginPath();c.roundRect(x,y-12,widths[i],14,3);c.fill();c.fillStyle=b.color;c.fillText(b.text,x+widths[i]/2,y-2);x+=widths[i]+4;});
    }
    c.restore();
  }
  drawWarning(intent,time,color,preview=false) {
    const w=intent.shape;if(!w)return;
    const c=this.ctx,p=this.project(w.x,w.y),radius=Math.max(0,w.radius||0)*this.scale;
    c.save();c.strokeStyle=color;c.fillStyle=color+(preview?'10':'2e');c.lineWidth=preview?1.5:2.5;c.setLineDash(preview?[3,5]:[6,4]);
    if(w.shape==='path'||w.shape==='line'){
      const end=w.tx!=null?this.project(w.tx,w.ty):this.project(w.x+Math.cos(w.angle||0)*(w.radius||0),w.y+Math.sin(w.angle||0)*(w.radius||0));
      c.beginPath();c.moveTo(p.x,p.y);
      if(w.points?.length)for(const point of w.points){const at=this.project(point.x,point.y);c.lineTo(at.x,at.y);}else c.lineTo(end.x,end.y);
      c.stroke();
      if(w.shape==='path'){c.beginPath();c.ellipse(end.x,end.y,radius,radius*.88,0,0,TAU);c.fill();c.stroke();}
    }else{
      c.translate(p.x,p.y);c.scale(1,.88);c.beginPath();
      if(w.shape==='cone'&&w.width<Math.PI){c.moveTo(0,0);c.arc(0,0,radius,w.angle-w.width,w.angle+w.width);c.closePath();}else c.arc(0,0,radius,0,TAU);
      c.fill();c.stroke();
    }
    c.restore();
    if(!preview){const progress=clamp((time-intent.start)/Math.max(.001,intent.at-intent.start),0,1);c.save();c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,Math.max(7,Math.min(18,radius*.13)),-Math.PI/2,-Math.PI/2+TAU*progress);c.stroke();c.restore();}
  }
  drawResults(s,p) {
    const c=this.ctx,events=recentCombatFeedback(s,p,{visible:this.visible}).slice(-4),rows=new Map();
    for(const event of events){
      const elapsed=s.time-event.time,at=this.project(event.x,event.y,215+elapsed*35);
      if(at.x<0||at.x>this.width||at.y<0||at.y>this.height)continue;
      const key=`${Math.round(at.x/70)}:${Math.round(at.y/45)}`,row=rows.get(key)||0;rows.set(key,row+1);
      c.save();c.globalAlpha=Math.min(1,(.8-elapsed)*3);c.textAlign='center';c.font='700 11px Barlow';c.lineWidth=3;c.strokeStyle='#101c27';const label=event.label||RESULT_LABELS[event.type];
      c.strokeText(label,at.x,at.y-row*16);c.fillStyle=RESULT_COLORS[event.type];c.fillText(label,at.x,at.y-row*16);c.restore();
    }
  }
  drawAtmosphere(s, time) {
    const c = this.ctx;
    // Local warm pools of light support the illustrated windows without tinting HUD.
    c.save(); c.globalCompositeOperation = 'screen';
    for (const prop of this.scenes[s.phase].props) {
      if (!prop.solid || !['observatory', 'market', 'greenhouse', 'house-a', 'shrine', 'mill', 'house-b'].includes(prop.name)) continue;
      const p = this.project(prop.x, prop.y, prop.height * .25), r = prop.height * this.scale * .42;
      if (p.x < -r || p.x > this.width + r || p.y < -r || p.y > this.height + r) continue;
      const glow = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); glow.addColorStop(0, '#ffbd5420'); glow.addColorStop(1, '#ffbd5400'); c.fillStyle = glow; c.fillRect(p.x - r, p.y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 32; i++) {
      const x = ((i * 137.51 + (this.sceneSeed % 600)) % this.width), y = ((i * 89.39 + (this.reducedMotion ? 0 : time * (i % 2 ? 2 : -3))) % this.height + this.height) % this.height;
      c.globalAlpha = .12 + Math.max(0, Math.sin(time * 1.4 + i)) * .3; c.fillStyle = s.phase ? '#b0e9e2' : '#e9d996'; c.beginPath(); c.arc(x + Math.sin(time * .4 + i) * 9, y, i % 3 ? 1 : 1.8, 0, TAU); c.fill();
    }
    c.restore();
    c.save(); c.strokeStyle = '#b8eee459'; c.lineWidth = 1.5;
    const left = Math.max(0, this.world(0, 0).x), right = Math.min(SIZE, this.world(this.width, 0).x);
    for (let i = 0; i < 34; i++) {
      const x = (i * 143 + (this.reducedMotion ? 0 : time * 16)) % SIZE; if (x < left - 40 || x > right + 40) continue;
      const water = riverSample(x, s.seed), offset = Math.sin(i * 2.399) * Math.min(water.y - water.north, water.south - water.y) * .7;
      const a = this.project(x, water.y + offset), next = riverSample(Math.min(SIZE, x + 38), s.seed), b = this.project(x + 38, next.y + offset);
      c.globalAlpha = .18 + Math.max(0, Math.sin(i + time * 1.1)) * .2;
      c.beginPath(); c.moveTo(a.x, a.y); c.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 2, b.x, b.y); c.stroke();
    }
    c.restore();
  }
  // Enemy heroes leave a last-seen marker on the maps for a few seconds after they vanish.
  rememberHeroes(s) {
    if (this.seenState !== s) { this.seenState = s; this.lastSeen = new Map(); }
    for (const e of s.units) if (e.kind === 'hero' && e.team !== 0) { if (e.hp <= 0) this.lastSeen.delete(e.id); else if (this.visible.has(e.id)) this.lastSeen.set(e.id, { x: e.x, y: e.y, time: s.time }); }
  }
  drawHeroMarker(m, s, e, x, y, full, ghost = false) {
    const identity = HERO_IDENTITIES[e.identity], color = identity?.color || TEAM[e.team], r = (e.player ? 1.2 : 1) * (full ? 21 : 7.5), art = identity && this.art['reference-' + identity.slug];
    m.save(); m.globalAlpha = ghost ? .42 : 1;
    m.beginPath(); m.arc(x, y, r, 0, TAU); m.fillStyle = '#0d1820'; m.fill();
    if (full && art) { m.save(); m.clip(); const w = art.width * .36; m.drawImage(art, art.width * .32, art.height * .015, w, w, x - r, y - r, r * 2, r * 2); m.restore(); }
    else { m.beginPath(); m.arc(x, y, r - (full ? 3 : 2), 0, TAU); m.fillStyle = color; m.fill(); m.fillStyle = '#0d1820'; m.font = `800 ${full ? 13 : 8}px Barlow`; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillText(ghost ? '?' : (identity?.name || e.name)[0], x, y + .5); }
    m.beginPath(); m.arc(x, y, r, 0, TAU); m.lineWidth = full ? 3 : 1.6; m.strokeStyle = e.team ? '#ff6f62' : e.player ? '#f4f8c2' : '#7ff0c2'; if (ghost) m.setLineDash([3, 3]); m.stroke();
    if (!ghost && e.hp < e.maxHp) { m.beginPath(); m.arc(x, y, r + (full ? 3 : 1.5), -Math.PI / 2, -Math.PI / 2 + TAU * e.hp / e.maxHp); m.strokeStyle = e.team ? '#ffb1a4' : '#c9f59c'; m.lineWidth = full ? 2.5 : 1.2; m.setLineDash([]); m.stroke(); }
    m.restore();
  }
  drawPings(m, s, size, full) {
    const colors = { fight: '#ff9a5c', defend: '#ff5a4f', rally: '#ffe27a', onmyway: '#7fe6ff', retreat: '#b9c4c8' };
    for (const p of s.pings || []) {
      const age = s.time - p.time; if (p.team !== 0 || age < 0 || age > (p.type === 'rally' ? 6 : 4)) continue;
      const x = p.x / SIZE * size, y = p.y / SIZE * size, pulse = (age * 1.4) % 1;
      m.save(); m.strokeStyle = colors[p.type] || '#fff'; m.lineWidth = full ? 3 : 1.5;
      for (const k of [0, .5]) { const t = (pulse + k) % 1; m.globalAlpha = (1 - t) * .9; m.beginPath(); m.arc(x, y, (full ? 10 : 5) + t * (full ? 34 : 16), 0, TAU); m.stroke(); }
      if (p.type === 'defend' || p.type === 'fight') { m.globalAlpha = .95; m.fillStyle = colors[p.type]; m.font = `900 ${full ? 20 : 11}px Barlow`; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillText('!', x, y); }
      m.restore();
    }
  }
  drawMap(s, canvas, waypoint = null) {
    const m = canvas.getContext('2d'), size = canvas.width, full = size > 250; m.clearRect(0, 0, size, size); m.fillStyle = '#1c353a'; m.fillRect(0, 0, size, size);
    m.save(); m.scale(size / SIZE, size / SIZE); riverOutline(m, riverGeometry(s.seed)); m.fillStyle = '#448e92'; m.fill(); m.restore();
    m.strokeStyle = '#56675a'; m.lineWidth = full ? 18 : 6; m.lineJoin = 'round';
    for (const lane of PATHS) { m.beginPath(); lane.forEach((p, i) => i ? m.lineTo(p.x / SIZE * size, p.y / SIZE * size) : m.moveTo(p.x / SIZE * size, p.y / SIZE * size)); m.stroke(); }
    for (const b of riverCrossings(PATHS, s.seed)) { m.strokeStyle = '#b6b294'; m.lineWidth = full ? 6 : 2; m.beginPath(); m.moveTo((b.x - b.dx * b.span / 2) / SIZE * size, (b.y - b.dy * b.span / 2) / SIZE * size); m.lineTo((b.x + b.dx * b.span / 2) / SIZE * size, (b.y + b.dy * b.span / 2) / SIZE * size); m.stroke(); }
    for (const gate of PORTALS) { m.strokeStyle = '#79d7bd'; m.lineWidth = 2; m.beginPath(); m.arc(gate.x / SIZE * size, gate.y / SIZE * size, full ? 7 : 3, 0, TAU); m.stroke(); }
    for (const e of s.units) {
      if (e.hp <= 0 || !this.visible.has(e.id)) continue;
      const x = e.x / SIZE * size, y = e.y / SIZE * size, scale = full ? 2 : 1;
      if (e.kind === 'tower' || e.kind === 'core') { const core = e.kind === 'core', image = this.art[core ? BASE_STYLES[e.team].asset : e.team ? 'tower-enemy' : 'tower-ally']; if(!core){m.strokeStyle=structureProtected(s,e)?'#9b96aa':'#e9cd8a';m.lineWidth=full?3:1;m.beginPath();m.arc(x,y,(e.tier===1?10:7)*scale,0,TAU);m.stroke();} m.drawImage(image, x - (core ? 11 : 6) * scale, y - (core ? 18 : 10) * scale, (core ? 22 : 12) * scale, (core ? 27 : 17) * scale); }
      else if (e.kind !== 'hero') { m.fillStyle = TEAM[e.team] || '#dec789'; m.beginPath(); m.arc(x, y, (['boss', 'leviathan'].includes(e.kind) ? 3.5 : 1) * scale, 0, TAU); m.fill(); }
    }
    // Heroes draw last so they stay readable above wisps; a structure under attack pulses red.
    for (const e of s.units) if (['tower', 'core'].includes(e.kind) && e.team === 0 && e.hp > 0 && e.alarmAt - 14 + 5 > s.time) { const t = (s.time * 1.5) % 1; m.save(); m.globalAlpha = 1 - t; m.strokeStyle = '#ff5a4f'; m.lineWidth = full ? 3 : 1.5; m.beginPath(); m.arc(e.x / SIZE * size, e.y / SIZE * size, (full ? 12 : 6) + t * (full ? 18 : 9), 0, TAU); m.stroke(); m.restore(); }
    for (const [id, seen] of this.lastSeen || []) { const e = s.units.find(u => u.id === id); if (e && !this.visible.has(id) && s.time - seen.time < 8) this.drawHeroMarker(m, s, e, seen.x / SIZE * size, seen.y / SIZE * size, full, true); }
    for (const e of [...s.units].sort((a, b) => Number(!!a.player) - Number(!!b.player))) if (e.kind === 'hero' && e.hp > 0 && this.visible.has(e.id)) this.drawHeroMarker(m, s, e, e.x / SIZE * size, e.y / SIZE * size, full);
    this.drawPings(m, s, size, full);
    if (waypoint) { m.strokeStyle = '#e8de9b'; m.lineWidth = 2; m.beginPath(); m.arc(waypoint.x / SIZE * size, waypoint.y / SIZE * size, 8, 0, TAU); m.stroke(); }
    if (full) { m.fillStyle = '#e7e4bc'; m.font = 'bold 19px Barlow'; m.textAlign = 'center'; m.fillText('ENEMY RIFT', size / 2, 28); m.fillText('YOUR RIFT', size / 2, size - 20); }
  }
  stats() { return { renderer: 'Illustrated 2.5D', pixelRatio: this.dpr, quality: this.quality, look: this.look || 0, push: this.push || 0, creatures: this.creatures.stats(), artStyle: 'reference-illustrated', cameraYaw: 0, laneScreenDelta: this.project(LANES[1][3].x,LANES[1][3].y).x - this.project(LANES[1][1].x,LANES[1][1].y).x, depthSorted: true, models: 4, textures: Object.keys(this.art).length, scenerySeed: this.sceneSeed, sceneryCount: this.scenes[0]?.props.length || 0, mapLayout: 'winding-districts', districts: this.scenes[0]?.districts.map(d => d.name), curvedTrackPoints: PATHS.map(p => p.length), sceneryVariants: new Set(this.scenes[0]?.props.map(p => p.name)).size, riverSeed: this.sceneSeed, crossings: this.bridges?.length || 0, attackPoses: this.lastPoses.map(p => ({ ...p })) }; }
}
