# Tasks

Owner: Codex on the host PC. Read `design.md` first; its **(check on host)** items are settled in task 1.2.

Order: group 0 first. Group 4 (page) and the page deploy in 5.3 need only groups 0 and 1, because an old game build never sends the frame message. Groups 2 and 3 are needed for 5.1, 5.2 and 5.4.

Keep the 12,000 MiB launch guard, the saves, the public tunnel and the TURN relay as they are. Never enable `-AllowPixelStreamingCommands` on the public host. Never stop user applications other than Dota 2 without asking.

## 0. Host checkout and safety

- [ ] 0.1 Work in the checkout the services run from: `/home/von/Work/rouge-warden-codex-nord-unreal` (see `games/nord-unreal/Browser/HOSTING.md`). Record its `git status`, HEAD, and the hashes of `Content/Maps/*.umap` and of authored assets that differ from Git. Fetch and merge `main` and this change's branch without resetting. If maps or `Content` differ from Git, stop and ask the user before merging. QA uses Playwright from `qa/browser` in this checkout (`npm ci --prefix qa/browser`).
- [ ] 0.2 Agree a maintenance window with the user for each task that restarts `nord-browser-demo`, builds a package, or runs a rendered editor or game job. End each window by restoring the demo with the `systemd-run` command in `HOSTING.md`, then run `live.test.mjs` against production.
- [ ] 0.3 Records rule: never write ICE server lists, TURN usernames or passwords, or candidate URLs with credentials into `Verification/` or reports. Before each commit, grep the records and `.qa` reports for the TURN username.
- [ ] 0.4 If the OpenSpec CLI is not installed, follow the tool setup in `AGENTS.md`, or check the structure by hand and report that CLI validation did not run.

## 1. Baseline and engine facts (no game rebuild)

- [ ] 1.1 The user asked on 2026-10-13 to close Dota 2. Close it when the user confirms they are not playing it. Then record `nvidia-smi` (total and per process).
- [ ] 1.2 Settle the open engine facts from the installed engine source, without opening a rendered editor while the demo runs. Find the plugin with `find /home/von/.local/share/Epic/UE_5.8.3/Engine/Plugins -name PixelStreaming2.uplugin`, then `grep -rn` its `Source` folder for:
  - which modules declare `IPixelStreaming2Streamer`, `IPixelStreaming2InputHandler` and `UPixelStreaming2Delegates` (for `Quebec.Build.cs`; `OnDataTrackClosedNative(FString, FString)` already compiles at `QuebecGameplay.cpp:1242`);
  - the default `Resolution.Width` handler: what it calls, and whether it checks `IsElevated` or a command setting;
  - what `AllowPixelStreamingCommands` gates, and whether custom `SetCommandHandler` commands run without it. This picks the request channel for design decisions 3 and 4: `Command` if they run, otherwise `UIInteraction` (find how C++ can register a `UIInteraction` handler);
  - the C++ name of the Response message type;
  - the declarations of `OnNewConnectionNative`, `OnDataTrackOpenNative` and `OnClosedConnectionNative` (parameter types and order), and the thread that broadcasts them;
  - whether capture or encode runs with zero peers (`GetUnwatchedVideoSink`);
  - whether `WebRTC.MinBitrate`, `WebRTC.MaxBitrate`, `WebRTC.Fps` and `Encoder.*` commands are applied;
  - the CVar and command-line names for start, minimum and maximum bitrate and FPS (settings class and CVar declarations), and whether several codecs are negotiated.
  Confirm the bitrate names with an isolated `-NullRHI` start of the package that queries each CVar, as was done for `PixelStreamingKeyFilter` (value and `LastSetByCommandline`). Note whether Lumen runs at GI quality 1 on this host (`r.Lumen.IrradianceFieldGather`). Write the answers into `design.md`.
