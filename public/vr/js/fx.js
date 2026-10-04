// In Full Swing: comic sound words in the world (THWIP, YANK, FLUSH ...). One InstancedMesh holds at most 16 live words and
// draws them in one call. A word pops in, holds, and fades out. It always faces your head, turning about world up only.
// The art (art/words.webp and words.json) loads here on its own. If it fails, words never show and nothing else breaks.
import * as THREE from "three";

const MAX = 16; // live words: one draw call whatever happens
const LIFE = 0.8; // seconds from the pop to nothing
const POP_UP = 0.07, POP_END = 0.12; // scale 0 to 1.2 by 0.07 s, back to 1 by 0.12 s
const FADE_FROM = 0.5; // it holds full strength until here, then fades
const NEAR = 1.2; // a word closer to the head than this is skipped: it would cover the view
const FADE_NEAR = 0.6; // a live word the head flies into fades over the last 0.6 m before NEAR
const ANG = [8, 12]; // degrees across, at the word's own distance, when the caller gives no size
const TILT = (8 * Math.PI) / 180;
const W_MIN = 0.2, W_MAX = 10; // metres across: never a speck, and a far word never fills the sky
const DRIFT = 0.5; // m/s along the word's dir
const ART = new URL("../art/", import.meta.url).href;
const smooth = (a, b, x) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };

