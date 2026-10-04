# Tasks

## Setup

- [x] Add `mods/` with the marketplace manifest, `mods/shared/` (check runs, merges, cells, random, days) and a `.gitignore` line for the types Claude Code lays in a loaded mod.
- [x] Write `mods/sync.mjs`: copy the shared helpers, the Full Tilt physics and table, the Primordia core and species, the Reel It In species and the announcer clips with their credits; `--check` fails on a stale copy.
- [x] Write `mods/check.mjs`: sync check, a cabinet for every game in the switcher, `claude plugin validate`, `claude plugin test` and `tsc` for every mod.

## Mods

- [x] `announcer`: first blood, multi kills, streaks, shut down, merges, the CI events, the toasts, the clips, the sound and greeting settings.
- [x] `cabinet-spinner`: a cabinet for every game in `public/arcade/switch.js`, the folder map, terminal spinner verbs, the end line, tokens, FREE PLAY and `/change`.
- [x] `creel`: the bobber band, the catch rules, the legend on a merge, the store, the daily goal and `/creel`.
- [x] `loon-chicks`: chicks from spawns and subagent events, the nest, the eel, the clutch and `/chicks`.
- [x] `tilt-sensor`: the four house rules, DANGER after an edit, TILT on a commit, the builds that close a rule, `git status` at commit time and `/tilt-sensor` with Reset.
- [x] `wanted-level`: the risky moves and their stars, the fade, the block at five stars and `/lay-low`.
- [x] `task-breakout`: the task lists, the active change, the wall, the ball, a brick per checked box, STAGE CLEAR, the archive suggestion and `/breakout`.
- [x] `attract-mode`: the idle timer, the Lenia dish, reseeding, closing at the next prompt and `/attract`.
- [x] `full-tilt`: the table, the keys, scoring, three balls, the best score, the pause and the SVG table for the apps.
- [x] `photo-booth`: QA commands, the shot folders, the pane with `p` and `n`, and the list on the apps.

## Checks

- [x] `node mods/sync.mjs --check` passes.
- [x] `node mods/check.mjs` passes: every mod validates, its tests pass (87 in all) and it type-checks.
- [x] `node mods/qa/frames.mjs` keeps each animated pane under 4 ms a frame (Task Breakout 0.4 ms, attract mode 1.9 ms, Full Tilt 1.0 ms), and the PNG of each pane looks right.
- [x] `openspec validate arcade-mods --strict` passes.
- [ ] Load the mods in a live session and try each one.
- [x] Add the README section.

## Checks that ran and checks that did not

- The tests run each mod against the Claude Code engine with `claude plugin test`: the hooks, the drawings on the terminal, desktop, VS Code and mobile surfaces that each mod draws on, the Buttons and their hotkeys, and the timers on a mock clock. A test answers every engine call itself, so it checks what the mod asked for, not what a surface paints.
- `mods/qa/frames.mjs` drew one frame of each animated pane to PNG, as the terminal's half-block cells and as the SVG the apps get. The pictures were checked by eye.
- Not checked: a live interactive session (the panes in a real terminal, the hotkeys from a real keyboard, the toasts and the status line as drawn), the kitty picture protocol, sound on macOS, and the desktop and mobile apps.
