# Design

## Art direction
The user's words, in order: "a gaussian splot within worldlabs that mimics a cyberpunk arcade to showcase our games and open portals to launch them", then "make it darker and denser, more cyberpunk and each machine the screen should have the portal on the main screen with the live edge".

The world is a small dark den. Ten black cabinets stand in a circle around the visitor, about 2 m away, with neon edge strips in magenta, cyan and violet. Neon tubes, cables and old monitors cover the walls, haze fills the air, and the wet floor mirrors the light. The prompt asks for no readable text, logos or characters from real games. The prompt and the world ids are in `public/lab/riftwalk/worlds/sources.json`.

Seven worlds were made in all: these four, and three more for the zones (see Zones). Six of the seven are zones now. A draft (`marble-1.0-draft`, 230 credits) checked the layout. The first full hall (`marble-1.1`, 1,580 credits) shipped with floating portals and is now the GTA zone. A darker hall with one row of cabinets (1,580 credits) is now the Strategy zone. The den (1,580 credits) is the Action zone.

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

## Zones
The user's words: "make it a bigger hall where you can move between zones", then "of game categories and make it higher fidelity".

A Marble world is sharp near the point it was made from, and it has room for about ten machines there. One world as a large hall would put most screens far from the visitor and would draw them badly. So the hall has one zone for each collection of the homepage, and each zone is its own world. `marble-1.1-plus` makes larger worlds, and it was not tried: the screens of a larger world would be too far from its one panorama for `find-screens.py`.

| Zone | World | Machines | Games |
| --- | --- | --- | --- |
| Cottage | amber ring | 12 | 8 |
| Action | magenta and cyan ring | 10 | 11 |
| ASCII Scenes | green ring | 9 | 2 |
| Strategy | one row of cabinets | 11 | 3 |
| GTA | brick hall with arches | 2 | 1 |
| Lab | violet ring | 10 | 19 |

