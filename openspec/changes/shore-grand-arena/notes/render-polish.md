# 3D render polish: mythic realism

Branch `claude/quirky-cerf-vwf0qw-render`. This pass works on the 3D battlefield (`three-render.js`, `render3d/`)
and the hero select portraits. It does not change the simulation, the HUD CSS or any game rule.

Contact sheets: `render-polish/` (before on the left, after on the right, one row per scene).

## 1. What changed and why

### Trees, bushes and grass (`render3d/foliage.js`, `render3d/props.js`)
- The pine and oak GLB crowns read as cardboard and crumpled paper from the game camera. Trees are now built in code:
  - **Broadleaf:** a tapered trunk, six limbs and about 25 clusters of leaf cards over an uneven crown.
  - **Pine:** a trunk and nine drooping tiers of needle cards that shrink toward the top, with a leader.
  - **Shrub:** leaf clusters in a low dome.
  - **Grass tuft:** five cards that lean out like a fan, so a tuft reads as a clump from the high camera.
- One 512 x 512 atlas holds a leaf cluster, a pine spray, bark and grass blades. It is painted on canvas at start.
  Colour and cut-out alpha are separate, so mip levels keep the leaf colour at the cut edge.
- Card normals lean out from the crown centre, so a crown shades as one soft mass. The back-face normal flip is
  removed, so both sides of a card keep that normal.
- Light shows through thin leaves. Leaves flutter in the vertex shader, on top of the old trunk sway.
- Only the leaves take the instance tint: mostly summer greens, about one crown in four gold or amber, pale birch.
  Bark keeps its own colour. No crown is flat brown.
- Everything stays instanced: one draw call per kind and realm set, as before.
  - A broadleaf tree is about 230 triangles; the simplified GLB oak was larger.
  - Trees are alpha-tested with alpha to coverage. Shadows use the same cut-out.
- Grass tufts sit on open grass near the view: up to 2400, one draw call, rebuilt only when the view moves.
  - They are placed on a hashed grid, so the same ground always gets the same tufts.
  - Lanes, sand, stone and water stay clear (the ground masks from `terrain.js`).
  - Tufts grow in patches, are thinned evenly on wide screens, and are dropped when the frame-rate rule lowers quality.
- `pine.glb` and `oak.glb` are no longer loaded. The files stay in `models/world/`.

### Nothing hides the fight (`render3d/materials.js` `SEE_GLSL`, `three-render.js` `seeThrough`)
- The see-through tube to the player's hero is now up to eight tubes:
  - the player's hero;
  - every other visible hero;
  - soldiers, camp beasts and summons within 240 units of the pointer.
- Scenery **and towers, guardians and cores** between the camera and one of these units thin out around it. Nothing
  behind the unit is cut.
- Tower heights are lower: 440, 490, 540 and 600 (were 520, 600, 680 and 760). The core is 660 (was 760).
  - Inner tiers still stand taller.
  - From the 55 degree camera, a 440-unit tower now hides about 310 units of ground behind it (was about 360).
- Heroes are 262 units tall (was 230). The player's hero stays 10% taller than that. `pick()` builds its boxes from the
  drawn height, so picking scales with the heroes.

### Crystals that glow without clipping (`materials.js` `unitMaterial`, `units.js`)
- The tower and core crystals are near-white, mirror-smooth texels (roughness 0 in the material map). They reflected
  the bright sky and turned white.
- A crystal texel is now found two ways: pale and grey, or glossy in the roughness map (some crystal texels are pale
  blue).
- Such a texel takes a dark, saturated team colour. It has roughness 0.5 and no metal.
- Its glow is in the team colour, and is reduced where the lit surface is already bright.
- The glow sprite is half as strong. Team tints are more saturated.

### Readability (`effects.js` decals, `render3d/tells.js`, `units.js` outlines)
- Ground warnings have a thin dark outline outside their edge, about 9 units wide at any size. They read on sunlit grass
  and in the dark woods.
