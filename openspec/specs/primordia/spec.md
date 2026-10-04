# primordia Specification

## Purpose
Primordia is a Cottage Arcade game built on a live Lenia simulation: the player eats Orbium prey, avoids stalking hunters, and turns on them during Frenzy.

## Requirements

### Requirement: A living Lenia dish
Primordia SHALL simulate its creatures with Lenia rules and published Lenia patterns, so prey and hunters move, collide and die as cellular automata, not as scripted sprites. Hunters SHALL stay alive until the player kills them; the game SHALL keep them from merging into each other.

#### Scenario: Prey glide
- **WHEN** an Orbium is placed in an empty dish
- **THEN** it travels across the dish and keeps its shape and mass

#### Scenario: Blooms end
- **WHEN** colliding prey explode into a bloom that covers much of the dish
- **THEN** the bloom starves within seconds and normal prey spawning resumes

#### Scenario: Red tides end
- **WHEN** hunter tissue spreads into a red tide
- **THEN** the tide burns out and new hunters can spawn

#### Scenario: Hunters persist
- **WHEN** the player swims around for 100 seconds without fighting while waves keep arriving
- **THEN** almost no hunter dissolves on its own (two or fewer per run on the tested seeds) and no red tide starts

#### Scenario: Fused bodies burst
- **WHEN** two hunters touch and fuse into one swollen body
- **THEN** that body bursts on its own and the other hunters in the dish are not purged

### Requirement: Eat prey to survive
The player SHALL lose light over time and SHALL regain it by swimming into prey, which the player eats bite by bite. From epoch III, prey alone SHALL not keep up with hunger, so fighting becomes the main food source.

#### Scenario: Devour an Orbium
- **WHEN** the player keeps eating one Orbium until it falls apart
- **THEN** the creature bursts into particles, the score shows a devour bonus with the multiplier, light rises and one dash charge refills

#### Scenario: Starve
- **WHEN** the player's light reaches zero
- **THEN** the player dissolves and the game-over screen appears within 0.9 seconds with the score, best score and run stats

### Requirement: Hunters stalk and sting
Hunters SHALL stalk the player, then attack with a telegraphed lunge that is faster than the player can swim. Touching hunter tissue SHALL sting at a lower rate than a lunge hit.

#### Scenario: Telegraphed lunge
- **WHEN** a hunter is 6 to 26 cells from the player and holds an attack token
- **THEN** it stops and heats up, a lane outline shows the area its body will sweep, the lane locks halfway through the windup, the hunter glints white for the last 0.2 seconds, and then it lunges about 18 cells along the lane

#### Scenario: Blocked path
- **WHEN** another body lies in the path a hunter would lunge along
- **THEN** the hunter does not wind up; it circles around the player faster for about a second and attacks once its path is clear, and while a lane is locked, swarm bodies in or beside it swim out of it

#### Scenario: Attackers at once
- **WHEN** several hunters are in range
- **THEN** at most one winds up at a time in epoch I, two in epochs II and III, and three from epoch IV, and from epoch III a lane locks where the player will be a quarter second later

#### Scenario: Lunge hit
- **WHEN** a lunge reaches the player outside dash i-frames
- **THEN** the player loses 18 light (at most 30 per second from lunges), is shoved along the lane, and the combo multiplier halves

#### Scenario: Sting
- **WHEN** the player touches hunter tissue that is not staggered, outside a dash and outside Burst
- **THEN** light drains, the screen kicks and tints red, and the player is pushed out of the tissue

#### Scenario: Warning before a hunter appears
- **WHEN** a hunter is about to spawn
- **THEN** a pulsing reticle marks the spot behind the player's heading, 34 to 48 cells away, for 1.2 seconds (0.9 for swarms, 0.6 for eggs, 3.0 for the Leviathan), and never on top of another body

### Requirement: Epochs and mutations
The run SHALL advance in 40-second epochs that each end with a choice of mutations, mostly build cards that change how fights play out, with Duo cards when both parents are owned.

#### Scenario: Choose a mutation
- **WHEN** an epoch timer runs out
- **THEN** play pauses and up to three cards appear, at least two of them build cards when available, each labelled BUILD or EXTRA; pressing 1, 2 or 3, tapping a card or using the gamepad applies one and starts the next, faster epoch with dash charges refilled

#### Scenario: Leviathan
- **WHEN** the run reaches every third epoch
- **THEN** a giant Heptapteryx arrives with a warning banner and three phase pips instead of the waves' middle slot (see Leviathan phases), and devouring it pays a large bonus

