## ADDED Requirements

### Requirement: A run through the five places
Gloam Downs SHALL open in a combat run. A run SHALL go through the five places in this order: The Sunken Gaol, The Crow Wall, Lantern Fen, The Bell Knoll and Barrow Crown. A run SHALL start with 100 health plus 15 for each Mantle level. It SHALL start with 2 flasks plus 1 for each Flask level. The health and the flasks SHALL be full, and no glim SHALL be carried. The Map SHALL not travel between places during a run.

#### Scenario: First visit
- **WHEN** a visitor opens `/lab/gloam-downs/` for the first time
- **THEN** the help card shows the run's controls. After Begin the run, the lamplighter stands at the start of The Sunken Gaol with 100 health and 2 flasks. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

#### Scenario: Later visit
- **WHEN** a visitor who was not in Wander, and has no run in progress, opens the page
- **THEN** the Lamp-room shows over the start view of The Sunken Gaol. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

#### Scenario: The order holds
- **WHEN** the lamplighter lights the beacon of The Crow Wall and chooses Walk on
- **THEN** Lantern Fen loads next. The pause panel shows the Gaol and The Crow Wall as passed, and Lantern Fen as the current place. The Bell Knoll and Barrow Crown show as ahead. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Controls on the cards
The help card and the pause panel SHALL show the controls for the input in use. When the page reads a gamepad, they SHALL show the pad's controls. On a touch screen, they SHALL show the touch controls. Otherwise they SHALL show the keys and the mouse.

A browser shows a pad to the page only after its first press. When a pad first shows up while the help card shows, the card SHALL change to the pad's controls. That first press SHALL not press a button of the card.

#### Scenario: Pad controls on the help card
- **WHEN** a visitor opens the page for the first time with a mocked gamepad connected from the load
- **THEN** the help card shows "A jump", "X attack", "B roll", "Y heal" and "Start pause". Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: A pad that shows up on its first press
- **WHEN** the help card shows on a first visit, and a mocked gamepad shows up only on its first press of A. The e2e presses A twice.
- **THEN** the first A changes the card to "A jump", "X attack" and the other pad controls, and the card stays. The second A starts the run. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: The mouse lines on the cards
With the keys and the mouse, the controls on the help card and the pause panel SHALL start with "Click the view to take the mouse. Move the mouse to look. Left click attacks, right click rolls. Esc frees the mouse." Without pointer lock, the first line SHALL be "Hold the right button and drag the view to look. Left click attacks."

#### Scenario: The pause panel says how the mouse works
- **WHEN** at 1280 by 720 the player opens the pause panel with the mouse taken, and in a browser with no pointer lock opens the help card
- **THEN** the pause panel's first line is the mouse line, and the help card's first line is the drag line. Check: e2e `gloam-downs-mouse.e2e.mjs`, with a screenshot of the pause panel.

### Requirement: Fixed game step
The page SHALL step the game at a fixed 1/60 s, as many steps as the frame took. It SHALL take no more than 15 steps for each frame. A time that is not a whole number of steps SHALL round to the nearest step. Timings of moves, warning moves and safe time SHALL be the same at every frame rate.

#### Scenario: Frame rates
- **WHEN** the Node test plays the same string, roll and Snuffer hook at 30, 60, 120 and 144 frames a second. At f frames a second, frame i covers the time from (i − 1)/f to i/f, and adds 1/f to `acc`. Each press is read by frame k·f/6 + 1, the first frame after k/6 s. k/6 s is a whole number of frames at each rate.
- **THEN** each press counts on step 10k + 1 at each rate. At each rate, the hook lands on the same play step, and the roll's safe time starts and ends on the same play steps. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The step count
The page SHALL add each frame's time in seconds to an accumulator, `acc`. The frame SHALL then take n = floor(`acc` × 60 + 10⁻⁶) steps, and `acc` SHALL lose n/60. When n is more than 15, the frame SHALL take 15 steps, and `acc` SHALL go to 0. A frame SHALL read the input before its steps. A press SHALL count on the first step that runs after it is read, in that frame or a later one.

#### Scenario: Steps at 144 Hz
- **WHEN** the Node test feeds 1,440 frames of 1/144 s to the step count
- **THEN** it takes exactly 600 steps. At 30, 60, 120 and 144 frames a second, the step total after the frame that ends at k/6 s is exactly 10k, for each k. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Two clocks
The game clock SHALL count every step. The play clock SHALL count the steps outside hit stop. Moves, wind-ups, recoveries, safe time and cooldowns SHALL run on the play clock. Effects SHALL run on the game clock.

#### Scenario: Hit stop holds the play clock
- **WHEN** a cut lands on a Snuffer during the Snuffer's wind-up
- **THEN** the play clock stops for the 3 steps of hit stop, and the game clock goes on. The hook lands 33 play steps after its wind-up starts. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Base values
The numbers of the moves, the roll, the plunge, health and the flasks SHALL be the values with no upgrade and no wick. Only The lasting upgrades and The wicks SHALL change them.

#### Scenario: A run with no upgrade and no wick
- **WHEN** a fresh save starts a run, and the run has chosen no wick
- **THEN** the first cut deals 10, and a drink heals 35 of 100. The next roll can start 0.25 s after one ends, and the plunge hits within 1.6 m. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The blade
The Attack control SHALL swing the blade in a string of three hits: two cuts, then a finisher. A press up to 0.15 s early SHALL be kept. A press of Attack during a hit SHALL be kept until the next hit can start. Each next hit SHALL be able to start 0.10 s into the recovery of the hit before, also the first cut after a finisher. Holding Attack SHALL go on with the string. The string SHALL start again at the first cut 0.35 s after the recovery of the last hit ends.

#### Scenario: Hold
- **WHEN** the player holds Attack for 2 s near a Snuffer held still by a test
- **THEN** full strings follow one another. Each hit starts 0.10 s into the recovery of the hit before, ±1 play step. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: The string starts again
- **WHEN** the player lands two hits, then presses Attack 0.7 s after the second hit's recovery ends
- **THEN** the next hit is the first cut. A press 0.2 s after that recovery ends gives the finisher instead. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: A press in a hit
- **WHEN** the player presses Attack once at the start of a cut, and once more in that cut's active time
- **THEN** the second cut starts as soon as it can, 0.10 s into the first cut's recovery. Check: Node test `gloam-downs-run.test.mjs`.

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

### Requirement: The swings
The blade SHALL swing in a wide arc that a player can read at play distance. Each hit SHALL draw the blade back, hold it at the top, strike fastest at the hit, follow through past the target and settle into a guard that leads into the next hit. On the play step that a hit lands, the pose SHALL show the blade within 20° of straight ahead, and hit stop SHALL hold that pose. The body SHALL twist, lean, squash and step with the blade.

#### Scenario: The hit lands where the blade is
- **WHEN** the player holds Attack 2.6 m from a training post
- **THEN** on the step each hit lands, the blade's tip is within 20° of straight ahead. The strike's top speed is at least 1.6 times the wind-up's (1.2 times for the first cut after a finisher). A cut's tip sweeps at least 200°, and the finisher's tip falls at least 1.8 m. The tip stays at least 0.1 m over the floor and out of the body and the head. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Smooth poses
No part of the lamplighter SHALL jump from one pose to the next. Each move SHALL ease in from the pose shown before it, and the walk SHALL ease back after it. The lantern SHALL swing after the blade.

