# Ahead of the Light design

## Source and scope

The contract is the lead's build spec of 2026-10-14 (`race/final.md` in the team's scratchpad), which merges five
specialist designs (core, survival, rivals, progression, tech) and a research report, with an adversarial critic's
changes applied in place. The critic's changes win where they differ. Every number marked (start) in the spec is a
first guess: the bots tune it, and this file, the specs and `core/tune.js` follow the code. Module APIs, state shapes,
event names, tuning keys and the test hook are the build spec's sections 18.2 to 18.5, 19 and 20; changes to them are
logged in the team's `contract.md` and folded in here.

## The user's art direction and input preferences

Keep these through every change to this game.

- **What it is.** A survival racer grown from the two v2 labs, which the user called "too simple". All four pieces they
  chose stay in: outrun a threat, hull and fuel, upgrades between legs, rival racers. It is a separate game; the v3
  adventure continues.
- **The look is the video's.** Black space, white points, thin white rings with leader lines and small labels, bold
  uppercase captions with the current word in orange (`#f08a2c`). Light-speed effects are real: aberration, Doppler
  colour, the light's (1 − β) and time dilation. The physicist who narrates the video is never named or shown, and
  every line is our own words (a node test checks for 6-word runs from the narration).
- **Fun in 3 seconds on a phone.** Portrait 390 × 844 and landscape 844 × 390 with touch, and desktop 1440 × 900 with
  keys, mouse or a gamepad. One thumb plays portrait: drag to steer, flick up to burn, press to grab.
- **Desktop.** Space grabs and holds only; ↑, W or Shift burns, mirroring touch, so no stray Space burns a cell. A mouse
  moving with no button down never steers.

## Decisions (the build spec's section 2)

| # | Topic | Decision |
|---|---|---|
| 1 | Meters | Two: HULL (3 pips plus 1 SHIELD charge that recharges) and FUEL (up to 4 cells) |
| 2 | Burn gesture | Flick up, copied from v3's `createFlick`; `?burn=tap` keeps the tap for the toy's A/B |
| 3 | Speed ladder | The nines: 0.9c, 0.99c (HEADLIGHT), 0.999c, 0.9999c (LIGHT SPEED). A burn adds 0.4 η but never past 2.6 in open space. Rivals stop at 0.999c |
| 4 | Leg start speed | By gate choice: THREAD η 1.6, fly past 1.0, DOCK 0.8 |
| 5 | A hit | −0.5 η, the shield or 1 hull, and a 1.0 s stumble back toward the light |
| 6 | The light's model | Each ship has its own gap. A rival ahead that the light takes gets a white beam from the burst ring |
| 7 | Push-back sizes | Lab A's: graze +0.12 s, hairline +0.30 s, times the leg's mass factor |
| 8 | Whip depth | Core's whip with survival's tides as a RED ZONE: the last 75° before the core costs the shield or 1 hull once and pays × 1.3 |
| 9 | Rams | A SLAM spills 1 fuel cell to the rammer; only a takedown is a hit |
| 10 | First well | Leg 1 on a player's first runs (`first-well`, about 15 s in, after the burn lesson at about 10 s) |
| 11 | Landmarks | THREAD, DOCK or fly past at every gate |
| 12 | Route length | All 8 legs, with 2 lanes on most |
| 13 | Bosses | All three, each cut to its one rule; a beaten boss refills hull and fuel and the next offer shows 4 cards |
| 14 | Currency | One purse: seconds of lead |
| 15 | Rivals taking cards | Never |
| 16 | Rival lanes | Rivals fly your lane; the VOID has none |
| 17 | HUD numbers | Speed and place only; years at arrivals, on pause and on the result; TTC on the light's ring under 10 s |
| 18 | Meters on screen | Wings on the ring: hull left of the ship, fuel right, the shield as a bubble |
| 19 | Card count | 32 cards plus 4 trophies: 22 starters, 6 fusions, 4 legendaries |
| 20 | Lane kinds | FAMILY, RISK and one VOID (leg 4); TUNE stays at docks |
| 21 | Points | None. Years if home, else distance, plus place |
| 22 | Desktop action | Space grabs and holds; ↑, W or Shift burns |
| 23 | Shield's name | SHIELD |

