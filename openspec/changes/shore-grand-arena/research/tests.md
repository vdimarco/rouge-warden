# Shore of the Ancients: tests, CI and OpenSpec affected by a bigger map, three tower tiers and new art

All 22 Node suites pass today; one run of all of them takes about 3 min 19 s. The map is already **6400** units, not 4800, so the brief starts from the wrong size. With only the map size changed, 6 suites fail at 9600 and 4 at 12800. A third tower tier will break the tower and match tests in more places, and moving to a 3D renderer will break three renderer tests and two browser contracts.

Snapshot: I ran the suites at `ddac5d1`, with untracked work from another agent in the tree. That agent then committed `bf2c362` and `cab26b4`. Those commits only add files (GLB models, `hero-rig.js`, `lib/meshopt_decoder.mjs`, `openspec/changes/shore-grand-arena/`, `higgsfield/models3d/`). No test file and no game module the tests import changed, so the results hold for `cab26b4`. I edited no repository files. Scratch copies and logs are in `/tmp/claude-0/-home-user-rouge-warden/969dd671-2f40-5e94-86df-9de415060d08/scratchpad/understand/`.

## 0. Points to settle first

1. **The current map is 6400, not 4800.**
   - `public/tidebreak/arena.js:2` sets `SIZE = 6400`, `:3` sets `MAP_SCALE = SIZE / 4800`, `:4` sets `CENTER = SIZE/2`, and `:5` defines `arenaPoint(x,y)` as authored point × MAP_SCALE.
   - Every anchor in the world is written on a 4800 grid and scaled by 4/3.
   - `docs/tidebreak.md:7` still says "4800 × 4800" and is out of date. `openspec/specs/moba-combat/spec.md:57` says 6400.
2. **"Double the size" can mean three different numbers:**
   - 9600 is 1.5× the width and 2.25× the area.
   - 12800 is 2× the width and 4× the area.
   - About 9051 is 2× the area.
3. **The new change contradicts itself.** `openspec/changes/shore-grand-arena/proposal.md:5` says "a map twice as wide and high", but `:12` says "6400 to 9600 units (2.25 times the area)". The same proposal names the tiers outer, middle and inner and adds "Two guardians defend each base before the core" (`:14`). That moves the meaning of `tier===1` from "inner" to "middle".

## 1. How the tests run in CI

Only **`.github/workflows/creature-browser.yml`** runs Shore tests. No other workflow touches `public/tidebreak/`.
- **Triggers** (`:3-8`):
  - a push to `codex/shared-procedural-creatures`;
  - a pull request touching `public/tidebreak/**`, `public/arcade/creatures/**`, `qa/creatures/**` or `qa/tidebreak/creatures.test.mjs`;
  - a manual run.
- **Time limit:** `timeout-minutes: 10` (`:13`).
- **Node step** (`:23`): `qa/creatures/shared.test.mjs`, then `creatures`, `base-attacks`, `hero-identities`, `legends` and `sim` from `qa/tidebreak/`.
- **Browser step** (`:24-28`): `node qa/creatures/browser.mjs` across six viewports.
- **Not in CI:** 15 of the 21 `qa/tidebreak/*.test.mjs` suites, and `qa/tidebreak/desktop.e2e.mjs`.
- **Time-limit risk:**
  - `sim.test.mjs` alone takes 161 s today, and the job also installs dependencies and runs six browser viewports.
  - A longer match limit on a bigger map multiplies the sim time, as section 3 shows.

Other places that reference the game:
- `qa/arcade/quiet.mjs:384` boots `/tidebreak/` by waiting for `#play` to be enabled, then clicks it.
- `mods/sync.mjs:38-40` copies the announcer clips.
- `mods/cabinet-spinner/hooks/cabinets.ts:23` lists the folders.

## 2. Current Node results (sequential, `node` 22.22.0)

