# Tidebreak

An original browser MOBA at `/tidebreak/`. A reef duelist, a shell guardian, and a current weaver fight over a living coral city. One human plays with two allies against three bots. The arcade cabinet and game switcher link to it.

## Play

The left pad moves. Basic attacks fire at nearby enemies; tap a world target or use Attack to change focus. Tap a skill for aim assist, or drag its button and release to choose a direction. Dash uses that direction, and Vela's ultimate lands ahead of her. Other area skills center on the caster.

Escort a wave into a spire's range. Spires prioritize soldiers; attacking an enemy hero under their spire draws its fire. Destroy any enemy spire to expose the heart. Destroy the heart to win. At four minutes, the team with more combined structure health wins. Equal health gives a draw. Damage rises during the last minute.

Leviathan appears after 30 seconds. Defeat it to recruit a siege beast in the winning hero's lane. It returns 65 seconds after capture. Every 50 seconds the center current gives the player a brief movement boost. Enemy hero lane assignments vary by match seed.

Team experience raises hero levels. The ultimate opens at level 3. Pearls buy attack, health, or shorter skill cooldowns; each upgrade stacks three times. Return channels for three seconds and cancels on movement or damage. Home heals you. Death leads to a short respawn.

Keyboard: WASD or arrows move, Q dashes, E casts Surge, R casts the ultimate, B returns, and Escape pauses. Portrait and landscape use the same layout rules. A second touch can aim a skill while the first moves. The game pauses when the page loses focus. Audio begins with the first Play tap; the sound preference and match record stay on the device.

## Code and assets

`sim.js` holds fixed-step battle rules. `render.js` draws generated art on Canvas 2D. `main.js` connects native HTML controls and dialogs. `audio.js` synthesizes a quiet theme and attack sounds. No runtime model calls, API keys, new dependencies, or server are required. Serve `public/` with the existing static host.

Higgsfield GPT Image 2.5 generated the concept, nine-object sprite atlas, and arena. The atlas contains three heroes, two soldiers, Leviathan, two spires, and a heart. The shipped WebP files preserve alpha. Hero portraits are crops of the same atlas. Source prompts, job IDs, and URLs are in `public/tidebreak/art/sources.json`.

The fal Nano Banana Pro request was rejected before submission because the account had no credits. No 404-GEN connector or credential was available. This version uses generated 2D sprites; it contains no 404 mesh or rig. Online multiplayer, server authority, skeletal animation, and a broader hero roster remain separate work.

## Visual spec

The [portrait concept](tidebreak-concept.webp) sets the direction: midnight navy, luminous teal, red enemies, ivory paths, and thin gold control borders. Barlow Condensed uses the arcade's existing local font files. The battlefield fills the screen; a compact score sits at the top, the minimap at upper left, the movement pad at lower left, and skill controls at lower right. Health sits between the controls. The hero picker and dialogs continue these colors and fonts.

Intentional implementation changes from the concept: the arena uses a top-down map with three visible lanes; characters are generated 3/4-view sprites. Skill glyphs, targeting rings, health bars, and effects use code. The primary actions have English labels. The UI adds Return, a pearl shop, a small animated first-play tip, and honest bot-mode text. These controls are required by the match rules. The game has no borrowed characters, names, map art, or logos.

## Checks

Run `node qa/tidebreak/sim.test.mjs`. It checks the protected heart, dash cooldown, ultimate lock, purchase cost and cap, respawn, interrupted return, single Leviathan reward, deterministic replay, and 18 full bot matches with finite health/positions and bounded wave counts.

The cloud browser rejected the local address with `ERR_BLOCKED_BY_CLIENT`. Local Chromium QA serves the same checked-in files through Playwright request routing, because the cloud browser and shell server do not share a reachable loopback interface. Browser checks cover hero selection, help, touch and keyboard controls, pause, shop, match completion, replay, and portrait/landscape/desktop layouts. Browser evidence is kept outside the repo.

### Visual review

The concept and final render were inspected together at 752 × 1344 pixels. Additional views: 390 × 844, 320 × 568, 844 × 390, and 1440 × 900. Page identity, asset loading, console health, and the core interaction flow passed.

| Check | Concept and implementation |
| --- | --- |
| Layout | Top score, upper-left map, lower-left movement, lower-right skills, and bottom health preserved. |
| Palette | Navy chrome, teal allies, red enemies, ivory paths, and gold borders preserved. The separate arena asset is brighter than the concept. |
| Type | Local Barlow Condensed gives consistent labels and readable phone controls. It is narrower and heavier than the concept's generic sans serif. |
| Art | All characters, buildings, and terrain use generated images. The top-down arena and fixed sprite perspectives are deliberate changes for this first playable build. |
| Controls | Buttons have English labels. Native SVG glyphs replace the concept's raster ability icons. Cooldowns and the level gate are visible. |
| Copy | Tidebreak, Break their heart, Dash, Surge, and Ult retained. Attack, Move, Return, Upgrade, and the first-play tip are explicit functional additions. |
| Small screens | All primary controls fit in portrait and landscape. The first-play tip hides when movement starts, clearing the battlefield. |

This review verifies the implemented visual spec and records its differences from the initial concept. It does not claim pixel-identical reproduction of the concept.
