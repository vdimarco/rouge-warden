# Tasks

Owner: Codex on the host PC. Read `design.md` first; its **(check on host)** items are settled in tasks 1.2 and 1.8.

## Current bounded performance pass — 2026-10-13

The user confirmed the live demo and authorized testing/restarting it in this session. The larger handoff remains open; the checks below describe this performance pass without claiming the unrelated phone-frame, sky-budget or deployment tasks.

- [x] Inspect the actual service checkout, preserve maps/saves, fetch and fast-forward current `main` without resetting local changes. The old handoff branch was removed remotely; its change is already on `main`.
- [x] Add a real 60-second direct/relay sampler, including decoded frames, bitrate, drops, freezes and video-frame gaps; cover calculations with a unit test. Retain failed attempts as well as completed samples.
- [x] Confirm bitrate arguments by engine-source inspection and isolated packaged readback.
- [x] Add validated bitrate, capture-scheduling and idle/windowed flags; retain launch guards and record the effective settings in the lifecycle report.
- [x] Implement idle-slot rendering suspension, immediate matching-stream wake and native FPS logs without reducing simulation frame caps.
- [x] Build editor/game targets, pass all 19 native automation tests and 69 smoke checks, and cook a separate replacement package successfully.
- [x] Measure flag-off/on native/browser performance, real wake/input and relay behavior using the same package; record live-weather/background-workload limits.
- [x] Install idle rendering suspension and CPU service priority, restore the ordinary demo, verify public media/input/reconnect and save/tunnel preservation, and record remaining physical-phone limitations. Lower bitrate and frame-size experiments were not retained.
- [x] Prepare a release candidate based on the actual deployed gyro/drag player; apply the four-line landscape action-row correction and pass 17 unit, 11 mobile and seven live checks through the new WSS route. Keep it separate from the uncommitted native performance checkout.
- [x] Merge PR #338 and publish production deployment `dpl_FYQAQ4mbiKNSKeQyMQ77hLTZPgyB` with the restored tunnel. Compare all twelve public files to the tested candidate and pass seven live and 11 mobile checks on the actual production alias. Physical-phone, carrier, driving and the larger handoff's acceptance remain open. See `Verification/BrowserOptimization.md`.

Order: group 0 first. Group 4 (page) and the page deploy in 5.3 need only groups 0 and 1, because an old game build never sends the frame message and the page sends no size request or bitrate cap without it. Groups 2 and 3 are needed for 5.1, 5.2 and 5.4. Fetch the branch again before each group; the handoff may receive fixes.

Keep the 12,000 MiB launch guard, the saves, the public tunnel and the TURN relay as they are. Never enable `-AllowPixelStreamingCommands` on the public host. Never stop user applications other than Dota 2 without asking.

## 0. Host checkout and safety

