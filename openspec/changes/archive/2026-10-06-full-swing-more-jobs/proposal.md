# More odd jobs: a taxi fare and a purse snatcher

## Why

The player asked for better missions. Catch! is now fair, but the odd jobs are still the same five, and the car the player
can now steal has no job of its own.

## What changes

- **Taxi!** A fare waits on a street. Drive a car into the marker to take them; on foot they only shout for a car. Drive
  them to a pin across town before the clock runs out. A fast ride pays a tip. Get out of the car for more than 4 s and
  they walk off.
- **Stop, Thief!** A goon grabs a purse and runs off along the streets, turning corners. Knock him down before he gets
  away. The rope can yank him like any goon.
- The marker pool is now seven jobs; four are on offer at a time, as before.
- Job markers and their map pins stay on while you drive (only a taxi marker starts while driving).

## Impact

- `public/vr/js/jobs.js`: two job types, a street-grid run for the thief, the taxi's car rule at markers.
- `public/vr/js/main.js`: the hero's `driving` flag for the jobs, offers stay on while driving, fail lines.
- `public/vr/js/actionview.js`: marker colours for the new jobs.
- Tests: `qa/vr/action.test.mjs`, `qa/vr/action.e2e.mjs`.