- [ ] 1.3 Add `games/nord-unreal/Browser/stream-sample.mjs`. It uses Playwright from `qa/browser` and a local page build (`NORD_SIGNALLING_URL=ws://127.0.0.1:9010`), connects to a chosen slot, and records 60 s of `inbound-rtp` `framesDecoded`, `framesDropped`, `bytesReceived`, `freezeCount` and `totalFreezesDuration`, the longest gap between `requestVideoFrameCallback` calls, the frame size and the selected candidate type. It writes raw JSON under ignored `Saved/BrowserStreaming/samples/`. A `--relay` option sets `iceTransportPolicy: relay` and uses the TURN host mapping from `Verification/BrowserMobileConnection.md`, and the report labels the mode. The client is the host PC's own Chromium; record its GPU use separately.
- [ ] 1.4 Native FPS for the current package: read the `GFrameCounter % 1000` prefix of log lines (`BrowserPerformance.md`) over windows of 20 s or less, counting wraps.
- [ ] 1.5 In a window: baseline with one browser on NordHost for 60 s, then one browser on each slot, then once through `--relay`. Record native FPS, `nvidia-smi pmon -s u` and VRAM per process, and the sampler metrics.
- [ ] 1.6 Launcher options in `Scripts/browser_streaming.py`, validated like `NORD_SKY_ARGS` and applied to both slots: `NORD_STREAM_FLAGS` (any of `idle`, `budget`, `windowed`; each maps to `-NordIdleThrottle`, `-NordStreamBudget`, `-windowed`), `NORD_STREAM_BITRATE=start,min,max` in bit/s within 300000–12000000, and `NORD_STREAM_SCHEDULING=0|1`. Use the names from 1.2. Defaults keep today's behaviour until 3.1. Record the values in `lifecycle.json`. Extend `self_check()` for every flag combination and for rejected values, keep the `[-4:]` sky-argument check passing, and run `python3 games/nord-unreal/Scripts/browser_streaming.py self-check`.
- [ ] 1.7 In a window, one change at a time, with each value read back first (page `initialSettings` for min/max bitrate and FPS, first-second `bytesReceived` for the start rate): `NORD_STREAM_SCHEDULING=1` against 0, where 1 stays only if no decoded-frame gap exceeds 1 s and native frames advance for 10 minutes on both slots; then a start bitrate at the relay throughput measured in 1.5 against 8 Mbps, with minimum 0.3 Mbps and maximum 12 Mbps. Measure how long a direct desktop takes to reach 6 Mbps.
- [ ] 1.8 In a window, on one slot: build the current page locally with `NORD_PORTRAIT_STREAM=1`, start the slot with `NORD_STREAM_FLAGS=windowed`, connect from a portrait-sized local browser, and record whether `videoWidth`/`videoHeight` change. This shows whether the engine resizes the stream under the current launch flags, and what an old package does with a tall request.

## 2. Game rebuild (one package for every native change)

- [ ] 2.1 First finish the native steps of `openspec/changes/nord-sky-water/tasks.md`: build the editor and Linux targets, run `Scripts/plateau_atmosphere.py` in a NullRHI editor (confirm `NORD_SKY_WATER_AUTHORED` and the unchanged map hash), and run `Quebec.Sky.*`. Tick the items there that pass. Commands:
  - `/home/von/.local/share/Epic/UE_5.8.3/Engine/Build/BatchFiles/Linux/Build.sh QuebecEditor Linux Development "$PWD/Quebec.uproject" -WaitMutex -NoUBA -NoHotReloadFromIDE` (from `games/nord-unreal`).
  - Automation: `UnrealEditor-Cmd "$PWD/Quebec.uproject" /Game/Maps/LaFontaine -NullRHI -unattended -nop4 -nosound -NordCampaignQA '-ExecCmds=Automation RunTests Quebec;SoftQuit'` (see `Verification/CompactHUD.md`).
