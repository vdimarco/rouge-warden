# Working in rouge-warden

## OpenSpec

Use [OpenSpec](https://openspec.dev/) for new features, changes to gameplay behavior, substantial refactors, and work across multiple systems. Read `.agents/skills/openspec-workflow/SKILL.md` for the workflow. Apply these rules throughout the repository, together with any instructions closer to the files you change.

Before implementation, inspect the affected game and existing specs. Reuse a relevant active change or create `openspec/changes/<change-name>/` with a proposal, capability specs, design decisions, and a task checklist. Keep the documents proportional to the work. A small correction that restores intended behavior can use an existing spec and a focused check.

Write scenarios that describe observable player behavior. For game changes, cover the affected controls, gameplay states, and supported screen layouts. Define a concrete way to check visual or performance requirements. Preserve the user's requested art direction and input preferences in the relevant change.

Implement the tasks and keep the specs current as the design develops. Check off work only when complete. Validate the spec structure and separately test the code against its scenarios. State clearly when browser, phone, audio, or motion-sensor checks could not run. Archive completed changes and review the resulting canonical specs in `openspec/specs/`.

Continue work already authorized by the user. OpenSpec documents the agreed scope; it does not add a new approval gate. Follow the user's instructions for publishing and merging.

### Tool setup

The repository includes a portable workflow skill. This does not mean the OpenSpec CLI or its generated command skills are installed.

When CLI setup is needed, check the current [installation guide](https://openspec.dev/docs/installation), verify the required Node.js version, and initialize at the repository root with `openspec init --tools codex`. Review generated files before saving them. Preserve this file and other custom instructions.

Use the generated skills for the installed version. Agent commands such as `$openspec-propose` run in the assistant, while `openspec` CLI commands run in the terminal. Consult `openspec --help` and the [CLI reference](https://openspec.dev/docs/cli) for supported flags. If the CLI is unavailable, create the Markdown artifacts directly and report which validation could not run.

## Cursor Cloud specific instructions

The Cottage Arcade is static files in `public/`. There is no root package. `install` refreshes the lockfiles that local checks use, then links Playwright so QA scripts can require it:

- `npm ci --prefix qa/browser`, then `npx playwright install --with-deps chromium` in that directory
- `npm ci --prefix games/olympus`
- `npm ci --prefix higgsfield`
- `npm ci --prefix follow-suit`
- `node_modules/playwright` and `node_modules/playwright-core` point at `qa/browser/node_modules`

`start` serves the site at http://127.0.0.1:8765/ with `python3 -m http.server 8765 --bind 0.0.0.0 --directory public` when that port is not already responding. Keyboard play on the arcade: arrow keys pick a cabinet, 5 drops a token, 1 or Enter starts the game.

- Pinball browser checks need the server: `npm run test:pinball --prefix qa/browser`. Physics only: `node qa/lab/tilt.sim.mjs`.
- Primordia: `node qa/primordia/lenia.test.mjs`, `node qa/primordia/combat.test.mjs` and `node qa/primordia/intro.test.mjs`. Bot runs: `node qa/primordia/bot.mjs 160 7 ref`. Browser checks need the server: `NODE_PATH=qa/browser/node_modules node qa/primordia/smoke.e2e.mjs`.
- Moonwell: `node qa/moonwell/world.test.mjs` and `node qa/moonwell/play.test.mjs`. Bot runs: `node qa/moonwell/bot.mjs 16 0.75 8`. Browser checks need the server: `NODE_PATH=qa/browser/node_modules node qa/moonwell/smoke.e2e.mjs`.
- Watch call: `npm ci --prefix voice`, then `node qa/voice/call.test.mjs`.
- Olympus: `npm test --prefix games/olympus`. After editing that game, rebuild the committed bundle with `npm run build --prefix games/olympus`.
- Follow Suit: `npm run check --prefix follow-suit`. Browser checks: `npm run qa --prefix follow-suit` and `npm run qa:arcade --prefix follow-suit`. After editing that game, rebuild the arcade copy in `public/follow-suit/` with `npm run build:arcade --prefix follow-suit`.
- Higgsfield typecheck: `npm run typecheck --prefix higgsfield`. Generation needs `HF_CREDENTIALS` in `higgsfield/.env.local`. The arcade plays without that key. `/api/warden` is a Vercel function and is not part of this static server; games use their local stand-in.
