## ADDED Requirements

### Requirement: Plateau streets at street level
The Montréal map SHALL show Plateau streets as a local would know them: dark asphalt cut to each street's measured width, Québec road paint, grey concrete sidewalks with curbs, front parterres and tree pits.

#### Scenario: Walk a residential plex street
- **WHEN** a player walks along avenue de Mentana or rue Fabre at eye height in daylight
- **THEN** the carriageway is dark asphalt about 10–12.5 m from curb to curb, the sidewalks are light grey concrete with joints and an 18 cm curb, and street trees stand in sidewalk tree pits where the city's tree inventory places them
- **AND** no taupe paver surface shows between the curb and the building line
- **AND** each street tree is the city inventory's tree at that address, with its species and trunk; a sidewalk tree's pit sits on the sidewalk 65–80 cm behind the curb with a low iron guard and planting, and the curb runs straight past it: curb extensions appear only near corners or where the city or OSM maps one
- **AND** the trees wear late-October yellow, orange and red on their species' forms (elms and hackberries vase-shaped; red, sugar and Freeman maples red, red and pin oaks russet), spruces, pines and cedars stay dark green on a conical form, the Colorado blue spruces are blue-grey, and larches turn gold, and a young planting is a slim tree with its crown above head height, never a shrunken mature tree
- **AND** a conifer's limbs grow in whorls on one leader, low limbs drooping and high ones rising, and a silver maple's leaf shows five deep lobes joined over a central blade, never five separate leaflets
- **AND** no tree trunk stands on the carriageway or in the parking lane: a tree the inventory maps there stands in a pit or on the lawn on its own side of the street, or on its street's median, or is left out

#### Scenario: Stop at a Plateau corner
- **WHEN** a player stops at a corner that OSM maps with a stop sign
- **THEN** an ARRÊT sign, a white stop bar and a crosswalk of the Québec kind are present, and a white street-name sign with black text gives the real street name
- **AND** where the city's sign inventory hangs the junction's street-name blades, ARRÊT or one-way sign on a wooden utility pole or a steel light standard the game draws, the sign hangs on that pole, clear of it and stacked (blades over the one-way plate over the ARRÊT), with no post of its own

#### Scenario: Read the parking signs
- **WHEN** a player looks at the parking signs along a curb
- **THEN** each stands at a pole of the city's parking-sign inventory and carries that pole's signs (code, text and arrow), hung under the junction signs on a wooden or steel pole the game draws, or on its own post a short way behind the curb, clear of the tree pits; none stands at a random spot with a random text
- **AND** each plate shows its sign family's face, picked from its code: a red crown and bar over a black octagon for no stopping, a barred P for no parking, a black P with no crown for limited parking, a barred P with "EXCEPTÉ" for a reserved space, the residents' permit plate with its permit panel and red SECTEUR box, or a green crown with the wheelchair symbol for a disabled space, with hours where its text has a time and the arrow its row gives (checked in `test_plateau_props.py` through the dry run)

#### Scenario: Walk a residential street at dusk
- **WHEN** a player walks avenue de Mentana, rue Fabre, rue Napoléon or rue Saint-André
- **THEN** the city's wooden utility poles stand where its sign-pole inventory puts them, each with a cobra-head light over the street, and its steel light standards carry cobra heads, so the residential streets are lit, not only the arterials and the park
- **AND** no pole stands on the carriageway or in a tree pit, and no pole or lamp collision lies within 300 cm of a traffic centreline

#### Scenario: Ride Rachel
- **WHEN** a player travels rue Rachel along the park
- **THEN** a green-painted bike lane with green bollards separates the bike path from traffic

