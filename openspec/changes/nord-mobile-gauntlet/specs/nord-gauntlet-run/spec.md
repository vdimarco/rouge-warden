## ADDED Requirements

### Requirement: Fixed Plateau loop
A gauntlet run SHALL drive the player's car with no player input through five fixed stops in the Plateau part of `/Game/Maps/LaFontaine` (S1 Sherbrooke, S2 Papineau, S3 Fabre, S4 RachelPark, S5 Mentana) and back to S1 on the LaFontaine road graph, with the sky pinned and frozen.

#### Scenario: Loop completes
- **WHEN** the host runs a stream-mode gauntlet and one phone-sized viewer watches NordHost
- **THEN** the viewer sees the player's car drive from S1 to S5 and back to S1 with no input, pause at each stop, and stop within 8 m of where it started
- **AND** the game log has one `NORD_GAUNTLET stop=` line per stop in route order, the lap takes at most 6 minutes with no stall longer than 10 s, and the run folder holds `native/route.json`
- **AND** offline, `test_gauntlet_model.py` passes: the route closes, its length is 3.0 to 4.0 km (the modelled driven line is 3,488 m), and a kinematic car at 30 Hz and at 120 Hz completes the loop with a lateral error under 2.5 m and no stall

#### Scenario: Viewer input ignored
- **WHEN** the viewer drags on the stream during the whole gated lap (the input row, `gauntlet_loop.py stream --look`)
- **THEN** the car keeps its path, and the largest lateral error in `native/route.json` stays at most 2.5 m
- **AND** the input row's `verdict.json` gates that lateral error and the exit code, and keeps its stream figures report-only, and a stream lost inside the lap while NordHost drove on fails it, which `test_gauntlet_loop.py` checks
- **AND** the input row reads unverified, never pass, unless NordHost's `--look` sample covers the whole gated lap, which the runner followed live (`drags_cover_lap`), so a sampler killed at the runner's limit, one that never reached the page, one that crashed in the middle of the lap, a sample without the `--look` sweep, or a `stream` command started after the lap began gives no input evidence, which `test_gauntlet_loop.py` checks
- **AND** `gauntlet_loop.py route <stream run>` checks the stop order and the lateral error of the same run
- **AND** the round report needs an input row from each ranked candidate, a ranked baseline too: a failed input row drops the candidate, also when a newer one passed, and a missing one, or a newest one that is contended, unverified or has no verdict, is missing evidence, which `test_gauntlet_loop.py` checks

#### Scenario: Gameplay state during a run
- **WHEN** a perf or stream run starts
- **THEN** ambient traffic and residents move as in normal play, and no police unit, campaign step, side job or save write happens, because `run.json` records `-NordNoPolice -NordNoCampaign -NordNoSideJobs -NordNoCampaignSave`
- **AND** a look run also records `-NordNoAmbient`, so its stills show an empty street and repeat

#### Scenario: Sky not pinned
- **WHEN** a gauntlet run starts without both `-NordHour=` and `-NordWeather=`
- **THEN** the game exits with code 3 before the car moves, and `browser_streaming.py` refuses `NORD_STREAM_GAUNTLET` unless `NORD_SKY_ARGS` has both flags
- **AND** `test_gauntlet_loop.py` and `browser_streaming.py self-check` cover both refusals

#### Scenario: Run cannot be set up
- **WHEN** a gauntlet run starts with an unknown mode, on another map, or where no loop through the stops avoids turning back
- **THEN** the car does not move, and the game exits with code 6 (setup) and an `error=` log line that names the reason, not with a driving failure

#### Scenario: Stops follow the replica cameras
- **WHEN** the camera list in `Data/Plateau/ReplicaGeometry/Streets/manifest.json` changes, for example after the mirror fix flips Y
- **THEN** `test_gauntlet_route.py` fails until `make_gauntlet_route.py` regenerates `QuebecGauntletRoute.h`

### Requirement: Phone-stream frame budget
With the phone profile at phone-stream sizes, the native render SHALL hold a 33.3 ms FrameTime p95 over the measured lap and on each leg, and the other frame limits over the lap, while the 60 FPS cap stays on.

#### Scenario: Night rain, top phone frame
- **WHEN** a perf run renders 1412x652 at 22:00 in rain with the phone profile, and the warm-up lap is discarded
- **THEN** FrameTime p95 is at most 33.3 ms over the lap and on each of the five legs
- **AND** over the lap, FrameTime p99 is at most 50 ms, at most 1% of frames take longer than 50 ms, there is at most one hitch (a frame longer than 66.7 ms) in any 30 s of frame time, and no frame takes longer than 250 ms
- **AND** peak VRAM per game process is at most 6,000 MiB, `render_log_guard.py` finds no errors, and every profile CVar reads back as requested
- **AND** `verdict.json` from a 3-lap confirmation (median of the per-lap p95 values) shows each of these gates as pass