| Suite | Result | Time |
|---|---|---|
| adapt | PASS | 0.13 s |
| base-attacks | PASS | 0.21 s |
| combat-decisions | PASS | 0.12 s |
| combat-feedback | PASS | 0.09 s |
| creatures | PASS | 1.17 s |
| encounters | PASS | 0.11 s |
| hero-classes | PASS | 0.16 s |
| hero-gifs | PASS | 0.12 s |
| hero-identities | PASS | 3.12 s |
| items | PASS | 0.10 s |
| legends | PASS | 0.13 s |
| pointers | PASS | 0.11 s |
| river | PASS | 0.42 s |
| scenery | PASS | 2.93 s |
| **sim** | PASS | **161.29 s** |
| skill-aim | PASS | 0.12 s |
| skills | PASS | 0.19 s |
| tactical-combat | PASS | 0.51 s |
| targeting | PASS | 0.26 s |
| **team-presence** | PASS | **27.06 s** |
| towers | PASS | 0.11 s |
| qa/creatures/shared | PASS | 0.11 s |

Total: about 198.6 s.

`sim.test.mjs` plays 36 full matches (3 seeds × 12 kits):
- 15 of 36 reach the 360 s limit.
- Kills per match range from 6 to 24, median 11.
- The peak unit count is 58 to 62.

I did not run the browser tests (`desktop.e2e.mjs`, `qa/creatures/browser.mjs`). They need the static server and Chromium, and other agents were active in the same checkout.

## 3. Experiment: change only `SIZE`

I made two copies of HEAD from `git archive`, with `arena.js:2` patched to 9600 and to 12800, and ran every suite against each.

| Suite:line | 9600 | 12800 | Cause |
|---|---|---|---|
| `towers.test.mjs:24` | FAIL | FAIL | `assert.equal(SIZE,6400)`. Without that line, everything else in the suite passes at both sizes. |
| `sim.test.mjs:7-8` | FAIL | FAIL | `SIZE===6400`; `(SIZE/1600)**2===16` |
| `encounters.test.mjs:38-39` | **TypeError** | **TypeError** | `OBSTACLES[1].find(w=>w.w<240)` finds nothing. The narrowest obstacle in the second realm becomes 255 (9600) or 340 (12800), against 170 today. |
| `combat-decisions.test.mjs:40` | FAIL | pass | The puller at a fixed (3200,3580) sits inside `ruin-yard`, so the pull's line of sight is blocked (`:37-38`). |
| `hero-classes.test.mjs:54` | FAIL | pass | Dryad's roots spread to the third target: the 2nd and 3rd targets at (2620/2840, 2630) sit inside `cliff-ridge`. |
| `skill-aim.test.mjs:35` | FAIL | pass | The foe at (2620,3020) is behind `cliff-ridge`, so `castTarget` returns undefined. |
| `team-presence.test.mjs:107` | pass (barely) | FAIL | `laneAt({x:6000})==='East'`. The rule is `SIZE*.62` (`team-chat.js:5`), which is 5952 at 9600 and 7936 at 12800. |
| `sim.test.mjs:33` | pass | FAIL | "Mothman flies across the building": the building, COVER[0] scaled, becomes wider than the blink. |
| `sim.test.mjs:63` (full matches, with `:7-8` removed) | FAIL | FAIL | `kills > 4` fails once at each size: seed 3 Jersey Devil (a 91 s rift kill with 4 kills) at 9600, and seed 3 Kitsune at 12800. |

Full matches at each size (`matches9600.log`, `matches12800.log`):
- **6400:** 15 of 36 matches reach 360 s; peak units 58 to 62.
- **9600:** 18 of 36 reach 360 s; peak units 67 to 70.
- **12800:** 26 of 36 reach 360 s; peak units 72 to 79.

The run time rises with the map. The 9600 and 12800 runs went in parallel, so their times are inflated:
- 9600: about 264 s.
- 12800: about 401 s.
- `team-presence`: 27 s today, 37 s at 9600, 55 s at 12800.

Tests that rely on fixed open ground at a fixed position, which the geometry check confirms (`geo.mjs`):
- **(2400,4000) as a "far away" spot:**
  - It lands inside `market` at 6400 today, and inside `ruin-yard` at 9600.
  - Used at `creatures.test.mjs:23,30`.
- **(2620,3020):** blocked at 9600.
- **(3200,3580):** blocked at 9600.
- **(2620,2630) and (2840,2630):** blocked at 9600.
- **(3650,3510):** inside `cliff-ridge` at 12800.

