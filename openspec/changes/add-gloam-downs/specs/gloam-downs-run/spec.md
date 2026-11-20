## ADDED Requirements

### Requirement: A run through the five places
Gloam Downs SHALL open in a combat run. A run SHALL go through the five places in order: The Sunken Gaol, Crow Ramparts, Lantern Fen, The Bell Knoll and Barrow Crown. A run SHALL start with 100 health, 2 flasks and no glim carried. The Map SHALL not travel between places during a run.

#### Scenario: First visit
- **WHEN** a visitor opens `/lab/gloam-downs/` for the first time
- **THEN** the help card shows the run's controls, and after Begin the run the lamplighter stands at the start of The Sunken Gaol with 100 health and 2 flasks

#### Scenario: Later visit
- **WHEN** a visitor who was not in Wander, and has no run in progress, opens the page
- **THEN** the Lamp-room shows over the start view of The Sunken Gaol

#### Scenario: The order holds
- **WHEN** the lamplighter lights the beacon of Crow Ramparts and chooses Walk on
- **THEN** Lantern Fen loads next, and the pause panel shows the Gaol and the Ramparts as passed and the other three as ahead

### Requirement: Fixed game step
The page SHALL step the game at a fixed 1/60 s, as many steps as the frame took, and no more than 15 steps for each frame. Timings of moves, warning moves and safe time SHALL be the same at every frame rate.

#### Scenario: Frame rates
- **WHEN** the Node test plays the same string, roll and Snuffer hook at 30, 60, 120 and 144 frames a second
- **THEN** the hook lands, and the roll's safe time starts and ends, on the same game step at each rate

### Requirement: The blade
The Attack control SHALL swing the blade in a string of three hits: two quick cuts of 10 and 11 damage, then a slower finisher of 22 damage with a longer reach. Each hit SHALL lunge a little forward. A press up to 0.15 s early SHALL be kept. Holding Attack SHALL go on with the string. After 0.35 s with no hit, the string SHALL start again at the first hit.

#### Scenario: Three presses
- **WHEN** the player presses Attack three times in 0.6 s next to a Snuffer
- **THEN** three hits land for 10, 11 and 22 damage, and the lamplighter moves about 0.45, 0.45 and 0.8 m forward

#### Scenario: Hold
- **WHEN** the player holds Attack for 2 s
- **THEN** the lamplighter swings full strings, one after the other, with the same timing as quick presses

#### Scenario: The string starts again
- **WHEN** the player lands two hits, waits 0.5 s and presses Attack
- **THEN** the next hit is the first cut, not the finisher

### Requirement: Soft aim
At the start of each hit, the lamplighter SHALL turn up to 75° toward the best foe within 4.5 m that the camera can see, inside 70° of the held direction, or inside 100° of its facing when no direction is held. A nearer foe and a smaller turn SHALL score better. The lunge SHALL stop 0.25 m short of the foe. The same foe SHALL stay the target while its score is close to the best.

#### Scenario: Aim at a foe to the side
- **WHEN** a Snuffer stands 2 m away at 60° to the right of the facing and the player presses Attack with no direction held
- **THEN** the lamplighter turns to the Snuffer and the cut hits it

#### Scenario: No aim through a wall
- **WHEN** one foe stands behind a wall 2 m away and another stands in the open 3.5 m away
- **THEN** the hit turns to the foe in the open

### Requirement: The dodge roll
The Roll control SHALL roll the lamplighter about 3.5 m in 0.36 s in the held direction, or straight back from its facing when no direction is held. For 0.28 s of the roll, from 0.02 s, no hit SHALL hurt it. The next roll SHALL start no sooner than 0.25 s after one ends. A roll SHALL cancel the wind-up or the recovery of a hit, but not its active time.

#### Scenario: Roll through a hook
- **WHEN** a Snuffer's hook would land and the player rolls through the Snuffer 0.2 s before it lands
- **THEN** the lamplighter takes no damage and comes out on the far side

#### Scenario: Roll distance
- **WHEN** the lamplighter rolls on flat ground with no direction held
- **THEN** it moves between 3.3 and 3.7 m back from its facing and then stands

### Requirement: The roll near walls and ledges
A roll SHALL pass through foes, stop at walls and slide along them. A roll SHALL stop at the edge of a drop of more than 3 m, unless the stick or keys push over the edge.

