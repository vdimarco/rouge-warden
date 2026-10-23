# first-breath-journey Specification

## Purpose
The run through First Breath from the title to the result: the eight stages and the ending in order, pause and resume, practice, the score and the save.

## Requirements

### Requirement: Play starts the first stage at once
The title SHALL start the audio and stage 1 (The Race) in the same tap, click or key press on Play (`#play`), with no card or screen between them. The prompt "Drag to swim." SHALL show by 0.5 s after Play, and steering SHALL respond by 0.5 s.

#### Scenario: Phone portrait
- **GIVEN** the title at 390 × 844 with touch
- **WHEN** the player taps Play
- **THEN** stage 1 is on screen at once and the prompt names the drag gesture by 0.5 s
- **AND** a drag anywhere on the screen turns the sperm cell within 0.5 s of Play
- **CHECK** `qa/first-breath/smoke.e2e.mjs`

#### Scenario: Phone landscape
- **GIVEN** the title at 844 × 390 with touch
- **WHEN** the player taps Play and drags with either thumb
- **THEN** the sperm cell swims toward the right of the screen, which is forward in landscape
- **CHECK** `qa/first-breath/smoke.e2e.mjs`

#### Scenario: Desktop keys
- **GIVEN** the title at 1440 × 900
- **WHEN** the player presses Enter or Space on Play, then holds the right arrow
- **THEN** stage 1 starts and the sperm cell swims forward with no mouse use
- **CHECK** `qa/first-breath/smoke.e2e.mjs`

### Requirement: The stages come in the user's order
A run SHALL play The Race, The Egg, The Embryo: first cells, The Placenta, First Trimester, Second Trimester, Third Trimester and Birth, in that order, and then the ending. No stage SHALL be skipped in a run.

#### Scenario: A whole run
- **WHEN** the bot plays a whole run with any seed
- **THEN** the stage ids come as `swim`, `egg`, `split`, `root`, `grow`, `answer`, `turn`, `birth`, then `ending`
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: The sperm comes before ovulation
- **WHEN** a player starts a new run
- **THEN** the first stage shows the player as a sperm cell, and the egg is released only in stage 2
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: One clock labels every moment
Every clock label SHALL come from one label function on gaDay, where gaDay 0 is the first day of the last period and fertilization is gaDay 14. Before fertilization the label SHALL read "Week N". After fertilization and before gaDay 42 it SHALL read "Day N after fertilization (week M)". From gaDay 42 it SHALL read "Week N". No label SHALL use a cycle day. Each moment of each stage SHALL have a gaDay span, and gaDay SHALL follow the moment's progress, so the clock never runs back in a run.

#### Scenario: The first heartbeat
- **WHEN** the hinge in stage 4 starts
- **THEN** the HUD reads "Day 22 after fertilization (week 5)"
- **CHECK** `qa/first-breath/clock.test.mjs`

#### Scenario: Before and after fusion
- **WHEN** stage 2 runs to the end of fusion
- **THEN** the HUD reads "Week 2" until the nuclei touch, then "Day 0 after fertilization (week 2)"
- **CHECK** `qa/first-breath/clock.test.mjs`

#### Scenario: The week rule
- **WHEN** the label function is called for Day N after fertilization, N from 0 to 27
- **THEN** the week in brackets is floor((14 + N) / 7) every time
- **CHECK** `qa/first-breath/clock.test.mjs`

#### Scenario: The clock never runs back
- **WHEN** whole runs are played in node with the reference bot and with no input
- **THEN** gaDay and the real span of the short axis never decrease from one step to the next, and only a stage 1 Try again restarts stage 1
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: Settings explain the weeks
- **WHEN** the player opens Settings
- **THEN** the line "Weeks count from the first day of the last period. Midwives and doctors count this way." shows
- **CHECK** `qa/first-breath/layout.e2e.mjs`

