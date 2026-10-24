## ADDED Requirements

### Requirement: Plateau streets at street level
The Montréal map SHALL show Plateau streets as a local would know them: dark asphalt cut to each street's measured width, Québec road paint, grey concrete sidewalks with curbs, front parterres and tree pits.

#### Scenario: Walk a residential plex street
- **WHEN** a player walks along avenue de Mentana or rue Fabre at eye height in daylight
- **THEN** the carriageway is dark asphalt about 10–12.5 m from curb to curb, the sidewalks are light grey concrete with joints and an 18 cm curb, and street trees stand in sidewalk tree pits where the city's tree inventory places them
- **AND** no taupe paver surface shows between the curb and the building line
- **AND** each street tree is the city inventory's tree at that address, with its species and trunk; a sidewalk tree's pit sits on the sidewalk 65–80 cm behind the curb with a low iron guard and planting, and the curb runs straight past it: curb extensions appear only near corners or where the city or OSM maps one
- **AND** the trees wear late-October yellow, orange and red on their species' forms (elms and hackberries vase-shaped; red, sugar and Freeman maples red, red and pin oaks russet), spruces, pines and cedars stay dark green on a conical form and larches turn gold, and a young planting is a slim tree with its crown above head height, never a shrunken mature tree
- **AND** no tree trunk stands on the carriageway or in the parking lane: a tree the inventory maps there stands in a pit or on the lawn on its own side of the street, or on its street's median, or is left out

#### Scenario: Stop at a Plateau corner
- **WHEN** a player stops at a corner that OSM maps with a stop sign
- **THEN** an ARRÊT sign, a white stop bar and a crosswalk of the Québec kind are present, and a white street-name sign with black text gives the real street name

#### Scenario: Ride Rachel
- **WHEN** a player travels rue Rachel along the park
- **THEN** a green-painted bike lane with green bollards separates the bike path from traffic

#### Scenario: Curb parking and traffic still work
- **WHEN** the replica layer is imported and the host runs the curb, car-collision and traffic checks
- **THEN** curb tops measure 17–25 cm, runtime parked cars still find curb spaces, the 18 cm curb test passes, and no new collision lies within 300 cm of a traffic lane centreline
- **AND** no car drives through a tree trunk: no trunk stands within 300 cm of a traffic lane centreline unless it is in a sidewalk or curb-extension pit or at a ruelle's edge, and none stands within 200 cm of one

### Requirement: Plateau plex fronts
Buildings that today show plain extruded boxes SHALL show Plateau plex fronts on their street side.

#### Scenario: Look along a block of plexes
- **WHEN** a player looks along any block on Mentana, Saint-André, Cartier, Saint-Christophe, Dorion, Fabre or Garnier
- **THEN** each 7.6 m lot shows its own front with two or three storeys, brick in local colours, stone sills and lintels, a painted cornice, balconies on each upper floor and paired doors
- **AND** lots with a setback of about 1.2 m have curved iron stairs, lots with a deep setback have straight stairs, and lots at the line have cantilevered balconies
- **AND** a side wall that a named street sees is brick, never siding

#### Scenario: See the Habitations De Mentana
- **WHEN** a player looks at the Habitations De Mentana from avenue de Mentana or from the ruelle behind it
- **THEN** red brick bays stand between grey concrete piers, separate one-bay balconies with teal open railings rise in vertical stacks, the end walls are plain grey concrete without balconies, and the ground floor stands back behind concrete columns

#### Scenario: Frame budget
- **WHEN** the host profiles the six reference views at Epic quality after import
- **THEN** each p95 frame time stays under 16.67 ms on the reference RTX 4090, and the plex layer, rear work included, stays within 3.2 million triangles in at most 1,350 batches, under the agreed ceiling of 3.5 million triangles and 1,400 batches

### Requirement: A lived-in Plateau
The streetscape SHALL carry seeded signs of life and wear, as the owner's reference article asks.

