# JOBS notes: side jobs, the street HUD and notices

## What was built

### Rules and places: `Source/Quebec/QuebecJobRules.h`
An engine-free header (`namespace QuebecJobRules`), compiled here by `Scripts/test_job_rules.py` with c++, g++ and clang++ under `-std=c++20 -Wall -Wextra -Wshadow -Wconversion -Wdouble-promotion -Werror`, plus a pass with the Unreal macro names poisoned. It holds every job point, the time limits, rewards, wave sizes, the arrival rule, the thief's road choice and speed, the ram bonus and the escape rule.

Places come from OSM centrelines in `Data/LaFontaine/osm.xml`, projected with the generator's formula and moved onto sidewalks or park paths. Z comes from a ground trace at runtime (static geometry only).

| Job | Marker | Points | Time | Reward |
|---|---|---|---|---|
| Livraison chaude | Rachel Est sidewalk, 25 m from the Maison des cyclistes café (-22296, 25268) | café (-23677, 23184); doors on rue De Lanaudière (-24679, 38588), rue Garnier (-14869, 40205), rue De La Roche (-38833, 23478) | 75 s, +20 s per door | 250 $ |
| Voleur de char | park-side Sherbrooke sidewalk south of Papineau (44747, 29578) | thief starts on Sherbrooke near (47568, 37601), lane away from the player | 150 s | 400 $ |
| L'encre déborde | path west of the Théâtre de Verdure bleachers (-14333, 3740) | lawn arena (-13467, 5100), radius 45 m, five spawn points | 150 s | 300 $ |
| Cinq étoiles | east Sherbrooke sidewalk at Parc-La Fontaine / Atateken (34714, -38068) | the police garage, `QuebecPolice::GarageLocation()` (≈ 50591, -17400) | 180 s | 500 $ |

Every point is at least 41 m from every QA anchor (campaign fixtures, light and loan cars, all race gates, the ink trap, the three legacy objectives, spawn, starter car, the smoke walk start) and from both respawn points. The closest is goon spawn 5 at 41.6 m.

### Side-job actor: `QuebecSideJobs.h/.cpp`
- `AQuebecSideJobs` (not a campaign subclass, `NotPlaceable`, replicated, always relevant, 10 Hz). `AQuebecGameMode::BeginPlay` spawns it after the campaign block, so it is after `if (bToronto) return;`, and skips it under `-NordNoCampaign` or `-NordNoSideJobs`. It spawns no cars at BeginPlay, so population placement and counts are unchanged.
- Replicated state: `JobIndex`, `JobState` (Idle/Running/Succeeded/Failed), `JobStep`, `StartedAt`, `DeadlineTime` (server time; clients subtract their own server-time reading), `ObjectiveText`, `TargetLocation`, `bHasTarget`, `JobProgress`, `StarterState`, `TargetActor`, `ResultSerial`, `LastJob`, `bLastSucceeded`, `LastReward`, `LastResult`, `CompletedMask`.
- Markers on every peer: a yellow disc (`M_Cream` with a yellow `Tint`, `M_Gold` fallback), a bobbing halo, a floating `M` and the job name (ASCII captions: the text-render font has no accented glyphs). They hide while a job runs. A goal disc, a 9 m column and a caption mark the café, door, theatre or garage; a paper bag waits at the café; `VOLEUR` floats over the thief's car every frame.
- E: `ServerInteract` calls `HandleInteract` after car entry/exit and the campaign. A walker within 2.5 m of a marker with line of sight starts the job. A running job, the campaign race or worklight aiming refuse with a notice. One job at a time, shared by both players; if the starter leaves, the other player inherits it.
- R: `ServerRetryCampaign` asks `QuebecJobs::HandleRecover` first. While a job runs it moves the requesting player to the job's marker (a driver to the lane beside it, with ground and clearance checks), clears what the job spawned and starts the job again. Otherwise R goes to the campaign as before.
- Fail conditions on every job: time out, starter K.-O., starter arrested, no player left. Delivery also fails when the bag carrier's car is wrecked. The thief job fails when the thief gets 300 m from every player for 10 s. The goon job fails when the starter stays 45 m from the arena for 10 s.
- Jobs:
  - Delivery: reach the café (on foot within 3 m, or a car within 5.5 m below 800 cm/s), then the three doors in order; only the player who took the bag delivers. Each door adds 20 s.
  - Thief: an `AQuebecCar` tagged `SideJobTarget`, painted, always relevant, driven with `SetAutopilot`. It follows the pruned surveyed road graph (no dead ends); at each road end it takes the onward road whose far end is farthest from the players, preferring straight, never a U-turn. It speeds up near a chaser, waits for a distant one, slows for corners and backs out when pinned. A ram from a player's car (velocity change of 450 cm/s or more within 7 m) adds `10 + Δv/50` damage on top of the car's own impact damage. `IsWrecked()` wins; so does taking the car. A walker gets a loaner (`SideJobLoan`) at the curb unless a free car waits within 30 m.
  - Goons: waves of 3, 4 and 5 `AQuebecOfficer::SpawnOfficer(..., FactionGoon)` tagged `SideJobGoon`, retargeted each second at the nearest player's current pawn. A downed or removed goon counts. The next wave comes 2.5 s after a wave is down. An unarmed player gets a pistol with 36 rounds at the start.
  - Escape: `QuebecCrime::SetStars(player, 3)`. Win at the police garage (the job clears the stars) or when the stars drop to zero after showing.
