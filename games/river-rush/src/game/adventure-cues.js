// Route previews are secondary to the action the raft actually needs next.
export function adventureCue(run, disabled = false) {
  const adventure = run?.adventure;
  if (disabled || !adventure) return null;
  const hint = run?.hint, hazardIn = hint?.in;
  // The island warning is the stream choice itself; keep both routes readable.
  if (hint?.type === 'island' && adventure.phase === 'approach') return adventure;
  if (Number.isFinite(hazardIn) && (hazardIn <= 1.35 ||
      (adventure.phase === 'approach' && hazardIn + .08 < adventure.in))) return null;
  return adventure;
}

export function islandGesture(action) {
  return action === 'island' ? { gesture: 'lanes', label: 'Choose a stream', hint: 'Swipe left or right' } : null;
}

export function adventureRouteCue(route) {
  const risk = route?.role === 'risk';
  const total = Math.max(0, Math.floor(route?.totalClears ?? 0));
  const clears = Math.min(total, Math.max(0, Math.floor(route?.cleanClears ?? 0)));
  const base = Math.max(0, Math.floor(route?.basePoints ?? 0));
  const bonus = Math.max(0, Math.floor((route?.maxPoints ?? base) - base));
  const eligible = route?.cleanEligible !== false;
  const collected = !!route?.collected;
  const earned = collected ? Math.max(0, Math.floor(route?.earned ?? 0)) : null;
  return { risk, total, clears, base, bonus, eligible, collected, earned };
}
