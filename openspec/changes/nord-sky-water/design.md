# Design

All paths are relative to `games/nord-unreal/` unless they start with `openspec/`.

## Sources adapted

- **Wave normals:** Mark Finch, "Effective Water Simulation from Physical Models", *GPU Gems*, chapter 1 (NVIDIA, 2004), <https://developer.nvidia.com/gpugems/gpugems/part-i-natural-effects/chapter-1-effective-water-simulation-physical-models>. We use its sum-of-waves normal (analytic slope of each wave, deep-water dispersion ω = √(g·k)), without vertex displacement. The pond mesh has no interior vertices, so displacement cannot work.
- **Rain on water and wet ground:** Sébastien Lagarde, "Water drop 2b – Dynamic rain and its effects" (2013), <https://seblagarde.wordpress.com/2013/01/03/water-drop-2b-dynamic-rain-and-its-effects/>. We adapt the four ripple layers enabled at rain quarters, the wet albedo darkening, the lower wet roughness, the puddle roughness and flat puddle normal, and "wet fast, dry slow".
- **Rain streaks around the camera:** the camera-centred rain volume idea from Sarah Tariq, "Rain", NVIDIA SDK 10 whitepaper (2007), <http://developer.download.nvidia.com/SDK/10/direct3d/Source/rain/doc/RainSDKWhitePaper.pdf>. We use world-fixed streak pivots wrapped into a box around the camera in the vertex shader, with instanced static mesh quads instead of GPU particles. Niagara is not in the module dependencies.
- **Sky, sun and moon:** Epic's Sky Atmosphere documentation, <https://dev.epicgames.com/documentation/en-us/unreal-engine/sky-atmosphere-component-in-unreal-engine>. The sun is atmosphere light index 0 and the moon is index 1. The sky light uses real-time capture, which the saved map already enables.
- **Sun position:** NOAA "General Solar Position Calculations", <https://gml.noaa.gov/grad/solcalc/solareqns.PDF>, reduced to a fixed declination for one day of the year.
- **Hash for ripple cells and puddle noise:** Dave Hoskins, "Hash without Sine" (Shadertoy 4djSRW, MIT licence), <https://www.shadertoy.com/view/4djSRW>. It avoids `sin()` so every GPU gives the same cells. Both shader files keep the full MIT notice, and the Custom nodes copy the file text, so the material assets carry it too.
- **Ripple anti-aliasing:** frequency clamping from Norton, Rockwood and Skolmoski, "Clamping: A Method of Antialiasing Textured Surfaces by Bandwidth Limiting in Object Space" (SIGGRAPH 1982). The slope variance a wave loses is folded into roughness, after Toksvig, "Mipmapping Normal Maps" (2005), and Olano and Baker, "LEAN Mapping" (2010).
- **Weather variety:** a hand-tuned Markov chain over weather states with random hold times. We found no published source that fits a two-player Unreal game with a replicated seed better, so the table is ours.

## Frames and units

The map uses centimetres with +X east and +Y north (`verify_lafontaine.py` asserts the road bounds centre has y > 0). The sky model works in the same frame: a direction is (east, north, up). The Unreal adapter turns the direction a light travels into a rotator with `FVector::Rotation()`.

## Sky model (`Source/Quebec/QuebecSkyModel.h`)

A header-only C++ file with no Unreal includes, so `Scripts/test_sky_model.py` can compile and run `Scripts/sky_model_test.cpp` with the system compiler. It must compile cleanly under clang and gcc with `-std=c++20 -Wall -Wextra -Wshadow -Wconversion -Werror`, and inside the Unreal module. It must not define or use Unreal macro names such as `PI`, `check`, `verify`, `TEXT` or `SMALL_NUMBER`.

Namespace `QuebecSky`. All angles in degrees unless a name says otherwise.

