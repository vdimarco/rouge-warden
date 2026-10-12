# Tasks

## Implementation (this container)

- [ ] Write the engine-independent sky model (`Source/Quebec/QuebecSkyModel.h`) and its standalone test (`Scripts/test_sky_model.py`), passing under g++ and clang++ with warnings as errors.
- [ ] Generate `Source/Quebec/LaFontaineLamps.h` from the OSM street lamps with `Scripts/prepare_lafontaine_lamps.py` and check it with `Scripts/test_lafontaine_lamps.py`.
- [ ] Write the Unreal sky actor (`Source/Quebec/QuebecSky.h/.cpp`), the game mode spawn and QA pinning, controller console commands and grading, the HUD time line, the worklight scale and the `Quebec.Sky.*` automation tests.
- [ ] Generate the pond shore texture and manifest (`Scripts/plateau_water.py prepare`) and check them with `Scripts/test_plateau_water.py`.
- [ ] Write the pond water and rain streak shader bodies and check their math as C++ with `Scripts/test_water_shader.py`.
- [ ] Write the bounded authoring and verification script (`Scripts/plateau_atmosphere.py`) for the parameter collection, shore texture, pond water, rain material, wet ground, night windows and daylight-calibrated unlit materials, and check it against a fake `unreal` module with `Scripts/test_plateau_atmosphere.py`.
- [ ] Make `Scripts/plateau_surfaces.py` build the pond with the same water author function.
- [ ] Run the existing CPU suites that touch the pond, park and comic filter, and confirm they still pass.
- [ ] Validate this change with the OpenSpec CLI.

## Native checks (user's Unreal host)

- [ ] Build the editor and Linux targets; fix any compile errors from the untested Unreal code.
- [ ] Run `Scripts/plateau_atmosphere.py` in a fresh NullRHI editor process; confirm `NORD_SKY_WATER_AUTHORED`, the recovery manifest and the unchanged map hash. Then run `verify_plateau.py` in a separate Vulkan editor process.
- [ ] Run the `Quebec.Sky.*` and existing automation tests.
- [ ] Capture matched views at both desktop sizes in the default look and F2: south pond, north pond and Sherbrooke spawn at 15:00 clear, 15:00 overcast, 15:00 fog, 15:00 rain, 18:15 clear (sunset) and 22:00 clear and rain. Record the cloud parameter names from `NORD_SKY_CLOUD_PARAMS`. Tune the look table if a view fails, and keep failed captures.
- [ ] Confirm the story, HUD, race, collision and population suites still pass with their existing flags (sky pinned), and record the new `QuebecGameplay.h` hash.
- [ ] Two-player check: a friend who joins at night in rain sees the same time and weather; console commands from the host reach the friend.
- [ ] Profile the six existing scenes pinned (unchanged gate), then again with `-NordHour=22 -NordWeather=Rain` and with a running clock; record the cost of the moving sun and rain.
- [ ] Rebuild the packages, restore the browser host, and check night readability and the movement check of `Browser/mobile.test.mjs` on the streamed view.
- [ ] Existing mismatch, not caused by this change: commit `a86a508a` made the realistic look the default, but `openspec/specs/nord-unreal/spec.md` and `Scripts/smoke_test.py` still expect the comic look at start. Decide with the user before changing either.
- [ ] Archive this change after native acceptance and review the canonical spec.
