# Gloam Downs: screens with life, and places that live

## Why
The player asked: "make tbe selection screen more engaging perhaps and enviromwnt itself". Screenshots of today's screens (design.md "What is dull today") show the problem. Every pick is a flat text button in a dark box that hides the world behind a 60% veil. The first load is a wall of text. A returning player lands in a list of nine rows. The summary is five numbers over black. In the places, about 99% of the splats never move: no grass stirs, no bird flies, no lamp answers the lamplighter.

## What changes
### Part S: the selection screens
- **A title screen** on each load that today opens the help card or the Lamp-room. The live place drifts slowly behind it. The title is in the painted style. The five places are lamps on a path: a lamp lights under the pointer or the focus and names its place. A line shows the seed and the Ember level. Begin the run is the clear main button. The explorer's start gets the same title, and there the lamps choose the place.
- **The beacon picks** become lamp cards: each wick and spark is a lit glass in its colour, with a lift and a brighter light on hover and focus, a short deal-in when the card opens, a flare and a sound on the pick, and a burst of light at the beacon in the world. The card sits low on a phone and to the side on a wide screen, so the lit beacon stays in view.
- **The Lamp-room** becomes a room of shelves: the wares as lamps whose light rises with their level, the patterns as unlit lamps that catch when kindled, the panes as windows. A buy or a kindle flashes, plays a sound and rolls the glim count down.
- **The summary and the win card** recap the run: the path of lamps lit place by place, the time and foes of each place, the glim kept and lost, the patterns kept, the sparks, the best combo, and what put the lamp out. They come in with motion.
- All of it works with keys, a pad and touch, at the six layouts, and with reduced motion (no drift, no shake, fades only). Text stays readable.

### Part E: places that live
- A new module adds ambient life to each place, in its own palette: moths at lamps, rising embers and drifting motes, falling leaves or ash, mist bands in the hollows, flicker on lamps and candles, wind on grass tufts and rags, crows that take off when the lamplighter comes near, and lamps that brighten as the lamplighter passes.
- It uses the motion the splat shader already has (rise, fall, bob, sway, flutter, wander, twinkle), so the renderer and its uniforms do not change. It never uses the fire slots 34 to 37, and it goes quiet near awake foes, so ambient light never looks like a tell.
- A budget: at most 1,200 life splats a place, and a measured check that the frame time at a phone layout rises by no more than 5%.
- Sound beds per place that react: a gust is heard as the grass leans, the wings as the crows lift.

## Capabilities
- Modified: `gloam-downs-run`. The delta is `specs/gloam-downs-run/spec.md`.
- The explorer capability, `gloam-downs`, is not modified by a delta. The title and the life also show in the explorer; the run's delta says so where it matters.

## Scope
- The baked places, foes and boss files do not change. No rebake.
- The vendored renderer and its shaders do not change, so the uniform counts do not change.
- `play.js` camera code does not change. The title's drift is a view passed to the draw.
- The art direction stays: painted, Digital Renaissance, lamplight in the dark. Fire stays the brightest colour.
- No Higgsfield or other paid generation. No model names.
- Two builders work in parallel (design.md "Who builds what").
