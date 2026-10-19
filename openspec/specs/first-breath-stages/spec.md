# first-breath-stages Specification

## Purpose
What each of the eight First Breath stages and the ending asks of the player, how each one always completes, and the facts each one shows.

## Requirements

### Requirement: Every caption fact shows whole
In real time, every caption fact a stage or the ending sends SHALL show whole before the stage ends: each of its pages, for its reading time in all. A stage SHALL send a caption fact only where its quiet moments leave room for it after its lines.

#### Scenario: Every stage in real time
- **WHEN** each stage and the ending play in real time, in practice and in a whole run, with the reference bot and with the mid bot, in portrait (390 × 844), landscape (844 × 390) and desktop
- **THEN** every caption fact the stage sends shows whole before the stage ends: each page on screen, for 1.5 s and 55 ms a letter in all, its label included (2.4 s a one-line page in stage 1 in portrait)
- **AND** every caption fact of the stage is sent
- **CHECK** `qa/first-breath/pacing.test.mjs`

### Requirement: A fact with no room is kept
A fact a stage has no room to show whole SHALL NOT be dropped: it SHALL be a "What was real" fact, listed on the run result with that stage's facts, with its label and its source.

#### Scenario: No room in the stage
- **WHEN** a whole run reaches the run result
- **THEN** "What was real" lists, with each stage's facts, the facts that stage had no room to show whole, each once with its label and link
- **CHECK** `qa/first-breath/facts.test.mjs`

### Requirement: Stage 1, The Race
Stage 1 SHALL make the player one sperm cell racing 19 rivals along a course: the wide womb with waves that speed a sperm swimming with them, a narrow gate, a fork where the egg's side glows warm and the cool side loops back to the fork within a few seconds, then a tube with a gentle current, a warm lane that is clearly faster than the walls, and glow walls, to the meeting place. Steering SHALL be analog with the drag gesture.

#### Scenario: Portrait drag
- **GIVEN** stage 1 at 390 × 844 with touch
- **WHEN** the player drags up from a touch-down near the bottom of the screen
- **THEN** the sperm cell swims forward, which is up, and stays above 60% of the screen height
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Landscape drag
- **GIVEN** stage 1 at 844 × 390 with touch
- **WHEN** the player drags right with either thumb
- **THEN** the sperm cell swims forward, which is right
- **AND** the place slot changes as the cell passes rivals
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Desktop keys
- **GIVEN** stage 1 at 1440 × 900
- **WHEN** the player steers with the arrows or WASD
- **THEN** the cell steers in 8 directions with smoothing, and no mouse is needed to finish the race
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Desktop mouse drag
- **GIVEN** stage 1 at 1440 × 900
- **WHEN** the player holds the left mouse button and drags to the right of the press point
- **THEN** the drag acts as the floating stick and the cell swims forward, which is right
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Ride a wave
- **WHEN** the player swims forward inside a wave's window in the womb
- **THEN** the cell's speed blends up to the wave's 140 u/s
- **AND** a sperm that does not swim is not lifted by the wave
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: The cool tube loops back
- **WHEN** the player takes the cool tube at the fork, or lets go inside it
- **THEN** "This way is cool. It leads back." shows, and the cell is back at the fork within 6 s, also with no input
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: The warm lane is faster
- **WHEN** a sperm swims at full stick in the tube, once in the warm lane and once along a wall
- **THEN** it moves forward at 70 u/s or more in the lane and at 65 u/s or less along the wall
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: One-button race
- **GIVEN** one-button mode
- **WHEN** the player holds the button
- **THEN** the cell rides the waves, takes the warm tube, rests on the first glow wall and reaches the meeting place in the top 3 before the cap
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The fork in view
- **GIVEN** stage 1 at 390 × 844, 844 × 390 and 1440 × 900
- **WHEN** the cell nears the fork
- **THEN** both branch mouths are on screen, under no HUD or prompt, at least 1.5 s before the cell reaches the split
- **CHECK** `qa/first-breath/layout.e2e.mjs`

