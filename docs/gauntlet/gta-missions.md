# GTA missions gauntlet

Loop: keep making NORD (the GTA row) clearer, more playable and more fun. Focus group: playability. Reference: GTA 6. Rubric: [RUBRIC.md](RUBRIC.md).

Unreal is not available here, so the native diamond was not captured. The title and the play client were loaded. Job choice is covered by `Scripts/test_job_rules.py` (126 assertions, 0 failures). A round that fails that test or the syntax check is reverted.

### Baseline — 2026-10-21 — rubric v1

- What changed: Nothing. Re-score of the build before round 1, for rubric v1.
- Why it helped: Gives round 1 a number to move.
- Screenshots: none. The round 1 shots are this same shell.
- Next target: mission clarity (2), the lowest playability score.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | A sky, weather clock and worklight exist; streets are not a lit city. |
| Color palette | 5 | Ink, gold and paper stay consistent from the title badge through the HUD. |
| Detail density | 3 | Park fronts carry balconies and stairs; most other blocks are still plain boxes, and one tree repeats. |
| Texture and material quality | 3 | Some greystone and slate are in the apply step; many surfaces are flat comic fills. |
| Composition and camera | 4 | The chase camera and compact radar leave the street readable; a phone still watches a streamed frame. |
| Atmosphere | 4 | The festival premise, weather and comic captions give the park a mood; the city is not alive at GTA scale. |
| Character models | 3 | Eight crew styles read as people; hands and faces are still coarse. |
| Animation smoothness | 3 | Sprint, jump and comic tumbles exist; locomotion is not a full performance set. |
| Particles and VFX | 2 | Ink, a plunger tug and a hit flash cover the action; ambient effects are almost absent. |
| UI polish | 4 | The mission card, stars and banners are readable; French and English share the screen, and touch hid the retry. |
| Responsiveness and input latency | 3 | Play is a stream; phone steering was rebuilt for late input and is still late. |
| Controls feel | 4 | Graded steering, WASD and aim assist are in; driving is still the hard part. |
| Mission clarity | 2 | The story diamond is clear; after it the card said you were done, and side jobs stayed off the radar past 100 m. |
| Pacing | 3 | Two short story beats, then free roam with nothing pointing at the next job. |
| Fun factor | 4 | The terrace rescue and the lap have a trick and a joke; the side jobs are a delivery, a ram, a fight and an escape. |
| Difficulty curve | 4 | Mission 1 teaches the plunger, then the lap and the three-star escape step up; phone delivery timing is unproven. |
| Feedback | 4 | Mission-complete banners, wanted stars, a hit flash and comic sound words mark the hits. |
| Sound design | 3 | Stingers and a music selector exist; the city is not scored and nobody is voiced. |
| Variety | 3 | Two of eight story missions, four side jobs, and fists through a shotgun. |
| Performance stability | 4 | The six static scenes meet the frame budget; driving, co-op and the stream are not proven. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 34 / 10 dimensions, index 34
- Total: 68 / 200
- Delta vs last round: —

### Round 1 — 2026-10-21 — rubric v1

- What changed: After both story scenes, the mission card and the existing gold diamond name the nearest unfinished side job, with distance. A running job puts its objective, timer and restart hint on that card. A finished set points at the nearest replay. During the story the campaign objective keeps the diamond. On touch, MISSION RATÉE says Menu · Recover. Keyboard still says R réessaie.
- Why it helped: From the terrace the nearest job is about 199 m away, and from the spawn about 308 m, so the old 100 m radar dots never showed a job. The card also used to say the story was over while a side job was running. A phone player who failed had no retry line, because that line only named the R key.
- Screenshots: title `docs/gauntlet/gta-missions/r1-title-1280.png`, `r1-title-390.png`, `r1-title-320.png`. Play client, host offline, `r1-play-1280.png`. Menu with Recover `r1-play-menu-390.png`. No native before/after: Unreal is not in this container.
- Next target: variety (3), tied with responsiveness, pacing and sound. Variety is the one this loop can raise: the story still stops at mission 2 of 8.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. The new card uses the same gold and paper. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The diamond sits in the radar the story already used. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | The card is clearer, and touch and keyboard now disagree less about retry; the mixed-language HUD remains. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. |
| Controls feel | 4 | Unchanged. |
| Mission clarity | 4 | After the story the card names the next job, the diamond and the distance; touch failures name Menu · Recover. There is still no route line, and the story still stops at two missions. |
| Pacing | 3 | Finding a job is no longer a search; the session still ends the story after two beats. |
| Fun factor | 4 | Unchanged. The jobs are easier to start, not yet more fun to play. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | Unchanged. The failure line is clearer; the hits feel the same. |
| Sound design | 3 | Unchanged. |
| Variety | 3 | Unchanged. Still two story missions and four side jobs. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 36 / 10 dimensions, index 36
- Total: 70 / 200
- Delta vs last round: +2 (baseline 68). Mission clarity 2 → 4. Every other score held.

![GTA title at 1280](gta-missions/r1-title-1280.png)

![GTA title at 390](gta-missions/r1-title-390.png)

![GTA title at 320](gta-missions/r1-title-320.png)

![Play client at 1280, host offline](gta-missions/r1-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r1-play-menu-390.png)

### Round 2 — 2026-10-21 — rubric v1