- [ ] 0.1 Work in the checkout the services run from: `/home/von/Work/rouge-warden-codex-nord-unreal` (see `games/nord-unreal/Browser/HOSTING.md`). Record its `git status`, HEAD, and the hashes of `Content/Maps/*.umap` and of authored assets that differ from Git. Fetch `main` and branch `ccr-bba4610e-so9rcg` (PR #332, which carries this change) and merge them without resetting. If maps or `Content` differ from Git, stop and ask the user before merging. QA uses Playwright from `qa/browser` in this checkout (`npm ci --prefix qa/browser`).
- [ ] 0.2 Maintenance windows. Agree a window with the user for each task that restarts the demo or runs a rendered editor or game job.
  - Stop only the game lifecycle: `systemctl --user stop nord-browser-demo.service`. Never stop `nord-browser-public`, the two funnel units or the `nord-browser-turn` container: a new Quick Tunnel hostname breaks the live page, and the TURN container has no recorded recreate command.
  - Test launches use the demo's `systemd-run` command from `HOSTING.md` (with its `NORD_ICE_CONFIG`) plus `--setenv=` for `NORD_STREAM_*` and `NORD_SKY_ARGS` as a task needs. Each launch restarts both slots. Never run the foreground `run` at the same time.
  - End each window by starting the plain demo command again. Check that the other units are still active and the tunnel hostname is unchanged; if it changed, stop and ask the user. Then run `live.test.mjs` against production.
  - Editor compiles, cooks and NullRHI editor jobs may run outside a window only under `nice -n 19` with a capped job count (UBT `-MaxParallelActions=8`), while a sampler (1.3) records the live decoded FPS. Otherwise run them in a window.
- [ ] 0.3 Records rule: never write ICE server lists, TURN usernames or passwords, or candidate URLs with credentials into `Verification/` or reports. Before each commit, grep the records and `.qa` reports for the TURN username.
- [ ] 0.4 If the OpenSpec CLI is not installed, follow the tool setup in `AGENTS.md`, or check the structure by hand and report that CLI validation did not run.

## 1. Baseline and engine facts (no game rebuild)

- [ ] 1.1 The user asked on 2026-10-13 to close Dota 2. Close it when the user confirms they are not playing it. Then record `nvidia-smi` (total and per process).
- [ ] 1.2 Settle the open engine facts from the installed engine source. Find the plugin with `find /home/von/.local/share/Epic/UE_5.8.3/Engine/Plugins -name PixelStreaming2.uplugin`, then `grep -rn` its `Source` folder for:
  - which modules declare `IPixelStreaming2Streamer`, `IPixelStreaming2InputHandler` and `UPixelStreaming2Delegates` (for `Quebec.Build.cs`; the existing `OnDataTrackClosedNative` binding compiles at `QuebecGameplay.cpp:1227`, handler at `:1243`);
  - every built-in resolution command: its handler key, which JSON shapes it accepts (flat `Resolution.Width` keys and nested `{Resolution:{Width,Height}}`), how nested JSON maps to `SetCommandHandler` names, what it calls, and whether it checks `IsElevated` or a command setting;
  - what `AllowPixelStreamingCommands` gates, and whether custom `SetCommandHandler` commands run without it. This picks the request channel for design decisions 3 and 4: `Command` if they run, otherwise `UIInteraction` (find how C++ can register a `UIInteraction` handler);
  - the C++ name of the Response message type;
  - the declarations of `OnNewConnectionNative`, `OnDataTrackOpenNative` and `OnClosedConnectionNative` (parameter types and order), and the thread that broadcasts them;
  - whether capture or encode runs with zero peers (`GetUnwatchedVideoSink`);
  - whether `WebRTC.MinBitrate`, `WebRTC.MaxBitrate`, `WebRTC.Fps` and `Encoder.*` commands are applied;
  - the CVar and command-line names for start, minimum and maximum bitrate and FPS (settings class and CVar declarations), and whether several codecs are negotiated.
  Also find, in the engine source, the CSV profiler's command-line options and its GPU-timing switch. Confirm the bitrate names with an isolated start of the current package that cannot touch the demo: the package binary with `-NullRHI -saveddirsuffix=BrowserArgsQA -NordNoCampaignSave -abslog=<own file>`, the bitrate arguments under test, and `-ExecCmds` that query each CVar and then quit. Do not pass `-PixelStreamingConnectionURL`, `-PixelStreamingID`, `?listen` or `-port`. Write the answers into `design.md`.
- [ ] 1.3 Add `games/nord-unreal/Browser/stream-sample.mjs`. It uses Playwright from `qa/browser` and a local page build (`NORD_SIGNALLING_URL=ws://127.0.0.1:9010`), connects to a chosen slot, and records `--seconds N` (default 60) of `inbound-rtp` `framesDecoded`, `framesDropped`, `bytesReceived`, `freezeCount` and `totalFreezesDuration`, the longest gap between `requestVideoFrameCallback` calls, the frame size and the selected candidate type. It writes raw JSON under ignored `Saved/BrowserStreaming/samples/`. A `--relay` option sets `iceTransportPolicy: relay` and uses the TURN host mapping from `Verification/BrowserMobileConnection.md`; the report labels the mode. The client is the host PC's own Chromium; record its GPU use separately.
- [ ] 1.4 Native FPS for the current package: read the `GFrameCounter % 1000` prefix of log lines (`BrowserPerformance.md`) over windows of 20 s or less, counting wraps.
- [ ] 1.5 In a window: baseline with one browser on NordHost for 60 s, then one browser on each slot, then once with `--relay`. Record native FPS, `nvidia-smi pmon -s u` and VRAM per process, and the sampler metrics. In the same window, record whether Lumen runs at GI quality 1 (`r.Lumen.IrradianceFieldGather` and the GPU profile from 1.6).
- [ ] 1.6 Launcher options in `Scripts/browser_streaming.py`, validated like `NORD_SKY_ARGS`, applied to both slots and recorded in `lifecycle.json`. Unset means the defaults; an empty value means none.
  - `NORD_STREAM_FLAGS`: any of `idle`, `budget`, `windowed`, mapping to `-NordIdleThrottle`, `-NordStreamBudget`, `-windowed`.
  - `NORD_STREAM_BITRATE=start,min,max` in bit/s within 300000–12000000, using the names from 1.2.
  - `NORD_STREAM_SCHEDULING=0|1`.
  - `NORD_STREAM_PROFILE=<frames>` (100–3000): adds the CSV profiler options from 1.2. The CSV profiler pins the sky, so the launcher refuses it unless `NORD_SKY_ARGS` has `-NordHour` and `-NordWeather`, or `-NordDynamicSky`.
  - `NORD_STREAM_CVARS`: only the four CVars from design decision 6, each with a number, added to the `-ExecCmds` list.
  Defaults keep today's behaviour until 3.1. Extend `self_check()` for every option, flag combination and rejected value, keep the `[-4:]` sky-argument check passing, and run `python3 games/nord-unreal/Scripts/browser_streaming.py self-check`.
- [ ] 1.7 In a window, one change at a time, with each value read back first (page `initialSettings` for min/max bitrate and FPS, first-second `bytesReceived` for the start rate):
  - `NORD_STREAM_SCHEDULING=1` against 0. Keep 1 only if one sampler per slot with `--seconds 600` shows no decoded-frame gap over 1 s and the native frame count advances on both slots.
  - A start bitrate at the relay throughput measured in 1.5 against 8 Mbps, with minimum 0.3 Mbps and maximum 12 Mbps. Measure how long a direct desktop takes to reach 6 Mbps.
- [ ] 1.8 In a window, on the public lifecycle: build the current page locally with `NORD_PORTRAIT_STREAM=1` and launch with `NORD_STREAM_FLAGS=windowed`. Open it in a touch context as `mobile.test.mjs` does (`isMobile: true`, `hasTouch: true`, CDP touch emulation, a portrait viewport), tap Play, confirm that `data-stream-size` shows the tall size, and record whether `videoWidth`/`videoHeight` change. This shows whether the engine resizes the stream under the launch flags, and what an old package does with a tall request.

## 2. Game rebuild (one package for every native change)

- [ ] 2.1 First finish these native items of `openspec/changes/nord-sky-water/tasks.md` and tick them there:
  - "Build the editor and Linux targets": `/home/von/.local/share/Epic/UE_5.8.3/Engine/Build/BatchFiles/Linux/Build.sh QuebecEditor Linux Development "$PWD/Quebec.uproject" -WaitMutex -NoUBA -NoHotReloadFromIDE` from `games/nord-unreal`, then the Linux game target.
  - The NullRHI half of "Run `Scripts/plateau_atmosphere.py`": confirm `NORD_SKY_WATER_AUTHORED` and the unchanged map hash. The rendered `verify_plateau.py` run is a window task.
  - "Run the `Quebec.Sky.*` and existing automation tests": `UnrealEditor-Cmd "$PWD/Quebec.uproject" /Game/Maps/LaFontaine -NullRHI -unattended -nop4 -nosound -NordCampaignQA '-ExecCmds=Automation RunTests Quebec;SoftQuit'` (see `Verification/CompactHUD.md`).
  The rendered captures, profiles and two-player check in that list are window tasks. Rebuild the package only through 2.9, never by archiving into `Builds/Browser`.
- [ ] 2.2 Add the modules from 1.2 to `Quebec.Build.cs`.
- [ ] 2.3 Frame message: on data-track open, send the Response `{"nord":{"frames":1}}` through `FindStreamer(GetDefaultStreamerID())->SendAllPlayersMessage(...)`, bound at game-instance or module level. Answer the capabilities request on the channel chosen in 1.2 (`Command` `{"Nord.Capabilities":1}`, or `UIInteraction` `{"nord":"capabilities"}`) with the same Response.
- [ ] 2.4 Size handler on the same channel, plus overrides of every built-in resolution handler found in 1.2. Accept flat and nested JSON, clamp to at most 921,600 pixels, even dimensions and at least 360 on the short side, apply with `FSystemResolution::RequestResolutionChange(W, H, EWindowMode::Windowed)`, and return to 1280×720 when all connections close. Add a `Quebec.Stream.FrameSize` automation test: flat and nested JSON, 4096×4096, odd sizes, a short side under 360, and the reset. The live check of flat and nested 4096×4096 requests is in 5.1.
- [ ] 2.5 If 1.2 shows `WebRTC.*` and `Encoder.*` commands are applied, override them with clamping handlers: minimum bitrate 0.3–2 Mbps, maximum 1–12 Mbps, FPS fixed at 30, encoder quality within the host defaults. Restore the host values when all connections close.
- [ ] 2.6 Idle throttle: `UQuebecStreamIdleSubsystem` as in design decision 5. Add a `NORD_STREAM_FPS frames=... seconds=...` log line every 5 s on both slots when `-NordStreamFps` is present (the launcher always passes it, so flag-off runs log too). Add an automation test that drives the state logic directly (automation runs in the editor, where the subsystem is not created): warm-up, grace, immediate wake, no frame-cap change on a listen server, rendering restored on shutdown, unrelated streamer ignored.
- [ ] 2.7 Stream budget: `-NordStreamBudget` in `AQuebecSky` as in design decision 6, with a getter that `AQuebecController::ApplySkyGrading` reads. Extend `Quebec.Sky.*` for the pool sizes under the flag.
- [ ] 2.8 Run the automation tests and the smoke test (`games/nord-unreal/README.md`: `UnrealEditor-Cmd ... -NullRHI -RenderOffscreen -unattended -NordNoCampaign -ExecutePythonScript="$(pwd)/Scripts/smoke_test.py" -nosound`) after the stream-speed implementation. The user authorized correcting the stale default-look fixtures on 2026-10-13; the current base passes 18 automation tests and 69 smoke checks (see `games/nord-unreal/Verification/PCDemoRefresh.md`). This does not validate the future stream-speed code.
- [ ] 2.9 Package and swap:
  - Cook into a separate folder: the `HOSTING.md` BuildCookRun command with `-archivedirectory="$PWD/games/nord-unreal/Builds/BrowserNext"` (0.2 rules for running outside a window).
  - Check the new package: `-NullRHI -saveddirsuffix=BrowserNextQA -NordNoCampaignSave -NordHour=22 -NordWeather=Rain -abslog=<own file>` with a timed quit. Require a `NORD_SKY host hour=` line and no `NORD_SKY missing` lines.
  - Swap in a window. Stop the demo. Move `Builds/Browser` to `Builds/BrowserPrevious` and `Builds/BrowserNext` to `Builds/Browser`. Copy every `Saved*/SaveGames` folder and every `Saved*/Config/Linux/GameUserSettings.ini` from `BrowserPrevious` into the new tree (see `Verification/CompactHUDPreservation.json`). Check that their hashes match `BrowserPrevious`.
  - Rollback: stop the demo, move `Builds/Browser` to `Builds/BrowserFailed`, copy its `Saved*/SaveGames` into `Builds/BrowserPrevious` only after checking the save format still loads, move `BrowserPrevious` back to `Builds/Browser`, record the hashes, and start the demo.

## 3. Launcher defaults after the rebuild

- [ ] 3.1 Make `idle`, `budget` and `windowed` the defaults of `NORD_STREAM_FLAGS`, always pass `-NordStreamFps`, and set the bitrate and scheduling defaults chosen in 1.7. Update `self_check()`.
- [ ] 3.2 In a window, try the CVars from design decision 6 through `NORD_STREAM_CVARS` in the pinned night-rain scene. Keep one only if it lowers the median GPU frame time of each process by at least 3% (`NORD_STREAM_PROFILE=900`) and the user sees no change in paired screenshots.
- [ ] 3.3 With both slots at 22:00 in rain, record peak VRAM per process and free VRAM. If the free memory left after launch falls below 2,000 MiB, report it to the user; do not change the guard.

## 4. Browser page

- [ ] 4.1 Replace `NORD_PORTRAIT_STREAM` with the game's frame message: one `addResponseEventListener` registered before connecting, JSON shape checked, the capabilities request sent once on `playing` if no Response came within 1 s (channel from 1.2), and tall or sideways frames asked for only after the message. Remove the flag from `build.mjs`, `README.md` and `mobile.test.mjs`. Leave the Vercel environment variable until 5.3.
- [ ] 4.2 Call `stream.webRtcController.resizePlayerStyle()` in the next animation frame after `portrait-stream` toggles. The feel check is in 5.4.
- [ ] 4.3 Track asked and received sizes (`data-stream-size`, `data-stream-frame`, `frame-ignored` after 5 s without a matching aspect). Retry when the send returns false. Clear the state on disconnect and slot change.
- [ ] 4.4 Round requests to aspect steps with hysteresis. After the frame message, ask sideways phones for a frame of their own shape (up to 21:9) and show it with `contain`. Without the message, keep today's landscape fullscreen `fill`.
- [ ] 4.5 If 1.2 shows bitrate commands are applied, cap relayed connections at 4 Mbps: `stream.config.setNumericSetting(...)` from a `setTimeout(0)` inside the `initialSettings` listener. Send the cap only after the game's frame message, because only a build with the 2.5 clamp and restore returns the slot to its host values; on an old package the cap would stay for every later visitor.
- [ ] 4.6 Add the `?stats=1` QA readout from design decision 8, without ICE server URLs or credentials.
- [ ] 4.7 Tests:
  - Move the sizing rules into a pure module with `node:test` tests, and add the file to the `test` script in `package.json`.
  - Add a no-host test to `browser.test.mjs` with the mechanism from design decision 8, for message present and absent, at 390×844, 412×915 and 844×390, plus a phone without element fullscreen. Include the converter check from the spec.
  - In `mobile.test.mjs`: compare aspect instead of exact pixels, compute HUD regions from the received frame, change the bottom-area check from `.58` to `.60` (bottom 40%), and replace the two `streamSize === '1280x720'` checks (the landscape wait and the build-flag skip) with waits on the received aspect and a skip decided by the frame message. In `fullscreenClearance`, expect `object-fit: contain` and a picture that reaches all four edges within the aspect-step tolerance when the frame message arrived; keep the `fill` assertion only when it did not.
  - In `live.test.mjs`: read `lifecycle.json` for the slot log paths and flags. Only if the slot's last logged state was sleep, measure wake time from the `NORD_STREAM_IDLE state=wake` log time to the first video frame whose world area (outside the HUD panels) is not black; a first played frame that already shows the world counts as 0 s. Require at most 2 s, and start frame-rate sampling at least 2 s after the wake line.
  - Add a friend-only mode to `live.test.mjs` (`NORD_LIVE_SLOTS=NordFriend1`) that never connects to NordHost. It asserts walking (the stream image changes while W is held) and driving (enter the car with E, hold W, and the image keeps changing), plus a host log line or a logged position change where the game provides one. The host-slot idle scenario uses this mode.
- [ ] 4.8 Run `npm test` and `NORD_CHROMIUM_PATH=<chromium> node browser.test.mjs` in `games/nord-unreal/Browser`.

## 5. Ship and check

- [ ] 5.1 In a window, restart the demo with the new package. Build the page locally with `NORD_SIGNALLING_URL=ws://127.0.0.1:9010`, serve it, and point `NORD_PLAYER_URL` at it. Run `mobile.test.mjs` on NordFriend1 first, then `live.test.mjs`, which needs 1280×720. From a local test page, send flat and nested 4096×4096 requests and check that the frame stays at most 921,600 pixels.
- [ ] 5.2 Repeat the 1.5 measurements with each flag on and off, using `NORD_STREAM_FLAGS`. For the night-rain budget scenario, pin both slots with `NORD_SKY_ARGS="-NordHour=22 -NordWeather=Rain -NordFreezeTime -NordFreezeWeather"`, profile with `NORD_STREAM_PROFILE=900`, and take paired streamed screenshots at the spawn for the user to review.
- [ ] 5.3 Deploy the page:
  - Before any merge to `main`, read the Vercel project's Git settings (production branch, root directory, build command) and environment. On 2026-10-13 the project had `NORD_SIGNALLING_URL` and `NORD_PORTRAIT_STREAM=0` for production and preview. If `NORD_SIGNALLING_URL` does not match the current Quick Tunnel hostname, update it only with the user's approval.
  - Deploy with the user's approval: make a production build of the tested commit and assign the production domain to it by hand, as `Browser/README.md` describes (preview builds add Vercel's feedback toolbar to `index.html`, so never promote a preview). Never run the Vercel CLI from the services checkout: its ignored files (`Saved/BrowserStreaming/relay/`, `ice-*.json`, `Builds/`) hold TURN credentials and saves, and the CLI does not read `.gitignore`. If a CLI deploy is needed, export the commit to a clean folder (`git worktree add <tmp> <commit>`), run `vercel link --project nord-montreal` there and check the link, then run `vercel deploy --prod` from that folder's root.
  - Byte-compare the deployed files with a local build. To roll back, promote the previous production deployment.
  - After the new page is live, remove `NORD_PORTRAIT_STREAM` from the project environment. Update `HOSTING.md`, which still says the project has no Git link (`Browser/README.md` already describes it).
