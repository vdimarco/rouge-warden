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

### Round 11 — 2026-10-21 — rubric v1

- What changed: the comic post process adds a pale grazing rim on crew pixels, (1 − n·v)^4. The city is left alone. The material updates when `apply_comic_style.py` runs in the editor.
- Why it helped: Character models were tied at 4. The half-lambert lights the crown and leaves the shadow side against the street. An upward-only rim sat inside that crown. A rim around the whole silhouette is what separates the figure.
- Screenshots: before `docs/gauntlet/gta-graphics/round-11/before-rim.png`, after `docs/gauntlet/gta-graphics/round-11/after-rim.png`. These are ellipses with the crew shading, not an Unreal capture and not the shipped mesh. `Scripts/test_plateau_trees.py` passed. `GET /gta/` returned 200.
- Next target: particles and VFX (tied at 4 with composition). Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Window lamps and the key are unchanged. The rim is an edge on the crew, not a city light. |
| Color palette | 5 | The rim is a pale sky white. |
| Detail density | 5 | Rails and doors are unchanged. |
| Texture and material quality | 5 | Mortar beds are unchanged. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 5 | The depth fade is unchanged. |
| Character models | 5 | A pale edge outlines the figure and the centre keeps the half-lambert. The preview is ellipses, not the shipped mesh. |
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
| Variety | 3 | One district. The rim is the same edge on every crew pixel. |
| Performance stability | 5 | The comic source test passed. The rim is extra arithmetic, no samples. Frame time was not remeasured. |

- Aesthetics raw: 46 / 10 dimensions, index 46
- Playability raw: 39 / 10 dimensions, index 39
- Total: 85 / 200
- Delta vs last round: +1

### Round 12 — 2026-10-21 — rubric v1

- What changed: rain cards go from 1.2 cm wide to 10 cm, and the streak material adds a round head on the leading end. `rain_streak.hlsl` is unchanged. The material updates when the atmosphere script runs in the editor.
- Why it helped: Particles were tied at 4. The core and the knot were authored, then drawn on a card thinner than a pixel past a few metres, so every drop was the same hairline. A card wide enough for the head to separate from the tail is the first time that profile can show.
- Screenshots: before `docs/gauntlet/gta-graphics/round-12/before-streaks.png`, after `docs/gauntlet/gta-graphics/round-12/after-streaks.png`. These are a perspective shade of the streak cards, not an Unreal capture. `Scripts/test_plateau_atmosphere.py` passed. `water_shader_test.cpp` passed under g++ (92 assertions). `python3 Scripts/test_water_shader.py` stops here because `c++` is clang and cannot see `<cmath>`. `GET /gta/` returned 200.
- Next target: composition and camera. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Window lamps and the crew rim are unchanged. The rain head does not cast. |
| Color palette | 5 | The head is the same white the core already used. |
| Detail density | 5 | Rails and doors are unchanged. |
| Texture and material quality | 5 | Mortar beds are unchanged. |
| Composition and camera | 4 | Unchanged gameplay camera. |
| Atmosphere | 5 | The depth fade is unchanged. |
| Character models | 5 | The crew rim is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 5 | Near streaks have a round head and a tail, and far ones shrink. There is still no splash on the street. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The drops repeat one shape. |
| Performance stability | 5 | The atmosphere test passed, and the streak-bounds test passed under g++. The head is extra arithmetic on the existing cards. Frame time was not remeasured. |

- Aesthetics raw: 47 / 10 dimensions, index 47
- Playability raw: 39 / 10 dimensions, index 39
- Total: 86 / 200
- Delta vs last round: +1

### Round 13 — 2026-10-21 — rubric v1

- What changed: the on-foot spring arm socket moves from `(0, 0, 55)` to `(0, 70, 55)`, and the combat idle socket matches it. Aim still uses `(0, 70, 62)` and only closes in. Pitch limits, arm length, and the car socket stay as they were. The camera updates when the game runs in the editor.
- Why it helped: Composition was the lowest aesthetics score this pass can check. The figure sat on the center line and aiming slid the street sideways onto a shoulder the idle view never used. Parking idle on that shoulder opens the street beside the figure.
- Screenshots: before `docs/gauntlet/gta-graphics/round-13/before-shoulder.png`, after `docs/gauntlet/gta-graphics/round-13/after-shoulder.png`. These are a perspective shade of the spring arm with a stand-in figure, not an Unreal capture. `Scripts/test_camera_shoulder.py` passed (worst normalized frame 0.729). `Quebec.Camera.LookBounds` could not run; Unreal is not installed. `GET /gta/` returned 200.
- Next target: lighting. Lamps and the sun still do not cast, and a contact darkening can be shaded offline. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Window lamps and the crew rim are unchanged. The shoulder does not add a light. |
| Color palette | 5 | Unchanged. |
| Detail density | 5 | Rails and doors are unchanged. |
| Texture and material quality | 5 | Mortar beds are unchanged. |
| Composition and camera | 5 | The figure sits left of center and the street on their right stays in frame. It is still a spring arm, not a filmed shot. |
| Atmosphere | 5 | The depth fade is unchanged. |
| Character models | 5 | The crew rim is unchanged. The preview figure is a stand-in, not the shipped mesh. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 5 | Rain heads are unchanged. There is still no splash on the street. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The offset is the same on every street. |
| Performance stability | 5 | The framing port passed. The offset is a constant on the existing arm. Frame time was not remeasured. |

- Aesthetics raw: 48 / 10 dimensions, index 48
- Playability raw: 39 / 10 dimensions, index 39
- Total: 87 / 200
- Delta vs last round: +1

### Round 14 — 2026-10-21 — rubric v1

- What changed: `Scripts/city_facade.hlsl` warms the brick under a lit window. The apron uses the same room hash as the orange pane, skips the glass, and falls off down the wall and a short way to either side. Dark windows are unchanged. The material updates when `apply_city_comic_style.py` runs in the editor.
- Why it helped: Lighting was tied at the top of what this pass can still move. A lit room was only a pane. The brick under it matched the brick under a dark room, so the lamp did not land on the wall.
- Screenshots: before `docs/gauntlet/gta-graphics/round-14/before-spill.png`, after `docs/gauntlet/gta-graphics/round-14/after-spill.png`. These are a direct port of the facade shader, not an Unreal capture. `Scripts/test_facade_spill.py` passed. `Scripts/test_environment_refresh.py` passed. `GET /gta/` returned 200.
- Next target: particles and VFX. Rain still has no splash where a drop meets the street, and that can be shaded offline. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | A lit pane now warms the brick under it. There is still no sun shadow and no bounce. |
| Color palette | 5 | The apron is the lamp's amber on the existing brick. |
| Detail density | 5 | Rails and doors are unchanged. |
| Texture and material quality | 5 | Mortar beds are unchanged. The apron is a tint, not a new grain. |
| Composition and camera | 5 | The shoulder camera is unchanged. |
| Atmosphere | 5 | The depth fade is unchanged. |
| Character models | 5 | The crew rim is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 5 | Rain heads are unchanged. There is still no splash on the street. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. Lit and dark rooms already varied; the apron follows that hash. |
| Performance stability | 5 | The facade source test passed. The apron is extra arithmetic, no samples. Frame time was not remeasured. |

- Aesthetics raw: 49 / 10 dimensions, index 49
- Playability raw: 39 / 10 dimensions, index 39
- Total: 88 / 200
- Delta vs last round: +1

### Round 15 — 2026-10-21 — rubric v1

- What changed: wet ground composites `Scripts/rain_splash.hlsl`, an expanding ring on a 70 cm cell, scaled by rain intensity. `rain_streak.hlsl` and the puddle mask are unchanged. The material updates when the atmosphere script runs in the editor.
- Why it helped: Particles were tied at 5. The streak now has a head and a tail, and it still never meets the street. A ring that opens and fades is the impact those drops were missing.
- Screenshots: before `docs/gauntlet/gta-graphics/round-15/before-splash.png`, after `docs/gauntlet/gta-graphics/round-15/after-splash.png`. These are a perspective shade of the wet-ground colour, not an Unreal capture. `Scripts/test_plateau_atmosphere.py` passed. `water_shader_test.cpp` passed under g++ (98 assertions). `python3 Scripts/test_water_shader.py` still stops here because `c++` is clang and cannot see `<cmath>`. `GET /gta/` returned 200.
- Next target: atmosphere. The depth fade is still a flat mix, and a height change in that fade can be shaded offline. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | The window apron is unchanged. A splash ring does not cast. |
| Color palette | 5 | The ring is a pale lift of the wet asphalt. |
| Detail density | 5 | Rails and doors are unchanged. |
| Texture and material quality | 5 | Mortar beds are unchanged. |
| Composition and camera | 5 | The shoulder camera is unchanged. |
| Atmosphere | 5 | The depth fade is unchanged. The ring is on the ground, not in the air. |
| Character models | 5 | The crew rim is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain draws a ring where it meets the street, larger near the camera. There is still no spray sheet. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The rings repeat one shape. |
| Performance stability | 5 | The atmosphere test passed, and the splash test passed under g++. The ring is extra arithmetic on the existing wet colour. Frame time was not remeasured. |

- Aesthetics raw: 50 / 10 dimensions, index 50
- Playability raw: 39 / 10 dimensions, index 39
- Total: 89 / 200
- Delta vs last round: +1

### Round 16 — 2026-10-21 — rubric v1

