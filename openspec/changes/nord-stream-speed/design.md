# Design: faster NORD browser stream and the tall phone frame

This change is a handoff. A cloud session researched it without Unreal Engine, a GPU or access to the host. Codex on the host PC builds, measures and ships it.

Statements without a label come from Epic's public docs, Epic's public PixelStreamingInfrastructure repository at the pinned revision `e5e243ed`, the installed npm frontend `lib-pixelstreamingfrontend-ue5.8` 0.1.2, or this repository. Statements marked **(check on host)** could not be confirmed, because the PixelStreaming2 engine plugin source is not public. Tasks 1.2 and 1.8 settle them from the installed engine before native code is written; write the answers into this file.

## Sources

- Epic, Pixel Streaming 2 migration guide (`Docs/pixel-streaming-2-migration-guide.md`, UE5.8 branch): one encoding session per peer; `-PixelStreamingDegradationPreference` removed and fixed to MAINTAIN_FRAMERATE; the C++ route for messages to the page is the streamer's `SendPlayerMessage` / `SendAllPlayersMessage`.
- Epic, `Frontend/Docs/Settings Panel.md` (UE5.8): "Match viewport resolution ... Resizes the Unreal Engine application resolution ... We recommend using `-windowed`".
- Epic, `Frontend/implementations/typescript/src/showcase.ts` (UE5.8): resolution change is a built-in command and "requires a `-windowed` application". Its sample sends a nested `{Resolution: {Width, Height}}` object, while the library sends flat `Resolution.Width` / `Resolution.Height` keys.
- Epic, `Frontend/Docs/Communicating from the Player Page to UE5.md`: says `emitCommand` needs `-AllowPixelStreamingCommands`. `Security-Guidelines.md` says to launch public hosts without it. These texts disagree about built-in commands, so task 1.2 decides.
- Epic API pages (UE 5.8): `IPixelStreaming2Streamer` (`SendPlayerMessage`, `SendAllPlayersMessage`, `GetConnectedPlayers`, `GetInputHandler`, `ForceKeyFrame`), `IPixelStreaming2InputHandler::SetCommandHandler` ("You can also override the default Pixel Streaming command handlers by setting handlers with the same name"), `UPixelStreaming2Delegates` (`OnNewConnectionNative`, `OnDataTrackOpenNative`, `OnClosedConnectionNative`, `OnAllConnectionsClosedNative`), `UGameViewportClient::bDisableWorldRendering`, `UEngine::SetMaxFPS` ("Overrides console variable"), `ULightComponent::SetMaxDrawDistance`, `SetMaxDistanceFadeRange`, `SetAffectTranslucentLighting`.
- Epic, Lumen guide (5.8): on supporting platforms, GI quality 1 runs a lighter Lumen and smooth surfaces fall back to screen-space reflections. Whether this Linux Vulkan host runs it is **(check on host)** (`r.Lumen.IrradianceFieldGather`, `stat gpu`).
- Installed frontend 0.1.2 (`Browser/node_modules/@epicgames-ps/lib-pixelstreamingfrontend-ue5.8/dist/esm`):
  - `PixelStreaming.emitCommand` blocks only `ConsoleCommand` keys and returns true once the data channel is open (`PixelStreaming.js:592-601`).
  - `Flags.MatchViewportResolution` sends the same flat `Resolution.*` message (`WebRtcPlayerController.js:53-58`).
  - `addResponseEventListener` passes every Response string to every listener.
  - `_onInitialSettings` dispatches the `initialSettings` event first (`PixelStreaming.js:427`) and then overwrites WebRTC min/max bitrate and FPS with the streamer's values (`PixelStreaming.js:473-483`), echoing each one back to the game.
  - The SDP edit for start/max bitrate touches H264 lines only.
  - `WebRtcPlayerController.resizePlayerStyle()` calls `VideoPlayer.resizePlayerStyle()`.
  - Test mocks ship in `dist/esm/__test__/` (for example `mockRTCPeerConnection.js`).
