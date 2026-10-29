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

### Round 5 — 2026-10-21 — rubric v1

- What changed: Sidewalks get one instanced mesh of bins, bollards, and hydrants, one kind per spot, on both walks and off the carriageway. They fade out between 70 m and 110 m. The bollard's pale band is painted after the cel bands, or the three tones swallow it. Parks, the Needle plaza, and the Dome stay clear. No colliders and no extra full-screen pass. No city-dressing paper fit a three-band comic street, so the shapes are original boxes on the prop draw already in the city view.
- Why it helped: The avenue had lanes, trees, and lamps, and the walks were empty. A bin, a striped post, and a hydrant in the near block are the first street furniture, which is what makes Spider-Man 2's sidewalks read as a city. They are still a few simple shapes.
- Screenshots: before `docs/gauntlet/shots/r05-before-street.png`, after `docs/gauntlet/shots/r05-after-street.png`. The needle is effectively unchanged, because the furniture has faded out by that distance: `docs/gauntlet/shots/r05-before-needle.png`, `docs/gauntlet/shots/r05-after-needle.png`.
- Next target: Atmosphere (4), tied with composition, character models, animation, particles and VFX, and UI. The street and needle still show stepped fog and no weather, which is the gap these views still show once the walks have furniture.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. The posts take the same three bands. |
| Color palette | 5 | Unchanged. The bin, stripe, and hydrant sit in the existing inks. |
| Detail density | 5 | The near sidewalk shows a bollard, and bins and hydrants recur down the walks. Still sparse next to Spider-Man 2. |
| Texture and material quality | 5 | Unchanged. Courses and fresnel from round 4. The new props are flat comic colours. |
| Composition and camera | 4 | Unchanged. Fixed cameras. The furniture sits in the street frame. |
| Atmosphere | 4 | Unchanged. One shaft, stepped fog, no weather. |
| Character models | 4 | Unchanged. Hair, shoulders, and a rim from round 3. |
| Animation smoothness | 4 | Unchanged. Stills only. |
| Particles and VFX | 4 | Unchanged. One occluded sun shaft. |
| UI polish | 4 | Unchanged. The shots hide the page. |
| Responsiveness and input latency | 6 | Unchanged. One extra instanced draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play and the lit-sphere cel check. The street frame went from 53 draws to 54. Street mean stayed in band. |

- Aesthetics raw: 44 / 10 dimensions, index 44
- Playability raw: 46 / 10 dimensions, index 46
- Total: 90 / 200
- Delta vs last round: +1 (89 → 90). Detail density 4 → 5. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 6 — 2026-10-21 — rubric v1

- What changed: The height fog keeps its 110 m layer and gains a second layer with an 18 m scale height. It starts past 28 m, sits on the walks and the lower floors, and thins out by the roofs. The four print steps still snap the amount. The colour is still this game's sky haze. The same integral is in the short prop kit. The split follows Carsten Wenzel, "Real-Time Atmospheric Effects in Games" (SIGGRAPH 2006 course): only the denser air near the ground, not the scattering shader.
- Why it helped: The avenue was sharp from the kerb to the far crossing, because the thin veil never crossed a print step. The lower floors down the block now sit in air, and the near bollard stays crisp. The needle is high enough that this layer does not reach it.
- Screenshots: before `docs/gauntlet/shots/r06-before-street.png`, after `docs/gauntlet/shots/r06-after-street.png`. Needle, unchanged at this height: `docs/gauntlet/shots/r06-before-needle.png`, `docs/gauntlet/shots/r06-after-needle.png`.
- Next target: Composition and camera (4), tied with character models, animation smoothness, particles and VFX, and UI. The views are still fixed cameras, which is the gap these frames still show once the avenue has air.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. The haze uses the existing sky colour. |
| Color palette | 5 | Unchanged. The veil is the dusk violet already in the sky. |
| Detail density | 5 | Unchanged. Bins, bollards, and hydrants from round 5. |
| Texture and material quality | 5 | Unchanged. Courses and fresnel from round 4. |
| Composition and camera | 4 | Unchanged. Fixed cameras. The haze sits in the street frame. |
| Atmosphere | 5 | The lower avenue carries a haze the near kerb and the roofs do not. Fog is still four steps, and there is no weather. |
| Character models | 4 | Unchanged. Hair, shoulders, and a rim from round 3. |
| Animation smoothness | 4 | Unchanged. Stills only. |
| Particles and VFX | 4 | Unchanged. One occluded sun shaft. The haze is fog, not particles. |
| UI polish | 4 | Unchanged. The shots hide the page. |
| Responsiveness and input latency | 6 | Unchanged. The layer is a few arithmetic ops in the fog both shaders already run. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play and the lit-sphere cel check. Street draws stayed at 54. Street mean moved from 53 to 54. |

- Aesthetics raw: 45 / 10 dimensions, index 45
- Playability raw: 46 / 10 dimensions, index 46
- Total: 91 / 200
- Delta vs last round: +1 (90 → 91). Atmosphere 4 → 5. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 7 — 2026-10-21 — rubric v1

- What changed: In third-person flat play the chase camera slides 0.95 m onto the hero's right and 0.22 m up. The arm stays 4.5 m and the pitch stays 20 degrees down. The slide scales away in first person, fades once the camera is already down by the head, and stops short of a wall. The look direction is unchanged. The source is Mark Haigh-Hutchinson, Real-Time Cameras (2009): lead room and an off-centre subject, only the offset.
- Why it helped: Standing in the avenue, the hero sat on the vanishing point. The jacket now sits about 100 pixels left of centre in a 1280-wide frame, and the street ahead holds the middle. It is still one chase camera, not a swinging shot.
- Screenshots: before `docs/gauntlet/shots/r07-before-play.png`, after `docs/gauntlet/shots/r07-after-play.png`. These are play frames, with the hero standing in the avenue. Named cameras hide the hero, so they do not show this.
- Next target: Particles and VFX (4), tied with character models, animation smoothness, and UI. The avenue has haze and one sun shaft, and no weather or debris a player sees while standing in it.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. The shaft and the wet avenue are as in rounds 2 and 1. |
| Color palette | 5 | Unchanged. The sunset inks hold. |
| Detail density | 5 | Unchanged. Bins, bollards, and hydrants from round 5. |
| Texture and material quality | 5 | Unchanged. Courses and fresnel from round 4. |
| Composition and camera | 5 | The chase view puts the hero left of centre and leaves the avenue in the middle. Pitch and arm length stay the chase defaults. It is still one camera, not a swing. |
| Atmosphere | 5 | Unchanged. The 18 m haze from round 6. |
| Character models | 4 | Unchanged. Hair, shoulders, and a rim from round 3. The play frame shows the same figure. |
| Animation smoothness | 4 | Unchanged. The shot is a settled idle. The slide is a still offset, not a motion. |
| Particles and VFX | 4 | Unchanged. One occluded sun shaft. No weather or debris in the avenue. |
| UI polish | 4 | Unchanged. The play frame shows the existing comic HUD. |
| Responsiveness and input latency | 6 | Unchanged. The slide is a few metres of arithmetic after the arm. No input timing was measured. |
| Controls feel | 5 | The centre ray moves with the camera, about a metre to the right. Not played as a session. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play and the lit-sphere cel check. Street mean 65.4. Reported chase distance stayed 4.5 m and pitch stayed −0.349. |

- Aesthetics raw: 46 / 10 dimensions, index 46
- Playability raw: 46 / 10 dimensions, index 46
- Total: 92 / 200
- Delta vs last round: +1 (91 → 92). Composition and camera 4 → 5. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 8 — 2026-10-21 — rubric v1

- What changed: Grates on both sidewalks put up comic steam. Each grate has two puffs, half a loop apart, so a still always has one rising. They drift up about 3.6 m, grow as they age, shrink away inside 8 m and past 70 m, and thin out in the existing haze. One extra city draw. No full-screen pass. The loop follows William T. Reeves, "Particle Systems — a Technique for Modeling a Class of Fuzzy Objects" (SIGGRAPH 1983). The puff is the lumpy cel cloud this game already uses, not Reeves's fuzzy shading.
- Why it helped: The avenue had haze and one sun shaft, and nothing moving in the air. Cream puffs with an ink edge now rise off the walks in the street view. They are a few grates, not weather.
- Screenshots: before `docs/gauntlet/shots/r08-before-street.png`, after `docs/gauntlet/shots/r08-after-street.png`. Play frame, with the round 7 chase offset still in place: `docs/gauntlet/shots/r08-after-play.png`.
- Next target: Character models (4), tied with animation smoothness and UI. The play frame still shows a blocky figure.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. The steam uses the existing cel bands. |
| Color palette | 5 | Unchanged. The puffs are warm cream in the dusk violet. |
| Detail density | 5 | Unchanged. Bins, bollards, and hydrants from round 5. The grates add puffs, not more props. |
| Texture and material quality | 5 | Unchanged. Courses and fresnel from round 4. |
| Composition and camera | 5 | Unchanged. The chase offset from round 7. Reported distance stayed 4.5 m and pitch stayed −0.349. |
| Atmosphere | 5 | Unchanged. The 18 m haze from round 6. The puffs sit in it. |
| Character models | 4 | Unchanged. Hair, shoulders, and a rim from round 3. |
| Animation smoothness | 4 | Unchanged. The shot is a still. The puffs loop, and that motion was not filmed. |
| Particles and VFX | 5 | Cream puffs with an ink edge rise from the sidewalks in the street view. One sun shaft remains. There is no weather. |
| UI polish | 4 | Unchanged. The play frame shows the existing comic HUD. |
| Responsiveness and input latency | 6 | Unchanged. One instanced draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play and the lit-sphere cel check. Street mean stayed 65.4. The street shot drew 55 calls, one more than round 7. |

- Aesthetics raw: 47 / 10 dimensions, index 47
- Playability raw: 46 / 10 dimensions, index 46
- Total: 93 / 200
- Delta vs last round: +1 (92 → 93). Particles and VFX 4 → 5. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 9 — 2026-10-21 — rubric v1

- What changed: The hero keeps 30 percent of the painted colour map under the cel bands, and samples that map one mip sharper. A hair crown, a brow fringe, and a light collar follow the head bone, in metres, as one extra mesh plus its ink hull. The skinned crew mesh stays at 12,468 triangles. The forms hide once the close fade drops below 0.9. The paint mix follows Jason Mitchell, Moby Francke, and Dhabih Eng, "Illustrative Rendering in Team Fortress 2" (2007). The hair and collar are original forms.
- Why it helped: At chase distance the painted face was one red block. The head now carries a dark hair mass and a collar, and a close view still shows the eyes, the zipper, and the shoes. It is still a comic figure, not Spider-Man 2's hero.
- Screenshots: before `docs/gauntlet/shots/r09-before-play.png`, after `docs/gauntlet/shots/r09-after-play.png`. Close portraits: `docs/gauntlet/shots/r09-before-close.png`, `docs/gauntlet/shots/r09-after-close.png`.
- Next target: Animation smoothness (4), tied with UI polish. The idle is still a small sway, and a still cannot show a step.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. The forms use the existing cel bands. |
| Color palette | 5 | Unchanged. Hair is the dark brown already on the fallback figure. The collar is the existing cream. |
| Detail density | 5 | Unchanged. Bins, bollards, and hydrants from round 5. |
| Texture and material quality | 5 | Unchanged. Courses and fresnel from round 4. The hero map is sharper, and the city materials are the same. |
| Composition and camera | 5 | Unchanged. The chase offset from round 7. Reported distance stayed 4.5 m and pitch stayed −0.349. |
| Atmosphere | 5 | Unchanged. The 18 m haze from round 6. |
| Character models | 5 | The chase head has a dark hair mass and a light collar. A close view still shows the painted face. The body is still a block. |
| Animation smoothness | 4 | Unchanged. The shot is a still of the idle pose. |
| Particles and VFX | 5 | Unchanged. Sidewalk steam from round 8. |
| UI polish | 4 | Unchanged. The play frame shows the existing comic HUD. |
| Responsiveness and input latency | 6 | Unchanged. The hero stays at four draws. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play and the lit-sphere cel check. Street mean stayed 65.4. Hero draws stayed at 4. Skinned triangles stayed at 12,468. |

- Aesthetics raw: 48 / 10 dimensions, index 48
- Playability raw: 46 / 10 dimensions, index 46
- Total: 94 / 200
- Delta vs last round: +1 (93 → 94). Character models 4 → 5. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 10 — 2026-10-21 — rubric v1

- What changed: The hair and the collar arrive after the head. The turn eases more slowly than the look, and while it is behind the hair shifts up to 12 cm along the head's right. A teleport snaps it back onto the skull. At rest it sits on the head again. The source is John Lasseter, "Principles of Traditional Animation Applied to 3D Computer Animation" (SIGGRAPH 1987), the follow-through principle only.
- Why it helped: A yaw of the view used to swing the hair on the same frame as the skull. Five frames into a yaw it is now 8 degrees behind, so the crown and the collar still face the old direction. It is one mesh, not cloth, and the body is still a block.
- Screenshots: before `docs/gauntlet/shots/r10-before-play.png`, after `docs/gauntlet/shots/r10-after-play.png`. Close portraits of the same moment: `docs/gauntlet/shots/r10-before-close.png`, `docs/gauntlet/shots/r10-after-close.png`.
- Next target: UI polish (4). It is the only aesthetics score still at 4.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. |
| Color palette | 5 | Unchanged. |
| Detail density | 5 | Unchanged. |
| Texture and material quality | 5 | Unchanged. |
| Composition and camera | 5 | Unchanged. Reported distance stayed 4.5 m and pitch stayed −0.349. The shot yaws the view on purpose. |
| Atmosphere | 5 | Unchanged. |
| Character models | 5 | Unchanged. The hair mass and collar from round 9. |
| Animation smoothness | 5 | Five frames into a yaw the hair is 8 degrees behind the head, with a short sideways drag. At rest it sits on the skull. There is still no cloth and no filmed run. |
| Particles and VFX | 5 | Unchanged. Sidewalk steam from round 8. |
| UI polish | 4 | Unchanged. The play frame shows the existing comic HUD. |
| Responsiveness and input latency | 6 | Unchanged. No new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. The look still aims the head. The hair only follows it. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play and the lit-sphere cel check. Street mean 65.5. Skinned triangles stayed at 12,468. |

- Aesthetics raw: 49 / 10 dimensions, index 49
- Playability raw: 46 / 10 dimensions, index 46
- Total: 95 / 200
- Delta vs last round: +1 (94 → 95). Animation smoothness 4 → 5. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 11 — 2026-10-21 — rubric v1

