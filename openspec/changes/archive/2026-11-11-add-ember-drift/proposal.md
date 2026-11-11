## Why
The user asked for an arcade game in the spirit of Faraway (Steph Thirion, Annapurna Interactive, 2026), a minimalist score attack about a short-lived star that links stars for energy. The arcade should not copy that game, so Ember Drift keeps only the broad loop and is otherwise original: name, art, rules, code and all 16 stages. It was built and tuned as a Claude artifact first, then made harder at the user's request, and now joins the Action row.

## What Changes
Add Ember Drift at `/ember-drift/`, an Action game. The player steers an ember that always loses fuel. Flying close to a star lights it and gives fuel and points. Stars lit one after another form a chain that scores more for each link and doubles at 8 links. Flying back to a star in the chain closes a shape for a bonus, and a shape of 5 or more stars fills the fuel. Close passes speed the ember up through the star's pull, and holding a button boosts at the cost of fuel.

Endless flight makes the sky as the ember flies. Fuel burns faster with time and depth, dark clouds burn it very fast and follow the ember past 5 light years, comets cross the ember's path, flare stars drift away for a big reward, and timed beacons mark a far star for a bonus. The page keeps the best score and the top five runs.

Puzzle stages are 16 hand-made skies with a goal each (light every star, a chain of N, a shape of N stars, two shapes, numbered order, one unbroken chain, one shape through every star), with moving stars, sliding clouds, a fuel budget and a ring the ember must stay inside. Clearing a stage opens the next one. A time at or under par gives 3 sparks.

## Impact
New static folder `public/ember-drift/`, a cabinet screen `public/arcade/key/ember-drift.webp`, an Action cabinet and its best-score line in `public/index.html`, an entry in `public/arcade/switch.js`, a Corridor piece in `public/corridor/index.html` (cabinets 19 to 41 become 20 to 42, the light slots grow from 123 to 126), a date entry in `public/arcade/game-dates.json`, a `PAGES` entry in `qa/arcade/quiet.mjs`, and `qa/arcade/machines.mjs` updated for the new last machine of the Action row. No other game changes.