#### Scenario: Duo
- **WHEN** the player owns both parents of a Duo (for example Spore Burst and Nerve Net)
- **THEN** the Duo can take the third card slot, shown with a DUO tag and a two-color border, and it always does after a Leviathan kill

### Requirement: Controls on every device
Primordia SHALL be playable with mouse, keyboard, touch and gamepad on desktop and phone layouts, without adding a button: DASH cuts, dodges and parries; BURST spends the meter.

#### Scenario: Desktop
- **WHEN** a player uses a mouse or keyboard at 1280×720
- **THEN** the player follows the pointer or WASD/arrows, Space, Z, J or left click dashes, Shift, X, K, F or right click fires Burst, Escape or P pauses, M mutes, and Enter or R restarts after death

#### Scenario: Phone portrait
- **WHEN** a player uses touch at 390×844
- **THEN** the dish turns to portrait, dragging anywhere steers with a floating stick, the DASH button shows its charges as pips, the BURST button glows gold when ready, a dash bends up to 12 degrees toward nearby hunter tissue, at most 3 gliders and 6 bodies share the dish, and the page has no horizontal scroll

#### Scenario: Phone landscape
- **WHEN** a player uses touch at 844×390
- **THEN** the same touch controls work and the HUD and buttons stay on screen

### Requirement: Arcade cabinet
The Cottage Arcade SHALL list Primordia in the Action row with a cabinet that boots the game, shows the saved best score and runs a live Lenia dish on its screen while selected.

#### Scenario: Play from the arcade
- **WHEN** a player selects Primordia, drops a token and presses Enter
- **THEN** the arcade loads /primordia/

#### Scenario: Live cabinet screen
- **WHEN** the Primordia cabinet is selected and the page is visible
- **THEN** its screen shows Orbium prey and a hunter moving in a small live dish; with reduced motion the still image stays

### Requirement: Rend Dash
The dash SHALL cut hunter tissue along its path and SHALL have charges that the player refills by eating.

#### Scenario: Cut a hunter
- **WHEN** the player dashes through a hunter
- **THEN** a line of tissue is torn away with a white flash, red chunks, a short freeze and a percent popup, the hunter is knocked back, and one dash tears at most 22% of that hunter's mass

#### Scenario: Dash charges
- **WHEN** the player dashes twice in a row
- **THEN** both charge pips empty, the third press does nothing, and the charges come back one at a time every 1.4 seconds or at once on a prey devour, a parry or a Glory Bite

### Requirement: Stagger and Glory Bite
A hunter torn by 20% of its mass, parried, or caught by a Burst SHALL reel gold, and the player SHALL be able to finish it by swimming the mouth into it.

#### Scenario: Stagger
- **WHEN** a hunter's recent tear reaches 20% of its mass
- **THEN** it stops moving, stops stinging, glows gold with a ring and motes for about 1.6 seconds, and takes 1.5x damage

#### Scenario: Glory Bite
- **WHEN** the player's mouth touches a staggered hunter after the dash that staggered it has ended and the hunter has reeled for 0.25 seconds, or a new dash passes through it
- **THEN** the hunter is devoured at once with a heavy hit, the player gains light, a dash charge and Burst meter, and its body breaks into live Orbium that glide away and fade after 6 seconds

#### Scenario: Bleed out
- **WHEN** a cut hunter dies by itself within 6 seconds of the player's last cut
- **THEN** the kill is credited to the player for half the points

### Requirement: Parry and Stasis
Dashing into a hunter during its glint or its lunge SHALL parry it and slow the dish.

#### Scenario: Parry
- **WHEN** the player's dash meets a hunter that is glinting or lunging
- **THEN** the lunge stops, the hunter staggers, a dash charge refills, PARRY shows, and the dish runs at 30% speed for 1.5 seconds with a violet grade and muffled sound while the player keeps full speed

#### Scenario: Missed parry
- **WHEN** the player dashes into a hunter that is still early in its windup
- **THEN** the dash only cuts it and no Stasis starts

### Requirement: Burst
A Burst meter filled only by fighting SHALL let the player blast every hunter near them and then hunt for a few seconds.

#### Scenario: Fire a Burst
- **WHEN** the meter is full and the player presses Shift, X, right-click, gamepad B or the touch BURST button
- **THEN** a gold ring expands 20 cells, hunters inside it are torn and staggered, eggs inside it pop, hunters within 40 cells are knocked back, and for 4 seconds hunters flee and the player's mouth eats their tissue

