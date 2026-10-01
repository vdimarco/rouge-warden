import assert from 'node:assert/strict';
import { createDialogue } from '../../public/crimson/js/story/ui/dialogue.js';
class Element {
  constructor() { this.listeners = {}; this.nodes = {}; this.dataset = {}; this.textContent = ''; this.innerHTML = ''; this.classes = new Set(); this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c), contains: c => this.classes.has(c), toggle: (c, on) => on ? this.classes.add(c) : this.classes.delete(c) }; }
  querySelector(k) { return this.nodes[k] ||= new Element(); }
  addEventListener(k, fn) { this.listeners[k] = fn; }
  removeAttribute() {} getAttribute() { return null; }
}
const root = new Element(); let box, stopped = 0;
const S = { timers: { now: 0 }, audio: { speak: () => ({ done: false, duration: 5 }), stopVoice: () => stopped++ }, cast: { talk: { talking: v => !v.audio.done } } };
const U = { S, root, make: (tag, cls) => { const e = new Element(); cls.split(' ').forEach(c => e.classList.add(c)); if (cls.startsWith('sSay')) box = e; return e; },
  lineOf: x => x, portrait: () => null, whoName: x => x, isCrew: () => true, glyph: () => '', pushModal() {}, popModal() {}, blip() {}, box: () => null };
const dialogue = createDialogue(U), h = dialogue.say([{ who: 'gabe', text: 'Hey, buddy. Long time.' }]);
assert(dialogue.state.typing); S.timers.now = .2; box.listeners.click({ stopPropagation() {} });
assert.equal(dialogue.state.text, 'Hey, buddy. Long time.'); assert.equal(stopped, 0, 'revealing the text keeps the voice playing');
assert(!h.done); S.timers.now = .4; box.listeners.click({ stopPropagation() {} });
assert.equal(stopped, 1); assert(h.done, 'advancing stops the voice');
const driving = dialogue.say([{ who: 'gabe', text: 'Drive.' }], { block: false }); S.timers.now += 8; dialogue.tick(); assert(!driving.done, 'subtitles wait for the voice');
dialogue.voices[0].audio.done = true; dialogue.tick(); assert(driving.done);
console.log('PASS: reveal keeps speech, next line stops speech, driving subtitles wait for audio.');