### Requirement: Rest on a glow to get ready
A sperm that lets go inside a glow on the tube wall SHALL hold to the wall and become ready on the mother's 4th beat, which multiplies its own swim speed by 1.6 to the finish. The current SHALL never push a sperm behind the last checkpoint it passed, and nothing SHALL fade to black.

#### Scenario: Rest to become ready
- **WHEN** the player lets go inside a glow on the wall
- **THEN** the cell holds to the wall with no drift, and on the mother's 4th beat "Now you are ready." shows and its own swim speed is 1.6 times as fast to the finish
- **AND** a new drag past a quarter of the stick lets it go
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

### Requirement: The place in the HUD
In stage 1 the HUD SHALL show the player's place among the 20 sperm, such as "3rd of 20", ranked by progress along the course. The shown place SHALL change only after a new place has held for 0.25 s.

#### Scenario: The place changes
- **WHEN** a rival passes the player in the tube and stays ahead
- **THEN** a `place` event moves the slot from "3rd of 20" to "4th of 20" within 0.3 s, once the new place has held for 0.25 s
- **CHECK** `qa/first-breath/stage-swim.test.mjs`, `qa/first-breath/layout.e2e.mjs`

### Requirement: The top-3 goal
Stage 1's goal SHALL be to reach the meeting place in the top 3 before the 117 s cap; there the game SHALL show "Wait here. The egg is coming." With the wait at the meeting place, or the 3 s carry after Go on at the cap, stage 1 SHALL never run past 120 s. The score SHALL count the place, wave riding, the warm lane and becoming ready, with 1st place as the Flourish.

#### Scenario: A mid player
- **WHEN** the skill 0.7 bot races 20 seeds
- **THEN** it reaches the meeting place in the top 3 in at least 18 of them, arriving 55 to 65 s into the stage on average
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: First place
- **WHEN** the reference bot races 20 seeds
- **THEN** it is 1st in at least 18 of them, arriving 44 to 54 s into the stage, and earns the Flourish
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: An idle player
- **WHEN** the player touches nothing in stage 1
- **THEN** the cell never passes the gate, every rival passes it, and the stage ends at 117 s without its goal, in 20th place
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

### Requirement: Rivals race, and nobody is harmed
The 19 rivals SHALL move by a seeded policy with a spread of skill: they ride waves, sometimes take the cool tube, and jostle; only the two front-runners rest on a glow and become ready. Contact SHALL be a soft bump between two circles that pushes them apart and costs speed for a moment. Rivals far behind SHALL slow and rest on the walls. A mild catch-up SHALL keep the race close under the same rules for every sperm. Nothing SHALL be killed, and the course SHALL have no hazards.

#### Scenario: The same race for the same seed
- **WHEN** stage 1 runs twice in node with the same seed and the same input
- **THEN** every rival is at the same spot at every step, and the places are equal
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: A soft bump
- **WHEN** two swimming sperm touch
- **THEN** they are pushed apart, each keeps 0.7 of its speed, and each is back to its full top speed 0.6 s later
- **AND** a sperm resting on the wall is passed over, never bumped
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: Falling behind
- **WHEN** a rival in the tube is 500 u or more behind the player
- **THEN** it slows and rests on the nearest wall, and it still counts behind the player in the place
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

### Requirement: Stage 2, The Egg: the opening
Stage 2 SHALL switch the view to the egg, with "Now you are the egg." on its card, or as its first caption when there is no card. A gold wave, the hormone surge, SHALL wash over the follicle on the mother's first two beats with no input. Taps with her beat SHALL then burst the follicle: the third tap graded Close or better bursts it, or it bursts by itself on beat 8. The fimbriae SHALL then sweep the egg into the tube. The opening SHALL end within 9 s.