- What changed: The chase score row sits on one paper plate with the pause menu's magenta dot field. Each sticker takes the same print. The coin has a lit face, the clog has a lit face, and the compass arrow sits on a cream dial with an ink ring. The row's box is unchanged, so the spoken line and the lock arrow keep their gap. The source is the menu's own dot field in this game, which copies Benjamin Day's mechanical tint (1879).
- Why it helped: The mission, the loonies, the clogs, and the compass were four flat stickers on the sky. They now read as one printed instrument. It is still a comic sticker row, not Spider-Man 2's HUD.
- Screenshots: before `docs/gauntlet/shots/r11-before-play.png`, after `docs/gauntlet/shots/r11-after-play.png`. The top of those frames is the row: `docs/gauntlet/shots/r11-before-play-top.png`, `docs/gauntlet/shots/r11-after-play-top.png`.
- Next target: Lighting (5), tied with the other aesthetics scores. The avenue has a sun streak and a shaft. The walls are still flat bands.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Unchanged. The avenue still carries the sun, and a shaft still falls when the sun is in front. Walls are still flat bands. |
| Color palette | 5 | Unchanged. The sunset inks hold. The plate uses the menu's magenta dots. |
| Detail density | 5 | Unchanged. |
| Texture and material quality | 5 | Unchanged. |
| Composition and camera | 5 | Unchanged. Reported distance stayed 4.5 m and pitch stayed −0.349. |
| Atmosphere | 5 | Unchanged. |
| Character models | 5 | Unchanged. Skinned triangles stayed at 12,468. |
| Animation smoothness | 5 | Unchanged. The hair still follows through a turn. |
| Particles and VFX | 5 | Unchanged. Sidewalk steam from round 8. |
| UI polish | 5 | The chase row is one dotted plate. The coin has a face and the compass arrow sits on a dial. It is still a flat sticker, not a dimensional HUD. |
| Responsiveness and input latency | 6 | Unchanged. CSS only. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. The mission line is the same words, printed with the scores. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play and the lit-sphere cel check. Street mean stayed 65.4. The row box stayed 12–57 px at 1280×720. The plate stayed inside the window at 640×360, 360×740, and 844×390. |

- Aesthetics raw: 50 / 10 dimensions, index 50
- Playability raw: 46 / 10 dimensions, index 46
- Total: 96 / 200
- Delta vs last round: +1 (95 → 96). UI polish 4 → 5. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 12 — 2026-10-21 — rubric v1

- What changed: Shaded wall under the street air takes a warm multiply. The lit band stays the sun, and a lit window keeps its own light. The warm tone is full at 8 m and gone by 20 m, so the lower floors change and the roofs stay the cold cel. The height is the 18 m street layer already in this shader, from Carsten Wenzel, SIGGRAPH 2006, the height only. No global-illumination pass was added.
- Why it helped: The chase view looks away from the sun, and the piers beside the avenue were the cold blue shade. They now read as wall that the street is lighting. The upper floors stay cold, so the building still has the three cel bands.
- Screenshots: before `docs/gauntlet/shots/r12-before-play.png`, after `docs/gauntlet/shots/r12-after-play.png`. The shaded pier: `docs/gauntlet/shots/r12-before-wall.png`, `docs/gauntlet/shots/r12-after-wall.png`.
- Next target: Texture and material quality (5), tied with the other aesthetics scores still at 5. The lower shade is warmer, and the wall is still a flat cel with joints.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Shaded wall beside the avenue reads warm, and the floors by the roof stay the cold cel. It is still three bands, not bounced light with contact. |
| Color palette | 5 | Unchanged. The sunset inks hold. The shade band is warmer and the grade is the same. |
| Detail density | 5 | Unchanged. |
| Texture and material quality | 5 | Unchanged. The wall is still a flat cel with masonry joints. |
| Composition and camera | 5 | Unchanged. Reported distance stayed 4.5 m and pitch stayed −0.349. |
| Atmosphere | 5 | Unchanged. The 18 m layer is only the height of this bounce. |
| Character models | 5 | Unchanged. Skinned triangles stayed at 12,468. |
| Animation smoothness | 5 | Unchanged. |
| Particles and VFX | 5 | Unchanged. |
| UI polish | 5 | Unchanged. The dotted score plate from round 11. |
| Responsiveness and input latency | 6 | Unchanged. No new pass. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play and the lit-sphere cel check. Street mean 67.1, from 65.4. Saturation 0.52. |

- Aesthetics raw: 51 / 10 dimensions, index 51
- Playability raw: 46 / 10 dimensions, index 46
- Total: 97 / 200
- Delta vs last round: +1 (96 → 97). Lighting 5 → 6. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 13 — 2026-10-21 — rubric v1

- What changed: Each brick, stone, and concrete unit takes its own clay, stone, or panel tone, with a lighter top edge and a darker bottom edge. A coarser batch of that colour stays once a single course is smaller than a pixel, including on the wall of a painted window tile. The glass in the tile is left alone. The three cel bands still shade the colour. The source is Adam Lake, Carl Marshall, Mark Harris, and Marc Blackstein, "Stylized Rendering Techniques for Scalable Real-Time 3D Animation", NPAR 2000. The ramp shades the surface colour. It does not replace it with one flat tone.
- Why it helped: The wall was one cel colour with a joint. A few metres from a brick face, neighbouring units are now a darker clay and a lighter one. From the avenue, where a single course has already faded, the same batches remain as patches.
- Screenshots: before `docs/gauntlet/shots/r13-before-street.png`, after `docs/gauntlet/shots/r13-after-street.png`. The near brick face: `docs/gauntlet/shots/r13-before-wall.png`, `docs/gauntlet/shots/r13-after-wall.png`. Chase: `docs/gauntlet/shots/r13-before-play.png`, `docs/gauntlet/shots/r13-after-play.png`.
- Next target: Color palette (5), tied with the other aesthetics scores still at 5. The brick batches sit inside the same three sunset inks.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cold cel. |
| Color palette | 5 | Unchanged. The sunset inks hold. The new clay is a step inside that grade, not a new grade. |
| Detail density | 5 | Unchanged. |
| Texture and material quality | 6 | A near brick face is more than one clay, and the joint is still there. It is still a cel multiply, not a rough surface. |
| Composition and camera | 5 | Unchanged. Reported distance stayed 4.5 m and pitch stayed −0.349. |
| Atmosphere | 5 | Unchanged. |
| Character models | 5 | Unchanged. Skinned triangles stayed at 12,468. |
| Animation smoothness | 5 | Unchanged. |
| Particles and VFX | 5 | Unchanged. |
| UI polish | 5 | Unchanged. The dotted score plate from round 11. |
| Responsiveness and input latency | 6 | Unchanged. No new pass. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play and the lit-sphere cel check. Street mean 66, from 67.1. Saturation 0.52. |

- Aesthetics raw: 52 / 10 dimensions, index 52
- Playability raw: 46 / 10 dimensions, index 46
- Total: 98 / 200
- Delta vs last round: +1 (97 → 98). Texture and material quality 5 → 6. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 14 — 2026-10-21 — rubric v1

- What changed: Cool shade takes a teal, and the step between that shade and the sun takes a rose. Bright windows, the sun disc, and near-black ink stay. The painted sky strip is graded the same way on the dome. The lookup the tests read is still the strip. The source is James Gurney, Color and Light (2010): a shadow is its own hue, and the half-step is not the average of the light and the shadow.
- Why it helped: The avenue was one violet family. Looking up the street, the sky and the shaded walls now read teal, and the warmer step reads rose. The sunset behind the tower stays the painted orange.
- Screenshots: before `docs/gauntlet/shots/r14-before-street.png`, after `docs/gauntlet/shots/r14-after-street.png`. The sunset: `docs/gauntlet/shots/r14-before-needle.png`, `docs/gauntlet/shots/r14-after-needle.png`. Chase: `docs/gauntlet/shots/r14-before-play.png`, `docs/gauntlet/shots/r14-after-play.png`.
- Next target: Atmosphere (5), tied with the other aesthetics scores still at 5. The air is still four print steps.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cool band. |
| Color palette | 6 | The avenue's cool colour is teal and the step toward the sun is rose. It is still three poster inks. |
| Detail density | 5 | Unchanged. |
| Texture and material quality | 6 | Unchanged. The masonry units from round 13. |
| Composition and camera | 5 | Unchanged. Reported distance stayed 4.5 m and pitch stayed −0.349. |
| Atmosphere | 5 | Unchanged. The haze is the same four steps. Only its hue moved. |
| Character models | 5 | Unchanged. Skinned triangles stayed at 12,468. |
| Animation smoothness | 5 | Unchanged. |
| Particles and VFX | 5 | Unchanged. |
| UI polish | 5 | Unchanged. The dotted score plate from round 11. |
| Responsiveness and input latency | 6 | Unchanged. No new pass. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, and the lit-sphere cel check. Street mean 70, from 66. Saturation 0.59. |

- Aesthetics raw: 53 / 10 dimensions, index 53
- Playability raw: 46 / 10 dimensions, index 46
- Total: 99 / 200
- Delta vs last round: +1 (98 → 99). Color palette 5 → 6. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 15 — 2026-10-21 — rubric v1

- What changed: Level views through the 18 m street layer take the avenue's warm light, a dusty rose-brown. Looking up, the haze stays the sky. The layer is a little thicker, still snapped to four print steps, and it still starts past the near kerb. The teal grade now sits on the surface, so it does not repaint the dust. Props use the same dust. The height split is the one already there, from Carsten Wenzel, SIGGRAPH 2006, the height only. The colour is this avenue's.
- Why it helped: The far blocks used to sink into the same violet as the sky behind them. Down the street they now sit in warmer air, and the sky above that air stays cool. The kerb in front of the camera is unchanged.
- Screenshots: before `docs/gauntlet/shots/r15-before-street.png`, after `docs/gauntlet/shots/r15-after-street.png`. The sunset: `docs/gauntlet/shots/r15-before-needle.png`, `docs/gauntlet/shots/r15-after-needle.png`. Chase: `docs/gauntlet/shots/r15-before-play.png`, `docs/gauntlet/shots/r15-after-play.png`.
- Next target: Detail density (5), tied with composition, character models, animation, particles and VFX, and UI. The near walls are still one painted slab once the air has a colour of its own.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cool band. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 5 | Unchanged. |
| Texture and material quality | 6 | Unchanged. The masonry units from round 13. |
| Composition and camera | 5 | Unchanged. Reported distance stayed 4.5 m and pitch stayed −0.349. |
| Atmosphere | 6 | The far avenue sits in warm dust the sky above it does not. The amount is still four print steps, and there is no weather. |
| Character models | 5 | Unchanged. Skinned triangles stayed at 12,468. |
| Animation smoothness | 5 | Unchanged. |
| Particles and VFX | 5 | Unchanged. |
| UI polish | 5 | Unchanged. The dotted score plate from round 11. |
| Responsiveness and input latency | 6 | Unchanged. No new pass. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, and the lit-sphere cel check. Street mean 73.2, from 70. Saturation 0.57. |

- Aesthetics raw: 54 / 10 dimensions, index 54
- Playability raw: 46 / 10 dimensions, index 46
- Total: 100 / 200
- Delta vs last round: +1 (99 → 100). Atmosphere 5 → 6. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 16 — 2026-10-21 — rubric v1

- What changed: Shop floors keep a cloth band above the windows once the painted tile is on. The flat facade already had the band, and it turned off inside the tile's range, which is where the street camera sits. Each bay is red or teal, with a darker hem and a seam that fades before it shimmers. The band is mixed on after the teal grade, so the grade does not repaint the shaded cloth. No new mesh.
- Why it helped: The near shop wall was one painted slab. A coloured band now sits on the wall above the lit glass, and the glass stays the shop window.
- Screenshots: before `docs/gauntlet/shots/r16-before-street.png`, after `docs/gauntlet/shots/r16-after-street.png`. The sunset: `docs/gauntlet/shots/r16-before-needle.png`, `docs/gauntlet/shots/r16-after-needle.png`. Chase: `docs/gauntlet/shots/r16-before-play.png`, `docs/gauntlet/shots/r16-after-play.png`.
- Next target: Character models (5), tied with composition, animation, particles and VFX, and UI. The chase hero is still a simple read beside the street.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cool band. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 6 | A red or teal band sits above the shop glass. The floors above it are still one tile. |
| Texture and material quality | 6 | Unchanged. The masonry units from round 13. |
| Composition and camera | 5 | Unchanged. Reported distance stayed 4.5 m and pitch stayed −0.349. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 5 | Unchanged. Skinned triangles stayed at 12,468. |
| Animation smoothness | 5 | Unchanged. |
| Particles and VFX | 5 | Unchanged. |
| UI polish | 5 | Unchanged. The dotted score plate from round 11. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, and the lit-sphere cel check. Street mean 73.2, saturation 0.57. |

- Aesthetics raw: 55 / 10 dimensions, index 55
- Playability raw: 46 / 10 dimensions, index 46
- Total: 101 / 200
- Delta vs last round: +1 (100 → 101). Detail density 5 → 6. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 17 — 2026-10-21 — rubric v1

- What changed: The chase jacket keeps half its painted colour under the cel, and the map is sampled a little sharper. A cream belt is painted on the red cloth about 8 cm along the hips' own up axis, and only near the torso, the same belt the built-in figure already wears as geometry. A roll carries that band with the body. The sun rim and the shade rim are a little stronger. No new mesh. The albedo warp and the rim follow Mitchell, Francke, and Eng, Illustrative Rendering in Team Fortress 2 (2007).
- Why it helped: From behind, the jacket was one red. A cream band now breaks it at the hips, and more of the painted panels stay inside the bands. It is still a comic figure.
- Screenshots: before `docs/gauntlet/shots/r17-before-play.png`, after `docs/gauntlet/shots/r17-after-play.png`. The street, where the hero is hidden: `docs/gauntlet/shots/r17-before-street.png`, `docs/gauntlet/shots/r17-after-street.png`.
- Next target: Animation smoothness (5), tied with composition, particles and VFX, and UI. The chase still is one idle pose.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cool band. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 6 | Unchanged. The shop awnings from round 16. |
| Texture and material quality | 6 | Unchanged. The masonry units from round 13. |
| Composition and camera | 5 | Unchanged. Reported distance stayed 4.5 m and pitch stayed −0.349. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | A cream belt breaks the red jacket at the hips, and half the painted colour stays under the cel. The body is still a simple figure. Skinned triangles stayed at 12,468. |
| Animation smoothness | 5 | Unchanged. The shot is a still of the idle pose. |
| Particles and VFX | 5 | Unchanged. |
| UI polish | 5 | Unchanged. The dotted score plate from round 11. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, and the lit-sphere cel check. Street mean 73.2, saturation 0.57. |

- Aesthetics raw: 56 / 10 dimensions, index 56
- Playability raw: 46 / 10 dimensions, index 46
- Total: 102 / 200
- Delta vs last round: +1 (101 → 102). Character models 5 → 6. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 18 — 2026-10-21 — rubric v1

