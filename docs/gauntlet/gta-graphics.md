# GTA graphics gauntlet

Loop: keep making NORD (the GTA row) look closer to GTA 6 fidelity with original art only. Focus group: aesthetics. Rubric: [RUBRIC.md](RUBRIC.md).

Unreal is not available in this environment, so in-engine frames are the last committed captures and new source art is judged from the same offline shade of the canopy meshes. A round that fails its source test is reverted.

### Round 1 — 2026-10-21 — rubric v1

- What changed: Broadleaf crowns in `prepare_environment_refresh.py` keep a full canopy, with a darker underside (`Leaf0`) and an ochre sunlit cap (`Leaf2`), and a slightly tighter isosurface so lobes do not fuse into one balloon. Eight canopy OBJs and their layout counts were regenerated. Checked-in Unreal meshes are unchanged until `apply_environment_refresh.py` runs in the editor.
- Why it helped: The street trees were one flat green. A sunlit cap and a shaded bottom give the row a light direction, which is the nearest step toward a cinematic city canopy without dropping the crown into bare twigs.
- Screenshots: before `docs/gauntlet/gta-graphics/round-01/before-crowns.png`, after `docs/gauntlet/gta-graphics/round-01/after-crowns.png`. The shipped in-engine street is still `games/nord-unreal/Preview/Environment1280/EnvironmentSherbrooke.png`.
- Next target: texture and material quality (tied at 2 with detail density and particles; this pass did not change surface grain).

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | One hard sun and purple shadows; this round did not touch the sky model. |
| Color palette | 5 | Crowns now carry a sunlit ochre cap and a dark underside instead of one green. |
| Detail density | 2 | Crowns are still smooth volumes, not leaves, bark, or street clutter. |
| Texture and material quality | 2 | Tints only. No grain, wear, or roughness change. |
| Composition and camera | 4 | The street reads. The camera is a gameplay view, not a filmed shot. |
| Atmosphere | 3 | Clear gradient sky. No fog, wet air, or time-of-day shift in this pass. |
| Character models | 3 | Low-poly crew stays readable and far from a lead character. |
| Animation smoothness | 3 | Locomotion clips exist. No motion was reviewed this round. |
| Particles and VFX | 2 | No weather or impact particles in these views. |
| UI polish | 5 | The comic HUD is consistent. It was not part of this pass. |
| Responsiveness and input latency | 4 | Input paths exist. This machine did not measure latency. |
| Controls feel | 4 | On-foot and driving controls are documented. They were not played here. |
| Mission clarity | 5 | The existing frame shows an objective card and a next step. |
| Pacing | 4 | Two missions are implemented. That is not a full campaign rhythm. |
| Fun factor | 3 | Not played this round. |
| Difficulty curve | 4 | Mission retry is soft. There is no tuned difficulty curve in this pass. |
| Feedback | 4 | Prompts exist. No new hit, reward, or juice. |
| Sound design | 3 | Audio acceptance is still open. Nothing was listened to here. |
| Variety | 3 | One park district. Crowns repeat across a few silhouettes. |
| Performance stability | 5 | The last recorded static scenes passed their frame budget. Not remeasured. Source tests passed. |

- Aesthetics raw: 32 / 10 dimensions, index 32
- Playability raw: 39 / 10 dimensions, index 39
- Total: 71 / 200
- Delta vs last round: +1 (first scored row; color palette 4 on the pre-round crowns, 5 after)

### Round 2 — 2026-10-21 — rubric v1

- What changed: `Scripts/city_facade.hlsl` gives each brick or stone course its own tone, and darkens the base of the wall. Glass, trim, and the cornice stay as they were. The map material updates when `apply_city_comic_style.py` runs in the editor.
- Why it helped: Texture and material quality was tied for the lowest aesthetics score. A flat paper wall reads as a cartoon fill. Course-by-course variation and street dirt are the first surface grain the shader can carry without a new texture.
- Screenshots: before `docs/gauntlet/gta-graphics/round-02/before-facade.png`, after `docs/gauntlet/gta-graphics/round-02/after-facade.png`. These are a direct port of the facade shader, not an Unreal capture.
- Next target: particles and VFX (still 2, the lowest aesthetics score).

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Still one hard sun. This round did not change lights. |
| Color palette | 5 | Brick red and limestone stay. The new variation sits inside those colours. |
| Detail density | 3 | Course units now read on the wall. The street is still thin on props. |
| Texture and material quality | 4 | Per-unit tone and base dirt replace the flat fill. There is still no roughness or wear map. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 3 | No fog or weather change. |
| Character models | 3 | Untouched. |
| Animation smoothness | 3 | No motion reviewed. |
| Particles and VFX | 2 | None added. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged two-mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | Two facade families, still one district. |
| Performance stability | 5 | Source test passed. The shader adds no extra samples. Frame time was not remeasured. |

