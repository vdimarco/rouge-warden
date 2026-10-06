# Design

- jobs.js: `clearEdge(b)` tries the middle and the quarter points of the four sides of the top tier; for each, three fall lines
  (the centre and 0.6 m either side) 1.6 m out from the edge must have nothing under them above `JOB.catch.clear` (3 m), from
  `city.topBelow`. `pickRoof` takes a filter; the edge goes into the offer, and setup uses it.
- portal.js: `toiletMode()` is `mode === "desktop"`. New phases `overflow` (after `gurgle`) and `flush` (after the yank). The rope
  target keeps its id and tag "crack" (the rope and physics plumbing stay the same); in toilet mode `syncTarget` puts it on the
  bowl with an upward normal. `pumped()` calls `startFlush()`; `finishFlush()` calls `finishReveal()`, plays a splash and fades
  in. Skip during the flush finishes it. Lines 6 and 7 of each `intro` list in config.js carry the toilet words.
- cutscene.js: the opening panels last 2.4, 3.2, 2.6, 2.5, 1.8 and 1.8 s.
- portal.js crack: `DECAL.px` 2048, the halo blur scales with it, and the shader steps the line and rim at ±fwidth.

## Checks

- `node qa/vr/action.test.mjs`: 200 job seeds; every Catch! fall ends at street level (3 m or lower) after at least 2.5 s. With the
  old code this check fails.
- A browser run of the flat intro (gurgle, overflow, shoot, yank, flush, play on the start roof); `qa/vr/flat.mjs` (the opening
  reaches the shoot phase and a pull moves it on); `qa/vr/cutscene.e2e.mjs` (the opening comic, now about 14 s).
- Not checked here: a headset (the crack runs only there), sound by ear.
