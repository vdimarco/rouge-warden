## ADDED Requirements

### Requirement: A run through the five places
Gloam Downs SHALL open in a combat run. A run SHALL go through the five places in this order: The Sunken Gaol, The Crow Wall, Lantern Fen, The Bell Knoll and Barrow Crown. A run SHALL start with 100 health, 2 flasks and no glim carried. The Map SHALL not travel between places during a run.

#### Scenario: First visit
- **WHEN** a visitor opens `/lab/gloam-downs/` for the first time
- **THEN** the help card shows the run's controls. After Begin the run, the lamplighter stands at the start of The Sunken Gaol with 100 health and 2 flasks. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Later visit
- **WHEN** a visitor who was not in Wander, and has no run in progress, opens the page
- **THEN** the Lamp-room shows over the start view of The Sunken Gaol. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: The order holds
- **WHEN** the lamplighter lights the beacon of The Crow Wall and chooses Walk on
- **THEN** Lantern Fen loads next. The pause panel shows the Gaol and the Crow Wall as passed, and the other three as ahead. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Fixed game step
The page SHALL step the game at a fixed 1/60 s, as many steps as the frame took. It SHALL take no more than 15 steps for each frame. A time that is not a whole number of steps SHALL round to the nearest step. Timings of moves, warning moves and safe time SHALL be the same at every frame rate.

#### Scenario: Frame rates
- **WHEN** the Node test plays the same string, roll and Snuffer hook at 30, 60, 120 and 144 frames a second
- **THEN** at each rate, the hook lands on the same game step, and the roll's safe time starts and ends on the same steps. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The blade
The Attack control SHALL swing the blade in a string of three hits: two cuts, then a finisher. A press up to 0.15 s early SHALL be kept. Each next hit SHALL be able to start 0.10 s into the recovery of the hit before, also the first cut after a finisher. Holding Attack SHALL go on with the string. The string SHALL start again at the first cut 0.35 s after the recovery of the last hit ends.

#### Scenario: Hold
- **WHEN** the player holds Attack for 2 s near a Snuffer held still by a test
- **THEN** full strings follow one another. Each hit starts 0.10 s into the recovery of the hit before, ±1 step. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: The string starts again
- **WHEN** the player lands two hits, then presses Attack 0.7 s after the second hit's recovery ends
- **THEN** the next hit is the first cut. A press 0.2 s after that recovery ends gives the finisher instead. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The blade's hits
Each hit of the string SHALL have the times, damage, reach and lunge in this table. Reach SHALL be measured from the lamplighter's centre to the foe's edge.

| Hit | Wind-up | Active | Recovery | Damage | Reach | Lunge |
|---|---|---|---|---|---|---|
| 1, cut | 0.10 s | 0.08 s | 0.24 s | 10 | 1.8 m | 0.45 m |
| 2, cut | 0.10 s | 0.08 s | 0.26 s | 11 | 1.8 m | 0.45 m |
| 3, finisher | 0.20 s | 0.10 s | 0.40 s | 22 | 2.1 m | 0.8 m |

#### Scenario: Three presses
- **WHEN** the player presses Attack at 0, 0.3 and 0.6 s, 2.1 m from the edge of a Snuffer held still by a test
- **THEN** three hits land for 10, 11 and 22 damage. The lamplighter moves 0.45, 0.45 and 0.8 m forward, each ±0.15 m. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Soft aim
At the start of each hit, the lamplighter SHALL turn up to 75° toward the best foe. A foe SHALL be a candidate when all of these are true:
- its edge is within 4.5 m of the lamplighter's centre;
- it is inside 70° of the held direction, or inside 100° of the facing when no direction is held;
- the lamplighter can see it: the walk map has a clear line from its eye, 1.2 m up, to the foe's chest, 0.9 m up.

#### Scenario: Aim at a foe to the side
- **WHEN** a Snuffer's edge is 2 m away at 60° to the right of the facing, and the player presses Attack with no direction held
- **THEN** the lamplighter turns to the Snuffer and the cut hits it. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: No aim through a wall
- **WHEN** one foe stands behind a wall 2 m away and another stands in the open 3.5 m away
- **THEN** the hit turns to the foe in the open. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The aim's score
The score of a candidate SHALL be the distance in metres plus 2 times the turn in radians. A lower score SHALL be better. The current target SHALL stay while its score is within 0.75 of the best. The lunge SHALL stop 0.25 m short of the target's edge.

#### Scenario: Keep the target
- **WHEN** the target stands 2.0 m straight ahead, and a second foe comes to 1.6 m at the same angle
- **THEN** the target stays, because the second score is better by only 0.4. When the second foe comes to 1.1 m, the next hit turns to it. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Stop short
- **WHEN** the player swings the first cut 0.5 m from the edge of a Snuffer held still by a test
- **THEN** the lamplighter moves 0.25 m forward, ±0.05 m, and stops 0.25 m from the Snuffer's edge. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The dodge roll
The Roll control SHALL roll the lamplighter for 0.36 s at 9.0 m/s, and then cut its speed to 4.5 m/s. The roll SHALL go in the held direction, or straight back from the facing when no direction is held. No hit SHALL hurt the lamplighter from 0.02 s to 0.30 s of the roll. The next roll SHALL start no sooner than 0.25 s after one ends. A roll SHALL cancel the wind-up or the recovery of a hit, but not its active time.

#### Scenario: Roll through a hook
- **WHEN** a Snuffer's hook would land, and the player rolls through the Snuffer 0.2 s before it lands
- **THEN** the lamplighter takes no damage and comes out on the far side. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Roll distance
- **WHEN** the lamplighter rolls on flat ground with no direction held
- **THEN** it moves between 3.3 and 3.7 m back from its facing, and then stands. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The roll near walls and ledges
A roll SHALL pass through foes, stop at walls and slide along them. A roll SHALL stop at the edge of a drop of more than 3 m, unless the stick or keys push over the edge.

#### Scenario: Ledge guard
- **WHEN** the lamplighter rolls toward a drop of 6 m that is 1 m away, with no direction held
- **THEN** it stops at the edge and does not fall. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Roll off on purpose
- **WHEN** the lamplighter rolls toward that drop with the stick held toward it
- **THEN** it rolls off the edge and falls. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The plunge
Attack in the air, with the feet at least 0.8 m above the floor, SHALL start a plunge. The plunge SHALL hang for 0.08 s, then fall straight down at 16 m/s. The landing SHALL hit every foe within 1.6 m. Its damage SHALL be 16, plus 3 for each metre fallen over 1 m, and no more than 28. A plunge SHALL knock down light foes and stop their wind-up. Attack lower in the air SHALL do the first cut.

#### Scenario: Plunge onto a Pitchrook
- **WHEN** the lamplighter jumps from a ledge 2 m above a Pitchrook and presses Attack over it
- **THEN** it falls straight down, and the Pitchrook takes 19 damage or more and is knocked down. A ring of sparks shows on the ground. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Flasks
The Heal control SHALL drink one flask. A drink SHALL take 0.8 s at a slow walk of 1.5 m/s. At its end, the drink SHALL heal 35% of the maximum health. A hit or a roll SHALL stop the drink and keep the flask. Each lit beacon SHALL fill every flask. The fifth wisp of a place SHALL fill one flask.

