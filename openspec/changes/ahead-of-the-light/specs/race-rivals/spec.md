## ADDED Requirements

### Requirement: The field
Each run SHALL draw three regulars from HOUND, PIKE, REMORA and MOTH; the fourth SHALL wait in reserve and join once ("MOTH JOINS" on the chart) if the light takes one. Leg 1 SHALL add 3 drifters, legs 2, 4, 5 and 7 add 3, 2, 2 and 2, and the WHALE (leg 3), MAKO (leg 6) and MANTA (leg 8) SHALL join their legs. Named ships SHALL line up in the order they crossed the last gate line, 0.25 s apart, with your place among them, and each rival's hull and gap SHALL carry over.

#### Scenario: Leg 1
- **WHEN** a run launches
- **THEN** three regulars sit 0.6, 1.2 and 1.8 s ahead and do not ram or block, and 3 nameless 4 px drifters start 1 to 4 s ahead with gaps of 3 to 6 s
- **CHECK** `qa/ahead-of-the-light/rivals.test.mjs`

#### Scenario: The grid
- **WHEN** leg 2 launches after you crossed Coma's gate line third
- **THEN** the named ships line up in that order 0.25 s apart, with you third, nobody ahead of the leader to draft, and each rival at least 2 fuel with its shield up
- **CHECK** `rivals.test.mjs`

#### Scenario: A rival docks
- **WHEN** a rival reaches a gate with 1 hull
- **THEN** it docks: +2 hull, a launch at η 0.8 and 1.5 s of gap paid
- **CHECK** `rivals.test.mjs`

#### Scenario: The VOID is empty
- **WHEN** a player flies THE LOCAL VOID
- **THEN** no rival races it, and in leg 5 the rivals line up behind you with their states unchanged
- **CHECK** `rivals.test.mjs`

### Requirement: Draft, tow and slingshot
A ship 0.08 to 0.8 s ahead within ±6° of your bearing SHALL leave a wake, drawn as two thin lines from its chevron to the ring. In it a ship SHALL feel no drag, gain 0.06 η a second, move at course speed × 1.10, and fill a draft charge in 1.0 s with a rising tone; at full the lines SHALL turn orange. Steering more than 10° out with charge 0.5 or more SHALL SLINGSHOT: +0.30 × charge η and course speed × 1.3 for 0.8 s. A whip released into a wake SHALL start the draft half full.

#### Scenario: Tuck in, pull out
- **WHEN** a player at 390 × 844 steers into REMORA's wake 0.5 s behind it, holds 1.0 s, then steers 15° out
- **THEN** the lines show and turn orange as the tone rises, and on the pull-out SLINGSHOT plays with a whoosh and +0.30 η
- **CHECK** `handle.test.mjs` and `feedback.e2e.mjs`

#### Scenario: Passing takes a tow
- **WHEN** the `mid` driver starts 0.8 s behind a cruising rival
- **THEN** it passes the rival within 6.0 s
- **CHECK** `rivals.test.mjs`

#### Scenario: Being drafted
- **WHEN** a rival sits in your wake
- **THEN** an orange tick shows at your tail, and weaving 10° shakes it off at no cost to you (`shaken`)
- **CHECK** `handle.test.mjs`

### Requirement: Contact
Ships within 0.08 s in depth whose bearings overlap SHALL touch, the one closing faster in bearing being the rammer. Under 200° a second it SHALL be a BUMP (both shoved 6°). At 200° a second or more it SHALL be a SLAM: the victim is shoved 12° + 0.04° per °/s (30° at most) over 0.15 s and spills 1 fuel cell, which the rammer takes if it has room. One ship straight behind another (within 3°) SHALL rear-end it and lose 0.2 η.

#### Scenario: A SLAM on a phone
- **WHEN** a player at 390 × 844 drags 40 px sideways in a quick swipe into a rival beside them
- **THEN** it is a SLAM: a crunch and a spilled-cell tinkle, exactly one cell moves from the rival to you, and the rival is shoved away
- **CHECK** `handle.test.mjs`

