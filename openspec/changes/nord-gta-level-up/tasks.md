# Tasks

## Plan
- [x] Map the driving, people, campaign/HUD, map pipeline, build/test code and research the Plateau, police, combat and lag references.
- [x] Write the shared contracts (`QuebecGTA.h`, `AQuebecPlayerState`) and this change.

## Cloud implementation
- [x] Lag-tolerant driving: `QuebecSteerAssist.h` with its delayed-input test, the on-road assist, graded steering keys, wall sliding, stuck nudge, 60 Hz possessed cars, autopilot, police flag, body damage.
- [x] Phone controls: graded steering with hysteresis, optional auto-gas, FIRE/WEAPON buttons, browser unit tests.
- [x] Knockdowns: `QuebecKnockModel.h` with its test, resident/pedestrian/player tumbles, fleeing, `QuebecPeople`.
- [x] Living street: dog, stroller and grocery companions on existing walkers.
- [x] Combat: `QuebecAimModel.h` with its test, weapons, pickups, FX, procedural sounds, health/armour, K.-O. and respawn.
- [x] Police: `QuebecHeatModel.h` with its test, crimes and witnesses, dispatcher, police cars and officers, arrest, garage, goons.
- [x] Side jobs and HUD: four jobs, notices, status column, banners, reticle, radar blips, R intercept, race-gate guard.
- [x] Traffic: stop signs, yielding, curb stops, tyre marks, knockable cones and bins.
- [x] Streetscape: streets, furniture placements and lived-in layer generator, apply script, tests.
- [x] Plex fronts for the plain buildings, with tests.
- [x] Blender props and companions, contact sheet, street previews.
- [x] Rear façades for plex lots on yards and ruelles: windows and doors, galleries with posts, rear stairs, fences, sheds.
- [x] Textured greystone and slate materials in the apply step, with previews re-rendered.
- [x] Roofs (membrane, gravel, tar, copings, chimneys, hatches), windowed long walls, skins on background backs, solid front steps.
- [x] Yards (ground cover, creepers, Canopée yard trees), gallery balusters, board fences, denser spirals, 15 textured material keys.
- [x] Lane life: laundry from galleries, bins and bikes at gates, ruelles vertes from open data, tags.
- [x] Third pass, first part: porch collision outside the traffic band, gallery guard collision, street trees off the asphalt, ruelle edges paved to the fences, the Habitations De Mentana block, brick and tower walls, macro variation on gravel and tar.
- [x] Third pass, second part: the Fabre front yard and sidewalk, gallery life, rear surfaces, background roofs, front planting, species yard trees, re-rendered previews and a critic review.
- [x] Fourth pass, streets: the city's tree inventory clipped with its licence, `street_trees.json` with every street and park tree, sidewalk pits 65–80 cm behind the curb with iron guards and planting cards, curb extensions only near corners or where the data maps one, the aged lane-concrete gutter with leaf drifts, a dull crack seal and six new texture sets.
- [x] Fourth pass, species trees: the vase elm and the young street trees, every street and park tree on its kind's mesh in the apply plan, the old summer tree cleared, autumn leaves by default, and host steps that build the tree OBJs first and import the tree meshes before the layers.
- [x] Fourth pass, Plex: the Habitations De Mentana slab form, lane fences seeded lot by lot with more garages and sheds, cedars and hedges as crossed cards, and brick on every wall a named street sees.
- [x] Fourth pass, lane life: catenary laundry lines with garments from the `Cloth_Laundry` atlas, a line in sight of the moved ruelle camera, fountain-grass cards, and tags only on solid fence faces.
- [x] Fourth pass, integration: every layer rebuilt in dependency order and byte-identical on a second build, the Plex manifest hashing `street_trees.json`, and the spec's Plex budget set to the code's caps with a test.
- [x] Fourth pass previews and review: all ten street previews re-rendered on the species trees, the straight curbs and the new Mentana form, then a critic review.
- [x] Fifth pass, streets: carriageway trees re-seated from the inventory's side, place and distance or listed for the host, a late-October colour on every row, conifer and larch genera, a 0.5 cm gutter that keeps clear of the old road, dull crack seal and potholes, ruelles paved out to the first lot line, and a missing Plex `Glass` OBJ named.
- [x] Fifth pass, trees: the `conifer` and `larch` kinds with young meshes and needle cells, the silver maple leaf with a central blade, and a `.mtl` library for every tree OBJ.
- [x] Fifth pass, leaf-litter texture: the masked `Leaf_Litter` set stamped from the tree atlas's leaf shapes, with `--check` tied to the leaf forms.
- [x] Fifth pass, lane life: no laundry line or garment in a tree crown, `Leaf_Litter` patches under every crown, on curb drifts and in the ruelle gutters, and the ruelle camera moved to a line in sight.
- [x] Fifth pass, apply step: the conifer and larch kinds, one actor per kind, mesh and late-October colour with tinted leaves, the `NordStreetTree` tag, no trunk in the traffic band, and `Leaf_Litter` as a contract key.
- [x] Fifth pass, host steps: both host blocks build the Plex and prop OBJs first, the park, stand-in and pre-apply verify read the OSM tree nodes again, and dogs sniff the tagged street trees (stub syntax check and link only).
- [x] Fifth pass, integration: every layer rebuilt in dependency order and byte-identical on a second build.
- [x] Fifth pass previews and review: draw the red and russet leaf tints in the preview, re-render the views that show the gutter, the litter, the conifers, the re-seated trees and the moved ruelle camera (`ruelle_mentana`, `ruelle`, `gallery_closeup`, `mentana`, `rachel`, `papineau`, `corner`, `aerial`), update `Preview/Replica/README.md`, then a critic review.
- [x] Fifth pass repair: serrated litter outlines with a thinning fringe of clumps, leaves on the ruelles under the yard trees and a gutter drift under every crown over a gutter, park litter over the park's own leaves, the city's wooden poles with cobra heads and its steel light standards from the sign-pole inventory with the junction signs hung on them, a back door on every lane wall, shadows on the street props, the larch genera in gold, and the dog sniff walk narrowed to the replica instance actors; every layer rebuilt in order.
- [ ] Re-render the views the repair changes (`rachel`, `mentana`, `papineau`, `fabre`, `corner`, `ruelle`, `ruelle_mentana`) and review them.