### Requirement: One heartbeat through the whole run
The mother's heartbeat SHALL play from Play to the run result, through stage-end overlays, the Almost card and stage cards, with no jump in its timing at a stage start. Each stage SHALL start her beats at the phase the run hands it. Only pause SHALL stop it, and the first 1.5 s of the ending SHALL be its one silence.

#### Scenario: Across the stages
- **WHEN** a whole run is played in node
- **THEN** her beat times have no gap and no jump at any overlay, card or stage start beyond the rate glide, apart from the first 1.5 s of the ending
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: Stage cards come during the crossfade
Between stages the game SHALL crossfade from the old scene to the new stage for 0.8 s, and SHALL show the next stage's card over it. The card SHALL show the stage number and name, a one-word verb with a gesture icon, the clock label, the size and one fact, and on the three trimester stages a border line with "about". It SHALL ignore input for its first 1.0 s, SHALL be skippable after that, and SHALL go by itself at 3.5 s. Stage 1 SHALL have no card.

#### Scenario: Skip a card on a phone
- **GIVEN** the card for The Placenta at 390 × 844
- **WHEN** the player taps at 0.5 s and again at 1.2 s
- **THEN** the first tap does nothing and the second starts the stage
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Skip a card on desktop
- **GIVEN** a stage card at 1440 × 900
- **WHEN** the player presses Enter after 1.0 s
- **THEN** the next stage starts
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: A card left alone
- **WHEN** nobody touches anything during a card
- **THEN** the stage starts 3.5 s after the card appears
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: Each stage ends with a short in-world overlay
After each of stages 1 to 7, the game SHALL show an overlay inside the scene with the grade word, the stage total and one fact. The overlay SHALL continue by itself after 2.5 s. A tap SHALL hold it until a second tap or Next. After Birth the game SHALL show no overlay and no points.

#### Scenario: The overlay goes on by itself
- **WHEN** stage 3 ends and the player does nothing
- **THEN** the overlay shows a grade word such as "Great", the total, and one fact, and the crossfade starts 2.5 s later
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: Linger
- **WHEN** the player taps during the overlay
- **THEN** the overlay stays until the player taps again or presses Next
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Nothing after Birth
- **WHEN** stage 8 ends
- **THEN** the ending starts with no overlay, no grade word and no points on screen
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: Development always goes on after fertilization
From stage 2 onward, every stage SHALL end by its cap or sooner, whatever the input, with its development done: division, implantation, the placenta, the heartbeat, growth, turning, birth and the first breath SHALL happen on schedule, after a knock-out too, through Go on. Skill SHALL change only the score, and a knock-out only costs that stage's Goal points and grade word. The mother's voice SHALL never stop as a result of a miss or a hit.

#### Scenario: An idle player
- **WHEN** a player touches nothing from stage 2 to the end, and picks Go on at every Almost card
- **THEN** each stage ends by its cap or by a knock-out, its milestones fire, and the run reaches the ending
- **CHECK** `qa/first-breath/sim.test.mjs`

#### Scenario: Every stage alone
- **WHEN** each stage from 2 to 8 runs in node with no input from its default carry, with Go on after any knock-out
- **THEN** `result().done` is true by the stage's cap, and stages 6 and 8 end with `goalMet` true
- **CHECK** `qa/first-breath/stage-<id>.test.mjs`

### Requirement: A gentle retry before fertilization
Stage 1 SHALL end without its goal when a knockout gate closes before you pass it, when the cool tide reaches you, when you reach the meeting place outside the top 3, or at the 117 s cap. Then the game SHALL show "Almost. Try again?" with the place ("You were 9th of 20." when you were out or at the cap; "You came 4th of 20." after a finish), "Your run and points are kept.", a focused Try again and Go on. Try again SHALL recreate stage 1 at once with the same seed and carry. From stage 2 on, the knock-out card SHALL follow the same pattern.

