# Full Swing graphics gauntlet

Reference: Marvel's Spider-Man 2 (Insomniac, 2023). Rubric: `docs/gauntlet/RUBRIC.md` v1. Original assets only. This file is the Full Swing graphics scorecard (Vaughn's path). The rubric's template also mentions `docs/gauntlet/full-swing.md`; that name is not this loop's file.

### Round 1 — 2026-10-21 — rubric v1

- What changed: Streets, alleys, and the expressway deck darken in puddles and mirror this game's own sky, with a warm sun streak on lit asphalt and a small warm fill in shade. Sidewalks, parks, medians, and the boardwalk stay matte. Lane paint stays bright. Ink draws on top.
- Why it helped: The street view's ground was one flat violet. A low sun now shows up in the avenue, which is the first thing that makes Spider-Man 2's streets read as wet.
- Screenshots: before `docs/gauntlet/shots/r01-before-street.png`, after `docs/gauntlet/shots/r01-after-street.png`. Also canyon, harbour, and needle: `docs/gauntlet/shots/r01-before-canyon.png`, `docs/gauntlet/shots/r01-after-canyon.png`, `docs/gauntlet/shots/r01-before-harbour.png`, `docs/gauntlet/shots/r01-after-harbour.png`, `docs/gauntlet/shots/r01-before-needle.png`, `docs/gauntlet/shots/r01-after-needle.png`.
- Next target: Particles and VFX (tied at 3 with Character models). Light in the air is the gap these city views still show.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 4 | The avenue takes a sun streak and a little shade fill. Walls are still three flat bands with no bounce. |
| Color palette | 5 | The sunset inks are coherent and saturated, and still posterized next to Spider-Man 2's grade. |
| Detail density | 4 | Windows, lanes, trees, and traffic are there. Surfaces repeat, and the street is thin on props. |
| Texture and material quality | 4 | Roads have puddles, darkening, and a sky mirror. Glass, brick, and concrete are still flat colors. |
| Composition and camera | 4 | The four views read clearly. They are fixed cameras, not a swinging shot. |
| Atmosphere | 4 | The painted sky and height fog hold the hour. The fog is still stepped, with no light in the air. |
| Character models | 3 | Named shots hide the hero. People on the street read as small comic figures. |
| Animation smoothness | 4 | These are stills. Motion in play is the existing comic step, not a captured swing. |
| Particles and VFX | 3 | Bloom and the print pass exist. No shafts, spray, or debris in these views. |
| UI polish | 4 | The shots hide the page. The comic HUD was not part of this pass. |
| Responsiveness and input latency | 6 | The city draws in the same call counts as before. No input timing was measured. |
| Controls feel | 5 | Swing and flat controls are unchanged, and they are not Spider-Man 2's web swing. |
| Mission clarity | 4 | Missions were not played this round. |
| Pacing | 4 | Unchanged, and not judged from a full run. |
| Fun factor | 4 | Not played as a session. The swing itself was not retimed. |
| Difficulty curve | 4 | Unchanged, and not played. |
| Feedback | 5 | Hit flashes, sound words, and shake are already in flat play. This pass did not add any. |
| Sound design | 4 | Procedural Web Audio only. Nothing new, and not listened to against the reference. |
| Variety | 4 | One city, several districts and jobs. No new activity. |
| Performance stability | 6 | Street, canyon, harbour, and needle all drew with no shader error. Draw counts did not rise. |

- Aesthetics raw: 39 / 10 dimensions, index 39
- Playability raw: 46 / 10 dimensions, index 46
- Total: 85 / 200
- Delta vs last round: baseline, no prior card

Playability was scored from a flat boot and the city render check, not a full playthrough. `qa/vr/render.mjs` passed, including flat play. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 2 — 2026-10-21 — rubric v1

- What changed: Flat play adds a short radial gather of the far warm sky toward the sun. Near buildings block it. The painted sky itself is left alone, and the added light is capped. A headset still draws the scene straight. The source is Kenny Mitchell, GPU Gems 3, chapter 13.
- Why it helped: The skyline had a sun in the paint and none in the air. With the sun in front of the camera, the tower and the roofs now catch a warm streak that stops on the geometry.
- Screenshots: before `docs/gauntlet/shots/r02-before-needle.png`, after `docs/gauntlet/shots/r02-after-needle.png`. The before frame is the round 1 needle view. Street and harbour look away from the sun, so they do not run the pass.
- Next target: Character models (3), the lowest aesthetics score.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | The avenue still carries the sun, and a shaft now falls on the tower when the sun is in front. Walls are still flat bands. |
| Color palette | 5 | Unchanged. The sunset inks hold, and the shaft is capped so it does not wash them. |
| Detail density | 4 | Unchanged. The city is still thin on props. |
| Texture and material quality | 4 | Unchanged. Roads are wet. Glass and brick are still flat colors. |
| Composition and camera | 4 | Unchanged. Fixed cameras. The shaft reads in the needle view. |
| Atmosphere | 4 | The shaft is a first bit of light in the air. Fog is still stepped, and there is no weather. |
| Character models | 3 | Unchanged. Named shots hide the hero. People stay small comic figures. |
| Animation smoothness | 4 | Unchanged. Stills only. |
| Particles and VFX | 4 | One occluded sun shaft on flat views. No spray, debris, or weather. |
| UI polish | 4 | Unchanged. The HUD was not part of this pass. |
| Responsiveness and input latency | 6 | Unchanged. The shaft is one full-screen gather. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play. Reported scene draw counts did not rise. |

