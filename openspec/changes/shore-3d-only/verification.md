# Verification

## Evidence
- Live browser entry through `?renderer=3d` displayed the illustrated game. Its pause menu confirmed `Graphics: 2D (no WebGL2 in this browser)`. This reproduces silent fallback in the current production build.
- Terrain CPU checks: dry side-lane ranges 166.2 and 177.9 world units; middle lane 17.8; sampled near-flat area 33.7%, previously 55.9%. Off-lane range 465.1, maximum mesh slope 1.481. Mirror, dry pads, water coverage and bridge approaches pass.
- Pointer checks compare against actual mesh triangles, including the first shallow contact and boundary/corner rays. Ground-warning interiors agree with the mesh to 0.000170 world units.
- Startup checks exercise missing WebGL2, software WebGL2, failed required models and failed context creation. No alternate renderer is constructed. Tactical maps tolerate missing optional icons.

- All 32 `qa/tidebreak/*.test.mjs` suites pass, including six full simulation matches. All updated JavaScript files pass syntax checks; `git diff --check` passes. The complete 3D module dependency graph imports in Node with browser paths mapped to local files.

## Limits
The available cloud browser reports no WebGL2 and cannot reach the local server. The local Chromium download was empty, and the package installation could not write its cache. Actual GPU rendering, gameplay controls and phone views remain unverified. Updated browser checks are committed for a WebGL2-capable runner. OpenSpec CLI is unavailable; Markdown structure is checked directly.
