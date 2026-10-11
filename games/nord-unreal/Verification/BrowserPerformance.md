# Browser lag investigation — 2026-10-11 UTC

**The control-logging correction is deployed and verified, and the normal demo is restored after the coordinated capture window. Latest desktop samples reach 26–29 FPS over short 1.5-second windows; sustained phone performance remains unverified.** Earlier native frame supply was low under shared GPU load. Full counters and check results are in [BrowserPerformance.json](BrowserPerformance.json).

| Ordinary-browser sample on the host PC | Decoded FPS | Mean browser decode | Loss / dropped frames |
| --- | ---: | ---: | ---: |
| Initial, 15.028 s | 10.25 | 6.67 ms | 0 / 0 |
| Before publication, 15.041 s | 18.35 | 5.42 ms | 0 / 0 |
| After publication, 13.527 s | 19.37 | 5.31 ms | 0 / 0 |

These are uncontrolled views and shared GPU loads; their difference does not establish a frame-rate improvement caused by the logging correction. The first sample includes one 346 ms freeze. The final sample uses real 1280×720 VP8 video, direct UDP, 0 ms reported same-PC RTT, and about 80 ms average receiver jitter buffering. Receiver processing delay includes buffering and decoding; those values must not be added together. This is not a carrier/TURN or physical-phone latency test.

The native friend log independently advances 172 game frames in 15.453 s (**11.13 FPS**) during the initial probe; the host advances 505 frames in 38.771 s (**13.03 FPS**) in an earlier nearby interval. Installed Unreal source confirms its log counter is `GFrameCounter % 1000`; the applied 30 FPS caps exclude an additional wrap for these intervals. No new OOM or fatal allocation error was found in the current logs.

The GPU remained 96–97% utilized. The recorded 01:55:25 UTC snapshot has only 1,374 MiB free, with the native host/friend at 5,535 / 5,085 MiB, Dota 2 at 2,287 MiB and quickshell at 3,796 MiB. The separate Unreal preview exited externally; this task stopped no unrelated applications. The user has been asked to close competing GPU applications for a controlled comparison; no answer or approval is inferred.

A passive 5.012 s `/proc` sample at 01:57:47 UTC found no saturated native CPU thread: host game/render/RHI used 15.56/15.56/4.99% of one core, friend 8.78/13.37/3.79%, with only 23–70 ms of runqueue delay on these threads. Their endpoint states were sleeping on futexes. This is consistent with waiting/synchronization under GPU contention, but cannot identify the wait dependency or measure GPU frame time. No browser subscriber was added for this CPU sample, so it is not an active-encoder benchmark.

Three low-rate requests use Epic's installed LatencyTest protocol rather than game input or console commands. The two populated final native encode reports average **8.92 ms**. This suggests encoding alone is not the throughput limit, but native render/capture/GPU frame-time profiling is still needed to isolate the bottleneck. Installed UE5.8 labels a packet-send-delay mean as `CaptureToSendMs`; its 4.57 ms value is not a measured capture-to-send span. Cross-clock one-way times and the frontend's derived end-to-end value are not used.

## Deployed correction and verification

Epic's common logger defaults to Debug with stack capture, and the frontend logs every control packet at Info. Initialize the existing logger at Warning with stack capture disabled before creating the player. Warnings and errors remain visible. The already installed common package is declared directly at its existing pinned 0.1.0 version; no new package was installed.

- Twelve unit tests pass, including actual logger suppression and warning/error preservation.
- Static browser checks pass with the real offline/configured logger context and no Info/Debug spam.
- Public preview and production each pass six real-media/touch checks, including simultaneous input, accessible actions, fullscreen and release-before-disconnect. Both record `{level: 2, stack: false}` and no per-packet log spam.
- The ordinary production desktop regression passes seven checks: both independent streams, input/Escape, occupied-slot refusal and both reconnect paths. Its brief FPS samples are 17.3–18.6; a passing connectivity check is not smooth-play acceptance.
- The final read-only production probe verifies the published JS hash, logger context and no Info/Debug messages or page exceptions. Missing favicon requests remain harmless resource 404s.

