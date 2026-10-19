## ADDED Requirements

### Requirement: The title
The title SHALL show AHEAD OF THE LIGHT in black condensed capitals on an orange panel, a black status strip with a
link back to the arcade, a short brief, the controls for the input in use, the best run, DEPLOY, the sound switch and
the game switcher. A bot SHALL fly the canyon behind it. The panel SHALL fit without scrolling.

#### Scenario: Open the game
- **WHEN** a player opens `/ahead-of-the-light/` at 1280 × 800, 800 × 600, 390 × 844, 320 × 568 or 844 × 390
- **THEN** the title fits with no scroll, every button is 44 px or more, and touch screens show DRAG · HOLD · TAP
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

#### Scenario: Deploy
- **WHEN** the player taps or clicks DEPLOY, or presses Enter or Space
- **THEN** a run starts with the ship already flying and the HUD on screen
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

### Requirement: Flying the canyon
The player SHALL strafe with A D, ← → or a drag left and right, and climb or dive with W S, ↑ ↓ or a drag up and down.
A gamepad's left stick SHALL steer too. The ground SHALL be drawn as points with contour lines, and the ground the
player sees SHALL be the ground the ship hits.

#### Scenario: Steer
- **WHEN** the player holds D, or drags right on a touch screen
- **THEN** the ship strafes right within half a second
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

#### Scenario: The bends can be flown
- **WHEN** the canyon bends, on any seed, at full boost near Earth
- **THEN** following it takes less than 80 % of the ship's strafe
- **CHECK** `qa/ahead-of-the-light/world.test.mjs`

### Requirement: The light behind you
The burst's light SHALL start 420 m behind and run faster than the ship cruises. When it reaches the ship the run
SHALL end with THE LIGHT CAUGHT YOU. The HUD SHALL show the gap in metres and whether it is closing, and the screen's
edge and the ground SHALL whiten as it closes.

#### Scenario: Cruising loses
- **WHEN** a pilot holds the canyon's middle and never takes a gate or boosts
- **THEN** the light catches them before Earth
- **CHECK** `qa/ahead-of-the-light/flight.test.mjs`

#### Scenario: Flying well wins
- **WHEN** a good bot flies eight seeds
- **THEN** it gets home on at least five, a weak bot is caught on at least one, and a run home takes 150 to 260 s
- **CHECK** `qa/ahead-of-the-light/flight.test.mjs`

### Requirement: Gates, boost and sonar
Orange gates SHALL hang in the canyon's open air about every 170 m. Flying through one SHALL add 30 % charge and a
kick of speed, and chain. BOOST (SHIFT, the held BOOST button, a gamepad's RT or A) SHALL spend charge for speed.
SONAR (SPACE, the SONAR button, a gamepad's X or B) SHALL send a ring across the ground, light it far ahead for a
moment and mark the gates within 650 m, with a 2.2 s cooldown.

#### Scenario: Ping
- **WHEN** the player presses SPACE or taps SONAR
- **THEN** the gates ahead are marked with brackets and their distance
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`, `qa/ahead-of-the-light/flight.test.mjs`

#### Scenario: Boost
- **WHEN** the player holds SHIFT or the BOOST button with charge
- **THEN** the ship speeds up and the charge falls; with no charge there is no boost
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`, `qa/ahead-of-the-light/flight.test.mjs`

#### Scenario: Gates in the open
- **WHEN** any gate on any seed is placed
- **THEN** its ring is clear of the ground and under the ceiling
- **CHECK** `qa/ahead-of-the-light/world.test.mjs`

### Requirement: Damage
A touch of the ground SHALL take 34 from the shield, then the hull, and slow the ship. The shield SHALL come back
after 2 s without damage. Above the canyon the light SHALL burn the shield, then the hull. With no hull the run SHALL
end with HULL LOST.

#### Scenario: A hit
- **WHEN** the ship touches the ground with its shield up
- **THEN** the shield drops, the hull stays whole, and the ship slows
- **CHECK** `qa/ahead-of-the-light/flight.test.mjs`

### Requirement: Sectors and home
The run SHALL pass eight sectors of 2.4 km named after the route home: THE COSMIC WEB, COMA, VIRGO, THE LOCAL GROUP,
THE MILKY WAY, THE ORION ARM, THE SUN'S STARS and EARTH. Each SHALL show its name as you cross into it and tint the
ground. Past Earth the run SHALL end with HOME AHEAD OF THE LIGHT. The score SHALL build over the run.

#### Scenario: A new sector
- **WHEN** the ship crosses into sector 4
- **THEN** THE LOCAL GROUP shows across the screen
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

#### Scenario: Home
- **WHEN** the ship passes Earth
- **THEN** the card says HOME AHEAD OF THE LIGHT, and the title then shows HOME 1× and the best time
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

### Requirement: Pause, result and again
ESC, P or the pause button SHALL pause and resume. The result card SHALL show distance, the sector reached, time,
gates and the best chain, and hits; R, Enter or FLY AGAIN SHALL start a new run.

#### Scenario: Pause
- **WHEN** the player pauses
- **THEN** the run stops until RESUME or ESC
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

#### Scenario: Again
- **WHEN** the light catches the player and they press R or tap FLY AGAIN
- **THEN** the result card fits on screen and a new run starts
- **CHECK** `qa/ahead-of-the-light/smoke.e2e.mjs`

### Requirement: The machine stays
The arcade machine SHALL keep its id `ahead-of-the-light`, name "Ahead of the Light", route and place in the Action
row, and its best line SHALL read the furthest sector from `ahead-of-the-light.meta.v1`. The page SHALL keep its
`qa/arcade/quiet.mjs` entry (start with `#go`).

#### Scenario: The machine
- **WHEN** the site is served and `qa/arcade/machines.mjs` runs
- **THEN** Ahead of the Light's cabinet, switcher entry and page agree on id, title and route
- **CHECK** `qa/arcade/machines.mjs`, `qa/arcade/quiet.mjs`