#### Scenario: Portrait
- **WHEN** the same run renders 652x1412
- **THEN** the same limits hold, and `verdict.json` shows them as pass

#### Scenario: Day
- **WHEN** the run is pinned to 15:00 with clear weather, in landscape and in portrait
- **THEN** the same limits hold, and `verdict.json` shows them as pass

#### Scenario: The 60 FPS cap stays on
- **WHEN** any gauntlet run starts
- **THEN** `run.json` records `t.MaxFPS 60` in the CVar readback, and `verdict.json` reports GPUTime next to FrameTime, so the headroom below the 16.7 ms floor is visible

### Requirement: Stream delivery to a phone-sized client
A phone-sized client watching NordHost alone over a direct connection SHALL receive at least 29 real decoded frames per second over the loop at both pinned phone rungs, in landscape and in portrait.

#### Scenario: Solo, landscape and portrait, both rungs
- **WHEN** one phone-sized sampler watches NordHost over a direct connection during the gated stream-mode lap, which follows a warm-up lap that is not gated, with NordFriend1 asleep, pinned first to rung 0 (1412x652 and 652x1412) and then to rung 1 (1058x488 and 488x1058)
- **THEN** mean decoded FPS is at least 29 over the lap, there are zero WebRTC freezes, at most 1% of decoded frame intervals are longer than 50 ms, the longest gap is at most 500 ms, and the jitter buffer delay averages at most 120 ms per frame
- **AND** `NORD_STREAM_FPS` is at least 29 in every 5 s window, decoded FPS is within 3 FPS of it, and `stream/sample.json` and `verdict.json` record each value
- **AND** the 120 ms jitter buffer limit is the player's own lag rule (`receiverLagging` in `Browser/config.mjs`), a check of stream health and not a delay target, and it is the only delay figure with a limit
- **AND** NordFriend1 logs no awake `NORD_STREAM_FPS` window inside the lap

#### Scenario: Frames cut to the lap
- **WHEN** the runner judges a stream sample
- **THEN** it keeps only the decoded frames whose wall time (`timeOrigin` plus `expectedDisplayTime`) falls inside the gated lap of the host log
- **AND** a sample without `timeOrigin` gets "unverified" for the interval share and the longest gap, never pass

#### Scenario: Lap end
- **WHEN** the host logs the end of the drive (`done` or `fail`)
- **THEN** the runner writes `END` to the sampler's trigger file, and the sampler takes one last sample and stops
- **AND** the runner follows the host log on to its `result` line, for at most the CSV wait and 15 s, before it judges the run, so the verdict has the exit code and `native/route.json`, which `test_gauntlet_loop.py` checks with a host that logs its result line after the sampler quit
- **AND** a sample whose stream ended before `END`, or before `--seconds` without a trigger file, keeps its summary up to the stream end but does not pass and exits non-zero, which `stream-sample.test.mjs` checks
- **AND** when no `END` comes, for example after a host crash before its `done`, `fail` or `result` line, the sampler stops 10 s after its last sample with a connected peer, not at `--seconds`, and a peer that connects again within 10 s keeps the sample going, which `stream-sample.test.mjs` checks with the fake plan
- **AND** a stream that went away inside the gated lap and did not come back fails a solo, input or two-viewer row (`stream_lost_in_lap`) while NordHost drove on, because its exit 0 is logged or its process still ran when the runner stopped following the log, leaves a relay row, which gates nothing, unverified, and leaves that gate unverified after a host crash, which `test_gauntlet_loop.py` checks

#### Scenario: Pinned frame size
- **WHEN** a sample runs with `?pin=` on a player built with `NORD_QA_PIN`
- **THEN** the requested and received frame size stay the same for the whole lap, the received size equals the pinned rung's size in that orientation, and the sample records every size change
- **AND** a production player build ignores `?pin=`, which `config.test.mjs` checks
- **AND** `gauntlet_loop.py stream` refuses a `--pin` rung that has no size in `loop.json` for that orientation before it starts anything, which `test_gauntlet_loop.py` checks

#### Scenario: Two viewers and relay
- **WHEN** one sampler watches each slot at the same time, or a sampler forces the TURN relay
- **THEN** `review.html` and `verdict.json` show their frame figures in a section labelled "report-only", and those figures do not change the gate result
- **AND** the row's status is "report-only", and `stream` exits 0, when its values are whole: for two viewers, every slot decoded frames inside the lap, and NordHost's `game_exit`, `stream_lost_in_lap`, `received_size`, `size_changes`, `cvar_mismatches` and `gpu_process_samples` gates passed, so the co-op guard counts it; for the relay, every stream figure has a value, NordHost's drive ended with exit 0 and the stream stayed through the lap
- **AND** a row that is not whole is "unverified", and a row that a foreign GPU process shared is "contended", so the host samples only those again, which `test_gauntlet_loop.py` checks
- **AND** a two-viewer row where one of those NordHost gates failed, such as a drive that failed inside the lap (a logged exit other than 0), a stream that went away inside the lap while NordHost drove on, another received size or a size change inside the lap, is "fail" and `stream` exits 1, as for a solo row, which `test_gauntlet_loop.py` checks
- **AND** one `gauntlet_loop.py stream --two-viewers` command starts one sampler per slot and records the two-viewer row
- **AND** `stream` offers only `--slot NordHost` and refuses `--slot NordFriend1`, because a NordFriend1 row alone wakes NordFriend1, and refuses a second `stream` command on a run that already has a `stream/` folder, which `test_gauntlet_loop.py` checks