Production is READY at [nord-montreal.vercel.app](https://nord-montreal.vercel.app/), deployment `dpl_2q2TYmdCX8BZcPTdHKokxBP5SYmm`. Its files match the tested preview byte for byte; JS SHA-256 is `1c63ff77ba224a03e077240ea6fa46100af9504044af83831569ffce32cf156d`.

During the logging correction, native services were not restarted and no new Unreal GPU job was launched. The later coordinated capture pause/restoration is recorded below. Graphics defaults, two-player capacity and the 12 GB launch guard were preserved. Both map hashes and the isolated Mission 1 save hash are unchanged. No separate Plateau project files changed. The active OpenSpec change has four requirements/nine scenarios, checked manually; the CLI remains unavailable.

## Remaining acceptance

Repeat a controlled comparison after competing GPU applications are closed. If low FPS persists, use a coordinated guarded native diagnostic window to collect game/render/GPU frame times. There is no evidence yet to justify a speculative native rebuild or a quality downgrade. Physical phone input/carrier latency, audible sound, sustained driving feel and existing full-story acceptance remain open. The PC and temporary signalling/relay services must stay online.

## Coordinated capture window

After the lag correction, the trailer chat's human requested continuation under the existing human authorization for GPU coordination. No browser subscriber was active. This task backed up the saves, stopped only its normal owned demo lifecycle, and handed the identical pinned signalling server/private ICE configuration to temporary `nord-browser-signalling-capture.service`. Cloudflare, both Funnels and TURN stayed running, with the public hostname unchanged. The released window began at 02:06:26 UTC with 12,655 MiB free. This required a brief signalling handoff because the existing lifecycle owns signalling and both native processes together.

The trailer chat reported both editor/recorder attempts exited and requested restoration before the deadline. Root verified no rendered Unreal job remained and all protected source/map/save hashes were unchanged. However, the unchanged 12 GB restoration guard initially refused at 11,225 MiB free, followed by an 11,212 MiB sample at 02:15 UTC. Dota 2 used 3,011 MiB; other desktop allocations also changed. No native process was relaunched while the guard refused, no other application was stopped and no guard/quality setting was weakened. An initial coordination message incorrectly said the guard passed before the failed tool result was inspected; it was promptly corrected.

**The normal browser demo is restored.** Actual headroom later returned without this task closing applications. The complete unchanged preflight passed at 02:17:35 UTC with **12,459 MiB free**, temporary signalling was stopped, and the normal lifecycle launched at 02:17:59 UTC. Both native peers and normal signalling are running; Cloudflare/Funnels/TURN and the public hostname remain unchanged. Dota 2 and quickshell remain active, so this does not establish removal of GPU contention. The exact cause of the intervening allocation change is unknown.

Ordinary production desktop QA passed **7/7** at 02:18:41–02:19:01 UTC: both independent real streams, input/Escape release, occupied-slot refusal and reconnect. Five decoded-frame samples over about 1.5 seconds each measured **25.97–28.61 FPS**. Production mobile Chromium emulation passed **6/6** at 02:20:32–02:20:38 UTC, including actual simultaneous movement/camera/jump data-channel packets, input release, portrait/landscape layout, fullscreen exit and warning/error logging without packet spam. The desktop runner covers reconnect; the mobile runner ends at disconnect. These bounded observations do not prove sustained frame rate, physical-phone latency or a causal improvement from logging suppression. Only missing-favicon 404s remain in mobile diagnostics.

All 11 protected source/map/project hashes and the exact browser save-file inventory/hash match the capture baseline after QA. Native command lines retain the prior quality/codec settings. The original save backup is retained in ignored `Saved/BrowserStreaming/capture-window-20261011T020502Z/`. No further capture window is released. Current state, raw QA paths and historical refusal snapshots are retained in the verification JSON and ignored `Saved/BrowserStreaming/active-capture-window.json` pointer.