#### Scenario: A BUMP
- **WHEN** two ships drift together at 100° a second
- **THEN** both are shoved 6° apart with a thud and nothing is lost
- **CHECK** `handle.test.mjs`

#### Scenario: Desktop
- **WHEN** a desktop player at 1440 × 900 taps ← into a rival on their left
- **THEN** the keys' 330° a second makes a SLAM
- **CHECK** `input.e2e.mjs`

### Requirement: Takedowns and traps
A shove that carries the victim through a hazard's edge or a well's core within 0.4 s SHALL be a TAKEDOWN: the victim takes a full hit, and the rammer gets +1 fuel and +0.3 s of gap. A knot's tick SHALL turn orange when a shove from your line would do it. A ship drafting you that hits a hazard you passed in the last 0.4 s at an edge gap under 7° SHALL count as your takedown with no fuel, captioned TRAPPED the first two times.

#### Scenario: Slam it into the knot
- **WHEN** a rival flies beside you with a knot just past it, and you slam it
- **THEN** the knot's tick had turned orange, the rival takes a hit, TAKEDOWN shows with a crash and a 40 ms buzz, and you gain +1 fuel and +0.3 s of gap
- **CHECK** `handle.test.mjs` and `feedback.e2e.mjs`

#### Scenario: Open space is not a takedown
- **WHEN** you slam a rival into open space
- **THEN** it is shoved and spills a cell, but takes no hit
- **CHECK** `handle.test.mjs`

#### Scenario: Trapped
- **WHEN** REMORA drafts you 0.3 s behind and you dodge a knot late
- **THEN** REMORA hits the knot in 80 % of seeds 1 to 20, and it counts as your takedown with TRAPPED
- **CHECK** `rivals.test.mjs`

### Requirement: The lean warns of every slam
Every rival SLAM SHALL start with a 0.3 s lean: the rival's chevron tilts toward its target and a short orange tick lights on the target's side of the ring. Steering away in the lean SHALL turn the SLAM into a BUMP or a miss. Rams SHALL be off in leg 1. In legs 2 and 3 they SHALL run at half strength, and a rival SHALL SLAM you only when no hazard lies within 30° past you. Full rams and rival-aimed takedowns SHALL start in leg 4.

#### Scenario: Every slam has a lean
- **WHEN** rivals race any leg on seeds 1 to 20
- **THEN** every rival SLAM has a `lean` at least 0.3 s before it, on the side it comes from
- **CHECK** `rivals.test.mjs`

#### Scenario: The first slam on a phone
- **WHEN** on a first run at 390 × 844, HOUND leans toward the player on leg 2's open road and the player does not move
- **THEN** HOUND's chevron tilts, an orange tick lights on the player's left, then a crunch, a cell tinkles off to HOUND, and "SMELL YOU, ROOKIE." shows
- **CHECK** `rivals.test.mjs` and `layout.e2e.mjs`

#### Scenario: Soft rams early
- **WHEN** rivals race legs 1 to 3
- **THEN** no rival SLAMs anyone in leg 1, and in legs 2 and 3 no rival SLAM on you starts with a hazard within 30° past you
- **CHECK** `rivals.test.mjs`

### Requirement: Four regulars, one rule each
HOUND SHALL steer for your bearing and ram within 10°; PIKE SHALL aim where you will be in 0.8 s, take the gap first and copy your pull-out for up to 1.2 s; REMORA SHALL ride whoever is ahead, then slingshot past; MOTH SHALL graze everything, linger near the light for 2 s and scatter up close. Each SHALL have its own silhouette and three-note motif, and each SHALL have a weakness a player can use.

#### Scenario: PIKE's block can be beaten
- **WHEN** a ship pulls out of PIKE's wake on seeds 1 to 20
- **THEN** in Act II a 25° pull-out passes and a 20° one is blocked; in Act III a 35° pull-out is blocked and a feint crossing 0.15 s after it passes
- **CHECK** `rivals.test.mjs`

