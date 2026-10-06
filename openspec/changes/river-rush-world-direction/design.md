## Art and interaction direction
Use warm sandstone, sculpted russet bark, jade canopy, coral cloth and flowers, turquoise water and blue atmospheric distance. Foreground action uses large legible shapes; detailed decoration stays on banks. An image panorama is distant scenery only; nearer landmarks, terrain, trees and hazards remain 3D and move at their proper depth.

Landmark density changes with course position, creating forest, waterfall and harbor stretches rather than a uniform prop grid. Transitions are continuous and decorations never become unannounced collision gates. The rider remains the rear-facing long-haired adult with only a modest loincloth, with existing continuous skeletal paddling, banking and independent near-prone duck.

## Rendering and fallbacks
Share GLB geometry/materials through bounded instanced pools, cull far/behind objects and supply cheaper software variants. Avoid fullscreen postprocessing. Panorama load has bounded retry and procedural fallback; missing new models preserve existing scenery/hazards. Reduced motion freezes decorative parallax, wildlife, falls and flags while preserving actions. Resource disposal includes loaded models and background textures.

## Verification
Unit checks retain fair routes and 30/60/120 Hz motion invariants. Browser screenshots inspect phone, desktop and landscape, three course stretches, near hazards and anatomical poses. Count actual rendered triangles and calls: full view <=300k triangles and <=65 calls, software <=125k and <=65. Test missing backdrop/new model fallback, pause pixel freeze, reduced motion and no page/shader errors. Headless software timings are diagnostic, not physical mobile frame-rate claims. Publish and verify exact production bundle/model hashes and arcade launch.
