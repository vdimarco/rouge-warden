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
| 2 RISK's pick 2 | Replaced: after a RISK lane you pick 1 of 4, every card Rare or better (chip tag PICK 1 OF 4 · RARE+). WP5's offer sim with the real `makeOffer` confirmed risk 7: with pick 2 a RISK-every-leg player made 13 picks, owned 40 to 46 % of the starters and got a legendary in 88 to 95 % of planned runs; with 1 of 4 Rare+ it is 7 picks, 22 % owned and a legendary in 45 to 65 % |
| 3 Fuel at full tanks | A fuel pickup at full tanks takes 2 s off the shield's recharge |
| 4 Fixed bosses per leg | Build 2 |
| 5 Thin rival stakes | Place sets the offer's rarity row: 1st one row up, 2nd and 3rd as the leg says, 4th or lower one row down (it stacks with RISK and GHOST; first place still adds the 4th card) |
| 6 The −2 s suspend penalty | A mid-leg snapshot saved on `pagehide` resumes with no penalty; −2 s stays for a deliberate quit |
| 7 Push-back lost at the cap | The overflow speeds the shield's recharge: each second lost at the cap is a second off the recharge (`CAP_OVERFLOW_SHIELD` 1) |
| 8 MAKO's ties | Ties go to the nearest ship, not to you |
| 9 Scope | Kept: conditions second in the cut order, 22 starters and 3-piece pools never cut |
| 10 Unverified values | The bots tune them |

## The light

- **One gap per ship.** Each ship's gap (seconds between it and its light) falls by `BLEED` × (1 − tanh η) every second,
  with c as 1 s of light per second of play. A docked or stopped ship loses a second a second. The light never speeds
  up, and it targets nobody.
- **Time to catch** TTC = gap ÷ (1 − β) is the only number the player sees. It counts down one second per second at a
  steady speed, jumps up when you speed up and drops when you slow.
- **Push-backs** (all × the leg's mass factor M: 1.00, 0.78, 0.74, 0.71, 0.69, 0.66, 0.63, 0.59): graze 0.12 s,
  hairline 0.30, rival graze 0.12, rail skim 0.20 a second, whip 0.4 × mass × (0.5 + d) (half on WIDE), mid-leg pair
  0.5, takedown 0.3, gate thread 2.0, dock 1.5, fly past 0.5. They stop at the leg's cap (8, 3.5, 3, 3, 3, 3, 2.8,
  2.8 s), except a red-zone release (up to +1.5 s, fading at 0.1 s a second) and STILL LIGHT, which raises the cap by up
  to 2 s. The physics is the Shapiro delay; its size is the game's.
- **The cap holds from each launch.** At a gate every ship's gap is cut to the next leg's cap: the light held back by
  one leg's masses comes round them. Without it leg 1's 8 s carried over, and a mid player flew legs 2 and 3 with the
  light 300 to 1,200 s away.
- **The start.** Your run starts with a 7 s gap (TTC 29 s at 0.76c): the burst went off as you left. Rivals start
  with 8 s.
- **Hits.** A hit drops your gap 1.0 s and costs 0.7 η, so the light also gains faster; a named rival's hit costs it
  0.4 s and 0.4 η (each ship is its own ship; drifters take yours). A hit outside the glare never takes TTC under 2.9 s
  (`STUMBLE_FLOOR_TTC`): it puts you in the glare, never past it. Only a hit in the glare, a wreck, or a gap that bleeds
  through the glare to 0 catches you. With caps near 3 s, two quick hits put a mid player in the glare.
- **States.** Far (TTC 10 s or more), pressed (under 10 s, labelled), warned (under 6 s once, re-armed above 9 s, a
  heartbeat from 60 to 140 bpm), in the glare (under 3.0 s, left above 4.5 s), caught. Warnings key on TTC, never on the
  gap, so a frozen gap never blinks. Leaving the glare, or 4 s inside it, starts a breather (11.7).
- **The burst ring.** R_b = R_p × (1 + K_B × u), u = clamp(ln(1 + TTC ÷ 2) ÷ ln(1 + 300 ÷ 2), 0, 1), K_B 1.4 on phones
  and 0.85 on desktop. On a phone: TTC 1 s gives 1.11 ×, 6 s 1.39 ×, 60 s 1.96 ×, 300 s or more 2.40 ×. Its colour is
  light from behind as you see it, 30,000 K × e^−(η − 1) through `blackbodyRGB`: blue-white when slow, dull red when
  fast, white in the glare.
