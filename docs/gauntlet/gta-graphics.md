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