#### Scenario: The first payoff
- **WHEN** the player taps on beats 3, 4 and 5 in time
- **THEN** the follicle bursts on the third tap, by 4.5 s into the stage
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: The surge comes first
- **WHEN** stage 2 starts
- **THEN** the gold surge plays on beats 1 and 2 with the prompt showing no gesture, and the first tap target is beat 3
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: Tap on any layout
- **WHEN** the player taps anywhere on a phone in portrait or landscape, or presses Space, Enter or Z on desktop
- **THEN** each press is judged at its touch-down time against the nearest beat
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: A short opening
- **WHEN** the player does nothing in the opening
- **THEN** the follicle bursts by itself on beat 8 with "It opens anyway.", and the guard starts by 8.9 s
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Guard your shell
In stage 2's guard, waves of sperm SHALL swim toward the egg's shell from all sides, building over about 35 to 40 s. A glowing arc SHALL follow one drag round the shell. A swimming rival under the arc SHALL bounce away. A rival that reaches an open part of the shell SHALL stick and burrow, with a progress ring, and the arc over it SHALL pop it loose. A rival that finishes burrowing SHALL be held, still, in the egg's cloud and SHALL never enter.

#### Scenario: Guard in portrait
- **GIVEN** the guard at 390 × 844 with touch
- **WHEN** the player touches down near the bottom of the screen and drags toward the upper left
- **THEN** the arc turns to the upper left of the shell, within 10° of the drag's angle, and the egg stays above 60% of the screen height
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Guard in landscape
- **GIVEN** the guard at 844 × 390 with touch
- **WHEN** the player drags right with either thumb
- **THEN** the arc moves to the right side of the shell
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Guard on desktop
- **GIVEN** the guard at 1440 × 900
- **WHEN** the mouse moves above the egg with no button down, then the right arrow is held, then released with the cursor still over the page
- **THEN** the arc first faces the pointer, then turns clockwise as seen, then stays where the arrow left it
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Pop a stuck sperm loose
- **WHEN** a sperm sticks to the shell and the player moves the arc over it before 4.0 s pass
- **THEN** it comes loose and drifts off, and it counts half in the guard credit
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: A held rival never enters
- **WHEN** a rival finishes burrowing
- **THEN** it is held, still, in the cloud, the guard goes on, and it never enters
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: One-button guard
- **GIVEN** one-button mode in the guard
- **WHEN** the player holds the button, and then lets go
- **THEN** while held the arc turns to the nearest rival that is not gold, the one that will reach the arc's reach soonest, and after the release it stays still
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The arc bot keeps off the gold sperm
- **WHEN** the reference bot guards over 20 seeds
- **THEN** it never nudges the player's gold sperm
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: The arc over a sperm
The arc SHALL be over a sperm when the angle between them is within the arc's half-width and the sperm's head is within 22 u of the egg's centre, checked every step, whether the sperm moves under the arc or the arc sweeps onto it. A swimming rival under it SHALL bounce, a stuck rival SHALL pop loose, the gold sperm SHALL be nudged, and held and drifting sperm SHALL ignore it.

#### Scenario: The arc sweeps onto a sperm
- **WHEN** the arc turns onto a swimming rival within 22 u, onto a stuck rival, and onto a held rival
- **THEN** the swimming rival bounces away, the stuck one pops loose and drifts off, and the held one stays where it is
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Only your sperm enters
The player's sperm from stage 1 SHALL come to the egg in gold, with "Let it in." The arc SHALL only nudge it back, at most 3 times, and it SHALL always return, burrow and enter by itself. Exactly one sperm SHALL enter in stage 2: the player's. No input SHALL take it into the egg. As it comes in and works its way through the shell, a caption SHALL say that Izumo1 meets Juno, and it SHALL be done by the time the sperm enters.

#### Scenario: It always gets in
- **WHEN** the player holds the arc on the gold sperm the whole time
- **THEN** it is nudged back 3 times, slips under the arc and enters by 52 s into the guard
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: Exactly one enters
- **WHEN** stage 2 runs over 20 seeds with no input, with the reference bot and with random drags
- **THEN** every run has exactly one `enter` event, and it is the gold sperm's
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: The gold sperm's way in
The gold sperm SHALL come in 27 s into the guard after 1st place, and 0.3 s later for each place lower. Its seeded angle SHALL always exist and SHALL keep clear of the arc, of the thumb side and of the portrait caption band.