- `ZONES` in `hall.js` is one zone for each collection, with the collection's id and name. The node test checks it against the homepage rows.
- Strategy and GTA use the two worlds that were made before the ring worlds and first left out. The World Labs account had no credits for two more worlds. Their prompts did not ask for a ring, so the GTA world has few screens near the visitor.
- Each zone has two rift doors. `doors()` puts one in the widest gap between machines on each side of the visitor, at the distance of the machines beside it, and as wide as the floor between their cabinets (0.36 m to 0.95 m). Where the machines leave an open wall, the door stands on that wall, a quarter turn from the front. The left door leads to the zone before and the right door to the zone after, and the last zone leads on to the first.
- A door is a portal like a screen, with the same shader. It shows a view into its zone (`door.webp`, cut from that zone's panorama by `door-art.py`) and the zone's name.
- A way through: the visitor glides to the door, the view fills with the zone's colour, the zone's world loads, and the new zone stands around the visitor.
- The zone buttons at the top, the up and down arrow keys and the keys 1 to 6 also change the zone, for a visitor who does not want to turn to a door.

The Cottage world came out with dim grey screens and a second panel under each. `find-screens.py` took a brightness ceiling and a latitude cut for it, and `face-screens.py` rebuilt its screens to face the capture point, because the tilt of a small dim screen measures badly. The GTA world got the same treatment. From the middle of the zone the portal covers the screen. After a walk its tilt differs a little from the cabinet's.

## Fidelity of the zones
The user asked for higher fidelity. No new world could be made, so the gain is in what the page loads:
- Every zone ships its full-resolution file, and a desktop draws it. The four ring worlds have about 28 MB each; the two earlier worlds have 9 MB each.
- When a zone is sharp, the worlds behind its two doors load in the background at the same quality (`ahead()`), so the visitor arrives in a sharp zone. A browser that asks to save data loads nothing ahead.
- The page keeps the worlds of the current zone and its two neighbours, and lets the others go (`keepNear()`), so memory stays at three worlds.
- The soft glow of the live edge no longer covers the art, so a game's art keeps its own colours. Art textures use the most anisotropic filtering the device has. Door pictures are 512 by 1024.

The worlds folder is about 222 MB.

## A cleaner, more natural look
The user's words: "it looks awkward clean it up make it more natural and differentiated".

- A game shows as a picture on the machine's own tube: scan lines, darker corners, a faint shine on the glass, a thin live edge and a small glow. The glow reaches 4.5 cm past the screen.
- A game's name shows only over the machine in the middle of the view. The other machines carry no floating words.
- A machine with no game idles in its zone's colour, with a slow bright bar that rolls down the tube. It is no longer a dark slab.
- A rift door is an arch, with its zone seen through a slow swirl of that zone's light.
- The GTA world has two neon arches of its own. `hall.doors` in that zone's `screens.json` puts the two rift doors in them.
- Each zone has its own look (`LOOKS` in `main.js`): the corner of its screens, how much the edge wavers, the strength of the scan lines, and the letters of its names. ASCII Scenes has square corners, a steady edge, strong scan lines and monospace letters. The Lab has round corners and a restless edge.
- The zone's name shows large for a moment on the way in, in the zone's colour.

## Magic
The user's word: "magically".

- Motes of light in the zone's colour drift up through the room and twinkle (180 on a desktop, 110 on a phone). They are `THREE.Points` with a small shader, drawn after the splats with light that adds up.
- Sparks in the next zone's colour circle each rift door and fall into it. Stars come and go inside the door.
- A glint crosses the screen of the machine in view.
- The light on the way into a game or a zone blooms from the middle of the view, and closes back to a point on arrival (`clip-path` on the flash).
- With reduced motion there are no motes and no sparks, and the light shows and clears at once.

No outside source was needed: these are point sprites and a hash-grid twinkle, both standard shader practice.

## Rifts behind the machines, and the clusters still to come
The user's words: "The spacing between the machines doesn't make any sense. And why is this rift like wedged there? Like it should be its own little section where there's machines next to each other and they do their thing. And then there's a rift above it or beside it or behind it. ... there should be clusters".

- Done: in the four ring worlds the rift doors no longer stand between two cabinets. `hall.doorBack` in a zone's `screens.json` sets a door back behind the machines (2 m in the Action, ASCII Scenes and Lab zones, 0.35 m in Cottage where the machines stand at the walls). The door shows through the gap as a doorway at the back of the room.
- Not done: clusters. The place of every cabinet is part of its Marble world, and the page cannot move a cabinet. The ring worlds came from a prompt that asked for cabinets in a circle. The Strategy world, from a prompt that asked for a row, has the layout the user describes. Five new worlds from a cluster prompt (a tight row of cabinets shoulder to shoulder, with a neon archway beside the row for the rift) cost 7,900 credits, and the account has none.

## Layout
`public/lab/riftwalk/hall.js` holds the rules with no drawing. The collections are a copy of the homepage's `GROUPS`, and the node test compares the two game for game. It also checks that each collection is in one zone. Names, lines, routes and art come from `window.GameSwitch.GAMES` at run time.

In a zone, the first game goes on the front machine, the next games go on the neighbours to the right and left in turn. A zone with more games than machines has pages, and the More button shows the next page. The visitor can walk 1 m from the capture point. After a walk, the arrows turn to a machine as the visitor sees it from their place.

## Controls
- Look: drag the view. ◀ and ▶ (keys and buttons) turn to the next lit machine or door and go round the circle.
- Zones: tap or click a rift door, or press Enter at it. Also the buttons at the top, the up and down arrow keys, or the keys 1 to 6.
- More games: the More button, Page Down or M.
- Play: tap or click a lit screen, press Enter or Space for the machine in the middle of the view, or use the Play button.
- Walk: W A S D on a keyboard.
A visitor can do everything with taps alone, with the buttons alone, or with the keyboard alone. Every game is also a plain link on the page for screen readers, and that list shows to everyone when WebGL2 is missing or the world does not load.

## Reduced motion
The machines change at once, the arrows turn at once, the edge holds still, and a launch or a way through a door has no glide.

## Not done
No sound. No true splat-to-splat portal: a door shows a picture of its zone, and the world changes behind a flash of light. The eye is at the height Marble reports for each world: 0.93 m in the Action zone and about 1.3 m in the other zones. A second try at the Cottage world, with brighter screens, did not start: the World Labs account had no credits left.
