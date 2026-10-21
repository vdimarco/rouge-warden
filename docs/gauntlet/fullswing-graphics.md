# Full Swing graphics gauntlet

Reference: Marvel's Spider-Man 2 (Insomniac, 2023). Original assets only. Scores are 0 to 10 against that game's look and feel, not against an earlier build of this one.

Rubric: Vaughn's 20-dimension card (`v1`, 2026-10-21). `docs/gauntlet/RUBRIC.md` was not on main when round 1 was scored. Aesthetics index = (aesthetics sum / 100) × 100. Playability index = (playability sum / 100) × 100. Total = aesthetics index + playability index, max 200.

## Round 1 — 2026-10-21 — rubric v1

**What changed.** Streets, alleys, and the expressway deck now behave like wet asphalt. The road darkens in puddles, mirrors this game's own sky (stronger down the avenue), and picks up a warm sun streak where the low sun hits it. Shaded road gets a small warm fill. Sidewalks, parks, medians, and the boardwalk stay matte. Lane paint is left bright. Ink draws on top.

**Why it helped.** In the street view the ground was one flat violet. Spider-Man 2 reads as a city first because the avenue carries the sun. A grazing view now shows that light in the road without a new texture or a copied reflection.

**Screenshots.** 1280×720, named cameras, HUD hidden, comic art loaded.

| View | Before | After |
| --- | --- | --- |
| Street | `docs/gauntlet/shots/r01-before-street.png` | `docs/gauntlet/shots/r01-after-street.png` |
| Canyon | `docs/gauntlet/shots/r01-before-canyon.png` | `docs/gauntlet/shots/r01-after-canyon.png` |
| Harbour | `docs/gauntlet/shots/r01-before-harbour.png` | `docs/gauntlet/shots/r01-after-harbour.png` |
| Needle | `docs/gauntlet/shots/r01-before-needle.png` | `docs/gauntlet/shots/r01-after-needle.png` |

**Aesthetics** (sum 39 / 10 dimensions, index 39)

| Dimension | Score | Reason |
| --- | ---: | --- |
| Lighting | 4 | The avenue now takes a sun streak and a little shade fill. Walls are still three flat bands with no bounce. |
| Color palette | 5 | The sunset inks are coherent and saturated, and still posterized next to Spider-Man 2's grade. |
| Detail density | 4 | Windows, lanes, trees, and traffic are there. Surfaces repeat, and the street is still thin on props. |
| Texture / material quality | 4 | Roads have puddles, darkening, and a sky mirror. Glass, brick, and concrete are still flat colors. |
| Composition and camera | 4 | The four views read clearly. They are fixed cameras, not a swinging shot. |
| Atmosphere | 4 | The painted sky and height fog hold the hour. The fog is still stepped, with no light in the air. |
| Character models | 3 | Named shots hide the hero. People on the street read as small comic figures. |
| Animation smoothness | 4 | These are stills. Motion in play is the existing comic step, not a captured swing. |
| Particles and VFX | 3 | Bloom and the print pass exist. No shafts, spray, or debris in these views. |
| UI polish | 4 | The shots hide the page. The comic HUD was not part of this pass. |

**Playability** (sum 46 / 10 dimensions, index 46). This round did not change controls or missions. Scores are from a flat boot and the existing game, not a full playthrough.

| Dimension | Score | Reason |
| --- | ---: | --- |
| Responsiveness / input latency | 6 | The city draws in the same call counts as before. No input timing was measured. |
| Controls feel | 5 | Swing and flat controls are unchanged, and they are not Spider-Man 2's web swing. |
| Mission clarity | 4 | Missions were not played this round. |
| Pacing | 4 | Unchanged, and not judged from a full run. |
| Fun factor | 4 | Not played as a session. The city is the toy; the swing itself was not retimed. |
| Difficulty curve | 4 | Unchanged, and not played. |
| Feedback / juice | 5 | Hit flashes, sound words, and shake are already in flat play. This pass did not add any. |
| Sound design | 4 | Procedural Web Audio only. Nothing new, and not listened to against the reference. |
| Variety | 4 | One city, several districts and jobs. No new activity. |
| Performance stability | 6 | Street, canyon, harbour, and needle all drew with no shader error. Draw counts did not rise. |

**Indexes.** Aesthetics 39 (raw 39 / 10). Playability 46 (raw 46 / 10). **Total 85 / 200.** Delta vs last round: baseline, no prior card.

**Next target.** Particles and VFX, tied at 3 with character models. Light in the air (a sun shaft, a bit of window spill) is the gap these four views still show. Character models stay a tied debt.
