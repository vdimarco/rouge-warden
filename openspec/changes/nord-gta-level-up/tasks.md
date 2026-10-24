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
- [ ] Fourth pass previews and review: re-render `mentana`, `papineau`, `rachel`, `fabre`, `corner`, `aerial` and `hlm_mentana`, which still show the old summer trees, the old curb extensions and the old Mentana form, then a critic review.

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
- [ ] Check that UE 5.8's OBJ importer names the tree meshes' bark and leaves slots from `usemtl`, that `clear_instances` empties the vegetation's `Trees` component, and the frame time with about 5,300 masked Nanite trees casting shadows.
- [ ] Play on a phone over the stream: graded steering, assists, combat buttons, HUD fit at 667×375 and 800×360.
- [ ] Cook, package, install with saves preserved, and check the public stream.

## Follow-up
- [x] Give the park and street trees more than one model: they stand on the species meshes from the city inventory (the apply plan is tested on the CPU; the previews and the host import are open above).
- [ ] Bring back the falling leaves: `QuebecVegetation` spawns them near its own instances, which the apply step now clears (a C++ change for a host build).
- [ ] Give the 263 inventory conifers a conifer kind; today they take a kind by crown size.
- [ ] Make a chain-link texture set; a small-scale grey lattice stands in for it.
- [ ] Count the street trees, not only the yard trees, as obstacles in the laundry sight test.
- [ ] Check the 424 street-name `TextRender` signs in the editor after import.
- [ ] Fix the mirrored world: negate Y across map layers, gameplay headers, campaign positions, saved actors and QA scripts, then rerun the full host QA.
