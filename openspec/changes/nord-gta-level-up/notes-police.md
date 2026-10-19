# POLICE notes: wanted stars, witnesses, police cars and officers, arrests, garage, goons

## What was built

### Pure rules (engine-free, tested here)
- `Source/Quebec/QuebecHeatModel.h` (`namespace QuebecHeat`)
  - Heat per crime, in `EQuebecCrime` order: HitPerson 30, AttackPerson 25, Gunfire 12, HitCar 6, StealCar 15, RamPolice 40, AttackPolice 60, DownPolice 120. Heat is capped at 400.
  - Stars 1–5 at 10, 45, 100, 180 and 300 heat.
  - Repeat gates: gunfire counts once per 3 s, HitCar and RamPolice once per 1.5 s, AttackPerson once per 0.4 s.
  - Heat never falls below the current star's threshold. Heat above it fades at 1 per second, so a near miss toward the next star is forgotten. At zero stars small crimes fade away; a single scrape is 6 heat, so two rams in quick succession give a star.
  - The search: when no unit sees the player, `bSearching` starts and `SearchEndsAt = now + 15 s + 10 s × stars`. When it passes, one star drops, heat moves to the new floor, and a fresh countdown starts for the lower level. Being seen stops the countdown. A witnessed crime during a search restarts it.
  - Witnesses (`InView`): an officer on foot sees a 55° half-angle out to 40 m; a police car sees 35° out to 70 m. Anything within 8 m is noticed whichever way the unit faces (this is an addition, so a unit cannot miss a crime next to it). The engine adds a line-of-sight trace. Two or more civilians within 25 m also witness a crime. Crimes against the police (RamPolice, AttackPolice, DownPolice) are always known.
  - Arrest timer: a police officer within 1.5 m of a player on foot who moves slower than 150 cm/s. The hold must last 2 s without a break.
  - Caps per wanted player: cars 1/2/3/4/4 and officers 1/2/3/4/4 for 1–5 stars. World caps: 4 cars and 4 officers. Officers shoot from 3 stars.
  - Search radius for wandering units: 120/180/250/320/400 m. Officer hit chance: 55% close, 15% at 25 m, ×0.6 against a target faster than 400 cm/s, ×0.7 against a driver.
- `Source/Quebec/QuebecPursuitModel.h` (`namespace QuebecPursuit`)
  - `PredictTarget`: Reynolds pursuit. The car aims at where the quarry will be after the time needed to close the gap, at most 1.2 s ahead.
  - `ChaseSpeed`: catch up while far (2950 cm/s beyond 120 m, 2600 cm/s beyond 30 m). Close, it is the quarry's speed plus 350 cm/s, enough to ram but never far faster than a nearby player. It stops about 10 m short of a player on foot.
  - `CornerSpeed`: brake before turns.
  - `FRoadGraph`: segment endpoints within 40 cm form one junction, as in the traffic graph. Routing is Dijkstra over open segments with a 30 m penalty for turning back. `Nearest`, `PointNear` (wander points) and `SetOpen` are also provided.
  - `Lookahead` and `TurnAhead`: pure-pursuit path following with the traffic lookahead of 450 cm + 0.3 s × speed.
- Test: `Scripts/heat_model_test.cpp` + `Scripts/test_heat_model.py`, 77 checks.

### Unreal code (`Source/Quebec/QuebecPolice.h/.cpp`)

#### `QuebecCrime` (the contract in `QuebecGTA.h`)
- `Report` passes crimes to the dispatcher. It ignores offenders that are not players and players who are down.
- `SetStars`. Without a dispatcher, as under `-NordNoPolice`, stars can only be cleared, because nothing would ever count a search down.
- `Stars`.
- `IsPolice`: officers of the police faction and cars with `bPolice`.
- `IsHostile`: goons are always hostile. A police officer is hostile only to the wanted player it chases (or to any wanted player before it has a target); a police car only to a wanted player. COMBAT limits the aim-assist threat bonus to these.
- `DecoratePoliceCar` builds the livery once per car and then only refreshes it. It can be called any number of times: from BeginPlay or ApplyPaint, and from `OnRep_Police`.

