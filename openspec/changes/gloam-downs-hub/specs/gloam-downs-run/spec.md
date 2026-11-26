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
The hall SHALL have these stations, each with its own object: the lamp shelf (wares), the kiln (patterns), the pane window (panes), the wick rack (unlocks), the temper rack (tempers), the trophy wall (keys), the training post, the Ember bell, the map table, the well and the run door. Each SHALL be reachable on the walk map and within 6 m of the spawn-to-door path.

#### Scenario: Every station is in reach
- **WHEN** the bake checks `lamproom`
- **THEN** each of the 11 station marks is reachable from the spawn with `reachable`, and each is within 6 m of the path to the door. Check: `node games/gloam-downs/bake.mjs lamproom --check`, and Node test `gloam-downs-hub.test.mjs`.

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
- **THEN** one card shows the wares, patterns, panes, unlocks, tempers and the Ember row, and Esc shuts it. Check: e2e `gloam-downs-hub.e2e.mjs`.

### Requirement: The hall grows
The hall SHALL show what the save owns and nothing else: a ware's lamp with one lit ring a level, an unlit lamp on the kiln for each found pattern and a lit one on its hood for each kindled one, set panes as coloured glass and shutters on slots not bought, a lit wick for each unlock, a blade for each kindled temper, a trophy for each key and a plaque for each elite put out.

#### Scenario: Buy lights a ring
- **WHEN** Mantle goes from level 2 to 3 at the lamp shelf
- **THEN** Mantle's third ring range gets its baked density back, the cue log has `buy`, and the other ranges do not change. Check: Node test `gloam-downs-hub.test.mjs`, and e2e `gloam-downs-hub.e2e.mjs`.

#### Scenario: A first key goes on the wall
- **WHEN** the save gains Crow step and the hall loads
- **THEN** the Crow step trophy's range is shown and the Bell drop trophy's range is at density 0. Check: Node test `gloam-downs-hub.test.mjs`.

### Requirement: Try the build at the post
In the hall, Attack, Roll and both abilities SHALL work at the training post, with ability cooldowns at a quarter of their length, damage numbers over the post, and nothing spent.

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
The hall SHALL hold at most 210,000 splats (160,000 scenery, 40,000 growth objects), download at most 0.40 MB gzip with a walk file of at most 4 KB, and bake in at most 20 s. On the phone profile (1.6 Mbit/s, 150 ms, CPU slowed 4 times) its first frame SHALL come within 4.0 s cold and 1.5 s warm.

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
The lamp shelf SHALL sell Whetstone (90, 200, 360) and Horn lamp (120, 280), and the wick rack SHALL sell Temper rack (150) and Wick crate (180), with the rules of design.md "New buffs".

#### Scenario: Whetstone is seeded
- **WHEN** two runs with the same seed and Whetstone 3 make the same 200 blade hits
- **THEN** the same hits are sure, and about 12% of them. Check: Node test `gloam-downs-kit.test.mjs`.

### Requirement: Gloam dash
The Fen-wick's first fall SHALL give the lasting key Gloam dash. With it, Roll in the air SHALL dash 3.5 m level, safe for 0.15 s, once until the lamplighter lands. Its trophy SHALL go up on the hall's wall.

#### Scenario: Dash once in the air
- **WHEN** with Gloam dash the lamplighter jumps and presses Roll twice in the air
- **THEN** it moves 3.5 m on the first press and nothing on the second. Check: Node test `gloam-downs-kit.test.mjs`, and e2e `gloam-downs-run.kit.e2e.mjs`.

### Requirement: Blade tempers
Once Temper rack is bought, the Hook, Twin and Bell tempers SHALL join the pattern drops. A kindled temper SHALL be picked at the temper rack and kept until changed, with the rules of design.md "New buffs". The Lamp blade SHALL be the default. Tempers SHALL use the cut poses there now.

#### Scenario: The twin string
- **WHEN** with the Twin temper the player presses Attack four times on a Snuffer
- **THEN** four cuts land at 65% damage each, and the fourth adds 1 Char. Check: Node test `gloam-downs-kit.test.mjs`, and e2e `gloam-downs-run.kit.e2e.mjs`.

#### Scenario: The bell slam
- **WHEN** with the Bell temper the player holds Attack 0.5 s with two foes within 2.5 m
- **THEN** each takes 30. Check: Node test `gloam-downs-kit.test.mjs`.

### Requirement: Colour sets
Three of one colour among the slotted abilities, set panes, held relics (by their move's colour) and the temper SHALL turn on that colour's set, with the rules of design.md "New buffs". The HUD's colour row SHALL ring a colour whose set is on.

#### Scenario: The Gloam set
- **WHEN** Smoke step and Moth swarm are slotted and Storm glass is set, and Smoke step is used
- **THEN** Moth swarm's cooldown drops by 1 s more than without the set, and Gloam is ringed. Check: Node test `gloam-downs-kit.test.mjs`.

### Requirement: Gaining the new things
The new abilities, panes and tempers SHALL be patterns, found and kindled as the others are. A pattern drop SHALL pick an ability, a pane or a temper with odds 50:35:15 (50:50:0 before Temper rack), then one from the seed's `pattern` stream.

#### Scenario: Same seed, same patterns
- **WHEN** two runs with the same seed and save put out the same foes
- **THEN** they drop the same patterns. Check: Node test `gloam-downs-kit.test.mjs`.

### Requirement: The power budget
Held alone, each new buff SHALL add at most 20% damage a second on the bot's reference string against a Snuffer, or at most 25% effective health. Pacing SHALL be measured again with 60 bots a skill after this change and the fair-fight change both land, against the fair-fight targets, and no build family SHALL clear a place more than 15% faster than the mean of all families.

#### Scenario: One buff alone
- **WHEN** the test measures each new buff alone on the reference string
- **THEN** none adds more than 20% damage a second or 25% effective health. Check: Node test `gloam-downs-kit.test.mjs`.

#### Scenario: Pacing after both changes
- **WHEN** the bot runs 60 runs a skill at 0.3, 0.5 and 0.9 on the merged code
- **THEN** the fair-fight targets hold, and design.md records the numbers. Check: `node qa/lab/gloam-downs-bot.mjs`.