- What changed: the comic aerial fade weights the existing 25 m–140 m depth term by view-ray elevation. A horizontal ray mixes farther toward the afternoon sky than a steep ray at the same depth. `QuebecSkyModel` clear-day fog scales stay at 1. The material updates when the comic script runs in the editor.
- Why it helped: Atmosphere was tied at 5. The old mix was halfway to the sky for every distant surface, so the vanishing point did not read as a longer path through the air.
- Screenshots: before `docs/gauntlet/gta-graphics/round-16/before-horizon.png`, after `docs/gauntlet/gta-graphics/round-16/after-horizon.png`. These are a perspective shade of the aerial mix on a street longer than 140 m, not an Unreal capture. `Scripts/test_horizon_haze.py` passed. `Scripts/test_plateau_trees.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: color palette. The ink grade is still one saturation curve, and a warm-brick / cool-shadow split can be shaded offline. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | The window apron is unchanged. Haze does not cast. |
| Color palette | 5 | The sky mix colour is the same afternoon blue. The horizon only uses more of it. |
| Detail density | 5 | Rails and doors are unchanged. |
| Texture and material quality | 5 | Brick grain and mortar are unchanged. |
| Composition and camera | 5 | The shoulder camera is unchanged. |
| Atmosphere | 6 | The vanishing point takes more of the afternoon sky than a steep view at the same depth. The near street stays. It is still a post-process lerp, not a fog volume. |
| Character models | 5 | The crew rim is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. |
| Performance stability | 5 | The comic source tests passed. The ray is a few arithmetic ops on the existing fade. Frame time was not remeasured. |

- Aesthetics raw: 51 / 10 dimensions, index 51
- Playability raw: 39 / 10 dimensions, index 39
- Total: 90 / 200
- Delta vs last round: +1

### Round 17 — 2026-10-21 — rubric v1

- What changed: brick paper in `city_facade.hlsl` moves to burnt orange, and stone paper moves to a cool grey. Course lines, mortar, rails, doors, and the lamp apron are unchanged. The material updates when the city comic script runs in the editor.
- Why it helped: Color palette was tied at 5. Brick and stone were two stops in the same maroon-brown, so a stone row did not separate from the brick beside it.
- Screenshots: before `docs/gauntlet/gta-graphics/round-17/before-palette.png`, after `docs/gauntlet/gta-graphics/round-17/after-palette.png`. These are a straight elevation of the facade shader, not an Unreal capture. `Scripts/test_facade_palette.py` passed. `Scripts/test_facade_spill.py` passed. `Scripts/test_environment_refresh.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: detail density. The wall bodies changed hue, and the courses, rails, and doors are the same marks as the last elevation. A new repeated mark on that elevation can be shaded offline. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | The window apron is unchanged. The body hue does not cast. |
| Color palette | 6 | Brick reads burnt orange and stone reads cool grey in the same elevation. It is still flat paper, not a photographed wall. |
| Detail density | 5 | Rails, doors, and courses are the same marks. |
| Texture and material quality | 5 | Grain and mortar beds are unchanged. The change is the body hue. |
| Composition and camera | 5 | The shoulder camera is unchanged. |
| Atmosphere | 6 | The horizon fade is unchanged. |
| Character models | 5 | The crew rim is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. Stone rows are the same block repeated. |
| Performance stability | 5 | The facade source tests passed. The body colour is a constant swap. Frame time was not remeasured. |

- Aesthetics raw: 52 / 10 dimensions, index 52
- Playability raw: 39 / 10 dimensions, index 39
- Total: 91 / 200
- Delta vs last round: +1

### Round 18 — 2026-10-21 — rubric v1

- What changed: `city_facade.hlsl` draws an iron trough under each window, with a lighter lip. The door opening is excluded. The rail, the lamp apron, and the brick and stone colours are unchanged. The material updates when the city comic script runs in the editor.
- Why it helped: Detail density was tied at 5. The elevation had courses, rails, and doors, and nothing repeated under the panes.
- Screenshots: before `docs/gauntlet/gta-graphics/round-18/before-trough.png`, after `docs/gauntlet/gta-graphics/round-18/after-trough.png`. These are a straight elevation of the facade shader, not an Unreal capture. `Scripts/test_facade_trough.py` passed. `Scripts/test_facade_palette.py` passed. `Scripts/test_facade_spill.py` passed. `Scripts/test_environment_refresh.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: texture and material quality. The trough is a flat iron colour, and the brick grain is still a small multiply. A coarser break in the stone or brick face can be shaded offline. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | The window apron still shows beside the trough. The trough does not cast. |
| Color palette | 6 | Brick and stone hues are unchanged. The trough uses the rail's iron. |
| Detail density | 6 | Each window has a trough and a lip. The door opening does not. It is still a flat bar, not a planted box. |
| Texture and material quality | 5 | Grain and mortar beds are unchanged. The trough is a flat colour. |
| Composition and camera | 5 | The shoulder camera is unchanged. |
| Atmosphere | 6 | The horizon fade is unchanged. |
| Character models | 5 | The crew rim is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The trough repeats one shape. |
| Performance stability | 5 | The facade source tests passed. The trough is a few steps on the existing colour. Frame time was not remeasured. |

- Aesthetics raw: 53 / 10 dimensions, index 53
- Playability raw: 39 / 10 dimensions, index 39
- Total: 92 / 200
- Delta vs last round: +1

### Round 19 — 2026-10-21 — rubric v1

- What changed: `city_facade.hlsl` mottles each masonry unit in three bands, chips a lower corner on some bricks, and pits the middle of some stones. The fine grain, mortar, rails, doors, troughs, and lamp apron are unchanged. The material updates when the city comic script runs in the editor.
- Why it helped: Texture and material quality was tied at 5. The per-unit tint is one flat colour, and the fine grain is only a couple of pixels at street scale.
- Screenshots: before `docs/gauntlet/gta-graphics/round-19/before-face.png`, after `docs/gauntlet/gta-graphics/round-19/after-face.png`. These are a straight elevation of the facade shader, not an Unreal capture. `Scripts/test_facade_face.py` passed. `Scripts/test_facade_trough.py` passed. `Scripts/test_facade_palette.py` passed. `Scripts/test_facade_spill.py` passed. `Scripts/test_environment_refresh.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: composition and camera. The shoulder offset is unchanged, and another framing shift can be checked with the existing projection. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | The window apron is unchanged. The mottle does not cast. |
| Color palette | 6 | Brick stays burnt orange and stone stays cool grey. The chip is a darker break in that hue. |
| Detail density | 6 | Troughs, rails, and doors are unchanged. |
| Texture and material quality | 6 | Each unit is banded, some bricks are chipped, and some stones are pitted. It is still a hash, not a photographed surface. |
| Composition and camera | 5 | The shoulder camera is unchanged. |
| Atmosphere | 6 | The horizon fade is unchanged. |
| Character models | 5 | The crew rim is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The mottle repeats one hash. |
| Performance stability | 5 | The facade source tests passed. The face is a few hashes on the existing colour. Frame time was not remeasured. |

- Aesthetics raw: 54 / 10 dimensions, index 54
- Playability raw: 39 / 10 dimensions, index 39
- Total: 93 / 200
- Delta vs last round: +1

### Round 20 — 2026-10-21 — rubric v1

- What changed: the walking socket and the combat socket rise from 55 cm to 110 cm. Aim keeps a 7 cm lift, at 117 cm. The 70 cm shoulder, the pitch clamps, the car socket, and `TargetOffset.Z` stay. The camera updates when the pawn is constructed in the editor.
- Why it helped: Composition was tied at 5. The shoulder already opened the right side, and the figure still sat in the middle of the frame.
- Screenshots: before `docs/gauntlet/gta-graphics/round-20/before-frame.png`, after `docs/gauntlet/gta-graphics/round-20/after-frame.png`. These are a perspective shade of the walking camera at pitch −12, not an Unreal capture. `Scripts/test_camera_shoulder.py` passed (worst framing 0.853, inside 0.95). `Quebec.Camera.LookBounds` did not run. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: character models. The rim is unchanged, and a clothing break has to come from source colour because the blend space still cannot be posed. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | The window apron is unchanged. The camera does not cast. |
| Color palette | 6 | Brick and stone hues are unchanged. |
| Detail density | 6 | Troughs, rails, and doors are unchanged. |
| Texture and material quality | 6 | The mottled face is unchanged. |
| Composition and camera | 6 | The figure sits lower and the street ahead fills more of the frame. The shoulder offset stays. It is still a spring arm on a stand-in figure. |
| Atmosphere | 6 | The horizon fade is unchanged. |
| Character models | 5 | The crew rim is unchanged. The shaded figure is a capsule. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. |
| Performance stability | 5 | The camera port passed. The socket is a constant. Frame time was not remeasured. |

- Aesthetics raw: 55 / 10 dimensions, index 55
- Playability raw: 39 / 10 dimensions, index 39
- Total: 94 / 200
- Delta vs last round: +1

### Round 21 — 2026-10-21 — rubric v1

- What changed: printed crew skips the cool shadow wash. The half-lambert multiply is a scalar from 0.70 to 1.08, the luminance of the old blue-to-warm key. The rim stays. The city wash stays.
- Why it helped: Character models were at 5. The coloured key and the wash pushed a warm-dark tee toward indigo.
- Screenshots: before `docs/gauntlet/gta-graphics/round-21/before-crew.png`, after `docs/gauntlet/gta-graphics/round-21/after-crew.png`. These are a 3× nearest crop of a walking-camera shade at pitch −12 and yaw 180, using the measured CurlyMetalhead tee albedo. Full frames are `before-frame.png` and `after-frame.png`. Not an Unreal capture. Shirt mean went from (0.146, 0.131, 0.165) to (0.125, 0.086, 0.073), so blue dropped below red. `Scripts/test_crew_colour.py` passed. `Scripts/test_plateau_trees.py` passed. `Scripts/test_horizon_haze.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: UI polish. The street panel is still one flat fill, and a mark on that panel can be shaded offline without changing mission text. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | The city wash is unchanged. The crew shade uses the old key's value range. |
| Color palette | 6 | Brick and stone hues are unchanged. |
| Detail density | 6 | Troughs, rails, and doors are unchanged. |
| Texture and material quality | 6 | The mottled face is unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 6 | The horizon fade is unchanged. |
| Character models | 6 | A warm-dark tee stays warm in shade, and skin stays warm in the light. The shaded figure is still an ellipsoid stand-in. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 5 | Untouched. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | Unchanged objective card. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. |
| Performance stability | 5 | The comic source tests passed. The shade is a scalar on the existing crew mask. Frame time was not remeasured. |

- Aesthetics raw: 56 / 10 dimensions, index 56
- Playability raw: 39 / 10 dimensions, index 39
- Total: 95 / 200
- Delta vs last round: +1

### Round 22 — 2026-10-21 — rubric v1

- What changed: the mission card, the caption, and the prompt draw a paper rule 4 scale units in from the top and bottom, and a 6-unit crop tick in the top-right padding. The accent bar, the words, and the 12-unit type inset stay.
- Why it helped: UI polish was at 5. Those cards were a flat fill.
- Screenshots: before `docs/gauntlet/gta-graphics/round-22/before-panel.png`, after `docs/gauntlet/gta-graphics/round-22/after-panel.png`. These are a 2× nearest crop of an offline shade of the mission card at scale 1 on a 1280×720 frame. The words are a stand-in; the game strings are unchanged. Not an Unreal capture. `Scripts/test_hud_rule.py` passed. `QuebecGameplay.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: lighting. The crew shade still does not darken the ground under the figure, and a contact darkening can be shaded offline. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | The city wash and the crew shade are unchanged. The card does not cast. |
| Color palette | 6 | Brick and stone hues are unchanged. |
| Detail density | 6 | Troughs, rails, and doors are unchanged. |
| Texture and material quality | 6 | The mottled face is unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 6 | The horizon fade is unchanged. |
| Character models | 6 | The crew hue grade is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 6 | The mission card has a paper rule and a crop tick. The words and their inset are unchanged. It is still a flat fill. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. |
| Performance stability | 5 | The rule is three lines on the existing cards. Frame time was not remeasured. |

