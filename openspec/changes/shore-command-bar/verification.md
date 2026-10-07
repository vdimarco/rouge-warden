# Verification

Local Playwright with the preinstalled Chromium (software GL), static server on port 8765.

## Layout
- At 1040x640, 1280x720, 1440x900 and 1920x1080 with a mouse, the bar shows. No two of these overlap or leave the screen: movement pad, rally, portrait, bars, the four skills, market, quick-buy, item grid, point button, minimap, objective and auto-status.
- At 1039x700 the thumb fan shows. Its existing overlap of the movement pad and the portrait circle is unchanged from before this change.
- At 390x844 and 844x390 (touch), the positions of the skills, health, market, movement pad, rally, minimap and objective are the same as before the change.

## Play
At 1440x900: the Q "+" badge spent the point (ranks 1/0/0/0, points 0). Q and a click cast it (cooldown 7.3 s shown on the skill). With 3000 more embers, quick-buy bought Root crown and it showed in the first slot. A click on the empty frame gave no order; a click on the ground gave a move order.

## Checks
- `qa/tidebreak/skill-targets.e2e.mjs` passes at ten sizes, with the bar rules for mouse screens from 1040x600.
- These e2e checks pass: `desktop` (17), `combat-feel` (33), `difficulty` (6), `hunted` (5), `ground` and `combat-feel-3d` (8). Before a fix, `hunted` found that the Hunted mark stretched across the bar from an older `inset:0` rule. Now the mark sits above the portrait.
- The OpenSpec CLI is not installed, so the structure was not validated by the CLI.
- Not checked: a real desktop GPU and a real mouse.
