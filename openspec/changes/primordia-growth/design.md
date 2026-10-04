# Design: Eat to Grow

Spine: the Food Chain design (8 from each of the fun, feasibility and coherence judges). Grafts: Lab 1's two-phase zoom recipe, centred on the player with a camera roll; the outward molt wave and the red-to-cyan crossfade while bodies are still big; outgrow at half the bar; two Orbium per heavy hunter; a relay pair for Size IV; Lab 2's colour rules. Dropped: new Lenia species, tamed hunters on channel B, synchronised pincers, shells, foragers, spillers, agar floors, a boss on every size, a feast state, and size penalties on speed or hunger.

Internal names stay: `epoch` is the size index in code, so every per-epoch ramp keeps working. Player-facing text says SIZE.

Anything marked **ASSUMPTION** was not measured by either lab. Section 10 lists how to test each one before the feature that depends on it is built.


## Departures from the workflow design (found while building)

- **No torus roll.** The old dish maps about its own centre (`x' = w/4 + x/2`), the fallback that section 10 lists. The torus makes this physics-identical, the picture at 2x is still exact, and the renderer needs no camera offset. The player keeps their spot in the old dish instead of moving to the grid centre; converted prey are still placed around the player, and the first wave of a new size still arrives outside the old dish.

---

## 1. Pitch

Eat to grow: every meal fills your GROW bar and swells your cell. When the bar is full, the whole petri dish shrinks into the middle of a dish twice its size, and the red hunters you were fighting turn into cyan prey. Then a bigger red hunter with one new move swims in from the fresh edge.

---

## 2. The loop

**Size start (Size I, or right after a card pick).** You are a small cell at the centre of the dish. From Size II on, up to six cyan Orbium glide around you: the hunters you just outgrew. The first time a species converts in a run, one of them carries a FOOD ring labelled "was Paraptera". Nothing attacks for 4 seconds. A banner names the new red hunter and its move in one sentence.

**Waves arrive.** Reticles appear in the new territory outside the old dish's area. Size I keeps its current table: waves at 2, 12 and 24 seconds. Later sizes open with a 4-second calm, so their waves come at about 4, 14 and 26 seconds, or 5 seconds after the last wave clears. From 40 seconds into a size, a new wave from that size's roster arrives every 14 seconds until the bar fills. The encore still fills an empty dish.

**Moment to moment.** The combat does not change. Eat prey, read lanes, dash to cut, Glory Bite gold hunters, parry glints into Stasis, fire Burst. Every meal now also pops a cyan "+N" at the meal, adds a segment to the GROW bar and plays a chime that rises with the bar. Your body eases bigger after each meal. Hunter kills fill the bar fastest.

**Half the bar: outgrow.** At 50% the bar's notch flashes and a ring pulses out from you. Discutium swarms, small brood and eggs get a gold dashed ring. Swarms turn and swim away and stop stinging. Your mouth swallows a swarm body whole, or pops an egg, on contact. A one-time tip says: "You are bigger than the swarms now. Eat them."

**Full bar.** The bar turns gold and pulses, and you get 0.8 seconds of i-frames. The dish grows 0.25 seconds later, as long as at least one red hunter is on the dish and no Burst is running. If no red hunter is there, the director sends one of the size's hunters at once and the dish grows as soon as it has arrived (at most 4 seconds of waiting). It arrives just in time to be outgrown.

**Apex sizes (III, VI, IX).** A full bar reads APEX and summons the Leviathan with its 3-second warning and the banner "LEVIATHAN / Eat it to grow." Other waves wait. The fight is the same three-phase fight as now. Devouring it (after its 0.8 s slow motion) grows the dish and guarantees a Duo card. If it leaves the dish any other way, the dish grows with no bonus.

**The dish grows (1.95 seconds, no input, frozen dish).**
1. 0.00-0.40 s: the view slides on the torus so you sit at the screen centre. A cyan ring runs out from you, and every red body it passes turns cyan while it is still full size. A rising swell plays.
2. 0.40 s: the whole dish shrinks into its middle quarter in one frame. The picture does not move, because the camera is now at 2x.
3. 0.40-1.60 s: the camera pulls back from 2x to 1x at a steady rate. Fresh teal agar slides in from every edge. The frozen old dish, now a quarter of the area, shows its old scars and its shrunken, cyan-tinted hunters. Old prey break into light motes that stream into you. The low-pass filter opens, so the dish sounds wider.
4. 1.60 s: each shrunken hunter is replaced by a living, full-size Orbium with a cyan pop and a pluck, 60 ms apart. Your body pops up to the new size's base radius.
5. 1.95 s: the mutation cards appear over the bigger dish under "YOU GREW · SIZE II". The first time, the line under it reads "The dish grew. Old hunters are food now."

**Card pick.** +30 light, +10 max light (up to 150), full dash charges. The banner reads, for example, "SIZE II / New hunter: Pentapteryx. It strikes twice." Back to the size start.

**Run end.** Light reaches zero. The results show SIZE IV (in Roman numerals) in place of EPOCH, next to score, hunters eaten, Glory Bites, parries and best chain. The best size is saved next to the best score.

---

## 3. Player growth

### The meter

The GROW bar holds whole growth points (GP). It fills only by eating and killing, and only in play mode. Each size has its own bar length. Inside a size, `g = GP / bar` runs from 0 to 1.

| Source | GP |
|---|---|
| Orbium devoured (including Remains) | 1 |
| Golden Orbium devoured | 4 |
| Converted Orbium (an old hunter) devoured | 3 |
| Egg popped | 1 |
| Discutium or brood kill, any route, including an outgrow gulp | 2 |
| Lancer (Paraptera, Pentapteryx) by Glory Bite or Burst | 5 |
| Lancer by bleed-out or rupture | 3 |
| Heavy (Hexapteryx, common Heptapteryx) by Glory Bite or Burst | 7 |
| Heavy by bleed-out or rupture | 4 |
| Leviathan | opens the apex gate |

GP gained while the bar is already full pays 50 points each instead.

**Calibration (estimate, from the existing c1-c4 bot logs in the scratch folder).** Applying this table to the current build's ref bot kills over 160 s gives 64-67 GP a minute (seeds 7 and 23 landscape, 11 portrait). In the first 40 s the rate is lower, about 36-42 GP. The blind bot earns 25 GP in the 60 s before it starves. So a 34-point Size I bar takes the ref bot about 35 s, and the blind bot never fills it. Hunters give 60-64% of the ref bot's growth. **ASSUMPTION:** the bigger mouth, outgrow gulps and husks will raise these rates. Tune bar lengths first, then the weights.

