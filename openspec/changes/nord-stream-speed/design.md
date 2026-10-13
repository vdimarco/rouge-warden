# Design: faster NORD browser stream and the tall phone frame

This change is a handoff. A cloud session researched it without Unreal Engine, a GPU or access to the host. Codex on the host PC builds, measures and ships it. Facts marked **confirmed** come from Epic's public docs, Epic's public PixelStreamingInfrastructure repository at the pinned revision `e5e243ed`, the installed npm frontend `lib-pixelstreamingfrontend-ue5.8` 0.1.2, or this repository. Facts marked **check on host** could not be confirmed, because the PixelStreaming2 engine plugin source is not public. Settle them first from the installed engine (task 1.2).

## Sources

- Epic, Pixel Streaming 2 migration guide (`Docs/pixel-streaming-2-migration-guide.md` in PixelStreamingInfrastructure UE5.8): one encoding session per peer, `-PixelStreamingDegradationPreference` removed and fixed to MAINTAIN_FRAMERATE, the C++ route for messages to the page is the streamer's `SendPlayerMessage` / `SendAllPlayersMessage`.
- Epic, `Frontend/Docs/Settings Panel.md` (UE5.8): "Match viewport resolution ... Resizes the Unreal Engine application resolution ... We recommend using `-windowed`".
- Epic, `Frontend/implementations/typescript/src/showcase.ts` (UE5.8): resolution change is a built-in command and "requires a `-windowed` application". Its sample sends a nested `{Resolution: {Width, Height}}` object, while the library sends flat `Resolution.Width` / `Resolution.Height` keys.
- Epic, `Frontend/Docs/Communicating from the Player Page to UE5.md`: says `emitCommand` needs `-AllowPixelStreamingCommands`. `Security-Guidelines.md` says to launch public hosts without it. These Epic texts disagree about resolution commands, so the host check in task 1.2 decides.
- Epic API pages (UE 5.8): `IPixelStreaming2Streamer` (`SendPlayerMessage`, `SendAllPlayersMessage`, `GetConnectedPlayers`, `GetInputHandler`, `ForceKeyFrame`), `IPixelStreaming2InputHandler::SetCommandHandler` ("You can also override the default Pixel Streaming command handlers by setting handlers with the same name"), `UPixelStreaming2Delegates` (`OnNewConnectionNative`, `OnDataTrackOpenNative`, `OnClosedConnectionNative`, `OnAllConnectionsClosedNative`), `UGameViewportClient::bDisableWorldRendering`, `UEngine::SetMaxFPS` ("Overrides console variable"), `ULightComponent::SetMaxDrawDistance`, `SetMaxDistanceFadeRange`, `SetAffectTranslucentLighting`, Epic's Lumen guide (GI quality 1 still runs a lighter Lumen, reflections fall back to SSR).
- Installed frontend 0.1.2 (`Browser/node_modules/@epicgames-ps/lib-pixelstreamingfrontend-ue5.8/dist/esm`): `PixelStreaming.emitCommand` blocks only `ConsoleCommand` keys and returns true once the data channel is open (`PixelStreaming.js:592-601`); `Flags.MatchViewportResolution` sends the same flat `Resolution.*` message (`WebRtcPlayerController.js:53-58`); `addResponseEventListener` passes every Response string to every listener; `_onInitialSettings` overwrites WebRTC min/max bitrate with the streamer's values (`PixelStreaming.js:473-482`); the SDP edit for start/max bitrate touches H264 lines only.
- Repository records: `Verification/BrowserPerformance.md/.json` (10–13 native FPS under contention, 27–30 in quiet windows, 96–97% GPU, 1,374 MiB free VRAM at worst, no CPU thread saturated, encode about 9 ms), `BrowserStreaming.md/.json` (relay runs 0.7–1.7 Mbps; direct runs 7–9.4 Mbps), `EnvironmentPolish.json` (RTX 4090, 24,564 MiB).

No outside rendering technique is adapted. The stream budget only lowers counts and ranges of lights and rain that `nord-sky-water` already added.

## Decisions

### 1. Measure first, with the GPU to ourselves

