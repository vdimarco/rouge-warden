// Splat Isle's sound, made in the browser with Web Audio from the lab kit's blocks (/lab/kit/sfx.js): no sound files.
// - The sea: pink noise under a low-pass filter that swells and falls like waves; a little wind over it, more at night.
// - Night: crickets, a chirp at a time, while the dark lasts.
// - Music: one soft note every few seconds from a five-note scale in each island's own key, quieter at night.
// - Steps while the keeper walks; a knock or a crack for each hit, by what the thing is made of; a burst of strokes when
//   it breaks and a rising glide when it pops back; a chime for a shell, a bell for the bell, a splash at the well.
// - A blip under each line a person says, at that person's pitch.
// The kit starts the context on the player's first press, keeps the arcade's one sound switch ("arcade.sound"), and
// suspends when the page is hidden; /arcade/quiet.js makes sure of that too.
import { Sfx, tone, hiss, ring, splash } from '/lab/kit/sfx.js';

const SCALE = [0, 2, 4, 7, 9];   // major pentatonic: any two notes sound well together
const KEY = { home: 220, orchard: 261.6, bell: 293.7, wreck: 329.6, light: 174.6 };
const note = (base, step) => base * 2 ** ((SCALE[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);
// what each kind of thing is made of, for its knock and its break
const STUFF = { crate: 'wood', barrel: 'wood', fence: 'wood', hay: 'straw', tree: 'leaf', rock: 'stone', stonewall: 'stone', statue: 'stone', pot: 'clay', crystal: 'glass', thornbush: 'leaf', thorntree: 'leaf', mushroom: 'soft', cottage: 'wood', lighthouse: 'stone', tower: 'stone', wreck: 'wood', well: 'stone' };
const VOICE = { Gardener: 196, Bellringer: 247, Fisher: 165, 'Lamp keeper': 220, '': 330 };

let started = false, sea = null, wind = null, clock = 0, nextNote = 2, nextChirp = 0, nextStep = 0, step = 0, melody = 0;
const r = Math.random;

export function start() {
  if (!Sfx.init()) return false;
  if (!started) { started = true; sea = Sfx.bed('sea', 'pink', 'lowpass', 520, 0.5); wind = Sfx.bed('wind', 'pink', 'bandpass', 1400, 0.8); }
  return true;
}
export const on = () => Sfx.isOn();
export const toggle = () => Sfx.toggle();
// For the browser check: whether the sound is on, and the state of its context.
export const state = () => ({ on: Sfx.isOn(), context: Sfx.engine?.ctx.state || 'none', beds: started });

// Called every frame: the waves, the wind, the crickets, the slow notes and the steps.
export function update(dt, { night = 0, moving = false, island = 'home', quiet = false }) {
  if (!started) return; clock += dt;
  const swell = 0.5 + 0.5 * Math.sin(clock * 0.55) * Math.sin(clock * 0.21 + 1);
  sea.set(0.05 + 0.06 * swell, 380 + 420 * swell, 0.4);
  wind.set(0.012 + 0.03 * night, 1100 + 500 * Math.sin(clock * 0.13), 0.6);
  if (quiet) return;
  if (clock > nextNote) {   // a soft note, wandering by small steps through the island's scale
    melody += [-2, -1, 1, 1, 2][Math.floor(r() * 5)]; melody = Math.max(-2, Math.min(7, melody));
    const f = note(KEY[island] || 220, melody), gainOf = 0.045 * (1 - 0.5 * night);
    Sfx.play((e, t) => { tone(e, t, { f, wave: 'sine', peak: gainOf, att: 0.06, dur: 2.6, send: 0.5 }); tone(e, t, { f: f * 2, wave: 'sine', peak: gainOf * 0.25, att: 0.04, dur: 1.4, send: 0.5 }); });
    nextNote = clock + 2.6 + r() * 3.4;
  }
  if (night > 0.5 && clock > nextChirp) {   // a cricket: three fast clicks of a high tone
    const f = 4200 + r() * 900, pan = r() * 1.6 - 0.8;
    Sfx.play((e, t) => { for (let i = 0; i < 3; i++) tone(e, t + i * 0.045, { f, peak: 0.012 * night, att: 0.003, dur: 0.03, pan }); });
    nextChirp = clock + 0.35 + r() * 1.4;
  }
  if (moving && clock > nextStep) {   // a step on grass: a short, soft brush of noise
    step++; Sfx.play((e, t) => hiss(e, t, { type: 'bandpass', f: 900 + (step % 2) * 250, q: 0.8, peak: 0.035, att: 0.004, dur: 0.07, pan: step % 2 ? 0.08 : -0.08 }));
    nextStep = clock + 0.36;
  }
}

// A hit that does not break the thing yet: a knock in the voice of what it is made of.
export function hit(kind) {
  const s = STUFF[kind] || 'wood';
  Sfx.play((e, t) => {
    if (s === 'wood') ring(e, t, [[180 + r() * 30, 0.16, 0.12], [460, 0.07, 0.06], [1150, 0.03, 0.03]], { send: 0.1 });
    else if (s === 'stone') { ring(e, t, [[95, 0.18, 0.1], [310, 0.06, 0.05]]); hiss(e, t, { type: 'highpass', f: 2400, q: 0.7, peak: 0.08, dur: 0.05 }); }
    else if (s === 'clay') ring(e, t, [[620, 0.1, 0.12], [1490, 0.05, 0.08]], { send: 0.15 });
    else if (s === 'glass') ring(e, t, [[1760, 0.07, 0.4], [2640, 0.04, 0.3], [3960, 0.02, 0.2]], { send: 0.3 });
    else hiss(e, t, { type: 'bandpass', f: 1600, q: 0.6, peak: 0.1, dur: 0.12, send: 0.05 });   // leaves, straw, soft things
  });
}
// The last hit: the thing breaks into strokes that fly off.
export function smash(kind) {
  const s = STUFF[kind] || 'wood';
  hit(kind);
  Sfx.play((e, t) => {
    hiss(e, t + 0.01, { type: 'bandpass', f: s === 'glass' ? 5000 : 2600, f2: 500, sweep: 0.5, q: 0.5, peak: 0.12, att: 0.004, dur: 0.55, send: 0.25 });
    for (let i = 0; i < 6; i++) { const f = (s === 'stone' ? 500 : 900) + r() * 1400; tone(e, t + 0.03 + r() * 0.3, { f, f2: f * 0.6, glide: 0.06, peak: 0.02 + r() * 0.02, dur: 0.07, pan: r() * 1.2 - 0.6 }); }
  });
}
// The strokes gather and pop back onto their shapes.
export function pop() { Sfx.play((e, t) => { tone(e, t, { f: 300, f2: 900, glide: 0.25, wave: 'triangle', peak: 0.05, att: 0.02, dur: 0.3, send: 0.3 }); }); }
// Something found: a shell, the rope, the stone, a fruit.
export function pickup(what) {
  const notes = what === 'shell' ? [880, 1108.7, 1318.5] : what === 'fruit' ? [659.3, 880] : [523.3, 659.3, 784];
  Sfx.play((e, t) => notes.forEach((f, i) => tone(e, t + i * 0.09, { f, wave: 'triangle', peak: 0.06, att: 0.004, dur: 0.35, send: 0.35 })));
}
// A line of talk: a few soft blips at the speaker's pitch, like a voice far off.
export function voice(who) {
  const base = VOICE[who] ?? 260;
  Sfx.play((e, t) => { for (let i = 0; i < 4; i++) { const f = base * (1 + [0, 0.12, -0.06, 0.2][i]); tone(e, t + i * 0.07, { f, wave: 'triangle', lp: 1400, peak: 0.035, att: 0.006, dur: 0.06 }); } });
}
// The bell: a big inharmonic ring with a long tail across the water.
export function bell() { Sfx.play((e, t) => ring(e, t, [[146.8, 0.2, 4.5], [293.7, 0.12, 3.2], [349.2, 0.08, 2.4], [440, 0.06, 2], [587.3, 0.05, 1.4], [881, 0.03, 0.9]], { send: 0.6 })); }
// A bell with no clapper only hums.
export function hum() { Sfx.play((e, t) => tone(e, t, { f: 146.8, peak: 0.05, att: 0.2, dur: 1.6, send: 0.3 })); }
export function well() { Sfx.play((e, t) => splash(e, t, 0.25, { send: 0.3 })); }
export function water() { Sfx.play((e, t) => { splash(e, t, 0.05); [1046.5, 1318.5, 1568].forEach((f, i) => tone(e, t + 0.15 + i * 0.12, { f, peak: 0.035, att: 0.01, dur: 0.6, send: 0.5 })); }); }
// The goat: a short bleat, a buzzing tone that wobbles down.
export function goat() {
  Sfx.play((e, t) => { for (let i = 0; i < 5; i++) tone(e, t + i * 0.06, { f: 420 - i * 12, f2: 380 - i * 12, wave: 'sawtooth', lp: 1500, peak: 0.03, att: 0.01, dur: 0.07 }); });
}
// Setting sail, and the lamp lit at last.
export function sail() { Sfx.play((e, t) => { splash(e, t, 0.5, { send: 0.3 }); hiss(e, t + 0.2, { type: 'lowpass', f: 600, q: 0.5, peak: 0.08, att: 0.3, dur: 1.4 }); }); }
export function lit() { Sfx.play((e, t) => [349.2, 440, 523.3, 698.5, 880].forEach((f, i) => tone(e, t + i * 0.16, { f, wave: 'triangle', peak: 0.06, att: 0.01, dur: 1.6, send: 0.6 }))); }
export function dawn() { Sfx.play((e, t) => [440, 554.4, 659.3].forEach((f, i) => tone(e, t + i * 0.25, { f, peak: 0.04, att: 0.08, dur: 1.4, send: 0.5 }))); }
export function click() { Sfx.play((e, t) => tone(e, t, { f: 1200, f2: 900, glide: 0.04, wave: 'triangle', peak: 0.03, dur: 0.05 })); }