- Aesthetics raw: 35 / 10 dimensions, index 35
- Playability raw: 39 / 10 dimensions, index 39
- Total: 74 / 200
- Delta vs last round: +3

### Round 3 — 2026-10-21 — rubric v1

- What changed: `plateau_atmosphere.rain_material` keeps the Tariq displacement and visibility mask, and shades each quad with a tight core, a soft skirt, and a knot at the leading end. The core lerps the streak from mist `(0.55, 0.64, 0.74)` to near-white. `rain_streak.hlsl` is unchanged. The material updates when the atmosphere apply runs in the editor.
- Why it helped: Particles and VFX was the lowest aesthetics score. A flat grey ribbon at 0.35 opacity does not read as a drop. A bright core and a leading knot are the first streak shape the existing graph can carry.
- Screenshots: before `docs/gauntlet/gta-graphics/round-03/before-rain.png`, after `docs/gauntlet/gta-graphics/round-03/after-rain.png`. These are a direct port of the streak mask, not an Unreal capture. The public page `GET /gta/` returned 200. `Scripts/test_plateau_atmosphere.py` passed.
- Next target: lighting (tied at 3 with detail density, character models, and animation smoothness). Lighting is the remaining graphics gap on the sky. The clear 15:00 authored multipliers stay locked.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Still one hard sun. This round did not change lights. |
| Color palette | 5 | The streak moves from cool mist to white. The city palette is unchanged. |
| Detail density | 3 | Same streak count. The street is still thin on props. |
| Texture and material quality | 4 | Facades keep their course grain. Rain is a mask, not a new surface. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 4 | The streak now reads as weather. There is still no fog volume or time-of-day shift. |
| Character models | 3 | Untouched. |
| Animation smoothness | 3 | No motion reviewed. |
| Particles and VFX | 4 | Streaks have a core, a skirt, and a leading knot. No splash, sheet, or exhaust. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged two-mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One rain look, still one district. |
| Performance stability | 5 | Atmosphere source test passed. The streak graph adds no texture samples. Frame time was not remeasured. |

- Aesthetics raw: 38 / 10 dimensions, index 38
- Playability raw: 39 / 10 dimensions, index 39
- Total: 77 / 200
- Delta vs last round: +3

### Round 4 — 2026-10-21 — rubric v1

- What changed: `apply_comic_style.py` lifts dark pixels with a cool sky wash `(0.05, 0.07, 0.11)` instead of a violet wash, and the shade dots and hatch follow that blue. Ink outlines and the clear 15:00 light multipliers are unchanged. The material updates when `apply_comic_style.py` runs in the editor.
- Why it helped: Lighting was tied for the lowest aesthetics score. The visual review already says comic shadows push foliage toward purple. A sky-coloured wash keeps shade off black and takes the violet out of it.
- Screenshots: before `docs/gauntlet/gta-graphics/round-04/before-shadow.png`, after `docs/gauntlet/gta-graphics/round-04/after-shadow.png`. These are a direct port of the shadow wash, not an Unreal capture. `Scripts/test_plateau_trees.py` passed. `GET /gta/` returned 200.
- Next target: detail density (tied at 3 with character models and animation smoothness). Detail density is the remaining city-graphics gap.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 4 | Shade is a cool sky wash instead of violet. It is still one hard sun, with no bounce. |
| Color palette | 5 | Brick and sky stay. Only the shadow cast moved off violet. |
| Detail density | 3 | Same geometry. The street is still thin on props. |
| Texture and material quality | 4 | Unchanged course grain. The wash is a colour add, not a surface. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 4 | Weather streaks are unchanged. No fog volume. |
| Character models | 3 | Untouched. |
| Animation smoothness | 3 | No motion reviewed. |
| Particles and VFX | 4 | Rain streaks are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged two-mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. |
| Performance stability | 5 | The comic source test passed. The wash is the same instruction count. Frame time was not remeasured. |

- Aesthetics raw: 39 / 10 dimensions, index 39
- Playability raw: 39 / 10 dimensions, index 39
- Total: 78 / 200
- Delta vs last round: +1

### Round 5 — 2026-10-21 — rubric v1

