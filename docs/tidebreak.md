# Monster Mash

A mobile folklore MOBA in the Warden arcade. The existing `/tidebreak/` route and draft PR are retained so prior links work. One player joins two bots against three bots. No runtime generation service, new dependency, or account is required to play.

## What changed

The original 1600 × 1600 reef was too cramped and its three characters played too similarly. The arena is now 9600 × 9600 units (2.25 times the area of the 6400 map before it). It has three lanes with three wards each, two guardians per base, eight spirit camps, a winding traversable river and six rift gates. Every hero moves 35% faster outside combat (keyboard, click orders and bots alike), and rift gates have a 15-second cooldown. See "Arena and pacing" below.

Every 40 seconds, the town becomes deep woods or returns. Town blocks have broad collision and line-of-sight footprints. Forest groves have smaller footprints, opening flanking passages. Vision shrinks from 950 to 620 world units. Marked brush hides creatures beyond 125 units unless they attack or take damage. A basic attack from concealment deals 75% extra damage to a creature. Attacking reveals the attacker for 2.6 seconds. Both bot targeting and player targeting enforce line of sight. Hidden enemy units are culled from the battlefield and minimap; allied vision is shared. The woods also add atmospheric distance fog.

| Creature | Movement | Skill | Ultimate at level 3 |
| --- | --- | --- | --- |
| Mothman | Flies over obstacles and cloaks | Slowing wing blast | Blackout: cloak, sight through cover, fear |
| Nessie | Healing dive, slowing wake; river speed bonus | Pulls a forward cone of enemies | Flood: persistent damage, slow and allied healing |
| Baba Yaga | Play the chicken-legged hut; hop and shield | Places a hidden rooting trap | Three damaging, stunning stomps |
| Jersey Devil | Leaps over obstacles; stunning landing | Fears nearby enemies | Eight-second attack frenzy with life steal |

## Match and controls

Escort wisp waves into ward range. Wards prioritize wisps; attacking a creature under its ward draws its fire. Each lane has an outer, a middle and an inner ward, and each ward is protected while the previous one on its lane stands. Any fallen inner ward opens the two rift guardians; both guardians must fall before the elder rift can be damaged. Wards and rifts take 75% less hero damage unless a wisp of the attacking team is at them. At 14:00 sudden death opens every structure; at 17:00 the team that broke more structures wins.

The Wild Hunt rises in the central ford after two minutes and returns 150 seconds after each kill. The team that slays it recruits a siege beast in the killer's lane. Spirit camps award embers, healing and temporary haste. Team kills, camps and waves share experience and embers. Start with 360 embers and earn 1.3 per second in addition to combat rewards. Spend them on recipe components and completed items in the Night Market. Both teams use the same economy. Death leads to respawn at the healing rift.

- Touch: left movement pad; tap a skill for aim assist, or drag and release to aim. Basic attacks are automatic. Tap an enemy or Attack to change target.
- Tap the minimap for a large tactical map. Tap a position or a named destination to place a navigation marker.
- Near a river gate, Rift Jump crosses to the paired gate on the other side of the map. A gate near each base sends a hero to the team's own river gate on the side the hero faces. Return channels a trip home and cancels on movement or damage.
- Keyboard: WASD/arrows move; Q/E/R skills; F gate; M map; B return; Esc or the top-left Menu button opens the menu. The view follows the hero, and moving the mouse left or right pushes the view that way. Skill buttons also support keyboard and assistive activation.
- Pause, help, shop, map, focus loss and the arcade game switcher pause the simulation. Pointer cancellation, resize and dialogs clear held input.

## Arena and pacing

`arena.js` holds `SIZE` and the scales derived from it. `layout.js` writes team 0's half of the map as fractions of `SIZE` (lane knots, guardians, gates, camps, brush, cover, river knots, districts, landmarks and groves); `world.js` mirrors it across the river (y′ = SIZE − y), so both teams get the same map. Footprints (cover, brush radius, river width and bridges) use the fixed `FEATURE_SCALE`; scattered scenery counts follow `AREA_SCALE` and river details follow `LENGTH_SCALE`. A change to 12800 is one constant plus a pacing retune.