### Requirement: Delay reported apart from frame rate
Each stream run SHALL report delay (round-trip time, jitter, jitter buffer delay and target, decode, processing and end-to-end delay) in its own section, apart from frame-rate results. The delay section SHALL NOT be gated. The only delay figure with a limit SHALL be the mean jitter buffer delay per frame, which the stream gate also checks as stream health.

#### Scenario: Delay section
- **WHEN** a stream run finishes
- **THEN** round-trip time, jitter, jitter buffer delay and target, decode, processing and end-to-end delay appear in their own section of `review.html` and `verdict.json`, with the gated lap's own values, labelled "host-PC headless Chromium with --disable-gpu, not a phone, not off-LAN"
- **AND** that section is marked as not gated, and no frame-rate result cites a delay figure
- **AND** the stream gate's `jitter_buffer_ms_per_frame` limit of 120 ms is the only limit on a delay figure, and no limit applies to round-trip time, jitter, the jitter buffer target, decode, processing or end-to-end delay

### Requirement: Fixed views and a repeatable look run
A look run SHALL capture the same fixed views at each stop for each sky and size, and the reference capture SHALL repeat closely enough to compare candidates.

#### Scenario: Stills
- **WHEN** a look run finishes
- **THEN** the run folder holds 10 views per sky at each size, an eye view and a chase view at each stop, with the HUD off, named `look/<sky>/<stop>-<view>-<WxH>.png`

#### Scenario: Settled sky at each stop
- **WHEN** a look run switches between day and night rain at a stop
- **THEN** the new weather and the street wetness are settled before the stills, as at a start with `-NordWeather=`, so the day stills show dry streets and no still changes with the frame rate
- **AND** the game log has a `NORD_SKY_WEATHER command <weather> settled` line for each switch

#### Scenario: Repeatable reference
- **WHEN** the ceiling profile is rendered twice with the same build, sizes and skies
- **THEN** the luma SSIM between the two runs is at least 0.98 on every image, otherwise the round is marked invalid in `verdict.json`
- **AND** a reference whose ceiling runs lack a still fails its `repeat_stills` gate, and `tune --reference` refuses it before it starts a run
- **AND** `tune --reference` also refuses, before it starts a run, a reference with a ceiling run that a foreign GPU process contended

#### Scenario: Review page
- **WHEN** the user opens `review.html` for a round
- **THEN** each view has one row with the ceiling, baseline, candidate and decoded stream frame, each tile shows its SSIM and a difference map, and a click flips between baseline and candidate
- **AND** the user's verdict on the look is final

### Requirement: Honest evidence
Every gauntlet result SHALL state whether it passed, failed, was not measured or ran under contention, and failing results SHALL stay on record.

#### Scenario: Missing host run
- **WHEN** a round has no host run for a gate
- **THEN** `verdict.json` marks that gate "unverified", and the round report says "unverified, not pass"

#### Scenario: Foreign GPU process
- **WHEN** another GPU process runs before or during a run
- **THEN** `verdict.json` marks the run "contended", lists the processes, and the tuner never ranks it
- **AND** the stream lifecycle's own processes never count as foreign: `stream` refuses a lifecycle that is still starting, before the launcher prints "NORD host and friend are connected", and starts nothing, so a NordFriend1 launched after the command cannot mark the row contended, which `test_gauntlet_loop.py` checks

#### Scenario: Failing result
- **WHEN** a committed round fails a gate
- **THEN** its `Verification/Gauntlet/<YYYYMMDD>-<label>.json` stays in the repository with the failing value and limit

#### Scenario: Physical phone
- **WHEN** a person plays the loop on a physical phone
- **THEN** the result goes in its own phone record with device, browser and network, and no host-PC sample is reported as a phone result

### Requirement: Rounds logged
Each gauntlet round SHALL be logged in `docs/gauntlet/gta-mobile.md` with a rubric v1 scorecard whose performance scores cite the round's evidence.

#### Scenario: Round scorecard
- **WHEN** a round ends
- **THEN** `docs/gauntlet/gta-mobile.md` has a rubric v1 scorecard for it, and "Performance stability" cites the round's `verdict.json` summary in `Verification/Gauntlet/`
- **AND** a dimension with no host evidence reads "unverified" and is left out of its group sum, with the dimension count recorded