- What changed: `city_facade.hlsl` turns every fourth ground-floor bay into a door with a transom, a panel, a knob, and steps up from the street. The windows above that bay stay. The map material updates when `apply_city_comic_style.py` runs in the editor.
- Why it helped: Detail density was tied for the lowest aesthetics score. A window grid with no entrance reads as a pattern, not a street. A door and steps are the first way in the shader can show.
- Screenshots: before `docs/gauntlet/gta-graphics/round-05/before-doors.png`, after `docs/gauntlet/gta-graphics/round-05/after-doors.png`. These are a direct port of the facade shader, not an Unreal capture. `Scripts/test_environment_refresh.py` passed. `GET /gta/` returned 200.
- Next target: character models (tied at 3 with animation smoothness).

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 4 | Unchanged sky wash. Still one hard sun. |
| Color palette | 5 | The door is a dark wood in the existing masonry colours. |
| Detail density | 4 | Ground floors now have a door and steps. The street is still thin on signs and clutter. |
| Texture and material quality | 4 | The entrance is flat colour, like the rest of the facade. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 4 | Weather streaks are unchanged. |
| Character models | 3 | Untouched. |
| Animation smoothness | 3 | No motion reviewed. |
| Particles and VFX | 4 | Rain streaks are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged two-mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. Entrances repeat on the same bay rhythm. |
| Performance stability | 5 | The facade source test passed. The door is extra arithmetic, no samples. Frame time was not remeasured. |

- Aesthetics raw: 40 / 10 dimensions, index 40
- Playability raw: 39 / 10 dimensions, index 39
- Total: 79 / 200
- Delta vs last round: +1

### Round 6 — 2026-10-21 — rubric v1

- What changed: `apply_comic_style.py` shades crew pixels with a half-lambert key from a fixed afternoon sun. The shade side is cooler and the lit side is slightly warm. Pixels outside the crew stencil are unchanged. The material updates when `apply_comic_style.py` runs in the editor.
- Why it helped: Character models were tied for the lowest aesthetics score. The crew material is an emissive fill, so a body is one flat colour. A wrapped key is the first form that fill can carry without a new mesh.
- Screenshots: before `docs/gauntlet/gta-graphics/round-06/before-crew.png`, after `docs/gauntlet/gta-graphics/round-06/after-crew.png`. These are a direct port of the crew key on stand-in ellipses, not an Unreal capture and not the shipped mesh. `Scripts/test_plateau_trees.py` passed. The sky patch in the preview is identical before and after. `GET /gta/` returned 200.
- Next target: animation smoothness (still 3, the lowest aesthetics score).

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 4 | The city sun is unchanged. The crew key is a stencil term, not a new light. |
| Color palette | 5 | The key tints the crew shade cool and the lit side warm. The street palette stays. |
| Detail density | 4 | Doors and steps are unchanged. |
| Texture and material quality | 4 | No new texture. The crew albedo is only multiplied. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 4 | Weather streaks are unchanged. |
| Character models | 4 | The crew stencil now has a lit side and a cool shade. The mesh is still the same low-poly body. |
| Animation smoothness | 3 | No motion reviewed. |
| Particles and VFX | 4 | Rain streaks are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The crew key is one sun direction. |
| Performance stability | 5 | The comic source test passed. The key is a dot product on crew pixels. Frame time was not remeasured. |

- Aesthetics raw: 41 / 10 dimensions, index 41
- Playability raw: 39 / 10 dimensions, index 39
- Total: 80 / 200
- Delta vs last round: +1

### Round 7 — 2026-10-21 — rubric v1

- What changed: `apply_comic_style.py` fades surfaces toward the afternoon sky from 25 m to 140 m, at most halfway. The sky pixel is skipped. The clear-day fog density and start scales stay at 1. The material updates when `apply_comic_style.py` runs in the editor.
- Why it helped: Atmosphere was tied at 4 once animation was set aside. A clear street had no depth in the air. A far wall now sits in the sky colour while a near wall stays.
- Screenshots: before `docs/gauntlet/gta-graphics/round-07/before-haze.png`, after `docs/gauntlet/gta-graphics/round-07/after-haze.png`. These are a direct port of the depth fade, not an Unreal capture. `Scripts/test_plateau_trees.py` passed. The near wall's mean colour matched before and after. `GET /gta/` returned 200.
- Next target: lighting (tied at 4 with detail density, texture and material quality, composition, character models, and particles). Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 4 | The sun and the crew key are unchanged. |
| Color palette | 5 | The near street stays. Only the far air picks up the sky. |
| Detail density | 4 | Doors and steps are unchanged. |
| Texture and material quality | 4 | No new surface. The fade is a colour mix. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 5 | Distant walls and the far street fade toward the sky. It is still a flat depth mix, not a fog volume. |
| Character models | 4 | The crew key is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 4 | Rain streaks are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The fade is one sky colour. |
| Performance stability | 5 | The comic source test passed. The fade is a smoothstep on depth. Frame time was not remeasured. |

- Aesthetics raw: 42 / 10 dimensions, index 42
- Playability raw: 39 / 10 dimensions, index 39
- Total: 81 / 200
- Delta vs last round: +1

### Round 8 — 2026-10-21 — rubric v1

