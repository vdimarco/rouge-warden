# Design

Use a shared deterministic distance/seed section sampler so narrows, rough-water jump sections and low-canopy passages agree with river geometry and hazard rows. Include calm transitions and recovery beats. Retain established speeds and analytic time-to-impact so terrain cannot introduce unannounced timing changes or invisible collisions.

Consume each newly emitted contact effect once for sound; the last event in a frame is insufficient when multiple coins and a challenge cross together. Use short bounded audio voices with a distinct bright pickup cue and a layered impact transient. Preserve persisted mute, user-gesture start, hidden/pause ownership, local music and graceful audio failure.

Separate the brief fatal impact presentation from the stopped simulation. Animate recoil/splash and play the collision tail before the result modal; keep the simulation fixed at exact physical contact. Protected hits must leave controls responsive. Reduced motion retains clear static contact feedback without camera shake. No new artwork generation or per-frame resource preparation is needed.