- Aesthetics raw: 41 / 10 dimensions, index 41
- Playability raw: 46 / 10 dimensions, index 46
- Total: 87 / 200
- Delta vs last round: +2 (85 → 87). Lighting 4 → 5, particles and VFX 3 → 4. Playability unchanged.

### Round 3 — 2026-10-21 — rubric v1

- What changed: A street figure keeps one instanced mesh and the same limb pivots, and now has a neck, a hair mass, shoulders wider than the waist, a chest, and a waist in the trouser colour. The hero and the crowd add a small warm rim on the sun side and a cool rim in shade, after the cel bands. The ink hull stays flat ink. The source for the rim is Jason Mitchell, Moby Francke, and Dhabih Eng, "Illustrative Rendering in Team Fortress 2" (2007).
- Why it helped: The people were six boxes, and the hero was a flat cel cutout. A shoulder line, hair, and an edge light are what make a comic figure read as a person against this sunset. They are still boxes, not Spider-Man 2's people.
- Screenshots: before `docs/gauntlet/shots/r03-before-chase.png`, `docs/gauntlet/shots/r03-before-crowd.png`, `docs/gauntlet/shots/r03-before-person.png`. After `docs/gauntlet/shots/r03-after-chase.png`, `docs/gauntlet/shots/r03-after-crowd.png`, `docs/gauntlet/shots/r03-after-person.png`. Named cameras hide the hero, so these are flat play on the Market sidewalk.
- Next target: Texture and material quality (4), tied with several others. Glass and brick are still flat colours, which is the gap these street views still show.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | The avenue and the shaft are unchanged. Figures now take a small rim. Walls are still flat bands. |
| Color palette | 5 | Unchanged. The sunset inks hold, and the rim stays inside them. |
| Detail density | 4 | Unchanged. The city is still thin on props. |
| Texture and material quality | 4 | Unchanged. Roads are wet. Glass and brick are still flat colours. |
| Composition and camera | 4 | Unchanged. The proof frames are a chase view and a close pedestrian, not a swinging shot. |
| Atmosphere | 4 | Unchanged. One shaft, stepped fog, no weather. |
| Character models | 4 | The crowd has hair, a neck, and shoulders, and the hero's edge catches the sun. Both are still simple next to Spider-Man 2. |
| Animation smoothness | 4 | Unchanged. Stills only. The poses still drive the same pivots. |
| Particles and VFX | 4 | Unchanged. One occluded sun shaft. No spray or debris. |
| UI polish | 4 | Unchanged. The HUD was hidden for the shots. |
| Responsiveness and input latency | 6 | Unchanged. The crowd is still two draws. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play and the lit-sphere cel check. The pedestrian frame stayed inside the draw budget. |

- Aesthetics raw: 42 / 10 dimensions, index 42
- Playability raw: 46 / 10 dimensions, index 46
- Total: 88 / 200
- Delta vs last round: +1 (87 → 88). Character models 3 → 4. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 4 — 2026-10-21 — rubric v1

- What changed: Brick, stone, concrete, and loft walls get a darkened masonry joint that fades out once a course is smaller than a pixel. Glass towers are left plain between the windows. On those towers the sky mix follows a Schlick fresnel (1994): less sky head-on, more where the view skims the pane, with a small sun glint. Lit rooms stay lamps. No brick paper fit a three-band comic wall, so the joint is original.
- Why it helped: The near wall in the street view was one flat violet. Courses make it read as masonry. The avenue looks north, away from the sun, so the glass fresnel barely shows in that frame. The towers still carry the sky mix.
- Screenshots: before `docs/gauntlet/shots/r04-before-street.png`, after `docs/gauntlet/shots/r04-after-street.png`. Also the needle, where the sun is in front and the courses are far: `docs/gauntlet/shots/r04-before-needle.png`, `docs/gauntlet/shots/r04-after-needle.png`.
- Next target: Detail density (4), tied with several others. The street is still thin on props, which is the gap these views still show once the walls have a joint.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. The glint is a glass edge, not a new city light. |
| Color palette | 5 | Unchanged. The joints sit in the existing inks. |
| Detail density | 4 | Unchanged. The city is still thin on props. |
| Texture and material quality | 5 | Near walls show masonry courses. Tower glass takes a fresnel. Both are still comic bands, not Spider-Man 2 materials. |
| Composition and camera | 4 | Unchanged. Fixed cameras. The courses read in the street view. |
| Atmosphere | 4 | Unchanged. One shaft, stepped fog, no weather. |
| Character models | 4 | Unchanged. Hair, shoulders, and a rim from round 3. |
| Animation smoothness | 4 | Unchanged. Stills only. |
| Particles and VFX | 4 | Unchanged. One occluded sun shaft. |
| UI polish | 4 | Unchanged. The shots hide the page. |
| Responsiveness and input latency | 6 | Unchanged. The joints are arithmetic in the wall shader. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play. Street and needle means stayed in band. |

- Aesthetics raw: 43 / 10 dimensions, index 43
- Playability raw: 46 / 10 dimensions, index 46
- Total: 89 / 200
- Delta vs last round: +1 (88 → 89). Texture and material quality 4 → 5. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