- Aesthetics raw: 57 / 10 dimensions, index 57
- Playability raw: 39 / 10 dimensions, index 39
- Total: 96 / 200
- Delta vs last round: +1

### Round 23 — 2026-10-21 — rubric v1

- What changed: upward ground pixels darken when one of eight nearby samples is an upright surface within 70 cm of the same depth. A much nearer sample is left to the ink. The crew shade and the clear-day fog scales stay.
- Why it helped: Lighting was at 6. A figure and a wall met the street with no darkening at the base.
- Screenshots: before `docs/gauntlet/gta-graphics/round-23/before-contact.png`, after `docs/gauntlet/gta-graphics/round-23/after-contact.png`. These are a 2× nearest crop of an offline walking-camera shade at pitch −12, using the same eight taps. Not an Unreal capture. `Scripts/test_contact.py` passed. `Scripts/test_plateau_trees.py` passed. `Scripts/test_horizon_haze.py` passed. `Scripts/test_crew_colour.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: texture and material quality. The brick face is still one hash, and another break in that face can be shaded offline. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | The ground darkens where a figure or a wall meets it. The darkening is eight depth taps, not a shadow cast by the sun. |
| Color palette | 6 | Brick and stone hues are unchanged. |
| Detail density | 6 | Troughs, rails, and doors are unchanged. |
| Texture and material quality | 6 | The mottled face is unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 6 | The horizon fade is unchanged. |
| Character models | 6 | The crew hue grade is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 6 | The paper rule is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. |
| Performance stability | 5 | Eight extra depth taps on the existing post process. Frame time was not remeasured. |

- Aesthetics raw: 58 / 10 dimensions, index 58
- Playability raw: 39 / 10 dimensions, index 39
- Total: 97 / 200
- Delta vs last round: +1

### Round 24 — 2026-10-21 — rubric v1

- What changed: some clay bricks take a pale salt crust on the face above the joint. Stone does not. Mortar is drawn after the crust, so the bed stays its own colour. Glass, doors, rails, and the lamp apron are unchanged.
- Why it helped: Texture was at 6. The face was a hash, a chip, and a pit, all in the clay colour.
- Screenshots: before `docs/gauntlet/gta-graphics/round-24/before-crust.png`, after `docs/gauntlet/gta-graphics/round-24/after-crust.png`. These are a straight elevation of the facade shader. Not an Unreal capture. About 11% of the pixels moved, and those pixels went from burnt orange toward a pale deposit. `Scripts/test_facade_crust.py` passed. `Scripts/test_facade_face.py` passed. `Scripts/test_facade_trough.py` passed. `Scripts/test_facade_palette.py` passed. `Scripts/test_facade_spill.py` passed. `Scripts/test_environment_refresh.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: detail density. The courses are one running bond, and a header course can be shaded on this elevation. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | The contact darkening is unchanged. The crust does not cast. |
| Color palette | 6 | Brick stays burnt orange and stone stays cool grey. The crust is a pale deposit on the clay. |
| Detail density | 6 | Troughs, rails, and doors are unchanged. |
| Texture and material quality | 7 | Some clay units carry a pale salt crust above the joint. It is a flat tint, not a photographed deposit. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 6 | The horizon fade is unchanged. |
| Character models | 6 | The crew hue grade is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 6 | The paper rule is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The crust repeats one hash. |
| Performance stability | 5 | The facade source tests passed. The crust is a lerp on the existing face. Frame time was not remeasured. |

- Aesthetics raw: 59 / 10 dimensions, index 59
- Playability raw: 39 / 10 dimensions, index 39
- Total: 98 / 200
- Delta vs last round: +1

### Round 25 — 2026-10-21 — rubric v1

- What changed: odd courses become headers. A second vertical joint splits the stretcher, and each half takes its own tint. Even courses stay one unit wide. The salt crust, the glass, and the lamp apron stay.
- Why it helped: Detail density was at 6. The wall was one running bond of stretchers.
- Screenshots: before `docs/gauntlet/gta-graphics/round-25/before-bond.png`, after `docs/gauntlet/gta-graphics/round-25/after-bond.png`. These are a straight elevation of the facade shader. Not an Unreal capture. About 19% of the pixels moved. `Scripts/test_facade_bond.py` passed. `Scripts/test_facade_crust.py` passed. `Scripts/test_facade_face.py` passed. `Scripts/test_facade_trough.py` passed. `Scripts/test_facade_palette.py` passed. `Scripts/test_facade_spill.py` passed. `Scripts/test_environment_refresh.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: color palette. The glass is still one tint, and a second pane colour can be shaded on this elevation. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | The contact darkening is unchanged. The bond does not cast. |
| Color palette | 6 | Brick, stone, and the crust hues are unchanged. |
| Detail density | 7 | Odd courses read as short headers against the stretchers. The units are still flat marks. |
| Texture and material quality | 7 | The salt crust is unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 6 | The horizon fade is unchanged. |
| Character models | 6 | The crew hue grade is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 6 | The paper rule is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The bond repeats every other course. |
| Performance stability | 5 | The facade source tests passed. The bond is a joint and a tint on the existing courses. Frame time was not remeasured. |

- Aesthetics raw: 60 / 10 dimensions, index 60
- Playability raw: 39 / 10 dimensions, index 39
- Total: 99 / 200
- Delta vs last round: +1

### Round 26 — 2026-10-21 — rubric v1

- What changed: sky pixels in `Scripts/apply_comic_style.py` take a cumulus paint. The view ray projects onto a layer above the camera, two octaves of value noise set the coverage, and the thicker samples go white while the thinner edge stays blue-grey with a warm sun-side tint. The street multiplies that paint by zero. The horizon haze mix, the weather cover scalar, and the crew masks stay.
- Why it helped: Atmosphere was at 6. The sky slot over the street was a clear gradient. Separate cloud masses now sit in that slot, with blue left between them.
- Screenshots: before `docs/gauntlet/gta-graphics/round-26/before-clouds.png`, after `docs/gauntlet/gta-graphics/round-26/after-clouds.png`. These are the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) with the cloud function on rays that miss the street. Not an Unreal capture. About 7.2% of the pixels moved, all of them sky. The street delta is 0. The sky is 11% of this frame. `Scripts/test_cloud.py` passed. `Scripts/test_horizon_haze.py` passed. `Scripts/test_plateau_trees.py` passed. `Scripts/test_crew_colour.py` passed. `Scripts/test_contact.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: vehicles. A clearcoat on the seventies body can be shaded from the existing meshes, and it fills the street in a way the sky slot does not. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | The contact darkening is unchanged. The cloud tint is a sky paint, not a new street light. |
| Color palette | 6 | Brick, stone, and the crew hues are unchanged. The clouds sit in the existing blue-white range. |
| Detail density | 7 | The English bond is unchanged. The clouds are large masses, not new street detail. |
| Texture and material quality | 7 | The salt crust is unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. The sky is still the slot above the roofs. |
| Atmosphere | 7 | The sky slot holds separate cumulus with blue between them. It is a paint on the post process, not a marched volume, and this camera hides most of the sky. |
| Character models | 6 | The crew hue grade is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 6 | The paper rule is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The cloud field repeats with the view. |
| Performance stability | 5 | The comic source tests passed. The paint is sixteen sine samples on the existing ray. Frame time was not remeasured. |

- Aesthetics raw: 61 / 10 dimensions, index 61
- Playability raw: 39 / 10 dimensions, index 39
- Total: 100 / 200
- Delta vs last round: +1

### Round 27 — 2026-10-21 — rubric v1

- What changed: glossy bodywork in `Scripts/apply_comic_style.py` takes a clearcoat. The view ray reflects about the world normal and picks up the afternoon sky, weighted by a Fresnel term. Paint at roughness 0.30, glass at 0.18 and chrome at 0.23 are in range. Rubber, the pond's smooth-reflection case, printed crew, foliage and the sky pixel stay out. The cumulus paint and the horizon haze mix stay.
- Why it helped: Texture and material quality was at 7. The coupe was a flat Lambert teal with black glass. The hood now carries the sky, and the glass reads as a reflection. The tires stay matte.
- Screenshots: before `docs/gauntlet/gta-graphics/round-27/before-coat.png`, after `docs/gauntlet/gta-graphics/round-27/after-coat.png`. These rasterize the seventies coupe meshes on the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90). Not an Unreal capture. The car is about 5% of the frame. Paint mean went from `(0.03, 0.20, 0.18)` to `(0.14, 0.31, 0.36)`. Glass mean went from `(0.04, 0.08, 0.11)` to `(0.16, 0.28, 0.45)`. The street delta is 0. A facing share of 0.22 was shaded first and did not show, so the facing share is 0.62. `Scripts/test_coat.py` passed. `Scripts/test_cloud.py` passed. `Scripts/test_horizon_haze.py` passed. `Scripts/test_plateau_trees.py` passed. `Scripts/test_crew_colour.py` passed. `Scripts/test_contact.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: night. A night grade can fill the frame, and it has to leave the clear-day lighting contract alone. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | The contact darkening is unchanged. The coat is a reflection, not a new light. |
| Color palette | 6 | The brick and the crew hues are unchanged. The sky colours on the car were already the afternoon sky. |
| Detail density | 7 | The English bond is unchanged. The car mesh was already in the game. |
| Texture and material quality | 8 | Paint and glass now carry the sky, and the tires stay matte. It is a Fresnel mix in the post process, not a clearcoat lobe. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 7 | The cumulus paint is unchanged. |
| Character models | 6 | The crew hue grade is unchanged. The coat skips printed crew. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 6 | The paper rule is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district, one coupe in the shade. The other two bodies use the same coat. |
| Performance stability | 5 | The comic source tests passed. The coat adds one noise octave on the reflected ray. Frame time was not remeasured. |

- Aesthetics raw: 62 / 10 dimensions, index 62
- Playability raw: 39 / 10 dimensions, index 39
- Total: 101 / 200
- Delta vs last round: +1

### Round 28 — 2026-10-21 — rubric v1

- What changed: the comic post process in `Scripts/apply_comic_style.py` paints a night grade after the clearcoat. A sky pixel toward a fixed moon direction takes the authored moon colour `(0.62, 0.72, 1)` plus a white disc. Sixteen taps of the post-process input spill warm windows and white headlights onto neighbouring pixels. `NightFactor` comes from `MPC_NordAtmosphere`. At 0 the mix returns the colour unchanged. `NightOffset` −9, `WindowGlow`, and the lamp switch stay in the sky model.
- Why it helped: Atmosphere was at 7. The midnight plate was flat rectangles on a black sky. The moon and the spill make a lit night. The darkness, the lamp switch, and the window glow were already the sky model.
- Screenshots: before `docs/gauntlet/gta-graphics/round-28/before-night.png`, after `docs/gauntlet/gta-graphics/round-28/after-night.png`. Both are the same walking-camera night plate (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90). The coupe is a box stand-in, not the seventies mesh. Not an Unreal capture. Mean absolute delta is 0.052 and the max is 0.92. The lower street, which is already black, stays at delta 0. The node runs after tonemapping, so a pixel whose peak is under about 0.20 is not re-crushed and does not become neon. `Scripts/test_night.py` passed. `Scripts/test_coat.py` passed. `Scripts/test_cloud.py` passed. `Scripts/test_horizon_haze.py` passed. `Scripts/test_plateau_trees.py` passed. `Scripts/test_crew_colour.py` passed. `Scripts/test_contact.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: color palette, by reflecting these neon lights on the street. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | The bloom is a post halo on lights the sky model already turns on. Exposure is unchanged. |
| Color palette | 6 | The neon sits in the existing orange windows and white headlights. |
| Detail density | 7 | The English bond and the street props are unchanged. |
| Texture and material quality | 8 | The clearcoat is unchanged. The grade does not retouch a surface. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The midnight sky now has a moon and the windows spill. It is sixteen point taps, not a bloom pyramid. |
| Character models | 6 | The crew hue grade is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. The spill is a post gather, not a particle. |
| UI polish | 6 | The paper rule is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district, one midnight plate. The clear-day frame is the same shader with NightFactor 0. |
| Performance stability | 5 | The comic source tests passed. The grade adds sixteen scene-colour taps. Frame time was not remeasured. |

