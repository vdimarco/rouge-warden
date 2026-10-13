# Tasks

Owner: Codex on the host PC. Read `design.md` first. Work in this order; each group needs the one before it. Record every measurement in `games/nord-unreal/Verification/BrowserPerformance.md` and `.json`. Keep the 12,000 MiB launch guard, the existing saves, the public tunnel and the TURN relay as they are. Do not enable `-AllowPixelStreamingCommands` on the public host.

## 1. Baseline and engine facts (no code change)

- [ ] 1.1 Close Dota 2 and other GPU applications (the user asked for this). Record `nvidia-smi` (total and per process) with only the two game processes and the desktop running.
- [ ] 1.2 Settle the open engine facts from the installed engine. Find the plugin with `find /home/von/.local/share/Epic/UE_5.8.3/Engine/Plugins -name PixelStreaming2.uplugin`, then `grep -rn` its `Source` folder for: `Resolution.Width` (what the default handler does, and whether it checks `IsElevated` or a command setting), `AllowPixelStreamingCommands` (which messages it gates), the declarations of `OnNewConnectionNative`, `OnDataTrackOpenNative`, `OnClosedConnectionNative` (parameter types and order) and the thread that broadcasts them, the C++ name of the Response message type, whether capture or encode runs with zero peers (`GetUnwatchedVideoSink`), and `WebRTC.MaxBitrate` / `Encoder.MaxQuality` command handling. Also open Project Settings > Plugins > PixelStreaming2 in the editor for the real setting names. Write the answers into `design.md`.
- [ ] 1.3 Baseline with the current package: run the normal lifecycle, connect one desktop browser to NordHost on the LAN, and record for 60 s: native FPS from both game logs, `nvidia-smi pmon -s u` per process, decoded FPS, freezes, and bitrate. Repeat with a second browser on NordFriend1. Repeat once through the forced relay (TLS) path.
- [ ] 1.4 No-rebuild A/B, one change at a time, same measurement: `MediaIO.EnableExperimentalScheduling 1` against 0 (keep 1 only if capture does not stall); start bitrate 2 Mbps, minimum 0.3 Mbps, maximum 8 Mbps against the current 8/12 Mbps.

## 2. Game rebuild (one package for every native change)

- [ ] 2.1 Tall-frame message: when a browser's data track opens, send a Response with `{"nord":{"frames":1}}` through `FindStreamer(GetDefaultStreamerID())->SendAllPlayersMessage(...)`. Bind at game-instance or module level and also answer a `Nord.Capabilities` request. Add `PixelStreaming2Core` (and the input module named in 1.2) to `Quebec.Build.cs`.
- [ ] 2.2 Size handler: `SetCommandHandler` for the size command (or a `UIInteraction` handler if 1.2 shows commands are gated). Accept flat and nested JSON, clamp to at most 921,600 pixels, even dimensions, at least 360 on the short side, apply with `FSystemResolution::RequestResolutionChange(W, H, EWindowMode::Windowed)`, and return to 1280×720 when all connections close.
- [ ] 2.3 If 1.2 shows the streamer applies `WebRTC.*` and `Encoder.*` commands, override them with handlers that clamp to an allowlisted range.
- [ ] 2.4 Idle throttle: `UQuebecStreamIdleSubsystem` in `Source/Quebec/QuebecStreamIdle.{h,cpp}` as in design decision 5 (flag `-NordIdleThrottle`, 60 s warm-up, 30 s grace, wake at once, `bDisableWorldRendering`, never lower the frame cap on the listen server, `NORD_STREAM_IDLE` log lines). Add an automation test that drives the state logic directly (automation runs in the editor, where the subsystem is not created): warm-up, grace, immediate wake, no frame-cap change on a listen server, rendering restored on shutdown, unrelated streamer ignored.
- [ ] 2.5 Stream budget: `-NordStreamBudget` in `AQuebecSky` as in design decision 6 (10 lamps with fade distance and stable assignment, translucency lighting kept, 3 headlights, 800 rain streaks at width .025, SSR roughness limit about .35 in `ApplySkyGrading`, slower scene and lamp updates). Extend `Quebec.Sky.*` tests for the pool sizes under the flag.
- [ ] 2.6 Compile, run the existing automation tests and `Scripts/smoke_test.py`, and rebuild the browser package with the BuildCookRun command in `Browser/HOSTING.md`.