#### Scenario: Meter sources
- **WHEN** the player eats prey only
- **THEN** the Burst meter does not rise; cuts, grazes, parries, Glory Bites, egg pops and golden prey fill it

#### Scenario: Burst not ready
- **WHEN** the meter is not full
- **THEN** the Burst input does nothing

### Requirement: Waves and roster
A director SHALL send scripted waves of distinct hunter roles each epoch, with relax beats between them and hard caps on bodies.

#### Scenario: Waves
- **WHEN** an epoch starts
- **THEN** three waves arrive (about 2, 12-15 and 24-28 seconds in, or 5 seconds after the previous wave is cleared; waves held back by a living Leviathan keep 8 seconds apart), a WAVE label shows, and clearing a wave fills a wave dot, pays 500 x epoch points and starts a 5-second relax beat with extra prey

#### Scenario: Roster
- **WHEN** waves arrive across epochs I to VI
- **THEN** they mix lancers (Paraptera, Pentapteryx), heavy lancers (Hexapteryx), Discutium swarms that rush in to sting and then peel away for 1.6 seconds, and Circium eggs that hatch a Discutium after 8 seconds unless a dash or Burst pops them

#### Scenario: Busy from the start
- **WHEN** epoch I starts
- **THEN** a lancer and a swarm arrive at once, the second wave brings three bodies about 12 seconds in, and the third arrives about 24 seconds in

#### Scenario: Caps
- **WHEN** a wave would exceed 4 gliders, 4 swarm bodies, 4 eggs or 8 bodies (3, 3, 3 and 6 on touch or portrait)
- **THEN** the extra units wait in a queue until a slot frees

### Requirement: Leviathan phases
Every third epoch a Leviathan SHALL arrive and change its attacks as the player tears its wings off.

#### Scenario: Wing tears
- **WHEN** the player tears 20% of the Leviathan's mass, parries it or catches it in a Burst
- **THEN** a wing tears off, a phase pip goes dark, WING TORN shows, and the boss changes its attack: a double lunge in phase 2, faster lunges and egg laying in phase 3

#### Scenario: Collapse
- **WHEN** the third wing tears
- **THEN** the Leviathan collapses for 2.5 seconds with a timer ring, and a Glory Bite in that window devours it for full light, a full Burst meter, three Remains and a guaranteed Duo offer

### Requirement: How to play intro
Primordia SHALL teach its moves with a short animated intro that plays scripted scenes on the real Lenia dish, with captions in plain words.

#### Scenario: First PLAY
- **WHEN** a player presses PLAY for the first time on a device
- **THEN** the intro plays before the run: a title card, then one scene each for eating, dodging a lane, cutting, the Glory Bite, the parry and Burst, then an end card with PLAY and Watch again

#### Scenario: Each lesson shows its move
- **WHEN** an intro scene plays
- **THEN** the player cell performs that scene's move with the game's own rules (a devoured prey, a lunge that misses, a cut that turns a hunter gold, a Glory Bite and a caught prey, a parry that starts Stasis, a Burst that catches at least two hunters), a ring and label mark the creatures it talks about, and the caption names the control for the current device

#### Scenario: Skip and replay
- **WHEN** a player presses Skip, Escape or gamepad B during the intro
- **THEN** the intro ends, is marked as seen and the run starts (or the title returns, when the intro was opened from HOW TO PLAY); Next, Enter, a tap on the dish or gamepad A moves to the next scene; HOW TO PLAY or H on the title screen replays it

#### Scenario: Intro layouts
- **WHEN** the intro plays at 1280×720, 390×844 or 844×390
- **THEN** the dish action stays on screen above the captions (beside them on the landscape phone), the Skip and Next buttons are at least 44 pixels tall, and the page has no horizontal scroll; with reduced motion the captions appear without motion

### Requirement: Combat feedback
Every combat action SHALL read on screen and in sound at a phone's scale.

#### Scenario: Juice
- **WHEN** the player cuts, staggers, parries, Glory Bites, Bursts or is hit
- **THEN** the game freezes briefly (at most 0.25 seconds of freeze in any second, none while another nearby hunter is winding up), the view kicks along the action, particles and popups appear, and a matching sound plays; with reduced motion the shakes and shards are off and freezes are halved

#### Scenario: Readability
- **WHEN** the dish is drawn at about 3 pixels per cell on a 390-pixel-wide phone
- **THEN** lane outlines, stagger rings and dash pips are at least 3 pixels thick and the glint star is at least 14 pixels across