- Aesthetics raw: 63 / 10 dimensions, index 63
- Playability raw: 39 / 10 dimensions, index 39
- Total: 102 / 200
- Delta vs last round: +1

### Round 29 — 2026-10-21 — rubric v1

- What changed: rough upward ground in `Scripts/apply_comic_style.py` takes a night sheen after the moon grade. Sixteen taps from the pixel toward the horizon, at the same screen x, keep the brightest warm or white sample and mix it at 0.85. Paint, glass, chrome, walls, sky, crew, foliage and the pond stay out. `NightFactor` 0 returns the colour unchanged. The puddle mask stays in the ground graph.
- Why it helped: Color palette was at 6. The midnight road was a black fill. The orange from the windows and the white from the headlights now run down the asphalt.
- Screenshots: before `docs/gauntlet/gta-graphics/round-29/before-mirror.png`, after `docs/gauntlet/gta-graphics/round-29/after-mirror.png`. Both are the walking-camera night plate (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) with the moon and the spill. The coupe is a box stand-in. Not an Unreal capture. Mean absolute delta is 0.045 and the max is 0.81. The lower street mean delta is 0.089. The taps are point samples, so the streaks are hard-edged. A screen-space reflected ray was shaded first and stayed under a mean delta of 0.01, so it was not kept. `Scripts/test_street.py` passed. `Scripts/test_night.py` passed. `Scripts/test_coat.py` passed. `Scripts/test_cloud.py` passed. `Scripts/test_horizon_haze.py` passed. `Scripts/test_plateau_trees.py` passed. `Scripts/test_crew_colour.py` passed. `Scripts/test_contact.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: character models, the lowest aesthetics score that can still be drawn offline. Composition, particles and UI are tied at 6, and the walking socket, the rain displacement and the paper rule stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | The sheen repeats lights that are already in the frame. Exposure is unchanged. |
| Color palette | 7 | The road carries the window orange and the headlight white. The streaks are sixteen hard taps, not a blurred lobe. |
| Detail density | 7 | The English bond and the street props are unchanged. |
| Texture and material quality | 8 | The clearcoat is unchanged. Roughness only gates who receives the sheen. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon and the spill are unchanged. |
| Character models | 6 | No figure was added. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. The sheen is a column of taps, not a particle. |
| UI polish | 6 | The paper rule is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district, one midnight plate. The clear-day frame is the same shader with NightFactor 0. |
| Performance stability | 5 | The comic source tests passed. The sheen adds sixteen scene-colour taps on top of the night gather. Frame time was not remeasured. |

- Aesthetics raw: 64 / 10 dimensions, index 64
- Playability raw: 39 / 10 dimensions, index 39
- Total: 103 / 200
- Delta vs last round: +1

### Round 30 — 2026-10-21 — rubric v1

- What changed: when the officer rig is missing, `AQuebecOfficer::ApplyLook` draws `SM_MenSuitStand` or `SM_MenHoodieStand` before the cylinder. `Scripts/bake_officer_stand.py` skins the CC0 civilian GLB at the first key of `Idle_Neutral`, feet on the origin, face toward +X, in centimetres. The cylinder, the sphere and the cap remain only when that mesh is also missing. The skeletal path is unchanged when the rig loads.
- Why it helped: Character models were at 6, and the missing-rig figure was a cylinder with a ball for a head. The idle is a clothed person: hair, collar, arms, legs and shoes.
- Screenshots: before `docs/gauntlet/gta-graphics/round-30/before-figures.png`, after `docs/gauntlet/gta-graphics/round-30/after-figures.png`. Both use the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90). The after frame is the suit idle turned toward the camera. Not an Unreal capture. The figure occupies about 53×192 pixels. Inside that box the mean absolute delta is 0.088. The street outside it is unchanged. This is one authored idle frame, not the blend space. `Scripts/test_officer_stand.py` passed. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`. The stand meshes were not imported.
- Next target: UI polish. Composition and particles are tied at 6, and the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | The sun on the figure is the same key. No new light. |
| Color palette | 7 | The suit is the source cloth colour. The street colours are unchanged. |
| Detail density | 7 | The street is unchanged. The figure is one person, not a crowd. |
| Texture and material quality | 8 | The clearcoat is unchanged. The suit uses the GLB material colours. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon grade and the street sheen are unchanged. |
| Character models | 7 | The cylinder fallback is a clothed idle. It is a stylized CC0 body, one frame, not a lead character. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. The bake is a single idle key. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 6 | The paper rule is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The hoodie bake uses the same path and is not in this frame. |
| Performance stability | 5 | `Scripts/test_officer_stand.py` passed. The bake is an offline mesh, not a runtime skin. Frame time was not remeasured. |

- Aesthetics raw: 65 / 10 dimensions, index 65
- Playability raw: 39 / 10 dimensions, index 39
- Total: 104 / 200
- Delta vs last round: +1

### Round 31 — 2026-10-21 — rubric v1

