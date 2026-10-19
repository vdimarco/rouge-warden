# TRAFFIC notes: stops, yielding, curb stops and street traces

Scope: ambient traffic behaviour in `AQuebecCar::UpdateTraffic`, the `QuebecTraces` contract (tyre marks, knockable street props), and their tests. Nothing here was compiled by Unreal or run in a game. Every native claim below is open until the host builds and runs it.

## What players see
- **ARRÊT stops.** A traffic car approaching a mapped stop sign brakes gently (about 3 m/s²) and stops with its centre about 9.5 m from the junction centre (front bumper about 7.3 m out, behind the crosswalk). It stays below 30 cm/s for at least 0.8 s, then enters through the existing junction reservation. If another car holds the junction it keeps waiting. A car following a stopped car stops behind it and makes its own full stop at the line.
- **Giving way to people.** Traffic slows for any resident, pedestrian, player or officer standing in its lane up to 8 m past the front bumper, and stops at least 2.5 m short of them. Residents and pedestrians have no collision, so the test uses positions (a 3.8 m wide lane box ahead of the car), not physics. A person on the sidewalk does not hold traffic. If someone stands in the lane for 15 s, the car creeps past at 2.3 m/s for 4 s instead of blocking the street forever.
- **Curb stops.** Each traffic car gets a seeded schedule: its first stop comes after 2–5 minutes, then one every 3–5 minutes. The first stop is never earlier than 120 s, so all 16 cars are still moving when `Scripts/population_test.py` samples traffic motion at about 65–75 s of world time. When a stop falls due, the car stops only on a stretch of street that meets all of these conditions:
  - curbside parking is allowed on its right (`RoadParkingSides`);
  - the stop point is 22 m ahead of the car and at least 24 m before the segment end, so it is never at or near a junction;
  - no ARRÊT approach is ahead;
  - a real raised curb (12–32 cm above the road) puts the stopped car 3.75–6 m from the centre line, so its inner side clears passing traffic;
  - the curb lane is free of parked cars, people and posts from 16 m before the stop point to 4 m past it;
  - no other car is pulled over within 40 m, and fewer than three are pulled over in the whole map;
  - the campaign race is not ready or running.

  The car signals right, slides its steering target toward the curb and stops with **hazard lights** for 15–40 s. It then signals left, waits for a gap in the lane (nothing from 25 m behind to 4 m ahead) and merges back over 15 m. A pull-in blocked for 14 s parks briefly where it is and then rejoins traffic.
- **Lamps.** The lamps are four small amber blocks at the body corners, using `M_Light` tinted through a `Tint` parameter when the material has one. They blink every 0.35 s and are built only for cars that signal. The lamps carry the component tag `NordOwnPaint`, so the car's `BeginPlay` and `ApplyPaint` leave them alone, and the amber paint is re-applied every time a lamp lights. This covers a client that receives a signalling car and builds the lamps before its BeginPlay. A car that leaves traffic turns its lamps off and drops the stop-sign hold, yield wait and curb manoeuvre within 0.35 s (`ClearTrafficLife`). This covers a player taking the car, an autopilot taking it (police or side jobs) or the car being wrecked.
- **Tyre marks.** Thin near-black quads (`/Engine/BasicShapes/Plane` with `M_Dark`) appear under the rear tyres while a car slides sideways, handbrakes above 4.5 m/s or brakes harder than 19 m/s² above 6 m/s. Ambient traffic, which brakes on its handbrake at every stop, never marks the road unless it is sliding after a hit. Marks stay whole for 75 s, narrow away and disappear at 90 s. A world holds at most 300 marks, and when full the oldest mark is reused. The marks live in one instanced component per world on each peer and are never replicated.
- **Knockable street props.** At most 60 replicated actors (`AQuebecStreetProp`) are spawned at the end of `AQuebecGameMode::BeginPlay`, after the parked cars, on the surveyed streets nearest the spawn:
  - two "chantier" work zones, each fencing 10 m of parking lane with 10 cones (70 cm Québec cone on a black base with a reflective band) and an orange-and-white barricade at each end;
  - up to 18 collection-day pairs at the curb, each a 360 L recycling bin (the older green model, or about one in three the newer blue one) beside a brown organics bin, fronts to the street.

  A car that passes over a prop knocks it into a short comic hop, and the prop tips onto its side and slides. Walls, parked cars and people stop the flight; the low curb does not. Every peer computes the same tumble from the replicated hit time, rest point, push direction and spin. The prop stays where it fell and stands up again after 120 s. If a player is within 15 m it waits in 10 s steps, at most six times. Props have no collision, so walkers pass through them and traffic and population checks are unaffected.

