# Design

## Art direction
The user's words: "a gaussian splot within worldlabs that mimics a cyberpunk arcade to showcase our games and open portals to launch them". The world's prompt asks for a cyberpunk arcade hall at night: rows of retro cabinets with blank screens, neon tubes in magenta, cyan and amber, tall neon archways, a wet mirror floor, and no readable text, logos or characters from real games. The prompt and the world id are in `public/lab/riftwalk/worlds/sources.json`.

A draft world (`marble-1.0-draft`, 230 credits) checked the layout first. It was pale and empty, so the prompt for the full world asked for more cabinets and stronger colour. The full world (`marble-1.1`, 1,580 credits) is the one in the game.

## Fidelity
The first version thinned each PINOC world from about 1,050,000 splats to 300,000 and widened the rest, and capped the pixel ratio at 1.25 to 1.5. The user saw the result as low fidelity.

Now the hall ships as Marble made it, in three files: 150,000 splats (2.3 MB) shows first, then a phone takes the 500,000 file (7.5 MB) and a desktop the full file (28.8 MB), and each replaces the one before it. No splat is widened. The pixel ratio goes up to 2.

## Sources looked up, and what was adapted
- World: the World Labs API (docs.worldlabs.ai). `POST /marble/v1/worlds:generate` with a text prompt, then `GET /marble/v1/operations/{id}`. The answer holds `.spz` files at 100k, 150k, 500k and full resolution, and `semantics_metadata`.
- Scale and floor: Marble's own rule ("Rendering Marble SPZ files in third-party engines"). Multiply by `metric_scale_factor` (2.2474 here) and move by `ground_plane_offset` (1.3498 m here). A scratch measure of the floor under the capture point gave 1.335 m, which agrees. A Marble `.spz` has y down, so the mesh turns half a turn about x.
- Drawing: Spark 2.4.0 by World Labs (sparkjs.dev, MIT), already vendored.
- Portals: these are not splat-to-splat portals. Each portal is a disc with the game's own key art, so Spark's `SparkPortals` class is no longer used. The rim band and its motes are the shaders written for the first version (a noise band fed by the angle as a point on a circle, so it has no seam). The disc shader is new: it fits the picture to the disc and swirls it a little near the rim. No outside source fit better for a picture in a ring.

## Layout
`public/lab/riftwalk/hall.js` holds the rules with no drawing. Portals stand on a ring 2.5 m from the capture point, because the hall is 7 m wide and a splat world is sharpest near the point it was made from. The visitor can walk 1.2 m from that point. A portal's radius shrinks when many share the ring (21 portals in the Lab ring), so neighbours keep a gap. A new ring starts where the visitor looks: the first game is in front, and the back portal is the last one, on the left.

The collections are a copy of the homepage's `GROUPS`. The node test compares the two, game for game, so a game added to a row cannot be missed in the hall. Names, lines, routes and art come from `window.GameSwitch.GAMES` at run time.

## Controls
- Look: drag the view. ◀ and ▶ (keys and buttons) turn to the next portal.
- Open: tap or click a portal, press Enter or Space for the portal in the middle of the view, or use the Open / Play button.
- Back: the back portal, the Back button, Esc or Backspace.
- Walk: W A S D on a keyboard.
A visitor can do everything with taps alone, with the buttons alone, or with the keyboard alone. Every game is also a plain link on the page for screen readers, and that list shows to everyone when WebGL2 is missing or the hall does not load.

## Reduced motion
No motes, no slow turn on the title, rings change at once, the arrows turn at once, and a launch has no glide.

## Not done
No sound. No true splat-to-splat portal. No art on the hall's own cabinet screens: the cabinets are part of the splat world, and their screens stay blank.