- Lanes: the side lanes run about 11500 units base to base. The middle lane swings west, back across the centre line and east of the Wild Hunt ford, so it is about 9500 units. Each lane crosses the river once, at the axis.
- Wards stand by walking distance from their own base (`TOWER_ARC`): side lanes 1250 / 2450 / 3700, middle 1100 / 2180 / 3250. Consecutive wards are at least 2.5 tower ranges apart in a straight line.
- Guardians flank each court. A guardian slam marks a 230-unit circle 0.8 s before impact; afterwards the guardian is exposed for 1.4 s and takes 25% more damage.
- Outer wards take half damage for the first 3:30. Waves (two melee wisps, a caster and a siege wisp every third wave) leave the base every 20 s from 0:23 and grow 6% stronger per minute after 5:00. An elder wisp joins a team's waves on a lane where the enemy inner ward is down, and every wave in sudden death.
- Sudden death (14:00): all protection is lifted, structures take 50% more damage and no longer need a wave, home heals only 2% per second, respawns take 50% longer and basic attacks of heroes and wisps grow stronger. Hard limit (17:00): structures broken, then structure health, then kills, else a draw.
- Respawn is 6 + 1.2 × level seconds (at most 28). Bots walk with their wave, join the push on any enemy lane that is open to its base, never into an enemy ward that no wisp of theirs tanks, and side-lane bots use their base gate when their wave has passed the river gate.

| Structure | Health | Range | Damage | Rewards (XP / embers, whole team) |
| --- | --- | --- | --- | --- |
| Outer ward | 3600 | 360 | 210 | 120 / 110 |
| Middle ward | 5200 | 385 | 225 | 150 / 130 |
| Inner ward | 6000 | 410 | 240 | 180 / 160 |
| Guardian (×2 per base) | 5000 | 420 | 240, slam 380 | 200 / 180 |
| Elder rift (armor 80; heals 1.5% per second while no enemy wisp is at it) | 24000 | 420 | 260 | win |

Measured pacing (36 seeded bot matches, each with its own draft, `scratchpad` script `pace.mjs`): first skirmish 0:38, first blood about 0:58, first outer ward 3:15–3:35, first middle ward 5:15–5:40, first inner ward 8:00–8:45, rift exposed 10:40–11:20, match end median about 12:00 (p25 about 9:30, p75 about 15:00). Mirrored drafts (both teams use the same kits, lane for lane) split 18–18, so the layout favours neither side.

## Items and builds

Six slots hold 18 items: six components and twelve completed items. A recipe consumes owned components and charges only its remaining price; forging works with a full bag if consuming its components frees a slot. Completed items are unique. Selling returns 70% of total item cost. Buying health never refills current health, preventing buy/sell healing exploits. Derived stats are recalculated from the creature, level and inventory.

| Build | First item | Play style |
| --- | --- | --- |
| Ambush | Nightfang | Cast, then land an empowered attack; kills reset movement skills |
| Bulwark | Root crown | Low-health shields, armor, sustain and a damaging aura |
| Hex | Witch lantern | Ability power, burns, slows and shorter cooldowns |
| Frenzy | Quickthorn | Third-hit damage, life steal and chain lightning |

Every creature can choose any build. The choice persists per creature on the device. Track a different completed item to override the next recommendation. Quick buy purchases the next affordable component or completed item. The market shows exact stats, recipe ownership, forge prices, inventory, resale and passive descriptions. Bots purchase components and completed items from these same definitions. `items.js` owns recipes and stat math; `market.js` owns the native shop UI.

## Implementation and art

`world.js` owns movement, collision, LOS, minimaps and the scenery footprint. `sim.js` is deterministic and browser independent. Basic attacks have a 120 ms wind-up before impact, with a range and LOS recheck. `main.js` owns touch, keyboard, dialogs and the fixed-step loop.