- `enum class EWeather : uint8_t { Clear, Breezy, Overcast, Fog, Drizzle, Rain }`, `WeatherCount = 6`, `WeatherName()` returns upper-case English names (`"CLEAR"`, `"BREEZY"`, `"OVERCAST"`, `"FOG"`, `"DRIZZLE"`, `"RAIN"`), `ParseWeather()` reads them without case.
- **Clock.** `FClock { CycleSeconds = 2400, DayStartHour = 5, NightStartHour = 21, NightShare = .2 }`. One full day takes 40 real minutes. The 16 day hours use 80% of the cycle and the 8 night hours use 20%, so night passes twice as fast. `HourAtCycle(double Fraction)` maps any real fraction to [0, 24) with wrap. `CycleForHour(double Hour)` is the exact inverse in [0, 1). `HourAtTime(ServerSeconds, CycleOffset, Clock) = HourAtCycle(ServerSeconds / CycleSeconds + CycleOffset)`.
- **Sun and moon.** `SunAt(Hour, DayOfYear = 288, LatitudeDeg = 45.525, SolarNoonHour = 12.67)`. Fixed declination from the NOAA series for the day. Hour angle 15° × (Hour − SolarNoonHour). Elevation and azimuth (clockwise from north) from the NOAA formulas. `ToSun` is the unit (east, north, up) vector. The moon uses the opposite declination and an hour angle 155° behind the sun (a waxing gibbous moon), so it rises in mid-afternoon, is highest near 23:00 and sets before dawn. For Montréal on day 288 the model gives sunrise near 07:09 and sunset near 18:11 (elevation −0.833°). `LatitudeForMap` and `SolarNoonForMap` give Toronto latitude 43.656 and solar noon 13.05 (NOAA: 13.054 at the College × Bathurst origin), so its sun rises near 07:30 and sets near 18:36.
- **Weather looks.** `FWeatherLook` holds multipliers relative to the authored scene, plus absolute rain, wind and gloom. `Mix(A, B, Alpha)` blends every field linearly with Alpha clamped to [0, 1]; callers pass a smoothstep alpha. Values (tuning targets for the native review):

| State | Cloud | SunVis | FogDensity × | FogStart × | Mie × | Rayleigh × | SkyLum | Rain | Wind | Gloom | EV offset |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Clear | .15 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | .2 | 0 | 0 |
| Breezy | .4 | .85 | 1.3 | 1 | 1.5 | .95 | 1 | 0 | .55 | .1 | −.15 |
| Overcast | .9 | .12 | 3 | .4 | 6 | .55 | .75 | 0 | .35 | .5 | −1.2 |
| Fog | .8 | .2 | 12 | .02 | 9 | .5 | .6 | 0 | .1 | .75 | −1.5 |
| Drizzle | .95 | .08 | 5 | .2 | 8 | .5 | .55 | .3 | .45 | .7 | −1.6 |
| Rain | 1 | .05 | 7 | .1 | 10 | .45 | .45 | .9 | .8 | .85 | −1.9 |

- **Weather chain.** `FRandom` is a fixed 32-bit generator (PCG-style or xorshift32 with a nonzero state; the algorithm must be identical on every compiler). `NextWeather(Current, Random)` never returns `Current`. Transition weights:

| From \ To | Clear | Breezy | Overcast | Fog | Drizzle | Rain |
|---|---|---|---|---|---|---|
| Clear | – | 5 | 4 | 1 | 0 | 0 |
| Breezy | 3 | – | 5 | 0 | 2 | 0 |
| Overcast | 1 | 2 | – | 2 | 3 | 2 |
| Fog | 1 | 0 | 5 | – | 4 | 0 |
| Drizzle | 0 | 1 | 4 | 2 | – | 3 |
| Rain | 0 | 1 | 4 | 0 | 5 | – |

