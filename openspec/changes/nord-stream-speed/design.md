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
- If PixelStreaming2 applies `WebRTC.MaxBitrate` commands **(check on host)**, the page caps a relayed connection (TLS or TCP relay candidate) at 4 Mbps. It must do this after the library finishes handling `initialSettings`: call `stream.config.setNumericSetting(...)` from a `setTimeout(0)` inside the `initialSettings` listener. The game clamps these commands as in decision 4.

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
- Physical phone checks (iPhone Safari has no element fullscreen) can only be done by a person.
- This change adds requirements to `nord-browser`, which `nord-browser-streaming` (not archived) also adds to. Its requirement "Phone held upright plays a tall game" says a sideways phone gets 1280×720. Archive `nord-browser-streaming` first, then turn the overlapping requirement here into a MODIFIED one before archiving this change.
