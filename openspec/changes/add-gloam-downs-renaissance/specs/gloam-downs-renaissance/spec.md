## ADDED Requirements

### Requirement: Three otherworldly places
The explorer of Gloam Downs SHALL have a second set of three places, the Gilt Lattice, in this order: The Vanishing Piazza (`piazza`), The Broken Cupola (`cupola`) and The Orrery Isles (`orrery`). Each place SHALL be baked offline with Ink Studio and drawn as the five places are. Each SHALL have one start, five wisps, one beacon 2 m or more over the start, and a summit landmark that the start can see.

#### Scenario: The landmark from the start
- **WHEN** a Lattice place loads at its start
- **THEN** the player sees the summit landmark in the first picture: the round temple with its wire dome in the Piazza, the lantern on the dome in the Cupola, and the armillary sphere in the Isles. Check: the `start` preview of `bake.mjs <id> --check --preview`, looked at and noted in the build notes.

#### Scenario: The bake check
- **WHEN** the builder runs `node games/gloam-downs/bake.mjs piazza --check` (and `cupola`, `orrery`)
- **THEN** every line prints `ok`: 250,000 splats or fewer, 1.5 MB or less for the three files, the start on the ground, the beacon and each wisp in reach, no trap, the beacon over the start, and the dark rule. The command exits with 0.

### Requirement: Digital Renaissance look
The three places SHALL mix Renaissance form (domes, arcades, ideal-city perspective, coffers, marble, gold leaf, sfumato skies, polyhedra, an armillary sphere) with digital form (grids to a vanishing point, wireframe solids, voxel breakup, floating fragments, impossible scale), at dusk or at night. No place SHALL copy a named artwork, building, game or artist's piece.

#### Scenario: The forms in each place
- **WHEN** the builder looks at the four previews of each Lattice place
- **THEN** each shows at least two Renaissance forms and two digital forms from the list above. Check: the build notes name them for each place.

### Requirement: One set, three colours
The three places SHALL share one gold ramp. Each place SHALL have one digital colour that the other two do not use: cyan blue in the Piazza, magenta in the Cupola and amber in the Isles.

#### Scenario: Each place is different
- **WHEN** the Node test reads the eight baked palettes
- **THEN** the first 32 colours of each Lattice place differ from those of each other place, the five included. Check: Node test `gloam-downs-lattice.test.mjs`.

#### Scenario: The set reads as one
- **WHEN** the builder looks at the `wide` previews of the three places side by side
- **THEN** each shows marble and gold, a lit digital colour, and a form that breaks into blocks at its edge. Check: the previews in the pull request, with a line for each in the build notes.

### Requirement: Dark, with light that reads
From the start, the picture of each Lattice place SHALL have a mean luminance between 0.05 and 0.32. Between 0.05% and 12% of its pixels SHALL be over 0.55. No own colour of a Lattice place SHALL be within an RGB distance of 60 of the two brightest wisp colours. Every colour of the place's digital ramp SHALL have a luminance under 0.55, so that fire, lamps, wisps, the sun and the moon stay the brightest things.

#### Scenario: Measure the picture
- **WHEN** `bake.mjs <id> --check` draws the start picture of a Lattice place
- **THEN** it prints `ok` for the mean luminance and for the bright pixels

#### Scenario: Wisps stand out
- **WHEN** the player looks at a wisp in a Lattice place
- **THEN** the wisp is the only mint glow in the picture. Check: `--check` prints `ok` for the wisp colour rule and the digital line rule.

### Requirement: Walk the Lattice
In each Lattice place the player SHALL walk from the start to the beacon with the controls of the five places. Every wisp and the beacon SHALL be in reach on foot. A fall to a lower floor SHALL never trap the player: every low floor has steps, a ramp or a stair back up.

#### Scenario: Climb to the beacon
- **WHEN** the player walks the way the design gives in a Lattice place
- **THEN** the lamplighter gets to the beacon, and touching it lights it. Check: `--check` reach lines, and the browser check lights each beacon.

#### Scenario: Fall off an isle
- **WHEN** the lamplighter drops from an isle of The Orrery Isles to the grid sea
- **THEN** a stair on the grid sea takes it back up to an isle. Check: `--check` prints `ok` for no trap.

#### Scenario: Every flight of steps
- **WHEN** `node qa/lab/gloam-downs-stairs.test.mjs piazza cupola orrery` runs
- **THEN** the controller walks each flight listed in the three places' JSON with no stop stuck

### Requirement: The Lattice on the Map
In the explorer, the Map SHALL show two groups with headings: "The downs" with the five places (I to V), and "The Gilt Lattice" with the three places (I to III). The first Lattice place SHALL be open from the start. A Lattice place after the first SHALL be open when the beacon of the Lattice place before it is lit. A locked row SHALL say "Light the beacon before it". The line under the Map's title SHALL count the wisps of each set: "Wisps: n of 25 on the downs, m of 15 in the Lattice."

#### Scenario: A first visit
- **WHEN** a first-time visitor opens the Map
- **THEN** The Sunken Gaol and The Vanishing Piazza are open, and the other six places are locked. Check: Node test `mapGroups(fresh())`, and the browser check.

