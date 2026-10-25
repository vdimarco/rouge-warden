# NORD: a GTA mobile gauntlet loop at 30 FPS

## Why
The user asked for a gauntlet loop that improves NORD's look and its performance on phones, at 30 frames per second. In this repo a gauntlet loop is a round-by-round loop scored with `docs/gauntlet/RUBRIC.md`. NORD has two loops, gta-graphics and gta-missions. Neither one measures frame time, and gta-graphics scored Performance stability in all 54 rounds without a measurement. Nothing measures a moving route at phone sizes, gates a 33.3 ms budget, or scores the look against a reference.

## What changes
- **A third NORD loop, "GTA mobile".** `docs/gauntlet/gta-mobile.md` logs each round with a rubric v1 scorecard. Its focus is the look plus phone performance at 30 FPS. Each round carries evidence from a host run. A round with no host run is "unverified, not pass".
- **A fixed Plateau loop.** The player's car drives itself through five stops in the Plateau part of LaFontaine: Sherbrooke, Papineau, Fabre, Rachel at the park, and Mentana, then back to Sherbrooke. The loop is about 3.5 km on the through roads of the existing road graph: the offline model drives a 3,488 m line, and the host has not measured it yet. The stops come from the replica manifest cameras, so the mirror fix needs one regeneration. The sky is pinned to a clear afternoon or to a rainy night, the worst case.
- **An Unreal Gauntlet run on the host.** A C# test node, `NordMobileLoop`, starts the Browser package through `RunUAT RunUnreal` on Linux. A game subsystem, created only with `-NordGauntlet`, seats and drives the car, records CSV profiler frame times per leg, takes fixed stills and quits with an exit code. A thin C++ controller, `UQuebecGauntletController`, ends the Gauntlet test with that exit code. A `--direct` launch does the same run without RunUnreal if Gauntlet does not work on Linux.
- **Phone-sized measurement.** The native gate judges frame time against 33.3 ms over the lap and on each leg. The stream gate uses the existing Chromium sampler at phone sizes, extended to record each decoded frame. Delay (round-trip time, jitter, jitter buffer, decode, processing, end to end) is reported in its own section. Only one delay figure also has a limit: the stream gate keeps the mean jitter buffer delay at most 120 ms per frame, the player's own lag rule, as a check of stream health.
- **A visual check.** Ten fixed views per sky are compared with a full-quality reference by SSIM. A review page shows reference, baseline, candidate and the decoded stream frame side by side. The user's verdict is final.
- **A tuning loop.** A greedy search over scalability settings keeps the best-looking candidate that holds the budget with a 10% margin.
- **An opt-in phone profile.** `[NordPhoneStream DeviceProfile]` in `Config/DefaultDeviceProfiles.ini` starts equal to today's stream settings. `NORD_STREAM_QUALITY=phone` selects it. `gauntlet_loop.py write-profile --approved` writes the winner only after the user approves, and records that approval beside the ini.

## What stays the same
- The stream keeps its 60 FPS caps (`t.MaxFPS 60`, `-PixelStreamingWebRTCFps=60`). The 30 FPS target is a floor judged against a 33.3 ms budget, not a cap. The canonical spec requires the 60 ceilings, and a 30 cap added about 30 ms of phone buffering.
- The production stream settings do not change. Flipping the default to `phone` is a separate change after the user approves paired captures.
- The desktop gate in `profile_package.py` stays at p95 below 16.67 ms at Epic quality.
- The co-op 30 FPS target stays with nord-stream-speed. Two viewers and the TURN relay are report-only rows here.

## Capabilities
- `nord-gauntlet-run` (new): the route, the native and stream measurements, the delay report, the visual check, the evidence rules and the round log.
- `nord-phone-stream-profile` (new): the tuning search and the opt-in, approved phone profile.

## Out of scope
Codec trials (nord-stream-speed decision 9), automatic changes to the phone adaptive ladder in `Browser/config.mjs`, Epic's AutomatedPerfTesting plugin, Horde, simulcast and SFUs, Gauntlet on phones (phones only watch the stream), and the mirror fix itself.

## Who checks what
This change is written in a cloud container with no Unreal Engine, no GPU and no dotnet. The container checks C++ syntax against stub headers, the engine-free model with g++ and clang++, the Python runner, metrics and tuner with fakes, the browser unit tests and the launcher self-check. The owner's host PC must build with the Gauntlet plugin, run RunUnreal, read back the profile, run the references, the tune and the stream runs. A person must check a physical phone. `tasks.md` keeps each host and person step open until it runs.