#### Scenario: Earlier when placed higher
- **WHEN** stage 2 runs with a stage 1 place of 1, 3 and 20
- **THEN** the gold sperm comes in at 27.0, 27.6 and 32.7 s into the guard
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: A place to come in from
- **WHEN** stage 2 runs over 20 seeds with no input, and with the arc parked at each of 72 angles
- **THEN** the gold sperm always finds an angle, at least the arc's half-width plus 30° from it, never from straight below or under the portrait caption band
- **CHECK** `qa/first-breath/stage-egg.test.mjs`, `qa/first-breath/layout.e2e.mjs`

### Requirement: Seal your shell
When the player's sperm has entered, stage 2 SHALL ask "Seal your shell. Hold, then let go." with a release target on the mother's 3rd beat, counted from her first beat at least 0.6 s after the prompt. The release SHALL send a shimmering wave round the shell from the entry point, push the other sperm away and harden the shell. An In time release SHALL earn a Flourish of 1,000, and a Close one 500. With no release by her 6th counted beat, the shell SHALL seal by itself with no Flourish.

#### Scenario: Seal on a phone
- **GIVEN** the seal at 390 × 844
- **WHEN** the player holds and lets go on the glowing beat
- **THEN** the release is In time, the wave runs round the shell from the entry point, and the other sperm drift off
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: Seal in landscape
- **GIVEN** the seal at 844 × 390 with touch
- **WHEN** the player presses with either thumb and lets go on the glowing beat
- **THEN** the release is graded In time and the shell seals
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Seal with Space
- **GIVEN** the seal at 1440 × 900
- **WHEN** the player holds Space and lets go on the glow
- **THEN** the release is graded and the shell seals
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: No input at the seal
- **WHEN** the player does nothing at the seal
- **THEN** "Your shell seals itself." shows on her 6th counted beat, no Flourish is given, and fusion follows
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: A fresh press seals the shell
Only a press made after the seal prompt SHALL count toward the seal. A thumb or button still down from the guard SHALL have to lift and press again, and lifting it SHALL do nothing. A hold still down at her 6th counted beat SHALL seal by itself with no Flourish.

#### Scenario: A thumb still down from the guard
- **GIVEN** the guard at 390 × 844 with the thumb still down from its drag when the seal prompt shows, and one-button mode at 1440 × 900 with Space still held from the guard
- **WHEN** the player lifts the thumb, or lets go of Space, right after the prompt
- **THEN** nothing seals, and a new press and release seals the shell and is graded
- **CHECK** `qa/first-breath/input.e2e.mjs`, `qa/first-breath/stage-egg.test.mjs`

### Requirement: Fertilization needs no input
After the seal, fusion SHALL play for 5 s with input ignored: the egg takes in the sperm's contents, and the two nuclei draw close and touch but stay apart. No push, drill or hold mechanic SHALL take the sperm into the egg.

#### Scenario: Fusion needs no input
- **WHEN** the seal ends
- **THEN** fusion plays for 5 s with input ignored, and the prompt shows no gesture
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Stage 2 captions keep the real order
Captions SHALL keep the real order: Izumo1 meets Juno as the sperm comes in and enters, and after the seal no other sperm can get through. The stage has no room to show more facts whole, so the wave, the shell changing and the nuclei touching but staying apart SHALL be listed in "What was real" with the stage 2 facts.

#### Scenario: The steps in order
- **WHEN** stage 2 runs in real time from the gold sperm coming in to the end of the stage, with the reference bot or the mid bot, in portrait, landscape or desktop
- **THEN** captions name, in order, Izumo1 meeting Juno, shown whole before the sperm enters, and no other sperm getting through, shown whole after "Your shell seals." and before the stage ends
- **AND** each caption's label matches the HUD clock, "Week 2"
- **AND** the run result's "What was real" lists the wave, the shell changing, and the two nuclei touching but staying apart with the stage 2 facts
- **CHECK** `qa/first-breath/stage-egg.test.mjs`, `qa/first-breath/pacing.test.mjs`, `qa/first-breath/facts.test.mjs`

