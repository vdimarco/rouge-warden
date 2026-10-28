# Eleven takes, one component

No new rendering technique is involved, so none of the usual art references fit. The voices are espeak-ng 1.51. Each resident keeps the line already written for them, with a different voice, pitch and speed. The samples are committed, so the game does not need espeak-ng to play.

Playback is its own audio component and a procedural mono wave at 11025. The first talk decodes the takes once. A later talk queues that giver's slice. `UpdateMusic(bool)` and the story bed are unchanged. `FeedbackSounds` stays the checkpoint, the complete sting and the dialogue sting. Resident talk no longer plays that sting, because the spoken line is the reply.

The line does not change CompletedMissions or the v1 save. It does not add a story step.