#### Scenario: Drink
- **WHEN** the lamplighter has 40 of 100 health and 2 flasks, and the player presses Heal
- **THEN** after 0.8 s it has 75 health and 1 flask. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Drink stopped
- **WHEN** a hit lands 0.5 s into a drink
- **THEN** the drink stops, the hit's damage is taken, and the flask count does not change. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: No flasks
- **WHEN** the player presses Heal with no flasks left
- **THEN** a toast says that a lit beacon fills the flasks, and nothing else happens. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Keyboard in a run
In a run, each key press SHALL count once, and the keys SHALL do these things:
- WASD or the arrows SHALL move, and Shift SHALL walk.
- Space SHALL jump.
- J or Z SHALL attack.
- K or X SHALL roll.
- L or C SHALL heal.
- Q and E SHALL turn the view.
- R SHALL face the nearest awake foe within 10 m, or look ahead when there is none.
- M, P or Escape SHALL open the pause panel.

#### Scenario: Keys with WASD
- **WHEN** the player holds A and presses K, then presses J
- **THEN** the lamplighter rolls to the left of the camera, and then swings the first cut. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Keys with the arrows
- **WHEN** the player holds the right arrow and presses X, then Z, then C
- **THEN** the lamplighter rolls to the right, swings, and drinks a flask. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Face the foe
- **WHEN** an awake foe stands 6 m behind the lamplighter and the player presses R
- **THEN** the view turns until the foe is in front of the camera. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Mouse in a run
In a run, a left press on the view SHALL attack at once. Holding the left button SHALL go on with the string until the pointer moves more than 6 px. A drag with either button SHALL turn the view, as in the explorer. The context menu SHALL not show on the view.

#### Scenario: Click to attack
- **WHEN** the player clicks the left button on the view
- **THEN** the lamplighter swings one cut on the press, with no wait for the release. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Look without a swing
- **WHEN** the player drags with the right button
- **THEN** the view turns and the lamplighter does not swing. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Touch in a run
On a touch screen in a run, the page SHALL show Attack, Jump, Roll and Heal buttons at the bottom right. The stick on the left half and the look drag on the right half SHALL work as in the explorer. A tap on Attack SHALL aim at the best foe. Holding Attack SHALL go on with the string. Heal SHALL show the number of flasks left.

#### Scenario: Thumbs
- **WHEN** the player holds the stick to the left and taps Roll, then taps Attack twice
- **THEN** the lamplighter rolls left and swings two cuts at the best foe in front of it. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Two thumbs at once
- **WHEN** one finger drags the look on the right half while another holds Attack
- **THEN** the view turns and the string goes on. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: The Map and Look tools in a run
In a run, the Map tool SHALL open the pause panel. The Look tool SHALL face the nearest awake foe within 10 m, or look ahead when there is none. A tap and a mouse click on a tool SHALL do the same thing. A press on a tool SHALL not swing the blade, and SHALL not start the stick or the look drag.

#### Scenario: Map on a phone
- **WHEN** the player taps Map in a fight on a touch screen
- **THEN** the pause panel opens, and no foe moves while it shows. Resume goes back to the fight. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Look on a phone
- **WHEN** an awake Snuffer stands 6 m behind the lamplighter and the player taps Look
- **THEN** the view turns until the Snuffer is in front of the camera. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Look with no foe near
- **WHEN** no foe is awake within 10 m and the player taps Look
- **THEN** the view turns to look ahead of the lamplighter, as in the explorer. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Tools with a mouse
- **WHEN** an awake foe stands 6 m to the side, and the player clicks Look and then Map with the left button
- **THEN** the view turns to the foe, then the pause panel opens, and the lamplighter does not swing. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Gamepad in a run
In a run, a held pad button SHALL count once across all pads, and the pad SHALL do these things:
- The left stick SHALL move, and a light tilt SHALL walk.
- The right stick SHALL turn the view.
- A (button 0) SHALL jump.
- X (2) or RT (7) SHALL attack.
- B (1) or LT (6) SHALL roll.
- Y (3) SHALL heal.
- RB (5) SHALL face the nearest awake foe within 10 m, or look ahead when there is none.
- Start (9) or the pad's Back button (8) SHALL open and close the pause panel.

#### Scenario: Pad buttons
- **WHEN** the player tilts the left stick fully, presses B, then presses X three times
- **THEN** the lamplighter rolls in the tilt's direction, and then swings a full string. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Two pads
- **WHEN** two pads hold Start at the same time
- **THEN** the pause panel opens once and does not close again. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Gamepad in Wander
In Wander, X (2) SHALL walk, as in the explorer. RT, B, LT and Y SHALL do nothing in Wander.

#### Scenario: X in Wander
- **WHEN** the player holds X and the left stick in Wander
- **THEN** the lamplighter walks, and no blade swings. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Focus in cards
Every card and panel SHALL work with keys alone and with a gamepad alone. The d-pad or the left stick SHALL move the focus between the buttons. A tilt of the left stick past half SHALL move the focus one button, and again every 0.3 s while it is held. A on a gamepad, and Space or Enter on keys, SHALL press the focused button.

#### Scenario: A beacon card on a gamepad
- **WHEN** the Gaol's beacon card shows with 60 glim banked, and the e2e uses only a mocked gamepad. The d-pad and A choose a wick, A presses Spend glim and buys Mantle, B goes back, and A presses Walk on.
- **THEN** the wick is chosen, and the bank shows 20. The beacon card shows again after B, and The Crow Wall loads after Walk on. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Back in cards
B on a gamepad and Escape SHALL go back where a card has a back action. The back actions SHALL be these:
- Resume in the pause panel;
- Back to the beacon in the Lamp-room, when the Lamp-room opened from a beacon card;
- No, when End the run asks again.

In other cards, B and Escape SHALL do nothing. Start and the pad's Back button SHALL close only the pause panel. Before a wick is chosen, only a wick button SHALL close the beacon card.

#### Scenario: No way past the wick
- **WHEN** the beacon card offers two wicks, and the player presses Escape, Start, the pad's Back button or B
- **THEN** the card stays, and play does not go on. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: B in the pause panel
- **WHEN** the pause panel shows and the player presses B on a gamepad
- **THEN** the panel closes and play goes on, as after Resume. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Combat camera
In a run, while a zone is awake, the camera SHALL turn toward the nearest awake foe. The turn SHALL start after 0.8 s with no look input. It SHALL turn at no more than 0.9 rad/s, and stop when the yaw difference to that foe is 20° or less. The yaw difference SHALL be the angle, seen from the lamplighter, between the view's forward direction and the direction to the foe. While a zone is awake, this turn SHALL take the place of the explorer's swing behind a running lamplighter.