## 4. Assertions that encode the things being changed

### 4.1 Map size and scale
- **`towers.test.mjs`:**
  - `:3` imports `SIZE`, `TOWER_POSITIONS` and `BASES`.
  - `:24` asserts `SIZE===6400`.
  - `:28` prints "6400-unit arena".
- **`sim.test.mjs`:**
  - `:7` asserts `SIZE===6400`.
  - `:8` asserts `(SIZE/1600)**2===16`.
  - `:61` keeps every unit's `x` in `[180, SIZE-180]`. This works with the clamp in `world.js:95`, which is not scaled.
- **`river.test.mjs`:**
  - `:8` asserts the last river sample has `x===SIZE`.
  - `:14` requires `north > 1400*MAP_SCALE` and `south < 2900*MAP_SCALE`.
- **`team-presence.test.mjs:107`:** `laneAt({x:6000})==='East'`.
- **`sim.test.mjs:20-23,32-33`:** assert the authored building COVER[0] (`world.js:46`) through `arenaPoint(1600,1600)` → `(1600,2100)` and `(1170,1850)` → `(1690,1850)`. They also assert a blink of more than 480 units, a distance that does not scale with the map.

### 4.2 Fixed world coordinates (they assume open ground at that spot)
Each suite places units at fixed points, mostly x=2400 or 3200, with y between 2400 and 4000.
- **`sim.test.mjs`:**
  - `:6` duel at (2400,2800) and (2400,2650).
  - `:38` Nessie pull at (2400,2440), with the result inside 110 units.
- **`scenery.test.mjs:27`:** an "open lane" duel at (2400,3100) and (2400,3000).
- **`targeting.test.mjs`:**
  - `:5` setup at (2400,3100) and (2400,2700).
  - `:7` the foe stands at range + 180.
  - `:25-26` a route around the wall `OBSTACLES[0][0]` within 600 frames.
- **`base-attacks.test.mjs`:**
  - `:9` duel at (2400,3100) and (2400,3000).
  - `:28` a deliberate miss with `foe.y=2000`.
- **`tactical-combat.test.mjs`:**
  - `:6` setup at (2400,2800).
  - `:35` the "far" hero at x+1500 gets no experience, because of the 1200 sharing radius in `sim.js:60`.
  - `:38` the test tower at y−200 and the hero walking out by x+800.
- **`combat-decisions.test.mjs`:**
  - `:7` setup at (2400,2800).
  - `:37` fixed positions (3200,3200), (3650,3510) and (3200,3580).
  - `:62-64` the hero at `CENTER`, where the boss also spawns (`sim.js:406`), with the boss at y−220 and the hero moving x+800.
- **`hero-classes.test.mjs`:**
  - `:7` setup at (2400,2800).
  - `:35` asserts `p.x > 2400`.
  - `:54` places foes at x+220, x+440 and y−170.
- **`legends.test.mjs`:** `:8` and `:40` use (2400,2800).
- **`skills.test.mjs`:**
  - `:4` setup at (2400,2800).
  - `:23-35` fixed foes at 2400/2450/2600 and 2550 to 3000.
- **`items.test.mjs`:**
  - `:4` setup at (2400,2800) and (2400,2660).
  - `:94` a wisp 700 units away.
- **`skill-aim.test.mjs`:**
  - `:7` setup at (2400,3100).
  - `:33` foe at +220/−80 and an empty spot at −350.
- **`creatures.test.mjs`:**
  - `:9` the hero at camp + 85.
  - `:20` the camp pulled to home + 420, which triggers its leash.
  - `:23,30` the hero parked at (2400,4000).
- **`encounters.test.mjs`:**
  - `:9-10` positions relative to `CENTER`, with the hero at +180.
  - `:21` a dodge of 600.
  - `:51` a hero 700 away, beyond sight.
  - `:90-101` offsets of 380, 440, 500 and 100.
- **`river.test.mjs`:**
  - `:38` the hero at `CENTER`.
  - `:41` a 1.4× water-speed check against open ground at `CENTER.y+700`.