### Requirement: Stage 3, The Embryo: first cells
Stage 3 SHALL be named "The Embryo: first cells". It SHALL show the cell splitting into 2, 4, 8 and 16 cells on Days 1 to 4 after fertilization, each split on schedule, while the ball keeps its size. An approach ring SHALL close over 2 beats before each of the 12 tap targets. The hollow SHALL fill and the embryo SHALL hatch with hold-and-release targets released at a marked glow. No mash input SHALL be used.

#### Scenario: Splits on schedule
- **WHEN** the player taps nothing during the four days
- **THEN** each split still plays on beat 6 of its day, with no sparkle
- **CHECK** `qa/first-breath/stage-split.test.mjs`

#### Scenario: Hold and let go on a phone
- **GIVEN** the Bloom prompt "Hold. Let go at the glow." at 390 × 844
- **WHEN** the player holds and lets go on the glowing beat
- **THEN** the release is graded In time and the hollow fills
- **CHECK** `qa/first-breath/stage-split.test.mjs`

#### Scenario: Hold with Space
- **GIVEN** the Hatch prompt at 1440 × 900
- **WHEN** the player holds Space and lets go on the glow
- **THEN** the embryo slips out of its shell and the release is graded
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Stage 4, The Placenta
Stage 4 SHALL let the player drift to any of 3 soft spots to nestle (the nearest spot draws the embryo in after 8 s idle), then steer the growing tip of the root tree to 8 gland pools that swell on the mother's beat. The tree SHALL link one more pool by itself every 3.5 s from 12 s into the roots, so all 8 link by 40 s. No nutrient count, drain or fail clock SHALL exist.

#### Scenario: Steer roots on a phone
- **GIVEN** the roots at 390 × 844
- **WHEN** the player drags toward a pool and enters it on the mother's beat
- **THEN** the pool links, a glow runs back along the roots, and the link counts as on-beat
- **CHECK** `qa/first-breath/stage-root.test.mjs`

#### Scenario: Grow roots in landscape
- **GIVEN** the roots at 844 × 390 with touch
- **WHEN** the player drags right
- **THEN** the tip grows forward, which is right in landscape
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Idle roots
- **WHEN** the player touches nothing during the roots
- **THEN** every pool links by itself by 40 s with "The roots reach it anyway." for each
- **CHECK** `qa/first-breath/stage-root.test.mjs`

#### Scenario: Gland pools first
- **WHEN** stage 4 is drawn at any moment
- **THEN** the pools are milk-white with dotted rims and none is red
- **CHECK** `qa/first-breath/stage-root.test.mjs`

### Requirement: The first heartbeat
On Day 22 after fertilization the world SHALL hush for 1.5 s and the embryo's own heart SHALL start beating by itself at 110 bpm. The game SHALL show the label "Day 22 after fertilization (week 5)" with "Your heart beats for the first time.", and then "This beat is yours. Tap with it." with 8 tap targets on the new beat. After them both hearts SHALL play together.

#### Scenario: The hinge
- **WHEN** the hinge starts
- **THEN** the mother's heart drops 8 dB for 1.5 s, a quick pulse glows in the embryo's chest, and both hearts play after the 8 targets
- **CHECK** `qa/first-breath/stage-root.test.mjs`

#### Scenario: The heart beats without taps
- **WHEN** the player taps none of the 8 targets
- **THEN** the heart still beats at 110 bpm and the stage goes on
- **CHECK** `qa/first-breath/stage-root.test.mjs`

