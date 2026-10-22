# Bound Full Swing's flat rendering workload

The user's 7680×2160, 120 Hz display at scale2 can request16.6 million rendered pixels. Hardware Chrome measurements miss frame-time targets at that workload. Test a4K total-pixel budget for the3D canvas before shipping it; retain native DOM text and controls. This is a performance round, not new graphics content.

Scope: renderer creation and resize in main.js, focused browser checks and workflow, performance evidence, round log and canonical spec. No saved settings, new controls, assets or dependencies. XR keeps its session-owned framebuffer sizing. The tradeoff is lower3D sampling density above the budget.
