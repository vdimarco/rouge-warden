The live demo now stops rendering empty player slots and gives its managed service higher CPU scheduling weight. A 60-second direct camera-sweep observation improved from **21.1 to 30.0 decoded FPS** with idle suspension enabled on the same package. Graphics settings, VP8, the 30 FPS cap and the 12,000 MiB launch guard are unchanged. The ordinary demo is restored. [Structured evidence](BrowserOptimization.json) identifies the source, package, measurements and remaining checks.

`UQuebecStreamIdleSubsystem` is opt-in for native games and enabled by the browser launcher. It waits through a 60-second warmup and 30-second empty-slot grace, skips 3D world rendering, and wakes on matching-stream connection events. It retains simulation on the listen server and friend, never changes their frame caps, and restores the original viewport rendering flag during shutdown. The editor, captures and ordinary native launches retain their existing rendering. Native FPS logs and the launcher’s validated settings make subsequent comparisons observable.

| Observation | Idle off / original | Idle on |
| --- | --- | --- |
| Same-package direct camera sweep, about 60 seconds | 21.12 decoded FPS | 30.02 decoded FPS |
| Direct camera-sweep freezes | 0 | 0 |
| Native host median with both processes drawing | 21.91 FPS | Sleeping host continues at about 30 FPS |
| Host GPU SM samples while friend is viewed | Awake samples 13–44% | Available sleeping samples 2–3%; eight readings unavailable |
| Relay camera sweep, about 60 seconds | 7.79 decoded FPS, four freezes | 9.36 decoded FPS, no counted freezes, longest frame gap 583 ms |

These are live operational observations on the RTX 4090/i9-14900K, with other desktop applications present. Weather, camera views and background GPU demand were not pinned. The raw samples remain available; no controlled graphics benchmark, physical-phone improvement or 60 FPS browser acceptance is claimed. Missing NVIDIA `pmon` readings remain unavailable, rather than being counted as zero utilization.

The relay remains a separate bottleneck. An additional lower-start-bitrate run measured 7.63 FPS, about 1.73 ms decoding per frame and 225 ms in the receiver jitter buffer. Direct playback with that startup value still reached over 6 Mbps in its first sampled second, but the relay improvement was not established, so production keeps its original bitrate settings. A brief 960×540 experiment measured 20.85 FPS over the relay and restored 1280×720 afterward. Its view/weather and quality were not matched for acceptance; that smaller frame was not shipped. Capture scheduling, codec and sky quality were also retained.

For resources on this PC, the game service now has `CPUWeight=400`, recorded in its normal start recipe. This is relative scheduling preference when CPU resources are contested, not a core or GPU reservation. At inspection there was negligible CPU/memory pressure, about 39 GiB available RAM, and neither game process had swapped memory. GPU sharing was the useful target: both empty slots previously kept drawing while the desktop shared the same card.