**Left for the lead, settled by the build rule** (take the first option the critic names unless the spec settles it):

| Item | Taken |
|---|---|
| 1 WELL has 4 cards | The spec settles it: HANDOFF waits for build 2 (12.1). WELL stays at 4 |
| 2 RISK's pick 2 | Stays. If the bots show about 13 picks and a legendary in nearly every RISK run, switch to "pick 1 of 4, Rare or better" |
| 3 Fuel at full tanks | A fuel pickup at full tanks takes 2 s off the shield's recharge |
| 4 Fixed bosses per leg | Build 2 |
| 5 Thin rival stakes | Place sets the offer's rarity row; WP5 sets the mapping and logs it in `contract.md` |
| 6 The −2 s suspend penalty | A mid-leg snapshot saved on `pagehide` resumes with no penalty; −2 s stays for a deliberate quit |
| 7 Push-back lost at the cap | The overflow speeds the shield's recharge; WP3 sets the rate and logs it |
| 8 MAKO's ties | Ties go to the nearest ship, not to you |
| 9 Scope | Kept: conditions second in the cut order, 22 starters and 3-piece pools never cut |
| 10 Unverified values | The bots tune them |

## The light

- **One gap per ship.** Each ship's gap (seconds between it and its light) falls by `BLEED` × (1 − tanh η) every second,
  with c as 1 s of light per second of play. A docked or stopped ship loses a second a second. The light never speeds
  up, and it targets nobody.
- **Time to catch** TTC = gap ÷ (1 − β) is the only number the player sees. It counts down one second per second at a
  steady speed, jumps up when you speed up and drops when you slow.
