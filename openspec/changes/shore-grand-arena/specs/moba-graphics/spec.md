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

#### Scenario: Read a protected tower
- **WHEN** the player approaches a tower that is still protected
- **THEN** its label and ward show that it is protected and why.

### Requirement: 2D fallback and graphics choice
When WebGL2 is not available, or when the address has `?renderer=2d`, the game SHALL use the painted 2D renderer with the same controls,
camera behaviour, minimap and HUD. The pause menu SHALL let the player switch between 3D and 2D, and the choice SHALL be remembered.

#### Scenario: Play without WebGL2
- **WHEN** the browser cannot create a WebGL2 context
- **THEN** the match starts in the 2D view and remains fully playable.

### Requirement: 3D performance
The 3D view SHALL keep a smooth frame rate on a mid-range desktop GPU at 1440x900 and on a 3440x1440 ultra-wide screen. It SHALL lower its
render resolution when frames are slow, by the same rule the 2D renderer uses, and raise it again when frames recover. Models SHALL load in the
background; a hero whose model is still loading SHALL show a placeholder and the match SHALL not wait for it.

#### Scenario: Slow frames on a wide screen
- **WHEN** frames are slower than the screen's refresh rate for more than a moment
- **THEN** the render resolution steps down until frames keep up, and it steps back up after they recover.
