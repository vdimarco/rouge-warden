## ADDED Requirements

### Requirement: The Lamp-room is a place
Between runs the Lamp-room SHALL be a baked place, `lamproom`, with an open front, the painted look of the five places and no foes. The title's Lamp-room button, the end of a run and a win SHALL load it, with the lamplighter at the spawn facing the run door. It SHALL never show in the Map.

#### Scenario: The title opens the hall
- **WHEN** the player presses Lamp-room on the title
- **THEN** `__gloam.place()` is `lamproom`, the lamplighter stands at (0, 5), no foe slot is awake, and the start view's mean luminance is between 0.07 and 0.16. Check: e2e `gloam-downs-hub.e2e.mjs`.

#### Scenario: A death walks back to the hall
- **WHEN** a run ends in a death and the player closes the summary
- **THEN** the hall loads and the well's card holds the run's recap. Check: e2e `gloam-downs-hub.e2e.mjs`.

### Requirement: Stations in the hall
The hall SHALL have these 12 stations, each with its own object: the lamp shelf (wares), the kiln (patterns), the pane window (panes), the wick rack (unlocks), the blade rack (blades), the off-hand stand (off-hands), the ability post (abilities), the trophy wall (keys), the Ember bell, the map table, the well and the run door. Each SHALL be reachable on the walk map and within 6 m of the spawn-to-door path.

#### Scenario: Every station is in reach
- **WHEN** the bake checks `lamproom`
- **THEN** each of the 12 station marks is reachable from the spawn with `reachable`, and each is within 6 m of the path to the door. Check: `node games/gloam-downs/bake.mjs lamproom --check`, and Node test `gloam-downs-hub.test.mjs`.

### Requirement: Station cards
Within 1.6 m of a station and facing it within 70 degrees, the hall SHALL show the station's name and its Use key. Use SHALL open a card with only that station's rows, made by the same row makers and Buy, Kindle and Set rules as the quick list. Esc, B, the close button, walking away for 0.3 s or moving 2.5 m away SHALL close it. The lamplighter SHALL stand still while it is open.

#### Scenario: The lamp shelf shows only wares
- **WHEN** the lamplighter walks to the lamp shelf and presses E
- **THEN** a card opens with one row a ware and no pattern, pane or unlock row. Check: e2e `gloam-downs-hub.e2e.mjs`.

#### Scenario: Walk away to close
- **WHEN** the lamp shelf's card is open and the player holds Left for 0.3 s
- **THEN** the card is shut and the lamplighter walks. Check: e2e `gloam-downs-hub.e2e.mjs`.

### Requirement: Station input
Use SHALL be E or Enter on keys, A on a pad, a click on the prompt or on a station within 3 m, and a Use button of at least 44 px on touch. In a card, arrows, W and S, the d-pad or the stick SHALL move the focus, and Enter, A, a click or a tap SHALL press. Every station SHALL work with keys alone, a pad alone, a mouse and touch alone.

#### Scenario: Buy with a pad alone
- **WHEN** a pad walks to the lamp shelf, presses A, moves to Mantle's Buy and presses A with 50 glim banked
- **THEN** Mantle is level 1 and 10 glim is banked. Check: e2e `gloam-downs-hub.e2e.mjs`.

#### Scenario: Buy with touch alone
- **WHEN** at 390x844 with touch, the player walks with the stick to the kiln, taps Use and taps Kindle on a found pattern with enough glim
- **THEN** the pattern is kindled. Check: e2e `gloam-downs-hub.e2e.mjs`.

### Requirement: Station cards in every layout
A station card SHALL sit beside its station at 800x600 and 1280x720, at most 360 px wide and 16 px inside the screen; a bottom sheet at most 55% high at 320x640, 360x640 and 390x844, with the station in view above it; and a side sheet at most 45% wide at 844x390. It SHALL never cover the Lab bar, and SHALL scroll inside itself.

#### Scenario: Six layouts
- **WHEN** the lamp shelf's card opens at 320x640, 390x844, 360x640, 844x390, 800x600 and 1280x720
- **THEN** it follows the rule for each size, every button is reachable by scroll, and the station's screen point is outside the card. Check: e2e `gloam-downs-hub-layout.e2e.mjs`.

### Requirement: The quick list
Tab, the pad's View button or a touch List button of at least 44 px SHALL open one card with every station's rows, anywhere in the hall. It SHALL keep the rules of today's Lamp-room card: focus kept in the card, Buy off and focusable when glim is short, and the Ember row after a first win.