#### Scenario: The camera turns to a foe
- **WHEN** an awake Snuffer stands 5 m away, 60° to the right of the view's forward direction. The player gives no look input for 0.8 s.
- **THEN** the view turns right, no faster than 0.9 rad/s, and stops when the yaw difference is 20° or less. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: No zone awake
- **WHEN** the last awake zone goes to sleep or its last foe goes out
- **THEN** the camera stops turning toward foes, and it swings behind a running lamplighter as in the explorer. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Look input wins
Look input SHALL take control back from the combat camera and the boss camera on the same step. Both cameras SHALL still come closer in front of a hill or a wall, as the explorer's camera does.

#### Scenario: Look input wins
- **WHEN** the camera turns by itself, and the player presses Q, drags the look or moves the right stick
- **THEN** the turn stops on that step, and the view follows only the player's input. The camera turns by itself again only after 0.8 s with no look input. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Boss camera
In the boss fight, the camera SHALL aim at a point 0.35 of the way from the lamplighter to the boss. Its distance SHALL ease over 1 s to 1.25 times the layout's follow distance, and to no less than 12 m. The follow distance SHALL be the explorer's: 8.5 m in landscape, and up to 12.75 m in a tall portrait window. When the boss falls or the lamplighter leaves the arena, the camera SHALL ease back to the follow camera over 1 s.

#### Scenario: Leave the arena
- **WHEN** the lamplighter walks out of the arena
- **THEN** within 1 s the camera is back at the follow camera's distance and aim. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Boss camera turn
After 0.6 s with no look input, the boss camera SHALL turn toward the boss at no more than 1.5 rad/s. It SHALL stop when the yaw difference to the boss is 15° or less. The yaw difference SHALL be measured as in the combat camera, from the lamplighter.

#### Scenario: Boss in view
- **WHEN** the Node test puts the boss 2 to 13 m from the lamplighter on flat ground, at bearings 15° apart. It steps the boss camera for 3 s with no look input. It does this at 320 by 640, 390 by 844, 360 by 640, 800 by 600 and 1280 by 720.
- **THEN** the chests of the boss and the lamplighter are inside 80% of the screen's half-width, and inside the screen's height. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Run round the boss
- **WHEN** the lamplighter runs round a boss for 10 s at 390 by 844, 5 m from it, with no look input. A test holds the boss still.
- **THEN** the chests of the boss and the lamplighter stay inside the screen. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Health and hits
The lamplighter SHALL have 100 health at the start of a run. A hit SHALL take its damage and push the lamplighter 1.2 m away from the source. The lamplighter SHALL have no control for 0.25 s after a hit. For 0.9 s after a hit, no damage SHALL hurt it, and the figure SHALL blink. Foes SHALL not hurt the lamplighter by touch alone.

#### Scenario: Hit by a hook
- **WHEN** a Snuffer's hook lands on the lamplighter with 100 health in the Gaol
- **THEN** health shows 84, and the lamplighter slides back 1.2 m, ±0.15 m, and blinks. A second hook within 0.9 s does no damage. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Walk into a foe
- **WHEN** the lamplighter walks into a Snuffer that is not attacking
- **THEN** it takes no damage, and the two push apart. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Falls
A fall below y −25 SHALL not end the run. The lamplighter SHALL come back on the last firm ground it stood on, at least 1 m from a ledge. It SHALL lose 10 health, but not below 1.

#### Scenario: Fall through a hole
- **WHEN** the Node test walks the lamplighter with 50 health into a hole in a test walk map, and it falls below y −25
- **THEN** it stands again on the ground it left, at least 1 m from the edge, with 40 health. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Low health warning
Below 30% health, the health bar SHALL pulse, and a heartbeat SHALL sound every 55 steps (0.92 s). At each beat, the place's own colours SHALL pull up to 25% toward dark red. Fire, lamp and wisp colours SHALL not change, so fire stays the brightest colour.

#### Scenario: Low health
- **WHEN** health falls from 40 to 25 of 100
- **THEN** the bar pulses, and `__gloam.sounds()` logs a heartbeat every 55 steps. At each beat, the grade changes palette slots 1 to 31, and slots 32 to 47 stay as they are. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Warning moves
Every foe attack SHALL start with a wind-up of at least 0.55 s, and every boss attack with a wind-up of at least 0.60 s. Each wind-up SHALL show a pose, a fire glow on the foe and a sound. Each ring or lane attack SHALL also grow a marker on the ground over its wind-up, in fire slots 34 and 35. No foe hit SHALL take more than 24 health.

#### Scenario: A Snuffer winds up
- **WHEN** a Snuffer starts its hook
- **THEN** its pole swings back and its cup glows fire. `__gloam.sounds()` logs the scrape on the first step of the wind-up, and the hook lands 0.55 s later. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: A ground marker
- **WHEN** an Ironback starts its slam
- **THEN** a fire ring grows on the ground to 3.0 m over 0.75 s, and the slam hits only inside it. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Hits on foes
A plain hit SHALL not stop a foe's wind-up. The finisher and the plunge SHALL stop the wind-up of a light foe. Outside its wind-up, a light foe SHALL flinch for 0.4 s when hit, no more than once every 1.5 s. Heavy foes and the boss SHALL not flinch.

#### Scenario: Finisher stops a hook
- **WHEN** the finisher lands on a Snuffer during its hook's wind-up
- **THEN** the Snuffer is knocked down for 0.6 s, and the hook does not land. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: No endless flinch
- **WHEN** a bot with seed 7 swings at a group of three Snuffers for 10 s, with no pause and no roll
- **THEN** at least 3 hooks hit the lamplighter for damage in that time. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The Snuffer
The Snuffer SHALL be a light foe in soot rags with a snuffer pole, in every place. It SHALL have 50 health. Its hook SHALL start within 3.2 m and wind up for 0.55 s. Then the Snuffer SHALL step 1 m forward and hit for 16. After the hook, it SHALL stand open for 0.7 s.

#### Scenario: Hit it while it recovers
- **WHEN** a Snuffer's hook misses, and the player at once holds Attack 1.5 m from the Snuffer's edge, with no upgrade or wick
- **THEN** it stands still for 0.7 s, and two cuts land in that time. The finisher lands after that time and knocks it down for 0.6 s. The next cut puts it out. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The Pitchrook
The Pitchrook SHALL be a light thrower in a beaked mask, from The Crow Wall on. It SHALL have 30 health and keep 5 to 9 m away. Its lob SHALL wind up for 0.8 s and then fly for 0.65 s. The coal SHALL land on a ring of 1.4 m, fixed where the lamplighter stood when the wind-up began. The lob SHALL hit for 18.

#### Scenario: Step out of the ring
- **WHEN** a Pitchrook lobs, and the lamplighter walks 2 m away before the coal lands
- **THEN** the coal lands inside its ring and does no damage. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The Mirelight
The Mirelight SHALL be a small floating pale flame, from Lantern Fen on. It SHALL fly over water and pits, but not through walls. It SHALL have 14 health. Within 2 m, it SHALL swell for 0.7 s and then pulse a ring of 2.2 m for 18 damage. After the pulse, it SHALL drift back 3 m and stay alive.