`render.js` uses the repository's vendored Three.js and GLTFLoader. An orthographic camera looks diagonally down on genuine 3D geometry. Screen-space movement and aimed skills rotate into world coordinates; map picking uses a ray/ground intersection. The native canvas overlay projects labels, health bars and hit effects through the same camera. The tactical map shows the camera's rotated footprint.

Six textured GLBs were generated with Meshy v7.1 through fal: four creatures, a gothic town block and a pine grove. Reference art derives from the existing fal atlas and Higgsfield art direction. The new Night Market icons and isometric design concept use Nano Banana Pro through fal. `art/sources.json` records providers, request IDs, source URLs and integration paths.

Models use 5–6K target polygons and embedded textures resized to 1024 pixels. Creature animation is procedural vertex deformation: wings flap, Nessie's tail undulates, the hut steps, and the Devil's legs and wings move. Directional turns, attack anticipation/recovery, visual leap arcs, soft ground shadows and shield/skill effects complete the motion. These are not authored skeletal animation clips. Static forest and scenery geometry is batched; device pixel ratio is capped at 1.5 for WebGL and shadows at 1024. Foreground town blocks fade when they obscure the player.

404-GEN remains unconnected. Online multiplayer, authored animation rigs and physical-device performance tuning remain future work. The current game is one player with five bots and requires WebGL.

## Verification

Run `node qa/tidebreak/sim.test.mjs`. It verifies the 9600 map, open lanes in both realms, collision recovery on a shift, blocked LOS, concealment and reveal, ambush damage, wall-blocked attacks, four distinct kits, portal and base gate transit and cooldown, completed-item uniqueness, respawn, return interruption, objective rewards, wave content and elder wisps, sprint parity, wave-gated bots, sudden death, the hard-limit tiebreak, deterministic replay and six full bot matches. `towers.test.mjs` checks the mirrored ward distances and spacing, the protection chain on every lane, guardian and core gating, backdoor protection, fortification and the guardian slam. `river.test.mjs` checks that every lane crosses the river once. With the server running, `ground.e2e.mjs` checks that the 2D ground paints water at every river sample.

Browser flow: choose a creature → start → move with one thumb while aiming a skill with the other → release → pause/resume → Night Market purchases / build change / sale → map destination → realm shift → full result → replay. Local Chromium loads checked-in files through request routing because Cloud Browser rejected loopback navigation with `ERR_BLOCKED_BY_CLIENT`. The rendered checks cover 390 × 844, 320 × 568, 844 × 390 and 1440 × 900. The public preview is checked separately in Cloud Browser after publishing.

Run `node qa/tidebreak/items.test.mjs` for atomic recipes, inventory limits, no healing exploit, resale, level scaling, all twelve item effects, build selection and tracking.

## Concept comparison

| Reference | Implementation |
| --- | --- |
| Ivory two-line serif title and lime start button | Native text and buttons, with the same hierarchy and palette |
| Eerie Mothman against shifting town/forest | Generated portrait with the live 3D world behind the menu |
| Four creature selection cards | Four interactive cards with generated portraits; selection changes name, role and kit |
| Full-bleed painted scene | Textured 3D town blocks and groves follow the physical collision footprints |
| Tall cinematic creature | Textured meshes use larger silhouettes and projected health labels; Baba Yaga is the walking hut |

The concept is visual direction, not a screenshot used as the application. All labels, controls, match state and map interactions are native. Local visual review caught and fixed a fourth-card overflow on phones. Geometry checks caught and fixed scenery intersecting the outer lanes.


The second concept, `docs/monster-iso-concept.webp`, sets the angled camera, moonlit village, chartreuse shop tabs, recipe panel and six-slot inventory. The implementation retains those relationships and uses a scrolling native shop on narrow phones. Differences: minions and wardstones use simple procedural meshes; creature motion uses deformation rather than studio animation rigs. All shop text and controls are live native elements.

