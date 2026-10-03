# Design

Remove ownership restrictions in the shared entry path. Driver-door entry displaces an occupant and stops its controller; passenger entry still rides along. Promote traffic to a full vehicle only on entry, retaining identity, pose, tint and damage and removing it from ambient cleanup. Expose parked lot cars individually with removable colliders; instantiate a drivable vehicle only when taken. Restore lot props on session reset. Reuse existing police theft consequences; a stolen patrol without an officer must not spot itself.

Parked cars remain low-detail meshes until entry, adding ten near-lot draw calls rather than eleven full vehicle rigs. The existing 300 m lot culling remains. Portrait play is already blocked by the rotate-phone overlay; preserve it and verify theft after rotation to landscape.
