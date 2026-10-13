# Mobile camera and compact controls — 2026-10-13

Touch drags anywhere in the game frame, including letterboxing, share one camera pointer with the existing look pad. Movement and action fingers remain independent. Gyro look is opt-in through the game menu; denied, unsupported and silent sensors leave feedback. Motion pauses during menus and interruptions and stops on disconnect. Sprint, Jump/brake, Use/car and Menu draw 24 px chips in one bottom-right row, inside 44 px targets and CSS safe-area insets.

## Verification

- Input/config unit tests: 17 passed, including motion permission, no data, invalid rates, portrait/landscape/flat axes, spike bounding, interruption cleanup and touch ownership.
- Static Chromium browser checks passed, including responsive controls, menu, start screen, fullscreen, connection states and no page errors. The trailer-paused check now waits for the browser's queued dialog close event.
- Actual running Unreal stream: 11 mobile checks passed at `http://127.0.0.1:8102`, with production signalling and portrait sizing enabled. The game honored the tall-frame request. Three-finger move/look/jump, left/center/right drags, simulated gyro, menu activation and disconnect releases used successful sends on the real RTC data channel and advancing decoded video. Drag and gyro changed the decoded image.
- Rendered portrait, 800x360 landscape and 667x375 landscape fullscreen were inspected. Buttons fit the corner; measured targets remain at least 44 px. Visible ink clears the reviewed mission card, prompt, map and speed-digit/unit regions; transparent hit targets and chips replace some old keyboard hints. CSS safe-area spacing is retained.
- Desktop actual-stream regression: all seven checks passed with independent host/friend video and input, occupied-slot refusal and both reconnect paths. Evidence: `Browser/.qa/live-2026-10-13T15-06-55-840Z/summary.json`.
- Hosted preview: all 11 mobile checks passed at `nord-montreal-njiwucp8w-vdimarcos-projects.vercel.app`; all 12 served files matched the tested local build byte for byte. Evidence: `Browser/.qa/mobile-2026-10-13T15-08-44-249Z/summary.json`.
- Evidence: `Browser/.qa/mobile-2026-10-13T15-05-13-426Z/summary.json` and screenshots (ignored local QA artifacts).

## Release

Production `dpl_EFdBK9W9FxqccgCsoFRyG3289Aq9` serves the tested browser source `eff8752e` at [nord-montreal.vercel.app](https://nord-montreal.vercel.app/). All 12 files match the local build byte for byte. All 11 mobile checks passed on that public alias (`Browser/.qa/mobile-2026-10-13T15-11-35-748Z/summary.json`). The frontend release did not restart the game or tunnels.

## Limits

Motion events and permission responses were explicitly simulated in Chromium. Physical iOS/Android sensors, direction/feel calibration, notched-phone safe areas, audible sound and off-LAN performance remain unverified. No sensor data is persisted by the player. Six native mouse pixels per degree is the initial gyro gain; sample gaps over 100 ms rebaseline.

OpenSpec CLI was unavailable; proposal, requirements, scenarios, design and task structure were checked directly. The broader streaming change retains its unfinished physical-device acceptance tasks.