#### Scenario: Ledge guard
- **WHEN** the lamplighter rolls toward a drop of 6 m that is 1 m away, with no direction held
- **THEN** it stops at the edge and does not fall

#### Scenario: Roll off on purpose
- **WHEN** the lamplighter rolls toward that drop with the stick held toward it
- **THEN** it rolls off the edge and falls

### Requirement: The plunge
Attack in the air, with the feet at least 0.8 m above the floor, SHALL start a plunge: a short hang, then a fast fall straight down. The landing SHALL hit every foe within 1.6 m for 16 damage, plus 3 for each metre fallen over 1 m, up to 28. A plunge SHALL knock down light foes and stop their wind-up. Attack lower in the air SHALL do the first cut.

#### Scenario: Plunge onto a Pitchrook
- **WHEN** the lamplighter jumps from a ledge 2 m above a Pitchrook and presses Attack over it
- **THEN** it falls straight down, the Pitchrook takes 19 damage or more and is knocked down, and a ring of sparks shows on the ground

### Requirement: Flasks
The Heal control SHALL drink one flask. A drink SHALL take 0.8 s, at a slow walk, and SHALL then heal 35% of the maximum health. A hit or a roll SHALL stop the drink and keep the flask. Each lit beacon SHALL fill every flask. Taking the fifth wisp of a place SHALL fill one flask.

#### Scenario: Drink
- **WHEN** the lamplighter has 40 of 100 health and 2 flasks, and the player presses Heal
- **THEN** after 0.8 s it has 75 health and 1 flask

#### Scenario: Drink stopped
- **WHEN** a hit lands 0.5 s into a drink
- **THEN** the drink stops, the hit's damage is taken, and the flask count does not change

#### Scenario: No flasks
- **WHEN** the player presses Heal with no flasks left
- **THEN** a toast says that a lit beacon fills the flasks, and nothing else happens

### Requirement: Keyboard in a run
In a run, WASD or the arrows SHALL move, Shift SHALL walk, Space SHALL jump, J or Z SHALL attack, K or X SHALL roll, L or C SHALL heal, Q and E SHALL turn the view, R SHALL face the nearest awake foe within 10 m, or look ahead when there is none, and M, P or Escape SHALL open the pause panel. Each press SHALL count once.

#### Scenario: Keys with WASD
- **WHEN** the player holds A and presses K, then presses J
- **THEN** the lamplighter rolls to the left of the camera and then swings the first cut

#### Scenario: Keys with the arrows
- **WHEN** the player holds the right arrow and presses X, then Z, then C
- **THEN** the lamplighter rolls to the right, swings, and drinks a flask

#### Scenario: Face the foe
- **WHEN** an awake foe stands 6 m behind the lamplighter and the player presses R
- **THEN** the view turns until the foe is in front of the camera

### Requirement: Mouse in a run
In a run, a left press on the view SHALL attack at once. Holding the left button SHALL go on with the string until the pointer moves more than 6 px. A drag with either button SHALL turn the view, as in the explorer. The context menu SHALL not show on the view.

#### Scenario: Click to attack
- **WHEN** the player clicks the left button on the view
- **THEN** the lamplighter swings one cut on the press, with no wait for the release

#### Scenario: Look without a swing
- **WHEN** the player drags with the right button
- **THEN** the view turns and the lamplighter does not swing

### Requirement: Touch in a run
On a touch screen in a run, the page SHALL show Attack, Jump, Roll and Heal buttons at the bottom right. The stick on the left half and the look drag on the right half SHALL work as in the explorer. A tap on Attack SHALL aim at the best foe. Holding Attack SHALL go on with the string. Heal SHALL show the number of flasks left.

#### Scenario: Thumbs
- **WHEN** the player holds the stick to the left and taps Roll, then taps Attack twice
- **THEN** the lamplighter rolls left and swings two cuts at the nearest foe in front of it

#### Scenario: Two thumbs at once
- **WHEN** one finger drags the look on the right half while another holds Attack
- **THEN** the view turns and the string goes on

### Requirement: Gamepad in a run
In a run, the left stick SHALL move and a light tilt SHALL walk. The right stick SHALL turn the view. A SHALL jump, X or RT SHALL attack, B or LT SHALL roll, Y SHALL heal, RB SHALL face the nearest awake foe, and Start or Back SHALL open and close the pause panel. A held button SHALL count once across all pads.

