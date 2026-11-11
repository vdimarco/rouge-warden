// Frostwing's look: generated 3D models, image-based light, sun shadows, bloom, the snow shader, the sky with the gas
// giant Varrow, weather presets, engine trails and explosion flashes. game.js owns the scene; this module dresses it.
// Sources adapted are named in openspec/changes/add-frostwing/design.md (section "Graphics").
import * as THREE from "./lib/three.module.min.js";
import { GLTFLoader } from "./lib/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "./lib/meshopt_decoder.mjs";
import { EffectComposer } from "./lib/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "./lib/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "./lib/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "./lib/addons/postprocessing/OutputPass.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Weather presets. The story picks one per operation; quick matches use "day".
export const WEATHER = {
  day: { top: 0x5f86b8, fog: 0xa6bcd4, density: 0.00078, sun: [0.4, 0.35, -0.85], sunColor: 0xfff2e0, sunI: 2.0, hemiSky: 0xd4e2f8, hemiGround: 0x52627a, hemiI: 1.05, cloud: 0xf4f8ff, clouds: 0.5, snow: 1, stars: 0, aurora: 0, exposure: 0.92, planet: [-0.55, 0.32, -0.77], planetSize: 2400 },
  dusk: { top: 0x34477e, fog: 0xb38d88, density: 0.0009, sun: [-0.3, 0.12, -0.95], sunColor: 0xffb070, sunI: 2.2, hemiSky: 0xe6b8a4, hemiGround: 0x3a3a58, hemiI: 0.95, cloud: 0xffc7a0, clouds: 0.6, snow: 0.8, stars: 0.25, aurora: 0, exposure: 0.95, planet: [0.55, 0.22, -0.8], planetSize: 3000 },
  night: { top: 0x070d20, fog: 0x1e2c48, density: 0.0011, sun: [0.3, 0.55, -0.78], sunColor: 0x9fb8ff, sunI: 1.1, hemiSky: 0x5a74b0, hemiGround: 0x101828, hemiI: 1.0, cloud: 0x2c3c60, clouds: 0.3, snow: 0.9, stars: 1, aurora: 1, exposure: 1.25, planet: [-0.4, 0.4, -0.82], planetSize: 2800 },
  storm: { top: 0x4a5a70, fog: 0x8b9bb0, density: 0.0024, sun: [0.2, 0.5, -0.84], sunColor: 0xdfe8ff, sunI: 1.2, hemiSky: 0xc8d4e4, hemiGround: 0x4a5464, hemiI: 1.6, cloud: 0xb8c4d4, clouds: 0.95, snow: 2.4, stars: 0, aurora: 0, exposure: 1.0, planet: [-0.5, 0.3, -0.8], planetSize: 2400 },
};