### Sizes

`P.r = base(n) x (1 + 0.5 g)`, where `base(n) = 2.4 x 1.08^(min(n, 5) - 1)`. Within a size the body grows 1.5x. Across sizes the base grows 8% until Size V. At the zoom the body shrinks with the world to 0.75 of the old base (in new cells), then pops to the new base, 1.08 of the old base. Against the dish, the player jumps about 1.44x at each zoom and never looks half as big.

| Size | Bar (GP) | Radius, empty to full (cells) | Mouth, empty to full | Cut radius at full | Max light | Hunger /s |
|---|---|---|---|---|---|---|
| I | 34 | 2.40 to 3.60 | 3.70 to 5.01 | 4.90 | 100 | 3.00 |
| II | 40 | 2.59 to 3.89 | 3.92 to 5.32 | 5.09 | 110 | 3.24 |
| III | 46 | 2.80 to 4.20 | 4.15 to 5.63 | 5.29 | 120 | 3.48 |
| IV | 52 | 3.02 to 4.53 | 4.40 to 5.96 | 5.50 | 130 | 3.72 |
| V+ | 56 | 3.27 to 4.90 | 4.66 to 6.32 | 5.72 | 140, then 150 | +8% per size |

The player is drawn at 1.3x its radius, as now: about 19 px across at the start of Size I on a 390 px phone, 28 px at the end of it.

### What size changes

- **Mouth:** `3.7 x (P.r / 2.4)^0.75 x Wide Maw`, capped at 8 cells, then x1.55 in Burst. Prey drain faster and Glory Bites reach farther.
- **Dash cut radius:** `(4 + 0.5 x Long Rend) x sqrt(P.r / 2.4)`. The 22% tear cap per dash per hunter stays, because the earlier lab showed that cuts of 28% or more kill a hunter outright.
- **Hitbox:** stings, lunge hits and the parry probe already test against `P.r`, so a bigger body is easier to sting and easier to parry with. This is the intended trade. **ASSUMPTION:** if the last quarter of the bar takes more than twice the contact plus lunge damage of the first quarter, set `hitShare` to 0.5 so the probes use `2.4 + 0.5 (P.r - 2.4)`.
- **Unchanged:** swim speed (31 cells/s), dash speed and time, charges, Burst reach and hunger. A bigger body covers fewer body lengths per second and reads as heavier. Hunger keeps its per-size ramp with no size multiplier.
- **Outgrow at g = 0.5:** Discutium, brood under 200 mass, and eggs become edible. Swarms and brood flee at 0.22 cells/step plus 0.06 orbit, clamped at 0.30, within 70 cells (Lab 2 flee test: Discutium and every in-game arc kept 0.94-1.25 of their mass for 1500 steps under this exact move). Edible bodies never sting. Mouth contact devours a swarm or brood body at once (how: "gulp": full base points, 6 light, 2 GP) and pops an egg (1 GP).

### TUNE entries

```js
grow: {
  bar: [34, 40, 46, 52, 56],             // GP per size; the last value repeats
  gp: { prey: 1, golden: 4, husk: 3, egg: 1, swarm: 2, lancer: 5, lancerBleed: 3, heavy: 7, heavyBleed: 4 },
  overflowPoints: 50,
  base: 2.4, basePerSize: 1.08, baseCapSize: 5, swell: 0.5,   // P.r = base * basePerSize^(min(n,5)-1) * (1 + swell*g)
  maw: { exp: 0.75, cap: 8 }, cutExp: 0.5, hitShare: 1.0,
  ease: 0.3, gulp: 0.12,                  // shell: radius eases 0.3 s with a 12% bulge
  maxLight: { perSize: 10, cap: 150 },
  notch: 0.5, edibleMass: 200,
  flee: { v: 0.22, orbit: 0.06, clamp: 0.30, range: 70 },
  ripe: { delay: 0.25, bossDelay: 1.0, wait: 4, minRed: 1, iframes: 0.8 },
  seq: { roll: 0.30, sweep: 0.40, begin: 0.40, finish: 1.60, cards: 1.95 },  // grow clock, seconds
  zoom: { dmin: 28, rmin: 16, refill: 20, maxNew: 6, remainsAge: 6 },
  heading: { horizon: 120, every: 8, speed: 0.65, trail: 60, passes: 3, agarMin: 0.985, agarK: 400, outward: 3 },
  husksPerHeavy: 2,
  motes: { light: 2, max: 10 },
  sizeBonus: 2000, huskPoints: 200,
  feast: 4, wave1: { min: 34, max: 70 },
  loop: { from: 40, every: 14 },
  goldenLate: { after: 60, every: 12 },
  apexEvery: 3, apexEscape: null,         // seconds; null = never. Set 90 only if playtests stall at the Leviathan.
},
```

---

## 4. The dish expands

The grid stays 256x128 (128x256 in portrait). There is no new kernel, rule, channel or texture size. The zoom is a field resample plus bookkeeping, run in two phases with the game paused between them. This is Lab 1's `zoomBegin` / `zoomFinish` from `scratchpad/grow/final.mjs`, with `place()` and `chooseHeadings3()` from `lib.mjs`.

### Trigger

Core sets `ripe` when the bar fills (`g >= 1`) in play mode with `growHold` off. While ripe, in the play state, `checkRipe(dt)` fires `startGrow()` when all of these hold:

1. No Leviathan is alive, pending, queued or claimed (`director.bossOut` false and no boss in hunters, pending, claims or queue). On apex sizes a full bar summons the boss instead, and ripe starts again only once it has left the dish.
2. No Burst is running.
3. `ripeT >= 0.25 s` (1.0 s after a Leviathan devour, so its slow motion and banner play).
4. At least one named, non-egg red hunter is tracked, or `waitT >= 4 s`, where `waitT` counts only while no Burst runs. Not required after a Leviathan, whose Remains and brood carry the beat.

While ripe and waiting for a red hunter, the director skips relax beats, and if no named hunter is alive or pending it queues one unit of the size's headline species at once. Lab 1 found 0 to 3 live hunters at random moments and none in 9 of 18 snapshots, which is why this rule exists. **ASSUMPTION:** median wait 1.5 s or less, at least one converted hunter in 90% of zooms.

### Grow clock

`startGrow()` sets `state = "grow"`, `growT = 0`, records `rx = round(P.x)` and `ry = round(P.y)`, and emits `growStart { x, y, rx, ry }`. In the grow state `update(dt)` only advances `growT` and runs the phases when `growT` crosses their times. It never calls `World.step`, `track`, the director, hunger, damage or `this.time += dt`. Lab 1 measured what a live pull-back does: 16 dissolve events in 8 zooms, 4 prey and 2 hunters stamped into the frozen world, an epoch ending, and a tracked hunter (massB 586) wiped by the finish. Paused, the result is the same as an instant zoom by construction.