- Repository records:
  - `Verification/BrowserPerformance.md/.json`: 11–13 native FPS under contention; 26–30 decoded FPS in later ~1.5 s desktop samples with Dota 2 still running; 96–97% GPU; 1,374 MiB free VRAM at worst; same-PC direct runs of 6.9–9.4 Mbps; two native encode reports averaging 8.92 ms.
  - `BrowserStreaming.md`: same-PC dual-stream runs of 9.6–9.75 Mbps.
  - `BrowserMobileConnection.json`: forced TURN/TLS relay runs of 0.7–1.7 Mbps, mostly ~1.5 s windows right after connecting, and one 19 s run at 1.19 Mbps that ended at 4 FPS. All relay and direct runs were on the host PC itself.
  - `EnvironmentPolish.json` and `.md`: RTX 4090 (24,564 MiB), i9-14900K.

No outside rendering technique is adapted. The stream budget only lowers counts and ranges of lights and rain that `nord-sky-water` already added.

## Decisions

### 1. Measure first, after Dota 2 is closed

On an RTX 4090, two 1280×720 game processes at 30 FPS with GI and reflections at 1 and virtual shadow maps off should fit. The low native rates came with Dota 2 and the desktop shell on the same GPU. Record a clean baseline before changing the game, so each later change has a cause. The user asked to close Dota 2; close nothing else without asking.

### 2. One rebuild carries every native change

The tall HUD (on `main`), the sky and weather (`nord-sky-water`, never compiled yet), and the native parts below need the same package rebuild. Finish the `nord-sky-water` native steps in the same rebuild, then compare against the baseline with each new flag on and off.

### 3. The game tells the page it supports other frame shapes

Drop the `NORD_PORTRAIT_STREAM` build flag. A build flag lets the page and the host disagree, which is the current fault.

- Game: when a browser's data track opens, send a Response message with `{"nord":{"frames":1}}`. Use `FindStreamer(GetDefaultStreamerID())` and `SendAllPlayersMessage`, because each NORD process has one streamer and one browser. The C++ name of the Response message type is **(check on host)**. Bind at game-instance or module level, because the message belongs to the build, not to a controller.
- Pull: the page asks once on `playing` if no Response came within 1 s, because the data track can open before the game binds its handler, and `dataChannelOpen` fires per channel while requests need the send-receive channel. The request uses the channel chosen in task 1.2: a `Command` with `{"Nord.Capabilities":1}` if custom command handlers run without `-AllowPixelStreamingCommands`, otherwise `emitUIInteraction({"nord":"capabilities"})` with a game-side `UIInteraction` handler **(check on host)**. The game answers with the same Response.
- Page: register one `addResponseEventListener` before connecting, parse the JSON and check its shape (every listener gets every Response), and only then ask for a non-16:9 frame.
- An old package never sends the message, so the page stays at 1280×720 and keeps today's landscape `fill`. The page can therefore deploy before the host rebuild.

### 4. The game owns frame sizes

- Size requests use the channel from task 1.2. The game installs a handler for it, and also overrides every built-in resolution handler with `SetCommandHandler`, so a crafted request cannot ask for 4096×4096. The built-in handler's key and the JSON shapes it accepts (flat `Resolution.Width` keys, nested `{Resolution:{Width,Height}}`) are **(check on host)**; task 5.1 sends both shapes at 4096×4096 to confirm the clamp.
- The handler accepts the flat and the nested JSON shape. It clamps to at most 921,600 pixels (the 1280×720 budget), even numbers, at least 360 on the short side, and applies the size with `FSystemResolution::RequestResolutionChange(W, H, EWindowMode::Windowed)`.
- That this resizes the PixelStreaming2 stream under `-RenderOffscreen -ForceRes -ResX=1280 -ResY=720 -windowed` on Linux Vulkan is **(check on host)**. Task 1.8 tests it on the public lifecycle in a maintenance window before native code relies on it.
- On all-connections-closed, return to 1280×720 so the next visitor does not get a phone's leftover frame.
- Never enable `-AllowPixelStreamingCommands` on the public host.

