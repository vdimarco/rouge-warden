# Unchanged mission marker buffers

Marker positions and colors are compared by value. Static offers no longer rewrite/upload geometry each callback; shader time still animates. Changed positions/colors/counts and mutable goal objects refresh buffers. No gameplay, anchor, height or art change.

Focused browser checks cover sixty rendered callbacks with unchanged buffer versions and zero actual bufferSubData bytes, advancing shader time, moved offers, changed colors, growing/hidden/shown batches and a goal mutated in place. Reference rendering forces marker refresh; nonblank output matches exactly. No FPS benefit claim or gate.

Integration initially expected stale updateRanges left after first buffer allocation to imply a fresh transfer. Actual versions/bytes showed no marker transfer; corrected the assertion to require populated car bytes on unchanged repeat updates. Failed fixture log retained.

All20 rubric dimensions retain historical context only; no new points are awarded. Composition, lighting, color, detail, texture, characters, environment, vehicles, animation, UI, controls, mission clarity, pacing, fun, difficulty, feedback, sound and variety receive no fresh acceptance score. Responsiveness/input latency and stability on affected Chrome remain unverified; current total and delta withheld. No physical-device/listening/full-playthrough claim. OpenSpec CLI unavailable; structure/scenarios checked manually. Review/CI/current preview/rebase/production remain required.

Baseline forced-refresh policy:2fail/9pass; corrected11pass. Existing action upload integration:9pass and zero differing RGBA components. Three cars plus unchanged markers transfer228bytes per repeat update versus684 previously. No FPS claim.
