// Explain a cast request using the same legality and input-buffer rules as the simulation.
// This reads state only. requestCast remains responsible for starting or queuing the spell.
import { canAfford, canReturn, manaCost } from './combat-rules.js';
import { movementSpell, rooted } from './combat-state.js';
import { CAST_BUFFER, lockRemaining } from './combat-tells.js';
import { castTarget } from './sim.js';

const rejected = (reason, message) => ({ outcome: 'rejected', reason, message, returning: false });

export function castFeedback(s, e, slot, aim, { bot = false } = {}) {
  if (!e || e.kind !== 'hero' || ![0, 1, 2, 3].includes(slot)) return rejected('invalid', 'Choose a spell.');
  if (s.winner !== null) return rejected('match_ended', 'The match has ended.');
  if (e.hp <= 0) return rejected('dead', 'Wait to respawn.');
  if (!e.skillRanks[slot]) return rejected('unlearned', 'Learn this spell first.');
  if (e.stun > 0) return rejected('stun', 'Stunned. Wait to cast.');
  if (e.fear > 0) return rejected('fear', 'Feared. Wait to cast.');
  if (e.silencedUntil > s.time) return rejected('silence', 'Silenced. Wait to cast.');
  if (e.tauntUntil > s.time) return rejected('taunt', 'Taunted. Wait to cast.');
  if (rooted(s, e) && movementSpell(e, slot)) return rejected('root', 'Rooted. Cannot use a movement spell.');

  const returning = slot === 0 && !!canReturn(s, e);
  const ready = returning || e.cd[slot] <= 0 && canAfford(e, slot);
  const left = lockRemaining(s, e);
  if (e.castIntent || e.recoveryUntil > s.time) {
    // requestCast returns false for a buffered press even though it stores the spell.
    if (!bot && ready && left > 0 && left <= CAST_BUFFER + 1e-9)
      return { outcome: 'queued', reason: null, message: 'Spell queued.', returning };
    if (!ready && e.cd[slot] > 0) return rejected('cooldown', `Ready in ${Math.ceil(e.cd[slot])}s.`);
    if (!ready) return rejected('mana', `Need ${Math.ceil(manaCost(e, slot) - e.mana)} more mana.`);
    return e.castIntent ? rejected('castIntent', 'Finish the current spell first.') : rejected('recovery', 'Recovering. Wait to cast.');
  }
  if (returning) return { outcome: 'accepted', reason: null, message: 'Return to your decoy.', returning: true };
  if (e.cd[slot] > 0) return rejected('cooldown', `Ready in ${Math.ceil(e.cd[slot])}s.`);
  if (!canAfford(e, slot)) return rejected('mana', `Need ${Math.ceil(manaCost(e, slot) - e.mana)} more mana.`);
  if (slot === 2 && [0, 8].includes(e.hero)) {
    const target = castTarget(s, e, slot, aim);
    if (!target || ['tower', 'core'].includes(target.kind)) return rejected('no_target', 'Aim at a visible enemy in range.');
  }
  return { outcome: 'accepted', reason: null, message: 'Ready.', returning: false };
}
