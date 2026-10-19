# People: knockdowns, fleeing and companions

## What was built

### Comic knockdown model
`Source/Quebec/QuebecKnockModel.h` holds the tumble rules. It has no Unreal includes.
- **Arc:** a ballistic arc at 980 cm/s² that lands on the measured ground height.
- **Bounce:** one small bounce (restitution 0.3), then a 0.3 s scrub along the ground.
- **Lie and stand-up:** the person lies dazed for `LieSeconds`, then stands up over 0.8 s.
- **Phases:** Airborne, Landing, Lying, StandingUp, Done. Pitch is continuous and ends in whole flips, so the body lands flat and stands up without a jump.
- **Launch rules:** `CarLaunch` and `HitLaunch` set the throw. `SpinFor` lets every peer rebuild the tumble rate from the replicated push alone.
- **Knockdown rule:** a civilian goes down under a car faster than 450 cm/s, under any weapon hit, or on the second punch within 4 s.
- **Contact test:** `SweptBoxHit` is a slab test of the car's swept box, so a fast step cannot pass through a person.

### Residents (`AQuebecParkResident`)
- **Replicated state:** `Stride` (0 route, 1 down, 2 running, 3 walking back), knock start time, origin, push, lie seconds, ground step, yaw, and the `Companion` byte.
- **Route clock:** `BeginAway` holds the shared route clock with the same formula as `Acknowledge`, but leaves the hold open. `FinishAway` closes it when the resident is back where it left the route, so `RouteTime` stays continuous.
- **Server movement:** the server moves the root along the throw. It then runs away from the cause for 2.5 s at 380 cm/s, picking a heading with the population's capsule sweep 4 times a second. Then it walks back. A social resident turns back to face its partner.
- **Visuals on every peer:** the body (or the six mascot pieces) is placed in world space from the replicated knock, so a 12 Hz root cannot make the arc stutter.
  - In the air the resident shows the crew `A_Jump` frames, which it now loads. On the ground it holds an idle frame.
  - Three gold stars (crossed basic-shape cubes) circle the head while it is dazed.
- **Existing rules kept:**
  - The worn-crew hide still runs every tick.
  - Pose work still runs only when the resident is visible and within 140 m.
  - A finished tumble pose resets even when the resident is hidden or far away.
  - Resident ticks are not throttled.
- **Greetings:** `Acknowledge` and `FindInteractableResident` ignore residents who are away.
- **Fast player cars:** in `TickResidentGreetings`, every resident and pedestrian in a fast player car's path now dives aside, away from the side of the path it stands on, at every 0.3 s scan. Before, the nearest resident stopped and faced the car. Only the warning caption still cools down.

### Pedestrians (`AQuebecPedestrian`)
- **Server:** it runs the same model on its root, which replicates at 30 Hz. It stands up facing its old heading, runs from the cause, then resumes the patrol from where it stopped.
- **Fleeing:** a replicated `bFleeing` plays the walk cycle at 2.4× speed.
- **Clients:** they tick only while a knock lasts, to animate the stars. The saved root hierarchy is unchanged.

### Players (`AQuebecCharacter`)
- **Knock state:** `StartKnock`, `EndKnock`, `IsKnocked` and `IsInputLocked` (contract 2).
  - `StartKnock` launches the player through character movement. The owning client gets the same launch through `ClientKnockLaunch`, so the server's launch does not arrive as a correction.
  - `bStayDown` is the K.-O. hold. `EndKnock` starts the 0.8 s stand-up now.
- **Input lock:** while `IsInputLocked`, `MoveForward`, `MoveRight`, `Jump`, sprint, `ServerSetSprint` and `ServerInteract` do nothing.
- **Mesh pose:** `UQuebecKnockPoser` is created on the first knock and ticks in `TG_PostPhysics`, after movement and remote mesh smoothing. It tips the mesh about the capsule centre and lowers it to the floor, then restores the mesh transform it saved. It skips swimming and driving players.
- **Pass-through:** the launched player's capsule passes through the car that hit it for 1.6 s. The car side is left to `AQuebecCar::PassStruckPerson` in `QuebecDrive.cpp`.

### The `QuebecPeople` namespace (`QuebecPeople.cpp`)
- **Coverage:** every function covers residents, pedestrians, players and officers. Officers go through the `AQuebecOfficer` contract.
- **`StrikeWithCar`:**
  - Swept-box test over the whole move, using the larger of the passed speed and the car's planar speed.
  - Skips characters attached to a car and the car's own occupant.
  - Player and officer capsules count across the whole move, and players are met 0.1 s early.
  - Only people in front of the travel are thrown.
- **`Hit`:**
  - Reports `HitPerson`, `AttackPerson`, `AttackPolice` or `DownPolice`, but only when there is an instigator. A player hitting itself is not reported.
  - Alarms everyone within 15 m.
  - Players lose health through `QuebecCombat::DamagePlayer`: 15 at 450 cm/s, rising to 70.
  - Players are knocked down only by cars. Weapons only cost them health.
