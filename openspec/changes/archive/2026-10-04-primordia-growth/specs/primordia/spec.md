## MODIFIED Requirements

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

#### Scenario: Growing the dish starts nothing
- **WHEN** the dish grows
- **THEN** no hunter tissue is left in the dish, no prey bloom or red tide starts in the next 12 seconds, and no hunter is counted as dying on its own

### Requirement: Eat prey to survive
The player SHALL lose light over time and SHALL regain it by swimming into prey, which the player eats bite by bite. Every meal SHALL also fill the GROW bar. From Size III, prey alone SHALL not keep up with hunger, so fighting becomes the main food source.

#### Scenario: Devour an Orbium
- **WHEN** the player keeps eating one Orbium until it falls apart
- **THEN** the creature bursts into particles, the score shows a devour bonus with the multiplier, light rises, one dash charge refills and the GROW bar rises by one point

#### Scenario: Starve
- **WHEN** the player's light reaches zero
- **THEN** the player dissolves and the game-over screen appears within 0.9 seconds with the score, best score, the size reached and run stats

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
- **THEN** at most one winds up at a time in Size I, two in Sizes II and III, and three from Size IV, and from Size III a lane locks where the player will be a quarter second later

#### Scenario: Lunge hit
- **WHEN** a lunge reaches the player outside dash i-frames
- **THEN** the player loses 18 light (at most 30 per second from lunges), is shoved along the lane, and the combo multiplier halves

#### Scenario: Sting
- **WHEN** the player touches hunter tissue that is not staggered and not a body the player has outgrown, outside a dash and outside Burst
- **THEN** light drains, the screen kicks and tints red, and the player is pushed out of the tissue

#### Scenario: Warning before a hunter appears
- **WHEN** a hunter is about to spawn
- **THEN** a pulsing reticle marks the spot behind the player's heading, 34 to 48 cells away (34 to 70 cells, in the new territory, for the first wave of Size II and later), for 1.2 seconds (0.9 for swarms, 0.6 for eggs, 3.0 for the Leviathan), and never on top of another body

### Requirement: Epochs and mutations
The run SHALL advance in epochs, shown to the player as sizes. A size SHALL end when the dish grows, not on a timer, and each growth SHALL be followed by a choice of mutations, mostly build cards that change how fights play out, with Duo cards when both parents are owned.

#### Scenario: Choose a mutation
- **WHEN** the dish has finished growing
- **THEN** play stays paused and up to three cards appear under YOU GREW and the new size, at least two of them build cards when available, each labelled BUILD or EXTRA; pressing 1, 2 or 3, tapping a card or using the gamepad applies one and starts the next, faster size with dash charges refilled, 30 more light and 10 more max light up to 150

#### Scenario: No timer
- **WHEN** a player stays in one size for 90 seconds
- **THEN** the size does not end, a new wave arrives every 14 seconds from 40 seconds in, and from 60 seconds in a golden Orbium arrives every 12 seconds

#### Scenario: Leviathan
- **WHEN** the GROW bar fills in every third size (III, VI, IX)
- **THEN** a giant Heptapteryx arrives with a warning banner and three phase pips, other waves wait while it lives (see Leviathan phases), devouring it pays a large bonus, and the dish grows once it has left the dish

#### Scenario: Duo
- **WHEN** the player owns both parents of a Duo (for example Spore Burst and Nerve Net)
- **THEN** the Duo can take the third card slot, shown with a DUO tag and a two-color border, and it always does after a Leviathan kill

### Requirement: Arcade cabinet
The Cottage Arcade SHALL list Primordia in the Action row with a cabinet that boots the game, shows the saved best score and runs a live Lenia dish on its screen while selected.

#### Scenario: Play from the arcade
- **WHEN** a player selects Primordia, drops a token and presses Enter
- **THEN** the arcade loads /primordia/

#### Scenario: Live cabinet screen
- **WHEN** the Primordia cabinet is selected and the page is visible
- **THEN** its screen shows Orbium prey and a hunter moving in a small live dish; with reduced motion the still image stays

#### Scenario: Demo dishes never grow
- **WHEN** the cabinet screen or the title screen runs its demo dish
- **THEN** no GROW bar fills and the dish never zooms

### Requirement: Waves and roster
A director SHALL send scripted waves of distinct hunter roles each size, with relax beats between them and hard caps on bodies.

