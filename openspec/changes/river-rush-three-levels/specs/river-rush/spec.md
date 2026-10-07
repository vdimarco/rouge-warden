## ADDED Requirements

### Requirement: Three finite adventure maps
River Rush SHALL offer exactly three maps in order: Canopy Run, Redstone Rapids
and Moonlit Ruins, each with a finite visible finish and a distinct environment.
A cleared level SHALL stop simulation, report results and unlock the next map.
The third clear SHALL show an adventure victory. Campaign totals SHALL carry
between levels; wiping out SHALL retry the current level with prior clears
preserved. Later maps SHALL have higher speed and more demanding varied
sequences while preserving fair routes and the existing action durations.

#### Scenario: Finish the adventure
- **WHEN** a player clears each of the three map finish gates and chooses Next level
- **THEN** every level ends at its stated distance, totals accumulate exactly once,
  the next map visibly changes, and the third finish shows a final victory

#### Scenario: Read varied routes and increasing difficulty
- **WHEN** a player plays the three seeded maps
- **THEN** multiple slalom, mixed obstacle, jump/duck and coin-route sequences
  appear, each row remains traversable, and later maps increase speed and timing demands

#### Scenario: Retry and resume
- **WHEN** a player wipes out or pauses in the second or third level
- **THEN** retry restarts that level with prior cleared totals intact, resume
  preserves simulation, and whole-screen dragging and edge controls still work

#### Scenario: Distinct readable maps
- **WHEN** a map is played at phone, desktop or short landscape size
- **THEN** jungle, rocky gorge and moonlit temple silhouettes and palettes are
  distinct, the character and next hazard remain readable, and the finish is visible

#### Scenario: Prepared maps and fallback
- **WHEN** a level changes, reduced motion is active or graphics/image loading fails
- **THEN** stage transitions allocate no new play-time textures or shader variants,
  stopped screens freeze, and all three maps remain playable in fallback

#### Scenario: Persistent progress
- **WHEN** a player reloads after a level clear or stored progress is malformed
- **THEN** valid map unlocks persist, malformed data starts safely, and old endless
  scores do not become finite adventure records

### Requirement: Shareable scores and gesture guidance
The game SHALL offer a button to save a legible PNG score image with the map,
score and adventure progress. Animated visual guidance SHALL demonstrate
horizontal lane swipes, upward jumping and downward ducking; reduced motion
SHALL retain still diagrams. Guides SHALL not capture gameplay gestures.

#### Scenario: Save a score
- **WHEN** a player chooses Save score image during a run or on a result screen
- **THEN** a downloaded PNG contains the current score, map and cleared progress
  and does not depend on retaining WebGL drawing-buffer pixels

#### Scenario: Learn gestures
- **WHEN** a player opens instructions or starts an early run
- **THEN** directional swipe/jump/duck guides visibly show the required gesture,
  remain readable at phone size, respect reduced motion and permit screen-wide input

### Requirement: Public guest leaderboard
The game SHALL show a shared persistent high-score leaderboard visible to
anyone. Guests SHALL be able to choose a short display name and explicitly
submit their completed score without signing in. The service SHALL validate
names and finite bounded score statistics, return ranked results, and report
failure visibly without replacing the shared board with local-only data.

#### Scenario: Submit and read across browsers
- **WHEN** a guest submits a finished score and another browser opens the board
- **THEN** the named score persists in the ranked public board and is visible to both

#### Scenario: Invalid or unavailable submission
- **WHEN** a request has invalid score/name data or the shared service is unavailable
- **THEN** invalid data is rejected or a retryable service error is shown, and
  the adventure, score capture and local progression remain usable

## MODIFIED Requirements

### Requirement: River Rush arcade cabinet
The arcade SHALL retain the River Rush cabinet id, name, /river-rush/ route,
Action membership, approved art direction and shared switcher entry. Its copy
SHALL describe the finite three-map adventure.

#### Scenario: Launch and switch
- **WHEN** a player starts the River Rush cabinet or uses Switch game
- **THEN** the selected adventure opens correctly and the shared switcher
  identifies River Rush while retaining links to other games and the arcade

### Requirement: Validated best score
The game SHALL save positive bounded finite-adventure best scores in
river-rush-adventure-best with version 3. Older race/endless scores SHALL NOT
become adventure records. The cabinet SHALL show valid adventure scores and
tolerate malformed storage.

#### Scenario: Retry an adventure map
- **WHEN** a player finishes or wipes out with a new personal best and retries
- **THEN** the best persists, current-map statistics reset and prior clears carry

#### Scenario: Malformed or old records
- **WHEN** storage is malformed, inconsistent or from the earlier runner
- **THEN** the game remains playable with safe defaults and no old best score

### Requirement: Endless runner controls and retry
The finite adventure SHALL offer three lanes, immediate lane changes, jump,
duck and Rush through keyboard/buttons and screen-wide directional gestures.
Inputs SHALL consume each tap once. A fatal collision SHALL show cumulative
score, distance, coins, cause and one-action current-map retry. Map clears SHALL
show Next map or final victory rather than a wipeout.

#### Scenario: Keyboard and swipe
- **WHEN** a player uses keyboard actions or swipes on any gameplay area
- **THEN** matching actions occur immediately, with left/right buttons anchored
  at the screen edges and no gesture-guide interception

#### Scenario: Restart or advance
- **WHEN** the player retries a wiped-out map or advances a cleared map
- **THEN** the current map restarts with earlier clears preserved or the next
  harder map starts with cumulative totals carried exactly once

### Requirement: Fair escalating obstacle course
Each seeded finite course SHALL vary slalom, coin zigzags, mixed obstacles,
jump waves, low canopy and split-current motifs. Later maps SHALL increase
speed/complexity while each row retains a clear lane or traversable action
barrier and enough time for the existing jump/duck durations. Hazards SHALL
stop before the finish runway and active course entities SHALL remain bounded.

#### Scenario: Choose an action
- **WHEN** a player jumps a log, ducks a branch or avoids a rock
- **THEN** the matching action safely clears the hazard and rewards its points

#### Scenario: Finish a varied map
- **WHEN** a player survives to the finish of any of the three maps
- **THEN** multiple route motifs appear, a legal route remains, the last 90 m
  is hazard-free, and simulation stops at the stated distance