- [ ] 2.2 Add the modules from 1.2 to `Quebec.Build.cs`.
- [ ] 2.3 Frame message: on data-track open, send the Response `{"nord":{"frames":1}}` through `FindStreamer(GetDefaultStreamerID())->SendAllPlayersMessage(...)`, bound at game-instance or module level. Answer the capabilities request on the channel chosen in 1.2 (`Command` `{"Nord.Capabilities":1}`, or `UIInteraction` `{"nord":"capabilities"}`) with the same Response.
- [ ] 2.4 Size handler on the same channel, plus an override of the built-in `Resolution.Width` handler. Accept flat and nested JSON, clamp to at most 921,600 pixels, even dimensions and at least 360 on the short side, apply with `FSystemResolution::RequestResolutionChange(W, H, EWindowMode::Windowed)`, and return to 1280×720 when all connections close. Add a `Quebec.Stream.FrameSize` automation test: flat and nested JSON, 4096×4096, odd sizes, a short side under 360, and the reset.
- [ ] 2.5 If 1.2 shows `WebRTC.*` and `Encoder.*` commands are applied, override them with clamping handlers: minimum bitrate 0.3–2 Mbps, maximum 1–12 Mbps, FPS fixed at 30, encoder quality within the host defaults. Restore the host values when all connections close.
- [ ] 2.6 Idle throttle: `UQuebecStreamIdleSubsystem` as in design decision 5. Add a `NORD_STREAM_FPS frames=... seconds=...` log line every 5 s on both slots when `-NordStreamFps` is present (the launcher always passes it, so flag-off runs log too). Add an automation test that drives the state logic directly (automation runs in the editor, where the subsystem is not created): warm-up, grace, immediate wake, no frame-cap change on a listen server, rendering restored on shutdown, unrelated streamer ignored.
- [ ] 2.7 Stream budget: `-NordStreamBudget` in `AQuebecSky` as in design decision 6, with a getter that `AQuebecController::ApplySkyGrading` reads. Extend `Quebec.Sky.*` for the pool sizes under the flag.
- [ ] 2.8 Run the automation tests and the smoke test (`games/nord-unreal/README.md`: `UnrealEditor-Cmd ... -NullRHI -RenderOffscreen -unattended -NordNoCampaign -ExecutePythonScript="$(pwd)/Scripts/smoke_test.py" -nosound`). The smoke test has a known comic-look mismatch (last open items of `nord-sky-water/tasks.md`). If it fails only there, record it and ask the user; do not edit the test or the spec.
- [ ] 2.9 Package without touching the live one. Archive with the `HOSTING.md` BuildCookRun command, but with `-archivedirectory="$PWD/games/nord-unreal/Builds/BrowserNext"`. Before the swap: hash and copy aside every `SaveGames` directory and `Saved/Config/Linux/GameUserSettings.ini` under `Builds/Browser` (see `Verification/CompactHUDPreservation.json`), start the new package once with `-NullRHI`, and require no `NORD_SKY missing` lines in its log. In a window, keep the old tree as `Builds/BrowserPrevious`, move `BrowserNext` into place, copy the saves and settings back, and check that their hashes are unchanged. Rollback: stop the demo, move `Builds/BrowserPrevious` back to `Builds/Browser`, and start the demo.

## 3. Launcher defaults after the rebuild

- [ ] 3.1 Make `idle`, `budget` and `windowed` the defaults of `NORD_STREAM_FLAGS`, always pass `-NordStreamFps`, and set the bitrate and scheduling defaults chosen in 1.7. Update `self_check()`.
- [ ] 3.2 In a window, try the launcher CVars from design decision 6 in the pinned night-rain scene. Keep one only if it lowers the median GPU frame time of each process by at least 3% and the user sees no change in paired screenshots.
- [ ] 3.3 With both slots at 22:00 in rain, record peak VRAM per process and free VRAM. If the free memory left after launch falls below 2,000 MiB, report it to the user; do not change the guard.

## 4. Browser page

