# River Rush

The user approved the character likeness and two 1536×1024 menu/gameplay concepts before implementation. Preserve long hair, facial likeness, loincloth, key and treasure race. The production artwork derived from those references is committed in `public/art/menu.png`, `river.png` and `sprites.png` within this game source.

Direction: cinematic jungle adventure; full bleed photography, forest green #031c17, ivory #fff0c9, gold #f9c65b. Quiet dark foliage behind menu content, no added wash over the image. Serif title (Bodoni Moda/Georgia), clean sans controls (DM Sans/system). Title 13vw capped at 200px; main gutter 5vw. Fine gold rules, thin outline keycaps, solid gold primary button. Minimal overlays during gameplay. All text and controls code-native.

Menu allowed copy: RIVER RUSH; River Rush.; The river doesn’t wait.; Grab the key. Claim the treasure. Escape the falls.; Start adventure; A two-minute race. One legendary escape.; A / D Steer; SPACE Reach; E Unlock; Best run; THE GOLDEN KEY RUN. Functional addition: How to play in a dialog.

Art: standalone cleaned menu photo; transparent 3×2 atlas (paddling raft, reaching raft, rival raft, key, boulder, chest); repeating river environment. Canvas draws these assets; simple code vectors are restricted to timing rings, wake particles, guidance arrows, course boundary and HUD indicators. Intentional gameplay concept deviations: front-facing character sprites to retain approved likeness; responsive touch buttons; an exit region rendered as a clearly labelled course marker rather than a further generated background.

Gameplay: steer A/D or arrows; hold Space to reach and release to catch; E held for 2 seconds to unlock with a key; safe left lane and faster hazardous right lane; rocks and rival collision drain balance; falling causes a recoverable rope climb and time loss; timed race, waterfall loss, narrow escape finish; two-minute maximum; pause, mute, replay, local best score. Recovery keys appear later after a miss.

Screens: menu, gameplay, pause, instructions, success, failure, art loading/error. Mobile reflows menu with dark footer for text legibility; gameplay preserves central navigable corridor and offers simultaneous touch controls. Pause on blur/hidden tab. Respect reduced motion in UI.