#### `UQuebecPoliceLivery`
- A scene component on the car, built on every peer.
- Paint: white through a dynamic instance of the car's own `M_Car70_Paint` (`Tint`). It is applied to the `Paint` slot of the body and roof, or to the whole body on the older box body. A 0.5 s check re-applies it after a late `ApplyPaint`. Every livery mesh and word carries the component tag `NordOwnPaint`; `AQuebecCar::BeginPlay` and `ApplyPaint` skip tagged components (shared with TRAFFIC's lamps), and `Refresh` re-applies the band, bar and lens materials. On a client `OnRep_Police` can build the livery before the car's deferred BeginPlay, which used to repaint the band in `M_CarBody`.
- Markings:
  - A blue band along each flank. It is fitted from the generator's real door width (91–96 cm, `Scripts/prepare_seventies_cars.py`), because the body bounds include the mirrors.
  - "POLICE" in navy on both sides and the back. This is generic, with no real force's logo or colours.
  - A dark light bar with red and blue lenses on the roof, placed from the cabin bounds.
- Lights: while `bSiren` is set, red and blue swap four times a second. Each lens swaps material and has a matching no-shadow point light of 900 cd. Material and intensity change only when the phase changes.
- Siren: a procedural two-tone hi-lo at 960 and 770 Hz, 0.6 s each, a soft square wave on a 24 kHz `USoundWaveProcedural` (no asset). One 1.2 s loop (576 + 462 whole cycles, so it repeats without a click) is computed once and queued by copy; nothing is synthesised per frame. Like the car engine it is not spatialised; its volume falls to zero at 90 m from the local camera.

#### `AQuebecOfficer` (contract 3)
- Body:
  - An `ACharacter` with no controller (`bRunPhysicsWithNoController`) and no navmesh.
  - The visible body is a separate skeletal mesh under a `Pose` pivot at hip height, and the pivot hangs under the empty default mesh. Network smoothing therefore still moves the body, and the tumble never fights it.
  - Police use the Quaternius `SK_MenSuit` (CC0, already imported for the Plateau pedestrians) with the suit and tie slots in `M_Navy`. They wear a cap with a black band and visor, a gold badge, a holster and a pistol, all from basic shapes.
  - Goons use `SK_MenHoodie` in `M_Ink` with a white mask and ink eyes.
  - The meshes and Walk/Idle clips are hard references in the constructor, so they cook. Without them, the officer falls back to basic shapes.
  - The walk clip plays faster for running.
- Collision: the capsule overlaps the Pawn channel, as resident collision is designed. Cars and players pass through officers. Cars knock them down through `QuebecPeople::StrikeWithCar`, `CanFitAt` and placement checks ignore them, and traffic does not stop for them.
- Steering: `AddMovementInput` toward the goal. Every 0.2 s it probes a 140 cm sphere sweep at 0°, ±35°, ±70° and ±110° against static geometry, dynamic objects and pawns, and it keeps a little separation from other officers.
- Police on foot head for what the dispatcher knows: the player while seen, otherwise the last sighting. They stop about 1 m from a player on foot and 3.5 m from a car.
- Shooting: from 3 stars, at 5–25 m with line of sight, an officer stands and fires every 1.15–1.65 s using `ShotHitChance`.
  - A hit is 8 damage through `QuebecCombat::DamagePlayer`. Against a driving player the shot aims at the car and still calls `DamagePlayer` with the driver's character; COMBAT gives the driver 50% and the car 60% and puts a knocked-out driver beside the car. An empty car takes 5 body damage.
  - The tracer, flash, word and bang come from COMBAT's `AQuebecCombatFX::PlayShot` through `MulticastAttack`.
  - Each shot alarms civilians within 25 m.
- Leaving: when the stars clear, or when the player drives more than 25 m away, an officer walks back to its car and is removed at the door. The car waits up to 8 s for the officer.
- Goons (faction 1, 60 health) chase the target player, or the nearest player who is up.
  - A punch at 1.7 m does 10 damage every 1.1 s.
  - A thrown ink blob at 4.5–14 m does 7 damage with a 45% hit chance, every 2.6 s. The blob is a sphere that flies in a 0.35 s arc on every peer and lands with `PlayImpact`.
  - Against a driving player they hurt the driver through the car the same way; an empty car takes body damage.
- `ReceiveHit`:
  - A car, a hit of 25 damage or more, or zero health starts the comic tumble from PEOPLE's `QuebecKnockModel.h` (`CarLaunch`/`HitLaunch` and `Sample`).
  - The capsule is launched with `LaunchCharacter`, and the pose adds the pitch and roll about the hips. The start time and launch values are replicated, so every peer draws the same tumble. Three gold stars circle the head while the officer is dazed.
  - Smaller hits stagger for 0.35 s.
  - At zero health the officer stays down (`IsKnockedOut`) and is removed after 9 s.
  - It returns false while down.
  - A police officer struck by a car with no player driver while a police car is within 7 m steps aside instead, so police cars never knock down their own crew.
  - It does not report crimes; `QuebecPeople::Hit` does that.
