## ADDED Requirements

### Requirement: Five dark places on rolling hills
Gloam Downs SHALL have five places, in this order: The Sunken Gaol, The Crow Wall, Lantern Fen, The Bell Knoll and Barrow Crown. Each place SHALL be a world of Ink Studio splats on rolling hills, sculpted and baked offline, with its own palette, sky, fog and landmark. The landmark with the beacon SHALL stand on a summit that the player can see from the start point.

#### Scenario: Open the piece
- **WHEN** a first-time visitor opens `/lab/gloam-downs/?wander`
- **THEN** a progress bar shows while the world loads. Then The Sunken Gaol shows with the lamplighter at the start point and the summit beacon in view. Check: e2e `gloam-downs.e2e.mjs` through `?wander`: the picture has more than 6 colours.

#### Scenario: Each place is different
- **WHEN** the visitor goes to each of the five places
- **THEN** each one shows its own landmark, palette and sky, and the ground rolls in hills. Check: Node test `gloam-downs.test.mjs`: the five names differ, and so do the first 32 colours of the five palettes.

### Requirement: Gritty and dark
Every place SHALL be at dusk or at night. Most of the screen SHALL be dark: shadowed stone, ground and sky. Fire, lanterns, wisps and the moon SHALL be the brightest pixels. The picture SHALL be pixel art: a small render, scaled up by a whole number and snapped to the palette with dither. It SHALL have dark outlines at depth breaks. Distance fog SHALL fade far hills toward a dark sky color.

#### Scenario: Measure the dark
- **WHEN** the test takes a picture of each place from the start point
- **THEN** the mean luminance of the picture is between 0.05 and 0.32, where 0 is black and 1 is white. Between 0.05% and 12% of its pixels are brighter than 0.55. Check: e2e `gloam-downs.e2e.mjs` through `?wander`.

### Requirement: The lamplighter
The player SHALL be a small original figure: a round hooded lamplighter that carries a lantern. The figure SHALL swing its legs and arms when it walks, lean when it runs and squash when it lands. It SHALL cast a round shadow on the ground under it.

#### Scenario: Walk
- **WHEN** the visitor holds W or the up arrow
- **THEN** the lamplighter walks away from the camera with its legs swinging, and its shadow stays on the ground under it. Check: e2e `gloam-downs.e2e.mjs` through `?wander`: W moves it more than 2 m, away from the camera. The Node test checks that the shadow lies on the floor under the body.

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
On a desktop with a fine pointer, a click on the view SHALL take the mouse with the Pointer Lock API, with raw movement where the browser offers it. That click SHALL do nothing else. While the mouse is taken, a move of the mouse with no button held SHALL turn the view: 0.0022 rad for each pixel across and 0.0018 rad for each pixel down, with no more than 120 px from one event. The pitch SHALL stay between 0.08 and 1.05 rad. No click SHALL turn the view while the mouse is taken.

#### Scenario: Look with the mouse
- **WHEN** the player moves the mouse 100 px right and 50 px down with the mouse taken
- **THEN** the yaw goes down by 0.22 rad and the pitch goes up by 0.09 rad. A spike of 5000 px counts as 120 px. Check: Node test `gloam-downs-mouse.test.mjs`.

### Requirement: The mouse in the explorer
In the explorer, while the mouse is taken, the left button SHALL jump, and a held left button SHALL jump higher, as Space does. The right button SHALL do nothing. Escape, or the browser, SHALL free the mouse, and the walk SHALL go on. A card that opens (the help card, the Map, the end card) SHALL free the mouse, so its buttons can be clicked. A button that goes back to play SHALL take the mouse again.

#### Scenario: Walk takes the mouse, the click that takes it does not jump
- **WHEN** at 1280 by 720 the player clicks Walk on the help card, presses Escape, and then clicks the view twice
- **THEN** Walk takes the mouse, Escape frees it and the hint shows, the first click takes the mouse again with no jump, and the second click jumps more than 0.3 m (measured 1.38 m). Check: e2e `gloam-downs-mouse.e2e.mjs`.

### Requirement: The mouse without pointer lock
Where the browser has no pointer lock, or refuses it, a move with the right button held SHALL turn the view at twice the speed of "Mouse look", and the left button SHALL jump (in a run, attack). The left button SHALL never turn the view. A refusal SHALL keep the page from asking again for 1.5 s, and for 5 s after a second refusal in a row. Meanwhile the mouse SHALL work as without pointer lock.