#### Scenario: Tab opens everything
- **WHEN** the lamplighter stands at the spawn and the player presses Tab
- **THEN** one card shows headings in the order Blades, Off-hands, Abilities, Panes, Patterns, Wares, Unlocks, Keys, Ember, each with its rows, and Esc shuts it. Check: e2e `gloam-downs-hub.e2e.mjs`.

### Requirement: The hall grows
The hall SHALL show what the save owns and nothing else: a ware's lamp with one lit ring a level, an unlit lamp on the kiln for each found pattern and a lit one on its hood for each kindled one, set panes as coloured glass and shutters on slots not bought, a lit wick for each unlock, each kindled blade on the blade rack, each kindled off-hand on the stand, a trophy for each key and a plaque for each elite put out.

#### Scenario: Buy lights a ring
- **WHEN** Mantle goes from level 2 to 3 at the lamp shelf
- **THEN** Mantle's third ring range gets its baked density back, the cue log has `buy`, and the other ranges do not change. Check: Node test `gloam-downs-hub.test.mjs`, and e2e `gloam-downs-hub.e2e.mjs`.

#### Scenario: A first key goes on the wall
- **WHEN** the save gains Crow step and the hall loads
- **THEN** the Crow step trophy's range is shown and the Bell drop trophy's range is at density 0. Check: Node test `gloam-downs-hub.test.mjs`.

### Requirement: Try the build at the ability post
In the hall, Attack, Roll, the off-hand and both abilities SHALL work at the ability post, with cooldowns at a quarter of their length, damage numbers over the post, and nothing spent. Its card SHALL let the player put any two kindled abilities in the slots to try, in the hall only.

#### Scenario: A bomb at the post
- **WHEN** the lamplighter throws Lantern bomb at the post
- **THEN** the post shows 28, and the bomb is ready again 2 s later. Check: e2e `gloam-downs-hub.e2e.mjs`.

### Requirement: Begin the run from the hall
The map table SHALL show the seed's route as five lamps, with Begin the run, Wander and Explore. The Ember bell SHALL pick the Ember level among those open. Walking through the run door or pressing Use at it SHALL begin a run at that level. While the hall shows, the page SHALL fetch the run's first place's bytes.

#### Scenario: Through the door
- **WHEN** Ember 2 is picked at the bell and the lamplighter walks through the door
- **THEN** a run starts at Ember 2 in its route's first place. Check: e2e `gloam-downs-hub.e2e.mjs`.

### Requirement: The beacon shrine
At a lit beacon, nothing SHALL load. The beacon card's "Go to the shrine" SHALL leave the lamplighter at the beacon with a station card open beside it, with tabs Wares, Patterns and Panes, switched by Left and Right, LB and RB, or a tap. It SHALL spend the glim carried first, then the bank.

#### Scenario: Spend at the shrine
- **WHEN** the lamplighter lights the Gaol's beacon with 50 carried and 30 banked, opens the shrine and buys Mantle 1 for 40
- **THEN** no place loads, 10 is carried and 30 is banked. Check: Node test `gloam-downs-hub.test.mjs`, and e2e `gloam-downs-hub.e2e.mjs`.

