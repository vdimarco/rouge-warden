// Stub LOOK (frozen; the look package replaces look/look.js, not this file).
// Its own fog objects per preset, the fixed story light set (hidden in the arena), the base post effects
// written each frame while the story runs, and reset() back to the arena look (B11).
import { LOOKS } from '../types.js';

// fog: 'exp' (density) or 'lin' (near, far); light levels for sun, moon and sky
const PRESETS = {
  DAY: { fog: 'lin', color: 0x9aa9b6, near: 250, far: 1100, sun: 2.6, moon: 0, hemi: 0.6 },
  DUSK: { fog: 'lin', color: 0x5f5454, near: 200, far: 900, sun: 1.0, moon: 0.6, hemi: 0.45 },
  NIGHT: { fog: 'exp', color: 0x0e1014, density: 0.012, sun: 0, moon: 2.0, hemi: 0.35 },
  DAWN: { fog: 'lin', color: 0x6c6a70, near: 200, far: 900, sun: 1.2, moon: 0.4, hemi: 0.45 },
  MEMORY: { fog: 'lin', color: 0xa39d92, near: 250, far: 1100, sun: 2.4, moon: 0, hemi: 0.65 },
  MEMORY_NIGHT: { fog: 'exp', color: 0x121216, density: 0.012, sun: 0, moon: 1.8, hemi: 0.35 },
  INTERIOR: { fog: 'exp', color: 0x14100c, density: 0.02, sun: 0, moon: 0, hemi: 0.5 },
  HANGOVER: { fog: 'lin', color: 0xb0aca4, near: 150, far: 900, sun: 2.8, moon: 0, hemi: 0.7 },
  VORTEX: { fog: 'exp', color: 0x07070a, density: 0.014, sun: 0, moon: 1.4, hemi: 0.25 },
  DEEP_INK: { fog: 'exp', color: 0x050506, density: 0.02, sun: 0, moon: 0.8, hemi: 0.15 },
};

export function init(S) {
  const { THREE, scene } = S;
  const expFog = new THREE.FogExp2(0x0e1014, 0.012), linFog = new THREE.Fog(0x9aa9b6, 250, 1100), bg = new THREE.Color(0x0e1014);
  const group = new THREE.Group(); group.name = 'storyLights'; group.visible = false;
  const sun = new THREE.DirectionalLight(0xffe2b8, 0), moon = new THREE.DirectionalLight(0xe6ecf5, 2.0), hemi = new THREE.HemisphereLight(0x9cc4ff, 0xa0522d, 0.35);
  group.add(sun, sun.target, moon, moon.target, hemi);
  const spots = [0, 1].map(() => { const s = new THREE.SpotLight(0xfff1d8, 0, 60, 0.45, 0.5, 1.5); group.add(s, s.target); return s; });
  const points = [0, 1].map(() => { const p = new THREE.PointLight(0xffc890, 0, 18, 2); group.add(p); return p; });
  scene.add(group);
  const SUN = new THREE.Vector3(0.45, 0.8, 0.35).normalize(), MOON = new THREE.Vector3(-0.4, 0.7, -0.55).normalize();
  const post = S.ctx.post;

  const L = S.look = {
    name: 'ARENA', clockDriven: false, overlay: { legend: false, vortex: false },
    base: { flash: 0, hurt: 0, grey: 0, neonBoost: 1, smear: 0 },
    sun, moon, hemi, lights: { sun, moon, hemi, spots, points }, group,
    set(name) {
      if (!LOOKS.includes(name)) throw new Error(`S.look.set: unknown look '${name}'`);
      L.name = name;
      if (name === 'ARENA') { group.visible = false; S.ctx.restoreArenaLook(); return; }
      const p = PRESETS[name], fog = p.fog === 'lin' ? linFog : expFog;
      fog.color.setHex(p.color);
      if (p.fog === 'lin') { fog.near = p.near; fog.far = p.far; } else fog.density = p.density;
      bg.setHex(p.color); scene.fog = fog; scene.background = bg;
      sun.intensity = p.sun; moon.intensity = p.moon; hemi.intensity = p.hemi;
      group.visible = true;
    },
    legend(on) { L.overlay.legend = !!on; },
    vortex(on) { L.overlay.vortex = !!on; },
    dawn() { L.set('DAWN'); },
    followLights(center, camPos) {
      sun.position.copy(center).addScaledVector(SUN, 80); sun.target.position.copy(center);
      moon.position.copy(center).addScaledVector(MOON, 80); moon.target.position.copy(center);
    },
    setQuality(q) { S.q = q; S.bus.emit('quality', q); },
    reset() {
      group.visible = false; L.name = 'ARENA'; L.overlay.legend = L.overlay.vortex = false;
      Object.assign(L.base, { flash: 0, hurt: 0, grey: 0, neonBoost: 1, smear: 0 });
      for (const s of spots) s.intensity = 0; for (const p of points) p.intensity = 0;
      S.ctx.restoreArenaLook(); writeBase();
    },
    update() { if (L.name !== 'ARENA') L.followLights(S.focus, S.camera.position); writeBase(); },
    headlights(on) { for (const s of spots) s.intensity = on ? 40 : 0; },
  };
  // the story owns the post pass while it runs: the arena's flash, hurt, grey and neon values stop here
  function writeBase() {
    const u = post.m.uniforms;
    u.uFlash.value = L.base.flash * 0.6; u.uHurt.value = L.base.hurt * 0.5; u.uGrey.value = L.base.grey; u.uNeonBoost.value = L.base.neonBoost;
  }
  S.register('look', () => L.update());
  S.test.perf = { info: () => ({ calls: S.renderer.info.render.calls, triangles: S.renderer.info.render.triangles, programs: S.renderer.info.programs ? S.renderer.info.programs.length : 0 }), tier: () => S.q };
}
