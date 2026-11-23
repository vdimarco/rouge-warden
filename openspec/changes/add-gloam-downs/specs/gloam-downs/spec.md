## ADDED Requirements

### Requirement: Five dark places on rolling hills
Gloam Downs SHALL have five places, in this order: The Sunken Gaol, The Crow Wall, Lantern Fen, The Bell Knoll and Barrow Crown. Each place SHALL be a world of Ink Studio splats on rolling hills, sculpted and baked offline, with its own palette, sky, fog and landmark. The landmark with the beacon SHALL stand on a summit that the player can see from the start point.

#### Scenario: Open the piece
- **WHEN** a first-time visitor opens `/lab/gloam-downs/?explore`
- **THEN** a progress bar shows while the world loads. Then The Sunken Gaol shows with the lamplighter at the start point and the summit beacon in view. Check: e2e `gloam-downs.e2e.mjs` through `?explore`: the picture has more than 6 colours.

#### Scenario: Each place is different
- **WHEN** the visitor goes to each of the five places
- **THEN** each one shows its own landmark, palette and sky, and the ground rolls in hills. Check: Node test `gloam-downs.test.mjs`: the five names differ, and so do the first 32 colours of the five palettes.

### Requirement: Gritty and dark
Every place SHALL be at dusk or at night. Most of the screen SHALL be dark: shadowed stone, ground and sky. Fire, lanterns, wisps and the moon SHALL be the brightest pixels. The picture SHALL be pixel art: a small render, scaled up by a whole number and snapped to the palette with dither. It SHALL have dark outlines at depth breaks. Distance fog SHALL fade far hills toward a dark sky color.

#### Scenario: Measure the dark
- **WHEN** the test takes a picture of each place from the start point
- **THEN** the mean luminance of the picture is between 0.05 and 0.32, where 0 is black and 1 is white. Between 0.05% and 12% of its pixels are brighter than 0.55. Check: e2e `gloam-downs.e2e.mjs` through `?explore`.

### Requirement: The lamplighter
The player SHALL be a round hooded lamplighter with a lantern in its left hand and a blade in its right. The blade SHALL be plainly visible from the follow camera at rest and in a swing: broad and chunky, held out to the side, grey iron with a thin lit edge, never brighter than the fire. In no pose SHALL it go into the floor. The figure SHALL swing its legs and arms when it walks, lean when it runs and squash when it lands. It SHALL cast a round shadow on the ground under it.

#### Scenario: Walk
- **WHEN** the visitor holds W or the up arrow
- **THEN** the lamplighter walks away from the camera with its legs swinging, and its shadow stays on the ground under it. Check: e2e `gloam-downs.e2e.mjs` through `?explore`: W moves it more than 2 m, away from the camera. The Node test checks that the shadow lies on the floor under the body.

#### Scenario: See the blade
- **WHEN** the run or the explorer starts at 1280 by 720 or 390 by 844, and the player swings
- **THEN** the blade shows to the right of the lamplighter at rest, a grey cleaver with a warm edge near its tip, and swings with the arm in each cut. Check: Node test `gloam-downs.test.mjs` (in each place, at least 150 splats on the right arm reach more than 0.5 m from the shoulder, the farthest more than 1 m, more than 0.5 m to the side of the body; the figure of 45ffb438 had none, its arm reaching 0.26 m), and screenshots at both sizes at rest and in a cut.

#### Scenario: The blade over the floor
- **WHEN** the lamplighter stands, walks, runs, jumps, and takes each phase of every move of a run (the cuts, the finisher, the roll, the plunge, the landing, the drink, a hit taken)
- **THEN** the blade's lowest splat is at least 0.03 m over the feet. Before: 0.11 m under them at the end of the finisher's chop and 0.43 m in a roll. Check: Node test `gloam-downs.test.mjs`.

### Requirement: Move and jump
The player SHALL move relative to the camera with WASD, the arrow keys, the left stick of a gamepad or the touch stick. Shift SHALL walk slowly. Space, the gamepad A button or the touch Jump button SHALL jump. The lamplighter SHALL stand on the ground, climb low steps, stop at walls and steep slopes, and fall off ledges.

#### Scenario: Wall
- **WHEN** the lamplighter walks into a wall higher than its jump
- **THEN** it stops at the wall and does not go into it. Check: Node test `gloam-downs.test.mjs`: a wall 3 high stops it 0 to 1 m short of the face.

#### Scenario: Wall at an angle
- **WHEN** the lamplighter walks or jumps into a wall or a ledge of 1.0 or more at any angle, on a 30, 60, 120 or 144 Hz screen
- **THEN** it slides along the wall and stays on the ground below it, unless it jumps onto a ledge lower than its jump

#### Scenario: Step on a ledge's lip
- **WHEN** the lamplighter walks at a ledge of 1.2 that has a step of 0.7 on its lip, at any angle and frame rate
- **THEN** it stops below the step, and a jump gets it onto the ledge

#### Scenario: Under an arch
- **WHEN** the lamplighter walks or runs under an arch or a tree crown with 1.8 of clearance, at any speed or frame rate
- **THEN** its feet stay on the floor under it

#### Scenario: On a roof
- **WHEN** the lamplighter jumps on, or falls onto, a sloped roof, an arch's top or a tree crown with a gap under it, on a 30, 60, 120 or 144 Hz screen
- **THEN** it lands on the top and does not fall through to the floor under it, and its shadow lies under its feet

#### Scenario: Higher roof
- **WHEN** the lamplighter walks on a roof into a higher roof
- **THEN** it stops at the higher roof, or walks up it when the step is 0.5 or lower, and does not fall through

#### Scenario: Sloped floor under a roof
- **WHEN** the lamplighter jumps in place, or runs and jumps up or down, on a floor that slopes 0.6 or 1.0 per unit under a roof, on a 30, 60, 120 or 144 Hz screen
- **THEN** it lands on that floor and does not fall through it

#### Scenario: No shelf in mid-air
- **WHEN** the lamplighter runs and jumps down a floor that slopes 0.6 or 1.0 per unit under a roof 5 high, with the stick held or let go in the air, on a 30, 60, 120 or 144 Hz screen, and then walks across the slope
- **THEN** it lands on the floor and stays on it, and never stands in the air between the floor and the roof

#### Scenario: Edge of a vault over a grate
- **WHEN** the lamplighter runs and jumps from a grate over a pit into a vault whose floor is the grate's height, or out of the vault onto the grate, on a 30, 60, 120 or 144 Hz screen
- **THEN** it flies and lands as it does on plain ground, and the vault's edge does not stop it

#### Scenario: Hut over a crawl space
- **WHEN** the lamplighter walks, runs or jumps on a hut's porch under its eave, along the hut's wall or across the seams between the planks, on a 30, 60, 120 or 144 Hz screen
- **THEN** its feet stay on the porch, and it never drops through a seam or past the hut's wall into the crawl space under the hut

#### Scenario: Seam in a boardwalk
- **WHEN** the lamplighter walks along or across a boardwalk where a seam between its planks is one cell of the walk map wide
- **THEN** it walks over the seam and does not drop through it into the water