#### Scenario: Two cuts
- **WHEN** the lamplighter lands two cuts on a Mirelight
- **THEN** the Mirelight goes out. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The Ironback
The Ironback SHALL be a heavy brute under a cracked bell, from The Bell Knoll on. It SHALL have 120 health and SHALL not flinch. Its charge SHALL wind up for 0.9 s along a lane, then run at 10 m/s for 0.7 s and hit for 24. Its slam SHALL wind up for 0.75 s and hit for 20 within 3 m. A charge into a wall SHALL stun it for 2 s, and it SHALL take 50% more damage while stunned.

#### Scenario: Charge into a wall
- **WHEN** the lamplighter stands with a wall behind it and rolls aside as an Ironback charges
- **THEN** the Ironback hits the wall, stands stunned for 2 s, and each hit on it deals 50% more. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The Ironback's charge
A charge SHALL carry the Ironback no more than 3 m past its leash. It SHALL stop dead at a wall, at the edge of a drop of more than 0.6 m, or 3 m past the leash. Each zone with an Ironback SHALL have a wall face of 2 m or more within 3 m past its leash.

#### Scenario: Charge at a ledge
- **WHEN** an Ironback charges toward a drop of 3 m
- **THEN** it stops dead at the edge and does not fall. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: A wall near each Ironback
- **WHEN** the zone test reads the baked walk maps
- **THEN** the Bell Knoll's vale (B1) and Barrow Crown's hollow (W2) each have a wall face of 2 m or more. Each face is within 3 m past the leash. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Zones and waking
Foes SHALL stand in zones. A zone SHALL wake when the lamplighter comes within 10 m of its centre and the zone fits. A zone SHALL fit when its foes and the awake foes together are no more than 6. A zone SHALL also need a free pool slot of the right type for each of its foes.

#### Scenario: Never more than six
- **WHEN** the bot walks every route of every place, and the zone test walks to every point that can be reached
- **THEN** no more than 6 foes are awake at once. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Wait for a free slot
- **WHEN** the Mirelight of the Bell Knoll's side path (B2) is awake. The lamplighter comes within 10 m of the zone under the clock hill (B3).
- **THEN** B3 stays asleep until that Mirelight is put out or B2 sleeps, because the pool has one Mirelight slot. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Rise and sleep
When a zone wakes, ember cracks SHALL show for 0.6 s, and then its foes SHALL rise from the ground. For the 0.9 s of the rise, they SHALL not hurt or be hurt. A zone SHALL sleep when the lamplighter is more than 16 m away and its foes are home.

#### Scenario: A zone wakes
- **WHEN** the lamplighter walks into the south yard of The Sunken Gaol
- **THEN** ember cracks show where the Snuffer will rise, and the Snuffer rises over 0.9 s. A cut during the rise does no damage. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: A zone sleeps
- **WHEN** the lamplighter walks 20 m from the Gaol's south yard while its Snuffer is home
- **THEN** the yard's zone sleeps, and its pool slot is free. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Guard zones always wake
A guard zone SHALL wake also when it does not fit. Then other awake zones SHALL give up their slots, the zone farthest from the lamplighter first, until the guard zone fits. Only a zone whose slots help SHALL go. Its slots help when it has a foe of a type that the guard zone lacks. They also help when the cap of 6 stops the guard zone. A zone that gives up its slots SHALL sleep. Its foes SHALL sink into the ground over 0.6 s with ember cracks, and keep their health.

#### Scenario: The guards of The Crow Wall
- **WHEN** the Pitchrook of the west flank (R3) is awake. The lamplighter comes within 10 m of the guard zone west of the drum (R4).
- **THEN** the R3 Pitchrook sinks into the ground over 0.6 s. Then R4's two Snuffers and its Pitchrook rise. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Every guard can wake
- **WHEN** the zone test stands at each point within 10 m of a guard zone's centre, with the other zones awake that fit
- **THEN** the guard zone's ember cracks show within 1 s each time. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Foes stay out
A foe put out SHALL stay out until the run ends or a reload restarts the place. A zone that sleeps SHALL keep the health of its living foes.

#### Scenario: Come back to a cleared zone
- **WHEN** the lamplighter puts out the Snuffer of the Gaol's south yard, walks 20 m away and comes back in the same run
- **THEN** the yard stays empty, and no ember cracks show. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Foes keep their ground
A foe SHALL stay inside its zone's leash, except in an Ironback's charge. A foe SHALL not walk off a ledge. A foe SHALL chase the lamplighter while it is within the leash plus 8 m, and SHALL walk home after 4 s farther away. A foe SHALL not heal at home. A foe knocked more than 6 m below its zone, or below y −25, SHALL be put out. Its glim SHALL drop on the last firm ground it stood on.

#### Scenario: Leave a fight
- **WHEN** the lamplighter runs 15 m away from a zone with a hurt Snuffer
- **THEN** after 4 s the Snuffer walks home, with the same health as before. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Ledge
- **WHEN** a Snuffer chases the lamplighter toward a pit
- **THEN** it stops before the edge. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Knocked off
- **WHEN** a plunge knocks a Snuffer off a ledge, and it falls more than 6 m below its zone
- **THEN** it goes out, and its 3 glim drop on the ledge where it last stood. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Fair crowds
At most two melee attacks SHALL be under way at once, and at most one thrown coal SHALL be in the air. Foes that wait SHALL hold about 3.5 m away and spread round the lamplighter.

#### Scenario: A group
- **WHEN** three Snuffers and a Pitchrook fight the lamplighter
- **THEN** no more than two hooks wind up or land at the same time, and only one coal is in the air. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Off-screen warnings
When a foe starts a wind-up outside the view, an ember notch SHALL show at the screen's edge toward the foe. The notch SHALL show for the length of the wind-up. A foe to the side SHALL give a notch at the left or right edge. A foe behind the camera's eye SHALL give a notch at the bottom edge. No more than 3 notches SHALL show at once.

#### Scenario: A foe beside the lamplighter
- **WHEN** a test at 390 by 844 spawns a Snuffer 2.5 m to the right of the lamplighter. It holds the Snuffer at 0.1 s of its hook.
- **THEN** the Snuffer is outside the view, and a notch shows at the right edge of the screen. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: A foe behind the camera
- **WHEN** a test spawns a Snuffer 2 m behind the camera's eye, and holds it at 0.1 s of its hook
- **THEN** a notch shows at the bottom edge of the screen. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Beacons in a run
In each place before Barrow Crown, one guard zone SHALL keep the beacon dark until all its foes are put out. Other zones MAY be passed. When one of those four beacons lights, it SHALL bank the glim carried and fill every flask. It SHALL then save the run at the start of the next place, and show the beacon card.

#### Scenario: Guards still stand
- **WHEN** the lamplighter touches the Gaol's beacon while the keep's Snuffers stand
- **THEN** the beacon stays dark. A toast says that it will not catch while its keepers stand in the keep. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Run past a zone
- **WHEN** the lamplighter runs past the first two zones of The Crow Wall, puts out the guards west of the drum and touches the beacon
- **THEN** the beacon lights, the glim carried is banked, and the flasks are full. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Where the keepers stand
While a guard zone has foes, a touch on its beacon SHALL show a toast that names where the keepers stand. The names SHALL be these:
- the keep, in the Gaol;
- west of the drum, on The Crow Wall;
- the mill, in the Fen;
- the terrace, at The Bell Knoll.

