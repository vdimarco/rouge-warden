# Reusable car-selection records

A high-water pool reuses car/street candidate records across visual updates. Each record resets car, street index and distance before sorting; insertion order, stable ties, nearest selection and driving priority remain unchanged. This avoids fresh candidate objects after warmup, with no FPS claim or gate.

Node checks exercise 100 mixed-type/shrink/grow/tie selections against a fresh-object reference. Browser checks compare actual loaded-model/fallback matrices and traffic promotion sets through 40 mixed updates, reuse ten warmed records, release promotions without a camera, and match nonblank reference pixels exactly.

The no-camera transition exposed stale street picks passed to streetModels with null traffic data. Calling the existing streetNear reset even without a camera fixes this; original failure log retained. The reference for pooling includes the same independent reset fix.

All20 rubric dimensions retain historical context only; no new points awarded. Composition, lighting, color, detail, texture, characters, environment, vehicles, animation, UI, controls, mission clarity, pacing, fun, difficulty, feedback, sound and variety receive no current acceptance scores. Affected Chrome responsiveness/input latency and stability remain unverified; total/delta withheld. No physical-device/listening/full-playthrough claim. OpenSpec CLI unavailable; scenarios/structure checked manually. Review, CI, current deployed preview, rebase and production verification pending.

Final allocation baseline1fail/4pass→candidate5pass:236fresh records versus10reused identities across40callbacks. Node100selection checks pass; action9/marker11 integration checks pass. Snapshot comparison sorts mesh records by name because GLB loading order is asynchronous; production order is unchanged.
