# Mobile touch controls — 2026-10-11 UTC

Touch controls are live at [nord-montreal.vercel.app](https://nord-montreal.vercel.app/). The user confirmed phone video loads before requesting this update. New physical-phone controls and iOS usability still need a hands-on review. [Structured evidence](BrowserTouchControls.json) records build hashes, deployments, actual native input packets and test scope.

The left stick maps to native WASD movement/steering; the right pad sends relative camera movement using Epic's installed coordinate normalization. Sprint, Jump/brake and Use/car are held native keys; tap Use to acquire/release a worklight and aim with the right pad. Crew, Recover, Race and Comic use C/R/T/F2. Independent pointer capture supports moving, looking and acting with several fingers. A cancelled/lifted finger, lost capture, focus loss, hidden page, rotation, disconnect or page exit releases touch-held keys. Controls are enabled only during real playback. Desktop pointer-lock controls are preserved.

Portrait keeps controls beneath the letterboxed game. Landscape uses side margins to leave more of the game HUD visible. Targets are at least 44×44 CSS pixels. Action buttons also accept keyboard/assistive click activation using a 120 ms held native pulse, cancelled safely on interruption; pointer clicks cannot double-trigger. Fullscreen retains the touch controls and a visible exit button. Reviewed screenshots include portrait playback, three-finger held input, landscape, fullscreen and disconnected state.

| Check | Result |
| --- | --- |
| Focused source tests | 11/11: endpoint validation plus touch deadzone/diagonals, simultaneous ownership, duplicate-finger release, bounded look normalization, disabled controls and all interruption events, plus timed keyboard/assistive activations and safe cancellation. |
| Existing static browser checks | Pass: desktop/narrow layout, offline/unavailable states, ignored endpoint overrides, occupied stream selection and disconnect/reconnect. |
| Initial local built player | 5/5 live mobile checks at 01:26 UTC. |
| Public HTTPS preview | 6/6 at 01:32 UTC, ordinary DNS/security. Preview `dpl_F9FxF2y9KLSmrfTgBqF2eYAzNFEL` was READY before publication. |
| Production mobile | 6/6 at 01:33 UTC: advancing real 1280×720 VP8 video, portrait/landscape layout, trusted three-finger move/look/jump, fullscreen exit, action-button keyboard activation without duplicate touch clicks, and release before disconnect. |
| Native input evidence | Actual open RTCDataChannel sends contain KeyDown W/Space, MouseMove and KeyUp on cancellation; held W/Shift both release before Disconnect closes the channel. Sampled streamed imagery changes during input. Native position/mission outcomes are not independently asserted. |
| Production desktop | 7/7 at 01:33 UTC: both independent streams, keyboard/mouse, Escape, occupied-slot refusal and two reconnect paths, ordinary DNS/security. |
| Publication | Production `dpl_Gn2Q2mVh2m1D42FuD7DhDth62Jah` READY; alias, JS, HTML, CSS and notices match the tested preview byte-for-byte. |
| Preservation | Three discovered map/save files retain their SHA-256 values. Running native/signalling/tunnel/relay services were preserved; no Unreal rebuild, restart, graphics change or new GPU job. Separate Plateau project untouched. |
| OpenSpec | Four requirements/eight observable scenarios manually checked. CLI unavailable; no CLI validation claimed. |

Raw results and screenshots remain in ignored `Browser/.qa/mobile-2026-10-11T01-26-07-875Z`, `mobile-2026-10-11T01-32-15-106Z`, `mobile-2026-10-11T01-33-09-796Z` and `live-2026-10-11T01-33-15-767Z`. Mobile checks observe real browser WebRTC sends without replacing their behavior. Two harmless missing-favicon 404s were recorded; no page JavaScript errors occurred. No dependencies, native bindings, map assets or campaign behavior were added.

Chromium touch emulation does not establish physical iOS/Android touch ergonomics, audible sound, sustained responsiveness or driving enjoyment. Existing manual Mission 2 acceptance remains open. The PC and temporary networking services must remain online; this static player update does not alter those hosting limits. See [HOSTING.md](../Browser/HOSTING.md).