#### Scenario: Keepers out of sight
- **WHEN** the lamplighter touches the beacon of The Crow Wall, 14 m from the guard zone, before that zone has woken
- **THEN** the beacon stays dark. The toast says that its keepers stand west of the drum. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: The beacon card
The beacon card SHALL offer two wicks, and the player SHALL choose one. The run's seed SHALL draw the two from the wicks that the run has not chosen. A run SHALL not offer a wick that it has already chosen. A wick SHALL last until the run ends. After the choice, the card SHALL offer Spend glim, which opens the Lamp-room, and Walk on, which loads the next place.

#### Scenario: Choose a wick
- **WHEN** the beacon card shows Keen edge and Quick heels, and the player chooses Keen edge
- **THEN** every blade hit deals 15% more for the rest of the run, and Walk on loads the next place. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Same seed
- **WHEN** two runs with the same seed light the Gaol's beacon, choose the same wick there, and light the beacon of The Crow Wall
- **THEN** both Gaol cards offer the same two wicks, and both Crow Wall cards offer the same two wicks. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: No wick twice
- **WHEN** the player chooses Keen edge at the Gaol's beacon
- **THEN** no later beacon card in that run offers Keen edge. The card at The Bell Knoll offers two of the three wicks not yet chosen. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: A reload at the beacon card
The page SHALL store the two wicks offered with the run. A reload before the choice SHALL show the beacon card again with the same two wicks, over the start of the next place. A reload after the choice SHALL go on at the start of the next place.

#### Scenario: Reload at the beacon card
- **WHEN** the player reloads the page while the Gaol's beacon card offers two wicks
- **THEN** the beacon card shows again over the start of The Crow Wall, with the same two wicks. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Glim
Foes and wisps SHALL drop glim: motes in the lamp colours that fly to the lamplighter from within 6 m after 0.4 s. A Snuffer SHALL drop 3, a Pitchrook 4, a Mirelight 2, an Ironback 8, a wisp 4 and the boss 30. In a run, a wisp SHALL go out when the lamplighter touches it, and SHALL count for that run only. The HUD SHALL show the glim carried.

#### Scenario: Pick up glim
- **WHEN** the lamplighter puts out a Snuffer and stands 3 m away
- **THEN** three motes fly to it, and the glim carried goes up by 3. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Take a wisp
- **WHEN** the lamplighter touches its fifth wisp of The Sunken Gaol in a run, with 1 of 2 flasks
- **THEN** the wisp goes out, the glim carried goes up by 4, and the flasks show 2 of 2. The explorer's save does not change. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Death and the run summary
At 0 health the run SHALL end, and the page SHALL store the ended run at once. The picture SHALL fade to ink over 1.2 s. Then the run summary SHALL show the place reached, the time, the foes put out, the glim lost and the glim banked. The glim carried SHALL be lost. The summary's button SHALL open the Lamp-room. The next run SHALL start in The Sunken Gaol with every foe back.

#### Scenario: Die on The Crow Wall
- **WHEN** the lamplighter dies in The Crow Wall carrying 20 glim, with 44 banked from the Gaol
- **THEN** the summary shows "II · The Crow Wall", 20 glim lost and 44 banked. The next run starts in the Gaol. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Reload in the fade
- **WHEN** the player reloads the page 0.5 s into the fade to ink
- **THEN** the run summary shows with the same figures, and the ended run does not go on. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: The Lamp-room
The Lamp-room SHALL show the glim banked and five lasting upgrades. Each upgrade SHALL show its level and the cost of the next level. A Buy button SHALL spend the cost and raise the level. A Buy button SHALL be off when the bank holds less than the cost, and SHALL say how much more is needed. Begin the run SHALL start a new run. Wander SHALL show once it is open.

#### Scenario: Buy an upgrade
- **WHEN** the bank holds 50 glim and the player buys Mantle
- **THEN** the bank shows 10 and Mantle shows level 1. The next run starts with 115 health. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Not enough glim
- **WHEN** the bank holds 30 glim
- **THEN** the Flask upgrade's Buy button is off, and it says that 30 more glim is needed. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: The Lamp-room from a beacon card
When the Lamp-room opens from a beacon card, it SHALL show Back to the beacon in place of Begin the run and Wander. Back to the beacon SHALL return to the beacon card. An upgrade bought there SHALL work at once, for the rest of the run and the runs after it.

#### Scenario: Back to the beacon
- **WHEN** the player chooses a wick, presses Spend glim and then Back to the beacon
- **THEN** the beacon card shows Spend glim and Walk on again. The Lamp-room did not show Begin the run or Wander. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Buy at a beacon
- **WHEN** the player buys Edge from a beacon card's Spend glim
- **THEN** the blade deals 12% more at once, for the rest of this run and the runs after it. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The lasting upgrades
The Lamp-room SHALL sell the five upgrades in this table.

| Upgrade | Each level | Costs |
|---|---|---|
| Mantle | 15 more maximum health | 40, 80, 140 |
| Flask | one more flask | 60, 150 |
| Edge | 12% more blade damage | 50, 100, 170 |
| Draught | each flask heals 10 more points: 35%, then 45% and 55% of the maximum health | 45, 110 |
| Ash pocket | keep 30% of the glim carried at death | 120 |

#### Scenario: All upgrades
- **WHEN** a player has bought every level
- **THEN** a run starts with 145 health and 4 flasks. Each flask heals 55%, the blade deals 36% more, and a death keeps 30% of the glim carried. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: How upgrades and wicks add up
The damage bonuses of Edge and Keen edge SHALL add. Damage SHALL round to the nearest whole number. A Mantle level bought in a run SHALL raise the maximum health and the health by 15. A Flask level bought in a run SHALL add one full flask.

#### Scenario: Bonuses add
- **WHEN** Edge is at level 3 and the run has Keen edge
- **THEN** the blade deals 51% more: the first cut deals 15 and the finisher 33. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Mantle at a beacon
- **WHEN** the lamplighter has 60 of 100 health and the player buys Mantle from a beacon card's Spend glim
- **THEN** the HUD shows "75/115". Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The boss arrives
At the east foot of Barrow Crown, the boss SHALL wait in an arena of 6.5 m. The first time in a visit that the lamplighter comes within 11 m, the game SHALL stop for 2.4 s. Black bars SHALL show, and a card SHALL name the Barrow Reeve. Then the boss bar SHALL show and the fight SHALL start. Twelve grave candles SHALL light round the arena.

#### Scenario: Intro
- **WHEN** the lamplighter walks to within 11 m of the arena for the first time
- **THEN** bars ease in, the card reads "The Barrow Reeve", the boss bar shows, and the candles light. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Touch the dark beacon first
- **WHEN** the lamplighter touches the beacon of Barrow Crown before the boss falls
- **THEN** the beacon stays dark, and a toast points to the keeper at the crown's east foot. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Boss phases
The Barrow Reeve SHALL have 1,300 health in three phases: down to 800, down to 350, and down to 0. At each change it SHALL stumble for 2 s and take no damage. Each phase SHALL add attacks and shorten the gap between them: 1.0, 0.75 and 0.55 s. If the lamplighter leaves the arena, the boss SHALL walk back to its centre and keep the damage it took.

