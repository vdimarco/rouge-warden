CPU-only jump arm trial: PASS

Control and trial were authored serially in Blender5.2.2, four CPU threads, factory/background, no renders. All three reimported clips contain24bones and37 samples at30fps/1.2s (FBX import frames2–38). Retained→control semantics match exactly. Trial changes upper-arm rotations by about40°; remaining local differences are floating-point export/reimport residuals within declared tolerances, not exact byte/transform equality. Rest/object matrices match exactly. Original vertical crouch and neutral endpoints remain. All23 retained raw source files are byte-identical, and the private native A_Jump package remains at its original hash.

See results.json for commands, pins, measured errors, tolerances, next native preparation gaps and artifact hashes. Native import, rendered motion and visual improvement remain unverified. This does not adopt the trial.
