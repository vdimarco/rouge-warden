# The job sticker

The marker is a screen sticker, the same yellow comic chip as the prompts, not a new scene material. No render paper applies. The behaviour is adapted from the objective marker in Marvel's Spider-Man 2 (Insomniac, 2023): a label on the target, pinned to the frame when the target leaves it, with a gain or lose read on a chase. The drawing is original (the game's ink, yellow and Bangers type). Nothing is copied from that game's icons or UI.

`placeGoal` in `actionhud.js` decides the pixel. Off to the side, or behind the camera, the sticker uses the horizontal turn (positive to the right) so a runner on the street behind you is a left or right arrow, not an arrow into the sky. In front but off the top or bottom, it uses that edge. `main.js` feeds it the live `jobs.card` each frame, not the mission card's half-second copy, and updates the camera matrix first so a stepped test sees the chase view.

CLOSING means the horizontal distance fell by more than 1.5 m/s over the last half second. FALLING BEHIND means it grew by more than that. A crew fight drops the chase words and says CREW, because the runner is already down.
