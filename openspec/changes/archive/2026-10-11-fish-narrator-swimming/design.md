# Design

## Voice

Keep the offline Web Speech API and the two existing event hooks. Select a suitable British English voice from the voices installed on the device, including voices that load after the page starts. Use a measured speaking rate and warm but clear pitch; keep the hook-set command short enough to be useful during the strike window. A missing British voice falls back to another English voice or the device default. Preserve the Voice hints and Sound switches, speech priority, and screen-reader live region. Describe the style as a wildlife narrator without promising any particular performer's likeness.

## Swimming

Use the simulation's existing fish position, heading, speed, move, and reel state; do not change its fight physics. Increase the visible tail beat while the fish swims or resists the reel, make bursts and thrashes stronger, and settle the beat when the fish rests. Add restrained body motion or water movement where it helps show forward swimming. Keep the body near the simulation's position so the line and catch framing remain coherent. Reuse the existing fish mesh and shader budget; Calm and reduced-motion play keep a readable swimming motion without ornamental shake.

Inspect rendered frames at phone and wide layouts for the fish's body, line, water, and HUD. Compare still and moving states over multiple frames rather than judging one screenshot.
