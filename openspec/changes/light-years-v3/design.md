# Light Years Home v3 design

## Source and scope

The contract is the lead's v3 design (2026-10-13, with an adversarial playtest pass on 2026-10-14). It merges five
specialist designs (handling, world, story, races, tech) and a research report on car-like flight, open-world event
design, touch driving and the feel of speed. The lead's build decisions of 2026-10-14 override it where they differ;
they are listed below. Every number is a starting value: bots, tests and crew playtests set the final ones, and the
specs, this file and `core/tune.js` follow the code.

The specs describe the whole of Chapter 1. It is built in two rounds (below). Requirements that name Coma's missions,
Coma's events, Vela, Virgo, the jet, J2, J3, the end card or the arcade machine are Round 2 work.

## The user's art direction and input preferences

Keep these through every change to this game.

- **What to drive.** The user chose "Ship, flown freely": an arcade spaceship with car-like handling (throttle, steer,
  drift, boost) that flies anywhere round each landmark. They chose all three kinds of adventure: explore and discover
  (secrets, scans, collectibles, a ship AI that talks on the way home), missions and story ("GTA in space": deliveries,
  rescues, chases) and races and challenges (Saturn's rings, M87's jet, the Orion Nebula).
- **What bored them.** v1's clue-and-throttle loop was "stale", and both v2 prototypes, a ring steered on rails (lab
  A) and a hold-to-swing fling (lab B), were "boring". So nothing in v3 runs on rails except the short run-up, every
  place is open, and the ship must be fun to drive with no goal.
- **The look is the video's.** Black space, white points, thin white rings with diagonal leader lines and small labels,
  small grey info boxes, and bold uppercase captions in 2 or 3 word chunks with the current word in orange
  (`#f08a2c`). The ship adds one orange nose. Speed is felt, not shown: near things to skim, a wider view, dust that
  stretches into lines, 60 fps, no motion blur, no post-processing. The physicist in the video is not named or shown,
  and every line is our own words.
- **Light speed is felt.** The jump uses the real aberration, Doppler colour and beaming already on main in
  `render/points.js`. The scale inside a place is stylised, and the game says so on arrival.
- **Phones.** Separate steering and pedals, as the user chose for NORD this week (`nord-mobile-driving`), in portrait
  and landscape, with auto-cruise so only the stick is needed. One thumb is a setting.
- **Desktop.** W, A, S, D and Space are the arcade's car keys already (In Full Swing). Mouse steer is a setting, never
  picked by moving the mouse. A standard gamepad works.

## Lead decisions for this build

1. **Cutover now.** v3 replaces v1 at `/light-years-home/` in this change's first round. v1-only files and tests go
   (git keeps them); the labs and the modules they import stay.
2. **The jump is a free corridor, not lab A's ring rim.** The user called lab A boring. See "The jump" below.
3. **Cruise is 24 u/s**, not 20. With auto-cruise most phone players rarely touch GAS, and 20 u/s is two-thirds of
   top speed. The ship test's cruise checks move with it.
4. **Cut from Chapter 1:** SHINY THINGS (it repeated the Wall's chase-and-catch) and Downtown Eight (two laps of named
   gates, the event most likely to feel like "fly through rings"). The Magpies appear at the Wall, and THE STRAIGHT
   RAY starts by itself on arrival in Virgo; both are confirmed.
5. **Phones default to stick and pedals with auto-cruise** in both orientations; one thumb is a setting.
6. **Arcade:** the machine goes in the Action group, in Round 2.
7. **Two rounds.** Round 1 is M1 to M3 plus the cutover; Round 2 is M4 to M6.
8. **Paths.** Node tests and browser checks live in `qa/light-years-home/v3/`; the hook is `window.__lyh`, version 3.
9. **One OpenSpec change**, this one. `add-light-years-home` is marked superseded in its proposal and is not
   archived.

## How the five designs were merged

