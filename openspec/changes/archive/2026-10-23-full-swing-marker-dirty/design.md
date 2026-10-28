# Design
Keep six raw position/color values per marker in a fixed Float64Array. Compare every value, not object identity. Rewrite changed entries; upload populated marker buffers when any value or count changes. Count changes ensure pending smaller uploads cannot omit newly visible slots. Shader time still updates every frame. No new rendering technique or FPS claim.