### Phase 0: roll (growT 0 to 0.40, shell only)

The shell eases a camera offset over 0.30 s (smoothstep) so the cell `(rx, ry)` lands at the screen centre: `ox = wdelta(rx - w/2, w) / w`, same for y. The textures use REPEAT, so the dish wraps across the screen edges. Overlays use the same wrapped transform. Easing to the rounded cell, not to `P.x`, makes the swap in phase 1 exact to the pixel. The old torus seam now lies at the screen edges.

During 0 to 0.40 s the molt wave runs: a render-only uniform `uConvert = (px, py, R, 1)` with R eased from 0 to 150 cells (the farthest torus point from the player is 143 cells). Hunter tissue inside R blends to the prey colours. The simulation never moves B into A: Lab 1 measured 0-4% survival when hunter tissue is simulated as prey.

### Phase 1: zoomBegin (growT = 0.40, one frame)

Lab 1 in play: 2.7 ms median, 4.4 ms max, of which the resample is 0.18-0.21 ms.

1. **Map.** `cx = w/2`, `cy = h/2`. In cell-index coordinates (the same convention as `findBlobs` centroids), `map(x, y) = (wrap(cx + wdelta(x - rx - 0.5, w)/2), wrap(cy + wdelta(y - ry - 0.5, h)/2))`. The player uses `cx + wdelta(P.x - rx, w)/2` so it is drawn in the same screen spot before and after the swap. The player then sits within half a cell of the grid centre.
2. **Conversion list,** built before anything is cleared. Each source keeps its mapped centroid and a `from` name.
   - Golden prey alive with mass over 30: carried, stay golden.
   - Named, non-egg hunters, including brood, plus hunter claims stamped this frame. Hexapteryx and common Heptapteryx give 2 sources at the same point, other bodies 1.
   - Remains younger than 6 s (prey tagged `remains`, plus prey claims with that tag): carried as converted prey.
   - Priority for the cap of 6: golden, heavy arcs, lancers, Remains, brood, Discutium.
   - Eggs vanish with no pop credit. The shell gets their mapped points for small pink puffs.
   - Count the other old prey: `motes = min(5, count)`. Credit `2 x motes` light now, in core. Emit their mapped points so the shell can stream motes into the player.
3. **Resample** A, B and N together in one pass with `World.zoomOut(rx, ry)`: new cell `(cx - w/4 + X, cy - h/4 + Y)` = mean of the old 2x2 box at `(rx - w/2 + 2X, ry - h/2 + 2Y)`, wrapped. Outside the middle quarter, A = B = 0 and N = 1. Reuse scratch buffers. The half-scale tissue is a picture only. Lab 1 (exp3): every species and Orbium at half scale dies on its own in 7-12 steps and never grows, so it cannot be kept alive anyway.
4. **Forget every tracked body directly.** Do not call `track()` on the old bodies. Lab 1 measured that the naive version fired `waveClear` 0.02 s after every zoom, paid 500 x epoch, started a relax beat and queued 2 prey (both golden twice). Reading `track()`: unmatched cut hunters would earn bleed credit (their half-scale mass is a quarter of their peak), other named hunters would count as self-deaths, bitten prey would count as devoured, golden prey would emit `fade`, a big blob near `lastCut` would become brood, and old claims would tag any new blob within 16 cells for 2 s. So:
   - `prey = []`, `hunters = []`, `claims = []`, `pending = []` (spawn warnings and pending prey are cancelled, since their spots no longer exist), `labelB = null`, `ownerOf = []`, `lastCut = null`.
   - Director: keep only a boss in the queue (there is none, by the trigger rule) and recompute `bossOut`. Mark every spawned, uncleared wave as cleared with `clearAt = epochTime` and no bonus, relax beat or prey.
   - Player: map `x, y`; set `px, py` to the mapped point, or the next `cutAlong` slices across the dish; halve `vx, vy`; end any dash (`dashT = 0`, `cutting = false`, `dashEnded = false`) and clear `dashTorn`, `kicked` and `cutLog` with no cut events; `rally = null`.
   - Burst: set `burstT = 0` and emit `burstEnd` directly. `endBurst()` would grant a relax beat, which does not matter but is noise. Stasis: `stasisT = 0`, emit `stasisEnd`. `hitstop = 0`, `freezeLog = []`, `dashBuffer = burstBuffer = 0`, `simAcc = 0`.
   - World: `toxin.A = toxin.B = 0`, `purge.A = purge.B = false` (Lab 1 diag3: a prey purge in progress, toxin A at 0.12, killed the new Orbium). `bloom = tide = false`.
   - `fieldDirty = true`, so the renderer uploads both textures and never blends old and new frames.
5. **Size step.** `epoch++`, `growth = 0`, `ripe = false`. `oldBox = { cx, cy, hw: w/4, hh: h/4 }`. `stats.zooms++`. `P.r` becomes `base(n+1)`; the shell keeps showing the old radius halved and eases it later.
6. Emit `zoomBegin { rx, ry, cx, cy, eggs: [...], motes: [...], converted: n }`. The shell maps its particles, trail, rings and popups through the same map, clears lanes, reticles and cut counts, and sets the camera to `z = 0.5`, offset 0.

At `z = 0.5` the screen shows exactly the middle quarter of the new grid, which is the old dish centred on the player, so the picture does not jump. The torus seam opposite the player now lies on the box edges, where the old screen edges were. A body that straddled it shows as two halves on opposite box edges for 1.2 s. That is cosmetic; phase 2 wipes it.

### Pull-back (growT 0.40 to 1.60, shell only)

`z = 0.5 x 2^e`, `e = smootherstep((growT - 0.40) / 1.2)`: a steady rate on a log scale, so it never seems to speed up or stall. The shader samples `uv = 0.5 + off + (vUv - 0.5) x z`. The quad stays the normal dish rect, so the zoom never spills under the HUD and needs no scissor. The rim vignette stays in screen space. A thin cyan rectangle on the old box edge is drawn on the fx canvas and fades out over the first second after play resumes.

### Phase 2: zoomFinish (growT = 1.60, one frame)

Lab 1 in play: 2.3-2.9 ms median, 7.6 ms max (JIT warm-up included).