#### Scenario: Slot between two floors
- **WHEN** the lamplighter walks across a slot one cell wide between floors at 0 and 0.5 over a drop of 2, or across a notch two cells wide and 1.5 deep in a platform, on a 30, 60, 120 or 144 Hz screen
- **THEN** it walks over the slot or the notch and never stands in it

#### Scenario: No trap
- **WHEN** the lamplighter walks, runs, jumps or falls to a place that the bake's reach check gets to (its own walks and jumps, and wide jumps on 16 headings over anything lower than the jump's top and under roofs), on a 30, 60, 120 or 144 Hz screen
- **THEN** from there it can walk or jump back to the start or on to the beacon. It never ends in a slot, a notch, a pit or a nook under a roof that it cannot leave, and a trap wider than a crack fails the bake. Check: the bake's `--check` line "no trap", and the Node test `gloam-downs.test.mjs`

#### Scenario: Stairs
- **WHEN** the lamplighter walks or runs up, down, beside or across any of the 18 flights of steps in the five places, straight or at 30° or 60°, at 30 or 60 Hz, or rolls on them in a run
- **THEN** wherever it stops, it can walk or jump out on at least one of 16 headings; it is never wedged between steps or between a stair and a wall. Check: Node test `gloam-downs-stairs.test.mjs` (each place's JSON lists its flights as `stairs`; on the walk maps of 45ffb438 it finds 21 stuck stops at the Gaol's west stair)

#### Scenario: Under a beam
- **WHEN** the lamplighter walks on the floor under a slanted beam, where the walk map missed a grid point of the beam, on a 30, 60, 120 or 144 Hz screen
- **THEN** it walks under the beam, and the bake's crack pass puts no solid column there. Check: the Node test `gloam-downs.test.mjs`

#### Scenario: Lean-to against a hall
- **WHEN** the lamplighter runs and jumps, or walks off, from a low roof (a lean-to, top 2.3) into a hall under a higher roof (underside 5), on a 30, 60, 120 or 144 Hz screen
- **THEN** it flies as in the open and lands on the hall's floor, and the hall's roof does not stop it in the air

#### Scenario: Face of a rampart
- **WHEN** the lamplighter falls past the face of a wall where a parapet's lip and a merlon's overhang stand over the ground, on a 30, 60, 120 or 144 Hz screen
- **THEN** it lands on the wall's top or on the ground, and never stands on a shelf between them

#### Scenario: Roof edge above a lean-to
- **WHEN** the lamplighter stands on a lean-to 1.5 under the top of a hall's roof, and runs, jumps or walks off toward the hall, on a 30, 60, 120 or 144 Hz screen
- **THEN** it does not get onto the hall's roof

#### Scenario: Jump into a roof from under its edge
- **WHEN** the lamplighter walks off a ledge to under a roof whose underside is over the ledge, and jumps in the moment after the edge, on a 30, 60, 120 or 144 Hz screen
- **THEN** its feet stop under the roof's underside and it falls, however thin the roof is

#### Scenario: Thin roof over a sloped floor
- **WHEN** the lamplighter jumps in place on, or falls from 1.5 above onto, a roof 1.85 to 2.0 over a floor that slopes 0.6 to 2.0 per unit with it, on a 30, 60, 120 or 144 Hz screen
- **THEN** it lands on the roof and does not fall through it

#### Scenario: Jump under a high roof
- **WHEN** the lamplighter runs and jumps down a slope of 0.4 to 1.0 under a roof 6 high, in a place whose walk map stores the roof's underside, on a 30, 60, 120 or 144 Hz screen
- **THEN** the jump flies and lands as it does on the open slope, and the roof does not stop it in the air

#### Scenario: Past the lip of an overhang
- **WHEN** the lamplighter falls past the lip of an overhang whose floor is higher than the open ground beside it
- **THEN** it lands on the floor there and does not fall through it

#### Scenario: Off a ledge into an arch
- **WHEN** the lamplighter walks off a ledge of 1.2 into an archway or a cave, at any speed or frame rate
- **THEN** it drops to the floor under the arch and is not stopped at the ledge's lip

#### Scenario: Jump onto a ledge
- **WHEN** the lamplighter jumps at a ledge lower than its jump height
- **THEN** it lands on the ledge. Check: Node test `gloam-downs.test.mjs`: it lands on a ledge of 1.0, ±0.05.

#### Scenario: Running jump up a slope
- **WHEN** the lamplighter runs up a slope of 0.3 or 0.6 with the stick at full and jumps, on a 30, 60, 120 or 144 Hz screen
- **THEN** it keeps at least 85% of its run speed in the air and through the landing, runs on up the slope, and the jump goes as far from the take-off at each frame rate, within 0.22

#### Scenario: Running jump up a steep slope
- **WHEN** the lamplighter runs up a slope of 0.8 to 2.0 with the stick at full and jumps, on a 30, 60, 120 or 144 Hz screen
- **THEN** its feet rise at least 0.4 over the slope, the same at each frame rate within 0.03; while they rise, its run up the slope slows so that the slope rises under it at 3.8 per second; the run picks up again before it lands, and it runs on up the slope

#### Scenario: Jump off a terrace over a slope
- **WHEN** the lamplighter runs off the edge of a terrace 0.8 above a slope of 0.8 to 1.5 and jumps there, on a 30, 60, 120 or 144 Hz screen
- **THEN** it keeps at least 95% of its run speed over the slope

#### Scenario: Curb on a slope
- **WHEN** the lamplighter runs up a slope of 0.6 or 1.0 and jumps with its front at the foot of a curb 0.2 high, straight at it or 30° off, on a 30, 60, 120 or 144 Hz screen
- **THEN** the curb stops its run into it until the feet are over it, and it does not pass through the curb

#### Scenario: Block on a slope
- **WHEN** the lamplighter runs up a slope of 0.3 to 1.0 and jumps at a block that stands 1.6 or 2.0 over the slope at its foot, or jumps again and again at a hillside of 4 per unit
- **THEN** it does not stand on the block or climb the hillside

#### Scenario: Block on a slope from a stop
- **WHEN** the lamplighter stands against a block 1.0 over a slope of 0.3 to 1.0 at its foot and jumps toward it, on a 30, 60, 120 or 144 Hz screen
- **THEN** it lands on the block

#### Scenario: Low step
- **WHEN** the lamplighter walks at a step of 0.5 or lower
- **THEN** it walks up the step without a jump. Check: Node test `gloam-downs.test.mjs`: it walks up steps of 0.35 to more than 0.9 high.

### Requirement: Look
Q and E, the right stick, the mouse (see "Mouse look") or a touch drag on the right half of the screen SHALL turn the camera. The camera SHALL follow behind the lamplighter with a framing for the window (see "The camera's framing"), and keep the scenery out of the way (see "The camera and the scenery"). It SHALL turn by itself only as "A calm camera" allows. In a run, the combat camera and the boss camera of gloam-downs-run SHALL apply.

#### Scenario: Turn the camera
- **WHEN** the player holds E or drags on the right half of a touch screen
- **THEN** the camera turns around the lamplighter. Check: Node test `gloam-downs-camera.test.mjs`: E held for 1 s turns the yaw by 2.6 rad, ±0.1 (2.60). The e2e `gloam-downs.e2e.mjs` checks that a drag on the right half turns the yaw by more than 0.2 rad.