#### Scenario: No pose jumps
- **WHEN** the lamplighter rolls, is hit, or ends a cut and walks on
- **THEN** outside a cut's wind-up and strike the blade's tip moves at most 0.4 m in one play step, and in a held string it moves at most 1.0 m outside a strike (1.5 m in the first cut's wind-up after a finisher). The hand moves at most 0.55 m in one step, and the lantern's fastest step comes after the blade's. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The swing's trail
Each swing SHALL lay a short trail of bright smears along the blade's arc. The trail SHALL hold in hit stop.

#### Scenario: A trail on a phone
- **WHEN** the first cut lands at 1280×720 and at 390×844
- **THEN** the hit step's picture has at least 12 more lamp pixels round the figure than the same cut with the trail turned off, and the trail changes no cue. Check: `gloam-downs-run.swing.e2e.mjs`.

### Requirement: Phase cues
The page SHALL log the phase cues of each hit in `__gloam.sounds()`: `swing` as the wind-up starts, `strike` as the blade leaves the top, `hit` on the step it meets a target, and `whiff` (when it met nothing) and `recover` as the active time ends. The plunge SHALL log `drop` as it falls.

#### Scenario: Phase cues
- **WHEN** the player swings the string at a training post
- **THEN** each hit logs `swing` on its first step, `strike` 4 steps later (9 for the finisher), `hit` 6 steps after `swing` (12 for the finisher) and `recover` 11 steps after `swing` (18 for the finisher). A cut that meets nothing logs `whiff` with `recover`. Check: Node test `gloam-downs-run.test.mjs`, and `gloam-downs-run.swing.e2e.mjs` in the browser.

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

### Requirement: A clear line
A line SHALL be clear when no point on it, at steps of 0.25 m, is inside a solid of the walk map. Each point SHALL be above the floor under it. Where the walk map has a gap, each point SHALL also be below the gap's underside.

#### Scenario: Aim under an arch
- **WHEN** a Snuffer stands 3 m away under an arch with 2.2 m of clearance, and the lamplighter stands outside the arch
- **THEN** the line from the eye to the Snuffer's chest is clear, and the cut turns to the Snuffer. Check: Node test `gloam-downs-run.test.mjs`.

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
- **WHEN** a Snuffer stands 2.0 m in front of the lamplighter, centre to centre, and winds up its hook. The player rolls through the Snuffer 0.2 s before the hook lands.
- **THEN** the lamplighter takes no damage and comes out behind the Snuffer. When the roll's safe time ends, it is outside the hook's arc. Check: Node test `gloam-downs-run.test.mjs`.

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
Attack in the air, with the feet at least 0.8 m above the floor, SHALL start a plunge. The plunge SHALL hang for 0.08 s, then fall straight down at 16 m/s. The landing SHALL hit every foe whose edge is within 1.6 m of the landing point. Its damage SHALL be 16, plus 3 for each metre fallen over 1 m, and no more than 28. A plunge SHALL knock down light foes and stop their wind-up. Attack lower in the air SHALL do the first cut.

#### Scenario: Plunge onto a Pitchrook
- **WHEN** the lamplighter jumps from a ledge 2 m above a Pitchrook and presses Attack over it
- **THEN** it falls straight down, and the Pitchrook takes 19 damage or more and is knocked down. A ring of sparks shows on the ground. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Flasks
The Heal control SHALL drink one flask. A drink SHALL take 0.8 s at a slow walk of 1.5 m/s. At its end, the drink SHALL heal 35% of the maximum health. A hit or a roll SHALL stop the drink and keep the flask. A press of Heal at full health SHALL keep the flask, and a toast SHALL say that health is full. Each lit beacon SHALL fill every flask. The fifth wisp of a place SHALL fill one flask.

#### Scenario: Drink
- **WHEN** the lamplighter has 40 of 100 health and 2 flasks, and the player presses Heal
- **THEN** after 0.8 s it has 75 health and 1 flask. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Drink stopped
- **WHEN** a hit lands 0.5 s into a drink
- **THEN** the drink stops, the hit's damage is taken, and the flask count does not change. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: No flasks
- **WHEN** the player presses Heal with no flasks left
- **THEN** a toast says that a lit beacon fills the flasks, and nothing else happens. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Full health
- **WHEN** the lamplighter has 100 of 100 health and 2 flasks, and the player presses Heal
- **THEN** a toast says that health is full, and the HUD still shows 2 flasks. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Keyboard in a run
In a run, each key press SHALL count once, and the keys SHALL do these things:
- WASD or the arrows SHALL move, and Shift SHALL walk.
- Space SHALL jump.
- J or Z SHALL attack.
- K or X SHALL roll.
- L or C SHALL heal.
- Q and E SHALL turn the view.
- R SHALL face the nearest awake foe within 10 m, or the boss within 10 m while the fight has started and the boss is up. With neither, R SHALL look ahead.
- M, P or Escape SHALL open the pause panel.

#### Scenario: Keys with WASD
- **WHEN** the player holds A and presses K, then presses J
- **THEN** the lamplighter rolls to the left of the camera, and then swings the first cut. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Keys with the arrows
- **WHEN** a test sets 60 of 100 health, and the player holds the right arrow and presses X, then Z, then C
- **THEN** the lamplighter rolls to the right, swings, and drinks a flask. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Face the foe
- **WHEN** an awake foe stands 6 m behind the lamplighter and the player presses R
- **THEN** within 0.5 s, the yaw difference to the foe, seen from the lamplighter, is 10° or less. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Face the boss with reduced motion
- **WHEN** reduced motion is on, the boss stands 8 m behind the lamplighter in the arena, and the player presses R
- **THEN** within 0.5 s, the yaw difference to the boss is 10° or less. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Mouse in a run
In a run, the mouse SHALL work as in the explorer's "Mouse look", with these buttons while it is taken: a left press SHALL attack at once, and holding the left button SHALL go on with the string. A right press SHALL roll. The click that takes the mouse SHALL do nothing else. No mouse movement SHALL swing, and no click SHALL turn the view. Without pointer lock, the left button SHALL attack and the right button held and dragged SHALL turn the view. The context menu SHALL not show on the view.

#### Scenario: Click to attack
- **WHEN** the mouse is taken and the player clicks the left button on the view with a training post 2 m ahead
- **THEN** the lamplighter swings one cut on the press, with no wait for the release, and the yaw does not change. Check: e2e `gloam-downs-run.input.e2e.mjs` and `gloam-downs-mouse.e2e.mjs`.

#### Scenario: Look with no button
- **WHEN** Begin the run has taken the mouse and the player moves it 100 px right and 40 px down with no button held
- **THEN** the view turns right by more than 0.15 rad (measured 0.22) and tilts down, and the lamplighter does not swing. Check: e2e `gloam-downs-mouse.e2e.mjs`, and `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Right click rolls
- **WHEN** the mouse is taken and the player presses the right button
- **THEN** the lamplighter rolls, and the yaw does not change. Check: e2e `gloam-downs-mouse.e2e.mjs`.

### Requirement: The mouse and the run's cards
When the mouse is freed in play, by Escape or by the browser, the pause panel SHALL open, and that Escape SHALL not also close it. Any card that opens SHALL free the mouse, so its buttons can be clicked. A button that goes back to play (Begin the run, Resume, Walk on, Go on with the run, Back to the start) SHALL take the mouse again, with its click as the gesture the browser asks for. A gamepad's press is not such a gesture, so the page SHALL not ask then.

#### Scenario: Escape pauses, Resume takes the mouse
- **WHEN** the mouse is taken in play, and the player presses Escape, clicks Resume, and then the browser takes the mouse back by itself
- **THEN** Escape frees the mouse and opens the pause panel, Resume takes the mouse again and play goes on, and the browser's release opens the pause panel again. P opens the pause panel and frees the mouse, and the Lamp-room frees it with no pause panel over it. Check: e2e `gloam-downs-mouse.e2e.mjs`.

#### Scenario: No pointer lock in a run
- **WHEN** the browser has no pointer lock, and the player moves the mouse, clicks the left button, and drags with the right button
- **THEN** the controls say "Hold the right button and drag the view to look", the move does nothing, the left click swings and does not turn the view, and the right drag turns the view by more than 0.3 rad with no swing and no roll (measured 0.53). Check: e2e `gloam-downs-mouse.e2e.mjs`.

#### Scenario: A phone has no mouse hint
- **WHEN** the run plays at 390 by 844 on a touch screen
- **THEN** the mouse hint does not show, and the pause panel shows the touch controls. Check: e2e `gloam-downs-mouse.e2e.mjs`.

### Requirement: Touch in a run
On a touch screen in a run, the page SHALL show Attack, Jump, Roll and Heal buttons at the bottom right. The stick on the left half and the look drag on the right half SHALL work as in the explorer. A tap on Attack SHALL aim at the best foe. Holding Attack SHALL go on with the string. Heal SHALL show the number of flasks left, up to 5.

#### Scenario: Thumbs
- **WHEN** the player holds the stick to the left and taps Roll, then taps Attack twice
- **THEN** the lamplighter rolls left and swings two cuts at the best foe in front of it. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Two thumbs at once
- **WHEN** one finger drags the look on the right half while another holds Attack
- **THEN** the view turns and the string goes on. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: The Map and Look tools in a run
In a run, the Map tool SHALL read "Pause", and it SHALL open the pause panel. The touch help SHALL say "Pause stops the run". The Look tool SHALL face the nearest awake foe within 10 m, or the boss within 10 m while the fight has started and the boss is up. With neither, it SHALL look ahead. A tap and a mouse click on a tool SHALL do the same thing. A press on a tool SHALL not swing the blade, and SHALL not start the stick or the look drag.

#### Scenario: Map on a phone
- **WHEN** the player taps Map in a fight on a touch screen
- **THEN** the pause panel opens, and no foe moves while it shows. Resume goes back to the fight. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Look on a phone
- **WHEN** an awake Snuffer stands 6 m behind the lamplighter and the player taps Look
- **THEN** within 0.5 s, the yaw difference to the Snuffer, seen from the lamplighter, is 10° or less. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Look with no foe near
- **WHEN** no foe is awake within 10 m and the player taps Look
- **THEN** the view turns to look ahead of the lamplighter, as in the explorer. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Tools with a mouse
- **WHEN** an awake foe stands 6 m to the side, the mouse is free, and the player clicks Look and then Map with the left button
- **THEN** within 0.5 s of Look, the yaw difference to the foe is 10° or less. Then the pause panel opens, and the lamplighter does not swing. While the mouse is taken the cursor is hidden and every click goes to the view, so the tools take clicks only while it is free; R and P do the same from the keys. Check: e2e `gloam-downs-run.input.e2e.mjs` (it frees the mouse with the `?test` hook `release()`, as a card does).

### Requirement: Gamepad in a run
In a run, a held pad button SHALL count once across all pads, and the pad SHALL do these things:
- The left stick SHALL move, and a light tilt SHALL walk.
- The right stick SHALL turn the view.
- A (button 0) SHALL jump.
- X (2) or RT (7) SHALL attack.
- B (1) or LT (6) SHALL roll.
- Y (3) SHALL heal.
- RB (5) SHALL face a foe or the boss, as R does in "Keyboard in a run".
- Start (9) or the pad's Back button (8) SHALL open and close the pause panel.

#### Scenario: Pad buttons
- **WHEN** the player tilts the left stick fully, presses B, then presses X three times
- **THEN** the lamplighter rolls in the tilt's direction, and then swings a full string. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Two pads
- **WHEN** two pads hold Start at the same time
- **THEN** the pause panel opens once and does not close again. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Gamepad in Wander
In Wander, X (2) SHALL walk, as in the explorer. RT, B, LT and Y SHALL do nothing in Wander's play.

#### Scenario: X in Wander
- **WHEN** the player holds X and the left stick in Wander
- **THEN** the lamplighter walks, and no blade swings. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Focus in cards
Every card and panel SHALL work with keys alone and with a gamepad alone. The d-pad, the left stick and Tab SHALL move the focus between the buttons of the card. The focus SHALL not leave the card, and it SHALL wrap at the ends. A tilt of the left stick past half SHALL move the focus one button, and again every 0.3 s while it is held. A on a gamepad, and Space or Enter on keys, SHALL press the focused button.

#### Scenario: Tab stays in the card
- **WHEN** the pause panel shows, and the player presses Tab once for each of its buttons
- **THEN** the focus never goes to ◀ Lab or Games, and it ends back on Resume. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: A beacon card on a gamepad
- **WHEN** the Gaol's beacon card shows with 60 glim banked, and the e2e uses only a mocked gamepad. A presses the first wick. The d-pad moves the focus to Spend glim, and A presses it. The d-pad moves the focus to Mantle's Buy, and A presses it. B goes back, and A presses Walk on.
- **THEN** the first wick is chosen, and the bank shows 20. After B, the beacon card shows with the focus on Walk on. The Crow Wall loads after Walk on. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: The focus when a card opens
When a card opens, the focus SHALL be on its main button. The main buttons SHALL be these:
- the button of the help card;
- the first wick on the beacon card, and Walk on after the choice;
- Begin the run in the Lamp-room, or Back to the beacon or Go on with the run where they show;
- Resume in the pause panel, and No when End the run asks again;
- the button of the run summary, and the Lamp-room button of the win card;
- Try again on the loading screen.

#### Scenario: First visit with a gamepad alone
- **WHEN** a visitor opens the page for the first time, and the e2e presses only A on a mocked gamepad
- **THEN** the help card closes, and the run starts in The Sunken Gaol. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: A press that closes a card
A key or a pad button that presses a card's button SHALL do nothing in play until it is released. So A, B and Space SHALL not jump or roll on the first step after a card closes.

#### Scenario: B in the pause panel
- **WHEN** the pause panel shows, and the player presses B on a gamepad and holds it for 0.5 s
- **THEN** the panel closes and play goes on, as after Resume. The lamplighter does not roll until B is let go and pressed again. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: The loading screen with a gamepad
The page SHALL read the gamepad while the loading screen shows. When the loading screen shows Try again, Try again SHALL take the focus, and A SHALL press it.

#### Scenario: Try again on a gamepad
- **WHEN** the foe files fail once, and the e2e presses A on a mocked gamepad alone
- **THEN** the page asks for the foe files again, and play starts when they load. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Back in cards
In a run, B on a gamepad and Escape SHALL go back where a card has a back action. The back actions SHALL be these:
- Resume in the pause panel;
- Back to the beacon in the Lamp-room, when the Lamp-room opened from a beacon card;
- No, when End the run or Back to the start asks again;
- Back to Wander, in the Lamp-room when it opened from Wander's Map;
- Step back, on the loading screen when the boss files did not load.

#### Scenario: Back to the beacon on a gamepad
- **WHEN** the Lamp-room shows after Spend glim on a beacon card, and the player presses B on a gamepad
- **THEN** the beacon card shows again, with the focus on Walk on. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Cards with no back action
In a run, B and Escape SHALL do nothing in other cards. In a run, Start and the pad's Back button SHALL close only the pause panel, and not while End the run asks again. Before a wick is chosen, only a wick button SHALL close the beacon card.

#### Scenario: No way past the wick
- **WHEN** the beacon card offers two wicks, and the player presses Escape, Start, the pad's Back button or B
- **THEN** the card stays, and play does not go on. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Presses outside a card
In a run, and on the run's help card, a press outside a card's box SHALL do nothing. On the pause panel, it SHALL act as Resume. On the run's help card, Escape, B and Start SHALL do nothing, and only its button SHALL close it.

#### Scenario: A tap beside a card
- **WHEN** at 390 by 844 on a touch screen, the player taps the backdrop of the Lamp-room, the run summary, the win card, and the beacon card after the wick is chosen
- **THEN** each card stays, and `__gloam.run().mode` does not change. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Escape on the run's help card
- **WHEN** the run's help card shows on a first visit, and the player presses Escape
- **THEN** the help card stays, and the run does not start. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Cards in Wander
In Wander, Escape, B and Start SHALL close the help card, the Map and the end card, as in the explorer. In Wander's play, M and Start SHALL open the Map, and M SHALL close it again.

Wander's cards SHALL follow Focus in cards. The d-pad, the left stick and Tab SHALL move the focus, and A, Space or Enter SHALL press the focused button. When Wander's Map opens, the focus SHALL be on the current place.

#### Scenario: From Wander to a run on a gamepad
- **WHEN** a mocked gamepad alone presses Start in Wander's play, moves the d-pad to the Lamp-room button and presses A. Then it presses A again.
- **THEN** the Lamp-room shows with the focus on Begin the run. The second A starts a run in The Sunken Gaol. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: The Map in Wander on a gamepad
- **WHEN** the player presses Start on a mocked gamepad in Wander's play, and then presses B
- **THEN** Start opens Wander's Map, and B closes it. The lamplighter does not roll. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: Escape in Wander
- **WHEN** Wander's help card shows, and the player presses Escape
- **THEN** the help card closes for good, as in the explorer. Check: e2e `gloam-downs.e2e.mjs` through `?wander`.

### Requirement: Combat camera
In a run, while the combat camera has a foe (see "The combat camera's foe"), the camera SHALL turn toward that foe. The turn SHALL start after 2 s with no look input. It SHALL turn at no more than 0.6 rad/s, and stop when the yaw difference to that foe is 20° or less (see "The yaw difference"). While the combat camera has a foe, this turn SHALL take the place of the explorer's swing behind a running lamplighter. It SHALL follow the explorer's "A calm camera".

#### Scenario: The camera turns to a foe
- **WHEN** an awake Snuffer stands 5 m away, 60° to the right of the view's forward direction. The player gives no look input for 2 s.
- **THEN** the view turns right, no faster than 0.6 rad/s, and stops when the yaw difference is 20° or less. It starts 2 s after the last look input, and stops at a yaw difference of 19.5° to 20° (measured: 2.02 s, 0.60 rad/s, 20.0°). Check: Node test `gloam-downs-camera.test.mjs`. The e2e `gloam-downs-camera.e2e.mjs` also checks it at 390 by 844 with a training post 5 m away, 60° to the right.

#### Scenario: No turn while the mouse is taken
- **WHEN** the mouse is taken, a training post stands 5 m ahead and 0.7 rad to the side, and the player holds W for 5 s past it
- **THEN** the post is the combat camera's foe, and the yaw does not change at all. Check: e2e `gloam-downs-mouse.e2e.mjs`, and Node test `gloam-downs-mouse.test.mjs` with the mouse taken and with a move held across the view.

#### Scenario: No foe awake
- **WHEN** the last awake foe goes out, or its zone goes to sleep
- **THEN** the camera stops turning toward foes, and it swings behind a running lamplighter as in the explorer. With no foe, the yaw moves exactly as with the explorer's swing. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: The yaw difference
The yaw difference SHALL be the angle, seen from the lamplighter, between the view's forward direction and the direction to the foe or the boss. The combat camera and the boss camera SHALL both use it.

#### Scenario: Seen from the lamplighter
- **WHEN** a foe stands 5 m from the lamplighter, 60° to the right of the view's forward direction
- **THEN** the yaw difference is 60° to the right, though the angle seen from the eye is smaller. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: The combat camera's foe
The combat camera's foe SHALL be the nearest awake foe within 10 m that is not home and not walking home, when the turn starts. A foe that sinks to go home SHALL count as walking home. The camera SHALL keep that foe until another such foe is 1.5 m nearer to the lamplighter. It SHALL choose again when its foe goes out, goes home, starts to walk home or is more than 10 m away. With no such foe, the explorer's swing SHALL apply.

#### Scenario: Two foes at about the same distance
- **WHEN** a test moves two Snuffers round the lamplighter on opposite sides. Every 0.5 s, their distances swap between 4.0 and 4.3 m. The player gives no look input for 3 s.
- **THEN** the camera's foe does not change in the 3 s, and a foe 1.5 m nearer takes over. Check: Node test `gloam-downs-camera.test.mjs`.

#### Scenario: A foe at home
- **WHEN** a Snuffer is awake but home 13 m away, or home 6 m away, or not home 11 m away, and the player gives no look input for 3 s
- **THEN** the view does not turn. At 9 m, not home, it turns. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: Moves while the camera turns
While the combat camera or the boss camera turns by itself, a held move input SHALL keep its world direction from the turn's start. This SHALL stop when the input turns by more than 20°, when it is let go, or when the player turns the view. It SHALL not stop when the turn stops.

#### Scenario: Run away from a foe
- **WHEN** a Snuffer, held still by a test, is awake 4 m behind the lamplighter. The player holds W and Shift, away from it, with no look input for 3 s.
- **THEN** the lamplighter walks 9 m, ±1 m, to 13 m from the Snuffer. The view turns toward the Snuffer while it is within 10 m, and the lamplighter's heading changes by 10° or less (measured: 8.9 m walked, 12.9 m away, a heading change of 0°, the view turned 1.22 rad). Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: Look input wins
Look input SHALL take control back from the combat camera and the boss camera on the same step. Both cameras SHALL still come closer in front of a hill or a wall, as the explorer's camera does.

#### Scenario: Look input wins
- **WHEN** the camera turns by itself, and the player presses Q, drags the look or moves the right stick
- **THEN** the turn stops on that step, and the view follows only the player's input: on the step of the look input the yaw changes by the input alone (−0.3 × 2.6 / 60). The camera turns by itself again only after 2 s with no look input, or 0.6 s in the boss fight. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: Boss camera
In the boss fight, the boss camera SHALL take the place of the combat camera. It SHALL be on while the fight has started, the boss is up, and the lamplighter is within 7.0 m of the arena's centre. So it SHALL start when the lamplighter first comes within 7.0 m after the intro, and again each time it comes back.

#### Scenario: The boss camera starts
- **WHEN** the intro has ended, and the lamplighter walks from 9 m to 6 m from the arena's centre
- **THEN** at 9 m, the combat camera has the boss as its foe. At 6 m, the boss camera is on. Check: Node test `gloam-downs-camera.test.mjs` (with a stand-in boss until stage 3).

### Requirement: Boss camera through an attack
The boss camera SHALL also be on while an attack of the boss is under way (its marker stands or its shards fly) and the lamplighter is within 16 m of the arena's centre, so a lunge or lamp-shards that the lamplighter steps out of the arena from is watched to its end.

#### Scenario: An attack watched from outside the arena
- **WHEN** the boss at the arena's centre winds up an attack at a lamplighter 7.5 m away, outside the arena
- **THEN** the boss camera is on at its least distance until the attack is over, and then eases back to the follow camera within 1 s. With an attack under way it comes on at 15.5 m from the centre, and not at 16.5 m. Check: Node test `gloam-downs-camera.test.mjs`.

#### Scenario: Every wind-up from the boss camera
- **WHEN** the boss e2e stands the lamplighter where each of the five attacks is chosen (the lunge 7.5 m from the boss, outside the arena) and holds the boss in its wind-up, at 1280 by 720 and 390 by 844, after 1.2 s to settle
- **THEN** the boss camera is on, at 11.9 m or more, the lamplighter is not faded, and each part of the marker shows fire: the sweeps' sector, the slam's disc, the lunge's lane and both halves (near the eye and beyond) of each shard ring, at a share of the part's drawn area no less than the e2e's per-kind least. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: The boss as the combat camera's foe
While the fight has started and the boss is up, outside the arena and within 16 m of its centre, the combat camera SHALL count the boss as an awake foe, at any distance from the lamplighter. Before the intro and after the fall, it SHALL not.

#### Scenario: Outside the arena
- **WHEN** the fight has started, and the lamplighter stands 12 m from the arena's centre with the boss up inside it
- **THEN** the combat camera has the boss as its foe. Before the intro, and after the fall, it does not. Check: Node test `gloam-downs-camera.test.mjs` (with a stand-in boss until stage 3).

### Requirement: Boss camera aim and distance
The boss camera SHALL aim at a point on the line from the lamplighter to the boss, 1.15 m up. Its distance SHALL be at least the layout's follow distance, at least 12 m and at most 24 m. The follow distance SHALL be the explorer's (the explorer's "Look"): 8.5 m in landscape, and 15.33 m on a phone held upright. The boss camera's own ease SHALL reach its aim and distance in 60 steps (1 s).

#### Scenario: Boss camera distance
- **WHEN**, on flat ground at 390 by 844, the lamplighter is 4 m from the arena's centre and the boss 4 m in front of it
- **THEN** within 1 s of the boss camera's start, the distance is at least 15.32 m (the follow distance 15.33 m, less 0.01), and its aim lies between the lamplighter and the boss. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: Boss camera hand-back
The lamplighter SHALL leave the arena when it is more than 7.0 m from the arena's centre, (18, 0.68, −22). When the boss falls or the lamplighter leaves the arena, the camera SHALL ease back to the follow camera over 1 s.

#### Scenario: Leave the arena
- **WHEN** the lamplighter walks more than 7.0 m from the arena's centre, with no attack of the boss under way
- **THEN** within 1 s the camera is back at the follow camera's distance and aim. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: Boss camera frame
Within its limits, the boss camera SHALL choose the aim point and the smallest distance that keep the frame clear. The follow camera's ease SHALL not apply to it. The frame SHALL be clear when each of these is inside the screen and under no touch button, the HUD or the tools:
- the lamplighter's chest, and the ground within 1.3 m of its feet;
- the boss's head, chest and feet, which SHALL also be inside the middle 80% of the width and below the Lab bar row.

#### Scenario: Boss in view
- **WHEN** the Node test puts the boss 2 to 13 m from the lamplighter on flat ground, at yaw differences of 0° and ±15°. It steps the boss camera for 3 s with no look input. It does this at 320 by 640, 390 by 844, 360 by 640, 800 by 600 and 1280 by 720. The HUD and the tools are the rects of "The HUD in the boss fight". The touch buttons are the rects in design.md.
- **THEN** the frame is clear each time, and the camera's distance is 21 m or less (measured: 12.0 m in landscape and 15.33 m on the phones). Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: Boss camera on a slope
When a hill, a stone or a wall would bring the boss camera closer than it chose, its pitch SHALL ease up by the least raise, in steps of 0.05 to a pitch of 1.1, at which it stands at its distance and sees the boss's chest and feet and the far points of the marker laid. A lane laid SHALL start the raise from a pitch of 0.6. Failing that, it SHALL take the least raise that stands at the distance and sees the most points; failing that, the raise that stands farthest back.

#### Scenario: Boss camera over the grave stones
- **WHEN** the Node test stands the lamplighter on Barrow Crown's walk map at every point of a 1.5 m grid within 6.6 m of the arena's centre, facing the boss 2.6 m and then 5 m toward the centre (122 pairs), and steps the boss camera for 2.5 s at 1280 by 720 and at 390 by 844
- **THEN** at every pair the camera stands at its least distance (12 m in landscape, 15.33 m on the phone), the boss's head and feet and the three shard rings of a lamp-shards laid at the lamplighter are on the screen with the head below the Lab bar row, the pitch moves by 0.01 or less over the next 1 s, each ring's rim (8 points at 1.3 m) is inside the middle 94% of the width, below the Lab bar row and under no control, at most 5% of the rim points are hidden from the eye by the ground, and at most 6 of the 366 rings are hidden from the eye by the ground (measured: 122 of 122 pairs at both layouts, the highest pitch 1.08, 1 and 2 rings hidden, 33 and 44 of 2928 rim points hidden; with a raise only to 0.55, 20 of 122 pairs came in to 1.85 to 5.65 m with the head off the screen, and 24 to 32 rings were hidden). Check: Node test `gloam-downs-boss.test.mjs`.

#### Scenario: The marker's far points
- **WHEN** the Node test reads the boss's camera view with each marker laid
- **THEN** the far points are the three shard rings' centres with four points on each rim at 1.3 m, the lane's far end, the sweeps' two side ends and front, and four points round the slam's ring, and the lunge's lane asks for a pitch of 0.6. Check: Node test `gloam-downs-boss.test.mjs`.

### Requirement: Scenery in front of a boss marker
While the boss's marker is laid, a piece of Barrow Crown's scenery that covers a point of the marker on the screen and stands more than 0.3 m nearer the eye than that point SHALL fade out over 0.25 s of game time, and SHALL fade back over 0.25 s when it no longer does.

#### Scenario: The yew in front of a shard ring
- **WHEN** the boss lays its lamp-shards with the boss camera south of the lamplighter and the yew at (17, −13.5) between the eye and the west ring, which the walk map's sight test hides at every pitch to 1.1
- **THEN** the yew's crown fades out over 15 steps of the game clock, to density 0, and comes back over 15 steps when the rings are gone. In the e2e picture both halves of the west ring show fire. Check: Node test `gloam-downs-boss.test.mjs` and e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: Scenery pieces that may fade
A piece SHALL be a group of the place's opaque splats within 20 m of the arena's centre that stand more than 1.2 m over the low ground round them, joined on a grid of 0.5 m, with the splats from 0.4 to 1.2 m up in its own columns. A piece more than 4 m across SHALL never fade, so the ground of a slope or a barrow stays. The foot of a piece SHALL stay.

#### Scenario: Pieces round the arena
- **WHEN** the Node test finds the pieces round Barrow Crown's arena
- **THEN** none is more than 4 m across, and the yew at (17, −13.5) is one piece. Check: Node test `gloam-downs-boss.test.mjs`.

### Requirement: Boss camera raise holds still
Whether something is in the way of the boss camera SHALL be read at the layout's pitch, and its frame SHALL be solved at the raised pitch. The raise SHALL come down only when the least raise is more than 0.1 under it, so the pitch holds still while the lamplighter and the boss stand still. Past the walk map's bounds, the boss camera SHALL read the map's edge cells, so scenery outside the map never brings it in.

#### Scenario: Boss camera raise at rest
- **WHEN** the Node test lets the boss camera settle for 2.5 s at each of the arena's 122 pairs at 1280 by 720 and 390 by 844, and steps it 1 s more
- **THEN** the pitch moves by 0.01 or less over that second at every pair. Check: Node test `gloam-downs-boss.test.mjs`.

#### Scenario: Boss camera by the grave stone
- **WHEN** the lamplighter stands at (18, −18), with the grave stone south of the arena behind it, in the browser at 1280 by 720 and 390 by 844
- **THEN** the boss camera stays 12 m or more out (15.33 m on the phone). Check: e2e `gloam-downs-run.boss.e2e.mjs`.

#### Scenario: Boss in the arena
- **WHEN** the Node test puts the lamplighter and the boss at 481 pairs of points in the arena, 3 to 9 m apart. It uses Barrow Crown's walk map. It steps the boss camera for 3 s at each of the five layouts.
- **THEN** at each layout, in at least 95% of the pairs, both chests are inside 80% of the screen's half-width and inside its height (measured: 481 of 481 at each layout). Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: Boss camera turn
After 0.6 s with no look input, the boss camera SHALL turn toward the boss at no more than 1.5 rad/s. It SHALL stop when the yaw difference to the boss is 15° or less. It SHALL not turn while the mouse is taken, or while the player holds a move more than 35° from straight ahead or back. The yaw difference SHALL be measured as in the combat camera, from the lamplighter.

#### Scenario: Turn to the boss
- **WHEN** the boss stands 8 m from the lamplighter, behind the view, and the player gives no look input for 3 s
- **THEN** the view starts to turn after 0.6 s, no faster than 1.5 rad/s, and the yaw difference is 15° or less by 3 s. Check: Node test `gloam-downs-camera.test.mjs`.

#### Scenario: The boss camera waits for the player
- **WHEN** the boss is up and the fight has started, the lamplighter stands 4 m from the arena's centre after 9 s with no look input, and the player first has the mouse taken for 3 s, then holds a move to the side for 3 s, then gives one small look with the mouse and frees it
- **THEN** the yaw does not change while the mouse is taken or while the move to the side is held, and the view starts to turn 0.6 s after the small look. Check: Node test `gloam-downs-mouse.test.mjs`.

#### Scenario: Run round the boss
- **WHEN** the lamplighter runs round a boss for 10 s at 390 by 844, 5 m from it, with no look input. A test holds the boss still.
- **THEN** the chests of the boss and the lamplighter stay inside the screen. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: Health and hits
With no Mantle level and no wick, the lamplighter SHALL have 100 health at the start of a run. A hit SHALL take its damage and push the lamplighter away from the source: 1.2 m, or 3 m for the Ironback's charge. The lamplighter SHALL have no control for 0.25 s after a hit. For 0.9 s after a hit, no damage SHALL hurt it, and the figure SHALL blink. Foes SHALL not hurt the lamplighter by touch alone. An attack SHALL test its hit on each of its active steps, until it hits once.

#### Scenario: Hit by a hook
- **WHEN** a Snuffer's hook lands on the lamplighter with 100 health in the Gaol
- **THEN** health shows 84, and the lamplighter slides back 1.2 m, ±0.15 m, and blinks. A second hook within 0.9 s does no damage. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Walk into a foe
- **WHEN** the lamplighter walks into a Snuffer that is not attacking
- **THEN** it takes no damage, and the two push apart. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Falls
A fall below y −25 SHALL not end the run. The lamplighter SHALL come back on the last firm ground it stood on, at least 1 m from a ledge. It SHALL lose 10 health, but not below 1. Then it SHALL be safe from hits for 0.9 s, and it SHALL blink, as after a hit.

#### Scenario: Fall through a hole
- **WHEN** the Node test walks the lamplighter with 50 health into a hole in a test walk map, and it falls below y −25
- **THEN** it stands again on the ground it left, at least 1 m from the edge, with 40 health. A hit at once after that does nothing. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Low health warning
Below 30% health, the health bar SHALL pulse, and a heartbeat SHALL sound every 55 steps (0.92 s). At each beat, the place's own colours SHALL pull up to 25% toward dark red. Fire, lamp and wisp colours SHALL not change, so fire stays the brightest colour.

#### Scenario: Low health
- **WHEN** health falls from 40 to 25 of 100
- **THEN** the bar pulses, and `__gloam.sounds()` logs a heartbeat every 55 steps. At each beat, `__gloam.run().fx.grade` shows slots 1 to 31 changed, and slots 32 to 47 as they are. Check: e2e `gloam-downs-run.look.e2e.mjs`.

### Requirement: Warning moves
Every foe attack SHALL start with a wind-up of at least 0.55 s, and every boss attack with a wind-up of at least 0.60 s. Each wind-up SHALL show a pose, a fire glow on the foe and a sound. Each ring or lane attack, and each of the boss's crook sweeps, SHALL also grow a marker on the ground over its wind-up. Markers SHALL be in fire slots 34 and 35. No foe hit SHALL take more than 24 health.

#### Scenario: A Snuffer winds up
- **WHEN** a Snuffer starts its hook
- **THEN** its pole swings back and its cup glows fire. `__gloam.sounds()` logs the scrape on the first step of the wind-up, and the hook lands 33 play steps later. Check: e2e `gloam-downs-run.look.e2e.mjs`.

#### Scenario: A ground marker
- **WHEN** an Ironback starts its slam
- **THEN** a fire ring grows on the ground to 3.0 m over 0.75 s, and the slam hits only inside it. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Markers on the ground
A ring marker SHALL be six slices of 60°. A lane marker SHALL be pieces of 1.5 m or less. Each slice or piece SHALL tilt to the plane that best fits the ground under its rim, and lie 0.16 m above that plane. The places' ground splats stand up to about 0.1 m over the walk map's floor, and a marker lower than that breaks into specks. Over water, the ground SHALL be the water's surface. A crook sweep SHALL show the front three slices of the boss's ring, at 4.0 m.

#### Scenario: A marker on rolling ground
- **WHEN** the Node test lays markers at points across each leash on the baked walk maps. These are the Ironback's ring and lane in B1 and W2, and the boss's rings and lane in the arena. They are also the Mirelight's ring in F1 and F2.
- **THEN** for each marker, at least 90% of its rim points are within 0.15 m of the ground (measured: 91.2% for F2's ring to 99.2% for the shard ring). Check: Node test `gloam-downs-foes-ai.test.mjs`.

### Requirement: Markers stand still
A ring or a lane SHALL stay in one place from at least 0.3 s before its hit. The Pitchrook's ring SHALL stay where it was laid at the start of the wind-up. The Ironback's lane SHALL be 1.6 m wide. The boss's lane SHALL be 1.6 m wide and 9 m long. A lane attack SHALL hit only a lamplighter whose centre is inside the lane. A ring or slice attack SHALL hit only a lamplighter whose centre is inside the ring or its slices, within 1.6 m of height (1.8 m for the pulse and the slam).

#### Scenario: Step out of the warning
- **WHEN** a lane or the three shard rings stop moving. At once, the lamplighter walks 1.5 m to the side of the lane, or 1.5 m away from the boss.
- **THEN** the Ironback's charge, the boss's lunge and the shards do no damage. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The crook sweeps
In a sweep's wind-up, the boss SHALL turn toward the lamplighter at no more than 1.5 rad/s. It SHALL hold its facing from 0.3 s before the hit. The three slices of the sweep's marker SHALL stop with it, and the sweep SHALL hit only inside them. The double sweep's second sweep SHALL grow its own three slices over its wind-up of 0.6 s, and SHALL follow the same rules.

#### Scenario: Outside the slices
- **WHEN** the boss's facing stops 0.3 s before a sweep, and the lamplighter stands 1 m outside the three slices and stays there
- **THEN** the sweep does no damage. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Hits on foes
A plain hit SHALL not stop a foe's wind-up. The finisher and the plunge SHALL stop the wind-up of a light foe. Outside its wind-up, a light foe SHALL flinch for 0.4 s when hit, no more than once every 1.5 s. Heavy foes and the boss SHALL not flinch. Light foes SHALL take the push of a hit, but not from a plain hit in their wind-up or active time. The Ironback SHALL take no push.

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
- **THEN** ember cracks show where the Snuffer will rise, and the Snuffer rises over 0.9 s. A cut during the rise does no damage. Check: e2e `gloam-downs-run.look.e2e.mjs`.

#### Scenario: A zone sleeps
- **WHEN** the lamplighter walks 20 m from the Gaol's south yard while its Snuffer is home
- **THEN** the yard's zone sleeps, and its pool slot is free. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Guard zones always wake
A guard zone SHALL wake also when it does not fit. Then other awake zones SHALL give up their slots, the zone farthest from the lamplighter first, until the guard zone fits. Only a zone whose slots help SHALL go. Its slots help when it has a foe of a type for which the pool has too few free slots for the guard zone. They also help when the cap of 6 stops the guard zone.

#### Scenario: Every guard can wake
- **WHEN** the zone test stands at each point within 10 m of a guard zone's centre, with the other zones awake that fit
- **THEN** each time, the guard zone's ember cracks show within 1 s, and its foes start to rise within 1.6 s. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Giving up slots
A zone that gives up its slots SHALL sleep, and its foes SHALL keep their health. Its foes SHALL sink into the ground while the guard zone's ember cracks show, over the same 0.6 s. Then the guard zone's foes SHALL rise.

#### Scenario: The guards of The Crow Wall
- **WHEN** the Pitchrook of the west flank (R3) is awake. The lamplighter comes within 10 m of the guard zone by the broken wall (R4).
- **THEN** the R3 Pitchrook sinks into the ground over 0.6 s, while R4's ember cracks show. Then R4's two Snuffers and its Pitchrook rise. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Foes stay out
A foe put out SHALL stay out until the run ends or a reload restarts the place. A zone that sleeps SHALL keep the health of its living foes.

#### Scenario: Come back to a cleared zone
- **WHEN** the lamplighter puts out the Snuffer of the Gaol's south yard, walks 20 m away and comes back in the same run
- **THEN** the yard stays empty, and no ember cracks show. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Foes keep their ground
A foe SHALL not walk past its zone's leash. Only an Ironback's charge and a push MAY move a foe past it. A foe SHALL not walk off a ledge. A foe SHALL chase the lamplighter while it is within the leash plus 8 m, and SHALL walk home after 4 s farther away. A foe SHALL not heal at home.

#### Scenario: Leave a fight
- **WHEN** the lamplighter runs 15 m away from a zone with a hurt Snuffer
- **THEN** after 4 s the Snuffer walks home, with the same health as before. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Ledge
- **WHEN** a Snuffer chases the lamplighter toward a pit
- **THEN** it stops before the edge. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Foes off their ground
A foe SHALL be off its ground when it is outside its leash, or more than 2 m below its zone's centre. A foe off its ground that is not home 4 s later SHALL sink over 0.6 s. It SHALL then rise at a home spot over 0.9 s, with its health. A foe knocked more than 6 m below its zone, or below y −25, SHALL be put out. Its glim SHALL drop on the last firm ground it stood on.

#### Scenario: Knocked off
- **WHEN** a plunge knocks a Snuffer off a ledge, and it falls more than 6 m below its zone
- **THEN** it goes out, and its 3 glim drop on the ledge where it last stood. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Pushed off the terrace
- **WHEN** a finisher knocks a Snuffer of The Bell Knoll's terrace guard (B4) off the terrace to the ground 2.2 m below, outside its leash
- **THEN** within 7 s it is back on its ground (inside its leash, less than 2 m under its centre), with the health it had after the hit (measured: 2.58 s). Check: Node test `gloam-downs-foes-ai.test.mjs`.

### Requirement: Fair crowds
At most two melee attacks SHALL be under way at once, and at most one thrown coal SHALL be in the air. Foes that wait for an attack token SHALL hold 3.2 to 3.8 m away and spread round the lamplighter. A foe whose chest is outside the view SHALL wait 0.4 s longer before it takes an attack token.

#### Scenario: A group
- **WHEN** three Snuffers and a Pitchrook fight the lamplighter
- **THEN** no more than two hooks wind up or land at the same time, and only one coal is in the air. Check: Node test `gloam-downs-foes-ai.test.mjs`.

#### Scenario: Wait for a token off screen
- **WHEN** a Snuffer waits for a token while its chest is outside the view, and another does the same in view
- **THEN** the foe off screen takes its token 24 steps (0.4 s) later. The foes that wait stand 3.2 to 3.8 m away. Check: Node test `gloam-downs-foes-ai.test.mjs`. The scenario of 20 bot fights at 390 by 844 and 320 by 640 (70% of wind-ups with the chest on screen) is stage 3's, with the bot.

### Requirement: Off-screen warnings
When a foe starts a wind-up outside the view, an ember notch SHALL show at the screen's edge toward the foe. The notch SHALL show for the length of the wind-up. It SHALL fill from empty to full over the wind-up, so its fill shows the time left. A foe SHALL be outside the view when its chest point projects outside the screen. The chest point is the foe's feet plus its chest height: Snuffer 0.9 m, Pitchrook 1.1 m, Mirelight 1.3 m and Ironback 1.0 m. No more than 3 notches SHALL show at once.

#### Scenario: A foe beside the lamplighter
- **WHEN** a test at 390 by 844 spawns a Snuffer 6.0 m to the right of the lamplighter. It holds the Snuffer at 0.1 s of its hook. A phone held upright sees ±4.6 m to each side of the lamplighter, so a foe 3 m to the side is in view.
- **THEN** the Snuffer is outside the view, and a notch shows at the right edge of the screen. The notch overlaps no control. Check: e2e `gloam-downs-run.fight.e2e.mjs`.

#### Scenario: The notch fills
- **WHEN** a test at 390 by 844 holds a Snuffer beside the lamplighter at 0.1 s of its hook, and then at 0.5 s
- **THEN** the notch is 18% full, ±10%, and then 91% full, ±10%. The hook's wind-up is 0.55 s. Check: e2e `gloam-downs-run.fight.e2e.mjs`.

### Requirement: Where a notch points
A notch SHALL sit where the line from the screen's middle toward the foe meets the edge. So a foe to the side SHALL give a notch at the left or right edge, and a foe behind the camera's eye a notch at the bottom edge. A foe above the view SHALL give a notch at the top edge, 8 px or more below the Lab bar row, and clear of the HUD and the tools.

#### Scenario: A foe above the view
- **WHEN** at 1280 by 720 a Pitchrook stands 6 m up and 5 m ahead, held at 0.1 s of its lob. The top ray is 5.7° above level there, so the Pitchrook is above the view. (On a phone the top ray is 12.6° to 14.3° above level, and it is in view.)
- **THEN** a notch shows at the top edge, 8 px or more under the Lab bar row, and it overlaps no control. Check: e2e `gloam-downs-run.look.e2e.mjs` (stage 3).

### Requirement: Where notches sit
A notch SHALL not overlap ◀ Lab, Games, a touch button, the HUD, the tools, the toast or the boss bar. On a touch screen, a notch at the bottom edge SHALL sit 8 px or more above the top of the touch buttons. At 390 by 844, its lowest point SHALL be at y 656 or less.

#### Scenario: A foe behind the camera
- **WHEN** a test on a touch screen at 390 by 844 spawns a Snuffer 2 m behind the camera's eye, 1 m to the right. It holds the Snuffer at 0.1 s of its hook.
- **THEN** a notch shows at the bottom edge of the screen, with its lowest point at y 656 or less. It overlaps no touch button. Check: e2e `gloam-downs-run.look.e2e.mjs`.

### Requirement: Beacons in a run
In each place before Barrow Crown, one guard zone SHALL keep the beacon dark until all its foes are put out. Other zones MAY be passed. When one of those four beacons lights, it SHALL bank the glim carried and fill every flask. Every glim mote that has dropped in the place and has not been taken SHALL count as carried before the bank, so a lit beacon never loses glim. It SHALL then save the run at the start of the next place, and show the beacon card.

#### Scenario: Guards still stand
- **WHEN** the lamplighter touches the Gaol's beacon while the keep's Snuffers stand
- **THEN** the beacon stays dark. A toast says "The beacon will not catch while its keepers stand in the keep." Check: e2e `gloam-downs-run.fight.e2e.mjs`.

#### Scenario: Run past a zone
- **WHEN** the lamplighter runs past the first two zones of The Crow Wall. It puts out the guards by the broken wall and touches the beacon.
- **THEN** the beacon lights, the glim carried is banked, and the flasks are full. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Where the keepers stand
While a guard zone has foes, a touch on its beacon SHALL show a toast that names where the keepers stand. Each name SHALL be a landmark that the player can see. The names SHALL be these:
- the keep, in the Gaol;
- by the broken wall below the tower, on The Crow Wall;
- the mill, in the Fen;
- the terrace, at The Bell Knoll.

No toast SHALL use a compass word: north, south, east or west.

#### Scenario: Keepers out of sight
- **WHEN** the lamplighter touches the beacon of The Crow Wall, 14 m from the guard zone, before that zone has woken
- **THEN** the beacon stays dark. The toast says that its keepers stand by the broken wall below the tower. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: A notch toward the keepers
While its keepers stand, a touch on a dark beacon SHALL show an ember notch for 3 s at the screen's edge. The notch SHALL point along the bearing from the lamplighter to the guard zone's centre. At Barrow Crown, it SHALL point to the arena's centre.

#### Scenario: The way to the keepers
- **WHEN** the lamplighter touches the dark beacon of The Crow Wall
- **THEN** a notch shows for 3 s. Its bearing is within 20° of the bearing to the centre of the guard zone by the broken wall (R4). No toast text in the run's data holds a compass word. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

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

### Requirement: Texts that explain the run
The cards SHALL say what each choice does and what the run asks for:
- Each wick button on the beacon card SHALL show the wick's name and its effect, for example "Keen edge · +15% blade damage".
- Each upgrade in the Lamp-room SHALL show what its next level gives, for example "Mantle 1 · +15 health · 40 glim".
- The help card SHALL say "Put out each beacon's keepers, then light it. A lit beacon banks the glim you carry."
- When the boss falls, a toast SHALL say "Carry the light to the beacon".

#### Scenario: Texts at 320 by 640
- **WHEN** the help card, a beacon card and the Lamp-room show at 320 by 640, and then the boss falls
- **THEN** each text above shows in full, inside its card or its toast. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: A reload at the beacon card
The page SHALL store the two wicks offered with the run. A reload before the choice SHALL show the beacon card again with the same two wicks, over the start of the next place. A reload after the choice SHALL go on at the start of the next place.

#### Scenario: Reload at the beacon card
- **WHEN** the player reloads the page while the Gaol's beacon card offers two wicks
- **THEN** the beacon card shows again over the start of The Crow Wall, with the same two wicks. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Glim
Foes and wisps SHALL drop glim: motes in the lamp colours that fly to the lamplighter from within 6 m after 0.4 s. A Snuffer SHALL drop 3, a Pitchrook 4, a Mirelight 2, an Ironback 8, a wisp 4 and the boss 30. In a run, a wisp SHALL go out when the lamplighter touches it, and SHALL count for that run only. The HUD SHALL show the glim carried.

#### Scenario: Pick up glim
- **WHEN** the lamplighter puts out a Snuffer and stands 3 m away
- **THEN** three motes fly to it, and the glim carried goes up by 3. Check: Node test `gloam-downs-foes-ai.test.mjs`, and e2e `gloam-downs-run.fight.e2e.mjs`.

#### Scenario: Take a wisp
- **WHEN** the lamplighter touches its fifth wisp of The Sunken Gaol in a run, with 1 of 2 flasks
- **THEN** the wisp goes out, the glim carried goes up by 4, and the flasks show 2 of 2. The explorer's save does not change. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Death and the run summary
At 0 health the run SHALL end, and the page SHALL store the ended run at once. The picture SHALL fade to ink over 1.2 s. Then the run summary SHALL show the place reached, the time, the foes put out, the glim lost and the glim banked. The glim carried SHALL be lost, except as "Ash pocket at death" says. The summary's button SHALL read "To the Lamp-room". It SHALL clear the ended run and open the Lamp-room over The Sunken Gaol. The next run SHALL start in The Sunken Gaol with every foe back.

#### Scenario: Die on The Crow Wall
- **WHEN** the lamplighter dies in The Crow Wall carrying 20 glim, with 44 banked from the Gaol
- **THEN** the summary shows "II · The Crow Wall", 20 glim lost and 44 banked. The next run starts in the Gaol. Check: Node test `gloam-downs-run.test.mjs` (the summary) and e2e `gloam-downs-run.cards.e2e.mjs` (the loop).

#### Scenario: Reload in the fade
- **WHEN** the player reloads the page 0.5 s into the fade to ink
- **THEN** the run summary shows with the same figures, and the ended run does not go on. Check: e2e `gloam-downs-run.cards.e2e.mjs`.

### Requirement: Ash pocket at death
With Ash pocket, a death SHALL bank 30% of the glim carried, rounded down. The summary SHALL show the rest as lost, and its glim banked SHALL include that 30%.

#### Scenario: Ash pocket keeps 30%
- **WHEN** the lamplighter dies in the Gaol with Ash pocket and 20 glim carried, and no glim banked before in this run
- **THEN** the summary shows 6 glim banked and 14 lost, and the bank goes up by 6. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The Lamp-room
The Lamp-room SHALL show the glim banked and five lasting upgrades. Each upgrade SHALL show its level and the cost of the next level. A Buy button SHALL spend the cost and raise the level. A Buy button SHALL be off when the bank holds less than the cost, and SHALL say how much more is needed. A Buy button that is off SHALL stay focusable (`aria-disabled="true"`), so the focus stays on it after a buy. Begin the run SHALL start a new run. Wander SHALL show once it is open.

#### Scenario: Buy an upgrade
- **WHEN** the bank holds 50 glim and the player buys Mantle
- **THEN** the bank shows 10 and Mantle shows level 1. The next run starts with 115 health. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

#### Scenario: Not enough glim
- **WHEN** the bank holds 30 glim
- **THEN** the Flask upgrade's Buy button is off, and it says that 30 more glim is needed. Check: Node test `gloam-downs-run.test.mjs` and e2e `gloam-downs-run.cards.e2e.mjs`.

### Requirement: Back to Wander in the Lamp-room
When the Lamp-room opens from Wander's Map, it SHALL show Back to Wander beside Begin the run or Go on with the run, in place of Wander.

#### Scenario: Back to Wander
- **WHEN** the Lamp-room opens from Wander's Map
- **THEN** it shows Back to Wander, and no Wander button. Check: Node test `gloam-downs-run.test.mjs` (the Lamp-room's buttons; stage 3 builds Wander's Map).

### Requirement: The upgrade rows
Each upgrade row SHALL read "<name> <next level> · <what it gives> · <cost> glim", as "Mantle 1 · +15 health · 40 glim". An upgrade of one level SHALL have no level number. Each row SHALL show its level as filled pips.

| Upgrade | What the next level gives |
|---|---|
| Mantle | +15 health |
| Flask | +1 flask |
| Edge | +12% blade damage |
| Draught | heal 45%, then heal 55% |
| Ash pocket | keep 30% of glim |

#### Scenario: The rows of a new bank
- **WHEN** the Lamp-room shows with no upgrade bought
- **THEN** the rows read "Mantle 1 · +15 health · 40 glim", "Flask 1 · +1 flask · 60 glim", "Edge 1 · +12% blade damage · 50 glim", "Draught 1 · heal 45% · 45 glim" and "Ash pocket · keep 30% of glim · 120 glim". Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: An upgrade at its top level
At its top level, a row SHALL read "<name> <level> · all bought" ("Ash pocket · all bought"), with no Buy button. A Buy button with too little glim SHALL read "<n> more glim". When a buy takes its row to the top level, the focus SHALL go to the next Buy button, or to the main button.

#### Scenario: All bought
- **WHEN** Mantle is at level 3
- **THEN** its row reads "Mantle 3 · all bought" and shows no Buy button. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: A run in progress in the Lamp-room
While a run is in progress, the Lamp-room SHALL show Go on with the run in place of Begin the run. Go on with the run SHALL go on as a reload does, at the start of the run's place.

#### Scenario: Wander with a run in progress
- **WHEN** a run is in progress in The Bell Knoll with three wicks. The player opens `?wander`, and then the Lamp-room from Wander's Map.
- **THEN** the Lamp-room shows Go on with the run, and no Begin the run. Go on with the run starts The Bell Knoll, and the run keeps its three wicks. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: The Lamp-room from a beacon card
When the Lamp-room opens from a beacon card, it SHALL show Back to the beacon in place of Begin the run and Wander. Back to the beacon SHALL return to the beacon card. An upgrade bought there SHALL work at once, for the rest of the run and the runs after it.

#### Scenario: Back to the beacon
- **WHEN** the player chooses a wick, presses Spend glim and then Back to the beacon
- **THEN** the beacon card shows Spend glim and Walk on again. The Lamp-room did not show Begin the run or Wander. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

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
| Draught | 10 more percentage points of the maximum health for each flask: 35%, then 45% and 55% | 45, 110 |
| Ash pocket | keep 30% of the glim carried at death | 120 |

#### Scenario: All upgrades
- **WHEN** a player has bought every level
- **THEN** a run starts with 145 health and 4 flasks. Each flask heals 55%, the blade deals 36% more, and a death keeps 30% of the glim carried. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The wicks
The beacon card SHALL offer the six wicks in this table. Each wick SHALL last until the run ends.

| Wick | Effect |
|---|---|
| Long wick | +20 maximum health, and heal 20 at once |
| Keen edge | +15% blade damage |
| Quick heels | the roll's cooldown is 0.12 s, not 0.25 s |
| Heavy fall | plunge damage ×1.5, and its reach is 2.0 m, not 1.6 m |
| Spare oil | one more flask, full |
| Close shave | the next hit after a near miss deals +50% |

#### Scenario: Long wick
- **WHEN** the lamplighter has 60 of 100 health and the player chooses Long wick
- **THEN** the HUD shows "80/120". Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Quick heels
- **WHEN** the run has Quick heels, and the player holds Roll
- **THEN** a second roll starts 0.12 s after the first ends, ±1 step. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Heavy fall
- **WHEN** the run has Heavy fall, and a plunge lands with a Snuffer's edge 1.9 m from the landing point
- **THEN** the plunge hits the Snuffer. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: A near miss
An attack SHALL pass in a roll's safe time when its hit test meets the lamplighter on a safe step. With Close shave, the next hit within 1 s after that SHALL deal +50%.

#### Scenario: Close shave
- **WHEN** the run has Close shave and no other bonus. A Snuffer's hook passes in the roll's safe time. The next cut lands 0.5 s later on a Snuffer held still by a test.
- **THEN** that cut deals 15, which is 10 × 1.5. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The wick buttons
Each wick button SHALL show the wick's name, a dot and the text in this table.

| Wick | Text |
|---|---|
| Long wick | +20 health |
| Keen edge | +15% blade damage |
| Quick heels | roll again after 0.12 s |
| Heavy fall | plunge ×1.5 and wider |
| Spare oil | +1 flask |
| Close shave | +50% after a near miss |

#### Scenario: Two wick buttons
- **WHEN** the Gaol's beacon card offers Keen edge and Quick heels
- **THEN** the buttons read "Keen edge · +15% blade damage" and "Quick heels · roll again after 0.12 s". Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: How upgrades and wicks add up
The damage bonuses of Edge, Keen edge and Close shave SHALL add. Edge and Keen edge SHALL raise the plunge too. After the bonuses, a foe's own factor SHALL multiply: ×1.5 on a stunned Ironback, and on the boss after its slam. Heavy fall SHALL multiply the plunge by 1.5. Damage SHALL round to the nearest whole number once, at the end. A heal SHALL round the same way.

#### Scenario: Bonuses add
- **WHEN** Edge is at level 3 and the run has Keen edge
- **THEN** the blade deals 51% more: the first cut deals 15 and the finisher 33. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Every factor on a plunge
- **WHEN** Edge is at level 3, and the run has Keen edge and Heavy fall. A plunge of 2 m lands on a stunned Ironback.
- **THEN** the plunge deals 65: 19 × 1.51 × 1.5 × 1.5 is 64.55, which rounds to 65. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Upgrades bought in a run
A Mantle level bought in a run SHALL raise the maximum health and the health by 15. A Flask level bought in a run SHALL add one full flask.

#### Scenario: Mantle at a beacon
- **WHEN** the lamplighter has 60 of 100 health and the player buys Mantle from a beacon card's Spend glim
- **THEN** the HUD shows "75/115". Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The boss arrives
At the east foot of Barrow Crown, the boss SHALL wait in an arena of 6.5 m. The first time in a visit that the lamplighter comes within 11 m of the arena's centre, the game SHALL stop for 2.4 s. Black bars SHALL show, and a card SHALL name the Barrow Reeve. Then the boss bar SHALL show and the fight SHALL start. Twelve grave candles SHALL light round the arena.

#### Scenario: Intro
- **WHEN** the lamplighter walks to within 11 m of the arena for the first time
- **THEN** bars ease in, and the card reads "V · The last light of the downs" and "The Barrow Reeve". The boss bar shows, and the candles light. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

#### Scenario: Touch the dark beacon first
- **WHEN** the lamplighter touches the beacon of Barrow Crown before the boss falls
- **THEN** the beacon stays dark. A toast says that the Barrow Reeve holds its light on the open ground below the standing stones. A notch points to the arena's centre. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Other zones at the intro
At the intro, every other awake zone SHALL sleep, and its foes SHALL sink over 0.6 s.

#### Scenario: A zone awake at the intro
- **WHEN** the zone before the gate (W4) is awake, and the lamplighter comes within 11 m of the arena's centre
- **THEN** W4's foes sink over 0.6 s, and only the boss is awake in the fight. Check: Node test `gloam-downs-run.test.mjs`.

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

#### Scenario: Every boss attack can be dodged
- **WHEN** the boss bot fights the Barrow Reeve on Barrow Crown's walk map with the game's own moves, runner and boss mind, reads each wind-up a fixed 0.25 to 0.55 s after it starts, and makes no other mistake (`REACT=0.25` to `0.55` with `SKILLS=1`), in 40 fights or more at each reaction time
- **THEN** no attack hits it, and each of the five attacks comes in those fights (measured: 0 hits in 60 fights at 0.25, 0.4, 0.5 and 0.55 s; the double sweep's second wind-up of 0.6 s is the shortest read, and a read of 0.6 s or more takes it). Check: `node qa/lab/gloam-downs-boss.sim.mjs`.

### Requirement: The lamp-shards
The lamp-shards SHALL fall into three rings of 1.3 m: one at the lamplighter and one 2.5 m to each side. Each ring SHALL grow on the ground over the 0.9 s wind-up. A shard SHALL hit for 14, and only inside its ring.

#### Scenario: Lamp-shards
- **WHEN** the boss starts the lamp-shards
- **THEN** three fire rings of 1.3 m grow over 0.9 s, and a shard hits only inside its ring. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: The win
When the boss falls, the caged light SHALL rise and follow the lantern. The boss's 30 glim SHALL go to the glim carried as it falls. After the fall, no zone of Barrow Crown SHALL wake. When the lamplighter carries the light to the beacon of Barrow Crown, the beacon SHALL light, and it SHALL bank the glim carried. The run clock SHALL stop.

#### Scenario: Carry the light
- **WHEN** the boss falls, and the lamplighter walks up to the beacon with the light, carrying 58 glim with 100 banked
- **THEN** the beacon burns, the bank goes up to 158, and the win card shows 1.8 s later. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: The bars at the win
At the fall, the bars SHALL come in over the 9 steps of hit stop. Then they SHALL ease out over 30 steps. They SHALL come in again over 30 steps when the last beacon lights.

#### Scenario: No bars while the light is carried
- **WHEN** the boss falls, and the lamplighter carries the light to the beacon
- **THEN** from 0.7 s after the fall until the beacon lights, `__gloam.run().fx.bars` is 0. In the 0.5 s after the beacon lights, it rises to 0.12. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: The win card
At the boss's fall, the place's colours, slots 1 to 31, SHALL pull toward fire slot 37 (fff4cc) by up to 50% for 6 steps, fading. Slots 32 to 47 SHALL not change, so fire stays the brightest colour. With reduced motion there SHALL be no such pull.

The win card SHALL show the time, the best winning time, the glim banked in this run, the runs and the deaths. The win card SHALL open the Lamp-room or Wander. The first win SHALL open Wander.

#### Scenario: First win opens Wander
- **WHEN** a player wins for the first time and opens the Lamp-room
- **THEN** the Lamp-room shows Wander. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: The win is stored
The page SHALL store the run at once when the boss falls. A reload after the fall SHALL start the lamplighter at the arena with the light at its lantern. The boss SHALL stay down, and the glim carried SHALL be its entry value plus the boss's 30. When the last beacon lights, the page SHALL store the bank, wins plus 1 and the best winning time at once. It SHALL set `run` to null and put the win's figures in `ended`. A reload before the win card closes SHALL show the win card again.

#### Scenario: Reload after the fall
- **WHEN** the boss falls, and the player reloads before the lamplighter reaches the beacon
- **THEN** the run goes on at the arena with the light at the lantern. The boss is down, no zone wakes, and the glim carried is the entry value plus 30. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: The place behind a reloaded win card
After a reload, the win card SHALL show over the place that was won, with its beacon burning.

#### Scenario: Reload on the win card
- **WHEN** the last beacon lights, and the player reloads 1.0 s later, before the win card shows
- **THEN** the win card shows with the same figures over Barrow Crown with its beacon lit, and the wins count went up by one only. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: No boss files after the fall
While `bossDown` is true, the page SHALL not wait for the boss files: it SHALL not fetch them, and the 11 m pause and Step back SHALL not apply.

#### Scenario: Reload after the fall with no boss files
- **WHEN** the boss falls, the boss files then fail on every request, and the player reloads
- **THEN** play goes on at the arena with no loading screen, the light rides at the lantern, the beacon lights with it, and the win card shows. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: The light after the fall
The light at the lantern after the boss's fall SHALL be drawn from the carried light in `foes.bin.gz`: 63 emissive splats on one bone, in wisp slots 38 and 39. Barrow Crown's pool SHALL hold a slot for it, so the light needs no boss file.

#### Scenario: The carried light in the foe files
- **WHEN** the Node test reads `foes.json.gz` and Barrow Crown's pool
- **THEN** the carried light has 63 splats on its one bone, in wisp slots 38 and 39, and the pool holds its slot. Check: Node test `gloam-downs-foes.test.mjs`.

### Requirement: Pause
The pause panel SHALL stop the game. It SHALL show the five places of the run with the current one marked, the run time, Resume, a sound switch (Sound on or Sound off), Back to the start and End the run, in that focus order. End the run SHALL ask again, and then end the run as a death does. M, P, Escape and Resume SHALL close the panel, and so SHALL Start, the pad's Back button and B.

#### Scenario: Pause and resume
- **WHEN** the player presses P in a fight and then Escape
- **THEN** no foe moves while the panel shows. After Escape, the fight goes on from where it stopped. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: The second question
While End the run or Back to the start asks again, Escape and B SHALL choose No and keep the panel. M, P, Start and the pad's Back button SHALL do nothing until the player answers.

#### Scenario: Keys on the second question
- **WHEN** End the run asks again, and the player presses Start and then Escape
- **THEN** after Start, the question still shows. After Escape, the question closes, the pause panel stays with the focus on Resume, and the run is not ended. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Back to the start
Back to the start in the pause panel SHALL ask again ("Back to the start of <place>? The glim you found here is lost."). Then it SHALL restart the place as a reload does: health and flasks the lower of the entry values and the current values, and the glim carried and the foes put out back to their entry values. So a player stuck in a place has a way out that keeps the run.

#### Scenario: Back to the start
- **WHEN** the lamplighter has 90 health in The Crow Wall, entered with 40, and carries 20 glim. The player chooses Back to the start, and then Yes.
- **THEN** The Crow Wall starts again with 40 health and 0 glim carried. Check: e2e `gloam-downs-run.cards.e2e.mjs`.

### Requirement: Saved run
The run SHALL save under its own key, `gloam-downs.run.v1`. The save SHALL hold the bank, the upgrade levels, runs, wins, deaths, the furthest place, the best winning time and the sound setting. The page SHALL check each saved field. A run SHALL not change the explorer's save. When the page cannot use `localStorage`, the run SHALL keep its save in the page only, and no store SHALL throw.

#### Scenario: Bad run save
- **WHEN** the run save holds wrong types, unknown upgrades or levels out of range
- **THEN** the page drops the bad fields and starts as normal. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: An old page
- **WHEN** a cached explorer page loads and stores its own save while a run save exists
- **THEN** the bank and the upgrades stay as they were. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Site data blocked
- **WHEN** the browser blocks site data, and the player begins a run and takes a hit
- **THEN** the run plays on with the hit's damage taken, and the page shows no error. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: The run in the save
The save SHALL also hold the run in progress: its place, time, health and flasks. It SHALL hold the glim carried, the glim banked in this run and the foes put out. It SHALL hold the wicks, any wick offer not yet chosen, whether the boss is down, and the entry values. It SHALL hold the summary of an ended run, or of a win, until its card closes.

#### Scenario: A run in the save
- **WHEN** a run in Lantern Fen has banked 30 glim and put out 7 foes, and the page stores it
- **THEN** a load of the save gives back the place, 30 glim banked, 7 foes and the entry values. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: When the run is stored
The page SHALL store the run at once on each hit taken, each drink, each wick chosen and each buy. It SHALL also store it at once on each lit beacon, the boss's fall and at 0 health. It SHALL also store it at least every 2 s of play.

#### Scenario: Reload just after a hit
- **WHEN** a hook takes the lamplighter from 60 to 44 health, and the player reloads on the next frame
- **THEN** the run goes on with 44 health. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: A reload in a run
A reload SHALL restart the current place. Health and flasks SHALL be the lower of the entry values and the stored values. The glim carried and the count of foes put out SHALL go back to their entry values. Every foe and wisp of the place SHALL be back. A reload SHALL not change the wicks.

#### Scenario: Reload in a place
- **WHEN** the lamplighter enters Lantern Fen with 80 health and 12 glim, and then drops to 50 health and gains 10 glim. The player reloads.
- **THEN** the run goes on at the start of Lantern Fen with 50 health and 12 glim carried. Every foe and wisp of Lantern Fen is back. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Choices raise the entry values
Choosing a wick or buying an upgrade in a run SHALL raise the entry values by the same amounts as the run's own values. These are the health, the flasks and their maximums. So a reload SHALL keep what the choice gave.

#### Scenario: Reload after a wick
- **WHEN** the player chooses Spare oil at the Gaol's beacon, presses Walk on and reloads
- **THEN** the run goes on at the start of The Crow Wall with 3 of 3 flasks, and Spare oil stays chosen. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Reload after a buy at a beacon
- **WHEN** the lamplighter has 60 of 100 health, the player buys Mantle through the beacon card's Spend glim, presses Walk on and reloads
- **THEN** the run goes on with 75 of 115 health. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Wander
Wander SHALL be the explorer as it was before the run, with no foes, no health and no glim. It SHALL have Map travel, the end card, Walk again and the explorer's save. Wander SHALL open from the Lamp-room after the first win, or when the explorer's save shows a finished walk. `?wander` SHALL open it. A reload in Wander SHALL open Wander again, until the player begins a run or goes on with one. Wander's Map SHALL have a way back to the Lamp-room.

#### Scenario: A walker from before
- **WHEN** a visitor whose explorer save has one finished walk opens the page for the first time since the run came. The visitor closes the help card.
- **THEN** the Lamp-room shows with Wander. Wander opens with the places that the visitor reached before. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: The HUD in a run
The HUD SHALL show the place, a health bar with its number, a pip for each flask, and the wisps and glim carried. At 520 px wide or less, the health line SHALL be one row. It SHALL have a 12 px number, a bar of 56 × 8 px and pips of 6 px. The toast SHALL show 8 px under the HUD's measured bottom. In a boss fight, a boss bar SHALL show in the Lab bar row, between ◀ Lab and Games. It SHALL be at most 360 px wide on a touch screen, and at most 520 px with a fine pointer.

#### Scenario: Health line
- **WHEN** the lamplighter has 74 of 100 health and 1 of 2 flasks
- **THEN** the HUD shows "74/100" beside a bar filled 74%, with one full pip and one empty pip. Check: Node test `gloam-downs-run.test.mjs` and e2e `gloam-downs-run.cards.e2e.mjs`.

#### Scenario: Toast in each layout
- **WHEN** the longest toast in the run's data (86 characters: "The beacon will not catch while its keepers stand by the broken wall below the tower."), and a toast of 96 characters, show at 320 by 640, 390 by 844, 360 by 640, 800 by 600 and 1280 by 720
- **THEN** in each layout it is inside the screen, and it does not overlap the HUD, the Lab bar, the tools or a touch button. Check: e2e `gloam-downs-run.cards.e2e.mjs` (the layout part).

### Requirement: The HUD in the boss fight
In the boss fight, the hint line SHALL hide. The HUD and the tools SHALL then fit inside these rects, given as x,y and w × h in px. The boss camera's frame test SHALL use the same rects.

| Layout | HUD | Tools |
|---|---|---|
| 320×640 | 10,60 180×88 | 198,60 112×44 |
| 360×640 | 10,60 220×88 | 238,60 112×44 |
| 390×844 | 10,60 250×88 | 268,60 112×44 |
| 800×600 | 10,60 262×91 | 656,60 134×44 |
| 1280×720 | 10,60 262×91 | 1136,60 134×44 |

#### Scenario: The widest HUD in the boss fight
- **WHEN** the boss fight shows the widest HUD of "The overlap check" at each of the five layouts
- **THEN** the HUD and the tools each lie inside their rects in the table. Check: e2e `gloam-downs-run.layout.e2e.mjs`.

### Requirement: Phone layouts
At 320 by 640 and 390 by 844 on a touch screen, every run control SHALL be inside the screen. It SHALL be at least 44 px on its shorter side. Each control SHALL be clear of the Lab bar, the HUD, the tools, the toast and the other controls. The stick SHALL have the left half of the screen below the HUD. The page SHALL not scroll sideways.

#### Scenario: 390 by 844
- **WHEN** the run plays at 390 by 844 on a touch screen
- **THEN** Attack is 84 px, Jump 72 px, Roll 64 px and Heal 52 px, at the bottom right. The overlap check finds nothing. Check: e2e `gloam-downs-run.layout.e2e.mjs`.

#### Scenario: 320 by 640
- **WHEN** the run plays at 320 by 640 on a touch screen
- **THEN** Attack is 76 px, Jump 64 px, Roll 60 px and Heal 48 px. The boss bar fits between ◀ Lab and Games, and the overlap check finds nothing. Check: e2e `gloam-downs-run.layout.e2e.mjs`.

### Requirement: The overlap check
The overlap check SHALL run with the widest HUD and the most on screen. That is 165/165 health, 5 of 5 flasks, 5/5 wisps and 254 glim, with a boss bar and a toast of 96 characters. Mantle at level 3 and Long wick give 165 health. Flask at level 2 and Spare oil give 5 flasks.

#### Scenario: The widest HUD at 320 by 640
- **WHEN** the run shows all of that at 320 by 640 on a touch screen
- **THEN** the HUD, the toast, the boss bar, the tools and the touch buttons overlap nothing, and every one is inside the screen. Check: e2e `gloam-downs-run.layout.e2e.mjs`.

### Requirement: Short windows and desktop
In windows 660 px tall or less, the touch buttons SHALL use their small sizes. At 360 by 640 and 800 by 600, every control SHALL be inside the screen, at least 44 px, and clear of the others. At 1280 by 720 with a fine pointer, no touch button SHALL show. There, the boss bar SHALL be 520 px wide, in the Lab bar row.

#### Scenario: 360 by 640 and 800 by 600
- **WHEN** the run plays at 360 by 640 or at 800 by 600 on a touch screen
- **THEN** the buttons use the small sizes, and every control is at least 44 px and inside the screen. The overlap check finds nothing. Check: e2e `gloam-downs-run.layout.e2e.mjs`.

#### Scenario: 1280 by 720
- **WHEN** the run plays at 1280 by 720 with a mouse
- **THEN** no touch button shows, and the HUD and tools are where the explorer has them. The boss bar is 520 by 44 px, in the Lab bar row between ◀ Lab and Games. Check: e2e `gloam-downs-run.layout.e2e.mjs`.

### Requirement: Cards fit the screen
Each card SHALL fit each of the five layouts. The cards SHALL be the help card, the Lamp-room, the beacon card, the pause panel and the run summary. They SHALL also be the win card, the loading screen, Wander's Map and Wander's end card. Each card's main button SHALL be inside the screen without a scroll of the page. Every button SHALL be at least 44 px. No card button SHALL be under ◀ Lab, Games or the boss bar. The boss bar SHALL hide while a card shows.

#### Scenario: Lamp-room in a short window
- **WHEN** the Lamp-room shows at 360 by 640
- **THEN** Begin the run is inside the screen with no scroll, and every Buy button is at least 44 px. Check: e2e `gloam-downs-run.layout.e2e.mjs`.

#### Scenario: Wander in short windows
- **WHEN** Wander's Map and then Wander's end card show at 360 by 640 and at 800 by 600
- **THEN** the Lamp-room button, every place button and Walk again are inside the screen with no scroll. Each one is at least 44 px. Check: e2e `gloam-downs-run.layout.e2e.mjs`.

#### Scenario: Clear of the Lab bar
- **WHEN** each card shows at each of the five layouts, and the pause panel also shows in the boss fight
- **THEN** no card button lies under ◀ Lab or Games. While the pause panel shows in the boss fight, the boss bar is hidden. Check: e2e `gloam-downs-run.layout.e2e.mjs`.

### Requirement: Hit feel
The game SHALL stop for a short hit stop on each hit, while the picture goes on. Hit stop SHALL be 3 steps (0.05 s) for a cut. It SHALL be 5 steps (0.083 s) for the finisher, the plunge and a hurt lamplighter. It SHALL be 6 steps (0.10 s) for the boss slam, and 9 steps (0.15 s) for a boss phase change and for death. Hit stop SHALL not exceed 9 steps in any 30 steps. A hit foe SHALL flash for 3 steps and shake in the picture only. The camera SHALL kick on heavy hits.

#### Scenario: A cut lands
- **WHEN** a test ticks one step at a time, and draws after each step, while the first cut hits a Snuffer
- **THEN** `__gloam.run().stop` shows the game held for 3 steps. The Snuffer is fire-bright on the 3 steps from the hit and not on the 4th, as its `flash` in `__gloam.foes()` shows. The shape that hits test against does not move. Check: e2e `gloam-downs-run.look.e2e.mjs`.

#### Scenario: Effects off
- **WHEN** the e2e turns off every feel effect with `__gloam.fx`, and plays 30 s of the Gaol
- **THEN** the run plays, and the lamplighter puts out a Snuffer. Check: e2e `gloam-downs-run.look.e2e.mjs`.

### Requirement: Effects on game time
Every effect SHALL be timed in whole steps of the game clock, and these steps SHALL go on during hit stop. So a flash, a blink, a tint or a zoom SHALL last the same at every frame rate and in `?test`. The hurt blink SHALL hide and show the figure every 4 steps (0.067 s). The zoom on a heavy hit SHALL last 7 steps (0.117 s). The hurt tint SHALL show red on palette slots 1 to 31 for 3 steps, and slots 32 to 47 SHALL stay as they are.

#### Scenario: Flash at two frame rates
- **WHEN** the Node test lands the same cut on a Snuffer, and takes the same hook, at 30 and at 144 frames a second
- **THEN** the hit flash and the hurt tint each last 3 steps (0.05 s) at both rates. Check: Node test `gloam-downs-foes-ai.test.mjs`.

### Requirement: Cards and toasts on game time
In a run, toasts, the arrival card, the fade to ink at death, the wait of 90 steps before the beacon card, the wait of 72 steps before the run summary and the wait before the win card SHALL count steps of the game clock. So SHALL the keeper notch, the off-screen notches and the intro stop. They SHALL wait while a card or the pause panel shows, so `__gloam.tick` moves them and the wall clock does not.

#### Scenario: Cards and toasts on game time
- **WHEN** a toast of 1.8 s shows and 2.2 s of wall time pass with no tick
- **THEN** it still shows, and it hides on the 108th step of `__gloam.tick`. When the lamplighter dies, the run summary opens on the 72nd step of the fade, whatever the wall clock. Check: e2e `gloam-downs-run.cards.e2e.mjs`.

### Requirement: Reduced motion
When the system asks for reduced motion, the camera SHALL not kick, zoom or turn by itself. The hurt blink SHALL change every 8 steps (0.133 s). The flash at the boss's fall SHALL not show. A hit foe SHALL not shake.

With reduced motion, the low health tint SHALL stay at 15% with no pulse. The health bar SHALL show a steady fire edge, and SHALL not pulse.

#### Scenario: Reduced motion
- **WHEN** the e2e turns reduced motion on and runs a hit, a boss slam and the boss intro. Then it runs 3 s with an awake foe at 60° to the side and no look input.
- **THEN** `fx.kick` stays [0, 0, 0] and `fx.zoom` stays 1 all through, and the view does not turn by itself. The blink changes every 8 steps, and the hit foe does not shake. Below 30% health, the tint stays at 15%, and the health bar does not pulse. Check: e2e `gloam-downs-run.look.e2e.mjs`.

### Requirement: The look in a fight
With foes on screen, every place SHALL keep the dark look. Foes SHALL add no bright colour other than fire, lamp and wisp. Foes SHALL be baked with Ink Studio as splats, so they take each place's palette, dither and outlines.

A bright pixel that foes add SHALL be a pixel that the foes change and that is brighter than a floor. The floor SHALL be the larger of two values. One is 0.42, the luminance of fire slot 34. The other is the dimmest of the brightest 1% with no foes.

#### Scenario: Measure a fight
- **WHEN** the e2e draws these views, each at the phone and the desktop art size, and again with no foe awake:
  - The Sunken Gaol with 5 foes awake;
  - The Crow Wall with R2 and R4 awake (5 foes) and the Pitchrook's ring;
  - Lantern Fen with 6 foes and a ground marker;
  - The Bell Knoll with its 6 slots awake and the Ironback's slam ring;
  - Barrow Crown with 6 foes and a ground marker.

  Both views use the same game time (`__gloam.draw({ time })`), and the view with no foe parks every slot for that draw (`pool: false`). Before each draw, `teleport` puts the lamplighter at the same point and yaw.
- **THEN** each view with foes has a mean luminance from 0.05 to 0.32, and 0.05% to 12% of its pixels are brighter than 0.55. At least 95% of the bright pixels that the foes add are within 12 of a fire, lamp or wisp colour. No pixel that the foes add is within 12 of wisp slot 40. Check: e2e `gloam-downs-run.look.e2e.mjs`.

### Requirement: Colour distance
A pixel SHALL be within 12 of a colour when each of R, G and B differs by 12 or less. The measure SHALL use 8-bit values. The checks of the run's look SHALL use this measure.

#### Scenario: Within 12
- **WHEN** the Node test measures two pixels against fire slot 34. The first differs by 12 in each of R, G and B. The second differs by 13 in G alone.
- **THEN** the first is within 12 of slot 34, and the second is not. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Foe colours
Foes and the boss SHALL use no colour brighter than fire slot 37 (fff4cc). The Mirelight and the boss's cage light SHALL use wisp slots 38 and 39, and not slot 40. In each of the five palettes, every foe and boss colour SHALL snap to a colour under 0.42 luminance. Otherwise it SHALL snap to slots 32 to 39 or 44 to 47. No foe or boss colour SHALL snap to the lamplighter's cloak slots 41 to 43.

#### Scenario: Foe colours in every palette
- **WHEN** the bake's check snaps each foe and boss colour to each of the five palettes
- **THEN** each one lands on a colour under 0.42 luminance, or on slots 32 to 39 or 44 to 47. None lands on slot 40, and none on slots 41 to 43. Check: a rule in `lib/check.mjs`, run by `node games/gloam-downs/bake.mjs foes boss --check` and by the Node test `gloam-downs-foes.test.mjs`.

### Requirement: Warning moves read
A warning move SHALL add clear fire to the picture, in fire slots 34 to 37. The check SHALL draw a foe 4 m in front of the lamplighter at the default camera. `__gloam.spawn` SHALL put the foe there, and `__gloam.hold` SHALL keep it in its move. On a small screen the tell's glow SHALL grow about its pivot, so that a metre covers no fewer art pixels than at 1280 by 720 (180 art px high, 8.5 m back, 48°). It SHALL grow no more than 2 times.

#### Scenario: Measure a tell
- **WHEN** the e2e draws a Snuffer at rest, and held at 0.54 s of its hook, the end of the wind-up. It does this at 1280 by 720 (art 320 by 180; the camera 8.5 m back, 48° vertical field of view) and at 390 by 844 on a touch screen (art 147 by 317 at device scale 3, about 46,000 px; 15.33 m back, 66°).
- **THEN** inside the Snuffer's box on screen, the art pixels within 12 of fire slots 34 to 37 are counted. "Colour distance" gives the measure. At the end there are at least 3 times as many as at rest, and at least 8 more, at each layout (measured: 7 and 37 at 1280 by 720; 11 and 39 at 390 by 844, where the tell grows 1.49 times, and 12 and 27 without that growth). Check: e2e `gloam-downs-run.fight.e2e.mjs`.

#### Scenario: Measure a ground marker
- **WHEN** the e2e draws an Ironback in The Bell Knoll at the start and at the end of its slam's wind-up
- **THEN** the ring adds at least 20 art pixels within 12 of fire slots 34 to 37 on the ground round it, at 1280 by 720 and at 390 by 844. Check: e2e `gloam-downs-run.fight.e2e.mjs`.

### Requirement: Foe budget
The foes SHALL come from two files: `foes.bin.gz` with the splats, and `foes.json.gz` with the types, splat ranges, bones, pivots and pose keyframes. The two foe files SHALL be at most 200 KB together. The boss SHALL come from `boss.bin.gz` and `boss.json.gz`, at most 140 KB together. Each place, with its pool of foes, SHALL have no more than 275,000 splats. At most 6 foes SHALL be awake at once.

#### Scenario: Budget check
- **WHEN** the Node test reads the baked worlds, the foe files, the boss files and each place's pool
- **THEN** the foe files are 200 KB or less together, and the boss files 140 KB or less. Each place with its pool has 275,000 splats or fewer. Check: Node test `gloam-downs-foes.test.mjs`.

### Requirement: Place files and zones
The run SHALL not change `<id>.bin.gz` or `<id>.walk.bin.gz` of any place. The zones SHALL go into `<id>.json` only. The bake SHALL take `--no-zones`, which leaves the zones out, and `--worlds <dir>`, which names the folder that it writes.

#### Scenario: Bake with and without zones
- **WHEN** a check bakes a place into a temporary folder with its zones, and again into another with `--no-zones`
- **THEN** the two `.bin.gz` files are the same, and the two `.walk.bin.gz` files are the same. The two `<id>.json` files differ only in `zones`. The committed files in `public/lab/gloam-downs/worlds/` do not change. Check: Node test `gloam-downs-foes.test.mjs` for The Sunken Gaol, and `node qa/lab/gloam-downs-bake-zones.mjs` for all five places.

### Requirement: Download in a run
A place's 1.5 MB SHALL count its three files: `<id>.bin.gz`, `<id>.walk.bin.gz` and `<id>.json`. The foe files and the boss files SHALL not count toward it. Before play starts in a place, the page SHALL download only the place's three files and the two foe files. It SHALL not download the foe files when the cache has them. That SHALL be no more than 1.7 MB in all. The boss files SHALL load after play starts, and the arena SHALL stay asleep until they have loaded.

#### Scenario: Sizes
- **WHEN** the Node test adds the sizes of each place's three files, and then adds the sizes of the two foe files
- **THEN** each place's three files come to 1.5 MB or less, and each sum with the foe files to 1.7 MB or less. Check: Node tests `gloam-downs-run.test.mjs` (the three files) and `gloam-downs-foes.test.mjs` (with the foe files).

#### Scenario: Boss files after a reload
- **WHEN** a run reloads in Barrow Crown with an empty cache
- **THEN** play starts before the boss files have loaded, and the arena wakes only after they have loaded. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: Foe and boss files that do not load
When the foe files do not load, the loading screen SHALL say so and show Try again. Try again SHALL ask for the files again. The lamplighter can come within 11 m of the arena before the boss files are in. Then the page SHALL pause the game and show the loading screen. The loading screen SHALL show progress, or say that the files did not load and show Try again.

#### Scenario: The foe files fail
- **WHEN** the e2e makes the foe files fail once, and the player presses Try again
- **THEN** the loading screen says that the foes did not load, and Try again has the focus. After Try again, the place loads and play starts. Check: e2e `gloam-downs-run.lineup.e2e.mjs`.

#### Scenario: The boss files fail
- **WHEN** the e2e makes the boss files fail once, and the lamplighter walks to within 11 m of the arena's centre. Then the e2e presses A on a mocked gamepad alone.
- **THEN** the game pauses, and the loading screen says that the Barrow Reeve did not load. Try again has the focus. After A, the boss files load and play goes on. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: Step back from the arena
When the boss files did not load, the loading screen SHALL also show Step back. Step back SHALL put the lamplighter at the last point of its path that was 13 m or more from the arena's centre. When the path has no such point, Step back SHALL put the lamplighter at the place's start. Then play SHALL go on, and the arena SHALL stay asleep.

#### Scenario: The boss files fail twice
- **WHEN** the e2e makes the boss files fail twice, and the lamplighter walks to within 11 m of the arena's centre. The player presses Try again, and then Step back.
- **THEN** the loading screen shows again with Try again and Step back. After Step back, play goes on with the lamplighter 13 m or more from the arena's centre. The arena stays asleep. Check: e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: Frame cost in a fight
A fight SHALL cost little more than the place alone. The place alone SHALL mean the place with the lamplighter's bones and no pool. The checks run on this machine's Node and software WebGL, so they compare ratios.

#### Scenario: Picture cost
- **WHEN** the e2e draws a view of The Bell Knoll at the phone art size three times, with all 6 pool slots awake. The foes stand 4 to 8 m in front of the lamplighter. It draws the same view three times in Wander, which loads no pool.
- **THEN** the median frame with foes takes no more than 1.30 times the median in Wander. Check: e2e `gloam-downs-run.perf.e2e.mjs`.

#### Scenario: Sort cost
- **WHEN** the Node bench sorts each place with its largest awake set on bones. The other slots are parked at density 0 and off the bones. In Barrow Crown it also sorts the boss fight, with the boss alone on bones. In one process, it times the place alone and the fight in alternate rounds. Each figure is the best median of 3 rounds of 60 frames.
- **THEN** in the best of 3 runs of the bench, each sort takes no more than 1.45 times the sort of the same place alone. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: Foe cost
- **WHEN** the Node bench steps 6 awake foes with their sight tests and bodies for 600 steps
- **THEN** the median step takes 0.5 ms or less. Check: Node test `gloam-downs-run.test.mjs`.

### Requirement: Test mode for the run
With `?test`, the page SHALL not run its loop. A test SHALL step the run with `__gloam.tick(seconds, held)` at 60 steps a second. `held` SHALL name the held inputs: mx, mz, jump, slow, ox, attack, roll, heal and look. With `held` set to `'live'`, `tick` SHALL read the real keys, pointer, touch and gamepad. With `?seed=N`, the run's seed SHALL be N. With `?fresh`, the page SHALL start with a fresh run save and a fresh explorer save. With `?nodraw`, a move to a place SHALL not draw.

#### Scenario: Same seed, same run
- **WHEN** a test plays 30 s of the Gaol twice with `?test&seed=7&fresh` and the same held inputs
- **THEN** the run state and the foes are the same both times. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: The pad in a test
With `held` set to `'live'`, `tick` SHALL read the pad on every step in every mode, also in cards and on the loading screen. It SHALL move the focus and press buttons as the loop does. A card that opens SHALL read `navigator.getGamepads()` to choose its controls.

#### Scenario: A card in a test
- **WHEN** the help card shows under `?test` with a mocked gamepad connected from the load. The pad holds A, and the test calls `__gloam.tick(0.1, 'live')`.
- **THEN** the help card's button is pressed, and the run starts in The Sunken Gaol. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: The run's state in a test
With `?test`, `__gloam.run()` SHALL return the run state with these fields:
- `mode`, `place`, `hp`, `max`, `flasks`, `flasksMax`, `carried`, `bank`, `wisps`, `wicks` and `offer`;
- `foes` and `banked`, the foes put out and the glim banked in this run, and `bossDown`;
- `time`, `step` (the game clock), `playStep` (the play clock) and `stop` (the steps of hit stop left);
- `fx`, the effects of "The effects in a test".

#### Scenario: Read the run
- **WHEN** a test sets 40 health with `__gloam.set` and ticks a Snuffer's hook onto the lamplighter
- **THEN** `__gloam.run()` shows `hp` 24, and `stop` counts the 5 steps of a hurt's hit stop. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: The lamplighter's state in a test
With `?test`, `__gloam.run()` SHALL also return `move`, `t`, `safe` and `combo`. These are the lamplighter's move, the seconds of play in the move, `'roll'` or `'hurt'` in a safe time, and the next hit of the string. It SHALL also return `entry` and `ended`, as the save holds them.

#### Scenario: Read a roll
- **WHEN** a test presses Roll and ticks 0.1 s
- **THEN** `__gloam.run()` shows `move` as `'roll'` and `safe` as `'roll'`. After 1 s more, `move` is null. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: The effects in a test
With `?test`, `__gloam.run().fx` SHALL hold `kick`, `zoom`, `bars` and `grade`. `kick` SHALL be the camera's offset in metres, as [x, y, z]. `zoom` SHALL be the zoom factor, 1 for no zoom. `bars` SHALL be the height of each bar, as a share of the screen's height. `grade` SHALL be the 48 colours after the grade. `blink` SHALL be true while the hurt blink hides the figure.

#### Scenario: Effects at rest
- **WHEN** a run plays in the Gaol with no hit for 2 s
- **THEN** `fx.kick` is [0, 0, 0], `fx.zoom` is 1 and `fx.bars` is 0. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: The foes in a test
With `?test`, `__gloam.foes()` SHALL return each awake foe and the boss with `id`, `type`, `zone`, `x`, `y`, `z`, `hp`, `move`, `t`, `flash` and `shake`. Here `t` is the time in the move, `flash` the steps of hit flash left, and `shake` the picture's shake of a hit foe as [x, y, z] in metres: ±0.04 m every 2 game steps, and [0, 0, 0] with reduced motion or the shake turned off.

#### Scenario: Read the foes
- **WHEN** a test spawns a Snuffer 2 m in front of the lamplighter, holds it at 0.2 s of its hook, and ticks one step
- **THEN** `__gloam.foes()` shows the Snuffer with 50 `hp`, its hook as `move`, and `t` 0.2. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Low health and tells in a test
With `?test`, `__gloam.run().fx` SHALL also hold `low`, true below 30% health, `beats`, the count of heartbeats, and `tell`, how much the tells grow on this screen (see "Warning moves read").

#### Scenario: Read the tells' growth
- **WHEN** a run draws at 1280 by 720, and at 390 by 844 on a touch screen at device scale 3
- **THEN** `fx.tell` is 1 at 1280 by 720, and between 1.4 and 1.6 at 390 by 844. Check: e2e `gloam-downs-run.fight.e2e.mjs`; the Node test `gloam-downs-foes-ai.test.mjs` checks `low` and `beats` in `feel.js`.

### Requirement: Test hooks for foes
With `?test`, the page SHALL give these hooks for foes:
- `__gloam.wake(zone)` SHALL wake a zone in free slots of the pool.
- `__gloam.spawn(type, x, z, yaw)` SHALL wake one foe at once at a point in a free slot.
- `__gloam.hold(foe, move, t)` SHALL keep a foe's pose and place at time t of a move. A held foe SHALL not hit.
- `__gloam.out(foe)` SHALL put out one foe as a death does, and drop its glim. `__gloam.out(zone)` SHALL do this to each foe of a zone.


#### Scenario: Hold a wind-up
- **WHEN** a test spawns a Snuffer 4 m in front of the lamplighter. It holds it at 0.54 s of its hook, the last step of the wind-up. It draws, ticks 1 s and draws again.
- **THEN** both pictures show the same pose of the Snuffer, and the hook does not land. Check: e2e `gloam-downs-run.look.e2e.mjs`.

#### Scenario: Spawn with no free slot
- **WHEN** a test spawns a Snuffer in the Gaol while its 5 pool slots are awake
- **THEN** nothing new wakes, and the call says that no slot is free. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

#### Scenario: Clear a guard zone
- **WHEN** a test calls `__gloam.out('G5')` and then `__gloam.light()` in the Gaol
- **THEN** the keep's three Snuffers go out and drop 9 glim, and the beacon lights. The bank goes up by 9 when no other mote is on the ground. Check: Node test `gloam-downs-foes-ai.test.mjs`, and e2e `gloam-downs-run.fight.e2e.mjs`.

### Requirement: Test hooks for notches, cameras and draws
With `?test`, the page SHALL also give these hooks:
- `__gloam.notches()` SHALL list the ember notches on screen as `{ kind, foe, edge, x, y, fill, bearing, rect }`. `kind` is `'foe'` or `'keepers'`.
- `__gloam.combat()` SHALL give what the cameras read: the awake foes, with `home`, `homing` and `rising`, and the blade's target.

#### Scenario: Read the notches
- **WHEN** at 390 by 844 a test spawns a Snuffer 6 m to the right of the lamplighter, and holds it at 0.1 s of its hook
- **THEN** `__gloam.notches()` lists one notch of kind `'foe'` at the right edge, 18% full, ±10%. Check: e2e `gloam-downs-run.fight.e2e.mjs`.

### Requirement: Test hooks for draws and framing
With `?test`, `__gloam.draw({ time, pool })` SHALL draw at game time `time` (the clips and the flicker). With `pool: false` it SHALL park every foe slot and the spark pool for that one draw. `__gloam.layout(o)` SHALL frame the camera as a window `{ w, h }` would, or with `{ fov, dist, pitch, aim }` given. `null` SHALL put this window's framing back.

#### Scenario: A fixed draw
- **WHEN** a test draws twice with the same `time`, once with `pool: false`
- **THEN** the place's flicker is the same in both pictures, and the second has no foe. Check: e2e `gloam-downs-run.lineup.e2e.mjs`, which draws each place at one game time with every slot parked and then posed.

### Requirement: The spawn hook
A foe from `__gloam.spawn` SHALL be already risen, with no ember cracks and no cooldown. It SHALL count as an awake zone of its own for the combat camera, the tokens and the cap of 6. Its home SHALL be its spawn point, with a leash of 4 m.

#### Scenario: Spawn in view
- **WHEN** a test spawns a Snuffer 1.5 m in front of the lamplighter and ticks one step
- **THEN** `__gloam.foes()` shows the Snuffer awake, and no ember cracks show. A cut that starts on the next step hurts it when it lands. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Test hooks for the run's state
With `?test`, the page SHALL give these hooks for the run's state:
- `__gloam.fx(flags)` SHALL turn the stop, flash, kick, zoom, grade and shake effects on or off.
- `__gloam.set(fields)` SHALL set health, flasks, glim carried, the bank, the upgrades, the wicks and the boss's health (`bossHp`). It SHALL change the current values, and it SHALL never change `entry`.
- `__gloam.go(id)` SHALL start a place as Walk on does. It SHALL take the entry snapshot from the current values and store the run.


#### Scenario: Set health
- **WHEN** a test sets 40 health and 1 flask with `__gloam.set`
- **THEN** the HUD shows "40/100" and one full pip. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

### Requirement: Test hooks for the run's screens
With `?test`, `__gloam.kill()` SHALL end the run as a death does. `__gloam.toast(text, ms)` SHALL show a toast and give its rect. `__gloam.lamp(from)` SHALL open the Lamp-room as from a beacon card (`'beacon'`), from Wander's Map (`'wander'`) or on its own.

#### Scenario: A test death
- **WHEN** a test calls `__gloam.kill()` in the Gaol
- **THEN** the picture fades to ink, and the run summary opens on the 72nd step of the fade. Check: e2e `gloam-downs-run.cards.e2e.mjs`.

### Requirement: Test hooks for targets and hits
With `?test`, the page SHALL give these hooks, which need no foe:
- `__gloam.post(x, z)` SHALL stand a training post: a target with health and no attack. `__gloam.posts()` SHALL list the posts and the hits on them.
- `__gloam.hurt(damage, from)` SHALL land a hit on the lamplighter, as a foe's hit does.
- `__gloam.project([x, y, z])` SHALL give the screen point of a world point in CSS px, or null behind the eye.

#### Scenario: Swing at a post
- **WHEN** a test stands a post 2 m in front of the lamplighter, and the player presses J
- **THEN** `__gloam.posts()` shows a hit of 10 on the post. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: A hit from a test
- **WHEN** a test calls `__gloam.hurt(16)` at 100 health
- **THEN** `__gloam.run()` shows `hp` 84 and `stop` 5, and the stored run holds 84. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Setting the boss's health
`__gloam.set({ bossHp })` SHALL put the boss at once in the phase of that health. When the phase changes, there SHALL be one hit stop of 9 steps and one stumble of 120 steps (2.0 s). This SHALL hold however many thresholds the change crosses.

#### Scenario: Set the boss's health
- **WHEN** a test sets `bossHp` to 10 in phase 1 of the boss fight, ticks 2.2 s, and lands a cut on the boss
- **THEN** the boss is in phase 3 after one stumble. The hit stop and the stumble end within 129 steps, so the cut deals 10, and the boss falls. Its light rises to the lantern. Check: Node test `gloam-downs-boss.test.mjs` and e2e `gloam-downs-run.boss.e2e.mjs`.

### Requirement: Test hooks for the beacon and the sound
With `?test`, `__gloam.light()` SHALL act as a touch on the beacon, so it SHALL obey the guard rule and the boss's light. `__gloam.sounds()` SHALL return a log of the sound cues, each with its cue name, its game step and its play step.

#### Scenario: Sound log
- **WHEN** a test spawns a Snuffer 2 m in front of the lamplighter, ticks until its hook lands, and reads `__gloam.sounds()`
- **THEN** the log has the scrape cue on the first step of the wind-up, and the hurt cue 33 play steps later. Check: e2e `gloam-downs-run.input.e2e.mjs`.

#### Scenario: A light obeys the guards
- **WHEN** a test calls `__gloam.light()` in the Gaol while the keep's Snuffers stand
- **THEN** the beacon stays dark, and the toast names the keep. Check: e2e `gloam-downs-run.screens.e2e.mjs`.

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
Each bot SHALL play until its first win, or for 12 runs. The bot SHALL spread its bots over the machine's cores with `worker_threads`. The three bot commands of 60 bots each SHALL finish in less than 10 minutes together on the development machine, which has 4 cores.

#### Scenario: Bot time
- **WHEN** the three bot commands of the Pacing check run one after the other
- **THEN** they finish in less than 10 minutes together. Check: the bot, `gloam-downs-bot.mjs`.

### Requirement: Sound in a run
The run SHALL make its sound in code with WebAudio, with no sound files. It SHALL have a cue for each warning move, hits, hurt, glim, the beacon and the boss. Sound SHALL start only after a press on the page. The pause panel's switch SHALL turn it off and on, and the choice SHALL be saved. Sound SHALL stop while the page is hidden. Wander SHALL make no sound, as the explorer made none.

#### Scenario: Hidden page
- **WHEN** `NODE_PATH=/opt/node22/lib/node_modules node qa/arcade/quiet.mjs --only=lab/gloam-downs` runs with the site served
- **THEN** the run's sound plays after Begin the run, stops while the page is hidden, and comes back when it shows. Check: `qa/arcade/quiet.mjs`.

#### Scenario: No sound in Wander
- **WHEN** the player takes a wisp and lights a beacon in Wander
- **THEN** `__gloam.sounds()` stays empty, and the page makes no `AudioContext`. Check: e2e `gloam-downs-run.input.e2e.mjs`.

### Requirement: Original names
Every name in the run SHALL be original. The names of the game, the places, the foes, the currency and the rooms SHALL be these:
- the game: Gloam Downs;
- the places: The Sunken Gaol, The Crow Wall, Lantern Fen, The Bell Knoll and Barrow Crown;
- the foes: the Snuffer, the Pitchrook, the Mirelight, the Ironback and the Barrow Reeve;
- the currency and the rooms: glim, the Lamp-room and Wander.

#### Scenario: Names on screen
- **WHEN** the Node test reads every place, foe, currency, room, wick and upgrade name in the run's data, and every card title
- **THEN** each name is in this list or in the list of wicks and upgrades. No name or card title has a phrase from the test's list in `qa/lab/gloam-downs-names.json`. Check: Node test `gloam-downs-run.test.mjs`.

#### Scenario: The list of names to avoid
- **WHEN** the Node test reads `qa/lab/gloam-downs-names.json`
- **THEN** it holds at least these names. Check: Node test `gloam-downs-run.test.mjs`, on this list:
  - Dead Cells places: Prisoners' Quarters, Promenade, Toxic Sewers, Ramparts, Ossuary, Stilt Village, Graveyard, Clock Tower and Clock Room;
  - more Dead Cells places: High Peak Castle, Throne Room, The Crown and Lighthouse;
  - Dead Cells bosses: Concierge, Conjunctivius, Time Keeper, Giant, Hand of the King, Collector and Queen.

### Requirement: Names of wicks and upgrades
The names of the wicks and the upgrades SHALL be these, and SHALL be original:
- the wicks: Long wick, Keen edge, Quick heels, Heavy fall, Spare oil and Close shave;
- the upgrades: Mantle, Flask, Edge, Draught and Ash pocket.

#### Scenario: Wick and upgrade names
- **WHEN** the Node test reads the wicks and the upgrades in the run's data
- **THEN** there are six wicks and five upgrades, with these names and no others. Check: Node test `gloam-downs-run.test.mjs`.
