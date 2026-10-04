# Follow Suit in the Cottage Arcade

Give Follow Suit a machine in the Cottage Arcade. The user asked for it after the prototype was done. `follow-suit/IDEAS.md` held the idea: a machine with the best chain score on its screen.

## Scope

- Build a copy of the game for the arcade at `public/follow-suit/`. It loads `/arcade/quiet.js` as its first script, and `/arcade/switch.js`.
- In that copy, show a Switch game button and an Arcade link on the start screen and on the run end screen.
- Save the best chain score in the browser after each chain.
- Add a Follow Suit machine at the end of the row, in the Strategy group. Its screen shows a frame from the game and the best chain score.
- List Follow Suit in the game switcher.
- Extend `qa/arcade/machines.mjs` and `qa/arcade/quiet.mjs` to cover the new machine and page.

## Out of scope

- Changes to the rules, the targets and the standalone Vercel project `follow-suit`.
- An animated screen on the machine.
