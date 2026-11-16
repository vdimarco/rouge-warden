# Design

## Art direction
The user's words, in order: "a gaussian splot within worldlabs that mimics a cyberpunk arcade to showcase our games and open portals to launch them", then "make it darker and denser, more cyberpunk and each machine the screen should have the portal on the main screen with the live edge".

The world is a small dark den. Ten black cabinets stand in a circle around the visitor, about 2 m away, with neon edge strips in magenta, cyan and violet. Neon tubes, cables and old monitors cover the walls, haze fills the air, and the wet floor mirrors the light. The prompt asks for no readable text, logos or characters from real games. The prompt and the world ids are in `public/lab/riftwalk/worlds/sources.json`.

Four worlds were made. A draft (`marble-1.0-draft`, 230 credits) checked the layout. The first full hall (`marble-1.1`, 1,580 credits) shipped with floating portals and was replaced. A darker hall with cabinets along the walls (1,580 credits) was not used: its screens were far away and few faced the middle. The den (1,580 credits) is the one in the game.

## Portals on the machine screens
Each cabinet screen is a portal to one game. The portal shows the game's key art, fitted to the screen with rounded corners. Its edge is live: a bright band in the game's colour with moving noise and a pulse that travels round the rim. A machine with no game shows dark glass with a faint rim. The game's name stands over the screen.

The prompt asks for screens that show plain white light. That gives a known mark to find, and the portal covers it.

## Finding the screens
- `games/riftwalk/tools/find-screens.py` reads the world's panorama (4608 by 2304, equirectangular). It keeps bright grey patches with four sides, drops reflections on the floor, and writes each patch's four corners as longitude and latitude.
- `games/riftwalk/tools/place-screens.mjs` loads the 500,000-splat file in headless Spark. The panorama's centre looks along -z from the capture point. For each screen it takes the plane's normal from the vanishing directions of the corner rays, and the distance from the median splat depth around the patch. The corner rays cut that plane, and the result is the screen's centre, right, up, normal, width and height in metres.
- The answer is `public/lab/riftwalk/worlds/screens.json`: ten screens, each about 0.51 m by 0.67 m, 1.7 m to 2.6 m from the visitor. A check picture drew green frames on the screens of the real world.

## Fidelity
The world ships as Marble made it, in three files: 150,000 splats (2.3 MB) shows first, then a phone takes the 500,000 file (7.7 MB) and a desktop the full file (29.4 MB). No splat is thinned or widened. The pixel ratio goes up to 2.

## Sources looked up, and what was adapted
- World: the World Labs API (docs.worldlabs.ai). `POST /marble/v1/worlds:generate` with a text prompt, then `GET /marble/v1/operations/{id}`. The answer holds `.spz` files, a panorama and `semantics_metadata`.
- Scale and floor: Marble's own rule ("Rendering Marble SPZ files in third-party engines"). Multiply by `metric_scale_factor` (1.5554 here) and move by `ground_plane_offset` (0.9271 m here). A Marble `.spz` has y down, so the mesh turns half a turn about x.
- Drawing: Spark 2.4.0 by World Labs (sparkjs.dev, MIT), already vendored.
- Screen pose: a rectangle's two pairs of parallel sides meet at two vanishing points, and the cross product of those two directions is the plane's normal. This is the standard single-view rule (Hartley and Zisserman, "Multiple View Geometry", chapter 8), used here on a sphere of view rays.
- Live edge: a rounded-box distance field (Inigo Quilez, "2D distance functions") gives the rim, and the noise band from the first version moves along it. These are not splat-to-splat portals, so Spark's `SparkPortals` class is not used.

## Layout
`public/lab/riftwalk/hall.js` holds the rules with no drawing. The collections are a copy of the homepage's `GROUPS`, and the node test compares the two game for game. Names, lines, routes and art come from `window.GameSwitch.GAMES` at run time.

One collection is on at a time. Its first game goes on the front machine, the next games go on the neighbours to the right and left in turn. A collection with more than ten games has pages, and the More button shows the next page. The visitor can walk 1 m from the capture point, because a splat world is sharpest there. After a walk, the arrows turn to a machine as the visitor sees it from their place.

## Controls
- Look: drag the view. ◀ and ▶ (keys and buttons) turn to the next lit machine and go round the circle.
- Collections: the buttons at the top, the up and down arrow keys, or the keys 1 to 6.
- More games: the More button, Page Down or M.
- Play: tap or click a lit screen, press Enter or Space for the machine in the middle of the view, or use the Play button.
- Walk: W A S D on a keyboard.
A visitor can do everything with taps alone, with the buttons alone, or with the keyboard alone. Every game is also a plain link on the page for screen readers, and that list shows to everyone when WebGL2 is missing or the world does not load.

## Reduced motion
The machines change at once, the arrows turn at once, the edge holds still, and a launch has no glide.

## Not done
No sound. No true splat-to-splat portal. The eye is 0.93 m over the floor, which is the height Marble reports for this world.