#### Scenario: Waves
- **WHEN** a size starts
- **THEN** three waves arrive (in Size I about 2, 12 and 24 seconds in; from Size II, after a 4-second calm, about 4, 14-15 and 26-28 seconds in; or 5 seconds after the previous wave is cleared; waves held back by a living Leviathan keep 8 seconds apart), a WAVE label shows, and clearing a wave fills a wave dot, pays 500 x size points and starts a 5-second relax beat with extra prey

#### Scenario: Roster
- **WHEN** waves arrive across Sizes I to IV
- **THEN** each size brings its own red arc (Paraptera in Size I, Pentapteryx in Size II, Hexapteryx in Size III, Heptapteryx in Size IV) with Discutium swarms that rush in to sting and then peel away for 1.6 seconds and Circium eggs that hatch a Discutium after 8 seconds unless a dash, a Burst or the player's mouth pops them

#### Scenario: Busy from the start
- **WHEN** Size I starts
- **THEN** a lancer and a swarm arrive at once, the second wave brings three bodies about 12 seconds in, and the third arrives about 24 seconds in

#### Scenario: New territory
- **WHEN** the first wave of Size II or later arrives
- **THEN** its warnings appear outside the area the old dish shrank into whenever a clear spot 34 to 70 cells from the player exists there

#### Scenario: Caps
- **WHEN** a wave would exceed 4 gliders, 4 swarm bodies, 4 eggs, 8 bodies or 1 common Heptapteryx (3, 3, 3, 6 and 1 on touch or portrait)
- **THEN** the extra units wait in a queue until a slot frees

### Requirement: Leviathan phases
On every third size a full GROW bar SHALL summon a Leviathan that changes its attacks as the player tears its wings off, and the dish SHALL grow only after it has left the dish.

#### Scenario: Summon
- **WHEN** the GROW bar fills in Size III, VI or IX
- **THEN** the bar reads APEX, no new wave arrives, the Leviathan waits until no other Hexapteryx or Heptapteryx is on the dish, then a LEVIATHAN banner says "Eat it to grow." and a giant Heptapteryx arrives after a 3-second warning with three phase pips

#### Scenario: Wing tears
- **WHEN** the player tears 20% of the Leviathan's mass, parries it or catches it in a Burst
- **THEN** a wing tears off, a phase pip goes dark, WING TORN shows, and the boss changes its attack: a double lunge in phase 2, faster lunges and egg laying in phase 3

#### Scenario: Collapse
- **WHEN** the third wing tears
- **THEN** the Leviathan collapses for 2.5 seconds with a timer ring, and a Glory Bite in that window devours it for full light, a full Burst meter, three Remains and a guaranteed Duo offer, and the dish grows about one second later

#### Scenario: Leviathan leaves
- **WHEN** the Leviathan leaves the dish without being devoured
- **THEN** the dish grows anyway, with no devour bonus and no guaranteed Duo

### Requirement: How to play intro
Primordia SHALL teach its moves with a short animated intro that plays scripted scenes on the real Lenia dish, with captions in plain words.

#### Scenario: First PLAY
- **WHEN** a player presses PLAY for the first time on a device
- **THEN** the intro plays before the run: a title card, then one scene each for eating, dodging a lane, cutting, the Glory Bite, the parry, Burst and growing, then an end card with PLAY and Watch again

#### Scenario: Each lesson shows its move
- **WHEN** an intro scene plays
- **THEN** the player cell performs that scene's move with the game's own rules (a devoured prey, a lunge that misses, a cut that turns a hunter gold, a Glory Bite and a caught prey, a parry that starts Stasis, a Burst that catches at least two hunters, a meal that fills the GROW bar and grows the dish, after which a hunter that turned into prey is eaten), a ring and label mark the creatures it talks about, and the caption names the control for the current device

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
- **THEN** lane outlines, stagger rings, edible rings, the GROW bar and its notch, and dash pips are at least 3 pixels thick and the glint star is at least 14 pixels across

## ADDED Requirements

### Requirement: Growth
The player SHALL grow by eating. A GROW bar SHALL fill with every meal and kill, hunters filling it most, and the player's cell SHALL get bigger as it fills, with a wider mouth and a wider cut.

#### Scenario: Meals fill the bar
- **WHEN** the player devours an Orbium, devours a golden Orbium, devours a converted Orbium, or Glory Bites a Paraptera
- **THEN** the GROW bar rises by 1, 4, 3 or 5 points (the Size I bar holds 34), a cyan +N shows at the meal and a chime plays a step higher

#### Scenario: The body grows
- **WHEN** the GROW bar goes from empty to full
- **THEN** the player's radius grows from its size's base to 1.5 times that base (2.4 to 3.6 cells in Size I), easing after each meal, the mouth and dash cut widen with it, swim speed stays the same, and the bigger body is easier to sting

