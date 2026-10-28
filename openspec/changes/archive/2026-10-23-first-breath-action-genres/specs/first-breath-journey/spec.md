## ADDED Requirements

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

## MODIFIED Requirements

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

### Requirement: A run fits a phone session
A run SHALL take about 10 minutes for a mid player, and no stage cap SHALL exceed 120 s. The skill 0.7 bot SHALL finish runs in 8 to 12 minutes of game time.

#### Scenario: Bot run length
- **WHEN** the skill 0.7 bot plays 20 seeds
- **THEN** every run takes 8 to 12 minutes of game time
- **CHECK** `qa/first-breath/sim.test.mjs`
