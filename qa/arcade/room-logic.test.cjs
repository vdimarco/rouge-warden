// Builds the real 3D room with real Three.js in Node (no GPU): scene, keyboard strafing, touch stick, look, taps, collision, launch.
const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const dataUrl = src => 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
(async () => {
  const threeUrl = dataUrl(fs.readFileSync('public/fish/lib/three.module.min.js', 'utf8'));
  const T = await import(threeUrl);
  // the addon must share the same Three.js module instance
  const { mergeGeometries } = await import(dataUrl(fs.readFileSync('public/arcade/room/lib/addons/utils/BufferGeometryUtils.js', 'utf8').replace("from 'three'", `from '${threeUrl}'`)));
  const controls = await import('../../public/arcade/room/controls.js');
  const elem = () => ({ style: {}, hidden: false, disabled: true, textContent: '', events: {}, addEventListener(k, f) { this.events[k] = f; }, setPointerCapture() {} });
  const nodes = {}; for (const id of ['error', 'enter', 'intro', 'selection', 'zone', 'play', 'stick', 'nub']) nodes[id] = elem();
  const listeners = {}, classes = new Set();
  let frame, position, rotation, scene, recorded, url, renders = 0;
  class Renderer { constructor() { this.domElement = elem(); Renderer.last = this; } setPixelRatio() {} setSize() {} render(s, c) { renders++; scene = s; position = c.position.clone(); rotation = c.rotation.clone(); } }
  class Loader { load() {} }
  class NoComposer { constructor() { throw Error('no WebGL in Node'); } } // also exercises the plain-render fallback
  class PMREM { fromScene() { return { texture: null }; } dispose() {} }
  const THREE = { ...T, WebGLRenderer: Renderer, TextureLoader: Loader, PMREMGenerator: PMREM };
  const games = [
    { id: 'fish', name: 'Reel It In', sub: 'Loon Lake', art: '/arcade/fish.webp', url: '/fish/', color: '#ffb04a' },
    { id: 'brawl', name: 'Cottage Brawl', sub: 'Fighter', art: '/brawl/art/hero-chaos.webp', url: '/brawl/', color: '#ffca51' },
    ...Array.from({ length: 30 }, (_, i) => ({ id: 'g' + i, name: 'Game ' + i, sub: 'Test', art: '/x.webp', url: '/g' + i + '/', color: '#88ccff' })),
  ];
  const ctx = {
    console: { ...console, warn() {} }, Math, Object, Array, Map, Set, Number, Float32Array, Infinity,
    THREE, mergeGeometries, EffectComposer: NoComposer, RenderPass: class {}, UnrealBloomPass: class {}, OutputPass: class {}, ...controls,
    devicePixelRatio: 1, innerWidth: 1440, innerHeight: 1000, performance: { now: () => 0 }, matchMedia: () => ({ matches: true }), requestAnimationFrame: f => frame = f,
    window: { GameSwitch: { GAMES: games, record: id => recorded = id } }, location: { assign: u => url = u }, addEventListener: (k, f) => listeners[k] = f,
    document: { hidden: false, body: { prepend() {}, classList: { add: c => classes.add(c) } }, getElementById: id => nodes[id], addEventListener() {},
      createElement: () => ({ getContext: () => new Proxy({}, { get: (o, k) => k in o ? o[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}), set: (o, k, v) => (o[k] = v, true) }) }) },
  };
  ctx.window.document = ctx.document;
  vm.createContext(ctx);
  const src = fs.readFileSync('public/arcade/room/room.js', 'utf8').replace(/^import [^;]+;$/gm, '');
  vm.runInContext(src, ctx);
  assert.equal(nodes.error.style.display, undefined, 'room built without an error');
  let now = 0; const step = n => { for (let i = 0; i < n; i++) frame(now += 20); };
  step(1);
  let objects = 0; scene.traverse(() => objects++); assert.ok(renders > 0 && objects > 150, 'scene has ' + objects + ' objects');
  // every cabinet stands inside the hall and the hall reaches past the last row
  const room = ctx.window.__room; assert.equal(room.cabinets.length, 32);
  assert.ok(room.cabinets.every(k => k.z - 1.02 > room.layout.back + 3.2));
  nodes.enter.onclick(); step(1); assert.equal(nodes.intro.hidden, true); assert.equal(position.z, 10); assert.ok(classes.has('inside'));
  // keyboard: A strafes left without turning
  listeners.keydown({ key: 'a', preventDefault() {} }); step(25); listeners.keyup({ key: 'a' });
  assert.ok(position.x < -1.5 && Math.abs(position.z - 10) < 1e-6 && rotation.y === 0, 'A strafes');
  listeners.keydown({ key: 'a', preventDefault() {} }); step(300); listeners.keyup({ key: 'a' });
  assert.ok(position.x > -5.16, 'cabinet collision'); assert.equal(nodes.selection.textContent, 'Reel It In'); assert.equal(nodes.play.disabled, false);
  listeners.keydown({ key: 'w', preventDefault() {} }); step(1500); listeners.keyup({ key: 'w' }); assert.ok(position.z > room.layout.back + 1.1, 'back wall');
  listeners.keydown({ key: 's', preventDefault() {} }); step(1500); listeners.keyup({ key: 's' }); assert.ok(position.z < room.layout.front - 1.1, 'front wall');
  // touch: the left half is a floating stick; dragging right strafes right, dragging up walks forward
  nodes.enter.onclick(); step(1);
  console.log('PASS real Three.js scene, 32 cabinets inside a grown hall, keyboard strafing, cabinet and wall collision, selection');
  // drive the canvas through the handlers the room registered on it
  const handlers = Renderer.last.domElement.events;
  const ptr = (type, id, x, y, pointerType = 'touch') => handlers[type]({ type, pointerId: id, clientX: x, clientY: y, pointerType });
  const start = position.clone();
  ptr('pointerdown', 1, 200, 800); for (let i = 1; i <= 6; i++) ptr('pointermove', 1, 200 + i * 10, 800); step(25);
  assert.ok(position.x > start.x + 1 && Math.abs(position.z - start.z) < 1e-6, 'stick strafes right');
  assert.equal(nodes.stick.hidden, false); ptr('pointerup', 1, 260, 800); assert.equal(nodes.stick.hidden, true);
  const s2 = position.clone();
  ptr('pointerdown', 1, 200, 800); for (let i = 1; i <= 6; i++) ptr('pointermove', 1, 200, 800 - i * 10); step(25); ptr('pointerup', 1, 200, 740);
  assert.ok(position.z < s2.z - 1, 'stick walks forward');
  // right half looks; both thumbs work together
  const yaw0 = rotation.y; ptr('pointerdown', 2, 1100, 500); ptr('pointermove', 2, 1000, 500); step(1); assert.ok(rotation.y > yaw0, 'drag right half looks');
  ptr('pointerdown', 3, 200, 800); ptr('pointermove', 3, 200, 740); const s3 = position.clone(); step(10); assert.ok(position.z < s3.z, 'walk while looking');
  ptr('pointerup', 3, 200, 740); ptr('pointerup', 2, 1000, 500);
  // a tap on the floor ahead walks there; a tap on a cabinet walks to its front and faces it
  nodes.enter.onclick(); step(1);
  ptr('pointerdown', 4, 900, 760); ptr('pointerup', 4, 900, 760); handlers.click({ clientX: 900, clientY: 760 });
  assert.ok(room.auto, 'floor tap starts a walk'); const yawBefore = rotation.y; step(200); assert.equal(room.auto, null);
  assert.ok(position.z < 10 && position.x > 0, 'walked to the tapped floor'); assert.equal(rotation.y, yawBefore, 'floor taps do not turn the view');
  const k = room.cabinets[5]; room.walkTo({ ...controls.standPoint(k), cabinet: k }); step(400);
  assert.equal(room.auto, null); assert.ok(Math.abs(position.x - controls.standPoint(k).x) < 1e-6 && Math.abs(position.z - k.z) < 1e-6, 'arrived at the cabinet');
  assert.ok(Math.abs(rotation.y - controls.standPoint(k).yaw) < 0.02, 'facing the cabinet'); assert.equal(nodes.selection.textContent, k.g.name);
  // a drag is not a tap
  ptr('pointerdown', 5, 1100, 760); ptr('pointermove', 5, 1160, 760); ptr('pointerup', 5, 1160, 760); handlers.click({ clientX: 1160, clientY: 760 }); assert.equal(room.auto, null, 'a drag is not a tap');
  nodes.play.onclick(); assert.equal(recorded, k.g.id); assert.equal(url, k.g.url);
  console.log('PASS touch stick strafing and walking, right-half look, two thumbs, floor and cabinet taps, arrival facing the cabinet, launch');
})().catch(e => { console.error(e); process.exitCode = 1; });
