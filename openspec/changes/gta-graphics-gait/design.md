# The player blends the walk into the run

A saved blend space does not fit. The hoodie has no blend space asset, and the editor path that authors one does not run here.

The graph already plays a blend space for a crew body that has one. The hoodie path adds two sequence evaluators and a two-way blend. The blend weight is the speed share from a walk at 450 cm/s to a sprint at 800. Both clips stay on the same point in the cycle. The rate reference moves from 180 cm to 600 cm with that share, which is the rate the single clip already used at each end. A body with no run clip still cuts at 520. The opening pitch and the socket stay.
