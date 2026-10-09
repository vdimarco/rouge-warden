// A short guide follows actions in a live match. It never pauses the battlefield.
export const FIRST_MATCH_KEY = 'tidebreak.first-match';
const STEPS = ['learn', 'move', 'aim', 'push'];
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const position = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null;
export function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }
function read(storage, key) { try { return storage?.getItem(key); } catch { return null; } }
function remember(storage, value) { try { storage?.setItem(FIRST_MATCH_KEY, value); } catch {} }

// Old match records count too, so returning players do not receive a new tutorial.
export function hasMatchExperience(storage = browserStorage()) {
  try { if (Number(JSON.parse(read(storage, 'monster-mash.record'))?.matches) > 0) return true; } catch {}
  return ['complete', 'skipped'].includes(read(storage, FIRST_MATCH_KEY));
}

// onStep receives {step, outcome}; callers can show the view and record transitions.
// notify('aim') means a drag actually left the icon. notify('cancel') means a
// deliberate return to the icon. A successful keyboard cast teaches desktop aim.
export function createFirstMatchGuide({ storage = browserStorage(), inputType = 'touch', onStep = () => {} } = {}) {
  let active = false, dismissed = hasMatchExperience(storage), index = 0, previous = null, moved = 0, aimed = false, warning = false;
  let learnedKey = 'Q';
  const input = () => ['desktop', 'mouse', 'keyboard'].includes(typeof inputType === 'function' ? inputType() : inputType) ? 'desktop' : 'touch';
  const emit = outcome => onStep({ step: STEPS[index] || 'complete', outcome });
  const finish = () => { active = false; dismissed = true; index = STEPS.length; remember(storage, 'complete'); emit('completed'); };
  const advance = () => { emit('completed'); index++; aimed = false; if (index === STEPS.length) finish(); else emit('shown'); };
  function view() {
    const desktop = input() === 'desktop', step = STEPS[index] || 'complete';
    const prompts = {
      learn: ['Learn a spell', desktop ? 'Click + above a spell to learn it. Basic attacks already work.' : 'Tap + POINT, then a spell icon. Basic attacks already work.'],
      move: ['Move your hero', desktop ? 'Use WASD or click the ground to move.' : 'Drag on the battlefield to move. Tap an enemy to select it.'],
      aim: ['Aim a spell', desktop ? `Point at the battlefield and press ${learnedKey}. Or drag a spell and return to its icon to cancel.` : 'Drag a learned spell to aim. Return to its icon to cancel.'],
      push: ['Push with wisps', warning ? 'Step out of tower range. Push with your wisps.' : 'Follow your wisps. They take tower fire while you attack.'],
      complete: ['Ready to hunt', 'Use Control guide in the menu to show these tips again.'],
    };
    const [title, text] = prompts[step];
    return { active, step, title, text, progress: Math.min(index + 1, STEPS.length), total: STEPS.length };
  }
  function reset(p) { index = 0; previous = position(p); moved = 0; aimed = warning = false; learnedKey = 'Q'; }
  function begin(p) { reset(p); active = !dismissed; if (active) emit('shown'); return view(); }
  function show(p) { reset(p); active = true; emit('shown'); return update(p); }
  function skip() { if (active) { emit('skipped'); active = false; dismissed = true; remember(storage, 'skipped'); } return view(); }
  function notify(action, detail = {}) {
    if (!active || STEPS[index] !== 'aim') return view();
    if (action === 'aim') aimed = true;
    if ((action === 'cancel' && aimed) || (action === 'cast' && input() === 'desktop' && detail.accepted === true)) advance();
    return view();
  }
  function update(p, { units = [], towerThreat = false, paused = false } = {}) {
    const here = position(p);
    if (!active) return view();
    if (!p || p.hp <= 0 || p.recall || paused) { previous = null; return view(); }
    const learned = (p.skillRanks || []).findIndex(rank => rank > 0);
    if (learned >= 0) learnedKey = ['Q', 'E', 'C', 'R'][learned];
    if (STEPS[index] === 'learn' && learned >= 0) advance();
    if (STEPS[index] === 'move' && previous && here) {
      const delta = gap(previous, here);
      // Recall, gate jumps and respawns do not teach walking.
      if (delta <= 250) moved += delta;
      if (moved >= 80) advance();
    }
    previous = here;
    if (STEPS[index] === 'push' && here) {
      const wards = units.filter(u => u.kind === 'tower' && u.team !== p.team && u.team >= 0 && u.hp > 0);
      const wave = units.filter(u => u.kind === 'minion' && u.team === p.team && u.hp > 0);
      warning = !!towerThreat || wards.some(t => gap(p, t) < (t.range || 0) + 60 && !wave.some(w => gap(w, t) < (t.range || 0) + 150));
      if (!warning && wards.some(t => gap(p, t) < (t.range || 0) + 400 && wave.some(w => gap(w, t) < (t.range || 0) + 150 && gap(p, w) < 600))) advance();
    }
    return view();
  }
  return { begin, update, notify, skip, show, view };
}