- **`team-presence.test.mjs`:**
  - `:76` an ally 900 away, inside `ASSIST_RANGE` of 1900 (`team-events.js:9`).
  - `:83` a rally point at +600, inside `RALLY_RANGE` of 3200 (`:10`).
  - `:86` an enemy 700 away.
  - `:105` a ping at x:1000 reads "West".

### 4.3 Tower counts and tiers
- **`towers.test.mjs`:**
  - `:5` loops over three lanes.
  - `:7` expects `tier===0` (outer) and `tier===1` (inner) only.
  - `:8` expects 12 towers, `s.towers` equal to `[6,6]`, and `distance(outer,inner)>400`.
  - `:9` checks every tower footprint lies on walkable ground in both realms.
  - `:10-11` the inner tower and the core take no damage, and an attack order on them is refused.
  - `:12` the next objective is the outer tower and the text matches `/outer/`.
  - `:13` after the outer tower falls: the inner tower is open, the core is still protected, and the text matches `/inner/`.
  - `:15-16` a tier-1 tower in another lane stays protected.
  - `:17` after the inner tower falls, the core is unprotected and becomes the objective. Base guardians would change this.
  - `:18` a destroyed ward pays no second reward.
  - `:19` killing the core sets the winner.
  - `:22` treats `TOWER_POSITIONS[0][1][0]` (index 0) as the outer ward.
  - `:23` the hero starts between that outer ward and the base.
- **`sim.test.mjs`:**
  - `:13` expects `tier` 0 and 1 in the middle lane.
  - `:14` the inner tower is protected.
  - `:15` `s.towers[1]===5` after the outer tower falls.
  - `:16` the core is still protected.
  - `:17` `s.towers[1]===4`, then the core can be killed.
  - `:63` asserts `s.towers.some(t => t<6)`. The 6 is hard-coded; with 9 towers a side, the assertion would need four towers to fall.
- **`team-presence.test.mjs`:**
  - `:63` picks the lane-2, `tier===0` ward.
  - `:68` expects the call "East outer ward under attack", built in `announcer.js:32` as `ping.tier ? 'inner' : 'outer'`.
- **`tactical-combat.test.mjs:38`:** a test tower (`tier:0`, range 360, damage 100) hits for 100, then 122, and resets after the hero leaves. This is the tower-pressure ramp from `sim.js`, through `towerHits`.

### 4.4 Lanes, river, bridges and scenery
- **`sim.test.mjs:9`:** every lane segment has line of sight in both realms.
- **`scenery.test.mjs`:**
  - `:14-16` every solid prop matches an entry in `OBSTACLES`.
  - `:17-18` small props keep `laneDistance ≥175`, `outsideRiver ≥35` and a 340 gap to solid props. These distances do not scale.
  - `:41` each lane has more than 60 samples.
  - `:42` lane endpoints equal `BASES`.
  - `:44-47` a body of radius 42 fits every sample, with sight between samples.
- **`river.test.mjs`:**
  - `:11` meanders span more than 400 units (not scaled).
  - `:12` width varies by more than 75.
  - `:20` there are 3 bridges, one per lane.
  - `:21` bridges sit on the river and span both banks.
  - `:25` the channel keeps more than 15 on each side.
  - `:30-32` bridge ends land on dry ground for 128 seeds.
- **`targeting.test.mjs:25`:** a route around `OBSTACLES[0][0]`.
- **`encounters.test.mjs:38`:** needs a second-realm obstacle narrower than 240.
- **`creatures.test.mjs:36`:** 4 camps.
- **`targeting.test.mjs:30`:** camp sprites equal `['possessed-ogre','undead-knight','undead-mage','undead-archer']`, which also means exactly 4 camps.
- **Two-entry camp timers:** many setups write `s.campTimers=[Infinity,Infinity]` or `[9999,9999]` (`sim.test:6`, `base-attacks:8`, `targeting:5`, `river:37`, `scenery:26`, `items:4`) while there are 4 camps. They still work only because `s.time >= undefined` is false.

