## ADDED Requirements

### Requirement: The route home
A run SHALL follow the video's route in 8 legs, each named for the region you cross and ending at a landmark gate: THE WEB to COMA (NGC 4874 · NGC 4889), COMA to VIRGO (M84 · M86), VIRGO to THE LOCAL GROUP (Andromeda · Triangulum), THE LOCAL GROUP to THE MILKY WAY (the LMC · the SMC), THE MILKY WAY to THE ORION ARM, ORION to THE SUN'S NEIGHBOURS, THE SUN'S NEIGHBOURS to THE SUN, and EARTH (Saturn, then home). The legs SHALL run 96, 120, 128, 136, 144, 152, 160 and 128 beats.

#### Scenario: Leg times
- **WHEN** the `mid` bot plays seeds 1 to 200
- **THEN** its leg times are within ±15 % of 45, 56, 60, 64, 67, 71, 75 and 60 s
- **CHECK** `qa/ahead-of-the-light/sim.test.mjs`

#### Scenario: Real names and distances
- **WHEN** the route's stop names, distances and fact lines are compared with `light-years-home`'s originals
- **THEN** every distance is within 0.5 % and every card id they cite exists
- **CHECK** `copies.test.mjs`

#### Scenario: The music climbs home
- **WHEN** a player flies the run
- **THEN** legs 1 and 2 play in D minor, 3 and 4 in F major, 5 and 6 in A major and 7 and 8 in D major, each gear lifts the key a whole tone, and HOME at Earth plays the ending tune
- **CHECK** `feedback.e2e.mjs`

