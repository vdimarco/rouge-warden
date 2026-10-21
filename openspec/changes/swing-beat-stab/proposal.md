## Why

A clog beat takes the mission card with the same one-second countdown a trial uses. Spider-Man 2 marks a mission change with a short stab, and leaves the countdown for a start you chose.

## What changes

- A job that carries a mission name plays a short brass stab when it starts.
- A job with no mission name, a crime, and a trial still play the trial countdown.
- The first flush plays neither. The second flush, the falling rescue, plays the stab. The King still sleeps.

## Capabilities

### Modified Capabilities

- `swing-sound`: a mission stabs, and a trial still counts in.

## Impact

`public/vr/js/audio.js`, `public/vr/js/jobs.js`, `public/vr/js/main.js`, `qa/vr/beatstab.e2e.mjs`, `qa/vr/audio.mjs`.
