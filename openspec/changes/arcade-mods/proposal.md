# Arcade mods for Claude Code

The crew builds the Cottage Arcade with Claude Code. Claude Code now takes mods: plugins whose function hooks run inside Claude Code, like middleware. A mod can draw a pane or a band above the prompt, change the spinner, show a toast or a status line, play a sound, add a slash command, and block or change a tool call.

This change adds ten mods that bring the arcade into that work. Some are games to play while Claude works. Some put an arcade skin on Claude Code. Two guard the house rules. Most of them reuse game code, art data or sound that the arcade already has.

## Scope

- Add `mods/`, a plugin marketplace with ten mods:
  - `announcer`: the Shore of the Ancients announcer calls green test streaks.
  - `cabinet-spinner`: spinner words and end-of-turn lines from the game you work on, and arcade tokens.
  - `creel`: a bobber while a long command runs, and a Reel It In fish when it ends.
  - `loon-chicks`: subagents swim as Loon Echo chicks.
  - `tilt-sensor`: the house rules as a pinball tilt.
  - `wanted-level`: Crimson Rogue stars for risky moves.
  - `task-breakout`: the open OpenSpec tasks as a brick wall.
  - `attract-mode`: a Primordia Lenia dish when the session is idle.
  - `full-tilt`: the Full Tilt table in a pane, with the real physics.
  - `photo-booth`: the screenshots that a QA run saves.
- Each mod is a folder with its manifest, its hooks module and its tests.
- `mods/sync.mjs` copies the game code, the fish data, the announcer clips and the shared helpers into the mods. With `--check` it fails when a copy is stale.
- `mods/check.mjs` validates, tests and type-checks every mod. `mods/qa/frames.mjs` draws the animated panes to PNG files and times their frames.
- A README section says what each mod does and how to turn it on.

## What changes for the crew

Nothing loads by itself. A person turns on one mod or all of them, in their own Claude Code session. The game pages and the arcade do not change.
