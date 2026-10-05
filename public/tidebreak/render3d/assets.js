// Model loading for the 3D battlefield. World models and the animation clips load first (the Play button waits for
// them); hero files download in the background and are parsed only when a match needs that hero, so sixteen sets of
// decoded textures never sit in memory at once.
import * as THREE from 'three';
import { GLTFLoader } from '/vr/lib/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from '../lib/meshopt_decoder.mjs';
import { HERO_IDENTITIES } from '../hero-identities.js';
import { retarget, skinnedMeshOf } from '../hero-rig.js';

export const WORLD_MODELS = ['minion', 'tower', 'core', 'wildhunt', 'beast', 'pine', 'oak', 'boulders', 'arch'];
const url = file => new URL(`../models/${file}`, import.meta.url).href;
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
// Shared state: world: name -> gltf; heroes: slug -> { scene, mesh, height, clips } once parsed.
export const assets = { clips: null, world: {}, heroBytes: new Map(), heroes: new Map(), parsing: new Map(), failed: new Set(), progress: { done: 0, total: 0 }, worldReady: false, heroesDownloaded: false };
let started = null;
const parse = buffer => new Promise((resolve, reject) => loader.parse(buffer, url('heroes/'), resolve, reject));
// Tripo exports a metalness factor of 1 with a packed ORM map; the props from the prop sheet have no metal map and no
// normals. Fix both once, so nothing reads as chrome and the props shade smoothly.
function prepare(root, { metal = true } = {}) {
  root.traverse(o => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true;
    if (!o.geometry.attributes.normal) o.geometry.computeVertexNormals();
    // GLTFLoader turns on flat shading for a mesh without normals; with computed normals it shades smoothly.
    const m = o.material; m.flatShading = false; m.emissiveMap = null; m.emissive?.set(0);
    if (!m.metalnessMap || !metal) { m.metalness = 0; m.metalnessMap = null; }
    if (!m.roughnessMap) m.roughness = .88;
    m.envMapIntensity = .9; m.needsUpdate = true;
  });
  return root;
}
// Starts every download once. Resolves when the world models and clips are ready; onProgress(done, total) reports all
// files, heroes included.
export function preload(onProgress = () => {}) {
  if (started) return started;
  const slugs = HERO_IDENTITIES.map(h => h.slug), p = assets.progress; p.total = 1 + WORLD_MODELS.length + slugs.length;
  const tick = () => { p.done++; onProgress(p.done, p.total); };
  const clips = fetch(url('clips.json')).then(r => r.ok ? r.json() : Promise.reject(new Error('Animation clips unavailable'))).then(c => { assets.clips = c; tick(); });
  const world = Promise.all(WORLD_MODELS.map(name => loader.loadAsync(url(`world/${name}.glb`)).then(g => { assets.world[name] = g; prepare(g.scene, { metal: name === 'tower' || name === 'core' }); tick(); })));
  // Hero bytes: a failed hero keeps its placeholder; it never blocks the match.
  Promise.all(slugs.map(slug => fetch(url(`heroes/${slug}.glb`)).then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(slug))).then(b => { assets.heroBytes.set(slug, b); tick(); }).catch(() => { assets.failed.add(slug); tick(); }))).then(() => { assets.heroesDownloaded = true; });
  started = Promise.all([clips, world]).then(() => { assets.worldReady = true; parseInIdle(slugs); return assets; });
  return started;
}
// The clip names each hero plays. attack follows the hero's own weapon; cast is the skill motion.
export const HERO_CLIPS = {
  tidewarden: ['thrust', 'slam'], embersong: ['cast', 'weave'], voidcaller: ['charge', 'weave'], stoneheart: ['hammer', 'slam'],
  skyreaver: ['bow', 'charge'], irontide: ['slam', 'hammer'], moonweaver: ['weave', 'charge'], dredge: ['maul', 'slam'],
  glasshand: ['throw', 'cast'], 'salt-priestess': ['weave', 'cast'], riftblade: ['combo', 'slash'], 'coral-sage': ['cast', 'weave'],
  nightcurrent: ['charge', 'weave'], 'the-marrow': ['slash', 'maul'], bloodwake: ['chop', 'slam'], zephyrs: ['combo', 'slash'],
};
// Strike moments in clip seconds (the hand-speed peak, checked frame by frame) and the usable part of each clip.
// combo and slash carry several strikes: the three basic-attack variants use them in turn.
export const CLIP_TIMING = {
  thrust: { from: .3, strikes: [.77], to: 1.6 }, slam: { from: .95, strikes: [1.67], to: 2.35 }, combo: { from: .1, strikes: [.67, 1.23, 1.8], to: 2.3 },
  hammer: { from: .75, strikes: [1.57], to: 1.87 }, cast: { from: .12, strikes: [.63], to: 1.45 }, bow: { from: .35, strikes: [1.2], to: 1.95 },
  weave: { from: .25, strikes: [.93], to: 1.8 }, throw: { from: 2.55, strikes: [3.48], to: 4.4 }, charge: { from: .7, strikes: [1.78], to: 2.6 },
  maul: { from: .45, strikes: [1.1], to: 1.85 }, slash: { from: .3, strikes: [.8, 1.3], to: 1.75 }, chop: { from: 3.35, strikes: [4.43], to: 5.1 },
};
export const ANIMATED = ['idle', 'run', 'hit', 'death', 'march'];
// Retargeted clips are cached per model: clones of one hero share the bind pose, so they share clips.
const clipCache = new Map();
export function clipsFor(key, mesh, names) {
  let cache = clipCache.get(key); if (!cache) clipCache.set(key, cache = {});
  for (const n of names) if (!cache[n] && assets.clips?.[n]) cache[n] = retarget(assets.clips[n], mesh, n);
  return cache;
}
// A parsed hero model, or null while it loads. The first call for a slug starts the parse.
export function heroModel(slug) {
  const ready = assets.heroes.get(slug); if (ready) return ready;
  if (assets.parsing.has(slug) || assets.failed.has(slug) || !assets.clips) return null;
  const bytes = assets.heroBytes.get(slug); if (!bytes) return null;
  assets.parsing.set(slug, parse(bytes).then(g => {
    const scene = prepare(g.scene), mesh = skinnedMeshOf(scene), box = new THREE.Box3().setFromObject(scene);
    clipsFor(slug, mesh, [...ANIMATED.filter(n => n !== 'march'), ...HERO_CLIPS[slug] || ['slash', 'cast']]);
    assets.heroes.set(slug, { scene, mesh, height: box.max.y - box.min.y });
    assets.heroBytes.delete(slug);
  }).catch(error => { console.warn('Hero model unavailable:', slug, error); assets.failed.add(slug); }).finally(() => assets.parsing.delete(slug)));
  return null;
}
export const heroesReady = () => assets.heroes.size;
// Heroes are parsed one at a time in idle moments after the world is ready, so a match rarely waits for one.
function parseInIdle(slugs) {
  const idle = globalThis.requestIdleCallback || (f => setTimeout(f, 60));
  const next = () => {
    const slug = slugs.find(s => !assets.heroes.has(s) && !assets.failed.has(s));
    if (!slug) return;
    if (assets.parsing.size || !assets.heroBytes.has(slug)) { setTimeout(() => idle(next), 120); return; }
    heroModel(slug); assets.parsing.get(slug)?.then(() => idle(next));
  };
  idle(next);
}