### 4.5 Match length and pacing
- **`sim.test.mjs`:**
  - `:22-23` realm shifts at 40 s and 80 s (`SHIFT`, `world.js:6`).
  - `:50` a 7 s respawn (`respawn = 5 + level`, `sim.js:119`).
  - `:53` the boss exists after 27 s (`objectiveAt: 26`, `sim.js:40`).
  - `:54` a camp exists after the first step.
  - `:59` matches run up to `(LIMIT+1)*20` ticks (`LIMIT = 360`, `world.js:5`).
  - `:63` needs a winner, both realm phases (so a match of at least 40 s), fewer than 150 units and more than 4 kills.
  - `:66` an 85 s deterministic replay.
- **`creatures.test.mjs:30`:** waits 31 s, then 2 s more, for a camp to respawn (+32 s, `sim.js:135`).
- **`skills.test.mjs:14`:** 25 s to respawn.
- **`tactical-combat.test.mjs:14`:** 12 s to respawn, then full mana.
- **`team-presence.test.mjs`:**
  - `:88` the rally expires after 12 s.
  - `:94` bot matches stop at `s.time < 400`, so a longer limit is cut off.
  - `:95-99` still need a kill, an on-my-way ping, a fight ping and exactly one first blood within that time.
  - `:47` and `:66` use `MULTI_KILL_WINDOW` and `ALARM_COOLDOWN`.

### 4.6 Art asset names
- **`hero-identities.test.mjs`:**
  - `:7` imports `loadArt` and `Renderer` from `illustrated-render.js`.
  - `:42` the spellbook HTML contains `./art/reference/${slug}.webp`.
  - `:84` there are 16 `/reference/` requests.
  - `:85` a failed art load leaves `null`.
  - `:86` needs art `nessie-front`, `nessie-back` and `nessie-attack-back-0`.
  - `:103` the drawn sprite matches `/^nessie-attack-/`.
  - `:104-109` checks `reference-tidewarden` and the `lastPoses` fields (`asset`, `renderAsset`, `stage`).
- **`hero-gifs.test.mjs`:**
  - `:4-6` reads `art/animated/sources.json` with 12 heroes.
  - `:9-10` checks each `${slug}-idle.gif` (GIF89a header, byte count, size).
  - `:18` needs at least 24 frames and the NETSCAPE2.0 loop.
- **`base-attacks.test.mjs:43`:** the two base styles use different art, `shrine` and `abbey` (`bases.js:3-4`).
- **`scenery.test.mjs:12`:** at least 10 distinct prop names.
- **`creatures.test.mjs:37,40`:** creature IDs come from the `CREATURES` catalog, with at least 10 distinct.
- **`qa/creatures/shared.test.mjs:7-26`:** 18 exports, 9 families, 4 clips in 8 directions.
- **`qa/creatures/browser.mjs`:**
  - `:27` the Creature Field Guide shows 18 cards.
  - `:44-46` all 16 portraits use `url(...reference-source.png)` with no gradient.
  - `:127-128` the stage art `src` is `./art/reference/${slug}.webp`.
  - `:196-197` loads `/tidebreak/art/reference/reference-source.png` and `shore-scene.webp`.
  - `:198` the first portrait uses `reference-source.png`.
  - `:25`, `:233` any 404 fails the test.
- **`team-presence.test.mjs:58`:** every `CLIPS` MP3 exists.
- **`combat-feedback.test.mjs:23-24`:** 12 distinct cast pitches.

### 4.7 Renderer and layout contracts
- **`adapt.test.mjs`:** `:5`, `:10-13`, `:27-29` and `:66` drive `Renderer.prototype.adapt`, `restartTiming` and `backingRatio`. They rely on `PIXEL_BUDGET = 2560*1440` and `QUALITY_FLOOR = .5` (`illustrated-render.js:14`).
- **`skill-aim.test.mjs`:**
  - `:8,12` call `Renderer.prototype.project`, `world` and `screenDirection`.
  - `:11` copies the camera rule `scale=min(w/1200,h/1680)` and `anchor .70/.78` (`illustrated-render.js:53-54`).
  - `:10` checks 1440×900, 390×844 and 844×390.
