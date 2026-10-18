## ADDED Requirements

### Requirement: Every ship has its own light
Each ship SHALL have a gap, the seconds between it and the burst's light, that falls by (1 − tanh η) every second; a docked or stopped ship SHALL lose 1 s a second. The light's only number SHALL be its time to catch, TTC = gap ÷ (1 − β). The light SHALL never speed up or target anyone, and nothing SHALL change because a player died.

#### Scenario: The bleed is exact
- **WHEN** a ship holds η 1.0 for 10 s with nothing to push the light back
- **THEN** its gap falls by 10 × (1 − tanh 1) = 2.38 s
- **CHECK** `qa/ahead-of-the-light/survival.test.mjs`

#### Scenario: Speed buys time
- **WHEN** a ship at η 0.8 with a 4 s gap burns to η 1.2
- **THEN** its TTC jumps from 11.9 s to about 24 s, and the light's ring springs outward and reddens on that frame
- **CHECK** `survival.test.mjs` and `feedback.e2e.mjs`

### Requirement: The light at each launch
Your run SHALL start with a gap of 7 s (the burst went off as you left: TTC 29 s at 0.76c) and each rival's with 8 s. At each gate every ship's gap SHALL be cut to the next leg's cap, so the light that one leg's masses held back does not carry past them.

#### Scenario: The start
- **WHEN** a run launches leg 1 at η 1.0
- **THEN** your gap is 7 s and your TTC 29 s, and every rival's gap is 8 s
- **CHECK** `race.test.mjs` and `tune.test.mjs`