The final 3D browser pass used 20 fps render scheduling in the software-GPU test harness while retaining the 60 Hz simulation. It passed real multitouch movement/aim, purchases, component ownership, build switching, resale, map markers, realm transition and restarting with all four creatures. Viewports: 390×844, 320×568, 844×390, 1440×900. No relevant console or asset errors. Cloud Browser reports WebGL disabled; unsupported browsers receive a clear graphics message. This is not a physical-device performance benchmark.


## Vertical camera, fluid controls and relic builds

The latest pass rotates the camera yaw from 45° to 0°, retaining a 45° elevated 3D view. The main lane and minimap now run vertically: allied base below, enemy base above. The hero sits slightly below center to expose more of the lane ahead. Screen-to-world movement and aim use the same projection; the renderer reports the projected lane X difference for QA.

The attack button is removed. Auto targeting prefers visible enemy creatures in range, holds a valid focus, then selects another target when it dies or leaves range. It checks line of sight and never walks the player toward a target. Tapping a creature remains an optional override. The left pad starts from the touch point; the right thumb has three larger ability buttons in a fan. Tap for aim assist or drag and release. The shop and quick buy form one small bottom strip. Return is in the pause menu, and rift jump appears only near a gate or during its cooldown.

The catalog now contains 26 items: six components, twelve finished items and eight relics. A build can contain one relic. Two finished items forge into a relic, which inherits their powers while replacing their stats. Recipe quotes consume each matching finished item or nested component exactly once. Quick buy follows unfinished branches; relic ownership counts as ownership of its inherited powers and prevents duplicate purchases. Four saved build paths now include a relic. The shop shows upgrade branches, inherited effects, trade-offs and active synergies.

| Relic | Build change |
| --- | --- |
| Eclipse covenant | Empowered attacks add missing-health damage; kill resets enable pursuit |
| Tempest engine | Third-hit lightning also damages the primary target |
| Winter sovereign | Three spell hits within 5 seconds root; per-target 10-second cooldown |
| Hollow inferno | Burns against slowed targets deal 60% more damage |
| Worldroot pact | Ultimate casts shield nearby allies; loses 20 movement speed |
| Pale reaper | Attacks cut healing by 45% for 4 seconds and damage shields 50% faster |
| Starfall grimoire | Three casts charge an explosive next attack; loses 120 health and 8 armor |
| Gravemaw idol | Damage aura scales with maximum health; loses 25 movement speed |

Lantern + Frost grants 35% stronger burns against slowed targets. Root + Beacon adds 1% of the owner's maximum health to each healing pulse. Relic upgrades keep these interactions without duplicating stats. Healing reduction applies to skill healing, item healing, life steal, regeneration and fountain healing. Shield-breaking bonus applies only to shield absorption.

Higgsfield produced `monster-vertical-concept.webp`. A subsequent terrain-atlas request was rejected because the Higgsfield workspace had no credits. The shipped pass therefore implements the concept through native 3D geometry and materials: fine cobbles, grass tufts, wind, flowing water and foam, bank stones, amber lanterns, motes, detailed wardstones, directional light and shadows. Existing generated creature and village meshes are retained. This is an art-directed mobile renderer, not a claim that the live game reproduces the concept's offline-render detail. The concept's full environment and UI remain references; no concept screenshot is placed over gameplay.

Validation: item tests cover nested discounts, relic uniqueness, inherited powers, quick-buy recursion, all eight relic effects, negative-stat trade-offs, healing reduction, synergy multipliers and automatic targeting without chasing. Twelve complete deterministic bot matches finished in 97–216 seconds, with 12–28 creature kills and at most 50 units. Real-phone frame rate remains unmeasured.