- What changed: On a rope the body follows the arc. At the bottom the chest leads and the legs sit behind the facing. On the way up the knees come forward. A quiet hang keeps the old mild trail, and the rope arm still reaches the anchor. A run on the street keeps the captured run loop. No new mesh. The swing follows Lasseter, Principles of Traditional Animation Applied to 3D Computer Animation (SIGGRAPH 1987). The run is the CMU loop already in `public/vr/anim/CREDITS.md`.
- Why it helped: The chase frame was one standing idle. A run now takes a stride, and a swing puts one arm on the rope with the legs behind the body. It is still a comic figure on twos.
- Screenshots: before `docs/gauntlet/shots/r18-before-play.png` (idle), after `docs/gauntlet/shots/r18-after-play.png` (run) and `docs/gauntlet/shots/r18-after-swing.png`. The street, where the hero is hidden: `docs/gauntlet/shots/r18-before-street.png`, `docs/gauntlet/shots/r18-after-street.png`. The sunset: `docs/gauntlet/shots/r18-before-needle.png`, `docs/gauntlet/shots/r18-after-needle.png`.
- Next target: Particles and VFX (5), tied with composition and UI. The swing still has no wind in the air.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cool band. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 6 | Unchanged. The shop awnings from round 16. |
| Texture and material quality | 6 | Unchanged. The masonry units from round 13. |
| Composition and camera | 5 | Unchanged. The chase pitch stayed −0.349 and the distance stayed 4.5 m. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. Skinned triangles stayed at 12,468. |
| Animation smoothness | 6 | A run takes a stride, and a swing puts the legs behind the facing with one arm on the rope. The pose still steps at 12 Hz. |
| Particles and VFX | 5 | Unchanged. |
| UI polish | 5 | Unchanged. The dotted score plate from round 11. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, and the lit-sphere cel check. Street mean 72, saturation 0.57. |

- Aesthetics raw: 57 / 10 dimensions, index 57
- Playability raw: 46 / 10 dimensions, index 46
- Total: 103 / 200
- Delta vs last round: +1 (102 → 103). Animation smoothness 5 → 6. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 19 — 2026-10-21 — rubric v1

- What changed: On a rope, off the ground, and faster than 10 m/s, a cream puff trails the body about every 0.08 s. It is born just behind and a little to one side, and it drifts back along the motion. The puff and the pool of 768 are the ones the city already draws. A stand and a quiet hang spawn nothing. No new mesh. None of the wind-field papers fit this cel pool, so the trail reuses that puff. Screen speed lines stay as they are and still ramp in only from 14 m/s.
- Why it helped: The swing still showed the body and empty air. A few light flecks now sit beside the figure on the way through. They are still comic puffs, not a volume of wind.
- Screenshots: before `docs/gauntlet/shots/r19-before-swing.png`, after `docs/gauntlet/shots/r19-after-swing.png`. The street, where the hero is hidden: `docs/gauntlet/shots/r19-before-street.png`, `docs/gauntlet/shots/r19-after-street.png`. The sunset: `docs/gauntlet/shots/r19-before-needle.png`, `docs/gauntlet/shots/r19-after-needle.png`.
- Next target: Composition and camera (5), tied with UI polish. The chase stays at 4.5 m and −20°.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cool band. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 6 | Unchanged. The shop awnings from round 16. |
| Texture and material quality | 6 | Unchanged. The masonry units from round 13. |
| Composition and camera | 5 | Unchanged. The chase pitch stayed −0.349 and the distance stayed 4.5 m. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. Skinned triangles stayed at 12,468. |
| Animation smoothness | 6 | Unchanged. The swing still trails at the bottom, and the run is still the captured loop. |
| Particles and VFX | 6 | A fast swing leaves a few cream puffs beside the body. They are the existing comic puff, not a body of air. |
| UI polish | 5 | Unchanged. The dotted score plate from round 11. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, and the lit-sphere cel check. Street mean 71.9, saturation 0.57. |

- Aesthetics raw: 58 / 10 dimensions, index 58
- Playability raw: 46 / 10 dimensions, index 46
- Total: 104 / 200
- Delta vs last round: +1 (103 → 104). Particles and VFX 5 → 6. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 20 — 2026-10-21 — rubric v1

- What changed: On a rope, off the ground, and faster than 8 m/s, the chase camera rises by up to 1.15 m after the arm is placed. The arm stays 4.5 m and the pitch stays −20°. A stand on the street does not take the rise. The ceiling check still stops it. The source is Mark Haigh-Hutchinson, Real-Time Cameras (2009), the lead room already used for the shoulder slide.
- Why it helped: The swing held the body near the middle, so the street ahead and the figure shared one band. The head now sits lower (screen y 425 to 524) and more of the avenue stays above it. It is still the same chase rig.
- Screenshots: before `docs/gauntlet/shots/r20-before-swing.png`, after `docs/gauntlet/shots/r20-after-swing.png`. The street, where this slide does not run: `docs/gauntlet/shots/r20-before-street.png`, `docs/gauntlet/shots/r20-after-street.png`. The sunset: `docs/gauntlet/shots/r20-before-needle.png`, `docs/gauntlet/shots/r20-after-needle.png`.
- Next target: UI polish (5). It is the only aesthetics score still at 5.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cool band. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 6 | Unchanged. The shop awnings from round 16. |
| Texture and material quality | 6 | Unchanged. The masonry units from round 13. |
| Composition and camera | 6 | On a fast rope the head drops from screen y 425 to 524. The reported pitch stayed −0.349 and the distance stayed 4.5 m. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. Skinned triangles stayed at 12,468. |
| Animation smoothness | 6 | Unchanged. The swing still trails at the bottom, and the run is still the captured loop. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 5 | Unchanged. The dotted score plate from round 11. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, and the lit-sphere cel check. Street mean 73.2, saturation 0.57. |

- Aesthetics raw: 59 / 10 dimensions, index 59
- Playability raw: 46 / 10 dimensions, index 46
- Total: 105 / 200
- Delta vs last round: +1 (104 → 105). Composition and camera 5 → 6. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 21 — 2026-10-21 — rubric v1

- What changed: The chase score plate keeps its box, its ink border, and its magenta dots. A cream lip runs along the top of the plate and of each sticker, and a rose hem runs along the bottom, painted in the same paper. The coin gains a lit spot and a dark crescent. Nothing moves, so the lock arrow still sits below the row. None of the dimensional HUD breakdowns fit this sticker, so the edge is painted in the paper the dots already use.
- Why it helped: The row was one flat field from top to bottom. The lip and the hem give the card an edge a still can see. At 1280×720 the box stayed top 12, bottom 57, left 212, right 1068.
- Screenshots: before `docs/gauntlet/shots/r21-before-play.png` (crop `docs/gauntlet/shots/r21-before-play-top.png`), after `docs/gauntlet/shots/r21-after-play.png` (crop `docs/gauntlet/shots/r21-after-play-top.png`). The street, where the HUD is hidden: `docs/gauntlet/shots/r21-before-street.png`, `docs/gauntlet/shots/r21-after-street.png`.
- Next target: Animation smoothness. Every aesthetics score is now 6. A wide chase still still reads as one idle pose, so the next pass has to make the stride and the swing obvious in that frame.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cool band. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 6 | Unchanged. The shop awnings from round 16. |
| Texture and material quality | 6 | Unchanged. The masonry units from round 13. |
| Composition and camera | 6 | Unchanged. On a fast rope the head still sits lower. The reported pitch stayed −0.349 and the distance stayed 4.5 m. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. Skinned triangles stayed at 12,468. |
| Animation smoothness | 6 | Unchanged. The swing still trails at the bottom, and the run is still the captured loop. A wide chase frame still reads as a stand. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 6 | The score plate and each sticker show a cream lip and a rose hem. The row box did not move. |
| Responsiveness and input latency | 6 | Unchanged. CSS only. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, and the lit-sphere cel check. Street mean 73.2, saturation 0.57. |

- Aesthetics raw: 60 / 10 dimensions, index 60
- Playability raw: 46 / 10 dimensions, index 46
- Total: 106 / 200
- Delta vs last round: +1 (105 → 106). UI polish 5 → 6. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 22 — 2026-10-21 — rubric v1

- What changed: At a full run the captured loop stays in the blend for the walk and the jog, and the body keeps an opened stride: the lifted knee steps out to the side and the arms swing against the legs. The 22 cm knee step waits for the run clip's weight (above about 2.9 m/s). At a jog the shin stays put, including on the fallback figure, which uses the same speed band when the clips never load. At the bottom of a swing one leg steps out of the trail and the free arm opens. A quiet hang stays the mild pose. The rope hand stays on the line to the anchor. Pose names and the twelve poses a second stay as they are. The chase arm stays 4.5 m and the pitch stays −20°. John Lasseter, SIGGRAPH 1987, the exaggeration principle. The captured file was not rebuilt.
- Why it helped: From behind the chase, a stride along the facing foreshortens to a stand. The lifted knee now leaves the silhouette (one foot ahead of the facing, one behind; screen y 579 and 500). At the bottom of the swing the feet sit further apart on screen (x 480 and 549) and both stay behind the facing. The rope-hand cosine stayed 0.91.
- Screenshots: run before `docs/gauntlet/shots/r22-before-run.png`, after `docs/gauntlet/shots/r22-after-run.png`. Swing before `docs/gauntlet/shots/r22-before-swing.png`, after `docs/gauntlet/shots/r22-after-swing.png`. The street, where the hero is hidden: `docs/gauntlet/shots/r22-before-street.png`, `docs/gauntlet/shots/r22-after-street.png`. The sunset: `docs/gauntlet/shots/r22-before-needle.png`, `docs/gauntlet/shots/r22-after-needle.png`.
- Next target: Texture and material quality (6), tied with the other aesthetics scores except animation. The walls are still one cel read.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cool band. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 6 | Unchanged. The shop awnings from round 16. |
| Texture and material quality | 6 | Unchanged. The masonry units from round 13. |
| Composition and camera | 6 | Unchanged. On a fast rope the head still sits lower. The reported pitch stayed −0.349 and the distance stayed 4.5 m. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. Skinned triangles stayed at 12,468. |
| Animation smoothness | 7 | A full run steps the lifted knee out of the silhouette, and the bottom of a swing spreads the legs. The rope hand stays on the line to the anchor. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 6 | Unchanged. The cream lip and rose hem from round 21. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, and the lit-sphere cel check. Street mean 73.2, saturation 0.57. |

- Aesthetics raw: 61 / 10 dimensions, index 61
- Playability raw: 46 / 10 dimensions, index 46
- Total: 107 / 200
- Delta vs last round: +1 (106 → 107). Animation smoothness 6 → 7. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 23 — 2026-10-21 — rubric v1

- What changed: Brick, stone and panel walls keep a second tone, printed after the grade. Neighbouring units stay different colours. Each course keeps a light crest until the course is only a few pixels tall. The bed stays at the unit clay, and every clay channel stays at or above 1, so a shade face does not drop under the ink. Glass, windows, rails, fire escapes and the shop awnings stay as they are. No new mesh and no new draw. Pascal Barla, Joëlle Thollot and Lee Markosian, X-Toon (NPAR 2006): the lighting band stays the cel, and the clay is the detail axis. The teal and rose grade is unchanged.
- Why it helped: The cel and the grade were pulling a masonry face back into one hue. On the street a near wall crop moved by a mean channel-sum of 23, and the avenue's left face by 19. The road did not move. Farther up the avenue the print fades, so the sunset shot stays the flat grade.
- Screenshots: street before `docs/gauntlet/shots/r23-before-street.png`, after `docs/gauntlet/shots/r23-after-street.png`. The wall crop: `docs/gauntlet/shots/r23-before-wall.png`, `docs/gauntlet/shots/r23-after-wall.png`. The sunset: `docs/gauntlet/shots/r23-before-needle.png`, `docs/gauntlet/shots/r23-after-needle.png`.
- Next target: Lighting (6), tied with color palette, detail density, composition, atmosphere, character models, particles and UI. The sun is still one grade.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 6 | Unchanged. Shaded lower walls stay warm. The floors by the roof stay the cool band. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 6 | Unchanged. The shop awnings from round 16. |
| Texture and material quality | 7 | A near masonry wall keeps different clay from unit to unit, with a light crest on the course. The grade no longer pulls that face back to one hue. |
| Composition and camera | 6 | Unchanged. On a fast rope the head still sits lower. The reported pitch stayed −0.349 and the distance stayed 4.5 m. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. Skinned triangles stayed at 12,468. |
| Animation smoothness | 7 | Unchanged. A full run steps the lifted knee out, and a jog keeps the captured loop. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 6 | Unchanged. The cream lip and rose hem from round 21. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (26.9%). Street mean 75.4, saturation 0.58. |

- Aesthetics raw: 62 / 10 dimensions, index 62
- Playability raw: 46 / 10 dimensions, index 46
- Total: 108 / 200
- Delta vs last round: +1 (107 → 108). Texture and material quality 6 → 7. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 24 — 2026-10-21 — rubric v1

- What changed: A lit window throws a warm pool onto the pier beside it. The pool falls off within a fraction of the cell, stays off the glass, and is weaker on a face in the sun. A lit shop warms the hem of its cloth, nearest the glass. The top of the cloth stays red or teal. A dark shop leaves the cloth alone. No new mesh and no new draw. James Gurney, Color and Light (2010): a local light colours the nearby surface and dies with distance. The cel and the teal and rose grade are unchanged. The pool is printed after the grade.
- Why it helped: The window was a sticker of light, and the cloth above it was one colour from top to bottom. On the street the hem of a lit shop now takes the lamp (an awning crop moved by a mean channel-sum of 27). The road did not move.
- Screenshots: street before `docs/gauntlet/shots/r24-before-street.png`, after `docs/gauntlet/shots/r24-after-street.png`. The shop cloth: `docs/gauntlet/shots/r24-before-awning.png`, `docs/gauntlet/shots/r24-after-awning.png`. The sunset: `docs/gauntlet/shots/r24-before-needle.png`, `docs/gauntlet/shots/r24-after-needle.png`.
- Next target: Color palette (6), tied with detail density, composition, atmosphere, character models, particles and UI. The grade is still one teal and one rose.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | A lit shop's cloth is warmer along the hem than along the top. The pool stays off the glass, and the road away from the shops does not take the lamp. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 6 | Unchanged. The shop awnings from round 16. |
| Texture and material quality | 7 | Unchanged. The masonry clay from round 23. |
| Composition and camera | 6 | Unchanged. On a fast rope the head still sits lower. The reported pitch stayed −0.349 and the distance stayed 4.5 m. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. Skinned triangles stayed at 12,468. |
| Animation smoothness | 7 | Unchanged. A full run steps the lifted knee out, and a jog keeps the captured loop. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 6 | Unchanged. The cream lip and rose hem from round 21. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (26.7%). Street mean 75.8, saturation 0.59. |

- Aesthetics raw: 63 / 10 dimensions, index 63
- Playability raw: 46 / 10 dimensions, index 46
- Total: 109 / 200
- Delta vs last round: +1 (108 → 109). Lighting 6 → 7. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.


#### Round 24 review correction — 2026-10-21