- [ ] 5.4 Ask the user to check on a physical phone: upright fills the screen, sideways is not stretched, look speed feels right, and 60 s on mobile data with `?stats=1` meets the relay scenario. Record which phone checks did not run.
- [ ] 5.5 Records and OpenSpec:
  - Record results in `Verification/BrowserPerformance.md` and `.json`, and update `Browser/HOSTING.md`.
  - In `openspec/changes/nord-browser-streaming/tasks.md`, close each matching open item only when its own checks pass: "Establish acceptable sustained phone responsiveness …", "Rebuild the game package on the host, redeploy the player, and confirm on a physical phone that the map and the move stick no longer overlap.", "Confirm the comic controls, the fullscreen trailer and the automatic fullscreen on a physical phone.", "Host: rebuild and repackage …" and "Confirm the start screen, the tall game and the hidden move stick on a physical phone."
  - Archiving: `nord-browser-streaming` has other open items (Mission 2, external network, iOS, sound, trailer deploy). Ask the user to accept or move them. If it is archived, turn this change's overlapping requirement into a MODIFIED "Phone held upright plays a tall game", run `openspec validate nord-stream-speed --strict`, archive this change when every scenario has passed or the user accepts the open ones, and review `openspec/specs/nord-browser/spec.md`. If it stays open, leave this change open too, because both add the same capability.