#### Scenario: Pad buttons
- **WHEN** the player tilts the left stick fully, presses B, then presses X three times
- **THEN** the lamplighter rolls in the tilt's direction, then swings a full string

#### Scenario: Two pads
- **WHEN** two pads hold Start at the same time
- **THEN** the pause panel opens once and does not close again

### Requirement: Health and hits
The lamplighter SHALL have 100 health at the start of a run. A hit SHALL take its damage, push the lamplighter about 1.2 m away from the source, take its control for 0.25 s, and keep it from more damage for 0.9 s while the figure blinks. Foes SHALL not hurt the lamplighter by touch alone.

#### Scenario: Hit by a hook
- **WHEN** a Snuffer's hook lands on the lamplighter with 100 health in the Gaol
- **THEN** health shows 84, the lamplighter slides back about 1.2 m, blinks, and a second hook within 0.9 s does no damage

#### Scenario: Walk into a foe
- **WHEN** the lamplighter walks into a Snuffer that is not attacking
- **THEN** it takes no damage and the two push apart

### Requirement: Falls
A fall below y −25 SHALL not end the run. The lamplighter SHALL come back on the last firm ground it stood on, at least 1 m from a ledge, and SHALL lose 10 health, but not below 1.

#### Scenario: Fall through a hole
- **WHEN** the Node test walks the lamplighter with 50 health into a hole in a test walk map, and it falls below y −25
- **THEN** it stands again on the ground it left, at least 1 m from the edge, with 40 health

### Requirement: Low health warning
Below 30% health, the health bar SHALL pulse, a heartbeat SHALL sound, and the place's own colours SHALL pull up to 25% toward dark red at each beat. Fire, lamp and wisp colours SHALL not change, so fire stays the brightest colour.

#### Scenario: Low health
- **WHEN** health falls from 40 to 25 of 100
- **THEN** the bar pulses, and the grade changes palette slots 1 to 31 at each beat while slots 32 to 47 stay as they are

### Requirement: Warning moves
Every foe attack SHALL start with a wind-up of at least 0.55 s, and every boss attack with at least 0.60 s. Each wind-up SHALL show a pose, a fire glow on the foe and a sound. Each ring or lane attack SHALL also grow a marker on the ground over its wind-up. No foe hit SHALL take more than 24 health.

#### Scenario: A Snuffer winds up
- **WHEN** a Snuffer starts its hook
- **THEN** its pole swings back, its cup glows fire, a scrape sounds, and the hook lands 0.55 s later

#### Scenario: A ground marker
- **WHEN** an Ironback starts its slam
- **THEN** a fire ring grows on the ground to 3.0 m over 0.75 s, and the slam hits only inside it

### Requirement: Hits on foes
A plain hit SHALL not stop a foe's wind-up. The finisher and the plunge SHALL stop the wind-up of a light foe. Outside its wind-up, a light foe SHALL flinch for 0.4 s when hit, at most once every 1.5 s. Heavy foes and the boss SHALL not flinch.

#### Scenario: Finisher stops a hook
- **WHEN** the finisher lands on a Snuffer during its hook's wind-up
- **THEN** the Snuffer is knocked down for 0.6 s and the hook does not land

#### Scenario: No stun-lock
- **WHEN** the player keeps swinging at a group of three Snuffers
- **THEN** the Snuffers still start and land hooks between their flinches

### Requirement: The Snuffer
The Snuffer SHALL be a light foe in soot rags with a snuffer pole, in every place. It SHALL have 50 health. Its hook SHALL start within 3.2 m, wind up for 0.55 s, step 1 m forward, hit for 16 and leave it open for 0.7 s.

#### Scenario: Punish the recovery
- **WHEN** a Snuffer's hook misses
- **THEN** it stands still for 0.7 s, and a full string in that time puts it out

### Requirement: The Pitchrook
The Pitchrook SHALL be a light thrower in a beaked mask, from Crow Ramparts on. It SHALL have 30 health and keep 5 to 9 m away. Its lob SHALL wind up for 0.8 s and fly for 0.65 s onto a ring of 1.4 m that marks where the lamplighter stood when the wind-up began. The lob SHALL hit for 18.

#### Scenario: Step out of the ring
- **WHEN** a Pitchrook lobs and the lamplighter walks 2 m away before the coal lands
- **THEN** the coal lands inside its ring and does no damage