#### Scenario: Outgrow the swarms
- **WHEN** the GROW bar passes half
- **THEN** Discutium swarms, brood under 200 mass and eggs get a gold dashed ring, swarms and brood swim away and stop stinging, and the player's mouth eats a swarm body whole or pops an egg on contact

#### Scenario: Full bar
- **WHEN** the GROW bar fills outside Size III, VI and IX
- **THEN** the bar turns gold, the player gets 0.8 seconds of i-frames, and once no Burst is running the dish grows: 0.25 seconds later if a red hunter is on the dish, otherwise when one arrives, at most 4 seconds later

#### Scenario: Growth only in play
- **WHEN** the intro (outside its grow scene), the title screen or the cabinet runs a dish
- **THEN** the GROW bar does not fill

### Requirement: The dish grows
When the GROW bar fills, the whole dish SHALL shrink into its middle quarter while the camera pulls back, and the hunters on it SHALL turn into living Orbium prey, with the dish keeping its cell count and its cost per frame.

#### Scenario: Pull-back
- **WHEN** the dish grows
- **THEN** play freezes for about 2 seconds while red tissue turns cyan in a ring that runs out from the player, the old dish shrinks into the middle quarter of a dish twice its size, and the camera pulls back from 2x to 1x over 1.2 seconds; the dish does not step while frozen and nothing can hurt the player

#### Scenario: Old hunters become food
- **WHEN** the dish grows with hunters on it
- **THEN** each lancer, swarm or brood body becomes one Orbium and each Hexapteryx or common Heptapteryx two, at most 6 in all, at least 28 cells apart and 16 cells from the player; golden prey stay golden; Remains dropped in the last 6 seconds come along as prey; eggs disappear; other old prey turn into light for the player (2 each, at most 10)

#### Scenario: The converted prey live
- **WHEN** play resumes after the dish grows
- **THEN** random prey wait 5 seconds before they restock, at least 85% of the converted Orbium are still alive 100 dish steps later on the tested seeds, and the first time a species converts in a run its Orbium shows a FOOD label that names the hunter it was for 3 seconds of play

#### Scenario: No credit at the swap
- **WHEN** the dish grows
- **THEN** no kill, bleed-out, rupture, self-death or wave clear is counted, and the score gains only the size bonus of 2000 x the new size

#### Scenario: New territory
- **WHEN** play resumes after the cards
- **THEN** the outer three quarters of the dish are fresh agar around the old dish, and no new hunter warns in for 4 seconds

#### Scenario: Grow layouts
- **WHEN** the dish grows at 1280×720, 390×844 or 844×390
- **THEN** the zoom stays inside the dish frame and never covers the HUD, the player's screen position moves no more than 2 pixels at the swap, and with reduced motion a short fade replaces the pull-back

### Requirement: Hunter tiers
Each size SHALL bring a bigger red arc with one new move, and an arc species that has turned into prey SHALL not come back red in Sizes II to IV.

#### Scenario: Never return
- **WHEN** Sizes II to IV run, including encores and loop waves
- **THEN** no Paraptera spawns red after Size I, no Pentapteryx after Size II, and no Hexapteryx after Size III

#### Scenario: Double strike
- **WHEN** a Pentapteryx finishes a lunge that was not blocked
- **THEN** it re-aims for at least 0.25 seconds with a fresh lane and glint and lunges again, unless that lane is blocked, and the player can parry either glint

#### Scenario: Egg layer
- **WHEN** a Hexapteryx stalks in Size III
- **THEN** it lays a Circium egg behind its glide 4 seconds after it arrives and then every 7 seconds, with at most 2 of its eggs alive and within the egg cap

#### Scenario: Fast strike
- **WHEN** a Heptapteryx attacks in Size IV
- **THEN** it winds up for 14 steps instead of 20 and lunges at 2.0 cells per step for 10 steps, like the Leviathan's last phase, and only one common Heptapteryx is on the dish at a time

#### Scenario: New hunter banner
- **WHEN** a size starts
- **THEN** a banner names its red hunter and its move in one plain sentence

#### Scenario: Tier cue
- **WHEN** the size rises
- **THEN** hostile tissue stays red while its heartbeat quickens and its white-hot core grows, up to Size V, and hunters that turn into prey take the prey colours

#### Scenario: Deep dish
- **WHEN** the run reaches Size V or later
- **THEN** Heptapteryx stay the red arc with every move at once (double strike, egg laying, fast strike), every wave brings one, the rest comes from a budget that grows with the size, and the Leviathan guards every third size
