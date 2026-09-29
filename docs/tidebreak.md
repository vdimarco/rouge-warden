# Monster Mash

A mobile folklore MOBA in the Warden arcade. The existing `/tidebreak/` route and draft PR are retained so prior links work. One player joins two bots against three bots. No runtime generation service, new dependency, or account is required to play.

## What changed

The original 1600 × 1600 reef was too cramped and its three characters played too similarly. The new 4800 × 4800 arena has nine times the area, three lanes, side spirit camps, a winding traversable river, and four paired rift gates. First waves and creatures start near the front, so the enlarged world does not add a long opening walk. Movement outside combat is 35% faster, and rift gates cross the map with a ten-second cooldown.

Every 40 seconds, the town becomes deep woods or returns. Town blocks have broad collision and line-of-sight footprints. Forest groves have smaller footprints, opening flanking passages. Vision shrinks from 950 to 620 world units. Marked brush hides creatures beyond 125 units unless they attack or take damage. A basic attack from concealment deals 75% extra damage to a creature. Attacking reveals the attacker for 2.6 seconds. Both bot targeting and player targeting enforce line of sight. Hidden enemy units are culled from the battlefield and minimap; allied vision is shared. The woods also add atmospheric distance fog.

| Creature | Movement | Skill | Ultimate at level 3 |
| --- | --- | --- | --- |
| Mothman | Flies over obstacles and cloaks | Slowing wing blast | Blackout: cloak, sight through cover, fear |
| Nessie | Healing dive, slowing wake; river speed bonus | Pulls a forward cone of enemies | Flood: persistent damage, slow and allied healing |
| Baba Yaga | Play the chicken-legged hut; hop and shield | Places a hidden rooting trap | Three damaging, stunning stomps |
| Jersey Devil | Leaps over obstacles; stunning landing | Fears nearby enemies | Eight-second attack frenzy with life steal |

## Match and controls

Escort wisp waves into wardstone range. Wardstones prioritize wisps; attacking a creature under its ward draws its fire. Break any enemy wardstone to expose their elder rift, then destroy the rift. Matches end at six minutes if neither rift falls; combined remaining ward and rift health decides the result. Damage rises after four minutes.

The central Wild Hunt spawns after 26 seconds. The team that slays it recruits a siege beast in the killer's lane. Side spirit camps award embers, healing and temporary haste. Team kills, camps and waves share experience and embers. Start with 360 embers and earn 3.2 per second in addition to combat rewards. Spend them on recipe components and completed items in the Night Market. Both teams use the same economy. Death leads to respawn at the healing rift.

- Touch: left movement pad; tap a skill for aim assist, or drag and release to aim. Basic attacks are automatic. Tap an enemy or Attack to change target.
- Tap the minimap for a large tactical map. Tap a position or a named destination to place a navigation marker.
- Near a gate, Rift Jump activates the paired gate. Return channels a trip home and cancels on movement or damage.
- Keyboard: WASD/arrows move; Q/E/R skills; F gate; M map; B return; Esc pause. Skill buttons also support keyboard and assistive activation.
- Pause, help, shop, map, focus loss and the arcade game switcher pause the simulation. Pointer cancellation, resize and dialogs clear held input.

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

Run `node qa/tidebreak/sim.test.mjs`. It verifies the ninefold map area, open lanes in both realms, collision recovery on a shift, blocked LOS, concealment and reveal, ambush damage, wall-blocked attacks, four distinct kits, portal transit/cooldown, completed-item uniqueness, respawn, return interruption, objective rewards, deterministic replay and 12 full bot matches. Those matches completed in 85–250 seconds, produced 13–26 creature kills, and peaked at 50 units.

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
