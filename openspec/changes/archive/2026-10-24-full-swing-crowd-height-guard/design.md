# Design
The street update computes Math.hypot before a height rejection for each active pedestrian. Reorder the two pure conditions so pedestrians at least 12 metres below focus skip distance work. No squared-distance replacement or changed boundaries. Inspect all callers and actual seeded update equivalence before implementation. No rendering technique is introduced.