#### Scenario: HOUND dodges what REMORA eats
- **WHEN** the leader dodges a knot late
- **THEN** REMORA, blind in the wake, hits it in 80 % of seeds, and HOUND in CRUISE dodges it in 80 %
- **CHECK** `rivals.test.mjs`

#### Scenario: Personalities show
- **WHEN** rivals race legs 4 and later
- **THEN** HOUND rams 1 to 3 times a leg, REMORA spends 50 % of a leg in a wake, and MOTH takes at least twice HOUND's hits
- **CHECK** `rivals.test.mjs`

### Requirement: Rivals drive fair
Rivals SHALL be bots that send the same intents as the player to the same step, every 50 ms, seeing the race as it was reactMs ago. Every change in a rival's η and gap SHALL come from an event the player could see. No rival SHALL pass η 3.80, and the only jump SHALL be a stumble gliding over 0.4 s. A rival more than one gear above you SHALL stop burning and halve its greed until it is back within one gear, its tail flame dimmed. No switch SHALL key on place.

#### Scenario: The honesty audit
- **WHEN** rivals race every leg on seeds 1 to 20
- **THEN** every change in a rival's η matches its events, every gap change matches course speeds, tows, surges and logged stumbles, and no rival passes η 3.80 + 1e-9
- **CHECK** `rivals.test.mjs`

#### Scenario: A stumble glides
- **WHEN** a rival is hit
- **THEN** it falls back exactly 1.0 s over 0.4 s, never in one step
- **CHECK** `rivals.test.mjs`

#### Scenario: Cheap enough for a phone
- **WHEN** six ships race
- **THEN** rival AI takes under 1 ms per 120 Hz step in node, and 1.0 ms or less per 50 ms tick on a low-tier phone
- **CHECK** `rivals.test.mjs` and `perf.e2e.mjs`

### Requirement: The light eats rivals
Every rival SHALL have its own gap and follow your glare, catch and wreck rules. A rival behind you SHALL be drawn outside the ring by its gap, never off screen (12 px inside the edge at most). When a rival's gap reaches 0 its chevron SHALL flash white and the light's ring bulge at its bearing, with a thin white beam first if it was ahead. THE LIGHT TOOK HOUND SHALL show at most once a leg, or FED TO THE LIGHT if you took it down, trapped it or weaved it off in the last 5 s.

#### Scenario: The drifter at 25 s
- **WHEN** a first-time player reaches about 25 s of leg 1, at 390 × 844, 844 × 390 or 1440 × 900
- **THEN** a grey dot 70 to 110° round from them slides out to the light's ring, flares white and is gone, THE LIGHT TOOK A DRIFTER shows, and the flare is inside the screen
- **CHECK** `sim.test.mjs` (a drifter eaten before 30 s on every seed) and `layout.e2e.mjs`

#### Scenario: Behind you in landscape
- **WHEN** a rival drafts you at 844 × 390, where 47 px lie under the ship
- **THEN** its chevron sits 12 px inside the bottom edge along its bearing and stays on screen
- **CHECK** `layout.e2e.mjs`

#### Scenario: Fed to the light
- **WHEN** you take down a rival whose gap then reaches 0 within 5 s
- **THEN** `eaten` fires with its id and your ship as `fedBy`, a soft minor chord plays, and FED TO THE LIGHT shows
- **CHECK** `survival.test.mjs`

### Requirement: Reading a rival
A rival SHALL be a filled white chevron 7° wide in its own silhouette; beyond 1.5 s ahead it SHALL be a hollow chevron at 0.20 ring radii with its seconds ("PIKE +2.4 S"). Its state SHALL be drawn: Nemesis orange, sparks at last hull, a halo in its glare, a 10 px hook 0.3 s before it grabs, the lean, PIKE's flare, MAKO's fin. At most 2 labels SHALL show (name and signed gap, 11 px, 13 on desktop), never within 24 px of the landmark label.