- **`desktop.e2e.mjs`** (not in CI; needs the server):
  - `:37` reads `snapshot()` (`main.js:468`). `graphics` comes from `renderer.stats()` (`illustrated-render.js:342`).
  - `:44,49-54` element IDs `#play`, `#hud` and `#sheet`.
  - `:72-75` `#pause-test`, `#sound-test-result` and `#sound-test-back`.
  - `:80-85` `#hud-sound` and `#muted-chip`.
  - `:101` `#menu-muted-chip`.
  - `:114-116` `#pause` sits at x<40, y<40 with width ≥80, and reads `/Menu\s*Esc/`.
  - `:119-122` `graphics.push` near 0 at the centre, above 400 at the right, below −400 at the left. Push is in world units with a cap of `width*.34/scale` (`illustrated-render.js:118`). `freeCam` must stay false.
  - `:130` push below −200 with the mouse outside the window.
  - `:135-137` holding Space brings push under 30.
  - `:156-160` `#map-button` and `freeCam` while the minimap is held.
  - `:161-163` `heroScreen.x` stays within 16% to 84% of the width.
  - `:167-176` a click gives a move order, and the order and a held key survive a resize.
  - `:179-189` `#fullscreen-back`, a `#resume` that reads "Keep playing windowed", and `tidebreak.fullscreen` saved as `off`.
  - `:216-217,231` the hero walks right for 1 s from spawn ("about 500 units, short of the first obstacle") and must move more than 250.
  - `:233` jitter under 0.3 px at 144, 75 and 60 Hz.
  - `:245-247` on a 390×844 phone, `.score` does not overlap `.hud-corner > *`.
  - `:256-261` the `#battle` canvas stays within 2560×1440×1.01 pixels, and `#perf pre` matches `/frame .* ms median/`, `/canvas \d+x\d+/` and `steps/frame < 50`.
- **`qa/creatures/browser.mjs`** (in CI):
  - `:21` six viewports.
  - `:37` page title `/Shore of the Ancients/`.
  - `:38-40` `#menu`, 16 `[data-hero]` cards and `#hero-art`.
  - `:43` the first hero is "Tidewarden".
  - `:49-57` six controls visible in the viewport.
  - `:58` the roster width is at least 0.27× (desktop) or 0.8× (phone) of the viewport.
  - `:59-62` on desktop, `.roster-browser` is 32% ±1% of the width.
  - `:63-94` footer, 4 spell buttons, key labels, 6 role filters, at least 4 usable cards, 4 columns and fitting captions.
  - `:95-119` swipe and Home on compact screens.
  - `:120-136` per-identity name, role, note, tags, art, spell titles and Q/E/C/R keys.
  - `:137-151` role filters and the 4-column keyboard grid.
  - `:152-177` the texts "Rising Current", "Pull enemies in a cone", `Q · Tidal Cleave` and 4 `h3`.
  - `:179-186` panel titles "Tidecaller", "The shifting realms", "The Night Market" and "Game settings".
  - `:204-208` 6 draft cards.
  - `:209-222` the spellbook flow (`#train-selected`, `#back-skills`).
  - `:223-225` **`graphics.creatures.loaded > 0` and `failed === 0`.** This comes from the 2D renderer's creature sprite bank (`illustrated-render.js:34-35`). A 3D default renderer without that field makes the `waitForFunction` at `:223` time out.
  - `:226-228` holding `d` moves the hero right.
  - `:229-231` `#coach-close`, `#pause` and "Keep playing".

### 4.8 Suites with no link to map, tier or art
- `pointers.test.mjs`.
- `combat-feedback.test.mjs`, apart from the 12 pitches.
- Most of `items.test.mjs`. It does assert `ITEMS.length===26` (`:96`).
- The kit, mana and timing parts of `skills`, `legends`, `hero-classes` and `combat-decisions`.

## 5. Code constants that encode the same facts

**Size and layout:**
- `arena.js:2-5`.
- `world.js`:
  - `:7` BASES; `:9-13` LANES knots; `:19` track samples every 55 units; `:27` PATHS (extra middle-lane knots).
  - `:33-37` TOWER_POSITIONS: the outer ward at lane knot 1 or 3, the inner ward at 48% along the lane.
  - `:38` PORTALS; `:39` CAMPS; `:45-60` COVER; `:61` OBSTACLES (×0.58 in the second realm); `:62-66` BRUSH; `:67` RIVER.
  - `:83` sight 950/620/500 and `:95` the 200/180 clamp, neither scaled.