## Files
- `Scripts/prepare_lafontaine_stops.py` → generated `Source/Quebec/LaFontaineStops.h` (`LaFontaine::StopApproaches[14][2]`, `StopSegments[14]`, `StopApproachCount` with `static_assert`s). It matches each OSM `highway=stop` node, with its `direction` tag (forward by default), to the first junction of `LaFontaine::RoadSegments` ahead of it on the same street, within 20 m. `stop=all` adds every graph approach into that junction. Result: 14 approaches at 9 junctions. 12 of them are on circulating roads. The other 64 mapped stops are on streets outside the 663-segment traffic graph. Guarded by `Scripts/test_lafontaine_stops.py`, which also proves that the junction `Quebec.Traffic.BlockedApproach` uses has no stop, so that test's timing is unchanged.
- `Source/Quebec/QuebecTrafficModel.h`: engine-free rules (`FStopGate`, `LaneGap`/`FYield`, `FCurbSite`/`CurbStopAlong`/`FCurbStop`, `IsSkidding`/`FMarkRing`, `SweptBoxTouches`, `KnockTravel`, `Tumble`). Tested by `Scripts/traffic_model_test.cpp` and `Scripts/test_traffic_model.py`, with the car's real traffic throttle and brake response copied in.
- `Source/Quebec/QuebecTrafficLife.cpp`: `AQuebecCar::UpdateTrafficLife`, `ClearTrafficLife`, `SetTrafficSignal`, `OnRep_TrafficSignal`, `BlinkTrafficSignal`.
- `Source/Quebec/QuebecTraces.h/.cpp`:
  - `QuebecTraces::TickCar` and `StrikeProps`;
  - `QuebecStreet::FindCurb` and `GroundAt`;
  - `AQuebecStreetProp`, including `SpawnStreetProps` (log line `NORD_TRACES street_props=… chantiers=… bin_pairs=…`);
  - `AQuebecTraceMarks`.
- `Source/Quebec/QuebecTrafficTests.cpp`: `Quebec.Traffic.StopSignFullStop`, `Quebec.Traffic.YieldToPeople`, `Quebec.Traffic.CurbStopClearOfJunctions`, `Quebec.Traffic.TracePoolCap`, `Quebec.Traffic.StreetPropKnock`. This adds 5 native tests.
- Shared edits, each small and marked in a comment:
  - `QuebecGameplay.h`: the `Engine/TimerHandle.h` and `QuebecTrafficModel.h` includes, and a traffic-only private block at the end of `AQuebecCar`.
  - `QuebecGameplay.cpp`: the `QuebecTraces.h` include, the curb shift on the steering target and the `UpdateTrafficLife` call in `UpdateTraffic`, `DOREPLIFETIME(AQuebecCar, TrafficSignal)`, and the `SpawnStreetProps` line at the end of `AQuebecGameMode::BeginPlay` (after the Toronto return, so Toronto spawns nothing).

## Decisions
- **Pinned behaviour stays.**
  - With no curb manoeuvre, the shift on the steering target is exactly zero.
  - The traffic dynamics in `SimulateDrive` are untouched, so the 1312.5 cm/s / 28° fixture holds.
  - The stop-sign and yield rules only lower the desired speed.
  - In `BlockedApproach` the obstacle character is beyond the 8 m reach of the crossing car and outside its lane, and its junction has no stop.
  - The curb schedule's first stop is at least 120 s away (it was 60 s; a 15–40 s stop could then cover the population test's 65–75 s motion window).
