# Runner sprite stack

Idle and the two run poses of the Neon Stack runner are a real stack of horizontal slices, so a camera yaw shows the hood, the pack, and the legs instead of one flat card. Crouch, hack, and spotted stay on that card. The corridor machine is unchanged.

## Source

Art's voxel strips in `tools/neon-stack/runner_slices/` (20 slices, 12 by 10). The four views in `tools/neon-stack/runner_views/` match the strip union and are not carved. `views_to_slices.py` is not used: its visual hull fattens the run legs.
