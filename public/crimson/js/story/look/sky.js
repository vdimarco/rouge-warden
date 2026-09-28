// js/story/look/sky.js : the story sky, one camera-following sphere drawn first (one draw call).
// - the dome: a gradient with the sun, the moon and stars (painted clouds in code when the day painting is
//   missing, A4)
// - the panorama, projected as a cylinder around the eye: it cross-fades the day painting
//   (art/sky_day.webp, red buttes under a blue sky) and the ink night painting (art/sky.webp, the arena's
//   own texture object, C6). Its top fades into the dome; below the horizon it turns to the fog colour, so
//   the far edge of the world meets it cleanly.
// The sky writes alpha 2: never keyed (the key reads 1 - alpha), and the composite softens its ink edges
// on sky pixels (uSkyEdge) so the painting does not turn into a comic of outlines.
import * as THREE from 'three';

const R = 2400;
const ASPECT = 3876 / 878, HN = (Math.PI * 2) / ASPECT; // a painting's height over the cylinder's radius
// where the eye line sits in each painting (0 top, 1 bottom): the buttes stand just above the horizon
export const EYE = Object.freeze({ day: 0.56, night: 0.64 });
// the arena's night sky puts its painted moon at this bearing (world.js MOON_THETA); the story moon matches it
export const MOON_THETA = 0.18 * Math.PI * 2;
export const MOON_ELEV = Math.atan((EYE.night - 0.3) * HN);

const FRAG = /* glsl */`
  uniform vec3 uTop, uHorizon, uFog, uSunDir, uSunCol, uMoonDir, uTint;
  uniform float uSunInt, uMoonInt, uStars, uTime, uClouds, uSunDisc;
  uniform sampler2D tDay, tNight; uniform float uDay, uEyeDay, uEyeNight, uHn, uBright, uHaze, uHasDay;
  varying vec3 vD;
  float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
  float h2(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
  void main(){
    vec3 d = normalize(vD);
    float y = d.y;
    // the dome
    vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.85, y), 0.65));
    float sd = max(dot(d, uSunDir), 0.);
    col += uSunCol * uSunInt * (smoothstep(0.99965, 0.9998, sd) * 6. * uSunDisc + pow(sd, 24.) * 0.3 + pow(sd, 4.) * 0.06);
    float md = max(dot(d, uMoonDir), 0.);
    col += vec3(0.95, 0.97, 1.) * uMoonInt * (smoothstep(0.99955, 0.99972, md) * 1.6 + pow(md, 80.) * 0.06);
    if (uClouds > 0.) {
      // soft painted cumulus (only when the day painting could not load)
      vec2 p = d.xz / max(y + 0.12, 0.05) * 1.6 + vec2(uTime * 0.004, 0.);
      float c = n2(p) * 0.55 + n2(p * 2.3) * 0.3 + n2(p * 5.1) * 0.15;
      c = smoothstep(0.52, 0.78, c) * smoothstep(0.02, 0.25, y) * uClouds;
      col = mix(col, mix(vec3(0.5, 0.55, 0.64), vec3(1.0, 0.97, 0.92), smoothstep(0.55, 0.9, c + y * 0.2)), c * 0.85);
    }
    vec3 q = floor(d * 260.);
    col += step(0.9972, h3(q)) * uStars * smoothstep(0.02, 0.35, y) * (0.55 + 0.45 * sin(uTime * 2.7 + h3(q + 1.) * 30.)) * 0.8;
    // the panorama on a cylinder around the eye; the bearing is picked from two wraps so the texture
    // never sees the seam
    float th = atan(d.x, d.z) / 6.2831853;
    float u1 = th, u2 = fract(th + 1.);
    float u = fwidth(u1) <= fwidth(u2) ? u1 : u2;
    float yr = y / max(length(d.xz), 1e-3);
    float rowD = uEyeDay - yr / uHn, rowN = uEyeNight - yr / uHn;
    vec3 cd = texture(tDay, vec2(-u, 1. - clamp(rowD, 0., 1.))).rgb;
    vec3 cn = texture(tNight, vec2(-u, 1. - clamp(rowN, 0., 1.))).rgb * 0.9;
    float aD = smoothstep(0.0, 0.08, rowD) * step(rowD, 1.) * uHasDay, aN = smoothstep(0.0, 0.12, rowN) * step(rowN, 1.);
    vec3 pano = mix(cn, cd, uDay) * uTint * uBright;
    pano += uSunCol * uSunInt * pow(sd, 14.) * 0.12;
    col = mix(col, pano, mix(aN, aD, uDay));
    // haze: the fog colour below the horizon, thinning above it
    float below = 1. - smoothstep(-0.004, 0.02, yr);
    col = mix(col, uFog, clamp(below + uHaze * (1. - smoothstep(0.0, 0.42, yr)) * mix(aN, aD, uDay), 0., 1.));
    gl_FragColor = vec4(col, 2.);
  }`;

