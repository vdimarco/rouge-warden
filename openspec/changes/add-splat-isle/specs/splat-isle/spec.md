## ADDED Requirements

### Requirement: An island painted with splats on shapes
Splat Isle SHALL build a small island at sunset in the page: a cottage, a lighthouse, trees, rocks, clouds, the sea and a goat. Every object SHALL be written as signed distance shapes, and the page SHALL lay Gaussian splats on their surface as flat brush strokes with the light baked into each one. A loading screen with a progress bar SHALL show while the island is built.

#### Scenario: Open the toy
- **WHEN** a visitor opens `/lab/splat-isle/`
- **THEN** a progress bar shows, and then the island shows with every object, lit by a low sun with soft shadows

### Requirement: Pixel art, with the soft splats underneath
The page SHALL show the island through a pixel pass: a small render, an ordered dither and a palette. The Pixel control and the P key SHALL turn the pass off and on, and the Palette control and the C key SHALL step through Dusk, Meadow and Pocket. With the pass off, the Palette control SHALL be disabled.

#### Scenario: Plain splats
- **WHEN** the visitor presses Pixel
- **THEN** the island shows as soft splats with no pixel grid, and Palette is disabled

### Requirement: Play with the strokes
A tap or a click on a cottage, a lighthouse, a tree, a rock, a cloud or the goat SHALL break it apart: its strokes fly out and fade. After a moment the strokes SHALL pop back onto the same shapes. A drag SHALL turn the view and SHALL NOT break anything. The Goop control SHALL scale every stroke from 0.3 to 3 times its size. The Shapes control and the X key SHALL show the shapes underneath as lines.

#### Scenario: Break and come back
- **WHEN** the visitor taps a tree
- **THEN** the tree's strokes fly apart, the tree is gone for a moment, and then it pops back whole

#### Scenario: Melt
- **WHEN** the visitor slides Goop to 2.4
- **THEN** every stroke grows, and the island looks melted

### Requirement: The goat
The goat SHALL walk a dirt path round the island with its legs swinging, and stop now and then to graze. The Ride the goat control and the G key SHALL put the view on the goat's back, looking ahead along its path, and SHALL take it off again. With reduced motion the goat SHALL stand still and the view SHALL NOT turn by itself.

#### Scenario: Ride
- **WHEN** the visitor presses Ride the goat
- **THEN** the view moves onto the goat's back and moves with it along the path

### Requirement: Controls and layout
The visitor SHALL turn the view by dragging or with the left and right arrow keys, and move in and out with the wheel, a pinch, or the up and down arrow keys. New island and the N key SHALL build another layout. Every control SHALL be at least 44 px on its shorter side and SHALL fit a 390 px wide screen with no sideways scroll.

#### Scenario: Phone
- **WHEN** the toy opens at 390 by 844 on a touch screen
- **THEN** every control is at least 44 px and inside the screen

### Requirement: Arcade cabinet
Splat Isle SHALL have its cabinet at the end of the Lab row on the homepage, its entry in the game switcher (Lab only), its piece in the Corridor after Riftwalk, its card on the Lab page and its dates. Its id SHALL be `splat-isle`, its title "Splat Isle" and its route `/lab/splat-isle/`.

#### Scenario: From the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Splat Isle cabinet
- **THEN** the marquee shows the whole title, and the toy loads