#### Scenario: Ride a painted bike street
- **WHEN** a player travels a street whose OSM ways carry a painted cycleway (a bike lane or contraflow lane on Marie-Anne, Fabre, Marquette, Gauthier, Bordeaux, Roy or Parc-La Fontaine; a shared street on Fabre, Chambord or Marquette; the bus lane on Papineau or De Lorimier)
- **THEN** a bike lane runs between two white lines, between the parked cars and the traffic where the side has parking, with a diamond, a bike and an arrow in its direction repeated in it; a shared street shows a bike with two chevrons in the traffic lane; a bus lane shows the white reserved-lane diamond
- **AND** on every block of 40 m or more, the first mark lies within 30 m after the junction and the next ones follow no more than 60 m apart, and no paint lies on a crosswalk or under a curb extension
- **AND** a lane line beside parked cars lies 2.55 m or more from the curb, so no parked car stands on a painted line, and a plain parking line is painted only where OSM marks the parking (one side of Avenue Calixa-Lavallée); the other curbs have bare asphalt under the cars (checked in `test_plateau_replica.py`)

#### Scenario: Curb parking and traffic still work
- **WHEN** the replica layer is imported and the host runs the curb, car-collision and traffic checks
- **THEN** curb tops measure 17–25 cm, runtime parked cars still find curb spaces, the 18 cm curb test passes, and no new collision lies within 300 cm of a traffic lane centreline
- **AND** no car drives through a tree trunk: no trunk stands within 300 cm of a traffic lane centreline unless it is in a sidewalk or curb-extension pit or at a ruelle's edge, and none stands within 200 cm of one
- **AND** where cars park beside a cycle track (Rue de Brébeuf, Rue De La Roche), a 70 cm concrete separator with the green bollards on it stands between the track and the cars, its top at 18 cm, a curb the curb finders accept, open at the lane mouths and out of the 300 cm traffic band (checked every metre in `test_plateau_parking.py`)
- **AND** every green bollard, on the road or on a separator, has its white band 92 to 104 cm over its own foot (checked in `test_plateau_replica.py`)

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
- **AND** a bike locked to a parking-sign post stands along the curb on the building side of the post, and every locked bike at a sign post or a parterre fence has both wheels on the level sidewalk at its own height, never over the road, a ramp or a tree pit
- **AND** hydrants, sign posts, bins and locked bikes cast shadows in the low sun, as the lamps, poles and benches do
- **AND** two neighbouring blocks do not repeat the same arrangement
- **AND** asphalt patches, sealed cracks and potholes are as dull as the asphalt around them, so the low sun never draws a crack as a white hook