// opts is reserved (a later pass may pass the shared art from comic.js here)
export function createFX(scene, renderer, opts = {}) {
  /* ---------------- the art ---------------- */
  let rects = null, ready = false, failed = false;
  const loadJSON = fetch(ART + "words.json").then((r) => { if (!r.ok) throw new Error("words.json " + r.status); return r.json(); });
  const loadTex = new Promise((ok, no) => new THREE.TextureLoader().load(ART + "words.webp", ok, undefined, no));
  Promise.all([loadJSON, loadTex]).then(([json, t]) => {
    // a sticker atlas seen at every distance: full mip chain, so a far word never crawls
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 1);
    t.needsUpdate = true;
    renderer.initTexture(t);
    mat.uniforms.uMap.value = t;
    rects = json;
    ready = true;
  }).catch(() => { failed = true; });

  /* ---------------- one draw for every word ---------------- */
  const geo = new THREE.PlaneGeometry(1, 1);
  const aRect = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage); // u0 v0 u1 v1
  const aTint = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 4), 4).setUsage(THREE.DynamicDrawUsage); // rgb, alpha
  geo.setAttribute("aRect", aRect);
  geo.setAttribute("aTint", aTint);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: null } },
    transparent: true, depthTest: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      attribute vec4 aRect; attribute vec4 aTint;
      varying vec2 vUv; varying vec4 vTint;
      void main() {
        vUv = mix(aRect.xy, aRect.zw, uv); // words.json rects are in v-up texture space
        vTint = aTint;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D uMap;
      varying vec2 vUv; varying vec4 vTint;
      void main() {
        vec4 t = texture2D(uMap, vUv);
        // an alpha test with a one pixel soft edge: the sticker outline stays crisp at any size, and never shimmers
        float aa = fwidth(t.a) + 1e-4;
        float a = clamp((t.a - 0.5) / aa + 0.5, 0.0, 1.0) * vTint.a;
        if (a < 0.01) discard;
        gl_FragColor = vec4(t.rgb * vTint.rgb, a);
      }`,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.name = "soundWords";
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false; // the matrices move every frame
  mesh.renderOrder = 980; // over the city and the rope, under the reticles (990), the panels (995) and the vignette (999)
  mesh.count = 0;
  mesh.visible = false;
  scene.add(mesh);

  /* ---------------- the words ---------------- */
  // A pool of MAX slots. The live ones sit in slots 0 .. n − 1 (a dead one is swapped out by the last).
  const S = Array.from({ length: MAX }, () => ({ name: "", age: 0, x: 0, y: 0, z: 0, dx: 0, dy: 0, dz: 0, w: 1, h: 1, tilt: 0, r: 1, g: 1, b: 1, pop: 0, alpha: 0, yaw: 0 }));
  let n = 0, spawned = 0, skipped = 0, dropped = 0, seed = 20240611, worldOn = true;
  const made = {}; // words made so far, by name (for the tests)
  const head = new THREE.Vector3();
  let hasHead = false;
  const rnd = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  // scale over the pop: 0 to 1.2 to 1
  function popScale(t) {
    if (t >= POP_END) return 1;
    if (t <= POP_UP) return 1.2 * Math.sin((t / POP_UP) * Math.PI * 0.5);
    return 1.2 - 0.2 * smooth(0, 1, (t - POP_UP) / (POP_END - POP_UP));
  }

  // Writes slot i into the instance arrays. The quad's normal points at the head on the flat plane, so a word stands
  // upright whatever height you look from. The roll is the tilt plus a short wobble after the pop.
  function place(i, s) {
    const m = mesh.instanceMatrix.array, o = i * 16;
    const px = s.x + s.dx * s.age, py = s.y + s.dy * s.age, pz = s.z + s.dz * s.age;
    let nx = head.x - px, nz = head.z - pz;
    const l = Math.sqrt(nx * nx + nz * nz) || 1;
    nx /= l; nz /= l;
    s.yaw = Math.atan2(nx, nz);
    const roll = s.tilt + 0.06 * Math.sin(s.age * 38) * Math.exp(-s.age * 9), c = Math.cos(roll), sn = Math.sin(roll);
    const k = popScale(s.age), sx = s.w * k, sy = s.h * k;
    // columns: right (rolled), up (rolled), normal, position; right = up × normal = (nz, 0, −nx)
    m[o] = nz * c * sx; m[o + 1] = sn * sx; m[o + 2] = -nx * c * sx; m[o + 3] = 0;
    m[o + 4] = -nz * sn * sy; m[o + 5] = c * sy; m[o + 6] = nx * sn * sy; m[o + 7] = 0;
    m[o + 8] = nx; m[o + 9] = 0; m[o + 10] = nz; m[o + 11] = 0;
    m[o + 12] = px; m[o + 13] = py; m[o + 14] = pz; m[o + 15] = 1;
    // it fades from FADE_FROM to LIFE, and also as the head flies into it (the last 0.6 m before NEAR)
    let a = 1 - smooth(FADE_FROM, LIFE, s.age);
    if (hasHead) {
      const dx = px - head.x, dy = py - head.y, dz = pz - head.z;
      a *= smooth(NEAR - FADE_NEAR, NEAR, Math.sqrt(dx * dx + dy * dy + dz * dz));
    }
    s.pop = k; s.alpha = a;
    aTint.array[i * 4 + 3] = a;
  }

  const FX = {
    // word("THWIP", pos, { size, dir, tint, scale }): pos is where its centre goes ({x,y,z} or Vector3).
    //   size: its width in metres. Without it the width is 8 to 12 degrees across at its distance (times scale).
    //   dir: a unit vector. The word starts a little way out along it (so a word on a wall does not sink into it) and drifts.
    //   vel: {x,y,z} in m/s, added to its drift. Pass the player's velocity for a word that must keep pace with you.
    //   tint: a hex number, {r,g,b} (0..1) or [r,g,b], multiplied into the art.
    // Returns true when a word was added. Nothing is added before the art loads, when the name is unknown, or when the
    // centre is closer than 1.2 m to the head.
    word(name, pos, o = {}) {
      if (!ready || !pos) return false;
      const r = rects[name];
      if (!r) return false;
      const aspect = r.aspect || (r.u1 - r.u0) / (r.v1 - r.v0);
      let w;
      if (o.size > 0) w = o.size;
      else {
        const d = hasHead ? Math.hypot(pos.x - head.x, pos.y - head.y, pos.z - head.z) : 4;
        const ang = (ANG[0] + (ANG[1] - ANG[0]) * rnd()) * (Math.PI / 180);
        const sc = o.scale > 0 ? o.scale : 1;
        w = Math.min(2 * d * Math.tan(ang / 2) * sc, W_MAX * sc);
        w = Math.max(w, W_MIN);
      }
      const d = o.dir;
      const dl = d ? Math.hypot(d.x, d.y, d.z) : 0;
      const ux = dl > 1e-6 ? d.x / dl : 0, uy = dl > 1e-6 ? d.y / dl : 0, uz = dl > 1e-6 ? d.z / dl : 0;
      const off = dl > 1e-6 ? 0.3 * w : 0;
      const x = pos.x + ux * off, y = pos.y + uy * off, z = pos.z + uz * off;
      if (hasHead && Math.hypot(x - head.x, y - head.y, z - head.z) < NEAR) { skipped++; return false; }
      // a full pool gives up its oldest word
      let i = n;
      if (n >= MAX) {
        i = 0;
        for (let k = 1; k < n; k++) if (S[k].age > S[i].age) i = k;
        dropped++;
      } else n++;
      const s = S[i];
      s.name = name; s.age = 0;
      s.x = x; s.y = y; s.z = z;
      const v = o.vel;
      s.dx = ux * DRIFT + (v ? v.x : 0); s.dy = uy * DRIFT + (v ? v.y : 0); s.dz = uz * DRIFT + (v ? v.z : 0);
      s.w = w; s.h = w / aspect;
      s.tilt = (rnd() * 2 - 1) * TILT;
      const t = o.tint;
      if (typeof t === "number") { s.r = ((t >> 16) & 255) / 255; s.g = ((t >> 8) & 255) / 255; s.b = (t & 255) / 255; }
      else if (Array.isArray(t)) { s.r = t[0]; s.g = t[1]; s.b = t[2]; }
      else if (t && t.r != null) { s.r = t.r; s.g = t.g; s.b = t.b; }
      else { s.r = s.g = s.b = 1; }
      aRect.array[i * 4] = r.u0; aRect.array[i * 4 + 1] = r.v0; aRect.array[i * 4 + 2] = r.u1; aRect.array[i * 4 + 3] = r.v1;
      aTint.array[i * 4] = s.r; aTint.array[i * 4 + 1] = s.g; aTint.array[i * 4 + 2] = s.b;
      spawned++;
      made[name] = (made[name] || 0) + 1;
      place(i, s);
      mesh.count = n;
      mesh.visible = worldOn;
      mesh.instanceMatrix.needsUpdate = true; aRect.needsUpdate = true; aTint.needsUpdate = true;
      return true;
    },

    // Every frame: the time passed and the head pose (world). Words age, turn to the head and fade; the dead ones leave.
    // headQuat is kept for the API; a word turns about world up toward the head position, so only the position counts.
    update(dt, headPos, headQuat) {
      if (headPos) { head.set(headPos.x, headPos.y, headPos.z); hasHead = true; }
      if (n === 0) return;
      for (let i = 0; i < n;) {
        const s = S[i];
        s.age += dt > 0 ? dt : 0;
        if (s.age >= LIFE) {
          // swap the last live word into this slot (matrix, rect, tint and state)
          const last = n - 1;
          if (i !== last) {
            const L = S[last], m = mesh.instanceMatrix.array;
            for (let k = 0; k < 16; k++) m[i * 16 + k] = m[last * 16 + k];
            for (let k = 0; k < 4; k++) { aRect.array[i * 4 + k] = aRect.array[last * 4 + k]; aTint.array[i * 4 + k] = aTint.array[last * 4 + k]; }
            Object.assign(s, L);
          }
          n--;
          continue; // the word now in slot i has not been aged yet
        }
        place(i, s);
        i++;
      }
      mesh.count = n;
      if (n === 0) mesh.visible = false;
      mesh.instanceMatrix.needsUpdate = true; aRect.needsUpdate = true; aTint.needsUpdate = true;
    },

    clear() {
      n = 0;
      mesh.count = 0;
      mesh.visible = false;
    },

    // The world can be hidden (the AR pause shows passthrough): words go with it.
    setVisible(v) {
      worldOn = !!v;
      mesh.visible = worldOn && n > 0;
    },

    // for the tests and the debug view
    info() {
      const words = [];
      for (let i = 0; i < n; i++) {
        const s = S[i];
        words.push({ name: s.name, x: s.x + s.dx * s.age, y: s.y + s.dy * s.age, z: s.z + s.dz * s.age, w: s.w, h: s.h, age: s.age, alpha: s.alpha, scale: s.pop, tilt: s.tilt, yaw: s.yaw });
      }
      return { live: n, max: MAX, ready, failed, spawned, skipped, dropped, made: { ...made }, words, calls: mesh.visible && n > 0 ? 1 : 0 };
    },
    meshes: { words: mesh },
  };
  return FX;
}
