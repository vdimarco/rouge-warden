# splat-isle Specification

## Purpose
A Lab game at `/lab/splat-isle/`, with sound made in the page: five tiny islands written as signed distance shapes, painted in the page with Gaussian splats as brush strokes with the light baked in, and shown through a pixel-art pass. The player keeps Home Isle, sails between the islands, helps one islander after another to relight a dark lighthouse, tends a flower, pulls thorn sprouts and befriends a goat.

## Requirements

### Requirement: An island painted with splats on shapes
Splat Isle SHALL build the island the player stands on in the page, with every object written as signed distance shapes and painted as flat brush strokes with the light baked in: a low sun with a soft shadow, the sky, a cool fill light from the far side, and ambient occlusion. Open ground SHALL carry short upright grass strokes. A loading screen with a progress bar SHALL show while an island is built. The other islands SHALL show on the horizon at their places on the sea.

#### Scenario: Open the game
- **WHEN** a visitor opens `/lab/splat-isle/` with no saved game
- **THEN** a progress bar shows, then Home Isle shows with its cottage, well, lantern-bloom, dock and goat, and the other four islands come up on the horizon

### Requirement: Pixel art, with the soft splats underneath
The page SHALL show the scene through a pixel pass: a small render, a soft dark outline on strong edges, an ordered dither and a palette. In the Look panel, Pixel and the P key SHALL turn the pass off and on, and Palette and the C key SHALL step through Dusk, Meadow and Pocket. With the pass off, Palette SHALL be disabled.

#### Scenario: Plain splats
- **WHEN** the player opens Look and presses Pixel
- **THEN** the scene shows as soft splats with no pixel grid, and Palette is disabled

### Requirement: Play with the strokes
A hit on a breakable thing SHALL crack it, and its last hit SHALL break it apart: its strokes fly out and fade. A thing that comes back at once SHALL pop back onto its shapes after a moment; a thing that comes back at dawn SHALL stay gone until the next dawn; a thing that never comes back SHALL stay gone. A drag SHALL turn the view and SHALL NOT walk or hit. Goop SHALL scale every stroke from 0.3 to 3 times, and Shapes and the X key SHALL show the shapes underneath as lines.

#### Scenario: Break and come back
- **WHEN** the player taps a tree
- **THEN** the keeper walks to it, the tree's strokes fly apart, and the tree pops back whole

#### Scenario: Two hits
- **WHEN** the player hits the old stone wall once with the gardener's leave
- **THEN** the wall shakes and a note says one more hit; the second hit breaks it and gives a stone

### Requirement: The goat
The goat SHALL live on Home Isle, wander and graze with its legs swinging. Each fruit the player feeds it SHALL raise its trust by one, up to five. At three it SHALL follow the keeper; at five Ride and the G key SHALL put the keeper on its back, moving faster. With reduced motion the goat SHALL stand still unless it carries the keeper.

#### Scenario: Ride
- **WHEN** the goat's trust is five and the player presses Ride
- **THEN** the keeper sits on the goat's back and the goat carries them where they walk

### Requirement: Controls and layout
The player SHALL walk by tapping the ground or with WASD or the arrow keys, act by tapping a thing, with Act, or with E, Space or Enter, turn the view by dragging or with Q and R, and zoom with the wheel or a pinch. Every control SHALL be at least 44 px on its shorter side and SHALL fit a 390 px wide screen with no sideways scroll, including the Look panel and the Map.

#### Scenario: Phone
- **WHEN** the game opens at 390 by 844 on a touch screen
- **THEN** Act, Map, Look, the Look panel's controls and the Map's island buttons are at least 44 px and inside the screen

### Requirement: Arcade cabinet
Splat Isle SHALL keep its cabinet at the end of the Lab row, its switcher entry (Lab only), its Corridor piece after Riftwalk, its Lab card and its dates, with subtitles that describe the island game. Its id SHALL be `splat-isle`, its title "Splat Isle" and its route `/lab/splat-isle/`.

#### Scenario: From the homepage
- **WHEN** a player opens the Lab row at 390, 320 or 1280 px wide and starts the Splat Isle cabinet
- **THEN** the marquee shows the whole title, and the game loads

### Requirement: Five islands and sailing
The sea SHALL hold Home Isle, Orchard Isle, Bell Isle, Wreck Isle and Lantern Isle. Map and the M key SHALL list the islands, with the current one disabled and a short note on each other one. Choosing one SHALL show a "Sailing…" card while it is painted, then put the keeper by its dock.

