## ADDED Requirements

### Requirement: Mythic 3D battlefield
When the browser supports WebGL2, the battlefield SHALL render in 3D with three.js: a perspective camera about 55 degrees down that follows the
hero, a warm low sun with soft shadows, a cool sky fill, an environment reflection for metal and a light horizon haze. The ground SHALL show
grass, dirt lane paths, stone base plazas, sand banks and animated river water. Each realm SHALL have its own mood and the change between
realms SHALL blend over about one second. The scene SHALL use natural, muted colours with restrained team accents, not flat cartoon colour.

#### Scenario: Start a match in 3D
- **WHEN** the player starts a match in a browser with WebGL2
- **THEN** the hero, minions, towers, cores, camps, scenery and river appear as lit 3D models with shadows, and the camera follows the hero
  as in the 2D view, including the mouse push toward the screen edge.

#### Scenario: Realm shift
- **WHEN** the realm shifts
- **THEN** the light, sky and scenery mood change over about one second while units and controls stay usable.

### Requirement: Animated 3D heroes and units
Each of the sixteen hero identities SHALL appear as its own rigged 3D model with its weapon in hand. Heroes SHALL show idle, run, attack, cast,
hit and death motions, with the attack's strike timed to the moment the damage lands. Lane soldiers SHALL be animated 3D models tinted by team.
Towers SHALL differ by tier, guardians and cores SHALL be larger, and camps and the Wild Hunt SHALL be 3D creatures. No 2D sprite SHALL appear
inside the 3D world.

#### Scenario: Watch an attack land
- **WHEN** a hero attacks a target
- **THEN** the hero plays its attack motion and the hit feedback appears when the weapon strikes, not before.

#### Scenario: A hero dies
- **WHEN** a hero's health reaches zero
- **THEN** it plays a death motion, stays down briefly and fades, and it appears again at respawn.

### Requirement: Readable 3D combat information
Ground telegraphs, aim previews, zones and traps SHALL appear as shapes on the 3D ground with the same meaning and timing as in 2D. Health and
mana bars, names, tower state, status badges, damage numbers and result labels SHALL stay in screen space above their units and stay readable
over a bright scene. Enemy units outside the player's team vision SHALL stay hidden.

#### Scenario: Dodge a warned spell
- **WHEN** an enemy prepares a warned spell
- **THEN** its area shows on the ground with a filling progress mark, and moving out of it before the fill completes avoids the hit.

#### Scenario: A tower locks on in 3D
- **WHEN** an enemy tower switches its fire to the player's hero in the 3D view
- **THEN** a red beam joins the tower and the hero and grows until the first shot, and TOWER LOCK shows over the hero.

#### Scenario: Read a protected tower
- **WHEN** the player approaches a tower that is still protected
- **THEN** its label and ward show that it is protected and why.

### Requirement: 2D fallback and graphics choice
When WebGL2 is not available, when the browser draws WebGL in software without a graphics card, or when the address has `?renderer=2d`,
the game SHALL use the painted 2D renderer with the same controls, camera behaviour, minimap and HUD. `?renderer=3d` SHALL force the 3D view.
The pause menu and the game settings SHALL let the player switch between 3D and 2D during play, and the choice SHALL be remembered.

#### Scenario: Play without WebGL2
- **WHEN** the browser cannot create a WebGL2 context
- **THEN** the match starts in the 2D view and remains fully playable.

#### Scenario: Play on a browser that draws in software
- **WHEN** WebGL2 works only through a software renderer
- **THEN** the match starts in the 2D view, and the Graphics choice can still switch it to 3D.

#### Scenario: Switch the view during a match
- **WHEN** the player changes Graphics from 3D to 2D in the pause menu and resumes
- **THEN** the same match continues in the 2D view with the same controls, and the next match starts in 2D.