`HoldSeconds(State, Random)` returns a uniform value in: Clear 360–720, Breezy 240–480, Overcast 300–600, Fog 180–360, Drizzle 180–360, Rain 150–300. `BlendSeconds(From, To, Random)` returns 60–120. Over a long run the overcast, fog, drizzle and rain states hold at least half of the time.
- **Wetness.** `FWetness { Surface, Puddles }`, `Step(Rain, DeltaSeconds)`. Surface moves toward `Rain > .02 ? min(1, .4 + Rain) : 0` at +1/45 per second while wetting and −1/240 per second while drying. Puddles move toward `Rain` at +1/120 and −1/420 per second. Both stay in [0, 1].
- **Lighting.** `LightingFor(Sun, Look) -> FLighting`:
  - `DayFactor = smoothstep(−6°, 8°, sun elevation)`. `NightFactor = 1 − smoothstep(−8°, 2°, sun elevation)`.
  - `SunScale = Look.SunVisibility × smoothstep(−12°, −2°, elevation)` (multiplier on the authored 26,000 lux). `bSunActive = SunScale > .001`.
  - `MoonLux = 12 × sqrt(Look.SunVisibility) × smoothstep(−2°, 6°, moon elevation) × NightFactor`. `bMoonActive = MoonLux > .01`. Colour (.62, .72, 1).
  - `SkyLightScale = 1` (multiplier on the authored 1.9). The real-time capture follows the sky.
  - `SkyNight = 1 − smoothstep(−12°, −4°, sun elevation)`. `SkyLuminanceFactor = clamp(Look.SkyLum / max(lerp(SunVisibility, sqrt(SunVisibility), SkyNight), .05), .5, 16) × lerp(1, .15, SkyNight)`. A dim overcast sun still gives a bright grey sky and soft ambient light by day. Below −4° the sky darkens to 15%, so sunset colours stay and the night sky reads as night; a gloomy night sky keeps the same share of a clear night sky as by day. The moon disk is scaled by 1/256 through `SetAtmosphereSunDiskColorScale`, so it does not glare.
  - `ExposureOffset`: day value `Look.EVOffset`; night value −9 (EV100 3.5); blend `Night + (Day − Night) × DayFactor^.6`. `ExposureScale = 2^ExposureOffset`.
  - `WindowGlow = 1 + 11 × NightFactor`. A gloom term could not show at daytime exposure, so it was dropped.
  - `bStreetLamps = NightFactor + .25 × Look.Gloom > .5`. `bHeadlights = NightFactor + .75 × Look.Gloom > .5`, so headlights come on by day in fog, drizzle and rain but not in overcast. `LampCandela = 1500`. `HeadlightCandela = 3500`.
  - Grading: `Saturation = 1 − .3 × Gloom − .15 × NightFactor`, `Contrast = 1 − .08 × Gloom`, `WhiteTemp = 6500 − 600 × Gloom`.
  - `FogBrightness = (.35 + .4 × DayFactor) × (1 − .3 × Gloom)`; the adapter multiplies the mid-grey luminance for the current exposure by it.
  - Under the clear look with the sun above 8°, every multiplier is 1 and the exposure offset is 0, so light levels match the authored scene. The sun direction does not: the saved sun is north-west at 44°, while the clock puts it south-west at about 28° at 15:00. Live play therefore changes which façades are lit and where shadows fall.
