# Gauntlet rubric v1

Shared scorecard for the Cottage Arcade gauntlet loops. GTA loops compare against **GTA 6**. Full Swing loops compare against **Marvel's Spider-Man 2**. The reference is a quality bar for an original game. Do not copy that game's assets, names, or trademarks into the project.

Score every dimension from 0 to 10. Each score gets one line saying why. 0 is absent. 10 is indistinguishable from the reference on that dimension in the build you actually ran.

## Aesthetics

1. Lighting
2. Color palette
3. Detail density
4. Texture and material quality
5. Composition and camera
6. Atmosphere (weather, fog, time of day)
7. Character models
8. Animation smoothness
9. Particles and VFX
10. UI polish

## Playability

1. Responsiveness and input latency
2. Controls feel
3. Mission clarity
4. Pacing
5. Fun factor
6. Difficulty curve
7. Feedback (hit, reward, juice)
8. Sound design
9. Variety
10. Performance stability (frame rate, no crashes)

## Summing

- Aesthetics index = (sum of aesthetics scores / (10 × number of aesthetics dimensions)) × 100
- Playability index = (sum of playability scores / (10 × number of playability dimensions)) × 100
- Total = aesthetics index + playability index, maximum 200
- Also record the raw sum and the dimension count for each group
- Each group is normalized to 100, so adding or removing a dimension keeps totals comparable

If this rubric changes, bump the version and re-score the current build once as a new baseline before the next improvement round.

## Scorecard template

Copy one block per round into the loop's own file (`docs/gauntlet/gta-graphics.md`, `docs/gauntlet/gta-missions.md`, or `docs/gauntlet/full-swing.md`).

```
### Round N — YYYY-MM-DD — rubric v1

- What changed:
- Why it helped:
- Screenshots: before `path`, after `path`
- Next target: lowest score in this loop's focus group

| Dimension | Score | Why |
| --- | ---: | --- |
| Lighting |  |  |
| Color palette |  |  |
| Detail density |  |  |
| Texture and material quality |  |  |
| Composition and camera |  |  |
| Atmosphere |  |  |
| Character models |  |  |
| Animation smoothness |  |  |
| Particles and VFX |  |  |
| UI polish |  |  |
| Responsiveness and input latency |  |  |
| Controls feel |  |  |
| Mission clarity |  |  |
| Pacing |  |  |
| Fun factor |  |  |
| Difficulty curve |  |  |
| Feedback |  |  |
| Sound design |  |  |
| Variety |  |  |
| Performance stability |  |  |

- Aesthetics raw: _ / 10 dimensions, index _
- Playability raw: _ / 10 dimensions, index _
- Total: _ / 200
- Delta vs last round: _
```