- Cast warnings fill as the hit comes closer: fill alpha goes from 0.2 to 0.42.
- Hostile warnings are a saturated red-orange (`#ff5a3d`, was a pale salmon).
- The warned third strike has a pulsing ring, 8 units wide (was 5), with an outline, a faint fill and a solid line to
  its target.
- Heroes have a thin team-coloured outline, 1.35 px at 900 px screen height (scaled with height, never under 1 px):
  - teal for allies, crimson for enemies, gold for the player;
  - drawn with a back-face copy of the skinned body that shares its skeleton;
  - pushed behind the body in depth, so open cloth does not show the line on its face;
  - hidden while the hero is dead or concealed.

### Element looks for spells (`render3d/elements.js`, `effects.js`, `textures.js`)
- Every hero casts with one element, chosen by identity:
  - **Water:** a splash of droplets and mist, with rippling rings.
  - **Fire:** rising embers, dark smoke and a scorch mark.
  - **Void:** motes pulled into a dark swirl.
  - **Stone:** rock chips with gravity, dust and cracked ground.
  - **Wind:** pale motes spinning outward and swirl ribbons.
  - **Light:** falling sparkles, rising rays and a golden ring.
- Ultimates add a light pillar.
- The particle pools now use 2 x 2 atlases with a frame per particle:
  - additive pool: glow, star, droplet, streak;
  - soft pool: smoke, dust, wisp, rock chip.
- The decal shader has a cracked-ground shape.
- All of this goes into the existing pools, so each family is still one draw call.
- A spell near the view lights the ground with the existing point-light flash in the element colour.
- An ultimate, or the player's own spell, also adds a short screen-space glow on the overlay canvas: about 0.2 s, off
  with reduced motion.

### Motion (`units.js`)
- **Windup pose.** The lean-back and crouch come from the windup clips (`render3d/windup.js`). They arrived from the
  combat feel branch during this work.
- This branch had its own procedural chest lean and a slowed cast clip. Both were removed in the merge: they doubled
  the lean and weakened the engage crouch that the combat-feel test measures.
- No sim field was added.
- **Death.** The death clip plays and holds. The body then burns away from the head down in soft world-space blobs,
  with an ember edge and a few ember sparks, and sinks a little. This replaces the screen-door dot fade, which looked
  dotted.
- The body's shadow is dropped when the burn starts.

### Hero select portraits (`qa/tidebreak/render-portraits.mjs`, `art/portraits/`)
- The full-length shots now have their own light set (`LOOKS.full`):
  - key 5.6 (was 3.8), warmer;
  - rim 7.2 (was 5.2);
  - warm kick 2.2 (was 0.9);
  - a new warm bounce from below;
  - fill 1.05 (was 0.55), warmer;
  - environment 0.85 (was 0.55);
  - exposure 1.5 (was 1.15).
- The busts keep their old light set and came out byte-identical.
- All 32 files were rendered again.

### Water and ground (`terrain.js`)
- **Shore foam:** a broken white edge and thin lines that run in toward the bank, dimmer in the woods.
- **Wet bank:** within about 100 units of the water, sand and soil darken and turn glossy. This uses a blurred mip of
  the water mask, so it costs one extra texture read.
- The river already spans the 9600-unit map, and its bridges match the lanes. Its shape is unchanged.

### Review fixes from the main session
A review on the main branch reported five 3D renderer bugs and one flaky check. Each was reproduced there and is fixed
here:
1. **Bridges missing from the maps.** The minimap and tactical map lost the river bridges in 3D, because the shared
   `drawMap` reads `this.bridges` and only the 2D renderer set it. `setScene` now copies `terrain.bridges`.
2. **No FORTIFIED label.** A fortified outer ward now reads `OUTER WARD · FORTIFIED` in 3D, as in 2D.
3. **Endless loading notice.** A hero model that fails to load no longer keeps "Heroes are still loading" on screen.
   It is not counted as a stand-in and is not retried.