- What changed: After the lap is banked, the mission card and the gold diamond lead mission 3, Still Life, Moving Target, along the north shore. The player tags the beam that never blinks, moves the worklight through a near lock and a far lock, sprints the opened path, and pulls the picnic clamp. The picnic is session state: the v1 save still stores CompletedMissions 0–2, and a reloaded finish offers the pond again. While it is open, side jobs and race replay wait. R, or Menu · Recover on touch, restores the current step and does not rewind it. Once the picnic is banked, the round 1 side-job guide returns.
- Why it helped: The story stopped at mission 2 of 8, so variety and pacing both sat on "two beats, then free roam." A third beat with a watch, a wrong answer, a route change and a sprint sits between the lap and the side jobs.
- Screenshots: title `docs/gauntlet/gta-missions/r2-title-1280.png`, `r2-title-390.png`, `r2-title-320.png`. Play client, host offline, `r2-play-1280.png`. Menu with Recover `r2-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and the Recover button still draw. No native pond capture: Unreal is not in this container. `Scripts/test_pond_rules.py` reports 373 assertions, 0 failures, on c++, g++ and clang++. `Scripts/test_job_rules.py` still reports 126 assertions, 0 failures. Syntax check `--both` passed for the campaign, the HUD, side jobs and the race-result test.
- Next target: sound design (3), tied with responsiveness. Responsiveness is the stream. This loop can put a cue on the pond beats.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. The pond posts use the same ink, gold, cream, lime and berry. |
| Detail density | 3 | Unchanged. The new posts are a few comic primitives on the north shore. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The diamond is the one the story already used. |
| Atmosphere | 4 | Unchanged. The postcard copy is in the card; the shore was not played. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. The blink is a post turning on and off. |
| UI polish | 4 | The card names mission 3, and touch says Menu · Recover. French and English still share the screen. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. |
| Controls feel | 4 | Unchanged. The dash uses the existing sprint. |
| Mission clarity | 4 | The card names the current pond step and the diamond marks it. There is still no route line, and the native card was not seen. |
| Pacing | 4 | A third story beat now sits between the lap and free roam. |
| Fun factor | 4 | The peel, the wrong beam and the irritated picnic are written. They were not played, so the feel score stays. |
| Difficulty curve | 4 | Unchanged. The new step is a short puzzle in front of the same side jobs. |
| Feedback | 4 | Unchanged. The pond reuses the checkpoint and complete cues. |
| Sound design | 3 | Unchanged. Those cues are the same three one-shots. |
| Variety | 4 | Three of eight story missions are now in the build, plus the four side jobs. The pond was not played in Unreal. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 38 / 10 dimensions, index 38
- Total: 72 / 200
- Delta vs last round: +2 (round 1 was 70). Pacing 3 → 4. Variety 3 → 4. Every other score held.

![GTA title at 1280](gta-missions/r2-title-1280.png)

![GTA title at 390](gta-missions/r2-title-390.png)

![GTA title at 320](gta-missions/r2-title-320.png)

![Play client at 1280, host offline](gta-missions/r2-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r2-play-menu-390.png)

### Round 3 — 2026-10-21 — rubric v1

- What changed: During mission 3's tag step, the local player hears a short original tick whenever the decoy beams change state. Tagging a blinking beam plays the existing dialogue cue. The neighborhood and race loops are unchanged.
- Why it helped: The puzzle is "which beam never blinks," and that blink was silent. The tick gives the watch a rhythm. A miss sounds like dialogue, not like the blink.
- Screenshots: title `docs/gauntlet/gta-missions/r3-title-1280.png`, `r3-title-390.png`, `r3-title-320.png`. Play client, host offline, `r3-play-1280.png`. Menu with Recover `r3-play-menu-390.png`. The title loaded with no page errors. The raw play page still logs the missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` specifier; the shell and Recover still draw. The tick was not heard: Unreal is not in this container. `Scripts/test_pond_rules.py` reports 385 assertions, 0 failures, on c++, g++ and clang++. Syntax check `--both` passed for the controller, the campaign and the music tests.
- Next target: responsiveness and input latency (3), now the only playability score at 3. It is the stream. This loop should not invent a stream fix to move that number.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. |
| Detail density | 3 | Unchanged. |
| Texture and material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. |
| Atmosphere | 4 | Unchanged. The shore still was not played. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. The blink is still a post turning on and off. |
| UI polish | 4 | Unchanged. |
| Responsiveness and input latency | 3 | Unchanged. Still a lagged stream. |
| Controls feel | 4 | Unchanged. |
| Mission clarity | 4 | Unchanged. The tick marks the blink; the card is still one line and was not seen in Unreal. |
| Pacing | 4 | Unchanged. |
| Fun factor | 4 | Unchanged. The tick was not heard in play. |
| Difficulty curve | 4 | Unchanged. |
| Feedback | 4 | The blink now has a tick and a wrong tag has the dialogue cue. The hits still use the same three one-shots, and none of this was heard. |
| Sound design | 4 | The tag step ticks with the decoys. The city still has two loops, and nobody is voiced. |
| Variety | 4 | Unchanged. Three of eight story missions. |
| Performance stability | 4 | Unchanged. |

- Aesthetics raw: 34 / 10 dimensions, index 34
- Playability raw: 39 / 10 dimensions, index 39
- Total: 73 / 200
- Delta vs last round: +1 (round 2 was 72). Sound design 3 → 4. Every other score held.

![GTA title at 1280](gta-missions/r3-title-1280.png)

![GTA title at 390](gta-missions/r3-title-390.png)

![GTA title at 320](gta-missions/r3-title-320.png)

![Play client at 1280, host offline](gta-missions/r3-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r3-play-menu-390.png)