The browser pass verified simultaneous touch movement and aimed casting, release, pause, quick-buy, nested recipes, relic browsing, trade-off descriptions, resale, map marking, realm transition and all four creature restarts. Viewports: 390×844, 320×568, 844×390 and 1440×900. No console or HTTP errors. A post-batching smoke capture loaded all four models, reported a zero horizontal difference between the main-lane endpoints, and used about 158 draws / 277K triangles in the opening scene. The local software-GPU harness limits rendering to 20 fps for longer interaction tests; it is not a phone-performance measurement.

## Selected cartoon direction

The user selected the Rick and Morty-inspired concept at `public/tidebreak/styles/rick-and-morty.webp`. The playable renderer now uses four-band cel lighting, a single depth-based ink-outline pass, lifted albedo on the generated GLBs, muted olive/teal woods, cyan creek water and violet enemies. The same animated creature models remain original folklore designs. Town props occupy the western side while eastern obstacles use pine groves; the woodland phase still transforms the town. Collision and line-of-sight footprints are unchanged.

The direct Higgsfield API generated the production texture atlas `art/toon-ground.webp` from the selected concept using `marketing-studio/image`. Its four quadrants supply dirt, grass, water and cobblestones. `higgsfield/monster-toon-assets.json` preserves the prompt and input reference; `art/sources.json` records the completed request. The temporary authenticated generation route was removed after completion.

`toon.js` owns the material ramp and outline render target; `toon.css` supplies inked HUD borders, cyan ability discs, tarnished gold rings and the matching market palette. Camera yaw remains zero and the main lane projects vertically. Existing labels, automatic attacks, three special abilities, item recipes and simulation rules are preserved.

This adapts the concept to the existing playable three-lane arena: it does not reproduce the concept's fixed illustration, invented UI numbers, or exact village layout. The HUD retains the game's score, timer, objectives and cooldowns. Existing portrait/item illustrations and native 3D towers, bridge geometry, foliage and effects remain; their surfaces now share the toon palette. Physical-phone GPU performance is not yet measured.


## Reference-matched illustrated arena

The user clarified that the playable game should reproduce the selected image's appearance, rather than add comedy or merely recolor the existing meshes. This pass uses 23 separate Higgsfield-generated illustrated assets, each generated against `styles/rick-and-morty.webp`: front/back views of four creatures, two crooked houses, pines, standing stones, two crystal towers, two wisps, a stone bridge and six ability illustrations. Their prompts and request provenance are committed. No humor additions were retained.

The default renderer is now `illustrated-render.js`, a Canvas 2.5D orthographic stage with a moving camera, depth-sorted independent scenery and actors, front/back facing, movement sway, Nessie tail deformation, attack lunges, airborne ability arcs and world-space combat effects. This is an illustrated rendering approach, not a claim that the new sprites are 3D meshes. It reproduces the selected image's linework and silhouettes directly and also works where WebGL is unavailable. The earlier mesh renderer remains in source as an alternative implementation.

Camera framing is bounded by both viewport width and height, preserving the vertical lane, the large Nessie silhouette, the bridge above the player, and the purple tower in the distance at the reference aspect ratio. The HUD uses the generated brass-rimmed ability art, a circular map and a compact six-slot shop strip. Nessie is the initial menu selection. Player health, actual score, objective text, cooldowns, one-relic builds and match actions remain live UI. The reference's arbitrary numbers and three-slot inventory are not copied.

The active creek crosses horizontally; its geometry and Nessie's water-speed test share `CREEK`. Additional central street cover keeps all three bot lanes open. New scenery fades when it would cover the player. Rendered creature bodies have hit boxes for optional tap focus; automatic targeting remains in the simulation. The scene is built from individual assets and live entities, never a screenshot pasted behind controls.

Validation: item suite and twelve complete deterministic bot matches; mobile multitouch movement and aimed casting, pause, keyboard, purchases/recipes/relics/resale, map markers, realm transition and all four hero restarts. Viewports 390×844, 320×568, 844×390 and 1440×900; additional 390×690 visual comparison against the normalized source. No console or asset errors in the final gameplay run.
