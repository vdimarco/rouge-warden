# Full Swing missions gauntlet

Loop: missions, playability, controls, feel, UX, pacing and fun for In Full Swing. Focus group: playability. Reference: Marvel's Spider-Man 2. Rubric: [RUBRIC.md](RUBRIC.md). Original fiction and UI only.

### Round 1 — 2026-10-21 — rubric v1

- What changed: While a job has a goal, a comic sticker names it and shows the distance. On the Sludge Run it reads RUNNER (CREW once his crew is out). It sits on the goal in view. Off to the side, or behind the camera, it sits on the left or right edge and points the way to turn. A chase says CLOSING or FALLING BEHIND. The compass title says "Your job" during a job.
- Why it helped: A play of Mission 1 showed the bomb runner at the bottom of the chase camera, about 40 m away, while the training card said to swing at a gold ring and the compass was still titled "The nearest clog". Spider-Man 2 keeps the chase target readable, including when he leaves the frame, and tells you if you are gaining. The sticker does that without a new mission or a change to the timer.
- Screenshots: before `docs/gauntlet/fullswing-r1/before-chase.png`. After `docs/gauntlet/fullswing-r1/runner-closing.png` and `docs/gauntlet/fullswing-r1/runner-offscreen.png`.
- Next target: pacing (4), tied with sound design. Pacing is the one to change next: Mission 1's timer should not run against the training lesson. Sound stays at 4 until a round listens to it.

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting | 5 | Golden-hour sun and ink shadows read clearly, and they are not a filmed city at dusk. |
| Color palette | 6 | Yellow, red and sludge green are consistent and loud enough to separate the HUD from the blocks. |
| Detail density | 4 | Blocks, a few signs and simple streets. A swing reads as open space more than a dressed borough. |
| Texture and material quality | 3 | Flat fills. Little of the wear, glass or cloth a 2023 city uses to sell a surface. |
| Composition and camera | 4 | The chase camera looks at the skyline. The runner stays low in the frame even with the sticker on him. |
| Atmosphere | 5 | The dusk skyline and the lake have a mood. The street under the chase does not. |
| Character models | 3 | The hero and the gang read as simple comic figures at this distance. |
| Animation smoothness | 4 | Scored from still frames in software GL. Poses exist. Continuous motion was not watched. |
| Particles and VFX | 4 | Clog beams and the comic words are the effects in play. This chase frame had neither a hit nor a trail. |
| UI polish | 6 | The chips, the training card and the new sticker share one ink-and-yellow system and stay inside the window. |
| Responsiveness and input latency | 7 | The sticker and the mission card update on the stepped frame that moves the hero. No missed press showed up in the run. |
| Controls feel | 5 | Swing is hold-forward plus the mouse, with an auto target. It is not a one-button web swing, and the training still asks for the gold ring during the chase. |
| Mission clarity | 6 | The runner is named, measured, and marked when he leaves the view, and the compass says it is the job. The training card still gives a second target. |
| Pacing | 4 | The bomb timer, the eight-row training card and the gold-ring lesson all start together. After that, Mission 2 is twelve of the same clog. |
| Fun factor | 5 | Catching a marked runner is a readable chase now. The opening still splits attention, so the swing is not the whole of the first minute. |
| Difficulty curve | 5 | The runner jogs at 5.4 m/s once you can see him. The fail is a toast and a retry, then a short crew fight. |
| Feedback | 6 | CLOSING and FALLING BEHIND sit on the chase, next to the existing GO cue, hit-stop and focus meter. |
| Sound design | 4 | Not listened to this round (the playtest ran with audio disabled). The events have stingers. There is no chase bed that rises as the runner pulls away. |
| Variety | 5 | Odd jobs and crimes cover chase, carry, drive and fight. The story objective after Mission 1 does not. |
| Performance stability | 6 | Desktop play booted in software GL and the job tests passed with no page errors. Frame time on a real GPU was not measured. |

- Aesthetics raw: 44 / 10 dimensions, index 44
- Playability raw: 53 / 10 dimensions, index 53
- Total: 97 / 200
- Delta vs last round: — (first v1 score of this loop)

![Before the sticker, the chase card names the runner and the view does not](fullswing-r1/before-chase.png)

![RUNNER 38 m, CLOSING, on the runner](fullswing-r1/runner-closing.png)

![Turned away, the sticker sits on the left edge and points left](fullswing-r1/runner-offscreen.png)