PR #611 review found that blank bays and incomplete top-floor rows could emit light from suppressed windows. The spill now uses the same `inFloors` mask as the window. Before and after renders passed all 50 existing checks after restoring both shared character models to the local checkout. Street mean 70.6, saturation 0.59; canyon ink 26.9%. City, physics, target and mobile Node checks also passed. Before: `docs/gauntlet/shots/r24-review-before-street.png`; after: `docs/gauntlet/shots/r24-review-after-street.png`. The correction earns no additional points: retain the round's recorded 109/200 (+0 for review repair), with the same playthrough and hardware limits. Fresh remote review, CI and preview checks remain required before merge.

### Round 25 — 2026-10-21 — rubric v1

- What changed: keyboard focus in the flat pause and Comfort menus uses the existing dark ink instead of white on paper. No layout or input behavior changes.
- Why it helped: before, all four desktop/portrait panel cases had 1.05:1 outline contrast; after, all reach 18.40:1, with Tab traversal and viewport bounds preserved. The focused control is now visible on the cream panel.
- Screenshots: `docs/gauntlet/fullswing-r25-focus/` contains before/after pause and Comfort panels at 960×540 and 390×844.
- Next target: continue the weakest evidenced UI or camera issue after checking open rounds. The map Tab shortcut was inspected and left unchanged.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Color palette | 6 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Detail density | 6 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Texture and material quality | 7 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Composition and camera | 6 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Atmosphere | 6 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Character models | 6 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Animation smoothness | 7 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Particles and VFX | 6 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| UI polish | 6 | Focus outline now measures 18.40:1 against paper in pause/Comfort at both tested widths; overall UI score held. |
| Responsiveness and input latency | 6 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Controls feel | 5 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Mission clarity | 4 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Pacing | 4 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Fun factor | 4 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Difficulty curve | 4 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Feedback | 5 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Sound design | 4 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Variety | 4 | Carried baseline; this focus-only round does not re-evaluate this dimension. |
| Performance stability | 6 | Carried baseline; this focus-only round does not re-evaluate this dimension. |

- Aesthetics raw: 63 / 10 dimensions, index 63
- Playability raw: 46 / 10 dimensions, index 46
- Total: 109 / 200
- Delta vs last round: 0. One accessibility correction is not enough evidence to raise the overall UI score. Other dimension scores are explicitly carried baselines, not fresh full-playthrough judgments.

Validation: the new browser regression failed its four contrast assertions before the change and passed all 14 checks after. Tested desktop keyboard operation at desktop and portrait viewport sizes, not a physical phone or headset. No hardware performance or listening claim.

The existing `SIZE=960x540 node qa/vr/layout.e2e.mjs` regression also passed, including HUD, pause and Comfort geometry.

