# Shore of the Ancients: map geometry and what changes when the map gets bigger

## 0. Summary

1. **The map is 6400 units wide now, not 4800.** The commit `ea4a34d` (2026-10-02) changed it to 6400. `public/tidebreak/arena.js:2` sets `SIZE = 6400`, and `arena.js:3` sets `MAP_SCALE = SIZE / 4800 = 4/3`. The anchors are still written in 4800-unit coordinates and multiplied by `MAP_SCALE` (`arena.js:5`). So "double the size" can mean two things:
   - **9600**: twice the 4800 basis. That is 1.5× today's width and 2.25× today's area, which is close to "double the area".
   - **12800**: twice today's width, so 4× today's area.

   Both can work. **Recommendation: 9600.** At 12800, a wisp needs about 58 s to walk a side lane end to end, building the scenery takes about 2 s per realm at today's density, and tiled ground becomes mandatory. The orchestrator should confirm 9600 with the user or state it as the interpretation.
2. **How positions are defined:** absolute numbers in the 4800 basis, times one factor (`arenaPoint`, `arena.js:5`). Everything derived from them (sampled lane paths, tower positions, collision boxes, bridge positions) is computed when the module loads. Changing `SIZE` alone does move every anchor in proportion. The problem is that the same factor also enlarges things that should keep their real size: cover collision boxes, bush radius, river width and therefore bridge sprites. Meanwhile counts do not scale at all: scenery, cover, bushes and camps stay the same number on a bigger map.
3. **A bug exists today.** `paint-ground.js:78,83,84` fill the river only inside the unscaled band y = 1300 to 3000. At 6400 the river extends south to y ≈ 3318–3411, so the water is missing wherever the river centre lies below y = 3000. I confirmed this three ways: pixel samples (x = 0, 792, 4752 are not blue), the ground preview (a straight horizontal cut) and a live screenshot (the west bridge stands on dry ground). At 9600 and 12800 **no river water is painted at all**.
4. **What breaks if only `SIZE` changes**, measured in scratch copies:
   - Lanes stay clear, and the river and scenery tests pass.
   - 6 test files fail at 9600 and 5 at 12800.
   - Travel times grow 1.5× or 2×.
   - Bot matches: towers destroyed fall from 6.8 to 4.9 to 4.6, and time-limit endings rise from 8/18 to 10/18 to 11/18.
   - Scenery density falls from 25 to 16 to 10 props per million square units.
   - Ground texture density falls from 0.48 to 0.32 to 0.24 texels per unit (blurrier).
5. **Ground memory.** Today: 2 canvases of 3072² = 72 MiB. Keeping today's sharpness at 9600 needs 4608² = 81 MiB per realm (162 MiB for both). That is 21.2 million pixels per canvas, above WebKit's iOS limit of 16,777,216 pixels per canvas. **Use tiles**: 512² texel tiles at 0.5 texels per unit, painted lazily and kept in an LRU cache. That needs about 42 MiB at any map size.
6. **Cleanest approach** (section 7):
   - Split the single `MAP_SCALE` into a layout scale (positions), a fixed feature scale (sizes), an area scale (counts) and an untouched unit scale (speeds, ranges, art).
   - Then write a new mirrored 9600 layout as data, with three tower stations per lane placed by distance along the path.
   - A pure "one SCALE" change is only a mechanical first step.

---

## 1. How the map is defined today

### 1.1 Where the numbers come from
`arena.js` (size and scale) → `world.js` (anchors, derived paths and tower positions, collision boxes, bushes, sight, movement) → `river.js` (seeded river) → `scenery.js` (props and districts) → `paint-ground.js` (cached ground canvases) → `illustrated-render.js` (camera, drawing, minimap) and `sim.js` (spawns, waves, AI). `navigation.js` builds a routing graph from the collision boxes.

`render.js`, `world-art.js`, `environment.js` and `toon.js` are the old WebGL path. Only `render.js:6-7` imports `world-art.js` and `environment.js`, and nothing imports `render.js`; `main.js:6` imports `illustrated-render.js`. These files still contain 4800-era numbers: `world-art.js:6` (2400 canvas at 0.5), `:16` (river y 100–4700), `:19` (bridges at y 1490/2400/3300), `:22`, `:39`, and `environment.js:21,35,38,48,54,57` (a 0–48 range at 0.01 scale). They do not run, but they will mislead future edits. Delete them or leave them alone.

