## ADDED Requirements

### Requirement: A run is 8 legs with a break after each
A run SHALL fly 8 legs home along the video's route, about 10 minutes for a mid player. After legs 1 to 7 a break SHALL freeze game time and show, on one screen, the arrival line ("VIRGO · LEG 2 OF 8 · YOU AGED +8.3 YR · 2ND" and one line per rival event), your ship at 2 × with its wings and the light at launch ("LEAD AT LAUNCH 14 S"), the dock strip after a DOCK, and the offer. Then the chart SHALL show, and tapping a lane SHALL launch it. Input SHALL unlock 0.4 s after each screen appears.

#### Scenario: The first break in portrait
- **WHEN** a first-time player threads Coma at 390 × 844
- **THEN** "COMA · LEG 1 OF 8 · YOU AGED +7.9 YR · 4TH" types on in y 0 to 56, the ship and the light show in y 56 to 196, and three cards 358 × 152 px, 14 px apart, slide in from y 316 with SKIP · +1 FUEL at y 806 to 844
- **CHECK** `qa/ahead-of-the-light/layout.e2e.mjs`

#### Scenario: Landscape
- **WHEN** the break shows at 844 × 390
- **THEN** the status column fills the left 260 px and three cards of 176 × 292 px sit side by side from x 276 to 828, with SKIP and REROLL along the bottom
- **CHECK** `layout.e2e.mjs`

#### Scenario: Desktop
- **WHEN** the break shows at 1440 × 900
- **THEN** a centred 960 px panel holds three cards of 296 × 380 px; ← and → move a highlight, Enter, Space or pad A pick, and 1 to 4 pick a card directly
- **CHECK** `layout.e2e.mjs` and `input.e2e.mjs`

#### Scenario: A steering thumb cannot pick
- **WHEN** a player's thumb is still moving as the break appears
- **THEN** no card is picked in the first 0.4 s
- **CHECK** `input.e2e.mjs`