- Success pays every player state in the session (`Cash`), plays `Complete` and bumps `ResultSerial`. Steps play `Checkpoint`; starts play `Dialogue`. No new feedback sounds.
- Clean-up on every end and retry: the thief's car (kept if a player took it), every goon, and the loaner once it is empty.
- Nothing is saved. Cash and completed jobs last for the session, so no new `.sav` appears and the campaign save is untouched.
- `QuebecJobs::IsJobActive` guards race gate 0 in `AQuebecCampaign::TickRace`: while a job runs and the phase is `RaceReady`, no crossing starts the race. Car positions still update, so a stale position cannot fake a crossing later.
- Logs: `NORD_SIDEJOB ready|start|wave|retry|end`.

### Notices and street HUD: `QuebecGameHUD.cpp`
- `QuebecNotice::Show` sends `AQuebecController::ClientGameNotice(Title, Detail, Seconds)`, a reliable client RPC that sets `GameNoticeTitle/Detail/Start/Until`. It never touches `ResidentCaption`. The sender drops the same notice within 1.5 s. A different notice that arrives while one is under a second old waits and shows after it (`TickGameNotice`).
- `AQuebecHUD::DrawHUD` gains three small hooks: the street prompt before the resident prompt; with `-NordTouchControls` the mission card moves left by `StreetColumnWidth()` (158 units, only while the column shows); and one `DrawStreetHUD(...)` call at the end.
- Status column, only while something is happening (stars, search, a job, a wound, armour, a weapon, or cash that changed in the last 6 s), so the calm HUD and its QA captures are unchanged:
  - Landscape (desktop and touch): right-aligned at the radar's left edge − 8 units, from the radar's top, 150 units wide. At 1280×720 that is x 940–1090, y 96 to at most about 300. Touch frames keep it clear of the action grid (from y ≈ 352 units) and the combat buttons (from y ≈ 500 units at 844×390 and 667×375).
  - Portrait: right-aligned under `Right`, radar-wide, ending 6 units above the touch area (60 % of the height) and growing upward.
  - Rows: five stars (filled by scanlines, so no texture; they blink at 2 Hz while searching and pop on a change), weapon and ammo (`QuebecCombat::WeaponName`), health bar (red and pulsing under 25), armour bar, job timer (red and pulsing under 10 s), job title, objective (three lines at most), distance with thief damage or goons down, and cash. Floors at phone scale: stars at least 12 px, bars at least 4 px.
