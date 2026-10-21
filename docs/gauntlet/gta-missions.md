# GTA missions gauntlet

Reference game: GTA 6. Scores follow Vaughn's rubric of 2026-10-21. `docs/gauntlet/RUBRIC.md` was not on `main` when this file was written, so this file records rubric version **v1** from that message. A later rubric-version change means the current build is scored again as a new baseline.

Each group index is `(group sum / (10 × dimension count)) × 100`. Total is the aesthetics index plus the playability index, maximum 200. This loop changes missions, controls, feel, UX, pacing and fun. The next target is the lowest playability score. Ties are broken toward the gap this loop can change in the game.

The native city does not run in this container (no Unreal). Scores use the mission, HUD and control code, the job-rules tests, and the pages that did load. They are not a played session of GTA 6.

## Baseline — build before round 1

- **Round:** 0
- **Date:** 2026-10-21
- **Rubric:** v1
- **What changed:** Nothing. Re-score of the current build for rubric v1.
- **Why it helped:** Sets the baseline the later rounds move.
- **Screenshots:** None. The round 1 shots below are this same shell; the mission card change is native HUD code and is not in these pictures.

### Aesthetics — raw 34 / 100, index 34

| Dimension | Score | Reason |
|---|---:|---|
| Lighting | 3 | A sky, weather clock and worklight exist; streets are not a lit, time-of-day city. |
| Color palette | 5 | Ink, gold and paper stay consistent from the title badge through the HUD. |
| Detail density | 3 | Park fronts carry balconies and stairs; most other blocks are still plain boxes, and one tree repeats. |
| Texture / material quality | 3 | Some greystone and slate are in the apply step; many surfaces are flat comic fills. |
| Composition and camera | 4 | The chase camera and compact radar leave the street readable; a phone still watches a streamed frame. |
| Atmosphere | 4 | The festival premise, weather and comic captions give the park a mood; the city is not alive at GTA scale. |
| Character models | 3 | Eight crew styles read as people; hands and faces are still coarse. |
| Animation smoothness | 3 | Sprint, jump and comic tumbles exist; locomotion is not a full performance set. |
| Particles and VFX | 2 | Ink, a plunger tug and a hit flash cover the action; ambient effects are almost absent. |
| UI polish | 4 | The mission card, stars and banners are readable; French and English share the screen, and touch hid the retry. |

### Playability — raw 34 / 100, index 34

| Dimension | Score | Reason |
|---|---:|---|
| Responsiveness / input latency | 3 | Play is a stream; phone steering was rebuilt for late input and is still late. |
| Controls feel | 4 | Graded steering, WASD and aim assist are in; driving is still the hard part. |
| Mission clarity | 2 | The story diamond is clear; after it the card said you were done, and side jobs stayed off the radar past 100 m. |
| Pacing | 3 | Two short story beats, then free roam with nothing pointing at the next job. |
| Fun factor | 4 | The terrace rescue and the lap have a trick and a joke; the side jobs are a delivery, a ram, a fight and an escape. |
| Difficulty curve | 4 | Mission 1 teaches the plunger, then the lap and the three-star escape step up; phone delivery timing is unproven. |
| Feedback / juice | 4 | Mission-complete banners, wanted stars, a hit flash and comic sound words mark the hits. |
| Sound design | 3 | Stingers and a music selector exist; the city is not scored and nobody is voiced. |
| Variety | 3 | Two of eight story missions, four side jobs, and fists through a shotgun. |
| Performance stability | 4 | The six static scenes meet the frame budget; driving, co-op and the stream are not proven. |

- **Total:** 68
- **Delta vs last round:** —
- **Next target:** Mission clarity (2), the lowest playability score.

## Round 1 — 2026-10-21

- **Round:** 1
- **Date:** 2026-10-21
- **Rubric:** v1
- **What changed:** After both story scenes, the mission card and the existing gold diamond name the nearest unfinished side job, with distance. A running job puts its objective, timer and restart hint on that card. A finished set points at the nearest replay. During the story the campaign objective keeps the diamond. On touch, MISSION RATÉE says Menu · Recover. Keyboard still says R réessaie.
- **Why it helped:** From the terrace the nearest job is about 199 m away, and from the spawn about 308 m, so the old 100 m radar dots never showed a job. The card also used to say the story was over while a side job was running. A phone player who failed had no retry line, because that line only named the R key.
- **Screenshots:** The arcade title loads. The play client loads and shows the host offline, which is the real state without the game PC. The menu shows Recover, the control the failure line now names. The native diamond cannot be captured here.

![GTA title at 1280](gta-missions/r1-title-1280.png)

![GTA title at 390](gta-missions/r1-title-390.png)

![GTA title at 320](gta-missions/r1-title-320.png)

![Play client at 1280, host offline](gta-missions/r1-play-1280.png)

![Menu on a 390-wide screen, Recover visible](gta-missions/r1-play-menu-390.png)

Checks: `python3 games/nord-unreal/Scripts/test_job_rules.py` — 126 assertions, 0 failures, on c++, g++ and clang++. Syntax check of the three changed cpp files passed for game and editor. Opening the play page from the raw `Browser/` folder logs a missing `@epicgames-ps/lib-pixelstreamingfrontend-ue5.8` import; the shell and menu still drew. That import is how this folder is served here, not a change in this round.

### Aesthetics — raw 34 / 100, index 34

| Dimension | Score | Reason |
|---|---:|---|
| Lighting | 3 | Unchanged. Sky and worklight only. |
| Color palette | 5 | Unchanged. The new card uses the same gold and paper. |
| Detail density | 3 | Unchanged. |
| Texture / material quality | 3 | Unchanged. |
| Composition and camera | 4 | Unchanged. The diamond sits in the radar the story already used. |
| Atmosphere | 4 | Unchanged. |
| Character models | 3 | Unchanged. |
| Animation smoothness | 3 | Unchanged. |
| Particles and VFX | 2 | Unchanged. |
| UI polish | 4 | The card is clearer, and touch and keyboard now disagree less about retry; the mixed-language HUD remains. |

### Playability — raw 36 / 100, index 36

| Dimension | Score | Reason |
|---|---:|---|
| Responsiveness / input latency | 3 | Unchanged. Still a lagged stream. |
| Controls feel | 4 | Unchanged. |
| Mission clarity | 4 | After the story the card names the next job, the diamond and the distance; touch failures name Menu · Recover. There is still no route line, and the story still stops at two missions. |
| Pacing | 3 | Finding a job is no longer a search; the session still ends the story after two beats. |
| Fun factor | 4 | Unchanged. The jobs are easier to start, not yet more fun to play. |
| Difficulty curve | 4 | Unchanged. |
| Feedback / juice | 4 | Unchanged. The failure line is clearer; the hits feel the same. |
| Sound design | 3 | Unchanged. |
| Variety | 3 | Unchanged. Still two story missions and four side jobs. |
| Performance stability | 4 | Unchanged. |

- **Aesthetics index:** 34 (raw 34 / 100, 10 dimensions)
- **Playability index:** 36 (raw 36 / 100, 10 dimensions)
- **Total:** 70
- **Delta vs last round:** +2 (baseline total 68). Mission clarity 2 → 4. Every other score held.
- **Next target:** Variety (3), tied with responsiveness, pacing and sound. Variety is the one this loop can raise: the story still stops at mission 2 of 8.