- **Push-backs** (all × the leg's mass factor M: 1.00, 0.94, 0.88, 0.83, 0.78, 0.73, 0.69, 0.65): graze 0.12 s,
  hairline 0.30, rival graze 0.12, rail skim 0.20 a second, whip 0.4 × mass × (0.5 + d) (half on WIDE), mid-leg pair
  0.5, takedown 0.3, gate thread 2.0, dock 1.5, fly past 0.5. They stop at the leg's cap (8, 7, 6, 5, 5, 5, 4.5, 4.5 s),
  except a red-zone release (up to +1.5 s, fading at 0.1 s a second) and STILL LIGHT, which raises the cap by up to 2 s.
  The physics is the Shapiro delay; its size is the game's.
- **Hits.** A hit drops the gap 1.0 s and costs 0.5 η, so the light also gains faster. A hit outside the glare never
  takes TTC under 2.9 s (`STUMBLE_FLOOR_TTC`): it puts you in the glare, never past it. Only a hit in the glare, a wreck,
  or a gap that bleeds through the glare to 0 catches you.
- **States.** Far (TTC 10 s or more), pressed (under 10 s, labelled), warned (under 6 s once, re-armed above 9 s, a
  heartbeat from 60 to 140 bpm), in the glare (under 3.0 s, left above 4.5 s), caught. Warnings key on TTC, never on the
  gap, so a frozen gap never blinks. Leaving the glare, or 4 s inside it, starts a breather (11.7).
- **The burst ring.** R_b = R_p × (1 + K_B × u), u = clamp(ln(1 + TTC ÷ 2) ÷ ln(1 + 300 ÷ 2), 0, 1), K_B 1.4 on phones
  and 0.85 on desktop. On a phone: TTC 1 s gives 1.11 ×, 6 s 1.39 ×, 60 s 1.96 ×, 300 s or more 2.40 ×. Its colour is
  light from behind as you see it, 30,000 K × e^−(η − 1) through `blackbodyRGB`: blue-white when slow, dull red when
  fast, white in the glare.
- **Why it still bites at speed** (critic calc): at a cap of 5 s, TTC is 50 s at 0.9c, 139 s at η 2.0 and 503 s at
  HEADLIGHT. For a mid or expert who threads, the light is a threat after a dock launch or a hit cluster, not a constant
  one. So the ring keeps moving at speed (`TTC_FULL` 300 s), and mid pressure comes from hit costs first: `HIT_ETA` 0.7,
  then caps −1 s, then docks at η 0.6, then a 1.5 s stumble, in that order. Experts meet the light through REDSHIFT 3,
  LATE LAUNCH.

## One step

`main.js` keeps real time and steps the core at 120 Hz, scaled by slow motion and hit-stop. `stepRace(race, intents,
dt)` runs, in order:

1. Steering for every ship from its intent.
2. Course advance: each ship's `dist` grows by its course speed × dt ÷ 0.86 R (tow, surges and stumble included).
3. The course window: items join within 12 beats of the leading ship and leave 4 beats behind the last.
4. Per ship, the items whose beat it crossed (knots, walls, gates, pulses, pickups); then lasting kinds (rails, fog);
   then wells (windows, grab, sweep, red zone, release, scorch).
5. Ship against ship: wakes, draft and tow, contact, slams, takedowns, traps.
6. Card hooks on this step's events.
7. Survival for every ship: gap and TTC, push-backs from this step's events, shield and hull, fuel, states, catches.
8. Rival AI on its 50 ms tick, reading the snapshot ring at `reactMs` ago; the bosses' rules.
9. The director.
10. The leg: the gate line and place, the run-out, the landing, the end.

The core never reads clocks, storage or `Math.random`; all randomness comes from named streams. The sim uses `tanh`
and `cosh`, which can differ in the last bit between engines, so replays are checked node against node.

## Events

Every event is `{ t, type, ship, ... }`. The renderer, sound, captions, survival, card hooks, bots and the run log read
the same list, and `feedback()` counts what each type actually started.

| Group | Events |
|---|---|
| Handling | `graze`, `hair`, `skimOn`, `skimOff`, `rivalGraze`, `chainEnd`, `bump`, `pickFuel`, `pickPatch`, `burn`, `oberth`, `dry`, `window`, `hook`, `grab`, `latchCancel`, `letgo`, `redIn`, `release { grade, angle, gain, red }`, `scorchWarn`, `scorch`, `wake`, `draftFull`, `slingshot`, `drafted`, `shaken`, `contact { kind }`, `spill`, `takedown { by, victim }`, `trapped`, `hit { cause, piece }`, `gearUp { gear, best }`, `gearDown`, `headlight`, `lightspeed`, `dropout` |
| Survival | `push { amount, from }`, `pressed`, `warn`, `glareIn`, `glareOut`, `breather`, `shieldPop`, `shieldBack`, `hullLost`, `lastHull`, `wreck`, `caught { fedBy }`, `eaten { id, fedBy }`, `thread { miss }`, `dock`, `past`, `door`, `land { ok, margin }` |
| Rivals | `nemesis`, `settled`, `block`, `lean { target, side }`, `dirtyAir`, `bark { speaker, text }`, `breach`, `bowWave`, `fin { target }`, `roll`, `backOff`, `shadow`, `sailTorn`, `lane` |
| Leg | `gateLine { place }`, `runout`, `vista`, `legEnd` |

`gearUp { best: true }` marks a new best gear this **run** (spec 6.2 after the critic), which is what earns the big
digits and the chord.

## Legs, captions and the hook

**Beats per section** (the crescendo absorbs what the signature leaves; a RISK lane adds 16 beats to the crescendo):

| Leg | Launch | Opener | Build | Signature | Breather | Open road | Crescendo | Gate | Total |
|---|---|---|---|---|---|---|---|---|---|
| 1 THE WEB | 6 | 16 | 16 | 16 | 6 | | 22 | 14 | 96 |
| 2 COMA | 6 | 14 | 16 | 16 | 6 | 14 | 34 | 14 | 120 |
| 3 VIRGO | 6 | 14 | 16 | 24 | 4 | 20 (WHALE) | 30 | 14 | 128 |
| 4 THE LOCAL GROUP | 6 | 14 | 16 | 24 | 4 | 16 | 42 | 14 | 136 |
| 5 THE MILKY WAY | 6 | 14 | 16 | 20 | 4 | 14 | 56 | 14 | 144 |
| 6 ORION | 6 | 14 | 16 | 28 | 4 | 14 | 56 (MAKO's field) | 14 | 152 |
| 7 THE SUN'S NEIGHBOURS | 6 | 16 | 16 | 20 | 4 | 14 | 60 | 24 | 160 |
| 8 EARTH | 6 | 14 (Kuiper belt) | 16 (Saturn) | 18 | 6 | 14 (inner) | 30 (asteroids) | 24 (Moon, landing) | 128 |

**Caption priority,** highest first: CAUGHT, WRECKED, HOME; LIGHT SPEED, HEADLIGHT; the landmark and THREAD OR DOCK;
IN THE GLARE; THE LIGHT TOOK… and FED TO THE LIGHT; SCORCHED, TAKEDOWN, a fusion's first trigger; NEMESIS; SHIELD
DOWN, LAST HULL; tutorial lines; barks. A lower caption never replaces a higher one in its first 0.6 s, and HAIRLINE
never takes the slot.

**The test hook** `window.__race` (id `ahead-of-the-light`, version 1, `tune`): `state()`, `run()`, `survival()`,
`rivals()`, `events(n)`, `timing()`, `perf()`, `feedback()`, `restart(seed)`, `advance(seconds, input)`,
`input(intent)`, `bot(name, opts)`, `rivalBot(id, overrides)`, `field(spec)`, `pick(i)`, `skip()`, `reroll()`,
`banish(i)`, `lane(i)`, `buy(chip)`, `refund(chip)`, `leg()`, `course({ from, to })`, `gen(...)`, `validate(...)`,
`chart()`, `goto({ leg, lane, seed, beat, build, ship })`, `save()`, `load(json)`, `clearSave()`, `meta()`,
`setMeta(obj)`, `daily(date)`. URL options: `seed`, `daily`, `leg`, `lane`, `ship`, `piece` with `loop`, `toy`, `bot`,
`debug`, `perf`, `cam`, `button`, `scheme`, `burn`, `tier`, `barks` and every `TUNE` key; all but `seed` and `daily`
make a run unranked.

## Cuts

**Cut from the first build:** station and signal lanes, the trader and all 12 signals; rival lane choice; rivals
taking cards; boss relics; salvage; card packs I to III and the 4 Epic glass cannons; the KITE and ANCHOR ships; daily
mutators (lane conditions stay); REDSHIFT 7 to 10; STEAL and BOUNCE on wells; hot-gas fog and the `orbit` kind;
separate `tail`, `block` and `sweep` kinds (builders on `rail` instead); points and spectral ranks; the short route.

**Cut order if the PR runs long,** from the top: (1) the second lane on legs 5 to 7; (2) conditions, down to DUST and
RICH; (3) MAKO; (4) PRACTICE; (5) the daily route; (6) ships beyond LANTERN; (7) trophies; (8) the WHALE.

**Never cut:** the light, hull, shield and fuel, the whip, drafting and contact, 1 of 3 with fusions and legendaries,
the 22 starters, the 3-piece section pools, all 8 legs, the landing, MANTA, the bots and the node tests, and the three
layouts.

## Rendering techniques and their sources

AGENTS.md asks for the source of every rendering technique.

| Technique | Source adapted |
|---|---|
| Aberrated, Doppler-shifted points; the play ring as f ÷ sinh φ, the circle of "beside you" under aberration | R. Penrose, "The apparent shape of a relativistically moving sphere" (1959), already in `light-years-home/render/points.js` with U. Kraus, "Brightness and color of rapidly moving objects" (2000); lab A's ring on main |
| Lanes read by angle round a ring | Tempest (Atari, 1981), Gyruss (Konami, 1983), Super Hexagon (T. Cavanagh, 2012; https://en.wikipedia.org/wiki/Super_Hexagon) |
| Hand-made pieces chained on a guaranteed path, then validated | Spelunky's room templates (Game Maker's Toolkit, "How (and Why) Spelunky Makes its Own Levels": https://amara.org/videos/p6MHlmreohsY/en-gb/3101319); S. Benard, Dead Cells' hybrid level design (https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/); Race the Sun's patterns strung together (Flippfly, https://flippfly.com/experiments-part-2/) |
| Lane conditions shown on the map before a leg | FTL's sector and beacon environments; Spelunky's level feelings |
| M87's jet as a beamed line of points with no counter-jet | Relativistic beaming; J. Biretta, W. Sparks and F. Macchetto, ApJ 520, 621 (1999) for the knots and their apparent 6c (https://www.stsci.edu/science/preprints/prep1335/prep1335.html) |
| Dust lanes as darkening | Hildebrand, Magnor and Fröhlich, WSCG 2006, as `light-years-home/render/galaxy.js` already cites |
| Galaxy discs, star fields and the web | `light-years-home/core/gen/galaxy.js`, `stars.js` and `web.js`, on main |
| Saturn's rings with their real radial gaps | The PDS Rings Node tables (https://pds-rings.seti.org/saturn/saturn_tables.html) |
| The vista's chase camera | Lab B's north-up chase camera (after Sling Drift, Tiny Wings and top-down orbit games) |
| The glare and the caught flood as CSS layers whose opacity alone animates | Playtest A P2-10: lab A's canvas gradient doubled the frame time. No outside source fit better |
| The light's colour from behind | `light-years-home/core/physics.js` `blackbodyRGB`, on main |
| The ring, ticks, chevrons, wings and labels on a 2D overlay | Lab A's overlay on main; no outside source fit better than plain canvas paths (at most 400 a frame, no `shadowBlur`) |

## How the requirements are checked

- **Node tests** in `qa/ahead-of-the-light/`, each runnable alone with `node` and exiting 1 on failure: `handle`,
  `survival`, `rivals`, `course`, `run`, `cards-drive`, `save`, `meta`, `copies`, `sim` (200 runs per bot model, a few
  minutes) and `toy`. `node qa/ahead-of-the-light/bot.mjs mid 200` prints home rate, catches by leg, causes, years,
  top gear, glare share, rivals eaten and hits by piece id.
- **Browser checks** with the server on 8765, Playwright from `qa/browser/node_modules` and SwiftShader, at 390 × 844
  touch, 844 × 390 touch and 1440 × 900: `smoke.e2e`, `input.e2e` (real CDP touch), `layout.e2e` (30 moments per size
  into a contact sheet, reviewed by eye), `perf.e2e` (4 × CPU throttle; SwiftShader numbers count only against each
  other) and `feedback.e2e`, plus `qa/arcade/machines.mjs` and `qa/arcade/quiet.mjs`.
- **The user's playtest** on real phones covers what the sandbox cannot: touch latency of the flick and the press,
  phone audio and the iPhone silent switch, haptics, real frame rates, whether the whip's spinning world bothers
  anyone, and whether the first 30 seconds are exciting. The build report says plainly which of these did not run.

## Risks

- **Size.** About 15,000 lines and 52 pieces. The work packages run in parallel, and content is the elastic part.
- **The flick on one thumb** is untested on real phones; `?burn=tap` and `?button=1` are the fallbacks.
- **Grab or re-grip.** A re-grip inside an open window grabs. If more than 1 grab in 10 is accidental, lengthen the latch
  cancel to 0.2 s at 12 px, then make `?button=1` the default in portrait.
- **Mid players may not feel the light** (see "Why it still bites at speed"). The bots decide.
- **Per-ship light** can take a rival ahead of you. The beam makes it readable; if testers find it odd, floor a rival's
  gap at yours while it is ahead.
- **Physics honesty.** Aberration, Doppler, the light's (1 − β), time dilation and the rocket equation are real. The
  whip's geometry, the Shapiro push-back's size, STILL LIGHT, CHERENKOV in vacuum and 0.25 years a second are the game's,
  and the log says which is which.
