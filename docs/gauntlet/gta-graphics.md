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