The machine also has an Intel UHD Graphics 770 with no monitor connected; the active monitor is on the RTX 4090. Moving desktop/background rendering to Intel while retaining Unreal on the RTX is a possible way to separate workloads without buying another card. It requires display configuration and potentially moving the monitor cable to a motherboard display output. This task did not migrate the desktop, restart user applications or change display configuration. The NVIDIA driver reports MIG unavailable for this 4090; it is absent from [NVIDIA’s supported partitionable GPU list](https://docs.nvidia.com/datacenter/tesla/mig-user-guide/supported-gpus.html).

| Verification | Result |
| --- | --- |
| Editor/game builds and separate Linux cook/stage/archive | Exit 0 |
| Native automation, including idle warmup/grace/wake state | 19 passed |
| Existing native smoke | 69 passed |
| Browser unit checks and launcher self-check | 13 passed; self-check passed |
| Public desktop media/input/Escape/occupied slot/reconnect | All seven checks passed |
| Public mobile emulation | Six checks passed, including tall real video and simultaneous move/look/jump; landscape menu/objective clearance failed |
| Appearance | Direct and relay screenshots inspected; current world renders after wake. No new art or quality acceptance is claimed |
| Preservation | All 48 installed package files match the tested archive; 47 runtime files copied and verified before startup; map and campaign-save hashes unchanged |
| Runtime changes after restarts | Only the existing guest `CachedClientID` setting changed; production saves/settings retained |
| Public infrastructure | Cloudflare and both Funnel service process IDs unchanged; TURN configuration untouched |

The final desktop evidence is `Browser/.qa/live-2026-10-13T15-13-31-998Z/`. The mobile failure remains in `Browser/.qa/mobile-2026-10-13T15-14-29-519Z/`; the clearance assertion was not weakened. An earlier desktop attempt hit an occupied friend slot and was repeated after that viewer left. Failed sampler fixture/occupied-slot attempts are retained alongside completed samples.

Local build, closed-log scans and preservation records are under `Saved/BrowserStreaming/optimization-20261013/`; raw receiver observations are under `Saved/BrowserStreaming/samples/`. The untouched prior package and original runtime files remain at `Builds/BrowserPrevious-optimization-20261013/`. A rollback must preserve any newer production progress before swapping packages and must restore the existing tunnel/relay-aware lifecycle.

The larger `nord-stream-speed` change stays open. Physical phones, carrier networks, subjective driving/audio, the remaining mobile layout check and its other frame-negotiation/sky-budget work are pending. OpenSpec structure was inspected manually; its CLI is unavailable on this PC.


## Follow-up after the host reboot — 2026-10-13

The PC rebooted before this continuation. Its four temporary user services and named TURN container had stopped. The existing package, 12,000 MiB preflight, private relay settings, graphics quality and CPUWeight=400 were retained when restoring the game, signalling and relay. Both empty worlds suspend rendering after warmup; a 30-second camera sweep received 30.00 decoded FPS without drops or freezes on the local direct path. The changed public Quick Tunnel is `wss://officials-soundtrack-engines-institute.trycloudflare.com`; the published player still points to the earlier, expired tunnel until the staged update is approved and deployed.

Desktop experiments did not establish an additional game-frame-rate gain. Intel shell offload freed memory but produced a black desktop and was fully reverted. Sleeping the display did not stop the background GPU work. The first 120-to-60 Hz comparison coincided with the session locking and cannot isolate the refresh-rate effect. A repeat with the session locked throughout measured median GPU utilization of 24% versus 28% and power of 37.80 W versus 26.21 W at 120/60 Hz. Native 7680×2160 at 120 Hz was restored; the monitor configuration file was not changed. The existing video wallpaper is paused in memory (`omarchy shell motion-wallpaper resume` restores it); the existing animated-background `pauseWhenCovered` setting is enabled. Shell restarts resume video playback. Neither setting reserves GPU resources.

The actual deployed player includes drag-anywhere and gyro controls from `eff8752e`, now also on `origin/main` at `54a86fe8`. The live performance checkout still retains its earlier uncommitted native work; it was not reset or switched. To preserve the deployed controls, the release candidate was exported separately from the deployed commit. Its only product-source edit is four CSS lines moving the landscape action row clear of the objective. The candidate preserves every other published source file, portrait behavior and gyro/drag controls. It passed 17 unit checks, all 11 real-media mobile checks (including simulated gyro and both landscape sizes), and all seven live checks through the new ordinary Cloudflare WSS route. The live observations were approximately 28–30 decoded FPS. These are same-PC checks, not carrier or physical-sensor acceptance.

The staged source, twelve-file static inventory and minimal patch are under `/home/von/.local/state/nord-browser-release-20261013/`. Mobile evidence is `games/nord-unreal/Browser/.qa/mobile-2026-10-13T18-37-28-431Z/` within that directory; live evidence is `.qa/live-2026-10-13T18-39-35-430Z/`. The checklist's explicit approval requirement for changing the public endpoint remains pending. No public deployment, codec switch, scheduler change, permanent GPU migration, reboot persistence or quality reduction is claimed from this follow-up.

A final simultaneous 60-second direct camera-sweep run received 30.05 FPS on NordHost and 30.09 FPS on NordFriend1, with zero dropped frames and zero freezes on both. Longest observed frame gaps were 83.2 ms and 66.8 ms. The desktop was locked and running at its restored 120 Hz. These same-PC observations show both streams meeting their existing cap; they do not establish a new phone/carrier improvement. Raw runs: `Saved/BrowserStreaming/samples/2026-10-13T18-40-34-280Z-NordHost/` and `2026-10-13T18-40-34-278Z-NordFriend1/`.