export function createSky(scene, { arena = null } = {}) {
  const group = new THREE.Group(); group.name = 'storySky'; group.visible = false;
  const col = (h) => new THREE.Color(h);
  // the night painting: the arena's texture object, reused as it is (C6)
  let night = null;
  if (arena) arena.traverse((o) => { const m = o.material; if (!night && o.isMesh && m && m.map && m.map.image && /sky\.webp/.test(m.map.image.src || m.map.image.currentSrc || '')) night = m.map; });
  if (!night) { night = new THREE.TextureLoader().load('art/sky.webp'); night.colorSpace = THREE.SRGBColorSpace; night.wrapS = THREE.RepeatWrapping; }
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true;
  const u = {
    uTop: { value: col(0x2f6cc0) }, uHorizon: { value: col(0xb9cbe1) }, uFog: { value: col(0xc6b2a0) }, uTint: { value: new THREE.Vector3(1, 1, 1) },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: col(0xffe2b8) }, uMoonDir: { value: new THREE.Vector3(0, 1, 0) },
    uSunInt: { value: 1 }, uMoonInt: { value: 0 }, uStars: { value: 0 }, uTime: { value: 0 }, uClouds: { value: 0 }, uSunDisc: { value: 1 },
    tDay: { value: blank }, tNight: { value: night }, uDay: { value: 1 }, uEyeDay: { value: EYE.day }, uEyeNight: { value: EYE.night }, uHn: { value: HN },
    uBright: { value: 1 }, uHaze: { value: 0.3 }, uHasDay: { value: 0 },
  };
  const VERT = 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }';
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24), new THREE.ShaderMaterial({ uniforms: u, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, fog: false }));
  mesh.name = 'storySky'; mesh.renderOrder = -20; mesh.frustumCulled = false;
  group.add(mesh);
  scene.add(group);

  // the day painting loads once, on the first ask; Q1 and Q0 draw it into a 2048-wide canvas (C6)
  const st = { state: 'none', width: 0 };
  let dayImg = null, want = 3876;
  function useDay() {
    if (!dayImg) return;
    const old = u.tDay.value;
    let tex;
    if (want < dayImg.width) {
      const cv = document.createElement('canvas'); cv.width = want; cv.height = Math.round(want * dayImg.height / dayImg.width);
      cv.getContext('2d').drawImage(dayImg, 0, 0, cv.width, cv.height);
      tex = new THREE.CanvasTexture(cv);
    } else { tex = new THREE.Texture(dayImg); tex.needsUpdate = true; }
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
    u.tDay.value = tex; u.uHasDay.value = 1; st.width = Math.min(want, dayImg.width);
    if (old && old !== blank) old.dispose();
  }
  function load() {
    if (st.state !== 'none') return;
    st.state = 'loading';
    const img = new Image();
    img.onload = () => { dayImg = img; st.state = 'ready'; useDay(); };
    img.onerror = () => { st.state = 'failed'; }; // the dome paints its own clouds instead (A4)
    img.src = 'art/sky_day.webp';
  }
  return {
    group, mesh, uniforms: u,
    load,
    get state() { return st.state; },
    // ready: the day painting is in (or it failed and the dome paints clouds instead)
    get ready() { return st.state === 'ready' || st.state === 'failed'; },
    get width() { return st.width; },
    setTier(t) { want = t.pano; if (dayImg && st.width !== Math.min(want, dayImg.width)) useDay(); },
    // P: the look's flat numbers (look.js); sunDir/moonDir: unit vectors toward them
    apply(P, sunDir, moonDir, time) {
      group.visible = P.skyShow > 0.5;
      u.uTop.value.setRGB(P.skyTop[0], P.skyTop[1], P.skyTop[2]);
      u.uHorizon.value.setRGB(P.skyHorizon[0], P.skyHorizon[1], P.skyHorizon[2]);
      u.uFog.value.setRGB(P.fogColor[0], P.fogColor[1], P.fogColor[2]);
      u.uSunDir.value.copy(sunDir); u.uMoonDir.value.copy(moonDir);
      u.uSunCol.value.setRGB(P.keyColor[0], P.keyColor[1], P.keyColor[2]);
      const sunUp = THREE.MathUtils.smoothstep(sunDir.y, -0.05, 0.08);
      u.uSunInt.value = sunUp * Math.min(1, P.skyDay + 0.2) * (1 - P.ink * 0.6);
      u.uSunDisc.value = P.skySunDisc;
      u.uMoonInt.value = THREE.MathUtils.smoothstep(moonDir.y, -0.02, 0.1) * (1 - P.skyDay) * (P.skyStars > 0 ? 1 : 0);
      u.uStars.value = P.skyStars; u.uTime.value = time;
      u.uClouds.value = st.state === 'ready' ? 0 : P.skyDay;
      u.uDay.value = P.skyDay; u.uBright.value = P.skyBright; u.uHaze.value = P.skyHaze;
      u.uTint.value.set(P.skyTint[0], P.skyTint[1], P.skyTint[2]);
    },
    follow(camPos) { mesh.position.copy(camPos); },
  };
}