- What changed: the street column fill goes from opacity .34 to .62. A paper rule sits on the panel edge, clamped to the 4-scale-unit padding, and the warm accent covers the left edge. Health and armour bars draw three quarter cuts and a paper lip only as wide as the fill. A cut inside the fill is ink. A cut past the fill is paper. The mission card, the words, and the calm-street hide stay.
- Why it helped: UI polish was at 6. The column was one faint fill, and the vitals bars were flat rectangles.
- Screenshots: before `docs/gauntlet/gta-graphics/round-31/before-meter.png`, after `docs/gauntlet/gta-graphics/round-31/after-meter.png`. These are a 3× nearest crop of an offline shade of the street column at scale 1 on a 1280×720 frame. Phone crops are `before-phone.png` and `after-phone.png` (390×844, scale 0.70). Narrow crops are `before-narrow.png` and `after-narrow.png` (320×700, scale 0.60). The words are a stand-in. The game strings are unchanged. Not an Unreal capture. On the desktop crop the mean absolute delta is 0.082 and the max is 0.94. The phone crop mean is 0.090. The narrow crop mean is 0.086. `Scripts/test_street_meter.py` passed. `Scripts/test_hud_rule.py` passed. `QuebecGameHUD.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: lighting. A warm pool on the road under the street lamps can be shaded offline, and the clear-day frame stays when the lamps are off. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | The card does not cast. The sun and the night grade are unchanged. |
| Color palette | 7 | The meter uses the existing health green and armour blue. The street colours are unchanged. |
| Detail density | 7 | The street is unchanged. |
| Texture and material quality | 8 | The clearcoat is unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon grade and the street sheen are unchanged. |
| Character models | 7 | The clothed idle fallback is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 7 | The street column is a framed card and the vitals bars are quartered meters. It is still a comic panel. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One district. The phone and narrow crops use the same column. |
| Performance stability | 5 | `Scripts/test_street_meter.py` passed. The column adds a few rects when it is already open. Frame time was not remeasured. |

- Aesthetics raw: 66 / 10 dimensions, index 66
- Playability raw: 39 / 10 dimensions, index 39
- Total: 105 / 200
- Delta vs last round: +1

### Round 32 — 2026-10-21 — rubric v1

- What changed: after the street sheen, a road pixel looks up the screen on a 5 by 7 grid for a lamp head. The head has to be brighter than a lit window and warmer than a headlight. The mix adds a warm pool and follows NightFactor, so a clear day stays as it was. The point-light radius and the lamp height stay at 18 m and 440 cm.
- Why it helped: Lighting was at 7. The night road under a lamp was black apart from a one-pixel sheen streak. The gather lays a pool on that road.
- Screenshots: before `docs/gauntlet/gta-graphics/round-32/before-pool.png`, after `docs/gauntlet/gta-graphics/round-32/after-pool.png`. These are a 2× nearest crop of an offline shade. Full frames are `before-frame.png` and `after-frame.png`. The walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) sits on a La Fontaine street. The globes are 55 cm stand-ins at the OSM lamp points. Not an Unreal capture. The crop mean absolute delta is 0.028 and the max is 0.35. The full frame mean is 0.0024 because the sky and the near road are unchanged. The pool edge is scalloped because the taps are points. A head that falls between the 16 px steps can be missed. `Scripts/test_pool.py` passed. `Scripts/test_night.py`, `Scripts/test_street.py`, `Scripts/test_coat.py`, `Scripts/test_cloud.py`, `Scripts/test_horizon_haze.py`, `Scripts/test_contact.py`, `Scripts/test_crew_colour.py` and `Scripts/test_plateau_trees.py` passed. The comic material was not rebuilt. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: color palette. Detail stays off the facades. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 8 | A warm pool sits on the road under the lamp heads. It is a blocky gather, not a shadowed light. |
| Color palette | 7 | The pool is one warm brown. Brick and window hues are unchanged. |
| Detail density | 7 | The street meshes are unchanged. |
| Texture and material quality | 8 | The clearcoat is unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. The shade uses that socket on a lamp street. |
| Atmosphere | 8 | The moon grade and the sheen are unchanged. The streaks in the plate are the sheen. |
| Character models | 7 | The clothed idle fallback is unchanged. No figure is in this frame. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. The pool is a gather, not a particle. |
| UI polish | 7 | The street column is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One night street. The clear-day path is the same shader with NightFactor 0. |
| Performance stability | 5 | The comic source tests passed. The pool adds 35 scene-colour taps on the road. Frame time was not remeasured. |

- Aesthetics raw: 67 / 10 dimensions, index 67
- Playability raw: 39 / 10 dimensions, index 39
- Total: 106 / 200
- Delta vs last round: +1

### Round 33 — 2026-10-21 — rubric v1

- What changed: after the lamp pool, road the pool did not claim gets a flat cool add of (0.05, 0.07, 0.12). A strong pool keeps the warm colour. The mix follows NightFactor, so a clear day stays as it was.
- Why it helped: Color palette was at 7. The night road outside a pool was black, so the street was one warm brown.
- Screenshots: before `docs/gauntlet/gta-graphics/round-33/before-frame.png`, after `docs/gauntlet/gta-graphics/round-33/after-frame.png`. Crops are `before-moonlit.png` and `after-moonlit.png`. Same walking camera and La Fontaine lamps as the pool round. Not an Unreal capture. Full-frame mean absolute delta is 0.042 and the max is 0.12. The crop mean is 0.039. The warm pools stay warm. `Scripts/test_pool.py` passed, and the comic regression tests passed. The comic material was not rebuilt. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: character models. Detail stays off the facades. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 8 | The lamp pool is unchanged. The blue is a flat add, not a new light. |
| Color palette | 8 | Open night road goes cool and the pools stay warm. It is one flat blue, not a grade across the city. |
| Detail density | 7 | The street meshes are unchanged. |
| Texture and material quality | 8 | The clearcoat is unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon disc and the sheen are unchanged. |
| Character models | 7 | The clothed idle fallback is unchanged. No figure is in this frame. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 7 | The street column is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One night street. The clear-day path is the same shader with NightFactor 0. |
| Performance stability | 5 | The comic source tests passed. The fill is one lerp on the road. Frame time was not remeasured. |

- Aesthetics raw: 68 / 10 dimensions, index 68
- Playability raw: 39 / 10 dimensions, index 39
- Total: 107 / 200
- Delta vs last round: +1

### Round 34 — 2026-10-21 — rubric v1

- What changed: when `SK_Body` is missing, `AQuebecCharacter::ApplyCrewAppearance` draws `SM_MenCasualStand` and hides the skeletal mesh. `Scripts/bake_officer_stand.py` skins the CC0 casual GLB at the first key of `Idle_Neutral`, feet on the origin, face toward +X, in centimetres. The mannequin stays only when that mesh is also missing. A loaded crew rig hides the stand and keeps the skeletal path.
- Why it helped: Character models were at 7 because the clothed idle was an officer, not the lead. The missing-rig lead was still the white mannequin.
- Screenshots: before `docs/gauntlet/gta-graphics/round-34/before-frame.png`, after `docs/gauntlet/gta-graphics/round-34/after-frame.png`. Crops are `before-casual.png` and `after-casual.png`. Both use the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90). The after frame is the casual idle turned toward the camera. Not an Unreal capture. The figure crop is 123×252 pixels. Inside that box the mean absolute delta is 0.093 and the max is 0.859. The full-frame mean is 0.0056. Eyes sit closer to the camera than the hair. This is one authored idle frame, not the blend space. A normal session that has `SK_Body` still shows the crew rig. `Scripts/test_player_stand.py` passed. `Scripts/test_officer_stand.py` passed. `QuebecGameplay.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`. The stand mesh was not imported.
- Next target: detail density, off the facades. UI polish is tied at 7 and the street column just moved. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 8 | The key on the figure is the same sun. No new light. |
| Color palette | 8 | The clothes use the source colours. The street colours are unchanged. |
| Detail density | 7 | The street meshes are unchanged. The figure is one person. |
| Texture and material quality | 8 | The clearcoat is unchanged. The idle uses the GLB material colours. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon grade and the street sheen are unchanged. |
| Character models | 8 | The missing crew rig is a clothed idle: hair, shirt, trousers and shoes. It is still one CC0 frame, and a loaded rig is unchanged. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. The bake is a single idle key. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 7 | The street column is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One casual idle. The crew rig, when it loads, is the same path as before. |
| Performance stability | 5 | `Scripts/test_player_stand.py` passed. The bake is an offline mesh, not a runtime skin. Frame time was not remeasured. |

- Aesthetics raw: 69 / 10 dimensions, index 69
- Playability raw: 39 / 10 dimensions, index 39
- Total: 108 / 200
- Delta vs last round: +1

### Round 35 — 2026-10-21 — rubric v1

- What changed: `AQuebecLanePaint` lays a broken white center line on La Fontaine roads at least 9 m wide. Each dash is an engine plane, 180 cm by 22 cm, 2 cm above the ground trace, every 450 cm. Narrower streets stay bare. The dashes do not collide. The host paints after the road meshes accept a trace. A remote client paints its own copy. A second spawn adds nothing.
- Why it helped: Detail density was at 7, and the facades stay off limits. The wide roads were one unbroken sheet of asphalt.
- Screenshots: before `docs/gauntlet/gta-graphics/round-35/before-frame.png`, after `docs/gauntlet/gta-graphics/round-35/after-frame.png`. Crops are `before-dashes.png` and `after-dashes.png`. Both use the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) on the sidewalk of a 14 m road. Not an Unreal capture. The dash pixels number 355. The max absolute delta is 0.612. The bounding crop mean is 0.004 because the gaps between dashes are still bare asphalt. The full-frame mean is 0.0004. `Scripts/test_lane_paint.py` passed. `QuebecTraces.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`. The dashes were not confirmed in Unreal.
- Next target: UI polish. It is the remaining aesthetics score at 7. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 8 | The sun on the road is the same. The dashes are not lights. |
| Color palette | 8 | The white is one marking. The street colours are otherwise unchanged. |
| Detail density | 8 | Wide roads now carry a broken center line. Local streets and the buildings are unchanged. |
| Texture and material quality | 8 | The clearcoat is unchanged. The dash is a flat white plane. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon grade and the street sheen are unchanged. |
| Character models | 8 | The casual idle fallback is unchanged. No figure is in this frame. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 7 | The street column is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One boulevard. Narrow streets stay unmarked. |
| Performance stability | 5 | `Scripts/test_lane_paint.py` passed. The dashes are one instanced mesh. Frame time was not remeasured. |

- Aesthetics raw: 70 / 10 dimensions, index 70
- Playability raw: 39 / 10 dimensions, index 39
- Total: 109 / 200
- Delta vs last round: +1

### Round 36 — 2026-10-21 — rubric v1

- What changed: The radar draws a road at least 9 m wide as an ink casing 5.2 scale units wide with a paper center 2.6 scale units wide, after the side streets. A narrower road keeps the grey stroke at 1.5 scale units. The clip that rejects a segment outside the disc is unchanged. On the expanded Montréal radar the park prefix uses the park widths and the surveyed suffix uses the extension widths.
- Why it helped: UI polish was at 7. Every street on the radar was one grey hair, so the avenue beside the spawn did not read as a wider road.
- Screenshots: before `docs/gauntlet/gta-graphics/round-36/before-frame.png`, after `docs/gauntlet/gta-graphics/round-36/after-frame.png`. Crops are `before-radar.png` and `after-radar.png`. Both are the landscape HUD radar (160 px, scale 1) centered on the park spawn. Not an Unreal capture. The radar crop mean absolute delta is 0.008 and the max is 0.808. The full-frame mean is 0.005 because the disc is a corner of the frame. The avenue is the pale cased spine through the disc. `Scripts/test_radar_rank.py` passed. `QuebecGameplay.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`. The ranked radar was not confirmed in Unreal.
- Next target: texture and material quality, tied at 8 with the other aesthetics a picture can still move. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 8 | The sun and the night grade are unchanged. The radar is a HUD disc. |
| Color palette | 8 | The avenue stroke is one warm paper line. The world colours are unchanged. |
| Detail density | 8 | The street mesh is unchanged. This is a map stroke. |
| Texture and material quality | 8 | World materials are unchanged. The radar stroke is flat. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon grade and the street sheen are unchanged. |
| Character models | 8 | No figure changed. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 8 | The avenue on the radar is now a cased stroke. Side streets stay the grey line. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One park radar. Toronto uses its own widths with the same gate. |
| Performance stability | 5 | `Scripts/test_radar_rank.py` passed. The radar walks the road list three times. Frame time was not remeasured. |

- Aesthetics raw: 71 / 10 dimensions, index 71
- Playability raw: 39 / 10 dimensions, index 39
- Total: 110 / 200
- Delta vs last round: +1

### Round 37 — 2026-10-21 — rubric v1

- What changed: The asphalt colour samples `asphalt_02` twice. One sample stays on world XY times 0.005, a 2 m repeat. The second uses times 0.013, shifted by 0.37, and a sine mixes them. A faster sine pair moves the colour between 0.78 and 1. Normals and roughness stay on the 2 m grid. The tint stays (0.82, 0.87, 0.89).
- Why it helped: Texture and material quality was at 8. The same crack ruled the road every 2 m.
- Screenshots: before `docs/gauntlet/gta-graphics/round-37/before-frame.png`, after `docs/gauntlet/gta-graphics/round-37/after-frame.png`. Crops are `before-tar.png` and `after-tar.png`. Both use the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) along a flat road. Not an Unreal capture. The road crop mean absolute delta is 0.060 and the max is 0.576. The full-frame mean is 0.058. `Scripts/test_asphalt_grain.py` passed. The material graph was not applied in Unreal. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: color palette, tied at 8 with the other aesthetics a picture can still move. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 8 | The sun and the night grade are unchanged. |
| Color palette | 8 | The photo and the tint are the same grey. The mix does not add a new hue. |
| Detail density | 8 | The street mesh is unchanged. |
| Texture and material quality | 9 | The ruled 2 m crack is broken. The aggregate is still one photo. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon grade and the street sheen are unchanged. |
| Character models | 8 | No figure changed. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 8 | The radar is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One asphalt photo, two scales. |
| Performance stability | 5 | `Scripts/test_asphalt_grain.py` passed. The graph adds one texture sample. Frame time was not remeasured. |

- Aesthetics raw: 72 / 10 dimensions, index 72
- Playability raw: 39 / 10 dimensions, index 39
- Total: 111 / 200
- Delta vs last round: +1

### Round 38 — 2026-10-21 — rubric v1

- What changed: After the clearcoat and before the night grade, a matte midtone is multiplied by a tint from (0.62, 0.96, 1.18) in shade to (1.55, 1.12, 0.42) toward the sun, then scaled back to that pixel's luminance. The split is the crew key's half-lambert. Pixels the cool wash already owns, glossy bodywork, the sky and printed crew stay. NightFactor 1 leaves the colour.
- Why it helped: Color palette was at 8. A clear day held one temperature, so the wall facing the sun matched the wall in shade and the road stayed a neutral grey.
- Screenshots: before `docs/gauntlet/gta-graphics/round-38/before-frame.png`, after `docs/gauntlet/gta-graphics/round-38/after-frame.png`. Crops are `before-street.png` and `after-street.png`. Both use the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) looking down a street of the burnt-orange brick paper and the two-scale asphalt. Not an Unreal capture. The street crop mean absolute delta is 0.046 and the max is 0.267. The full-frame mean is 0.044. The shade wall goes duller brown, the sunlit wall stays burnt orange, and the road goes warm. `Scripts/test_day_grade.py` passed. The comic material was not applied in Unreal. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: detail density, tied at 8 with lighting, atmosphere, character models and UI polish. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 8 | The sun vector and the exposure are unchanged. The grade puts the luminance back. |
| Color palette | 9 | Shade brick, sunlit brick and the road are three hues. It is still one multiply, and the shade is brown rather than skylight. |
| Detail density | 8 | The street mesh is unchanged. |
| Texture and material quality | 9 | The asphalt mix and the brick paper are unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon grade and the street sheen are unchanged. |
| Character models | 8 | No figure changed. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 8 | The radar is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One street grade. |
| Performance stability | 5 | `Scripts/test_day_grade.py` passed. The grade adds no texture taps. Frame time was not remeasured. |

- Aesthetics raw: 73 / 10 dimensions, index 73
- Playability raw: 39 / 10 dimensions, index 39
- Total: 112 / 200
- Delta vs last round: +1

### Round 39 — 2026-10-21 — rubric v1

- What changed: Each road at least 9 m wide and 15 m long gets eight bars across its middle, on the same white plane pool as the center dashes. A bar is 40 cm along the road, stops 80 cm short of each curb, and the next bar is 90 cm further on. The dash loop, the 9 m gate and the return count stay. Narrow streets stay bare.
- Why it helped: Detail density was at 8. The avenue had a broken line down the middle and no crossing.
- Screenshots: before `docs/gauntlet/gta-graphics/round-39/before-frame.png`, after `docs/gauntlet/gta-graphics/round-39/after-frame.png`. Crops are `before-bars.png` and `after-bars.png`. Both use the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) a few metres before the ladder on a 14 m road. Not an Unreal capture. The bar crop mean absolute delta is 0.183 and the max is 0.929. The full-frame mean is 0.079. The center dashes are in both frames. `Scripts/test_crosswalk.py` and `Scripts/test_lane_paint.py` passed. `QuebecTraces.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`. The bars were not confirmed in Unreal.
- Next target: lighting, tied at 8 with atmosphere, character models and UI polish. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 8 | The sun and the night grade are unchanged. |
| Color palette | 9 | The bars are the existing white under the day grade. No new hue. |
| Detail density | 9 | The ladder crosses the avenue. The bars are flat planes, not worn paint. |
| Texture and material quality | 9 | The asphalt mix is unchanged. The bar is one white material. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon grade and the street sheen are unchanged. |
| Character models | 8 | No figure changed. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 8 | The radar is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | The ladder is on the wide park roads. A narrow street stays bare. |
| Performance stability | 5 | `Scripts/test_crosswalk.py` passed. Twenty-eight roads would add 224 bars when the ground trace hits. Frame time was not remeasured. |

- Aesthetics raw: 74 / 10 dimensions, index 74
- Playability raw: 39 / 10 dimensions, index 39
- Total: 113 / 200
- Delta vs last round: +1

### Round 40 — 2026-10-21 — rubric v1

- What changed: After the clear-day hue grade and before the night grade, a matte surface is multiplied by a half-lambert shade from 0.58 in shade to 1 toward the sun. The hue grade still puts the luminance back first. Gloss, the sky and printed crew stay. NightFactor 1 leaves the colour. There is no shadow ray, so the road under a wall is not darkened.
- Why it helped: Lighting was at 8. The shade wall and the sunlit wall were the same brightness, because the hue grade gives the luminance back.
- Screenshots: before `docs/gauntlet/gta-graphics/round-40/before-frame.png`, after `docs/gauntlet/gta-graphics/round-40/after-frame.png`. Crops are `before-shade.png` and `after-shade.png`. Both use the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) on the brick street from the hue round. Not an Unreal capture. The shade-wall crop mean absolute delta is 0.076 and the max is 0.267. The full-frame mean is 0.026. The sunlit wall and the road are unchanged. `Scripts/test_key_shade.py` passed. The comic material was not applied in Unreal. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: atmosphere, tied at 8 with character models and UI polish. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The shade wall goes darker. The sunlit wall and the road stay. There is still no cast shadow on the street. |
| Color palette | 9 | The hues are the round-38 grade. This multiply changes value. |
| Detail density | 9 | The street mesh and the ladder are unchanged. |
| Texture and material quality | 9 | The asphalt mix and the brick paper are unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 8 | The moon grade, the haze and the clouds are unchanged. |
| Character models | 8 | No figure changed. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 8 | The radar is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One street, one sun direction. |
| Performance stability | 5 | `Scripts/test_key_shade.py` passed. The shade is a scalar. Frame time was not remeasured. |

- Aesthetics raw: 75 / 10 dimensions, index 75
- Playability raw: 39 / 10 dimensions, index 39
- Total: 114 / 200
- Delta vs last round: +1

### Round 41 — 2026-10-21 — rubric v1

- What changed: After the far aerial mix and before the clouds, a clear-day surface lerps toward warm dust `(0.74, 0.71, 0.64)`. The band rises from 5 m to 18 m, dies by 70 m, and uses the same horizon weight as the far haze. Sky pixels stay. NightFactor 1 leaves the colour. The far window, from 25 m to 140 m, is unchanged.
- Why it helped: Atmosphere was at 8. The far haze is zero inside 25 m, and the walking street lives inside that. The road ahead now pales and warms with distance. The foreground crosswalk does not.
- Screenshots: before `docs/gauntlet/gta-graphics/round-41/before-frame.png`, after `docs/gauntlet/gta-graphics/round-41/after-frame.png`. Distance crops are `before-dust.png` and `after-dust.png`. Both use the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) on the brick street. Not an Unreal capture. The distance-crop mean absolute delta is 0.074 and the full-frame mean is 0.021 (max 0.256). The bottom of the frame, nearer than 5 m, stays (mean 0.00014). A road pixel at 13.9 m goes from about (0.36, 0.31, 0.17) to (0.48, 0.40, 0.22). `Scripts/test_street_air.py` passed, and the locked comic tests still passed. The comic material was not applied in Unreal. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: character models, tied at 8 with UI polish. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The shade wall is unchanged. Dust is a depth mix, not a new light. |
| Color palette | 9 | The foreground keeps the round-38 hues. The distance warms because it is in the dust. |
| Detail density | 9 | The street mesh, the dashes and the ladder are unchanged. |
| Texture and material quality | 9 | The asphalt mix and the brick paper are unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 9 | The road ahead pales into warm dust. The foreground stays sharp. Past 70 m the cool haze still owns the view. There is no light shaft. |
| Character models | 8 | No figure changed. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 8 | The radar is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One clear-day street. Night still skips the dust. |
| Performance stability | 5 | `Scripts/test_street_air.py` passed. The band is a lerp. Frame time was not remeasured. |

- Aesthetics raw: 76 / 10 dimensions, index 76
- Playability raw: 39 / 10 dimensions, index 39
- Total: 115 / 200
- Delta vs last round: +1

### Round 42 — 2026-10-21 — rubric v1

- What changed: the radar heading is filled. An ink wedge, the same triangle grown by 1.55 about its centre, is drawn first. The paper wedge is the original tip and tails. The three paper outline strokes stay. Avenue casing and the grey side streets stay.
- Why it helped: UI polish was at 8. The heading was a paper outline and the avenue centre is paper, so the point of the arrow fell into the wide road.
- Screenshots: before `docs/gauntlet/gta-graphics/round-42/before-frame.png`, after `docs/gauntlet/gta-graphics/round-42/after-frame.png`. Crops are `before-arrow.png` and `after-arrow.png`, a 4× nearest enlargement of the heading. The disc is scale 1. Not an Unreal capture. At scale 1, 59 pixels change. The heading crop mean absolute delta is 0.227 and the max is 0.967. The full disc mean is 0.0007. `Scripts/test_radar_arrow.py` passed. `Scripts/test_radar_rank.py` passed. `QuebecGameplay.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: character models, the remaining aesthetics score at 8. Composition and particles stay at 6, because the walking socket and the rain displacement stay as they are. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The street shade is unchanged. |
| Color palette | 9 | The arrow uses the existing ink and paper. |
| Detail density | 9 | The street mesh is unchanged. |
| Texture and material quality | 9 | The asphalt mix is unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 9 | The street dust is unchanged. |
| Character models | 8 | No figure changed. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 6 | Rain rings are unchanged. |
| UI polish | 9 | The heading is a solid paper wedge, and the ink edge cuts the avenue. It is still a flat triangle. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. The diamond is unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | The heading is easier to see. No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One disc, one heading. |
| Performance stability | 5 | `Scripts/test_radar_arrow.py` passed. The fill is thirty line strokes. Frame time was not remeasured. |