### 1.2 Inventory of geometry constants
"A×S" means written in the 4800 basis and multiplied by `MAP_SCALE`.

| Constant | Where | Basis | Comment |
|---|---|---|---|
| `SIZE = 6400`, `MAP_SCALE`, `CENTER`, `arenaPoint` | `arena.js:2-5` | — | Single source of truth |
| `LIMIT = 360` (s), `SHIFT = 40` (s) | `world.js:5-6` | time | Match length and realm swap |
| `BASES` (2400,4000)/(2400,800) | `world.js:7` | A×S | Top and bottom centre |
| `LANES` (5 knots each) | `world.js:9-13` | A×S | Mid lane is a straight vertical line |
| `track()`: Catmull-Rom, one sample per ≤55 units | `world.js:15-26` (`:19`) | absolute | Point count grows with length |
| `PATHS` (mid lane has 4 extra knots) | `world.js:27` | A×S | Used for movement, ground, minimap and bridges |
| `closestTrack` | `world.js:28-32` | — | Linear search over every path point |
| `TOWER_POSITIONS` | `world.js:33-37` | derived | Outer = `lane[1]` / `lane[3]`; inner = `path[round(index × .48)]` (`:36`). Exactly 2 tiers |
| `PORTALS` (4, cross-map pairs, `to`) | `world.js:38` | A×S | |
| `CAMPS` (4) | `world.js:39` | A×S | |
| `COVER` (13; position and size) | `world.js:45-59`, scaled at `:60` | A×S, **size too** | Art heights (`height:`) are not scaled, so collision box and art drift apart |
| `OBSTACLES` (woods realm ×0.58) | `world.js:61` | derived | |
| `BRUSH` (12), radius `150×S` | `world.js:62-66` | A×S, **radius too** | 200 at 6400, 300 at 9600, 400 at 12800 |
| `RIVER` (old sine curve) | `world.js:67` | A×S | Used only by the dead WebGL files |
| Sight 950 / 620 / 500; bush reveal 125 | `world.js:83,86` | absolute | |
| Body clamp 200/180 margins | `world.js:95` | absolute | |
| River `LENGTH = SIZE`, `STEP = 12` | `river.js:2` | SIZE | 535 / 801 / 1068 samples |
| River knots x/y and **width** `(65+r·47)×S` | `river.js:19-20` | A×S, **width too** | |
| Pools (radius and extra ×S) | `river.js:21-24` | A×S | |
| 18 erosion pockets over `LENGTH`; radius 65–225, depth fixed | `river.js:26-29` | count fixed | Fewer per unit as the map grows |
| Erosion limit 30/78, bank waviness | `river.js:33`, `:41-46` | absolute | |
| Bridge landing needs 45 units of dry ground | `river.js:76` | absolute | |
| `riverCrossings` returns **only the first crossing per lane** | `river.js:63-80` (`:80`) | — | Constrains any new layout |
| `DISTRICTS` (4 ellipses) | `scenery.js:22-28` | A×S | |
| Prop exclusion around anchors (towers, camps, portals, bases, centre) | `scenery.js:36,44,64,72` | absolute radius 160–220 | |
| 7 detail props around each cover block, radius 180–360, **no `blocked()` check** | `scenery.js:42-46` | absolute | Lands inside collision boxes once boxes outgrow 360 |
| 5 village landmarks | `scenery.js:49-52` | A×S | |
| 12 groves × 13 tries | `scenery.js:54-68` | A×S, count fixed | |
| Infill: 2600 tries, 85-unit spacing (O(n²)) | `scenery.js:70-77` | **count fixed** | |
| 24 reed beds; 220 ground patches | `scenery.js:79-90` | count fixed | |
| No props within 590 of a base | `scenery.js:91` | absolute | |
| Ground canvas 3072² per realm | `paint-ground.js:29` | fixed | 0.48 texels/unit at 6400 |
| World-to-canvas scale | `paint-ground.js:31` | SIZE | |
| Camp and portal side paths (width 64/32) | `paint-ground.js:48-52` | absolute | |
| Lane ribbons (half-width 73–79 + spread) | `paint-ground.js:15-26,53-66` | absolute | |
| **Hard-coded river band `fillRect(0,1300,SIZE,1700)`** | `paint-ground.js:78,84` | **unscaled (bug)** | |
| **Water gradient (0,1700)→(4000,2600)** | `paint-ground.js:83` | **unscaled (bug)** | |
| 45 sand masks, 135 gravel fans | `paint-ground.js:90,92` | count fixed | Should follow river length |
| Base court ellipse 540×420, steps, heal ring | `bases.js:7-29` (`:15,:22,:28`) | absolute | |
| `BASE_HEAL_RADIUS = 420` | `bases.js:1` | absolute | |
| Routing graph: 4 nodes per obstacle, margin `radius*2+8` | `navigation.js:12-21` (`:14,:17`) | — | O(n²) edges, cached per realm and radius |
| Route goal clamp | `navigation.js:23` | absolute | |