#### Scenario: Labels on a phone
- **WHEN** four rivals and Coma's label are on screen at 390 × 844
- **THEN** at most 2 rival labels show, in the order Nemesis, boss, nearest, newest change, and none comes within 24 px of COMA
- **CHECK** `layout.e2e.mjs`

#### Scenario: Grab first
- **WHEN** a rival is about to grab a well you are also in reach of
- **THEN** a 10 px white hook shows from its nose 0.3 s before, so a press now grabs first and the rival's later press gives a dull click
- **CHECK** `handle.test.mjs`

### Requirement: Barks
Barks of 2 to 5 words and 24 characters at most SHALL carry each rival's personality in the caption band, with a grey 11 px speaker tag and one pulse of the speaker's chevron. There SHALL be at most one per 8 s across the field, none within 2 s of a hit, release, gate, landmark or catch, none in leg 1's first 20 s, each line once a leg, and a bark that cannot show within 1.0 s SHALL be dropped. `?barks=0` and the setting SHALL turn them off.

#### Scenario: The limits hold
- **WHEN** rivals race every leg on seeds 1 to 20
- **THEN** barks come at most one per 8 s, none in the quiet windows and none over 24 characters
- **CHECK** `rivals.test.mjs`

#### Scenario: Used and told
- **WHEN** REMORA drafts the player and slingshots past
- **THEN** "NICE WAKE, PAL." then "THANKS FOR THE TOW!" show with "REMORA ·" in grey and its rising motif
- **CHECK** `rivals.test.mjs` and `feedback.e2e.mjs`

### Requirement: The Nemesis
The first regular to SLAM you twice in a leg, take you down once, be taken down by you once, or be slammed by you three times in a leg SHALL become your Nemesis: one at a time, never a boss. It SHALL show an orange chevron and label, play its motif within 1.0 s of you, hunt you within 1.0 s whatever its rule, and start each leg with +1 fuel directly behind you. Taking it down while it is your Nemesis SHALL settle it (SETTLED); a settled or eaten Nemesis SHALL never return.

#### Scenario: HOUND becomes your Nemesis
- **WHEN** HOUND slams you twice in leg 4
- **THEN** HOUND IS YOUR NEMESIS shows, its chevron turns orange, and next leg it starts directly behind you with +1 fuel
- **CHECK** `rivals.test.mjs`

#### Scenario: Settled
- **WHEN** you take down your Nemesis
- **THEN** SETTLED shows, its trophy card takes the random slot of the next offer, and it cannot become your Nemesis again this run
- **CHECK** `rivals.test.mjs` and `run.test.mjs`

### Requirement: The WHALE
On leg 3 the WHALE SHALL race as a 20° boss that cannot be taken down. Contact with it SHALL always be a SLAM on you (30°), and your shoves SHALL move it × 0.25. Its wake SHALL run ±14° from 0.08 to 1.6 s behind it, tow × 1.12, and pay × 1.5 on a slingshot. Its bow wave SHALL push ships 13.5 to 25° off its bearing away at 40° a second. Every 12 s from 6 s it SHALL breach (+0.6 η; × 1.3 tow in its wake for 1 s), its song 1 s before. Crossing the gate line ahead of it SHALL beat it.

#### Scenario: Its rules
- **WHEN** ships race the WHALE on seeds 1 to 20
- **THEN** no shove takes it down, its bow wave moves a ship at 40° a second, and a breach gives × 1.3 tow in its wake
- **CHECK** `rivals.test.mjs`

#### Scenario: Beating something big
- **WHEN** a player at 390 × 844 drifts into the WHALE's wake and pulls out
- **THEN** the lines turn orange, SLINGSHOT carries them past, and "FAST. LITTLE. ONE." shows
- **CHECK** `rivals.test.mjs` and `layout.e2e.mjs`

