## ADDED Requirements

### Requirement: The title
The title SHALL show a velocity line, AHEAD OF THE LIGHT in ascii.rest's block letters with LIGHT in the spectrum, a
rainbow rule, a short brief, a menu (FLY, SOUND, SWITCH GAME), the controls for the input in use, the best run and a
link back to the arcade, over a bot flying the starbow. It SHALL fit the window with the logo whole.

#### Scenario: Open the game
- **WHEN** a player opens `/ahead-of-the-light/` at 1280 × 800, 800 × 600, 390 × 844, 320 × 568 or 844 × 390
- **THEN** the title fits, the logo is whole, and every button is 44 px tall
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

#### Scenario: Fly
- **WHEN** the player taps FLY or presses Enter or Space
- **THEN** a run starts with the ship already flying, drawn on a character grid that fits the window
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

### Requirement: Flying through the stars
The player SHALL steer across and up and down with A D W S, the arrows, a drag or a gamepad's stick, inside a tube of
stars. A star in the ship's path SHALL hit it; a pass within 1.8 m of a star's edge SHALL add charge. Every slice of
the tube SHALL keep a way through.

#### Scenario: Steer
- **WHEN** the player holds D, or drags right on a touch screen
- **THEN** the ship moves right within half a second
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

#### Scenario: A way through
- **WHEN** any slice of the tube on any seed is checked
- **THEN** some point in it is clear of every star by more than the ship
- **CHECK** `qa/ahead-of-the-light/world.test.mjs`

#### Scenario: A hit and a skim
- **WHEN** the ship flies into a star, then past one close
- **THEN** the hit takes shield before hull and slows the ship, and the close pass adds charge
- **CHECK** `qa/ahead-of-the-light/flight.test.mjs`

### Requirement: The light behind you
The burst's light SHALL start 520 m behind. For the first 1.2 km it SHALL only keep pace with the ship's cruise, so a
new pilot can learn; over the next 3.6 km it SHALL become faster than the cruise, and when far behind it SHALL close
faster. When it reaches the ship the run SHALL end with THE LIGHT CAUGHT YOU. The HUD SHALL show the gap as a meter
from BURST to YOU, and the frame's edges SHALL whiten as it closes.

#### Scenario: A calm start
- **WHEN** a pilot cruises the first kilometre without rings or boost
- **THEN** the gap stays open
- **CHECK** `qa/ahead-of-the-light/flight.test.mjs`

#### Scenario: Flying well wins
- **WHEN** a good bot flies eight seeds
- **THEN** it gets home on at least six, a very weak bot is caught on at least four, and a run home takes 150 to 260 s
- **CHECK** `qa/ahead-of-the-light/flight.test.mjs`

### Requirement: Clear for a first-time player
A player's first three runs SHALL show one tip at a time over the first 28 s: how to steer, to fly through the gold
rings, to dodge stars (red brackets), to skim and boost, and where the light is. Rings SHALL be solid glowing gold;
the next one SHALL pulse and wear +SPEED, and when it is off screen an arrow at the edge SHALL point to it. The result
SHALL say why the run ended and what to do next time.

#### Scenario: The first run
- **WHEN** a new player starts a run
- **THEN** the tips show in turn and the next ring is marked +SPEED in gold
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

### Requirement: Rings and boost
Gold rings SHALL hang in the tube about every 170 m, clear of stars. Flying through one SHALL add 25 % charge and
a kick of speed, and chain. BOOST (SHIFT, SPACE, the held BOOST button, a gamepad's RT or A) SHALL spend charge for
speed.

#### Scenario: Boost
- **WHEN** the player holds SHIFT, SPACE or BOOST with charge
- **THEN** the ship speeds up and the charge falls
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`, `qa/ahead-of-the-light/flight.test.mjs`

#### Scenario: Rings in the clear
- **WHEN** any ring on any seed is placed
- **THEN** it is inside the tube and no star blocks it
- **CHECK** `qa/ahead-of-the-light/world.test.mjs`

### Requirement: Sectors and home
The run SHALL pass eight sectors of 2.4 km: THE COSMIC WEB, COMA, VIRGO, THE LOCAL GROUP, THE MILKY WAY, THE ORION
ARM, THE SUN'S STARS and EARTH, each shown in block letters as you cross into it. Past Earth the run SHALL end with
HOME AHEAD OF THE LIGHT.

#### Scenario: A new sector
- **WHEN** the ship crosses into sector 4
- **THEN** THE LOCAL GROUP shows in block letters
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

#### Scenario: Home
- **WHEN** the ship passes Earth
- **THEN** the card says HOME AHEAD OF THE LIGHT, and the title then shows HOME 1× and the best time
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

### Requirement: Pause, result and again
ESC, P or the pause button SHALL pause and resume. The result SHALL show distance, the sector reached, time, rings,
skims and hits; R, Enter or FLY AGAIN SHALL start a new run.

#### Scenario: Again
- **WHEN** the light catches the player and they press R or tap FLY AGAIN
- **THEN** the result fits on screen and a new run starts
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

### Requirement: The machine stays
The machine SHALL keep its id, name, route and place in the Action row, its best line from
`ahead-of-the-light.meta.v1`, and its `qa/arcade/quiet.mjs` entry (start with `#go`).

#### Scenario: The machine
- **WHEN** the site is served and `qa/arcade/machines.mjs` runs
- **THEN** Ahead of the Light's cabinet, switcher entry and page agree on id, title and route
- **CHECK** `qa/arcade/machines.mjs`, `qa/arcade/quiet.mjs`