7. `A.fill(0)`, `B.fill(0)`. Old prey and hunter tissue at half scale are gone. Lab 1 (exp4, crowded states, Orbium alive at 100 steps): leaving half-scale hunter tissue in B dropped survival to 33-38%, because B eats A at 0.6 per step; leaving old half-scale prey in A dropped it to 46-63%.
8. **Place** at most 6 sources about the player's position (the `placeAround` shift of Lab 1's `place()`): at least 28 cells apart centre to centre, at least 16 cells from the player, 60 relaxation passes, and drop any that still sit closer than 0.95 x 28. Lab 1 (exp2, diag1): pairs closer than 26 cells grow tissue between them and both die; diverging pairs at 26-36 cells live 2 of 2.
9. **Refill agar** to N = 1 in a radius-20 disc at each placed point. Lab 1 (agar.mjs): a newborn Orbium lives on mean agar of 0.97 or more over radius 20 (4 of 4) and dies at 0.95 or less (0 of 4); a radius-12 disc fails even at 0.97; a floor of 0.8 changed nothing. The refill raised survival at 100 steps from 54-75% to 79-100%. The middle quarter's resampled agar averages 0.969-0.999 with lows of 0.44-0.80, so the local refill is what matters.
10. **Choose headings** with `chooseHeadings3`: right-angle stamps only (q x 90 degrees, glide at q x 90 + 67.8 degrees), greedy search in 3 passes over a 120-step horizon sampled every 8 steps at 0.65 cells/step. Score: the closest approach to the others' bodies and their last 60 steps of trail (+4 cells allowance on trail points), capped at 60; minus 400 x max(0, 0.985 - lowest 3x3 agar ahead); plus 3 x cos(heading - away from the grid centre). Lab 1 (exp9, 64 Orbium from 16 crowded states): 94-100% alive at 100 steps against 81-88% for plain outward headings. It costs 0.52 ms.
11. **Stamp** ORB at scale 1. Push prey claims tagged `{ stamped: true, converted: !golden, golden, from }`. Converted prey are not Remains: they do not fade.
12. Recompute `massA`, set `massB = 0`, call `track("prey")` and `track("hunter")`, set `fieldDirty`. Add `sizeBonus x epoch` to the score. Emit `zoomFinish { at: [{ x, y, from }] }`.

### Cards (growT = 1.95)

`offerCards()` (the old `endEpoch()` minus its own Burst and Stasis ending, which phase 1 already did) sets `state = "mutate"` and builds the offer with the same rules. An empty offer, or `noCards` in the intro, calls `startSize(null)` at once.

### startSize(m), the old nextEpoch minus `epoch++`

+30 light, max light +10 up to 150, full charges, a fresh director with `relaxT = 4` (Sizes II and up), `state = "play"`, emit `epochStart`. The boss carry-over is deleted, because a size cannot end while the boss lives. The Size II+ first wave spawns outside `oldBox` when a clear spot 34 to 70 cells from the player exists, otherwise by the normal rule. The player is at the centre of a box that is 128x64 (64x128 in portrait), so the ring at 34-48 cells already reaches outside it on the short sides.

### Everything else at the swap

| Thing | What happens | Why |
|---|---|---|
| Old hunters | Become Orbium at their mapped centroids (2 per heavy), cap 6 | Half-scale tissue dies in 7-12 steps; Orbium is the only living prey creature |
| Old prey | Dropped. 2 light each (max 10) credited in core, shown as motes into the player | Cannot live at half scale and crowds the new Orbium |
| Golden prey | Re-stamped golden | Keeps the player's prize; Lab 1 carried them in the same way |
| Fresh Remains | Re-stamped as converted prey | The Glory Bite that filled the bar keeps its payoff; the Leviathan's three Remains become the next size's food |
| Eggs | Vanish, no credit, pink puff | Circium at half scale has mass 19 and dies in 10 steps |
| Brood | Converts like a hunter | It is a named body |
| Pending spawns and warnings | Cancelled; their waves count as cleared, no bonus | Their spots no longer exist |
| Director queue | Emptied (no boss can be in it) | Same |
| Burst | Ends; the meter stays as it was | No hunters left to hunt |
| Stasis | Ends | The grade would hang over the cards |
| Dash | Ends with no cut events | Stops a cut across the whole dish |
| Hit-stop and buffers | Cleared | Nothing should play out after the swap |
| Toxin and purge | Reset | A running purge kills the new Orbium |
| Combo | Kept; its timer pauses in grow and mutate | Real-time timers do not run while paused |
| Score | No kill, bleed, rupture or wave credit; only the size bonus | Lab 1: 0 such events in 42 zooms once the lists were forgotten |
| Shell effects | Mapped through the same map, or cleared | Particles and popups stored in world cells |

### Lab numbers for the whole operation

- 42 zooms in real games (14 runs x tiers 2, 3 and 4; 7 landscape, 7 portrait): 0 self-deaths, wave clears, ruptures, dissolves or kill credits in the 2 s after; 0 prey blooms within 12 s; massB 0 after phase 2. The second and third zooms behave like the first.
- Converted Orbium in play (exp8): median life 2.9 s against 2.4 s for ordinary stamped prey; the player ate 57% of them (17 of 30) against 25% of ordinary prey.
- Long-run survival on a bare dish matches ordinary prey: 56% at 300 steps and 13% at 800, the same range as random spawns (3 Orbium 57%/20%, 8 Orbium 25%/8%). Late losses come from straight glides colliding on the torus.
- Cost: one zoom is about one sim step (World.step was 4.8 ms on the shared lab container). It runs on frames that show a frozen picture.

---

## 5. Tiers

The ladder only goes up. Each size's headline arc is the next arc up, and an arc species that has turned into prey does not come back red in Sizes II to IV. Discutium swarms and Circium eggs are small fodder in every size; each size you outgrow them again at half the bar. Each size adds exactly one move, built as a per-unit flag on code the Leviathan already runs.