#### Scenario: The boss card
- **WHEN** the chart shows leg 3
- **THEN** the WHALE's card beside it reads BEHIND IT IS SAFE. BESIDE IT IS ROUGH.
- **CHECK** `layout.e2e.mjs`

### Requirement: MAKO
On leg 6 MAKO SHALL hunt, every 1.0 s, the ship with the fewest fuel cells within 1.5 s of it, ties going to the nearest ship. A 6 px orange fin SHALL mark its target, its two-note motif SHALL play while you are the target, and its lane alarm SHALL sound when it turns in within 0.3 s. Its shoves SHALL be × 1.5. After each ram it SHALL roll, steering locked for 0.6 s and drifting 20° a second away. Two takedowns on it in the leg SHALL make it back off and count as beaten.

#### Scenario: Keep two cells
- **WHEN** you hold 2 cells and REMORA, within 1.0 s of MAKO, drops to 1
- **THEN** the fin moves to REMORA within 1.0 s
- **CHECK** `rivals.test.mjs`

#### Scenario: Two takedowns
- **WHEN** you take MAKO down twice in leg 6
- **THEN** it falls back 3 s over 2 s and counts as beaten: hull and fuel refill at the break and the next offer shows 4 cards
- **CHECK** `rivals.test.mjs` and `run.test.mjs`

#### Scenario: The fin on a phone
- **WHEN** MAKO targets you at 390 × 844
- **THEN** the 6 px orange fin shows above your ship and MAKO's motif plays
- **CHECK** `layout.e2e.mjs` and `feedback.e2e.mjs`

### Requirement: MANTA
On leg 8 MANTA SHALL start on a 2 s gap and ride the light: its η SHALL rise by 0.5 × max(0, 1 − gap ÷ 8 s) a second, and while its sail is lit its gap SHALL not fall below 1.0 s. Its push SHALL be zero, the sail grey, while any ship sits behind it within 2.0 s and ±10°. 1.0 s before it passes a ship a 1 px white lane line SHALL light 15° off that ship. A takedown SHALL tear its sail for 4 s. Reaching the door ahead of it, or the light taking it, SHALL beat it.

#### Scenario: Shadowed
- **WHEN** a ship sits 1.0 s behind MANTA within 10° of its bearing
- **THEN** MANTA's push is zero and its sail is grey
- **CHECK** `rivals.test.mjs`

#### Scenario: Its lane
- **WHEN** MANTA is about to pass you
- **THEN** its lane line lights 1.0 s before, and steering into it blocks MANTA: it rear-ends you and you shadow it
- **CHECK** `rivals.test.mjs`

#### Scenario: Torn near the light
- **WHEN** you take MANTA down with its gap near 1 s
- **THEN** the sail tears, and the stumble ends in `eaten`: THE LIGHT TOOK MANTA
- **CHECK** `rivals.test.mjs`

#### Scenario: FIRST HOME
- **WHEN** you reach the door ahead of MANTA and land
- **THEN** the result card and the cabinet line show FIRST HOME with the crown
- **CHECK** `run.test.mjs`

### Requirement: Rivals race at every skill
Over 200 runs per bot model, place SHALL follow skill, the light SHALL take about one regular per mid run, and each boss SHALL be beatable at rates that rise with skill.

#### Scenario: Place
- **WHEN** the bots play seeds 1 to 200
- **THEN** the novice's median place is 3rd to 4th, the mid's 2nd, and the expert finishes first in 60 % of legs
- **CHECK** `sim.test.mjs`

#### Scenario: Rivals eaten
- **WHEN** the `mid` bot plays seeds 1 to 200
- **THEN** about one regular is eaten a run (0 to 2)
- **CHECK** `sim.test.mjs`

#### Scenario: Boss wins
- **WHEN** novice, mid and expert runs reach each boss
- **THEN** they beat the WHALE in 30 / 70 / 95 %, MAKO in 15 / 50 / 85 % and MANTA in 5 / 35 / 75 %
- **CHECK** `sim.test.mjs`