### Requirement: Mouse look
Where there is a mouse (see "What counts as a mouse"), a click on the view SHALL take the mouse with the Pointer Lock API, with raw movement where the browser offers it, and SHALL also do what its button does. While the mouse is taken, a move with no button held SHALL turn the view: 0.0022 rad per px across and 0.0018 rad per px down, at most 120 px from one event. The pitch SHALL stay between 0.08 and 1.05 rad. No click SHALL turn the view while the mouse is taken.

#### Scenario: Look with the mouse
- **WHEN** the player moves the mouse 100 px right and 50 px down with the mouse taken
- **THEN** the yaw goes down by 0.22 rad and the pitch goes up by 0.09 rad. A spike of 5000 px counts as 120 px. Check: Node test `gloam-downs-mouse.test.mjs`.

### Requirement: Every click acts
A press of the left or right button on the view in play SHALL always do what the button does, whether the mouse is taken, asked for, refused or unanswered, or the browser has no pointer lock. The left button SHALL jump (in a run, attack) on the first click, and while the mouse is free the right button held and dragged SHALL turn the view. A click while a lock request is still out SHALL not ask again.

#### Scenario: Clicks with the lock granted, refused, unanswered and missing
- **WHEN** at 1280 by 720 with a fine pointer, and on a coarse 390 by 844 page with a mouse, the browser grants the lock, refuses it (a rejected promise, or pointerlockerror), never answers, or has no pointer lock, and the player clicks Begin the run or Walk and then clicks the view three times
- **THEN** each click on the view attacks a post 2 m ahead (the explorer: jumps more than 0.3 m), the first one too; the mouse turns the view (taken: a move with no button; free: the right drag, by more than 0.1 rad); Look, Map, Close, Games and every button of the pause panel answer one click; and with an unanswered request the clicks ask no more than once. Before (913f5b4e): with the lock refused, 55 clicks in 12 s made no attack, and the right drag did not turn the view. Check: e2e `gloam-downs-clicks.e2e.mjs`, with real `page.mouse` clicks and `elementFromPoint` at each button.

### Requirement: A way into the run
The page with no mode in its address SHALL open the combat run, because a player expects a click to attack. `?run` and `#run` SHALL also open the run. `?explore` SHALL open the explorer, and so SHALL `?wander`. The explorer's help card and map SHALL each have a Fight button, at least 44 px high. Fight SHALL open the run's address: `explore` and `wander` leave the query, and the rest of it stays. A run SHALL not show Fight.

#### Scenario: A plain address opens the fight
- **WHEN** at 1280 by 720 a first-time visitor opens `/lab/gloam-downs/?test`, clicks Begin the run with the real mouse, then clicks the view
- **THEN** the run's help card shows with Begin the run focused, and the click on the view attacks a post 2 m ahead. Before: the plain address opened the explorer, where a click jumps. Check: e2e `gloam-downs-clicks.e2e.mjs fight`.

#### Scenario: A player in the explorer wants to fight
- **WHEN** at 1280 by 720, 390 by 844 and 320 by 640 the player opens `?explore&test&_vercel_share=key`, clicks Fight on the help card, or presses M and clicks Fight on the map
- **THEN** the page loads with no `explore` in its query and the share key kept. The run's help card shows, and Fight is not shown. The map still fits with no scroll. Check: e2e `gloam-downs-clicks.e2e.mjs fight`.

#### Scenario: Old addresses keep their meaning
- **WHEN** the e2e opens `?run&test`, `?test#run` and `?explore&test`, and the Node test reads the modes of 15 addresses
- **THEN** the first two open the run's help card, and `?explore` opens the explorer with no run. `?wander` is the explorer too. Check: e2e `gloam-downs-clicks.e2e.mjs fight` and Node test `gloam-downs-run.test.mjs`.

### Requirement: What counts as a mouse
There is a mouse when the primary pointer is fine, or when a pointer of type mouse has moved or pressed on the page since (any-pointer: fine) last turned on. The page SHALL read this on each event and as those media queries change, so a phone with a mouse plugged in counts. A pen or a touch is not a mouse, and a touch's tap on the view SHALL never act as a click. A touch on the screen SHALL free a taken mouse, and SHALL act where it touched.

#### Scenario: A touch is not a click
- **WHEN** on a 390 by 844 touch screen the player taps the view (not a touch button)
- **THEN** the lamplighter does not jump and the page does not ask for the mouse. Before (913f5b4e): the browser's copy of the tap as a mousedown jumped. Check: e2e `gloam-downs-clicks.e2e.mjs`.

#### Scenario: A thumb after the mouse
- **WHEN** on a coarse 390 by 844 page the mouse is taken and the player puts a thumb on the left half of the view at (90, 640)
- **THEN** the mouse is freed and the stick shows under the thumb. Before this change's first build: the touch got the taken mouse's place and looked instead. Check: e2e `gloam-downs-clicks.e2e.mjs` and `gloam-downs.e2e.mjs` (the phone part).

### Requirement: Page buttons answer the mouse
Every page button SHALL answer one click of the mouse. The button itself SHALL be what is on top at its centre, and it SHALL be at least 44 px on its shorter side.

#### Scenario: Every button, one click
- **WHEN** at 1280 by 720 and on a coarse 390 by 844 page with a mouse, the player clicks Walk, Look, Map, Close, Games, Begin the run, Pause, Sound, Music, End the run, No, Back to the start, Resume, a wick, Spend glim, Back to the beacon, Walk on, To the Lamp-room and the Lamp-room's Begin the run with the real mouse
- **THEN** at each button's centre `elementFromPoint` finds the button, and one click does what the button says. Check: e2e `gloam-downs-clicks.e2e.mjs`.

### Requirement: The mouse in the explorer
In the explorer, while the mouse is taken, the left button SHALL jump, and a held left button SHALL jump higher, as Space does. The right button SHALL do nothing. Escape, or the browser, SHALL free the mouse, and the walk SHALL go on. A card that opens (the help card, the Map, the end card) SHALL free the mouse, so its buttons can be clicked. A button that goes back to play SHALL take the mouse again.

#### Scenario: Walk takes the mouse, the click that takes it jumps too
- **WHEN** at 1280 by 720 the player clicks Walk on the help card, presses Escape, and then clicks the view twice
- **THEN** Walk takes the mouse, Escape frees it and the hint shows, the first click takes the mouse again and jumps, and the second click jumps more than 0.3 m (measured 1.38 m). Before (913f5b4e): the first click only took the mouse. Check: e2e `gloam-downs-mouse.e2e.mjs`.

### Requirement: The mouse without pointer lock
Where the browser has no pointer lock, a move with the right button held SHALL turn the view at twice the speed of "Mouse look", and the left button SHALL jump (in a run, attack). The left button SHALL never turn the view.

