# Longer, faster rapids

The three courses finish at 2,800 / 3,600 / 4,400 m. Starting speeds are
52 / 62 / 72 m/s, with caps of 68 / 80 / 92 m/s. Obstacle spacing and the first
teaching hazard preserve reaction time; jump, duck and steering timings remain
the same. A complete adventure totals 10,800 m. Existing version-3 best scores
and version-1 map unlocks remain valid.

Redstone's sky now contains atmosphere only. Three bounded, prepared layers of
textured canyon mesas occupy course coordinates, so perspective and fog give
them appropriate depth as the near banks approach. The fallback uses prepared
distant silhouettes without a painted foreground river. Current advection is
26 m/s and wave cadence is 15% faster; the CPU buoyancy probes and GPU waves
share the same coefficients. The raft still travels faster than the current.

Ordinary coins use the raft's visible position at the exact longitudinal
crossing, with a quarter-lane center tolerance. Selecting a lane before reaching
it no longer awards its coins. Misses travel past without pickup effects;
raised coins require a jump. Magnet and Rush remain explicit attraction powers.

The public leaderboard API and the isolated `river_rush_scores` constraint and
guest-insert policy accept distances through 10,800 m. The migration in
`leaderboard-longer-rivers.sql` keeps existing rows and permissions. It does not
reset scores or map progress.

Checks can be reproduced with:

```sh
npm test --prefix games/river-rush
npm run build:arcade --prefix games/river-rush
# Serve public on port 8765 and the game's Vite source on port 3001.
node qa/river-rush/longer-rapids.mjs
node qa/river-rush/adventure.mjs
```

The focused suite separates source simulation fixtures from actual browser
input and rendered map checks. The campaign check plays all three maps through
ordinary keyboard actions and captures each finish. Exact results, resource
budgets, deployed bundle and live storage checks are recorded in
`longer-rapids-verification.json`. Headless software WebGL checks do not establish
frame rates on physical phones.