#### Scenario: Phase change
- **WHEN** the boss's health falls below 800
- **THEN** it stumbles for 2 s, and hits do no damage for that time. The lamp-shards start to come. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Leave and come back
- **WHEN** the lamplighter leaves the arena with the boss at 900 health and comes back
- **THEN** the boss is at 900 health. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Boss attacks
The boss SHALL choose each attack from where the lamplighter stands. It SHALL not use the same attack three times in a row. Phase 1 SHALL have the crook sweep and the cage slam. Phase 2 SHALL add the lamp-shards and the stalking lunge. Phase 3 SHALL add the double sweep. After the cage slam, the boss SHALL stay open for 1.5 s and take 50% more damage. No boss hit SHALL take more than 22 health.

#### Scenario: Behind the boss
- **WHEN** the lamplighter stands behind the boss within 3.5 m, and the boss's last two attacks were not slams
- **THEN** the boss starts the cage slam, and a ring grows to 3.4 m at its feet over 1.0 s. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Far from the boss
- **WHEN** the boss stands at the arena's edge in phase 2, and the lamplighter stands 10 m from it in the arena. The boss's last two attacks were not lunges.
- **THEN** the boss starts the stalking lunge, and a lane grows on the ground toward the lamplighter over 0.7 s. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The lamp-shards
The lamp-shards SHALL fall into three rings of 1.3 m: one at the lamplighter and one 2.5 m to each side. Each ring SHALL grow on the ground over the 0.9 s wind-up. A shard SHALL hit for 14, and only inside its ring.

#### Scenario: Lamp-shards
- **WHEN** the boss starts the lamp-shards
- **THEN** three fire rings of 1.3 m grow over 0.9 s, and a shard hits only inside its ring. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The win
When the boss falls, the caged light SHALL rise and follow the lantern. When the lamplighter carries it to the beacon of Barrow Crown, the beacon SHALL light, and it SHALL bank the glim carried. The run clock SHALL stop. The win card SHALL show the time, the best winning time, the glim banked, the runs and the deaths. The win card SHALL open the Lamp-room or Wander. The first win SHALL open Wander.

#### Scenario: Carry the light
- **WHEN** the boss falls, and the lamplighter walks up to the beacon with the light, carrying 58 glim with 100 banked
- **THEN** the beacon burns, the bank goes up to 158, and the win card shows 1.8 s later. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: First win opens Wander
- **WHEN** a player wins for the first time and opens the Lamp-room
- **THEN** the Lamp-room shows Wander. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Pause
The pause panel SHALL stop the game. It SHALL show the five places of the run with the current one marked, the run time, Resume, a sound switch, and End the run. End the run SHALL ask again, and then end the run as a death does. M, P, Escape and Resume SHALL close the panel, and so SHALL Start, the pad's Back button and B.

#### Scenario: Pause and resume
- **WHEN** the player presses P in a fight and then Escape
- **THEN** no foe moves while the panel shows. After Escape, the fight goes on from where it stopped. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Saved run
The run SHALL save under its own key, `gloam-downs.run.v1`. The save SHALL hold the bank, the upgrade levels, runs, wins, deaths, the furthest place, the best winning time and the sound setting. It SHALL also hold the run in progress, with any wick offer not yet chosen. It SHALL hold the summary of an ended run until its card closes. The page SHALL check each saved field. A run SHALL not change the explorer's save.

#### Scenario: Bad run save
- **WHEN** the run save holds wrong types, unknown upgrades or levels out of range
- **THEN** the page drops the bad fields and starts as normal. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: An old page
- **WHEN** a cached explorer page loads and stores its own save while a run save exists
- **THEN** the bank and the upgrades stay as they were. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: When the run is stored
The page SHALL store the run at once on each hit taken, each drink, each wick chosen, each lit beacon and at 0 health. It SHALL also store it at least every 2 s of play. A reload SHALL restart the current place. Health and flasks SHALL be the lower of the entry values and the stored values. The glim carried SHALL go back to its entry value. Every foe and wisp of the place SHALL be back.

#### Scenario: Reload in a place
- **WHEN** the lamplighter enters Lantern Fen with 80 health and 12 glim, and then drops to 50 health and gains 10 glim. The player reloads.
- **THEN** the run goes on at the start of Lantern Fen with 50 health and 12 glim carried. Every foe and wisp of Lantern Fen is back. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Reload just after a hit
- **WHEN** a hook takes the lamplighter from 60 to 44 health, and the player reloads on the next frame
- **THEN** the run goes on with 44 health. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Wander
Wander SHALL be the explorer as it was before the run, with no foes, no health and no glim. It SHALL have Map travel, the end card, Walk again and the explorer's save. Wander SHALL open from the Lamp-room after the first win, or when the explorer's save shows a finished walk. `?wander` SHALL open it. A reload in Wander SHALL open Wander again. Wander's Map SHALL have a way back to the Lamp-room.

#### Scenario: A walker from before
- **WHEN** a visitor whose explorer save has one finished walk opens the page for the first time since the run came. The visitor closes the help card.
- **THEN** the Lamp-room shows with Wander. Wander opens with the places that the visitor reached before. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: The HUD in a run
The HUD SHALL show the place, a health bar with its number, a pip for each flask, and the wisps and glim carried. The toast SHALL show 8 px under the HUD's measured bottom. In a boss fight, a boss bar SHALL show. On a touch screen it SHALL be in the Lab bar row between ◀ Lab and Games. With a fine pointer it SHALL be at the bottom centre.

#### Scenario: Health line
- **WHEN** the lamplighter has 74 of 100 health and 1 of 2 flasks
- **THEN** the HUD shows "74/100" beside a bar filled 74%, with one full pip and one empty pip. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Toast in each layout
- **WHEN** a toast of 60 characters shows at 320 by 640, 390 by 844, 360 by 640, 800 by 600 and 1280 by 720
- **THEN** in each layout it is inside the screen, and it does not overlap the HUD, the Lab bar, the tools or a touch button. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Phone layouts
At 320 by 640 and 390 by 844 on a touch screen, every run control SHALL be inside the screen. It SHALL be at least 44 px on its shorter side. Each control SHALL be clear of the Lab bar, the HUD, the tools, the toast and the other controls. The stick SHALL have the left half of the screen below the HUD. The page SHALL not scroll sideways.

#### Scenario: 390 by 844
- **WHEN** the run plays at 390 by 844 on a touch screen
- **THEN** Attack is 84 px, Jump 72 px, Roll 64 px and Heal 52 px, at the bottom right. The overlap check finds nothing. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: 320 by 640
- **WHEN** the run plays at 320 by 640 on a touch screen
- **THEN** Attack is 76 px, Jump 64 px, Roll 60 px and Heal 48 px. The boss bar fits between ◀ Lab and Games, and the overlap check finds nothing. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Short windows and desktop
In windows 660 px tall or less, the touch buttons SHALL use their small sizes. At 360 by 640 and 800 by 600, every control SHALL be inside the screen, at least 44 px, and clear of the others. At 1280 by 720 with a fine pointer, no touch button SHALL show. There, the boss bar SHALL be at the bottom centre, 520 px wide.

