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
- [x] Sixth pass, streets: on-street bike paint from the OSM `cycleway` tags (lanes and contraflow lanes between two white lines with diamond, bike and arrow marks, shared-street bikes with chevrons, reserved bus-lane diamonds, the first mark within 30 m after each junction) in `Streets/bike_paint.json`, and the Colorado blue spruce's `blue` fall through the species table and the apply plan.
- [x] Sixth pass, Soul: litter sides that only run straight along a change in the ground, half-lanes covered under the yard crowns and drifts at the lane fences and walls, fine park patches with clumps near the streets, the park litter 1.0 cm up, the litter's inputs hashed, and kraft leaf bags and stoop pumpkins in the placements, within the Soul budget.
- [x] Sixth pass, parked cars: `Scripts/plateau_parking.py` with `test_plateau_parking.py`, `Streets/parked_cars.json`, the generated `LaFontaineParking.h`, `AQuebecParkedCars` (instanced fill, replicated hidden spaces, promotion on E, impact and shot, recycling) with its automation test, and the engine-free `QuebecParkedRules.h`.
- [x] Sixth pass, apply step: a 1/32 cm Nanite position step on every layer and prop mesh, read back by verify; the one static mesh of each import, at its planned name; stray `.mtl` materials deleted and no unplanned asset left; the conifer's `blue` tint group through apply and verify; shadows and a scale-range check for the leaf bags and pumpkins.
- [x] Sixth pass, Plex: lane-door stoops keep 2 m from every lane and road centreline, else the door opens at grade (330 doors), with the district check against the traffic graph and a fixture at 250 and 330 cm.
- [x] Sixth pass, textures: the ruelle gutter owns its colour and is darker, with dirty, uneven edges that fade into the asphalt, tested against the lane asphalt colour.
- [x] Sixth pass, props: kraft leaf bags at three fills and plain and carved pumpkins in the Props manifest and the contact sheet, with `check_october`.
- [x] Sixth pass, integration: every layer rebuilt in dependency order (trees, Plex, props, replica, parking, textures `--check`) and byte-identical on a second build; all map tests, the dry run, the rendering self-check and the stub C++ checks pass.
- [ ] Sixth pass previews: draw the parked cars from `parked_cars.json`, the blue spruces, the bike paint, the leaf bags and pumpkins, the at-grade lane doors and the new gutter in the preview, re-render the street views, then a critic review.
- [x] Sixth pass repair (the pass-6 critics): the parking sides from the drawn cycle tracks (`prepare_car_parking.py`, `RoadParkingSides` regenerated), the city's parking signs clipped (`Inventory/park_signs.json`, `plateau_park_signs.py`) and read at a weekday midday by the parked cars (signed sides, ban spans by their arrows, peak-hour bus lanes, a 3 m lane on the streets off the traffic graph), the parking signs at the city's poles, bikes locked along the curb with both wheels on the sidewalk, straight litter runs broken by midpoint displacement, gutter drifts beside the lane patches, a matt gutter, and the parked-car fill's boxes off the Visibility channel, shots found on their own line, thrown people promoted from `MoveBlockedBy`, 190 m tiles and the street props seen by `FindVacancies`; the affected layers (Streets, Furniture, Soul, the lane textures, the trees manifest) rebuilt in order.
- [ ] Re-render the views the sixth-pass repair changes (`rachel`, `papineau`, `fabre`, `ruelle_mentana`, `hlm_mentana`, `corner`) and review them.
- [x] Give the parking-sign plate a form per sign family: eight faces (no stopping, no stopping in hours, no parking, no parking in hours, limited, reserved, residents' permit, disabled) with left, right and double arrows, picked per row from its code by the apply step and the preview, in the props build and the contact sheet (seventh pass).
- [x] Seventh pass, parked-car code (the pass-6 tech verify): the boxes on `BlockAllDynamic`, so no ground query by object type lands on a roof, with knocked cones stopped at a parked car on their own line; no car within 150 cm of a side-job spot; one 10 cm `CurbRise` for the curb finders, measured against the Streets OBJs; a cap on the shadow-casting sections (460; 480 from every space since the settle pass) and no distance-field lighting on the tyres and rims; thrown residents and pedestrians stopped and promoting through `ThrowAgainst`; a start time for each pending client hide; and the east extension pinned only to the road text it reads (stub syntax check, link and engine-free rules test only).
- [x] Seventh pass, streets: a plain parking line only where OSM marks the parking, lane lines 271 cm from the curb as drawn so no car stands on one, all 26 sharrows kept, the 70 cm separator with parked cars on the Brébeuf and De La Roche track sides and every car 165 cm from a drawn track, and litter outlines without straight cuts (extra rays at a cut, patches relaid smaller or left out, 60 cm ruelle sides, small cut scraps dropped); Streets, Soul, Furniture and parking rebuilt.
- [x] Seventh pass, fleet: one licence plate per car, at the rear (`prepare_seventies_cars.py`, `test_seventies_cars.py`).
- [x] Seventh pass, integration: every layer rebuilt in order (cars, trees, Plex, props, replica, parking, textures `--check`) and byte-identical on a second build; every non-gauntlet test in `Scripts`, the dry run, the rendering self-check, the parking test and the stub C++ checks run, with each failure classified against main.
- [x] Re-render the views the seventh pass changes and review them: the render pass re-rendered all ten views and `fabre_before`, and `Preview/Replica/README.md` records the rear plate only (`rachel` probe (712, 443)) and the AD-TT face (`corner` probe (513, 343)).
- [x] Seventh pass, settle (the pass-7 verifiers): parked cars 5 m from the crosswalk paint where the replica draws it (`Streets/paint_marks.json`, 2,055 spaces), the bollard bands on their posts on the separators, each street leaf clump within 30 cm of a patch and five points round where it lies apart from every patch, a shadow cap of 480 sections checked from every space, the EastDetails inventory refreshed with its run record marked historical, and the curb-stop choice in the street-life spec; Streets, Furniture, Soul and parking rebuilt, and `mentana`, `fabre`, `rachel`, `papineau`, `corner` and `aerial` re-rendered.

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
- [ ] Check that UE 5.8's OBJ importer names the tree meshes' bark and leaves slots from `usemtl` and the `.mtl` libraries, that each mesh lands at its `SM_` name, that every layer and prop mesh keeps its 1/32 cm Nanite position step, which stray materials `apply-report.json` lists under `stray_import_assets`, that `clear_instances` empties the vegetation's `Trees` component, that the red and russet groups show their tinted leaves, and the frame time with about 5,300 masked Nanite trees casting shadows and the `Leaf_Litter` patches.
- [ ] Check that a dog sniffs a street tree after the import (`FindSniffSpot` on the `NordStreetTree` replica instance actors) and that `GetInstancesOverlappingSphere` returns the right instances on 5.8.
- [ ] Check the cobra heads on the city's wooden poles, the signs hung on poles and the street props' shadows in the editor, and the residential streets' light at night.
- [ ] Parked cars, after the C++ build (rebuild the module whenever `plateau_parking.py` rewrites `LaFontaineParking.h`):
  - Run `Quebec.Parked.FillAndPromote`.
  - After the replica import, check the `NORD_PARKED` log line: about 2,055 spaces, about 1,988 shown, few left out for missing asphalt, a street prop or something already standing there.
  - With a client connected: get into a parked car with E, ram one at 11 km/h or more, throw a person into one and shoot one; on the client the space empties once the real car arrives, with no gap or doubled car, and the car goes back into its space when no player is within 100 m.
  - `car_collision_test.py` (`18cm_curb_*`, `CurbParking`), `population_test.py` and `test_race_drive.py` still pass with the fill, the 32 runtime parked cars still find their spaces, and traffic cars still drive past the filled curbs.
  - Look runs (`-NordNoAmbient`) now show the parked cars, so the reference captures change; take new ones.
  - Profile a plex street with and without `-NordNoParkedFill` on the phone-stream profile, and a run of five rams with the virtual shadow map's cached-page view: a promotion now rebuilds only its 190 m tile's components.
  - Run `Quebec.Parked.ThrownPerson`, get out of a car beside the parked row (the player lands on the road, not on a roof), and check that a chantier's cones keep their spaces empty.
  - Run `Quebec.Parked.ThrownResident`. Check that an officer on foot and a driven car stop at a parked car, that a cone knocked at one stops short of it, and that the escape job's marker on Sherbrooke Est and the Garnier delivery door's goal stand on the road, not on a roof.
  - Traffic curb stops, the two runtime chantiers and the curb bins now find the replica's 11 cm curb (`CurbRise` 10 cm). Check where they land, and that no curb stop pulls in over the parked row.
  - Look at the cars parked against the separator on Rue de Brébeuf and Rue De La Roche.
  - `RoadParkingSides` changed on 70 segments (Rue Rachel's park side and Avenue du Parc-La Fontaine's separated ways now take parking), so the 32 runtime parked cars, the traffic curb stops and the two chantiers may land elsewhere; rerun `population_test.py` and look at where they stand.
- [ ] Re-import the Car70 meshes with `Scripts/build_seventies_cars.py` (UnrealEditor-Cmd, `-NullRHI`), so every `AQuebecCar` and the parked fill lose the front plate; until then the committed `SM_Car70Body*` assets keep it.
- [ ] Check the Habitations De Mentana ruelle gutter in backlight: it is 1.37 times the lane's brightness in `hlm_mentana.jpg` (1.53 before).
- [ ] Play on a phone over the stream: graded steering, assists, combat buttons, HUD fit at 667×375 and 800×360.
- [ ] Cook, package, install with saves preserved, and check the public stream.

## Follow-up
- [x] Give the park and street trees more than one model: they stand on the species meshes from the city inventory (the apply plan is tested on the CPU; the previews and the host import are open above).
- [ ] Bring back the falling leaves: `QuebecVegetation` spawns them near its own instances, which the apply step now clears (a C++ change for a host build).
- [x] Give the 263 inventory conifers a conifer kind: 180 stand on `conifer` and 83 larches on `larch`.
- [ ] Make a chain-link texture set; a small-scale grey lattice stands in for it.
- [ ] Count the street trees, not only the yard trees, as obstacles in the laundry sight test.
- [ ] Check the 424 street-name `TextRender` signs in the editor after import.
- [x] Fill the residential curbs with parked cars: 1,900 legal spaces from `plateau_parking.py` (2,025 after the sixth-pass repair, by the city's parking signs), instanced at runtime by `AQuebecParkedCars`, promoted to real cars by E, impacts and shots (sixth pass).
- [ ] Let a traffic car's curb stop double-park beside the parked cars: the fill leaves few 20 m stretches of free curb, so curb stops are now rare.
- [ ] Let a shot hit a promoted parked car: the real car's Pawn hull ignores the Visibility channel, so shots pass through it once it is promoted. (The parked instances now find the shot on its own line, `AQuebecParkedCars::PromoteOnLine`; the real cars could use the same line test.)
- [ ] Park cars in the off-street lots (`amenity=parking` areas): the fill parks only at the curbs, so the lots in `aerial.jpg` are empty.
- [ ] Give the Car70 fleet a lower sedan roof and a white, beige, brown or silver paint: the roofs stand 164 to 177 cm over the road (a 1975 sedan is about 138 cm), and the four paints miss the commonest colours of the period. This is car art and the `PaintStyle` 0..3 contract.
- [ ] Give the `Car70` meshes Nanite or LODs: up to 122 parked cars stand within 90 m of a space, 1.64 million triangles before frustum culling.
- [ ] Give the conifer kind a pine and a cedar form. (The Colorado blue spruce's glaucous tint is done: the `blue` fall in the sixth pass, and the preview draws it, `T_conifer_blue_leaves`.)
- [x] Late-October dressing: kraft leaf bags beside the curb bins and pumpkins on the stoop landings (sixth pass; no data source places the pumpkins, so they are an art-direction choice).
- [ ] Fade the litter's edge by vertex colour if UE 5.8's OBJ import keeps vertex colour on masked Nanite (a host check first).
- [ ] Show every plate of a parking-sign pole: 346 rows carry two or three stacked plates, and each sign shows only its top one.
- [ ] Park the track sides that have no room today: Rachel's north curb would need to move out to about 9 m (about 20% of its length could then park), and Cherrier needs a wider north half; Avenue du Parc-La Fontaine's track lies 5.5 to 6.9 m out, too far for any widening.
- [ ] Check the lane wall of lot 355861162 at (-28398, -25290): it stands about 70 cm from the centreline of service road 46, and its door threshold 85 cm. The wall predates the sixth pass; check whether traffic routes there.
- [x] Refresh `Data/Plateau/EastDetails/manifest.json` (its file hashes) and mark `cpu-checks.json` as the record of its 2026-10-14 run; `test_montreal_east_details.py` now checks both (seventh pass, settle).
- [ ] Keep the parked cars 50 cm behind the stop bars: nine stand on a bar painted curb to curb 4.2 to 9 m before a junction (Beaudry, Cartier, De Lanaudière, Gauthier, Marie-Anne, Rachel, Saint-Hubert, Sherbrooke). The bars are outlined in `Streets/paint_marks.json`.
- [ ] Move the parking-sign post 106 cm from the café's pickup spot (`DeliveryCafe` in `QuebecJobRules.h`), or keep colliding Furniture 150 cm from every job spot as the parked cars are.
- [ ] Run the litter's straight-cut rule on the union of the patches on one ground: two edges in `rachel.jpg` (x 480 to 700, y 520 to 552) and `papineau.jpg` (x 1061 to 1196, y 535 to 575) pass it patch by patch but still read as cuts.
- [ ] Fix the mirrored world: negate Y across map layers, gameplay headers, campaign positions, saved actors and QA scripts, then rerun the full host QA.