### Requirement: The embryo grows
After the first heartbeat, stage 4 SHALL end with a 7 s grow moment that needs no input, from Day 22 after fertilization to week 7. In it the embryo's buds SHALL grow from about 2 mm to 10 mm, the camera SHALL pull back, the root tree SHALL thicken into a disc with "This will become your placenta.", and a week 6 fact SHALL name the buds that will become arms and legs.

#### Scenario: The body takes shape
- **WHEN** the grow moment plays with no input
- **THEN** the figure grows from 2 mm to 10 mm, the week 6 buds fact shows, and the clock reaches week 7 as the stage ends
- **CHECK** `qa/first-breath/stage-root.test.mjs`

### Requirement: Stage 5, First Trimester
Stage 5 SHALL run weeks 7 to 13 as one phrase per week of tap targets on the player's own heartbeat, as lights reach the heart along the cord. In weeks 8 to 13 each phrase SHALL be followed by one drag move toward a glow (uncurl at week 8, an arm stretch at 9, a startle at 10, a kick with fists at 11, a kick at 12, thumb to mouth at 13) that plays by itself after 3 s.

#### Scenario: Tap with your heart
- **WHEN** a light reaches the heart and the player taps within 70 ms
- **THEN** the tap is In time, the light enters brightly, and a soft bell plays
- **CHECK** `qa/first-breath/stage-grow.test.mjs`

#### Scenario: Drag to stretch on desktop
- **GIVEN** a move glow to the left at 1440 × 900
- **WHEN** the player holds the left arrow for 0.5 s
- **THEN** the arm stretches and the move counts as done by the player
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: A move in landscape
- **GIVEN** a move glow above the baby at 844 × 390 with touch
- **WHEN** the player drags up toward it past half deflection for 0.5 s
- **THEN** the move plays and counts as done by the player
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Moves by themselves
- **WHEN** the player does nothing at a move
- **THEN** the move plays by itself after 3 s and the next phrase starts
- **CHECK** `qa/first-breath/stage-grow.test.mjs`

#### Scenario: The fetus line
- **WHEN** the clock reaches week 10
- **THEN** the caption shows the label "Week 10" and "From about now you are called a fetus. Sources differ, from week 8 to week 10."
- **CHECK** `qa/first-breath/facts.test.mjs`

### Requirement: Your heart sets the peak tempo
In stage 5 the player's heart SHALL follow the curve from 130 bpm at week 7 to 170 bpm at weeks 9 to 10 and about 155 bpm at week 13. Targets SHALL fall on its beats with gaps of 2 to 4 beats, at least 0.5 s apart, and lights SHALL enter the cord at least 2 targets and 1.6 s ahead. The timing windows SHALL be no tighter than in the stages before and after.

#### Scenario: The peak
- **WHEN** the clock is at week 9 or 10
- **THEN** the heart beats at 170 bpm and targets come 0.706 s or more apart
- **CHECK** `qa/first-breath/stage-grow.test.mjs`

#### Scenario: Windows stay fair
- **WHEN** the In time windows of stages 4, 5 and 6 are compared
- **THEN** stage 5's narrowest window is no narrower than ±60 ms, the floor shared by every stage
- **CHECK** `qa/first-breath/judge.test.mjs`

### Requirement: The placenta fills with blood near week 12
Before week 12 every pool around the roots SHALL be milk-white with a dotted rim. From week 12 the pools SHALL turn red, with wavy rims, and pulse with the mother's heart, with the captions "Near week 12, more of {carer}'s blood flows into the placenta." and "Your blood and {carer}'s blood never touch."

#### Scenario: Red from week 12
- **WHEN** stage 5 passes gaDay 84
- **THEN** the pools turn red with wavy rims and both captions show, and before gaDay 84 no pool is red
- **CHECK** `qa/first-breath/stage-grow.test.mjs`

### Requirement: Stage 6, Second Trimester
Stage 6 SHALL turn the mother's heartbeat from felt to heard at week 15 and ask for 8 taps with it in weeks 15 to 18. From week 19 it SHALL play 6 hummed phrases at 78 bpm with one note slot per beat, each followed by a 4-beat answer. No phrase SHALL start before week 19. Each hummed note SHALL show as a ripple and each answer note as a ghost ripple. The eyes SHALL open by themselves at week 26.