- `SpawnOfficer` places the officer on the floor under the given point and works on the server only. JOBS uses it for goons.

#### `AQuebecPoliceDispatch`
- Spawning: `AQuebecGameMode::BeginPlay` spawns it after the Toronto return, beside the campaign, side-job and pickup lines, unless `-NordNoCampaign` or `-NordNoPolice` is set. It is replicated and always relevant, so every peer builds the garage. It spawns no unit until a player has stars, so population counts and QA fixtures are unchanged.
- Per player, on the server:
  - Vision at 5 Hz from every police car and officer, using the cone, the range and an `ECC_Visibility` trace. A sighting records the last seen point.
  - The heat model runs every frame. Stars, `bSearching` and `SearchEndsAt` are sent at once with `Changed()`.
  - "SEMÉS!" shows when the last star drops.
  - The arrest timer.
  - The garage.
  - All times use the shared server clock (`GetServerWorldTimeSeconds`), the same clock the HUD and COMBAT use.
- `ReportCrime` checks for a witness: the police themselves, a police unit that sees the spot, or two civilians (`QuebecPeople::Gather`, excluding players, officers and people who are down). A witnessed crime adds heat and tells the police where the player is. When stars rise it shows "RECHERCHÉ! / n étoiles".
- Unit upkeep at 2 Hz:
  - At most one new car per pass, for the most wanted player who is short of cars, with 4 s between spawns per player.
  - Spawn points are road segments 120–200 m from the last sighting. Each must be on the road surface, out of every player's view (outside a 60° cone around the view direction, or hidden by a visibility trace; for a remote driver, whose camera the server never hears about, the view is taken from a chase camera 7 m behind the car with an 80° cone), clear for the hull, and at least 7 m from any car.
  - The car is spawned deferred like the population's cars, tagged `Police` (never CityParked or CityTraffic), then given `SetPolice(true)`, `bSiren` and the autopilot.
- Driving every frame through `SetAutopilot`:
  - Within 40 m while the player is known, the car drives straight at the predicted point, which rams a car.
  - Otherwise it follows a road-graph route to the known position, replanned every 1.5 s, and slows for corners.
  - When no unit sees the player, it drives to the last sighting and then wanders to road points within the search radius.
  - A player on foot: the car stops within 16 m, or at the road point nearest a player who is in the park, and an officer gets out on the driver's side, or on the passenger side against a wall.
  - It slows for its own officers ahead.
  - A stuck car backs out with the wheel turned the other way, then replans.
- Routing:
  - Segments that run through static geometry are closed using a 2 × 1.4 m box swept 3 m in from each end. The scan starts at the dispatcher's BeginPlay and runs 4 sweeps per server tick (about 450 sweeps, done in about 2 s), so the first star never stalls the host; until it finishes, unscanned roads count as open. The road lookup is cached per world, so `QuebecDistrict::ForWorld` is not called every frame.
  - The graph comes from `QuebecDistrict::ForWorld(World).RoadSegments`: the 806 radar segments on LaFontaine and the 663 original segments in synthetic worlds.
- Endings:
  - When the stars clear, units call off the chase. A unit hands over to another wanted player if one is short of cars. Otherwise it turns the siren off, drives toward the nearby road point farthest from every player, and is removed once out of view, or after 60 s when more than 80 m away.
  - Units more than 350 m behind and unseen for 5 s are removed, and so are cars stuck three times that nobody sees.
  - A wrecked police car lets its officer out and is removed when nobody watches.
  - A police car a player takes is a StealCar crime and becomes theirs.
- Arrest:
  - `DownState = Arrested` with `DownUntil` 4 s ahead. The stars clear at once, and the HUD gets "ARRÊTÉ! / Poste de quartier 38".
  - When `DownUntil` passes, `QuebecCombat::Respawn(…, Arrested)` returns the player to PDQ 38 with full health and only fists. COMBAT's character tick does the same; the first call wins, because the respawn clears the down state.
