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

export function streamPreview(adventure, islandWarning = false) {
  return islandWarning || adventure?.phase === 'approach' || ![-1, 1].includes(adventure?.selectedSide);
}

const lateralDirection = (target, current) => Math.abs(target - current) <= .35 ? 'hold' : target < current ? 'left' : 'right';

export function rewardChoiceCue(run, disabled = false) {
  const choice = run?.rewardChoice, adventure = run?.adventure;
  if (disabled || !choice || !adventure || choice.expired || choice.exitIn <= 0) return null;
  if (![-1, 1].includes(adventure.selectedSide) || choice.routeSide !== adventure.selectedSide) return null;
  const hint = run.hint;
  if (hint?.type === 'island') return null;
  const sameGuard = hint?.guardId && hint.guardId === choice.guardId;
  if (Number.isFinite(hint?.in) && hint.in <= 1.35 && !sameGuard) return null;
  // An action-free bank offer is valid only beside a single wildlife guard.
  if (sameGuard && hint.fullStreamGate && choice.family === 'wildlife-bank') return null;
  const lane = Number.isFinite(run.visualLane) ? run.visualLane : run.lane;
  return { ...choice,
    stashDirection: lateralDirection(choice.alternativeLane, lane),
    actionDirection: lateralDirection(choice.entryLane, lane),
    counterpartDirection: lateralDirection(choice.entryLane, lane),
    opposingChoiceDirection: lateralDirection(choice.entryLane, lane),
    guardExitDirection: lateralDirection(choice.exitLane, choice.entryLane),
    returnDirection: lateralDirection(choice.exitLane, choice.collected||choice.counterpartCollected ? lane : choice.alternativeLane),
    actionLabel: choice.action === 'jump' ? 'Jump' : choice.action === 'duck' ? 'Duck' : 'Dodge',
    stashPoints: Math.max(0, Math.floor(choice.baseValue ?? 0)),
    coinCount: Math.max(0, Math.floor(choice.coinCount ?? 0)),
    counterpartLabel: choice.counterpartType==='magnet'?'Gold Boost ×2 · 8s':choice.counterpartType==='shield'?(choice.heldShield?'Shield already held':'Shield · 1 hit'):null,
    actionPoints: Math.max(0, Math.floor(choice.actionBasePoints ?? 0)),
    cleanAtRisk: Math.max(0, Math.floor(choice.cleanBonusAtRisk ?? 0)) };
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