Round 25 shipped in [PR #617](https://github.com/vdimarco/rouge-warden/pull/617), merged as `1c976f5f` after rebase confirmation, all six browser QA jobs, automated review and preview deployment passed. Authenticated preview play verified focus; production UI matched the merged file exactly. Score remains 109/200. Next: the reduced-motion default below.

### Round 26 — 2026-10-21 — rubric v1

- What changed: new games and legacy saves without a comic motion choice select the existing Calm mode when the system requests reduced motion. Saved Full, Calm and Off choices continue to take precedence; ordinary defaults remain Full.
- Why it helped: the game already offers a calmer camera, but ignored the system preference when choosing its initial mode. One default expression now selects that existing mode. This is not a promise that all game motion is disabled or that media-query changes are followed live.
- Screenshots: `docs/gauntlet/fullswing-r26-motion/before-reduce.png` and `docs/gauntlet/fullswing-r26-motion/after-reduce.png` show Full before and Calm after under the same system preference.
- Next target: inspect another evidenced graphics or camera issue after the pending rounds merge.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Color palette | 6 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Detail density | 6 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Texture and material quality | 7 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Composition and camera | 6 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Atmosphere | 6 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Character models | 6 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Animation smoothness | 7 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Particles and VFX | 6 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| UI polish | 6 | The Comfort menu now selects Calm for fresh reduced-motion users and preserves saved choices; overall UI score held. |
| Responsiveness and input latency | 6 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Controls feel | 5 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Mission clarity | 4 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Pacing | 4 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Fun factor | 4 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Difficulty curve | 4 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Feedback | 5 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Sound design | 4 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Variety | 4 | Carried baseline; this motion-default round does not re-evaluate this dimension. |
| Performance stability | 6 | Carried baseline; this motion-default round does not re-evaluate this dimension. |

- Aesthetics raw: 63 / 10 dimensions, index 63
- Playability raw: 46 / 10 dimensions, index 46
- Total: 109 / 200
- Delta vs last round: 0. This comfort correction does not justify an overall score increase. Unchanged dimensions are carried baselines, not a new full-playthrough judgment.

Validation: all 12 browser checks pass. The baseline failed exactly the three reduced-default expectations and passed the other nine checks. The test covers both system preferences, menu selection, camera mode flags, saved Full and Off choices, legacy save behavior and page errors. Screenshot inspected at 960×540. No physical phone/headset, hardware-performance, audio-listening or OpenSpec CLI checks were run. Remote review and CI remain required before merge.

Round 26 shipped in [PR #619](https://github.com/vdimarco/rouge-warden/pull/619), merged as `3a14ec73` after an up-to-date rebase check, all six browser jobs, automated review and preview checks passed. Authenticated preview confirmed Calm selection, disabled camera bank/shake, and no page errors under reduced motion. Score remains 109/200. Next: the prepared mission compass-height round.

### Round 27 — 2026-10-21 — rubric v1, performance evidence supplement

- What changed: the existing opt-in debug overlay now measures elapsed-time gameplay FPS, frame-time p95/p99, frames over 50 ms and event-to-render-submission p95. The old smoothed FPS could ignore stalls over a second. Normal play does not collect diagnostics. The new module is included in the offline precache.
- Why it helped: the user reports slow Chrome on this machine. Measurements and explicit hardware acceptance are now the next priority; these diagnostics do not themselves fix the slowdown. [Mandatory performance evidence](fullswing-performance.md) governs future rounds, using the existing two rubric dimensions without changing rubric v1 weights.
- Screenshots: `docs/gauntlet/fullswing-r27-performance/before.png`, `after.png`. Software-rendered instrumentation probes only. Different short runs are not a performance before/after comparison.
- Next target: obtain a matched hardware Chrome baseline and diagnose the reported slowdown before further graphics expansion. The browser connector currently exposes no Chrome tab.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Color palette | 6 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Detail density | 6 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Texture and material quality | 7 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Composition and camera | 6 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Atmosphere | 6 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Character models | 6 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Animation smoothness | 7 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Particles and VFX | 6 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| UI polish | 6 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Responsiveness and input latency | Unverified | Hardware evidence missing; user reports slow Chrome. Software instrumentation checks cannot establish this score. |
| Controls feel | 5 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Mission clarity | 4 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Pacing | 4 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Fun factor | 4 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Difficulty curve | 4 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Feedback | 5 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Sound design | 4 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Variety | 4 | Historical baseline carried for context; this diagnostic round does not re-evaluate the dimension. |
| Performance stability | Unverified | Hardware evidence missing; user reports slow Chrome. Software instrumentation checks cannot establish this score. |

- Aesthetics historical raw: 63 / 10 dimensions, index 63; no new visual quality claim.
- Playability: 8 carried dimensions sum to 34; responsiveness and performance stability are unverified. Do not normalize the partial sum into a passing score.
- Current total and delta: withheld pending hardware evidence. Previous historical total was 109/200; it is not a current performance acceptance result.

Validation: deterministic tests cover elapsed FPS rather than averaged reciprocal frame times, p95/p99, two-second stalls, inactive gaps, fixed buffer limits and reset. The browser probe failed four expected diagnostic assertions before implementation and passed its no-error check. After implementation all five checks pass (real samples, keyboard timings, visible labels, held-simulation exclusion and no errors). This does not claim hardware FPS, physical input-to-display latency, headset behavior, audio listening or a full playthrough. OpenSpec CLI is unavailable; artifacts are reviewed manually. Remote review, preview and CI remain required before merge.

Automated review identified hidden/blurred XR frames being counted as gameplay. The new visibility regression reproduces that finding (one failure, five passes), using actual loop progress rather than a fixed wait. The correction gates sampling on the same input visibility flag as simulation and breaks timing continuity on XR visibility events. Hardware XR latency remains unverified.

Round 27 shipped in [PR #621](https://github.com/vdimarco/rouge-warden/pull/621), merge `1b216ced`, after all six fresh CI jobs, review and authenticated six-check preview passed. Rebase was up to date. Production main.js, frame-metrics.js and sw.js match the merge exactly. This provides measurements, not a slowdown fix.

### Round 28 — 2026-10-22 — ultrawide render budget (in progress)

Bound desktop 3D drawing buffers to 3840×2160 total pixels at initialization and resize. This machine’s 7680×2160 display at scale 2 otherwise permits a 16.6-million-pixel buffer. DOM text remains native-resolution; XR resizing retains its existing guard. Fine 3D texture sampling is softer above the cap: this is an explicit performance/quality tradeoff, not an aesthetics upgrade.

First matched hardware pair: installed Chrome155, headless NVIDIA RTX4090 OpenGL, CSS3840×1080, DPR2, 10s warmup then 60s each workload. Baseline→candidate FPS: idle41.57→60.00, traversal39.56→56.17, staged auto-healed brawl39.60→60.00. Input timestamp-to-CPU-submit p95:25.1→17.4,28.7→19.9,28.3→17.4ms. Candidate traversal p95 remains33.3ms, missing20ms. Three serial repetitions are still running; these preliminary values are not acceptance. Shared GPU load and warmup variability matter. Actual user-profile Chrome and physical input-to-display latency remain unverified.

Evidence: [round28 artifacts](fullswing-r28-performance/README.md). Functional baseline3fail/6pass → candidate9pass, including resize, phone/DPR restoration, camera/CSS sizing and simulated XR guard. No physical XR check.

| Dimension | Score | Evidence scope |
| --- | ---: | --- |
| Lighting | 7 | Historical context only; no new score awarded. |
| Color palette | 6 | Historical context only; no new score awarded. |
| Detail density | 6 | Historical context only; no new score awarded. |
| Texture and material quality | 7 | Historical context only; no new score awarded. |
| Composition and camera | 6 | Historical context only; no new score awarded. |
| Atmosphere | 6 | Historical context only; no new score awarded. |
| Character models | 6 | Historical context only; no new score awarded. |
| Animation smoothness | 7 | Historical context only; no new score awarded. |
| Particles and VFX | 6 | Historical context only; no new score awarded. |
| UI polish | 6 | Historical context only; no new score awarded. |
| Responsiveness and input latency | Unverified | Matched repetitions and user-profile acceptance pending. |
| Controls feel | 5 | Historical context only; no new score awarded. |
| Mission clarity | 4 | Historical context only; no new score awarded. |
| Pacing | 4 | Historical context only; no new score awarded. |
| Fun factor | 4 | Historical context only; no new score awarded. |
| Difficulty curve | 4 | Historical context only; no new score awarded. |
| Feedback | 5 | Historical context only; no new score awarded. |
| Sound design | 4 | Historical context only; no new score awarded. |
| Variety | 4 | Historical context only; no new score awarded. |
| Performance stability | Unverified | Matched repetitions and user-profile acceptance pending. |

Total/delta withheld: historical aesthetics63 and eight playability dimensions34 are not current hardware acceptance. Review, CI, deployed preview, final rebase and production verification remain pending.

Round28 matched repetitions completed: see the full [hardware table](fullswing-r28-performance/README.md). GPU median render time fell in all nine paired workloads; warmed baseline FPS was already near60, limiting steady-state gains. Candidate traversal56.17/59.30/60.00FPS; first traversal p9533.3ms still misses target. No repeatable >10% regression. User-profile acceptance remains open and total withheld. Fine3D sampling softness is disclosed. Automated review passed on8a3399df with no inline findings.

Round28 shipped in [PR #622](https://github.com/vdimarco/rouge-warden/pull/622), merge `926de76e`, after all six CI jobs, current review and deployed nine-check preview passed. Fresh rebase was up to date immediately before the exact-head merge. Production main.js returned HTTP200 and matched the merge byte-for-byte. No current rubric total awarded: actual user-profile Chrome remains unverified. Next: diagnose remaining frame pacing before more graphics. A windowed test was interrupted and rejected; no windowed acceptance claim.

Post-release pacing follow-up: three direct-production hardware runs are recorded in [the production table](fullswing-r28-performance/production-pacing.md). Normal headless pacing yields about60FPS and input-to-submit p9515.2–17.8ms across idle/traversal/stagedcombat. Traversal2/3 slightly miss strict60FPS; original first-pair frame-time misses remain disclosed. The exploratory unpaced333ms input delay did not recur normally. Actual user-profile acceptance and overall scores remain unverified; no new graphics or runtime change.

### Round 29 — 2026-10-22 — adaptive flat resolution (PR #629, shipped)

Sustained slow flat gameplay trials15% lower linear3D resolution, retaining it only after at least10% frame-interval improvement. Otherwise quality rolls back and probing stops. A half-ratio floor bounds softness; resize restores original quality. Native DOM/camera and XR sizing remain unchanged. [Evidence and limits](fullswing-r29-adaptive/README.md). Unit and12 controlled browser integration checks pass; current matched hardware/visual evidence is pending. No current acceptance or score increase yet.

| Dimension | Score | Evidence scope |
| --- | ---: | --- |
| Lighting | 7 | Historical context only; no current re-score or improvement awarded. |
| Color palette | 6 | Historical context only; no current re-score or improvement awarded. |
| Detail density | 6 | Historical context only; activated resolution tradeoff/visual evidence remains pending. |
| Texture and material quality | 7 | Historical context only; activated resolution tradeoff/visual evidence remains pending. |
| Composition and camera | 6 | Historical context only; no current re-score or improvement awarded. |
| Atmosphere | 6 | Historical context only; no current re-score or improvement awarded. |
| Character models | 6 | Historical context only; no current re-score or improvement awarded. |
| Animation smoothness | 7 | Historical context only; activated resolution tradeoff/visual evidence remains pending. |
| Particles and VFX | 6 | Historical context only; no current re-score or improvement awarded. |
| UI polish | 6 | Historical context only; no current re-score or improvement awarded. |
| Responsiveness and input latency | Unverified | Matched hardware evidence in progress; actual user-profile Chrome remains inaccessible. |
| Controls feel | 5 | Historical context only; no current re-score or improvement awarded. |
| Mission clarity | 4 | Historical context only; no current re-score or improvement awarded. |
| Pacing | 4 | Historical context only; no current re-score or improvement awarded. |
| Fun factor | 4 | Historical context only; no current re-score or improvement awarded. |
| Difficulty curve | 4 | Historical context only; no current re-score or improvement awarded. |
| Feedback | 5 | Historical context only; no current re-score or improvement awarded. |
| Sound design | 4 | Historical context only; no current re-score or improvement awarded. |
| Variety | 4 | Historical context only; no current re-score or improvement awarded. |
| Performance stability | Unverified | Matched hardware evidence in progress; actual user-profile Chrome remains inaccessible. |

Current total/delta withheld. Historical aesthetics63/10dimensions and eight playability dimensions34 are context only. Preliminary synthetic pressure gain35→43FPS does not satisfy all targets or establish affected-Chrome acceptance. No physical-device, listening, full-playthrough or input-to-photon claim.

Round29 completed54hardware workload samples: [full tables and before/after evidence](fullswing-r29-adaptive/README.md). Normal3pairs remain60FPS at full resolution. Under distinct6-draw synthetic pressure, all9paired FPS averages improve25.11–31.38→43.89–56.29 and input-to-submit p9530.5–46.8→20.8–26.4ms. Heavy p95still33.3–33.4ms fails20ms; FPSstillbelow60; p99up to33.5ms fails33.3. Four-draw cold-only gains retained/disclosed. No repeatable>10%regression. Detail softens while DOM remains native; no aesthetic increase. Responsiveness/stability/current total remain unverified for affected Chrome. Review/all6CI/12-checkcurrentpreview passed1d671ac1; evidence-only final head still needs current gates/rebase/merge/productionverify.

Round29 shipped in [PR #629](https://github.com/vdimarco/rouge-warden/pull/629), merge `6f1005b1`, after all6CI jobs, current review and authenticated12-checkpreview passed on3086357f. Fresh rebase was up to date immediately before exact-head merge. Production main.js/render-scale.js/sw.js returned HTTP200 and matched merge bytes exactly. This provides a bounded response to sustained slow flat frames; affected-profile Chrome remains unverified, and no current hardware passing score/overall total is awarded. Canonical adaptive-rendering scenarios and completed archive recorded.

### Round 30 — 2026-10-22 — zero-contribution sky gather (validation in progress)

Skip only the16tap sun-shaft gather whose existing contribution weight is exactly zero. Content, samples/weights on partial edges, resolution, controls and XR bypass remain unchanged. [Scoped evidence](fullswing-r30-sky/README.md). Eight same-frame functional comparisons across desktop/phone and effect modes have identical RGBA bytes; full recorded hardware/visual and matched workload checks pending. Preliminary30s GPU gains are not release acceptance.

| Dimension | Score | Evidence scope |
| --- | ---: | --- |
| Lighting | 7 | Historical context only; no current re-score or improvement awarded. |
| Color palette | 6 | Historical context only; no current re-score or improvement awarded. |
| Detail density | 6 | Historical context only; current focused visual acceptance remains pending. |
| Texture and material quality | 7 | Historical context only; current focused visual acceptance remains pending. |
| Composition and camera | 6 | Historical context only; no current re-score or improvement awarded. |
| Atmosphere | 6 | Historical context only; no current re-score or improvement awarded. |
| Character models | 6 | Historical context only; no current re-score or improvement awarded. |
| Animation smoothness | 7 | Historical context only; current focused visual acceptance remains pending. |
| Particles and VFX | 6 | Historical context only; no current re-score or improvement awarded. |
| UI polish | 6 | Historical context only; no current re-score or improvement awarded. |
| Responsiveness and input latency | Unverified | Current round hardware evidence pending; actual user-profile Chrome inaccessible. |
| Controls feel | 5 | Historical context only; no current re-score or improvement awarded. |
| Mission clarity | 4 | Historical context only; no current re-score or improvement awarded. |
| Pacing | 4 | Historical context only; no current re-score or improvement awarded. |
| Fun factor | 4 | Historical context only; no current re-score or improvement awarded. |
| Difficulty curve | 4 | Historical context only; no current re-score or improvement awarded. |
| Feedback | 5 | Historical context only; no current re-score or improvement awarded. |
| Sound design | 4 | Historical context only; no current re-score or improvement awarded. |
| Variety | 4 | Historical context only; no current re-score or improvement awarded. |
| Performance stability | Unverified | Current round hardware evidence pending; actual user-profile Chrome inaccessible. |

Current total/delta withheld. Historical aesthetics63/10dimensions and eight playability dimensions34 are context only. No current hardware passing points, aesthetic increase, affected-user-profile, physical-device, listening or full-playthrough claim. Require full matched evidence, review, allCI/currentpreview, rebase and production verification before release.


Round30 measurement update:48accepted60s/35inputworkloads, fullraw/source hashes and corrected identical city images in fullswing-r30-sky. All9pressureGPU medians lower; controlled same-browser combat medianFPS37.92→42.66/input26.7→25.8ms resolves original repeated latency direction under matched launch conditions. Original normal/pressure misses retained, heavyFPS/tails still fail absolute targets. All20dimension assessments above remain historical context; responsiveness/stability unverified/currenttotalwithheld. No aesthetic/userChrome fix claim. Current preview/CI/review/rebase/production gates remain.


Round30 shipped in PR#631, merge45b0243e, after all6freshintegratedCI/review/currentauthenticated11checkpreview/exactbloombytes and finalfreshrebase. Productionbloom HTTP200 exactSHAda57af013327ae283503ddc5a29416d9847057ce478c35b582f03bfa1fcc4b04. Zero-contribution guard preserves pixels and lowers measured pressureGPUtime; original frame/tail misses and shared-load limits remain. No userChrome fix/passingscore. Canonical sky-gather scenarios published and OpenSpec archived.


## Full-screen clear round34 (pending)

One scoped pass helper suppresses redundant clears and restores renderer.autoClear in finally. Preliminary2paired30sGPU/FPS/input improvements justify full measurement, not acceptance. Functional15checks pass. Sources/evidence fullswing-r34-clears; full3pairsnormalpressure60s35inputs queued. Realbuildinganchors/noceiling preserved; no resolution/effect change.

| Lighting | 7 | Historical context only; no current re-score or improvement awarded. |
| Color palette | 6 | Historical context only; no current re-score or improvement awarded. |
| Detail density | 6 | Historical context only; current focused visual acceptance remains pending. |
| Texture and material quality | 7 | Historical context only; current focused visual acceptance remains pending. |
| Composition and camera | 6 | Historical context only; no current re-score or improvement awarded. |
| Atmosphere | 6 | Historical context only; no current re-score or improvement awarded. |
| Character models | 6 | Historical context only; no current re-score or improvement awarded. |
| Animation smoothness | 7 | Historical context only; current focused visual acceptance remains pending. |
| Particles and VFX | 6 | Historical context only; no current re-score or improvement awarded. |
| UI polish | 6 | Historical context only; no current re-score or improvement awarded. |
| Responsiveness and input latency | Unverified | Current full-clear round hardware evidence pending; actual user-profile Chrome inaccessible. |
| Controls feel | 5 | Historical context only; no current re-score or improvement awarded. |
| Mission clarity | 4 | Historical context only; no current re-score or improvement awarded. |
| Pacing | 4 | Historical context only; no current re-score or improvement awarded. |
| Fun factor | 4 | Historical context only; no current re-score or improvement awarded. |
| Difficulty curve | 4 | Historical context only; no current re-score or improvement awarded. |
| Feedback | 5 | Historical context only; no current re-score or improvement awarded. |
| Sound design | 4 | Historical context only; no current re-score or improvement awarded. |
| Variety | 4 | Historical context only; no current re-score or improvement awarded. |
| Performance stability | Unverified | Current full-clear round hardware evidence pending; actual user-profile Chrome inaccessible. |


Current total/delta withheld. Historical scores above are context only, no aesthetic improvement, affecteduserChrome/physicaldevice/listening/fullplaythrough claim. Requirefullhardwareevidence/review/currentpreview/allCI/rebase/production before release.


Round34 rejected beforemerge:42fullworkloads/35inputs each; normal60FPS but pressure results mixed, same-browser medianFPS25.15→25.44(~1.2%) insufficient reliable gain. CI/review/pixel/statechecks pass but do not justify shipping. Fullraw/tables/limits retained in fullswing-r34-clears. No current score increase, totalwithheld; no productionchange or Chrome fixclaim.


User-directed workflow update: performance measurements are diagnostic, not an FPS-benefit merge gate. Round34 reopens as removal of redundant render commands with actual FPS benefit unverified; original mixed results remain recorded. Focused correctness/review/CI/preview/rebase/production checks retained. Delivery plan: FULLSWING-PERFORMANCE-PLAN.md.


## Increment35 — populated character/sign uploads (pending release)

Range-limited dynamic GPU transfers reuse existing Three APIs.13focused browser checks pass, verifying actual upload bytes after shrink/grow/zero and identical populatedimages. Threeof240figures upload264instead of21120bytes; threeof100signs156instead of5200. No FPSgain claim or benchmarkmergegate. All20dimension historical assessments from prior round remain context only; no new aestheticpoints, responsiveness/stabilityunverified,total/deltawithheld. Review/CI/deployedpreview/rebase/production pending; realbuildinganchors/noheightceiling unchanged.


## Increment36 — hidden flat rendering (pending release)

One guard skips hidden flat city/bloom draws. Baseline2fail/8pass→10pass in focused synthetic desktop/phone checks:60hidden callbacks0pipelineentriesafter,visible/resume/XRroutingunchanged. Evidence fullswing-r36-hidden-render. No FPSclaim/gate; all20historicaldimensionassessmentsremaincontext,responsiveness/stabilityunverified,totalwithheld. Review/CI/currentpreview/rebase/production pending. No affected-user/physicaldevice/playthroughclaim.


## Incremental rendering releases

PR#634 released as `8608ff629f30ec911edab0ad6c12f77606b6fc9c` after review, CI, deployed functional checks, final rebase and exact-head merge; production bytes verified. Canonical spec and archive published. FPS benefit and affected Chrome remain unverified; no FPS-benefit gate.

PR#635 released as `3797b07fdd943b430102de6b573ef8f20f6f2e38` after review, CI, deployed functional checks, final rebase and exact-head merge; production bytes verified. Canonical spec and archive published. FPS benefit and affected Chrome remain unverified; no FPS-benefit gate.

PR#636 released as `9d82f8233450bc1a3c5f1e8ef841c78de731c768` after review, CI, deployed functional checks, final rebase and exact-head merge; production bytes verified. Canonical spec and archive published. FPS benefit and affected Chrome remain unverified; no FPS-benefit gate.


## Increment37 — invisible street preparation (pending release)

Skip hidden street sign-list/uniform work with existing root visibility. Focused hide/move/resume regression validates attribute versions, sign counts, current time and people; street simulation/quality/anchors/height rules unchanged. No FPS claim or gate. All20dimensions retain historical context only, no newpoints; responsiveness/stability unverified, currenttotal/delta withheld. Evidence fullswing-r37-hidden-street.


Increment37 released in #638 as2c9d2d8f after all6CI/review/current4checkpreview/freshrebase. Production streetview HTTP200 exactSHA6a1c7c3089d596471c0cca7fae51a27b30b6bd39bdffa021a49f879fe5c64282. Canonical invisible-street scenarios published and OpenSpec archived. No FPS gain or affectedChrome acceptance claimed; currenttotal withheld.


## Increment38 — populated car and marker transfers (pending release)

Bound matrix/color buffer uploads to populated model/fallback cars and mission markers using the established update-range policy. Focused actual WebGL byte/range/count tests cover shrink/grow/empty plus same-frame image comparison. No physics/anchor/height/quality changes. All20dimensions historical context only, no newpoints; affectedChrome responsiveness/stability unverified, currenttotal/deltawithheld. Evidence fullswing-r38-action-uploads. No FPS gate.


Increment38 shipped #640 as69c6ecff after all6CI/review/current9checkpreview/freshrebase. Productionactionview HTTP200 exactSHA8390a157dc9c3ccd40b16968f869791f8ea7713cd2d81fd114b12d885c276a38. Canonical populated-car/marker scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


## Increment39 — unchanged mission marker buffers (pending release)

Value-based marker dirtiness avoids static geometry rewrites/uploads whiletime animates. Focused actualzero-transfer/mutablegoal/color/count/hide/show/referenceimagechecks; no anchors/physics/height/quality change. All20dimensions historicalcontextonly,no newpoints; affectedChrome responsiveness/stability unverified,total/deltawithheld. Evidence fullswing-r39-marker-dirty; noFPSgate.


Increment39 shipped #642 asf84e61f3 after all6CI/review/current20deployedchecks/freshrebase; productionactionview HTTP200 exactbytes verified (fullhash in fullswing-r39-marker-dirty/production-verification.json). Canonical markerdirty scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


## Increment40 — reusable car selection records (pending release)

Reuse high-water candidate records with allfieldsreset; nearest/driving/tie/streetpromotion behavior preserved. Browser regression also fixes stale streetpicks on cameraremoval. Node/reference selection checks and actual loadedmodel/trafficmatrix/pixel checks. No quality/physics/anchor/height change; noFPSgate. All20dimensions historicalcontextonly, no newpoints; responsiveness/stabilityunverified,total/deltawithheld. Evidence fullswing-r40-selection-slots.


Increment40 shipped #644 as8b5a4565 after freshall6CI/review/current25deployedchecks/rebase; productionactionview HTTP200 exactbytes verified (hash in fullswing-r40-selection-slots/production-verification.json). Canonical selection/no-camera scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


## Increment41 — reusable traffic paint arrays (pending release)

Reuse per-output paint storage during traffic sampling; fresh results and fallbackpalette independent. Focused identity/value/alias checks plus action and visualselectionintegration. No art/physics/anchor/height change/noFPSgate. All20dimensions historicalcontextonly,no newpoints; affectedChrome responsiveness/stabilityunverified,total/deltawithheld. Evidence fullswing-r41-traffic-paint.


Increment41 shipped #646 as2d254f7d after freshall6CI/review/current10deployedchecks/rebase; productioncars HTTP200 exactbytes verified (hash in fullswing-r41-traffic-paint/production-verification.json). Canonical traffic-paint scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


## Increment42 — reusable street hazard samples (pending release)

Optionaloutputstorage reusedbyrealstreetframe; defaultfreshresultsunchanged. Node100listidentity/value/count/reverse/avoidancechecksand4realframebrowserchecksPASS; noFPSgate. All20dimensions historicalcontextonly,no newpoints; responsiveness/stabilityunverified,total/deltawithheld. Evidence fullswing-r42-hazard-scratch; noanchor/height/artchange.


Increment42 shipped #648 as853fed7a after all6CI/review/current9deployedchecks/rebase; productioncars+main HTTP200 exactbytes verified (hashes in fullswing-r42-hazard-scratch/production-verification.json). Canonical hazard-output scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment43 — clog guard source reuse — 2026-10-23
Guard selection uses static city clogs and synchronized saved completion IDs, avoiding full target snapshots. Node20spawns match the snapshot reference with96→0snapshot calls; browser5checks verify actual guard offsets/once/real completion, existing action suite passes. Evidence fullswing-r43-clog-guards includes all20dimension limits; no newpoints, total/delta withheld, affectedChrome/stability unverified. Review/CI/currentpreview/rebase/production pending. No art/anchor/ceiling changes or FPS claim.


Increment43 shipped #650 as5f5c85f5 after all6CI/review/current10deployedchecks/freshrebase/exactmerge. Productionmain HTTP200 exactbytes verified (hash in fullswing-r43-clog-guards/production-verification.json). Canonical guard-selection scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment44 — desired rope Map reuse — 2026-10-23
One private cleared Map replaces per-frame construction in target reconciliation. Node100cycles match target add/remove/positions under goon/job transitions/disabled/pause/driving;100→0Mapobjects after initialization. Browser60realframes/oneMap/4checksPASS, action Node suitePASS. Evidence fullswing-r44-rope-want includes20dimensionlimits; total/delta withheld, actualChrome/stability unverified. No image/physics/anchor/ceiling change or FPS claim. Review/CI/preview/rebase/production pending.


Increment44 shipped #652 as16909bd0 after all6CI/review/current14deployedchecks/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactbytes verified (hash in fullswing-r44-rope-want/production-verification.json). Canonical desired-map scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment45 — combat rope target scratch — 2026-10-23
Optional combat.targets output reused by main; fresh default arrays/live goon references and filtering unchanged. Node100sample identity/value/radius/perch/countchecks, existingaction/reconciliation suites and4browserchecks60realframes/onearrayPASS. Evidence fullswing-r45-combat-targets/all20dimensionlimits; total/delta withheld, actualChrome/stability unverified. No art/physics/anchor/ceiling change or FPS claim. Review/CI/preview/rebase/production pending.


Increment45 shipped #654 as8005f88d after all6CI/review/current18deployedchecks/rebase before AND afterpreview/exactmerge. Productionmain+combat HTTP200 exactbytes verified (hashes in fullswing-r45-combat-targets/production-verification.json). Canonical combat-target-storage scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment46 — job rope target scratch — 2026-10-23
Optional jobs.ropeTargets output reused by main; defaultfresharrays/records and livepositions unchanged. Node100fourtype/statecycles +action/reconciliation suites and4browserchecks60realframes/onearrayPASS. Evidence fullswing-r46-job-targets/all20dimensionlimits; total/delta withheld, actualChrome/stability unverified. No art/physics/anchor/ceiling change or FPS claim. Review/CI/preview/rebase/production pending.


Increment46 shipped #656 as5536c923 after all6CI/review/current22deployedchecks/rebase before AND afterpreview/exactmerge. Productionmain+jobs HTTP200 exactbytes verified (hashes in fullswing-r46-job-targets/production-verification.json). Canonical job-target-storage scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment47 — registered goon rope record reuse — 2026-10-23
Private cache retains complete goon target records, updating existing chest positions. Baseline60records→one across60movingreconciliations; removal/return freshidentity preserved. Node/action/reconciliation+4actualgoonbrowserchecks+4realframechecksPASS. Evidence fullswing-r47-goon-rope-records/all20dimensionlimits; total/delta withheld, actualChrome/stability unverified. No art/physics/anchor/ceiling change or FPS claim. Review/CI/preview/rebase/production pending.


Increment47 shipped #658 as6aa20d58 after all6CI/review/current26deployedchecks/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactbytes verified (hash in fullswing-r47-goon-rope-records/production-verification.json). Canonical registered-goon-record scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment48 — private figure count storage — 2026-10-23
Private count dictionary cleared/reused acrossframes; info snapshotsremaincloned. Baseline61objects→one/5browserchecksPASS dynamiccounts/culling/capacity/empty/snapshotindependence; existingupload13checks/exactnonblankpixelsPASS. Evidence fullswing-r48-figure-counts/all20dimensionlimits; total/delta withheld, actualChrome/stability unverified. No art/physics/anchor/ceiling change or FPS claim; deletioncost unmeasured. Review/CI/preview/rebase/production pending.


Increment48 shipped #660 as09966956 after all6CI/review/current18deployedchecks/rebase before AND afterpreview/exactmerge. Productionstreetview HTTP200 exactbytes verified (hash in fullswing-r48-figure-counts/production-verification.json). Canonical figure-count scenarios published and OpenSpec archived. ActualChrome/FPSbenefit and deletioncost unverified; totalwithheld.


### Increment49 — goal projection layout inputs — 2026-10-23
Reuse viewport/paddinginputs; livereaddimensions and originalphone/desktopsafeareas preserved. Baseline60size+60padobjects perlayout→oneeach/5browserchecksPASS acrossresize/layoutchanges/freshresults. ExistinggoalmarkerNode/browser suitesPASS. Evidence fullswing-r49-goal-layout/all20dimensionlimits; total/delta withheld, actualChrome/stability unverified. No art/physics/anchor/ceiling change or FPS claim. Review/CI/preview/rebase/production pending.


Increment49 shipped #662 asa51930fe after all6CI/review/currentlayout+goalmarkdeployedchecks/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactbytes verified (hash in fullswing-r49-goal-layout/production-verification.json). Canonical goal-layout scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment50 — mission crew list scratch — 2026-10-23
Optional combat.group output reused by five synchronous jobqueries. Defaultfresharrays/order/goonrefs/countfilters/goals unchanged. Baselineidentityfails→Node100cyclesPASS;existingactionmissionsuite+4browserchecks60brawlframes/onearrayPASS. Evidence fullswing-r50-job-crew/all20dimensionlimits; total/delta withheld, actualChrome/stability unverified. No art/physics/anchor/ceiling change or FPS claim. Review/CI/preview/rebase/production pending.


Increment50 shipped #664 asfba485ea after freshall6CI/review/current12deployedchecks/rebase before AND afterpreview/exactmerge. Productioncombat+jobs HTTP200 exactbytes verified (hashes in fullswing-r50-job-crew/production-verification.json). Canonical crew-storage scenarios published and OpenSpec archived. Initial incomplete review retried successfully, never accepted as passing. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment51 — count-only crew filters — 2026-10-23
Five missionupdates reducealivecounts directly, preservingpredicate/firstlivegoals/completionrules. Node100updates/all5missionsPASS with100→0filteredarrays;actionmissionsuite+5browserchecks60brawlframes/zerofiltersPASS. Evidence fullswing-r51-crew-count/all20dimensionlimits; total/delta withheld, actualChrome/stability unverified. No art/physics/anchor/ceiling change or FPS claim. Review/CI/preview/rebase/production pending.


Increment51 shipped #666 as2035c0b8 after all6CI/review/current13deployedchecks/rebase before AND afterpreview/exactmerge. Productionjobs HTTP200 exactSHA c714f2e6fbb50390ceab1bb75dece1c794fa2946c98deb8c992a8b37167d69ac verified. Canonical crew-count scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment52 — idle offer array
Skip replacement filtering until an actual expired crime exists. Node60updates/strict deadline/busy/ordered events/previous-array independence and action suite PASS; browser four checks PASS using separate actual module instance. All20limits in r52-offer-expiry; no FPS claim/total withheld. Release pending.


Increment52 shipped #668 as2264dc92 after all6CI/review/current12deployedchecks/rebase before AND afterpreview/exactmerge. Productionjobs HTTP200 exactSHA9ed9b41552376e9930dd0b4a2dc25da4da69b828f9b1cad866d729f9f09abb04 verified. Canonical idle-offer scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld; expiryextrascanunmeasured.


### Increment53 — share HUD throw query
Current HUD availability shared between prompt and button.4096 output-equivalence statesPASS,worstcase2→1selectorcalls; actualbrowser60desktop+60phoneupdates/currentcooldown/nofightPASS/action suitePASS. Evidence r53-hud-throw/all20limits; noFPSclaim/totalwithheld. Releasepending.


Increment53 shipped #670 asff8861c5 after all6CI/review/current4HUDdeployedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA d58ec0ebbad7a244cc85beabfcee1bef89b41c3bb44741021227c8f41e85f9c9 verified. Canonical HUD throw-query scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment54 — share HUD threat selection
HUD passes current threat to warning instead of scanning twice.4096stateequivalencePASS,6144→4096queries acrossfixture; browser60desktop+60phoneactualHUDupdates/realwindupgoon/warning/state+removalPASS;action/throwquerysuitePASS. Evidence r54-hud-threat/all20limits/noFPSclaim/totalwithheld. Releasepending.


Increment54 shipped #672 as05750289 after freshall6CI/review/current8HUDdeployedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA11e1f28fb3cb50f199caf8d630a9825ae6af40ab5eed34bb54f914fd94c7df67 verified. Canonical HUD threat-query scenarios published and OpenSpec archived. Concurrent unrelated main changes preserved by rebase; all checks rerun on rebased head. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment55 — phone finish guard
Skipdesktop-onlyFINISHreachquerybeforephonefallback.4096outputequivalencePASS/712→456queries;actualbrowser60phonePUNCH+60desktopFINISHqueries/removalPASS;HUD/action suitesPASS. Evidence r55-phone-finish/all20limits/noFPSclaim/totalwithheld. Releasepending.


Increment55 shipped #676 asd1867b18 after freshall6CI/review/current63deployedchecks/exactmain+ropebytes/rebase before AND afterpreview/exactmerge. Productionmain+rope HTTP200 exactbytes verified (hashes in r55-phone-finish/production-verification.json). Canonical phone-finish and ink-rope endpoint scenarios published and both changes archived. Shipped stale endpoint regression restored without changing physics/renderedink; layout fixture waits CSS fade completion, assertions unchanged. Concurrent NORD/buildingrope work preserved. ActualChrome/FPSbenefit unverified; totalwithheld.


### Increment56 — comic-word populated GPU uploads
Spawn/updateboundmatrix+atlas+tintprefixesto livewords. Actualuploads1536→96bytesforoneword/288for3/672for7/full1536for16.14browserchecks/exactnonblankreferencepixels/shrink/swap/zero/regrow/hiddenagingPASS;existing32FXchecksPASS afterisolatingWHOOSHcooldownfixture. Evidence r56-word-uploads/all20limits/noFPSclaim/totalwithheld. Releasepending.


Increment56 shipped #679 as c4c37bd9 after all6CI/review/current46deployedchecks/exactfxbytes/rebase before AND afterpreview/exactmerge. Productionfx HTTP200 exactSHA3a67361da1a3e08fb75b31b3fcd65f890708e49f79dfb364a3347058a38e19f8 verified. Canonical comic-word upload scenarios published and OpenSpec archived. Initial full GPU allocation unchanged; actualChrome/FPSbenefit unverified; totalwithheld.


Increment57 — atlas uploads omitted on animation-only word updates; pending spawn/removal ranges preserved. Actual one-word animated uploads96→80bytes, baseline assertion fails;16browserchecks/exactnonblankpixels/fullreplacement/swap/hiddenaging PASS;32FXchecksPASS. Evidence r57-word-atlas/all20limits/noFPSclaim/totalwithheld. Releasepending.


Increment57 shipped #681 as f548a6b7 after all6CI/review/current48deployedchecks/exactfxbytes/rebase before AND afterpreview/exactmerge. Productionfx HTTP200 exactSHA03095f3bb17ef5d1078d601045c5cad9e29a34c81c230785df95f2a5c014e9c7 verified. Canonical atlas-update scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment58 pending: populated web matrix/fade uploads1088→408bytesone6segments/816two12 with exactnonblankpixels; existing building checks caught shippedsky-anchor regression/currentmainbaseline3fail. Restored prior shared realbuilding selector preserving newer gold-ring/melee/wall/heldrope behavior;4building+51swing checksPASS. Evidence r58-web-ranges/all20limits/noFPSclaim.


Increment58 shipped #683 as b05703d1 after all6CI/review/current63deployedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA220d0f069b4d893723e7bda74bec3a0131d7d940b2d21bf9341a02f3716b026c verified. Canonical web-upload and real-anchor-restoration scenarios published; both OpenSpecs archived. Realbuilding-only/above-roof restoration preserves newer goldring/melee/wall/heldrope behavior; legacyfixtures corrected to realanchor contract. NoFPSclaim/actualChromeunverified/totalwithheld.


Increment59 pending — sharedcamera.updateMatrixWorld onceper3Dwebdraw vsperrope;actualtwo/fading2→1call.8upload/pixel+11web-line+4buildingchecksPASS. Evidence r59-web-camera/all20limits/noFPSclaim/totalwithheld.


Increment59 shipped #685 as d7b7c8bf after all6CI/review/current23deployedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA2602aa95c69c6a447f93048b39fac22d9740bb5bd6700be776953ef3e2c96a27 verified. Canonical shared-web-camera scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment60 pending — goonpose tick shared perstreetframe/currentdiagnosticdefault. Actualfunctions60frames10goons/6mode-layout runs equivalent allfields+pose/state/position/modechanges;400→40ticksfull/calm,200→20offtransition,nonflat0. ExistingVersebrowserchecksPASS. Emptyframeoneextratick/aggregateeffectunmeasured. Evidence r60-goon-tick/all20limits/noFPSclaim/totalwithheld.


Increment60 shipped #687 as8b4f724a after all6CI/review/currentVersepreview/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA9be698cabaa8fc4334b71712cefe5cccd427d6188d43db044925ff04d7034d24 verified. Canonical goon-pose tick scenarios published and OpenSpec archived. ActualChrome/FPSbenefit and aggregate effect unverified; totalwithheld.


Increment61 pending — sharedfigure root followsworldvisibility;hiddenvisualprep180→0calls/60frames/bufferversionsunchanged. Simulation+crowd60/60 retained;firstresumeactualmovedgoon/currenttime/jobpopulationPASS.5browser+4hiddenstreet+6goonposeequivalencecasesPASS. Evidence r61-hidden-figures/all20limits/noFPSclaim/totalwithheld.


Increment61 shipped #689 asb123bc2f after all6CI/review/current9deployedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA5850d940312c64eef14db15acf1f1a6a6ed3a64e25ac3950b8fd45d1e6a29e11 verified. Canonical hidden-figure scenarios published and OpenSpec archived. PhysicalAR/actualChrome/FPSbenefit unverified; totalwithheld.


Increment62 pending — privateaction-viewoptions64fresh→1record inactualbrowseractive/hidden/resume/cutscene/play;4checksPASS/currentmarkerflags/samecamera. Marker-dirty+6goonposeequivalencecasesPASS. Evidence r62-action-options/all20limits/noFPSclaim/totalwithheld.


Increment62 shipped #691 as b6763a7a after all6CI/review/current authenticated options+marker checks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA074d5e80ccfcc386336c3cc1b4a545fc0e85b8f6bf8bb32bd99c4ef7f8a45898 verified. Canonical action-view options scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment63 pending — crowd height rejection before horizontal distance:240actualupdates equivalent state/crowd across boundary/movement,19200hypotcalls skipped/6400roof. Existing street and5hidden-figure browser checksPASS. Evidence r63-crowd-height/all20limits/noFPSclaim/totalwithheld.


Increment63 shipped #693 as a3710180 after all6CI/review/current5authenticatedbrowserchecks/exactstreetbytes/rebase before AND afterpreview/exactmerge. Productionstreet HTTP200 exactSHA20e474654fbd99fc37eafc02afc3abc77de05ce7d79641498983a715a1d51c89 verified. Canonical crowd-height scenarios published and OpenSpec archived. ActualChrome/FPSbenefit/listening unverified; totalwithheld.


Increment64 pending — traffic wrapper optionaloutput/private runtime scratch60fresh→1 direct+street frames;4browser+actualaccessor null/replacementchecks+existingactionbrowserPASS. Evidence r64-traffic-record/all20limits/noFPSclaim/totalwithheld.


Increment64 shipped #695 as013e0bbc after all6CI/review/current authenticated traffic+action checks/exactmain+cityviewbytes/rebase before AND afterpreview/exactmerge. Productionboth HTTP200 exactSHA main00ebd4da21a1c12c01d7c04038c4a52ce94f9be631533bfab2d02c69f1a138b3/cityview634fdd52adfe4935feb960e34f29d4c6bbe0ccf38969f952d6d641e3e0438601 verified. Canonical traffic-record scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment65 pending — goal placement+HUD output share private record/twoactivegoalrecords→0;1920exactplacementcomparisons/defaultfresh+goalmark+7browserchecksPASS includinglayout/state/mission/trendreset. Evidence r65-goal-record/all20limits/noFPSclaim/totalwithheld.


Increment65 shipped #697 as765d5da0 after all6CI/review/current7authenticatedbrowserchecks/exactmain+actionhudbytes/rebase before AND afterpreview/exactmerge. Productionboth HTTP200 exactSHA main8224627aa0816c71eba6778e777b5bc39e318e85da3faa9137a921a7e4b8afa7/actionhud0f995bd08ad348c929818e50b1fd7c19948a9e489160cdf2ddebc9a9c7441693 verified. Canonical goal-record scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment66 pending — private sun-screen result60fresh→1 across90camera frames/60visible30behind/exactprojection;3browser+existingdesktop/phone sky-gather RGBAchecksPASS. Evidence r66-sun-screen/all20limits/noFPSclaim/totalwithheld.


Increment66 shipped #699 as74357132 after all6CI/review/current authenticated sun+sky checks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA86d220e1ef9114da119d3e6980f9926fb10e95ef1c1d13b4ff810efc8cf0f979 verified. Canonical sun-screen scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment67 pending — unchangedhandOf hoistedoutside drawWeb60functionidentities→1;4endpointchecks+8webuploadpixel+11weblinechecksPASS. Evidence r67-web-hand/all20limits/noFPSclaim/totalwithheld.


Increment67 shipped #701 asd3984338 after all6CI/review/current23authenticatedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA302c7cc1189f94481abc0696892f1a649ab8cb5ea1e64aa067d6568515853aca verified. Canonical web-hand scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment68 pending — fade-onlyweb speedquery1→0/attached1unchanged;10webupload/pixel/peakreset+11weblinechecksPASS. Evidence r68-web-speed/all20limits/noFPSclaim/totalwithheld.


Increment68 shipped #703 as5d1ae20b after all6CI/review/current21authenticatedchecks/exactmainbytes/rebase before AND afterpreview/exactmerge. Productionmain HTTP200 exactSHA1dbac0ea735298b55de7cb7bd968958140493fa32c6b0ddc1ba3c3145f7705ba verified. Canonical web-speed scenarios published and OpenSpec archived. ActualChrome/FPSbenefit unverified; totalwithheld.


Increment 69 shipped externally in PR #705 as `f9577462`. Seven moving cars upload 0 unchanged color bytes instead of 84 in the fixture; changed paint uploads 12 bytes per slot. Fresh six-job CI passed on rebased head `4a4e5387`. Production actionview.js is HTTP 200 and exactly matches SHA-256 `13c2a4fcb4c902b9502588aefe150568393435b1ae65f6dc6aa76f11bbdcccf0`; 15 production paint checks and 35 authenticated post-merge preview checks passed. Agent Review was absent, and the external merge preceded the final preview/rebase sequence; those pre-merge gates were not completed or claimed. Canonical car-paint scenarios and archive published with full evidence in fullswing-r69-car-paint. Actual Chrome120Hz/FPS benefit and aggregate frame effect remain unverified; no score changes or total claimed.


Increment70 pending — unchanged blocked-goon movement uses prepared fixed rotations. 216 exact attempt/result traces, existing action simulation,8 browser checks and byte-identical nonblank desktop/portrait goon frames pass. Retry trigonometry1,008→0 in focused cases; aggregate effect/FPS unmeasured. Evidence fullswing-r70-goon-slide; all20rubric points/total withheld; full release gates pending.


Increment 70 shipped externally in PR #711 as `0719c3f6` from `f3e29d11` at 2026-10-25T20:43:25Z by vdimarco. Fresh six-job CI run40213698308 and deployments passed. Production index.html and combat.js are HTTP200 and exactly match the merged bytes; combat SHA-256 `24933b759fab55be014148c99d0c0ed99777a676bee08e9b3a0a9940b0bc966d`. Eight production browser assertions and 60 action simulation assertions using downloaded production combat bytes pass. Desktop/portrait goon PNGs exactly match pre-release evidence. Agent Review was absent, and final authenticated pre-merge preview/both rebases were not completed; this external merge exception is not a waiver for future PRs. Canonical slide requirements and archive published with full evidence in fullswing-r70-goon-slide. Retry trig work is removed in focused cases; aggregate effect, affected Chrome120Hz/FPS, physical input and listening/full-playthrough remain unverified. All 20 scores and total/delta withheld.

### Round 31 — 2026-10-27 — rubric v1

- What changed: At a full run the lifted foot steps further out and the knee rises higher. At the bottom of a swing the trail steps wider and one heel lifts higher. The knee step still waits for the run clip, so a jog keeps the shin at rest. A quiet hang stays the mild trail. The rope hand is still aimed after the pose. Pose names, the twelve poses a second, the chase arm and the pitch stay as they are. John Lasseter, SIGGRAPH 1987, the exaggeration principle. The captured file was not rebuilt. Round 30's sky gather was already on main and was left as shipped.
- Why it helped: From behind the chase, the same run phase (0.438) put the feet at screen x 517 and 551 (34 px) and y 507 and 582 (75 px) before, and at x 476 and 556 (80 px) and y 484 and 578 (94 px) after. The same swing frame put the feet at x 475 and 550 (75 px) before, and at x 461 and 580 (119 px) after. A jog's feet stayed 0.286 m apart, the same as before. The rope-hand cosine at that swing frame stayed 0.873, the same figure as the previous pose.
- Screenshots: run before `docs/gauntlet/shots/r31-before-run.png` (crop `docs/gauntlet/shots/r31-before-run-crop.png`), after `docs/gauntlet/shots/r31-after-run.png` (crop `docs/gauntlet/shots/r31-after-run-crop.png`). Swing before `docs/gauntlet/shots/r31-before-swing.png` (crop `docs/gauntlet/shots/r31-before-swing-crop.png`), after `docs/gauntlet/shots/r31-after-swing.png` (crop `docs/gauntlet/shots/r31-after-swing-crop.png`).
- Next target: Color palette (6), tied with detail density, composition, atmosphere, character models, particles and UI. The grade is still one teal and one rose.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Unchanged. A lit shop's cloth is warmer along the hem than along the top. |
| Color palette | 6 | Unchanged. Cool shade stays teal and the step toward the sun stays rose. |
| Detail density | 6 | Unchanged. The shop awnings from round 16. |
| Texture and material quality | 7 | Unchanged. The masonry clay from round 23. |
| Composition and camera | 6 | Unchanged. On a fast rope the head still sits lower. The chase arm stays 4.5 m and the pitch stays −20°. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. |
| Animation smoothness | 8 | At the same run phase the feet sit 80 px apart across the frame and 94 px apart in height. At the same swing frame they sit 119 px apart. A jog does not take the step. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 6 | Unchanged. The cream lip and rose hem from round 21. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (26.7%). Street mean 75.4, saturation 0.58. |

- Aesthetics raw: 64 / 10 dimensions, index 64
- Playability raw: 46 / 10 dimensions, index 46
- Total: 110 / 200
- Delta vs last round: +1 (109 → 110). Animation smoothness 7 → 8. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 32 — 2026-10-27 — rubric v1

- What changed: The grade's dark end is violet, the sky's colour in the shade. Open shade stays teal. The step stays rose. A sunlit face takes amber. During play the boundary walks from the painted sunset to blue hour and back, over four minutes. At blue hour the violet takes the teal and the amber leaves. Bright lamps, the sun disc, and near-black ink stay. The painted strip is not replaced. James Gurney, Color and Light (2010): a shadow takes the sky's colour, and the light takes the hour's.
- Why it helped: On the street, every other pixel, violet was 8.2% and teal was 20.6% before. At the painted sunset violet is 18.9% and teal is 13.1%, with rose 39.0% and amber 15.3%. The same street at blue hour is violet 35.7%, teal 0.0%, amber 5.2%, rose 49.0%. A wall that is (49, 91, 54) at sunset is (53, 35, 101) at blue hour. A dark shade that was (60, 53, 34) is (63, 28, 54) already at sunset. The red awning at (250, 46, 59) and a rose step at (182, 46, 94) did not move. On the wall crop, mean green goes from 51.8 at sunset to 26.6 at blue hour, and mean blue from 67.8 to 102.1.
- Screenshots: before `docs/gauntlet/shots/r32-before-street.png`, sunset `docs/gauntlet/shots/r32-after-street.png`, blue hour `docs/gauntlet/shots/r32-blue-street.png`. The same wall: `docs/gauntlet/shots/r32-before-wall.png`, `docs/gauntlet/shots/r32-after-wall.png`, `docs/gauntlet/shots/r32-blue-wall.png`. Needle before `docs/gauntlet/shots/r32-before-needle.png`.
- Next target: Detail density (6), tied with composition, atmosphere, character models, particles and UI. The shop band is still one cloth.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Unchanged. A lit shop's cloth is warmer along the hem than along the top. |
| Color palette | 7 | The dark shade is violet and the open shade is still teal. At blue hour that teal is gone and the violet covers the shade. |
| Detail density | 6 | Unchanged. The shop awnings from round 16. |
| Texture and material quality | 7 | Unchanged. The masonry clay from round 23. |
| Composition and camera | 6 | Unchanged. On a fast rope the head still sits lower. The chase arm stays 4.5 m and the pitch stays −20°. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. |
| Animation smoothness | 8 | Unchanged. At the same run phase the feet sit 80 px apart across the frame and 94 px apart in height. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 6 | Unchanged. The cream lip and rose hem from round 21. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (20.4%). Street mean 73.6, saturation 0.60. |

- Aesthetics raw: 65 / 10 dimensions, index 65
- Playability raw: 46 / 10 dimensions, index 46
- Total: 111 / 200
- Delta vs last round: +1 (110 → 111). Color palette 6 → 7. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 33 — 2026-10-27 — rubric v1

- What changed: On a shop building, each floor above the street gets a limestone course at the floor line. The storey just above the shop is the deep one, about a quarter of the floor, with a dark lip and a sill, and its window starts higher so the sash is shorter than the floors above it. Higher floors get a thinner course, about a seventh of the floor. The stone is mixed on after the grade, so the violet and teal paper do not recolor it. It fades before it can shimmer. Glass towers are left alone. No new mesh. Francis D.K. Ching, Architecture: Form, Space, and Order: a string course marks the floor.
- Why it helped: The floors above the shop cloth were one window tile. On the street still, six limestone courses now stack up the near facades. The deepest, just above the red cloth, runs from image y 224 to 242. At x 600, y 235, the wall goes from (203, 55, 27) to (148, 133, 112). About 8.3% of the street pixels moved, mean absolute change 12.2. Glass that sat in the old lower sash is stone now (757 sampled pixels).
- Screenshots: before `docs/gauntlet/shots/r33-before-street.png`, after `docs/gauntlet/shots/r33-after-street.png`. The floors: `docs/gauntlet/shots/r33-before-floors.png`, `docs/gauntlet/shots/r33-after-floors.png`. Needle, where the courses are out of frame: `docs/gauntlet/shots/r33-before-needle.png`, `docs/gauntlet/shots/r33-after-needle.png`.
- Next target: Composition and camera (6), tied with atmosphere, character models, particles and UI. On a fast rope the head still sits lower, and the chase arm stays 4.5 m at −20°.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Unchanged. A lit shop's cloth is warmer along the hem than along the top. |
| Color palette | 7 | Unchanged. The dark shade is violet and the open shade is still teal. At blue hour that teal is gone. |
| Detail density | 7 | A limestone course sits on each floor above a shop. The one just above the cloth is the deep course, and that window's sash is shorter. |
| Texture and material quality | 7 | Unchanged. The masonry clay from round 23. |
| Composition and camera | 6 | Unchanged. On a fast rope the head still sits lower. The chase arm stays 4.5 m and the pitch stays −20°. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. |
| Animation smoothness | 8 | Unchanged. At the same run phase the feet sit 80 px apart across the frame and 94 px apart in height. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 6 | Unchanged. The cream lip and rose hem from round 21. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (20.4%). Street mean 77.1, saturation 0.58. |

- Aesthetics raw: 66 / 10 dimensions, index 66
- Playability raw: 46 / 10 dimensions, index 46
- Total: 112 / 200
- Delta vs last round: +1 (111 → 112). Detail density 6 → 7. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 34 — 2026-10-27 — rubric v1

- What changed: On a rope, off the ground, and faster than 11 m/s across, the chase arm lets out by up to 2.6 m past the length speed already asks for. It is all the way out by 16 m/s. A swing near 8 m/s keeps the ordinary arm. A stand stays at 4.5 m and −20°. The pitch on the swing is the lift that was already there. A wall still stops the arm. Mark Haigh-Hutchinson, Real-Time Cameras (2009): at speed the subject takes less of the frame so the space ahead stays readable.
- Why it helped: The same mid-swing, low in the arc at 18 m/s, held the body from screen y 400 to 533 (133 px) on a 4.46 m arm. The arm is now 6.98 m and the body runs from y 379 to 459 (80 px). The feet sit 74 px higher, so the avenue shows under them. Mean absolute change across the frame is 50.1, and 33% of the pixels moved. The camera was not against a wall. Standing still, the arm is 4.50 m and the pitch is −20°.
- Screenshots: before `docs/gauntlet/shots/r34-before-swing.png`, after `docs/gauntlet/shots/r34-after-swing.png`. The street, where this arm does not run: `docs/gauntlet/shots/r34-street.png`.
- Next target: Atmosphere (6), tied with character models, particles and UI. The far avenue still sits in the warm dust from round 15.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Unchanged. A lit shop's cloth is warmer along the hem than along the top. |
| Color palette | 7 | Unchanged. The dark shade is violet and the open shade is still teal. At blue hour that teal is gone. |
| Detail density | 7 | Unchanged. A limestone course sits on each floor above a shop. |
| Texture and material quality | 7 | Unchanged. The masonry clay from round 23. |
| Composition and camera | 7 | On the same fast rope the body shrinks from 133 px to 80 px and the arm goes from 4.46 m to 6.98 m. A stand stays at 4.5 m and −20°. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 6 | Unchanged. The cream belt from round 17. |
| Animation smoothness | 8 | Unchanged. At the same run phase the feet sit 80 px apart across the frame and 94 px apart in height. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 6 | Unchanged. The cream lip and rose hem from round 21. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (20.4%). Street mean 77.1, saturation 0.58. |

- Aesthetics raw: 67 / 10 dimensions, index 67
- Playability raw: 46 / 10 dimensions, index 46
- Total: 113 / 200
- Delta vs last round: +1 (112 → 113). Composition and camera 6 → 7. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 35 — 2026-10-27 — rubric v1

- What changed: The chase jacket gets a dark wine panel on the upper back, painted after the cel in the hips' own frame, so a roll carries it. It sits about 42 cm above the hip joint and stays off the chest and off the cream belt. No new mesh. Skinned triangles stay at 12,468. Mitchell, Francke, and Eng, Illustrative Rendering in Team Fortress 2 (2007): the material break is painted back onto the albedo, the same way the belt was.
- Why it helped: From behind at the rest chase (4.5 m, −20°), the jacket above the belt was one red. The upper back is now wine. At x 400, y 336, the cloth goes from (246, 106, 103) to (51, 17, 25). The panel covers about 35 by 22 pixels, and 460 of those pixels leave the red. The cream belt at y 364 stays (252, 249, 235). The head stays the hair and skin.
- Screenshots: before `docs/gauntlet/shots/r35-before-hero.png`, after `docs/gauntlet/shots/r35-after-hero.png`.
- Next target: Atmosphere (6), tied with particles and UI. The far avenue still sits in the warm dust from round 15.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Unchanged. A lit shop's cloth is warmer along the hem than along the top. |
| Color palette | 7 | Unchanged. The dark shade is violet and the open shade is still teal. At blue hour that teal is gone. |
| Detail density | 7 | Unchanged. A limestone course sits on each floor above a shop. |
| Texture and material quality | 7 | Unchanged. The masonry clay from round 23. |
| Composition and camera | 7 | Unchanged. On the same fast rope the body shrinks from 133 px to 80 px and the arm goes from 4.46 m to 6.98 m. |
| Atmosphere | 6 | Unchanged. The far avenue still sits in the warm dust from round 15. |
| Character models | 7 | A dark wine panel breaks the upper back. The cream belt stays. The figure is still simple. Skinned triangles stayed at 12,468. |
| Animation smoothness | 8 | Unchanged. At the same run phase the feet sit 80 px apart across the frame and 94 px apart in height. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 6 | Unchanged. The cream lip and rose hem from round 21. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (20.4%). Street mean 77.1, saturation 0.58. |

- Aesthetics raw: 68 / 10 dimensions, index 68
- Playability raw: 46 / 10 dimensions, index 46
- Total: 114 / 200
- Delta vs last round: +1 (113 → 114). Character models 6 → 7. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 36 — 2026-10-27 — rubric v1

- What changed: The low air keeps its sunset rose. As the hour walks to blue hour, that dust walks toward violet (0.28, 0.20, 0.68) and the mix goes from 0.78 to 0.92. Looking up stays the painted sky. A red awning at (196, 47, 32) and an ink line at (20, 10, 24) did not move. James Gurney, Color and Light (2010): the air takes the colour of the sky at that hour. The height split is the street layer already there, from Carsten Wenzel, SIGGRAPH 2006.
- Why it helped: At blue hour the street band was 15.2% violet and 74.2% rose. It is now 29.0% violet and 59.5% rose. At x 432, y 160, the haze goes from (95, 45, 56) to (57, 29, 89). Mean absolute change 14.5. The same pixel at the painted sunset stays (95, 45, 56), matching the street from round 33. 94.4% of the sunset frame is identical.
- Screenshots: blue hour before `docs/gauntlet/shots/r36-before-blue.png`, after `docs/gauntlet/shots/r36-after-blue.png`. Sunset, where the dust does not move: `docs/gauntlet/shots/r36-sunset.png`.
- Next target: Particles and VFX (6), tied with UI. The cream trail from round 19 is still one fleck.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Unchanged. A lit shop's cloth is warmer along the hem than along the top. |
| Color palette | 7 | Unchanged. The dark shade is violet and the open shade is still teal. At blue hour that teal is gone. |
| Detail density | 7 | Unchanged. A limestone course sits on each floor above a shop. |
| Texture and material quality | 7 | Unchanged. The masonry clay from round 23. |
| Composition and camera | 7 | Unchanged. On the same fast rope the body shrinks from 133 px to 80 px and the arm goes from 4.46 m to 6.98 m. |
| Atmosphere | 7 | At blue hour the low haze goes from rose to violet. At x 432, y 160 it goes from (95, 45, 56) to (57, 29, 89). Sunset stays the warm dust. |
| Character models | 7 | Unchanged. A dark wine panel breaks the upper back. |
| Animation smoothness | 8 | Unchanged. At the same run phase the feet sit 80 px apart across the frame and 94 px apart in height. |
| Particles and VFX | 6 | Unchanged. The cream trail from round 19. |
| UI polish | 6 | Unchanged. The cream lip and rose hem from round 21. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (20.4%). Street mean 77.1, saturation 0.58. |

- Aesthetics raw: 69 / 10 dimensions, index 69
- Playability raw: 46 / 10 dimensions, index 46
- Total: 115 / 200
- Delta vs last round: +1 (114 → 115). Atmosphere 6 → 7. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 37 — 2026-10-27 — rubric v1

- What changed: A fast rope now leaves three cream puffs along the air behind the body, stepped back along the velocity, instead of one fleck every 0.08 s. They are the same comic puff. The gate is unchanged: off the ground, off a wall, faster than 10, rope attached. Reeves, Particle Systems (SIGGRAPH 1983): the particles are born along the path the body just traveled.
- Why it helped: On the same mid-swing (18 m/s, arm 6.91 m), 11,898 pixels became cream. A puff at (212, 100) goes from (64, 69, 30) to (249, 252, 236). The trail crosses the avenue behind the body. A stand still returns before any birth.
- Screenshots: before `docs/gauntlet/shots/r37-before-swing.png`, after `docs/gauntlet/shots/r37-after-swing.png`.
- Next target: UI polish (6). The cream lip and rose hem from round 21.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Unchanged. A lit shop's cloth is warmer along the hem than along the top. |
| Color palette | 7 | Unchanged. The dark shade is violet and the open shade is still teal. At blue hour that teal is gone. |
| Detail density | 7 | Unchanged. A limestone course sits on each floor above a shop. |
| Texture and material quality | 7 | Unchanged. The masonry clay from round 23. |
| Composition and camera | 7 | Unchanged. On the same fast rope the body shrinks from 133 px to 80 px and the arm goes from 4.46 m to 6.98 m. |
| Atmosphere | 7 | Unchanged. At blue hour the low haze goes from rose to violet. At x 432, y 160 it goes from (95, 45, 56) to (57, 29, 89). |
| Character models | 7 | Unchanged. A dark wine panel breaks the upper back. |
| Animation smoothness | 8 | Unchanged. At the same run phase the feet sit 80 px apart across the frame and 94 px apart in height. |
| Particles and VFX | 7 | Three cream puffs mark the air behind a fast rope. 11,898 pixels became cream on the same mid-swing. They are still flat comic puffs. |
| UI polish | 6 | Unchanged. The cream lip and rose hem from round 21. |
| Responsiveness and input latency | 6 | Unchanged. No new pass and no new draw. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (20.4%). Street mean 77.1, saturation 0.58. |

- Aesthetics raw: 70 / 10 dimensions, index 70
- Playability raw: 46 / 10 dimensions, index 46
- Total: 116 / 200
- Delta vs last round: +1 (115 → 116). Particles and VFX 6 → 7. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 38 — 2026-10-27 — rubric v1

- What changed: The compass dial was a blank cream disc. It now carries a rose ring and four ink ticks, painted in the same paper as the plate's hem. The ticks stay put. The arrow is a second mark and still turns on its own. The row box does not move.
- Why it helped: The face of the dial was one cream. At (984, 38) that cream goes from (255, 249, 234) to the ink (20, 10, 24). At (976, 28) it goes to the rose (231, 160, 180). Sixteen cream pixels become ink and 118 become rose. At 1280×720 the row stayed top 12, bottom 63, left 199, right 1081.
- Screenshots: before `docs/gauntlet/shots/r38-before-hud.png`, after `docs/gauntlet/shots/r38-after-hud.png`.
- Next target: Lighting (7). The street is still one warm key.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 7 | Unchanged. A lit shop's cloth is warmer along the hem than along the top. |
| Color palette | 7 | Unchanged. The dark shade is violet and the open shade is still teal. At blue hour that teal is gone. |
| Detail density | 7 | Unchanged. A limestone course sits on each floor above a shop. |
| Texture and material quality | 7 | Unchanged. The masonry clay from round 23. |
| Composition and camera | 7 | Unchanged. On the same fast rope the body shrinks from 133 px to 80 px and the arm goes from 4.46 m to 6.98 m. |
| Atmosphere | 7 | Unchanged. At blue hour the low haze goes from rose to violet. At x 432, y 160 it goes from (95, 45, 56) to (57, 29, 89). |
| Character models | 7 | Unchanged. A dark wine panel breaks the upper back. |
| Animation smoothness | 8 | Unchanged. At the same run phase the feet sit 80 px apart across the frame and 94 px apart in height. |
| Particles and VFX | 7 | Unchanged. Three cream puffs mark the air behind a fast rope. |
| UI polish | 7 | A rose ring and four ink ticks sit on the compass dial. The row box did not move. It is still a flat sticker. |
| Responsiveness and input latency | 6 | Unchanged. CSS and one extra svg. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (20.4%). Street mean 77.1, saturation 0.58. |

- Aesthetics raw: 71 / 10 dimensions, index 71
- Playability raw: 46 / 10 dimensions, index 46
- Total: 117 / 200
- Delta vs last round: +1 (116 → 117). UI polish 6 → 7. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.

### Round 39 — 2026-10-27 — rubric v1

- What changed: The six street lamps nearest the camera print a warm disc on the pavement, full inside 1.1 m and gone by 6.4 m. It is mixed after the grade and before the haze, and it stays off the ink. James Gurney, Color and Light (2010): a local light colours the nearby surface and falls off. The shop spill already uses that on the wall.
- Why it helped: From the lamp shot, 1.65 m up and 9 m from the post, 28,074 pixels shift amber (red up by at least 15, blue down by at least 8). At (482, 300) the pavement goes from (23, 65, 54) to (49, 63, 24). At (372, 206) it goes from (59, 30, 34) to (194, 130, 54). The lamp post at (482, 274) stays ink (13, 16, 73). 84.8% of the frame is identical.
- Screenshots: before `docs/gauntlet/shots/r39-before-lamp.png`, after `docs/gauntlet/shots/r39-after-lamp.png`.
- Next target: Detail density (7). A limestone course sits on each floor above a shop. The wall between those courses is still one slab.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 8 | A warm disc sits on the pavement under a street lamp. At (482, 300) it goes from (23, 65, 54) to (49, 63, 24). The lamp post stays ink. It is still one local pool, not a lit city. |
| Color palette | 7 | Unchanged. The dark shade is violet and the open shade is still teal. At blue hour that teal is gone. |
| Detail density | 7 | Unchanged. A limestone course sits on each floor above a shop. |
| Texture and material quality | 7 | Unchanged. The masonry clay from round 23. |
| Composition and camera | 7 | Unchanged. On the same fast rope the body shrinks from 133 px to 80 px and the arm goes from 4.46 m to 6.98 m. |
| Atmosphere | 7 | Unchanged. At blue hour the low haze goes from rose to violet. At x 432, y 160 it goes from (95, 45, 56) to (57, 29, 89). |
| Character models | 7 | Unchanged. A dark wine panel breaks the upper back. |
| Animation smoothness | 8 | Unchanged. At the same run phase the feet sit 80 px apart across the frame and 94 px apart in height. |
| Particles and VFX | 7 | Unchanged. Three cream puffs mark the air behind a fast rope. |
| UI polish | 7 | Unchanged. A rose ring and four ink ticks sit on the compass dial. |
| Responsiveness and input latency | 6 | Unchanged. Six extra uniforms on the ground shader. No input timing was measured. |
| Controls feel | 5 | Unchanged. |
| Mission clarity | 4 | Unchanged. Not played. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. Not played as a session. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 5 | Unchanged. |
| Sound design | 4 | Unchanged. |
| Variety | 4 | Unchanged. |
| Performance stability | 6 | `qa/vr/render.mjs` passed, including flat play, the painted-sky checks, the lit-sphere cel check, and the canyon ink lines (20.4%). Street mean 77.2, saturation 0.59. |

- Aesthetics raw: 72 / 10 dimensions, index 72
- Playability raw: 46 / 10 dimensions, index 46
- Total: 118 / 200
- Delta vs last round: +1 (117 → 118). Lighting 7 → 8. Playability unchanged.

Playability was scored from a flat boot and the city render check, not a full playthrough. OpenSpec CLI validation was not run; the `openspec` command is not installed.



Performance increment 71 (pending): nearTraffic now materializes only its final winner; selection/distance/paint snapshots match 300 original-query comparisons, filter/tie/ownership checks and existing action simulation. Five SwiftShader car-scene assertions pass at 640×360 and 390×844 with exact nonblank before/after PNGs. Fixture result records/paint arrays 4→1; no FPS/latency claim or inherited points, all twenty limitations in fullswing-r71-traffic-winner/README.md, total withheld. Full release gates and canonical/archive remain pending. Prior #712 docs/archive merged externally as aa7368ee without AgentReview/fresh six-job CI/final authenticated preview/required rebases; not a waiver. Current production byte checks only, combined runtime behavior unverified.


Increment 71 shipped in PR #786 as fafc9085 after all six CI jobs, Entire Gates, both deployments, current authenticated preview and rebases before/after preview passed. Human-authorized vdimarco approval satisfied Entire; disabled Vercel Agent Review is unavailable, not passed. Production index/main/cars/actionview raw bytes match exactly; downloaded production traffic queries and five SwiftShader desktop/portrait browser assertions pass with unchanged nonblank images. Canonical winner scenarios and archive follow the verified release in a separate documentation PR. Four progressively closer result/paint allocations become one; no FPS or affected Chrome120Hz benefit claim. All twenty dimensions remain unscored and total/delta withheld. Evidence: fullswing-r71-traffic-winner.
