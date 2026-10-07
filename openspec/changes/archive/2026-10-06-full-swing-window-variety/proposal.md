# Proposal: varied windows across the city (In Full Swing)

## Why

A player said: "can we make the buildings more interesting, please? All the windows are very similar."

The earlier facade change (commit "In Full Swing: vary the city's building facades") gave each building its own wall
paint, bay width, window grouping, bands and props. The windows themselves still look alike, for three reasons:

- Every window is the same painted atlas tile. There are only seven window styles, and each building of a style shows
  that style's one tile in every cell (only lit or dark changes).
- The window shape is fixed per style (`WRECT`): one centred rectangle per floor cell, always the same proportions.
- Rooms light at random with the same density pattern on every building, and the glass is the same blue everywhere.

## What changes

In the facade shader only (`public/vr/js/cityview.js`), with no new geometry, textures or draw calls:

- Each building picks a **window family** from its seed: the painted tile as now, tall narrow sashes, ribbon bands,
  paired windows, a glass curtain wall with mullions, small punched windows in a wide wall, or big multi-pane factory
  windows. The families that a building can pick depend on its window style (towers, brick, stone, concrete, loft,
  condo).
- Each building varies its window width, height and sill line, its panes (glazing bars), its frame colour, its dark
  glass tint and how its rooms light (scattered, whole floors, vertical stacks, or blocks).
- Homes get arched heads on some buildings, stone sills and lintels, shutters beside some windows, and a cornice with
  dentils under the top on some buildings. Their top floor can differ from the floors below (arched, small attic
  windows or round windows).
- Walls that do not show the painted tile get flat brick courses, stone joints or panel joints.
- The street floor keeps the painted shop fronts and lobbies.

Up close, the non-painted families still show the painted interiors (lamps, plants, people) inside their own window
shapes. Everything is chosen by a stable hash of the building seed, so nothing flickers.

## Out of scope

Version bump, `sw.js`, `config.js` VERSION, `quest/twa-manifest.json` (the owner does these). `main.js`, `jobs.js`,
`portal.js`, `cutscene.js` and `cars.js` are not touched. No geometry or atlas changes.

## Impact

- `public/vr/js/cityview.js`: the facade fragment shader.
- `qa/vr/facade-shots.mjs`: a new screenshot script for before/after facade views (desktop and phone sizes).
- Performance: the triangle and draw-call counts do not change; the fragment cost grows a little.