- Aesthetics raw: 77 / 10 dimensions, index 77
- Playability raw: 39 / 10 dimensions, index 39
- Total: 116 / 200
- Delta vs last round: +1

### Round 43 — 2026-10-21 — rubric v1

- What changed: a car (ride kind 0) that is not a wreck, and is faster than 80 cm/s or holding throttle, grows a column of six pale spheres from the tail. A new puff every 0.16 s lives 1.1 s, drifts back at 160 cm/s and rises at 180 cm/s, swelling from scale 0.16 to 0.55. A stopped car stays clear. A wreck still uses the bonnet smoke. The pond pedalo and the park bicycle do not.
- Why it helped: Particles were at 6. The only smoke was the wreck column off the bonnet, and a healthy car left no trail.
- Screenshots: before `docs/gauntlet/gta-graphics/round-43/before-frame.png`, after `docs/gauntlet/gta-graphics/round-43/after-frame.png`. Crops are `before-plume.png` and `after-plume.png`. Both use the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) behind a stand-in car. Not an Unreal capture. The plume crop mean absolute delta is 0.184 and the max is 0.573. The full-frame mean is 0.0016. 2276 pixels change. `Scripts/test_exhaust.py` passed. `QuebecDrive.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: composition, still at 6. The walking socket stays. Particles can move again after this column is in. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The street shade is unchanged. The puffs use the same sun. |
| Color palette | 9 | The puffs are the existing white material. |
| Detail density | 9 | The street mesh is unchanged. The car in the picture is a stand-in box. |
| Texture and material quality | 9 | The asphalt mix is unchanged. |
| Composition and camera | 6 | The walking socket is unchanged. |
| Atmosphere | 9 | The street dust is unchanged. |
| Character models | 8 | No figure changed. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 7 | A running car leaves a rising column at the tail. The puffs are spheres, not a volume, and a parked car stays clear. |
| UI polish | 9 | The radar heading is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | The column is the new mark. No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One car, one column. Rain rings are unchanged. |
| Performance stability | 5 | `Scripts/test_exhaust.py` passed. Six spheres. Frame time was not remeasured. |

- Aesthetics raw: 78 / 10 dimensions, index 78
- Playability raw: 39 / 10 dimensions, index 39
- Total: 117 / 200
- Delta vs last round: +1

### Round 44 — 2026-10-21 — rubric v1

- What changed: on foot, the opening pitch is −16, inside the −25..−5 clamp. An unset pitch of 0 was landing on the upward stop at −5. Spawn, leaving a car, a respawn, and a side-job recovery on foot use that pitch. The walking socket, the clamps, the car's −12 possess pitch, and the drive look stay.
- Why it helped: Composition was at 6. The horizon sat near the middle of the frame, so the street ahead was a short slot between the walls.
- Screenshots: before `docs/gauntlet/gta-graphics/round-44/before-frame.png`, after `docs/gauntlet/gta-graphics/round-44/after-frame.png`. Crops are `before-road.png` and `after-road.png`. The before frame is pitch −5. The after frame is pitch −16. Both use the walking camera (arm 420, socket Y 70, socket Z 110, horizontal FOV 90) on the brick street, with a stand-in figure. Not an Unreal capture. On a 540-tall frame the horizon row moves from 227 to 131. The full-frame mean absolute delta is 0.074 and the max is 0.723. The far-street crop mean is 0.092 and the max is 0.497. The figure stays in frame. `Scripts/test_street_look.py` passed. `Scripts/test_camera_shoulder.py` passed. `QuebecGameplay.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: particles, tied with composition at 7. Leaves can still be shown without moving the rain displacement. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The street shade is unchanged. |
| Color palette | 9 | Brick, asphalt, and the figure use the existing colours. |
| Detail density | 9 | The street mesh is unchanged. |
| Texture and material quality | 9 | The asphalt mix is unchanged. |
| Composition and camera | 7 | The horizon sits higher and the street runs farther past the figure. It is still a spring arm on a stand-in figure. |
| Atmosphere | 9 | The street dust is unchanged. The sky wedge is smaller because the view tips down. |
| Character models | 8 | The figure is the same stand-in. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 7 | The tail column is unchanged. Rain rings are unchanged. |
| UI polish | 9 | The radar heading is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One street, one opening pitch. |
| Performance stability | 5 | `Scripts/test_street_look.py` passed. The pitch is a constant. Frame time was not remeasured. |