## 3. Host launcher

- [ ] 3.1 `Scripts/browser_streaming.py`: add `-windowed`, `-NordIdleThrottle` and `-NordStreamBudget` to both slots (before the sky arguments), the bitrate values chosen in 1.4, and the scheduling value chosen in 1.4. Try the launcher-only CVars from design decision 6 and keep the ones that measure better.
- [ ] 3.2 Update `self_check()`: the "no -nord flags without NORD_SKY_ARGS" check must allow the two new flags, and the `[-4:]` sky-argument check must still pass. Run `python3 games/nord-unreal/Scripts/browser_streaming.py self-check`.
- [ ] 3.3 Give browser QA a way to keep both slots awake, or make `live.test.mjs` wait past the 30 s grace period before it samples frame rate.

## 4. Browser page

- [ ] 4.1 Replace `NORD_PORTRAIT_STREAM` with the game's message: one `addResponseEventListener` registered before connecting, JSON checked, tall and sideways frames asked for only after the message, asked again on `playing` if none came. Remove the flag from `build.mjs`, `README.md`, `mobile.test.mjs` and the Vercel project settings.
- [ ] 4.2 Call `stream.webRtcController.resizePlayerStyle()` in the next animation frame after `portrait-stream` toggles. Check look-pad speed by feel on a phone.
- [ ] 4.3 Track asked and received sizes (`data-stream-size`, `data-stream-frame`, `frame-ignored` after 5 s), retry when `emitCommand` returns false, and clear the state on disconnect and slot change.
- [ ] 4.4 Round requests to aspect steps with hysteresis. Ask sideways phones for a frame of their own shape (up to 21:9) and show it with `contain`; allow `fill` only within 3% of the box aspect.
- [ ] 4.5 If 1.2 shows bitrate commands work, send a per-connection profile after the `initialSettings` event: relay over TLS or TCP gets at most 4 Mbps.
- [ ] 4.6 Move the sizing rules into a pure module with `node:test` tests. Add a no-host test to `browser.test.mjs` with a `canvas.captureStream()` frame and injected Response frames, for message present and absent, at 390×844, 412×915 and 844×390, plus a phone without element fullscreen. Update `mobile.test.mjs` to compare aspect instead of exact pixels and to compute HUD regions from the received frame.
- [ ] 4.7 Run `npm test` and the browser checks in `games/nord-unreal/Browser` (set `NORD_CHROMIUM_PATH` if `/usr/bin/chromium` is missing).

## 5. Ship and check

- [ ] 5.1 Restart the lifecycle with the rebuilt package and run `live.test.mjs` and `mobile.test.mjs` against it.
- [ ] 5.2 Repeat the measurements from 1.3 with each new flag on and off, plus the night-rain budget scenario (`NORD_SKY_ARGS="-NordHour=22 -NordWeather=Rain -NordFreezeTime -NordFreezeWeather"`) with paired captures. Record the results against the baseline.
- [ ] 5.3 Check the current Quick Tunnel hostname, deploy the page to the nord-montreal production project, and confirm every deployed file matches a local build. The project is now linked to this repository with root `games/nord-unreal/Browser` (Vercel builds a preview for each branch), so check in the Vercel project settings whether a merge to `main` also deploys production. With the game message from 4.1 in place, an early deploy is safe: an old game build keeps the page at 1280×720.
- [ ] 5.4 Ask the user to check on a physical phone: upright fills the screen, sideways is not stretched, look speed feels right, play is smooth on mobile data.
- [ ] 5.5 Update `Browser/HOSTING.md`, close the matching open items in `openspec/changes/nord-browser-streaming/tasks.md` (62, 63, 64), validate with `openspec validate nord-stream-speed --strict`, and archive when every scenario has passed.
