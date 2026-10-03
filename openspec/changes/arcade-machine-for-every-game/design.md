# Design

**One machine per page a player can play.** A folder of `public/` with an `index.html` is a game, unless the test lists it as not a game (`arcade`, `icons`, `lib`, `.well-known`) or as covered by another machine (`breakthrough`). The four Lab toys are games, because each has its own page and the Lab page gives each a Play button.

**New machines go last.** The arcade picks screens by index, and it starts at machine 1. New machines come after the old ones, so no old index changes. A group named Lab holds the new machines in the machine list. A machine that no group names appears under More.

**Art comes from the real games.** Each screen is a frame saved from the real page as WebP, at most 60 KB. Moonwell, Olympus and BREAKTHROUGH have small tiles for the switcher, so the list does not load a 3.6 MB PNG.

**High scores come from each game's own save.** A save that cannot be read (junk, wrong type, zero, not a finite number) leaves the plain line. It never throws.

**The switcher finds the current game by the longest matching address.** `/lab/worlds/` is Small Worlds and `/lab/` is The Lab. An entry with `credits: false` stays off Crimson Rogue's end card. The four Lab toys use it, because the Lab tile covers them.

**Crimson Rogue's end card.** When the last block is taller than the window, the roll stops with its bottom edge in view, so FIGHT AGAIN and ARCADE stay on screen.

**The test reads the files and then drives the page.** `qa/arcade/machines.mjs` scans `public/`, compares every machine with its switcher entry (same id, same name), and then walks to each machine, drops a token and presses START. It stops the page change and reads where the page was going, so it never loads a game. Anything it lets pass without a machine must be in a list with a reason.
