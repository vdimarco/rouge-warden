# Driving and sustained streaming follow-up — 2026-10-13 Montréal

The delivered curb/collision revision passes the existing complete Mission 2 circuit: all seven directional gates in order, 271.62 metres of continuous native driving, 63.0 simulated seconds, no retries, no stalls, collision enabled and sixteen ambient traffic cars retained. Native E enters the original loan car; only the standing avatar is moved for the initial approach. The car is never teleported. Mission completion persists as completed-missions 2, the isolated QA save is restored, and the live production save remains byte-identical.

A separate public-player camera sweep on the installed browser package receives **29.96 decoded FPS over 60.409 seconds**, with zero dropped frames, freezes or lost packets. The longest observed video-frame callback gap is 100.1 ms; average receiver decode time is 0.45 ms/frame and receiver jitter-buffer time is 54.8 ms/frame. The existing adaptive phone profile settles at **640×360 VP8**, using a direct host UDP candidate on this PC. This is an operational observation at the current 30 FPS cap, not a comparison proving another speedup.

Source hashes and all 48 non-Saved package files match the prior [curb-parking delivery](CurbParking.md). No gameplay, frontend, quality settings or service configuration changed; the live service was not restarted. The sampler releases its viewer normally. [Structured evidence](DrivingStreamFollowup.json) includes the exact source/package references, raw-report hashes, all race crossings/samples, production-save guard and native host tick observations.

## Reproduction and evidence

- Race: `Scripts/test_race_drive.py`, with only its historical output destination retargeted to `Saved/RaceCurb-20261014/RaceDrive.json`; fresh `-saveddirsuffix=RaceCurb20261014`, `-NordCampaignQA`, standalone NullRHI PIE. Editor process exited 0; dependency/shader/fatal log scan passed. The script's sparse OnActorHit delegate is unavailable, so contact counts were not measured.
- Stream: existing `Browser/stream-sample.mjs --seconds 60 --slot NordHost --url https://nord-montreal.vercel.app/ --look`, with the installed Playwright runtime. Process exited 0. Raw samples/screenshots: `Saved/BrowserStreaming/samples/2026-10-14T02-05-43-754Z-NordHost/`; the final screenshot was inspected.
- Sampler arithmetic: `node --test Browser/stream-sample.test.mjs` passed.
- Native telemetry: `Saved/BrowserStreaming/host-20261014-005051-1631030.log`, awake NordHost records during the stream observation. These count engine ticks, not GPU frame-time distributions.

Physical phones, carrier/off-LAN paths, audible sound and subjective driving remain unverified. The race uses native input callbacks in NullRHI PIE; it does not complete a rendered packaged Mission 1–2 playthrough. The browser sample is Chromium touch emulation on the host PC. Historical verification reports remain unchanged except for a link to this follow-up.