## Cloud verification
- [x] Every new and changed `.cpp` passes the stub-header syntax check with UE's Linux warnings.
- [x] Engine-free model tests pass with g++ and clang++ under `-Wshadow -Werror`.
- [x] Map CPU tests and browser unit tests pass.
- [x] Independent reviews for UE API use, replication, `-Wshadow`, pinned tests and contracts; fixes applied.
- [x] Second review of the fix commits; all 17 confirmed findings fixed.
- [x] OpenSpec structure validated.

## Host verification (owner's PC with UE 5.8.3)
`notes-host.md` gives the exact commands and flags for each step.
- [ ] Build QuebecEditor and Quebec Linux Development; fix anything the stub check could not catch.
- [ ] Run `Automation RunTests Quebec.` (the existing tests plus 36 new ones), `car_collision_test.py`, `smoke_test.py`, `population_test.py`, `test_resident_feedback.py` and the story-slice suite with and without `-NordLag`.
- [ ] Run `Scripts/apply_plateau_replica.py` on a backed-up map, verify on a fresh load, capture the six reference views and profile them.
- [ ] Check that UE 5.8's OBJ importer names the tree meshes' bark and leaves slots from `usemtl` and the `.mtl` libraries, that `clear_instances` empties the vegetation's `Trees` component, that the red and russet groups show their tinted leaves, and the frame time with about 5,300 masked Nanite trees casting shadows and the `Leaf_Litter` patches.
- [ ] Check that a dog sniffs a street tree after the import (`FindSniffSpot` on the `NordStreetTree` replica instance actors) and that `GetInstancesOverlappingSphere` returns the right instances on 5.8.
- [ ] Check the cobra heads on the city's wooden poles, the signs hung on poles and the street props' shadows in the editor, and the residential streets' light at night.
- [ ] Play on a phone over the stream: graded steering, assists, combat buttons, HUD fit at 667×375 and 800×360.
- [ ] Cook, package, install with saves preserved, and check the public stream.

## Follow-up
- [x] Give the park and street trees more than one model: they stand on the species meshes from the city inventory (the apply plan is tested on the CPU; the previews and the host import are open above).
- [ ] Bring back the falling leaves: `QuebecVegetation` spawns them near its own instances, which the apply step now clears (a C++ change for a host build).
- [x] Give the 263 inventory conifers a conifer kind: 180 stand on `conifer` and 83 larches on `larch`.
- [ ] Make a chain-link texture set; a small-scale grey lattice stands in for it.
- [ ] Count the street trees, not only the yard trees, as obstacles in the laundry sight test.
- [ ] Check the 424 street-name `TextRender` signs in the editor after import.
- [ ] Fill the residential curbs with parked cars (instanced, on the spaces `CurbParking` finds; C++ for the host).
- [ ] Give the conifer kind a pine and a cedar form, and the Colorado blue spruce a glaucous tint (a new colour group in the `fall` contract).
- [ ] Late-October dressing: kraft leaf bags beside the curb bins, and pumpkins on stoops if a better source confirms them.
- [ ] Fade the litter's edge by vertex colour if UE 5.8's OBJ import keeps vertex colour on masked Nanite (a host check first).
- [ ] Fix the mirrored world: negate Y across map layers, gameplay headers, campaign positions, saved actors and QA scripts, then rerun the full host QA.
