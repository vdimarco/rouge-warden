# Montréal pond water, weather and day and night

The user asked for better water in Parc La Fontaine, gloomy weather with variety, and a day and night cycle. The current ponds are an opaque surface 5 cm above the lawn. Two slow sine waves, roughness .17 and a small metallic value give a pale, flat reflection (`Verification/EnvironmentPolish.md` records "NorthPark water is flat/pale"). The sky is a fixed afternoon: one sun at pitch −44°, light fog, simple clouds and exposure locked at EV100 12.5. No light actors exist for night.

## Scope

- Rebuild `M_PondWater` in place, at the same asset path. Add depth tint from the distance to the shore, a soft shore line, wind ripples from a small sum of wave normals, rain rings, and physically plausible water reflectance. Keep it opaque Default Lit with roughness at or below .17 and an upward normal, so the F2 comic filter keeps its smooth-reflection treatment.
- Add a host-owned sky actor. It runs a Montréal clock (sun and moon positions for mid-October at 45.5° N) and a weather chain with six states: clear, breezy, overcast, fog, drizzle and rain. Gloomy states are common. The host replicates the clock and the current weather segment to the guest, so both players see the same sky.
- Drive the existing sun, sky light, sky atmosphere, height fog and clouds at runtime. Add a moon light, pooled street-lamp lights at the mapped OSM lamp positions, pooled car headlights, rain streaks around the camera, a rain sound and per-player exposure and colour grading.
- Add one material parameter collection. Pond water, wet road and pavement materials, lit windows and the daylight-calibrated unlit materials read it, so the scene stays readable at night and roads look wet in rain.
- Show the time and weather as one extra muted line in the top-right HUD block, only when the sky actor runs.
- Keep every QA, capture, story, profile and package run on the authored afternoon. The sky actor does not spawn under the existing QA flags unless `-NordHour=` or `-NordWeather=` asks for a fixed state.
- In live play the sun follows the clock. Light levels on a clear afternoon match the saved scene, but the sun direction does not, so lit façades and shadows differ from the accepted screenshots.

## Out of scope

No new pond geometry, basin, banks or cascade. No swimming. No new terrain. No change to the saved map: every runtime element is created at play time. No Niagara. No snow or lightning. No new touch controls: weather and time commands are console commands and command-line flags.

## Acceptance

Native acceptance needs the user's Unreal host. CPU checks here cover the sky model, the shore texture and the editor authoring scripts against a fake `unreal` module. They do not show that the C++ compiles, that the materials compile, or that the result looks right. The tasks list the native checks that remain: compile, editor authoring, fresh-load verification, matched captures for clear, overcast, fog, rain, dusk and night in Default and F2 at 1280×720 and 1920×1080, the existing story/HUD suites in pinned mode, package startup, two-player replication and the six-scene p95 profile with the sky pinned and running.