- **Clock.** Traffic timers use real time between updates (capped at 0.25 s). Test worlds, whose world clock is frozen, advance by the 0.05 s tick interval.
- **Signal state.** The replicated signal byte is the only new car replication. Lamps are local components built on first use. Props replicate a handful of values and never their movement.
- **Curb detection.** Curb stops and props detect the curb from geometry (a raised walkable step 12–32 cm high, consistent over three samples 2.35 m apart), the same rule the runtime curb parking relies on. They therefore follow the new Plateau streetscape's 18 cm curbs when the host imports it. Where no curb is found, nothing is spawned and no curb stop happens.
- **Montréal reference.** The recycling bin is green or blue because the city's 360 L recycling bins are generally green and new ones are blue; organics bins are brown ([montreal.ca: collection bin models](https://montreal.ca/articles/les-modeles-de-bacs-de-collecte-49215), [recyclables collection](https://montreal.ca/collectes/collecte-des-matieres-recyclables), [organics in Le Plateau-Mont-Royal](https://montreal.ca/demarches/connaitre-les-modalites-de-la-collecte-des-matieres-organiques)). The city asks residents to set bins at the edge of the lot, not on the sidewalk. The brief asked for bins at the curb, so they stand on the sidewalk 50 cm from the curb face. Move them back to the lot line if the owner prefers strict accuracy.
- **Rendering sources.**
  - The tyre marks adapt the common game "skidmarks" technique: per-wheel streaks of thin quads laid every metre or so while a tyre slips, kept in a fixed-size circular buffer that reuses the oldest section (the Unity community `Skidmarks` script and Edy's Vehicle Physics follow this pattern). Here each section is one instance of an engine plane in an instanced static mesh component, so it needs no new asset. Decals were not used because no suitable decal material exists in the content.
  - The prop tumble reuses this change's knockdown approach (design.md, "People and knockdowns"): a deterministic arc, tip and slide from a replicated start time instead of physics.

## Checked here (cloud container, 2026-10-19)
- `python3 Scripts/test_traffic_model.py`: c++, g++ 13.3 and clang++ 18.1 each ran 473 checks with 0 failures, under `-std=c++20 -Wall -Wextra -Wshadow -Wconversion -Wdouble-promotion -Werror` plus a strict pass with the Unreal macro names poisoned. Measured with the copied traffic dynamics:
  - a stop with the centre 986 cm from the junction, holding 0.80 s and reaching the junction after 6.8 s;
  - a yield gap of 251 cm to a standing person;
  - a curb stop at 27.6 m for 17.2 s.
- `python3 Scripts/test_lafontaine_stops.py`: 14 approaches, the header is current, it compiles standalone, and the BlockedApproach junction has no stop. `test_lafontaine_lamps.py` and `test_road_widths.py` still pass.
- `uestubs/check.sh --both` passes on `QuebecTraces.cpp`, `QuebecTrafficLife.cpp`, `QuebecTrafficTests.cpp` and `QuebecGameplay.cpp` in both the game and editor configurations. In `--no-pch` mode every module file fails, including untouched ones such as `QuebecMusic.cpp`, because `QuebecGameplay.h` uses `UStaticMesh` without a forward declaration. That gap predates this change and the shared PCH hides it.
- An offline replay of the curb manoeuvre's lateral motion (traffic steering law) puts the stopped car 4.0 m from the centre line and back to 1.64 m one second after the merge.

## Host steps (not run)
1. Build both targets.
2. Run `Automation RunTests Quebec.Traffic` and the full `Quebec.` filter. `Quebec.Traffic.BlockedApproach` and `ClosedRoadGraph` must still pass.
3. Run `population_test.py`, `smoke_test.py` and `test_traffic_circulation.py` on LaFontaine. Check the `NORD_TRACES` log counts.
4. In a rendered PIE session, look at:
   - a car at the Mentana/Duluth all-way stop;
   - traffic giving way at a park crossing;
   - one curb stop with hazard lights (to force one, temporarily shorten `CurbFirst`);
   - handbrake marks;
   - knocking cones in a work zone, and the props after a client joins late.
5. Confirm the amber tint on `M_Light`. If `M_Glow` lost its `Tint` parameter, the lamps show warm white.

## Risks and open points
- **APIs used without confirmation:**
  - `UInstancedStaticMeshComponent::SetCullDistances(0,9000)`, `AddInstance(Transform,true)` and `UpdateInstanceTransform(Slot,Transform,true,bDirty,true)`;
  - `#include "Engine/TimerHandle.h"`;
  - `AGameStateBase::GetServerWorldTimeSeconds()` cast to float;
  - `LineTraceSingleByObjectType(ECC_WorldStatic)` finding the query-only road surfaces (the car's `WheelSupport` already relies on it);
  - `/Engine/BasicShapes/Cone.Cone`, and centred pivots on the basic shapes.
- **Cost.** Each traffic car gathers the people within 20 m at about 7 Hz (three class scans), then tests their live positions on every 20 Hz update. That is about 5 scans per host frame, down from about 33 when every update scanned. Car strikes on props read a per-world list instead of scanning the actor list per striking car per frame. A prop joins the list in `PostInitializeComponents` and again at the end of `SpawnProp`, because a world that has not run `InitializeActorsForPlay` (the native test worlds) skips `PostInitializeComponents`; joining twice is harmless. A destroyed prop leaves the list in `Destroyed`, and stale entries are pruned whenever a prop joins.
- **Few mapped stops.** OSM maps only 14 stop approaches on the traffic graph, so most junctions still flow without stopping. Adding more needs better source data, such as the city's `panneaux-de-signalisation` RA-A signs, which the cloud could not download.
- **Late joiners.** A client that joins while a prop is mid-tumble sees it jump to the current pose, which is harmless. Marks are local to each peer, so two players can see different marks.