### 1.3 Every consumer outside `world.js`
- **sim.js:**
  - Hero spawn: 180 units behind the outer tower (`:35-36`).
  - Core at `BASES` (`:42`); tower loop with `tier<2` (`:43-46`).
  - XP shared within 1200 (`:60`); respawn time 5 + level (`:119`).
  - Siege beast spawns at `LANES[lane]` knot 2 (`:130-131`); camp respawn 32 s (`:135`).
  - Skill clamp 180 (`:290`); portal use radius 150, cooldown 10 (`:301-306`).
  - First wave spawns at `LANES[lane][2]` ±370; later waves at `BASES`; wisp speed 240 (`:327-333`).
  - `followLane` (`:334-340`); bot recall to base (`:349`).
  - Wave every 14 s (`:404`); Wild Hunt at `CENTER` (`:405-407`); camps jittered ±60 (`:409-415`).
  - Respawn at base (`:432`); base healing (`:435-437`).
  - Sprint ×1.35 **only for manual movement** (`:450-452`); recall (`:459`); click orders get no sprint (`:471`).
  - Boss leash 390 (`:502`); time limit (`:519-521`).
- **illustrated-render.js:**
  - Starting camera `CENTER.y+600` (`:37`); zoom `min(w/1200, h/1680)` (`:53`).
  - Builds scenery, bridges and both ground canvases synchronously on a seed change (`:41-46`).
  - Camera clamp (`:124-126`); **whole-ground blit every frame** (`:131`).
  - Bridge sprite height = span (`:134`); portal rings 95/70 (`:135`); bush rings (`:136`).
  - Loops over every prop each frame (`:140-148`); tower heights by tier (`:184`); tower labels (`:224`).
  - Loops over every prop for glows (`:273-278`); 34 river glints spaced 143 apart (`:286-292`).
  - Minimap scaled by `SIZE` (`:321-341`), recomputing `riverCrossings` every redraw (`:326`); map labels (`:340`).
- **main.js:** tactical map click converted with `SIZE` (`:218`); map destinations `CENTER` / `CAMPS[0]` / `PORTALS` (`:222`); clock from `LIMIT` (`:236`); `SHIFT` countdown and portal button 150/180 (`:276-282`); minimap point (`:296`).
- **Combat AI (combat-ai.js):** 850 (`:8`), 650 (`:9`), `BASES` (`:32`), 700 (`:40`), 1600/1700 (`:51`), 1900 (`:52`).
- **Team events (team-events.js):** `ASSIST_RANGE = 1900` (`:9`), `RALLY_RANGE = 3200` (`:10`).
- **Team chat (team-chat.js):** `laneAt` uses `SIZE × .38` / `.62` (`:5`).
- **Neutral encounters (encounters.js):** leash 390/430 (`:22`); target search within 490 (`:39`).
- **Objectives (objectives.js):** `towers.length === 2` (`:5`); `tier === 1` (`:9`); "/6" text (`:18`).
- **Clamps:** combat-rules.js `:18`; legend-rules.js `:9,:84`; skill-aim.js `:36,:38`.
- **Audio:** listener span 1400 (`audio.js:135-138`). Absolute, which is fine.

---

## 2. Measured effect of changing only `SIZE`
I copied the game into scratch folders and changed only `arena.js:2`. Hero speeds are 285–375, wisps 240, the siege beast 180.

