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

## Layout

- `src/config.ts`: every tunable number.
- `src/engine/`: the rules, in pure TypeScript with no React and no DOM. Each `*.test.ts` file tests the module next to it.
- `src/ui/`: the React screens. They call the engine and hold no rules.

`PLAN.md` lists the files for each milestone. `DECISIONS.md` records how unclear rules were read. `IDEAS.md` keeps ideas that are outside the brief.
