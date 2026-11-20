## ADDED Requirements

### Requirement: Five dark places on rolling hills
Gloam Downs SHALL have five places, in this order: The Sunken Gaol, Crow Ramparts, Lantern Fen, The Bell Knoll and Barrow Crown. Each place SHALL be a world of Ink Studio splats on rolling hills, sculpted and baked offline, with its own palette, sky, fog and landmark. The landmark with the beacon SHALL stand on a summit that the player can see from the start point.

#### Scenario: Open the piece
- **WHEN** a visitor opens `/lab/gloam-downs/`
- **THEN** a progress bar shows while the world loads, and then The Sunken Gaol shows with the lamplighter at the start point and the summit beacon in view

#### Scenario: Each place is different
- **WHEN** the visitor goes to each of the five places
- **THEN** each one shows its own landmark, palette and sky, and the ground rolls in hills

### Requirement: Gritty and dark
Every place SHALL be at dusk or at night. Most of the screen SHALL be dark: shadowed stone, ground and sky. Fire, lanterns, wisps and the moon SHALL be the brightest pixels. The picture SHALL be pixel art: a small render scaled up by a whole number, snapped to the palette with dither, and drawn with dark outlines at depth breaks. Distance fog SHALL fade far hills toward a dark sky color.

#### Scenario: Measure the dark
- **WHEN** the test takes a picture of each place from the start point
- **THEN** the mean luminance of the picture is between 0.05 and 0.32 (0 is black, 1 is white), and between 0.05% and 12% of its pixels are brighter than 0.55

### Requirement: The lamplighter
The player SHALL be a small original figure: a round hooded lamplighter that carries a lantern. The figure SHALL swing its legs and arms when it walks, lean when it runs, squash when it lands, and cast a round shadow on the ground under it.

#### Scenario: Walk
- **WHEN** the visitor holds W or the up arrow
- **THEN** the lamplighter walks away from the camera with its legs swinging, and its shadow stays on the ground under it

### Requirement: Move and jump
The player SHALL move relative to the camera with WASD, the arrow keys, the left stick of a gamepad or the touch stick. Shift SHALL walk slowly. Space, the gamepad A button or the touch Jump button SHALL jump. The lamplighter SHALL stand on the ground, climb low steps, stop at walls and steep slopes, and fall off ledges.

#### Scenario: Wall
- **WHEN** the lamplighter walks into a wall higher than its jump
- **THEN** it stops at the wall and does not go into it

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

#### Scenario: Jump onto a ledge
- **WHEN** the lamplighter jumps at a ledge lower than its jump height
- **THEN** it lands on the ledge

#### Scenario: Low step
- **WHEN** the lamplighter walks at a step of 0.5 or lower
- **THEN** it walks up the step without a jump

### Requirement: Look
Q and E, the right stick, a mouse drag or a touch drag on the right half of the screen SHALL turn the camera. The camera SHALL follow behind the lamplighter and come closer when a hill or a wall is between it and the lamplighter.

#### Scenario: Turn the camera
- **WHEN** the player holds E or drags on the right half of a touch screen
- **THEN** the camera turns around the lamplighter

#### Scenario: Hill in the way
- **WHEN** a hill comes between the camera and the lamplighter
- **THEN** the camera comes closer, so the lamplighter stays in view

#### Scenario: Back to a wall
- **WHEN** the lamplighter stands with its back to a wall or a cliff
- **THEN** the camera's eye stays in front of the wall, and the view tilts down from above when the wall is too close to frame the lamplighter

### Requirement: Wisps and the beacon
Each place SHALL have five wisps: glowing motes that float above the ground. A wisp SHALL go out and count when the lamplighter touches it. Each place SHALL have one beacon on its summit. When the lamplighter touches the beacon, the beacon SHALL light, a card SHALL say that the way opens, and the next place SHALL load. After Barrow Crown, an end card SHALL show the time and the wisps found, with a button to walk again.

#### Scenario: Wisp
- **WHEN** the lamplighter touches a wisp
- **THEN** the wisp goes out and the count goes up by one

#### Scenario: Beacon
- **WHEN** the lamplighter touches the beacon of The Sunken Gaol
- **THEN** the beacon lights, a card shows, and then Crow Ramparts loads

### Requirement: Map and saved progress
The Map control and the M key SHALL show the five places. A place the player has reached SHALL be open, and the others SHALL be locked. The page SHALL save the places reached and the wisps found in the browser, and SHALL check each saved field, so a bad save cannot break the page.

#### Scenario: Come back
- **WHEN** the visitor reaches Lantern Fen, reloads the page and opens the Map
- **THEN** the first three places are open, and the wisps found before are still counted

#### Scenario: Bad save
- **WHEN** the saved data holds wrong types or values
- **THEN** the page ignores the bad fields and starts as normal

### Requirement: Controls and layout
Every touch control SHALL be at least 44 px on its shorter side. The page SHALL fit 390 by 844, 320 by 640 and 1280 by 720 with no sideways scroll. On a touch screen a stick SHALL show where the thumb first touches on the left half of the screen. The page SHALL stop its loop while the game switcher is open or the page is hidden. Without WebGL 2 the page SHALL say so in words.

#### Scenario: Phone
- **WHEN** the piece opens at 390 by 844 on a touch screen
- **THEN** the Jump, Map and Look controls are at least 44 px and inside the screen, and a drag on the left half moves the lamplighter

### Requirement: Size and speed
Each baked world SHALL have no more than 260,000 splats and no more than 48 palette colors, and its download SHALL be no more than 1.5 MB. The page SHALL draw at a small art size that scales up by a whole number. If frames take too long, the page SHALL draw at a smaller art size.

#### Scenario: Budget
- **WHEN** the Node test reads the baked worlds
- **THEN** each one is within the splat, palette and size limits above

### Requirement: Arcade cabinet
Gloam Downs SHALL have its cabinet at the end of the Lab row on the homepage, its entry in the game switcher (Lab only), its piece in the Corridor after Splat Isle, its card on the Lab page and its dates. Its id SHALL be `gloam-downs`, its title "Gloam Downs" and its route `/lab/gloam-downs/`.

#### Scenario: From the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Gloam Downs cabinet
- **THEN** the marquee shows the whole title, and the piece loads
