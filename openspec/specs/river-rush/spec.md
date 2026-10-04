# River Rush Specification

## Purpose
Define River Rush's animated two-minute whitewater treasure race, Higgsfield living title scene, keyboard/touch controls, Surge and close-call rewards, and its cabinet, shared switcher, audio lifecycle and best-score behavior in the Cottage Arcade.

## Requirements

### Requirement: River Rush arcade cabinet
The arcade SHALL append a River Rush cabinet with id `river-rush`, name `River Rush`, route `/river-rush/`, a real game picture, and membership in the Action group. The shared switcher SHALL use the same id, name and route.

#### Scenario: Launch from the arcade
- **WHEN** a player selects River Rush and starts its cabinet
- **THEN** the browser opens `/river-rush/` and its approved menu art and Start adventure button load

#### Scenario: Shared switcher
- **WHEN** a player opens Switch game from River Rush's menu or result screen
- **THEN** River Rush is marked as the current game and the player can return to the arcade or another cabinet

### Requirement: A complete treasure race
River Rush SHALL retain keyboard and touch steering, timed key release, reduced steering while reaching, key-gated sustained chest unlocking, balance damage and recoverable falls, a rival and a marked left escape channel. A win SHALL require unlocked treasure and escape before the rival within two minutes.

#### Scenario: Catch and unlock
- **WHEN** the player reaches near a key and releases within the catch window, then holds Unlock for two seconds
- **THEN** the key is secured, treasure is claimed, and the objective progresses to escape

#### Scenario: Pause and restart
- **WHEN** the player pauses or the page is hidden
- **THEN** race time stops until resumed, and Restart begins a fresh run

#### Scenario: Desktop and phone
- **WHEN** the game is played at 1536 by 1024 or 390 by 844
- **THEN** art loads from the game subpath, controls respond, and no horizontal overflow hides the main actions

### Requirement: Validated best score
The game SHALL save successful best runs in `river-rush-best`. The cabinet SHALL display a positive finite saved score; invalid or absent data SHALL leave the plain cabinet line without errors.

#### Scenario: Saved and invalid scores
- **WHEN** the save contains a best score of 2102
- **THEN** the cabinet displays BEST 2,102 PTS
- **WHEN** that save is malformed or its score is nonpositive or not finite
- **THEN** the default cabinet line is shown and the arcade remains usable

### Requirement: Shared audio lifecycle
The arcade build SHALL load `/arcade/quiet.js` before other scripts so audio suspends when the page is hidden.

#### Scenario: Hide the page
- **WHEN** game audio has started and the page becomes hidden
- **THEN** the shared lifecycle script silences the game without breaking its own mute control

### Requirement: Animated river adventure
River Rush SHALL animate current foam, raft wakes, paddle strokes, raft rocking and transitions between paddling and reaching using the approved character art. Motion SHALL remain readable at 1536×1024 and 390×844 without hiding controls.

#### Scenario: Ride and reach
- **WHEN** the player steers into the fast current and then holds Reach
- **THEN** wakes and rocking respond to speed and the character smoothly transitions to the reaching pose

### Requirement: Animated action feedback
Key catches, treasure opening, collisions and falls SHALL have short visual feedback. Effects SHALL expire and be bounded per run, without changing race outcomes or input timing.

#### Scenario: Catch the key and open the chest
- **WHEN** a key is caught and the chest is unlocked
- **THEN** the key travels toward the raft and a gold burst marks the treasure reward

#### Scenario: Strike a rock
- **WHEN** the raft collides with a rock
- **THEN** a splash and brief raft recoil accompany the balance loss

### Requirement: Motion lifecycle and accessibility
Canvas animation SHALL use simulation time so pause and run completion freeze its frame. The game SHALL respond to live prefers-reduced-motion changes by disabling decorative movement and particles while preserving course scrolling, input and objective feedback.

#### Scenario: Pause mid-effect
- **WHEN** the player pauses during a splash or wake
- **THEN** the canvas remains unchanged until the run resumes

#### Scenario: Reduced motion
- **WHEN** the player enables reduced motion before or during a run
- **THEN** decorative water, rocking, pose blending and CSS animation stop, and gameplay remains functional

### Requirement: Higgsfield living title scene
The title scene SHALL use a Higgsfield-generated silent looping video based on the approved character art, with a still-image fallback. It SHALL preserve live readable menu controls, pause while hidden or covered by instructions, and use the still image for reduced motion or data-saving.

#### Scenario: Enter the menu
- **WHEN** the menu loads in a normal-motion browser
- **THEN** the river and character artwork animate behind working Start and Switch game controls

#### Scenario: Video unavailable
- **WHEN** video cannot load or motion/data preferences disable it
- **THEN** the approved still image and all menu actions remain usable

### Requirement: Surge and close-call rewards
The player SHALL be able to spend at least 35 charge points on a 1.8-second Surge using Shift or a dedicated touch control. Surge SHALL accelerate the raft and cost balance, and SHALL be blocked while falling. Clear near misses SHALL grant charge and increasing combo points; impacts SHALL break the combo. One held activation SHALL spend charge only once until released.

#### Scenario: Use Surge
- **WHEN** a player with sufficient charge presses and holds Shift
- **THEN** one Surge starts, its speed and balance cost apply, and a second charge is not spent without releasing and pressing again

#### Scenario: Skim a rock
- **WHEN** the raft passes close to an unhit rock with sufficient clearance
- **THEN** a close-call reward increments the combo and adds charge and score once for that rock