#### Scenario: Sail
- **WHEN** the player opens Map and chooses Lantern Isle
- **THEN** a sailing card shows, then the keeper stands on Lantern Isle by the dock, near the dark lighthouse and its sleeping keeper

### Requirement: Relight the lighthouse
Each islander SHALL need one thing, in a chain: the lamp keeper sleeps until the bell rings; the bell rings only with a clapper; the bellringer makes one from a round stone; the gardener lets the player break the old wall for a stone once the four thornbushes are cleared, and gives three fruit; awake, the lamp keeper needs oil; the fisher trades oil for the net rope hidden in one crate. The goal line SHALL always name the next step. When the lamp keeper gets the oil, the lamp SHALL light, an end card SHALL show, and play SHALL go on.

#### Scenario: The wall before leave
- **WHEN** the player hits the old wall before the gardener agrees
- **THEN** the wall shakes, a note says to ask first, and no stone comes loose

#### Scenario: The light
- **WHEN** the player brings the oil to the lamp keeper
- **THEN** the lamp glows, the end card shows, and at night a beam turns over the sea

### Requirement: Home chores
Home Isle SHALL ask for care. The well SHALL fill the watering can and the can SHALL water the lantern-bloom once a day; a day with no water SHALL dim the flower. Each dawn two thorn sprouts SHALL come up on Home Isle (up to seven); a sprout left two days SHALL grow into a thorn tree that takes three hits. The HUD SHALL list the day's chores.

#### Scenario: A new day
- **WHEN** the day ends
- **THEN** the day count goes up, new thorn sprouts stand on Home Isle, broken pots and crates that come back at dawn are whole, and a note says whether the flower needs water

### Requirement: Day and night
A day SHALL last four minutes. The sky and the islands SHALL turn from day to a rose dusk to a blue night with stars and back to dawn. Lamps, windows, crystals, the lantern-bloom and the keeper's lantern SHALL keep their glow at night; the lighthouse lamp SHALL stay dark until it is lit.

#### Scenario: Night
- **WHEN** night falls
- **THEN** the islands dim and turn blue, stars show, and the cottage windows and the flower still glow

### Requirement: Things to find and break
The islands SHALL hold crates, barrels, clay pots, thornbushes, thorn trees, thorn sprouts, the old stone wall, crystals, mushrooms, fences, statues and hay bales to break, as well as trees and rocks. Seven shells SHALL hide in them; the HUD SHALL count the shells found. A fruit tree SHALL drop one fruit a day when hit.

#### Scenario: A shell
- **WHEN** the player breaks the pot on Home Isle
- **THEN** a note says a shell was found, and the HUD shows 1 of 7 shells

### Requirement: Saved game
The game SHALL save in the browser: the island, the day and time, what the keeper carries, the story, what is broken, the sprouts, the flower and the goat. Opening the page again SHALL load it with no opening words. The page SHALL check a save read back from the browser field by field and keep only known fields with the expected types and ranges, because every arcade page shares one origin and one storage. A save that names an unknown island, holds the wrong types, or holds markup SHALL still load a working game, and its text SHALL never be read as markup. New game in the Look panel SHALL ask once more before it wipes the save.

#### Scenario: Come back
- **WHEN** the player reloads the page after the lamp is lit
- **THEN** the game opens on the same island and day, with the lamp lit

#### Scenario: A broken or hostile save
- **WHEN** the stored save names an island that does not exist and puts an HTML tag in the shell count
- **THEN** the game opens on Home Isle, the HUD shows 0 of 7 shells as plain text, and no markup or script from the save runs

### Requirement: Sound
Splat Isle SHALL make its sound in the browser, with no sound files: the sea and the wind under everything, crickets at night, slow soft notes in each island's own key, steps, a knock for each hit by what the thing is made of, a burst when a thing breaks and a glide when it pops back, a chime for each thing found, blips under each line a person says, the bell, the well, the flower, the goat, sailing, the lamp lit and dawn. The sound SHALL start on the player's first press. The Sound button SHALL turn it off and on and SHALL share the arcade's one sound switch. The sound SHALL go silent while the page is hidden.

#### Scenario: First press
- **WHEN** a player opens the game and taps the opening words
- **THEN** the sea and the wind start, quietly

#### Scenario: Sound off
- **WHEN** the player presses Sound
- **THEN** the game goes silent and the button shows Sound as off, and the next arcade game also opens with its sound off
