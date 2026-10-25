# NORD browser player QA plan

This plan says which checks to run on the NORD browser player, when to run them, and what counts as a pass. It covers the static player in `games/nord-unreal/Browser`, its Vercel delivery, the temporary host PC, and the checks that only a person can do. The dated records in this folder hold the evidence; this plan holds the method.

Commands run from `games/nord-unreal/Browser` unless a row says otherwise. `PW` stands for the Playwright path, normally `../../../qa/browser/node_modules/playwright/index.mjs`, which the tests use by default. Set `NORD_PLAYWRIGHT_PATH` when it lives elsewhere.

## Levels

| Level | Needs | Time | Run it when |
| --- | --- | --- | --- |
| L0 Unit | Node only | under 1 min | every change to `Browser/` |
| L1 Page | Chromium, no game | about 2 min | every change to `Browser/`, before each deploy |
| L2 Delivery | a Vercel deployment | about 5 min | after each production or preview build |
| L3 Live stream | the host PC with two free slots | 10 to 20 min | after a player deploy, a package rebuild, a host restart or a tunnel change |
| L4 Performance | the host PC with one free slot | 5 min per sample | after a change to bitrate, frame size, native quality or scheduling |
| L5 Person | a person, a physical phone, a network outside the LAN | 30 to 60 min | before a release claim, and for every item in "Open acceptance" |

A change passes a level only when every check in that level passes on the same build. Record the build commit and, for L2 to L5, the deployment ID and the host log path.

## L0 Unit checks

```bash
npm ci
npm test
```

| Check | Pass condition |
| --- | --- |
| `config.test.mjs` | Endpoint validation rejects credentials, query strings and insecure public hosts. Offline page when the endpoint is empty. Phone frame sizes and receiver adaptation behave as recorded. |
| `touch-controls.test.mjs` | Stick ownership, deadzones, look drag, gyro permission and rejection, driving mode, and release on blur, rotation, cancel and disconnect. |
| `stream-sample.test.mjs` | The sampler reports measured time, counter differences and freezes. |
| `hero.test.mjs` | The title loop loads only while visible, the trailer loads only on open and unloads on close, and a late autoplay result cannot restart or unmute an inactive title. |

The `NORD browser player QA` GitHub workflow runs L0 and L1 on each pull request and push to `main` that changes `games/nord-unreal/Browser/`.

Also run the launcher self-check from the repository root when `Scripts/browser_streaming.py` changes:

```bash
python3 games/nord-unreal/Scripts/browser_streaming.py self-check
```

## L1 Page checks

```bash
npm run test:browser
```

This test rebuilds `dist` with a test endpoint and restores it in `finally`. Do not run it while a deploy reads `dist`.

| Check | Pass condition |
| --- | --- |
| Offline and error states | The page says it is offline when the endpoint is empty, and shows a clear error when the server refuses. |
| Click to connect | No connection before the user acts. |
| URL overrides | Query parameters cannot change the endpoint or Pixel Streaming settings. |
| Layout | 720p, 1080p and a narrow page keep the controls and start screen in view. |
| Console | No `[Info]`, `[Debug]` or `Message Sent:` spam in the production logger. |

## L2 Delivery checks