#### Scenario: Phrases start at week 19
- **WHEN** stage 6 runs with any input
- **THEN** no phrase starts before gaDay 133, and the first phrase opens with "In one study, the first response to sound was to a low tone."
- **CHECK** `qa/first-breath/stage-answer.test.mjs`

#### Scenario: Stage 6 facts read between the hum lines
- **WHEN** stage 6 runs in real time with the reference bot or the mid bot, in portrait, landscape or desktop
- **THEN** "Week 16: {Carer} may first feel you move between about week 16 and week 24." shows as the clock reaches week 16 in the beat moment, and it and the facts that open phrases 1, 2 and 4 each show whole, coming back after each hum line and "{Carer} feels you." until they have had their reading time
- **AND** "By week 21, you can hear voices outside the womb." and "You can get hiccups by about week 19." are listed in "What was real"
- **CHECK** `qa/first-breath/pacing.test.mjs`, `qa/first-breath/stage-answer.test.mjs`

#### Scenario: Sound off
- **GIVEN** the sound muted
- **WHEN** a phrase is hummed
- **THEN** each note shows as a gold ripple with a caption, and each answer slot has a ghost ripple and a DOM ring in `svg#rings` at least its preview time before it
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Answers bring a warm reply
A phrase answered with at least 75% of its notes Close or better SHALL bring "{Carer} feels you." with the carer word, and from phrase 2 a warm hand glow on the wall. A phrase under 75% SHALL lead on to the next phrase on time, and the voice SHALL never stop as a result of a miss. The answered notes SHALL be lit in the song carried to stage 7 and the ending.

#### Scenario: Answer a phrase
- **WHEN** the mother hums `xx.x` in phrase 3 and the player taps the same pattern in the answer bar
- **THEN** the phrase matches, the hand glow presses on the wall, and the notes are lit in the song
- **CHECK** `qa/first-breath/stage-answer.test.mjs`

#### Scenario: A missed phrase
- **WHEN** the player taps nothing in an answer bar
- **THEN** the next phrase is hummed on time, the stage goes on, and those notes stay unlit in the song
- **CHECK** `qa/first-breath/stage-answer.test.mjs`

### Requirement: Stage 7, Third Trimester
Stage 7 SHALL ask for 4 practice breaths (press on beat 1, let go on beat 5), then a turn head-down with the drag's sideways offset, which is fast only in roomy moments (2.5 s every 6.0 s) on the mother's out-breath. If the turn is not done 30 s into the turn, the baby SHALL turn by itself with "Most babies turn head-down by 36 to 37 weeks. You turn now." Weeks 37 to 40 SHALL be an unscored rest with "Rest. Keep your thumb on the screen." while the song is hummed.

#### Scenario: A missed breath
- **WHEN** the player does not press on beat 1 of a breath
- **THEN** the ring still grows and shrinks by itself, the breath earns nothing, and no sound marks the miss
- **CHECK** `qa/first-breath/stage-turn.test.mjs`

#### Scenario: Turn in a roomy moment
- **GIVEN** the turn at 390 × 844
- **WHEN** the player drags sideways during a roomy moment
- **THEN** the baby turns at up to 60° a second, and at 15° a second outside a roomy moment
- **CHECK** `qa/first-breath/stage-turn.test.mjs`

#### Scenario: Turn in landscape
- **GIVEN** the turn at 844 × 390 with touch
- **WHEN** the player drags sideways with either thumb in a roomy moment
- **THEN** the baby turns at up to 60° a second
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Turn with keys
- **GIVEN** the turn at 1440 × 900
- **WHEN** the player holds the left or right arrow in roomy moments
- **THEN** the baby turns head-down before the 30 s limit
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The rest
- **WHEN** the rest starts
- **THEN** nothing is judged, the score does not change, and the stage ends after 16 s with "Week 40. You are ready."
- **CHECK** `qa/first-breath/stage-turn.test.mjs`