### 5. An idle slot stops drawing the world

New `UQuebecStreamIdleSubsystem` (`UGameInstanceSubsystem`) in `Source/Quebec/QuebecStreamIdle.{h,cpp}`:

- Created only when `-NordIdleThrottle` is on the command line, `GIsEditor` is false and `-NordCapture` is absent. Only `browser_streaming.py` passes the flag.
- Delegate handlers only set an atomic flag, because the broadcasting thread is **(check on host)**. An `FTSTicker` at 0.25–0.5 s on the game thread polls `GetConnectedPlayers().Num()` (null-safe until the streamer and the game viewport client exist) and applies the state.
- Starts awake, with a 60 s warm-up after the first world BeginPlay. Sleeps after 30 s with no viewer. Wakes at once on any connection signal.
- Sleep: `bDisableWorldRendering = true` on the game viewport client, re-asserted every tick. On NordFriend1 (net mode client) only, lower the frame cap to 10 FPS if the sleeping process still uses more than 5% of the GPU (`nvidia-smi pmon` SM%), and log the value read back. Never lower the cap on NordHost: it is the listen server, traffic steps clamp at 0.05 s and player-car steps at 0.15 s (`QuebecGameplay.cpp:1007`, `:1012`).
- Wake: clear the flag, restore the cap, call `SetGameCameraCutThisFrame` on local player cameras, and optionally `ForceKeyFrame` two frames later. Log `NORD_STREAM_IDLE state=... streamer=... viewers=... reason=...`.
- Rejected: `FViewport::SetGameRenderingEnabled`. It is global and tied to movie and loading-screen presentation, so it probably also stops HUD and Slate output (unconfirmed).
- Whether PixelStreaming2 captures or encodes with zero peers is **(check on host)**. The 3D render is the main cost either way.
- Residents use `OnlyTickPoseWhenRendered` (`QuebecPedestrian.cpp:24`), so their poses freeze while a slot sleeps. Check that they look right after a wake.

The default slot is NordHost, so with one player the sleeping process is usually the friend.

### 6. Stream budget for the sky

`-NordStreamBudget`, read once in `AQuebecSky::StartPresentation` and passed by `browser_streaming.py` to both slots (not through `NORD_SKY_ARGS`, which reaches the host only):

- Street lamps: pool from 24 to 10, attenuation 1800 to 1500 cm, `SetMaxDrawDistance` about 6000 with `SetMaxDistanceFadeRange` about 1500. Keep shadows off and keep translucency lighting on, because `M_NordRain` is lit only through the translucency lighting volume. Keep a lamp in place while it stays in the nearest set, so lamps do not pop.
- Headlights: 6 to 3.
- Rain: 800 instances with width scale .025 instead of 2000 at .012, so streaks stay at least 1 px wide near the player and the encoder sees less sub-pixel flicker.
- Wet reflections: `AQuebecController::ApplySkyGrading` (`QuebecGameplay.cpp`) reads the flag through a new getter on `AQuebecSky` and overrides `ScreenSpaceReflectionMaxRoughness` to about .35.
- Update rates: scene writes every 0.25 s, lamp assignment every 1 s.
- Launcher CVars to try after the rebuild, in the pinned night-rain scene: `r.SSR.MaxRoughness`, `r.SkyLight.RealTimeReflectionCapture.TimeSlice.SkyCloudCubeFacePerFrame 1`, `r.TranslucencyLightingVolumeDim 32`, a lower `r.VolumetricCloud.ViewRaySampleMaxCount`. Read the current values first.

