## ADDED Requirements

### Requirement: Five dark places on rolling hills
Gloam Downs SHALL have five places, in this order: The Sunken Gaol, The Crow Wall, Lantern Fen, The Bell Knoll and Barrow Crown. Each place SHALL be a world of Ink Studio splats on rolling hills, sculpted and baked offline, with its own palette, sky, fog and landmark. The landmark with the beacon SHALL stand on a summit that the player can see from the start point.

#### Scenario: Open the piece
- **WHEN** a visitor opens `/lab/gloam-downs/`
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

#### Scenario: Jump onto a ledge
- **WHEN** the lamplighter jumps at a ledge lower than its jump height
- **THEN** it lands on the ledge. Check: Node test `gloam-downs.test.mjs`: it lands on a ledge of 1.0, ±0.05.

#### Scenario: Low step
- **WHEN** the lamplighter walks at a step of 0.5 or lower
- **THEN** it walks up the step without a jump. Check: Node test `gloam-downs.test.mjs`: it walks up steps of 0.35 to more than 0.9 high.

### Requirement: Look
Q and E, the right stick, a mouse drag or a touch drag on the right half of the screen SHALL turn the camera. The camera SHALL follow behind the lamplighter and come closer when a hill or a wall is between it and the lamplighter. In a run, the combat camera and the boss camera of gloam-downs-run SHALL apply.

#### Scenario: Turn the camera
- **WHEN** the player holds E or drags on the right half of a touch screen
- **THEN** the camera turns around the lamplighter. Check: Node test `gloam-downs.test.mjs`: E held for 1 s turns the yaw by 2.6 rad, ±0.1. The e2e checks that a drag on the right half turns the yaw by more than 0.2 rad.

#### Scenario: Hill in the way
- **WHEN** a hill comes between the camera and the lamplighter
- **THEN** the camera comes closer, so the lamplighter stays in view. Check: Node test `gloam-downs.test.mjs`: with a wall behind the lamplighter, the camera comes in to less than 2 m.

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

### Requirement: Arcade cabinet
Gloam Downs SHALL have its cabinet at the end of the Lab row on the homepage, and its entry in the game switcher (Lab only). It SHALL have its piece in the Corridor after Splat Isle, its card on the Lab page and its dates. Its id SHALL be `gloam-downs`, its title "Gloam Downs" and its route `/lab/gloam-downs/`.

#### Scenario: From the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Gloam Downs cabinet
- **THEN** the marquee shows the whole title, and the piece loads. Check: `node qa/arcade/machines.mjs` with the site served, and the homepage screenshots at 390, 320 and 1280.
