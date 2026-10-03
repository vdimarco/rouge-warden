# Follow Suit

A single-player card roguelike for phones in portrait. Build chains from a hand of 8 cards. Each card must follow the card before it by suit or by rank, as in Crazy Eights, and 8s are wild. Each change of suit adds Mult. A chain of 4 or more cards whose last card matches its first by suit or rank closes into a ring and doubles Mult.

## Run it

You need Node.js 20.19 or later.

```sh
npm install
npm run dev
```

## Check it

```sh
npm test            # engine tests (Vitest)
npm run typecheck   # TypeScript
npm run build       # production build in dist/
npm run check       # all three
```

## Balance

`npm run simulate` plays 1,000 seeds with no charms and no redraws, with the best chain for each hand, and prints a Markdown report. `BALANCE.md` holds the report and explains the tuned targets.

## Check it in a browser

`npm run qa` builds the app, serves `dist/` and runs two checks in Chromium with touch input:

- `qa/table.e2e.mjs` plays one table at 390 by 844, 375 by 667, 360 by 740 and 430 by 932. It checks the follow rules on screen, the 8 picker, undo, redraw, clear and loss, 44 px tap targets and page overflow.
- `qa/feel.e2e.mjs` checks the score reveal: the order and timing of the points, the Mult bumps, the scale notes and the ring chord, the count-up, the mute toggle and the reduced-motion fade. An `AudioContext` spy records each note's pitch, so the check needs no speakers.
- `qa/run.e2e.ts` plays a full run. It picks a seed whose run clears a table with a power-of-ten bonus and counts one coin sound for each bonus dollar. It plans each step with the engine, plays it on screen and compares the screen with the engine after each tap. It visits the start screen, stop intros, tables, a host table, shops, the deck view, a stamp picker and the run end screen, and checks each layout at the 4 sizes.

Screenshots go to `qa/out/`.

The check uses `playwright-core`, which does not download a browser:

- If Playwright has no Chromium on your computer, run `npx playwright-core install chromium` once.
- To use another Chromium binary, set `CHROMIUM_PATH` to its path.
- To check a deployed copy, set `BASE_URL` and run `npm run qa:url`.

## Deploy to Vercel

The app is a static site. Vercel builds it with the Vite preset from `vercel.json`: `npm ci`, then `npm run build`, with the output in `dist/`.

With the Vercel CLI:

1. Install the CLI: `npm install --global vercel`.
2. Log in: `vercel login`.
3. Go to this folder: `cd follow-suit`.
4. Link the folder to a project: `vercel link`. Pick your team, and create or pick the project `follow-suit`.
5. Deploy a preview: `vercel deploy`. The CLI prints the preview URL.
6. When you are ready, deploy to production: `vercel deploy --prod`.

With Git instead of the CLI:

1. In the Vercel dashboard, import the `rouge-warden` repository as a new project.
2. Set the root directory to `follow-suit`. Vercel finds the Vite preset.
3. Each push then builds a preview. Pushes to `main` build production.

## Layout

- `src/config.ts`: every tunable number.
- `src/engine/`: the rules, in pure TypeScript with no React and no DOM. Each `*.test.ts` file tests the module next to it.
- `src/ui/`: the React screens. They call the engine and hold no rules.

`PLAN.md` lists the files for each milestone. `DECISIONS.md` records how unclear rules were read. `IDEAS.md` keeps ideas that are outside the brief.