#### Scenario: 360 by 640 and 800 by 600
- **WHEN** the run plays at 360 by 640 or at 800 by 600 on a touch screen
- **THEN** the buttons use the small sizes, and every control is at least 44 px and inside the screen. The overlap check finds nothing. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: 1280 by 720
- **WHEN** the run plays at 1280 by 720 with a mouse
- **THEN** no touch button shows, and the HUD and tools are where the explorer has them. The boss bar is 520 by 44 px, 24 px above the bottom. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Cards fit the screen
Each card SHALL fit each of the five layouts. The cards SHALL be the help card, the Lamp-room, the beacon card, the pause panel and the run summary. They SHALL also be the win card, Wander's Map and Wander's end card. Each card's main button SHALL be inside the screen without a scroll of the page. Every button SHALL be at least 44 px.

#### Scenario: Lamp-room in a short window
- **WHEN** the Lamp-room shows at 360 by 640
- **THEN** Begin the run is inside the screen with no scroll, and every Buy button is at least 44 px. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Wander in short windows
- **WHEN** Wander's Map and then Wander's end card show at 360 by 640 and at 800 by 600
- **THEN** the Lamp-room button, every place button and Walk again are inside the screen with no scroll. Each one is at least 44 px. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Hit feel
The game SHALL stop for a short hit stop on each hit, while the picture goes on. Hit stop SHALL be 3 steps (0.05 s) for a cut. It SHALL be 5 steps (0.083 s) for the finisher, the plunge and a hurt lamplighter. It SHALL be 6 steps (0.10 s) for the boss slam, and 9 steps (0.15 s) for a boss phase change and for death. Hit stop SHALL not exceed 9 steps in any 30 steps. A hit foe SHALL flash for 3 steps and shake in the picture only. The camera SHALL kick on heavy hits.

#### Scenario: A cut lands
- **WHEN** a test ticks one step at a time, and draws after each step, while the first cut hits a Snuffer
- **THEN** the game holds for 3 steps. The Snuffer is fire-bright on the 3 steps from the hit and not on the 4th. The shape that hits test against does not move. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Effects off
- **WHEN** the e2e turns off every feel effect with `__gloam.fx`, and plays 30 s of the Gaol
- **THEN** the run plays, and the lamplighter puts out a Snuffer. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Effects on game time
Every effect SHALL be timed in whole steps of the game clock, and these steps SHALL go on during hit stop. So a flash, a blink, a tint or a zoom SHALL last the same at every frame rate and in `?test`. The hurt blink SHALL hide and show the figure every 4 steps (0.067 s). The zoom on a heavy hit SHALL last 7 steps (0.117 s).

#### Scenario: Flash at two frame rates
- **WHEN** the Node test lands the same cut on a Snuffer, and takes the same hook, at 30 and at 144 frames a second
- **THEN** the hit flash and the hurt tint each last 3 steps (0.05 s) at both rates. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Reduced motion
When the system asks for reduced motion, the camera SHALL not kick, zoom or turn by itself. The hurt blink SHALL change every 8 steps (0.133 s). The white flash at the boss's fall SHALL not show, and the low health tint SHALL not pulse.

#### Scenario: Reduced motion
- **WHEN** the e2e turns reduced motion on and runs a hit and a boss slam. Then it runs 3 s with an awake foe at 60° to the side and no look input.
- **THEN** the camera kick and the zoom stay at zero, and the view does not turn by itself. The blink changes every 8 steps. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: The look in a fight
With foes on screen, every place SHALL keep the dark look. Foes SHALL add no bright colour other than fire, lamp and wisp. Foes SHALL be baked with Ink Studio as splats, so they take each place's palette, dither and outlines.

A bright pixel that foes add SHALL be a pixel that the foes change and that is brighter than a floor. The floor SHALL be the larger of two values. One is 0.42, the luminance of fire slot 34. The other is the dimmest of the brightest 1% with no foes.

#### Scenario: Measure a fight
- **WHEN** the e2e draws The Sunken Gaol with 5 foes awake, and Lantern Fen and Barrow Crown with 6 foes and a ground marker each. It draws each view at the phone and the desktop art size, and again with no foe awake.
- **THEN** each view with foes has a mean luminance from 0.05 to 0.32, and 0.05% to 12% of its pixels are brighter than 0.55. At least 95% of the bright pixels that the foes add are within 12 of a fire, lamp or wisp colour in 8-bit RGB. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Warning moves read
A warning move SHALL add clear fire to the picture, in fire slots 34 to 37. The check SHALL draw a foe 4 m in front of the lamplighter at the default camera. `__gloam.spawn` SHALL put the foe there, and `__gloam.hold` SHALL keep it in its move.

#### Scenario: Measure a tell
- **WHEN** the e2e draws a Snuffer at rest and at the end of its hook's wind-up
- **THEN** inside the Snuffer's box on screen, the art pixels within 12 of fire slots 34 to 37 are counted. At the end there are at least 3 times as many as at rest, and at least 8 more. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Measure a ground marker
- **WHEN** the e2e draws an Ironback in The Bell Knoll at the start and at the end of its slam's wind-up
- **THEN** the ring adds at least 20 art pixels within 12 of fire slots 34 to 37 on the ground round it. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Foe budget
The foes SHALL come from two files: `foes.bin.gz` with the splats, and `foes.json.gz` with the types, splat ranges, bones, pivots and pose keyframes. The two foe files SHALL be at most 200 KB together. The boss SHALL come from `boss.bin.gz` and `boss.json.gz`, at most 100 KB together. Each place, with its pool of foes, SHALL have no more than 275,000 splats. At most 6 foes SHALL be awake at once.

#### Scenario: Budget check
- **WHEN** the Node test reads the baked worlds, the foe files, the boss files and each place's pool
- **THEN** the foe files are 200 KB or less together, and the boss files 100 KB or less. Each place with its pool has 275,000 splats or fewer. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Place files and zones
The run SHALL not change `<id>.bin.gz` or `<id>.walk.bin.gz` of any place. The zones SHALL go into `<id>.json` only.

#### Scenario: Bake with and without zones
- **WHEN** the bake runs for a place with its zones, and again with its zones taken out
- **THEN** the two `.bin.gz` files are the same, and the two `.walk.bin.gz` files are the same. The two `<id>.json` files differ only in `zones`. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Download in a run
A place's 1.5 MB SHALL count its three files: `<id>.bin.gz`, `<id>.walk.bin.gz` and `<id>.json`. The foe files and the boss files SHALL not count toward it. Before play starts in a place, the page SHALL download only the place's three files and the two foe files. It SHALL not download the foe files when the cache has them. That SHALL be no more than 1.7 MB in all. The boss files SHALL load after play starts, and the arena SHALL stay asleep until they have loaded.