| Size | Red hunters (motion) | New move | Prey | Colour | Boss |
|---|---|---|---|---|---|
| I | Paraptera lancer (advect), Discutium swarm (roll), Circium eggs (static). Waves PD 2 s, PDD 12 s, PEE 24 s (unchanged) | None. Stalk, lane, glint, lunge; swarms hit and run; eggs hatch in 8 s | Orbium, golden Orbium, Remains; swarms and eggs after the notch | Red, heartbeat 5.0 rad/s | None |
| II | Pentapteryx (advect), Discutium, eggs. Waves QD 4 s, DDDEE 14 s, QQD 26 s. No Paraptera | **Double strike.** After a lunge it re-aims for 6 steps and at least 0.25 s with a fresh lane and glint, then lunges again. Both glints can be parried | Orbium, golden, Remains, plus Size I's Paraptera and swarms as Orbium | Red, heartbeat 5.8, hot core from 0.56 | None |
| III | Hexapteryx (advect), Discutium, eggs. Waves HDD 4 s, DDEE 14 s, HD 26 s. No Pentapteryx | **Egg layer.** While it stalks, it lays a Circium egg behind its glide 4 s after it arrives, then every 7 s, with at most 2 of its eggs alive | Orbium, golden, Remains, Size II's Pentapteryx and swarms as Orbium | Red, heartbeat 6.6, hot core from 0.52 | Leviathan (Heptapteryx, three phases, unchanged) summoned by the full bar |
| IV | Heptapteryx as a common heavy (advect; unit T, max 2), Discutium, eggs. Waves TT (pair) 4 s, DDEE 15 s, TTD (pair) 28 s. No Hexapteryx | **Relay pair.** Two arrive on opposite sides and share one attack token. When one's lunge ends, the other may wind up at once with no cooldown, from its own side. A thin red thread joins them | Orbium, golden, Size III's Hexapteryx (2 each), brood, and the Leviathan's three Remains | Red, heartbeat 7.4, hot core from 0.48 | None |
| V and up | Heptapteryx with all three moves, Discutium, eggs; waves from the budget generator (650 + 130 x size, cap 1700) over T, D and E | Every move at once | Last size's hunters as Orbium | Red, heartbeat 8.2, hot core from 0.44 (capped) | Leviathan on VI, IX, XII |

**Size V and up breaks the never-return rule for the top rung only.** No bigger arc has been shown to work inside the game yet. The follow-up change in the cut list (Octapteryx by roll) would remove this exception. The banner says it plainly: "SIZE V / Every hunter uses every move now."

### Lab evidence per species (Lab 2 unless noted; mass ratio after 1500 steps of game-faithful steering)

- **Paraptera:** 257-258 mass, 35-36 x 16-17 cells, glide 0.347 cells/step. Stalk 0.97 (lowest 0.95), charger 0.96-1.00, flee 0.94-1.25. Never give it a steady sideways push of 0.22 or more: it drops to 0.76 and turns into the PS form. Nothing here does that.
- **Pentapteryx:** 328 mass, 45-46 x 17, 0.348. Stalk 0.99. Charger mode, which is this double strike (lunge, 6-step re-aim, lunge), 1.00. Head-on counter-steer at least 0.92; steady sideways push 0.97.
- **Hexapteryx:** 409-419 mass, 56-57 x 18-20, 0.354-0.361. Stalk 0.99, orbit 0.96, charger 0.96-1.00. Egg laying behind a glider: safe from a 7-cell tissue gap behind a Pentapteryx and 9.8 behind an Octapteryx. **ASSUMPTION:** Hexapteryx itself was not measured. The game's offset (reach + egg reach + 6 cells from the centroid) leaves a tissue gap of roughly 20 cells behind it; the egg-layer test checks it.
- **Heptapteryx (common and Leviathan):** 493-499 mass, 67-68 x 19-21, 0.360-0.368. Stalk 0.99, charger 0.96-1.00. The Leviathan's phase 2 and 3 code runs in today's game. **ASSUMPTION:** the relay pair is unmeasured. Gate: 200 relay attacks in a stress run with 0 fusions and 0 red tides before it ships; fallback is a 0.3 s gap between the two attacks, then a single Heptapteryx with the Leviathan's phase 3 lunge (windup 14, 2.0 x 10, inside the tested range).
- **Discutium:** 154-155 mass, 22 x 15, 0.341. Roll only (advect fails, as the existing lab gate says). Flee under roll 0.94-1.25.
- **Circium:** 75 mass, 10 x 9, static. Beside a gliding mother it needs at least 8 cells (Pentapteryx), behind it 7.
- **Orbium (husks):** Lab 1 numbers in section 4.

### Colour

Lab 2 (color.mjs, CIELAB delta E, normal / deutan / protan): hunter red vs Orbium cyan 125.8 / 41.8 / 37.1; a magenta tier hue would clash with blue at 16.1 under protanopia, and orange would clash with the gold stagger. So:

- Every hostile tier stays red. One global `uTier` uniform sets the heartbeat to `5 + 0.8 (tier - 1)` rad/s and lowers the white-hot core threshold in `hunterRamp` from 0.6 by 0.04 per tier, capped at tier 5.
- Converted bodies use the prey ramp. The molt wave carries the red-to-cyan change as motion as well as hue, which helps where the red-cyan contrast is low (deutan 41.8, protan 37.1).
- The Exposed mark (code 4) currently cools hunters toward blue-grey. Retint it to a dim rose-grey (`vec3(l) * vec3(1.0, 0.8, 0.85)`) so it never reads as food.
- Edible swarms and eggs get a gold dashed ring on the fx canvas. Gold already means "eat this" (stagger, golden prey, collapse). This adds no uMark code, since the 8 slots are shared with combat marks.

---

## 6. Structure

| Thing | Before | After |
|---|---|---|
| Epoch | 40 s of play | One size. `epoch` stays as the index; `get size()` returns it. Text says SIZE |
| 40 s timer | Ends the epoch | Removed. A size ends when the dish grows. `epochTime` stays as the size clock for wave times, the 3 s epoch grace and loop waves. `EPOCH_LENGTH` (40) stays exported and now marks when loop waves start |
| Per-epoch ramps | Sim rate +6.5% (cap 38), hunger +8%, tokens 1/2/2/3/3/3, chase, cooldown, lane lead from III, prey light, prey target | Same, keyed to the size |
| Mutation cards | At each epoch end | After every zoom, over the bigger paused dish, same offer rules, Duo guaranteed after a Leviathan. Kicker "YOU GREW · SIZE II". Pick: +30 light, +10 max light (cap 150), full charges |
| Leviathan | Middle wave of epochs III and VI; carries over if alive | Apex of sizes III, VI and IX: summoned by the full bar; the dish grows only after it leaves. Carry-over deleted. Common Heptapteryx gets role "heavy", 1500 points and 2 Remains; the boss keeps 2500 points and 3 Remains through `e.boss` |
| Waves | WAVES table for epochs I-VI, generator after | `TIERS` table: Size I keeps `WAVES[1]` exactly; II-IV as in section 5; V+ generated over T, D, E. Wave 1 of II+ prefers the new territory. Loop waves from 40 s, every 14 s. Encore pool follows the size (I: P D; II: Q D; III: H D; IV+: T D). Caps unchanged, plus at most 2 Heptapteryx |
| Feast | None | The existing relax beat: `relaxT = 4` at the start of Sizes II+, with wave 1 at 4 s. Hunger stays on. No new state |
| Safety valve | Golden every 22-32 s | After 60 s in one size, golden every 12 s |
| Hunger | 3.0/s x (1 + 0.08 (epoch - 1)) | Same per size. Off in grow and mutate, because `update()` returns early |
| Score | Kills, prey, combos, Burst, wave clears 500 x epoch | Same, plus converted prey 200 x multiplier, size bonus 2000 x new size, overflow GP 50 each. Wave clear 500 x size |
| Game over | EPOCH row | SIZE row (Roman numerals). Best size saved as `primordia.bestSize` and shown on the title next to the best score |
| Demo, cabinet, intro | n/a | `addGrowth` does nothing unless mode is play and `growHold` is off. The intro sets `growHold` in every scene except GROW. Tests set it in `setup()` |