- **`Alarm`:** makes civilians flee for 4 s, with at most 32 residents running at once.
- **`IsDown`:** true for the whole knock, lying included (at least 3 s for a car hit), as DRIVE requires. `IsPerson`, `IsDown` and `AimPoint` accept null and non-person actors.

### Living companions (`QuebecLife.h/.cpp`)
- **Assignment:** `QuebecLife::CompanionFor` gives a companion to some of the existing runtime walkers in `AQuebecGameMode::BeginPlay`. No actors are added. Of every 18 walkers, 3 get a dog, 2 a stroller and 2 grocery bags, which gives 12, 8 and 8 of the 72 walkers. A stroller slows its pusher to 85% pace, and that pace is set before the spawn point is sampled.
- **Rig:** `UQuebecCompanionRig` is a scene component on the resident that never ticks. The resident poses it only when its own pose runs.
- **Dog:**
  - Three sizes and five coats.
  - A trot with diagonal leg pairs at a stride that matches the ground covered, plus a tail wag.
  - A straight leash from the left hand to the collar (the right hand holds the plunger).
  - At one route-end pause it sniffs the nearest tree within 4.5 m; it searches the `AQuebecVegetation` tree instances once per pause. At the other end it sits.
  - While the owner is down it runs circles around them. While the owner runs, it runs alongside off the leash.
- **Stroller:** pushed at hand height. Its wheels turn with the distance covered. When the owner is knocked down it rolls 1.4 m and stops, then returns to the owner's hands over 0.5 s once the owner is back on the route.
- **Groceries:** the bag hangs from the hand. When the owner is knocked down, the bag tips over and three oranges roll out.
- **Imported props:** when the host has imported the Blender props, the rig uses `SM_Props_dog_<size>_<part>`, `SM_Props_stroller_<part>` and `SM_Props_grocery_bag_<part>` from `/Game/Plateau/Replica/Props`. Each part goes at its manifest `attach_cm` and pivots at its joint. Otherwise the rig builds the companion from engine basic shapes and always-cooked ParkComic materials.

## What was checked here
- `python3 games/nord-unreal/Scripts/test_knock_model.py` passes 317,407 checks on c++ 13.3, g++ 13.3 and clang++ 18.1, with `-std=c++20 -Wall -Wextra -Wshadow -Wconversion -Wdouble-promotion -Werror`, plus a strict pass that poisons the Unreal macro names. All three compilers print the same pose table.
- `scratchpad/uestubs/check.sh --both` passes all 70 module files in both the game and editor configurations. This is a syntax and warning check against stub headers only. It does not link and it does not use the real engine headers.
- Not checked here: nothing ran in Unreal. The engine build, the link, the automation tests, PIE, the look of the tumble and companions, and the network behaviour all wait for the host.

## Native tests (`QuebecPeopleTests.cpp`, host only)
- `Quebec.People.KnockPose`: checks the phases, a continuous pose, the swept box and the civilian rules.
- `Quebec.People.ResidentRouteHold`: knocks a resident down, then checks that the route clock holds until it is back. The route resumes exactly where it paused, and fleeing also holds the clock. A resident who is down does not greet, and a hidden one cannot be knocked down.
- `Quebec.People.CompanionCounts`: 96 runtime residents with 72 walkers give 12 dogs, 8 strollers and 8 grocery carriers. Joggers and social residents get none. A dog walker is still one actor.
- `Quebec.People.PlayerKnock`: covers the knock, the input lock, standing up after the tumble, the K.-O. hold, and `EndKnock` followed by the 0.8 s stand-up.
- `Quebec.People.PedestrianKnock`: the server moves the pedestrian through the throw, then it stands up upright and flees.

## Host checks still open
- Build both targets, then run `Automation RunTests Quebec.People` and the existing `Quebec.Residents.*` tests. `HiddenVisuals` and `ReactionContinuity` must still pass.
- `Scripts/population_test.py` needs a carve-out. A resident whose `Stride` is not 0 runs at 380 cm/s and leaves its route, which breaks the "never teleports" pace limit and the social-drift check. Today that happens only after a knock, an alarm or a fast player car, so a run with idle players should still pass.
- `smoke_test.py:653` needs every resident's tick interval to stay 0. This change keeps it at 0.
- In PIE with two players:
  - Drive into walkers above and below 450 cm/s.
  - Check the arc on the friend's screen.
  - Check the stars, the run away and the return to the route.
  - Hit the other player with a car: the launch, the health loss, the input lock and the stand-up.
  - Check the K.-O. hold from combat.
- Look at the dogs, strollers and bags with and without the imported props: leash ends, sniff and sit, and the stroller and bags dropped and picked up again.
- Engine APIs that could not be checked here:
  - `UHierarchicalInstancedStaticMeshComponent::GetInstancesOverlappingSphere(Center, Radius, true)` and `GetInstanceTransform(Index, Transform, true)` on a const component.
  - `USkeletalMeshComponent::SetPlayRate` after `PlayAnimation`.
  - That character network smoothing does not overwrite the knock pose set in `TG_PostPhysics` on remote peers.
  - `ClientKnockLaunch` reconciling with movement prediction on the owning client.
