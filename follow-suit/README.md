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

## Check it in a browser

`npm run qa` builds the app, serves `dist/` and plays one table by touch in Chromium at 390 by 844, 375 by 667, 360 by 740 and 430 by 932. It checks the follow rules on screen, the 8 picker, undo, redraw, clear and loss, 44 px tap targets and page overflow. Screenshots go to `qa/out/`.

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
