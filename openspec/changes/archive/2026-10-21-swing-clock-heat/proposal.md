## Why

A chase that is pulling away turns the card hot. A clock about to run out, a person already falling, and a balloon about to leave the sky still use the ordinary ink pill. Spider-Man 2 uses one urgent treatment when the objective is getting away.

## What changes

- A job whose opening clock is at least 12 seconds turns the card hot once 8 seconds remain, or a quarter of that opening clock, whichever is less. Putting time back above that line brings the ink pill back.
- A clock that opened under 12 seconds does not heat from time alone. The 3.5 second edge and the 1.2 second balloon slip stay ink.
- When the Sludge Run's crew arrives, that stretch's opening clock is the longer of the clock the job opened with and the time now on it.
- A falling person who has not been caught turns the card hot. A free balloon at or above 140 m turns the card hot.
- A won job and the clog card stay the ink pill. Pulling away still heats the card.

## Capabilities

### Added Capabilities

- `swing-jobs`: a job about to slip turns the card hot.

## Impact

`public/vr/js/jobs.js`, `public/vr/js/ui.js`, `public/vr/js/main.js`, `qa/vr/clockheat.e2e.mjs`, `qa/vr/action.test.mjs`.