| Topic | Decision | Why |
|---|---|---|
| Rival | Vela flies the Swift, meets you at Coma and saves you on M87's jet. She calls you "bird". | Keeps the story's character and the races' rival race at Coma. |
| Earth's clock | v1's clock: today minus the route light-years still ahead; it moves only in jumps. | "You land the moment you left" needs it. |
| Chapter 1 scope | The Wall, J1, Coma, J2, Virgo with its story mission and the jet pocket, J3 to a cliffhanger at the Andromeda edge. | The user named "along M87's jet", and the chapter needs its own ending. |
| Portrait controls | Stick and pedals with auto-cruise by default; one thumb as a setting. | The NORD preference, and it still passes the one-thumb toy test. |
| Radar in portrait | Top right under the toast. | The steering thumb covers the lower left. |
| Tap in a race | Back to the last gate; a 0.35 s hold restarts. No rewind. | No state history in the core; a restart takes 1.6 s anyway. |
| Input after PLAY | 0.3 s. | |
| Narration | Our own lines (`EACH POINT HERE IS A GALAXY`, "Two giants downtown. That's Coma."), not the video's. | The brief asks for our own words. |
| Inner Ring traffic | 24 u/s. | Zwicky's fact is that these galaxies move too fast; it also makes a draft lane and the Zwicky's Clue secret. |
| M87*'s well in the jet race | Events and beats can switch wells off. | Keeps Ride the Jet's start and restart points. |
| The Shadow secret | One drift lap within 20 u of M87* at 26 u/s or more, with a strong well (radius 14, gain 0.9). | The handling cannot turn tighter; a drift bot laps it in about 3 s. |
| Scanning | Hands-free: hold the target in the nose; Cruise also scans what you pass close. | One fewer control for thumbs. |
| Naming Node 0 | Cut: "No name. Just a number." | A text box mid-drive costs UI for little fun. |
| Fact cards | Never pop up in play. The info box shows the number for 3 s and the text waits in the log. | No text walls. |
| First minute | Open on the misfire's drop-out at 38 u/s; three seeded near misses by 4 s; the Magpie steals the chart by 80 s. | The first purpose came at 78 s and was "aim at three rings". |
| Jump length | `L = round(clamp(9.5 + 2·log10(ly), 16, 28))`: J1 18 s with a 6 s soft start, J2 26 s, J3 25 s. | A short set piece that pays, not a long one. |
| Jump reward | The medal sets the arrival bar: bronze 0.5, silver 0.75, gold or Tern full. | A clean jump feeds the next place's first minute. |

Kept as the specialist designs wrote them: the handling's flight model, drift, bar, near misses, collisions, wells,
tow, edges, camera, dust and shake; the races' event kit, gates, pads, ghosts, pacer, medals and restarts; the story's
premise, cast, talk rules and mission rules; the world's zone rules, zone kit, discovery and density targets; and the
tech design's three layers, fixed step, traffic as a function of time, saves, budgets, loading and hook.

## Cut from Chapter 1

| Cut | Where it went |
|---|---|
| SHINY THINGS (Coma chase) and Downtown Eight (Coma circuit) | Lead decision 4; Chapter I extras if reworked |
| INFALL (a second tow) and HOT KNOT (an investigation) at Virgo | Chapter I extras |
| The Web Highway lap, the Downtown Run, the Infall rival race, Cluster Halo | Chapter I extras; each needs bot tuning |
| Free-roam duels with Vela | Chapter I extras |
| Rewind | Later, if crew tests ask for it |
| The Lost Stars secret | Dropped: its find was "a sparse field" |
| Text-to-speech | Not planned; captions carry the meaning |
| Haptics on iOS | Not possible (no Vibration API) |

What is left: 3 story missions, 2 side jobs (FIRST SHOUT, FRAGILE), 5 timed events, 14 stunts, 3 jumps, 24 scans, 3
Look Home postcards, 3 place cards, 4 secrets, 2 sets and 90 sparks. One Light Years FM tape (`wake-up-call`).

