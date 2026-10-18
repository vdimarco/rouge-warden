# Working in rouge-warden

## OpenSpec

Use [OpenSpec](https://openspec.dev/) for new features, changes to gameplay behavior, substantial refactors, and work across multiple systems. Read `.agents/skills/openspec-workflow/SKILL.md` for the workflow. Apply these rules throughout the repository, together with any instructions closer to the files you change.

Before implementation, inspect the affected game and existing specs. Reuse a relevant active change or create `openspec/changes/<change-name>/` with a proposal, capability specs, design decisions, and a task checklist. Keep the documents proportional to the work. A small correction that restores intended behavior can use an existing spec and a focused check.

Before you build a rendering or art technique, such as grass, trees, water, outlines, a painted look or a texture step, look up how others already solve it: talks, breakdowns, papers, engine documentation or open shaders. In the change's `design.md`, name the source you adapted, or say that none fit.

Write scenarios that describe observable player behavior. For game changes, cover the affected controls, gameplay states, and supported screen layouts. Define a concrete way to check visual or performance requirements. Preserve the user's requested art direction and input preferences in the relevant change.

Implement the tasks and keep the specs current as the design develops. Check off work only when complete. Validate the spec structure and separately test the code against its scenarios. State clearly when browser, phone, audio, or motion-sensor checks could not run. Archive completed changes and review the resulting canonical specs in `openspec/specs/`.

Continue work already authorized by the user. OpenSpec documents the agreed scope; it does not add a new approval gate. Follow the user's instructions for publishing and merging.

### Tool setup

The repository includes a portable workflow skill. This does not mean the OpenSpec CLI or its generated command skills are installed.

When CLI setup is needed, check the current [installation guide](https://openspec.dev/docs/installation), verify the required Node.js version, and initialize at the repository root with `openspec init --tools codex`. Review generated files before saving them. Preserve this file and other custom instructions.

Use the generated skills for the installed version. Agent commands such as `$openspec-propose` run in the assistant, while `openspec` CLI commands run in the terminal. Consult `openspec --help` and the [CLI reference](https://openspec.dev/docs/cli) for supported flags. If the CLI is unavailable, create the Markdown artifacts directly and report which validation could not run.

## New games

Every new game ships with its homepage arcade cabinet in the same pull request.

Cabinets are the `<article class="cab">` elements inside `<div class="row" id="row">` in `public/index.html`. Copy a neighboring article. `data-game` is the id, `data-url` is the game's route, the marquee `<b>` is the name, and `<small>` is the subtitle. The `<img>` inside `.bezel .screen` is the cabinet screen art, drawn in the game's palette. Set `--c1`, `--c2`, and `--glow` to that palette, on a `.cab.<id>` rule or on the article.

Rows are the `GROUPS` array in that file, in the script section "the machines, in groups". Each entry is `{ id, label, games, c1, c2, glow, art, art2 }`. `games` lists the cabinet ids in that collection. The rows are `cottage`, `action`, `ascii`, `strategy`, `gta`, and `lab`. The hall shows one cabinet per group. Opening a group shows its cabinets in the order those articles appear in `#row`, because `members` keeps document order. Put the new article after the other articles in its group, and append its id to that group's `games` array, so it sits at the end of the row. When a spot in the row is requested, insert the article at that place among the group's articles. The array decides which row the cabinet belongs to. The article's place in `#row` decides its order in that row. A lab game's id goes in the `lab` group alone. `public/lab/index.html` is a separate link list for the Lab page. Put every id in a group's `games` list. An id with no group is gathered into a generated More row. The collection buttons in `nav.section-nav` open Cottage, Action, Strategy, and GTA. The Lab control links to `/lab/`. A new cabinet in an existing group leaves those controls as they are.

The game switcher and the All Games list are the `GAMES` array in `public/arcade/switch.js`. Each entry is `{ id, name, sub, url, art, color }`, plus optional `probe`, `credits`, and `labOnly`. Use one id (`id` and `data-game`), one title (`name` and the marquee `<b>`; compared in lowercase), and one route (`url` and `data-url`). `art` is the screen image and `color` is the tile color from the same palette. All Games search matches `name` and `sub`. The rank filters are Featured, Plays, Views, Likes, and Time. Featured pins the ids in `FEATURED`, then lists the other games. `labOnly: true` keeps a Lab-only game off the homepage All Games list, under the Lab tile, while the in-game switcher still lists it. The game page loads `/arcade/switch.js` and gives its menu button `data-switch`. `#machinePicker` takes its labels from the marquee.

Check the homepage at viewport widths 390, 320, and 1280. The cabinet is in the right row, in the right place in that row, and opening it loads the game. Its marquee shows the whole title and subtitle at those widths. At 320 a marquee holds two title lines and 8 characters of subtitle only with tighter lines, and in a short window (360x640, 800x600) only the title, so hide the subtitle there rather than cut it, as the `.cab.ahead-of-the-light .marquee` rules do. Coin slots, Start, the row arrows, the collection controls, and the All Games controls are at least 44px on the shorter side. The other rows stay as they were. Include screenshots of the three widths in the pull request. With the site served, `node qa/arcade/machines.mjs` checks that each game page has a cabinet whose id, title, and route match its switcher entry. A game page with sound needs an entry in `PAGES` of `qa/arcade/quiet.mjs`, which starts its sound the way a player does.

## Cursor Cloud specific instructions

The Cottage Arcade is static files in `public/`. There is no root package. `install` refreshes the lockfiles that local checks use, then links Playwright so QA scripts can require it:

- `npm ci --prefix qa/browser`, then `npx playwright install --with-deps chromium` in that directory
- `npm ci --prefix games/olympus`
- `npm ci --prefix higgsfield`
- `npm ci --prefix follow-suit`
- `node_modules/playwright` and `node_modules/playwright-core` point at `qa/browser/node_modules`

`start` serves the site at http://127.0.0.1:8765/ with `python3 -m http.server 8765 --bind 0.0.0.0 --directory public` when that port is not already responding. Keyboard play on the arcade: arrow keys pick a cabinet, 5 drops a token, 1 or Enter starts the game.

- Pinball browser checks need the server: `npm run test:pinball --prefix qa/browser`. Physics only: `node qa/lab/tilt.sim.mjs`.
- Primordia: `node qa/primordia/lenia.test.mjs`, `node qa/primordia/combat.test.mjs`, `node qa/primordia/growth.test.mjs` and `node qa/primordia/intro.test.mjs`. Bot runs: `node qa/primordia/bot.mjs 160 7 ref`. Browser checks need the server: `NODE_PATH=qa/browser/node_modules node qa/primordia/smoke.e2e.mjs`.
- Moonwell: `node qa/moonwell/world.test.mjs` and `node qa/moonwell/play.test.mjs`. Bot runs: `node qa/moonwell/bot.mjs 16 0.75 8`. Browser checks need the server: `NODE_PATH=qa/browser/node_modules node qa/moonwell/smoke.e2e.mjs`.
- Ahead of the Light (`public/ahead-of-the-light/`): `for f in qa/ahead-of-the-light/*.test.mjs; do node $f || echo FAIL $f; done` (`sim.test.mjs` takes a few minutes). Bot runs: `node qa/ahead-of-the-light/bot.mjs mid 200`. Browser checks need the server: `NODE_PATH=qa/browser/node_modules node qa/ahead-of-the-light/smoke.e2e.mjs`, and `input.e2e.mjs`, `layout.e2e.mjs`, `perf.e2e.mjs` and `feedback.e2e.mjs` the same way.
- Shore of the Ancients (`public/tidebreak/`): `for f in qa/tidebreak/*.test.mjs; do node $f || echo FAIL $f; done` (`sim.test.mjs` plays six full matches and takes about two minutes). Browser checks need the server: `node qa/tidebreak/desktop.e2e.mjs`, `node qa/tidebreak/combat-feel.e2e.mjs`, `node qa/tidebreak/difficulty.e2e.mjs`, `node qa/tidebreak/hunted.e2e.mjs`, `node qa/tidebreak/skill-targets.e2e.mjs`, `node qa/tidebreak/hud-details.e2e.mjs` cover gameplay and HUD behavior. `node qa/tidebreak/ground.e2e.mjs` is a legacy painted-ground asset diagnostic. `node qa/tidebreak/terrain-3d.e2e.mjs` checks 3D-only startup, hills, controls and graphics recovery. `node qa/tidebreak/render3d.e2e.mjs`, `node qa/tidebreak/hero-select-3d.e2e.mjs` and `node qa/tidebreak/combat-feel-3d.e2e.mjs` test the 3D view in SwiftShader; Shore is 3D-only, including software WebGL; old renderer preferences and URLs no longer select 2D. After a change to the hero models, run `node qa/tidebreak/render-portraits.mjs`. The 3D model pipeline is in `higgsfield/models3d/README.md`.
- Watch call: `npm ci --prefix voice`, then `node qa/voice/call.test.mjs`.
- Olympus: `npm test --prefix games/olympus`. After editing that game, rebuild the committed bundle with `npm run build --prefix games/olympus`.
- Follow Suit: `npm run check --prefix follow-suit`. Browser checks: `npm run qa --prefix follow-suit` and `npm run qa:arcade --prefix follow-suit`. After editing that game, rebuild the arcade copy in `public/follow-suit/` with `npm run build:arcade --prefix follow-suit`.
- Claude Code mods: `node mods/check.mjs` (needs the `claude` CLI; set `CLAUDE_CODE_TYPES` to `claude-code.d.ts` for the type check) and `node mods/qa/frames.mjs`. After editing `public/lab/tilt/physics.js` or `table.js`, `public/primordia/lenia.js` or `species.js`, `public/fish/js/species.js`, the clips in `public/tidebreak/audio/announcer/`, or `mods/shared/`, run `node mods/sync.mjs`.
- Higgsfield: `npm run typecheck --prefix higgsfield` and `npm test --prefix higgsfield`. Generation needs `HF_CREDENTIALS` in `higgsfield/.env.local`. Give art requests a game's look with `--style <game>` (files in `higgsfield/styles/`) and check the request with `--dry-run` first. Make a generated texture tile with `npm run swatch --prefix higgsfield`. The arcade plays without that key. `/api/warden` is a Vercel function and is not part of this static server; games use their local stand-in.

- Shore highlands and caves: `node qa/tidebreak/geology.test.mjs`; `node qa/tidebreak/landscape.e2e.mjs` covers desktop and portrait landscape rendering. Startup and optional map icons: `node qa/tidebreak/graphics-startup.test.mjs`.
