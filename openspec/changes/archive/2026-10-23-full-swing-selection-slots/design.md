# Design
Keep a separate high-water pool of slot records; the existing sorted slots array remains the active list. Rewrite c/i/d on reuse so a former job car cannot be mistaken for a street index or vice versa. Pool grows only when candidate count exceeds its prior maximum. Stable sort insertion order is unchanged. No new rendering technique or FPS claim.

Browser regression exposed stale street pick entries when a later update omits the camera: streetModels received null traffic data. Always call streetNear after models load so its existing pick reset also applies to that path.
