// Small action cues attached to the scene's rod, without a second tackle view.
import { activeLesson, moveWords, inputOf } from "./guide.js";
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const UP = 'M20 34V8m-8 8 8-8 8 8';
const DOWN = 'M20 8v26m-8-8 8 8 8-8';
const ICONS = {
  hold: 'M12 20a8 8 0 1 0 16 0a8 8 0 1 0-16 0',
  back: DOWN, cast: UP, hook: UP, pump: UP, strength: UP, land: UP, raise: UP, low: DOWN,
  turn: 'M5 20h30M12 13l-7 7 7 7m16-14 7 7-7 7',
  reel: 'M31 12a14 14 0 1 0 2 15M31 4v9H22',
  stop: 'M14 9v22m12-22v22', flight: 'M8 25q12-26 24 0m-8-2 8 2 1-8',
  nibble: 'M7 20q13-16 26 0q-13 16-26 0m0 0-4-7v14l4-7',
  drag: 'M8 20h24M20 8v24',
};
// the cast cues; the fight cues use the same words as the prompt and the guide (MOVE_WORDS in guide.js)
const LABELS = { hold: 'Hold rod', back: 'Pull back', cast: 'Flick up!', flight: 'Touch to slow', nibble: 'A nibble…' };
export function createRodCues(game) {
  const touchDevice = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const el = document.createElement('div');
  el.id = 'rodCue'; el.hidden = true;
  el.innerHTML = `<svg class="rod-ring" viewBox="0 0 96 96" aria-hidden="true"><circle class="rod-halo" cx="48" cy="48" r="35"/><circle class="rod-tension" cx="48" cy="48" r="35" pathLength="100"/></svg><svg class="rod-action" viewBox="0 0 40 40" aria-hidden="true"><path/></svg><span role="status" aria-live="polite"></span>`;
  game.append(el);
  const label = el.querySelector('span'), path = el.querySelector('path'), tension = el.querySelector('.rod-tension');
  const cast = game.querySelector('#reelBox'), pad = game.querySelector('#padBox'), crank = game.querySelector('#crankBox');
  let key = '';
  return { update({ world, phase, step, motion, paused, cue, fish, nibble, held }) {
    el.hidden = paused || !['cast', 'reel'].includes(phase);
    if (el.hidden) { crank.dataset.cue = ''; return; }
    const anchor = world.rodAnchor();
    // During lure flight the camera leaves the rod behind. Keep feathering reachable.
    const x = clamp(anchor.x, 72, game.clientWidth - 72), y = clamp(anchor.y, 128, game.clientHeight - 90);
    for (const hit of [cast, pad]) {
      hit.style.left = (x - 64) + 'px'; hit.style.top = (y - 80) + 'px';
    }
    el.style.left = x + 'px'; el.style.top = y + 'px';
    let kind = activeLesson({ phase, step, motion, fishPhase: fish?.phase, cue });
    if (phase === 'reel' && nibble && ['sink', 'retrieve'].includes(fish?.phase)) kind = 'nibble';
    const tight = phase === 'reel' && (fish?.tfrac || 0) > .85;
    // the crank goes at the pace the prompt gives with the cue (fast for slack line or a charge, slowly when the lure runs
    // away from a fish, steadily for a tired fish), the same words as the guide; with no pace it is the reel move. A steer
    // the prompt gives a side to ("Drag the rod right.") says the same side here
    const text = motion && kind === 'cast' ? 'Flick forward!' : LABELS[kind] ||
      (kind === 'turn' && /^(Tilt the phone|Drag the rod) (left|right)\.$/.test(cue.sub) ? cue.sub :
      moveWords(kind, inputOf(motion, touchDevice), 0, phase === 'reel' ? cue.pace : '') || LABELS.hold);
    const next = `${kind}:${text}:${cue.tone}:${tight}:${held}`;
    if (key !== next) {
      key = next; el.dataset.cue = kind; el.dataset.tone = tight || kind === 'hook' ? 'hot' : cue.tone;
      el.dataset.held = String(held); path.setAttribute('d', ICONS[kind] || ICONS.hold);
      label.textContent = text;
      crank.dataset.cue = phase === 'reel' && kind === 'reel' ? 'reel' : '';
    }
    tension.style.strokeDasharray = `${clamp(fish?.tfrac || 0, 0, 1) * 100} 100`;
  } };
}
