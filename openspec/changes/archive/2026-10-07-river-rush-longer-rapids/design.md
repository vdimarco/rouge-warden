Use 2,800 / 3,600 / 4,400 m map lengths (10,800 m adventure). Increase map
start speeds to 52 / 62 / 72 and caps to 68 / 80 / 92, keeping the current
jump/duck durations and time-based fair row spacing. The first Canopy hazards
must remain spaced for the faster start. Retain existing finite scores/unlocks.
Update API/database distance bounds together without deleting scores.

Redstone's near scenery remains textured and procedural. Remove its painted
river from the far backdrop so projected water, ground and distant canyon
silhouettes occupy coherent depth. Prepare all skyline resources before play;
near geometry moves quickly, far geometry slowly, with no horizon pop.

Ordinary coins require actual interpolated raft overlap at their crossing,
rather than immediate target-lane selection. Missed coins travel past rather
than disappearing as though collected. Magnet/Rush attraction remains an
explicit power-up exception, with visible feedback. Raised coins still require
a jump. Geometry and scoring must agree at 30/60/120 Hz and steering reversal.
Faster current motion remains downstream, shares wave coefficients between
water and buoyancy, freezes on pause, and respects reduced motion.

Verify delayed full-map bots, coin hit/miss/reversal cases, map finish/carry,
bounded entities/resources, real browser interaction and canyon motion at
phone/desktop/landscape, fallback/reduced motion, shared board bounds, then
publish and verify the exact live version. Chromium checks do not measure
physical-device frame rate. OpenSpec CLI is unavailable; check Markdown.