## What is real and what is made up

- **Real:** every landmark's direction and facts (`core/objects.js` and sourced cards), Earth's history by date, light
  speed, aberration, Doppler colour and beaming in the jumps, and Earth's clock.
- **Made up:** the misjump; the people out in the cosmic web; the scale and speed inside a place (each is a diorama at
  its own map scale, and the scale card says so); the instant punch to light speed; D100's tail, drawn longer than
  real (its card says so).
- The game says this in Dot's first minute, the help text and the end card. The end card also gives the real speed
  the trip would need, in nines of light speed, from the chapter's distance and the player's time.

## Architecture

- **Three layers.** `core/` is pure: no DOM, no three.js, no `Date`, no `Math.random`, no `performance`, no storage
  object of its own. `render/` never imports `ui/`, and `ui/` never imports `render/`. `main.js` is the only file that
  imports all three. A purity test scans every file.
- **Fixed step.** The core steps at 120 Hz, at most 8 steps a frame, and the renderer draws between two steps.
  Traffic positions are pure functions of the place's clock, so a race or checkpoint can set that clock and replay the
  same traffic.
- **Data.** Places, events, missions, lines and cards are plain data modules in `core/world/`, checked by
  `world/schema.js`. Every feel number lives in `core/tune.js` with a range and a `?tune.GROUP.KEY=value` override.
- **Events.** The core pushes typed events into one reused buffer. One table in `main.js` maps every type to a sound
  and an effect, and the hook counts the sounds that really started.
- **Bots** are functions from state to an input record, so the same bots run in node, through the hook and live with
  `?bot=`.

## Handling starting values

| Value | Start | Note |
|---|---|---|
| Cruise / top / boost / drift-boost / cap | 24 / 30 / 42 / 37.5 / 48 u/s | Cruise from lead decision 3 |
| Up to cruise | 95% in 0.99 s | `K_LOW` 3.0 per s; independent of the cruise value |
| Cruise to 28.5 u/s on the gas | about 1.85 s [arithmetic] | Was 2.52 s from 20 u/s; `ship.test` uses the measured value |
| Brake | 17 u/s²: 30 to 24 u/s in about 0.35 s, 24 to 0 in about 1.4 s [arithmetic] | Below 4 u/s the ship pivots, 180° in 1.12 s |
| Full steer at cruise | turn rate about 1.64 rad/s, radius about 15 u [arithmetic] | Was 1.8 rad/s and 12 u at 20 u/s |
| Drift tiers | 0.88 / 1.68 / 2.48 s of full in-turn steer | Charge does not depend on speed |
| Scrape / head-on | keep 90% / bounce at 40%, floor 6 u/s, back to 95% of cruise in 1.6 s | |
| Bar | full lasts 3 s; near +0.06, hairline +0.12, thread +0.10, takedown +0.25, spark +0.04, crash −0.25 | |
| Camera | FOV 90° vertical in portrait, 86° and 82° across in landscape and on desktop; boost kick +10° to +12° | Drift look-in 14° portrait, 6° elsewhere |

## The jump: a free corridor

The merged design kept lab A's verb for the run: ride the rim of the ring that aberration makes, like the Blaster in
Tempest. That is the verb of v2 prototype A, which the user called boring, and its touch control used position
mapping while the places use a rate stick, so the thumb changed meaning at every jump. Lead decision 2 replaces it.

**What the player does.** In the run the ship flies down a tube of light. The player steers it across the tube and up
or down with the same stick, keys or gamepad and the same rate steering as in the places. Knots (galaxy groups), rails
(filament strands), walls with gaps (sheets with voids) and gates (cluster rings) come at the ship, with light pads
between them. The player dodges the knots and rails, threads the gaps and gates, and grazes things for speed. The
tube's edge holds the ship in without a hit. Gas does nothing; boost spends the bar for speed. The drift control slides
the ship wider across the tube and charges the drift tiers, as in the places. A jump cannot be failed.