### Requirement: One grammar for every leg
Every leg SHALL run LAUNCH, OPENER, BUILD, SIGNATURE, BREATHER, OPEN ROAD (from leg 2), CRESCENDO and GATE, with the beats per section listed in `design.md`; Earth SHALL run its sections in the order of the planets. LAUNCH SHALL hold nothing to hit, with the first item at beat 6 (beat 4 on a run's first leg). The BREATHER SHALL hold at most 3 outlying knots while the next landmark draws on at the centre. The GATE SHALL be fixed except for its side and angle.

#### Scenario: Something to steer at once
- **WHEN** a run's first leg launches
- **THEN** the first knot passes the ship by about 2.4 s
- **CHECK** `course.test.mjs`

#### Scenario: Room to race
- **WHEN** any leg from leg 2 is built (the belt and the VOID excepted)
- **THEN** it holds an open road of at least 12 beats with at most two rails, and at least 4 beats of breather follow its signature
- **CHECK** `course.test.mjs`

### Requirement: The first minute on a phone
On a player's first runs, leg 1 SHALL teach one thing at a time: steer and skim from about 2 s (a graze band of 12° until beat 19, SKIM FOR SPEED), the light from 2.5 s (A GAMMA-RAY BURST IS BEHIND YOU), the burn at about 10 s (a fuel cell a hairline from a knot, then THE LIGHT IS GAINING · FLICK UP TO BURN), the first whip at about 15 s until a GOOD whip in any run, a drifter eaten at about 25 s, and THREAD OR DOCK at Coma by about 45 s.

#### Scenario: The first 30 seconds in portrait
- **WHEN** a first-time player taps TAP TO FLY at 390 × 844 and drags toward galaxies
- **THEN** the ring draws within 0.3 s with galaxies already streaming, the first zzip comes by about 2.5 s, the light's ring rises by 2.5 s, the burn lesson shows at about 10 s, PRESS AS IT PASSES at about 15 s, and THE LIGHT TOOK A DRIFTER at about 25 s
- **CHECK** `smoke.e2e.mjs` and `toy.test.mjs`

#### Scenario: Desktop words
- **WHEN** a first-time player plays leg 1 at 1440 × 900 with keys
- **THEN** the burn lesson reads THE LIGHT IS GAINING · ↑ TO BURN
- **CHECK** `smoke.e2e.mjs`

#### Scenario: Lessons step aside
- **WHEN** a player has landed a GOOD whip in any run, and later starts a 4th run
- **THEN** `first-well` no longer appears in leg 1's build, and `easy-knots` replaces `web-first-knots` as the opener
- **CHECK** `course.test.mjs`

#### Scenario: Exciting on a real phone
- **WHEN** the user plays the first 30 seconds on their own phone, in portrait and in landscape
- **THEN** they say it is exciting, not "too simple"
- **CHECK** the user's playtest

### Requirement: Lanes on the chart
The chart SHALL offer the next leg's lanes: one on leg 1; a FAMILY and a RISK lane on legs 2, 3, 5, 6 and 7; FAMILY, RISK and THE LOCAL VOID on leg 4; JUPITER (the long way) and THE ASTEROID BELT (the short way, × 0.75) on leg 8. Each lane SHALL carry its named signature. FAMILY lanes SHALL cover all four families across legs 2 to 7, never the same family on two legs in a row, and edit only the build. A RISK lane SHALL add 16 beats and density × 1.25.

#### Scenario: The chart in portrait
- **WHEN** the chart shows at 390 × 844
- **THEN** 9 thin rings with leader lines and labels run from START at y 782 to EARTH at y 110, 84 px apart, the next leg's lane chips (120 × 80 px tap areas) sit at y 572, and the bottom line reads "THE LIGHT AT LAUNCH: 14 S"
- **CHECK** `layout.e2e.mjs`

#### Scenario: Landscape and desktop charts
- **WHEN** the chart shows at 844 × 390 and at 1440 × 900
- **THEN** the ladder lies on its side along y 260 with nodes 95 px apart and chips at y 120 to 200, and on desktop it fills a 900 × 720 panel at 1.4 × scale
- **CHECK** `layout.e2e.mjs`

#### Scenario: Lane edits
- **WHEN** the same leg is built with its FAMILY lane and with its RISK lane on one seed
- **THEN** the RISK lane is exactly 16 beats longer, and the FAMILY lane differs from the plain leg only in the build section
- **CHECK** `course.test.mjs`

#### Scenario: A RISK chip says what it pays
- **WHEN** the chart shows leg 2
- **THEN** COMA'S HEART shows a cracked ring and "PICK 2 · RARE+", and THE GREAT WALL its family glyph and "SKIM × 2" (or its rolled family)
- **CHECK** `layout.e2e.mjs`

### Requirement: THE LOCAL VOID
THE LOCAL VOID SHALL replace the whole of leg 4 at × 0.6 length (82 beats): three far sheets and sparse knots, with no pickups, no wells and no rivals. It SHALL have no gas: no drag and no burn cap. It SHALL give no card, the SKIP reward instead, and its chip SHALL read SHORT · NO CARD.

#### Scenario: Burn it all
- **WHEN** a player enters the VOID for the first time from a thread launch with 4 cells and burns them all
- **THEN** NO GAS · NO DRAG · BURN IT ALL shows, η reaches about 3.2 and does not bleed away
- **CHECK** `handle.test.mjs`

#### Scenario: Fuel in is speed out
- **WHEN** one mid bot enters the VOID with 4 cells and another with 1
- **THEN** the first leaves it at least one gear faster
- **CHECK** `sim.test.mjs`

#### Scenario: Empty by rule
- **WHEN** the VOID is built on seeds 1 to 500
- **THEN** it has no pickups, wells or rivals, is × 0.6 length, and sets no drag and no burn cap
- **CHECK** `course.test.mjs`

### Requirement: Lane conditions
From leg 3 the chart SHALL roll one condition onto one lane of each leg, never the VOID and never the same one on two legs in a row, shown as the chip's second tag ("M87 · DUST"): DUST, FLARES, RICH, HEADWIND or TIDES, each with its cost and upside. A condition SHALL be made only of kinds and rules that already exist, SHALL pass the validator, and SHALL never change the light.

#### Scenario: Every condition builds
- **WHEN** each condition is built on every lane it can land on, seeds 1 to 500
- **THEN** every leg passes the validator and its light rules are untouched
- **CHECK** `course.test.mjs`

#### Scenario: In the dust
- **WHEN** a player flies a DUST lane at 390 × 844
- **THEN** hazards and rivals inside the dust draw as dark silhouettes with an orange 1.25 px outline until 0.5 s out, ticks still show, the mix low-passes to 900 Hz, and grazes there push the light back × 1.5
- **CHECK** `layout.e2e.mjs` and `survival.test.mjs`

#### Scenario: Chart rules
- **WHEN** `makeChart` runs on seeds 1 to 500
- **THEN** no condition lands on the VOID and none repeats on two legs in a row
- **CHECK** `course.test.mjs`

### Requirement: Legs built from hand-made pieces
Each leg SHALL be built by `buildLeg` from hand-made pieces picked per section by the seed, with integer RNG and no trig or `Math.random`, so one seed builds the same leg on every device. The opener and build pools of legs 3 to 7 SHALL hold at least 3 pieces, drawn in the leg's skin, no piece SHALL repeat in a run while its pool has others, and teaching pieces SHALL appear only while unseen. Building and validating a leg SHALL take under 40 ms in node.

#### Scenario: Same seed, same leg
- **WHEN** a leg is built twice from one seed, type, lane and mods
- **THEN** both have the same hash, and the committed golden hashes for seeds 1 to 3 of every leg and lane match
- **CHECK** `course.test.mjs`

#### Scenario: Runs look different
- **WHEN** legs 3 to 7 are built on any two of seeds 1 to 20
- **THEN** they differ in at least two sections
- **CHECK** `sim.test.mjs`

#### Scenario: The strip tool
- **WHEN** a developer opens `dev/strip.html` with a seed, leg and lane
- **THEN** the leg draws as an SVG with blocked arcs, the corridor and the validator's report, and every leg and lane draws without an error
- **CHECK** `course.test.mjs`

### Requirement: No unfair pieces
Every generated leg SHALL pass the validator's 13 rules. Among them: at most 7 hazards inside the ring, 5 in a swarm at top speed; a 30° gap within 60° of every bearing in a swarm; no traps for a ship that reacts in 0.35 s and turns 200° a second from any bearing safe 1.3 s before a pass; a preview tick 3 s ahead of any turn over 120° within 2 beats; wells 11 beats apart; every exit band within 10° of a real target; pickups 6 to 14° off the safe line.

#### Scenario: Every leg, every lane
- **WHEN** every leg type and lane is built on seeds 1 to 500
- **THEN** every leg passes R1 to R13
- **CHECK** `course.test.mjs`

#### Scenario: The old trap is caught
- **WHEN** the validator checks a fixture of lab A's old P1-4 wall and today's layout
- **THEN** it fails the old wall and passes today's
- **CHECK** `course.test.mjs`

#### Scenario: No piece hogs the hits
- **WHEN** the `mid` bot plays 200 runs
- **THEN** no piece takes more than 3 times its share of hits per pass
- **CHECK** `sim.test.mjs`

### Requirement: Set pieces
Each lane's signature SHALL be a named set piece with one line to find, among them: THE FILAMENT's converging rails, COMA'S HEART's tails, THE GREAT WALL's edge (WALL RIDE), M87's jet (RIDE THE JET), MARKARIAN'S CHAIN, ANDROMEDA (OBERTH taught), the GALACTIC CENTRE's bar, ORION'S BELT (BELT RUN), Saturn's ring gaps, and Jupiter with its moons. Each SHALL be drawn readable at every layout.

#### Scenario: JET RIDER
- **WHEN** a player rides M87's jet and clears all eight pulses, HST-1 to C
- **THEN** JET RIDER shows and pays +1 fuel, and the first time THE KNOTS LOOK FASTER THAN LIGHT shows
- **CHECK** `course.test.mjs` and `handle.test.mjs`

#### Scenario: Saturn's gaps
- **WHEN** a player at Saturn steers through the ENCKE GAP, or finds the unlabelled KEELER GAP
- **THEN** ENCKE pays +0.8 × M s, +0.25 η and +2 chain, and KEELER, a double hairline, pays +1 fuel
- **CHECK** `course.test.mjs`

#### Scenario: Small targets stay readable
- **WHEN** the ring is at its floor at 390 × 844
- **THEN** the jet's 4° shows as 8 to 11 px, Saturn's Keeler gap as 20 px, and the PERFECT zone as 41 px
- **CHECK** `layout.e2e.mjs`

### Requirement: The director
On a `breather` event the director SHALL drop every optional item more than 1.3 s and less than 5 s ahead and keep knots in that window 30° apart, inside the step so it stays deterministic. Nothing else SHALL adapt: no density change after a hit or a death, and no hidden help.

#### Scenario: Nothing changes after a hit
- **WHEN** one ship flies a leg cleanly and another on the same seed takes three hits
- **THEN** both meet the same items except those a breather dropped
- **CHECK** `course.test.mjs`

### Requirement: Each leg's backdrop
Each leg SHALL show its own backdrop in the video's look, built in the break's idle slices with the last one disposed: the cosmic web and Coma's giants; Virgo with M87's jet as a beamed line and no counter-jet; Andromeda and Triangulum as discs; the Milky Way's disc with dust lanes; Orion's named stars and haze; the Sun, the planets, Saturn's rings with their real gaps, the Moon and Earth.

#### Scenario: The contact sheet
- **WHEN** the layout check shoots 30 moments at each of 390 × 844, 844 × 390 and 1440 × 900, including each gate, each signature, the dust, Saturn and the landing
- **THEN** each backdrop reads as its place in black space with white points and thin labelled rings, as reviewed by eye
- **CHECK** `layout.e2e.mjs`

#### Scenario: Built while you fly
- **WHEN** a player flies a leg and then reaches its break
- **THEN** the next leg's lanes were built and validated in idle slices of 4 ms or less during the leg, and in the break the next backdrop is built in idle slices and the old one disposed
- **CHECK** `perf.e2e.mjs`