---

## 7. Feedback

**HUD.** The epoch block keeps its slot. `EPOCH I` becomes `SIZE I`. The draining time bar becomes the GROW bar: it fills cyan from the left, has a 3 px tick at 50%, turns gold and pulses when full, and reads APEX on apex sizes while the Leviathan lives. Every GP gain flashes the newest segment. A silhouette of the size's headline hunter, drawn once from its pattern rows (24 px desktop, 16 px at 760 px wide or less), sits at the bar's end in red and turns cyan during the pull-back. The three wave dots stay. Bar lines are at least 3 px thick at about 3 px per cell.

**Camera.** The dish still fits the screen and never follows the player. Only the grow sequence moves the view: the 0.30 s torus roll, the swap at 2x, the 1.2 s pull-back. The shell keeps `cam = { z, ox, oy }`, derived only from `game.growT` and the `growStart` / `zoomBegin` events, so a frame drop never desyncs it. `sx`, `sy` and `wrapped()` apply it. Reduced motion: no roll and no pull-back; the dish fades to 25% between growT 0.20 and 0.40 and back by 0.60, and the molt wave recolours at once.

**Player body.** The drawn radius eases to each new `P.r` over 0.3 s with a 12% gulp bulge. During the pull-back it shrinks with the world, then pops to the new base at 1.60 s. Dash pips hug the body at `R + 1.2` cells.

