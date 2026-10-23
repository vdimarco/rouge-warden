# Design
Replace crew.filter(q=>combat.alive(q)).length with reduce accumulating one for each truthy predicate. Leave crew selection, find calls and all state transitions unchanged. No extra API, cache, helper, graphics change or FPS claim.