On an RTX 4090, two 1280×720 game processes at 30 FPS with GI and reflections at 1 and virtual shadow maps off should not be GPU-bound. The low numbers came with Dota 2 and the desktop shell on the same GPU. Record a clean baseline before changing code, so each later change has a cause.

### 2. One rebuild carries every native change

The tall HUD (on `main`), the sky and weather (`nord-sky-water`), and the native parts below all need the same package rebuild. Do them together, then compare against the baseline with each new flag on and off.

### 3. The game tells the page it supports tall frames

Drop the `NORD_PORTRAIT_STREAM` build flag. A build flag lets the page and the host disagree, which is the current fault.

- Game: when a browser's data track opens, send a Response message with a small JSON body, for example `{"nord":{"frames":1}}`. Use `FindStreamer(GetDefaultStreamerID())` and `SendAllPlayersMessage`, because each NORD process has one streamer and one browser, and the parameter order of `OnDataTrackOpenNative` is not documented.
- Page: register one `addResponseEventListener` before connecting, parse and check the JSON, and only then ask for a non-16:9 frame. Ask again on `playing` if no message came, because the friend's controller does not exist until it joins the host.
- An old package never sends the message, so the page stays at 1280×720. The page can deploy before the host rebuild.

Register the capability at game-instance or module level, not in `AQuebecController`, because it belongs to the build.

### 4. The game owns frame sizes

Install a game-side command handler with `SetCommandHandler` for the size command. It accepts both the flat and the nested JSON shape, clamps the size to at most 921,600 pixels (the 1280×720 budget), even numbers, at least 360 on the short side, and applies it with `FSystemResolution::RequestResolutionChange(W, H, EWindowMode::Windowed)`. This also stops one browser from asking for 4096×4096. On all-connections-closed, return to 1280×720 so the next visitor does not get a phone's leftover frame.

If task 1.2 shows that `-AllowPixelStreamingCommands` gates every `Command` message, do not enable it on the public host. Use the `UIInteraction` message (`emitUIInteraction`) for the size request instead, with a game-side handler.

Add `-windowed` to the launch flags, as Epic advises for resizing beyond the monitor. Keep `-RenderOffscreen -ForceRes -ResX=1280 -ResY=720` as the start size.

### 5. An idle slot stops drawing the world

New `UQuebecStreamIdleSubsystem` (`UGameInstanceSubsystem`) in `Source/Quebec/QuebecStreamIdle.{h,cpp}`:

- Created only when `-NordIdleThrottle` is on the command line, `GIsEditor` is false and `-NordCapture` is absent. Only `browser_streaming.py` passes the flag, to both slots.
- Delegate handlers only set an atomic flag. An `FTSTicker` at 0.25–0.5 s on the game thread polls `GetConnectedPlayers().Num()` (null-safe until the streamer and the viewport client exist) and applies the state.
- Starts awake, with a 60 s warm-up after the first world BeginPlay. Sleeps after 30 s with no viewer. Wakes at once on any connection signal.
- Sleep: `bDisableWorldRendering = true` on the game viewport client, re-asserted every tick. On NordFriend1 (net mode client) only, and only if a measurement shows remaining cost, lower the frame cap to 10 FPS and log the value read back. Never lower the cap on NordHost: it is the listen server, and car and traffic steps clamp at 0.05 s and 0.15 s.
- Wake: clear the flag, restore the cap, call `SetGameCameraCutThisFrame` on local player cameras, and optionally `ForceKeyFrame` two frames later. Log `NORD_STREAM_IDLE state=... streamer=... viewers=... reason=...`.
- Rejected: `FViewport::SetGameRenderingEnabled`, because it is global and also stops the HUD and Slate output.

The default slot is NordHost, so with one player the sleeping process is usually the friend.

### 6. Stream budget for the sky

`-NordStreamBudget`, read once in `AQuebecSky::StartPresentation` and passed by `browser_streaming.py` to both slots (not through `NORD_SKY_ARGS`, which reaches the host only):