#### Scenario: Sizes
- **WHEN** the Node test adds the sizes of each place's three files, and then adds the sizes of the two foe files
- **THEN** each place's three files come to 1.5 MB or less, and each sum with the foe files to 1.7 MB or less. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Boss files after a reload
- **WHEN** a run reloads in Barrow Crown with an empty cache
- **THEN** play starts before the boss files have loaded, and the arena wakes only after they have loaded. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Foe and boss files that do not load
When the foe files do not load, the loading screen SHALL say so and show Try again. Try again SHALL ask for the files again. The lamplighter can come within 11 m of the arena before the boss files are in. Then the page SHALL pause the game and show the loading screen. The loading screen SHALL show progress, or say that the files did not load and show Try again.

#### Scenario: The foe files fail
- **WHEN** the e2e makes the foe files fail once, and the player presses Try again
- **THEN** the loading screen says that the foes did not load. After Try again, the place loads and play starts. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: The boss files fail
- **WHEN** the e2e makes the boss files fail, and the lamplighter walks to within 11 m of the arena
- **THEN** the game pauses, and the loading screen says that the keeper did not load and shows Try again. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Frame cost in a fight
A fight SHALL cost little more than the place alone. The place alone SHALL mean the place with the lamplighter's bones and no pool. The checks run on this machine's Node and software WebGL, so they compare ratios.

#### Scenario: Picture cost
- **WHEN** the e2e draws a view of The Bell Knoll at the phone art size three times, with all 6 pool slots awake on screen. It draws the same view three times in Wander, which loads no pool.
- **THEN** the median frame with foes takes no more than 1.30 times the median in Wander. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Sort cost
- **WHEN** the Node bench sorts each place with its largest awake set on bones. The other slots are parked at density 0 and off the bones. In Barrow Crown it also sorts the boss fight, with the boss alone on bones. Each figure is the best median of 3 rounds of 60 frames.
- **THEN** each sort takes no more than 1.45 times the sort of the same place alone. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Foe cost
- **WHEN** the Node bench steps 6 awake foes with their sight tests and bodies for 600 steps
- **THEN** the median step takes 0.5 ms or less. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Test mode for the run
With `?test`, the page SHALL not run its loop. A test SHALL step the run with `__gloam.tick(seconds, held)` at 60 steps a second. `held` SHALL name the held inputs: mx, mz, jump, slow, ox, attack, roll, heal and look. `__gloam.run()` SHALL return the run state, and `__gloam.foes()` the awake foes. With `?seed=N`, the run's seed SHALL be N. With `?fresh`, the page SHALL start with a fresh run save and a fresh explorer save.

#### Scenario: Same seed, same run
- **WHEN** a test plays 30 s of the Gaol twice with `?test&seed=7&fresh` and the same held inputs
- **THEN** the run state and the foes are the same both times. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Test hooks for foes
With `?test`, the page SHALL give these hooks for foes:
- `__gloam.wake(zone)` SHALL wake a zone in free slots of the pool.
- `__gloam.spawn(type, x, z, yaw)` SHALL wake one foe at a point in a free slot.
- `__gloam.hold(foe, move, t)` SHALL keep a foe's pose and place at time t of a move.

#### Scenario: Hold a wind-up
- **WHEN** a test spawns a Snuffer 4 m in front of the lamplighter and holds it at 0.55 s of its hook. It draws, ticks 1 s and draws again.
- **THEN** both pictures show the same pose of the Snuffer, and the hook does not land. Check: e2e `gloam-downs-run.e2e.mjs`.

#### Scenario: Spawn with no free slot
- **WHEN** a test spawns a Snuffer in the Gaol while its 5 pool slots are awake
- **THEN** nothing new wakes, and the call says that no slot is free. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Test hooks for the run's state
With `?test`, the page SHALL give these hooks for the run's state:
- `__gloam.fx(flags)` SHALL turn the stop, flash, kick, zoom, grade and shake effects on or off.
- `__gloam.set(fields)` SHALL set health, flasks, glim carried, the bank and the upgrades.
- `__gloam.go(id)` SHALL move the run to the start of a place.
- `__gloam.sounds()` SHALL return a log of the sound cues, each with its cue name and its game step.

#### Scenario: Sound log
- **WHEN** a test spawns a Snuffer 2 m in front of the lamplighter, ticks until its hook lands, and reads `__gloam.sounds()`
- **THEN** the log has the scrape cue on the first step of the wind-up, and the hurt cue 33 steps later. Check: e2e `gloam-downs-run.e2e.mjs`.

### Requirement: Pacing
A bot SHALL check the run's numbers with the page's own rules on the real walk maps. The pacing targets SHALL be these:
- Skill 0.3: the median first win SHALL be in run 3 to 6.
- Skill 0.9: the median first win SHALL be in run 1 or 2.
- Skill 0.5: three of four bots SHALL need 3 boss tries or fewer.
- Skill 0.5: the median boss fight SHALL last 50 to 110 s.
- Skill 0.5: the median winning run that takes every wisp SHALL last 6 to 12 minutes of game time.

#### Scenario: Bot runs
- **WHEN** `node qa/lab/gloam-downs-bot.mjs 60 0.3 1` runs, and the same command at skill 0.5 and at skill 0.9
- **THEN** each pacing target holds. Check: the bot, `gloam-downs-bot.mjs`.

### Requirement: Bot run time
Each bot SHALL play until its first win, or for 12 runs. The three bot commands of 60 bots each SHALL finish in less than 10 minutes together on the development machine.

#### Scenario: Bot time
- **WHEN** the three bot commands of the Pacing check run one after the other
- **THEN** they finish in less than 10 minutes together. Check: the bot, `gloam-downs-bot.mjs`.

### Requirement: Sound in a run
The run SHALL make its sound in code with WebAudio, with no sound files. It SHALL have a cue for each warning move, hits, hurt, glim, the beacon and the boss. Sound SHALL start only after a press on the page. The pause panel's switch SHALL turn it off and on, and the choice SHALL be saved. Sound SHALL stop while the page is hidden.

#### Scenario: Hidden page
- **WHEN** `node qa/arcade/quiet.mjs --only=lab/gloam-downs` runs with the site served
- **THEN** the run's sound plays after Begin the run, stops while the page is hidden, and comes back when it shows. Check: `qa/arcade/quiet.mjs`.

### Requirement: Original names
Every name in the run SHALL be original, and SHALL be one of these:
- the places: The Sunken Gaol, The Crow Wall, Lantern Fen, The Bell Knoll and Barrow Crown;
- the foes: the Snuffer, the Pitchrook, the Mirelight, the Ironback and the Barrow Reeve;
- the currency and the rooms: glim, the Lamp-room and Wander;
- the wicks: Long wick, Keen edge, Quick heels, Heavy fall, Spare oil and Close shave;
- the upgrades: Mantle, Flask, Edge, Draught and Ash pocket.

#### Scenario: Names on screen
- **WHEN** the Node test reads every place, foe, wick, upgrade and card title in the run's data
- **THEN** each one is a name in this list, and no place name has the word "Ramparts". Check: Node test `gloam-downs-run.test.mjs`.