**What carries over from lab A** (on main in `lab/a/core.js` and `sound.js`): the pass check for grazes, hairlines and
threads, the hazard kinds, rail skims, the chain, the hit flicker, the near-miss "zzip" with its pitch raised by
`clamp(cosh φ, 1, 2.4)`, grazes raising rapidity, TWO NINES and THREE NINES, the Headlight, the real aberration and
Doppler of `render/points.js` (blue still coming, red passed, a brightness floor so passed things redden and do not
vanish), the vista and the drop-out, callout priority (THREE NINES, fork, THREAD, tutorial, HAIRLINE), the proximity
whine that cuts when the line is clear, and a dark vignette behind dense stretches.

**What goes:** the ring rim, the camera roll, position mapping on touch (`?tunnelTouch` has no job), the burst behind
you, the lead and the rank against par.

**Numbers** (first guesses in `JUMP` of `core/tune.js`; WP5 tunes them until the bot targets hold):

| Item | Start |
|---|---|
| Tube radius / steering rate | 10 u / 30 u/s across at full stick, in at 12 per s, out at 25 per s |
| Graze / hairline | within 1.6 u of a hazard's edge (2.3 u in the soft start) / 0.6 u |
| Rapidity | entry 2.0 (0.964c), floor 1.8 (0.947c), cap 4.0 (0.9993c), drifting back 0.03 per s above entry |
| Gains (each × 1.4 to start) | graze +0.06, hairline +0.12, thread +0.25, pad +0.15, skim +0.04 per s, boost +0.25 per s, drift-boost tiers +0.15 / +0.25 / +0.40 |
| Hit | −0.35 and the chain, 0.6 s flicker |
| Hazards | 1.2 per s after the soft start, rising to 2.5 per s; two rails, two gates and (J2, J3) one fork per run |
| Nines | TWO NINES at 0.99c (η 2.65); THREE NINES at 0.999c (η 3.80) with 0.4 s at 0.35 speed and the sky punched to φ 4 |
| Medals | bronze arrive; silver 0.99c with 2 hits or fewer; gold 0.999c; Tern 0.999c held 4 s with no hits |
| Bot targets on 20 seeds | still bot always arrives; mid bot 0.99c in 90% or more and 0.999c in 30% to 50%; expert 0.999c in 90% or more |

**Controls in the corridor:**

| Input | Phone, stick and pedals | Phone, one thumb | Desktop | Gamepad |
|---|---|---|---|---|
| Across | Stick X (rate) | Same | A / D, ← / → | Left stick X |
| Up and down | Stick Y (rate; invert climb applies) | Same | R / F | Left stick Y |
| Slide (drift) | BRAKE | Second finger | Space | B or LT |
| Boost | BOOST, or flick up | Flick up or BOOST | Shift | A or RB |
| Gas | Ignored | Ignored | Ignored | Ignored |

The camera stays in chase framing behind the ship and does not roll, so the horizon of the tube stays level and
reduced motion needs no special case. The first jump on touch shows one hint that the stick steers as in the places.

## Rendering techniques and their sources

AGENTS.md asks for the source of every rendering technique.