- [ ] 4.1 Replace `NORD_PORTRAIT_STREAM` with the game's frame message: one `addResponseEventListener` registered before connecting, JSON shape checked, the capabilities request sent once on `playing` if no Response came within 1 s (channel from 1.2), and tall or sideways frames asked for only after the message. Remove the flag from `build.mjs`, `README.md` and `mobile.test.mjs`. Leave the Vercel environment variable until 5.3.
- [ ] 4.2 Call `stream.webRtcController.resizePlayerStyle()` in the next animation frame after `portrait-stream` toggles. The feel check is in 5.4.
- [ ] 4.3 Track asked and received sizes (`data-stream-size`, `data-stream-frame`, `frame-ignored` after 5 s without a matching aspect). Retry when the send returns false. Clear the state on disconnect and slot change.
- [ ] 4.4 Round requests to aspect steps with hysteresis. After the frame message, ask sideways phones for a frame of their own shape (up to 21:9) and show it with `contain`. Without the message, keep today's landscape fullscreen `fill`.
- [ ] 4.5 If 1.2 shows bitrate commands are applied, cap relayed connections at 4 Mbps: `stream.config.setNumericSetting(...)` from a `setTimeout(0)` inside the `initialSettings` listener.
- [ ] 4.6 Add the `?stats=1` QA readout from design decision 8, without ICE server URLs or credentials.
- [ ] 4.7 Tests:
  - Move the sizing rules into a pure module with `node:test` tests, and add the file to the `test` script in `package.json`.
  - Add a no-host test to `browser.test.mjs` with the mechanism from design decision 8, for message present and absent, at 390×844, 412×915 and 844×390, plus a phone without element fullscreen. Include the look-delta comparison from the spec.
  - In `mobile.test.mjs`, compare aspect instead of exact pixels, compute HUD regions from the received frame, and change the bottom-area check from `.58` to `.60` (bottom 40%).
  - In `live.test.mjs`, start sampling at least 2 s after the slot logs `NORD_STREAM_IDLE state=wake`, and assert that the wake took at most 2 s.
- [ ] 4.8 Run `npm test` and `NORD_CHROMIUM_PATH=<chromium> node browser.test.mjs` in `games/nord-unreal/Browser`.

## 5. Ship and check

- [ ] 5.1 In a window, restart the demo with the new package. Build the page locally with `NORD_SIGNALLING_URL=ws://127.0.0.1:9010`, serve it, and point `NORD_PLAYER_URL` at it. Run `mobile.test.mjs` on NordFriend1 first, then `live.test.mjs`, which needs 1280×720.
- [ ] 5.2 Repeat the 1.5 measurements with each flag on and off, using `NORD_STREAM_FLAGS`. For the night-rain budget scenario, pin both slots with `NORD_SKY_ARGS="-NordHour=22 -NordWeather=Rain -NordFreezeTime -NordFreezeWeather"`, profile 900 frames per process with the CSV profiler and the GPU-stats option named in 1.2, and take paired streamed screenshots at the spawn for the user to review.
- [ ] 5.3 Deploy the page:
  - Before any merge to `main`, read the Vercel project's Git settings (production branch, root, build command) and environment. On 2026-10-13 the project had `NORD_SIGNALLING_URL` and `NORD_PORTRAIT_STREAM=0` for production and preview. Check that `NORD_SIGNALLING_URL` matches the current Quick Tunnel hostname.
  - Deploy with the user's approval: merge to `main` if that deploys production, otherwise run `vercel deploy --prod` from `games/nord-unreal/Browser` with the project environment.
  - Byte-compare the deployed files with a local build. To roll back, promote the previous production deployment.
  - After the new page is live, remove `NORD_PORTRAIT_STREAM` from the project environment. Update `Browser/README.md` and `HOSTING.md`, which still say the project has no Git link.
- [ ] 5.4 Ask the user to check on a physical phone: upright fills the screen, sideways is not stretched, look speed feels right, and 60 s on mobile data with `?stats=1` meets the relay scenario. Record which phone checks did not run.
- [ ] 5.5 Records and OpenSpec:
  - Record results in `Verification/BrowserPerformance.md` and `.json`, and update `Browser/HOSTING.md`.
  - In `openspec/changes/nord-browser-streaming/tasks.md`, close each matching open item only when its own checks pass: "Establish acceptable sustained phone responsiveness …", "Rebuild the game package on the host, redeploy the player, and confirm on a physical phone that the map and the move stick no longer overlap.", "Deploy the comic controls and the fullscreen change …", "Host: rebuild and repackage …" and "Confirm the start screen, the tall game and the hidden move stick on a physical phone."
  - Archive `nord-browser-streaming` first. Then turn this change's overlapping requirement into a MODIFIED "Phone held upright plays a tall game" and run `openspec validate nord-stream-speed --strict`. Archive this change when every scenario has passed or the user accepts the open ones. Review `openspec/specs/nord-browser/spec.md`.
