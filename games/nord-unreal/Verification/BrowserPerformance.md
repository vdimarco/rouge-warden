# Browser lag investigation — 2026-10-11 UTC

**The control-logging correction is deployed and verified. Smooth-play acceptance remains open because native frame supply is low under shared GPU load.** Full counters and check results are in [BrowserPerformance.json](BrowserPerformance.json).

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

Native services were not restarted, no new Unreal GPU job was launched, and graphics defaults, two-player capacity and the 12 GB launch guard were preserved. Both map hashes and the isolated Mission 1 save hash are unchanged. No separate Plateau project files changed. The active OpenSpec change has four requirements/nine scenarios, checked manually; the CLI remains unavailable.

## Remaining acceptance

Repeat a controlled comparison after competing GPU applications are closed. If low FPS persists, use a coordinated guarded native diagnostic window to collect game/render/GPU frame times. There is no evidence yet to justify a speculative native rebuild or a quality downgrade. Physical phone input/carrier latency, audible sound, sustained driving feel and existing full-story acceptance remain open. The PC and temporary signalling/relay services must stay online.
