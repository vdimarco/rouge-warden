# Stop the sound when a page is hidden

On a phone, a game kept playing music after the player left it: after the browser was minimised, after the screen locked, and after a switch to another tab or app. Only Reel It In and the Lab toys stopped their sound.

## Scope

- Add `public/arcade/quiet.js`. Every page that makes sound loads it first in `<head>`.
- Add it to the arcade page and to every game page with sound. In Full Swing (`/vr/`) keeps its own code; this change adds a pause for the phone (flat) mode there.
- Pause the SoundCloud songs in Get Plunger'd and Crimson Rogue.
- Add a test that fails when a page with sound does not load the script.

## Player-facing change

When the page is hidden, all sound stops. When the page is visible again, the sound that the guard stopped starts again. Sound that the player or the game had stopped stays stopped.