### Requirement: The Mirelight
The Mirelight SHALL be a small floating pale flame, from Lantern Fen on. It SHALL fly over water and pits, but not through walls. It SHALL have 14 health. Within 2 m, it SHALL swell for 0.7 s and then pulse a ring of 2.2 m for 18 damage, drift back 3 m, and stay alive.

#### Scenario: Two cuts
- **WHEN** the lamplighter lands two cuts on a Mirelight
- **THEN** the Mirelight goes out

### Requirement: The Ironback
The Ironback SHALL be a heavy brute under a cracked bell, from The Bell Knoll on. It SHALL have 120 health and SHALL not flinch. Its charge SHALL wind up for 0.9 s along a lane and hit for 24. Its slam SHALL wind up for 0.75 s and hit for 20 within 3 m. A charge into a wall SHALL stun it for 2 s, and it SHALL take 50% more damage while stunned.

#### Scenario: Charge into a wall
- **WHEN** the lamplighter stands with a wall behind it and rolls aside as an Ironback charges
- **THEN** the Ironback hits the wall, stands stunned for 2 s, and each hit on it deals 50% more

### Requirement: Zones and waking
Foes SHALL stand in zones. A zone SHALL wake when the lamplighter comes within 10 m of its centre, if fewer than 6 foes are awake. Its foes SHALL rise from the ground: 0.6 s of ember cracks, then 0.9 s in which they cannot hurt or be hurt. A zone SHALL sleep when the lamplighter is more than 16 m away and its foes are home. A foe put out SHALL stay out for the rest of the run.

#### Scenario: A zone wakes
- **WHEN** the lamplighter walks into the south yard of The Sunken Gaol
- **THEN** ember cracks show, a Snuffer rises over 0.9 s, and a cut during the rise does no damage

#### Scenario: Never more than six
- **WHEN** the lamplighter walks anywhere in any place
- **THEN** no more than 6 foes are awake at once

### Requirement: Foes keep their ground
A foe SHALL stay inside its zone's leash. A foe SHALL not walk off a ledge. A foe SHALL chase the lamplighter while it is within the leash plus 8 m, and SHALL walk home after 4 s farther away. A foe SHALL not heal at home. A foe knocked more than 6 m below its zone SHALL be put out and SHALL drop its glim.

#### Scenario: Leave a fight
- **WHEN** the lamplighter runs 15 m away from a zone with a hurt Snuffer
- **THEN** after 4 s the Snuffer walks home, with the same health as before

#### Scenario: Ledge
- **WHEN** a Snuffer chases the lamplighter toward a pit
- **THEN** it stops before the edge

### Requirement: Fair crowds
At most two melee attacks SHALL be under way at once, and at most one thrown coal SHALL be in the air. Foes that wait SHALL hold about 3.5 m away and spread round the lamplighter.

#### Scenario: A group
- **WHEN** three Snuffers and a Pitchrook fight the lamplighter
- **THEN** no more than two hooks wind up or land at the same time, and only one coal is in the air

### Requirement: Off-screen warnings
When a foe starts a wind-up outside the view, an ember notch SHALL show at the nearest edge of the screen for the length of the wind-up. No more than 3 notches SHALL show at once.

#### Scenario: Attack from behind
- **WHEN** a Snuffer behind the camera starts its hook
- **THEN** a notch shows at the bottom edge of the screen until the hook lands

### Requirement: Beacons in a run
In each place before Barrow Crown, one guard zone SHALL keep the beacon dark until all its foes are put out. Other zones MAY be passed. When one of those four beacons lights, it SHALL bank the glim carried, fill every flask, save the run at the start of the next place, and show the beacon card.

#### Scenario: Guards still stand
- **WHEN** the lamplighter touches the Gaol's beacon while the keep's Snuffers stand
- **THEN** the beacon stays dark and a toast says that it will not catch while its keepers stand

#### Scenario: Run past a zone
- **WHEN** the lamplighter runs past the first two zones of Crow Ramparts, puts out the guards west of the drum and touches the beacon
- **THEN** the beacon lights, the glim carried is banked, and the flasks are full

### Requirement: The beacon card
The beacon card SHALL offer two wicks, drawn by the run's seed, and the player SHALL choose one. A wick SHALL last until the run ends. A run SHALL not offer the same wick twice. After the choice, the card SHALL offer Spend glim, which opens the Lamp-room, and Walk on, which loads the next place.

