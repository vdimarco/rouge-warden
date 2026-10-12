import * as THREE from "../vr/lib/three.module.min.js";
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const noise = (n) => {
  const v = Math.sin(n * 91.37 + 17.1) * 41371.7;
  return v - Math.floor(v);
};
const C = {
  green: new THREE.Color("#30b77c"),
  lime: new THREE.Color("#bdff64"),
  cyan: new THREE.Color("#39eaff"),
  gold: new THREE.Color("#ffd574"),
  orange: new THREE.Color("#ff9b54"),
  violet: new THREE.Color("#ac65ff"),
  red: new THREE.Color("#ff5e82"),
  dark: new THREE.Color("#197778"),
  blue: new THREE.Color("#63a5ee"),
};
export function createDepthRenderer(parent, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: "high-performance",
    }),
    canvas = renderer.domElement;
  canvas.style.cssText =
    "width:100%;height:100%;display:block;touch-action:none";
  canvas.dataset.renderer = "three-luminous-dots";
  canvas.dataset.engine = "three";
  parent.appendChild(canvas);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0x020d1a);
  const gl = renderer.getContext(),
    ext = gl.getExtension("WEBGL_debug_renderer_info"),
    device = String(
      gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
    ),
    software = /swiftshader|llvmpipe|software/i.test(device);
  canvas.dataset.backend = software ? "software" : "hardware";
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(55, 1, 0.2, 500),
    raycaster = new THREE.Raycaster(),
    plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    hit = new THREE.Vector3();
  let width = 1,
    height = 1,
    region = "",
    lastTime = 0,
    cover = [],
    detail = 1;
  const shader = {
    vertexShader: `attribute vec3 tint;attribute float size;attribute float flow;uniform float clock;uniform float pixelScale;varying vec3 colour;varying float depth;void main(){vec3 p=position;if(flow>0.){p.x+=sin(clock*.17+p.z*.06)*flow;p.y+=sin(clock*.4+p.x*.06)*flow*.15;}vec4 v=modelViewMatrix*vec4(p,1.);depth=-v.z;colour=tint;gl_Position=projectionMatrix*v;float breath=flow>0.?1.+sin(clock*.55+p.z*.05)*.12:1.;gl_PointSize=clamp(size*breath*pixelScale/max(1.,depth),1.2,9.);}`,
    fragmentShader: `varying vec3 colour;varying float depth;void main(){vec2 q=gl_PointCoord-.5;float r=length(q);if(r>.5)discard;float core=1.-smoothstep(.19,.34,r);float halo=(1.-smoothstep(.29,.5,r))*.25;float fog=exp(-depth*.0022);gl_FragColor=vec4(pow(colour,vec3(.48))*(.6+core*.9)*fog,core*.85+halo);}`,
  };
  function batch(max, dynamic = false) {
    const geometry = new THREE.BufferGeometry(),
      position = new Float32Array(max * 3),
      tint = new Float32Array(max * 3),
      size = new Float32Array(max),
      flow = new Float32Array(max);
    for (const [key, array, item] of [
      ["position", position, 3],
      ["tint", tint, 3],
      ["size", size, 1],
      ["flow", flow, 1],
    ]) {
      const a = new THREE.BufferAttribute(array, item);
      if (dynamic) a.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute(key, a);
    }
    const material = new THREE.ShaderMaterial({
      ...shader,
      uniforms: { clock: { value: 0 }, pixelScale: { value: 500 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    scene.add(points);
    let count = 0,
      dropped = 0;
    return {
      points,
      geometry,
      material,
      get count() {
        return count;
      },
      get dropped() {
        return dropped;
      },
      reset() {
        count = 0;
        dropped = 0;
      },
      add(x, y, z, color, diameter = 0.32, motion = 0, brightness = 1) {
        if (count >= max) {
          dropped++;
          return;
        }
        const i = count * 3;
        position[i] = x;
        position[i + 1] = y;
        position[i + 2] = z;
        tint[i] = color.r * brightness;
        tint[i + 1] = color.g * brightness;
        tint[i + 2] = color.b * brightness;
        size[count] = diameter;
        flow[count++] = motion;
      },
      flush() {
        geometry.setDrawRange(0, count);
        for (const key of ["position", "tint", "size", "flow"])
          geometry.attributes[key].needsUpdate = true;
      },
    };
  }
  const landscape = batch(12500),
    actors = batch(7000, true),
    atmosphere = batch(500, true);
  function ring(b, x, y, z, r, color, diam = 0.38, n = 64) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      b.add(x + Math.cos(a) * r, y, z + Math.sin(a) * r, color, diam);
    }
  }
  function line(b, from, to, color, diam = 0.35, spacing = 0.6) {
    const dx = to[0] - from[0],
      dy = to[1] - from[1],
      dz = to[2] - from[2],
      steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / spacing));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      b.add(from[0] + dx * t, from[1] + dy * t, from[2] + dz * t, color, diam);
    }
  }
  function world(s) {
    region = s.region || "forest";
    landscape.reset();
    const forest = region === "forest",
      desert = region === "desert";
    // An irregular luminous ground grid makes open fighting lanes legible.
    for (let z = -48; z <= 48; z += 3)
      for (let x = -106; x <= 106; x += 3) {
        const n = noise(x * 23 + z * 31),
          wave = Math.sin(x * 0.055 + z * 0.11);
        landscape.add(
          x + n * 0.7,
          0.03 + Math.max(0, wave) * 0.1,
          z,
          desert ? C.orange : n > 0.88 ? C.lime : C.green,
          n > 0.9 ? 0.72 : 0.48,
          0,
          n > 0.86 ? 1 : 0.4,
        );
      }
    // Three flowing dotted mist rivers cross different depth planes.
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 320; i++) {
        const x = -120 + (i / 320) * 240,
          z = -55 + j * 30 + Math.sin(x * 0.045 + j) * 7;
        landscape.add(
          x,
          0.4 + noise(i + j * 89) * 3,
          z + (noise(i * 7) * 2 - 1) * 4,
          C.cyan,
          0.65 + noise(i) * 1.3,
          1.8,
          0.5 + noise(i + 67) * 0.6,
        );
      }
    if (forest) {
      for (let i = 0; i < 40; i++) {
        let x = noise(i + 91) * 240 - 120,
          z = noise(i + 421) * 100 - 85;
        if (z > -36 && Math.abs(x) < 96)
          x = Math.sign(x || 1) * (102 + noise(i) * 15);
        const h = 9 + noise(i + 88) * 21;
        for (let k = 0; k < 12; k++) {
          const y = (h * (k + 1)) / 13,
            r = (1 - y / h) * h * 0.3;
          for (let j = 0; j < 10; j++) {
            const a = (j / 10) * Math.PI * 2 + noise(i + k);
            const edge = j < 3;
            landscape.add(
              x + Math.cos(a) * r,
              y,
              z + Math.sin(a) * r,
              edge ? C.cyan : k % 3 === 0 ? C.lime : C.green,
              0.48 + noise(j + i) * 0.3,
              0,
              edge ? 1 : 0.45 + noise(k + i) * 0.55,
            );
          }
        }
        line(landscape, [x, 0, z], [x, h, z], C.dark, 0.28, 1);
      }
    } else if (region === "city") {
      for (let i = 0; i < 22; i++) {
        const x = -117 + i * 11,
          z = -55 - noise(i) * 25,
          h = 12 + noise(i + 1) * 27;
        for (let y = 0; y < h; y += 1.6)
          for (let w = -3; w <= 3; w += 1.5) {
            landscape.add(x + w, y, z, C.blue, 0.36, 0, 0.45);
            if (noise(i + y + w) > 0.55)
              landscape.add(x + w, y, z + 0.3, C.gold, 0.42, 0, 0.7);
          }
        line(landscape, [x - 4, h, z], [x + 4, h, z], C.cyan, 0.5);
      }
    } else {
      for (let j = 0; j < 7; j++)
        for (let i = 0; i < 230; i++) {
          const x = -130 + (i / 230) * 260,
            z = -55 - j * 7,
            y = 3 + j * 1.4 + Math.sin(x * 0.035 + j) * 4;
          landscape.add(
            x,
            y,
            z,
            desert ? C.orange : C.blue,
            0.4,
            0,
            0.3 + j * 0.04,
          );
        }
    }
    for (let i = 0; i < 700; i++) {
      landscape.add(
        noise(i + 781) * 330 - 165,
        38 + noise(i + 321) * 110,
        -80 - noise(i + 12) * 120,
        i % 5 ? C.blue : C.gold,
        0.55,
        0,
        0.9,
      );
    }

    // Stippled dawn and aurora span the horizon without a flat sky image.
    for (let i = 0; i < 1100; i++) {
      const x = -190 + noise(i + 993) * 380,
        y = 28 + Math.sin(x * 0.018) * 8 + noise(i + 284) * 22,
        z = -135 - noise(i + 902) * 22;
      landscape.add(
        x,
        y,
        z,
        noise(i) > 0.64 ? C.gold : C.blue,
        0.65 + noise(i + 51) * 1.1,
        1,
        0.45 + noise(i + 13) * 0.55,
      );
    }
    // Large curling fern fronds frame the foreground; the combat lanes stay open.
    for (let i = 0; i < 18; i++) {
      const x = (i % 2 ? 1 : -1) * (105 + noise(i) * 9),
        z = -30 + noise(i + 981) * 82;
      for (let fr = 0; fr < 4; fr++) {
        const a = (fr / 4) * Math.PI * 2;
        for (let k = 0; k < 10; k++) {
          const q = k / 10,
            r = q * 7;
          landscape.add(
            x + Math.cos(a) * r,
            Math.sin(q * Math.PI) * 5,
            z + Math.sin(a) * r,
            fr % 2 ? C.lime : C.cyan,
            0.55,
            0,
            0.7,
          );
        }
      }
    }
    landscape.flush();
  }
  function box(
    b,
    cx,
    cy,
    cz,
    w,
    h,
    d,
    color,
    yaw = 0,
    step = 0.7,
    brightness = 1,
  ) {
    const co = Math.cos(yaw),
      si = Math.sin(yaw);
    function p(x, y, z) {
      b.add(
        cx + x * co - z * si,
        cy + y,
        cz + x * si + z * co,
        color,
        0.35,
        0,
        brightness,
      );
    }
    for (let x = -w / 2; x <= w / 2 + 0.01; x += step)
      for (let z = -d / 2; z <= d / 2 + 0.01; z += step) p(x, h / 2, z);
    for (let y = -h / 2; y <= h / 2 + 0.01; y += step) {
      for (let x = -w / 2; x <= w / 2 + 0.01; x += step) {
        p(x, y, -d / 2);
        p(x, y, d / 2);
      }
      for (let z = -d / 2; z <= d / 2 + 0.01; z += step) {
        p(-w / 2, y, z);
        p(w / 2, y, z);
      }
    }
  }
  function tank(a, player = false, wreck = false) {
    const x = a.x - 100,
      z = a.y - 50,
      hull = a.hullAngle ?? a.angle ?? 0,
      turret = a.turretAngle ?? hull,
      role = a.type || a.role,
      color = wreck
        ? C.dark
        : player
          ? C.gold
          : role === "bruiser"
            ? C.violet
            : C.red,
      wide = role === "bruiser" ? 1.3 : role === "scout" ? 0.8 : 1,
      hot = player && (a.charge >= 100 || a.weaponBoost > 0);
    box(
      actors,
      x,
      1.5,
      z,
      6.3 * wide,
      1.8,
      4.1 * wide,
      color,
      hull,
      wreck ? 1.35 : player ? 0.7 : 0.9 * detail,
      wreck ? 0.3 : 1,
    );
    if (role === "bruiser" && !wreck)
      box(actors, x, 2.6, z, 7, 0.6, 5, color, hull, detail, 0.9);
    for (const side of [-1, 1]) {
      const ox = -Math.sin(hull) * side * 2.45 * wide,
        oz = Math.cos(hull) * side * 2.45 * wide;
      box(
        actors,
        x + ox,
        0.8,
        z + oz,
        7.3 * wide,
        1.35,
        0.8,
        player ? C.cyan : C.orange,
        hull,
        wreck ? 1.3 : player ? 0.65 : 0.85 * detail,
        wreck ? 0.2 : 0.7,
      );
      for (let i = -3; i <= 3; i++) {
        const ax = Math.cos(hull) * i + ox,
          az = Math.sin(hull) * i + oz;
        actors.add(x + ax, 0.3, z + az, player ? C.cyan : C.red, 0.48);
      }
    }
    if (wreck) return;
    ring(actors, x, 2.8, z, 1.7, color, 0.4, 24);
    for (let y = 2; y <= 3.3; y += 0.5)
      ring(actors, x, y, z, 1.65, color, 0.32, 20);
    const co = Math.cos(turret),
      si = Math.sin(turret);
    for (const side of role === "scatter" ? [-0.65, 0.65] : [0])
      for (let l = 0; l < (role === "scout" ? 7.5 : 6); l += 0.35) {
        actors.add(
          x + co * l - si * side,
          3,
          z + si * l + co * side,
          player ? C.cyan : C.orange,
          hot ? 0.8 : role === "scout" ? 0.4 : 0.55,
        );
        actors.add(
          x + co * l - si * side,
          3.35,
          z + si * l + co * side,
          color,
          hot ? 0.65 : 0.4,
        );
      }
    if (!player) {
      for (let i = 0; i < Math.min(4, a.hp || 0); i++)
        actors.add(x + (i - 1.5) * 0.8, 4.7, z, C.gold, 0.65);
    }
    if (player) {
      ring(actors, x, 0.15, z, 5, C.cyan, 0.3, 60);
      if (a.charge > 65)
        ring(
          actors,
          x,
          0.3,
          z,
          5.7,
          a.charge >= 100 ? C.lime : C.cyan,
          0.48,
          70,
        );
    }
  }
  const diagnostics = {
    type: "PerspectiveCamera",
    geometry: "luminous 3D point clouds",
    software,
    device,
    pointObjects: 3,
    solidGeometry: 0,
    points: 0,
    camera: [],
    calls: 3,
  };
  function render(s, time = 0) {
    const start = performance.now();
    if (region !== (s.region || "forest")) world(s);
    const t = reducedMotion ? 0 : time;
    actors.reset();
    atmosphere.reset();
    for (const p of s.projectiles || []) {
      const color = p.owner !== "player" ? C.red : p.charged ? C.lime : C.cyan,
        x = p.x - 100,
        z = p.y - 50,
        length = Math.hypot(p.vx, p.vy) || 1;
      line(
        actors,
        [x - (p.vx / length) * 4, 2.4, z - (p.vy / length) * 4],
        [x, 2.4, z],
        color,
        p.charged ? 0.75 : 0.6,
        0.3,
      );
    }
    for (const a of [...(s.enemies || []), ...(s.relays || [])])
      if (a.hp > 0 && a.warning > 0) {
        const x = a.x - 100,
          z = a.y - 50,
          angle = a.turretAngle || 0,
          tx = Number.isFinite(a.aimX)
            ? a.aimX - 100
            : x + Math.cos(angle) * 30,
          tz = Number.isFinite(a.aimY) ? a.aimY - 50 : z + Math.sin(angle) * 30;
        line(actors, [x, 0.2, z], [tx, 0.2, tz], C.red, 0.45, 0.8);
        ring(actors, tx, 0.2, tz, 3.5, C.red, 0.45, 40);
      }
    for (const e of s.effects || []) {
      ring(
        actors,
        e.x - 100,
        0.4,
        e.y - 50,
        e.r || 3,
        e.kind === "impact" ? C.orange : C.cyan,
        0.6,
        45,
      );
    }
    for (const e of s.restorations || []) {
      const radius =
        (e.r || 12) *
        (reducedMotion ? 1 : Math.max(0.18, 1 - (e.life || 0) / 1.2));
      ring(actors, e.x - 100, 0.12, e.y - 50, radius, C.lime, 0.6, 90);
    }
    detail = actors.count > 1500 ? 1.65 : 1;
    tank(s, true);
    for (const e of s.enemies || []) if (e.hp > 0) tank(e);
    for (const r of s.relays || []) {
      if (r.hp <= 0) {
        ring(actors, r.x - 100, 0.12, r.y - 50, 9, C.lime, 0.45, 65);
        for (let i = 0; i < 70; i++) {
          const a = i * 2.4,
            d = noise(i) * 9;
          actors.add(
            r.x - 100 + Math.cos(a) * d,
            0.2 + noise(i + 61),
            r.y - 50 + Math.sin(a) * d,
            i % 4 ? C.lime : C.gold,
            0.4,
          );
        }
        continue;
      }
      tank({
        ...r,
        angle: 0,
        turretAngle: r.turretAngle || 0,
        type: "bruiser",
      });
      ring(actors, r.x - 100, 0.3, r.y - 50, 5, C.violet, 0.5);
    }
    cover = (s.cover || []).filter((c) => c.hp > 0);
    for (const c of cover) {
      box(
        actors,
        c.x - 100,
        2,
        c.y - 50,
        c.w,
        4,
        c.h,
        C.blue,
        0,
        1.4 * detail,
        c.hp < 2 ? 0.35 : 0.65,
      );
      for (let y = 0.8; y < 4; y += 1.2)
        line(
          actors,
          [c.x - 100 - c.w / 2, y, c.y - 50 + c.h / 2],
          [c.x - 100 + c.w / 2, y, c.y - 50 + c.h / 2],
          C.cyan,
          0.4,
          1.3,
        );
    }
    for (const p of s.pickups || []) {
      if (p.used) continue;
      const x = p.x - 100,
        z = p.y - 50;
      line(actors, [x - 1, 1.8, z], [x + 1, 1.8, z], C.lime, 0.6, 0.35);
      line(actors, [x, 1.8, z - 1], [x, 1.8, z + 1], C.lime, 0.6, 0.35);
      ring(actors, x, 0.15, z, 2, C.lime, 0.3, 24);
    }
    const b = s.beacon || { x: 178, y: 83 };
    for (let j = 0; j < 3; j++)
      ring(
        actors,
        b.x - 100,
        0.2 + j * 0.35,
        b.y - 50,
        (b.r || 9) + j,
        s.relays?.some((r) => r.hp > 0) ? C.dark : C.lime,
        0.4,
        85,
      );
    const essentialDropped = actors.dropped;
    for (const w of s.wrecks || []) tank(w, false, true);
    for (const e of s.restorations || []) {
      const radius = e.r || 12;
      for (let i = 0; i < 50; i++) {
        const a = i * 2.4,
          r = noise(i) * radius;
        actors.add(
          e.x - 100 + Math.cos(a) * r,
          0.6,
          e.y - 50 + Math.sin(a) * r,
          C.lime,
          0.48,
        );
      }
    }
    for (const smoke of s.smoke || [])
      for (let i = 0; i < 130; i++) {
        const a = i * 2.4,
          r = noise(i) * smoke.r;
        atmosphere.add(
          smoke.x - 100 + Math.cos(a) * r,
          1 + noise(i + 89) * 4,
          smoke.y - 50 + Math.sin(a) * r,
          C.blue,
          0.7,
          1,
          0.24,
        );
      }
    actors.flush();
    atmosphere.flush();
    const portrait = width / height < 0.8,
      x = s.x - 100,
      z = s.y - 50;
    camera.position.set(
      x * 0.88,
      portrait ? 82 : 48,
      z * 0.7 + (portrait ? 105 : 72),
    );
    camera.lookAt(x * 0.88, 3, z * 0.7 - 17);
    camera.updateMatrixWorld();
    for (const batch of [landscape, actors, atmosphere]) {
      batch.material.uniforms.clock.value = t;
      batch.material.uniforms.pixelScale.value =
        canvas.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    }
    renderer.render(scene, camera);
    diagnostics.points = landscape.count + actors.count + atmosphere.count;
    diagnostics.staticPoints = landscape.count;
    diagnostics.actorPoints = actors.count;
    diagnostics.droppedPoints =
      landscape.dropped + actors.dropped + atmosphere.dropped;
    diagnostics.actorDroppedPoints = actors.dropped;
    diagnostics.essentialDroppedPoints = essentialDropped;
    diagnostics.actorDetail = detail;
    diagnostics.camera = camera.position.toArray();
    diagnostics.calls = renderer.info.render.calls;
    diagnostics.renderMs = performance.now() - start;
    diagnostics.resolution = [canvas.width, canvas.height];
    canvas.dataset.renderMs = diagnostics.renderMs.toFixed(2);
    canvas.dataset.points = String(diagnostics.points);
    canvas.dataset.droppedPoints = String(diagnostics.droppedPoints);
    canvas.dataset.region = region;
    canvas.dataset.depth = "perspective";
    diagnostics.maxPoints = 20000;
    lastTime = time;
  }
  function resize(
    w = parent.clientWidth || 960,
    h = parent.clientHeight || 600,
  ) {
    width = w;
    height = h;
    const max = software ? 640 : 960,
      factor = Math.min(1, max / w, max / h);
    renderer.setSize(Math.round(w * factor), Math.round(h * factor), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function aim(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return { x: clamp(hit.x + 100, 0, 200), y: clamp(hit.z + 50, 0, 100) };
  }
  function project(x, y, elevation = 2) {
    const p = new THREE.Vector3(x - 100, elevation, y - 50),
      distance = camera.position.distanceTo(p);
    p.project(camera);
    return {
      x: ((p.x + 1) * width) / 2,
      y: ((1 - p.y) * height) / 2,
      depth: p.z,
      visible: p.z > -1 && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1,
      size: height / (2 * Math.tan((camera.fov * Math.PI) / 360) * distance),
      distance,
    };
  }
  function isOccluded(x, y, elevation = 2) {
    const dest = new THREE.Vector3(x - 100, elevation, y - 50),
      length = camera.position.distanceTo(dest),
      ray = new THREE.Ray(
        camera.position,
        dest.sub(camera.position).normalize(),
      );
    return cover.some((c) => {
      const box = new THREE.Box3(
        new THREE.Vector3(c.x - 100 - c.w / 2, 0, c.y - 50 - c.h / 2),
        new THREE.Vector3(c.x - 100 + c.w / 2, 4, c.y - 50 + c.h / 2),
      );
      const p = ray.intersectBox(box, new THREE.Vector3());
      return p && p.distanceTo(camera.position) < length - 0.2;
    });
  }
  resize();
  return {
    canvas,
    render,
    resize,
    aim,
    project,
    isOccluded,
    diagnostics,
    setReducedMotion(value) {
      reducedMotion = Boolean(value);
    },
    dispose() {
      for (const b of [landscape, actors, atmosphere]) {
        b.geometry.dispose();
        b.material.dispose();
      }
      renderer.dispose();
      canvas.remove();
    },
  };
}
export const createDotRenderer = createDepthRenderer;
