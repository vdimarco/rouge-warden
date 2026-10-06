# Design

The raft travels toward negative scene Z; the chase camera remains behind it at positive Z. Rider art must show his back and paddle blades reaching toward the bow before pulling aft. World objects continue approaching the camera, which is correct for a camera travelling with the raft. Distinct duck and jump sprites replace body scaling as the main pose cue. Normalize art to shared foot/raft anchors, keep the raft independent of the rider sprite, and retain the approved long hair, tan skin, body and modest loincloth.

Upgrade materials and shoreline texture, remove terrain seams and vary vegetation size/orientation with one lightweight sky-background draw and no added postprocessing passes or changing the fixed scene/instance budgets. Retain direct rendering, reduced-motion behavior, pause freeze, missing-model fallback and asset retries. Preserve existing engine constants exactly.

Verify pose/direction screenshots at phone, desktop and landscape, actual rapid action cancellation and obstacle clearance, and no speed changes. Verify fixed instance counts and inspect the full-detail draw count; physical-phone performance is not established by headless checks.