| Metric | 6400 (today) | 9600 | 12800 |
|---|---|---|---|
| Lane lengths W/M/E | 7019 / 4619 / 6953 | 10529 / 6930 / 10430 | 14039 / 9241 / 13907 |
| Base to base | 4267 | 6400 | 8533 |
| Wisp, end to end W/M/E (s) | 29 / 19 / 29 | 44 / 29 / 44 | 58 / 39 / 58 |
| Slowest hero, end to end (s) | 25 / 16 / 24 | 37 / 24 / 37 | 49 / 32 / 49 |
| Wave from base to enemy outer tower (s) | 21.5 / 14.8 / 21 | 32 / 22 / 32 | 43 / 30 / 42 |
| Base to inner tower W/M/E | 858 / **412** / 793 | 1270 / 655 / 1206 | 1683 / 867 / 1554 |
| Outer to enemy outer W/M/E | 3001 / 2293 / 3004 | 4501 / 3440 / 4506 | 6001 / 4587 / 6009 |
| River width min–max | 177–522 | 236–819 | 296–926 |
| Bridge spans (seed 49) | 296 / 426 / 395 | 371 / 546 / 514 | 568 / 605 / 552 |
| Bush radius | 200 | 300 | 400 |
| Cover share of map (town / woods) | 5.0% / 1.7% | same | same |
| Scenery props (realm 0) / per million sq units | 1020 / 24.9 | 1441 / 15.6 | 1659 / 10.1 |
| Scenery with area-scaled infill: props / ms per realm (Node) | — | 2333 / 480–680 | 4249 / 1920–2140 |
| Visible share of map at 1440×900 (w / h) | 42% / 30% | 28% / 20% | 21% / 15% |
| Ground texels per unit (3072 canvas) | 0.48 | 0.32 | 0.24 |
| River water painted? | **partly** (cut at y=3000) | **no** | **no** |
| Bots (18 matches): average length / time-limit endings | 318 s / 8 | 315 s / 10 | 331 s / 11 |
| First tower falls (average) | 84 s | 111 s | 116 s |
| Towers destroyed per match (of 12) | 6.8 | 4.9 | 4.6 |
| Living units (average / max) | 43 / 59 | 52 / 69 | 58 / 74 |
| Simulation cost per simulated second (Node) | 41 ms | 53 ms | 61 ms |

Other measurements:
- Lanes are still clear for 42-unit bodies in both realms at every size.
- Each lane crosses the river exactly once at every size.
- Lanes plus base courts use 61% of the square at 6400 and 56% at 9600. The empty margins beside the side lanes and behind the bases are about 840–900 units (side) and 527 (top/bottom) at 6400, and about 1300–1400 and 1060 at 9600.

---

## 3. What breaks or needs re-tuning, by subsystem

**Lane paths.** `PATHS` and `TOWER_POSITIONS` follow automatically (`world.js:27,33-37`).
- The mid lane is 66% as long as the side lanes because the bases sit at top and bottom centre and the mid lane is straight (`world.js:7,10-12`).
- Its inner tower is only 412 straight-line units (480 along the path) from the base. That is at the edge of the painted court, whose ellipse is 540×420 (`bases.js:15`).
- The layout is not mirror-symmetric. East lane outer tower: 1779 units from base for team 0 versus 1920 for team 1. West: 1908 versus 1849.
- The mid-lane bridge sits 60% of the way from team 0's base (seed 49), so the river is closer to team 1.
- All of this scales with the map unless the layout is rewritten.

**River.**
- The knots scale, and so does the width (`river.js:20`). Crossing time and bridge sprite size (`illustrated-render.js:134`, height = span) grow with the map while heroes keep their size.
- The 18 erosion pockets (`river.js:26`) are spread over a longer river, so the banks get smoother.
- The paint band is hard-coded (`paint-ground.js:78,83,84`). Fix it by deriving the rectangle from the river's sample bounds (`min(north)`, `max(south)` plus margin) and using a world-scaled gradient.
- Sand and gravel counts (`paint-ground.js:90,92`) and river glints (`illustrated-render.js:286`) should grow with `SIZE`. Even today, 34 glints × 143 = 4862 < 6400, so part of the river has no glints at any moment.
- `river.test.mjs:14` checks a band of `1400..2900 × MAP_SCALE`.

