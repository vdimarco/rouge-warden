# Reusable traffic paint arrays

Reused traffic sample outputs now own one paint array, updated in place for colored or fallback samples. Fresh outputs remain independent and fallback palette constants are never assigned as mutable sample storage. Car stealing already copies sampled paint. Position/headings/time arithmetic is unchanged.

Focused Node checks compare 100 samples against independent modulo/direction arithmetic, test one-array identity, fresh-output independence and fallback palette isolation. Existing action suite and loaded-model/street-promotion image integration pass. No FPS claim or benchmark gate.

All20 rubric dimensions retain historical context only; no new points. Composition, lighting, color, detail, texture, characters, environment, vehicles, animation, UI, controls, mission clarity, pacing, fun, difficulty, feedback, sound and variety receive no fresh acceptance score. Affected Chrome responsiveness/input latency and stability remain unverified; current total/delta withheld. No physical-device/listening/full-playthrough claims. OpenSpec CLI unavailable; scenarios checked manually. Review/CI/current preview/rebase/production remain required.

Remote city/input CI reached its 30-minute job cap while the cutscene test was progressing (opening and briefing/finale passed). The job budget is now45minutes; existing per-test watchdogs and all assertions remain. This is a CI scheduling correction, not a product performance claim.
