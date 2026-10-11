# Design

## Existing implementation

`games/nord-unreal/Source/Quebec/QuebecGameplay.cpp`, `AQuebecHUD::DrawHUD`, draws the native UI for both packaged peers. `AQuebecGameMode` assigns this HUD class. The separate original GTA project contains an older implementation and is not the active browser source.

Reuse the current Canvas drawing, fonts, mission and campaign getters, private controller caption, vehicle speed and `AQuebecController::IsComicStyle()`. Keep any new presentation timers in the HUD. Rendering changes must not write campaign progress, production saves or replicated gameplay fields.

## Layout and priorities

- Bottom left: a 240×150 reference-pixel player-centered radar showing actual road segments, the player/facing, objective and eligible nearby cars, with a 58-pixel credit footer. Clip road segments to its bounds; independently clamping both endpoints must not manufacture roads along the frame. Keep OpenStreetMap contributors/ODbL and its copyright URL, and Ville de Montréal/CC BY 4.0 visible at font scale .85 beside the radar.
- Top right: small NORD/Montréal identity with the actual selected crew and online count. The existing C/F2 hint also includes R Recover during an unfinished campaign so alignment or save status cannot hide recovery discovery. Remove the oversized permanent title card.
- Lower right: concise current objective/status above the driving readout, with one contextual action region between the radar and the readout. Objective body uses font scale 1.15; title/status use .9. Wrap or measure text against available width and leave clearance from adjacent HUD regions. Context hints retain the existing car-before-objective/resident priority and existing recovery/replay controls.
- Story briefing: a nine-second temporary presentation on initial appearance or phase change. Active `ResidentCaption` takes priority: it carries private dialogue and blocked-exit or interaction explanations. Pause the briefing's reading budget while that private caption is shown. Do not time out `GetStatusText()` save warnings with the briefing.
- Completion: a brief centered gold banner driven by the existing completed-mission count, including shared completion feedback. Campaign and legacy counts remain distinct.
- Driving: speed in a compact corner readout with handbrake feedback; on-foot entry and dialogue prompts remain contextual. No invented combat/status statistics.
- Comic feedback: retain brief jump/acceleration/handbrake sound words only while `IsComicStyle()` is true. Limit burst rays to 90 reference pixels, font scale 2.4 and center Y to .47 of screen height, leaving clearance below the completion banner. Keep motion edge tracking valid across style switches so restoring comic view cannot emit stale events.

Scale positions, map symbols, markers and text consistently for the existing desktop sizes. World objective markers must avoid occupied HUD regions. Keep the center of the picture open during ordinary movement and driving.

## Browser constraints

The browser receives the existing 1280×720 game stream with `object-fit: contain`; a portrait phone viewport does not create a portrait native HUD. Review the actual decoded frame at 360×800, 800×360 and landscape fullscreen, including touch controls covering the lower corners. Preserve touch targets and input ownership. Phone emulation does not establish physical iOS/Android or off-LAN behavior.

## Verification and ownership

Use the existing story render suite at both supported native sizes, plus the smoke states for crew dialogue, car entry, blocked exit, interaction priority and legacy completion. Add a focused check for any new non-trivial layout or clipping logic. Review actual screenshots independently of automated progress assertions; check private feedback and shared completion across both peers.

`Scripts/test_compact_hud.py` extends the existing story fixture with a calm HUD capture after eleven seconds, a phase briefing capture ten seconds after the first-clamp interaction once its seven-second private message clears, and a completion capture .6 seconds after the final gate. It retains the original fixture's progress, save and editor-setting guards. The native `Quebec.HUD.RadarClip` automation exercises real segment intersections, borders, parallel rejection and degenerate points. The final current-source 1080p suite passes 121 checks/21 captures. Full burst-spacing 720p passes the same matrix before the R-only header refinement, followed by a focused current-header two-step/one-capture pass. Exact source comparison proves only that R expression and three burst presentation expressions differ from the module covered by 13 native tests and both 66-check/15-capture smoke runs. The smoke fixture suppresses duplicate inspection rendering and guards actual captures before checking the live client world; its retained initial teardown failure is distinguished from the passing reruns. A retained gate6 fixture stall is also distinguished from the unchanged-source full 720p retry that passes. See [CompactHUD.md](../../../games/nord-unreal/Verification/CompactHUD.md) for exact hashes, scope and remaining visual/delivery acceptance.

Coordinate any rendered test/package replacement with the running browser host owner. Preserve production saves and restore the normal service after a permitted exclusive GPU window. This proposal does not itself claim a capture window or implementation acceptance.

The exclusive HUD test window is complete and the GPU has been returned to the host owner for package, performance and browser delivery. No further HUD capture jobs are planned. Keep canonical merge and archival pending owner acceptance.

Preserve current raw reports and the 72 fresh story/legacy PNGs under `Saved/Tests/CompactHUD/`, with images in `Captures/{1280|1920}/{story|legacy}/`. The four historical root reports are restored; original Preview paths in raw reports are provenance, not durable current review locations. [CompactHUD.json](../../../games/nord-unreal/Verification/CompactHUD.json) records archived hashes and exact run scopes. The owner's current package build, independent-peer/render verification and 48-file parity pass; final six-scene profiling, independent matrix review and browser acceptance remain open.

The OpenSpec CLI is unavailable on this machine. Maintain the standard Markdown delta layout and record manual structure review; do not claim CLI validation or install tools for this change.