- Garage:
  - It sits in the right lane of LaFontaine road segment 255, a 6.2 m street 154 m south-east of the start, `QuebecPolice::GarageLocation()`. The nearest QA, job or respawn anchor is more than 60 m away.
  - The sign is a blue Montréal shop sign on two posts on the sidewalk, French first: "GARAGE / MÉCANIQUE · CARROSSERIE". The lane has a painted yellow 7.6 × 3.3 m bay and "GARAGE".
  - Driving within 6 m of the bay while no unit sees the player clears the stars, with the banner "GARAGE / Nouvelles plaques: recherche annulée". The garage then has a 15 s cooldown per player.
  - JOBS reads `QuebecPolice::GarageLocation()` for its escape job.
- Logs: `NORD_WANTED crime=… heat=… stars=… police=…`, `NORD_WANTED set_stars`, `arrest`, `garage`, `stars=… reason=search_ended`, and `NORD_POLICE spawn_car`, `despawn_car`, `spawn_officer`, `officer_down`, `roads=… closed=…`, `dispatcher garage_x/y`.

#### Native tests (`Source/Quebec/QuebecPoliceTests.cpp`)
They cannot run here.

| Test | Covers |
|---|---|
| `Quebec.Police.HeatThresholds` | Heat per crime and the star thresholds |
| `Quebec.Police.WitnessRule` | Cone and range edges for officers on foot and police cars, and the two-civilian rule |
| `Quebec.Police.SearchDrop` | The 45 s three-star search and the drop of one star |
| `Quebec.Police.DispatcherCaps` | Cars and officers per star level, world caps, and shooting from 3 stars |
| `Quebec.Police.ArrestTimer` | Arrest after 2 s; moving at 150 cm/s resets the hold |
| `Quebec.Police.RoadsAndGarage` | The graph holds all 663 segments; the starter car routes to the garage; the bay is in a lane and more than 60 m from the spawn, the starter car and the legacy objectives |
| `Quebec.Police.OfficerKnockdown` | Spawn on the floor and health per faction; `IsPolice` and `IsHostile`; a stagger, a knockdown and refusal while down; standing up; a car knocking a goon out |
| `Quebec.Police.LiveryKeepsPaint` | Decorating before the car's BeginPlay (the client order) keeps the band's own material, tag and visibility through BeginPlay and repaint; decorating again builds nothing new |
| `Quebec.Police.DispatchArrest` | In an isolated world with a possessed character, `SetStars`; an unwitnessed crime adds nothing; an attack on police gives 3 stars; the search starts at 45 s; the car cap holds; an arrest after 2 s beside an officer clears the stars; the player stands up after the banner |

#### Shared file edits
`QuebecGameplay.cpp` gets one include and the spawn line, both marked POLICE. No other shared file was changed.

## Sources
- GTA wanted levels: GTA IV ("one witness" is enough; the search re-centres when police see the player again) and GTA V (stars flash while unseen; on-foot units have narrow vision and cars moderate). See research-gameplay.md §1.
- Craig W. Reynolds, "Steering Behaviors For Autonomous Characters", GDC 1999: pursuit with a prediction interval.
- R. Craig Coulter, CMU-RI-TR-92-01: pure-pursuit path tracking. The lookahead reuses the traffic follower's 450 cm + 0.3 s × speed.
- Black Rock, "The Pure Advantage": catch up only out of sight, and never out-drag a nearby player by much.
- Cyberpunk 2077 2.0 police rework (CDPR, GIC talk): police lose interest when they lose sight.

No rendering technique is involved. The livery is made of basic shapes and existing ParkComic materials.

## Decisions and deviations
- Officers at 1–2 stars: the spec says officers leave their cars and shoot at 3 stars. Here an officer also steps out at 1–2 stars, but only to make an arrest; shooting starts at 3 stars. Without this, the arrest scenario could never happen below 3 stars. The officer cap per player is 1/2/3/4/4, inside the world cap of 4.
- The 8 m awareness range is an addition to the witness rule.
- Civilian witnesses add full heat at once. The research's 50% and 3 s delay were not used, because the brief and the spec ask for full heat.
- Units do not use roadblocks or helicopters. Not requested.

