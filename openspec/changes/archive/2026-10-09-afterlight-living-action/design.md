# Direction
The picture is the playfield: a full-viewport cinematic ASCII action game. Large emerald/cyan/gold/violet light sheets cover substantial portions of the scene. Layered source scenery, drifting fog, rain, aurora, water, dunes and orbit keep the whole frame alive. A recognizable courier blasts shadow creatures, rescues three visible survivors per region, leads them to a central beacon and protects the beacon during a short attack and defeats a larger guardian with alternating warned fan attacks and charges. Restoration rolls outward and permanently changes color and vegetation. Six regions have distinct hazards and scenery, sharing one clear loop. Controls and purpose remain explicit.

# Architecture
A new deterministic action model and Phaser action renderer live beside the old journey. The default index loads the new action game; classic.html retains the prior journey and old storage key. Action progress uses a separately validated save. Pause/hide/switch stop simulation. Rendering scales to actual viewport and retains a bounded ASCII source texture; decorative motion can be reduced without suppressing gameplay cues. Full-screen CSS/HTML overlay owns accessible HUD, touch controls and menus.

# Validation
Pure tests cover weapon collisions, dodge invulnerability/cooldown, survivor following/delivery, beacon waves, all six-region completion, retry, pause and malformed saves. Chromium desktop, portrait and landscape checks cover real input, intro/pause/menu/restart, responsive fit and source assets. Capture screenshots and frame comparisons demonstrating broad colored/moving areas and changes through play; inspect images before deployment. Existing journey remains reachable and its checks remain applicable to Classic.

# Visual reference and tokens
Full-screen concept: `/workspace/generated_images/exec-37f0b77d-2b0f-4a09-8774-0160406f1281.png`. Production retains the original source scenes and generates sprites/light in code so animation and scenery stay interactive. This is an intentional procedural-ASCII adaptation of the concept, not a flattened image background.
- Background #030b14; emerald #17e898; cyan #39eaff; gold #ffd15c; violet #a24fff; survivor peach #ffb78a.
- Foreground courier/enemies remain brighter and larger than background dots. Broad fog/light fields cross at least several screen quadrants.
- HUD: monospace 12–16px, dark translucent backing only where needed; top brand/place, central objective, right health/pause. Bottom concise movement/action hints and touch controls. No permanent sidebar.
- Current controls/copy: Afterlight; Bring them home.; Start rescue; Blast the shadows. Lead three survivors to the beacon. Defend it until the rescue route opens.; Fire; Dodge; Pause; Motion; Sound; Classic.
- Mobile: compact top HUD, bottom-left directions and bottom-right actions; minimum44px targets; scene fills viewport.