**Obstacles and cover.**
- Box sizes scale (`world.js:60`) but art heights do not (`scenery.js:40`), so collision boxes outgrow their art.
- The count stays 13, so open space per obstacle grows 2.25× or 4×.
- The detail props around each cover block skip the `blocked()` check (`scenery.js:42-46`), so they end up inside larger boxes.
- Routing (`navigation.js:12-21`) handles about 40 obstacles easily, about 100k segment tests once per cached graph. Measured: graph build about 20 ms, one route 0.4–0.65 ms at every size.

**Bushes.** The radius scales (`world.js:66`), but the 125-unit reveal distance (`world.js:86`) and hero size do not, so a 400-radius bush becomes a hiding zone. Keep the radius at 200 and scale the count instead (12 → about 27 at 9600).

**Portals.** Positions scale and jumps grow from 3740 to 5610 to 7480. Use radius 150 (`sim.js:303`) and the rings (`illustrated-render.js:135`) stay fixed, which is correct. On a bigger map, consider more portals or gates near the bases to save travel.

**Camps.** Positions scale. Distance to the nearest lane grows from 553–1054 (6400) to 829–1581 (9600). Leash distances stay fixed (`sim.js:502`, `encounters.js:22`), which is correct. Add camps in proportion to area (4 → about 9). `campTimers` (`sim.js:40`) and `campSprite` (`marketplace-sprites.js:8`, modulo) already handle any count.

**Bases.** Positions scale; courts, healing radius and the 590 prop exclusion stay fixed, which is correct. The empty margins behind the bases grow, and the camera bottom reaches only about 420 units below the hero at 1440×900. Move the bases outward when rewriting the layout.

**Minimap and tactical map.** Coordinates are proportional (`illustrated-render.js:321-341`, `main.js:218,296`). Pixel sizes stay fixed:
- Minimap backing 180 px (`index.html:34`): 35 units per pixel at 6400, 53 at 9600, 71 at 12800.
- Tactical map 640 px (`main.js:216`): 10, 15, 20 units per pixel.

It stays readable. `riverCrossings` is recomputed at `:326`; it should reuse `this.bridges`.

**Camera.** The clamp (`illustrated-render.js:124-126`) is relative to `SIZE` and needs no change. Zoom is fixed (`:53`), so a bigger map simply means more screens to cross.

**Ground canvas.** See section 8.
- Texel density drops: on-screen magnification is 1.1–1.9× today and becomes 1.7–2.8× at 9600 and 2.2–3.8× at 12800 (scale × backing ratio from `illustrated-render.js:14,17,53`).
- The whole ground is blitted every frame (`:131`).

**Scenery density and cost.**
- Infill, groves, reeds and patches have fixed counts (`scenery.js:54-90`).
- Scaling infill by area keeps 25 props per million square units but costs 0.5–0.7 s per realm at 9600 and about 2 s at 12800. The cause is the O(n²) spacing check `props.some(...)` (`scenery.js:72,85`) plus a full lane scan per candidate (`scenery.js:12-20`; also `paint-ground.js:117`).
- The renderer loops over all props twice per frame (`illustrated-render.js:140-148,273-278`). Bucket props into grid cells.

**Sight.** Sight is in world units (`world.js:83`). It needs no change: 950 is about half the view height at 1440×900. A bigger map means more fog, so vision tools become more valuable.

**Travel and speed.**
- Keep unit speeds and ranges as they are; skills and combat feel are tuned to them.
- Compensate with movement instead:
  - Apply the out-of-combat sprint to all movement modes. Today it only applies to manual movement (`sim.js:450`), not click orders (`:471`) or bots (`:338,:357`).
  - Add portals or gates near the bases.
  - Spawn waves at the innermost standing tower, or make wisps faster (`:331`).
- Respawn is 5 + level, at most 23 s (`sim.js:119`). At 9600 the walk from base to the side-lane midpoint is about 18.5 s for the slowest hero.
- This is combat-fun rule 8, "pressure rhythm" (`docs/combat-fun-system.md:14`): travel is the recovery phase, and too much of it is dead time.

