# Verification

## Diagnosis and implementation

Before frames at 100, 1,200, 3,000, 3,100 and 5,600 m on three layouts reproduce the fixed painted river, mountains and temples. Moonlit's UV matrix is unchanged across distances, and 11,660 phone background pixels remain identical. The old painting also hides the fixed fallback 3D mountains. Evidence: `/tmp/river-moonlit-background/baseline.json` and before screenshots.

Moonlit now has an aspect-cropped atmosphere-only sky, a smaller round moon, three absolute-course forested ridge layers and prepared broken ruin silhouettes. Lavender fog and depth remain; nearby temples/fireflies, controls, speed and terrain pools retain their behavior. The four horizon batches share prepared geometry/materials and the existing stone texture, with at most 32 instances. The obsolete Moonlit panorama is no longer loaded for gameplay. The 2D fallback shares course anchors and prepared sky/ridge cards, follows its existing distance-based scenery in reduced motion, and uses opaque haze-colored ridges rather than showing moonlight through mountains.

## Source checks

- Six focused horizon tests initially pass: immutable capacities, bank/profile placement and exterior footprints, matching absolute IDs with exact travel, continuous fade boundaries, bounded windows, and stable prepared resource identities on three camera layouts.
- 22 focused horizon/noise/chunk/course tests pass before final boundary correction.
- Full `npm test --prefix games/river-rush`: 112 tests pass, including the existing 240 complete simulated campaigns; this run precedes the final horizon burial/far-plane correction. After that correction, 23 focused horizon/noise/chunk/course tests pass. After final footprint tapering, all seven horizon checks pass; actual-camera projection covers 13,684,163 on-screen vertices, with maximum depth 874.86 m below the 900 m limit.
- Final arcade build passes and references `index-ByIAhKor.js` with unchanged `index-aD_k1wTR.css`. Actual built App smoke passes in phone, desktop and short landscape: real menu selection/start, screen-wide drag, keyboard return to center, and pause at 90 m. Shared projected ridge IDs advance during play; detailed models load, stopped pixels/status are exact, and there are no JS/shader errors or post-prepare texture uploads/compiles. Observed maximum is 38 calls and 101,653 triangles. No engine/clock mutations or leaderboard writes occur. Evidence: `/tmp/river-moonlit-background/app-smoke.json` and matching screenshots.

## Rendered checks

Browser plugin unavailable; existing Playwright/Chromium with SwiftShader used. Physical-device frame rate is not measured.

Nine initial source views across phone, desktop and short landscape show clear lanes, no painted duplicate river, correct round sky crop, exact pause/reduced pixels, and moving landmarks. Shared course IDs advance exactly 3.75 m across 12 motion groups. Initial frames use 35–36 calls and 88–89k triangles. Root inspected primary phone/desktop and fallback screenshots.

Prepared rich/simple water and ground shaders compile/link. Resource counters remain unchanged across movement and seven map/retry selections; four horizon batches and six terrain slots per bank persist. Fallback at 100/3,000/3,100/5,600 m preserves paused/reduced exact pixels. Evidence: `/tmp/river-moonlit-background/resource-fallback.json`.

Boundary isolation caught a real seven-pixel collapsed nearest-ridge footprint at 3,366.9999 m; seven other sampled edges were already invisible. Burial removed that footprint, but exposed 15- and eight-pixel flat caps in the other two layers. The final correction also tapers width/depth only below visibility .03 and omits degenerate instances below .0001. All 16 final isolation comparisons now contribute zero pixels, including eight just above that cutoff; restored frames are exact. These checks, shader/resource/map-switch checks, and current opaque fallback pause/reduced checks pass in `/tmp/river-moonlit-background/final.json`.

Independent geometry review found on-screen depths up to 824 m beyond the old 800 m camera limit. The corrected 900 m plane passes all 251 seeds, 29,313 layout/lane/course configurations and 130,918,476 on-screen vertices with visibility at least .1. Maximum depth is 877.106 m; those substantially visible shapes are unchanged by the final taper. Evidence: `/tmp/river-moonlit-review/projected-extents.json`. The final focused unit regression additionally covers low visibility and reports the 874.86 m maximum above. No full or software visual budget is exceeded.

## Publication and specs

Production publication is pending. This change remains active until final source, build and live checks pass.

OpenSpec CLI is unavailable. Markdown structure is validated manually; canonical river requirements contain 46 unique titles and valid delta scenarios.
