# Design: grand arena in 3D

## 3D assets (done before the code work)
Credits were limited (406 at the start), so the pipeline uses the cheapest step that holds quality at each stage. It was chosen by a
side-by-side test on Tidewarden: Meshy 7 image-to-3D (38 credits) put the weapons on the floor in its A-pose mode and gave only a base
colour map. Tripo H3.1 (9 credits) kept the weapons and gave full PBR maps. SAM 3 (1 credit) lost the trident.

1. One reference image per hero with GPT Image 2.5: front view, A-pose, empty hands, the weapon standing apart. The first hero's image is
   the layout and style reference for the rest, so all sixteen match.
2. Tripo H3.1 turns the image into a textured PBR mesh. Weapons come out as separate mesh parts because they stood apart in the image.
3. Tripo faces +X; the Meshy rigger assumes +Z. A model that is not turned gets a broken skeleton, so the mesh is turned 90 degrees.
4. The Meshy rigger fails on a body that is not centred (a weapon on one side moves the body off centre), so only the body is rigged.
   The weapon parts are added back after rigging, fixed rigidly to the hand or forearm bone. A weapon skinned by the rigger bends like
   rope; a rigid prop does not.
5. Each rig job buys one animation clip, so every hero bought a different clip. clips.json keeps each clip with the bind pose of the
   hero it was made on. hero-rig.js retargets any clip to any hero by world-space rotation deltas, which keeps the motion and fits the
   bones. Only hip height moves, so no clip slides a hero away from its simulation position.
6. The rigger's material is a flat emissive copy of the base colour. The Tripo PBR maps (base colour, ORM, normal) are restored, because
   the rig keeps the same UV atlas, and stored as WebP. Meshes are quantized and meshopt-compressed (decoder in lib/).
7. Towers, cores, the Wild Hunt and the camp beast are static Tripo meshes. Scenery props come from one prop sheet through SAM 3 and are
   simplified for instancing.

Result: 16 heroes in about 7 MB, a 1.3 MB clip library, 1.6 MB of world models. Spent: about 400 credits, 6.25 left. The scripts are in
`higgsfield/models3d/` and the job IDs in `public/tidebreak/models/sources.json`.

## Rendering
- `three-render.js` keeps the whole 2D renderer interface. It borrows `adapt`, `restartTiming`, `drawMap`, the minimap markers, badges and
  results from the 2D renderer's prototype, so both views share one resolution rule and one minimap. `world()` raycasts to the ground plane;
  `pick()` uses screen hit boxes from projected feet and heads.
- The camera looks 55 degrees down with a 34 degree field of view and follows the hero by the 2D rules (lead, mouse push, edge clamp). The
  clamp uses the perspective footprint of the screen corners. Narrow screens pull the camera back.
- A WebGL canvas and a transparent overlay canvas sit after `#battle` with no pointer events. `#battle` stays the input surface, so the live
  switch between 2D and 3D cannot lose input. The 3D module is a dynamic import; the 2D view never downloads three.js.
- Choice: 3D when WebGL2 runs on a graphics card. A software renderer (SwiftShader, llvmpipe) takes seconds per frame, so it starts in 2D.
  `?renderer=3d`, `?renderer=2d` and the Graphics row override it.
- Light: a low golden sun, a cool hemisphere fill, a PMREM environment from a gradient sky, ACES tone mapping with a small grade, distance fog
  and one shadow map that follows the camera. Each realm has its own mood and the change blends over about 1.1 s.
- Ground: one plane with a splat shader (grass, meadow, moss, dirt lanes, stone plazas, sand). The masks are painted per match from the live
  layout. The river is a ribbon mesh with depth tint, fresnel, ripples and glint.
- Scenery is instanced per kind and realm and culled to the view (and the long shadows that reach it). Props near the camera dissolve when
  they hide the player's hero.
- Heroes: one GLB clone and one mixer each. The attack clip is time-scaled so its strike lands at `attackStarted + attackWindup`. Lane
  soldiers are pooled and animate at 20 Hz when far. Effects use one draw call per family (decals, light ribbons, two particle pools, two
  pooled point lights). Bars, names, labels and numbers are drawn on the overlay canvas in screen space.
- The combat tells (windup rings, tower lock beam, third-strike reach, hitstop, marks) are sim or presentation data that both renderers draw
  (`combat-tells-draw.js` for 2D, `render3d/tells.js` for 3D).

## Map, towers and pacing
- `SIZE` is 9600. Positions are fractions of `SIZE`; cover, brush, river width and bridges keep a fixed size (`FEATURE_SCALE`); scenery counts
  follow area and river details follow length. `layout.js` holds team 0's half and `world.js` mirrors it across the river, so the map is fair
  by construction (mirror matches split 16 to 20 over 36 games). A 12800 map is one constant plus a pacing retune.
- Each lane has outer, middle and inner wards, then two guardians per base, then the core: the protection chain. Wards of both teams are the
  same walk from their base within 2%, and consecutive wards are at least 2.5 ranges apart.
- Guardians slam a 230-unit circle with a 0.8 s warning, then stay exposed for 1.4 s. The core has 24000 health and armour 80 and heals
  while no enemy wisp is at it, so a core falls only after a won fight, not to a lone hero. Heroes deal 25% damage to structures without a
  wisp of their team at the structure (backdoor protection).
- Waves add a caster wisp, a siege wisp every third wave, and an elder wisp on a lane whose enemy inner ward is down. Sprint applies to every
  hero and bot.
- Sudden death at 14:00 lifts all protection and speeds the finish; a hard limit at 17:00 decides by structures broken, then structure
  health, then kills. Measured over 72 seeded bot matches: first outer ward 3:15, core exposed 10:38, median end 11:33, none at the hard
  limit. The old 6:00 limit ended 15 of 36 matches.

## Combat feel and bots
- The combat changes follow the ten rules in `docs/combat-fun-system.md` by the audit in `research/combat-audit.md`. Each mechanic is data
  on the sim state (`notes/combat-feel.md` lists the fields), so both renderers and the bots can read it.
- Hitstop never pauses the 60 Hz sim. `ImpactFeel` freezes only the drawn pose of the two units in a hit, for 60 to 90 ms, at most once per
  0.3 s, so seeded replays stay the same.
- Punish windows use one rule: a committed cast that hits nothing exposes its caster, and hits on an exposed hero deal 15% more. The same
  OPENING HIT cue already marked exposed camps and the boss, so players learn one signal.
- Lane mana regeneration fell from `6 + 0.35 x level` to `3.5 + 0.25 x level`. A player who casts on cooldown is now short of mana 15% of
  their living time (the audit's target was 10 to 20%); a careful player stays near 6%.
- Bots: see `notes/bots.md` (difficulty profiles in `bot-difficulty.js`, short hooks in `sim.js` and `combat-ai.js`).