- `river.js:20,24`.
- `paint-ground.js`:
  - `:29-31` the ground is a fixed 3072 px canvas, so detail per world unit drops on a bigger map.
  - `:78,83,84` use raw y values 1300 and 1700 and a gradient from (0,1700) to (4000,2600), not scaled.
- `illustrated-render.js`:
  - `:124-126` the camera clamp; `:131` the ground draw.
  - `:285-289` the river shimmer; `:314-339` the minimap scale.
- `scenery.js:36,44,50,64,71`.
- `team-chat.js:5` (`laneAt`).
- `team-events.js:9-10` (assist 1900, rally 3200); `combat-ai.js:52` (1900).
- `sim.js`:
  - `:35-36` the hero spawns 180 behind the outer tower.
  - `:60` experience is shared within 1200.
  - `:330` the first wave starts at `LANES[lane][2]` ±370.

**Towers:**
- `sim.js`:
  - `:40` `towers:[6,6]`.
  - `:43` the build loop runs `tier<2`.
  - `:44-45` HP 2700/3400, range 360/390, damage 180/195, names "Outer"/"Inner".
  - `:73` the "Inner ward protected" message.
  - `:125-126` the reward and the "Both wards are down" text.
- `objectives.js`:
  - `:1` LANE_NAMES.
  - `:5` a lane is open when `towers.length === 2` and both are down.
  - `:9` protection checks `tier===1`.
  - `:18` the text uses outer/inner and "/6".
- `announcer.js:32`; `team-events.js:38`.
- `illustrated-render.js:184,204,224,331`; `main.js:355`; `bases.js:35`.

**Pacing:**
- `world.js:5-6` (LIMIT, SHIFT).
- `sim.js`:
  - `:40` the first wave at 1 s and the boss at 26 s.
  - `:129` the boss returns after +65 s; `:131` the Wild Hunt.
  - `:135` camps return after +32 s; `:119` respawn takes 5 + level.
  - `:188` damage rises after 240 s.
  - `:330-331` 3 units per lane per wave, with a siege unit every 3rd wave.
  - `:404` waves every 14 s; `:427` 3.2 gold per second; `:450` the 1.35 sprint.
  - `:519-521` the six-minute tiebreak.
- `main.js:236` (match timer) and `:276-279` (realm countdown).
- `team-events.js:5-6`.

**Art:**
- `illustrated-render.js:21`, the asset name list (`tower-ally`, `tower-enemy`, `bridge`, …).
- `bases.js:3-4`.
- `index.html:23` preloads `shore-scene.webp`.

## 6. OpenSpec requirements the change would modify

The OpenSpec CLI is not installed (`which openspec` finds nothing), so no CLI validation is possible.

**`openspec/specs/moba-combat/spec.md`:**
- `:4` Purpose: "Both towers in one lane must fall…".
- `:8-17` Larger distinct bases (base guardians, new silhouettes).
- `:49-54` Imported neutral artwork (MagicPixel sprites).
- `:56-63` **Expanded two-stage arena**: 6400 units, an outer and an inner tower, and the core unlocking after two towers.
- `:65-74` Clear match flow: start "behind their allied outer towers", map routes, camera.
- `:76-81` Tactical combat decisions (bots).
- `:83-88` Spell resources.
- `:90-95` Lane and tower pressure (the experience radius and the tower ramp).

**`openspec/specs/moba-ui/spec.md`:**
- `:103-120` Reference opening scene (supplied composition, gold wordmark, cyan selection).
- `:122-147` Contained reference layout: four columns and a roster at about 32% width, with the checked viewports.

**`openspec/specs/moba-roster/spec.md`:**
- `:8-17` Twelve archetypes ("the match finishes").
- `:19-32` Sixteen identities: "source-matched selection artwork", and the fallback when a battle sprite fails to load.

**`openspec/specs/moba-skills/spec.md`:**
- `:57-64` Four-button thumb fan (HUD restyle and layouts).
- `:87-89` Complete a match.
- `:106-113` Painted spellbook ("supplied painted reference… cream serif… gold frame").