- **Replicated segment.** `FSegment { From, To, Start, Blend, Hold, FromWeights }`. `Sample(Segment, Now) -> FWeatherLook` uses `smoothstep(0, 1, (Now − Start) / Blend)`. `Advance(Segment, Now, Random)` starts the next segment when `Now ≥ Start + Hold`: `From = To`, `To = NextWeather`, `Start = Now`, `Blend = BlendSeconds`, `Hold = Blend + HoldSeconds(To)`, and clears `FromWeights`. A held weather uses `From = To`. `Redirect(Segment, Requested, Now, Blend, Random)` starts a new segment from the look actually showing: it stores the current mix in `FromWeights` (six weights, empty in the normal case), so a console command in the middle of a blend does not jump. `ShownWeather` names the weather with the largest weight, for the HUD.
- **Joining the chain.** `JoinChain(Now, Random, OutWet)` runs the chain for a random 6–12 hours and starts the session at that point, possibly mid-blend, with the wetness of its last 20 minutes. Without it every session started clear for 6–12 minutes. Over 4,000 simulated sessions, gloomy states hold 73.6% of the first half hour, 79.4% of sessions are at least half gloomy, and there are about four changes per half hour.
- **Light turn step.** `LightTurnStep(Elevation)` is 0.1° when the light is 30° or more above the horizon and shrinks to 0.02° at the horizon, so a 10 m shadow tip moves at most 50 cm per step above 5°.

## Unreal adapter (`Source/Quebec/QuebecSky.h/.cpp`)

`AQuebecSky : AActor`. `bReplicates`, `bAlwaysRelevant`, net update frequency 1, `ForceNetUpdate()` after every host change. Tick every frame for presentation; heavy scene writes are rate-limited (below).

- **Spawn.** `AQuebecGameMode::BeginPlay` spawns it before the La Fontaine population check, so any map can get a sky. It does not spawn when any of `NordCapture`, `NordCampaignQA`, `NordNoCampaign`, `NordNoCampaignSave`, `NordStoryRenderChecks`, `NordRenderChecks` or `NordFixedSky` is on the command line, or when the command line contains `csvCaptureFrames` or `ExecutePythonScript` (the editor capture runs), unless `-NordHour=` or `-NordWeather=` is also present. In that case the clock and weather are frozen at the requested values. `-NordDynamicSky` forces a running sky.
- **Host flags.** `-NordHour=<hours>` start time (default 15.0), `-NordWeather=<name>` start weather (default: join the chain at a random point with `JoinChain`, possibly mid-blend, with matching wetness; a requested or frozen weather starts settled), `-NordDayMinutes=<minutes>` cycle length (default 40, clamped 2–240), `-NordFreezeTime`, `-NordFreezeWeather` (without `-NordWeather` it holds clear), `-NordSkySeed=<n>` (default: the UTC clock, logged on the `NORD_SKY` line).
- **Replicated state.** `USTRUCT FQuebecSkyState`: `CycleOffset` (double), `CycleSeconds`, `bFreezeClock`, `FrozenHour`, weather `From`, `To`, `Start`, `Blend`, `Hold`, `FromWeights`, `bFreezeWeather`, `Wetness`, `Puddles`, `DayOfYear`, `LatitudeDeg`, `SolarNoonHour`. `ReplicatedUsing=OnRep_State`. The host integrates wetness and replicates it at most once per two seconds; the guest eases toward it. All peers sample the clock and weather from `GetServerWorldTimeSeconds()`.
- **Console commands** on `AQuebecController` as `UFUNCTION(Exec)`: `NordWeather <name>`, `NordTime <hours>`, `NordSkyFreeze <0|1>`. Each calls a reliable server RPC; the host applies and replicates. On the server only the host's own controller is local, so a guest's command is refused with "Only the host can change the sky". They do nothing when no sky exists. `NordWeather` blends over 10 s from the look showing.
- **Scene writes on each peer** (never on a dedicated server):
  - Capture the authored values once: sun intensity, rotation and temperature; sky light intensity; fog density, start distance, height falloff and inscattering colour; Mie and Rayleigh scattering scales; cloud layer altitude and height.
  - Sun: rotation from the light travel direction (−ToSun), written only when the angle changes by `LightTurnStep` or more, so virtual shadow map pages are not invalidated every frame. Intensity = authored × SunScale. Hidden below the threshold.
  - Moon: a `UDirectionalLightComponent` created on this actor at runtime, atmosphere sun light index 1, light source angle .5, the same turn step, hidden by day. It casts shadows only while the sun is off, so only one directional light shadows the scene at a time.
  - Sky light: intensity = authored × SkyLightScale.
  - Sky atmosphere: Mie and Rayleigh scattering scales = authored × look multipliers; sky luminance factor = `SkyLuminanceFactor` grey.
  - Fog: density, start distance and inscattering colour from the look and `FogBrightness`.
  - Clouds: a dynamic instance of the existing cloud material at runtime only. On first use, log its scalar parameter names once (`NORD_SKY_CLOUD_PARAMS`). Drive any parameter whose name contains `Coverage` with `CloudCover`. If none exists, leave the material alone. The saved actor keeps its engine material, so `verify_plateau.py:275` stays true.
  - Material parameter collection `/Game/Art/Atmosphere/MPC_NordAtmosphere`: `NightFactor`, `ExposureScale`, `WindowGlow`, `Wetness`, `Puddles`, `RainIntensity`, `WindStrength`, `WindDirX`, `WindDirY`, `Gloom`. Wind direction turns slowly with server time. If the asset is missing, log once and skip.
  - Street lamps: a pool of 24 point lights (candela units, 3200 K, attenuation 1,800 cm, no shadows) at the nearest lamp positions from the generated `LaFontaineLamps.h` (the 266 OSM `highway=street_lamp` nodes inside the map bounds, at 440 cm, below the comic lamp globes that span 455–499 cm; the snapshot has 22 more outside the bounds). Reassign every .5 s from the local view location.
  - Headlights: a pool of 6 spot lights (no shadows, cone 22°/38°, attenuation 3,500 cm) on the nearest cars that have an occupant or are traffic, when `bHeadlights` is on (night, and fog, drizzle and rain by day).
  - Rain: an instanced static mesh of 2,000 thin vertical quads in a 2,000 × 2,000 × 1,200 cm box, with `/Game/Art/Atmosphere/M_NordRain`. The plane `/Engine/BasicShapes/Plane` loads through `ConstructorHelpers` and `Config/DefaultGame.ini` always cooks `/Game/Art/Atmosphere`, so packages carry both. The component snaps to the box grid around the camera, so the wrap in the material keeps streaks fixed in the world; its bounds scale is 3. Hidden when rain is under .02. Missing material: log once (`NORD_SKY missing …`), no streaks.
  - Rain sound: a procedural 22,050 Hz mono wave of filtered noise, volume from rain intensity, following the car audio pattern.
  - Worklight: `AQuebecSky::LightScale(World)` returns `clamp(8 × ExposureScale, .03, 1)` or 1 when no sky exists. The campaign multiplies its 300,000 cd worklight by it.