- Aesthetics raw: 79 / 10 dimensions, index 79
- Playability raw: 39 / 10 dimensions, index 39
- Total: 118 / 200
- Delta vs last round: +1

### Round 45 — 2026-10-21 — rubric v1

- What changed: the nearest tree within 18 m sheds ten autumn cards from the lower crown. A new card every 0.22 s lives 2.2 s, drifts across at 120 cm/s and down at 140 cm/s. Ten slots cover that life, so a card fades before its slot is reused. A farther tree stays still. The rain streak shader stays.
- Why it helped: Particles were at 7. The tail column is the only loose smoke, and a crown did not shed.
- Screenshots: before `docs/gauntlet/gta-graphics/round-45/before-frame.png`, after `docs/gauntlet/gta-graphics/round-45/after-frame.png`. Crops are `before-leaves.png` and `after-leaves.png`. Both use the opening walk camera (arm 420, socket Y 70, socket Z 110, pitch −16, horizontal FOV 90) with one sidewalk tree. Not an Unreal capture. The leaf crop mean absolute delta is 0.069 and the max is 0.350. The full-frame mean is 0.0037. 8193 pixels change. `Scripts/test_leaves.py` passed. `QuebecVegetation.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: composition, back to the lowest aesthetics score at 7. The opening pitch is in, and the socket stays. Animation smoothness stays at 3 and is skipped until a pose can be drawn.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The street shade is unchanged. |
| Color palette | 9 | The cards use the autumn leaf material. |
| Detail density | 9 | The street mesh is unchanged. The tree in the picture is a stand-in. |
| Texture and material quality | 9 | The asphalt mix is unchanged. |
| Composition and camera | 7 | The opening pitch is unchanged. |
| Atmosphere | 9 | The street dust is unchanged. |
| Character models | 8 | No figure changed. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 8 | Ochre cards leave the lower crown and drift down across the street. They are flat cards, not a canopy, and a distant tree stays still. |
| UI polish | 9 | The radar heading is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | The cards are the new mark. No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One tree, one drift. Rain rings are unchanged. |
| Performance stability | 5 | `Scripts/test_leaves.py` passed. Ten cards. Frame time was not remeasured. |

- Aesthetics raw: 80 / 10 dimensions, index 80
- Playability raw: 39 / 10 dimensions, index 39
- Total: 119 / 200
- Delta vs last round: +1

### Round 46 — 2026-10-21 — rubric v1

- What changed: on foot, the opening yaw aims at a point 18 m down the nearest avenue, a road at least 9 m wide within 25 m. At the park spawn that is about 110°, instead of the authored 77.5° that looks along the curb. The pitch stays −16. The walking socket stays. A respawn uses the same aim. Getting out of a car still uses the car's yaw. A narrower street does not count.
- Why it helped: Composition was at 7. From the sidewalk, a look parallel to Sherbrooke left the avenue as a sliver beside the lawn.
- Screenshots: before `docs/gauntlet/gta-graphics/round-46/before-frame.png`, after `docs/gauntlet/gta-graphics/round-46/after-frame.png`. Crops are `before-street.png` and `after-street.png`. The before yaw is the authored 77.5°. The after yaw is 110.1°. Both use the opening walk camera (arm 420, socket Y 70, socket Z 110, pitch −16, horizontal FOV 90) at the surveyed sidewalk spawn, with surveyed building footprints and a stand-in of the parked car. Not an Unreal capture. The street crop mean absolute delta is 0.082 and the max is 0.382. The full-frame mean is 0.044 and the max is 0.382. 139276 pixels change. The figure stays in frame. `Scripts/test_street_aim.py`, `Scripts/test_street_look.py`, and `Scripts/test_camera_shoulder.py` passed. `QuebecGameplay.cpp` and `QuebecCombat.cpp` were not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: animation smoothness, still at 3. A procedural sway can be drawn offline. The socket and the opening pitch stay.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The street shade is unchanged. |
| Color palette | 9 | Brick, asphalt, and the figure use the existing colours. The car in the picture is a stand-in box. |
| Detail density | 9 | The street mesh is unchanged. The buildings are surveyed footprints. |
| Texture and material quality | 9 | The asphalt mix is unchanged. |
| Composition and camera | 8 | The opening look turns toward the lane, so the avenue and the parked car sit in the frame. The foreground is still the park lawn, and the figure is still a spring arm. |
| Atmosphere | 9 | The street dust is unchanged. |
| Character models | 8 | The figure is the same stand-in. |
| Animation smoothness | 3 | Skipped. The blend space still cannot be posed here. |
| Particles and VFX | 8 | The leaf cards are unchanged. Rain rings are unchanged. |
| UI polish | 9 | The radar heading is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One avenue, one opening aim. |
| Performance stability | 5 | `Scripts/test_street_aim.py` passed. The aim is a loop over the road segments at spawn and respawn. Frame time was not remeasured. |

- Aesthetics raw: 81 / 10 dimensions, index 81
- Playability raw: 39 / 10 dimensions, index 39
- Total: 120 / 200
- Delta vs last round: +1

### Round 47 — 2026-10-21 — rubric v1

- What changed: on foot, when the crew anim instance is absent, the body rocks with an integrated phase and planar speed. A walk at 180 cm/s leans 12° and shifts 4 cm at the side peak. An idle is 0.34 of that. Starting or stopping does not snap the phase or the lean. The mesh keeps its yaw. A swim, a knockdown, a fall, a vehicle, and the crew blend space leave the mesh alone. The feet do not step.
- Why it helped: Animation smoothness was at 3. The blend space still cannot be posed, and the stand-in was rigid.
- Screenshots: before `docs/gauntlet/gta-graphics/round-47/before-frame.png`, after `docs/gauntlet/gta-graphics/round-47/after-frame.png`. Crops are `before-sway.png` and `after-sway.png`. The before frame is the rest pose. The after frame is the walk peak. Both use the opening walk camera (arm 420, socket Y 70, socket Z 110, pitch −16, yaw about 110°, horizontal FOV 90) at the surveyed sidewalk spawn. Not an Unreal capture. The figure crop mean absolute delta is 0.034 and the max is 0.319. The full-frame mean is 0.0020 and the max is 0.319. 7035 pixels change. `Scripts/test_sway.py` and `Scripts/test_street_aim.py` passed. `QuebecGameplay.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: animation smoothness, still the lowest aesthetics score at 4. The rock is in. A step needs a pose the blend space cannot give here.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The street shade is unchanged. |
| Color palette | 9 | The figure uses the same stand-in colours. |
| Detail density | 9 | The street mesh is unchanged. |
| Texture and material quality | 9 | The asphalt mix is unchanged. |
| Composition and camera | 8 | The opening aim is unchanged. |
| Atmosphere | 9 | The street dust is unchanged. |
| Character models | 8 | The figure is the same stand-in, leaned. |
| Animation smoothness | 4 | The body rocks to the side while walking, and the idle rock is smaller. The feet do not step. The crew blend space still cannot be posed here. |
| Particles and VFX | 8 | The leaf cards are unchanged. Rain rings are unchanged. |
| UI polish | 9 | The radar heading is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | The lean is the new mark. No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One rock, walk and idle. |
| Performance stability | 5 | `Scripts/test_sway.py` passed. The sway is one sine. Frame time was not remeasured. |

- Aesthetics raw: 82 / 10 dimensions, index 82
- Playability raw: 39 / 10 dimensions, index 39
- Total: 121 / 200
- Delta vs last round: +1

### Round 48 — 2026-10-21 — rubric v1

