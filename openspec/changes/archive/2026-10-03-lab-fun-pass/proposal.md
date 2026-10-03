# Make every lab game more fun

## Why

The owner asked us to review the games in the lab and make them more entertaining. The Lab page lists twelve games: the six Small Worlds, Neon Ronin, Loon Echo, Take the Plunge, Up the Creek, Full Tilt and House Rules.

Six reviewers played each game on a 390×844 phone screen and on a desktop, read the code, ran the tests, and scored the game against the bar in `docs/game-ideas.md`. Most games passed none of the seven points that a review can test. The same problems came up again and again: runs that end in seconds or cannot be lost, a top score on the first run, seeds that change almost nothing, end cards that hide the ending and do not say how close you came, warnings that come late or only to the eye, and bugs that turn one mistake into a spiral. The full results are in `docs/lab-fun.md`.

## What Changes

- The Small Worlds shell: an outro before the result card, the best score on the card, a daily world, and more feedback helpers for the games.
- Each game: fix the bugs from the review, then make the changes that add the most fun for the effort. A game's core move, look and controls stay; the changes sharpen the move, the feedback and the reason to play again.
- Tests: each change gets a sim or browser check. A new `qa/lab/links.mjs` checks that every link from the arcade and the Lab page opens a page that exists.
- Docs: the README, the Lab page cards and a fun audit of the lab.

## Out of scope

- New painted art or generated art.
- Graduating a game from the lab to an arcade cabinet.
- The crew playtest (bar point 8). It happens after this change ships on the preview.