#### Scenario: Choose a wick
- **WHEN** the beacon card shows Keen edge and Quick heels and the player chooses Keen edge
- **THEN** every hit deals 15% more for the rest of the run, and Walk on loads the next place

#### Scenario: Same seed
- **WHEN** two runs with the same seed light the Gaol's beacon
- **THEN** both beacon cards offer the same two wicks

### Requirement: Glim
Foes and wisps SHALL drop glim, motes in the lamp colours that fly to the lamplighter from within 6 m after 0.4 s. A Snuffer SHALL drop 3, a Pitchrook 4, a Mirelight 2, an Ironback 8, a wisp 4 and the boss 30. In a run, a wisp SHALL go out when the lamplighter touches it, and SHALL count for that run only. The HUD SHALL show the glim carried.

#### Scenario: Pick up glim
- **WHEN** the lamplighter puts out a Snuffer and stands 3 m away
- **THEN** three motes fly to it, and the glim carried goes up by 3

#### Scenario: Take a wisp
- **WHEN** the lamplighter touches its fifth wisp of The Sunken Gaol in a run with 1 of 2 flasks
- **THEN** the wisp goes out, the glim carried goes up by 4, the flasks show 2 of 2, and the explorer's save does not change

### Requirement: Death and the run summary
At 0 health the run SHALL end. The picture SHALL fade to ink over 1.2 s, and the run summary SHALL show the place reached, the time, the foes put out, the glim lost and the glim banked. The glim carried SHALL be lost. Its button SHALL open the Lamp-room. The next run SHALL start in The Sunken Gaol with every foe back.

#### Scenario: Die on the Ramparts
- **WHEN** the lamplighter dies in Crow Ramparts carrying 20 glim, with 44 banked from the Gaol
- **THEN** the summary shows "II · Crow Ramparts", 20 glim lost and 44 banked, and the next run starts in the Gaol

### Requirement: The Lamp-room
The Lamp-room SHALL show the glim banked and five lasting upgrades, each with its level and the cost of the next level. A Buy button SHALL spend the cost and raise the level. A Buy button SHALL be off when the bank holds less than the cost, and SHALL say how much more is needed. Begin the run SHALL start a new run. Wander SHALL show once it is open.

#### Scenario: Buy an upgrade
- **WHEN** the bank holds 50 glim and the player buys Mantle
- **THEN** the bank shows 10, Mantle shows level 1, and the next run starts with 115 health

#### Scenario: Not enough glim
- **WHEN** the bank holds 30 glim
- **THEN** the Flask upgrade's Buy button is off and says that 30 more glim is needed

#### Scenario: Buy at a beacon
- **WHEN** the player buys Edge from a beacon card's Spend glim
- **THEN** the blade deals 12% more at once, for the rest of this run and the runs after it

### Requirement: The lasting upgrades
The upgrades SHALL be: Mantle, 15 more maximum health a level, for 40, 80 and 140 glim; Flask, one more flask a level, for 60 and 150; Edge, 12% more blade damage a level, for 50, 100 and 170; Draught, 10% more heal for each flask a level, for 45 and 110; Ash pocket, keep 30% of the glim carried at death, for 120.

#### Scenario: All upgrades
- **WHEN** a player has bought every level
- **THEN** a run starts with 145 health and 4 flasks, each flask heals 55%, the blade deals 36% more, and a death keeps 30% of the glim carried

### Requirement: The boss arrives
At the east foot of Barrow Crown, the boss SHALL wait in an arena of 6.5 m. The first time in a visit that the lamplighter comes within 11 m, the game SHALL stop for 2.4 s while black bars show and a card names the Barrow Reeve. Then the boss bar SHALL show and the fight SHALL start. Twelve grave candles SHALL light round the arena.

#### Scenario: Intro
- **WHEN** the lamplighter walks to within 11 m of the arena for the first time
- **THEN** bars ease in, the card reads "The Barrow Reeve", the boss bar shows, and the candles light

#### Scenario: Touch the dark beacon first
- **WHEN** the lamplighter touches the beacon of Barrow Crown before the boss falls
- **THEN** the beacon stays dark and a toast points to the keeper at the crown's east foot

### Requirement: Boss phases
The Barrow Reeve SHALL have 1,300 health in three phases: down to 800, down to 350, and down to 0. At each change it SHALL stumble for 2 s and take no damage. Each phase SHALL add attacks and shorten the gap between them: 1.0, 0.75 and 0.55 s. If the lamplighter leaves the arena, the boss SHALL walk back to its centre and keep the damage it took.

