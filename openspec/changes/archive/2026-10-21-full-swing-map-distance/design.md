# Design
Reuse each existing pin's travel coordinates and the player position already used by the map. Display whole metres below the name, using the existing UI font. Compute when rebuilding the destination list; opening the map pauses play, and reopening after travel rebuilds it. Label the measure as map distance, not route length. No new rendering technique, dependency, setting or sorting.

Verify distances against known destinations at two positions, including zero at the start roof, and ensure reopening refreshes labels. Check desktop and portrait overflow and that clicking still travels to the same destination. Preserve before/after screenshots.