**Active `openspec/changes/moba-combat-decisions/`:**
- `design.md:3`: "Preserve… the six-minute match limit" and the "existing… visual direction".
- `proposal.md:3`: "retaining the painted art".
- Deltas in `specs/moba-combat/spec.md`: Independent control effects (`:3`), Committed major attacks (`:10`), Varied readable encounters (`:25`) and Punishable commitments (`:37`). These are the combat-fun rules.
- Deltas in `specs/moba-skills/spec.md`: Precise skill placement (`:3`) and Readable combination states (`:14`, with layout checks).
- `tasks.md:8-10` are still open.

**Active `openspec/changes/moba-team-presence/`:**
- `specs/moba-combat/spec.md:3` Teammates answer fights and calls. The ranges (1900 and 3200) are in `design.md:9`.
- `specs/moba-ui/spec.md`:
  - `:18` Team presence on the map (minimap structures).
  - `:47` Readable skill icons ("painted art").
  - `:54` Desktop camera control (push of about a third of the screen, minimap look).
  - `:73` Menu and sound in the top left.
  - `:107` **Smooth on large screens**: the 2560×1440 budget, creature art kept loaded, and a readout showing the graphics renderer.
  - `:122` Compact skill cluster.
- `specs/moba-audio/spec.md:3` Battle announcer (alarms naming the lane, wards falling).
- `design.md:17-27` records the camera numbers.
- `tasks.md:35-38` are still open.

**New `openspec/changes/shore-grand-arena/`** (named `shore-*`, not `moba-*`):
- It has `proposal.md` and `design.md`; `specs/` is empty, so no requirement deltas exist yet.
- It plans to modify `moba-combat`, `moba-roster` and `moba-ui` and add `moba-graphics` (`proposal.md:20-23`).
- The size conflict is described in section 0.

**Out-of-date docs:** `docs/tidebreak.md:7` (4800), `:20` ("any enemy wardstone exposes the rift") and `:57` ("12 full bot matches").

## 7. Consequences for the implementation

1. **Fixed coordinates.**
   - About 15 suites place units at absolute world points.
   - At 9600, three suites fail because those points now land inside scaled cover. At 12800, one more point lands in cover.
   - A shared "open spot" helper, or positions written with `arenaPoint`, would decouple them from the map size.
2. **Second-realm obstacle width.** `encounters.test.mjs:38` needs a new way to pick a narrow obstacle (or a scaled 240) at any bigger size.
3. **Three tiers plus base guardians.** These parts must be rewritten:
   - `towers.test.mjs:7-19,22-24,28`
   - `sim.test.mjs:13-17,63` (`[6,6]`, 5/4, `t<6`)
   - `team-presence.test.mjs:63-68` (the tier name in the alarm)
   - the code paths `objectives.js:5,9,18` and `announcer.js:32`, which these tests check.
4. **Match length.**
   - At 9600 with unchanged pacing, half the matches reach the 360 s limit, and one match fails `kills>4` after a 91 s rift kill.
   - A longer `LIMIT` with bigger maps and more units raises the `sim.test.mjs` time several-fold. That threatens the 10-minute CI job (`creature-browser.yml:13`).
   - The 400 s loop in `team-presence.test.mjs:94` may also need to grow.
5. **Renderer coupling.**
   - `adapt`, `skill-aim` and `hero-identities` import `illustrated-render.js` directly. They keep working only if the 2D renderer stays as the fallback.
   - The browser tests read `renderer.stats()` from whichever renderer is the default: `push`, `freeCam`, `heroScreen`, `creatures.loaded/failed`, the `#battle` canvas and the `?perf` readout text.
   - A three.js default must provide these fields, or `desktop.e2e.mjs:119-163,256-261` and `qa/creatures/browser.mjs:223-225` must change.
6. **New art.**
   - These tests pin the current file names and layout: `qa/creatures/browser.mjs:44-46,58-62,127-128,196-198`, `hero-identities.test.mjs:42,84-109`, `hero-gifs.test.mjs` and `base-attacks.test.mjs:43`.
   - The DOM IDs listed in 4.7 must survive the restyle, or those tests change with it.
   - `qa/arcade/quiet.mjs:384` also depends on `#play`.