- Street lamps: pool from 24 to 10, attenuation 1800 to 1500 cm, `SetMaxDrawDistance` about 6000 with `SetMaxDistanceFadeRange` about 1500. Keep shadows off and keep translucency lighting on, because `M_NordRain` is lit only through the translucency lighting volume. Keep a lamp in place while it stays in the nearest set, so lamps do not pop.
- Headlights: 6 to 3.
- Rain: 800 instances with width scale .025 instead of 2000 at .012, so streaks stay at least 1 px wide near the player and the encoder sees less sub-pixel flicker.
- Wet reflections: in `ApplySkyGrading`, override `ScreenSpaceReflectionMaxRoughness` to about .35. Try `r.SSR.MaxRoughness` from the launcher first to measure the effect without a rebuild.
- Update rates: scene writes every 0.25 s, lamp assignment every 1 s.
- Launcher-only CVars to try: `r.SkyLight.RealTimeReflectionCapture.TimeSlice.SkyCloudCubeFacePerFrame 1`, `r.TranslucencyLightingVolumeDim 32`, a lower `r.VolumetricCloud.ViewRaySampleMaxCount`. Read the current values first.

Keep unchanged: moon shadows (cost close to the day sun's), height fog, the pond shader and puddles.

### 7. Bitrate for the relay path

Host flags, at the next lifecycle restart with no rebuild: start 2 Mbps, minimum 0.3 Mbps, maximum 8 Mbps, 30 FPS. A LAN desktop climbs back within seconds. The page cannot set bitrate through its initial settings, because the library overwrites them. If PixelStreaming2 applies `WebRTC.MaxBitrate` commands (check on host), the page may send a per-connection profile after the `initialSettings` event: relay over TLS or TCP gets at most 4 Mbps, a direct connection keeps the host values. Clamp these commands in the game, as in decision 4, so one browser cannot leave extreme values for the next.

### 8. Page fixes found in review

- After `portrait-stream` toggles, call `stream.webRtcController.resizePlayerStyle()` (`WebRtcPlayerController.js`, which calls `VideoPlayer.resizePlayerStyle`) in the next animation frame, so Epic's input-coordinate converter measures the new video box. Without it the look pad turns about 3.85 times too fast in the tall frame. Then re-check look speed by feel.
- Keep the size asked for (`data-stream-size`) apart from the size received (`data-stream-frame`). Mark `frame-ignored` after about 5 s without a match. Retry when `emitCommand` returns false. Clear these on disconnect and slot change.
- Round requests to a few aspect steps (9:16, 9:18, 9:19.5, 9:20 upright; 16:9, 18:9, 19.5:9, 20:9 sideways) with hysteresis, so toolbar and rotation changes send at most one request each.
- A sideways phone asks for a frame of its own shape (1280 wide, height from its aspect, at most 21:9) and shows it with `object-fit: contain`. Allow `fill` only when the frame and box aspects match within 3%.
- Encoder downscaling under MAINTAIN_FRAMERATE can make the received frame smaller than asked. Compare aspect, not exact pixels, in `mobile.test.mjs`.
- Move the sizing rules into a pure module with `node:test` tests. Add a no-host browser test that puts a `canvas.captureStream()` on the video element and injects Response frames (byte 1, then little-endian UTF-16 text, as in Epic's `PixelStreaming.test.ts`).

### 9. Codecs and capture scheduling

VP8 encoding is not the bottleneck (no CPU thread saturated, about 9 ms per frame). Test `MediaIO.EnableExperimentalScheduling 1` against 0 on one slot during a maintenance window, and keep it only if capture does not stall. Retest H264 NVENC and AV1 only on an isolated port with a working VP8 fallback, and test AV1 on a real iPhone and Android phone first. Under H264 the frontend adds `x-google-max-bitrate=100000`, which can override the host cap.

## Risks

- Every native claim needs the host rebuild and a GPU measurement. Nothing here ran against the engine.
- If `OnNewConnectionNative` fires only after ICE completes, the first frame after wake can be black for one poll interval. The Play tap mostly hides it.
- The next rebuild adds the sky cost and the throttle saving at the same time. Measure each flag on and off against the baseline.
- Physical phone checks (iPhone Safari has no element fullscreen) can only be done by a person.
