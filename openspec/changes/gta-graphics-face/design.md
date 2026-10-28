# Mottle and a chip, not a height field

The procedural brick written up at shader.gallery ("brick", E. T. Carter) hashes each unit for its own tone, mottles the face, and chips the corners. That writeup then builds a height field and takes normals from finite differences. This facade shader returns one colour and already has the course and the per-unit tint, so the height field does not fit.

What is added is the albedo part. Inside the unit the running bond already names, three horizontal bands multiply the paper by `lerp(0.78, 1.16, hash)`. Bricks with hash at least 0.80 lose a lower corner. Stones with hash at least 0.62 gain a cooler pit in the middle of the face. The fine grain stays. Mortar is applied after the mottle, so the joint stays a clean bed. Glass, rails, doors, and troughs are drawn later and cover the face where they sit.

Unreal is not installed here. The offline picture is the same straight elevation as the trough round, with the face added. It is not an engine capture.