### Requirement: Pick 1 card of 3
The offer SHALL hold 3 cards: slot 1 from a family you own and slot 2 from one you do not (both from the lane's family after a FAMILY lane), and slot 3 from the whole pool. First of the named ships through the gate, or a beaten boss, SHALL add a 4th card. An owned card SHALL never show again. SKIP SHALL give +1 fuel, or +1 reroll at full tanks.

#### Scenario: The first offer ever
- **WHEN** a player finishes leg 1 for the first time
- **THEN** the offer is HAIR TRIGGER, SLOW ORBIT and AFTERBURNER, all Common, with PICK ONE · IT CHANGES HOW YOU FLY
- **CHECK** `run.test.mjs`

#### Scenario: First through the gate
- **WHEN** you cross Virgo's gate line ahead of every named ship
- **THEN** the offer shows 4 cards headed "FIRST TO VIRGO", 110 px tall each at 390 × 844
- **CHECK** `run.test.mjs` and `layout.e2e.mjs`

#### Scenario: Teaching the families
- **WHEN** a player on one of their first 3 runs finishes leg 1
- **THEN** no RIVAL card is offered until after leg 2, and from run 4 every family can appear from break 1
- **CHECK** `run.test.mjs`

### Requirement: RISK and place change the offer
After a RISK lane you SHALL pick 1 of 4, every card Rare or better, rolled one rarity row up. Your place among you and the named ships through the gate line SHALL move the rarity row: 1st one row up, 2nd and 3rd as the leg says, 4th or lower one row down.

#### Scenario: A RISK lane
- **WHEN** a player finishes a RISK lane
- **THEN** they pick 1 of 4, every card is Rare or better, and the offer is headed PICK 1 OF 4 · RARE+
- **CHECK** `run.test.mjs` and `layout.e2e.mjs`

#### Scenario: Place sets the rarity
- **WHEN** a player crosses a gate line 1st, and on another seed 5th
- **THEN** the first offer rolls from one rarity row up and the second from one row down
- **CHECK** `run.test.mjs`

### Requirement: Rarity and pity
Each card's rarity SHALL roll from the row of the leg just finished: Common, Rare and Epic at 75 / 25 / 0 % after leg 1, 68 / 30 / 2 after leg 2, 60 / 33 / 7 after leg 3, 52 / 36 / 12 after legs 4 and 5, and 45 / 38 / 17 after legs 6 and 7. Each Common shown SHALL move 4 points from Common to Rare on the next card, and a Rare or better SHALL reset it. A run SHALL have 1 REROLL, and more from the log.

#### Scenario: Pity
- **WHEN** n Commons have shown since the last Rare
- **THEN** the next card's Rare chance is the row's plus 4n points, and a Rare resets it to the row's
- **CHECK** `run.test.mjs`

#### Scenario: Same seed, same run
- **WHEN** two runs share a seed and every choice
- **THEN** their charts, offers and runs are the same
- **CHECK** `run.test.mjs`

### Requirement: Every card changes a rule
The pool SHALL hold 22 starters in four families (SKIM, WELL, SHIP and RIVAL), each a FORM, which fills its family's form slot, or a TRAIT, which stacks, with Common, Rare and Epic values; plus 6 fusions, 4 legendaries and 4 trophies. A card SHALL show a title of up to 14 characters, one effect line of up to 68 with its number in orange, a tag line and its family's band and glyph. Card faces SHALL never show ls or η; a burn's worth of speed is the unit.

#### Scenario: The 20 % rule
- **WHEN** each base card is forced at break 1 for the `mid` driver over 50 seeds, legs 2 to 4
- **THEN** each moves hairlines a minute, whips a leg, PERFECT share, burns a leg, drafts a leg, slams a leg, takedowns a run, glare time or time near hazard edges by 20 % or more, and keeps the mid home rate within −5 to +15 points
- **CHECK** `cards-drive.test.mjs`

#### Scenario: Faces fit
- **WHEN** every card's face is laid out at 390 × 844, 844 × 390 and 1440 × 900
- **THEN** every title fits 14 characters and every effect line 68, and no card text overflows its card
- **CHECK** `run.test.mjs` and `layout.e2e.mjs`

#### Scenario: A new form replaces the old
- **WHEN** you own STEADY HAND and SCRAPE is offered
- **THEN** SCRAPE's tag line reads REPLACES STEADY HAND, and taking it removes STEADY HAND from your build and from its fusions and legendary count
- **CHECK** `run.test.mjs`

#### Scenario: The card shows itself
- **WHEN** a player who took AFTERBURNER burns
- **THEN** a long orange flare shows, the grazes inside it count double, and AFTERBURNER shows at the ship in orange the first 2 times it fires this run
- **CHECK** `feedback.e2e.mjs`

### Requirement: Stacking caps
Builds SHALL stay within caps: graze band 12°, hairline band 5°, 3 shield charges, 6 fuel cells, 5 hull, whip gain multipliers × 2.5 after multiplying, and chances combined as 1 − Π(1 − p). Light-holding effects SHALL never lift the gap above the leg's cap, and STILL LIGHT SHALL raise the cap by 2 s at most. BUSSARD SCOOP SHALL fill at most 2 cells a leg, 3 with STAR LIFTER. SPARK GAP SHALL refund half a cell once a burn, and CHERENKOV's touch SHALL cost 10 chain.

#### Scenario: Caps for every pair
- **WHEN** `applyBuild` runs on every card alone and with every other card
- **THEN** every patched value stays within its cap
- **CHECK** `run.test.mjs`

#### Scenario: No endless fuel
- **WHEN** an expert with BUSSARD SCOOP (Epic) hairlines 40 knots in a leg
- **THEN** it gains 2 cells from the scoop that leg and no more
- **CHECK** `run.test.mjs`

### Requirement: Fusions
A fusion SHALL unlock from break 2 when you own a card of family X tagged → Y and a card of family Y tagged → X. It SHALL take slot 3 of the next offer once, one fusion or legendary an offer, and stay in the pool at normal odds if passed. Owning one half SHALL turn the partner cards' tag lines orange ("COMPLETES SPARK GAP"). The log SHALL show an unfound fusion as "SKIM + SHIP = ?".

#### Scenario: SPARK GAP
- **WHEN** a player owns HAIR TRIGGER (SKIM, → SHIP) and takes AFTERBURNER (SHIP, → SKIM) at break 2
- **THEN** SPARK GAP appears in slot 3 of the next offer, and never before both halves are owned
- **CHECK** `run.test.mjs`

#### Scenario: The partner glows
- **WHEN** a player owns HAIR TRIGGER and an offer shows AFTERBURNER
- **THEN** AFTERBURNER's tag line reads COMPLETES SPARK GAP in orange
- **CHECK** `layout.e2e.mjs`

### Requirement: One legendary a run
A legendary SHALL unlock from break 4 when you own 3 cards of its family including one of its forms (traits and trophies count toward the 3). Taking one SHALL close the others for the run; a passed legendary SHALL stay in the pool at normal odds. Its card SHALL wear a thin landmark ring with a leader line behind its title.

#### Scenario: The form rule
- **WHEN** a player owns 3 SKIM traits and no SKIM form at break 4
- **THEN** CHERENKOV is not offered, and it is offered once they also own STEADY HAND or SCRAPE
- **CHECK** `run.test.mjs`

#### Scenario: Never two
- **WHEN** a player takes SLINGSHOT HOME and later owns 3 SHIP cards with a SHIP form
- **THEN** LIFEBOAT never shows this run
- **CHECK** `run.test.mjs`

#### Scenario: How often
- **WHEN** the `mid` bot plays 200 runs with the `planner` pick policy
- **THEN** a legendary is in 30 to 80 % of runs and never two in one build
- **CHECK** `sim.test.mjs`

### Requirement: Trophies
Feeding a regular to the light or settling it as your Nemesis SHALL put its trophy card in the random slot of the next offer, always Rare, and the trophy SHALL join your pool for good: HOUND'S BITE, PIKE'S DOOR, REMORA'S GRIP or MOTH'S DANCE. Trophies SHALL count toward legendaries and SHALL have no fusion tag.

#### Scenario: A trophy takes the random slot
- **WHEN** you feed PIKE to the light in leg 4
- **THEN** the next offer's slot 3 is PIKE'S DOOR at Rare, and it can be offered in later runs too
- **CHECK** `run.test.mjs`

### Requirement: Runs differ
Different runs SHALL build different ships: over 200 `planner` runs the median run SHALL be offered at most 75 % of the starters, and no starter SHALL be in more than 50 % of final builds.

#### Scenario: Variety
- **WHEN** the `mid` bot plays seeds 1 to 200 with the `planner` pick policy
- **THEN** the median run is offered 75 % of the starters or fewer, and no starter ends in more than half of the builds
- **CHECK** `sim.test.mjs`

### Requirement: Years aged
Your clock SHALL run at 0.25 years per second of sim time ÷ cosh η, and each docked second SHALL age you 0.25 years; Earth's clock SHALL run at 0.25 years per second. Years SHALL show at arrivals, on pause and on the result, never as a number mid-leg. Only a run home SHALL have a years score, ranked LIGHTKEEPER (15 years or less), NAVIGATOR (40), WAYFINDER (65) or DRIFTER; a caught run SHALL score by distance. Best runs SHALL sort by furthest leg, then fewest years.

#### Scenario: Time dilation
- **WHEN** a ship flies 10 s of sim time at HEADLIGHT (γ 7.09)
- **THEN** you age about 0.35 years while Earth ages 2.5
- **CHECK** `survival.test.mjs`

#### Scenario: The line everyone gets
- **WHEN** a player gets home after 25 years while Earth waited 124
- **THEN** the result reads HOME IN 25 YEARS · EARTH WAITED 124 with the rank NAVIGATOR
- **CHECK** `run.test.mjs`

#### Scenario: Two numbers mid-leg
- **WHEN** a leg is in flight at any of the three sizes
- **THEN** the only HUD numbers are speed and place
- **CHECK** `layout.e2e.mjs`

### Requirement: The result card
When a run ends the card SHALL show what happened, where (leg, percent home and the best run), one cause from the last 12 s and one goal for next time, the build as glyphs, the log pages earned and the next unlock, with AGAIN and Copy log. If a rival caused your last hit the card SHALL name it. Input SHALL unlock at 0.9 s; then a tap anywhere, Space or Enter SHALL be AGAIN, back to steering within 1.5 s, with tutorial captions skipped after the first run.

#### Scenario: Caught with no fuel
- **WHEN** a player is hit in the glare at Virgo with no fuel left
- **THEN** the card reads THE LIGHT CAUGHT YOU · VIRGO · LEG 3 OF 8 · 31 % HOME, "Hit in the glare with no fuel left" and NEXT TIME: FUEL SITS AT THE GAP EDGES
- **CHECK** `run.test.mjs`

#### Scenario: A rival's fault
- **WHEN** MAKO's takedown was the last hit at Orion
- **THEN** the card reads CAUGHT AT ORION AFTER MAKO'S TAKEDOWN · KEEP 2 CELLS
- **CHECK** `run.test.mjs`

#### Scenario: Again, fast, on every device
- **WHEN** a player taps the card at 390 × 844 or 844 × 390, or presses Space at 1440 × 900, after 0.9 s
- **THEN** a new run is steerable within 1.5 s
- **CHECK** `smoke.e2e.mjs`

### Requirement: Saves and resume
The run SHALL save at the start of every break under `ahead-of-the-light.run.v1`, never the course: a resume SHALL rebuild the leg from its seed. With storage blocked or throwing, the game SHALL play with the starter pool and LANTERN and say nothing. A version mismatch SHALL drop the run and keep the meta. A quit mid-leg SHALL resume at that leg's start with 2 s less gap; a page the phone reloaded after `pagehide` SHALL resume its mid-leg snapshot with no penalty.

#### Scenario: Resume at a break
- **WHEN** a run saved at any break is restored
- **THEN** its next leg builds with the same hash
- **CHECK** `save.test.mjs`

#### Scenario: Quitting a bad leg is not free
- **WHEN** a player quits mid-leg from the pause menu and resumes
- **THEN** the leg restarts from its launch with the gap 2 s lower: "the light kept coming"
- **CHECK** `save.test.mjs`

#### Scenario: The phone reloads a background tab
- **WHEN** a phone discards the hidden page mid-leg and the player comes back
- **THEN** the leg resumes from the snapshot saved on `pagehide`, with no gap lost
- **CHECK** `save.test.mjs`; on an iPhone in the user's playtest

#### Scenario: Blocked storage
- **WHEN** `localStorage` throws on every call
- **THEN** the game plays a whole run with LANTERN and the starter pool and shows no error
- **CHECK** `save.test.mjs` and `smoke.e2e.mjs`

### Requirement: The ship's log and unlocks
The title SHALL open a log of 84 pages in four tabs: PLACES (24: 8 gates and 16 lanes), CARDS (36), RIVALS (14) and ENDINGS (10). A page SHALL count once. Pages SHALL unlock REROLL +1 at 6, BANISH at 15, LUCKY STAR (1 offer in 5 shows a 4th card) at 25, REROLL +1 at 40, BANISH +1 at 55 and a gold frame on the cabinet at 84. The result card SHALL show what opened or the next unlock ("LOG +7 PAGES · 2 PAGES TO BANISH").

#### Scenario: Unlocks at their thresholds
- **WHEN** a player's log reaches 6, then 15 pages
- **THEN** the result card says REROLL +1 UNLOCKED, then BANISH, and the next run has 2 rerolls and 1 banish
- **CHECK** `meta.test.mjs`

#### Scenario: Pages count once
- **WHEN** a player is caught at Virgo twice
- **THEN** the ENDINGS page for Virgo counts once
- **CHECK** `meta.test.mjs`

### Requirement: Ships by feats
The hangar chip on the title ("SHIP: LANTERN ›") SHALL choose among ships that change how you drive, not how strong you are: LANTERN from the start; NEEDLE after a clean leg on leg 3 or later; TUG after 3 takedowns in one run; GHOST after getting home. A locked ship SHALL show its silhouette and its feat.

#### Scenario: Unlock NEEDLE
- **WHEN** a player finishes leg 3 with no hits
- **THEN** NEEDLE unlocks once: 2.5° wide, 700° a second, 2 hull, 1 of 3 fuel, starting with HAIR TRIGGER
- **CHECK** `meta.test.mjs`

#### Scenario: GHOST cannot dock
- **WHEN** a player flies GHOST to a gate
- **THEN** there is no DOCK line, and every offer rolls one rarity row up
- **CHECK** `run.test.mjs`

### Requirement: Modes and REDSHIFT
RUN SHALL always be open. EASY LIGHT (the light gains 25 % slower, unranked and marked) SHALL be offered on the result card after 3 runs caught on leg 1 or 2, never turned on by itself. DAILY ROUTE SHALL open after the first run, seeded by the cottage's day. PRACTICE SHALL fly one reached leg with LANTERN and no cards. REDSHIFT 1 to 6 SHALL open step by step after the first run home, each making the ship weaker, never the light faster.

#### Scenario: The daily route is fair
- **WHEN** two players fly the daily route on the same date with the same choices
- **THEN** their runs match, and on a different date they differ
- **CHECK** `meta.test.mjs`

#### Scenario: REDSHIFT step by step
- **WHEN** a player gets home at REDSHIFT 2
- **THEN** REDSHIFT 3, LATE LAUNCH (a thread launches at η 1.0, a dock at 0.6), opens, the title shows "REDSHIFT z 3", and the trail reddens a step
- **CHECK** `meta.test.mjs` and `survival.test.mjs`

#### Scenario: EASY LIGHT is offered, not forced
- **WHEN** a player is caught on leg 1 or 2 for the 3rd time
- **THEN** the result card offers EASY LIGHT as a toggle, and runs with it on are marked and unranked
- **CHECK** `meta.test.mjs`

### Requirement: Skill and choices decide the run
Across 200 bot runs per model, more skill SHALL mean fewer years and further legs, and the run's big choices SHALL change outcomes.

#### Scenario: Skill spread
- **WHEN** the bots play seeds 1 to 200
- **THEN** the expert's median years home is at most half the mid's, the mid's median furthest leg is at least 1.5 legs past the novice's, and the expert finishes first in at least 50 % of legs
- **CHECK** `sim.test.mjs`

#### Scenario: When to dock
- **WHEN** one mid bot docks at hull 2 and another at hull 1
- **THEN** the first ages at least 20 % more
- **CHECK** `sim.test.mjs`

#### Scenario: Greed in the red zone
- **WHEN** one mid bot enters the red zone only when TTC is under 12 s and another never does
- **THEN** the first leaves the glare more often
- **CHECK** `sim.test.mjs`