4. **Wrong texture mapping on built props.** Walls, pillars, logs and timber had lost their world-space texture
   mapping: the scenery patch replaced the `worldMapped` patch instead of chaining it. The patch now runs the
   material's own patch first. The program key carries each texture scale, so walls and pillars no longer share one
   program.
5. **Hitstop ring gives away hidden units.** The hitstop ring is drawn only on units that team 0 can see, so a hidden
   attacker stays hidden.
6. **Flaky windup check.** The engage-crouch check in `combat-feel-3d.e2e.mjs` compared two frames 12 frames apart, so
   it was flaky. It now compares one frame with the windup clip's weight at zero and at its value, at the same clip
   times.
   - How a hero splits the move depends on the model the draft picks. One leans forward about 5% of its height and
     drops 0.5%; another leans 2% and drops 3%.
   - So the check asks the head to move both forward and down, by more than 3% of the height together.
   - The lock-beam pixel screenshot also gets a 120 s timeout, because a SwiftShader frame of the full scene can take
     longer than 30 s.

### Not done
- The 3D arena behind the hero select is not drawn. It needs a change in `main.js`, which another session owns.

## 2. Performance

Measured in Chromium with SwiftShader on the staged scenes of `qa/tidebreak/render3d-shots.mjs`. Draw calls and
triangles come from three's renderer info, shadow pass included. The "base" scene is the busiest fight: six heroes, a
dozen soldiers and three spells beside the enemy guardians.

| Size | Scene | Draw calls before | Draw calls after | Triangles before | Triangles after |
|---|---|---|---|---|---|
| 1440x900 | start | 65 | 63 | 0.46 M | 0.20 M |
| 1440x900 | lane | 89 | 105 | 0.55 M | 0.34 M |
| 1440x900 | base | 150 | 170 | 0.81 M | 0.70 M |
| 1440x900 | core | 144 | 167 | 0.76 M | 0.69 M |
| 1440x900 | river | 60 | 64 | 0.35 M | 0.18 M |
| 1440x900 | telegraph | 77 | 80 | 0.46 M | 0.31 M |
| 1440x900 | effects | 65 | 68 | 0.43 M | 0.17 M |
| 1440x900 | death | 75 | 76 | 0.48 M | 0.22 M |
| 1440x900 | woods | 53 | 57 | 0.33 M | 0.14 M |
| 3440x1440 | start | 71 | 77 | 0.59 M | 0.28 M |
| 3440x1440 | lane | 117 | 107 | 0.71 M | 0.34 M |
| 3440x1440 | base | 154 | 176 | 0.93 M | 0.77 M |
| 3440x1440 | core | 158 | 182 | 0.89 M | 0.76 M |
| 3440x1440 | river | 78 | 81 | 0.54 M | 0.24 M |
| 3440x1440 | telegraph | 88 | 99 | 0.63 M | 0.37 M |
| 3440x1440 | effects | 76 | 79 | 0.53 M | 0.24 M |
| 3440x1440 | death | 91 | 99 | 0.61 M | 0.33 M |
| 3440x1440 | woods | 67 | 68 | 0.49 M | 0.23 M |
| 390x844 | start | 56 | 60 | 0.42 M | 0.21 M |
| 390x844 | lane | 86 | 92 | 0.64 M | 0.33 M |
| 390x844 | base | 169 | 185 | 0.82 M | 0.67 M |
| 390x844 | core | 165 | 181 | 0.82 M | 0.66 M |
| 390x844 | river | 60 | 64 | 0.49 M | 0.19 M |
| 390x844 | telegraph | 82 | 97 | 0.59 M | 0.37 M |
| 390x844 | effects | 61 | 65 | 0.49 M | 0.18 M |
| 390x844 | death | 62 | 64 | 0.51 M | 0.18 M |
| 390x844 | woods | 56 | 60 | 0.32 M | 0.19 M |
| 844x390 | start | 67 | 71 | 0.53 M | 0.23 M |
| 844x390 | lane | 107 | 119 | 0.67 M | 0.41 M |
| 844x390 | base | 159 | 171 | 0.83 M | 0.73 M |
| 844x390 | core | 156 | 170 | 0.83 M | 0.73 M |
| 844x390 | river | 64 | 67 | 0.47 M | 0.21 M |
| 844x390 | telegraph | 76 | 88 | 0.54 M | 0.34 M |
| 844x390 | effects | 65 | 80 | 0.46 M | 0.23 M |
| 844x390 | death | 77 | 99 | 0.52 M | 0.32 M |
| 844x390 | woods | 62 | 66 | 0.42 M | 0.22 M |