### Requirement: Stage 8, Birth
Stage 8 SHALL play 8 contraction waves, one every 8.0 s, each moving the baby one eighth of the way by itself. Plain waves SHALL ask the player to hold through the wave. The opening SHALL be drawn only as light, as a full-width glow at the bottom of the screen. After wave 8 the light SHALL rise to white over 3.5 s.

#### Scenario: Nothing held
- **WHEN** the player holds nothing during the waves
- **THEN** "Rest. Another wave will come." shows, each wave still moves the baby on, and the light comes after wave 8
- **CHECK** `qa/first-breath/stage-birth.test.mjs`

#### Scenario: The light
- **WHEN** wave 8 ends
- **THEN** the draw list's only light is a full-width mark at the bottom, and its exposure rises to 6 and its white to 1 within 3.5 s
- **CHECK** `qa/first-breath/stage-birth.test.mjs`

### Requirement: The prompted moves of birth
Waves 2, 4, 6 and 8 SHALL ask for Tuck (drag down and hold), Turn (drag sideways and hold), Lift (drag up and hold) and Turn back (drag the other way and hold), on screen axes in every layout. Each move SHALL play on its wave either way.

#### Scenario: Drag and hold on a phone
- **GIVEN** the Tuck wave at 390 × 844
- **WHEN** the player presses, drags down past 12 px and keeps holding through the swell
- **THEN** the overlap in the right direction is near 1 and the chin tucks
- **CHECK** `qa/first-breath/stage-birth.test.mjs`

#### Scenario: Drag and hold in landscape
- **GIVEN** the Turn wave at 844 × 390 with touch
- **WHEN** the player presses, drags right past 12 px and keeps holding
- **THEN** the direction reads right on the screen axis, and the move counts as matched
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Hold the arrow on desktop
- **GIVEN** the Lift wave at 1440 × 900
- **WHEN** the player holds the up arrow through the swell
- **THEN** the keydown counts as a press with the direction up, and the move counts as matched
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: One-button birth
- **GIVEN** one-button mode
- **WHEN** the player holds the button through every wave
- **THEN** every move counts in the right direction and the birth completes
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Every sub-goal is shown and confirmed
Each sub-goal SHALL show its prompt and caption when it starts, and SHALL be confirmed when the player does it ("Now you are ready.") or when it happens by itself ("The roots reach it anyway."). No sub-goal SHALL pass with no message.

#### Scenario: Sub-goals end confirmed
- **WHEN** any stage runs to its end with the reference bot or with no input
- **THEN** every sub-goal it showed ends as `done` or `auto`, each with a shown message
- **CHECK** `qa/first-breath/stage-<id>.test.mjs`

### Requirement: A miss only adds less
A missed or late input SHALL never reset progress, stall development or take points away. It SHALL only earn less, and an Off press SHALL show only a faint dotted ring.

#### Scenario: Off taps in stage 3
- **WHEN** the player taps 300 ms early on every split target
- **THEN** each split still happens, no count resets, and only a faint dotted ring shows
- **CHECK** `qa/first-breath/stage-split.test.mjs`

### Requirement: Stages play the same for the same seed
Every stage SHALL give the same result for the same seed, carry, options and input, in node and in the browser, and SHALL use no clock, DOM or unseeded random number. Every stage SHALL list its moments with their gaDay spans, so the clock is set the same way in every stage.

#### Scenario: Determinism
- **WHEN** a stage runs twice in node with the same seed and scripted input
- **THEN** both results, events and scores are equal
- **CHECK** `qa/first-breath/stage-<id>.test.mjs`, `qa/first-breath/purity.test.mjs`

#### Scenario: Moments on the clock
- **WHEN** a stage's meta is read
- **THEN** each moment has the gaDay span of the design's moment table, and the stage's gaDay follows it as the moment runs
- **CHECK** `qa/first-breath/stage-<id>.test.mjs`
