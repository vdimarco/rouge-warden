# Additive loop, separate from the two cooked beds

No new rendering technique is involved, so none of the usual art references fit. This is audio. ACE-Step, which produced the two cooked loops, is not in this container, so the third bed is original additive synthesis in `QuebecStoryBed.h`.

The loop is 22050 Hz, four bars of 16 beats at 84, 252000 frames, about 11.43 seconds. D minor: bass, a lead panned a little left and right, chord stabs, and a short tick on each beat. The first sample and the sample at the wrap are both silent, so the restart meets the downbeat.

Playback is a second audio component and a procedural stereo wave. The PCM is built once and queued again before the buffer runs out. `UpdateMusic(bool)` still chooses only the race loop or the neighborhood loop, and it still logs only when that pointer changes. While the story bed plays, that call is skipped, so opening a beat does not log a new selection. When the beat ends, the existing neighborhood or race pointer fades back in and `UpdateMusic` runs.

The line does not change CompletedMissions or the v1 save. It does not add a story step.