### Requirement: 3D performance
The 3D view SHALL keep a smooth frame rate on a mid-range desktop GPU at 1440x900 and on a 3440x1440 ultra-wide screen. It SHALL lower its
render resolution when frames are slow, by the same rule the 2D renderer uses, and raise it again when frames recover. World models and
animations SHALL load before the Play button is ready, and the button SHALL show the progress. Hero models SHALL load in the background; a
hero whose model is still loading SHALL show a stand-in and the match SHALL not wait for it.

#### Scenario: Slow frames on a wide screen
- **WHEN** frames are slower than the screen's refresh rate for more than a moment
- **THEN** the render resolution steps down until frames keep up, and it steps back up after they recover.

### Requirement: Natural trees and grass in 3D
The 3D battlefield SHALL draw trees, shrubs and grass as leafy shapes in natural greens with some autumn colour, not
as flat cut-outs or brown sheets.

#### Scenario: Look at a grove
- **WHEN** the player sees a grove in the town realm
- **THEN** broadleaf crowns show many leaves in mostly green tones, some gold or amber, never one flat brown
- **AND** pines show drooping tiers of needles around a trunk
- **AND** the crowns move a little in the wind unless reduced motion is on

#### Scenario: Open grass
- **WHEN** the view shows open grass
- **THEN** small grass tufts grow in patches on it
- **AND** no tuft stands on a lane, a plaza, a river bank or in the water

### Requirement: Units stay visible behind scenery and structures
The 3D battlefield SHALL thin any tree, rock, wall, tower, guardian or core that stands between the camera and a
hero, and the same for a soldier, camp beast or summon near the pointer.

#### Scenario: A fight beside the guardians
- **WHEN** an enemy hero stands behind a guardian as seen from the camera
- **THEN** the part of the guardian in front of the hero thins out so the hero and its outline show through
- **AND** the guardian is drawn normally everywhere else

#### Scenario: Point at a soldier behind a tree
- **WHEN** the player moves the pointer over a soldier behind a tree crown
- **THEN** the crown thins out around that soldier

### Requirement: Clear heroes and warnings
The 3D battlefield SHALL give every hero a thin team-coloured outline and SHALL draw ground warnings with a dark edge
that reads on bright grass and in the woods.

#### Scenario: Tell teams apart in a crowd
- **WHEN** allied and enemy heroes fight in one place
- **THEN** allies have a teal outline, enemies a crimson outline and the player's hero a gold outline

#### Scenario: Dodge a warned spell in either realm
- **WHEN** an enemy starts a cast with a ground warning, in the town or in the woods
- **THEN** the warning is red-orange with a dark outline
- **AND** its fill grows stronger until the hit

#### Scenario: A warned third strike
- **WHEN** an enemy hero warns its third basic strike
- **THEN** a pulsing outlined ring shows the reach to leave, with a line to its target

### Requirement: Crystals read as cut crystal
In the 3D view, tower, guardian and core crystals SHALL read as faceted magical crystal in their team colour (enemy crimson, ally teal). Each crystal SHALL show:
- visible facets of different brightness;
- a brighter heart that fades to darker edges;
- a light rim on its outline;
- small glints where a facet faces the sun;
- a slow shimmer;
- a soft halo that does not cover the facets.

No crystal area SHALL clip to flat white, in either realm. The check reads a box inside the enemy core crystal from the WebGL canvas in qa/tidebreak/render3d.e2e.mjs: luminance standard deviation above 18, under 30% of pixels within 3% of the most common colour, under 0.5% near-white pixels, and a crimson mean.

#### Scenario: Look at the enemy core
- **WHEN** the camera shows the enemy core and guardians in the town realm at golden hour
- **THEN** each crystal shows facets of different brightness, a bright heart and darker edges
- **AND** the crystals stay crimson, and no crystal area is flat white or pale blue
- **AND** the glow shows as a halo around the crystal, not over it

#### Scenario: Look at the allied base
- **WHEN** the camera shows the allied core and guardians
- **THEN** their crystals are faceted teal with the same depth, and no area is flat white

#### Scenario: Reduced motion
- **WHEN** the player asks for reduced motion
- **THEN** the crystal shimmer does not move

