## ADDED Requirements

### Requirement: Stage 1, The Journey
Stage 1 SHALL make the player a sperm cell that starts in the wide space of the womb with no anatomy labels, rides waves forward into a warm tube, swims against a gentle current, rests on a glowing wall until ready, and settles in a warm pocket on the tube wall. Steering SHALL be analog with the drag gesture. Speed SHALL never be scored. The current SHALL never push the cell behind the last checkpoint passed, and nothing SHALL fade to black.

#### Scenario: Portrait drag
- **GIVEN** stage 1 at 390 × 844 with touch
- **WHEN** the player drags up from a touch-down near the bottom of the screen
- **THEN** the sperm cell swims forward, which is up, and stays above 60% of the screen height
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Landscape drag
- **GIVEN** stage 1 at 844 × 390 with touch
- **WHEN** the player drags right with either thumb
- **THEN** the sperm cell swims forward, which is right
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Desktop keys
- **GIVEN** stage 1 at 1440 × 900
- **WHEN** the player steers with the arrows or WASD
- **THEN** the cell steers in 8 directions with smoothing, and no mouse is needed to finish the stage
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Rest to become ready
- **WHEN** the player lets go on a glowing wall so the cell stays there for 4 of the mother's beats
- **THEN** "Now you are ready." shows and the cell swims 1.4 times as fast for the rest of the stage
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

#### Scenario: One-button
- **GIVEN** one-button mode
- **WHEN** the player holds the button
- **THEN** the cell follows the warm lane by itself, rests on each glowing wall until ready, and settles in the pocket before the cap
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Stage 2, Ovulation
Stage 2 SHALL make the player the egg. A gold wave, the hormone surge, SHALL wash over the follicle on the mother's first two beats with no input. Then taps with her beat SHALL swell the follicle: the third tap graded Close or better opens it, or it opens by itself on beat 8. The stage SHALL take the same time for every input.

#### Scenario: The first payoff
- **WHEN** the player taps on beats 3, 4 and 5 in time
- **THEN** the follicle opens on the third tap, by 4.5 s into the stage
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: The surge comes first
- **WHEN** stage 2 starts
- **THEN** the gold surge plays on beats 1 and 2 with the prompt showing no gesture, and the first tap target is beat 3
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: Tap on any layout
- **WHEN** the player taps anywhere on a phone in portrait or landscape, or presses Space, Enter or Z on desktop
- **THEN** each press is judged at its touch-down time against the nearest beat
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: The ride and the call
In stage 2, cilia SHALL carry the egg whatever the input, and each tap on a beat SHALL add a visible surf. Every third beat of the ride SHALL be gold, and on-beat gold taps SHALL widen the trail that the waiting sperm follows to the egg.

#### Scenario: Gold beats shape the meeting
- **WHEN** a player taps all 8 gold beats In time and another player taps none
- **THEN** the first trail is 26 u wide and the second 8 u wide, and the sperm reaches the egg in both
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

### Requirement: Fertilization needs no input
Fertilization SHALL play for 6 s with input ignored: the corona parts, Izumo1 meets Juno, the shell changes, the other sperm drift away, and the two nuclei touch but stay apart. No push, drill or hold mechanic SHALL take the sperm into the egg.

#### Scenario: Fusion needs no input
- **WHEN** the meeting ends
- **THEN** fusion plays for 6 s with input ignored, and the prompt shows no gesture
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

#### Scenario: The steps of fusion
- **WHEN** fusion plays
- **THEN** captions name, in order, the parting cells, Izumo1 meeting Juno, the shell changing, and the two nuclei touching but staying apart
- **CHECK** `qa/first-breath/stage-egg.test.mjs`

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

### Requirement: Other sperm only rest
In stage 1 the other sperm SHALL only rest, still, on the tube walls. They SHALL never move toward the pocket, sit past 2,800 u, block or touch the player's cell, and nothing SHALL be killed. Moving rivals and the fork with the cool tube are not part of this change.

#### Scenario: Other sperm over many seeds
- **WHEN** stage 1 runs for 20 seeds with the reference bot and with no input
- **THEN** every other sperm stays at its seeded wall spot, none sits past 2,800 u, and the player's speed never changes from passing one
- **CHECK** `qa/first-breath/stage-swim.test.mjs`

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
