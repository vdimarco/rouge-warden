## ADDED Requirements

### Requirement: The Alley is the default view
A visitor who opens `/` with no stored choice, no hash and a browser that supports WebGL2 SHALL arrive at `/lab/riftwalk/`, and Back SHALL NOT return to `/`. A browser with WebGL and no WebGL2 SHALL arrive at `/corridor/`. A browser without WebGL, an automated browser and a link with a hash such as `/#strategy` SHALL stay on `/`.

#### Scenario: First visit
- **WHEN** a visitor opens `/` for the first time in a browser with WebGL2
- **THEN** the address becomes `/lab/riftwalk/` and the Alley's start card shows

#### Scenario: Group link
- **WHEN** a visitor opens `/#strategy`
- **THEN** the hall opens on Strategy and the address does not change

### Requirement: Three views, each remembered
The home SHALL have three views: the Alley, the Corridor and All Games. `/?view=classic` SHALL open All Games and `/?view=corridor` SHALL open the Corridor, and `/` SHALL open that same view on later visits. `/?view=walk` SHALL do the same as `/?view=corridor`. `/?view=alley` SHALL open the Alley and clear the stored choice.

#### Scenario: Choosing the Corridor
- **WHEN** a visitor chooses Corridor in the Alley's Views menu and later opens `/`
- **THEN** the Corridor opens both times

#### Scenario: Back to the Alley
- **WHEN** that visitor chooses Alley in the Corridor and later opens `/`
- **THEN** the Alley opens both times

### Requirement: Controls between the views
The Alley SHALL show a Views button, at least 44 px wide, that opens a menu with the Alley, the Corridor and All Games, each link at least 44 px tall, with the Alley marked as the current view. A press outside the menu and the Esc key SHALL close it. The menu SHALL work on the start card, before the world has loaded. The Corridor SHALL show an Alley control beside its All games control: in the bar on a wide screen, and in the category strip at 760 px and narrower. All Games SHALL show an Alley control with its Corridor control: in the bar on a wide screen, and in Menu at 480 px and narrower. All of these controls SHALL be on screen at widths 1280, 390 and 320 with no sideways scroll, and the All Games bar's controls SHALL NOT cover its title.

#### Scenario: The Views menu
- **WHEN** a visitor presses Views in the Alley at 1280, 390 or 320 px wide
- **THEN** the menu lists Alley, Corridor and All games inside the window, and Alley is marked as current

#### Scenario: From the Corridor
- **WHEN** a visitor presses Alley in the Corridor
- **THEN** the Alley opens
