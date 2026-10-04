## ADDED Requirements

### Requirement: The hero is drawn in the comic look
The hero SHALL be drawn with three cel bands and an ink outline that is about 2 px wide on screen at any distance and at least 1.1 cm wide up close. The light SHALL lean toward the camera side, so the hero's back is never a dark shape against the sunset. The hero SHALL always write alpha 1.

#### Scenario: Hero against the sunset, 960x540
- **WHEN** the player looks at the hero from behind with the sun ahead
- **THEN** the jersey shows red cel bands with a violet shade and a warm lit side
- **AND** an ink line runs round the body, also while the hero is posed in a swing

#### Scenario: Hero up close
- **WHEN** the camera comes closer than 1.5 m
- **THEN** the hero dissolves into Ben-Day dots and every pixel that remains is opaque

### Requirement: The objects of the game wear cel bands and ink
The clogs, the Loonies, the pipes, the ball and the King SHALL be drawn with three cel bands, dots fixed in the world, an ink outline twin, and the city's four-step haze toward the painted sky. The rings SHALL be a flat tube in the cel light with an ink line drawn by their own shader, and a disc of dots. They SHALL stay one draw with no twin. The King SHALL have lime-green eyes, as on the key art. They SHALL look heavy-lidded while he sleeps and wide and lit when he wakes.

#### Scenario: A clog on a roof
- **WHEN** the player looks at a clogged toilet from 20 m
- **THEN** the toilet shows flat porcelain bands with a violet shade and an ink line round its shape
- **WHEN** the player flushes the clog
- **THEN** the ink line follows the toilet through the flush

#### Scenario: The King on the Needle
- **WHEN** the King sleeps on the Needle
- **THEN** the King has an ink line and dull green eyes
- **WHEN** twelve flushed clogs wake him
- **THEN** his eyes turn wide and lit, with a ring of dots

### Requirement: Ropes, plungers, launchers and gloves are inked
The ropes, the cups, the launchers and the hand gloves SHALL each have an ink outline twin. The twin of a rope SHALL draw as many segments as the rope.

#### Scenario: Fire a rope
- **WHEN** the player fires a rope at a building
- **THEN** the rope and the cup show an ink line along their full length
- **AND** the ink line follows the rope while it swings and while it is reeled in

### Requirement: Outline twins follow their objects
An outline twin SHALL move, animate, show and hide with the thing it outlines. The game SHALL have at most one twin for each thing, and at most six twins in the game objects.

#### Scenario: Count the twins
- **WHEN** the game objects are listed after the start of play
- **THEN** there are at most six outline twins, each with its own name
- **AND** the twins for the toilets and the Loonies are among them

### Requirement: The HUD and the menus are comic captions
On a flat screen the HUD, the subtitles, the toasts, the pause menu and the map SHALL be caption boxes: cream or yellow, a thick ink border, a hard shadow, a small tilt and Bangers lettering. The wrist HUD and the panels in VR SHALL use the same style. A toast box SHALL fit inside its canvas with its border and its shadow, also when it has two lines. The compass arrow and its ink line SHALL fit inside the compass ring.

#### Scenario: A two-line unlock toast
- **WHEN** an unlock toast runs to two lines
- **THEN** the caption box shows its top border and its bottom border and its shadow

#### Scenario: Compass on the wrist HUD
- **WHEN** the wrist HUD shows the compass
- **THEN** the arrow and its ink line stay inside the ring and the arrow is still easy to read

#### Scenario: The flat HUD at three sizes
- **WHEN** the player plays at 960x540, at 844x390 and at 390x844
- **THEN** the Loonie count, the clog count, the subtitle, the toast and the pause menu stay inside the window at each size
- **AND** the text does not overlap the SWING button on a phone

### Requirement: The opening in mixed reality is inked and ends clean
The pieces of wall that fly out at the burst and the toilet in the room SHALL have ink lines. The ink line of a piece SHALL end before the piece gets thinner than the line. It SHALL not come back. The reveal SHALL not leave black dots.

#### Scenario: The wall bursts
- **WHEN** the wall bursts and the pieces fly
- **THEN** each piece has an ink line
- **WHEN** the pieces shrink at the end of the reveal
- **THEN** the lines end first, and no black dot remains when the last piece is gone

### Requirement: Dots stay in the world
Ben-Day dots on the city and on the objects SHALL be fixed in the world, and not in the screen. The one exception is the fade-out of the hero, whose dots are in screen space. The hero SHALL be drawn only in flat play, which has one view, so the dots cannot cause a different picture in each eye.

#### Scenario: Look in the headset
- **WHEN** the player turns the head in a headset
- **THEN** no dot pattern slides across the surfaces of the city or of the objects

### Requirement: Opaque things write alpha 1
Every opaque surface SHALL write alpha 1, so that passthrough shows only where nothing is drawn.

#### Scenario: Mixed reality
- **WHEN** the city fills the view after the opening
- **THEN** every pixel of the city has alpha 1

### Requirement: The look survives a missing file
If an art file or the hero model does not load, the game SHALL fall back to a built-in look and SHALL not raise an error.

#### Scenario: Art files fail
- **WHEN** the sky strip and the window atlas fail to load
- **THEN** the city shows its built-in banded sky and flat windows, and the page has no shader error

#### Scenario: Hero model fails
- **WHEN** the model of the hero fails to load
- **THEN** the built-in figure is drawn in the same look

### Requirement: The look fits the budget
The look SHALL stay within 120 draw calls and 800,000 triangles per view, ink twins included, at every named camera shot, on the title and in flat play. The art SHALL use 16 textures or fewer.

#### Scenario: Count the draws in flat play
- **WHEN** each named camera shot is drawn in flat play
- **THEN** each shot has 120 draw calls or fewer and 800,000 triangles or fewer
