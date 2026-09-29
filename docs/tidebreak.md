# Monster Mash

A mobile folklore MOBA in the Warden arcade. The existing `/tidebreak/` route and draft PR are retained so prior links work. One player joins two bots against three bots. No runtime generation service, new dependency, or account is required to play.

## What changed

The original 1600 × 1600 reef was too cramped and its three characters played too similarly. The new 4800 × 4800 arena has nine times the area, three lanes, side spirit camps, a winding traversable river, and four paired rift gates. First waves and creatures start near the front, so the enlarged world does not add a long opening walk. Movement outside combat is 35% faster, and rift gates cross the map with a ten-second cooldown.

Every 40 seconds, the town becomes deep woods or returns. Town blocks have broad collision and line-of-sight footprints. Forest groves have smaller footprints, opening flanking passages. Vision shrinks from 950 to 620 world units. Marked brush hides creatures beyond 125 units unless they attack or take damage. A basic attack from concealment deals 75% extra damage to a creature. Attacking reveals the attacker for 2.6 seconds. Both bot targeting and player targeting enforce line of sight. Hidden enemy units are culled from the battlefield and minimap; allied vision is shared. The fog overlay shows the player's local field of vision.

| Creature | Movement | Skill | Ultimate at level 3 |
| --- | --- | --- | --- |
| Mothman | Flies over obstacles and cloaks | Slowing wing blast | Blackout: cloak, sight through cover, fear |
| Nessie | Healing dive, slowing wake; river speed bonus | Pulls a forward cone of enemies | Flood: persistent damage, slow and allied healing |
| Baba Yaga | Play the chicken-legged hut; hop and shield | Places a hidden rooting trap | Three damaging, stunning stomps |
| Jersey Devil | Leaps over obstacles; stunning landing | Fears nearby enemies | Eight-second attack frenzy with life steal |

## Match and controls

Escort wisp waves into wardstone range. Wardstones prioritize wisps; attacking a creature under its ward draws its fire. Break any enemy wardstone to expose their elder rift, then destroy the rift. Matches end at six minutes if neither rift falls; combined remaining ward and rift health decides the result. Damage rises after four minutes.

The central Wild Hunt spawns after 26 seconds. The team that slays it recruits a siege beast in the killer's lane. Side spirit camps award embers, healing and temporary haste. Team kills, camps and waves share experience and embers. Purchase damage, health or cooldown upgrades, each capped at three stacks. Death leads to respawn at the healing rift.

- Touch: left movement pad; tap a skill for aim assist, or drag and release to aim. Basic attacks are automatic. Tap an enemy or Attack to change target.
- Tap the minimap for a large tactical map. Tap a position or a named destination to place a navigation marker.
- Near a gate, Rift Jump activates the paired gate. Return channels a trip home and cancels on movement or damage.
- Keyboard: WASD/arrows move; Q/E/R skills; F gate; M map; B return; Esc pause. Skill buttons also support keyboard and assistive activation.
- Pause, help, upgrades, map, focus loss and the arcade game switcher pause the simulation. Pointer cancellation, resize and dialogs clear held input.

## Implementation and art

`world.js` owns the same geometry used for movement, collision recovery at realm shifts, LOS, minimaps and scenery. `sim.js` has deterministic browser-independent battle rules. `render.js` composites generated ground textures, scenery and sprites with native canvas tactical effects. `main.js` owns touch, keyboard, dialogs and the fixed-step loop. No artificial network or multiplayer status is displayed.

Higgsfield generated the design concept. After the fal account was topped up, Nano Banana Pro through fal generated the four creatures, scenery and terrain. Asset provenance and full prompts are in `art/sources.json`. The original generation placed both wisps in one cell; the build separates those crops and repacks the atlas. Chroma-key cleanup preserves transparent sprites. The shipped game loads about 620 KB for its two main atlases plus approximately 140 KB for portraits.

404-GEN is not integrated: no callable connector or credential was available, and the fal catalog returned no 404 endpoint. The playable assets are 2D sprites, not rigged 3D models. Online multiplayer, authoritative servers, proper animation rigs and real-device performance tuning remain future work.

## Verification

Run `node qa/tidebreak/sim.test.mjs`. It verifies the ninefold map area, open lanes in both realms, collision recovery on a shift, blocked LOS, concealment and reveal, ambush damage, wall-blocked attacks, four distinct kits, portal transit/cooldown, purchase caps, respawn, return interruption, objective rewards, deterministic replay and 12 full bot matches. Those matches completed in 228–360 seconds, produced 26–52 creature kills, and peaked at 49 units.

Browser flow: choose a creature → start → move with one thumb while aiming a skill with the other → release → pause/resume → upgrade panel → map destination → realm shift → full result → replay. Local Chromium loads checked-in files through request routing because Cloud Browser rejected loopback navigation with `ERR_BLOCKED_BY_CLIENT`. The rendered checks cover 390 × 844, 320 × 568, 844 × 390 and 1440 × 900. The public preview is checked separately in Cloud Browser after publishing.

## Concept comparison

| Reference | Implementation |
| --- | --- |
| Ivory two-line serif title and lime start button | Native text and buttons, with the same hierarchy and palette |
| Eerie Mothman against shifting town/forest | Generated sprite with native world scenery behind the menu |
| Four creature selection cards | Four interactive cards with generated portraits; selection changes name, role and kit |
| Full-bleed painted scene | The playable map is assembled from textures and scenery matched to physical obstacles |
| Tall cinematic creature | Compact sprites stay legible in combat; Baba Yaga is represented by the walking hut |

The concept is visual direction, not a screenshot used as the application. All labels, controls, match state and map interactions are native. Local visual review caught and fixed a fourth-card overflow on phones. Geometry checks caught and fixed scenery intersecting the outer lanes.