### Requirement: The hall's life and sound
The hall SHALL have life from `life.js` (dust in the torch light, the kiln's fire, the well's water and shelf lamps that brighten near the lamplighter, at most 1,200 dabs) and a bed from `beds.js` (a room tone, a drip from the well, the kiln's crackle), with the Lamp-room's music.

#### Scenario: Life and bed in the hall
- **WHEN** the hall shows for 10 s
- **THEN** life draws at most 1,200 dabs, a shelf lamp within 4 m is brighter than one 8 m away, and the bed's level is under the music's. Check: Node test `gloam-downs-life.test.mjs`, and `node qa/lab/gloam-downs-music-demo.mjs beds`.

### Requirement: The hall with reduced motion
With reduced motion, the camera SHALL NOT glide to frame a station, a card SHALL show at once, a new light SHALL come on at once, and life SHALL follow its reduced rules.

#### Scenario: Reduced motion
- **WHEN** the page runs with reduced motion and a ware is bought at the shelf
- **THEN** the camera does not move, and the ring is at full density on the next frame. Check: e2e `gloam-downs-hub-layout.e2e.mjs`.

### Requirement: The hall's budget and load
The hall SHALL hold at most 210,000 splats (160,000 scenery, 46,000 growth objects), download at most 0.40 MB gzip with a walk file of at most 4 KB, and bake in at most 20 s. On the phone profile (1.6 Mbit/s, 150 ms, CPU slowed 4 times) its first frame SHALL come within 4.0 s cold and 1.5 s warm.

#### Scenario: The budget
- **WHEN** `lamproom` is baked
- **THEN** its counts and sizes are inside the budget. Check: `node games/gloam-downs/bake.mjs lamproom --check`.

#### Scenario: The phone load
- **WHEN** the hall loads on the phone profile with an empty cache, and again with a warm one
- **THEN** the first frame comes within 4.0 s and 1.5 s. Check: e2e `gloam-downs-hub.e2e.mjs`. No real phone runs here.

### Requirement: Char and Soot
Char SHALL stack to 5 on a foe, each stack dealing 1 a second for 4 s from the last added, and the 5th SHALL burst for 20 and clear them. Soot SHALL deal 2 a second for 6 s; a sooted foe put out SHALL pass 4 s of Soot to each foe within 2.5 m, once. The Barrow Reeve SHALL take only Char's burst.

#### Scenario: Five stacks burst
- **WHEN** a Snuffer gets 5 Char in 1 s
- **THEN** it takes 20 at the 5th and has 0 stacks after. Check: Node test `gloam-downs-states.test.mjs`.

#### Scenario: Soot passes on
- **WHEN** a sooted Snuffer is put out with two foes 2 m away and one 3 m away
- **THEN** the two have 4 s of Soot and the third has none. Check: Node test `gloam-downs-states.test.mjs`.

### Requirement: Blind and Mark
A blind foe's next attack started within 3 s (1.5 s for a heavy foe) SHALL play and deal 0. A Mark SHALL last 4 s, and the lamplighter's next hit on the foe SHALL burst it for 22. The Barrow Reeve SHALL take neither.

#### Scenario: A blind hook misses
- **WHEN** a blind Snuffer hooks the lamplighter in reach
- **THEN** the hook plays and the lamplighter's health does not change. Check: Node test `gloam-downs-states.test.mjs`.

### Requirement: Ticks never interrupt
A tick of Char, Soot or burn SHALL NOT make a foe flinch, wear its poise, stop a wind-up, add to the combo or give glim. Ticks on one foe SHALL deal at most 8 a second together. A burst of Char or Mark SHALL be a hit under the fair-fight rules.

#### Scenario: A ticking foe still swings
- **WHEN** a Snuffer with 5 s of Soot and 4 Char starts its hook
- **THEN** the hook lands on time, its poise is unchanged, and the ticks deal at most 8 in that second. Check: Node test `gloam-downs-states.test.mjs`.

### Requirement: Sure cuts
A sure cut SHALL deal 1.5 times, after the added bonuses, with a brighter spark, a 1-step longer hit stop and the `sure` cue. A hit SHALL be sure from Sure hand on a stunned, held or blind foe, from Shutter, or by Whetstone's chance of 4% a level from the seed's `sure` stream.

#### Scenario: Sure hand on a held foe
- **WHEN** with Sure hand the first cut hits a foe held by Ember snare
- **THEN** the hit deals 1.5 times the same cut on a free foe, and the cue log has `sure`. Check: Node test `gloam-downs-kit.test.mjs`.

### Requirement: The ward shell
The lamplighter SHALL have a shell that takes damage before health. All sources together SHALL hold at most 40% of the max health (50% with the Ward set), each with its own time, and Horn lamp SHALL make each 20% bigger a level. The HUD SHALL show it as a pale band over the health bar.

#### Scenario: The shell takes the blow
- **WHEN** with a 20 shell and 100 health a hook deals 16
- **THEN** the shell is 4 and health is 100. Check: Node test `gloam-downs-kit.test.mjs`, and e2e `gloam-downs-run.kit.e2e.mjs`.

### Requirement: New Flame abilities
Wick lash, Shard fan and Oil slick SHALL be Flame abilities with the cooldowns, costs and numbers of design.md "New abilities". Each SHALL have a tell before its effect and its cue with `ability: <id>`, and SHALL scale with Flame, bright lamps, Gloam cooldowns and Smoked glass as the other abilities do.

#### Scenario: Wick lash
- **WHEN** Wick lash is used with two Snuffers on a line 3 m and 4.5 m ahead
- **THEN** each takes 14 and burns for 3 s. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Shard fan
- **WHEN** Shard fan is used at a Snuffer 4 m ahead
- **THEN** it takes 6 and 1 Char for each shard that hits, up to 30; five hits make 5 Char, which bursts for 20. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Burn lights the slick
- **WHEN** a Lantern bomb bursts on an Oil slick with a foe in it
- **THEN** the slick burns for 4 s and the foe takes 5 every 0.5 s. Check: Node test `gloam-downs-kit.test.mjs`, and e2e `gloam-downs-run.kit.e2e.mjs`.

### Requirement: New Ward abilities
Bell toll, Ember shell and Post lamp SHALL be Ward abilities with the numbers of design.md "New abilities", and the same tells, cues and scaling as the other abilities.

#### Scenario: Bell toll
- **WHEN** Bell toll rings with a Snuffer and an Ironback within 3.5 m
- **THEN** the Snuffer is stunned 0.8 s and the Ironback loses 40 poise. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Ember shell bursts
- **WHEN** an Ember shell breaks with a foe 2 m away
- **THEN** the foe takes 15 and burns 2 s. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Back to the post lamp
- **WHEN** a Post lamp stands 6 m away and the player uses it again
- **THEN** the lamplighter is at the lamp 0.15 s later, safe on the way, and the lamp is gone. Check: Node test `gloam-downs-kit.test.mjs`, and e2e `gloam-downs-run.kit.e2e.mjs`.

### Requirement: New Gloam abilities
Tack scatter, Shutter, Moth swarm and Gloam blink SHALL be Gloam abilities with the numbers of design.md "New abilities", and the same tells, cues and scaling as the other abilities.

#### Scenario: Tack scatter
- **WHEN** a Snuffer walks over a tack
- **THEN** it takes 4, 1 Char and a 30% slow for 1 s, and that tack is gone. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Shutter
- **WHEN** Shutter is used with two Snuffers near and not winding up
- **THEN** neither starts an attack for 2 s, and the next blade hit within 3 s is sure. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Moths seek fire
- **WHEN** Moth swarm is used with a burning foe 6 m away and a free foe 2 m away
- **THEN** the moths go to the burning foe. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Blink and Mark
- **WHEN** Gloam blink passes through a Snuffer and the next cut hits it
- **THEN** the cut deals its damage plus 22. Check: Node test `gloam-downs-kit.test.mjs`, and e2e `gloam-downs-run.kit.e2e.mjs`.

### Requirement: New panes
Cinder, Spill, Rush, Thirst, Shard and Cracked glass SHALL be panes with the colours, costs and rules of design.md "New buffs". A Spill chain SHALL stop after 3. Cracked glass SHALL crack after 3 hits taken in a place and give nothing until the next beacon.

#### Scenario: Cinder glass
- **WHEN** with Cinder glass the lamplighter is at 25% health and cuts
- **THEN** the cut deals 30% more than at full health. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Spill stops at 3
- **WHEN** with Spill glass a foe put out sets off a chain through five foes on low health
- **THEN** at most 3 bursts happen. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Cracked glass cracks
- **WHEN** with Cracked glass the lamplighter takes a third hit in a place
- **THEN** the bonus is 0, the cue log has `crack`, and the bonus is back after the next beacon. Check: Node test `gloam-downs-kit.test.mjs`.

### Requirement: New wicks
Sure hand and Char wick SHALL join the wick pool, and Count wick and Shell wick SHALL join it once Wick crate is bought, with the rules of design.md "New buffs". Count wick's free bomb SHALL count as an ability use.

#### Scenario: Count wick
- **WHEN** with Count wick a combo reaches 12 hits with a foe 5 m away
- **THEN** a Lantern bomb at 75% power bursts on it, and Hot glass counts it. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Wick crate opens wicks
- **WHEN** Wick crate is not bought
- **THEN** no seed's offer holds Count wick or Shell wick. Check: Node test `gloam-downs-kit.test.mjs`.

### Requirement: New relics and kindlings
Char edge, Soot heel, Glass drink and Thorn roll SHALL be relics with the moves, rules and kindlings of design.md "New buffs". Thorn roll's damage SHALL NOT make a foe flinch.

#### Scenario: Glass drink kindled
- **WHEN** with Glass drink and Spare oil the lamplighter drinks
- **THEN** the shell is 30 for 5 s. Check: Node test `gloam-downs-kit.test.mjs`.

### Requirement: New wares and unlocks
The lamp shelf SHALL sell Whetstone (90, 200, 360) and Horn lamp (120, 280), and the wick rack SHALL sell Blade rack (150) and Wick crate (180), with the rules of design.md "New buffs".

#### Scenario: Whetstone is seeded
- **WHEN** two runs with the same seed and Whetstone 3 make the same 200 blade hits
- **THEN** the same hits are sure, and about 12% of them. Check: Node test `gloam-downs-kit.test.mjs`.

### Requirement: Gloam dash
The Fen-wick's first fall SHALL give the lasting key Gloam dash. With it, Roll in the air SHALL dash 3.5 m level, safe for 0.15 s, once until the lamplighter lands. Its trophy SHALL go up on the hall's wall.

#### Scenario: Dash once in the air
- **WHEN** with Gloam dash the lamplighter jumps and presses Roll twice in the air
- **THEN** it moves 3.5 m on the first press and nothing on the second. Check: Node test `gloam-downs-kit.test.mjs`, and e2e `gloam-downs-run.kit.e2e.mjs`.

### Requirement: Colour sets
Three of one colour among the held blade, the held off-hand, the slotted abilities, set panes and held relics (by their move's colour) SHALL turn on that colour's set, with the rules of design.md "New buffs". The HUD's colour row SHALL ring a colour whose set is on.

#### Scenario: The Gloam set
- **WHEN** Smoke step and Moth swarm are slotted and Storm glass is set, and Smoke step is used
- **THEN** Moth swarm's cooldown drops by 1 s more than without the set, and Gloam is ringed. Check: Node test `gloam-downs-kit.test.mjs`.

### Requirement: Gaining the new things
The new abilities, panes, blades and off-hands SHALL be patterns, found and kindled as the others are. A pattern drop SHALL pick a kind with odds ability 40, pane 30, blade 15, off-hand 15 (45:35:0:20 before Blade rack), passing an empty kind to the next, then one from the seed's `pattern` stream.

#### Scenario: Same seed, same patterns
- **WHEN** two runs with the same seed and save put out the same foes
- **THEN** they drop the same patterns. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: No blade patterns before Blade rack
- **WHEN** 1,000 pattern drops are drawn for a save without Blade rack
- **THEN** none is a blade, and the kinds are within 3 points of 45:35:0:20. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: The power budget
Held alone, each new buff SHALL add at most 20% damage a second on the bot's reference string against a Snuffer, or at most 25% effective health. Pacing SHALL be measured again with 60 bots a skill after this change and the fair-fight change both land, against the fair-fight targets, and no build family SHALL clear a place more than 15% faster than the mean of all families.

#### Scenario: One buff alone
- **WHEN** the test measures each new buff alone on the reference string
- **THEN** none adds more than 20% damage a second or 25% effective health. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Pacing after both changes
- **WHEN** the bot runs 60 runs a skill at 0.3, 0.5 and 0.9 on the merged code
- **THEN** the fair-fight targets hold, and design.md records the numbers. Check: `node qa/lab/gloam-downs-bot.mjs`.

### Requirement: Categories and slots
Everything the player can gain SHALL sit in one category: Blade (1 slot), Off-hand (1 slot), Abilities (2 slots), Panes (1 to 3 slots), Wicks (one pick a beacon, at most 5 a run), Relics (from elites, at most 5), Sparks (the colour levels), Patterns (plans), and the lasting wares, unlocks, keys and Ember. A run SHALL hold at most one item a gear slot.

#### Scenario: One item a slot
- **WHEN** a run holds a blade, an off-hand and two abilities and the lamplighter takes a found blade
- **THEN** the run holds one blade, the found one, and the old one lies on the ground. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: Gear grows with its colour
Every blade, off-hand and ability SHALL have one colour, and its numbers SHALL grow with that colour's level by `colourPower`. The blade's damage bonus SHALL use the held blade's colour in place of Flame alone, so the Lamp blade keeps today's numbers.

#### Scenario: A Ward blade grows with Ward
- **WHEN** the Bell maul is held with Ward 3 and Flame 0, and again with Ward 0 and Flame 3
- **THEN** its cut deals 30% more in the first case than with no sparks, and the same as with no sparks in the second. Check: Node test `gloam-downs-gear.test.mjs`.

#### Scenario: The Lamp blade keeps its numbers
- **WHEN** a save from before this change cuts a Snuffer with Flame 2
- **THEN** the cut deals what it dealt before this change. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: Blades
The Lamp blade (Flame, from the first run), Hook blade (Flame), Twin knives (Gloam) and Bell maul (Ward) SHALL be blades with the strings, speeds, reach and damage of design.md "Blades", drawn with today's cut poses. Once Blade rack is bought, the other three SHALL join the pattern drops. A run SHALL start with the blade picked at the blade rack, plain.

#### Scenario: The twin string
- **WHEN** with Twin knives the player presses Attack four times on a Snuffer
- **THEN** four cuts land at 65% damage each, and the fourth adds 1 Char. Check: Node test `gloam-downs-gear.test.mjs`, and e2e `gloam-downs-run.gear.e2e.mjs`.

#### Scenario: The bell slam
- **WHEN** with the Bell maul the player holds Attack 0.5 s with two foes within 2.5 m
- **THEN** each takes 30. Check: Node test `gloam-downs-gear.test.mjs`.

#### Scenario: The start blade
- **WHEN** the Hook blade is kindled and picked at the blade rack, and the run begins
- **THEN** the run holds the Hook blade, plain, with no traits. Check: e2e `gloam-downs-hub.e2e.mjs`.

### Requirement: Swap gear on the ground
A found blade or off-hand SHALL lie on the ground with a glow in its colour. Standing on it SHALL show the compare toast. Holding Attack 0.4 s on a blade, or Off-hand 0.4 s on an off-hand, SHALL take it and leave the old one there with its tier and traits; a tap SHALL still cut or use. Ability lamps SHALL swap as today.

#### Scenario: Hold to swap a blade
- **WHEN** the lamplighter stands on a bright Hook blade holding a plain Lamp blade and holds Attack 0.4 s
- **THEN** the run holds the bright Hook blade, the plain Lamp blade lies there, and the cue log has `swap`. Check: e2e `gloam-downs-run.gear.e2e.mjs`.

#### Scenario: A tap still cuts
- **WHEN** the lamplighter stands on a blade and taps Attack
- **THEN** the first cut plays and the held blade is the same. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: The off-hand slot and its input
The off-hand SHALL have its own button and cooldown: V or O on keys, the middle mouse button, RB on a pad (facing the foe moves to R3), and an Off-hand touch button of at least 44 px beside the ability buttons. A run SHALL start with the off-hand picked at the off-hand stand, plain, or none. Every off-hand SHALL work with keys alone, a pad alone, a mouse and touch alone.

#### Scenario: The off-hand on every input
- **WHEN** with the Sling held the player presses V, then the middle mouse button, then RB, then taps the Off-hand button, each after its cooldown
- **THEN** the Sling throws four times. Check: e2e `gloam-downs-run.gear.e2e.mjs`.

#### Scenario: Facing on R3
- **WHEN** a pad presses R3 with a foe 3 m to the side
- **THEN** the lamplighter turns to face it. Check: e2e `gloam-downs-run.gear.e2e.mjs`.

### Requirement: The Buckler
The Buckler (Ward, from the first run, 1.2 s) SHALL be raised for 0.6 s. A blow in its first 0.2 s SHALL be parried: 0 damage, a light foe staggered 0.6 s, a heavy foe losing 30 poise, and the next cut sure. A blow later in the raise SHALL deal 40%. A new save SHALL have the Buckler picked.

#### Scenario: A parry
- **WHEN** a Snuffer's hook lands 0.1 s after the Buckler is raised
- **THEN** health does not change, the Snuffer staggers 0.6 s, the cue log has `parry`, and the next cut is sure. Check: Node test `gloam-downs-gear.test.mjs`, and e2e `gloam-downs-run.gear.e2e.mjs`.

#### Scenario: A late block
- **WHEN** a 20 hook lands 0.4 s after the Buckler is raised
- **THEN** it deals 8. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: The other off-hands
Iron cuff (Ward), Sling and Fire pot (Flame), Lamp chain and Shade lamp (Gloam) SHALL be off-hands with the costs, cooldowns and rules of design.md "Off-hands". Each SHALL have a tell before its effect and its cue. An off-hand's hit SHALL NOT be blade damage, and SHALL follow the fair-fight rules.

#### Scenario: Lamp chain
- **WHEN** Lamp chain is used with a Snuffer 6 m ahead
- **THEN** the lamplighter is beside it 0.2 s later, safe on the way, and it takes 6 and a Mark. Check: Node test `gloam-downs-gear.test.mjs`.

#### Scenario: Shade lamp
- **WHEN** Shade lamp is raised with one Snuffer 3 m ahead and one 3 m behind
- **THEN** the one ahead is Blind and the one behind is not. Check: Node test `gloam-downs-gear.test.mjs`.

#### Scenario: Sling on a burning foe
- **WHEN** the Sling hits a burning Snuffer 8 m away
- **THEN** it takes 8 and 1 Char. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: Quality tiers
Found gear SHALL come in three tiers: plain (power x1.0, no trait), bright (x1.25, 1 trait) and blazing (x1.4, 2 different traits). Power SHALL multiply the item's damage, heals and shell points after its colour, and SHALL NOT change a cooldown, a time or a reach. A start item SHALL be plain, except Belt 3's start abilities, which SHALL be bright.

#### Scenario: A blazing bomb
- **WHEN** a blazing Lantern bomb with no Flame bursts on a Snuffer
- **THEN** it deals 28 x1.4, rounded once, and its cooldown is 8 s. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: Tiers by place depth
A gear drop's tier SHALL come from the row of design.md "Drop tables" for the place's depth in the route, from plain 90, bright 10, blazing 0 at depth 0 to 35, 42, 23 at depth 4. An elite or a cache SHALL use the next row. Each Keen eye level SHALL move 4 points from plain to bright, each Ember level 2 points from plain to blazing, and plain SHALL never go under 10.

#### Scenario: Deeper drops are better
- **WHEN** 10,000 tiers are drawn at each depth with no Keen eye and Ember 0
- **THEN** each depth's shares are within 1.5 points of its row, and blazing grows with depth. Check: Node test `gloam-downs-gear.test.mjs`.

#### Scenario: The first place drops no blazing gear
- **WHEN** a foe in the run's first place drops gear with no Keen eye and Ember 0
- **THEN** it is plain or bright. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: Gear drops
Each foe put out SHALL roll once for gear: 3% and 1% more a Keen eye level, 60% for an elite, at most 3 a place. The kind SHALL be ability 50, blade 25, off-hand 25 (65:0:35 before Blade rack), and the item one kindled item of that kind. The kind and item SHALL come from the seed's `gear` stream, the tier from `tier`, the traits from `trait`, each with its own counter.

#### Scenario: Same seed, same gear
- **WHEN** two runs with the same seed and save put out the same foes
- **THEN** they drop the same gear with the same tiers and traits, and a third run that skips one wick pick still drops the same gear. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: Traits
A bright item SHALL roll 1 trait and a blazing item 2 different ones, from the traits of design.md "Traits" that fit its kind: Smouldering, Steady, Gleaning, Charring, Quick, Wide, Weighted, Hoarding, Shelling and Dimming. Traits on two items SHALL add. Their ticks SHALL count in the tick cap, their shells in the shell cap, and Steady's chance SHALL add to Whetstone's.

#### Scenario: Smouldering burns
- **WHEN** a bright blade with Smouldering cuts a Snuffer
- **THEN** the Snuffer burns for 2 s, and the burn never makes it flinch. Check: Node test `gloam-downs-gear.test.mjs`.

#### Scenario: Gleaning heals on a kill
- **WHEN** a Sling with Gleaning puts out a foe with max health 100
- **THEN** health rises by 2. Check: Node test `gloam-downs-gear.test.mjs`.

#### Scenario: Traits fit the kind
- **WHEN** 1,000 blazing abilities are drawn
- **THEN** none has Weighted or Dimming, and none has the same trait twice. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: Patterns for every category
A pattern SHALL be the plan of any ability, pane, blade or off-hand not there from the first run. Kindled at the kiln, it SHALL join that category's drops, and a blade or off-hand SHALL also show at its rack or stand. The pattern pool SHALL hold 37: 17 abilities, 12 panes, 3 blades and 5 off-hands.

#### Scenario: A kindled off-hand drops
- **WHEN** the Fire pot pattern is kindled and a run's gear roll picks an off-hand
- **THEN** the Fire pot may drop, and it hangs on the off-hand stand in the hall. Check: Node test `gloam-downs-gear.test.mjs`, and Node test `gloam-downs-hub.test.mjs`.

### Requirement: The gear row on the HUD
The HUD SHALL show the gear row: tiles for the Blade, Off-hand, Ability 1 and Ability 2, a small tile for each open pane slot, and the wick count. Each tile SHALL show its category glyph, a colour edge with the colour's corner shape, and the tier mark (none, one pip, two pips). The off-hand and ability tiles SHALL show the cooldown. A label SHALL name every slot, tier and trait.

#### Scenario: The row by category
- **WHEN** a run holds a bright Hook blade with Smouldering, the Buckler, Lantern bomb and nothing in slot 2
- **THEN** the row shows a blade tile with a Flame edge and one pip, a shield tile with a Ward edge, a lamp tile, and a dashed empty tile, and the label names each. Check: e2e `gloam-downs-gear-hud.e2e.mjs`.

#### Scenario: Read on a grey screen
- **WHEN** the gear row is drawn in greyscale
- **THEN** the corner shapes and pips still tell each colour and tier apart. Check: e2e `gloam-downs-gear-hud.e2e.mjs`.

### Requirement: The gear row in every layout
At 1280x720 and 800x600 the gear row SHALL sit at the bottom left with 40 px tiles. At 390x844, 360x640 and 320x640 it SHALL sit under the life row in one line of at most 300 px with 32 px tiles, and at 844x390 under the life row with 28 px tiles. It SHALL never cover the Lab bar, the boss bar, the stick or a touch button. The touch Off-hand and ability buttons SHALL show the same marks at 44 px or more.

#### Scenario: Six layouts
- **WHEN** a run with all four gear slots full shows at 320x640, 390x844, 360x640, 844x390, 800x600 and 1280x720
- **THEN** the gear row follows the rule for each size, overlaps no control, and the touch buttons are at least 44 px with their marks. Check: e2e `gloam-downs-gear-hud.e2e.mjs`, with screenshots under `SHOTS`.

### Requirement: Cards by category
Every choice card and station row SHALL start with its category glyph and word, show its colour edge, its tier mark when it has one, and a line a trait. On a ground blade, off-hand or ability lamp, the compare toast SHALL show the held item over the found one with tiers, traits and the way to swap, in two lines with no numbers at 320x640, and SHALL never cover a touch button.

#### Scenario: The compare toast
- **WHEN** the lamplighter at 320x640 stands on a blazing Sling while holding a plain Buckler
- **THEN** a two-line toast shows "Off-hand: Buckler" over "Off-hand: Sling, blazing" with its two traits and "Hold Off-hand to swap", clear of the touch buttons. Check: e2e `gloam-downs-gear-hud.e2e.mjs`.

#### Scenario: A pane card shows its category
- **WHEN** the beacon shrine's Panes tab opens
- **THEN** each row starts with the pane glyph and the word Pane and has its colour edge, and no row has a tier mark. Check: e2e `gloam-downs-hub.e2e.mjs`.

### Requirement: The save keeps the gear
The save SHALL keep the start `blade` and `offhand`, and in a run the held blade, off-hand and abilities as `{ id, tier, traits }`, the gear on the ground with its place, and the draw counters, so a reload gives the same gear and drops. `clean()` SHALL make an unknown tier plain, keep only known traits that fit, differ and fit the tier's count, and make an unknown blade the Lamp blade and an unknown off-hand none.

#### Scenario: A reload keeps the gear
- **WHEN** a run holding a bright Twin knives with Quick is saved and loaded
- **THEN** it holds the bright Twin knives with Quick, and the next gear drop is the same as without the reload. Check: Node test `gloam-downs-gear.test.mjs`.

#### Scenario: An old save moves to v4
- **WHEN** a v3 save with a run holding a bright Lantern bomb loads
- **THEN** it is v4 with its glim, wares and kindled list kept, the Lamp blade and Buckler picked, the run holding the Lamp blade plain and no off-hand, and the bomb bright with no trait. Check: Node test `gloam-downs-gear.test.mjs`.

### Requirement: The gear budget
One trait alone and each off-hand alone SHALL keep the one-buff rule. Each plain blade SHALL deal within 10% of the Lamp blade's damage a second on the reference string against a Snuffer. A bright item with its trait SHALL add at most 40%, and a blazing item with its two traits at most 60%, to the damage a second of the same item plain.

#### Scenario: Tiers stay inside the budget
- **WHEN** the test measures every blade, off-hand and ability plain, bright with each trait, and blazing with each pair of traits
- **THEN** each is inside its limit. Check: Node test `gloam-downs-gear.test.mjs`.
