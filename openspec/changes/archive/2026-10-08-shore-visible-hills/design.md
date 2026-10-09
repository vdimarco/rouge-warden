# Design

Use the existing sampled terrain for mesh, actors, camera, picking and spell warnings. Narrow the broad flattening shoulders, remove repeated attenuation, and lift the low landforms with a smooth height ceiling. Keep level road cores, structure footprints and river carving. Let the ground cast shadows so hills shade neighboring slopes. Measure relief near lane shoulders as well as the whole map; inspect actual desktop and phone frames.

Remove renderer selection and the 2D startup fallback. Extract maps, screen-space combat labels and adaptive resolution from the legacy illustrated renderer so 3D no longer imports or loads the old battlefield and its art. Keep only map icon art. Unsupported WebGL disables Play with an actionable message; context loss pauses an active match and offers reload, then allows resuming after restoration.

Validation: CPU terrain, surface, effects, roads and renderer checks; Chromium WebGL shader/console checks; desktop and phone screenshots; saved 2D and URL migration; missing WebGL and failed model loading; pause/settings, movement, map, targeting and context-loss/restoration.

## Measured geometry
Original: 0/89 dry side-lane shoulders exceeded 90 units, median 1.18; maximum slope 1.481. Updated: 46/89 exceed 90 units, median 97.09; maximum slope 1.415. The mesh remains 37,249 vertices. This intentionally prioritizes relief near play routes over an impressive whole-map range. CPU checks retain level road cores, level pads, seeded submerged banks, dry bridge landings, exact symmetry and mesh/CPU/GPU sampling agreement.

## Browser verification
Browser plugin not available; use the existing Playwright installation with `/usr/bin/chromium` and SwiftShader against `http://127.0.0.1:8765/tidebreak/`. The focused test covers meaningful hero selection, old renderer URL/preference migration, no legacy renderer/art requests, blocked WebGL, a required model returning 503, ground clicks, keyboard movement, pause/settings, actual WebGL context loss/restoration and mobile touch input. Screenshots live outside the repository. Physical devices, non-Chromium engines and hardware GPU frame rates are not verified.


## Final verification
- `terrain.test.mjs`, `surface.test.mjs`, `terrain-effects.test.mjs`, `roads.test.mjs`, `river.test.mjs`, `scenery.test.mjs`, `towers.test.mjs`, `pointers.test.mjs`, `targeting.test.mjs` and `adapt.test.mjs` pass. After the final height profile, terrain/surface/effects/adaptation were rerun successfully.
- `PW_TEST_SCREENSHOT_NO_FONTS_READY=1 SHOTS=/tmp/shore-final node qa/tidebreak/terrain-3d.e2e.mjs` passes: old saved preference and URL migrate to 3D, no legacy renderer/art downloads, meaningful hero selection, settings/pause have no renderer switch, missing WebGL and model 503 show recovery messages, ground clicking and keyboard movement change the live match, real context loss freezes time, restoration requires explicit resume, and actual emulated touch input moves the hero and releases.
- Desktop 1280x800 and phone 390x844 frames were inspected with view_image, including both realms. A separate 1280x800 desktop capture also passed without console errors. Hills rise beside the right lane and show shaded/rocky slopes; paths and bridge approaches remain level. The HUD remains usable; phone checks have coarse pointer input. Shader/runtime error collection is empty, and neither viewport overflows horizontally.
- SwiftShader checks use the supported half-pixel quality floor. Full-resolution software rendering exceeded an early 30-second fixture timeout; the harness now allows shader warmup and uses the quality floor. These are functional/visual checks, not hardware performance measurements.
- The existing six-viewport creature/roster CI harness now checks loaded 3D models instead of retired 2D sprite counters, uses SwiftShader explicitly, and waits for movement rather than assuming a 350ms frame window. Its full CI run is separate from the focused local check.
- The extracted map, labels and adaptive-resolution methods were compared with their originals and are identical. JavaScript syntax and `git diff --check` pass. OpenSpec strict validation passes.
- PR: https://github.com/vdimarco/rouge-warden/pull/292. Preview deploys through Vercel. Production requires merging the PR.

## Integration with current main
The final merge retains the newer highlands, rolling roads, cliffs, caves, camera clearance, startup module and optional map-icon fallbacks from main. The original flat-road and height-ceiling design above records the initial preview only. Current geometry checks measure side-lane ranges of 360.8 and 478.7 units, total land relief of 1054.7, and level defensive pads and bridge approaches. The remaining runtime additions are terrain shadows, preference cleanup and modal graphics recovery requiring explicit resume. The browser server retains main’s `.mjs` content-type fix.