**Timers.** These are not geometry, but bigger maps force them:
- `LIMIT` 360 (`world.js:5`) already ends 8 of 18 bot matches at 6400. With three tiers and a bigger map it must grow, or be replaced by escalation.
- Wave interval 14 (`sim.js:404`), boss timers (`:405,:129`) and camp respawn 32 (`:135`) need retuning against the new travel times.

**AI distances.** Rally 3200 and assist 1900 (`team-events.js:9-10`), plus `combat-ai.js:51-52` (1600/1700/1900). These were relative to a 6400 map; retune them or make them proportional to the lane gap.
- `team-chat.js:5` names lanes by x fraction. With a rewritten layout it should use the nearest lane instead (`laneDistance` / `closestTrack`).

---

## 4. Tests that encode geometry

Failures with `SIZE` changed and nothing else (scratch runs):

| Test | 9600 | 12800 | Cause |
|---|---|---|---|
| `sim.test.mjs:7-8` | fail | fail | Asserts `SIZE === 6400` and `(SIZE/1600)² === 16` |
| `towers.test.mjs:24` | fail | fail | Asserts `SIZE === 6400`. Also `:8` (12 towers, `[6,6]`, outer-to-inner > 400) and `:28` text; these must change for 3 tiers |
| `combat-decisions.test.mjs:37-40` | fail | ok | Literal (3200,3200), (3650,3510), (3200,3580): at 9600 one point is inside cover and one is in a bush |
| `encounters.test.mjs:38-39` | fail | fail | `OBSTACLES[1].find(w => w.w < 240)` finds nothing once boxes scale (TypeError) |
| `hero-classes.test.mjs:54` (setup `:7` at 2400,2800) | fail | ok | Target at (2840,2800) blocked by moved cover |
| `skill-aim.test.mjs:35` (setup `:7` at 2400,3100) | fail | ok | Line of sight to the target blocked |
| `team-presence.test.mjs:107` | ok | fail | `laneAt({x:6000}) === 'East'` uses map fractions |

More tests use literal coordinates. They pass today, but by luck:
- `base-attacks.test.mjs:9,28-32`; `creatures.test.mjs:23,30`: (2400,4000) is **inside a cover box today** in the town realm.
- `items.test.mjs:4`; `legends.test.mjs:8,40`; `scenery.test.mjs:27`; `sim.test.mjs:6,38`; `skills.test.mjs:4,23-35`: (2400,2550) is **in the river today**.
- `tactical-combat.test.mjs:6`; `targeting.test.mjs:5`.
- Browser: `desktop.e2e.mjs:216-217` assumes about 500 units of open ground to the right of the spawn point.

Fix: add a helper that returns a known open spot, or derive spots from `CENTER`, `TOWER_POSITIONS` or lane samples. Replace the `SIZE` assertions with the spec constant.

The canonical spec says "The arena SHALL be 6400 units square… outer and inner tower" (`openspec/specs/moba-combat/spec.md:56-63`). The new change needs a MODIFIED requirement for it.

---

## 5. Three tower tiers: what the geometry implies

**Current coupling to two tiers:**
- `world.js:33-37` returns `[outer, inner]`, with the inner tower at 48% of the outer tower's path index.
- `sim.js:40` (`towers:[6,6]`), `:43-46` (`tier<2`, health and range by tier), `:73,:126` (messages).
- `objectives.js:5` (`length === 2`), `:9`, `:18`.
- Renderer: `:184,:204,:224,:331`.
- `main.js:212` help text; `towers.test.mjs:8,28`; `sim.test.mjs:12-17`.

