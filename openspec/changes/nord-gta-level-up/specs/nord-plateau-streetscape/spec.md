## ADDED Requirements

### Requirement: Plateau streets at street level
The Montréal map SHALL show Plateau streets as a local would know them: dark asphalt cut to each street's measured width, Québec road paint, grey concrete sidewalks with curbs, front parterres and tree pits.

#### Scenario: Walk a residential plex street
- **WHEN** a player walks along avenue de Mentana or rue Fabre at eye height in daylight
- **THEN** the carriageway is dark asphalt about 10–12.5 m from curb to curb, the sidewalks are light grey concrete with joints and an 18 cm curb, and street trees stand in tree pits about 8 m apart
- **AND** no taupe paver surface shows between the curb and the building line

#### Scenario: Stop at a Plateau corner
- **WHEN** a player stops at a corner that OSM maps with a stop sign
- **THEN** an ARRÊT sign, a white stop bar and a crosswalk of the Québec kind are present, and a white street-name sign with black text gives the real street name

#### Scenario: Ride Rachel
- **WHEN** a player travels rue Rachel along the park
- **THEN** a green-painted bike lane with green bollards separates the bike path from traffic

#### Scenario: Curb parking and traffic still work
- **WHEN** the replica layer is imported and the host runs the curb, car-collision and traffic checks
- **THEN** curb tops measure 17–25 cm, runtime parked cars still find curb spaces, the 18 cm curb test passes, and no new collision lies within 300 cm of a traffic lane centreline

### Requirement: Plateau plex fronts
Buildings that today show plain extruded boxes SHALL show Plateau plex fronts on their street side.

#### Scenario: Look along a block of plexes
- **WHEN** a player looks along any block on Mentana, Saint-André, Cartier, Saint-Christophe, Dorion, Fabre or Garnier
- **THEN** each 7.6 m lot shows its own front with two or three storeys, brick in local colours, stone sills and lintels, a painted cornice, balconies on each upper floor and paired doors
- **AND** lots with a setback of about 1.2 m have curved iron stairs, lots with a deep setback have straight stairs, and lots at the line have cantilevered balconies

#### Scenario: Frame budget
- **WHEN** the host profiles the six reference views at Epic quality after import
- **THEN** each p95 frame time stays under 16.67 ms on the reference RTX 4090, and the plex layer stays under about 2.5 million triangles

### Requirement: A lived-in Plateau
The streetscape SHALL carry seeded signs of life and wear, as the owner's reference article asks.

#### Scenario: Look closely at a block
- **WHEN** a player looks at any residential block
- **THEN** at least some of these are visible: asphalt patches or potholes, leaves in the gutter, weeds at wall bases, bins at the curb, a bike locked to a railing, rust streaks under iron stairs
- **AND** two neighbouring blocks do not repeat the same arrangement

#### Scenario: Walk a ruelle
- **WHEN** a player walks a mapped ruelle
- **THEN** laundry lines, wooden utility poles and sagging wires cross overhead

### Requirement: Checkable without the engine
The streetscape generators SHALL be deterministic and checkable without Unreal.

#### Scenario: Regenerate on another machine
- **WHEN** the host runs the replica, plex and props generators from a clean checkout
- **THEN** the OBJ files match the manifests' hashes, the CPU tests pass, and Blender previews of the reference views render from the same files
