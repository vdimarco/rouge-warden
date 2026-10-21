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
