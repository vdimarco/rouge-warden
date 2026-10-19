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
- [ ] Rear façades for plex lots on yards and ruelles: windows and doors, galleries with posts, rear stairs, fences, sheds.
- [ ] Textured greystone and slate materials in the apply step, with previews re-rendered.

## Cloud verification
- [x] Every new and changed `.cpp` passes the stub-header syntax check with UE's Linux warnings.
- [x] Engine-free model tests pass with g++ and clang++ under `-Wshadow -Werror`.
- [x] Map CPU tests and browser unit tests pass.
- [x] Independent reviews for UE API use, replication, `-Wshadow`, pinned tests and contracts; fixes applied.
- [ ] Second review of the fix commits; confirmed findings fixed.
- [x] OpenSpec structure validated.

## Host verification (owner's PC with UE 5.8.3)
`notes-host.md` gives the exact commands and flags for each step.
- [ ] Build QuebecEditor and Quebec Linux Development; fix anything the stub check could not catch.
- [ ] Run `Automation RunTests Quebec.` (the existing tests plus 36 new ones), `car_collision_test.py`, `smoke_test.py`, `population_test.py`, `test_resident_feedback.py` and the story-slice suite with and without `-NordLag`.
- [ ] Run `Scripts/apply_plateau_replica.py` on a backed-up map, verify on a fresh load, capture the six reference views and profile them.
- [ ] Play on a phone over the stream: graded steering, assists, combat buttons, HUD fit at 667×375 and 800×360.
- [ ] Cook, package, install with saves preserved, and check the public stream.

## Follow-up
- [ ] Give the park and street trees more than one model; today one small tree repeats (`Preview/Replica/papineau.jpg`).
- [ ] Check the 424 street-name `TextRender` signs in the editor after import.
- [ ] Fix the mirrored world: negate Y across map layers, gameplay headers, campaign positions, saved actors and QA scripts, then rerun the full host QA.
