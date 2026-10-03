# Primordia: a Lenia arcade game

Add a new Cottage Arcade cabinet, Primordia, inspired by Bert Chan's Lenia (chakazul.github.io/Lenia). The user asked for a fun, engaging game, "like an all-time great game", built on that simulation.

The player is a small glowing protist inside a living Lenia dish. Every creature in the dish is a real Lenia pattern from the published catalogue, simulated live. Orbium gliders are prey. Arc-shaped species from the max-fleet compilation (Paraptera, Pentapteryx, Hexapteryx, Heptapteryx) are hunters. The loop borrows Pac-Man's reversal: eat prey to fill a Frenzy meter, then turn on the hunters and eat them.

## Scope

- A static game at `public/primordia/` with no build step, playable with mouse, keyboard, touch and gamepad.
- Forty-second epochs that speed the dish up, followed by a choice of one of three mutations (roguelite upgrades).
- A Leviathan boss every third epoch, golden prey, combo chains, blooms and red tides as emergent events.
- A cabinet in the Action row of the arcade with its best score.
- Node tests for the Lenia behaviour the game relies on, and a Playwright smoke test for desktop and phone layouts.

## Out of scope

- Online leaderboards. Scores and the bestiary stay in local storage.
- Generated art. The cabinet image is a frame from the game.