#### Scenario: No pointer lock
- **WHEN** the browser has no pointer lock, and the player drags with the right button and then with the left button
- **THEN** the right drag turns the view, the left drag does not turn it, and the hint does not show. Check: e2e `gloam-downs-mouse.e2e.mjs` (in a run) and Node test `gloam-downs-mouse.test.mjs` (which button does what in the explorer).

### Requirement: A refused pointer lock
A refusal of the pointer lock, or a request with no answer in 2 s, SHALL keep the page from asking again for 1.5 s, and for 5 s after a second refusal in a row. After a first refusal the page SHALL ask again by itself when the wait is over; after later ones a click asks once the wait is over. The free mouse SHALL work all the while. Until the mouse is taken, the hint SHALL then say "Hold the right button and drag to look".

#### Scenario: The browser refuses the mouse once
- **WHEN** in a run at 1280 by 720 the player presses Escape, the browser refuses the mouse once when the player clicks Resume, and the player then clicks the view with a training post 2 m ahead
- **THEN** play goes on with no pause panel, the hint says "Hold the right button and drag to look", the click hits the post and does not roll, and within 1.5 s the page takes the mouse and the hint hides. Before (913f5b4e): the click did nothing, and while the browser kept refusing no click ever acted. Check: e2e `gloam-downs-mouse.e2e.mjs` (it makes `requestPointerLock` reject once).

### Requirement: A late pointer lock
A lock that the browser grants after a card has opened SHALL be given back at once, so the cursor shows over the card and its buttons take one click.

#### Scenario: The lock comes after the pause panel
- **WHEN** at 1280 by 720 the browser answers the lock 1.5 s late, and the player clicks Begin the run and presses P at once
- **THEN** 2 s later the pause panel shows with the mouse free, and one click on Resume plays. Before (913f5b4e): the late lock hid the cursor over the pause panel and clicks on Resume did nothing. Check: e2e `gloam-downs-clicks.e2e.mjs`.

### Requirement: The mouse hint
While the mouse is not taken in play, where the page can take it, a small hint "Click to look with the mouse" SHALL show low in the middle of the view. It SHALL hide once the mouse is taken, and SHALL not show over a card or on a touch screen with no mouse.

#### Scenario: The hint
- **WHEN** at 1280 by 720 the explorer's help card shows, and then the player frees the mouse in play with Escape
- **THEN** the help card says how the mouse works, and the hint shows at the bottom middle of the view, clear of the HUD and the tools. It hides when a click takes the mouse. Check: e2e `gloam-downs-mouse.e2e.mjs`, with screenshots of the help card and the hint.

### Requirement: The help's mouse lines
The help card SHALL say "Click the view to take the mouse. Move the mouse to look round. Left click jumps. Esc frees the mouse." Without pointer lock it SHALL say "Hold the right button and drag the view to look round. Left click jumps." On a touch screen with a mouse it SHALL show these lines as well as the touch lines. A switch made by a press SHALL wait for the next card, so no button moves under it. A mouse click on the view round its box SHALL walk, as Walk does; a tap there SHALL not.

#### Scenario: A click round the help card
- **WHEN** at 1280 by 720 the help card shows on a first visit and the player clicks the view to its left (30, 360)
- **THEN** the help card closes and play starts. Before (913f5b4e): the click did nothing. Check: e2e `gloam-downs-clicks.e2e.mjs`.

#### Scenario: A tap after a mouse on a phone
- **WHEN** at 390 by 844 on a touch screen the mouse has moved, and the player taps Walk, Begin the run, Resume, Sound, Music, End the run or Back to the start
- **THEN** that same button is pressed: a card that shows does not change its height under the tap. A tap round the help box leaves it open. Check: e2e `gloam-downs-clicks.e2e.mjs taps`.