#### Scenario: Try again
- **GIVEN** stage 1 with Gate 1 closed before you passed it
- **WHEN** the player taps Try again
- **THEN** stage 1 starts again at once with the rivals on the same start grid, and the run total and carry are what they were
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: Out at a gate
- **WHEN** Gate 2 closes with you 9th by progress
- **THEN** after you curl up and rest, the Almost card shows with "You were 9th of 20."
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: At the cap
- **WHEN** stage 1 reaches its 117 s cap with the sperm 9th by progress
- **THEN** the Almost card shows with "You were 9th of 20."
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: Outside the top 3
- **WHEN** the sperm reaches the meeting place in 4th place
- **THEN** the Almost card shows with "You came 4th of 20."
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: Keys on the card
- **GIVEN** the Almost card at 1440 × 900
- **WHEN** the player presses Enter
- **THEN** Try again runs, because it has focus
- **CHECK** `qa/first-breath/input.e2e.mjs`

### Requirement: Go on after the Almost card
In stage 1, Go on SHALL carry the cell to the meeting place in 3 s ("The waves carry you on."). Stage 1 SHALL then score with no Goal points and no grade word, and SHALL not run past 120 s.

#### Scenario: Go on
- **WHEN** the player chooses Go on at the Almost card in stage 1
- **THEN** the waves carry the sperm to the meeting place in 3 s, the stage has run no more than 120 s, the overlay shows only points, and stage 2 follows
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: Carry-over joins the stages
Stages SHALL pass one carry object from each result to the next stage, with a default for every field. The sperm raced in stage 1 SHALL come to the egg in stage 2 as the gold sperm, with its tint, sooner the higher it placed, brighter if it took a warm glow. The embryo's nestle spot in stage 4 SHALL be where the placenta grows in stages 5 to 7. The phrases answered in stage 6 SHALL become the song hummed in stage 7 and heard clearly in the ending. The side of the stage 8 Turn gate SHALL set the side of its Turn back gate. Each Glowing grade SHALL add a spark to the rim for the rest of the run, and each spark SHALL also be a shield pip, up to 2 per action stage. No gift or upgrade SHALL carry from one stage to the next.

#### Scenario: Your sperm comes to you
- **WHEN** stage 1 ends in 2nd place, and in another run in 3rd place
- **THEN** in stage 2 the gold sperm has stage 1's tint and comes in 0.3 s sooner after 2nd than after 3rd, and it is the one that enters
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: A stage alone uses defaults
- **WHEN** a test opens stage 6 or the ending through `goto` with no carry
- **THEN** the stage runs with the default carry, and the ending hums the default song
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: Sparks shield you
- **GIVEN** a run with one Glowing grade before stage 3
- **WHEN** you are hit for the first time in stage 3
- **THEN** the shield pip takes the hit and your hp stays full
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: Gifts stay in their stage
- **WHEN** stage 3 ends with three gifts taken
- **THEN** stage 4 starts with the default grapple, speed and fire
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: The rivals of the first two stages
The other sperm in stages 1 and 2 SHALL be seeded from each stage's seed, so a Try again or a replay with the same seed brings the same rivals doing the same things. They SHALL look alike in both stages, mauve paper sperm with beating tails and no faces. Nobody SHALL be harmed in either stage: rivals bump, spin out, slip, rest when a gate or the tide leaves them behind, bounce off and drift away. In a whole run, only the player's own sperm SHALL enter the egg.

#### Scenario: The same rivals on Try again
- **WHEN** the player taps Try again in stage 1
- **THEN** the 19 rivals start from the same grid with the same skills, and with the same input they race the same way and roll the same items
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: One sperm enters in a run
- **WHEN** whole runs are played in node with the bots at skills 1.0, 0.7, 0.5 and 0
- **THEN** each run has exactly one `enter` event, and it is in stage 2 for the player's own sperm
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: Points, grades and the run total
Each stage SHALL score Goal (3,000), Skill (up to 6,000) and Flourish (up to 1,000), for a total up to 10,000. A stage with its goal met SHALL get Good, Great at 6,500 or more, and Glowing at 8,500 or more. A knocked-out stage SHALL score no Goal points and get no grade word. The run total SHALL be the sum of the eight stages plus 500 per Glowing, and the run time SHALL be the core time from Play to the end of Birth with pauses left out. A retried stage SHALL keep its better attempt. Assist and one-button runs SHALL carry a mark and still count.