- Centre banners, one at a time: the K.-O. / ARRÊTÉ! overlay (dim, ink burst, respawn place and countdown from `DownUntil`), then MISSION RÉUSSIE / MISSION RATÉE for 4 s on `ResultSerial`, then the newest notice, then a RECHERCHÉ plate only for a star rise the police left silent. Notices are hidden while the player is down, so the overlay and COMBAT's or POLICE's K.-O./ARRÊTÉ notices never stack.
- Aim reticle: four red brackets turning over `QuebecPeople::AimPoint(LockedTarget)`.
- Radar blips, in DrawHUD's existing `MapPoint` transform (orientation unchanged): police cars and officers flash red/blue at 4 Hz, goons are black with a white rim, available pickups are white, job markers are yellow dots held on the rim, and the job target is a pulsing yellow dot. A screen marker (yellow chevron and distance) sits over the job target.
- A hit flashes the screen edges red for 0.3 s.

### Tests
- `Scripts/job_rules_test.cpp` + `Scripts/test_job_rules.py` (run here): placement and clearance, bounds, route length against the time limit, timers with a client clock offset, arrival rule, waves, the thief's road choice and speed, ram damage, the escape rule.
- `Source/Quebec/QuebecJobsTests.cpp` (host only):
  - `Quebec.Jobs.MarkerClearance`: every job point against the live campaign anchors, the legacy objectives, spawn, car and walk start; the table's race gates against the campaign's; the escape garage against `QuebecPolice::GarageLocation()`.
  - `Quebec.Jobs.TimersAndRetry`: idle R stays with the campaign; start, server-time countdown, R restart with full time, timeout failure and result serial, R released after the end, K.-O. failure, pistol grant, success bookkeeping.
  - `Quebec.Jobs.Cleanup`: no cars from the actor itself; the thief's tagged autopilot car and the goons are removed when the job ends or restarts.
  - `Quebec.Jobs.NoticeChannel`: notices never touch `ResidentCaption`; queueing, promotion and the sender's repeat filter.

## Checks run here
- `python3 Scripts/test_job_rules.py`: 112 assertions, 0 failures with c++ 13.3, g++ 13.3 and clang++ 18.1.3; strict poisoned pass compiles.
- Stub syntax checker `check.sh --both` over the whole module: 70 of 70 configurations pass, including `QuebecSideJobs.cpp`, `QuebecGameHUD.cpp`, `QuebecJobsTests.cpp`, `QuebecGameplay.cpp` and `QuebecCampaign.cpp`.

## Host checks still needed
- Build both targets; run `Automation RunTests Quebec.` (four new `Quebec.Jobs.*` tests) and confirm the pinned tests still pass (`Quebec.District.TorontoFreeRoamIsolation`, `Quebec.Feedback.SoundAssets`, `Quebec.Music.*`, campaign save tests).
- `test_story_slice.py` (with and without `-NordLag`), `test_compact_hud.py` at 1280 and 1920, `test_camera_touch.py`, `smoke_test.py`, `population_test.py`, `test_resident_feedback.py`, `test_race_drive.py`. None starts a job, and the column stays hidden on a calm street.
- In PIE: walk to each marker; play each job to success and to failure; R mid-job; two players sharing a job; a player leaving mid-job; the race not starting at gate 0 during a job; ground traces landing on the sidewalk at every marker, café, door and spawn point.
- Rendered captures at 1280×720, 1920×1080, 1058×488, 706×326 and 488×1058 with stars, a job and a weapon active, to confirm the column, banners and touch controls do not overlap. No browser, phone or audio check ran here.

## Unverified engine details
- Client RPCs (`ClientGameNotice`, `ClientPlaySound`) run locally in a standalone test world after `InitializeActorsForPlay`; `Quebec.Jobs.NoticeChannel` relies on this.
- `UTextRenderComponent` with the default font draws the ASCII captions; the HUD canvas font draws the accented text, as DrawHUD's `MONTRÉAL` already does.
- `LineTraceSingleByObjectType(..., FCollisionObjectQueryParams(ECC_WorldStatic), ...)` hits the Plateau sidewalks and the query-only road meshes (both WorldStatic).
- Thick `DrawLine` scanlines fill the stars without gaps at phone scale.