#### Scenario: Phase change
- **WHEN** the boss's health falls below 800
- **THEN** it stumbles for 2 s, hits do no damage for that time, and the lamp-shards start to come

#### Scenario: Leave and come back
- **WHEN** the lamplighter leaves the arena with the boss at 900 health and comes back
- **THEN** the boss is at 900 health

### Requirement: Boss attacks
The boss SHALL choose each attack from where the lamplighter stands, and SHALL not use the same attack three times in a row. Phase 1 SHALL have the crook sweep and the cage slam. Phase 2 SHALL add the lamp-shards and the stalking lunge. Phase 3 SHALL add the double sweep. After the cage slam the boss SHALL stay open for 1.5 s and take 50% more damage. No boss hit SHALL take more than 22 health.

#### Scenario: Behind the boss
- **WHEN** the lamplighter stands behind the boss within 3.5 m
- **THEN** the boss starts the cage slam, and a ring grows to 3.4 m at its feet over 1.0 s

#### Scenario: Far from the boss
- **WHEN** the lamplighter stands more than 9 m from the boss in phase 2, out of reach of the lamp-shards
- **THEN** the boss starts the stalking lunge, and a lane grows on the ground toward the lamplighter over 0.7 s

### Requirement: The win
When the boss falls, the caged light SHALL rise and follow the lantern. When the lamplighter carries it to the beacon of Barrow Crown, the beacon SHALL light, the run clock SHALL stop, and the win card SHALL show the time, the best winning time, the glim banked, the runs and the deaths. The win card SHALL open the Lamp-room or Wander. The first win SHALL open Wander.

#### Scenario: Carry the light
- **WHEN** the boss falls and the lamplighter walks up to the beacon with the light
- **THEN** the beacon burns, and the win card shows 1.8 s later

#### Scenario: First win opens Wander
- **WHEN** a player wins for the first time and opens the Lamp-room
- **THEN** the Lamp-room shows Wander

### Requirement: Pause
The pause panel SHALL stop the game. It SHALL show the five places of the run, with the current one marked, the run time, Resume, a sound switch, and End the run. End the run SHALL ask again and then end the run as a death does. Escape or Resume SHALL close the panel.

#### Scenario: Pause and resume
- **WHEN** the player presses P in a fight and then Escape
- **THEN** no foe moves while the panel shows, and the fight goes on after Escape from where it stopped

### Requirement: Saved run
The run SHALL save under its own key, `gloam-downs.run.v1`: the bank, the upgrade levels, runs, wins, deaths, the furthest place, the best winning time, the sound setting and the run in progress. The page SHALL check each saved field. A run SHALL not change the explorer's save.

#### Scenario: Reload in a place
- **WHEN** the player reloads in Lantern Fen, after entering it with 80 health and 12 glim and then dropping to 50 health and gaining 10 glim
- **THEN** the run goes on at the start of Lantern Fen with 50 health and 12 glim carried

#### Scenario: Bad run save
- **WHEN** the run save holds wrong types, unknown upgrades or levels out of range
- **THEN** the page drops the bad fields and starts as normal

#### Scenario: An old page
- **WHEN** a cached explorer page loads and stores its own save while a run save exists
- **THEN** the bank and the upgrades stay as they were

### Requirement: Wander
Wander SHALL be the explorer as it was before the run: no foes, no health, no glim, Map travel, the end card and Walk again, with the explorer's save. Wander SHALL open from the Lamp-room after the first win, or when the explorer's save shows a finished walk. `?wander` SHALL open it. A reload in Wander SHALL open Wander again. Wander's Map SHALL have a way back to the Lamp-room.

#### Scenario: A walker from before
- **WHEN** a visitor whose explorer save has one finished walk opens the page for the first time since the run came, and closes the help card
- **THEN** the Lamp-room shows with Wander, and Wander opens with the places that the visitor reached before

### Requirement: The HUD in a run
The HUD SHALL show the place, a health bar with its number, a pip for each flask, and the wisps and glim carried. At 520 px wide or less, the toast SHALL move down under the taller HUD. In a boss fight, a boss bar SHALL show: on a touch screen in the Lab bar row between ◀ Lab and Games, and with a fine pointer at the bottom centre.