Keep unchanged: moon shadows (cost close to the day sun's), height fog, the pond shader and puddles.

### 7. Bitrate for the relay path

- Keep the 12 Mbps maximum on the host so desktop picture quality does not drop.
- Lower the start bitrate to the relay throughput measured in task 1.5 (the records suggest about 1.2 Mbps). WebRTC should adapt up within seconds on a fast path; task 1.7 measures it. Keep a 0.3 Mbps minimum.
- The legacy flag names `-PixelStreamingWebRTCStartBitrate`, `-PixelStreamingWebRTCMinBitrate` and `-PixelStreamingWebRTCMaxBitrate` are **(check on host)** for PixelStreaming2. An unknown argument gives no warning (the old `-PixelStreamingInputKeyFilter` showed this), so read each value back before comparing.
- If PixelStreaming2 applies `WebRTC.MaxBitrate` commands **(check on host)**, the page caps a relayed connection (TLS or TCP relay candidate) at 4 Mbps, but only after the game's frame message. A command changes the slot's setting, so only a build that restores the host values when the browser leaves may receive it. It must do this after the library finishes handling `initialSettings`: call `stream.config.setNumericSetting(...)` from a `setTimeout(0)` inside the `initialSettings` listener. The game clamps these commands as in decision 4.

### 8. Page fixes found in review

- After `portrait-stream` toggles, call `stream.webRtcController.resizePlayerStyle()` in the next animation frame, so Epic's input-coordinate converter measures the new video box. Without it the converter keeps the 390×219 strip size, so vertical look-pad deltas are about 3.85 times too large in the tall frame (page side). After the fix, vertical deltas shrink by the strip-to-frame height ratio and horizontal deltas stay the same. How the game turns deltas into camera rotation is unconfirmed; upright look may feel slower than today's strip, so the user checks it by feel and look sensitivity may need tuning.
- Keep the size asked for (`data-stream-size`) apart from the size received (`data-stream-frame`). Mark `frame-ignored` after about 5 s without a matching aspect. Retry when the send returns false. Clear these on disconnect and slot change.
- Round requests to a few aspect steps (9:16, 9:18, 9:19.5, 9:20 upright; 16:9, 18:9, 19.5:9, 20:9 sideways) with hysteresis, so toolbar and rotation changes send at most one request each.
- A sideways phone asks for a frame of its own shape (1280 wide, height from its aspect, at most 21:9) only after the game's message. Show such frames with `contain`. Keep today's landscape fullscreen `fill` when the game has not sent the message, so the black bars do not come back on the old build.
- Encoder downscaling under MAINTAIN_FRAMERATE can make the received frame smaller than asked. Compare aspect, not exact pixels.
- Add a QA readout behind `?stats=1`: decoded FPS, freeze count and total freeze time from `inbound-rtp`, the longest gap between `requestVideoFrameCallback` calls, received bitrate and the selected candidate type. Never show ICE server URLs or credentials.
- Move the sizing rules into a pure module with `node:test` tests. Add a no-host test: build with a configured endpoint and a test-only build define that exposes the stream, put a `canvas.captureStream()` on the video element, stub or observe the send, and inject Response frames through `stream.webRtcController.responseController.onResponse(...)` (byte 1, then little-endian UTF-16 text, as in Epic's `PixelStreaming.test.ts`), or use the shipped mock `RTCPeerConnection`.

### 9. Codecs and capture scheduling

- VP8 encoding is probably not the bottleneck: two native encode reports average 8.92 ms (`BrowserPerformance.md`). The `/proc` CPU sample there added no browser subscriber, so it is not an encoder benchmark; whether a viewer was connected is not recorded.
- Test `MediaIO.EnableExperimentalScheduling 1` against 0 during the agreed maintenance window. Keep 1 only if no decoded-frame gap exceeds 1 s and native frames keep advancing for 10 minutes on both slots.
- Retest H264 NVENC and AV1 only by replacing one slot during a maintenance window, never as a third game process (VRAM guard). Whether PixelStreaming2 negotiates several codecs, so VP8 can be a fallback, is **(check on host)**. Test AV1 on a real iPhone and Android phone first. Under H264 the frontend adds `x-google-max-bitrate=100000`, which can override the host cap.

## Risks

- Every native claim needs the host rebuild and a GPU measurement. Nothing here ran against the engine.
- If `OnNewConnectionNative` fires only after ICE completes, the first frame after wake can be black for one poll interval. The Play tap mostly hides it.
- The rebuild adds the sky cost and the throttle saving at the same time. Measure each flag on and off.

## Host implementation, 2026-10-13

The user's current request is mobile performance of the live demo. The first bounded pass implements sustained measurements, validated bitrate/capture-scheduling controls, native FPS telemetry and idle-slot rendering suspension. Tall-frame negotiation, relay-specific browser commands and sky/light reductions remain separate unchecked work below; none is needed to test these changes. Sky assets were already rebuilt and delivered earlier today (`Verification/PCDemoRefresh.md`), so this package does not combine an atmosphere update with the performance change.

Installed UE 5.8.3 facts: `PixelStreaming2PluginSettings.cpp` maps the launch arguments `PixelStreamingWebRTCFps`, `PixelStreamingWebRTCStartBitrate`, `PixelStreamingWebRTCMinBitrate` and `PixelStreamingWebRTCMaxBitrate` to `PixelStreaming2.WebRTC.*`. An isolated NullRHI run of the current package read back 30, 1000000, 300000 and 4000000 respectively, all `LastSetBy: Commandline`, and exited 0. Its log is retained under `Saved/BrowserStreaming/optimization-20261013/bitrate-readback.log`.

`EpicRtcStreamer.cpp` dispatches both `OnNewConnectionNative(FString,FString)` and `OnDataTrackOpenNative(FString,FString)` through `DoOnGameThread`. The idle subsystem therefore wakes directly on those game-thread events and polls connected-player counts every 250 ms. It preserves the original viewport rendering flag and restores it on shutdown. It never changes frame caps, including the listen server's simulation rate. The public launcher retains its GPU guard, VP8 codec, graphics settings and console-command restrictions. The engine's 100 kbps minimum is retained during calibration rather than raising a mobile connection's floor before measuring it.

Sources inspected locally: `Engine/Plugins/Media/PixelStreaming2/Source/PixelStreaming2Settings/Private/PixelStreaming2PluginSettings.cpp`, `PixelStreaming2RTC/Private/EpicRtcStreamer.cpp`, and `PixelStreaming2/Public/PixelStreaming2Delegates.h`. External references checked: [Epic Pixel Streaming reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-pixel-streaming-reference) and [Tailscale Funnel limits](https://tailscale.com/docs/features/tailscale-funnel). No new rendering technique or dependency is introduced.
- Physical phone checks (iPhone Safari has no element fullscreen) can only be done by a person.
- This change adds requirements to `nord-browser`, which `nord-browser-streaming` (not archived) also adds to. Its requirement "Phone held upright plays a tall game" says a sideways phone gets 1280×720. Archive `nord-browser-streaming` first, then turn the overlapping requirement here into a MODIFIED one before archiving this change.

### Host reboot and public-player follow-up — 2026-10-13

The host reboot removed the transient services and changed the Quick Tunnel on restoration. The release candidate preserves the actually published gyro/drag controls from `eff8752e` (also on latest main `54a86fe8`) and adds only a four-line landscape action-row positioning override. It passes 17 unit, 11 mobile and seven live checks; the endpoint update and deployment await the explicit approval in task 5.3. Intel shell offload was reverted after a black-desktop visual failure; matched locked 120/60 Hz trials established lower power at 60 Hz, not a game-FPS gain, and 120 Hz was restored. Existing background pause controls are reused without new desktop code. No native quality, codec, scheduler or package changes are introduced in this follow-up.

The user approved merging and publishing the tested update on 2026-10-13. Preserve the existing native render quality, 75% internal screen percentage, 30 FPS cap, 1280×720 landscape output and supported tall-phone frames; the rejected bitrate/frame-size experiments remain disabled.


## Co-op throughput follow-up — 2026-10-19

The user asks for30FPS on both players after PR415 raised aligned native/WebRTC ceilings to60. Actual solo playback is59.76FPS; simultaneous viewers are17.37/17.32FPS with matching native rates. Previous receiver target0, capture scheduling1 and wallpaper-only experiments did not help. Full GPU durations around55ms include inter-context scheduling; Game/Render critical times are roughly4–6ms. Do not infer that all individual GPU category spans are additive or that the character meshes are the cause.

Read-only GPU samples show substantial desktop activity while both unwatched native worlds sleep. Per-process attribution varies between Hyprland, Quickshell and Codex, with unavailable (`-`) entries; the samples do not establish an exclusive compositor cause. Pausing wallpaper did not isolate persistent desktop overlays or the looping border-angle animation. The first border-angle fixture was rejected after the runtime normalized disabled metadata; the captured animation tuple and all other rows were restored, and no performance gain was established. Do not close user applications, alter monitor modes or persist desktop preference changes as an incidental game fix.

Installed UE5.8.3 `VulkanDevice.cpp` enables separate graphics/async-compute families in both live processes and honors `-DisableAsyncCompute` during device creation. Test that single scheduling flag first as a game-side hypothesis; preserve every image-quality/codec/capture/bitrate argument. A simpler submit CVar is inapplicable with the currently active queue/thread topology. Other possible capture paths are hypotheses only; previous H264 stalls remain rejected, and decoupled repeated frames cannot establish real30FPS.

Reuse the existing pinned stream sampler with90seconds and30seconds warm-up per viewer. Evaluate a common settled interval of at least60seconds, stable negotiated dimensions, at least10 fully enclosed awake native telemetry intervals per world, browser frame pacing, drops/loss/freezes and receiver buffering. Separate successful measurement from achieving the target. Phone adaptation explains brief resize stalls in earlier short samples; preserve those events instead of counting them as steady native performance. Root owns all browser/GPU/service operations and exact normal60 restoration, preserving current progress rather than overwriting it to force equal hashes.

References: installed UE Vulkan source; Epic’s [Stream Tuning Guide](https://dev.epicgames.com/documentation/en-us/unreal-engine/stream-tuning-guide); official [Hyprland variables](https://wiki.hypr.land/Configuring/Basics/Variables/). Continue in the existing isolated source checkout on `codex/nord-coop-stream-throughput`; the original source/art checkout and its checksum-pinned C7 launcher remain intact.

Fresh settled tests reject both single-flag alternatives: async compute disabled reduces decoded/native throughput to about13.8FPS per player; MediaCapture disabled retains native18.7–18.8 but reduces decoded delivery to4.7FPS. Both diagnostics restored exact accepted60, preserving source/package/tunnels/containers and current campaign/settings. No measured throttling correlated with either regression. A separately bounded desktop-overlay A/B/A uses existing runtime IPC reduced-motion support, retains static effects, changes no user file or native launch, and always reapplies the latest disk payload. IPC acknowledges application but exposes no full loaded-state or timer-phase readback; report that limit.

If reduced motion remains below target, the next isolated diagnostic uses the overlays’ existing public `disable`/`enable` IPC methods and observable `runtimeEnabled` Boolean. This temporarily removes desktop effects rather than altering game rendering. Capture/reapply only those runtime Booleans; leave loaded settings, user files, monitor modes and other applications untouched. Use fresh A/B/A measurements and always restore. Animation phase is outside the getter’s observable scope.

## Touch-stream recovery — 2026-10-21

The completed all-ambience A/B/A remained below target: both streams reached about24.14–24.16 decoded FPS at1058×488 while paused, versus about17–18FPS at706×326 before/after. This exposed a receiver-policy gap:24–28FPS was neither poor enough to lower resolution nor healthy enough to recover. Keep these results as diagnostics, not an accepted desktop preference change.

For touch playback, count receiver rates below29FPS as pressure and require35FPS for15 consecutive healthy samples before increasing the existing resolution profile. Rates from29 through34.999FPS hold the current profile. The headroom prevents a receiver barely meeting30FPS from immediately spending that gain on a larger frame. Existing profile sizes, native art settings, bitrate limits, startup grace, emergency handling and controls stay intact. A receiver capped at30FPS deliberately stays at its current profile until35FPS headroom is available; this trades possible resolution recovery for smoother delivery. Non-touch desktop sizing is unaffected.

Validate boundary behavior with pure tests, actual resize/bitrate commands with controlled receiver statistics, and performance separately with unmodified statistics aligned to native telemetry. Fresh measurements are necessary after the host restart; no October19 PID, desktop state or result establishes October21 performance. Recover the continuation branch in `/home/von/Work/rouge-warden-nord-coop-throughput`, integrate current main, and leave the dirty source/art checkout intact. Serialize live tests with the other task restoring the game.

The fresh candidate on/off/on desktop comparison remains below30: about16.7FPS with ambience active and24.1FPS with all scoped ambience paused, at706×326 in the paused phase. Restore all captured/current desktop preferences; there is no accepted persistent desktop workaround. Keep ordinary solo playback and simultaneous playback results separate.

The retained short native GPU profile makes Nanite visibility a useful remaining hypothesis (about18ms per peer, with overlapping queue waits), not proof of a present isolated shader cost. Test only `r.Nanite.AsyncRasterization 0` next in a guarded maintenance window, leaving other async work and all Nanite/material/LOD features intact. Installed UE5.8.3 `Renderer/Private/Nanite/NaniteCullRaster.cpp` lines6582–6604 changes scheduling from `HardwareAndSoftwareOverlap` to `HardwareThenSoftware`; [Epic's CVar reference](https://dev.epicgames.com/documentation/en-us/unreal-engine/unreal-engine-console-variables-reference) documents the async-raster switch. Do not use `r.Nanite.ComputeRasterization 0`: its hardware-only path also disables runtime tessellation, and this cooked package has no proven material-level absence of tessellation. Require native readback, stable real native/decoded measurements, direct paired images, and independent exact accepted60 restoration before considering any retained launch change.

The Nanite scheduling-only trial read back0 in both worlds but delivered only15.18/15.41 decodedFPS; reject it and restore accepted60. Saved differences were limited to normal per-launch crash-reporter configuration and the guest CachedClientID counter; SaveGames and every other existing settings byte stayed intact.

The next bounded comparison changes only VP8 to H264 on the current package, retaining capture mode, scheduling0, native60 ceilings, art and all other arguments. Earlier explicit H264 tests also disabled MediaCapture and therefore cannot settle this combination. Installed UE5.8.3 NVENC module registers H264 for Vulkan through CUDA and the current native logs initialize CUDA successfully; the VP8 path uses LibVpx and I420 readback. Avoid claiming hardware encoder use from a negotiated codec alone: require both receivers to negotiate video/H264, stable real native and decoded rates for at least60 seconds, no new pacing failures, retained native logs and unconditional exact VP8 restoration. This tests the existing engine codec path without a source rebuild or art change.

H264-only failed Host readiness before a valid settled media/FPS sample; it establishes no throughput gain. Owned browsers closed and exact accepted60VP8 restored. Retain the existing native launch; deliver only the independently checked touch-policy improvement. Fresh ordinary solo native58.12/decoded58.12FPS at1412×652 meets the solo30FPS target, while simultaneous playback still does not.