| Technique | Source adapted |
|---|---|
| Relativistic points, glows and the Headlight (aberration, Doppler colour, beaming) | On main in `render/points.js`: R. Penrose, "The apparent shape of a relativistically moving sphere" (1959); U. Kraus, "Brightness and color of rapidly moving objects", Am. J. Phys. 68 (2000); G. Spencer et al., "Physically-based glare effects for digital images", SIGGRAPH 1995 |
| Galaxy impostors, one 2 × 2 atlas, instanced | On main in `render/galaxy.js` (`bakeImpostor`); three.js `InstancedMesh` |
| Giants, D100's tail, the jet beam and the radio lobe as stacked soft cards | P. Decaudin and F. Neyret, "Volumetric Billboards" (2009), as `render/nebula.js` already does |
| Giants' near stars | `core/gen/galaxy.js` elliptical particles, on main |
| Speed dust | Elite's stardust (1984): https://elite.bbcelite.com/deep_dives/stardust_in_the_front_view.html |
| Chase camera spring | T. Lowe, "Critically Damped Ease-In/Ease-Out Smoothing", Game Programming Gems 4: https://www.gameenginegems.com/gemsdb/article.php?id=274 |
| Screen shake | S. Eiserloh, GDC 2016 (shake is trauma squared), via https://bevy.org/examples/camera/2d-screen-shake/ |
| Ring and gate outlines of constant screen width | I. Quilez, 2D distance functions, with `fwidth` antialiasing: https://iquilezles.org/articles/distfunctions2d/ |
| The jump corridor | Star Fox 64's Corridor Mode (Nintendo, 1997): the craft is forced down a path while the player moves it freely round the screen to dodge obstacles (https://en.wikipedia.org/wiki/Star_Fox_64, read 2026-10-14). The tube geometry, pass check and hazard kinds come from lab A on main, which took its tube from Tempest (1981). Redout's tube tracks, from the research, informed treating the jump as a track. |
| M87*'s orange ring | A flat annulus sprite after the Event Horizon Telescope image (2019). No lensing shader fits a phone budget, so none was adapted. |
| The zoom into a pocket | None fit: a 1.5 s dolly with a white ring flash and a cross-dissolve between scenes, like the video's zooms. |
| Wingtip ribbons and the radar | None fit better than the plain method: a ribbon of the last N wingtip positions; a heading-up 2D radar as in GTA. |
| Trail and engine colours | `physics.blackbodyRGB`, on main (v1's blackbody table) |

## Budgets

| Item | High | Mid (phones) | Low (software GPU, after a memory kill) |
|---|---|---|---|
| Pixel ratio cap / floor | 2.0 / 1.25 | 1.5 / 1.0 | 1.0 / 0.75 |
| Points a frame / far web | 120,000 / 40,000 | 50,000 / 16,000 | 25,000 / 8,000 |
| Near impostors / atlas tile | 400 / 512 | 300 / 256 | 150 / 256 |
| Stars per giant | 8,000 | 4,000 | 2,000 |
| Dust / trail samples | 360 / 72 | 240 / 48 | 140 / 24 |
| Draw calls target / cap | 60 / 80 | 45 / 60 | 30 / 40 |
| Triangles / GPU textures | 200,000 / 96 MB | 60,000 / 48 MB | 30,000 / 24 MB |

- One frame on a mid phone is 16.7 ms: main thread 8 ms (core 1.0, render prep 1.5, submit 2.5, overlay 1.0, HUD 0.5,
  audio 0.3), bake slices of 6 ms only in the jump, GPU 12 ms, overdraw at most 4 screens.
- Coma downtown at worst is about 25 draw calls; the corridor about 10. Chapter 1 needs about 2 MB of textures and
  0.8 MB of point buffers. Only one place is on the GPU at a time (plus a pocket's parent).
- Download before PLAY is live: 450 KB gzipped (three.js 189 KB); each place's modules about 40 KB gzipped.
- Stepping down: when the slowest 5% of frames pass 20 ms over 3 s, lower the pixel ratio by 0.25 to the floor, then
  points, then impostors. Never step up inside a place.
- The core: a mean step under 0.25 ms in node over 120 s of Coma downtown, and under 2 MB of heap growth in 10,000
  steps.

## How the requirements are checked

- **Node tests** in `qa/light-years-home/v3/`, run with
  `for f in qa/light-years-home/v3/*.test.mjs; do node $f || echo FAIL $f; done`: purity, tune, ship, toy, collide,
  traffic, zones, text, race, ghost, stunt, mission, talk, discovery, jump, save, layout, determinism, perf and
  chapter.
- **Browser checks** with the server running, in Chromium with SwiftShader, each at 1440×900 (keys, mouse and a mocked
  gamepad), 390×844 and 844×390 (touch): `drive`, `events`, `discovery`, `story`, `jump`, `chapter`, `recover` and
  `perf`, plus the existing `qa/arcade/quiet.mjs`. Run with
  `NODE_PATH=qa/browser/node_modules node qa/light-years-home/v3/<name>.e2e.mjs`.
- **Layout:** `layout.test` checks the pure rectangles for overlaps and safe areas at six sizes, both hands and both
  phone schemes; `drive.e2e` checks the DOM against them within 2 px and that the page never scrolls sideways.
- **Visuals:** a pixel check round `project(id)` for scan rings; screenshots of the opening drop-out, the punch,
  mid-corridor and each drop-out at all three sizes, reviewed by eye; the Bend Giant on screen for 80% of a portrait
  drift lap.
- **Performance:** `perf.e2e` reads draw calls, points, triangles, texture bytes and overdraw from the hook in Coma
  downtown and in the corridor at the mid tier, against the caps above. SwiftShader frame times are only for comparing
  runs.
- **Feel:** event timings from the core (near misses by 4 s, tiers at 0.88 / 1.68 / 2.48 s, restart control at 0.6 s
  and clock at 1.6 s), bots on seeds, and `timing()` for PLAY to control.
- **What these cannot prove:** whether the drive is fun, touch feel and 60 fps on a real mid-range phone, GPU time,
  audio output, haptics, iOS memory kills and tilt. Those need the crew test: the preview on their phones with no
  instructions, watching for the first grin, two minutes of driving with no goal, and "again?" after the jump. Each
  round's report says plainly which of these did not run.

## Two rounds and the cut line

- **Round 1:** M1 the toy (the crew drives it for 2 minutes with no goal), M2 the Wall, M3 J1 into Coma City as a
  drivable place with traffic, giants, scans and Look Home, and the cutover from v1. The crew should call the jump the
  best moment so far.
- **Round 2:** M4 Coma's actors, missions, events, Vela, secrets, set, log and photos; M5 J2, Virgo, the zoom, the jet,
  THE STRAIGHT RAY, the Chain, Ride the Jet, J3, the edge and the end card; M6 the arcade machine, README, AGENTS.md,
  the performance pass, a real-phone run or a plain note that none ran, and archiving this change.
- **Cut line** if Round 2 runs late, first to last: jump back from the log; ghost links; tilt steering; fact-card
  photos (use a drawn ring and label); FRAGILE; the Markarian's Chain race; Virgo's stunts.
- **Never cut:** the toy, the three jumps, PELICAN DOWN, THE STRAIGHT RAY with the zoom and the jet ride, Race the
  Jellyfish, Ring Road Rush, Ride the Jet, the log, saves and the chapter bot.

## Open questions

- **Showpieces sooner.** Story order puts the Orion Nebula run in Chapter III and Saturn's rings in Chapter IV. Should
  one come right after Chapter 1? (For the user.)
- **Desktop climb in the corridor.** The corridor keeps the places' keys (R and F climb). Gas and brake do nothing
  there, so W and S could also climb. Try both in the M3 crew test.
- **Coma in Round 1.** Coma has no missions until Round 2, so the "one orange objective" rule needs a stand-in there
  for the Round 1 preview (for example the nearest unscanned giant).
- **Forks** change only the score. If the risky gap chose the arrival point, the fork would be a real choice; that
  needs a second entry per place.
- **Speed-trap readout.** Traps score 40, 44 and 47 u/s, but the HUD's speed gauge has bars and no number. Decide what
  the trap toast shows.
- **Coma's entry** is 552 u from its nearest skim surface, so it meets the 15 s rule only at pad speed. Add a skimmable
  elliptical beside the dive line if the rule must hold at cruise.
- **Arithmetic, not bots.** The jump gains, the new medal times and the Coma and Virgo entry timings are arithmetic. The
  bots decide the final numbers, and this file records them.