#### Scenario: Health line
- **WHEN** the lamplighter has 74 of 100 health and 1 of 2 flasks
- **THEN** the HUD shows "74/100" beside a bar filled 74%, one full pip and one empty pip

#### Scenario: Toast on a phone
- **WHEN** a toast shows at 390 by 844
- **THEN** it does not overlap the HUD, the Lab bar or the tools

### Requirement: Phone layouts
At 320 by 640 and 390 by 844 on a touch screen, every run control SHALL be at least 44 px on its shorter side, inside the screen, and clear of the Lab bar, the HUD, the tools, the toast and each other. The stick SHALL have the left half of the screen below the HUD. The page SHALL not scroll sideways.

#### Scenario: 390 by 844
- **WHEN** the run plays at 390 by 844 on a touch screen
- **THEN** Attack is 84 px, Jump 72 px, Roll 64 px and Heal 52 px, at the bottom right, and the overlap check finds nothing

#### Scenario: 320 by 640
- **WHEN** the run plays at 320 by 640 on a touch screen
- **THEN** Attack is 76 px, Jump 64 px, Roll 60 px and Heal 48 px, the boss bar fits between ◀ Lab and Games, and the overlap check finds nothing

### Requirement: Short windows and desktop
In windows 660 px tall or less, the touch buttons SHALL use their small sizes. At 360 by 640 and 800 by 600 every control SHALL be inside the screen, at least 44 px, and clear of the others. At 1280 by 720 with a fine pointer, no touch button SHALL show, and the boss bar SHALL be at the bottom centre, 520 px wide.

#### Scenario: 360 by 640 and 800 by 600
- **WHEN** the run plays at 360 by 640 or at 800 by 600 on a touch screen
- **THEN** the buttons use the small sizes, every control is at least 44 px and inside the screen, and the overlap check finds nothing

#### Scenario: 1280 by 720
- **WHEN** the run plays at 1280 by 720 with a mouse
- **THEN** no touch button shows, the HUD and tools are where the explorer has them, and the boss bar is 520 by 44 px, 24 px above the bottom

### Requirement: Cards fit the screen
The help card, the Lamp-room, the beacon card, the pause panel, the run summary and the win card SHALL fit each of the five layouts. Each card's main button SHALL be inside the screen without a scroll of the page. Every button SHALL be at least 44 px. Space and Enter SHALL press the focused button.

#### Scenario: Lamp-room in a short window
- **WHEN** the Lamp-room shows at 360 by 640
- **THEN** Begin the run is inside the screen with no scroll, and every Buy button is at least 44 px

### Requirement: Hit feel
The game SHALL stop for a short hit stop on each hit while the picture goes on: 0.05 s for a cut, 0.08 s for the finisher, the plunge and a hurt lamplighter, 0.10 s for the boss slam, and 0.15 s for a boss phase change and for death. Hit stop SHALL not exceed 0.15 s in any 0.5 s. A hit foe SHALL flash and shake in the picture only. The camera SHALL kick on heavy hits.

#### Scenario: A cut lands
- **WHEN** the first cut hits a Snuffer
- **THEN** the game holds for 3 steps, the Snuffer flashes fire-bright for 2 to 4 frames, and the shape that hits test against does not move

#### Scenario: Effects off
- **WHEN** the test turns off every feel effect
- **THEN** the run still plays, and the Node tests of moves and foes pass

### Requirement: Reduced motion
When the system asks for reduced motion, the camera SHALL not kick or zoom, the hurt blink SHALL be slower, the white flash at the boss's fall SHALL not show, and the low health tint SHALL not pulse.

#### Scenario: Reduced motion
- **WHEN** the e2e runs a hit and a boss slam with reduced motion on
- **THEN** the camera kick and the zoom stay at zero, and the blink changes every 0.125 s

### Requirement: The look in a fight
With foes on screen, every place SHALL keep the dark look and fire SHALL stay the brightest colour. Foes SHALL be baked with Ink Studio as splats, so they take each place's palette, dither and outlines.

#### Scenario: Measure a fight
- **WHEN** the e2e draws The Sunken Gaol, Lantern Fen and Barrow Crown with 6 foes awake and one ground marker at full size, at the phone and desktop art sizes
- **THEN** the mean luminance is between 0.05 and 0.32, between 0.05% and 12% of the pixels are brighter than 0.55, and at least 90% of the brightest 1% of pixels are within 12 of a fire, lamp, wisp or moon colour in 8-bit RGB