**Banners and text** (plain, no em dashes, each tip once per device):
- Start of a run: "SIZE I" / "Eat to grow."
- First GP gain: tip "Eating fills the GROW bar. Hunters fill it fastest."
- Notch: popup "BIGGER" at the player; tip "You are bigger than the swarms now. Eat them."
- Apex: "LEVIATHAN" / "Eat it to grow." (replaces "Heptapteryx approaches").
- Cards: kicker "YOU GREW · SIZE II"; the first time, the line "The dish grew. Old hunters are food now."
- Size start: "SIZE II" / "New hunter: Pentapteryx. It strikes twice." Then "Hexapteryx. It lays eggs." and "Heptapteryx. Two of them take turns." From V: "Every hunter uses every move now."
- Converted prey: a FOOD ring and label for 2 s after play resumes, the first time each species converts in a run, reading "was Paraptera" and so on (the intro's ring-and-label callout, moved into game.js). Every converted Orbium also gets a thin white dashed ring for 3 s.

**Sound** (audio.js):
- A GP chime that steps up a pentatonic scale in 8 steps across the bar.
- A two-note ding at the notch; a soft heartbeat while ripe.
- Grow: a 0.4 s swell (bandpass noise 300 to 2400 Hz plus a tone 220 to 440 Hz); at the swap, a whoosh (noise 2400 down to 250 Hz over 1.2 s) while the Stasis low-pass opens from 700 Hz to full; one pluck per converted Orbium, rising, 60 ms apart; the existing epoch chord with the cards.
- Tempo +5% per size, as now.

**Shader** (render.js): `uView (z, ox, oy)`, `uConvert (x, y, R, s)`, `uTier`, the Exposed retint, and the player glow measured in torus cells around the transformed uv. No tier hue shift.

**Intro.** One new scene after Burst and before the end card:
- Kicker "7 · GROW", title "Eat to grow.", text "Fill the GROW bar and the dish grows. The hunters you fought turn into food."
- Setup: clean dish, player at the centre, bar one point short, one Orbium 20 cells ahead, one Paraptera 60 cells away (outside its 26-cell trigger range).
- Action: the player eats the Orbium, the bar fills, the real grow sequence plays with no cards, the Paraptera becomes an Orbium with a FOOD callout, and the player eats it.
- The intro camera widens to the whole dish for this scene.
- The end card changes from "Live through each 40-second epoch." to kicker "SURVIVE", title "Grow as big as you can.", text "Each time the dish grows, you pick a mutation and bigger hunters arrive."

**Arcade cabinet.** The attract dish runs in demo mode, which never accrues growth, so it never zooms. No change to attract.js.

---

## 8. Code plan (build order)

Each step lands with its tests from section 10 green before the next starts.

1. **lenia.js**
   - `World.zoomOut(rx, ry)`: one-pass 2x2 mean of A, B and N into the middle quarter, fresh outside, reusing scratch buffers; resets toxin, purge, massA and massB.
   - `World.fill(field, x, y, r, v)`: disc fill, for the agar refill.
2. **core.js: tables and roles.**
   - `TUNE.grow` (section 3).
   - `TIERS` (Size I points at `WAVES[1]`; II-IV tables; flags per unit letter; headline; pool; banner line).
   - `UNIT.T` = common Heptapteryx.
   - ROSTER Heptapteryx: role "heavy", 1500 points, 2 Remains; `devour()` and `spawnRemains()` read `e.boss` for 2500 points and 3 Remains.
   - `wavePlan(n)`, `epochPool()` to `sizePool()`, the generator over T/D/E for V+.
3. **core.js: growth.**
   - `growth`, `growHold`, `bar()`, `gFrac()`, `addGrowth(n, x, y)` (emits `grow { n, g }` and `notch`, sets `ripe`, handles overflow and apex).
   - Hooks in `devour()` (prey by tag, hunters by role and how), `creditEgg()` and the gulp.
   - `bodyR()` sets `P.r` each frame. `mawRadius()` and `cutRadius()` take size; `hitShare`.
4. **core.js: outgrow.**
   - `outgrown()`, `edible(e)`.
   - `stepHunter()`: swarm and brood flee branch.
   - `interact()`: no sting from edible owners; `tryGulp()` with the mouth (gulps swarm and brood, pops eggs).
5. **core.js: grow sequence.**
   - `checkRipe(dt)`, with the herald unit queued through `queueUnit` and relax skipped.
   - `startGrow()`, the `update()` grow branch, `zoomBegin()`, `zoomFinish()`, `mapPoint()`.
   - `placeHusks()`: a port of Lab 1 `place()` plus the player shift.
   - `chooseHeadings()`: a port of `chooseHeadings3`.
   - `offerCards()` replaces the timed `endEpoch()`. `startSize(m)` replaces `nextEpoch(m)`: no `epoch++`, max light, feast, no boss carry-over.
   - Remove the `epochTime >= EPOCH_LENGTH` check.
6. **core.js: apex.** In `addGrowth` on apex sizes, queue the boss once (`bossOut = true`, wave "apex"). In `devour()` and the boss-fade branch of `track()`, set `ripe` with `bossDelay`. Optional `apexEscape` timer.
7. **core.js: director.**
   - Size II+ start with `relaxT = feast`.
   - Wave 1 spawn spot outside `oldBox` (`spawnSpot` option `outsideBox`, 34-70 cells, full circle).
   - Loop waves from 40 s; golden valve after 60 s; Heptapteryx cap 2 in `capRoom`.
8. **core.js: moves.**
   - `endLunge()`: `(e.boss && e.phase === 2) || e.double` takes the reaim path.
   - `updateEggs()`: a per-unit `e.layer` branch with `nextEgg`, first at 4 s, every 7 s, at most 2 own eggs alive, the same offset and caps as the boss.
   - Relay: `e.pair` id set by `spawnWave` for paired waves; `canLunge()` counts a pair as one token and blocks a twin while its partner winds up, lunges or re-aims; `endLunge()` hands the token to the partner and zeroes its cooldown.
9. **render.js.** `uView`, `uConvert`, `uTier`, the Exposed retint, the player glow in world uv. FlatRenderer: no zoom; it uses the reduced-motion fade and blends B colour toward A colour by the convert strength.
10. **game.js.**
    - `cam` state and transforms in `sx`, `sy` and `wrapped()`; handlers for `growStart`, `zoomBegin` and `zoomFinish` (map fx arrays, puffs, motes, pops, callouts).
    - GROW HUD in `updateHud()`; edible rings and the relay thread in `drawFx()`; player radius easing in `drawPlayer()`; `buildMarks()` sends no marks in grow.
    - Cards kicker, banners and tips; SIZE on results and best size; disable pause during grow; index.html and CSS for the bar notch and the silhouette slot.
11. **audio.js.** `growChime(step)`, `notch()`, `heartbeat(on)`, `growSwell()`, `growWhoosh()` with the low-pass opening, `pluck(i)`.
12. **intro.js.** `hush()` sets `growHold` except in the GROW scene; the new scene; `noCards`; the end card text; the intro camera widening in that scene.
13. **Optional prey spawn hygiene (Lab 1, spawnagar.mjs and exp2):** `queuePrey` uses `findSpot(30, 28)` instead of 22, and `spawnRemains` needs mean agar of 0.97 or more over radius 10 instead of N > 0.5 at one cell. 17 of 536 prey stamps (3%) landed below the cliff today, and random-heading pairs 22 cells apart kept 9 of 24. This changes existing behaviour, so rerun the metrics table after it.
14. **QA.** bot.mjs, metrics.mjs, combat.test.mjs, lenia.test.mjs, intro.test.mjs, smoke.e2e.mjs, the new growth.test.mjs (section 10).
15. **OpenSpec.** `openspec/changes/primordia-growth/` with proposal, design (this file, trimmed), the spec delta in section 9 and tasks; validate; archive when done.

---

## 9. OpenSpec delta

See specs/primordia/spec.md in this change.

---

## 10. Tests, assumptions and cuts

### Node tests

New file `qa/primordia/growth.test.mjs`, with the same `setup()`, `tick()` and `spawnMany()` helpers as combat.test.mjs:

1. **Growth table.** Each source adds its GP. The bar per size is 34, 40, 46, 52, 56. Overflow pays 50 points. Nothing accrues with `growHold`, in demo mode, or outside the play state.
2. **Body.** `P.r`, the mouth and the cut radius match the section 3 table at g = 0, 0.5 and 1 for Sizes I and V.
3. **Outgrow.** At g = 0.5 a Discutium flees (distance rises over 60 steps). Touching it gives 0 contact loss. Mouth contact gulps it (devour, how "gulp", 2 GP) and pops an egg. Brood of 200 mass or more stays hostile.
4. **Ripe.** The zoom fires 0.25 s after a full bar with a red hunter present. It waits during a Burst. With an empty dish it queues one headline unit and fires once that unit is tracked, within 4 s. i-frames are 0.8 s at the fill.
5. **Boss guard.** No zoom while a boss is alive, pending, queued or claimed. On Size III a full bar summons exactly one boss; devouring it grows the dish 1.0 s later with `duoNext`; a boss that fades also grows the dish, without `duoNext`.
6. **Frozen.** Wrap `World.step` with a counter. Zero calls from `growStart` to the card pick, `this.time` is unchanged, and no `devour`, `selfDeath`, `waveClear`, `dissolve`, `brood`, `rupture` or `fade` event fires in that window.
7. **zoomBegin state.** Lists, claims, pending and the queue are empty; `labelB` is null; the player is within 0.5 cells of the grid centre with `px, py` equal to `x, y`; toxin and purge are reset; Burst, Stasis and dash have ended; the only score change is the size bonus; light rises by the mote credit. `World.zoomOut` keeps about a quarter of each field's mass in the middle and leaves A = B = 0, N = 1 outside it (also a new lenia.test case).
8. **Placement.** At most 6 stamps; pairwise at least 0.95 x 28 cells; at least 16 from the player; N = 1 everywhere within radius 20 of each stamp; stamp angles are multiples of 90 degrees; claims carry `converted` and `from`; a Hexapteryx gives 2.
9. **Survival in play.** 6 seeds x 2 orientations x 3 zooms (immortal ref bot, light pinned as in Lab 1): at least 85% of converted Orbium still tracked 100 steps after play resumes; massB 0 after phase 2; 0 blooms and 0 red tides in the 12 s after. Lab 1 measured 94-100% on bare crowded dishes.
10. **Cost.** Median of each phase at 20 ms or less in Node (Lab 1: 2.7 and 2.3-2.9 ms).
11. **Size start.** The cards appear at growT 1.95. A pick gives +30 light, +10 max light (cap 150) and full charges, sets `relaxT = 4`, and puts wave 1 outside `oldBox` in both orientations.
12. **Never return.** Run Sizes II to IV with the director, encores and loop waves on: no earlier arc species is ever stamped.
13. **Double strike.** A lone Pentapteryx re-aims after a completed lunge and lunges again. A parry on the second glint staggers it. A body placed in the second lane cancels the re-aim.
14. **Egg layer.** Over 40 s, a Hexapteryx lays its first egg at about 4 s, then every 7 s, never has more than 2 of its eggs alive, and each egg's tissue gap to the mother is at least 9.8 cells when laid.
15. **Relay gate.** A 200-attack stress run of Heptapteryx pairs with swarms, in landscape and portrait: 0 fusions, 0 red tides, never two windups in one pair at once, at most one token per pair. If it fails, ship the 0.3 s gap, then the fallback in section 5.
16. **Common Heptapteryx.** It uses tokens, pays 1500 points and drops 2 Remains. The boss still pays 2500 and drops 3.

Changes to existing tests:
- combat.test.mjs: `setup()` sets `g.growHold = true`. Test 27 (wave table) keeps checking `WAVES[1]` up to 39.5 s; loop waves start at 40 s, so it stays valid. Test 30 (cards) reaches the cards through a full bar.
- lenia.test.mjs: "an epoch ends with three mutation cards" becomes "a full bar grows the dish, then three cards", with `g.growth = bar - 1` plus one devour, then 2 s of updates.
- intro.test.mjs: new check, "grow: the bar fills, the dish grows with at least one converted Orbium, and the player eats it". Plus the 9-scene count.

### Bot and metrics (metrics.mjs acceptance rows)

- bot.mjs: no input in the grow state; the ref policy prefers converted prey within 50 cells for 5 s after play resumes; per-size records keyed to `epoch`.
- Ref bot seconds per size: Size I 30-50 s; Sizes II-IV 35-60 s, plus the boss fight in III. Leviathan fight 35 s or less. Seeds 7, 11, 23, both orientations.
- Blind bot never reaches Size II (it starved at 60 s with 25 GP in c4). Idle bot dies within 40 s.
- Converted Orbium per zoom: median 2 or more; at least 1 in 90% of zooms. Ripe wait: median 1.5 s or less, 90th percentile 3.5 s or less.
- Ref bot eats a converted Orbium within 5 s of resuming in at least half the zooms.
- Contact plus lunge damage by bar quarter: last quarter at most 2x the first (else `hitShare` 0.5).
- Hunter share of growth 55-75% (60-64% today by the c1-c3 logs).
- Every current row still passes, rekeyed to sizes: 0 red tides from lunges or cuts, caps, uncontested steering in the worst full size under 35%, damage rising from Size I to IV, Burst uptime, 3.5 ms or less per frame. Grow and mutate time is excluded from steering and uncontested time.

### Browser smoke checks (smoke.e2e.mjs, needs the server)

- A QA hook sets the bar one point short, then a devour starts the grow sequence. Screenshots at growT 0.15, 0.39, 0.41, 1.0, 1.59, 1.61 and 1.95 at 1280×720, 390×844 and 844×390.
- The player's screen position moves 2 px or less between growT 0.39 and 0.41. The zoom stays inside the dish rect. The HUD is never covered. No horizontal scroll.
- The frame-time log around the zoom frames shows no frame over 50 ms on the CI machine.
- The GROW bar fills, the notch tick and the gold full state render, the APEX state shows on Size III, and the cards kicker reads "YOU GREW · SIZE II".
- Reduced motion (emulated): no roll and no pull-back, the fade path runs, and the husks still pop.
- The FlatRenderer path (WebGL2 disabled) runs the fade without errors.
- The intro plays the GROW scene at all three layouts.
- The cabinet shot (cabinet-shot.mjs) still shows a live demo dish that never grows.
- Phones, real audio and motion sensors cannot be checked in this environment. Report that, along with the emulated results.

### ASSUMPTIONS to test first (not measured by either lab)

| Assumption | First check |
|---|---|
| Bar lengths and GP weights give 30-60 s sizes for the ref bot | Metrics rows above, before tuning anything else |
| A bigger body's extra stings are a fair trade | Damage by bar quarter |
| The ripe rule yields converted hunters without a long wait | Converted-per-zoom and ripe-wait rows |
| Two husks from one point place cleanly | Growth test 8 with a lone Hexapteryx |
| Hexapteryx egg gap is safe | Growth test 14 |
| Relay pairs never fuse | Growth test 15, the gate for Size IV |
| The torus roll reads well and the swap is pixel exact | Smoke screenshots at 0.15, 0.39 and 0.41; fallback: no roll, map about the dish centre (`x' = w/4 + x/2`), which the torus makes physics-identical |
| The red-to-cyan molt wave reads as cause and effect, and the half-resolution 2x picture is not too soft | Screenshots and one human look; fallback: 70 ms white flash at the swap |
| Loop waves keep pressure without crowding | Uncontested and cap rows |
| Size V+ with only Heptapteryx stays interesting | Human playtest; the follow-up change below |
| Human size times of 60-90 s | One playtest; there is no bot for it |

### Cut list

**Cut in this order if the change runs long:** the headline silhouette on the bar; the white dashed husk rings; the old-dish outline; the light motes (keep the core light credit, drop the drawing); loop waves (keep the encore); the relay pair (Size IV falls back to the phase 3 lunge); the GROW intro scene (fall back to the two tips and the end card line). Keep the zoom, the conversion, the GROW bar, outgrow, the apex gate, double strike and the egg layer.

**Not in this change:**
- New Lenia species. Octapteryx, Nonapteryx and Decapteryx live under the hunter rule only when moved by roll (Lab 2: 18 of 18 rolled stalk and charger runs at 0.98-1.02; under advect they become tides). A middle cut makes them re-merge into a tide unless the halves are rolled apart (12 of 12 scripted splits gave two living arcs). Nothing has been tested inside Game. This is the follow-up change that would extend the ladder past Size IV, starting with Octapteryx at Size V behind an in-Game fusion and cut test.
- Tamed blue hunters kept on channel B. They would still eat prey at 0.6 per step and fuse with red tissue within about 10 cells.
- Synchronised or crossing twin lunges. `laneClear` and `bodyInPath` cancel them, and forcing them leaves two bodies a few cells apart.
- Shields, foraging hunters, spillers, spitters, the Helicium turret, splitters.
- A boss on every size, a feast state with hunger off, banked card picks, growth cards.
- Swim, steering or hunger penalties for size; crumbs spilled on hits.
- A bigger grid or a third convolved channel; a follow camera; any zoom inside a size.
- Per-tier hue shifts; the mm readout; per-size body parts; music key drops per size.
- Agar floors (0.8 or 0.85), spacing under 28 cells, more than 6 stamps, headings copied from the source's glide.
