import * as THREE from "../vr/lib/three.module.min.js";

const PALETTES = {
  forest: [0x05281f, 0x14864c, 0x14eaca],
  city: [0x081f29, 0x176272, 0x10d8eb],
  coast: [0x063638, 0x167b72, 0x27eee2],
  fjord: [0x102f43, 0x4187a2, 0x6cecff],
  desert: [0x372b24, 0xa37a43, 0x48ded8],
  moon: [0x172138, 0x555c88, 0x9ac4ff],
};
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export function createDepthRenderer(parent, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  const canvas = renderer.domElement;
  canvas.dataset.renderer = "three-perspective";
  canvas.dataset.engine = "three";
  canvas.style.cssText =
    "display:block;width:100%;height:100%;touch-action:none";
  parent.appendChild(canvas);
  const gl = renderer.getContext(),
    debug = gl.getExtension("WEBGL_debug_renderer_info"),
    device = debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER));
  const software = /swiftshader|llvmpipe|software/i.test(device);
  canvas.dataset.backend = software ? "software" : "hardware";
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(57, 1, 0.2, 420);
  scene.background = new THREE.Color(0x03241f);
  scene.fog = new THREE.FogExp2(0x075a4b, 0.009);
  scene.add(new THREE.HemisphereLight(0x57ceb4, 0x071a18, 1.1));
  const sun = new THREE.DirectionalLight(0xffd27a, 2.8);
  sun.position.set(-30, 70, -30);
  scene.add(sun);
  const rimLight = new THREE.DirectionalLight(0x16e5d1, 1.6);
  rimLight.position.set(0, 15, -70);
  scene.add(rimLight);
  const mat = (color, emissive = 0) =>
    new THREE.MeshLambertMaterial({ color, emissive, emissiveIntensity: 1.5 });
  const emerald = mat(0x82bca0, 0x073b25),
    trunkMat = mat(0x163e30),
    gold = new THREE.MeshBasicMaterial({ color: 0xffb43b, fog: false }),
    cyan = new THREE.MeshBasicMaterial({ color: 0x22f4dc }),
    violet = mat(0x713caa, 0x230d41),
    dark = mat(0x0b1728),
    skin = mat(0xffb985),
    cream = mat(0xffe3a1, 0x5a3714);
  const enemyArmor = mat(0xcb5251, 0x441217),
    playerArmor = mat(0x8eae75, 0x122410),
    turretArmor = mat(0x8a9f7b, 0x182f2a),
    coverArmor = mat(0xb2b9a3, 0x162a22);
  const smokeMaterial = new THREE.MeshBasicMaterial({
    color: 0x86b9b4,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  });
  const geo = {
    box: new THREE.BoxGeometry(1, 1, 1),
    sphere: new THREE.IcosahedronGeometry(1, 0),
    cone: new THREE.ConeGeometry(1, 1, 7),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
    ring: new THREE.TorusGeometry(1, 0.045, 5, 64),
  };
  const mesh = (g, m, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    return o;
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(350, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {},
      vertexShader:
        "varying vec3 v;void main(){v=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying vec3 v;void main(){float a=clamp(normalize(v).y*.8+.2,0.,1.);gl_FragColor=vec4(mix(vec3(.018,.23,.29),vec3(.012,.025,.09),a),1.);}",
    }),
  );
  scene.add(sky);
  const terrain = new THREE.Group();
  scene.add(terrain);
  let region = "",
    mode = "",
    width = 1,
    height = 1,
    lastStage = "",
    stageTime = 0,
    previousTime = 0;
  const ground = mesh(geo.box, mat(0x063f32), 0, -1, 0, 240, 2, 170);
  terrain.add(ground);
  const beacon = new THREE.Group();
  scene.add(beacon);
  beacon.add(
    mesh(geo.cylinder, gold, 0, 9, 0, 2.5, 18, 2.5),
    mesh(geo.box, gold, 0, 2, 0, 8, 4, 8),
    mesh(geo.cone, cream, 0, 20, 0, 4, 6, 4),
  );
  const crown = mesh(
    geo.sphere,
    new THREE.MeshBasicMaterial({ color: 0xfff0a0, fog: false }),
    0,
    23,
    0,
    2,
  );
  beacon.add(crown);
  const beaconLight = new THREE.PointLight(0xffc45b, 100, 80, 1.4);
  beaconLight.position.y = 20;
  beacon.add(beaconLight);
  const ring = mesh(geo.ring, cyan, 0, 0.15, 0, 10, 10, 10);
  ring.rotation.x = -Math.PI / 2;
  beacon.add(ring);
  const glowCanvas = document.createElement("canvas");
  glowCanvas.width = glowCanvas.height = 64;
  const gc = glowCanvas.getContext("2d"),
    gg = gc.createRadialGradient(32, 32, 0, 32, 32, 32);
  gg.addColorStop(0, "rgba(255,242,153,1)");
  gg.addColorStop(0.15, "rgba(255,190,47,.7)");
  gg.addColorStop(1, "rgba(255,140,10,0)");
  gc.fillStyle = gg;
  gc.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const star = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffd45a,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  star.position.y = 23;
  star.scale.set(35, 35, 1);
  beacon.add(star);
  const rayMat = new THREE.MeshBasicMaterial({
    color: 0xffbd39,
    fog: false,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const rays = [];
  for (let i = 0; i < 7; i++) {
    const ray = mesh(
      new THREE.ConeGeometry(0.8, 105, 8, 1, true),
      rayMat.clone(),
      0,
      0,
      0,
    );
    ray.geometry.translate(0, -52.5, 0);
    ray.position.y = 23;
    ray.rotation.z = (i - 3) * 0.4;
    ray.rotation.x = 0.6 + (i % 2) * 0.2;
    beacon.add(ray);
    rays.push(ray);
  }
  const restoredRing = mesh(geo.ring, mat(0xbcff87, 0x70be30), 0, 0.3, 0, 1);
  restoredRing.rotation.x = -Math.PI / 2;
  scene.add(restoredRing);
  const pools = new Map();
  const mist = new THREE.Group();
  scene.add(mist);
  const mistTexture = (() => {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 32;
    const q = c.getContext("2d"),
      g = q.createRadialGradient(64, 16, 0, 64, 16, 66);
    g.addColorStop(0, "rgba(34,255,220,.38)");
    g.addColorStop(0.4, "rgba(23,220,202,.1)");
    g.addColorStop(1, "rgba(0,170,180,0)");
    q.fillStyle = g;
    q.fillRect(0, 0, 128, 32);
    return new THREE.CanvasTexture(c);
  })();
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(
      new THREE.PlaneGeometry(190, 26),
      new THREE.MeshBasicMaterial({
        map: mistTexture,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    p.rotation.x = -Math.PI / 2;
    p.position.set(((i % 3) - 1) * 20, 1 + (i % 4) * 2, -50 + i * 40);
    mist.add(p);
  }
  const particles = new THREE.BufferGeometry();
  const ps = new Float32Array(1800);
  for (let i = 0; i < 600; i++) {
    ps[i * 3] = (Math.sin(i * 73.1) * 0.5 + 0.5) * 220 - 110;
    ps[i * 3 + 1] = (Math.sin(i * 21.1) * 0.5 + 0.5) * 30;
    ps[i * 3 + 2] = (Math.sin(i * 41.7) * 0.5 + 0.5) * 140 - 80;
  }
  particles.setAttribute("position", new THREE.BufferAttribute(ps, 3));
  const dust = new THREE.Points(
    particles,
    new THREE.PointsMaterial({
      color: 0x83ffc7,
      size: 0.22,
      transparent: true,
      opacity: 0.65,
      sizeAttenuation: true,
    }),
  );
  scene.add(dust);
  const starPositions = [];
  for (let i = 0; i < 450; i++) {
    starPositions.push(
      Math.sin(i * 92.3) * 230,
      40 + (Math.sin(i * 21.4) * 0.5 + 0.5) * 140,
      -90 - (Math.sin(i * 43.4) * 0.5 + 0.5) * 100,
    );
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPositions, 3),
  );
  scene.add(
    new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({
        color: 0x97dfff,
        size: 0.35,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.7,
        fog: false,
      }),
    ),
  );
  const rand = (n) => {
    const a = Math.sin(n * 127.1 + 19.7) * 43758.5453;
    return a - Math.floor(a);
  };
  function rebuild(s) {
    region = s.region || "forest";
    mode = s.mode || "action";
    while (terrain.children.length > 1) {
      const o = terrain.children.pop();
      o.parent = null;
      release(o);
    }
    const pal = PALETTES[region] || PALETTES.forest;
    ground.material.color.setHex(mode === "tanks" ? 0x253829 : pal[0]);
    scene.background.setHex(pal[0]);
    scene.fog.color.setHex(pal[0]);
    if (mode !== "tanks" && region === "forest") {
      const count = 120,
        trees = new THREE.InstancedMesh(
          new THREE.ConeGeometry(1, 1, 7),
          emerald,
          count * 3,
        ),
        trunks = new THREE.InstancedMesh(geo.cylinder, trunkMat, count),
        dummy = new THREE.Object3D(),
        leafDots = [];
      for (let i = 0; i < count; i++) {
        let x = rand(i + 2) * 220 - 110,
          z = rand(i + 401) * 150 - 85;
        if (Math.abs(x) < 22 && z > -25) x += x < 0 ? -32 : 32;
        if (z > 5 && Math.abs(x) < 70) z -= 65;
        const h = 7 + rand(i + 71) * 20;
        dummy.position.set(x, h * 0.2, z);
        dummy.scale.set(0.8, h * 0.4, 0.8);
        dummy.updateMatrix();
        trunks.setMatrixAt(i, dummy.matrix);
        for (let k = 0; k < 3; k++) {
          dummy.position.set(x, h * (0.35 + k * 0.23), z);
          dummy.scale.set(
            h * (0.25 - k * 0.055),
            h * 0.55,
            h * (0.25 - k * 0.055),
          );
          dummy.updateMatrix();
          trees.setMatrixAt(i * 3 + k, dummy.matrix);
          trees.setColorAt(
            i * 3 + k,
            new THREE.Color().setHSL(
              0.4 + rand(i) * 0.07,
              0.7,
              0.16 + rand(i + 72) * 0.17,
            ),
          );
          for (let n = 0; n < 6; n++) {
            const angle = (n / 6) * Math.PI * 2;
            const r = h * (0.25 - k * 0.055) * 0.96;
            leafDots.push(
              x + Math.cos(angle) * r,
              h * (0.075 + k * 0.23) + rand(n + i) * 0.4,
              z + Math.sin(angle) * r,
            );
          }
        }
      }
      const leafGeo = new THREE.BufferGeometry();
      leafGeo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(leafDots, 3),
      );
      const leaves = new THREE.Points(
        leafGeo,
        new THREE.PointsMaterial({
          color: 0x23ffc6,
          size: 0.44,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.84,
        }),
      );
      terrain.add(trunks, trees, leaves);
    } else if (mode !== "tanks") {
      const props = new THREE.InstancedMesh(
          region === "city" ? geo.box : geo.cone,
          mat(pal[1]),
          65,
        ),
        q = new THREE.Object3D();
      for (let i = 0; i < 65; i++) {
        const x = rand(i + 21) * 230 - 115,
          z = rand(i + 821) * 140 - 85;
        const h = region === "city" ? 8 + rand(i) * 30 : 2 + rand(i) * 9;
        q.position.set(x, h / 2, z);
        q.scale.set(4 + rand(i + 11) * 5, h, 4 + rand(i + 12) * 5);
        if (Math.abs(x) < 22 && z > -20) q.scale.setScalar(0);
        q.updateMatrix();
        props.setMatrixAt(i, q.matrix);
      }
      terrain.add(props);
    }
    const path = new THREE.Mesh(
      new THREE.PlaneGeometry(13, 120),
      new THREE.MeshStandardMaterial({
        color: mode === "tanks" ? 0x586147 : 0x20755d,
        roughness: 1,
      }),
    );
    path.rotation.x = -Math.PI / 2;
    path.position.set(0, 0.03, 15);
    terrain.add(path);
    for (let j = 0; j < 8; j++) {
      const ridge = mesh(
        geo.cone,
        mat(0x124047),
        -115 + j * 34,
        9,
        -90 - rand(j) * 20,
        30,
        18 + rand(j) * 12,
        16,
      );
      terrain.add(ridge);
    }
    if (mode !== "tanks") {
      for (let j = 0; j < 3; j++) {
        const points = [];
        for (let i = 0; i < 24; i++)
          points.push(
            new THREE.Vector3(
              -115 + i * 10,
              0.1,
              Math.sin(i * 0.31 + j * 2) * 9 - 30 + j * 35,
            ),
          );
        terrain.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3(points),
              70,
              1.1 + j * 0.35,
              5,
              false,
            ),
            cyan,
          ),
        );
      }
    }
    const rocks = new THREE.InstancedMesh(geo.sphere, mat(pal[1]), 80),
      rockTransform = new THREE.Object3D();
    for (let i = 0; i < 80; i++) {
      rockTransform.position.set(
        rand(i + 721) * 200 - 100,
        0.6,
        rand(i + 1721) * 100 - 30,
      );
      rockTransform.scale.set(0.5 + rand(i) * 1.5, 0.6, 0.8);
      rockTransform.updateMatrix();
      rocks.setMatrixAt(i, rockTransform.matrix);
    }
    terrain.add(rocks);
  }
  function person() {
    const g = new THREE.Group();
    g.add(
      mesh(geo.cone, gold, 0, 2, 0, 1.6, 3.5, 1.6),
      mesh(geo.sphere, gold, 0, 4.1, 0, 1.05),
      mesh(geo.sphere, dark, 0, 4.15, 0.78, 0.67, 0.58, 0.3),
    );
    const legs = [];
    for (const x of [-0.55, 0.55]) {
      const l = mesh(geo.box, trunkMat, x, 0.45, 0, 0.45, 1.1, 0.5);
      g.add(l);
      legs.push(l);
    }
    for (const x of [-1.15, 1.15]) {
      const arm = mesh(geo.cylinder, cream, x, 2.5, 0.25, 0.25, 1.4, 0.25);
      arm.rotation.z = x * 0.2;
      g.add(arm);
    }
    const pack = mesh(geo.box, trunkMat, 0, 2.6, -1, 1.1, 1.5, 0.8);
    g.add(pack, mesh(geo.box, cyan, 1.15, 2.8, 0.8, 0.4, 0.4, 2));
    g.userData.legs = legs;
    return g;
  }
  function cover() {
    const o = mesh(geo.box, coverArmor);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo.box),
      new THREE.LineBasicMaterial({ color: 0x80c4aa }),
    );
    o.add(edges);
    return o;
  }
  function tank() {
    const g = new THREE.Group();
    g.add(mesh(geo.box, playerArmor, 0, 1.2, 0, 5.8, 1.8, 3.9));
    for (const z of [-2.3, 2.3]) {
      g.add(mesh(geo.box, dark, 0, 0.7, z, 6.8, 1.5, 1.1));
      g.add(mesh(geo.box, cyan, 0, 1.35, z, 6.1, 0.12, 0.12));
    }
    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(5.8, 1.8, 3.9)),
      new THREE.LineBasicMaterial({ color: 0x4affd5 }),
    );
    edge.position.y = 1.2;
    g.add(edge);
    const turret = new THREE.Group();
    turret.position.y = 2.4;
    turret.add(mesh(geo.cylinder, turretArmor, 0, 0, 0, 1.8, 1.3, 1.8));
    const barrel = mesh(geo.cylinder, cream, 3, 0.3, 0, 0.22, 5, 0.22);
    barrel.rotation.z = Math.PI / 2;
    turret.add(barrel);
    g.add(turret);
    g.userData.turret = turret;
    return g;
  }
  function enemy() {
    const g = new THREE.Group();
    g.add(
      mesh(geo.sphere, violet, 0, 3, 0, 1.4, 2, 1),
      mesh(geo.sphere, cyan, -0.55, 3.6, 1, 0.2),
      mesh(geo.sphere, cyan, 0.55, 3.6, 1, 0.2),
    );
    const wings = [];
    for (const d of [-1, 1]) {
      const wing = mesh(geo.cone, violet, d * 2.6, 3.5, 0, 2.8, 5, 0.7);
      wing.rotation.z = d * -1;
      g.add(wing);
      wings.push(wing);
    }
    g.userData.wings = wings;
    return g;
  }
  function object(key, type) {
    let o = pools.get(key);
    if (!o) {
      o =
        type === "player"
          ? person()
          : type === "tank"
            ? tank()
            : type === "enemy"
              ? enemy()
              : type === "person"
                ? person()
                : type === "cover"
                  ? cover()
                  : type === "relay"
                    ? tank()
                    : type === "projectile"
                      ? mesh(geo.sphere, cyan, 0, 0, 0, 0.4)
                      : mesh(geo.sphere, cream);
      scene.add(o);
      pools.set(key, o);
    }
    o.visible = true;
    return o;
  }
  const sharedMaterials = new Set([
    emerald,
    trunkMat,
    gold,
    cyan,
    violet,
    dark,
    skin,
    cream,
    enemyArmor,
    playerArmor,
    turretArmor,
    coverArmor,
    smokeMaterial,
  ]);
  function release(o) {
    scene.remove(o);
    o.traverse((a) => {
      if (a.isInstancedMesh) a.dispose();
      if (a.geometry && !Object.values(geo).includes(a.geometry))
        a.geometry.dispose();
      for (const m of a.material
        ? Array.isArray(a.material)
          ? a.material
          : [a.material]
        : [])
        if (!sharedMaterials.has(m)) m.dispose();
    });
  }
  const target = new THREE.Vector3(),
    camTarget = new THREE.Vector3(),
    raycaster = new THREE.Raycaster(),
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    hit = new THREE.Vector3();
  const renderTarget = new THREE.WebGLRenderTarget(960, 600, {
    depthBuffer: true,
  });
  const postScene = new THREE.Scene(),
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postMaterial = new THREE.ShaderMaterial({
    uniforms: {
      image: { value: renderTarget.texture },
      resolution: { value: new THREE.Vector2(960, 600) },
      software: { value: software },
    },
    vertexShader:
      "varying vec2 uv0;void main(){uv0=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `uniform sampler2D image;uniform vec2 resolution;uniform bool software;varying vec2 uv0;vec3 glow(vec2 uv){vec3 c=texture2D(image,uv).rgb;return max(c-.57,0.);}void main(){vec2 d=vec2(7.)/resolution;vec3 c=texture2D(image,uv0).rgb;vec3 bloom=glow(uv0+d)+glow(uv0-d);if(!software)bloom+=glow(uv0+vec2(d.x,-d.y))+glow(uv0+vec2(-d.x,d.y));c+=bloom*(software?.7:.48);vec2 cell=fract(gl_FragCoord.xy/3.)-.5;float dots=smoothstep(.52,.26,length(cell));c*=.88+.12*dots;float vignette=1.-.25*length(uv0-.5);gl_FragColor=vec4(pow(c,vec3(.72))*vignette,1.);}`,
  });
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial));
  let alive = true;
  const diagnostics = {
    type: "PerspectiveCamera",
    geometry: "3D meshes + instanced vegetation",
    software,
    device,
    maxResolution: software ? 240 : 640,
    camera: [],
    calls: 0,
    triangles: 0,
    objects: 0,
  };
  function render(s, time = 0) {
    if (!alive) return;
    const began = performance.now();
    if (region !== (s.region || "forest") || mode !== (s.mode || "action"))
      rebuild(s);
    if (lastStage !== s.stage) {
      lastStage = s.stage;
      stageTime = time;
    }
    const t = reducedMotion ? 0 : time;
    for (const o of pools.values()) o.visible = false;
    const x = s.x - 100,
      z = s.y - 50,
      isTank = mode === "tanks";
    const player = object("player-" + mode, isTank ? "tank" : "player");
    const moved =
      player.position.distanceTo(new THREE.Vector3(x, 0, z)) > 0.025;
    player.position.set(x, 0, z);
    if (!isTank) {
      player.userData.legs.forEach(
        (l, i) =>
          (l.rotation.x = moved
            ? Math.sin(s.time * 13 + i * Math.PI) * 0.5
            : 0),
      );
    }
    player.rotation.y = isTank
      ? -(s.hullAngle || 0)
      : Math.atan2((s.aim?.x ?? s.x) - s.x, (s.aim?.y ?? s.y) - s.y);
    if (isTank)
      player.userData.turret.rotation.y =
        -(s.turretAngle || 0) - player.rotation.y;
    const b = s.beacon || { x: 100, y: 62 };
    beacon.position.set(b.x - 100, 0, b.y - 50);
    beacon.visible = !isTank;
    ring.scale.setScalar(10 + Math.sin(t * 2) * 0.5);
    rays.forEach(
      (r, i) => (r.rotation.z = (i - 3) * 0.4 + Math.sin(t * 0.35 + i) * 0.045),
    );
    for (const [i, m] of mist.children.entries()) {
      m.position.x = Math.sin(t * 0.12 + i) * 16;
      m.material.opacity = s.stage === "defend" ? 0.12 : 0.15;
    }
    for (const e of s.enemies || []) {
      const o = object("enemy" + e.id, isTank ? "tank" : "enemy");
      o.position.set(e.x - 100, 0, e.y - 50);
      o.scale.setScalar(e.elite ? 2.5 : 1);
      if (isTank) {
        o.children[0].material = enemyArmor;
        o.userData.turret.children[0].material = enemyArmor;
        o.rotation.y = -(e.angle || 0);
        o.userData.turret.rotation.y = -(e.turretAngle || 0) - o.rotation.y;
      } else {
        o.position.y = Math.sin(t * 2 + e.x) * 0.4;
        o.userData.wings.forEach(
          (w, i) =>
            (w.rotation.z = (i ? 1 : -1) * (-1 + Math.sin(t * 5 + e.x) * 0.2)),
        );
      }
      if (e.telegraph) {
        const r = object("warning" + e.id, "pickup");
        r.material = violet;
        r.position.set(e.x - 100, 0.1, e.y - 50);
        r.scale.set(5, 0.06, 5);
      }
    }
    for (const a of s.survivors || []) {
      const o = object("survivor" + a.id, "person");
      o.position.set(a.x - 100, 0, a.y - 50);
      o.scale.setScalar(0.85);
      o.children[0].material = skin;
    }
    for (const [i, p] of (s.projectiles || []).entries()) {
      const o = object("bullet" + (p.id ?? i), "projectile");
      o.position.set(p.x - 100, 2, p.y - 50);
      o.scale.setScalar(isTank ? 0.7 : 0.35);
      o.material = p.owner === "enemy" ? violet : cyan;
    }
    for (const c of s.cover || []) {
      if (c.hp <= 0) continue;
      const o = object("cover" + c.id, "cover");
      o.position.set(c.x - 100, 2.5, c.y - 50);
      o.scale.set(c.w, 5, c.h);
    }
    for (const a of s.relays || []) {
      if (a.hp <= 0) continue;
      const o = object("relay" + a.id, "relay");
      o.position.set(a.x - 100, 0, a.y - 50);
      o.userData.turret.rotation.y = -(a.turretAngle || 0);
    }
    for (const a of s.tethers || []) {
      const o = object("tether" + a.id, "cover");
      o.material = violet;
      o.position.set(a.x - 100, 2.5, a.y - 50);
      o.scale.set(2.2, 5, 2.2);
    }
    for (const [i, a] of (s.smoke || []).entries()) {
      const o = object("smoke" + i, "pickup");
      o.material = smokeMaterial;
      o.position.set(a.x - 100, 1.5, a.y - 50);
      o.scale.set(a.r || 3, 2.5, a.r || 3);
    }
    for (const [i, a] of (s.effects || []).entries()) {
      const o = object("effect" + (a.id ?? i), "pickup");
      o.material = a.kind === "impact" ? gold : cyan;
      o.geometry = geo.ring;
      o.rotation.x = -Math.PI / 2;
      o.position.set(a.x - 100, 0.3, a.y - 50);
      o.scale.setScalar(a.r || a.radius || 2);
    }
    for (const a of s.pickups || []) {
      if (a.used) continue;
      const o = object("pickup" + a.id, "pickup");
      o.position.set(a.x - 100, 1.5 + Math.sin(t * 3) * 0.3, a.y - 50);
      o.scale.setScalar(1.3);
    }
    if (isTank) {
      const o = object("extraction", "pickup");
      o.position.set(b.x - 100, 0.15, b.y - 50);
      o.material = cyan;
      o.geometry = geo.ring;
      o.rotation.x = -Math.PI / 2;
      o.scale.setScalar(9);
    }
    restoredRing.visible =
      s.stage === "restored" ||
      s.phase === "region-complete" ||
      s.phase === "won";
    restoredRing.position.copy(beacon.position);
    restoredRing.position.y = 0.3;
    restoredRing.scale.setScalar(
      reducedMotion ? 80 : Math.min(130, 8 + (time - stageTime) * 18),
    );
    // Oblique view tracks traversal while retaining the broad playable field.
    const portrait = width / height < 0.8,
      back = portrait ? 105 : 76,
      up = portrait ? 104 : 68;
    target.set(x * 0.88, 6, z * 0.55 - 18);
    camTarget.set(
      x * 0.88,
      portrait ? 72 : 44,
      z * 0.55 + (portrait ? 105 : 68),
    );
    if (previousTime === 0 || reducedMotion) {
      camera.position.copy(camTarget);
    } else camera.position.lerp(camTarget, 0.14);
    camera.lookAt(target);
    previousTime = time || 0.001;
    for (const [key, o] of pools)
      if (!o.visible) {
        release(o);
        pools.delete(key);
      }
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    const sceneCalls = renderer.info.render.calls,
      sceneTriangles = renderer.info.render.triangles;
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
    diagnostics.camera = camera.position.toArray();
    diagnostics.calls = sceneCalls + 1;
    diagnostics.triangles = sceneTriangles + 2;
    diagnostics.objects = pools.size;
    diagnostics.renderMs = performance.now() - began;
    diagnostics.resolution = [canvas.width, canvas.height];
    canvas.dataset.renderMs = diagnostics.renderMs.toFixed(2);
    canvas.dataset.region = region;
    canvas.dataset.mode = mode;
    canvas.dataset.depth = "perspective";
    canvas.dataset.restoration = String(s.rescued || 0);
  }
  function resize(
    w = parent.clientWidth || 960,
    h = parent.clientHeight || 600,
  ) {
    width = w;
    height = h;
    const factor = Math.min(
      1,
      (software ? 240 : 640) / w,
      (software ? 240 : 640) / h,
      Math.sqrt((software ? 34000 : 250000) / (w * h)),
    );
    renderer.setSize(Math.round(w * factor), Math.round(h * factor), false);
    renderTarget.setSize(Math.round(w * factor), Math.round(h * factor));
    postMaterial.uniforms.resolution.value.set(
      Math.round(w * factor),
      Math.round(h * factor),
    );
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
    if (!raycaster.ray.intersectPlane(groundPlane, hit)) return null;
    return { x: clamp(hit.x + 100, 0, 200), y: clamp(hit.z + 50, 0, 100) };
  }
  function project(x, y, elevation = 2) {
    const v = new THREE.Vector3(x - 100, elevation, y - 50),
      distance = camera.position.distanceTo(v);
    v.project(camera);
    return {
      x: ((v.x + 1) * width) / 2,
      y: ((1 - v.y) * height) / 2,
      depth: v.z,
      visible: v.z < 1 && v.z > -1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1,
      size: height / (2 * Math.tan((camera.fov * Math.PI) / 360) * distance),
      distance,
    };
  }
  function isOccluded(x, y, elevation = 2) {
    const point = new THREE.Vector3(x - 100, elevation, y - 50);
    const distance = camera.position.distanceTo(point);
    raycaster.set(camera.position, point.sub(camera.position).normalize());
    return raycaster
      .intersectObjects(terrain.children, true)
      .some((h) => h.distance < distance - 0.3);
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
    setReducedMotion(v) {
      reducedMotion = Boolean(v);
    },
    dispose() {
      alive = false;
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
        }
      });
      mistTexture.dispose();
      glowTexture.dispose();
      renderTarget.dispose();
      postMaterial.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
