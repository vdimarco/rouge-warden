---
name: arcade-machine
description: Give a game its machine in every view of the Cottage Arcade. Use when adding a new game, moving or renaming one, shipping a visible update to one, or when a game is missing from the Corridor, the New or Updated orders, or All Games. A game is not done until it has a machine in the Corridor, in the game-updates orders, and in All Games.
---

# Arcade machine

A game ships with its machine in the same pull request. The machine has to stand in every view, not only the homepage row. A game that is only on the Lab page, or only in the switcher, is unfinished work.

`AGENTS.md`, section "New games", has the field-by-field detail for each file. This skill is the list of places and the order to do them in.

## The places

Use one id, one title and one route everywhere.

| View | File | What to add |
| --- | --- | --- |
| Corridor | `public/corridor/index.html` | A `PIECES` entry after the last cabinet of its group, its `ART` screen (448 by 370 WebP, under 60 KB, inline), and its route in the baked `DATES` |
| Game updates (New and Updated orders) | `public/arcade/game-dates.json` | The game's `path`, `added` and `updated`. Copy the same pair into the Corridor's `DATES` |
| All Games and the in-game switcher | `public/arcade/switch.js` | A `GAMES` entry. Leave `labOnly` off, so All Games lists it |
| Homepage row (the classic view) | `public/index.html` | The `<article class="cab">` and the id in its group's `games` array |
| Lab page, for a Lab game | `public/lab/index.html` | Its card |

`labOnly: true` hides a game from All Games. Do not set it on a new game. Set it only when the user asks for a game to be kept out of All Games.

## Steps

1. Add the switcher entry and the homepage cabinet.
2. Add the Corridor cabinet. Renumber `n` so there is no gap. Then raise every written count by one: `--n`, the aria label, the role line, the index, the counter, the count in words (twice), `uPP` and `uPC`, the loop bound, `lightPP` and `lightPC`, and the screen light offset. Two light slots for each cabinet.
3. Make the screen art from the running game, in the game's palette, and inline it in `ART`.
4. Write the dates. They are git committer dates, not typed dates: `added` is the oldest commit that touches the game's folder and `updated` is the newest. Commit the game first, then in a clone with full history run `node qa/arcade/game-dates.mjs` and commit the file. In a shallow or partial clone that script gives wrong dates for older games, so write only this game's entry by hand, from `git log -1 --format=%cI -- <folder>`. Copy the pair into the Corridor's `DATES`. `node qa/arcade/game-dates.test.mjs` compares the file with git.
5. Add the game to the Corridor list in `qa/arcade/machines.mjs` (`ADDED`: id, title, kind, art key, the cabinet it stands after, and `last` when it ends its group). Add the next number to `WORDS` when the count passes it.
6. Serve the site and run `node qa/arcade/machines.mjs`. Open the Corridor, the New and Updated orders, All Games and the homepage row, and find the machine in each. Opening it loads the game.

## When a game changes

A visible change to a game moves it in the Updated order. After the game's commit, write its new `updated` in `game-dates.json` and in the Corridor's `DATES` the same way as step 4. A stale `updated` leaves the game where it was in the Updated order. Replace the screen art when the game no longer looks like it.

## Done when

- The Corridor has the cabinet, numbered with no gap, with its own screen art.
- The New and Updated orders place it by its dates, in the Corridor and in All Games.
- All Games lists it and search finds it by name and subtitle.
- The homepage row has it in the right group and place.
- `node qa/arcade/machines.mjs` passes.