- What changed: when the crew body is missing and the casual skeleton, its idle, and its walk all load, the player mesh stays visible and plays that walk above a walk speed. Nearly still, it plays the idle. The body rock still leans the whole mesh. The static clothed stand remains the fallback when those clips are missing, and that stand does not step. A sprint has no casual run clip, so it keeps the walk. The opening pitch, the socket, and the sway amplitudes stay.
- Why it helped: Animation smoothness was at 4. The rock leaned the whole body, and the feet stayed together.
- Screenshots: before `docs/gauntlet/gta-graphics/round-48/before-frame.png`, after `docs/gauntlet/gta-graphics/round-48/after-frame.png`. Crops are `before-stride.png` and `after-stride.png`. The before frame is the casual idle, first key. The after frame is the walk at 0.75 s, where the foot centers are about 79 cm apart. Both use the opening walk camera (arm 420, socket Y 70, socket Z 110, pitch −16, yaw about 110°, horizontal FOV 90) at the surveyed sidewalk spawn, with the same walk-peak rock (12° and 4 cm). Not an Unreal capture. The figure crop mean absolute delta is 0.040 and the max is 0.393. The full-frame mean is 0.0021 and the max is 0.393. 5042 pixels change. One foot is ahead and the near arm swings back. `Scripts/test_stride.py`, `Scripts/test_player_stand.py`, and `Scripts/test_sway.py` passed. `QuebecGameplay.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: character models, tied at 8 with particles. Animation stays at 5. Another frame of this same walk will not move it. The crew blend space still cannot be posed.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The street shade is unchanged. |
| Color palette | 9 | The civilian uses the casual cloth colors. The street hues are unchanged. |
| Detail density | 9 | The street mesh is unchanged. |
| Texture and material quality | 9 | The asphalt mix is unchanged. |
| Composition and camera | 8 | The opening aim is unchanged. |
| Atmosphere | 9 | The street dust is unchanged. |
| Character models | 8 | The figure is the same casual civilian, now mid-stride. It is still one clothed mesh. |
| Animation smoothness | 5 | The feet take a stride and the near arm swings back. It is one walk clip on the missing-rig path, and the crew blend space still cannot be posed here. |
| Particles and VFX | 8 | The leaf cards are unchanged. Rain rings are unchanged. |
| UI polish | 9 | The radar heading is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | The stride is the new mark. No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One civilian, idle and walk. |
| Performance stability | 5 | `Scripts/test_stride.py` passed. The clip is the existing walk. Frame time was not remeasured. |

- Aesthetics raw: 83 / 10 dimensions, index 83
- Playability raw: 39 / 10 dimensions, index 39
- Total: 122 / 200
- Delta vs last round: +1

### Round 49 — 2026-10-21 — rubric v1

- What changed: on foot, faster than 80 cm/s, five pale spheres are born at the rear shoe. A new puff every 0.16 s lives 0.7 s, so a slot is free before it is reused. It drifts back, rises, and grows from a 12 cm radius, then fades. The walker leaves it behind. A slow step, a swim, a knockdown, a fall, and a vehicle do not birth one. The rain streak shader and the leaf slots stay.
- Why it helped: Particles were at 8. The leaf cards, the rain, and the tail column were already in, and a planted shoe left nothing.
- Screenshots: before `docs/gauntlet/gta-graphics/round-49/before-frame.png`, after `docs/gauntlet/gta-graphics/round-49/after-frame.png`. Crops are `before-scuff.png` and `after-scuff.png`. Both are the casual stride at 0.75 s. The after frame adds puffs aged 0.04, 0.20, 0.36, and 0.52 s, with the walker moving at 180 cm/s. Both use the opening walk camera (arm 420, socket Y 70, socket Z 110, pitch −16, yaw about 110°, horizontal FOV 90) at the surveyed sidewalk spawn, with the same walk-peak rock. Not an Unreal capture. The foot crop mean absolute delta is 0.080 and the max is 0.426. The full-frame mean is 0.00046 and the max is 0.426. 949 pixels change. `Scripts/test_scuff.py` and `Scripts/test_stride.py` passed. `QuebecGameplay.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: character models, tied at 8 with composition. Animation stays at 5. Another frame of the same walk will not move it. The crew blend space still cannot be posed.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The street shade is unchanged. |
| Color palette | 9 | The puffs use the existing white material. |
| Detail density | 9 | The street mesh is unchanged. |
| Texture and material quality | 9 | The asphalt mix is unchanged. |
| Composition and camera | 8 | The opening aim is unchanged. |
| Atmosphere | 9 | The street dust grade is unchanged. The puffs are spheres, not that grade. |
| Character models | 8 | The figure is the same casual civilian. |
| Animation smoothness | 5 | The stride is unchanged. The crew blend space still cannot be posed here. |
| Particles and VFX | 9 | A pale puff sits at the planted shoe and is left behind. The spheres are soft blobs, not a kicked sheet, and a standing walker stays clear. |
| UI polish | 9 | The radar heading is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | The puff is the new mark. No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One shoe, one trail. Rain rings and leaf cards are unchanged. |
| Performance stability | 5 | `Scripts/test_scuff.py` passed. Five spheres. Frame time was not remeasured. |

- Aesthetics raw: 84 / 10 dimensions, index 84
- Playability raw: 39 / 10 dimensions, index 39
- Total: 123 / 200
- Delta vs last round: +1

### Round 50 — 2026-10-21 — rubric v1

- What changed: when the crew body is missing and the hoodie skeleton, its idle, and its walk all load, the player mesh stays visible and plays that walk above a walk speed. Nearly still, it plays the idle. The imported cloth colours stay, so the hood, the sleeve cuffs, the hem, and the bare calves remain. A sprint has no hoodie run clip, so it keeps the walk. The casual walk remains when the hoodie assets are missing, and the static stand remains after that. The opening pitch, the socket, and the sway amplitudes stay. Goons still repaint their own copy of this mesh.
- Why it helped: Character models were at 8. From the opening camera the lead was the back of a flat t-shirt.
- Screenshots: before `docs/gauntlet/gta-graphics/round-50/before-frame.png`, after `docs/gauntlet/gta-graphics/round-50/after-frame.png`. Crops are `before-garment.png` and `after-garment.png`. Both are a walk at 0.75 s. The before frame is the casual body. The after frame is the hoodie. Both use the opening walk camera (arm 420, socket Y 70, socket Z 110, pitch −16, yaw about 110°, horizontal FOV 90) at the surveyed sidewalk spawn, with the same walk-peak rock (12° and 4 cm). Foot dust is left out of both frames. Not an Unreal capture. The figure crop mean absolute delta is 0.030 and the max is 0.396. The full-frame mean is 0.0011 and the max is 0.396. 4511 pixels change. The back shows a hood, sleeve cuffs, and a hem, and the calves are bare. `Scripts/test_garment.py`, `Scripts/test_stride.py`, and `Scripts/test_player_stand.py` passed. `QuebecGameplay.cpp` was not compiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: composition, the lowest aesthetics score that can still move. Animation stays at 5. Another frame of this walk will not move it. The crew blend space still cannot be posed.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The street shade is unchanged. |
| Color palette | 9 | The street hues are unchanged. The hoodie keeps its imported cloth colours. |
| Detail density | 9 | The street mesh is unchanged. |
| Texture and material quality | 9 | The asphalt mix is unchanged. |
| Composition and camera | 8 | The opening aim is unchanged. |
| Atmosphere | 9 | The street dust grade is unchanged. |
| Character models | 9 | The back of the figure has a hood, sleeve cuffs, and a hem, and the calves are bare. It is still one CC0 body. |
| Animation smoothness | 5 | The stride is the hoodie walk, the same kind of clip as before. The crew blend space still cannot be posed here. |
| Particles and VFX | 9 | The shoe puffs are unchanged. They are left out of these frames. |
| UI polish | 9 | The radar heading is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | The garment is the new mark. No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One lead outfit. The casual walk remains only when the hoodie is missing. |
| Performance stability | 5 | `Scripts/test_garment.py` passed. The mesh is the existing hoodie. Frame time was not remeasured. |

- Aesthetics raw: 85 / 10 dimensions, index 85
- Playability raw: 39 / 10 dimensions, index 39
- Total: 124 / 200
- Delta vs last round: +1

### Round 51 — 2026-10-21 — rubric v1

- What changed: the opening shade draws the park-inventory trees whose trunks are within 50 m of the spawn. A trunk centred at 0.32 of the tree height, 0.64 of the height long, matches the level builder. The crown is an ellipsoid from about 0.23 of the height to the top, in the inventory leaf colour. The level already instances the real crowns. Pitch, aim, socket, and the pawn stay. The player car stays the box.
- Why it helped: Composition was at 8. The opening shade was an empty lawn, so the avenue had nothing in front of it.
- Screenshots: before `docs/gauntlet/gta-graphics/round-51/before-frame.png`, after `docs/gauntlet/gta-graphics/round-51/after-frame.png`. Crops of the avenue band are `before-grove.png` and `after-grove.png`. Both use the opening walk camera (arm 420, socket Y 70, socket Z 110, pitch −16, yaw about 110°, horizontal FOV 90) at the surveyed sidewalk spawn, with the hoodie walk at 0.75 s and the same walk-peak rock. Foot dust is left out. Not an Unreal capture. The full-frame mean absolute delta is 0.040 and the max is 0.400. 94655 pixels change. A foreground trunk stands in the middle of the avenue, and crowns sit on both sides. The figure stays in the lower lawn. `Scripts/test_opening_grove.py` passed. The vegetation actor was not recompiled. `GET /gta/` returned 200. OpenSpec CLI is not installed, so the change files were not validated with `openspec`.
- Next target: the player car. The box on the right of this frame is still a stand-in. Animation stays at 5.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 9 | The street shade is unchanged. |
| Color palette | 9 | The crowns use the existing leaf colours. The street hues are unchanged. |
| Detail density | 9 | The street mesh is unchanged. The crowns are simple volumes. |
| Texture and material quality | 9 | The asphalt mix is unchanged. |
| Composition and camera | 9 | A foreground trunk and a row of crowns frame the avenue. The lawn in front of the figure is still open. |
| Atmosphere | 9 | The street dust grade is unchanged. |
| Character models | 9 | The hoodie is unchanged. |
| Animation smoothness | 5 | The stride is unchanged. The crew blend space still cannot be posed here. |
| Particles and VFX | 9 | The shoe puffs are unchanged. They are left out of these frames. |
| UI polish | 9 | The radar heading is unchanged. |
| Responsiveness and input latency | 4 | Not measured this round. |
| Controls feel | 4 | Not played. |
| Mission clarity | 5 | The objective words are unchanged. |
| Pacing | 4 | Unchanged mission slice. |
| Fun factor | 3 | Not played. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | The trees are the new mark. No new juice. |
| Sound design | 3 | Not listened to. |
| Variety | 3 | One grove in this frame. The rest of the inventory stays where it was. |
| Performance stability | 5 | `Scripts/test_opening_grove.py` passed. Thirty-one nearby trees. Frame time was not remeasured. |

- Aesthetics raw: 86 / 10 dimensions, index 86
- Playability raw: 39 / 10 dimensions, index 39
- Total: 125 / 200
- Delta vs last round: +1
