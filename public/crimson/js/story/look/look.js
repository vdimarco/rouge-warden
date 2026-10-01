// js/story/look/look.js : S.look, the story's look. One post pass (render.js) does every look: day is colour,
// night is ink, neon means danger, crimson marks the crew and objectives (design 3.6).
// - set(name, {dur}) tweens to a preset (presets.js). DAY/DUSK/NIGHT/DAWN can follow the clock (clockDriven).
// - legend(on) bleeds a daytime fight to ink; vortex(on, dur) drains the world to ink with the neon kept;
//   dawn(dur) drains the ink from the ground up.
// - every frame it writes the post uniforms, the fog (and the background under it), the lights, the sky and
//   the toon ramp together, plus the base effects (flash, hurt, grey, neon boost, smear) other packages set.
// - reset() hands the arena back exactly: post uniforms, arena fog and background (ARENA_LOOK), toon ramp,
//   render quality and depth 0.1/3000.
// Beyond the contract (types.js Look), for other packages:
// - S.look.sun is the key light and the only shadow caster: the sun by day, the moon by night. S.look.moon
//   (also S.look.fill) is a shadowless fill from the camera's side. lights.spots are the van's headlights
//   (VEHICLES aims them); lights.points are two warm points (set userData.pinned when you place one; a
//   pinned point keeps the intensity its owner sets, an unpinned one follows the look near the focus).
// - S.look.uniforms {uFogColor, uFogNear, uFogFar, uSunDir, uTime}: live values for custom shaders.
// - S.look.KEY (render.js KEY): KEY.solid(mat) for crimson crew and objective materials, KEY.glow(mat)
//   for additive crimson glows. S.look.QUALITY / S.look.tier: the tier table (quality.js).
// - base.flash and base.hurt are impulses: set them to 1 and they fade like the arena's.
// - the story fog is linear (one THREE.Fog for every look, so no material recompiles between looks); its
//   far end never passes the tier's view distance (C8).
import * as THREE from 'three';
import { post, resetPost, setQuality as renderQuality, quality as renderNow, adaptConfig, adaptHold, adaptInfo, createAdapter, setDepth, toonRamp, lastInfo, KEY, LITE } from '../../render.js';
import { LOOKS } from '../types.js';
import { PRESETS, CLOCK, CLOCK_LOOKS, clockLook } from './presets.js';
import { createSky, MOON_THETA, MOON_ELEV } from './sky.js';
import { createLights } from './lights.js';
import { QUALITY, tierOf, startTier, renderOpts, CINE_PR } from './quality.js';
import { checkNeon } from './palette.js';