### Requirement: Elemental spell effects
Each hero's spells SHALL show the hero's element (water, fire, void, stone, wind or light) with its own particles,
ground mark and light.

#### Scenario: Water and stone spells land
- **WHEN** a water hero's spell and a stone hero's spell land in view
- **THEN** the water spell throws droplets and mist and leaves rippling rings
- **AND** the stone spell throws rock chips and dust and cracks the ground

#### Scenario: A big impact with reduced motion
- **WHEN** an ultimate lands near the player and reduced motion is on
- **THEN** the effect shows without the short screen glow

### Requirement: Windup and death motion in 3D
A 3D hero SHALL lean back while its cast warning fills and SHALL burn away cleanly when it dies.

#### Scenario: An enemy winds up
- **WHEN** an enemy hero starts a cast with a warning
- **THEN** it leans back until the release, then strikes
- **AND** before an engage it crouches forward instead

#### Scenario: A hero dies
- **WHEN** a hero dies in 3D
- **THEN** it plays its death motion
- **AND** it then burns away from the head down with a glowing edge and no dot pattern
- **AND** its shadow goes with it

### Requirement: Bright hero select portraits
The full-length hero portraits on the hero select SHALL be lit brighter and warmer than the card busts, so dark armour
reads against the bright stage art.

#### Scenario: Choose a dark-armoured hero
- **WHEN** the player selects Tidewarden or Voidcaller
- **THEN** the full-length portrait shows the armour and robe detail in warm light with a clear rim
- **AND** the card busts keep their dark warm style

### Requirement: 3D arena behind the hero select
When the battlefield renderer is 3D, the hero select SHALL draw the live arena behind the menu. A low cinematic camera (15° pitch, 30° lens, slow sway) SHALL frame the selected hero's model, playing its idle, in the stage area where the portrait stands, lit by the golden sun with only a faint team rim light. The roster, the skill panel, Play and keyboard focus SHALL stay readable and usable over the scene. The painted stage and portrait SHALL show in the 2D view, in the default 2D view of software rendering, until the first hero model is ready, when the selected model fails to load, and when the WebGL context is lost. The arena SHALL draw at most 30 frames a second, and a slow frame SHALL wait twice its own time (at most 2 s) before the next one. It SHALL NOT draw while the tab is hidden, SHALL stop when the draft or a match starts, and SHALL never start the match clock. qa/tidebreak/hero-select-3d.e2e.mjs checks this in SwiftShader.

#### Scenario: See the selected hero in the arena
- **WHEN** the player opens the hero select in the 3D view and the selected hero's model has loaded
- **THEN** the painted stage and portrait step aside, and the hero's 3D model stands in the arena where the portrait stood, at 1440x900, 3440x1440, 390x844, 844x390 and 320x568.

#### Scenario: Choose another hero
- **WHEN** the player clicks another hero card or moves to it with the arrow keys
- **THEN** the arena keeps showing the previous hero until the new model is ready, then shows the new hero with a short ring in the hero's colour (no ring with reduced motion), and the painted stage does not come back in between.

#### Scenario: Keep the menu cheap and usable
- **WHEN** the hero select is open in the 3D view
- **THEN** the arena draws at most 30 frames a second, a slow frame waits twice its own time before the next one, nothing draws while the tab is hidden, and the roster cards, skill previews and Play take clicks above the scene.

#### Scenario: Lost graphics context
- **WHEN** the WebGL context is lost while the hero select is open
- **THEN** the painted stage and portrait come back until the context returns.

#### Scenario: Reduced motion
- **WHEN** the player prefers reduced motion
- **THEN** the arena camera holds still.

#### Scenario: Start the draft
- **WHEN** the player presses Play
- **THEN** the arena stops drawing during the draft, and the match draws with the gameplay camera.

#### Scenario: 2D view
- **WHEN** the renderer is 2D (?renderer=2d, no WebGL2, or the software-rendering default)
- **THEN** the hero select shows the painted stage and the full-length portrait.