- **Busiest fight:** at most 185 draw calls (390 x 844 base) and 0.77 M triangles (3440 x 1440 base). The budget is
  200 draw calls and 1.5 M triangles.
- **Where the extra draw calls come from:** mostly the hero outline copies, one per hero body part.
- **Why triangles fell by 15 to 60%:** the leaf-card trees are lighter than the simplified GLB trees.
- **Matches differ between shots.** Each page load drafts a new match, so the seed (river shape, bridges) and the hero
  line-up differ between the before and after shots. The camera spots follow the same rules.
- **`adapt()` keeps working.** When it lowers quality, the shadow map shrinks as before, and grass thins with quality
  and drops out below 0.6.


Frame time could not be measured on a real graphics card. On SwiftShader at 1440 x 900, the CPU cost per frame of the
start view was the same before and after (about 2 to 7 ms, `gl.finish()` included).

## 3. Tests run

All runs used SwiftShader in headless Chromium, with the static server on port 8765.

| Suite | Result |
|---|---|
| `qa/tidebreak/render3d.e2e.mjs` | 8 of 8 pass, after the merge. Also checks the FORTIFIED label and the minimap bridges. New check: trees, bushes and grass are leaf-card meshes, heroes have outlines, the see-through points include the player, towers take the see-through. Tower heights 440/490/540/600. |
| `qa/tidebreak/combat-feel-3d.e2e.mjs` | 8 of 8 pass, after merging the base branch. This includes the windup-clip check from the combat feel branch. New check: the death dissolve is 0.54, with no screen-door fade and the outline hidden. |
| `qa/tidebreak/desktop.e2e.mjs` | 17 of 17 pass, after the merge |
| `qa/tidebreak/*.test.mjs` (22 suites) | all pass |

Found and fixed while testing:
- **Bark over leaves.** Bark streaks wrapped onto the leaf part of the atlas. The bark is now clipped to its own part.
- **Wrong noise space for the dissolve.** The death dissolve used quantized model space. It now works in world space.
- **Shadow of a dissolving hero.** It stayed whole. It is now dropped when the burn starts.
- **Grass on wide screens.** The grass cap left one edge of a wide view bare. Grass now thins evenly.
- **Slow frames in SwiftShader.** Alpha to coverage made SwiftShader frames about 1.6 times slower.
  - Software renderers now use a plain alpha test.
  - A graphics card keeps alpha to coverage.
  - The contact sheets were shot before this change, so they show alpha to coverage.
- **Hero models stuck as stand-ins.**
  - Hero parsing waited for idle time, which a slow device never has. Each hero now parses within a second.
  - A stand-in checked for its model only every tenth frame. It now checks every frame (a map lookup).


## 4. What could not be checked

- **No real GPU.** All frames are SwiftShader, so frame rate, alpha-to-coverage quality and the outline width on high
  DPI screens are unchecked.
- **No phone.** 390 x 844 and 844 x 390 are desktop Chromium at those sizes, with touch emulation.
- **3440 x 1440 is scaled.** It was drawn at device scale 0.5, because a full-size SwiftShader frame timed out.
- **No motion review.** Wind sway, leaf flutter, the windup lean and the death burn were checked as values and still
  frames, not in motion.
- **No audio change.**

## 5. Draft requirements (delta)

## ADDED Requirements