/* ---------------- presets as flat numbers ---------------- */
const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
function flatten(p) {
  return {
    comic: p.comic || 0, ink: p.ink === 'keep' ? NaN : p.ink, key: p.crimsonKey, exposure: p.exposure, grade: [...p.grade], lift: p.lift, sat: p.sat, edge: p.edge, grain: p.grain,
    scratch: p.scratch, memory: p.memory, vig: p.vig, bloomThresh: p.bloomThresh, bloomGain: p.bloomGain, hotColor: p.hotColor, hueNeon: p.hueNeon,
    neonBoost: p.neonBoost, hangover: p.hangover, smear: p.smear, dissolve: p.dissolve, dissolveUp: p.dissolveUp, skyEdge: p.skyEdge,
    fogColor: lin(p.fog.color), fogNear: p.fog.near, fogFar: p.fog.far, fogView: p.fog.view,
    skyShow: p.sky.show, skyDay: p.sky.day, skyTop: lin(p.sky.top), skyHorizon: lin(p.sky.horizon), skyTint: [...p.sky.tint], skyBright: p.sky.bright,
    skyStars: p.sky.stars, skyHaze: p.sky.haze, skySunDisc: p.sky.sunDisc,
    keyColor: lin(p.key.color), keyInt: p.key.int, keyFrom: p.key.from, fillColor: lin(p.fill.color), fillInt: p.fill.int,
    hemiSky: lin(p.hemi.sky), hemiGround: lin(p.hemi.ground), hemiInt: p.hemi.int, pointColor: lin(p.point.color), pointInt: p.point.int,
    ramp: [...p.ramp],
  };
}
const FLAT = Object.fromEntries(Object.entries(PRESETS).map(([k, v]) => [k, flatten(v)]));
const copyInto = (out, a) => { for (const k in a) { const v = a[k]; if (Array.isArray(v)) { if (!out[k]) out[k] = v.slice(); else for (let i = 0; i < v.length; i++) out[k][i] = v[i]; } else out[k] = v; } return out; };
function lerpInto(out, a, b, t) {
  for (const k in b) {
    const x = a[k], y = b[k];
    if (Array.isArray(y)) { if (!out[k]) out[k] = y.slice(); for (let i = 0; i < y.length; i++) out[k][i] = x[i] + (y[i] - x[i]) * t; }
    else out[k] = Number.isNaN(y) ? x : Number.isNaN(x) ? y : x + (y - x) * t;
  }
  return out;
}
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function init(S) {
  const { scene, ctx } = S;
  S.q = startTier();
  checkNeon(); // throws in ?dev when a palette colour would read as neon

  const lights = createLights(scene);
  const sky = createSky(scene, { arena: ctx.arena });
  const storyFog = new THREE.Fog(0xc6b2a0, 250, 1100), storyBg = new THREE.Color(0xc6b2a0);
  // shared uniforms for custom story shaders that want the look's fog and sun (WORLD may use them)
  const uniforms = { uFogColor: { value: storyFog.color }, uFogNear: { value: 250 }, uFogFar: { value: 1100 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uTime: { value: 0 } };

  const cur = copyInto({}, FLAT.NIGHT), fin = copyInto({}, FLAT.NIGHT), from = copyInto({}, FLAT.NIGHT), clockP = copyInto({}, FLAT.NIGHT);
  const tw = { t: 0, dur: 0, up: false };
  const ov = { legend: 0, legendOn: false, vortex: 0, vortexOn: false, vortexRate: 1 / 1.2 };
  const sunDir = new THREE.Vector3(), moonDir = new THREE.Vector3(Math.sin(MOON_THETA) * Math.cos(MOON_ELEV), Math.sin(MOON_ELEV), Math.cos(MOON_THETA) * Math.cos(MOON_ELEV)), keyDir = new THREE.Vector3();
  const center = new THREE.Vector3(), fwd = new THREE.Vector3();
  let cineSave = null; // the render settings a cine put aside (cineQuality)
  let active = false, compiled = false, stamp = null, lastRamp = '', debugKey = false, lastVariant = 'INK';
  const rampBytes = toonRamp.image.data;

  // the sun's direction at an hour: it rises in the east (+x), crosses the south (+z) and sets in the west
  function sunAt(h, out) {
    const t = (h - 6.0) / (19.6 - 6.0);
    const elev = 1.2 * Math.sin(Math.PI * Math.max(-0.3, Math.min(1.3, t))), az = Math.PI * t;
    return out.set(Math.cos(az) * Math.cos(elev), Math.sin(elev), Math.sin(az) * Math.cos(elev)).normalize();
  }
  // the clock's look at an hour, blended through DUSK and DAWN
  function clockParams(h, out) {
    const w = clockLook(h);
    if (w === 'DAY' || w === 'NIGHT') return copyInto(out, FLAT[w]);
    const dusk = w === 'DUSK', f = dusk ? (h - CLOCK.duskStart) / (CLOCK.duskEnd - CLOCK.duskStart) : (h - CLOCK.dawnStart) / (CLOCK.dawnEnd - CLOCK.dawnStart);
    const a = dusk ? FLAT.DAY : FLAT.NIGHT, m = FLAT[w], b = dusk ? FLAT.NIGHT : FLAT.DAY;
    return f < 0.5 ? lerpInto(out, a, m, ease(f * 2)) : lerpInto(out, m, b, ease((f - 0.5) * 2));
  }
  const target = () => (L.clockDriven ? clockParams(S.day.hour, clockP) : FLAT[L.name] || FLAT.NIGHT);

  function activate() {
    if (active) return;
    active = true;
    if (!compiled) { post.precompile(); compiled = true; }
    lights.group.visible = true;
    renderQuality(renderOpts(tierOf(S.q))); lights.setTier(tierOf(S.q)); sky.setTier(tierOf(S.q)); sky.load();
    adaptConfig.tier = { get: () => S.q, set: (q) => L.setQuality(q), min: 0, max: 2 };
    adaptHold(1000);
    scene.fog = storyFog; scene.background = storyBg;
  }
  const CINE_SHADOW_BIAS = -0.0012;
  // in a cine the fill (from the camera's side) is at least this: the dark looks (VORTEX, DEEP_INK, the
  // bar) left the faces of a close-up black; play keeps the look's own
  const CINE_FILL = 0.8;
  function cineOpts() { const t = tierOf(S.q), pr = L.cinePR(); return { ...renderOpts(t), samples: Math.max(2, t.msaa), prMin: pr, prMax: Math.max(pr, t.pr[1]), pr }; }
  function deactivate() {
    const was = active;
    if (cineSave) lights.sun.shadow.bias = cineSave.bias;
    cineSave = null;
    active = false;
    lights.group.visible = false; sky.group.visible = false;
    for (const s of lights.spots) s.intensity = 0;
    for (const p of lights.points) { p.intensity = 0; p.userData.pinned = false; }
    adaptConfig.tier = null;
    resetPost(); lastVariant = 'INK';
    ctx.restoreArenaLook(); // arena fog, background, grass fog and wind, toon ramp (B11)
    lastRamp = '';
    if (was) { renderQuality(null); adaptHold(1000); } // the arena's MSAA, pixel-ratio range and shadow filter
    if (stamp && S.ui && S.ui.stamp) S.ui.stamp(null);
    stamp = null;
  }

  const L = S.look = {
    name: 'ARENA', clockDriven: false, overlay: { legend: false, vortex: false },
    base: { flash: 0, hurt: 0, grey: 0, neonBoost: 1, smear: 0 },
    sun: lights.sun, moon: lights.moon, fill: lights.moon, hemi: lights.hemi,
    lights: { sun: lights.sun, moon: lights.moon, hemi: lights.hemi, spots: lights.spots, points: lights.points },
    sky, uniforms, QUALITY, KEY,
    get params() { return fin; },
    get tier() { return tierOf(S.q); },
    get ink() { return fin.ink; },
    get variant() { return lastVariant; },
    get active() { return active; },
    // a LOOKS preset, tweened over o.dur seconds (0: at once). DAY/DUSK/NIGHT/DAWN follow the clock when
    // the clock agrees with the name (or o.clock is true); o.clock false pins the look.
    set(name, o = {}) {
      if (!LOOKS.includes(name)) throw new Error(`S.look.set: unknown look '${name}'`);
      if (name === 'ARENA') { L.name = 'ARENA'; L.clockDriven = false; if (active) deactivate(); return; }
      const wasActive = active;
      activate();
      L.name = name;
      L.clockDriven = CLOCK_LOOKS.includes(name) && (o.clock != null ? !!o.clock : clockLook(S.day.hour) === name);
      tw.t = 0; tw.up = false;
      if (wasActive) { copyInto(from, cur); tw.dur = Math.max(0, o.dur || 0); }
      else { copyInto(from, FLAT.NIGHT); tw.dur = 0; copyInto(cur, target()); if (Number.isNaN(cur.ink)) cur.ink = from.ink; }
      // an 'ink: keep' preset (INTERIOR) keeps the ink it found: lerpInto and update() read it from `from`
    },
    // daytime fight ink bleed: to ink in 0.6 s, back in 1.2 s
    legend(on) { ov.legendOn = !!on; L.overlay.legend = !!on; },
    // the vortex sight: a dissolve to ink over dur (default 1.2 s), neon kept and pushed
    vortex(on, dur = 1.2) { ov.vortexOn = !!on; L.overlay.vortex = !!on; ov.vortexRate = 1 / Math.max(0.05, dur); },
    // the ink drains from the ground up (red rocks first) over dur seconds
    dawn(dur = 6) { L.set('DAY', { dur, clock: false }); tw.up = true; },
    followLights(c, camPos) { lights.follow(c, camPos, keyDir); },
    setQuality(q) {
      q = Math.max(0, Math.min(2, Math.round(q) || 0));
      S.q = q;
      const t = tierOf(q);
      if (active) { renderQuality(cineSave ? cineOpts() : renderOpts(t)); lights.setTier(t); sky.setTier(t); adaptHold(1000); }
      S.bus.emit('quality', q);
    },
    // a cine's render scale: the tier's top pixel ratio and a step past it (quality.js CINE_PR), capped by
    // the screen's own; the frame-time governor may not take it (or the tier) down while the cine plays
    cinePR() { return Math.min(devicePixelRatio || 1, CINE_PR[Math.max(0, Math.min(2, S.q))]); },
    // on: the cine's render settings (the pixel ratio above, at least 2x MSAA); off: the ones before it
    cineQuality(on) {
      if (on && !cineSave) {
        cineSave = { pr: renderNow.pr, tier: adaptConfig.tier, active, bias: lights.sun.shadow.bias };
        adaptConfig.tier = null;
        // (a close-up shows the key light's shadow acne on flat panels, a van's side: a deeper bias clears it)
        lights.sun.shadow.bias = CINE_SHADOW_BIAS;
        renderQuality(active ? cineOpts() : { prMin: L.cinePR(), prMax: L.cinePR(), pr: L.cinePR() });
      } else if (!on && cineSave) {
        const sv = cineSave; cineSave = null;
        lights.sun.shadow.bias = sv.bias;
        if (sv.active && active) { adaptConfig.tier = sv.tier; renderQuality({ ...renderOpts(tierOf(S.q)), pr: sv.pr }); }
        else if (!sv.active && !active) renderQuality(null); // the arena's own settings
        adaptHold(1000);
      }
    },
    get cineOn() { return !!cineSave; },
    headlights(on) { for (const s of lights.spots) s.intensity = on ? 60 : 0; },
    // QA: show the key mask (1 - alpha) as grey
    debugKey(on) { debugKey = !!on; },
    reset() {
      L.name = 'ARENA'; L.clockDriven = false; L.overlay.legend = L.overlay.vortex = false;
      ov.legend = ov.vortex = 0; ov.legendOn = ov.vortexOn = false; tw.t = tw.dur = 0; tw.up = false; debugKey = false;
      Object.assign(L.base, { flash: 0, hurt: 0, grey: 0, neonBoost: 1, smear: 0 });
      deactivate();
      writeBase();
      setDepth(0.1, 3000);
    },
    update(rdt) {
      writeBase(rdt);
      if (!active) return;
      // the preset (or the clock), the tween, then the overlays
      const T = target();
      if (tw.dur > 0 && tw.t < tw.dur) { tw.t = Math.min(tw.dur, tw.t + rdt); lerpInto(cur, from, T, ease(tw.t / tw.dur)); if (tw.up) cur.dissolveUp = 1; }
      else { copyInto(cur, T); tw.up = false; }
      if (Number.isNaN(cur.ink)) cur.ink = from.ink;
      ov.legend = ov.legendOn ? Math.min(1, ov.legend + rdt / 0.6) : Math.max(0, ov.legend - rdt / 1.2);
      ov.vortex = ov.vortexOn ? Math.min(1, ov.vortex + rdt * ov.vortexRate) : Math.max(0, ov.vortex - rdt * ov.vortexRate);
      if (ov.vortex > 0) lerpInto(fin, cur, FLAT.VORTEX, ease(ov.vortex)); else copyInto(fin, cur);
      fin.ink = Math.max(fin.ink, ov.legend, ov.vortex >= 1 ? 1 : ov.vortex);
      if (Number.isNaN(fin.ink)) fin.ink = 1;
      writeAll(rdt);
    },
  };

  // flash, hurt, grey and neon boost: other packages set L.base; flash and hurt fade out like the arena's
  function writeBase(rdt = 0) {
    const u = post.m.uniforms, b = L.base;
    if (rdt > 0) { b.flash = Math.max(0, b.flash - rdt * 2.5); b.hurt = Math.max(0, b.hurt - rdt * 1.4); }
    u.uFlash.value = b.flash * 0.6; u.uHurt.value = b.hurt * 0.5; u.uGrey.value = b.grey;
    u.uNeonBoost.value = b.neonBoost * (active ? fin.neonBoost : 1);
    if (active) u.uSmear.value = Math.max(fin.smear, b.smear); else u.uSmear.value = b.smear;
  }
  function writeAll(rdt) {
    const u = post.m.uniforms, P = fin;
    u.uComic.value = P.comic; u.uInk.value = P.ink; u.uKey.value = P.key; u.uExposure.value = P.exposure; u.uGrade.value.set(P.grade[0], P.grade[1], P.grade[2]);
    u.uLift.value = P.lift; u.uSat.value = P.sat; u.uEdge.value = P.edge; u.uGrain.value = P.grain; u.uScratch.value = P.scratch;
    u.uMemory.value = P.memory; u.uVig.value = P.vig; u.uBloomThresh.value = P.bloomThresh; u.uBloomGain.value = P.bloomGain; u.uHotColor.value = P.hotColor;
    u.uHueNeon.value = P.hueNeon; u.uHangover.value = P.hangover; u.uDissolve.value = P.dissolve; u.uDissolveUp.value = P.dissolveUp; u.uSkyEdge.value = P.skyEdge;
    u.uDebugKey.value = debugKey ? 1 : 0;
    lastVariant = post.variant(P.ink <= 0.002 ? 'COLOR' : P.ink >= 0.998 ? 'INK' : 'TRANSITION');
    // fog, and the background under it (the sky covers it, but a cleared pixel must match)
    const t = tierOf(S.q), view = t.view.day + (t.view.night - t.view.day) * clamp01(P.fogView);
    const far = Math.min(P.fogFar, view), near = Math.min(P.fogNear * Math.min(1, view / 1100 + 0.25), far * 0.6);
    storyFog.color.setRGB(P.fogColor[0], P.fogColor[1], P.fogColor[2]); storyFog.near = near; storyFog.far = far;
    storyBg.copy(storyFog.color);
    if (scene.fog !== storyFog) scene.fog = storyFog;
    if (scene.background !== storyBg) scene.background = storyBg;
    uniforms.uFogNear.value = near; uniforms.uFogFar.value = far; uniforms.uTime.value = S.time;
    // lights: the key goes to the sun by day and the moon by night
    sunAt(S.day.hour, sunDir);
    const lightSun = keyDir.copy(sunDir); if (lightSun.y < 0.2) { lightSun.y = 0.2; lightSun.normalize(); }
    keyDir.lerp(moonDir, clamp01(P.keyFrom)).normalize();
    uniforms.uSunDir.value.copy(keyDir);
    lights.sun.color.setRGB(P.keyColor[0], P.keyColor[1], P.keyColor[2]); lights.sun.intensity = P.keyInt;
    lights.moon.color.setRGB(P.fillColor[0], P.fillColor[1], P.fillColor[2]); lights.moon.intensity = cineSave ? Math.max(P.fillInt, CINE_FILL) : P.fillInt;
    lights.hemi.color.setRGB(P.hemiSky[0], P.hemiSky[1], P.hemiSky[2]); lights.hemi.groundColor.setRGB(P.hemiGround[0], P.hemiGround[1], P.hemiGround[2]); lights.hemi.intensity = P.hemiInt;
    for (const p of lights.points) { p.color.setRGB(P.pointColor[0], P.pointColor[1], P.pointColor[2]); if (!p.userData.pinned) p.intensity = P.pointInt; } // a pinned point's intensity is its owner's (WORLD lights the rooms)
    // where the lights and the shadow box go: the focus, or in front of the camera when the focus is far off
    const cam = S.camera;
    center.copy(S.focus);
    if (center.distanceToSquared(cam.position) > 200 * 200) { cam.getWorldDirection(fwd); center.copy(cam.position).addScaledVector(fwd, 20); }
    lights.follow(center, cam.position, keyDir);
    sky.follow(cam.position);
    sky.apply(P, sunDir, moonDir, S.time);
    // the toon ramp: every toon material's cel bands at once
    const r0 = Math.round(P.ramp[0]), r1 = Math.round(P.ramp[1]), r2 = Math.round(P.ramp[2]), r3 = Math.round(P.ramp[3]);
    const key = `${r0},${r1},${r2},${r3}`;
    if (key !== lastRamp) { rampBytes[0] = r0; rampBytes[1] = r1; rampBytes[2] = r2; rampBytes[3] = r3; toonRamp.needsUpdate = true; lastRamp = key; }
    // a memory shows the camcorder stamp (the UI draws it)
    const want = P.memory > 0.5 ? `▶ ${S.day.label()}` : null;
    if (want !== stamp && S.ui && S.ui.stamp) { S.ui.stamp(want); stamp = want; }
  }

  S.register('look', (cdt, rdt) => L.update(rdt));
  // the day painting loads at the bear's transform on a desktop, and when the story begins everywhere
  S.bus.on('preload', (stage) => { if ((stage === 'transform' && !LITE) || stage === 'begin') sky.load(); });
  // a world swap is a hitch, not a slow device
  S.bus.on('swap', () => adaptHold(1000));

  const programs = () => (S.renderer.info.programs ? S.renderer.info.programs.length : 0);
  S.test.perf = {
    info: () => ({ calls: lastInfo.calls, triangles: lastInfo.triangles, programs: programs(), geometries: S.renderer.info.memory.geometries, textures: S.renderer.info.memory.textures, q: S.q, ...adaptInfo() }),
    tier: () => S.q,
    programs,
    budget: () => { const t = tierOf(S.q); return { tris: t.tris, draws: t.draws }; },
    // the frame-time governor on fakes: feed it a list of frame times, get back what it did (look.mjs)
    adaptSim(frames, o = {}) {
      let pr = o.pr ?? 1.0, q = o.q ?? 1;
      const T = o.tier === false ? null : { get: () => q, set: (v) => { q = v; }, min: 0, max: 2 };
      const A = createAdapter({ getPR: () => pr, setPR: (v) => { pr = Math.round(v * 100) / 100; }, prMin: () => o.prMin ?? 0.6, prMax: () => o.prMax ?? 1.25, tier: T });
      const log = []; let ms = 0;
      if (o.hold) A.hold(o.hold);
      for (const f of frames) { const [dt, n] = Array.isArray(f) ? f : [f, 1]; for (let i = 0; i < n; i++) { ms += dt; const r = A.feed(dt); if (r) log.push({ at: +(ms / 1000).toFixed(2), what: r, pr, q }); } }
      return { log, pr, q };
    },
  };
  S.test.look = {
    get name() { return L.name; }, get ink() { return fin.ink; }, get variant() { return lastVariant; }, get active() { return active; },
    get clockDriven() { return L.clockDriven; }, get legend() { return ov.legend; }, get vortex() { return ov.vortex; },
    get skyReady() { return sky.ready; }, get sky() { return sky.state; },
    uniform: (name) => { const v = post.m.uniforms[name].value; return typeof v === 'number' ? v : v.toArray ? v.toArray() : v; },
    params: () => JSON.parse(JSON.stringify(fin)),
    debugKey: (on) => L.debugKey(on),
    fog: () => ({ type: scene.fog && scene.fog.isFogExp2 ? 'exp2' : 'linear', near: scene.fog && scene.fog.near, far: scene.fog && scene.fog.far, color: scene.fog && scene.fog.color.getHexString() }),
    sunDir: () => sunDir.toArray(),
  };
}
