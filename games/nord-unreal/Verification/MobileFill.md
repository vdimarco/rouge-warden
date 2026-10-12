# Mobile fullscreen fill

## Result and scope

The mobile fullscreen player now displays the complete native game frame to all four screen edges. Local, preview and final public checks pass. The update is live at [Play NORD](https://nord-montreal.vercel.app/). [MobileFill.json](MobileFill.json) records source hashes, static-file hashes and the exact report paths.

The previous fullscreen control gutters and aspect-ratio containment caused black bars. The CSS now uses `object-fit: fill` in mobile landscape fullscreen. The complete radar, attribution, identity, objective and speed remain visible. The fixed 1280×720 stream stretches horizontally by 25% at 800×360; at 667×375 its proportions are almost unchanged.

Existing controls float over clear world regions: utilities across the upper middle, movement/look pads above the lower HUD, and primary actions above the contextual prompt and left of the objective. Targets remain at least 44px. Portrait, ordinary windowed play and desktop styling retain their existing behavior. Native input handling, host, relay, package, gameplay and map are unchanged.

## Checks

| Check | Result | Evidence |
| --- | --- | --- |
| Configured static build | PASS | Four-file manifest in MobileFill.json; existing WSS endpoint retained |
| Existing config/input unit tests | PASS 12/12 | `npm test` |
| Local public-endpoint desktop streams/input/reconnect | PASS 7/7 | `Browser/.qa/live-2026-10-11T14-26-04-345Z/summary.json` |
| Local mobile real media/input/fullscreen | PASS 6/6 | `Browser/.qa/mobile-2026-10-11T14-24-36-780Z/summary.json` |
| Root decoded-frame review | PASS | Both fullscreen PNGs in the mobile report directory |
| Independent source/decoded-frame review | PASS | hud_visual reviewed both local fullscreen PNGs; owner browser_player audited source and local fullscreen/portrait/windowed frames |
| Preview desktop/mobile | PASS 7/7 and 6/6 | Reports and hashes in MobileFill.json |
| Final public desktop/mobile | PASS 7/7 and 6/6 | Reports and hashes in MobileFill.json |
| Preview/public static parity | PASS | Four exact files and security/cache headers; [MobileFillDelivery.json](MobileFillDelivery.json) |
| OpenSpec | Manual PASS | 17 unique requirements; one exact replacement; seven scenarios; four archive files; six completed tasks and valid evidence links; CLI unavailable |

`fullscreenClearance` now checks the actual video and its container against all four viewport edges, observes `object-fit: fill`, and waits for advancing decoded media after resize. It replaces the obsolete requirement that controls sit outside the video with checks against mapped native HUD regions. It also retains target size, viewport bounds, target separation and the existing input/release tests. Root reviewed both local screenshots for full image coverage, complete HUD and control clearance. The deployment owner also accepted fresh preview/public frames at both landscape sizes and portrait; the rectangles alone are not a visual acceptance claim.

The first local attempt failed before media connection because no HTTP test server was running. Its separate report is retained. An owned loopback server then served the built files for the passing runs; it was stopped after tests, and all owned QA browsers closed. No Unreal job or native service restart was needed.

## Limits

Physical phones, phone safe-area insets, every dynamic HUD state, off-LAN networking and audible sound were not checked. Filling a different display aspect ratio deliberately stretches the image; this correction does not change the native render resolution. OpenSpec CLI validation is unavailable; final structure is checked manually.