### Requirement: A calm camera
The camera SHALL turn by itself (the swing behind a running lamplighter, the turn out of a blocked lane, and a run's combat and boss cameras) only after 2 s with no look input. It SHALL never turn by itself while the mouse is taken, or while the player holds a move more than 35° from straight ahead or straight back. The swing SHALL ease at 0.5 per second, times the speed up to 5 m/s. With reduced motion it SHALL never turn by itself. R and the Look tool SHALL still turn the view at once.

#### Scenario: The mouse steers
- **WHEN** the lamplighter runs to the side for 5 s with the mouse taken, or runs past an awake foe, or runs into a lane between walls
- **THEN** the yaw does not change by itself. With the mouse free, the swing turns it by more than 0.3 rad. Check: Node test `gloam-downs-mouse.test.mjs`.

#### Scenario: A gentle swing
- **WHEN** the lamplighter runs to the side on touch, keys or a gamepad with no look input, and again while the player holds a move to the side
- **THEN** the swing starts 2 s after the last look input and turns no faster than 0.5 × π/2 rad/s (measured start 2.02 s), and with the move to the side held the view does not turn. Check: Node test `gloam-downs-mouse.test.mjs`.

### Requirement: Tight spaces
Where the scenery is close round the lamplighter, the camera SHALL keep it and the way ahead in view rather than zoom in. The eye SHALL use a room's height, up to 0.35 m under its ceiling. Under a roof over the feet, the aim SHALL come 1.55 m under the roof (at least 0.6 m over the feet); the view MAY dip under a lintel to a pitch of 0.1 where the dip stands at the full distance. It SHALL not take a rise that hides the head while a lower one sees it, nor a distance under 0.5 m.

#### Scenario: Into the torn cell
- **WHEN** the lamplighter walks from the Gaol's yard into the torn cell where its first wisp hangs, at 1280 by 720 and 390 by 844
- **THEN** walking in within 20° of square to the mouth the eye ends out in the yard at the layout's distance. From 35° each way, with the mouse taken (so the view may not turn by itself to the mouth), the eye stands at least 2 m back, or the near fade leaves out the whole figure and it covers at most 15% of the view. Before: a phone's eye stood 0.5 m away walking in. Check: Node test `gloam-downs-camera.test.mjs`, and screenshots at the wisp at both sizes.

#### Scenario: Under a long roof
- **WHEN** the lamplighter stands in a passage 3 m wide under a roof 2.4 m high
- **THEN** the camera stands at 8 m or more inside the passage, its eye under the roof. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: The framed shot
In a nook (the room at the view's yaw under 2 m, the lamplighter at 3 m/s or less), the view SHALL lean toward the nearest yaw where the eye stands 3 m back and sees the head and the chest. The lean SHALL turn the view itself, so the picture and the moves read one yaw. It SHALL add or take away at most 15% of each step of a player's turn, and stay within 60° of the player's own turns. Where it may not turn, or no clear yaw is that near, "The cutaway" SHALL apply, else the near fade.

#### Scenario: Turn round in a nook
- **WHEN** the player turns the view a full turn with the mouse in 6 s, standing at three spots in the torn cell and at each of the 25 wisps, at 1280 by 720 and 390 by 844
- **THEN** on each step the eye stands at least 2.5 m back or the near fade leaves the figure out whole (the steps in between at most 35% at a spot and 6% over all), never nearer than 0.5 m, it sees the head as it settles, and the lamplighter as drawn covers at most 35% of the view on every step (measured: 9% at 1280 by 720, 21% on a phone). Before 2337588c: within 2 m on 84 to 90% of the cell's sweep at 1280 by 720, 65 to 86% on a phone, and the figure a wall of cloak over the view; inside the Bell Knoll's fallen bell the camera stood over the crown with the figure hidden. Check: Node test `gloam-downs-camera.test.mjs`.

#### Scenario: The picture turns with the mouse
- **WHEN** the player turns the view a full turn in 6 s, 1° a step, each way with the mouse and one way with a stick, at the same 28 spots and both sizes, then lets go for 1.5 s
- **THEN** every step turns the picture by 80 to 120% of the turn (a wall holds back no more than 15% of it, the lean no more than 15%), the picture never stands still, and the view stays within 60° of the player's own turns; in the 1.5 s still the view does not turn; in the open it turns by exactly the mouse's turn and never leans. With a fast turn (3 and 6 rad/s) the lean's own count changes by no more than the lean's share of what each step shows (a wall that holds back part of a turn holds back the same part of its lean). Before (100a12c4): the picture was shown from a yaw up to 180° from the mouse's and stood still on 68 to 92% of the steps in the cell. Check: Node test `gloam-downs-mouse.test.mjs`.

#### Scenario: A move goes the way the screen shows
- **WHEN** the lamplighter stands in the torn cell and the player turns the mouse to 8 yaws, 45° apart, waits 1.5 s and presses forward, at 1280 by 720 and 390 by 844
- **THEN** forward moves the figure up the screen (within 30°, as drawn from that step's view). There is one yaw: `follow()` returns the camera's own yaw, which the moves read. Before (100a12c4): a press of back went up the screen at one mouse yaw and down at another. Check: browser test `gloam-downs-mouse.e2e.mjs`.

#### Scenario: Turn against a wall
- **WHEN** the player turns the view into a long wall 1 or 2 m behind the lamplighter and back, at 1.2, 3 and 6 rad/s, and at each spawn and wisp at 1.2 rad/s each way
- **THEN** the eye is never in the wall, the eye comes in eased (no step over 1 m), and in the sweeps of the five places at most 10 steps come in through a wall, each under 2.2 m. Check: Node test `gloam-downs-mouse.test.mjs`.

### Requirement: The cutaway
In a nook (a roof over the head, or walls within 2.5 m at 5 of 8 yaws), or standing, where no rise clears the room or the follow eye within 4 m is heading nearer than 2.5 m, the camera SHALL keep the player's yaw and stand 3.2 m back, coming on before the eye comes in. The view SHALL never come nearer than it was as it started, and SHALL go out to 3.2 m at no more than 5 m/s. A camera coming in from far SHALL come in as before.

#### Scenario: Look round the torn cell
- **WHEN** the player turns the view a full turn with the mouse in 6 s, 1° a step, at three spots in the torn cell and at each of the 25 wisps, at 1280 by 720 and 390 by 844, with the place's splats cut away as the page does
- **THEN** the eye stands at least 2.5 m back on 98% of the steps at each spot and 99.5% over all (measured: 100% at both sizes), and the near fade never thins the figure (measured: no step); the figure shows (whole, and through the splats as drawn) on 93% of all steps (measured 98.6% and 95.6%) and on 98% of the steps where the cutaway is whole (measured 100% at both sizes); it covers at most 25% of the view (measured 9% and 17%); each 1° step turns the picture by 80 to 120%, and in the cutaway by exactly 1°; and the cutaway does not come back on within 0.25 s of going off. Before (19b99dd8): the eye stood 2.5 m back on 70% and 74% of all steps and on 7 to 28% of the steps in the torn cell, the rest nearer, with the near fade hiding the figure. Check: Node test `gloam-downs-camera.test.mjs`.

#### Scenario: A slow pan in from the mouth
- **WHEN** at three spots in the torn cell and at the Gaol's wisp at (7.6, -2.2), at 1280 by 720 and 390 by 844, the mouse turns the view from the mouth at 0.5, 1 and 2° a step for a full turn
- **THEN** on every step the view stands at least 2.5 m back and the near fade leaves the figure whole (measured: the view no nearer than 3.2 m), and while the cutaway is on the view goes out by no more than 5 m/s up to 3.2 m and 12 m/s beyond. Before (8afff94f), at (1.6, -0.9) at 1280 by 720 and 1° a step, the follow eye came in to 0.82 m and the figure was faded out for about 20 steps before the cutaway came on and popped the eye out at up to 25 m/s. Check: Node test `gloam-downs-camera.test.mjs`; in the browser, 0.5° a step at (1.6, -0.9), (1.6, -1.6) and (7.6, -2.2) with every step checked and a screenshot at the nearest step, `gloam-downs-cutaway.e2e.mjs`.

### Requirement: The cutaway's pitch
In the cutaway the view's pitch SHALL rise to the least that puts its eye in the open (over the roof, into the next cell), or stay where none does, and SHALL follow each step of the mouse's pitch at once: up to 1.15 rad, and down as far as the eye stays in the open, where the mouse's own pitch stops too, so no pitch is held out of sight to swing in as the cutaway ends. The view's pitch SHALL never be over 1.15 rad in the cutaway.

#### Scenario: The mouse's pitch in the cutaway
- **WHEN** with the cutaway whole in the torn cell or at the Gaol's wisp, the mouse's pitch moves by 0.3° and 1° a step, up and down
- **THEN** each step moves the view's pitch by as much as the mouse's own pitch moves: the whole step up until 1.15 rad, and down until the eye would leave the open, where both stop; the view's pitch is never over 1.15 rad. Before (8afff94f), 20 steps of 0.3° down did not move the view while the mouse's pitch fell out of sight, and 0.9 rad up moved it 0.08 rad. Check: Node test `gloam-downs-camera.test.mjs` and browser test `gloam-downs-cutaway.e2e.mjs`.

### Requirement: The cutaway does not flicker
Once the cutaway's splats have started back, it SHALL NOT come on again for 0.4 s unless the follow eye has come within 2.5 m, where waiting would hide the figure.

#### Scenario: Walking and the mouse together
- **WHEN** at the 28 spots at both sizes, two runs each of 15 s of made-up play change the move (none, a walk or a run in any direction, forward) and the mouse's turn and pitch every 0.5 s
- **THEN** once off, the cutaway never comes back on within 0.25 s unless the follow eye has come within 2.5 m; it never comes on with the follow eye farther out than 4 m but where no rise clears the room and something already stands between; and the near fade thins the figure on under 0.5% of the steps (running through a lane, or walking past a wall in the open, where by design there is no cutaway; before, 0.88%). Check: Node test `gloam-downs-camera.test.mjs`.

#### Scenario: The mouse stops in the torn cell
- **WHEN** in the torn cell the mouse turns the view from the mouth by 0 to 315° (8 yaws, 45° apart) and stops, at 1280 by 720 and 390 by 844, in the browser
- **THEN** on every step of the turn the view stands at least 2.5 m back and the near fade leaves the figure whole, and a picture halfway through the turn, with the view within 4 m, shows the lamplighter's cloak on at least 4% of the box round it; 1 s later the yaw is the mouse's exactly, the view stands at least 2.5 m back, the near fade leaves the figure whole, the cutaway is on wherever the view looks away from the mouth, and in the drawn picture the lamplighter's cloak fills at least 4% of a box round its projected body. Screenshots at each yaw at both sizes. Check: browser test `gloam-downs-cutaway.e2e.mjs`.

#### Scenario: A pillar beside an open yard
- **WHEN** the lamplighter walks at 3 or 6 m/s past a tall pillar 1 to 3 m behind it, with the mouse taken
- **THEN** there is no cutaway (it is not a nook and the lamplighter is moving), and the eye is never in the pillar. Check: Node test `gloam-downs-mouse.test.mjs`.

### Requirement: The cutaway's splats and turn
While the cutaway is on, the place's splats between its eye and the figure SHALL be left out, and come back once they no longer stand between, each easing out over about 0.15 s and back over about 0.25 s. The view SHALL ease into the cutaway over about 0.15 s and out over about 0.25 s, and go out only once the room has stood 2.9 m back for 0.2 s. The player's turn SHALL be the whole turn of the picture: no lean, no wall holding it back, and with the mouse taken no turn by itself.

#### Scenario: A wall eased out and back
- **WHEN** an eye 3.2 m from the figure has a wall of splats between, with others beside, behind the figure, the sky and the figure's own, and the eye then goes
- **THEN** the wall eases out in 9 steps at 60 Hz and back in 15, the rest never change, and a reset brings back every density. Check: Node test `gloam-downs.test.mjs`.

#### Scenario: The cutaway yields to the boss camera
- **WHEN** in a run the boss camera is on (its eye 12 to 24 m back)
- **THEN** the view it draws cuts none of the place's splats, so no long cone is cut through the arena. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: The framed shot with the view still
With no look input the lean is a turn by itself. It SHALL turn the view only as "A calm camera" allows (never while the mouse is taken or with reduced motion, only after 2 s with no look input), never while a run's combat or boss camera has the yaw, and at no more than 0.5 rad/s. While it turns, a held move SHALL keep its world direction.

#### Scenario: The mouse stops in a nook
- **WHEN** at three spots in the torn cell and at the Gaol's wisp at (7.6, -2.2), at 1280 by 720 and 390 by 844, the mouse turns the view from the mouth by 0 to 315° (8 yaws) and stops; again with reduced motion; and with a stick and the mouse free
- **THEN** with the mouse taken or reduced motion the view does not turn at all in the next 1.5 s, and then the eye stands at least 2.5 m back or no part of the figure, its lantern and blade included, covers more than 15% of the view. With a stick nothing turns it for 2 s, and then the lean turns it at no more than 0.5 rad/s. Before (1974d668): the view turned by itself by up to 43° in 0.5 s with the mouse taken, and the eye settled 0.95 to 1.3 m back with the lantern and the blade over much of the view. Check: Node test `gloam-downs-camera.test.mjs` and browser test `gloam-downs-mouse.e2e.mjs` (8 yaws in the cell, both sizes).

#### Scenario: No look input in a nook
- **WHEN** at the 28 spots, from 24 start yaws, at both sizes, the player sets the yaw with the mouse and then gives no look input for 3 s with the mouse taken, with reduced motion, and with the mouse taken and forward held; and with a stick and forward held for 5 s
- **THEN** the yaw does not change at all in the first three; with the stick, the lean waits 2 s, turns at no more than 0.5 rad/s, and while it turns the move reads the yaw where the turn started. Before (1974d668): the view turned by itself in 47 of 672 cases (up to 43°) with the mouse taken and the same with reduced motion, and a held move curved by up to 37°. Check: Node test `gloam-downs-mouse.test.mjs`.

#### Scenario: A foe near a nook
- **WHEN** a foe stands 6 m away in 6 directions from three spots in the torn cell, from 6 start yaws, with no look input for 10 s and the mouse free
- **THEN** the yaw changes direction at most once, and the foe ends within 20° of the view's forward direction, or the eye is so near that the near fade leaves the figure out whole. Before (1974d668): the lean turned the yaw back on the same step as the combat camera turned it, up to 384 reversals in 480 steps, with the foe left 143° off. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: The follow zoom
Nearer than 3.5 m, the field of view SHALL widen so the view is as tall at the aim as from 3.5 m, up to 90° tall and 110° across.

#### Scenario: Close by a wall
- **WHEN** the walls bring the eye 2 m from the aim at 1280 by 720, or 0.3 m from it
- **THEN** the view is as tall at the aim as from 3.5 m at 2 m, and at most 110° across at 0.3 m (90° tall on a phone). From 3.5 m out the field of view is the layout's. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: The near fade
With the eye within 2.2 m of the lamplighter's body, a share of the figure's splats SHALL be left out, more the nearer the eye, in four steps, and all of them from 0.9 m in, as a dithered fade. The blade and the lantern SHALL stay while the eye is more than 1.6 m from the body; from 1.6 m in, every splat of the figure SHALL be left out, the blade and the lantern too. All densities SHALL come back when the eye moves off.

#### Scenario: Leave out the figure, keep what it holds
- **WHEN** the fade is set to 0.5 and then 1 on a baked place, then to the whole fade, and then to 0
- **THEN** that share of the figure's other splats is left out (±0.03), the blade's and the lantern's are all kept, the whole fade leaves out every splat, and every density comes back. Check: Node test `gloam-downs.test.mjs`.

#### Scenario: An eye at the hood
- **WHEN** the eye is 0.5 m behind the hood, the view widened by the follow zoom, at 1280 by 720 and 390 by 844
- **THEN** the figure as drawn covers none of the view (drawn whole it covers 30% or more, thinned by 0.8 nearly as much, and with the blade and the lantern kept up to 10%). Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: An eased pull-in
When a wall or a hill brings the camera in, it SHALL come in and go back out eased, with a critically damped spring of about 0.15 s in and 0.25 s out. Its eye SHALL still never be inside the scenery. Standing still, the view SHALL not move.

#### Scenario: No jump near a wall
- **WHEN** the player turns the view with the mouse at 1.2, 3 and 6 rad/s into a 14 m wall to the side of the lamplighter and back: walls 0.5 m and 1 m thick, 1 m and 2 m away, at 1280 by 720 and 390 by 844
- **THEN** the camera comes in, its distance changes by no more than 1 m in a step, the change from one step to the next is 0.4 m or less, and the follow eye is never in the wall (the cutaway's eye may be, with the splats round it cut, as it goes out to 3.2 m) (measured at most 0.55 m and 0.3 m; the camera of 09fd360b came in by 4.8 m in one step at 390 by the wall 0.5 m thick and 1 m away at 1.2 rad/s, and had its eye in it at 6 rad/s). Standing still with the back to the wall, beside it, or under a low roof, the view does not move after it settles. Check: Node test `gloam-downs-mouse.test.mjs`.

### Requirement: The eye out of the wall
The eye SHALL never be inside the scenery. Where the view turns toward a wall, the camera SHALL start in early: for the eye at its present distance along its path for 0.3 s ahead, and for the line of sight 0.15, 0.3 and 0.45 s ahead. Where easing the rise down would lower the eye into the scenery, the rise SHALL wait. Where the eye would still go into a wall, or through one on its way round, the turn of that step SHALL go only as far as keeps the eye clear.

#### Scenario: Walk past a pillar
- **WHEN** the lamplighter walks past a 14 m pillar 0.5 m or 1 m thick, 1.5 m or 3 m wide and 1 to 3 m behind it, at 3 and 6 m/s with the mouse taken, at 1280 by 720 and 390 by 844
- **THEN** the eye, coming in past the pillar between, never passes through it and is never in it (the camera of 09fd360b had it there on 23 steps). Check: Node test `gloam-downs-mouse.test.mjs`.

### Requirement: No dive
The camera SHALL come in no faster than 15 m/s while its eye is clear, also where a wall will come between as the player turns the view, or where a nearer goal's path round meets a wall. It SHALL come in faster, at no more than 33 m/s, only where its eye at its present distance is inside the scenery, or will be on its path round within 0.3 s. It SHALL go back out no faster than 12 m/s. Each speed SHALL build at no more than 360 m/s².

#### Scenario: A mouse sweep in the five places
- **WHEN** at the spawn and each wisp of the five places the player turns the view round with the mouse at 1.2 rad/s for 6 s, to the left and to the right, at 1280 by 720 and 390 by 844 (120 sweeps)
- **THEN** a step changes the distance by 0.6 m or less, except where the eye comes in through a wall from behind (the line from the old eye to the new passes within 0.35 m of the scenery), on 10 steps or fewer in all, each under 2.8 m. Measured: 9 such steps, the largest 2.69 m (the camera of 45ffb438: 7, up to 2.05 m, before the tight-space fix left the eye farther back in a room before it meets a wall; that of 3fe9318f: 8, up to 1.75 m; that of 09fd360b changed the distance by more than 0.6 m on 142 steps of 60 sweeps one way, by up to 2.3 m). On every other step where the eye is clear, the camera comes in at 15 m/s or less, and its speed in builds by 360 m/s² or less. The test decides "clear" from the walk map alone, not from the camera's own flag: the old eye, at its last distance and this step's aim and pitch, marched along its path round for 0.3 s of the sweep's turn every 0.1 m, with 0.35 m of clearance. Measured: 0 fast steps, 0 jolts (the camera of 3fe9318f: 53 fast steps and 1 jolt, from 8.50 m to 2.99 m in 0.23 s at the Barrows wisp at (−7.9, 12.8) at 1280 by 720; that of 7dcfd747: 739 fast steps one way). Check: Node test `gloam-downs-mouse.test.mjs` (skipped with `GLOAM_WORLDS=0`).

### Requirement: The camera's framing
The camera SHALL frame each window so:
- landscape: a 48° vertical field of view, 8.5 m back, the aim 0.75 m over the feet, the horizon 12.8% from the top;
- a narrower window: a horizontal field of view of at least 2·atan(0.30), max(8.5, 4.6 / tan of the horizontal half-angle) back (15.33 m on a phone held upright), the aim 1.8 m over the feet, the horizon 24% from the top.

#### Scenario: The ground round the lamplighter
- **WHEN** the lamplighter stands on flat ground in any window from 320 by 568 to 2560 by 1080
- **THEN** a 4 m ring round its feet is inside the screen within 3% of each side. It is between 12% and 95% of the height in landscape, and between 22% and 76% (80% on a tablet) in a tall window, above the touch buttons. A foe 3.5 m to each side is in view. The horizon is under the HUD. The ground is seen at 20° or more. The figure is 7% to 25% of the height. Check: Node test `gloam-downs-camera.test.mjs` at 14 windows, and e2e `gloam-downs-camera.e2e.mjs` at the five layouts. At 3 spots of each place's route the camera stands at its full distance, and a foe 3.5 m to each side is in view at 0.75 (landscape) or 0.9 (phones) of the spots. The mean number of ring points on screen is at least 12 (landscape) or 14 (phones). Measured: full distance at every spot, side foes in view at every spot, ring points 14.7 and 16.

### Requirement: The camera and the scenery
When a hill or a wall comes between the eye and the lamplighter's head or chest, the camera SHALL rise over it, at no more than 4 rad/s, before it comes closer. It SHALL come closer only when no rise up to 1.35 rad clears it. A thin thing SHALL not move it: one with open space 0.55 m to both sides of the line, and no more than 0.6 m along it. The foes SHALL not move it either. Its eye SHALL never be inside the scenery. Past the walk map's bounds, the camera SHALL read the map's edge cells.

#### Scenario: Hill in the way
- **WHEN** a hill comes between the camera and the lamplighter
- **THEN** the camera rises over it and stays back. It comes closer only when no rise clears it. The eye stays out of the wall and sees the head. Check: Node test `gloam-downs.test.mjs`. With a 3 m wall 0.6 to 2.2 m behind the lamplighter, the camera stays 8.5 m back with its pitch over 0.5 (measured 0.82 to 1.30). With the wall 0.4 m behind, it comes in to less than 2.5 m (0.65).

#### Scenario: Back to a wall
- **WHEN** the lamplighter stands with its back to a wall or a cliff
- **THEN** the camera's eye stays in front of the wall, and the view tilts down from above when the wall is too close to frame the lamplighter. Check: Node test `gloam-downs.test.mjs`: backing into the wall for 4 s, the eye stays 0.1 m or more above the wall's top at every step.

#### Scenario: Through the five places
- **WHEN** the lamplighter runs each route at 6.4 m/s with no look input, at the five layouts
- **THEN** the camera stands at 0.6 of its distance or more on 95% of steps (measured 98% to 99%). The figure fills more than 45% of the height on 3% of steps or fewer (0.4% to 1.4%). The lamplighter is hidden on 3% or fewer (1.8% to 2.2%). The eye is inside the scenery on 1% or fewer (0.5%). The view turns at most 4.5° in one step (4.2°). The whole 4 m ring is on screen on 90% of steps in a tall window (93%) and 55% in landscape (62% to 66%). A foe 3.5 m to each side is on screen on 95% of steps in a tall window (98%) and 80% in landscape (89% to 90%). Check: Node test `gloam-downs-camera.test.mjs`.

#### Scenario: Posts and walls
- **WHEN** a post 0.3 m wide stands between the eye and the lamplighter, or the lamplighter runs past a row of posts, or a wall comes between, or the lamplighter walks under a long roof
- **THEN** the posts do not move the camera. A wall that comes between turns the view by no more than 4 rad/s, and the eye stays out of it. Under a long roof the camera follows inside the passage. Check: Node test `gloam-downs-camera.test.mjs`.

### Requirement: Wisps and the beacon
Each place SHALL have five wisps, glowing motes that float above the ground, and one beacon on its summit. In Wander, a wisp SHALL go out and count when the lamplighter touches it, and the beacon SHALL light when the lamplighter touches it. While another beacon is still dark and the place has a next place, a card SHALL say that the way opens. Then the next place SHALL load. Otherwise the walk SHALL follow The end of the walk. In a run, the run's rules apply instead.

#### Scenario: Wisp
- **WHEN** the lamplighter touches a wisp in Wander
- **THEN** the wisp goes out and the count goes up by one. Check: e2e `gloam-downs.e2e.mjs` through `?explore`: the count shows 1/5, and the toast says "Wisp 1 of 5".

#### Scenario: Beacon
- **WHEN** the lamplighter touches the beacon of The Sunken Gaol in Wander
- **THEN** the beacon lights, a card shows, and then The Crow Wall loads. Check: e2e `gloam-downs.e2e.mjs` through `?explore`: The Crow Wall is in the places reached.

### Requirement: The end of the walk
In Wander, when all five beacons burn, in any order, an end card SHALL show. It SHALL show the time, the wisps found and the best time, with a button to walk again. Walk again SHALL put out every beacon, start the time again at zero and go back to The Sunken Gaol. The places reached SHALL stay open. While a beacon is still dark, the walk SHALL not end. If the beacon of Barrow Crown lights then, a card SHALL say how many beacons are still dark.

#### Scenario: The last beacon
- **WHEN** four beacons burn in Wander and the lamplighter lights the fifth
- **THEN** the end card shows the time, the wisps found and the best time. Check: e2e `gloam-downs.e2e.mjs` through `?explore`: with a walk of 100 s, the best time shows 1:40.

#### Scenario: Walk again
- **WHEN** the player chooses Walk again on the end card in Wander, goes to Barrow Crown on the Map and lights only its beacon
- **THEN** the Map shows all five places open, and a card says that 4 beacons are still dark. No end card shows, and the best time does not change. Check: e2e `gloam-downs.e2e.mjs` through `?explore`.

### Requirement: Map and saved progress
In Wander, the Map control and the M key SHALL show the five places. A place the player has reached SHALL be open, and the others SHALL be locked. The page SHALL save the places reached and the wisps found in the browser, under the explorer's own key. It SHALL check each saved field, so a bad save cannot break the page. The run SHALL keep its own save, under another key.

#### Scenario: Come back
- **WHEN** the visitor reaches The Crow Wall in Wander, reloads the page and opens the Map
- **THEN** the first two places are open and the other three are locked, and the wisps found before are still counted. Check: e2e `gloam-downs.e2e.mjs` through `?explore`.

#### Scenario: Bad save
- **WHEN** the saved data holds wrong types or values
- **THEN** the page ignores the bad fields and starts as normal. Check: Node test `gloam-downs.test.mjs`: the cleaned save has the same fields as a fresh one. The e2e loads a bad save and plays.

### Requirement: Controls and layout
Every touch control SHALL be at least 44 px on its shorter side. The page SHALL fit 390 by 844, 320 by 640 and 1280 by 720 with no sideways scroll. On a touch screen a stick SHALL show where the thumb first touches on the left half of the screen. The page SHALL stop its loop while the game switcher is open or the page is hidden. In a dialog, on the end card and on the loading screen, Space and Enter SHALL press the focused button. In play, Space SHALL jump.

#### Scenario: Phone
- **WHEN** the piece opens at 390 by 844 on a touch screen
- **THEN** the Jump, Map and Look controls are at least 44 px and inside the screen, and so are the Lab bar's ◀ Lab and Games. A drag on the left half moves the lamplighter more than 2 m. Check: e2e `gloam-downs.e2e.mjs` through `?explore`.

### Requirement: Loading and old browsers
When a place does not load, the loading screen SHALL say so and show Try again. Without WebGL 2 the page SHALL say so in words. The renderer SHALL start on a chip that allows 256 uniform vectors in a stage. When WebGL 2 is there and the renderer still does not start, the page SHALL name the chip and the error. Without DecompressionStream, which unpacks the places, the page SHALL also say so in words, and SHALL not show Try again.

#### Scenario: A place does not load
- **WHEN** a place's file does not load, and the player presses Space or Enter on the focused Try again
- **THEN** the page asks for the place again, and the place shows when its file loads. Check: e2e `gloam-downs.e2e.mjs` through `?explore`: Try again has the focus, and Space and Enter each ask for the place once more.

#### Scenario: An old browser
- **WHEN** the browser has no WebGL 2, or no DecompressionStream
- **THEN** the page says in words what the browser does not have, and does not show Try again. Check: e2e `gloam-downs.e2e.mjs` through `?explore`.

#### Scenario: A phone graphics chip with few uniforms
- **WHEN** the page opens on a phone whose graphics chip allows 256 uniform vectors in a shader stage, such as an Adreno 840 in Chrome on Android
- **THEN** the renderer starts and draws the place. Each program of the renderer uses 200 or fewer default-block uniform vectors in a stage; the large arrays are in std140 uniform blocks, and each frame is pixel for pixel the same as the frame of the unpatched renderer. Check: Node test `gloam-downs-uniform-blocks.test.mjs`, and with the server, e2e `gloam-downs-uniforms.e2e.mjs`, which counts the vectors of every program and compares each case with Ink Studio's own `resources.mjs`. A check on a real Adreno phone is still needed.

#### Scenario: A renderer that does not start
- **WHEN** WebGL 2 is there but the renderer does not start
- **THEN** the page names the graphics chip, its fragment uniform limit and the error line, so a player can report it.

### Requirement: Size and speed
Each baked world SHALL have no more than 250,000 splats and no more than 48 palette colors. Its download SHALL be no more than 1.5 MB. The page SHALL draw at a small art size that scales up by a whole number. If frames take too long, the page SHALL draw at a smaller art size.

#### Scenario: Budget
- **WHEN** the Node test reads the baked worlds
- **THEN** each one is within the splat, palette and size limits above. Check: Node test `gloam-downs.test.mjs`.

#### Scenario: The camera's draw time
- **WHEN** the page draws the Gaol's start at 1280 by 720 and 390 by 844 at the same art size, with the camera's framing and with stage 1's framing (a 38° field of view, 8.5 or 12.75 m back, pitch 0.34, aim 1.15), drawn in turn in one page
- **THEN** the new framing draws in no more than 1.15 times the time of stage 1's framing (measured 0.72 and 0.85 in the build, and 0.82 and 1.02 at the merge, on a machine shared with other agents). Check: e2e `gloam-downs-camera.e2e.mjs`.

#### Scenario: Walk map layers
- **WHEN** the Node test reads a baked walk map
- **THEN** it holds the three layers that its JSON names: the top, the floor under a gap, and the gap's underside, which is 0 where there is no gap and between the floor and the top where there is one; and it has no crack left to close and no trap in reach

#### Scenario: Walk file that does not match its settings
- **WHEN** the page loads a place whose walk file does not hold the layers that the place's JSON names
- **THEN** the place does not load, and the loading screen shows Try again

### Requirement: Arcade cabinet
Gloam Downs SHALL have its cabinet at the end of the Lab row on the homepage, and its entry in the game switcher (Lab only). It SHALL have its piece in the Corridor after Splat Isle, its card on the Lab page and its dates. Its id SHALL be `gloam-downs`, its title "Gloam Downs" and its route `/lab/gloam-downs/`.

#### Scenario: From the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Gloam Downs cabinet
- **THEN** the marquee shows the whole title, and the piece loads. Check: `node qa/arcade/machines.mjs` with the site served, and the homepage screenshots at 390, 320 and 1280.