#### Scenario: The cap holds from the launch
- **WHEN** a ship threads Coma's gate with an 8 s gap
- **THEN** leg 2 launches it with a 3.5 s gap (leg 2's cap) at η 1.6, TTC 45 s, and the break's line reads LEAD AT LAUNCH 45 S
- **CHECK** `run.test.mjs` and `sim.test.mjs`

### Requirement: The light's ring is always on screen
The light SHALL be a white ring outside the play ring at R_b = R_p × (1 + K_B × u), u = clamp(ln(1 + TTC ÷ 2) ÷ ln(1 + 300 ÷ 2), 0, 1), with K_B 1.4 on phones and 0.85 on desktop, coloured by 30,000 K × e^−(η − 1): blue-white when you are slow, dull red when you are fast, white in the glare. At least 60 px of its arc SHALL be on screen in every frame: a bottom arc in portrait, side arcs in landscape and on desktop.

#### Scenario: Portrait
- **WHEN** a mid bot's run plays at 390 × 844
- **THEN** the light's ring sits at 1.96 × the play ring at TTC 60 s and 1.39 × at TTC 6 s, a bottom arc of 60 px or more shows in every sampled frame, and under TTC 6 s it shows top and bottom
- **CHECK** `layout.e2e.mjs`

#### Scenario: Landscape and desktop
- **WHEN** the same run plays at 844 × 390 and at 1440 × 900
- **THEN** the ring shows as side arcs of 60 px or more in every sampled frame, at 1.58 × at TTC 60 s on desktop
- **CHECK** `layout.e2e.mjs`

#### Scenario: One hit at speed pulls it in
- **WHEN** a ship at η 2.0 on a 5 s gap (TTC 139 s) is hit
- **THEN** its TTC falls to about 29 s and on a phone the ring pulls in from 2.19 × to 1.76 × on that frame
- **CHECK** `survival.test.mjs` and `layout.e2e.mjs`

### Requirement: Skill pushes the light back
Push-backs SHALL add to the gap, times the leg's mass factor M (1.00 on leg 1 down to 0.59 on leg 8): graze 0.12 s, hairline 0.30, rival graze 0.12, rail skim 0.20 a second, a whip 0.4 × mass × (0.5 + d) (half on WIDE), a mid-leg pair 0.5, takedown 0.3, gate thread 2.0, dock 1.5, fly past 0.5. Gains SHALL stop at the leg's cap (8, 3.5, 3, 3, 3, 3, 2.8, 2.8 s: a buffer of 2 or 3 hits), except a red-zone release (up to +1.5 s, fading 0.1 s a second) and STILL LIGHT.

#### Scenario: A graze in leg 1
- **WHEN** a ship below the cap grazes a knot in leg 1
- **THEN** its gap rises by exactly 0.12 s, and the ring springs outward over 0.25 s with a faint arc from the galaxy toward it, and no number pops
- **CHECK** `survival.test.mjs` and `feedback.e2e.mjs`

#### Scenario: The cap holds
- **WHEN** a ship at leg 3's 3 s cap hairlines a knot
- **THEN** its gap stays at 3 s; only a red-zone release lifts it past the cap, by 1.5 s at most, fading at 0.1 s a second
- **CHECK** `survival.test.mjs`

#### Scenario: STILL LIGHT raises the cap
- **WHEN** a player who owns STILL LIGHT (Common) hairlines 25 knots in a leg
- **THEN** the leg's cap rises by 0.1 s each time up to +2 s, a faint second ring flashes outside the light's ring on each, and the bonus clears at the next launch
- **CHECK** `survival.test.mjs`

### Requirement: The light's states
The light SHALL be far at TTC 10 s or more (its label only in a run's first 20 s), pressed under 10 s with the label "LIGHT · 7 S", warned once under 6 s with a heartbeat from 60 bpm rising to 140 at TTC 0 (re-armed only above 9 s), and IN THE GLARE under 3.0 s until TTC passes 4.5 s: a white CSS rim at 0.55 × clamp((3 − TTC) ÷ 3, 0, 1), the ring full white, a high whine and the label in tenths. Warnings SHALL key on TTC, never on the gap.

#### Scenario: A frozen TTC warns once
- **WHEN** a ship's TTC sits at 5.5 s for 20 s
- **THEN** `warn` fires once and the heartbeat plays, and it fires again only after TTC has risen above 9 s
- **CHECK** `survival.test.mjs`

#### Scenario: Into the glare on a phone
- **WHEN** a first-run player's TTC falls under 3.0 s at 390 × 844
- **THEN** the white rim fades in, the ring turns full white and pulses, the whine starts, and IN THE GLARE · ONE HIT AND IT HAS YOU shows once this leg
- **CHECK** `layout.e2e.mjs` and `feedback.e2e.mjs`; one 10 ms buzz per heartbeat on a real phone in the user's playtest

#### Scenario: The glare costs no frames
- **WHEN** the perf check runs a bot's leg at 390 × 844 with a 4 × CPU throttle, glare on and off
- **THEN** the frame times differ by 10 % or less
- **CHECK** `perf.e2e.mjs`

#### Scenario: A breather after the peak
- **WHEN** a ship leaves the glare, or has been in it for 4 s
- **THEN** a `breather` fires, every optional item 1.3 to 5 s ahead is dropped, and no two knots in that window sit within 30° of each other for 5 s
- **CHECK** `course.test.mjs`

### Requirement: A far light reads
The far light's label SHALL also show during each leg's launch, so its quiet seconds show what the gate left you. A time to catch of 100 s or more SHALL read in whole minutes (LIGHT · 3 MIN), and an hour or more as HOURS, on the ring, on the break (LEAD AT LAUNCH) and on the chart.

#### Scenario: A far light reads
- **WHEN** a leg launches with the light 150 s away
- **THEN** its label reads LIGHT · 3 MIN during the launch, never LIGHT · 150 S, and hides once the race starts
- **CHECK** `ringmath.test.mjs` and `layout.e2e.mjs`

### Requirement: Hits, catches and wrecks
A hit SHALL cost you 0.7 η (never below 0.6) and end HEADLIGHT and LIGHT SPEED, pop the shield or else cost 1 hull, break the chain, drop the gap 1.0 s and fall 1.0 s back in the field over 0.4 s, then give 1.0 s of flicker. A hit outside the glare SHALL never leave TTC under 2.9 s. A hit in the glare SHALL catch the ship in the same step; 0 hull and no shield SHALL wreck it. A run's first 10 s of leg 1 SHALL turn hits into a 10° bump with no cost.

#### Scenario: No catch from outside the glare
- **WHEN** seeds 1 to 200 of random hit sequences run at every η from 0.6 to 4.9
- **THEN** no hit outside the glare emits `caught` or leaves TTC under 2.9 s, every catch comes after a `glareIn`, and every hit inside the glare emits `caught`
- **CHECK** `survival.test.mjs`

#### Scenario: Caught
- **WHEN** a player is hit in the glare
- **THEN** the ring sweeps over theirs, white floods in, a white-noise swell plays and the music keeps playing, low-passed, under the result card
- **CHECK** `survival.test.mjs` and `feedback.e2e.mjs`

#### Scenario: Wrecked
- **WHEN** a ship with 0 hull and no shield is hit outside the glare
- **THEN** `wreck` then `caught` fire, the ship stops and the light floods in
- **CHECK** `survival.test.mjs`

#### Scenario: The soft start
- **WHEN** a player clips a knot 6 s into a run
- **THEN** the ship is shoved 10° aside with a `bump`, and it loses no speed, shield, hull or gap
- **CHECK** `handle.test.mjs`


### Requirement: A rival's own ship
A named rival's hit SHALL cost it 0.4 η and 0.4 s of gap (each ship is its own ship, as NEEDLE's 0.8 η is); a drifter's SHALL cost what yours does. A boss SHALL launch at least 4.5 s ahead of its light. The light SHALL take about 1 to 2 regulars in a mid player's run, so the field keeps named ships to race to the end.

#### Scenario: The field lives
- **WHEN** the mid bot plays 64 runs
- **THEN** the light takes 2.6 regulars a run or fewer (the known-gap floor; the target is about 1)
- **CHECK** `sim.test.mjs`
### Requirement: Hull and shield
The ship SHALL have 3 hull pips (cards and ships raise it to 5) and 1 shield charge that takes the damage of one hit and returns 5 s after the last hit (LANTERN; NEEDLE 4 s, TUG 7 s, GHOST 4 s). At 1 hull with the shield down, sparks SHALL trail the ship and a two-note alarm play once, with LAST HULL captioned the first time in a run. A clean leg (no hits, shield pops included) SHALL give +1 hull, or +1 fuel at full hull, shown as CLEAN LEG +1.

#### Scenario: The shield takes a hit
- **WHEN** a ship with its shield up clips a wall
- **THEN** no hull is lost, the 13 px bubble bursts into six fragments with a glass pop, SHIELD DOWN shows and the music drops a step
- **AND** the shield returns exactly 5.0 s after the last hit with a soft rising chime
- **CHECK** `survival.test.mjs` and `feedback.e2e.mjs`

#### Scenario: Last hull
- **WHEN** a second hit takes a 2-hull ship with no shield to 1 hull
- **THEN** a hull pip cracks on the left wing, sparks trail the ship, the alarm plays once and LAST HULL shows the first time this run
- **CHECK** `survival.test.mjs`

#### Scenario: A clean leg
- **WHEN** a ship with 2 of 3 hull finishes a leg with no hits and no shield pops
- **THEN** the break shows CLEAN LEG +1 and the ship launches with 3 hull
- **CHECK** `survival.test.mjs`

### Requirement: Fuel and pickups
Fuel SHALL start a run at 2 cells of 4 (cards raise the cap to 6), hold parts of a cell, and never drain on its own. Leg 1 SHALL hold 1 fuel pickup and legs 2 to 8 hold 3 fuel and 1 patch each, fuel 6 to 14° off the safe line. A pickup SHALL go to the first ship within 4° of its edge. A patch SHALL spawn near 55 % of the leg only if your hull is below full 3 s before it shows. At full tanks a fuel pickup SHALL take 2 s off the shield's recharge.

#### Scenario: Take a cell
- **WHEN** a player at 390 × 844 steers within 4° of an orange FUEL diamond a hairline from a knot
- **THEN** "+1 ◆" shows at the ship, a diamond fills on the right wing, and the orange dashed tick had shown 1.3 s before
- **CHECK** `handle.test.mjs` and `feedback.e2e.mjs`

#### Scenario: A rival gets there first
- **WHEN** a rival passes within 4° of a fuel pickup before you do
- **THEN** the rival takes it and it is gone, at no cost to you
- **CHECK** `handle.test.mjs`

#### Scenario: A patch only when it matters
- **WHEN** a player reaches 55 % of leg 2 with full hull
- **THEN** no patch spawns, and on the same seed with 2 hull a PATCH shows in a hard window
- **CHECK** `course.test.mjs`

#### Scenario: Full tanks still pay
- **WHEN** a ship with 4 of 4 cells and its shield recharging takes a fuel pickup
- **THEN** its fuel stays at 4 and its shield returns 2 s sooner
- **CHECK** `survival.test.mjs`

### Requirement: The wings
Hull pips SHALL sit left of the ship and fuel diamonds right of it on an arc 7 px outside the ring, one item every 5° from 8° out, so 5 pips reach 28° and 6 cells 33°. A lost pip or an empty cell SHALL show as a 1 px outline at 35 %, and a part-filled cell SHALL fill as it does. The shield SHALL be a 13 px bubble round the ship with an arc sweeping round it while it recharges. Desktop SHALL double every size. No wing item SHALL touch another, HUD text or the pause button.

#### Scenario: Portrait at the floor
- **WHEN** a ship with 5 hull and 6 fuel flies at 0.999c at 390 × 844, its ring at 117 px
- **THEN** all 11 wing items show, no two touch, and none overlaps HUD text or the pause button
- **CHECK** `layout.e2e.mjs`

#### Scenario: Landscape
- **WHEN** the same ship flies at 844 × 390, with 47 px under the ship
- **THEN** every wing item is inside the screen and no two touch
- **CHECK** `layout.e2e.mjs`

#### Scenario: Desktop
- **WHEN** the same ship flies at 1440 × 900
- **THEN** pips are 24 × 8 px and diamonds 16 × 16 px on an arc 14 px outside the ring
- **CHECK** `layout.e2e.mjs`

### Requirement: THREAD, DOCK or fly past
About 4 s before each landmark, its THREAD line (the gap between its two giants, 30° on leg 1 and 1° narrower each leg, orange label) and its DOCK ring (60°, at least 120° round from the thread, white label "DOCK +") SHALL draw on with preview ticks 3 s ahead. A thread SHALL pay +2.0 × M s, +0.8 η and the HEADLIGHT punch and launch the next leg at η 1.6; a dock +1.5 × M s, a free repair and the dock strip, at η 0.8; a fly-past +0.5 × M s, at η 1.0.

#### Scenario: Thread Coma on a phone
- **WHEN** a player at 390 × 844 swings the long way round and passes between NGC 4874 and NGC 4889
- **THEN** THREAD plays in slow motion, the sky punches to a blue-white eye, HEADLIGHT shows, the light's ring bends outward at Coma and settles over 0.8 s with COMA HOLDS THE LIGHT BACK, and leg 2 launches at η 1.6
- **CHECK** `survival.test.mjs` and `layout.e2e.mjs`

#### Scenario: A missed thread
- **WHEN** a player aiming to thread clips a giant
- **THEN** it is a hit on the giant and the gate pays only +0.5 × M s
- **CHECK** `survival.test.mjs`

#### Scenario: Launch speeds
- **WHEN** a ship threads, flies past or docks
- **THEN** the next leg launches at η 1.6, 1.0 or 0.8, and at REDSHIFT 3 at 1.0, 1.0 or 0.6
- **CHECK** `survival.test.mjs`

#### Scenario: The caption fades out of use
- **WHEN** a player reaches a gate on their 4th run
- **THEN** the lines and labels draw on with no THREAD OR DOCK caption, which played on the first 3 runs only
- **CHECK** `smoke.e2e.mjs`

### Requirement: The dock strip
After a DOCK the break SHALL show chips priced in gap seconds, each labelled with its drop in launch TTC: FREE REPAIR +1 hull (automatic), REPAIR +1 hull for 0.6 s, REFUEL +2 fuel for 0.4 s, and TUNE one card up a rarity for 0.8 s, once a dock. A purchase SHALL never leave launch TTC under 4 s: its chip SHALL grey out and read TOO CLOSE. Tapping a bought chip again before launch SHALL refund it exactly. Each docked second SHALL age you 0.25 years.

#### Scenario: Buying safety with time
- **WHEN** a docked player at 390 × 844 taps REPAIR
- **THEN** the chip reads "−1.8 S", LEAD AT LAUNCH drops by 0.6 s of gap, the ship gains 1 hull, and the run's years rise by 0.15
- **CHECK** `survival.test.mjs` and `layout.e2e.mjs`

#### Scenario: Too close
- **WHEN** a purchase would leave launch TTC under 4 s
- **THEN** its chip is grey, reads TOO CLOSE and cannot be bought
- **CHECK** `survival.test.mjs`

#### Scenario: Chips on each layout
- **WHEN** the dock strip shows
- **THEN** chips are 170 × 72 px in a row at y 236 to 308 at 390 × 844, stacked 236 × 44 px in the left column at 844 × 390, and in an 80 px strip at 1440 × 900, every one 44 px or more
- **CHECK** `layout.e2e.mjs`

### Requirement: Land before the light
Leg 8 SHALL end with LAND BEFORE THE LIGHT: a 60° DOOR labelled EARTH at L − 4 with a preview tick 3 s ahead. Landing SHALL need a margin of 3 s plus 1 s for each nine held at the door, covered by the gap in full, then fuel cells at 1 s each (up to 3), then hull pips at 1 s each. Short of it the ship SHALL be CAUGHT ON THE DOORSTEP. Missing the door SHALL loop the ship round in 1.5 s and cost 1.5 s of margin. Place SHALL be decided at the door.

#### Scenario: The margin shows from the start
- **WHEN** leg 8 launches and the player climbs to HEADLIGHT
- **THEN** "TO LAND: 5 S AT 0.99C · FUEL AND HULL COUNT 1 EACH" shows and updates with each gear, with a dashed white HOME LINE ring the light's ring must stay outside
- **CHECK** `layout.e2e.mjs`

#### Scenario: Home
- **WHEN** a ship at HEADLIGHT with a 3.2 s gap, 3 cells and 2 hull reaches the door
- **THEN** the landing spends 2 cells and no hull, the chevron flips, two orange retro flares fire, the sky opens out and HOME plays in D major
- **CHECK** `survival.test.mjs`

#### Scenario: Caught on the doorstep
- **WHEN** a ship at 0.999c with a 2 s gap, 1 cell and 1 hull reaches the door
- **THEN** 4 s is short of the 6 s margin: CAUGHT ON THE DOORSTEP, and the result's goal reads SAVE A CELL OR TWO FOR THE LANDING
- **CHECK** `survival.test.mjs` and `run.test.mjs`

#### Scenario: Keep cells for the landing
- **WHEN** 200 mid runs burn every cell in leg 8, and 200 keep 2
- **THEN** the first group is caught on the doorstep at least twice as often
- **CHECK** `sim.test.mjs`

### Requirement: The light presses every skill
Across 200 bot runs per model, the light SHALL catch weak players early, press mid players in most legs, and reach experts only through hit clusters and REDSHIFT, and no catch at any level SHALL come without a `glareIn` first.

#### Scenario: Weak and novice
- **WHEN** the `weak` and `novice` bots play seeds 1 to 200
- **THEN** `weak` is caught by leg 3 in 80 % or more; `novice` has a median catch on leg 3 or 4, leg-1 catches in 5 % or less and gets home in 10 % or less
- **CHECK** `sim.test.mjs`

#### Scenario: Mid
- **WHEN** the `mid` bot plays seeds 1 to 200
- **THEN** it gets home in 25 to 45 %, its median catch is on leg 5 or later, TTC falls under 10 s in at least 50 % of legs, and it sees the glare in at least 15 % of runs
- **CHECK** `sim.test.mjs`

#### Scenario: Expert
- **WHEN** the `expert` bot plays seeds 1 to 200
- **THEN** it gets home in 85 % or more, sees TTC under 10 s in at least 5 % of legs at REDSHIFT 0 and 25 % at REDSHIFT 3
- **CHECK** `sim.test.mjs`

#### Scenario: Choices change the outcome
- **WHEN** a novice never burns, or a mid never docks
- **THEN** the novice is caught at least a leg sooner, and the mid gets home less than half as often
- **CHECK** `sim.test.mjs`