export function createLook({ renderer, scene, camera, high, TOUCH }) {
  const look = { high, models: {}, ready: false, weather: "day", time: 0 };
  const hemi = new THREE.HemisphereLight(0xdbe8ff, 0x5a6a80, 1.3);
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.3);
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -180, right: 180, top: 180, bottom: -180, near: 10, far: 2600 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  scene.add(hemi, sun, sun.target);
  look.sun = sun; look.hemi = hemi;

  /* ---------- sky: gradient, sun, drifting clouds, stars and aurora at night ---------- */
  const skyU = {
    top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() },
    cloudCol: { value: new THREE.Color() }, clouds: { value: 0.5 }, stars: { value: 0 }, aurora: { value: 0 }, time: { value: 0 },
  };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false, uniforms: skyU, defines: { OCT: high ? 5 : 2 },
    vertexShader: "varying vec3 vd; void main(){ vd = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }",
    fragmentShader: `
      uniform vec3 top, mid, sunDir, sunCol, cloudCol; uniform float clouds, stars, aurora, time; varying vec3 vd;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < OCT; i++){ s += a * n2(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
      void main(){
        vec3 d = normalize(vd); float h = clamp(d.y, 0.0, 1.0);
        vec3 c = mix(mid, top, pow(h, 0.55));
        float s = max(dot(d, sunDir), 0.0);
        c += sunCol * (pow(s, 1400.0) * 3.0 + pow(s, 64.0) * 0.35 + pow(s, 6.0) * 0.1);
        if (stars > 0.0 && d.y > 0.0) { vec2 g = floor(d.xz / (d.y + 0.35) * 380.0); float st = step(0.9975, h2(g)) * (0.6 + 0.4 * sin(time * 3.0 + h2(g + 3.0) * 40.0)); c += vec3(st) * stars * smoothstep(0.0, 0.25, d.y); }
        if (aurora > 0.0 && d.y > 0.02) { vec2 a = d.xz / (d.y + 0.25); float band = fbm(vec2(a.x * 1.2 + time * 0.03, a.y * 0.3)); float curtain = smoothstep(0.45, 0.8, band) * smoothstep(0.02, 0.25, d.y) * smoothstep(0.75, 0.3, d.y);
          c += mix(vec3(0.1, 1.0, 0.55), vec3(0.6, 0.3, 1.0), smoothstep(0.1, 0.5, d.y)) * curtain * aurora * 0.9; }
        if (d.y > -0.02) { vec2 uv = d.xz / (d.y + 0.12) * 0.9 + vec2(time * 0.012, time * 0.004); float cl = smoothstep(1.0 - clouds, 1.25 - clouds * 0.5, fbm(uv * 1.4));
          vec3 cc = cloudCol * (0.75 + 0.35 * s) + sunCol * pow(s, 8.0) * 0.4; c = mix(c, cc, cl * smoothstep(-0.02, 0.18, d.y) * 0.85); }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), skyMat);
  sky.renderOrder = -2; sky.frustumCulled = false; scene.add(sky);
  look.sky = sky;
  // Varrow, the gas giant that Hollowmere circles
  const planet = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.TextureLoader().load("art/varrow.webp", (t) => { t.colorSpace = THREE.SRGBColorSpace; }), fog: false, depthWrite: false, transparent: true }));
  planet.renderOrder = -1; planet.frustumCulled = false; scene.add(planet);
  look.planet = planet;

  /* ---------- image-based light from the sky ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envRT = null;
  function bakeEnv() {
    const es = new THREE.Scene();
    const m = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat); m.renderOrder = -1; es.add(m);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(48, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(WEATHER[look.weather].fog).multiplyScalar(0.9) }));
    ground.position.y = -6; es.add(ground);
    if (envRT) envRT.dispose();
    envRT = pmrem.fromScene(es, 0.03, 0.1, 200);
    scene.environment = envRT.texture;
  }

  /* ---------- weather ---------- */
  const snowScale = { v: 1 };
  look.snow = snowScale;
  look.setWeather = (name) => {
    const w = WEATHER[name] || WEATHER.day; look.weather = WEATHER[name] ? name : "day";
    skyU.top.value.set(w.top); skyU.mid.value.set(w.fog); skyU.sunDir.value.set(...w.sun).normalize(); skyU.sunCol.value.set(w.sunColor);
    skyU.cloudCol.value.set(w.cloud); skyU.clouds.value = w.clouds; skyU.stars.value = w.stars; skyU.aurora.value = w.aurora;
    scene.fog.color.set(w.fog); scene.fog.density = w.density; scene.background = scene.fog.color;
    sun.color.set(w.sunColor); sun.intensity = w.sunI; hemi.color.set(w.hemiSky); hemi.groundColor.set(w.hemiGround); hemi.intensity = w.hemiI;
    renderer.toneMappingExposure = w.exposure; snowScale.v = w.snow;
    look.sunDir = new THREE.Vector3(...w.sun).normalize(); look.planetDir = new THREE.Vector3(...w.planet).normalize(); planet.scale.setScalar(w.planetSize);
    if (terrainMat) terrainMat.userData.u.sunDir.value.copy(look.sunDir);
    bakeEnv();
  };

  /* ---------- the snow: detail normals and glints ---------- */
  // Base colour comes from vertex colours (snow, shaded snow, rock, ice). The fragment shader adds wind-carved ripples
  // as a normal perturbation in world space and sparse glints that flash when a grain faces the sun, after the sand
  // shading in Journey (John Edwards, GDC 2013).
  let terrainMat = null, land = null;
  const terrainFast = new THREE.MeshLambertMaterial({ vertexColors: true });
  look.setLand = (mesh) => { land = mesh; land.material = look.high ? terrainMat : terrainFast; land.receiveShadow = true; };
  look.terrainMaterial = () => {
    terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0, envMapIntensity: 0.6 });
    const u = { sunDir: { value: new THREE.Vector3(0.4, 0.35, -0.85).normalize() }, glint: { value: high ? 1 : 0.6 } };
    terrainMat.userData.u = u;
    terrainMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vWorld;")
        .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
        varying vec3 vWorld; uniform vec3 sunDir; uniform float glint;
        float fh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float fn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(fh(i), fh(i+vec2(1,0)), f.x), mix(fh(i+vec2(0,1)), fh(i+vec2(1,1)), f.x), f.y); }
        float ripples(vec2 p){ return fn(p * 0.09) * 0.55 + fn(p * 0.31 + 3.1) * 0.3 + fn(p * 1.3 + 7.7) * 0.15; }`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        { float e = 0.6, h0 = ripples(vWorld.xz), hx = ripples(vWorld.xz + vec2(e, 0.0)), hz = ripples(vWorld.xz + vec2(0.0, e));
          float fade = 1.0 - smoothstep(150.0, 700.0, length(vWorld - cameraPosition));
          vec3 wp = normalize(vec3(-(hx - h0) * 2.2, 1.0, -(hz - h0) * 2.2));
          vec3 vp = normalize((viewMatrix * vec4(wp - vec3(0.0, 1.0, 0.0), 0.0)).xyz);
          normal = normalize(normal + vp * fade * 0.9); }`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        { vec3 cell = floor(vWorld * 1.6); float r = fh(cell.xz + cell.y * 13.0);
          vec3 gdir = normalize(vec3(fh(cell.xz + 1.3) - 0.5, 1.2, fh(cell.xz + 4.7) - 0.5));
          vec3 v = normalize(cameraPosition - vWorld); vec3 hv = normalize(v + sunDir);
          float g = step(0.985, r) * pow(max(dot(gdir, hv), 0.0), 60.0);
          float near = 1.0 - smoothstep(40.0, 260.0, length(cameraPosition - vWorld));
          float snowy = smoothstep(0.55, 0.85, diffuseColor.b);
          totalEmissiveRadiance += vec3(0.95, 0.97, 1.0) * g * near * snowy * glint * 5.0; }`);
    };
    return terrainMat;
  };

  /* ---------- models ---------- */
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const NAMES = ["lantern", "corvid", "slab", "gate", "beacon", "rock"];
  look.load = () => Promise.all(NAMES.map((n) => loader.loadAsync(`models/${n}.glb`).then((g) => {
    g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; if (o.material) o.material.envMapIntensity = 1.0; } });
    look.models[n] = g.scene;
  }))).then(() => {
    // the Corvid's black hull lets its violet seams show through as light
    look.models.corvid.traverse((o) => { if (o.isMesh && o.material.map) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xb070ff); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.55; } });
    // the meteorite's amber cracks glow
    look.models.rock.traverse((o) => { if (o.isMesh && o.material.map) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(0xff9a2a); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 1.6; } });
    // Fast graphics: each PBR material has a Lambert twin with the same colour map and glow, and no normal map or
    // sky reflections. setQuality swaps them on every mesh in the scene.
    for (const n of NAMES) look.models[n].traverse((o) => {
      if (!o.isMesh || loOf.has(o.material)) return;
      const hi = o.material, lo = new THREE.MeshLambertMaterial({ map: hi.map, color: hi.color, emissive: hi.emissive, emissiveMap: hi.emissiveMap, emissiveIntensity: hi.emissiveIntensity });
      loOf.set(hi, lo); hiOf.set(lo, hi);
    });
    look.ready = true;
  });
  const loOf = new Map(), hiOf = new Map();
  const swap = (root, h) => root.traverse((o) => { if (!o.isMesh) return; const m = h ? hiOf.get(o.material) : loOf.get(o.material); if (m) o.material = m; });
  look.clone = (n) => { const c = look.models[n].clone(true); if (!look.high) swap(c, false); return c; };

  /* ---------- shadows, bloom and the final frame ---------- */
  let composer = null, bloom = null;
  function setupPost() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.45, 1.05);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  look.setQuality = (h) => {
    look.high = h;
    renderer.shadowMap.enabled = h; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    sun.castShadow = h;
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
    if (h && !composer) setupPost();
    if (land) land.material = h ? terrainMat : terrainFast;
    swap(scene, h);
    skyMat.defines.OCT = h ? 5 : 2; skyMat.needsUpdate = true;
    if (envRT) bakeEnv();
    look.resize();
  };
  look.resize = () => {
    if (!composer) return;
    const pr = renderer.getPixelRatio();
    composer.setPixelRatio(pr); composer.setSize(innerWidth, innerHeight);
    bloom.resolution.set(innerWidth * pr * 0.5, innerHeight * pr * 0.5);
  };
  look.render = () => { if (look.high && composer) composer.render(); else renderer.render(scene, camera); };

  // follow the action: the sky and planet ride with the camera; the shadow box stays on the focus point
  const tmp = new THREE.Vector3();
  look.update = (dt, focus) => {
    look.time += dt; skyU.time.value = look.time;
    sky.position.copy(camera.position);
    planet.position.copy(camera.position).addScaledVector(look.planetDir, 4300);
    if (focus) {
      tmp.set(focus.x, focus.y, focus.z);
      sun.target.position.copy(tmp);
      sun.position.copy(tmp).addScaledVector(look.sunDir, 1200);
      sun.target.updateMatrixWorld();
    }
    trails.update(dt);
    flashes.update(dt);
  };

  /* ---------- engine trails: camera-facing ribbons that taper and fade ---------- */
  const trails = (() => {
    const list = [], N = 26;
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
      vertexShader: [
        "attribute vec4 tint; varying vec4 vt;",
        "#include <fog_pars_vertex>",
        "void main(){ vt = tint; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;",
        "  vt.a *= smoothstep(18.0, 70.0, -mvPosition.z);",
        "#include <fog_vertex>",
        "}"].join("\n"),
      // additive light fades out in fog rather than turning fog-coloured
      fragmentShader: [
        "varying vec4 vt;",
        "#include <fog_pars_fragment>",
        "void main(){ float keep = 1.0;",
        "#ifdef USE_FOG",
        "  keep = exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);",
        "#endif",
        "  gl_FragColor = vec4(vt.rgb * vt.a * keep, 1.0); }"].join("\n"),
    });
    function add(color, width) {
      const pos = new Float32Array(N * 2 * 3), tint = new Float32Array(N * 2 * 4), idx = [];
      for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("tint", new THREE.BufferAttribute(tint, 4).setUsage(THREE.DynamicDrawUsage));
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, mat); mesh.frustumCulled = false; scene.add(mesh);
      const t = { mesh, pts: [], color: new THREE.Color(color), width, on: true, last: 0,
        push(p, boost) {
          // the newest point follows the nozzle every frame; a new point is laid down every 1/45 s
          const now = look.time;
          if (this.pts.length && now - this.last < 1 / 45) { const h = this.pts[0]; h.x = p.x; h.y = p.y; h.z = p.z; h.b = boost; return; }
          this.last = now; this.pts.unshift({ x: p.x, y: p.y, z: p.z, a: 1, b: boost }); if (this.pts.length > N) this.pts.length = N;
        }, clear() { this.pts.length = 0; } };
      list.push(t); return t;
    }
    const side = new THREE.Vector3(), dir = new THREE.Vector3(), toCam = new THREE.Vector3();
    function update(dt) {
      for (const t of list) {
        const pos = t.mesh.geometry.attributes.position.array, tint = t.mesh.geometry.attributes.tint.array;
        for (const p of t.pts) p.a -= dt * 2.2;
        const n = t.pts.length;
        for (let i = 0; i < N; i++) {
          const p = i < n ? t.pts[i] : null;
          if (!p || !t.on) { for (let k = 0; k < 2; k++) { const j = i * 2 + k; tint[j * 4 + 3] = 0; if (n) { const e = t.pts[n - 1]; pos[j * 3] = e.x; pos[j * 3 + 1] = e.y; pos[j * 3 + 2] = e.z; } } continue; }
          const q = t.pts[Math.min(i + 1, n - 1)], o = t.pts[Math.max(i - 1, 0)];
          dir.set(o.x - q.x, o.y - q.y, o.z - q.z); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
          toCam.set(camera.position.x - p.x, camera.position.y - p.y, camera.position.z - p.z);
          side.crossVectors(dir, toCam).normalize();
          const f = 1 - i / (N - 1), w = t.width * (0.25 + 0.75 * f) * (p.b ? 1.5 : 1), a = clamp(p.a, 0, 1) * f * f * (p.b ? 0.9 : 0.55);
          for (let k = 0; k < 2; k++) {
            const sgn = k ? -1 : 1, j = i * 2 + k;
            pos[j * 3] = p.x + side.x * w * sgn; pos[j * 3 + 1] = p.y + side.y * w * sgn; pos[j * 3 + 2] = p.z + side.z * w * sgn;
            tint[j * 4] = t.color.r; tint[j * 4 + 1] = t.color.g; tint[j * 4 + 2] = t.color.b; tint[j * 4 + 3] = a;
          }
        }
        t.mesh.geometry.attributes.position.needsUpdate = true; t.mesh.geometry.attributes.tint.needsUpdate = true;
      }
    }
    return { add, update };
  })();
  look.trail = trails.add;

  /* ---------- explosion flashes: a few lights kept alive, so shaders never recompile ---------- */
  const flashes = (() => {
    const pool = [];
    for (let i = 0; i < (high ? 3 : 0); i++) { const l = new THREE.PointLight(0xffb060, 0, 260, 1.6); scene.add(l); pool.push({ l, t: 0 }); }
    let next = 0;
    return {
      fire(x, y, z, color = 0xffb060, power = 1) { if (!pool.length) return; const f = pool[next]; next = (next + 1) % pool.length; f.l.position.set(x, y, z); f.l.color.set(color); f.t = 0.45; f.p = 6000 * power; },
      update(dt) { for (const f of pool) { f.t = Math.max(0, f.t - dt); f.l.intensity = f.t > 0 ? f.p * (f.t / 0.45) ** 2 : 0; } },
    };
  })();
  look.flash = flashes.fire;

  look.setWeather("day");
  look.setQuality(high);
  return look;
}
