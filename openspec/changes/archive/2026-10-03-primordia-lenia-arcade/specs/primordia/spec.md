## ADDED Requirements

### Requirement: A living Lenia dish
Primordia SHALL simulate its creatures with Lenia rules and published Lenia patterns, so prey and hunters move, collide and die as cellular automata, not as scripted sprites.

#### Scenario: Prey glide
- **WHEN** an Orbium is placed in an empty dish
- **THEN** it travels across the dish and keeps its shape and mass

#### Scenario: Blooms end
- **WHEN** colliding prey explode into a bloom that covers much of the dish
- **THEN** the bloom starves within seconds and normal prey spawning resumes

#### Scenario: Red tides end
- **WHEN** hunters merge into a spreading red tide
- **THEN** the tide burns out and new hunters can spawn

### Requirement: Eat prey to survive
The player SHALL lose light over time and SHALL regain it by swimming into prey, which the player eats bite by bite.

#### Scenario: Devour an Orbium
- **WHEN** the player keeps eating one Orbium until it falls apart
- **THEN** the creature bursts into particles, the score shows a devour bonus with the combo multiplier, and light and the Frenzy meter rise

#### Scenario: Starve
- **WHEN** the player's light reaches zero
- **THEN** the player dissolves and the game-over screen shows the score, best score and run stats

### Requirement: Hunters stalk and sting
Hunters SHALL drift toward the player and SHALL drain light while the player touches their tissue, unless the player is dashing or in Frenzy.

#### Scenario: Sting
- **WHEN** the player touches hunter tissue outside Frenzy and outside a dash
- **THEN** light drains, the screen shakes and tints red, and the player is pushed out of the tissue

#### Scenario: Warning before a hunter appears
- **WHEN** a hunter is about to spawn
- **THEN** a pulsing reticle with the species name marks the spot for two seconds, and never closer than 58 cells to the player

### Requirement: Frenzy reversal
A full Frenzy meter SHALL let the player turn the tables for a limited time.

#### Scenario: Activate Frenzy
- **WHEN** the meter is full and the player presses Shift, X, right-click, gamepad B or the touch FRENZY button
- **THEN** the player turns gold, hunters stop stinging, hunters drift away from the player, and the player can eat them for large points

#### Scenario: Frenzy not ready
- **WHEN** the meter is not full
- **THEN** the Frenzy input does nothing

### Requirement: Epochs and mutations
The run SHALL advance in 40-second epochs that each end with a choice of one of three mutations.

#### Scenario: Choose a mutation
- **WHEN** an epoch timer runs out
- **THEN** play pauses, three mutation cards appear, and pressing 1, 2 or 3, tapping a card or using the gamepad applies one and starts the next, faster epoch

#### Scenario: Leviathan
- **WHEN** the run reaches every third epoch
- **THEN** a giant Heptapteryx arrives with a warning banner and a health bar, and devouring it pays a large bonus

### Requirement: Controls on every device
Primordia SHALL be playable with mouse, keyboard, touch and gamepad on desktop and phone layouts.

#### Scenario: Desktop
- **WHEN** a player uses a mouse or keyboard at 1280×720
- **THEN** the player follows the pointer or WASD/arrows, Space or click dashes, Escape or P pauses, M mutes and Enter starts or restarts

#### Scenario: Phone portrait
- **WHEN** a player uses touch at 390×844
- **THEN** the dish turns to portrait, dragging anywhere steers with a floating stick, and DASH and FRENZY buttons appear without horizontal page scroll

### Requirement: Arcade cabinet
The Cottage Arcade SHALL list Primordia in the Action row with a cabinet that boots the game and shows the saved best score.

#### Scenario: Play from the arcade
- **WHEN** a player selects Primordia, drops a token and presses Enter
- **THEN** the arcade loads /primordia/
