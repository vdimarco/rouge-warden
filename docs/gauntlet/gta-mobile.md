# GTA mobile gauntlet

Loop: make NORD (the GTA row) look as close to GTA 6 as the phone stream allows, while the host holds a 30 FPS frame budget for a phone viewer. Use original art only. Focus: aesthetics, plus phone performance at 30 FPS. Rubric: [RUBRIC.md](RUBRIC.md), v1. Spec and host commands: [`openspec/changes/nord-mobile-gauntlet/`](../../openspec/changes/nord-mobile-gauntlet/).

This is the third NORD loop, next to [gta-graphics](gta-graphics.md) and [gta-missions](gta-missions.md). Those loops did not measure frame time. Here an Unreal Gauntlet run on the owner's host PC measures every round. The cloud container has no Unreal Engine and no GPU, so it cannot measure a round.

## What a round runs
- **Map and route.** `/Game/Maps/LaFontaine` with the Plateau replica. The player's car drives itself through five stops and back: S1 Sherbrooke, S2 Papineau, S3 Fabre, S4 RachelPark, S5 Mentana. The loop is about 3.5 km: the offline model drives a 3,488 m line, and the host has not measured it yet. A lap is about 5 minutes of driving (about 296 s in a perf run, 307 s in a look or stream run).
- **World.** Ambient traffic and residents stay on. Police, campaign, side jobs and save writes are off. Look runs also turn ambient life off, so the stills repeat.
- **Sky.** Always pinned and frozen. Day is 15:00, clear. Night rain is 22:00, rain, the worst case.
- **Sizes.** Rung 0 is 1412x652 (landscape) and 652x1412 (portrait). Rung 1 is 1058x488 and 488x1058, in the stream pass only.
- **Caps.** The stream keeps `t.MaxFPS 60` and `-PixelStreamingWebRTCFps=60`. The 30 FPS target is a floor judged against a 33.3 ms frame budget. It is not a cap.
- **Viewers.** The gate is one phone-sized viewer on NordHost, with NordFriend1 asleep. Two viewers and the TURN relay are report-only. The input row (`gauntlet_loop.py stream --look`) drags on the stream for the whole lap and gates only the exit code and the car's largest lateral error, at most 2.5 m.

## Gates
A round passes a gate only with a host measurement for it.

**Native, after the warm-up lap:**
- FrameTime p95 at most 33.3 ms over the lap and on each leg.
- Over the lap: p99 at most 50 ms, and at most 1% of frames over 50 ms.
- Over the lap: at most one hitch (a frame over 66.7 ms) in any 30 s, and no frame over 250 ms.
- Peak VRAM at most 6,000 MiB per game process.
- No render log errors, and every profile CVar reads back as requested, with the fixed `t.MaxFPS 60` and `r.AntiAliasingMethod 4` (TSR).

**Stream, solo, direct, both rungs, landscape and portrait, over the lap after the warm-up lap:**
- Mean decoded FPS at least 29, and zero WebRTC freezes.
- At most 1% of decoded frame intervals over 50 ms, and a longest gap of at most 500 ms.
- Jitter buffer delay at most 120 ms per frame on average. This is the player's own lag rule, a check of stream health, not a delay target.
- `NORD_STREAM_FPS` at least 29 in every 5 s window, and decoded FPS within 3 FPS of it.
- The received size stays the pinned rung's size, and NordFriend1 stays asleep through the lap.

**Look:**
- Every still has an SSIM of at least 0.85 against the full-quality reference, and the mean is at least that of the current production profile. These floors are provisional until round 1 calibrates them.
- All 20 stills (10 views, two skies) are scored, and the look run exits cleanly, or the look result does not count.
- The reference repeats with an SSIM of at least 0.98 on every image, or the round is invalid.
- The user reviews `review.html`. The user's verdict is final.

**Delay** (round-trip time, jitter, jitter buffer delay and target, decode, processing, end to end) is reported in its own section, and that section is never gated. The jitter buffer delay is the only delay figure that also has a limit, the stream-health limit above. The delay comes from host-PC headless Chromium with `--disable-gpu`, not a phone and not off-LAN.

## Evidence each round must carry
Record these in the round, under the scorecard:
- The commit, the package build and its hash, and the host hardware (CPU, GPU, driver, RHI).
- The profile under test (`current`, `phone` or a candidate file) and its CVar readback.
- The sky, the sizes, the number of measured laps, and the warm-up rule.
- The path of each committed verdict: `games/nord-unreal/Verification/Gauntlet/<YYYYMMDD>-<label>.json`. Failing runs stay committed.
- Each gate with its value, its limit and its status: pass, fail, unverified or contended.
- The GPU processes before and after each run. A run with a foreign GPU process is "contended" and is never ranked.
- Paired stills of the same views, before and after, in `games/nord-unreal/Preview/Gauntlet/<YYYYMMDD>/`, and the user's review verdict.
- The delay section, with the client label above.
- A physical-phone result, if a person played the loop, as its own record (`Verification/Gauntlet/<YYYYMMDD>-phone.md`) with device, browser and network. A host-PC sample is never a phone result.

## Missing host runs
Missing host evidence is **unverified, not pass**. A round may still change code or art without a host run. Then:
- Write `unverified` in the Score column for "Performance stability" and for "Responsiveness and input latency".
- Leave those dimensions out of the playability sum, and record the dimension count you used, as the rubric allows.
- Do not carry an older measured score forward as if it were new.

A confirmation that the agreed window cut, or that a foreign GPU process shared twice, is missing evidence too, unless it also holds a failed run. The round's `confirmed` gate stays unverified while a ranked candidate has only missing evidence, also after a better ranked candidate failed, until `gauntlet_loop.py confirm <tune folder>` runs that candidate again. Only a failure drops a candidate, so the report confirms no lower ranked candidate while a better ranked one has only missing evidence. A failure is final: a failed native run, or a failed solo stream row, also when that row was sampled again and passed. The round report reads the newest solo stream row of each candidate at each rung and orientation. A newest row that is contended or unverified is missing evidence until that row is sampled again. A two-viewer row that is contended, or whose NordHost drive did not end with exit 0, does not count for the co-op guard. One `gauntlet_loop.py stream --two-viewers` command samples both slots and records the two-viewer row.

## Scoring
- Copy the scorecard block from [RUBRIC.md](RUBRIC.md) for each round, and add the evidence list above.
- Judge the aesthetics dimensions on the native stills and the decoded stream frames at phone size, not on desktop captures.
- Score "Performance stability" from the round's `verdict.json` gates, and cite the committed verdict file.
- Score "Responsiveness and input latency" from the delay section, and name its client limits.
- Next target: a failing gate comes first. When every gate passes, pick the lowest aesthetics score that the phone profile or the art can change.

## Rounds
No scored rounds yet. Round 1 waits for the first host runs in `openspec/changes/nord-mobile-gauntlet/tasks.md` (group 11).