## Current co-op throughput pass — 2026-10-19

User target: improve both simultaneous players to a real sustained 30 FPS. This bounded follow-up preserves the delivered solo60 configuration and current graphics, assets, handling, campaign/settings and relay identities. Older handoff tasks remain independently open.

- [x] Inspect the live delivered package/configuration, recent aligned native/browser evidence and shared GPU consumers.
- [x] Measure a settled common interval of at least60seconds for both native and decoded streams, retaining resize/startup events separately. Baseline60-v1: native18.17/18.02, decoded18.15/18.09FPS over65seconds, fixed706×326VP8, no steady loss/drops/freezes.
- [ ] Test one scheduling or resource-contention hypothesis at a time with the strict resource guard, owned maintenance windows and exact current60 restoration.
- [ ] Retain only a measured improvement with real native and decoded rates near30FPS on both peers, stable resolution, no new steady-state stalls and direct visual/control review. Preserve solo responsiveness.
- [ ] Deliver verified source/operational changes, current operator recipes and a concise handoff; report physical-device/off-LAN and remaining throughput limits honestly.

## Touch-stream recovery — 2026-10-21

- [x] Recover the continuation branch in a durable isolated worktree, integrate current main, and retain the dirty source/art checkout and historical receipts.
- [x] Record the completed all-ambience diagnostic separately from target achievement and persistent desktop settings.
- [x] Count touch receiver rates below29FPS as pressure and require35FPS headroom for recovery; test exact boundaries and update rendered fixtures.
- [x] Run offline browser checks and real resized-video adaptation checks, distinguishing injected statistics from actual throughput. CPU81/81, offline UI/layout and3 focused real-media callbacks passed;15 unrelated mobile callbacks were explicitly skipped.
- [ ] Measure fresh simultaneous native/decoded rates and solo responsiveness with current service identities; retain resolution and desktop-workload limits.
- [ ] Review and deliver only verified changes, preserving current progress and the other task's restarted service/deployment.
