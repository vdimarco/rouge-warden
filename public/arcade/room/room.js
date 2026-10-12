import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WALK, RUN, STICK, hallLayout, collider, moveDelta, yawToward, turnToward, stickVector, zoneFor, isTap, standPoint, tapTarget, stepToward } from './controls.js';
const $ = id => document.getElementById(id);
let renderer;
try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' }); }
catch { $('error').style.display = 'block'; }
if (renderer) { try { buildRoom(); } catch (error) { console.error('Arcade room initialization failed', error); $('error').style.display = 'block'; } }

function buildRoom() {
  const coarse = matchMedia('(pointer: coarse)').matches;
  // Quality steps down while the frame rate is low: sharpness first, then the floor mirror, then bloom.
  const quality = { ratio: Math.min(devicePixelRatio, coarse ? 1.5 : 2), mirror: true, bloom: true };
  renderer.setPixelRatio(quality.ratio);
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  document.body.prepend(renderer.domElement);

  const games = window.GameSwitch.GAMES.filter(g => g.id !== 'lab');
  const layout = hallLayout(games.length), clear = collider(layout);
  const length = layout.front - layout.back, mid = (layout.front + layout.back) / 2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#05060d');
  scene.fog = new THREE.FogExp2('#070915', 0.028);
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.08, 90);
  const lens = () => { camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 1 ? 74 : 62; camera.updateProjectionMatrix(); };
  lens();
  const restPitch = () => camera.aspect < 1 ? -0.1 : 0;
  camera.position.set(0, 1.7, 11);
  const world = new THREE.Group(); scene.add(world); // everything the floor mirrors
  const pink = '#ff36b8', cyan = '#38e8ff', gold = '#ffc24a';
  const hdr = (c, k) => new THREE.Color(c).multiplyScalar(k); // values over 1 are what the bloom picks up

  // Merged geometry: every box, panel and tube of one material becomes a single draw call.
  const parts = { paint: [], body: [], metal: [], wall: [], glow: [] };
  const holder = new THREE.Object3D();
  function bake(bucket, geometry, color, object) {
    object.updateWorldMatrix(true, false); // parents too: a cabinet part sits inside the cabinet's turn
    const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(object.matrixWorld);
    for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    const n = g.attributes.position.count, col = new Float32Array(n * 3), c = color instanceof THREE.Color ? color : new THREE.Color(color);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    parts[bucket].push(g);
  }
  function piece(bucket, geometry, color, parent, [x, y, z], [rx, ry, rz] = [0, 0, 0]) {
    const o = new THREE.Object3D(); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); parent.add(o);
    bake(bucket, geometry, color, o); parent.remove(o);
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  function canvasTexture(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities?.getMaxAnisotropy?.() || 1;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
    return t;
  }
  // Neon lettering: a soft colored halo with a bright core, like a glass tube.
  function neonTexture(text, color, w = 1024, h = 256) {
    return canvasTexture(w, h, (ctx) => {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '800 ' + Math.min(h * 0.5, w / (text.length * 0.62)) + 'px system-ui, sans-serif';
      ctx.lineJoin = 'round'; ctx.shadowColor = color;
      for (const [blur, width, style] of [[40, 10, color], [16, 6, color], [4, 2.5, '#ffffff']]) { ctx.shadowBlur = blur; ctx.lineWidth = width; ctx.strokeStyle = style; ctx.strokeText(text, w / 2, h / 2, w * 0.92); }
    });
  }
  function sign(text, color, w, h, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: neonTexture(text, color), color: hdr('#ffffff', 1.7), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    m.position.set(x, y, z); m.rotation.y = ry; world.add(m); return m;
  }

  // ---- The hall: glossy tiles, a blacklight carpet, slatted walls and a ceiling of neon tubes.
  const tiles = canvasTexture(256, 256, (ctx, w) => { ctx.fillStyle = '#121a26'; ctx.fillRect(0, 0, w, w); ctx.fillStyle = '#1b2738'; ctx.fillRect(0, 0, w, 3); ctx.fillRect(0, 0, 3, w); }, [16 / 1.5, length / 1.5]);
  const grout = canvasTexture(256, 256, (ctx, w) => { ctx.fillStyle = '#3a3a3a'; ctx.fillRect(0, 0, w, w); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, 4); ctx.fillRect(0, 0, 4, w); }, [16 / 1.5, length / 1.5]);
  grout.colorSpace = THREE.NoColorSpace;
  const floorMat = new THREE.MeshStandardMaterial({ map: tiles, roughnessMap: grout, roughness: 0.55, metalness: 0.2, transparent: true, opacity: 0.74 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, length), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.z = mid; floor.renderOrder = -1; scene.add(floor);
  const carpetArt = canvasTexture(512, 512, (ctx, w) => {
    ctx.fillStyle = '#0a0d26'; ctx.fillRect(0, 0, w, w);
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const hues = ['#ff4fbf', '#3ee8ff', '#ffd23f', '#8a5cff', '#59ff9c'];
    ctx.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const x = rnd() * w, y = rnd() * w, s = 8 + rnd() * 22; ctx.strokeStyle = ctx.fillStyle = hues[i % hues.length]; ctx.lineWidth = 3 + rnd() * 3; ctx.beginPath();
      const kind = i % 4;
      if (kind === 0) { ctx.moveTo(x - s, y); ctx.bezierCurveTo(x - s / 2, y - s, x + s / 2, y + s, x + s, y); ctx.stroke(); }
      else if (kind === 1) { ctx.arc(x, y, s / 2, 0, Math.PI * 2); ctx.stroke(); }
      else if (kind === 2) { ctx.moveTo(x, y - s / 2); ctx.lineTo(x + s / 2, y + s / 2); ctx.lineTo(x - s / 2, y + s / 2); ctx.closePath(); ctx.stroke(); }
      else { ctx.arc(x, y, 2 + rnd() * 3, 0, Math.PI * 2); ctx.fill(); }
    }
  }, [2, length / 2.5]);
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(5, length - 0.3), new THREE.MeshStandardMaterial({ map: carpetArt, emissiveMap: carpetArt, emissive: '#ffffff', emissiveIntensity: 0.32, roughness: 1 }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.004, mid); scene.add(carpet);
  for (const x of [-2.55, 2.55]) piece('glow', box(0.03, 0.012, length - 0.3), hdr(x < 0 ? pink : cyan, 2.2), world, [x, 0.008, mid]);

  const slats = canvasTexture(512, 256, (ctx, w, h) => { ctx.fillStyle = '#141b29'; ctx.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 32) { ctx.fillStyle = '#0d121c'; ctx.fillRect(x, 0, 4, h); ctx.fillStyle = '#1c2537'; ctx.fillRect(x + 4, 0, 2, h); } }, [length / 3, 1]);
  const wallMat = new THREE.MeshStandardMaterial({ map: slats, roughness: 0.8, metalness: 0.1 });
  for (const x of [-8, 8]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(length, 5), wallMat); w.position.set(x, 2.5, mid); w.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; world.add(w); }
  for (const z of [layout.back, layout.front]) piece('wall', box(16, 5, 0.3), '#141b29', world, [0, 2.5, z]);
  piece('body', box(16, 0.15, length), '#05070d', world, [0, 5, mid]);
  for (const x of [-7.85, 7.85]) { piece('glow', box(0.04, 0.04, length), hdr(cyan, 2.5), world, [x, 0.22, mid]); piece('glow', box(0.05, 0.05, length), hdr(pink, 2.6), world, [x, 4.62, mid]); }
  // Ceiling portals every four metres, each with a tube and a soft shaft of light below it.
  const shaft = canvasTexture(64, 256, (ctx, w, h) => { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); });
  shaft.colorSpace = THREE.NoColorSpace;
  for (let z = layout.front - 9; z > layout.back + 1; z -= 4) {
    const tone = Math.round(z) % 8 === 0 ? pink : cyan;
    piece('metal', box(15.6, 0.16, 0.24), '#1a2230', world, [0, 4.62, z]);
    piece('glow', box(10.5, 0.05, 0.05), hdr(tone, 1.8), world, [0, 4.5, z]);
    for (const x of [-7.6, 7.6]) piece('metal', box(0.1, 4.5, 0.14), '#1a2230', world, [x, 2.25, z]);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 4.4, 4.4, 24, 1, true), new THREE.MeshBasicMaterial({ map: shaft, color: hdr(tone, 0.03), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true }));
    cone.scale.z = 0.16; cone.position.set(0, 2.3, z); world.add(cone);
  }
  sign('COTTAGE ARCADE', pink, 10, 1.4, 0, 3.75, layout.back + 0.2);
  sign('ONE MORE GAME', cyan, 6, 0.6, 0, 2.75, layout.back + 0.21);
  sign('AFTER HOURS', cyan, 8, 1.1, 0, 3.75, layout.front - 0.2, Math.PI);
  const wallWords = ['INSERT COIN', 'HIGH SCORE', 'FREE PLAY', 'PLAYER 1', 'CONTINUE?', 'BONUS ROUND'];
  for (let i = 0, z = layout.front - 5; z > layout.back + 3; z -= 4, i++) { const side = i % 2 ? 1 : -1; sign(wallWords[i % wallWords.length], i % 3 === 0 ? gold : side < 0 ? cyan : pink, 2.6, 0.62, side * 7.8, 3.85, z, side < 0 ? Math.PI / 2 : -Math.PI / 2); }
  // A small lounge at the far end, off the aisle.
  piece('metal', box(3, 0.45, 1.2), '#1a2230', world, [0, 0.3, layout.back + 2.2]);
  piece('paint', box(3, 0.75, 0.25), '#63304e', world, [0, 0.72, layout.back + 1.7]);

  // ---- Cabinets: a shaped side profile with clearcoat paint, a neon edge, a CRT screen and a lit marquee.
  const profile = [[-0.5, 0], [0.45, 0], [0.45, 0.95], [0.62, 1.05], [0.62, 1.13], [0.3, 1.25], [0.18, 2.2], [0.32, 2.3], [0.32, 2.62], [-0.5, 2.62]];
  const shape = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  // Shape x is depth and the extrusion is width, so turn it to stand across the cabinet.
  const sideGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 }).rotateY(-Math.PI / 2);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: 1.26, bevelEnabled: false }).rotateY(-Math.PI / 2);
  // the neon edge runs up the front of the profile and back across the top
  const edge = new THREE.CurvePath(); for (let i = 2; i < profile.length; i++) edge.add(new THREE.LineCurve3(new THREE.Vector3(0, profile[i - 1][1], profile[i - 1][0]), new THREE.Vector3(0, profile[i][1], profile[i][0])));
  const edgeGeo = new THREE.TubeGeometry(edge, 80, 0.011, 5, false);
  const button = new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14), ball = new THREE.SphereGeometry(0.06, 14, 10), shaftGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8);
  const screenTilt = -Math.atan2(0.12, 0.95), deckTilt = Math.atan2(0.12, 0.32);
  const screens = [], hitboxes = [], cabinets = [], screenMats = [];
  const loader = new THREE.TextureLoader();
  const screenVertex = 'varying vec2 vUv;\n#include <fog_pars_vertex>\nvoid main(){vUv=uv;vec4 mvPosition=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mvPosition;\n#include <fog_vertex>\n}';
  // Curved glass, scanlines, a slow rolling band and a dark rim. power rises when the cabinet is selected.
  const screenFragment = 'uniform sampler2D map;uniform float time;uniform float power;varying vec2 vUv;\n#include <fog_pars_fragment>\nvoid main(){vec2 c=vUv-0.5;vec2 uv=0.5+c*(1.0+0.08*dot(c,c));vec3 col=texture2D(map,uv).rgb;float scan=0.84+0.16*sin(vUv.y*620.0);float roll=0.94+0.06*sin((vUv.y+time*0.12)*6.2832);float rim=smoothstep(0.52,0.4,max(abs(c.x),abs(c.y)*1.05));col*=scan*roll*rim*power;if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0)col=vec3(0.0);gl_FragColor=vec4(col,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n#include <fog_fragment>\n}';
  const pool = canvasTexture(128, 128, (ctx, w) => { const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, w); });
  pool.colorSpace = THREE.NoColorSpace;
  const pools = [];
  for (const [i, g] of games.entries()) {
    const spot = layout.cabinets[i], side = spot.side;
    const group = new THREE.Object3D(); group.position.set(spot.x, 0, spot.z); group.rotation.y = side === -1 ? Math.PI / 2 : -Math.PI / 2; holder.add(group);
    const paint = new THREE.Color(g.color).multiplyScalar(0.62), trim = hdr(g.color, 2.4);
    piece('body', bodyGeo, '#0b0e18', group, [0.63, 0, 0]);
    for (const x of [-0.64, 0.7]) piece('paint', sideGeo, paint, group, [x, 0, 0]);
    for (const x of [-0.675, 0.675]) piece('glow', edgeGeo, trim, group, [x, 0, 0.003]);
    // the control deck: a joystick and three lit buttons
    const deck = new THREE.Object3D(); deck.position.set(0, 1.19, 0.46); deck.rotation.x = deckTilt; group.add(deck);
    piece('glow', ball, hdr('#ff3b6b', 1.6), deck, [-0.3, 0.1, 0]); piece('body', shaftGeo, '#05070d', deck, [-0.3, 0.05, 0]);
    for (let b = 0; b < 3; b++) piece('glow', button, hdr(b === 0 ? cyan : g.color, 1.8), deck, [0.12 + b * 0.14, 0.015, b === 1 ? -0.05 : 0]);
    piece('glow', box(1.12, 0.02, 0.02), trim, group, [0, 1.25, 0.31]);
    // coin door with two warm slots
    piece('metal', box(0.34, 0.38, 0.02), '#2a3242', group, [0, 0.56, 0.455]);
    for (const x of [-0.07, 0.07]) piece('glow', box(0.03, 0.09, 0.012), hdr('#ff9a2e', 2.2), group, [x, 0.6, 0.468]);
    for (let v = 0; v < 4; v++) piece('metal', box(0.3, 0.012, 0.012), '#2a3242', group, [0, 0.16 + v * 0.045, 0.456]);
    // the screen, set into the tilted face
    const mat = new THREE.ShaderMaterial({ uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, time: { value: 0 }, power: { value: 1 } }]), vertexShader: screenVertex, fragmentShader: screenFragment, fog: true });
    mat.uniforms.map.value = neonTexture(g.name, g.color, 512, 320);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.74), mat);
    screen.position.set(0, 1.725, 0.24 + 0.012); screen.rotation.x = screenTilt; group.add(screen); screen.userData.game = g;
    loader.load(g.art, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; mat.uniforms.map.value = t; }, undefined, () => {});
    screens.push(screen); screenMats.push(mat);
    // the marquee: the name lit from behind, brighter than the paint so it blooms
    const marqueeArt = canvasTexture(512, 128, (ctx, w, h) => {
      const bg = ctx.createLinearGradient(0, 0, w, 0); bg.addColorStop(0, '#0a0b18'); bg.addColorStop(0.5, g.color + '55'); bg.addColorStop(1, '#0a0b18'); ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = g.color; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 ' + Math.min(62, w / (g.name.length * 0.62)) + 'px system-ui, sans-serif';
      ctx.shadowColor = g.color; ctx.shadowBlur = 18; ctx.fillStyle = '#ffffff'; ctx.fillText(g.name.toUpperCase(), w / 2, h / 2 + 3, w * 0.88);
    });
    const marquee = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 0.28), new THREE.MeshBasicMaterial({ map: marqueeArt, color: hdr('#ffffff', 1.12) }));
    marquee.position.set(0, 2.46, 0.325); group.add(marquee);
    // an invisible box, so a tap anywhere on the cabinet picks it
    const hit = new THREE.Mesh(box(1.45, 2.65, 1.2)); hit.visible = false; hit.position.set(spot.x, 1.32, spot.z); hit.rotation.y = group.rotation.y; hit.userData.cabinet = i; hit.updateMatrixWorld(); hitboxes.push(hit);
    const p = new THREE.Object3D(); p.position.set(spot.x - side * 0.55, 0.02, spot.z); p.rotation.x = -Math.PI / 2; bake('glow', new THREE.PlaneGeometry(3.2, 3.2), new THREE.Color(g.color).multiplyScalar(0.42), p); pools.push(parts.glow.pop());
    group.updateMatrixWorld(true);
    // move the screen and marquee into the hall at their baked positions; clone() copies userData, so set the game again
    for (const m of [screen, marquee]) { m.updateMatrixWorld(); const copy = m.clone(); copy.matrixAutoUpdate = false; copy.matrix.copy(m.matrixWorld); copy.userData.game = g; world.add(copy); if (m === screen) screens[screens.length - 1] = copy; }
    cabinets.push({ ...spot, g, mat, index: i });
  }
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.15, clearcoat: 0.8, clearcoatRoughness: 0.18 }),
    body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 }),
    metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.8 }),
    wall: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true }),
  };
  for (const [key, list] of Object.entries(parts)) if (list.length) world.add(new THREE.Mesh(mergeGeometries(list), mats[key]));
  const poolMesh = new THREE.Mesh(mergeGeometries(pools), new THREE.MeshBasicMaterial({ vertexColors: true, map: pool, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(poolMesh);

  // The floor mirror: the hall again, upside down under the translucent tiles.
  // Its see-through parts draw before the tiles, the real ones after.
  const mirror = world.clone(); mirror.scale.y = -1; scene.add(mirror);
  mirror.traverse(o => { if (o.material?.transparent) o.renderOrder = -2; });

  // Light: a cool fill, neon point lights down both walls, and a reflection map made from glowing strips.
  scene.add(new THREE.HemisphereLight('#7088c0', '#120f22', 0.7));
  for (let z = layout.front - 4, i = 0; z > layout.back + 1 && i < 8; z -= Math.max(5, length / 4), i++) {
    for (const [x, c] of [[-5, pink], [5, cyan]]) { const l = new THREE.PointLight(c, 20, 12, 2); l.position.set(x, 3.1, z); scene.add(l); }
  }
  const envScene = new THREE.Scene(); envScene.background = new THREE.Color('#06070e');
  for (let k = 0; k < 6; k++) { const strip = new THREE.Mesh(box(0.25, 0.25, 30), new THREE.MeshBasicMaterial({ color: hdr(k % 2 ? cyan : pink, 4) })); strip.position.set(k < 3 ? -6 : 6, 1 + (k % 3) * 1.5, 0); envScene.add(strip); }
  for (let k = -2; k <= 2; k++) { const tube = new THREE.Mesh(box(12, 0.2, 0.2), new THREE.MeshBasicMaterial({ color: hdr('#ffffff', 3) })); tube.position.set(0, 5, k * 5); envScene.add(tube); }
  const pmrem = new THREE.PMREMGenerator(renderer); scene.environment = pmrem.fromScene(envScene, 0.04).texture; pmrem.dispose?.();
  scene.environmentIntensity = 0.55;

  // Dust drifts slowly through the light.
  const dust = new Float32Array(260 * 3); for (let i = 0; i < dust.length; i += 3) { dust[i] = (Math.random() - 0.5) * 15; dust[i + 1] = Math.random() * 4.6; dust[i + 2] = layout.back + Math.random() * length; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
  const motes = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.03, map: pool, color: '#b4b0ff', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending })); scene.add(motes);
  // A ring on the floor marks where a tap is walking to.
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 40), new THREE.MeshBasicMaterial({ color: hdr(cyan, 2.5), transparent: true, opacity: 0, depthWrite: false }));
  marker.rotation.x = -Math.PI / 2; marker.position.y = 0.02; scene.add(marker);

  // Post-processing: multisampled HDR, neon bloom, then tone mapping.
  let composer = null, bloom = null;
  try {
    const target = new THREE.WebGLRenderTarget(innerWidth * quality.ratio, innerHeight * quality.ratio, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.35, 1.0);
    composer.addPass(bloom); composer.addPass(new OutputPass());
    composer.setPixelRatio(quality.ratio); composer.setSize(innerWidth, innerHeight);
  } catch (error) { console.warn('Bloom unavailable', error); composer = null; }

  // ---- Controls
  let yaw = 0, pitch = 0, entered = false, selected = null, last = performance.now(), introStart = last, walkTime = 0, auto = null;
  const keys = new Set(), ray = new THREE.Raycaster(), center = new THREE.Vector2(), tapNdc = new THREE.Vector2();
  const pointers = new Map(), stick = { forward: 0, strafe: 0 };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = renderer.domElement, stickEl = $('stick'), nub = $('nub');
  $('enter').onclick = () => { entered = true; $('intro').hidden = true; yaw = 0; pitch = restPitch(); auto = null; camera.position.set(0, 1.7, 10); document.body.classList.add('inside'); };
  function showStick(p) {
    if (!stickEl) return;
    stickEl.hidden = !p; if (!p) return;
    stickEl.style.transform = `translate(${p.x0}px,${p.y0}px)`;
    const dx = p.x - p.x0, dy = p.y - p.y0, len = Math.hypot(dx, dy), k = len > STICK ? STICK / len : 1;
    nub.style.transform = `translate(${dx * k}px,${dy * k}px)`;
  }
  canvas.addEventListener('pointerdown', e => {
    if (!entered) return;
    const moving = [...pointers.values()].some(p => p.zone === 'move');
    const zone = zoneFor(e.pointerType, e.clientX, innerWidth) === 'move' && !moving ? 'move' : 'look';
    const p = { zone, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, travel: 0 };
    pointers.set(e.pointerId, p); canvas.setPointerCapture?.(e.pointerId);
    if (zone === 'move') { auto = null; document.body.classList.add('moved'); }
  });
  canvas.addEventListener('pointermove', e => {
    const p = pointers.get(e.pointerId); if (!p) return;
    p.travel += Math.hypot(e.clientX - p.x, e.clientY - p.y);
    if (p.zone === 'look') {
      const k = e.pointerType === 'mouse' ? 0.005 : 0.0065;
      yaw -= (e.clientX - p.x) * k; pitch = Math.max(-0.7, Math.min(0.7, pitch - (e.clientY - p.y) * k * 0.8));
      if (p.travel > 10) document.body.classList.add('looked');
    }
    p.x = e.clientX; p.y = e.clientY;
    if (p.zone === 'move') {
      // the stick floats: pulled past its rim, its centre follows the thumb
      const dx = p.x - p.x0, dy = p.y - p.y0, len = Math.hypot(dx, dy);
      if (len > STICK * 1.6) { p.x0 = p.x - dx / len * STICK * 1.6; p.y0 = p.y - dy / len * STICK * 1.6; }
      Object.assign(stick, stickVector(p.x - p.x0, p.y - p.y0)); if (p.travel > 10) showStick(p);
    }
  });
  function endPointer(e) {
    const p = pointers.get(e.pointerId); if (!p) return; pointers.delete(e.pointerId);
    if (p.zone === 'move') { stick.forward = stick.strafe = 0; showStick(null); }
    lastTravel = p.travel;
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, endPointer);
  // The browser decides what a tap is (a long press gives no click); a drag that ends on the canvas is not one.
  let lastTravel = Infinity;
  canvas.addEventListener('click', e => { if (entered && isTap(lastTravel)) tap(e.clientX, e.clientY); lastTravel = Infinity; });
  function walkTo(t) {
    auto = t; marker.position.x = t.x; marker.position.z = t.z; marker.material.opacity = 1; marker.scale.setScalar(1);
  }
  function tap(x, y) {
    tapNdc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(tapNdc, camera);
    const hit = ray.intersectObjects([...hitboxes, floor, carpet], false)[0];
    if (!hit) return;
    if (hit.object.userData.cabinet !== undefined) { const c = cabinets[hit.object.userData.cabinet]; walkTo({ ...standPoint(c), cabinet: c }); return; }
    const t = tapTarget(layout, clear, hit.point.x, hit.point.z); if (t) walkTo(t);
  }
  const keyMap = { ArrowUp: 'w', ArrowDown: 's', ArrowLeft: 'a', ArrowRight: 'd' };
  addEventListener('keydown', e => {
    if (!entered) return; const k = keyMap[e.key] || e.key.toLowerCase();
    if (['w', 'a', 's', 'd', 'e'].includes(k)) { e.preventDefault(); keys.add(k); if (k !== 'e') auto = null; if (k === 'e' && !e.repeat) launch(); }
    if (e.key === 'Shift') keys.add('shift');
  });
  addEventListener('keyup', e => { keys.delete(keyMap[e.key] || e.key.toLowerCase()); if (e.key === 'Shift') keys.delete('shift'); });
  const reset = () => { keys.clear(); pointers.clear(); stick.forward = stick.strafe = 0; showStick(null); };
  addEventListener('blur', reset); document.addEventListener('visibilitychange', () => { reset(); last = performance.now(); });
  function launch() { if (!selected || !entered) return; window.GameSwitch.record(selected.id); location.assign(selected.url); }
  $('play').onclick = launch;

  // Frame-time watch: three slow seconds in a row step the quality down one notch.
  let slow = 0;
  function adapt(dt) {
    slow = dt > 1 / 40 ? slow + dt : Math.max(0, slow - dt * 0.5);
    if (slow < 3) return; slow = 0;
    if (quality.ratio > 1) { quality.ratio = Math.max(1, quality.ratio - 0.5); resize(); }
    else if (quality.mirror) { quality.mirror = false; mirror.visible = false; floorMat.transparent = false; floorMat.opacity = 1; floorMat.needsUpdate = true; }
    else if (quality.bloom) { quality.bloom = false; }
  }
  function frame(now) {
    requestAnimationFrame(frame); if (document.hidden) return;
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!entered) { const t = reduce ? 0 : (now - introStart) / 1000; camera.position.set(Math.sin(t * 0.13) * 0.65, 1.8, 11 - Math.min(t * 0.22, 3)); yaw = Math.sin(t * 0.11) * 0.12; pitch = restPitch() + 0.015; }
    else {
      let f = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0) + stick.forward, r = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0) + stick.strafe;
      const len = Math.hypot(f, r); if (len > 1) { f /= len; r /= len; }
      const speed = WALK * (keys.has('shift') ? RUN : 1) * dt;
      let moved = 0;
      if (len > 0.01) {
        auto = null;
        const { dx, dz } = moveDelta(yaw, f, r, speed), x0 = camera.position.x, z0 = camera.position.z;
        if (clear(x0 + dx, z0)) camera.position.x += dx; if (clear(camera.position.x, z0 + dz)) camera.position.z += dz;
        moved = Math.hypot(camera.position.x - x0, camera.position.z - z0);
      } else if (auto) {
        const from = { x: camera.position.x, z: camera.position.z }, step = stepToward(from, auto, WALK * 1.25 * dt, clear);
        camera.position.x = step.x; camera.position.z = step.z; moved = Math.hypot(step.x - from.x, step.z - from.z);
        if (auto.yaw !== undefined) { yaw = turnToward(yaw, auto.yaw, 2.6 * dt); pitch += (-0.05 - pitch) * Math.min(1, dt * 3); }
        auto.stuck = moved < WALK * 0.1 * dt ? (auto.stuck || 0) + dt : 0;
        if ((step.arrived && (auto.yaw === undefined || Math.abs(Math.atan2(Math.sin(auto.yaw - yaw), Math.cos(auto.yaw - yaw))) < 0.01)) || auto.stuck > 0.35) auto = null;
      }
      walkTime += moved;
      camera.position.y = 1.7 + (reduce ? 0 : Math.sin(walkTime * 3.2) * 0.022);
    }
    marker.material.opacity = Math.max(0, marker.material.opacity - dt * (auto ? 0.4 : 2.5)); marker.scale.setScalar(1 + (1 - marker.material.opacity) * 0.5);
    camera.rotation.order = 'YXZ'; camera.rotation.set(pitch, yaw, 0); camera.updateMatrixWorld();
    ray.setFromCamera(center, camera); const hit = ray.intersectObjects(screens, false)[0];
    let next = hit && hit.distance < 4 ? hit.object.userData.game : null;
    if (!next && entered) { const near = cabinets.map(c => [c, Math.hypot(c.x - camera.position.x, c.z - camera.position.z)]).filter(([, d]) => d < 2.3).sort((a, b) => a[1] - b[1])[0]; if (near) next = near[0].g; }
    if (next !== selected) {
      selected = next; $('selection').textContent = next ? next.name : 'Find your next obsession.'; $('zone').textContent = next ? next.sub : 'THE NEON ROOM';
      $('play').disabled = !next; $('play').textContent = next ? 'PLAY · FREE CREDIT' : coarse ? 'Tap a cabinet to walk to it' : 'Walk up to a cabinet';
    }
    const t = now / 1000;
    for (const c of cabinets) { const u = c.mat.uniforms; u.time.value = t + c.index; u.power.value += ((c.g === selected ? 1.45 : 1.05) - u.power.value) * Math.min(1, dt * 6); }
    if (!reduce) { motes.position.y = Math.sin(t * 0.2) * 0.15; motes.rotation.y = Math.sin(t * 0.05) * 0.02; }
    if (entered) adapt(dt);
    if (composer && quality.bloom) composer.render(dt); else renderer.render(scene, camera);
  }
  function resize() {
    lens();
    renderer.setPixelRatio(quality.ratio); renderer.setSize(innerWidth, innerHeight);
    if (composer) { composer.setPixelRatio(quality.ratio); composer.setSize(innerWidth, innerHeight); }
  }
  addEventListener('resize', resize);
  // a handle for browser and Node checks
  window.__room = { camera, get selected() { return selected; }, get auto() { return auto; }, quality, cabinets, layout, tap, walkTo };
  requestAnimationFrame(frame);
}
