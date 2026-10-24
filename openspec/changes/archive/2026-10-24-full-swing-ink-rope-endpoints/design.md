# Design
rope.update reports easy rope endpoints outside the mesh branch. inkLine suppresses that mesh branch too, but was missing from endpoint bookkeeping guard. Extend the existing guard to easy OR inkLine. All endpoint info readers and sole update caller inspected. This preserves the concurrent building-rope design and restores current hand/anchor diagnostics. No rendering technique added.
