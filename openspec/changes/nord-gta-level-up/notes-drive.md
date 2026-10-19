# DRIVE notes: lag-tolerant driving and the AQuebecCar street contract

## What was built

### Pure steering model: `Source/Quebec/QuebecSteerAssist.h`
An engine-free header (`namespace QuebecSteer`), compiled here by `Scripts/test_steer_assist.py` with c++, g++ and clang++ under `-std=c++20 -Wall -Wextra -Wshadow -Wconversion -Wdouble-promotion -Werror`, plus a pass with the Unreal macro names poisoned.

- `LockDegrees`, `YawRateFor`: today's lock (30° to 4.2° by 2,400 cm/s), bicycle yaw, handbrake ×1.4 above 450 cm/s and the ±110°/s clamp, reproduced exactly. The off-road path is unchanged.
- `TurnInRate`: hold 3.5/s and release 10/s as today. Off road the rule is today's exactly for every input, keyboard or analog (the test compares keyboard and analog inputs against the old rule). On a road, easing from one level to a smaller one on the same side is as quick as a release (a keyboard never sees this, because its input is 0 or full), and a graded level turns in at 3.5/s up to 1,200 cm/s and 2.6/s from 2,600 cm/s. Full lock keeps 3.5/s.
- `AssistedYawRate`: turn-in follows the steering state as today. Yaw that the state still carries beyond what the wheel now asks for, after a release or a countersteer, keeps only 25%. With |wheel| < 0.15 the car turns toward the chosen street direction at 2.6°/s per degree of error, at most 24°/s, faded in between 300 and 1,100 cm/s. Never under the handbrake.
- `ChooseRoadHeading`: of every segment within its curb half-width plus 1 m, both ways, the direction closest to the heading, up to 32° away. Segments more than 25° apart in direction mark a junction. There a residual wheel (|wheel| ≥ 0.02) picks the side it points to, and only a car already within 15° is helped.
- Collision forgiveness: `GlanceTurn` (a scrape within 30° of the wall line turns the nose along the wall at 90°/s), `FStuckWatch` (throttle held 1.5 s with less than 40 cm of progress), `ImpactDamage` (walls from 600 cm/s closing at 0.02 per cm/s; cars from 500 cm/s at 0.025, each car).

Closed loop (`Scripts/steer_assist_test.cpp`): a simulated player drives through a 150 ms input delay (also 250 ms, printed only). A keyboard player taps full lock beyond 2.5° of error. A touch player drags the graded wheel (0, ±0.33, ±0.66, ±1, the browser's bands). Two tasks: hold the street heading after a 10° swerve 2.5 m off centre, and steer back to the lane centre. Swings are counted when the heading crosses the street direction by more than 3° (and 1°) each way.

| 150 ms delay, swings over 600–2,200 cm/s (3° + 1°) | today | assist |
|---|---|---|
| Hold the heading, keyboard | 104 | 60 |
| Hold the heading, graded wheel | 0 | 0 |
| Back to the lane, keyboard | 122 | 105 |
| Back to the lane, graded wheel | 7 | 0 |

The heading RMS and the peak overshoot are lower with the assist at every speed, for both players and both tasks; for example, holding the heading at 1,000 cm/s gives keyboard 7.85° → 5.41° RMS (peak 11.1° → 7.7°) and graded 1.39° → 0.05°. Limits the numbers show:
- A keyboard player using pure bang-bang at 1,000 cm/s still limit-cycles: 17 swings today, 20 with the assist, each smaller. Only a lower full-lock yaw would cure that, and that would change keyboard feel, which stays as it is.
- In the lane task the straightening slows a touch player's drift back to the lane centre (lane RMS 51 → 72 cm at 1,000 cm/s). Any graded level (0.33 or more) switches the straightening off.

### Car integration (`QuebecGameplay.cpp`, `QuebecDrive.cpp`)
- Assist is on only for a car with a controller and an occupant that is not AI or traffic and sits within a road's half-width plus 1 m (`PrepareDriveAssist`, from `QuebecDistrict::ForWorld(...).RoadSegments` and the generated width arrays). The fixtures at (0,0) are 137 m from any road, so the six pinned `Quebec.Driving.*` tests and the traffic numbers (1,312.5 cm/s, 28°) keep their values.
- `SimulateDrive`: turn-in rate from `TurnInRate`. Yaw from `AssistedYawRate` when assisted. A turn that `CanFitAt` refuses falls back to 40% of the turn when assisted.
- `MoveWithCollision`: walls still keep tangential speed. A hard wall hit adds body damage. An assisted car turns along a glancing wall. A step too high to climb now stops only the speed into its face: a level trace 12 cm above each wheel's path finds the face, and the car slides along it (`SlideAlongStep`). A square approach still stops, so the pinned 30 cm step test is unchanged.
- Stuck nudge (assisted cars only): after 1.5 s of throttle without 40 cm of progress, the car backs 80 or 160 cm off the last wall and turns up to 30° toward the street, at the first pose where the hull fits (`NORD_CAR_UNSTUCK` log).
- Possessed cars use `SetNetUpdateFrequency(60)`; `UnPossessed` restores 30. No engine ini change: `NetServerMaxTickRate` caps a dedicated server's tick, and a listen server's only when `bClampListenServerTickRate` is set (unverified here). The host should confirm 60 Hz updates for the friend with `stat net`.
- Graded keys in `Config/DefaultInput.ini`: `MoveRight` NumPadOne −0.33, NumPadTwo −0.66, NumPadFour +0.33, NumPadFive +0.66. A grep of `Source/`, `Config/` and `Browser/` found no other use of NumPad keys (digits 1–8 are the top-row `EKeys::One`…`Eight`). `MoveRight` and `ServerSetDrive` only clamp to ±1, so graded values arrive unchanged. On foot the same keys give a slower strafe.

### Street contract (contract 1)
- `SetAutopilot`/`ClearAutopilot`/`HasAutopilot`: on the server only, and ignored while a player drives. Each Tick copies the AI inputs into `Throttle`/`Steering`/`bHandbrake` and runs the player handling branch. The 0.5 s remote-input failsafe does not apply. The first `SetAutopilot` turns a traffic car into an AI car for good (`bTraffic=false`, route and junction released, tick every frame). `ClearAutopilot` restores the tick interval the car rested at before (0.05 s for a former traffic car, 0.1 s for a parked one), but only once the released car stands still (speed and lateral speed under 1 cm/s, not sliding from a shove): it brakes on every-frame ticks, so neither peer sees it step at 10 Hz. A player or a new AI driver taking over before then keeps every-frame ticks. After a shove an AI car drives on. Possession clears the autopilot.
- `bPolice` (`OnRep_Police`), `SetPolice`, `bSiren`, `BodyDamage`, `AddBodyDamage`, `IsWrecked`, `GetDriverController` (controller only when an occupant sits in the car). `ApplyPaint` re-applies `DecoratePoliceCar` after a repaint, so the decoration must be idempotent; POLICE's `UQuebecPoliceLivery::Refresh` says it builds its pieces once.
- Wreck (100): throttle ignored (coasts; steering and brakes work), siren off, traffic route dropped, `NORD_CAR_WRECKED` log. Smoke on every peer from 60 damage: swelling basic-shape spheres (`M_White` steam, `M_Dark` smoke on a wreck), 7 pooled per car, animated by the car's own tick (a parked wreck steps its smoke at 10 Hz and traffic at 20 Hz; the smoke never changes the tick interval, so it never wakes the car simulation), spawned only while the car was rendered within the last second, and for 30 s (90 s for a wreck) after the last hit. No suitable source fit: the usual technique is a Niagara sprite emitter (Epic's smoke templates), which needs an authored system the cloud cannot create, so these puffs stand in until the host authors one.
- Strikes: each authority Tick keeps the location before the move. After the move, a player-driven, AI or shoved car calls `QuebecPeople::StrikeWithCar` and `QuebecTraces::StrikeProps` (From, To, planar speed). Player and officer capsules block the hull sweep, so `PassStruckPerson` handles that hit inside `MoveWithCollision`. Below 450 cm/s closing speed the car stops as before. At 450 cm/s or more it calls `StrikeWithCar` over the whole intended travel; when the person is down, the car ignores their capsule (`IgnoreActorWhenMoving`, and in `CanFitAt`) for at least 1.5 s and while they stay down, loses 10% speed and drives on. Traffic is never a striker, so `Quebec.Traffic.BlockedApproach` keeps its behaviour. Residents keep no collision.
- `QuebecTraces::TickCar` runs every frame on every peer while the car moves faster than 1 cm/s.
- Car-to-car: both cars take `ImpactDamage`. When the striking car has a player driver and the struck car has a driver (police, traffic, AI or occupied), it calls `QuebecCrime::Report(Driver, RamPolice or HitCar, contact point)` above 300 cm/s closing speed, at most once a second.