#### Scenario: Go to the Lattice
- **WHEN** the player chooses The Vanishing Piazza on the Map
- **THEN** the Piazza loads, and its arrival card says "I · The Gilt Lattice", "The Vanishing Piazza" and its subtitle. Check: browser check.

#### Scenario: Keys and gamepad on the Map
- **WHEN** the Map is open and the player presses Tab, the d-pad or the arrows
- **THEN** the focus goes through the open rows of the downs, then the open rows of the Lattice, then Close, and wraps. Space, Enter or A opens the focused place. Check: browser check.

### Requirement: Lattice beacons
In a Lattice place, a lit beacon SHALL open the next Lattice place, and a card SHALL say "The way opens to <name>". Then that place SHALL load. The beacon of The Orrery Isles SHALL say "Every beacon of the Lattice burns", and the player SHALL stay. A Lattice beacon SHALL not open a place of the downs, SHALL not show the end card of the downs, and SHALL not change the downs' time, best time or count of walks.

#### Scenario: Light the Piazza's beacon
- **WHEN** the lamplighter touches the beacon of The Vanishing Piazza
- **THEN** the beacon lights, a card says "The way opens to The Broken Cupola", and the Cupola loads. The Map then shows the Cupola open. Check: browser check.

#### Scenario: The last Lattice beacon
- **WHEN** the lamplighter lights the beacon of The Orrery Isles while the five beacons of the downs burn
- **THEN** a card says "Every beacon of the Lattice burns". No end card shows. Check: browser check.

#### Scenario: Walk again keeps the Lattice
- **WHEN** the player chooses Walk again on the end card of the downs
- **THEN** the five beacons of the downs go out, and the Lattice beacons stay lit, so the Lattice places stay open. Check: Node test on the save, and the browser check.

### Requirement: The Lattice in the save
The explorer's save SHALL keep the Lattice's wisps and lit beacons, and the Lattice place where the player is, under the explorer's own key. The save SHALL keep its fields. A bad save SHALL not break the page. The walk time of the downs SHALL count only in the five places of the downs.

#### Scenario: Come back to the Lattice
- **WHEN** the player lights the Piazza's beacon, takes two wisps in the Cupola, and reloads the page
- **THEN** the Cupola loads, its HUD shows ◆ 2/5, and the Map shows the Piazza's beacon lit. Check: browser check.

#### Scenario: Bad Lattice save
- **WHEN** the saved data has `lit: { cupola: true }` with the Piazza dark, `wisps: { orrery: [0, 9, 'a'] }` and `at: 'orrery'`
- **THEN** the cleaned save has no lit Cupola, the Isles' wisps are `[0]`, and `at` is the Gaol. Its fields are those of a fresh save. Check: Node test `gloam-downs-lattice.test.mjs`.

### Requirement: Open a Lattice place by address
`/lab/gloam-downs/?place=<id>` SHALL load a Lattice place when it is open. When it is locked, the page SHALL load the place where the player was.

#### Scenario: Address of an open place
- **WHEN** a first-time visitor opens `/lab/gloam-downs/?place=piazza`
- **THEN** The Vanishing Piazza loads. Check: browser check.

#### Scenario: Address of a locked place
- **WHEN** a first-time visitor opens `/lab/gloam-downs/?place=orrery`
- **THEN** The Sunken Gaol loads. Check: browser check.

### Requirement: Map layouts
The Map SHALL fit 1280 by 720, 390 by 844 and 320 by 640 with no sideways scroll. At 1280 by 720 the two groups SHALL stand side by side. At 390 by 844 and 320 by 640 they SHALL stand one over the other. At each of the three sizes, every row and the Close button SHALL be inside the screen with the box not scrolled, and SHALL be at least 44 px on its shorter side.

#### Scenario: Desktop
- **WHEN** the Map opens at 1280 by 720
- **THEN** "The downs" is on the left and "The Gilt Lattice" on the right, and all eight rows and Close show. Check: browser check `gloam-downs-lattice.e2e.mjs`, with a screenshot.

#### Scenario: Phone
- **WHEN** the Map opens at 390 by 844 on a touch screen
- **THEN** the downs are over the Lattice, every row and Close is inside the screen and 44 px or more, and a tap on The Vanishing Piazza loads it. Check: browser check, with a screenshot.

#### Scenario: Small phone
- **WHEN** the Map opens at 320 by 640
- **THEN** every row and Close is inside the screen with the box not scrolled, each row shows its numeral, name, wisps and beacon state, and no text is cut. Check: browser check, with a screenshot.

### Requirement: The run does not change
The combat run (`?run`) SHALL not have the Lattice places. Its order, its pause panel's places, its music, its zones and its save SHALL stay as they were. The five places' baked files SHALL not change.

#### Scenario: The run's places
- **WHEN** the player opens `/lab/gloam-downs/?run` and pauses
- **THEN** the pause panel lists the five places only. Check: the run's checks (`gloam-downs-run.test.mjs` and `gloam-downs-run.cards.e2e.mjs`) pass unchanged.

#### Scenario: The five places' files
- **WHEN** the Lattice places are baked
- **THEN** `git status` shows no change to the five places' `.bin.gz`, `.walk.bin.gz` and `.json` files