- **Why it still bites at speed**: at a cap of 3 s, TTC is 30 s at 0.9c, 83 s at η 2.0 and 300 s at HEADLIGHT. For a
  mid or expert who threads, the light is a threat after a hit cluster, a dock launch or a slow leg start, not a
  constant one: two quick hits at η 2 put them in the glare. So the ring keeps moving at speed (`TTC_FULL` 300 s), its
  label shows at every launch, and a far light reads in minutes (LIGHT · 3 MIN). Experts meet it more through
  REDSHIFT 3, LATE LAUNCH.

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
`setMeta(obj)`, `daily(date)`, and from the build: `toy(seed)`, `medal(type, years)`, `screen()`, `action(act, data)`,
`pause()`, `resume()`, `realtime(on)` (off, only `advance` moves the race, so a browser check's timeline repeats) and
`drawn()` (what the ring layer drew last frame: the burst ring, wings, rivals, labels, marks, bands, gate lines and the
caption's keep-out boxes). `advance` skips a vista and the end hold, so a whole run can be driven through it. URL
options: `seed`, `daily`, `leg`, `lane`, `ship`, `piece` with `loop`, `toy`, `bot`,
`debug`, `perf`, `cam`, `button`, `scheme`, `burn`, `tier`, `barks` and every `TUNE` key; all but `seed` and `daily`
make a run unranked.

## Built differently from the spec

The team's `contract.md` logs every change with its reason; these are the ones a player or a check can see.

- **The caption keeps clear.** When the caption's words would sit on the next gate's THREAD or DOCK lines, an exit band
  or LET GO, the line moves down (toward the centre, where the ring is wider) or up by 26 to 104 px, or its words shrink
  to 0.8 or 0.66, by the least that clears it, and comes back once nothing is in the way. In portrait the ring at its
  floor crosses the caption line, so THREAD OR DOCK met the THREAD label without it. The gate's labels stay 6 px inside
  the screen.
- **Earth's DOOR** is a cue at L − 4 (60°, labelled EARTH), not a gate item, so it is no hazard and pays no THREAD.
- **RISK** is pick 1 of 4, every card Rare or better (above).
- **Rivals drive by their own cost search** (72 bearings, then ±5° in 1°, rails judged where they will be), not through
  the bots' `human()`, which read a rail at the ship's distance and wrecked most rivals. Same knobs, the same handling
  rules and no hidden speed. A rival never turns toward a ship in contact range faster than 95° a second except its
  flick, so every SLAM comes after a lean.
- **Gears hold 0.04 η** under each nine before they drop, so drag at a nine does not flap the key every second.
- **A hidden page** pauses the race; its sound is left to `/arcade/quiet.js`, which suspends it while hidden and resumes
  it when shown, so the pause card keeps a low-passed drone. A pause on a visible page still suspends the sound.
- **The result card's log line** names the pages left: LOG +5 PAGES · 1 PAGE TO REROLL +1.
- **The cabinet line**: FIRST HOME · 14.2 YR once you have come home first (the record keeps the best years, not the
  place), else HOME IN 14.2 YR, else BEST: and the furthest leg's name; the plain line is SKIM · BURN · WHIP. Leg 7
  reads THE SUN'S STARS on the machine: the line is Press Start 2P at 12 px, a word cannot wrap, and NEIGHBOURS (130 px
  with the padding) is wider than the 97 px screen at 320 × 700 and 375 × 667. A smaller font would break the arcade's
  12 px floor. With `gold-frame` in the save's unlocks the machine gets the class `gold`: a 3 px gold ring and a soft
  glow as a box-shadow on the bezel, so no size changes.
- **The marquee**: the title is Bungee at max(12 px, 3 % of the machine's height), so it takes one line on a computer
  and at 390 × 844. At the 12 px floor (360 × 740, 375 × 667, 320 × 700) it wraps to two lines 10.8 px apart, the gap
  over the sub line goes to 0, and the sub line holds 8 characters of Press Start 2P (96 of the 102 px inside the box).
  So the sub lines are RUN HOME (was RACE HOME BEFORE THE BURST) and DRIVE ON on Light Years Home (was DRIVE HOME, 10
  characters). That needs a box 100 px wide inside, a machine 259 px tall. On a shorter machine (360 × 640 or
  800 × 600, about 230 px) two title lines and a sub line are 34 px in a 30 px box, so the sub line is hidden and the
  title shows whole; before, the box cut RUN HOME to RUN. The rule is a CSS container query (MDN, "CSS container
  queries") on the marquee's width, which is a fixed share of the machine's height. The marquee is an `inline-size`
  container, not a `size` one, because `--h` holds `100cqh`, and inside a `size` container that would measure the
  marquee instead of the stage. On a landscape phone (844 × 390, a machine 137 px tall) the 12 px floor leaves no room
  for the title, and these marquees are cut like every other. The older machines' marquees and attract text overflow at
  320 × 700 the same way these did; they are left as they are.
- **The row order**: AGENTS.md's New games rule puts a new cabinet after the others in its group. This machine came
  first and the Light Years Home cabinet after it, so Light Years Home is last in the Action row and last in the
  Action group's `games`. No spot in the row was asked for. The switcher keeps Light Years Home's entry where its own
  change put it, after River Rush.
- **The key art** is cut from a 2 × portrait screenshot of leg 1 at 0.9931c with PIKE 0.1 s in your wake, staged with
  `?gap0=0.3&gapcap=0.3&bleed=0` so the light's ring sits at 1.6 × the play ring (LIGHT · 44 S); at a real HEADLIGHT
  gap the ring sits off the bottom edge.
- **Tuning.** WP9 tuned the bots and the light's first levers: `HIT_ETA` 0.5 → 0.7, the masses of legs 2 to 8
  (0.94 to 0.65 → 0.70 to 0.51) and RISK as pick 1 of 4; its stages are in the team's `race/tuning.md`. The playtest
  pass (`race/playtest.md`) then found the light absent for anyone past a novice and retuned with the bots:

  | Mid bot, 64 seeds | WP9 | Playtest pass |
  |---|---|---|
  | Home | 38 % | 33 % |
  | How failed runs end | 27 wrecked, 13 caught | 18 wrecked, 23 caught, 2 on the doorstep |
  | Legs with TTC under 10 s | 22 % | 34 % |
  | Runs that meet the glare | 34 % | 64 % |
  | Median TTC in legs 2 and 3 (16 and 32 seeds) | 592 and 1,205 s | 222 and 299 s |
  | Time with the gap at its cap, legs 2 to 7 | 44 to 94 % | 40 to 59 % |
  | Landing caught on the doorstep | 0 % | 7 % of landings |
  | Regulars the light takes a run | 2.5 | 2.1 |
  | Expert home | 77 % | 77 % |

  The changes: each leg's cap holds from its launch; caps 8, 3.5, 3, 3, 3, 3, 2.8, 2.8 s (were 8, 5, 4, 3.4, 3.4,
  3.4, 3, 3); your start 7 s (rivals 8 s); the shield back 5 s after a hit (LANTERN; NEEDLE 4, TUG 7, GHOST 4); dock
  prices 0.6, 0.4 and 0.8 s with a 4 s floor; a named rival's hit costs it 0.4 η and 0.4 s; a boss launches at least
  4.5 s ahead of its light; the WHALE starts 2.5 s ahead; MANTA has 3 hull. Known gaps stay as todos in `sim.test.mjs`
  with floors (raised where the pass improved them: the mid's TTC under 10 s to 25 %, rivals eaten to 2.6, REDSHIFT
  3's light to 15 %).
  The review fixes judge each item once, so a stumble back over it no longer pays a second THREAD or graze. That took
  the mid home rate from 33 to 23 %, so the masses of legs 2 to 8 rose 0.08 (now 0.78 to 0.59; mid home 38 %). Two
  floors moved with it: 12 of 22 base cards pass the 20 % rule (was 14), and a hull-2 dock may age up to 0.15 years a
  leg less than a hull-1 dock (2.52 against 2.61), inside the noise of 40 runs.

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
  touch, 844 × 390 touch and 1440 × 900: `smoke.e2e`, `input.e2e` (real CDP touch for drags, re-grips and two
  fingers; flicks and latch drags dispatched in the page with set gaps, since CDP touch moves arrive 80 to 100 ms apart
  under SwiftShader), `layout.e2e` (the 30 moments of the spec, with the light's four states, every leg's signature,
  every gate, MANTA lit and shadowed and the full wings shot apart: about 48 shots per size into a contact sheet, reviewed by eye,
  and frame-by-frame rules over four mid-bot legs), `perf.e2e` (4 × CPU throttle; SwiftShader numbers count only
  against each other) and `feedback.e2e`, plus `qa/arcade/machines.mjs` and `qa/arcade/quiet.mjs`. The shared
  helpers live in `qa/ahead-of-the-light/e2e-lib.mjs`.
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