#### Scenario: Look closely at a block
- **WHEN** a player looks at any residential block
- **THEN** at least some of these are visible: asphalt patches or potholes, leaves in the gutter, weeds at wall bases, bins at the curb, a bike locked to a railing, rust streaks under iron stairs
- **AND** two neighbouring blocks do not repeat the same arrangement

#### Scenario: Late-October leaf litter
- **WHEN** a player walks a sidewalk, a parterre or the park lawn under the street and park trees
- **THEN** fallen leaves lie under every crown, in ragged patches of leaf shapes that thin out toward the drip line, denser under the trees that have dropped more of their leaves (honey locusts and ashes more than Norway maples, conifers almost none), and leaves drift against the curbs, more under the crowns, and along the ruelle gutters
- **AND** the leaves are never a flat one-colour polygon that reads as paint, never hang over a curb, a ramp, a dropped curb or a park path, and never sink under a slab (checked in `test_plateau_replica.py`: every litter vertex lies 0.2 to 0.8 cm over its ground, on world metre UVs of the `Leaf_Litter` set, within 70,000 triangles of the Soul budget)

#### Scenario: Walk a ruelle
- **WHEN** a player walks a mapped ruelle
- **THEN** wooden utility poles and sagging wires cross overhead, and laundry hangs from the galleries over the yards, never from a utility pole or across the lane, as the city's clothesline rules require
- **AND** no line or garment passes through a tree: every rope and every garment keeps out of the inner 0.7 of each crown the game draws, above its crown base, and 1.5 m from every trunk; a yard under a big tree hangs its line elsewhere or none
- **AND** each pulley line sags between its gallery and a pole at the back fence and rises to the pole, with sheets, towels, shirts and jeans pegged along it whose tops follow the rope's sag and whose hems fold, never flat boards; from the ruelle preview camera a line with washing is in sight within 15 m, above the fences (checked by a ray cast through the game's geometry and tree meshes)
- **AND** the centre gutter is a strip of aged, stained concrete with joints, slightly sunken and darker than a sidewalk, with leaves along it, never a painted white line or a double line where an older surface shows through
- **AND** the lane is paved from lot line to lot line: no bare floor lies between the lane and the first fence, yard or wall beside it
- **AND** blue and brown bins, flower boxes and locked bikes stand at the gates

#### Scenario: Look at the back of a block
- **WHEN** a player looks at the yard side of a plex block from a ruelle or from above
- **THEN** each rear wall has doors and windows, every upper floor has a wooden or steel gallery on posts with balusters or boards, and a straight or spiral stair reaches each gallery from the yard
- **AND** yards hold lawns, patios, garden beds or parking pads behind fences with gates that change from lot to lot (weathered or painted boards, chain-link, low pickets, slat panels, lattice-topped boards), some with sheds or garages facing the lane, and mature backyard trees rise above the roofs where the city's canopy data shows them
- **AND** cedars and hedges are soft columns of foliage, never cones
- **AND** no window card floats on a blank wall

#### Scenario: Walk a ruelle verte
- **WHEN** a player walks a ruelle that the city's open data lists as a ruelle verte
- **THEN** planted beds run along the fences and walls, an arch with planters marks the entry, and most such ruelles carry a mural
- **AND** the ornamental grasses in the beds are fountain-shaped clumps of blades and plumes, never cones, and graffiti appears only where paint can land: board fences, slat panels, shed and garage doors, not picket or chain-link fences

#### Scenario: See the roofs from above
- **WHEN** a player sees the plex blocks from above
- **THEN** most flat roofs are white membrane or white gravel, a few are tar and gravel, parapets carry metal copings that step at party walls, and each lot has a chimney and a roof hatch; only mansards are slate

### Requirement: Checkable without the engine
The streetscape generators SHALL be deterministic and checkable without Unreal.

#### Scenario: Regenerate on another machine
- **WHEN** the host runs the replica, plex and props generators from a clean checkout
- **THEN** the OBJ files match the manifests' hashes, the CPU tests pass, and Blender previews of the reference views render from the same files
