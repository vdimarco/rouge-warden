# Tasks

- [x] List every playable page under `public/` and decide which have no machine (`breakthrough` only: the older build; its machine opens `/breakthrough2/`).
- [x] Make nine machines: The Lab, Small Worlds, Neon Ronin, Loon Echo, Tell Me, Take the Plunge, Up the Creek, Full Tilt, House Rules. Use art from the real games, each under 60 KB.
- [x] List every game in `public/arcade/switch.js`, with the longest matching address marking the current game.
- [x] Retire the old "never mention the Lab" rule in `qa/lab/hidden.mjs` and the README. Add `noindex` to Small Worlds.
- [x] Keep Crimson Rogue's end card inside the window with the longer list.
- [x] Link Tell Me and BREAKTHROUGH back to the arcade, also over their start and end cards.
- [x] Wrap the older high-score blocks in `try`/`catch`.
- [x] Make Tab bring the focused machine to the middle.
- [x] Give Primordia (merged from main) a switcher entry.
- [x] Write `qa/arcade/machines.mjs` and run each new check on the code from before its fix: it fails there.
- [ ] Validate the spec with the OpenSpec CLI when it is available.

## Checks

Run on the final tree, with the server on `public/` and Playwright from `/opt/node22/lib/node_modules`:

- `node qa/arcade/machines.mjs`: see the lane result in the pull request.
- `node qa/lab/hidden.mjs`: passes.
- `node qa/tellme/play.mjs` and `node qa/breakthrough2/play.mjs`: pass.

Not checked: a real phone, Safari on iOS, and a home-screen install. The OpenSpec CLI is not installed, so `openspec validate` did not run.