## Notes for the other owners
- PEOPLE (`QuebecPeople.cpp:288`) reports `DownPolice` when `Officer->IsDown()` after the hit. `IsDown()` is also true during an ordinary tumble the officer gets up from, so one pistol round (25 damage) counts as DownPolice: 120 heat, three stars. Use `Officer->IsKnockedOut()` for DownPolice if that is too harsh.
- PEOPLE passes the launch velocity as `Push` to `ReceiveHit`. For car hits the officer derives its own `CarLaunch` from the planar size of that push, so officers fly a little less far than residents. Harmless.
- Traffic drives through officers, because their capsules overlap pawns. Only player, autopilot and shoved cars strike people.

## Checks run here (2026-10-19)
- `python3 Scripts/test_heat_model.py`: c++ and g++ 13.3.0 and clang++ 18.1.3 under `-std=c++20 -Wall -Wextra -Wshadow -Wconversion -Wdouble-promotion -Werror -O1`, plus a pass with the Unreal macro names poisoned. 77 checks pass, with identical output on all three. Prints `NORD_HEAT_MODEL_OK 3 compilers`.
- After the review fixes, from `games/nord-unreal`: `Tools/SyntaxCheck/check.sh --both` passes all 74 compiles (37 files × game and editor, stub UE headers, UHT-style generation, clang `-Wall -Werror -Wshadow`), and `Tools/SyntaxCheck/link.sh --both` reports every used game-module symbol defined in both configurations. Earlier, a simulated unity file joining `QuebecGameplay.cpp`, `QuebecPolice.cpp`, `QuebecPoliceTests.cpp`, `QuebecPeople.cpp`, `QuebecSideJobs.cpp` and `QuebecDrive.cpp` also passed.
- Every function declared in `QuebecPolice.h`, the `QuebecCrime` namespace and `QuebecPolice::GarageLocation` has a definition. This was checked by a script.
- Not run here: no Unreal build, no automation tests, no PIE, no rendering, no audio and no phone. No visual, audio or performance claim is made.

## Host checks still needed
1. Build both targets: `QuebecEditor` and `Quebec`, Linux Development.
2. `Automation RunTests Quebec.Police` (9 tests). Then the full `Quebec.` filter, including `Quebec.District.TorontoFreeRoamIsolation`.
3. Two-player PIE on LaFontaine. Each step below needs a rendered capture review.
   - Knock down a resident near two others: one star and RECHERCHÉ!.
   - The police car appears out of view, its lights flash and the siren is audible. Check the band and POLICE text on the Car70 bodies and the light-bar height.
   - The car follows streets, rams, stops near a player on foot and lets an officer out.
   - The arrest shows ARRÊTÉ! and returns the player at PDQ 38.
   - Shots at 3 stars.
   - Losing the police: blinking, then the drop.
   - The garage clears the stars.
   - Goons in the JOBS fight.
4. Rerun the suites with their usual flags: `smoke_test.py`, `population_test.py` (`-NordNoCampaign` keeps police off) and `test_story_slice.py`. The story suite runs with police on; no star should appear unless a fixture causes a witnessed crime. If one does, add `-NordNoPolice` to that suite's launch.
5. `stat game` with four police cars and four officers in a two-viewer session.

## Open risks
- APIs not compiled against the real engine (the stubs accepted them):
  - `UCharacterMovementComponent::bRunPhysicsWithNoController`, so a pawn with no controller can walk.
  - `USkeletalMesh::GetImportedBounds()`.
  - `UStaticMeshComponent::CalcBounds(GetRelativeTransform())` for fitting the livery.
  - `ULocalLightComponent::SetIntensityUnits(ELightUnits::Candelas)`.
  - `AController::PlayerState` assigned directly in the dispatch test.
  - `UWorld::TimeSeconds` written by the tests.
  - `FConstPlayerControllerIterator`.
  - `APlayerController::GetPlayerViewPoint` on the server for remote players. On foot it depends on the client's camera updates. A remote driver sends none, because the car has no movement component to send them, so the view is estimated from the car (chase camera 7 m behind, 80° cone). A police car can still appear at the edge of the friend's view when the friend looks far to the side.
- The Quaternius rigs face +X and stand with their feet at the bounds' minimum Z. This matches the pedestrian importer, but the officer's cap, mask and holster offsets are estimated from proportions and need a visual check.
- `M_Text` may ignore the vertex colour used for the navy "POLICE" and the white garage words.
- The ParkComic palette materials are not emissive, so the lenses flash by colour swap, and the point lights carry the glow at night.
- Some surveyed radar segments run through buildings. The sweep closes most of them, but a car can still meet an unmapped obstacle; the reverse-and-replan and the out-of-view removal of stuck cars handle it.
