## Why
The user likes the runner rebuild but requests more animation. The river remains a still photograph and the character has only three static action poses.

## What Changes
- Add fal.ai-generated river loops for portrait and landscape, with GPU water and moving-foam fallbacks.
- Add an eight-frame paddling cycle and quick ride/jump/duck pose transitions, lane banking, landing recoil/splash.
- Animate coin spins and pickup flights, magnet pulls, shield shatter, Rush trails and obstacle bursts, plus small HUD reward animations.
- Preserve mechanics, collision timing, likeness, long hair, modest loincloth, controls, score storage and shared arcade integration.

## Impact
River Rush presentation, graphics lifecycle, visual event metadata, motion tests, documentation and committed static output at the existing public route.

User steering: use fal.ai. Matched-frame river loops now come from fal.ai MiniMax H3 Max; GPU water is the optional-media fallback rather than the primary water source.