### Requirement: Warning moves read
A warning move SHALL add clear fire to the picture. The check SHALL draw a foe 4 m in front of the lamplighter at the default camera.

#### Scenario: Measure a tell
- **WHEN** the e2e draws a Snuffer at rest and at the end of its hook's wind-up
- **THEN** inside the Snuffer's box on screen, the art pixels of fire colours at the end are at least 3 times and at least 8 more than at rest

#### Scenario: Measure a ground marker
- **WHEN** the e2e draws an Ironback at the start and at the end of its slam's wind-up
- **THEN** the ring adds at least 20 art pixels of fire colours on the ground round it

### Requirement: Foe budget
The five place files SHALL not change. The foes SHALL come from one file of at most 200 KB gzipped, and the boss from one of at most 100 KB gzipped. Each place, with its pool of foes, SHALL have no more than 275,000 splats. At most 6 foes SHALL be awake at once.

#### Scenario: Budget check
- **WHEN** the Node test reads the baked worlds, the foe file, the boss file and each place's pool
- **THEN** each place file has the hash it had before the run, each file is within its size, and each place with its pool has 275,000 splats or fewer

### Requirement: Frame cost in a fight
A fight SHALL cost little more than the place alone. The checks run on this machine's Node and software WebGL, so they compare ratios.

#### Scenario: Picture cost
- **WHEN** the e2e draws the same view at the phone art size three times with 6 foes awake on screen and three times with none
- **THEN** the median frame with foes takes no more than 1.30 times the median without

#### Scenario: Sort cost
- **WHEN** the Node bench sorts The Bell Knoll with its full pool of foes, best median of 3 rounds of 60 frames
- **THEN** it takes no more than 1.40 times the sort of the place alone

#### Scenario: Foe cost
- **WHEN** the Node bench steps 6 awake foes with their sight tests and bodies for 600 steps
- **THEN** the median step takes 0.5 ms or less

### Requirement: Test mode for the run
With `?test`, the page SHALL not run its loop. A test SHALL step the run with `__gloam.tick(seconds, held)` at 60 steps a second, where held names mx, mz, jump, slow, ox, attack, roll, heal and look. `__gloam.run()` SHALL return the run state and `__gloam.foes()` the awake foes. With `?seed=N` the run's seed SHALL be N.

#### Scenario: Same seed, same run
- **WHEN** a test plays 30 s of the Gaol twice with `?test&seed=7&fresh` and the same held inputs
- **THEN** the run state and the foes are the same both times

### Requirement: Pacing
A winning run SHALL take about 8 to 15 minutes for a person. A player new to the genre SHALL win in about 3 to 6 runs, and a skilled player in 1 or 2. A bot SHALL check the numbers on the real walk maps with the page's own rules.

#### Scenario: Bot runs
- **WHEN** `node qa/lab/gloam-downs-bot.mjs 200 0.3 1` and the same at skill 0.5 and 0.9 run 12 runs for each bot
- **THEN** the median first win is in run 3 to 6 at skill 0.3 and in run 1 or 2 at skill 0.9, at skill 0.5 three of four bots need 3 boss tries or fewer, and the median boss fight lasts 50 to 110 s

### Requirement: Sound in a run
The run SHALL make its sound in code with WebAudio, with no sound files: a cue for each warning move, hits, hurt, glim, the beacon and the boss. Sound SHALL start only after a press on the page. The pause panel's switch SHALL turn it off and on, and the choice SHALL be saved. Sound SHALL stop while the page is hidden.

#### Scenario: Hidden page
- **WHEN** `node qa/arcade/quiet.mjs --only=lab/gloam-downs` runs with the site served
- **THEN** the run's sound plays after Begin the run, stops while the page is hidden, and comes back when it shows

### Requirement: Original names
Every name in the run SHALL be original: the Snuffer, the Pitchrook, the Mirelight, the Ironback, the Barrow Reeve, glim, the Lamp-room, Wander, the wicks Long wick, Keen edge, Quick heels, Heavy fall, Spare oil and Close shave, and the upgrades Mantle, Flask, Edge, Draught and Ash pocket.

#### Scenario: Names on screen
- **WHEN** the Node test reads every foe, wick, upgrade and card title in the run's data
- **THEN** each one is a name in this list