Run after Vercel reports the build READY. The project settings are in [HOSTING.md](../Browser/HOSTING.md#vercel-project-and-git-builds).

| Check | How | Pass condition |
| --- | --- | --- |
| Correct build | The deployment list shows a build for each push that changed a served file, and CANCELED for the rest. The build log shows the `vercel-ignore.sh` decision and the changed files. | The READY deployment names the expected commit. |
| Files match | Build locally with the production variables, then compare every served file with `dist/` by SHA-256. | All twelve files match. |
| Endpoint | Fetch `player.js` from the deployment and search for `wss://`. | Exactly the configured `NORD_SIGNALLING_URL`, with no credentials. |
| Headers | `curl -I` on the page. | `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `Cache-Control` match `vercel.json`. |
| Notices | Fetch `/THIRD_PARTY_NOTICES.txt`. | HTTP 200 and the Epic, `sdp` and `@protobuf-ts` notices are present. |
| Public alias | Read the alias for `nord-montreal.vercel.app`. | It points at the tested deployment. If not, set it by hand as HOSTING.md describes, then repeat the file match on the alias. |
| Preview toolbar | Open a preview URL. | Vercel's toolbar is present on previews only. Production serves its own build. |

Never upload from the live service checkout. Its ignored `Saved/` and `Builds/` folders hold private relay settings and saves.

## L3 Live stream checks

Before you start, agree a window with the owner of the host PC, then run from the repository root:

```bash
python3 games/nord-unreal/Scripts/browser_streaming.py check
```

It must report the lifecycle, signalling and both native peers alive, and at least 12,000 MiB free VRAM before any launch. Both slots must be free. The tests never evict an occupied slot.

### Desktop regression

```bash
NORD_PLAYER_URL=https://nord-montreal.vercel.app/ NORD_PLAYWRIGHT_PATH=PW npm run test:live
```

| Check | Pass condition |
| --- | --- |
| Host real stream | 1280×720 video, advancing playback, decoded WebRTC frames. |
| Friend independent real stream | Same, on a second isolated browser, with a different character. |
| Host native input and Escape release | Mouse, WASD, C and Space reach the data channel; Escape releases capture. |
| Friend native input and Escape release | Same for the friend slot. |
| Occupied host slot rejects a third browser | The third browser is refused with a clear message. |
| Occupied browser reconnects after host frees its slot | Disconnect, then the waiting browser connects. |
| Original host reconnects and retains Disconnect control | The first browser returns and keeps its controls. |

Run it twice: once on the public alias, once on a local page built with `ws://127.0.0.1:9010` and served on loopback port 8100. A pass on the local page and a fail on the public alias points at the tunnel or the relay.

### Mobile regression

```bash
NORD_PLAYER_URL=https://nord-montreal.vercel.app/ NORD_PLAYWRIGHT_PATH=PW npm run test:mobile
```

The fixture walks to the starter car with real controls, so the Friend slot must be at the starter street. All 16 checks in `mobile.test.mjs` must pass at 360×800, 800×360 and 667×375. They cover fullscreen on tap, the tall frame request, the phone bitrate ceiling, control sizes and placement, car entry and exit, simultaneous touch, gyro, receiver pressure fallback and release on disconnect.

### Evidence

Both tests write screenshots and a JSON summary to an ignored `.qa/live-*` or `.qa/mobile-*` folder. Copy the summary path, the decoded FPS, the host log path from `Saved/BrowserStreaming/` and the package hash into the dated record for the change. Screenshots do not prove native position or story progress.

## L4 Performance samples

Build a separate local player and serve it on port 8100:

```bash
NORD_SIGNALLING_URL=ws://127.0.0.1:9010 NORD_DEFAULT_STREAMER_ID=Choose NORD_PORTRAIT_STREAM=0 npm run build
python3 -m http.server 8100 --bind 127.0.0.1 --directory dist
```

Then sample a free slot:

```bash
node stream-sample.mjs --slot NordFriend1 --seconds 60 --look
node stream-sample.mjs --slot NordFriend1 --seconds 60 --look --relay
```

A sample passes only when the stream lasts the whole 60 s. When the stream ends first, `sample.json` keeps the summary up to the stream end (`streamEndedTimeMs`), with `passed: false`, and the sampler exits non-zero. The sampler stops 10 s after its last sample with a connected peer, so a lost stream does not hold it for the rest of the 60 s. That a lost stream leaves no peer in the connected state is unverified.

| Measure | Reference | Pass condition |
| --- | --- | --- |
| Decoded FPS | 60 FPS cap, 30 FPS floor | Mean at or above 27 over 60 s on the camera sweep, both slots occupied. |
| Freezes | `freezeCount` | Zero over 60 s. |
| Frame gaps | `longestFrameGapMs` | Under 500 ms. |
| Bitrate | 2 Mbps start, 12 Mbps desktop ceiling, 1.5 Mbps phone | Settles under the ceiling and does not fall back without a recorded cause. |
| Native FPS | `NORD_STREAM_FPS` log lines | At or above 29 on both peers while both slots are watched. The 60 cap allows more. |
| GPU memory | `nvidia-smi` | Stays above the 12,000 MiB guard margin after launch. |

The stream runs at a 60 FPS cap: `t.MaxFPS 60` and `-PixelStreamingWebRTCFps=60` in `Scripts/browser_streaming.py`, since commit `d6ed7d07` (2026-10-19). A 30 cap added about 30 ms of phone buffering ([DrivingLatency.md](DrivingLatency.md)). The 30 FPS target is a floor judged against a 33.3 ms frame budget, not a cap. A solo sample can decode up to 60 FPS. That is headroom, not a promise.

These L4 samples sweep the camera at the spawn. For phone-sized gates on a fixed Plateau route, use the GTA mobile gauntlet in [`docs/gauntlet/gta-mobile.md`](../../../docs/gauntlet/gta-mobile.md). It gates native frame time on each leg and decoded frame intervals at pinned phone sizes, and it reports delay apart from frame rate. Its pinned samples need a local player built with `NORD_QA_PIN=1`, which `build.mjs` refuses when `VERCEL` is set. Its input row, `gauntlet_loop.py stream --look`, drags on the stream for the whole lap and gates the car's lateral error at most 2.5 m. Its requirements and host commands are in [`openspec/changes/nord-mobile-gauntlet/`](../../../openspec/changes/nord-mobile-gauntlet/).

Samples go under ignored `Saved/BrowserStreaming/samples/`. Record candidate types only, never ICE credentials. Do not rebuild `dist` while a sample runs. Same-PC samples do not stand for phone, carrier or off-LAN performance.

## L5 Person checks

These need a person, and they close the open tasks in [`openspec/changes/nord-browser-streaming/tasks.md`](../../../openspec/changes/nord-browser-streaming/tasks.md). Record each result with the date, device, browser, network and deployment ID.

| Check | Device and network | Pass condition |
| --- | --- | --- |
| Off-LAN desktop play | A laptop on a network outside the host LAN, Chrome and Firefox | Video, audio and input work on both slots; reconnect works. |
| Physical Android phone | Android Chrome on carrier data and on Wi-Fi | Video loads, the tall frame appears upright, all touch controls respond, fullscreen on tap, gyro after permission. |
| Physical iOS phone | iOS Safari on carrier data and on Wi-Fi | Same as Android. Record any Safari fullscreen or sensor limit. |
| Audible sound | Any device with speakers | Game audio plays after **Play with sound**, with no sustained stutter. |
| Driving feel | Desktop keyboard and a phone | Sustained steering, Gas, Brake and Exit feel responsive. Note the perceived input delay. |
| Walk, run, jump, crew | Two people, one per slot | Both characters are seen moving in each other's view; C, R, T and F2 work. |
| Mission 1 and 2 | Host slot, a fresh campaign save | Both missions complete through the browser, the save reloads after a host restart, and the guest cannot write campaign progress. |
| Start screen and trailer | Desktop and phone | The loop and the trailer play, and the trailer goes fullscreen where the browser allows it. |
| Visual and face quality | Desktop at 1280×720 | A bounded review against [NaturalFaces.md](NaturalFaces.md) and [UnifiedPlateau.md](UnifiedPlateau.md). |

## Host and tunnel checks

Run these after a host reboot, a tunnel restart or a relay change, before L3.

| Check | How | Pass condition |
| --- | --- | --- |
| Units | `systemctl --user status nord-browser-demo nord-browser-public nord-browser-turn-funnel` | All intended units active. |
| Tunnel hostname | Read the `cloudflared` log | The hostname equals `NORD_SIGNALLING_URL` in Vercel. If it changed, update the variable, redeploy, then run L2 and L3. |
| Serve state | `tailscale serve status --json` | The 443 and 8443 mappings match HOSTING.md and nothing else changed. |
| Relay container | `docker ps` | `nord-browser-turn` is up. |
| Launch guard | `browser_streaming.py check` | At least 12,000 MiB free VRAM; no other Unreal render job. |
| Save inventory | Package inventory hash | The campaign save hash equals the value in the latest record. |

## Open acceptance

These items stay open until an L5 record closes them. They come from the OpenSpec task list and the dated records.

- Off-LAN media and input from a network outside the host LAN.
- Physical Android and iOS touch gameplay, comfort and sensors.
- Audible playback.
- Sustained driving responsiveness and handling feel.
- Mission 2 progression and reload in the browser package.
- Sustained phone responsiveness after host contention is resolved.
- The start loop and trailer on a real desktop and phone browser.
- The comic controls, fullscreen trailer and automatic fullscreen on a physical phone.
- The upright tall frame and hidden move stick on a physical phone.

## Rules

- Never write ICE server lists, TURN credentials or candidate URLs with credentials into this folder, a report or a commit.
- Never evict an occupied slot, restart the host, or change a tunnel from a test.
- Agree a window before any check that restarts the demo or uses the GPU.
- Keep graphics, frame size and bitrate settings unchanged unless a change authorizes a quality tradeoff.
- A same-PC pass is not a public pass. Say which network each result used.
- Say in each record which levels ran, which did not, and why.
