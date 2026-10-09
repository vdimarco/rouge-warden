import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBattlefield } from '../../public/tidebreak/render3d/startup.js';
import { BattlefieldOverlay } from '../../public/tidebreak/battlefield-overlay.js';
import { createMatch } from '../../public/tidebreak/sim.js';

let loaded = 0;
await assert.rejects(createBattlefield({ support: () => ({ webgl2: false }), loadArt: () => { loaded++; }, loadRenderer: () => { loaded++; } }), error => error.code === 'GRAPHICS_UNAVAILABLE');
assert.equal(loaded, 0, 'unsupported graphics must fail before loading a battlefield');
let created = 0, preloaded = false;
const canvas = {}, minimap = {}, art = { marker: {} };
const module = { preload: async () => { preloaded = true; }, ThreeRenderer: class {
  constructor(c, m, a) { assert(preloaded); assert.equal(c, canvas); assert.equal(m, minimap); assert.equal(a, art); created++; }
} };
const make = extra => createBattlefield({ canvas, minimap, support: () => ({ webgl2: true, software: true }), loadArt: async () => art, loadRenderer: async () => module, ...extra });
assert(await make(), 'software WebGL2 still starts 3D');
assert.equal(created, 1);
await assert.rejects(make({ loadRenderer: async () => ({ ...module, preload: async () => { throw new Error('World model failed'); } }) }), /World model failed/);
assert.equal(created, 1, 'a failed model never creates another renderer');
await assert.rejects(make({ loadRenderer: async () => ({ ...module, ThreeRenderer: class { constructor() { throw new Error('GPU context failed'); } } }) }), /GPU context failed/);

// Exercise the real shared maps with missing optional art. Icons have a canvas fallback; startup stays independent.
const s = createMatch(0, 49), calls = [];
const ctx = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]), set: () => true });
const r = Object.assign(new BattlefieldOverlay(), { art: {}, visible: new Set(s.units.map(u => u.id)) });
r.rememberHeroes(s);
r.drawMap(s, { width: 180, getContext: () => ctx });
r.drawMap(s, { width: 700, getContext: () => ctx }, { x: 4800, y: 4800 });
assert(calls.some(c => c[0] === 'fillRect'), 'structures stay on maps when optional icons are missing');
assert(calls.some(c => c[0] === 'fillText' && c[1] === 'ENEMY RIFT'), 'the tactical map retains orientation labels');

const main = readFileSync(new URL('../../public/tidebreak/main.js', import.meta.url), 'utf8');
const choice = readFileSync(new URL('../../public/tidebreak/render3d/choice.js', import.meta.url), 'utf8');
const three = readFileSync(new URL('../../public/tidebreak/three-render.js', import.meta.url), 'utf8');
assert(!/rendererChoice|saveRendererChoice|graphics-mode|settings-graphics|new Renderer\(/.test(main), 'no playable mode selector or fallback remains');
assert(!/location.search|localStorage/.test(choice), 'legacy 2D choices have no effect');
assert(!/illustrated-render/.test(main + three), '3D startup never imports the old battlefield renderer');
console.log('PASS: 3D-only startup, software WebGL2, visible failure propagation, no alternate renderer, and optional map icons.');