- **Post-process on each local player.** `AQuebecController::PlayerTick` sets overrides on the view-target cameras, next to the comic blendable: auto-exposure min and max brightness = 12.5 + `ExposureOffset`, saturation, contrast and white temperature. When no sky exists, it clears only the overrides it set, so the level volume applies unchanged.
- **HUD.** One line inside the top-right map panel, under the map and above the map credits: `"%02d:%02d · %s"` (clock and weather name), at 1.15 × the credit size. The panel grows by that line only when a sky exists, so with the sky pinned the HUD layout is unchanged. (The first version sat under the controls line; the merged `main` moved the radar there.)

## Material authoring (`Scripts/plateau_atmosphere.py`, `Scripts/plateau_water.py`)

Bounded authoring in a fresh NullRHI editor process, following `refine_plateau_trees.apply`: assert the open world is `/Game/Maps/LaFontaine`, hash the map, back up every touched `.uasset` to `Saved/Recovery/sky-water-<UTC>/` with a SHA-256 manifest, edit in place, save, assert the map bytes did not change, then reload and verify. Each wrapper is idempotent: nodes carry the description `NordSky` and are not added twice.

- **MPC** `/Game/Art/Atmosphere/MPC_NordAtmosphere` with the ten scalars and defaults 0, 1, 1, 0, 0, 0, .25, .94, .34, 0. Defaults equal the pinned afternoon.
- **Shore texture.** `plateau_water.prepare()` reads the two pond relations through `plateau_park.park_survey()` and writes `Data/Plateau/WaterGeometry/pond_shore.png` (2,048², RGBA8, linear) and `water.json` (bounds in cm, texel size, encoding, sources, SHA-256). R = distance to the nearest shore over 0–6 m, G = distance over 0–30 m, B = 255 inside water, A = 255. Row 0 is the minimum y. Islands are shore. Import as `/Game/Plateau/Water/T_PondShore` with sRGB off, clamp addressing and BC7 or uncompressed masks.
- **Pond water.** `plateau_water.author(u, mat, texture, manifest, mpc)` rebuilds `/Game/Plateau/Materials/M_PondWater` in place: opaque, Default Lit, world-space normal (`tangent_space_normal` false). One Custom HLSL node (`Scripts/pond_water.hlsl`) takes `WorldPos`, `WorldDX` and `WorldDY` (DDX and DDY of the camera-relative world position, so it knows the size of each pixel on the water), `Time`, `Shore`, `Wind`, `WindDirX`, `WindDirY` and `Rain`, and returns (slope x, slope y, foam, roughness). The slope is a sum of ten waves, mostly along the wind plus a 47 cm cross-wind wave and a 33 cm opposing wave, under an 18 m value-noise gust mask (cat's paws). Rain adds Lagarde rings in four layers switched on at rain quarters: one drop per 50 cm cell, rings up to 15 cm across with a 3 cm half width and a peak slope of .12, damped within 1.5 m of the shore. Rain also damps the wind waves shorter than 1 m by `1 − .6 × Rain`. Each wave and the rings fade by their own frequency on screen, from 1/4 to 1/2 cycle per pixel, and the slope variance they lose is added to the roughness, so far water turns glossy instead of shimmering under TSR or the browser's 75% screen percentage. Total slope stays at or below .24, so the normal z stays above .97. Base colour: shallow (.045, .05, .03) to deep (.008, .022, .02) by `smoothstep(0, .4, Shore G)` in the graph (0–12 m from the shore), with a noise-broken foam band (.35, .36, .33) inside 35 cm. Roughness `clamp(.035 + .05 × Wind + .08 × Rain, .03, .17)` plus the lost slope variance, capped at .17 so F2 keeps its smooth-reflection treatment; foam .3. Specular .25 (F0 = .02), metallic 0. `plateau_surfaces.py` calls the same `author()` so a later full regeneration keeps the new water, and it re-applies the wet-ground and window wrappers through `rewrap()` whenever `MPC_NordAtmosphere` exists.
- **Rain streaks** `/Game/Art/Atmosphere/M_NordRain`: translucent, two-sided, volumetric non-directional lighting, base colour (.7, .74, .78), opacity = streak mask × .35 × visible-instance mask. The world-position offset (Custom HLSL, `Scripts/rain_streak.hlsl`, which also takes the vertex world position so the wind slant can vary along each streak) wraps each instance pivot into the box around the camera, after a fall of 900 cm/s (±25% per instance) and wind drift, and slants streaks along the wind. Instances above the rain intensity (by per-instance random) fade out; streaks fade near the box faces. The wrap moves a streak up to about 1.5 boxes from its pivot, so the material sets `max_world_position_offset_displacement` to 3,200 cm; with the default 0 the engine would cull streaks by their unmoved pivots.
- **Wet ground** on `M_Asphalt`, `M_Concrete`, `M_ConcreteDark`, `M_Gravel`, `M_ParkEarth`: base colour × `lerp(1, .5, Wetness)`; roughness → `lerp(R, R × .45, Wetness)`, then to .03 in puddles. Puddle mask = `smoothstep(.55, .7, noise)` × `Puddles`, from world-space value noise at 3 m scale (`Scripts/wet_puddles.hlsl`). In puddles the tangent normal goes to (0, 0, 1).
- **Night windows** on Plateau `M_Glow`, `M_InteriorWarm` and `M_Tail`: emissive × `WindowGlow`.
- **Daylight-calibrated unlit materials** `/Game/Materials/M_Glow` (parent of `M_Light` and `M_Tail`), `/Game/ParkComic/M_Paper`, `M_Text`, `M_IllustrationCrew`, `M_IllustrationBrawl`: emissive × `ExposureScale` × (1 + 1.5 × `NightFactor`). With the defaults, the daytime result is unchanged.
- **Verify.** `verify()` checks the map hash, then `verify_assets()` reads back blend mode, shading model, tangent-space flag, the pond's DDX and DDY inputs and shader-fed roughness, the rain material's displacement, and the base colour, normal, roughness and emissive inputs. It confirms the 15 pond actors still use `M_PondWater`, the MPC has the ten names and defaults, and every wrapper exists once. `verify_plateau.py` calls `verify_assets()` through `verify_sky_water()` once the MPC exists, so a full regeneration is checked too.

## Street lamp data

`Scripts/prepare_lafontaine_lamps.py` reads `Data/LaFontaine/osm.xml` with the same projection as `prepare_lafontaine.xy()` and writes `Source/Quebec/LaFontaineLamps.h` (`namespace LaFontaine { const FVector StreetLamps[] = {...}; }`, z = 440). `Scripts/test_lafontaine_lamps.py` checks the count, the bounds and that the header matches the source.

## QA pinning and preserved evidence

The existing QA flags pin the authored afternoon, so story, HUD, capture, profile and package checks keep their scope. The public browser host runs the live sky. For a browser QA run whose frames must repeat, `browser_streaming.py` passes `NORD_SKY_ARGS` (for example `-NordFixedSky`) to the host only, and refuses any flag outside a fixed list. The new water changes the look of every pond image; new evidence must be recorded rather than compared with the old pond pixels. Existing tests that parse `QuebecGameplay.h` (for example the source hash in `test_compact_hud.py`) record a new hash; that is expected.

On 2026-10-13 the user authorized fixing the failed smoke test and updating the demo. Keep the realistic default introduced intentionally by `a86a508a`. Both native suites first check standard view on both players, then explicitly enable comic view before their existing private-toggle, car/tool and capture checks. The smoke animation assertion follows each player's expected filter weight, including the standard default. This corrects test setup and the stale canonical specification without changing gameplay or replacing historical captures.

The native package build also required replacing the editor-only directional-light accessor with `FindComponentByClass`. The host generated the missing atmosphere assets using the bounded authoring pass. Rainy-night captures exposed the daylight-calibrated emissive fill in all eight crew materials: apply the existing exposure wrapper to that fill as well, preserving their base colour, textures and daytime multiplier of one. The crew importer reapplies the wrapper when the collection exists. UE 5.8's `DeleteAllMaterialExpressions` iterates the expression array it removes from; the pond, rain and crew generators instead share a copied-list deletion helper. The CPU repeat-authoring test reproduces the engine's skipped-node behavior and requires a stable second run.

## Risks

- Nothing here compiled Unreal C++ or ran the editor. The first native build may need small API fixes. DDX, DDY and SmoothStep in the pond graph, and the Custom node bodies, are untested natively.
- The sky luminance factor, Mie scale and fog values are first estimates. They need a matched native review.
- Moving the sun invalidates virtual shadow pages. The turn step limits that, but play-time cost while the sky runs is not measured yet.
- The cloud material may expose no coverage parameter; then overcast relies on fog, sky tint and light.
- The browser host runs at reduced quality with virtual shadows off; night readability there needs its own check.
- A full rebuild with `build_park_comic.py` or `brighten_comic_lights.py` recreates the ParkComic and old unlit materials without their exposure wrappers; run `plateau_atmosphere.py` again after either.