- What changed: `city_facade.hlsl` colours the inner pane of some windows warm, from a hash of the bay and the floor. Other windows stay dark. Mullions and doors stay. The map material updates when `apply_city_comic_style.py` runs in the editor.
- Why it helped: Lighting was tied at 4 once animation was set aside. Every pane was the same dark glass, so the block looked empty. A warm room is the first practical light the facade colour can show.
- Screenshots: before `docs/gauntlet/gta-graphics/round-08/before-lamps.png`, after `docs/gauntlet/gta-graphics/round-08/after-lamps.png`. These are a direct port of the facade shader, not an Unreal capture. `Scripts/test_environment_refresh.py` passed. `GET /gta/` returned 200.
- Next target: detail density (tied at 4 with texture and material quality, composition, character models, and particles). Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Some rooms read warm against dark glass. The pane does not cast light on the wall, and the sun is unchanged. |
| Color palette | 5 | The warm pane sits in the existing masonry. Dark glass remains. |
| Detail density | 4 | Doors and steps are unchanged. The street is still thin on signs and clutter. |
| Texture and material quality | 4 | The lamp is a flat colour in the glass. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 5 | The depth fade is unchanged. |
| Character models | 4 | The crew key is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 4 | Rain streaks are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. Lit and dark rooms repeat on the same hash. |
| Performance stability | 5 | The facade source test passed. The lamp is a hash, no samples. Frame time was not remeasured. |

- Aesthetics raw: 43 / 10 dimensions, index 43
- Playability raw: 39 / 10 dimensions, index 39
- Total: 82 / 200
- Delta vs last round: +1

### Round 9 — 2026-10-21 — rubric v1

- What changed: `city_facade.hlsl` draws a gallery rail and bars on the floor above each entrance, and a downspout between bay groups. Doors, lamps, and the other windows stay. The map material updates when `apply_city_comic_style.py` runs in the editor.
- Why it helped: Detail density was tied at 4. The wall was a grid of windows with a door at the street. A rail in front of the floor above the door, and a downspout, are the first pieces that sit on the wall rather than in it.
- Screenshots: before `docs/gauntlet/gta-graphics/round-09/before-rails.png`, after `docs/gauntlet/gta-graphics/round-09/after-rails.png`. These are a direct port of the facade shader, not an Unreal capture. `Scripts/test_environment_refresh.py` passed. `GET /gta/` returned 200.
- Next target: texture and material quality (tied at 4 with composition, character models, and particles). Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Lit and dark windows are unchanged. The rail does not cast light. |
| Color palette | 5 | The iron is a dark grey in the existing masonry. |
| Detail density | 5 | Entrances now have a gallery rail, and downspouts break the bay grid. The street is still thin on signs and loose clutter. |
| Texture and material quality | 4 | The rail is a flat colour, like the rest of the facade. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 5 | The depth fade is unchanged. |
| Character models | 4 | The crew key is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 4 | Rain streaks are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. Rails repeat on the entrance rhythm. |
| Performance stability | 5 | The facade source test passed. The rail is extra arithmetic, no samples. Frame time was not remeasured. |

- Aesthetics raw: 44 / 10 dimensions, index 44
- Playability raw: 39 / 10 dimensions, index 39
- Total: 83 / 200
- Delta vs last round: +1

### Round 10 — 2026-10-21 — rubric v1

- What changed: `city_facade.hlsl` draws courses as a pale mortar bed, darker toward the back of the joint, with a lit upper edge and a fine face mottle. Doors, lamps, and rails stay. The map material updates when `apply_city_comic_style.py` runs in the editor.
- Why it helped: Texture and material quality was tied at 4. A course was the brick colour darkened by a hairline, so the wall was one fill. A joint that is its own material, and an edge that takes the sun, is the first surface relief the colour shader can show.
- Screenshots: before `docs/gauntlet/gta-graphics/round-10/before-mortar.png`, after `docs/gauntlet/gta-graphics/round-10/after-mortar.png`. These are a direct port of the facade shader, not an Unreal capture. `Scripts/test_environment_refresh.py` passed. `GET /gta/` returned 200.
- Next target: character models (tied at 4 with composition and particles). Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Window lamps are unchanged. The arris is a lit edge on the course, not a new light. |
| Color palette | 5 | The mortar is a pale limestone in the trim's range. |
| Detail density | 5 | Rails and doors are unchanged. The joint is a material, not a new object. |
| Texture and material quality | 5 | Courses have a pale bed and a lit upper edge, and the face is mottled. It is still one colour, not a scanned surface. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 5 | The depth fade is unchanged. |
| Character models | 4 | The crew key is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 4 | Rain streaks are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The joint repeats on every course. |
| Performance stability | 5 | The facade source test passed. The grain is extra arithmetic, no samples. Frame time was not remeasured. |

- Aesthetics raw: 45 / 10 dimensions, index 45
- Playability raw: 39 / 10 dimensions, index 39
- Total: 84 / 200
- Delta vs last round: +1