#### Scenario: Late-October leaf litter
- **WHEN** a player walks a sidewalk, a parterre, a ruelle or the park lawn under the street, park and yard trees
- **THEN** fallen leaves lie under every crown, in ragged patches of leaf shapes that thin out toward the drip line, denser under the trees that have dropped more of their leaves (honey locusts and ashes more than Norway maples, conifers almost none), and leaves drift against the curbs, more under the crowns, and along the ruelle gutters
- **AND** a patch on a sidewalk, a lawn, a parterre or a ruelle has a serrated edge with a point about every 60 to 90 cm, and small clumps of leaves lie just outside it, more and bigger near its edge than toward the drip line, each street clump within 30 cm of a patch, and one apart from every patch five points round or more, so none lies alone on the open sidewalk or reads as a diamond; a side longer than 1.5 m only runs along a change in the ground (a curb, a lawn's or a path's edge, a fence or a wall), never across open sidewalk (checked at every 20 cm of such a side: its ground changes within 20 cm), and no outline runs 3 m or more turning less than 10° over open ground, even in short sides; no outline stays within 15 cm of one straight line for 2 m or more over open ground, no side of a ruelle patch over 1 m crosses open paving, and no patch under 0.5 m² is cut by the edge of its ground
- **AND** where a yard tree's crown reaches over a ruelle, its leaves cover at least half its kind's share of the lane's paving under it, and together the crowns' leaves cover 90% or more of their target; they drift into the gutter under it, a lane patch that reaches the gutter has leaves in the gutter beside at least half of that stretch, and leaves bank against the lane fences and walls, more under the crowns (18% or more of the paving's edge has leaves at its foot, and half or more of it under the crowns)
- **AND** a park patch within 20 m of a street is as fine as a street's, with clumps of leaves on the lawn round it, so the park's carpet thins out toward the street with no clean edge
- **AND** the leaves are never a flat one-colour polygon that reads as paint, never hang over a curb, a ramp, a dropped curb or a park path, never lie over the sunken gutter outside its own drifts, never cross the park's own fallen leaves (0.25 cm or more under the litter), and never sink under a slab (checked in `test_plateau_replica.py`: every litter vertex lies 0.2 to 0.8 cm over its ground, or up to 1.0 cm on the park lawn, on world metre UVs of the `Leaf_Litter` set, within 110,000 triangles of the Soul budget)

#### Scenario: Late-October dressing
- **WHEN** a player walks a residential street in late October
- **THEN** kraft paper leaf bags, printed green on both wide faces and rolled over at the top, stand at the curb beside some bin rows, full, three-quarters or half full, a wide face to the street, on the level sidewalk and never on a ramp, in a tree pit or against another prop
- **AND** pumpkins sit on some stoop landings, at the corners beside the steps, wholly on the landing and clear of its rail, wall and stair; a carved one faces the street, and no landing within 2.5 m of the carriageway has one, so no pumpkin closes a parking space

#### Scenario: Walk a ruelle
- **WHEN** a player walks a mapped ruelle
- **THEN** wooden utility poles and sagging wires cross overhead, and laundry hangs from the galleries over the yards, never from a utility pole or across the lane, as the city's clothesline rules require
- **AND** no line or garment passes through a tree: every rope and every garment keeps out of the inner 0.7 of each crown the game draws, above its crown base, and 1.5 m from every trunk; a yard under a big tree hangs its line elsewhere or none
- **AND** each pulley line sags between its gallery and a pole at the back fence and rises to the pole, with sheets, towels, shirts and jeans pegged along it whose tops follow the rope's sag and whose hems fold, never flat boards; from the ruelle preview camera a line with washing is in sight within 15 m, above the fences (checked by a ray cast through the game's geometry and tree meshes)
- **AND** the centre gutter is a strip of aged, stained concrete with joints, slightly sunken and darker than a sidewalk, with leaves along it, never a painted white line or a double line where an older surface shows through; its dirty, uneven edges fade into the asphalt, and in low sun the strip is at most 1.4 times as bright as the lane asphalt, near or far, and its dry concrete stays matt (roughness 0.85 or more, the damp channel 0.72 or more), so it does not flash in backlight (checked in `test_plateau_textures.py`)
- **AND** the lane is paved from lot line to lot line: no bare floor lies between the lane and the first fence, yard or wall beside it
- **AND** blue and brown bins, flower boxes and locked bikes stand at the gates

#### Scenario: Look at the back of a block
- **WHEN** a player looks at the yard side of a plex block from a ruelle or from above
- **THEN** each rear wall has doors and windows, every upper floor has a wooden or steel gallery on posts with balusters or boards, and a straight or spiral stair reaches each gallery from the yard
- **AND** every wall of 3 m or more on a ruelle has a ground-floor back door on the lane, one per 8 m, on a concrete stoop with steps along the wall where the floor is raised and the stoop keeps 2 m from every lane and road centreline; otherwise the door opens at grade, so no car on a ruelle drives through steps
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

#### Scenario: Look down a street from far off
- **WHEN** a player looks along a street, a ruelle or a stoop from 10 to 90 m away
- **THEN** the paint, the ruelle gutter, the fallen leaves and a jack-o'-lantern's face keep the small lift they were built with over the surface under them, so none sinks into it
- **AND** the leaf bags and pumpkins cast shadows in the low sun
- **AND** this is checked without the engine: the apply step imports every layer and prop mesh with a Nanite position step of 1/32 cm and verify reads it back (`check_nanite_precision` in `test_plateau_replica.py`), and on the host by the reference captures

### Requirement: Checkable without the engine
The streetscape generators SHALL be deterministic and checkable without Unreal.

#### Scenario: Regenerate on another machine
- **WHEN** the host runs the replica, plex and props generators from a clean checkout
- **THEN** the OBJ files match the manifests' hashes, the CPU tests pass, and Blender previews of the reference views render from the same files
- **AND** the host steps build the tree, Plex and prop OBJs before the replica layers, and a missing OBJ stops the build with the path or the step that makes it
- **AND** before the replica import, the committed park and the saved map's trees still verify against the OSM tree nodes they were built from
