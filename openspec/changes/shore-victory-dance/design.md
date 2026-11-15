# Design

## Source of the motion
The four clips are the four samples of one PINOC text-to-motion task (6 seconds, 6 credits), run through the PINOC MCP server on 2026-11-15. The task and asset IDs are in `public/tidebreak/models/sources.json`. The PINOC motion library was checked first. Its free "Cheering" clip was a possible fit, but a dance was the request.

## Technique and the source adapted
The retarget method is the one Shore already uses in `public/tidebreak/hero-rig.js`: world-space rotation deltas from a stored bind pose. No outside technique fit better, because that code already moves any clip to any hero.

PINOC exports "mixamo-glb": the X Bot mesh in a T-pose with Mixamo bone names. The Shore heroes use the Meshy rig in an A-pose. A rotation delta from a T-pose would lower every hero's arms by the angle between the two rest poses. `pinoc-clip.mjs` therefore stores a bind pose whose shoulder, arm, leg and foot bones point in the average rest direction of the Shore rigs. It reads those directions from the bind poses already in `clips.json`. Hands and toes follow the bone above them.

Bone map: Mixamo `Spine`, `Spine1`, `Spine2` become Meshy `Spine02`, `Spine01`, `Spine`. `Neck` becomes `neck`. Limb names are the same.

The clips are sampled at 15 keys each second (90 keys), in metres, with an armature scale of 1. Each clip adds about 77 KB to `clips.json` before compression.

## Game changes
- `render3d/assets.js`: `DANCES` and `danceFor(slug)`. A hero's dance is retargeted with its other clips, so one dance is retargeted for each hero.
- `render3d/units.js`: a hero dances when it is alive, `state.winner` equals its team, and reduced motion is off. It eases its facing to the camera and loops the clip with a 0.3 second blend. The pose list reports the stage `victory`.
- `main.js`: the result waits `CELEBRATE_MS` (3500) after a team wins.

## Checks
`qa/tidebreak/victory-dance.e2e.mjs` covers each scenario in software WebGL at 1280x720 and 390x844, and saves screenshots with `SHOTS=<dir>`.
