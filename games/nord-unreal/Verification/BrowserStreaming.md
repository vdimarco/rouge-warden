# Browser streaming verification — 2026-10-10

**Current availability: the normal demo is restored after the second coordinated capture window.** The complete unchanged 12,000 MiB preflight passed with 13,041 MiB free at 02:40:21 UTC. Ordinary production desktop QA passed 7/7 at 02:41:09–02:41:31 UTC and mobile Chromium emulation passed 6/6 at 02:41:37–02:41:42 UTC. Both native peers and normal signalling are running; temporary signalling is stopped. Public tunnels/TURN, quality settings, source/maps and the exact save inventory are unchanged. Short desktop samples measured about 27–30 FPS; sustained physical-phone performance remains open. See [capture-window state](BrowserPerformance.md#second-coordinated-capture-window).

**Earlier logging-correction checks:** mobile touch controls and a production control-logging correction are deployed; all six live mobile checks and seven ordinary desktop checks passed at 2026-10-11 01:54 UTC. The 13.5-second probe then received 19.37 FPS while the GPU was 97% utilized. See [lag investigation](BrowserPerformance.md). The user confirmed phone video loads before the touch update. See [touch-control verification](BrowserTouchControls.md) and [mobile connection verification](BrowserMobileConnection.md). The Tailscale MagicDNS/Chrome local-network failure was reproduced and the deployed signalling setting replaced with a public-only temporary Cloudflare Tunnel. No DNS/security override is used for these results. See [connection repair evidence](BrowserConnection.md). Earlier “normal public” checks below used a scoped DNS override and did not verify ordinary-browser access. Overall acceptance remains open for off-LAN desktop/new touch input, audible sound, sustained/manual driving and full Mission 2 browser progression.

## Deployment and runtime

| Item | Recorded configuration |
| --- | --- |
| Public player | [nord-montreal.vercel.app](https://nord-montreal.vercel.app/) |
| Latest READY deployment | `dpl_2q2TYmdCX8BZcPTdHKokxBP5SYmm`, production logging correction; exact preview-tested files. |
| Separate Vercel project / team | `prj_WxSPmxW7fhy7iszj54rAC7Hn5GqJ` / `team_eiZs2QejkAGnsji7iQVwMLy9` |
| Deployment method | Configured prebuilt `dist` and static deployment configuration, uploaded without Git linkage. Commits do not automatically redeploy it. |
| Final publication check | Player and [third-party license notices](https://nord-montreal.vercel.app/THIRD_PARTY_NOTICES.txt) return HTTP 200. Deployed player JavaScript SHA-256 `1c63ff77ba224a03e077240ea6fa46100af9504044af83831569ffce32cf156d` matches the current local build. Expanded notices are 15,768 bytes, SHA-256 `2c40b33c5c15250d80589740dece635104dcb398cf3cf58af6ed500e7b32f3f8`, also matching local output. The latest configured bundle is byte-identical to the tested public preview; third-party notices remain unchanged. |
| Temporary player signalling | Configured `wss://reports-rec-encouraged-taught.trycloudflare.com`, temporary `nord-browser-public` Cloudflare Tunnel to unchanged PC player port 9010. Native lifecycle and original Funnel remain running. The tunnel hostname changes on process recreation; rebuild/redeploy if that happens. No reboot persistence. |
| Capacity | `NordHost` and `NordFriend1`: two separate 1280×720 Unreal processes in one native listen-server session, one browser subscriber per stream. |
| Host | Existing Linux PC, UE5.8.3, Intel Core i9-14900K / NVIDIA RTX 4090 / Vulkan SM6. It must remain powered on, connected and running. |
| Frontend / bundler | Official `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` 0.1.2, shared common logger 0.1.0 / esbuild 0.28.2, lockfile pinned. Production logging retains warnings/errors and suppresses info/debug and stack capture. |
| Signalling source | Epic PixelStreamingInfrastructure revision `e5e243ed038313d3dad4e3fb9087d4393a5df192`; Common, Signalling and SignallingWebServer workspaces. Verified with Node.js 26.7.0 / npm 11.19.0. |
| Final bounded calibration configuration | 1280×720 output, High (2) base with global illumination/reflection/shadow quality 1, `r.Shadow.Virtual.Enable 0`, `r.ScreenPercentage 75`, `t.MaxFPS 30`, `MediaIO.EnableExperimentalScheduling 0`. VP8 software encoding, WebRTC 30 FPS, 8 Mbps start / 12 Mbps video ceiling. |
| Input restrictions | `-NoDebugExecBindings` disables Development debug key bindings; Pixel Streaming `ConsoleCommand` payloads are disabled. Corrected `-PixelStreamingKeyFilter=Tilde` was accepted in native logs; a bounded rendered Backquote check showed no console while subsequent C still changed crew style. Earlier live runs used unknown `PixelStreamingInputKeyFilter`, so effective Tilde filtering is not claimed for them. Upstream resolution messages remain available to a subscribed input owner. |
| ICE | Google STUN plus authenticated co-located TURN/TLS on8443. A separate TLS-terminated Funnel carries media to the game-PC-only relay. Direct/forced-relay and Android-emulated media pass; user subsequently confirmed phone video loads. |
| Launch resource guard | NVIDIA adapter 0 must report at least 12,000 MiB free through `nvidia-smi`; the recovered launch passed at 12,787 MiB. The normal running host had at least 2,431 MiB free in a later bounded sample. This is a build-specific launch threshold, not a VRAM reservation or stability guarantee. |

The existing map/assets and previous `Builds/Linux` package/saves are retained. This rollout adds PixelStreaming2 integration, held-input cleanup and a separate `Builds/Browser` package. Only the native host writes campaign progress; the guest uses `-NordNoCampaignSave` and `-saveddirsuffix=BrowserGuest`. An isolated browser-package Mission 1 checkpoint and restart/reload passed without changing production or guest saves. Full Mission 2 progression is still unverified.

## Recorded checks

The [verification JSON](BrowserStreaming.json) retains the original scoped-DNS seven-check deployed regression at **21:38:43–21:39:06 UTC**, its later 30-second performance sample and exact runtime settings. A fresh [normal-host regression](../Browser/.qa/live-2026-10-10T22-29-01-803Z/summary.json) at **22:29:01–22:29:23 UTC** repeated all seven checks after the recovery. Both target the public HTTPS player with a scoped DNS override; ordinary-browser access was verified only by the later [connection repair](BrowserConnection.md). All seven checks pass:

| Check | Evidence / scope |
| --- | --- |
| Host real stream | 1280×720 video, `readyState=4`, advancing playback and decoded inbound VP8 frames. Audio packets received. |
| Friend independent real stream | Separate browser context selecting `NordFriend1`, with its own real 1280×720 VP8 video and audio packets. |
| Host input and Escape | Trusted mouse/WASD/C/Space actions sent through the player; before/after screenshots saved. Browser pointer lock releases on Escape. |
| Friend input and Escape | Same check on the independent friend stream. |
| Occupied slot | Third browser attempting `NordHost` is refused while the host browser occupies it. |
| Released-slot recovery | The refused browser reconnects successfully after the original host disconnects. |
| Original-host reconnect | The original host reconnects after that slot is freed, actual video resumes, and Disconnect remains enabled; the friend stream remains connected. |

The runner uses real Chromium, real WebSocket/WebRTC and separate browser contexts. Its RTCPeerConnection instrumentation only retains actual peer references for `getStats`; it does not simulate video, replace signalling, or issue native game commands. Input screenshots require human review; the runner does not assert native position, completed jumps, character appearance, car behavior or story progress. Raw PNGs and the original summary remain locally under `Browser/.qa/live-2026-10-10T21-38-43-224Z/`; `.qa` is intentionally ignored by Git. The final player also disables selection after disconnect, so changing a slot cannot send a subscription over the closed socket; selection remains available after an occupied-slot refusal.

| Other verification | Result / evidence |
| --- | --- |
| Endpoint validation | `npm test` passes validation of WSS, loopback-only WS, rejected credentials/query/fragment and disabled arbitrary player query overrides. |
| Static browser checks | `npm run test:browser` passes offline/unavailable states, explicit connection, ignored URL overrides and 1280/1920/narrow layouts. These checks do not need a running game. |
| Held-input cleanup | `Quebec.Browser.InputRelease` reports `Result={Success}` at 21:25:15 UTC in `Saved/BrowserStreaming/input-release-tests.log`. Unreal's forced `-TestExit="Automation Test Queue Empty"` requests exit 1; this process code is recorded separately from the successful automation result. |
| Streaming package | `Saved/Logs/BrowserBuild.log` records `BUILD SUCCESSFUL`, BuildCookRun 97.88 s and AutomationTool exit 0. This is the rebuilt package with native disconnect cleanup. |
| Temporary lifecycle | Pinned-source/package checks, occupied-port/rendered-job guards and owned-child cleanup are implemented by `Scripts/browser_streaming.py`. Self-check/Python syntax passed; the foreground lifecycle started the two native instances and signalling. Per-run logs/state are in `Saved/BrowserStreaming/`. |
| Resource guard | After the OOM restart, mocked 9,500 MiB rejects / 13,000 MiB passes, self-check and Python syntax pass. Actual preflight refuses 10,206 MiB without launching children. |
| Corrected key-filter argument | The existing package's isolated `-NullRHI` check exits 0, using `Saved_BrowserArgsQA` and `-NordNoCampaignSave`. `Saved/BrowserStreaming/keyfilter-check.log` records the command-line CVar/property set to `Tilde` at 22:01:07 UTC and the CVar query returning `Tilde`, LastSetByCommandline, at 22:01:11. No unknown-argument warning; self-check/Python syntax pass. This verifies parsing, not rendered browser filtering. |
| Transient-service stop and recovery | Both owned units stopped successfully after the earlier restart failure; other applications were preserved. After GPU headroom returned, the normal units restarted and the public-player regression passed again. All three native/signalling children remained alive through 22:30:15 UTC; [recovery evidence](BrowserGpuRecovery.md). |
| Browser car actions | Real browser controls enter a car, drive with the native HUD showing **045 KM/H** and return to an on-foot character/HUD. `Saved/BrowserStreaming/CarQA/{entered,driving,braked,exit-recheck}.png` reviewed; the first exit capture was early, and the follow-up shows the completed exit. This verifies entry/driving/exit, not handling enjoyment or remote input latency. |
| Bounded visual review | Six final-sample host/friend PNGs inspected: two distinct scene views, real characters/traffic/trees/buildings, readable browser/HUD controls and no framework overlay. Movement poses/views change and Escape restores page control. The dialogue panel obscures feet in the action captures; complete jump/animation/facial quality is not accepted from them. |
| Browser campaign checkpoint | Real browser input completed Mission 1 without phase/save commands or fixture relocation. The isolated host save is 2,104 bytes and its SHA persisted across restart; both peers loaded `RaceReady`, `CompletedMissions=1`. The guest and production save baselines stayed unchanged. One earlier car-entry attempt failed before a later successful entry/drive. [Detailed evidence](BrowserGpuRecovery.md). |
| OpenSpec | Proposal/design/spec/tasks inspected manually. Three added requirements and four scenarios are present. OpenSpec CLI was unavailable; no CLI validation is claimed. |

## Performance and network limits

**Bounded calibration is complete; performance acceptance remains limited.** The final regression's approximately 1.5-second samples range from **17.96–22.62 decoded FPS**. One subsequent **30.003-second simultaneous sample** ran with the final configuration above, brief trusted W/Space/S inputs and six screenshots, without restarting the native games. Installed Playwright/system Chromium was used because the Browser plugin was unavailable. Both real streams remained at 1280×720 with advancing playback and their separate selected IDs.

| Final 30-second sample | Host | Friend |
| --- | ---: | ---: |
| Newly decoded frames | 692 | 726 |
| Average decoded FPS | 23.06 | 24.20 |
| Video receive rate | 9.75 Mbps | 9.63 Mbps |
| Video jitter at sample end | 35 ms | 33 ms |
| Mean decode time per decoded frame | 4.67 ms | 4.58 ms |
| Mean processing delay per decoded frame | 58.89 ms | 62.00 ms |
| Mean jitter-buffer delay per emitted frame | 54.17 ms | 57.38 ms |
| Reported dropped frames / packet-loss increment / freeze increment | 0 / 0 / 0 | 0 / 0 / 0 |

Reported nominated candidate RTT values were **0–2 ms** on this PC; they do not measure end-to-end input latency or internet latency. Processing and jitter-buffer metrics are browser receiver statistics, with cumulative deltas divided by decoded/emitted frames. The JSON retains before/after/intermediate counters. Three console entries reported resource 404s, with no JavaScript page exceptions or failed media checks; this sample did not capture those resource URLs. The earlier deployment check identified missing favicon requests.

All six PNGs and the raw sample are locally under `Browser/.qa/dual-stream-2026-10-10T21-43-21-333Z/`. The two temporary QA contexts and their browser were closed afterwards; existing games/signalling were not restarted. This single short sample is not a sustained soak, worst-case gameplay test or 30/60 FPS guarantee. Earlier native static-view frame budgets measure a different workload and do not establish simultaneous streaming performance. The preceding 60-cap regression at 21:30 observed 15.97–18.63 decoded FPS; it remains local historical evidence rather than the final result.

H264 signalling connected but capture stalled without playable frames on this Linux host. The working test used VP8 software encoding with synchronous MediaIO capture. Hardware encoding remains a future retest after engine/driver changes.

The deployed test ran **on the host PC**, using the actual public player and Funnel endpoint. This PC's Tailscale DNS resolves its own Funnel hostname to a tailnet address that Chromium local-network checks can block from the Vercel origin. For this isolated QA browser only, `NORD_FUNNEL_PUBLIC_IP` mapped that one hostname to its observed public Funnel IP, with IP validation and normal browser security retained. No system DNS or global browser security setting changed. This does not establish that a friend behind a different NAT/firewall can receive media. No off-LAN test has been performed; STUN may be insufficient, and a reachable TURN relay may be needed.

## Remaining acceptance and risks

- Extend the bounded calibration with sustained moving gameplay/input-latency acceptance; the measured 23–24 FPS and passing regression do not establish racing-game responsiveness.
- Keep enough GPU headroom for two full Unreal processes. The normal host was restored and passed a fresh same-PC public regression, but its preflight cannot reserve memory or guarantee uptime under later GPU contention.
- Review complete walk/run/jump/crew switching and both characters interacting in the native world. Brief movement captures and separately verified car actions do not establish full animation/face quality or manual co-op comprehension.
- Listen to playback and test manual driving feel/comprehension with two people. Received audio packets do not prove audible sound.
- Continue through Mission 2 and verify the full browser campaign/reload. Mission 1 boundary and isolated save/reload passed in [BrowserGpuRecovery.md](BrowserGpuRecovery.md); the earlier native save evidence remains in [StorySlice.md](StorySlice.md).
- Test actual media and input from an off-LAN desktop browser. Emulated mobile controls pass; new physical-phone input and sustained responsiveness remain open.
- The public demo has two slots and no authentication, reservations or automatic recovery. Anyone reaching signalling can attempt to occupy a slot; sharing one slot is not multiplayer.
- Upstream control messages let a subscribed input owner request resolution changes and affect GPU/resource load despite the disabled Pixel Streaming `ConsoleCommand` payload path. The earlier unknown Tilde-filter argument was ineffective; corrected native parsing and a bounded rendered Backquote check pass. Input/command restrictions are not complete public resource isolation.
- Eight runtime signalling dependency audit findings remain. Active WebSocket paths were reviewed and the unused default static server is disabled with `--no_config`; the findings are not resolved and production security is not accepted.

## Later restart failure and recovered current state

The original tool-terminal foreground lifecycle and Funnel stopped cleanly. The replacement transient user services initially reached active/running with `Transient=yes` and `Restart=no`, avoiding tool-terminal cleanup. A later restart after another GPU application started failed in the friend process at **21:51:43 UTC**, with Vulkan unable to allocate **134,217,728 bytes (128 MiB)**. The failure is recorded in `Saved/BrowserStreaming/friend-20261010-215114-2922917.log`.

Both owned services were then stopped through `systemctl --user stop`; the lifecycle was `stopped` and Tailscale Serve was `{}`. Other GPU applications were not closed or modified. After shutdown, a 10,206 MiB free-VRAM probe was refused by the new 12,000 MiB guard without launching any child. The guard only checks NVIDIA adapter 0 at launch and cannot reserve memory or prevent later competing allocations. Its mocked rejection/acceptance checks, self-check and Python compilation pass.

After other rendered Unreal work exited externally, the unchanged guard passed at 12,787 MiB free. The isolated campaign QA completed Mission 1 and reloaded its save on both peers. The unchanged normal lifecycle and Funnel then restarted. A fresh public-endpoint seven-check regression passed, and all three children remained alive through the 22:30:15 UTC bounded check, at least 2,431 MiB free. No renderer quality, game assets, deployment or guard bypass changed. This is [documented in detail](BrowserGpuRecovery.md). The original 30-second performance result remains historical; the fresh regression observed brief samples around 21.3–23.3 decoded FPS, not sustained performance acceptance.

Use [HOSTING.md](../Browser/HOSTING.md) for pinned preparation, transient-service/manual start/stop, preserved services and network limits, and the [browser README](../Browser/README.md) for repeatable static/live checks. Stopping the PC, game, signalling or current Quick Tunnel ends availability; the Vercel page alone does not keep the game running.
