// Sound follows emitted contacts; wipeout presentation never advances gameplay.
export function unplayedEffects(game, afterId) {
  return game.effects.filter(effect => effect.id > afterId);
}
export function advanceWipeout(elapsed, dt, duration = .6) {
  return Math.min(duration, elapsed + Math.max(0, Number.isFinite(dt) ? dt : 0));
}
