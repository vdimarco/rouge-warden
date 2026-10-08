# Design

Use the existing sampled terrain for mesh, actors, camera, picking and spell warnings. Narrow the broad flattening shoulders, remove repeated attenuation, and lift the low landforms with a smooth height ceiling. Keep level road cores, structure footprints and river carving. Let the ground cast shadows so hills shade neighboring slopes. Measure relief near lane shoulders as well as the whole map; inspect actual desktop and phone frames.

Remove renderer selection and the 2D startup fallback. Extract maps, screen-space combat labels and adaptive resolution from the legacy illustrated renderer so 3D no longer imports or loads the old battlefield and its art. Keep only map icon art. Unsupported WebGL disables Play with an actionable message; context loss pauses an active match and offers reload, then allows resuming after restoration.

Validation: CPU terrain, surface, effects, roads and renderer checks; Chromium WebGL shader/console checks; desktop and phone screenshots; saved 2D and URL migration; missing WebGL and failed model loading; pause/settings, movement, map, targeting and context-loss/restoration.

## Measured geometry
Original: 0/89 dry side-lane shoulders exceeded 90 units, median 1.18; maximum slope 1.481. Updated: 46/89 exceed 90 units, median 97.09; maximum slope 1.415. The mesh remains 37,249 vertices. This intentionally prioritizes relief near play routes over an impressive whole-map range. CPU checks retain level road cores, level pads, seeded submerged banks, dry bridge landings, exact symmetry and mesh/CPU/GPU sampling agreement.

## Browser verification
Browser plugin not available; use the existing Playwright installation with `/usr/bin/chromium` and SwiftShader against `http://127.0.0.1:8765/tidebreak/`. The focused test covers meaningful hero selection, old renderer URL/preference migration, no legacy renderer/art requests, blocked WebGL, a required model returning 503, ground clicks, keyboard movement, pause/settings, actual WebGL context loss/restoration and mobile touch input. Screenshots live outside the repository. Physical devices, non-Chromium engines and hardware GPU frame rates are not verified.