### Requirement: Natural trees and grass in 3D
The 3D battlefield SHALL draw trees, shrubs and grass as leafy shapes in natural greens with some autumn colour, not
as flat cut-outs or brown sheets.

#### Scenario: Look at a grove
- **WHEN** the player sees a grove in the town realm
- **THEN** broadleaf crowns show many leaves in mostly green tones, some gold or amber, never one flat brown
- **AND** pines show drooping tiers of needles around a trunk
- **AND** the crowns move a little in the wind unless reduced motion is on

#### Scenario: Open grass
- **WHEN** the view shows open grass
- **THEN** small grass tufts grow in patches on it
- **AND** no tuft stands on a lane, a plaza, a river bank or in the water

### Requirement: Units stay visible behind scenery and structures
The 3D battlefield SHALL thin any tree, rock, wall, tower, guardian or core that stands between the camera and a
hero, and the same for a soldier, camp beast or summon near the pointer.

#### Scenario: A fight beside the guardians
- **WHEN** an enemy hero stands behind a guardian as seen from the camera
- **THEN** the part of the guardian in front of the hero thins out so the hero and its outline show through
- **AND** the guardian is drawn normally everywhere else

#### Scenario: Point at a soldier behind a tree
- **WHEN** the player moves the pointer over a soldier behind a tree crown
- **THEN** the crown thins out around that soldier

### Requirement: Clear heroes and warnings
The 3D battlefield SHALL give every hero a thin team-coloured outline and SHALL draw ground warnings with a dark edge
that reads on bright grass and in the woods.

#### Scenario: Tell teams apart in a crowd
- **WHEN** allied and enemy heroes fight in one place
- **THEN** allies have a teal outline, enemies a crimson outline and the player's hero a gold outline

#### Scenario: Dodge a warned spell in either realm
- **WHEN** an enemy starts a cast with a ground warning, in the town or in the woods
- **THEN** the warning is red-orange with a dark outline
- **AND** its fill grows stronger until the hit

#### Scenario: A warned third strike
- **WHEN** an enemy hero warns its third basic strike
- **THEN** a pulsing outlined ring shows the reach to leave, with a line to its target

### Requirement: Crystals glow without white clipping
Tower, guardian and core crystals SHALL glow in their team colour and SHALL NOT turn flat white in the low sun.

#### Scenario: Look at the enemy core
- **WHEN** the camera shows the enemy core and guardians in the town realm
- **THEN** their crystals are a saturated crimson
- **AND** no crystal area is flat white

### Requirement: Elemental spell effects
Each hero's spells SHALL show the hero's element (water, fire, void, stone, wind or light) with its own particles,
ground mark and light.

#### Scenario: Water and stone spells land
- **WHEN** a water hero's spell and a stone hero's spell land in view
- **THEN** the water spell throws droplets and mist and leaves rippling rings
- **AND** the stone spell throws rock chips and dust and cracks the ground

#### Scenario: A big impact with reduced motion
- **WHEN** an ultimate lands near the player and reduced motion is on
- **THEN** the effect shows without the short screen glow

### Requirement: Windup and death motion in 3D
A 3D hero SHALL lean back while its cast warning fills and SHALL burn away cleanly when it dies.

#### Scenario: An enemy winds up
- **WHEN** an enemy hero starts a cast with a warning
- **THEN** it leans back until the release, then strikes
- **AND** before an engage it crouches forward instead

#### Scenario: A hero dies
- **WHEN** a hero dies in 3D
- **THEN** it plays its death motion
- **AND** it then burns away from the head down with a glowing edge and no dot pattern
- **AND** its shadow goes with it

### Requirement: Bright hero select portraits
The full-length hero portraits on the hero select SHALL be lit brighter and warmer than the card busts, so dark armour
reads against the bright stage art.

#### Scenario: Choose a dark-armoured hero
- **WHEN** the player selects Tidewarden or Voidcaller
- **THEN** the full-length portrait shows the armour and robe detail in warm light with a clear rim
- **AND** the card busts keep their dark warm style
