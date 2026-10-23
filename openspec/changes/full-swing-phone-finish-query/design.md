# Design
Inspect hudFrame/combat.inReach and all HUD priority consumers. Reorder existing conjunction only: focus>=1 && !phone && inReach. Phone can still query reach for later PUNCH fallback; do not skip that query. Existing HUD 4096-combination fixture patterns support equivalence and call-count proof. No new cache/helper.
