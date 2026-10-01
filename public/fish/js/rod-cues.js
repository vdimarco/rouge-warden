// Small action cues attached to the scene's rod, without a second tackle view.
import { activeLesson } from "./guide.js";
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
const LABELS = { hold: 'Hold rod', back: 'Pull back', cast: 'Flick up!', flight: 'Touch to slow',
  hook: 'Strike! Lift', pump: 'Lift + reel', strength: 'Tip back', land: 'Lift + hold', raise: 'Keep rod up',
  low: 'Lower rod', turn: 'Steer', reel: 'Reel slowly', stop: 'Pause reeling', nibble: 'A nibble…', drag: 'Tighten drag' };
export function createRodCues(game) {
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
    const text = tight && kind !== 'hook' && kind !== 'low' ? 'Ease the line' :
      motion && kind === 'cast' ? 'Flick forward!' :
      kind === 'reel' && /fast|Slack/i.test(cue.text) ? 'Reel faster' : LABELS[kind];
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