## Tests
- Here: `python3 games/nord-unreal/Scripts/test_steer_assist.py`: 89 assertions, 3 compilers, `NORD_STEER_ASSIST_OK`.
- Native, new in `Source/Quebec/QuebecDriveAssistTests.cpp` (not run here): `Quebec.Driving.GradedSteering` (ini mapping, a third and two thirds against full lock, quick easing, remote graded RPC), `Quebec.Driving.AutopilotWithoutController` (60/30 Hz, traffic to AI, drives and steers with no controller, release brakes to a stop, possession ends it), `Quebec.Driving.WreckedCarCoasts`, and `Quebec.Driving.RoadHeadingAssist` (straightens on the longest surveyed street; off road the heading stays at 12°; a graded turn is not fought; leftover yaw after a release is damped).
- Stub syntax check (`scratchpad/uestubs/check.sh --both`): `QuebecDrive.cpp`, `QuebecDriveAssistTests.cpp`, `QuebecGameplay.cpp` and `QuebecCarHandlingTests.cpp` pass in the game and editor configurations.

## Host checks still needed
1. Build both targets. Run `Automation RunTests Quebec.Driving` and `Quebec.Traffic`, plus `Quebec.Browser.InputRelease`. All earlier numbers must still hold.
2. Phone over the stream, one and two viewers: graded wheel on Rachel and Papineau, a released wheel straightens, junction turns are not pulled back, and keyboard feel is unchanged.
3. `stat net` on the host: the friend's car updates at 60 Hz.
4. PIE: drive into the other player at more than 450 cm/s (they tumble and the car passes) and at walking pace (it blocks); ram a traffic car (HitCar heat) and a police car (RamPolice); wreck a car (smoke, no throttle); scrape a wall at a shallow angle; hold throttle against a wall for 1.5 s.
5. Police livery after a repaint and on a late-joining client, so `DecoratePoliceCar` runs more than once.
6. `Scripts/test_race_drive.py` (rendered M2 route) steers with analog `MoveRight` values and does not brake for traffic. On streets its car now gets the road assist: straightening while |steer| < 0.15, damped yaw when its steer eases, and quick easing to a smaller level. Traffic now stops at ARRÊT signs, waits for people and pulls to the curb (TRAFFIC). The host may need to update that script's steering gains and add braking behind stopped cars before its numbers are compared with older runs.