#### Scenario: Grades
- **WHEN** a stage ends with 8,620 points
- **THEN** its grade is Glowing and a spark appears on the rim
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: The best run
- **WHEN** two finished runs have the same total
- **THEN** the faster one is the best
- **CHECK** `qa/first-breath/save.test.mjs`

#### Scenario: A real spread
- **WHEN** 20 seeds are played by bots of skill 1.0, 0.7 and 0.5
- **THEN** the skill 1.0 bot is Great or better in at least 18 of 20 seeds in every stage, with a mean of at least 7,500 in each, and the mean totals rise with skill
- **CHECK** `qa/first-breath/sim.test.mjs`

#### Scenario: Survival gates
- **WHEN** the same 20 seeds are played
- **THEN** the skill 0.7 bot is in the top 3 of stage 1 in at least 18, and is not knocked out in stages 2 to 5 and 7 in at least 18; the skill 0.5 bot is not knocked out in those stages in at least 16
- **CHECK** `qa/first-breath/sim.test.mjs`

### Requirement: The ending comes before any result
After Birth the game SHALL play the ending: white, 1.5 s of silence, the prompt "Breathe.", a first breath, skin-to-skin, the mother's heartbeat close and clear, the song heard clearly, and the line "Your nine months took" with the run time. The first breath SHALL come by itself 3.0 s after the prompt when the player gives no input. The ending SHALL show no points and no grade. The run result SHALL come only after the skin-to-skin part has played.

#### Scenario: No input at the first breath
- **WHEN** the player touches nothing after "Breathe." appears
- **THEN** the breath comes by itself 3.0 s later with the caption "It can take a few seconds. That is normal."
- **CHECK** `qa/first-breath/ending.test.mjs`

#### Scenario: Holding to breathe
- **GIVEN** the "Breathe." prompt on a phone
- **WHEN** the player presses and lets go 1 s later
- **THEN** a warm glow fills as the player holds, and a soft first cry plays at the release
- **AND** nothing is graded
- **CHECK** `qa/first-breath/ending.test.mjs`

#### Scenario: Skin-to-skin
- **WHEN** the ending reaches skin-to-skin
- **THEN** two plain paper ovals, a big warm one and a small one, rest in a circle of cream light, "You know this heartbeat." shows, and "Rest your thumb here." invites a touch that makes both rings pulse together
- **CHECK** `qa/first-breath/visual.e2e.mjs`

#### Scenario: Rest your thumb in landscape
- **GIVEN** skin-to-skin at 844 × 390 with touch
- **WHEN** "Rest your thumb here." shows
- **THEN** its ring sits low in the corner on the side of the player's last touch (the right if there was none), inside the safe area, and touching it makes both rings pulse
- **CHECK** `qa/first-breath/layout.e2e.mjs`

### Requirement: The run result
The run result SHALL show "Hello.", the run total and time, a grade chip for each stage, the Goal, Skill and Flourish of each stage, the best run, the marks, Play again, Stages and "‹ Arcade". It SHALL say "In this game, every baby is born well. The ending is the same for every score." Below a divider it SHALL list every fact shown in the run with its clock label and its source link, ending with the Apgar fact.

#### Scenario: After a run
- **WHEN** the ending finishes
- **THEN** the run result shows the total, the time, eight chips and the born-well line
- **AND** Play again starts a new run at stage 1 with no card
- **CHECK** `qa/first-breath/smoke.e2e.mjs`