**Spacing.**
- Today, three tiers do not fit on the mid lane at 6400. Base to outer tower is about 1120 along the path, so the towers would be about 370 apart, which is roughly one tower range (360–390, `sim.js:45`).
- At 9600 with a pure scale, place stations at 20%, 50% and 80% of half the lane length (measured from each team's own base, so the result is symmetric):
  - Side lanes: 1053, 2632 and 4212 units from base; 1580 between tiers; 2106 between the two outer towers.
  - Mid lane: 693, 1733 and 2772; 1040 between tiers; 1386 between the two outer towers.

  That works, but the mid lane's last tower sits just outside the court.
- With bases moved out to written y 4300/500 (8600/1000 at 9600) and an S-curved mid lane of about 8000, the mid stations become about 810, 2025 and 3240.

**Placement rule.** Use a helper `pointAtArc(path, distance)` and place every station by arc length, the same way for every lane and both teams. Do not use knot indices: the current formula ties the outer tower to an authored knot and causes the asymmetry measured in section 3.

**Layout constraint.** Each lane must cross the river exactly once, or `riverCrossings` must return every crossing. Today it returns only the first crossing per lane (`river.js:80`), and `river.test.mjs:20` expects exactly 3 bridges.

---

## 6. Hero, wave and objective spawn points
| Spawn | Code | Rule |
|---|---|---|
| Hero start | `sim.js:35-36` | Outer tower position, 180 units toward the hero's own base (checked by `towers.test.mjs:23`) |
| Respawn, recall, bot recall | `sim.js:432,459,349` | `BASES[team]` |
| Wave 1 | `sim.js:330` | `LANES[lane][2]` (lane middle) ±370 in y |
| Later waves | `sim.js:330-331` | `BASES[team]` with offsets of 32 and 28 |
| Wild Hunt | `sim.js:406` | `CENTER`, which is on the mid lane (`LANES[1][2]`) |
| Siege beast | `sim.js:130-131` | Knot 2 of `LANES` (reversed for team 1) |
| Camps | `sim.js:409-415` | `CAMPS[i]` ±60 by hash, pushed out of cover |
| Portals | `world.js:38`, `sim.js:303-304` | Fixed pairs; use radius 150 |

---

## 7. Proposed way to scale

**Option A: change `SIZE` only.** A one-line change. It moves everything, but leaves the problems listed in sections 2–4.

**Option B: split the scale (do this first).** Make `arena.js` the single place for four separate kinds of scaling:
```js
export const AUTHORED = 4800, SIZE = 9600;
export const LAYOUT_SCALE = SIZE / AUTHORED;          // positions of authored anchors only
export const FEATURE_SCALE = 4 / 3;                   // footprints/radii: today's look, never derived from SIZE
export const AREA_SCALE = (SIZE / 6400) ** 2;         // counts of scattered things vs the tuned 6400 density
export const LENGTH_SCALE = SIZE / 6400;              // counts along the river / lanes
export const arenaPoint = (x, y) => ({ x: x * LAYOUT_SCALE, y: y * LAYOUT_SCALE });
```

| Scale | What it applies to |
|---|---|
| Layout | `BASES`, `LANES`, mid-lane extra knots, `PORTALS`, `CAMPS`, cover and bush **positions**, `DISTRICTS` centres and radii, grove centres and radii, landmarks, river knot x/y and pool x |
| Feature (fixed) | Cover w/h (`world.js:60`), bush radius (`:66`), river width and pool size (`river.js:20-24`) and therefore bridge spans |
| Area | Infill tries (`scenery.js:70`), groves, reed beds and patches (`:79,:90`), cover, bush and camp counts |
| Length | River pockets (`river.js:26`), sand and gravel (`paint-ground.js:90,92`), glints (`illustrated-render.js:286`) |
| Unit (unchanged) | Speeds, ranges, skill radii, art heights, body radii, clamps, court and healing radius, sight, leashes, ribbon widths |

Also in this step:
- Fix `paint-ground.js:78,83,84`.
- Add a spatial grid to scenery generation and per-frame prop culling.
- Reuse `this.bridges` in the minimap.

**Option C: rewrite the layout for 9600 as data (needed for three tiers and a fuller map).** Create a `layout.js` with absolute 9600 coordinates:
- Write team 0's half and mirror it (`y' = SIZE − y`) so towers, camps and portals are fair.
- Use the dead margins: move the bases outward and lengthen the mid lane with curves.
- Place 3 stations per lane by arc length.
- About 9 camps, about 29 cover blocks and about 27 bushes (area 2.25×).
- One river crossing per lane, with the river centred on each lane's midpoint.
- About 6 districts.

Keep `arenaPoint` only for old data.

**Recommendation:** do B, then C, then tiled ground (section 8), then pacing retunes (section 3). Verify with tests for:
- open lanes in both realms;
- equal tower arc distances across teams (within 2%);
- minimum tower spacing of at least 2.5 tower ranges;
- water painted at every river sample (browser pixel check);
- scenery density within 10% of 25 props per million square units;
- bot runs with fewer time-limit endings than today and a target base-to-river travel time of about 20 s or less.

---

## 8. Ground memory and the tiling plan

**Today:** two 3072² canvases (`paint-ground.js:29`, built in `illustrated-render.js:44`) = 2 × 36 MiB = **72 MiB**, at 0.48 texels per unit. Each paint also creates 4 temporary 600² material canvases (`paint-ground.js:6-10,30`).

| Single-canvas option | Pixels per canvas | Per realm | Both realms | iOS (16.7 Mpx limit) | Texels per unit |
|---|---|---|---|---|---|
| Keep 3072 at 9600 | 9.4 M | 36 MiB | 72 MiB | ok | 0.32 (blurry) |
| 4096 at 9600 | 16.8 M | 64 MiB | 128 MiB | at the limit | 0.43 |
| 4608 at 9600 (today's sharpness) | 21.2 M | 81 MiB | 162 MiB | **fails** | 0.48 |
| 6144 at 12800 (today's sharpness) | 37.7 M | 144 MiB | 288 MiB | **fails** | 0.48 |

Headless Chromium timings (software rendering, so absolute numbers are pessimistic): painting both realms took about 1.5 s plus 0.8 s to flush at 6400. At 6144² for 12800 it took 1.9 s plus 1.85 s, and that happens synchronously in the first frame of a match.

**Tiling plan (any map size):**
- **Tiles.** 512² texels at 0.5 texels per unit, so each tile covers 1024 world units and uses 1 MiB.
  - 9600 needs 10×10 tiles per realm; 12800 needs 13×13.
  - At most 4×3 = 12 tiles are visible at 1440×900, 1920×1080, 390×844 or 844×390 (view footprints of 2688×1909, 2987×1909, 1200×2951 and 3636×1909 units).
  - LRU cache of about 30 tiles for the active realm, plus 12 prepainted for the other realm: **about 42 MiB, the same at any map size.**
  - Optional 0.75 texels per unit on high-DPI desktops with plenty of memory.
- **Overview canvas.** One 1024² canvas per realm (4 MiB), painted first. It serves the minimap and tactical map, and fills in for tiles that are not painted yet, so there are never holes.
- **Display list.** Build the ground once per seed and realm as a list of drawing operations in world coordinates, each with a bounding box. Keep today's random-number order (one stream at `paint-ground.js:30`) so the look stays deterministic. To paint a tile, set its transform with `setTransform(k,0,0,k,−tileX·k,−tileY·k)` and replay only the operations that touch it.
  - Patterns and gradients are defined in world space, so tiles join without seams.
  - Paint a 2-texel gutter around each tile and draw only its inner 512 region.
  - Round the projected tile edges so neighbouring tiles meet exactly.
- **Budget.** Paint at most one tile per idle slice, ahead of camera movement. Start prepainting the other realm's visible tiles about 10 s before each 40 s realm swap (`world.js:6,114-120`; the countdown already exists at `main.js:276-281`).
- **Drawing.** Replace the full blit (`illustrated-render.js:131`) with a few `drawImage` calls for visible tiles. Match start then only paints the visible tiles. A later step can move painting to an `OffscreenCanvas` worker.

---

Everything was done in scratch copies; no repository files were changed. One gap: I only checked the browser in headless software rendering. Real GPU timings, phone memory limits and audio were not checked.

Files are in `/tmp/claude-0/-home-user-rouge-warden/969dd671-2f40-5e94-86df-9de415060d08/scratchpad/understand/`:
- Scripts: `measure.mjs`, `matches.mjs`, `units.mjs`, `points.mjs`, `cross.mjs`, `sym.mjs`, `bbox.mjs`, `scen.mjs`, `harness.html`, `run-harness.mjs`, `live.mjs`
- Results: `tests-9600.txt`, `tests-12800.txt`
- Images: `ground-6400.png`, `ground-9600.png`, `live-west.png`, `live-centre.png`
- Scratch game copies: `s6400/`, `s9600/`, `s12800/`, `s9600d/`, `s12800d/`, `a9600/`, `a12800/`