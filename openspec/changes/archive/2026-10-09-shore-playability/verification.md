# Verification

## Gameplay

All 39 Shore Node suites pass locally and in the gameplay job of [run 37950530978](https://github.com/vdimarco/rouge-warden/actions/runs/37950530978). This includes six complete deterministic matches and cases for selected wisp focus while moving, target loss, Recall cancellation during control effects, actual cast outcomes at cooldown boundaries, spell buffering, lane hysteresis, guide progress, blocked storage and anonymous telemetry.

The four camera jobs and terrain/landscape job pass in [run 37948829762](https://github.com/vdimarco/rouge-warden/actions/runs/37948829762) on game commit caa885a2. Native wheel and pinch input, terrain picking, zoom retention, Rift placement and activation remain functional. Geometry checks and renders retain raised terrain, cliffs, caves and trees. Subsequent changes preserve the tactical map's square proportions and prioritize cast feedback over the noninteractive chat shelf.

## Native browser review

All four native playability jobs pass in [run 37950530978](https://github.com/vdimarco/rouge-warden/actions/runs/37950530978) on commit 233e18d1. Screenshot review covers first match, spell rejection, retained target, guide stages, Recall, optional touch Spellbook and all four tactical maps.

| Layout | Viewport | Result |
| --- | --- | --- |
| Desktop | 1440x900 | Pass |
| Portrait | 390x844 | Pass |
| Landscape | 844x390 | Pass |
| Small phone | 320x568 | Pass |

The checks use native mouse, keyboard and touch input with the real game and simulation. They cover direct start, optional draft in settings, live learning and contextual guide progress, aim cancellation, rejected and buffered spells, selected-target movement, Recall start/cancel/interruption/completion, current-lane map routing and no production telemetry from automation. Touch inspection also opens Spellbook through the pause menu with a point available, checks that it spends no point and casts no spell, and returns to live play.

Screenshot review exposed and corrected a landscape attack label below the viewport, a crowded phone status strip, small-phone objective text behind Recall and route actions hidden on a second map page. The map now keeps all five destinations and Back together, with 44 px targets. Guide text lets battlefield input through; Skip has a 44 px touch target.

A native small-phone trace exposed a production ghost click: map pointerup opened the modal, then the generated compatibility click retargeted to Close and shut it. The document capture guard consumes that one click while preserving keyboard activation and subsequent presses. A real native Chromium reproduction confirms the fixed map remains open; the full-game harness waits for the generated click before asserting persistence. Node regression checks cover pointer identity, one-click consumption, legacy MouseEvent fallback, deadline, separate documents, disabled/cancelled actions and concurrent gestures.

The browser fixture pumps the real simulation clock and draws its final frame to keep software-renderer queues bounded. A separate native RAF flush synchronizes input and screenshots. A stable native Chromium reproduction confirmed Chrome adjusts a tap 3.5 px above Skip into that button; the wisp fixture now chooses a point inside the same rendered hit box with correct picking, battlefield ownership and 12 px control clearance. Required controls and all simulation assertions remain strict. Only the transient optional GPU notice may disappear before its optional dismissal.

A fixture using the actual CSS and map markup verifies proportional square sizing at all four layouts. Intrinsic canvas sizing fixes previous 480x470, 200x196 and 188x140 distortion while keeping every destination visible. No letterboxing is used, so map coordinates continue to match its bounds. The final full-game checks also assert a square map and capture it before native Next tower selection.

The last CSS refinement hides chat while cast feedback is visible. It was verified separately in native Chromium at 320x568 using the actual index HUD, styles and TeamChat module: chat changes from flex to none and back as the output appears and hides; the cast reason stays visible; Recall, Rally, Rift, map, abilities, joystick, loadout and point-pill bounds remain identical. This CSS-only change does not alter input or simulation code, so the completed full-game suites were not repeated solely for it.

## Limits

Local Chromium closes during Shore startup, so complete game rendering uses SwiftShader Chromium in GitHub Actions. Physical phones and native Safari were not available. The legacy MouseEvent fallback has Node coverage; real touch browser coverage uses Chromium.

The existing Shared creatures browser job times out at its unchanged hero-menu screenshot at qa/creatures/browser.mjs:42. Its export, neutral behavior and six-match simulation checks pass. This timeout was also present before these changes. The broader arcade test stops on an existing missing Afterlight analytics tag; the actual tracker host isolation and Shore capture behavior pass the new telemetry suite.

The OpenSpec CLI is unavailable. Required files, requirement headings, canonical requirement presence and observable WHEN/THEN scenarios were checked directly. Canonical requirements are updated and the completed change is archived.

PostHog recording read permission is unavailable. This change adds capture-only anonymous gameplay events and load timing on the known production Shore host, without a replay SDK. Preview, localhost and WebDriver sessions do not send production events. Event capture failures are tested to leave play usable. Combat balance, match timing and cave navigation remain separate playtest work.
