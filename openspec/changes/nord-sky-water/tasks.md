# Tasks

## Implementation (this container)

- [x] Write the engine-independent sky model (`Source/Quebec/QuebecSkyModel.h`) and its standalone test (`Scripts/test_sky_model.py`), passing under g++ and clang++ with warnings as errors.
- [x] Generate `Source/Quebec/LaFontaineLamps.h` from the OSM street lamps with `Scripts/prepare_lafontaine_lamps.py` and check it with `Scripts/test_lafontaine_lamps.py`.
- [x] Write the Unreal sky actor (`Source/Quebec/QuebecSky.h/.cpp`), the game mode spawn and QA pinning, controller console commands and grading, the HUD time line, the worklight scale and the `Quebec.Sky.*` automation tests. Syntax-checked against stub engine headers only.
- [x] Generate the pond shore texture and manifest (`Scripts/plateau_water.py prepare`) and check them with `Scripts/test_plateau_water.py`.
- [x] Write the pond water and rain streak shader bodies and check their math as C++ with `Scripts/test_water_shader.py`.
- [x] Write the bounded authoring and verification script (`Scripts/plateau_atmosphere.py`) for the parameter collection, shore texture, pond water, rain material, wet ground, night windows and daylight-calibrated unlit materials, and check it against a fake `unreal` module with `Scripts/test_plateau_atmosphere.py`.
- [x] Make `Scripts/plateau_surfaces.py` build the pond with the same water author function and re-apply the wrappers after a full regeneration.
- [x] Run the existing CPU suites that touch the pond, park and comic filter, and confirm they still pass.
- [x] Review the C++, editor Python, behaviour and data independently; fix the confirmed findings (Toronto solar noon, rain culling and cooking, mid-blend commands, host-only commands, session start in the chain, night sky and moon glare, pond aliasing and weak rain rings, lamp height, licence notice, editor capture pinning, browser host pinning).
- [x] Validate this change with the OpenSpec CLI.

## Native checks (user's Unreal host)

- [x] Build the editor and Linux targets; fix any compile errors from the untested Unreal code. Both pass on 2026-10-13 after replacing the editor-only sun accessor; see `games/nord-unreal/Verification/PCDemoRefresh.md`.
- [ ] Run `Scripts/plateau_atmosphere.py` in a fresh NullRHI editor process; confirm `NORD_SKY_WATER_AUTHORED`, the recovery manifest and the unchanged map hash. Then run `verify_plateau.py` in a separate Vulkan editor process. The NullRHI authoring and fresh-load asset read-backs passed on 2026-10-13; the separate full Vulkan map-verifier run remains open.
- [x] Run the `Quebec.Sky.*` and existing automation tests. All 18 `Quebec.*` tests passed on 2026-10-13.
- [ ] Capture matched views at both desktop sizes in the default look and F2: south pond, north pond and Sherbrooke spawn at 15:00 clear, 15:00 overcast, 15:00 fog, 15:00 rain, 18:15 clear (sunset) and 22:00 clear and rain. Record the cloud parameter names from `NORD_SKY_CLOUD_PARAMS`. Tune the look table if a view fails, and keep failed captures.
- [ ] In the 22:00 captures, check that the night sky is 4–8 EV below the day sky, that the moon disk does not glare, and that one park lamp globe reads lit.
- [ ] Check far-pond shimmer while walking along the north pond at 100% and 75% screen percentage, and look at the foam line and rain rings in F2.
- [ ] In rain, turn the camera through 360° and compare the streak count, to confirm the engine does not cull moved streaks.
- [ ] Confirm the story, HUD, race, collision and population suites still pass with their existing flags (sky pinned), and record the new `QuebecGameplay.h` hash.
- [ ] Two-player check: a friend who joins at night in rain sees the same time and weather; console commands from the host reach the friend; the friend's own commands are refused.
- [ ] Profile the six existing scenes pinned (unchanged gate), then again with `-NordHour=22 -NordWeather=Rain`, and a dusk run with `-NordHour=18.2 -NordDynamicSky` so the sun moves. Record the cost of the moving sun and rain.
- [ ] Rebuild the packages and confirm the package log has no `NORD_SKY missing` lines. Restore the browser host, then check night readability and the movement check of `Browser/mobile.test.mjs` on the streamed view (use `NORD_SKY_ARGS` for repeatable QA frames).
- [x] Resolve the default-look mismatch authorized by the user on 2026-10-13: preserve `a86a508a`'s realistic default, align the canonical spec, and check the standard default before explicitly enabling the existing comic fixtures in both smoke and story suites. Both suites passed (69/120 checks), and the updated streaming package passed native day/night and public desktop/touch-emulated checks; see `games/nord-unreal/Verification/PCDemoRefresh.md`.
- [ ] Archive this change after native acceptance and review the canonical spec.
