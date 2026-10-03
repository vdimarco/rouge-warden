# Verification

Eight Node suites passed: legends, skills, sim, items, base-attacks, scenery, river and creatures. The simulation suite completed 36 seeded matches across all twelve heroes with deterministic replay. Syntax and whitespace checks passed.

## Browser

Chrome cloud preview at 1363x936: twelve roster choices loaded, Mage filtering showed four, selecting Kraken updated statistics and four spells, selecting a move updated the roster preview. Starting a hunt opened the paused spellbook. Selecting rows did not spend points. The ultimate displayed level 6 and a disabled learn action. Learning Brine lance spent exactly one point, raised its rank, enabled its HUD button and showed the next rank gate at level 3. Returning to play and casting showed the cooldown. Reopening the book preserved ranks. No game-origin console errors were captured; Vercel sign-in and browser-extension messages were excluded.

## Visual fidelity

1. Structure: four spell rows on the left, selected detail on the right, header and footer retained.
2. Hierarchy: cream serif title, prominent move name, large point count and gold learn action retained.
3. Palette: dark ink panel, muted gold frame and hero accent retained.
4. Detail: cooldown, rank gates, upgrade explanation and combination hint retained.
5. Art: illustrated hero portrait retained. Crisp SVG spell glyphs replace the concept's large illustrated effects. This intentional change supports forty-eight readable spells without a large image payload.

New heroes use one generated transparent portrait with procedural combat poses. Original four heroes keep their directional and attack frames. Narrow-screen CSS stacks details and scrolls long content, but phone touch, mobile viewport, audio and motion checks could not run in this browser. OpenSpec CLI was unavailable; requirement/scenario structure was reviewed directly.