#### Scenario: What was real
- **WHEN** the player scrolls to "What was real"
- **THEN** each fact shown in the run, and each "What was real" fact of the stages played, is listed once with its label and a working link
- **CHECK** `qa/first-breath/facts.test.mjs`

### Requirement: Pause
The game SHALL pause on the pause button, Esc, P, `visibilitychange` to hidden and `pagehide`, and SHALL NOT pause on window blur. Pause SHALL stop the core clock and the sound and show Resume, Try this stage again, Settings, Sound, Switch game and "‹ Arcade". After Resume, targets in the first 1.2 s SHALL be free, and in an action stage you SHALL not be hit for 1.2 s.

#### Scenario: Hide the page on a phone
- **GIVEN** stage 5 in play at 390 × 844
- **WHEN** the page becomes hidden and then visible
- **THEN** the game is paused with the pause menu up, and no time passed in the stage while hidden
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Esc on desktop
- **WHEN** the player presses Esc in a stage at 1440 × 900
- **THEN** the pause menu opens with focus on Resume, and Enter resumes
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: Fair resume
- **WHEN** the player resumes 0.3 s before a target, or with a foe bullet 2 u away
- **THEN** that target is left out of accuracy whatever the player does, and the bullet cannot hit for 1.2 s
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: Saves
The game SHALL keep one save under `first-breath.save.v1`, read and written inside try/catch, with the best run, the number of stages reached, the best per stage, the carry each stage last started with in a run, and the settings. A broken, old or blocked save SHALL give defaults with no error. A run SHALL always start at stage 1; resuming a run part-way is not part of this change.

#### Scenario: Records across visits
- **GIVEN** a finished run
- **WHEN** the player closes the page and opens it again
- **THEN** the title's best line shows that run's total, and Stages lists every stage with its best and grade
- **CHECK** `qa/first-breath/save.test.mjs`

#### Scenario: A broken save
- **WHEN** the save holds text that is not JSON, or storage throws
- **THEN** the title shows with default settings and no console error
- **CHECK** `qa/first-breath/save.test.mjs`

### Requirement: Practice from the Stages menu
The Stages menu SHALL list each stage reached at least once, with its best and grade. A stage played from the menu SHALL run alone with the carry it last started with in a run, or the defaults, and its score SHALL go only to that stage's best.

#### Scenario: Practise a stage
- **GIVEN** a save that reached The Placenta
- **WHEN** the player opens Stages and picks The Placenta
- **THEN** stage 4 starts alone, and at its end the stage best updates while the best run stays the same
- **CHECK** `qa/first-breath/run.test.mjs`

### Requirement: A run fits a phone session
A run SHALL take about 10 minutes for a mid player, and no stage cap SHALL exceed 120 s. The skill 0.7 bot SHALL finish runs in 8 to 12 minutes of game time.

#### Scenario: Bot run length
- **WHEN** the skill 0.7 bot plays 20 seeds
- **THEN** every run takes 8 to 12 minutes of game time
- **CHECK** `qa/first-breath/sim.test.mjs`

### Requirement: A knock-out ends a stage gently
Stages 2, 3, 4, 5 and 7 SHALL give you hp as pips. At 0 hp you SHALL curl up and rest while foes and bullets drift off over 1.2 s, with the stage's rest line ("Your shell needs a rest.", "Your cells need a rest." or "You need a rest."). Then the game SHALL show the Almost card: "Almost. Try again?", "Your body keeps growing. Your run and points are kept.", a focused Try again and Go on. Stages 6 and 8 SHALL have no hp and no knock-out.

#### Scenario: The rest line
- **WHEN** the shell's last pip goes in stage 2
- **THEN** the egg rests, the sparks and sperm drift off over 1.2 s, "Your shell needs a rest." shows, and then the Almost card
- **CHECK** `qa/first-breath/stage-egg.test.mjs`, `qa/first-breath/run.test.mjs`

