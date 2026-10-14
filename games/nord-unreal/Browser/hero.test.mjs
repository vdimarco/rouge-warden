import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./hero.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
function fixture({ saveData = false, reduced = false, play } = {}) {
  const nodes = new Map();
  const document = Object.assign(new EventTarget(), { body: { dataset: { state: 'offline' } }, hidden: false });
  for (const id of ['hero-video', 'hero-sound', 'trailer-dialog', 'trailer-video', 'trailer-stage', 'watch-trailer', 'close-trailer']) {
    const attributes = new Map();
    const node = Object.assign(new EventTarget(), { dataset: { landscapeSrc: `${id}-wide.mp4`, portraitSrc: `${id}-tall.mp4` },
      paused: true, hidden: false, loads: [], plays: 0,
      getAttribute: key => attributes.get(key) ?? null, hasAttribute: key => attributes.has(key),
      setAttribute: (key, value) => attributes.set(key, value), removeAttribute: key => attributes.delete(key),
      load() { this.loads.push(this.getAttribute('src')); this.paused = true; },
      pause() { this.paused = true; },
      play() { this.plays++; this.paused = false; return id === 'hero-video' && play ? play() : Promise.resolve(); },
      contains: () => false,
      showModal() { this.open = true; }, close() { this.open = false; this.dispatchEvent(new Event('close')); }
    });
    nodes.set(id, node);
  }
  document.getElementById = id => nodes.get(id);
  const motion = Object.assign(new EventTarget(), { matches: reduced });
  const portrait = Object.assign(new EventTarget(), { matches: false });
  const connection = Object.assign(new EventTarget(), { saveData });
  let observer;
  runInNewContext(source, { document, navigator: { connection },
    matchMedia: query => query.includes('reduced-motion') ? motion : portrait,
    MutationObserver: class { constructor(callback) { observer = callback; } observe() {} }
  });
  return { hero: nodes.get('hero-video'), trailer: nodes.get('trailer-video'), document,
    state(value) { document.body.dataset.state = value; observer(); },
    intro(value) { if (value) document.body.dataset.intro = value; else delete document.body.dataset.intro; observer(); },
    rotate() { portrait.matches = !portrait.matches; portrait.dispatchEvent(new Event('change')); },
    hidden(value) { document.hidden = value; document.dispatchEvent(new Event('visibilitychange')); },
    saver(value) { connection.saveData = value; connection.dispatchEvent(new Event('change')); },
    motion(value) { motion.matches = value; motion.dispatchEvent(new Event('change')); },
    click(id) { nodes.get(id).dispatchEvent(new Event('click')); }
  };
}

test('still-only title never loads a clip, including after rotation or preference changes', async () => {
  for (const options of [{ saveData: true }, { reduced: true }]) {
    const f = fixture(options); await settle(); f.rotate();
    assert.equal(f.hero.getAttribute('src'), null); assert.equal(f.hero.plays, 0);
    assert.equal(f.trailer.getAttribute('src'), null);
    f.saver(false); f.motion(false); await settle();
    assert.equal(f.hero.getAttribute('src'), 'hero-video-tall.mp4');
    f.saver(true); assert.equal(f.hero.getAttribute('src'), null);
  }
});
test('connecting, intro, play and background unload the loop; only visible media rotates', async () => {
  const f = fixture(); await settle();
  assert.equal(f.trailer.getAttribute('src'), null);
  for (const state of ['connecting', 'selecting', 'ready', 'playing']) {
    f.state(state); f.rotate(); await settle();
    assert.equal(f.hero.getAttribute('src'), null, state); assert.ok(f.hero.paused);
    assert.equal(f.trailer.getAttribute('src'), null);
  }
  f.state('disconnected'); await settle(); assert.ok(f.hero.getAttribute('src'));
  f.intro('open'); assert.equal(f.hero.getAttribute('src'), null);
  f.intro(null); f.hidden(true); assert.equal(f.hero.getAttribute('src'), null);
  f.rotate(); assert.equal(f.hero.getAttribute('src'), null);
  f.hidden(false); await settle(); assert.ok(f.hero.getAttribute('src'));
});
test('full trailer loads on explicit open and unloads on close without loading the title underneath', async () => {
  const f = fixture({ saveData: true }); await settle();
  f.click('watch-trailer'); assert.equal(f.trailer.getAttribute('src'), 'trailer-video-wide.mp4');
  assert.equal(f.hero.getAttribute('src'), null);
  f.rotate(); assert.equal(f.trailer.getAttribute('src'), 'trailer-video-tall.mp4');
  f.hidden(true); assert.ok(f.trailer.paused);
  f.click('close-trailer'); assert.equal(f.trailer.getAttribute('src'), null);
});
test('late autoplay success or rejection cannot restart or unmute an inactive title', async () => {
  for (const reject of [false, true]) {
    let resolve, fail;
    const f = fixture({ play: () => new Promise((a, b) => { resolve = a; fail = b; }) });
    f.state('playing');
    if (reject) fail(new Error('autoplay blocked')); else resolve();
    await settle(); assert.equal(f.hero.plays, 1); assert.ok(f.hero.paused);
    assert.equal(f.hero.getAttribute('src'), null);
  }
});
