# Design
Use the existing mutable JavaScript engine and character canvas without dependencies. maps.js supplies fresh validated 30x21 maps with safe spawn/HQ reservations and 35 distinct layouts. Engine keeps game.wave as stage index and exposes players, level/lives, enemy carriers and timed pickup effects. Local co-op uses IJKL/U/O alongside existing P1 controls. Construction paints the same terrain model through guarded pointer coordinates; storage input is shape/tile validated.

Four player tiers change hull shape, barrel count and markings, not color alone. P2 uses cyan and clear identifiers. Forest overlays units; ice slides, steel responds to siege-tier rounds, and pickups have distinct glyphs and HUD explanations.

Web Audio schedules an original looping score from notes, bass and percussion with a short lookahead. It unlocks on user gestures, suspends on pause/hidden/menus, and cleans up nodes/timers. Existing sound toggle covers music and effects.

Verification: assert 35 unique navigable maps and reserved cells; engine tests for every pickup/tier, lives, co-op, terrain and collisions, 35-stage completion; renderer state-purity/tier visuals; audio scheduling/cleanup self-checks; browser stage selection/editor save/load/test, controls, sound lifecycle and desktop/phone layout. Long human balance runs and physical phone audio are reported separately.