#### Scenario: No pointer lock
- **WHEN** the browser has no pointer lock, and the player drags with the right button and then with the left button
- **THEN** the right drag turns the view, the left drag does not turn it, and the hint does not show. Check: e2e `gloam-downs-mouse.e2e.mjs` (in a run) and Node test `gloam-downs-mouse.test.mjs` (which button does what in the explorer).

### Requirement: The mouse hint and help
While the mouse is not taken in play, on a desktop that can take it, a small hint "Click to look with the mouse" SHALL show low in the middle of the view. It SHALL hide once the mouse is taken, and SHALL not show over a card or on a touch screen. The help card SHALL say "Click the view to take the mouse. Move the mouse to look round. Left click jumps. Esc frees the mouse." Without pointer lock it SHALL say "Hold the right button and drag the view to look round. Left click jumps."

#### Scenario: The hint
- **WHEN** at 1280 by 720 the explorer's help card shows, and then the player frees the mouse in play with Escape
- **THEN** the help card says how the mouse works, and the hint shows at the bottom middle of the view, clear of the HUD and the tools. It hides when a click takes the mouse. Check: e2e `gloam-downs-mouse.e2e.mjs`, with screenshots of the help card and the hint.

### Requirement: A calm camera
The camera SHALL turn by itself (the swing behind a running lamplighter, the turn out of a blocked lane, and a run's combat and boss cameras) only after 2 s with no look input. It SHALL never turn by itself while the mouse is taken, or while the player holds a move more than 35° from straight ahead or straight back. The swing SHALL ease at 0.5 per second, times the speed up to 5 m/s. With reduced motion it SHALL never turn by itself. R and the Look tool SHALL still turn the view at once.

#### Scenario: The mouse steers
- **WHEN** the lamplighter runs to the side for 5 s with the mouse taken, or runs past an awake foe, or runs into a lane between walls
- **THEN** the yaw does not change by itself. With the mouse free, the swing turns it by more than 0.3 rad. Check: Node test `gloam-downs-mouse.test.mjs`.

#### Scenario: A gentle swing
- **WHEN** the lamplighter runs to the side on touch, keys or a gamepad with no look input, and again while the player holds a move to the side
- **THEN** the swing starts 2 s after the last look input and turns no faster than 0.5 × π/2 rad/s (measured start 2.02 s), and with the move to the side held the view does not turn. Check: Node test `gloam-downs-mouse.test.mjs`.

### Requirement: An eased pull-in
When a wall or a hill brings the camera in, it SHALL come in and go back out eased, with a critically damped spring of about 0.15 s in and 0.25 s out. It SHALL start in early where the view turns toward a wall. Its eye SHALL still never be inside the scenery. Standing still, the view SHALL not move.

#### Scenario: No jump near a wall
- **WHEN** the player turns the view with the mouse at 1.2 rad/s into a 14 m wall 2 m to the side of the lamplighter and back, at 1280 by 720 and 390 by 844
- **THEN** the camera comes in, its distance changes by no more than 1 m in a step, the change from one step to the next is 0.4 m or less, and the eye is never in the wall (measured 0.35 m and 0.09 m at 1280, 0.91 m and 0.28 m at 390; the camera before came in by 3.6 m in one step at 390). Standing still with the back to the wall, beside it, or under a low roof, the view does not move after it settles. Check: Node test `gloam-downs-mouse.test.mjs`.

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
- **THEN** the wisp goes out and the count goes up by one. Check: e2e `gloam-downs.e2e.mjs` through `?wander`: the count shows 1/5, and the toast says "Wisp 1 of 5".

#### Scenario: Beacon
- **WHEN** the lamplighter touches the beacon of The Sunken Gaol in Wander
- **THEN** the beacon lights, a card shows, and then The Crow Wall loads. Check: e2e `gloam-downs.e2e.mjs` through `?wander`: The Crow Wall is in the places reached.

### Requirement: The end of the walk
In Wander, when all five beacons burn, in any order, an end card SHALL show. It SHALL show the time, the wisps found and the best time, with a button to walk again. Walk again SHALL put out every beacon, start the time again at zero and go back to The Sunken Gaol. The places reached SHALL stay open. While a beacon is still dark, the walk SHALL not end. If the beacon of Barrow Crown lights then, a card SHALL say how many beacons are still dark.

#### Scenario: The last beacon
- **WHEN** four beacons burn in Wander and the lamplighter lights the fifth
- **THEN** the end card shows the time, the wisps found and the best time. Check: e2e `gloam-downs.e2e.mjs` through `?wander`: with a walk of 100 s, the best time shows 1:40.

#### Scenario: Walk again
- **WHEN** the player chooses Walk again on the end card in Wander, goes to Barrow Crown on the Map and lights only its beacon
- **THEN** the Map shows all five places open, and a card says that 4 beacons are still dark. No end card shows, and the best time does not change. Check: e2e `gloam-downs.e2e.mjs` through `?wander`.

### Requirement: Map and saved progress
In Wander, the Map control and the M key SHALL show the five places. A place the player has reached SHALL be open, and the others SHALL be locked. The page SHALL save the places reached and the wisps found in the browser, under the explorer's own key. It SHALL check each saved field, so a bad save cannot break the page. The run SHALL keep its own save, under another key.

#### Scenario: Come back
- **WHEN** the visitor reaches The Crow Wall in Wander, reloads the page and opens the Map
- **THEN** the first two places are open and the other three are locked, and the wisps found before are still counted. Check: e2e `gloam-downs.e2e.mjs` through `?wander`.

#### Scenario: Bad save
- **WHEN** the saved data holds wrong types or values
- **THEN** the page ignores the bad fields and starts as normal. Check: Node test `gloam-downs.test.mjs`: the cleaned save has the same fields as a fresh one. The e2e loads a bad save and plays.

### Requirement: Controls and layout
Every touch control SHALL be at least 44 px on its shorter side. The page SHALL fit 390 by 844, 320 by 640 and 1280 by 720 with no sideways scroll. On a touch screen a stick SHALL show where the thumb first touches on the left half of the screen. The page SHALL stop its loop while the game switcher is open or the page is hidden. In a dialog, on the end card and on the loading screen, Space and Enter SHALL press the focused button. In play, Space SHALL jump.

#### Scenario: Phone
- **WHEN** the piece opens at 390 by 844 on a touch screen
- **THEN** the Jump, Map and Look controls are at least 44 px and inside the screen, and so are the Lab bar's ◀ Lab and Games. A drag on the left half moves the lamplighter more than 2 m. Check: e2e `gloam-downs.e2e.mjs` through `?wander`.

### Requirement: Loading and old browsers
When a place does not load, the loading screen SHALL say so and show Try again. Without WebGL 2 the page SHALL say so in words. Without DecompressionStream, which unpacks the places, the page SHALL also say so in words, and SHALL not show Try again.

#### Scenario: A place does not load
- **WHEN** a place's file does not load, and the player presses Space or Enter on the focused Try again
- **THEN** the page asks for the place again, and the place shows when its file loads. Check: e2e `gloam-downs.e2e.mjs` through `?wander`: Try again has the focus, and Space and Enter each ask for the place once more.

#### Scenario: An old browser
- **WHEN** the browser has no WebGL 2, or no DecompressionStream
- **THEN** the page says in words what the browser does not have, and does not show Try again. Check: e2e `gloam-downs.e2e.mjs` through `?wander`.

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
- **THEN** it holds the three layers that its JSON names: the top, the floor under a gap, and the gap's underside, which is 0 where there is no gap and between the floor and the top where there is one; and it has no crack one cell wide left to close

#### Scenario: Walk file that does not match its settings
- **WHEN** the page loads a place whose walk file does not hold the layers that the place's JSON names
- **THEN** the place does not load, and the loading screen shows Try again

### Requirement: Arcade cabinet
Gloam Downs SHALL have its cabinet at the end of the Lab row on the homepage, and its entry in the game switcher (Lab only). It SHALL have its piece in the Corridor after Splat Isle, its card on the Lab page and its dates. Its id SHALL be `gloam-downs`, its title "Gloam Downs" and its route `/lab/gloam-downs/`.

#### Scenario: From the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Gloam Downs cabinet
- **THEN** the marquee shows the whole title, and the piece loads. Check: `node qa/arcade/machines.mjs` with the site served, and the homepage screenshots at 390, 320 and 1280.
