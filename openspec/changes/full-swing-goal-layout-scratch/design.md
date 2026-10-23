# Design
placeGoal only reads size/pad and returns a fresh placement. main owns GOAL_SIZE and updates w/h on every projection; static phone/desktop pads preserve all four existing values. No resize listener/cache invalidation, public API change, result reuse or graphics change. All callers inspected: only main plus existing projection tests. No FPS claim.