### Requirement: Try again or Go on after a knock-out
After a knock-out, Try again SHALL recreate the stage at once with the same seed and carry. Go on SHALL let the stage's development finish by itself, with its milestones and its carry, and end the stage with no Goal points and no grade word.

#### Scenario: Go on after a knock-out
- **GIVEN** stage 3 with the player knocked out on Day 2
- **WHEN** the player chooses Go on
- **THEN** the splits and the hatch play by themselves, the clock reaches Day 6 after fertilization, the overlay shows only points, and stage 4 follows
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: Try again after a knock-out
- **GIVEN** stage 7 with the player knocked out at 40 s
- **WHEN** the player chooses Try again
- **THEN** stage 7 starts again at once with the same seed and carry, and the run keeps the better attempt's score
- **CHECK** `qa/first-breath/run.test.mjs`

#### Scenario: Keys on the knock-out card
- **GIVEN** the Almost card after a knock-out at 1440 × 900
- **WHEN** the player presses Enter
- **THEN** Try again runs, because it has focus
- **CHECK** `qa/first-breath/input.e2e.mjs`

#### Scenario: The egg still meets your sperm
- **GIVEN** stage 2 with the shell's last pip gone during the swarm
- **WHEN** the player chooses Go on
- **THEN** every rival and spark drifts off, the gold sperm comes in alone within 2 s and enters, the shell seals by itself, fusion plays, and the run has exactly one `enter` event
- **CHECK** `qa/first-breath/stage-egg.test.mjs`, `qa/first-breath/run.test.mjs`

### Requirement: The Music setting
Settings SHALL have a Music switch next to Sound, on by default and saved for the next visit. Music off SHALL silence the score within 0.35 s and schedule no more of it, while her heartbeat and every other sound play on. Music on SHALL bring the score back on the next bar line. Sound off, by the arcade mute or M, SHALL silence the score too, whatever the Music switch says.

#### Scenario: Turn the music off
- **GIVEN** stage 2 in play at 390 × 844
- **WHEN** the player pauses, turns Music off in Settings and resumes
- **THEN** the score is silent within 0.35 s, her heartbeat still plays, and after a reload Music is still off
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: Turn it back on
- **GIVEN** stage 2 with Music off
- **WHEN** the player turns Music on and resumes
- **THEN** the stage's cue comes back on the next bar line at the level the stage's mood gives
- **CHECK** `qa/first-breath/music.e2e.mjs`

#### Scenario: The switch in every layout
- **GIVEN** Settings at 390 × 844 and 844 × 390 with touch, and at 1440 × 900
- **WHEN** the Music switch is found
- **THEN** it sits next to Sound, is at least 44 px on its shorter side, overlaps nothing, and Tab reaches it with a visible focus ring
- **CHECK** `qa/first-breath/layout.e2e.mjs`

#### Scenario: M silences the score
- **GIVEN** stage 1 with Music on
- **WHEN** the player presses M, and then M again
- **THEN** the score falls silent with the rest of the sound, and comes back with it
- **CHECK** `qa/first-breath/music.e2e.mjs`

### Requirement: The score pauses with the game
While the game is paused or the page is hidden, the score SHALL schedule no notes. After Resume it SHALL come back on the next bar line of the cue it was playing, at the level the stage's mood gives then.

#### Scenario: Hidden, then resumed
- **GIVEN** stage 4 with the score at level 1
- **WHEN** the page is hidden for 5 s, shown again, and the player taps Resume
- **THEN** no score note was scheduled while the page was hidden or the game was paused, and the first note after Resume lands on a bar line of the stage 4 cue
- **CHECK** `qa/first-breath/music.e2e.mjs`, `qa/arcade/quiet.mjs`

#### Scenario: Esc on desktop
- **GIVEN** stage 7 at 1440 × 900 with the score at level 2
- **WHEN** the player presses Esc, waits 3 s and resumes with Enter
- **THEN** the score is silent while paused and comes back on a bar line after Enter
- **CHECK** `qa/first-breath/music.e2e.mjs`
