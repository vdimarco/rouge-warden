# Shore victory dance

## Why
A Shore match ends with a result sheet that opens at once and blurs the field. The winning heroes stand still behind it. The user asked for something fun made with Viggle PINOC in Shore of the Ancients.

## What changes
- The living heroes of the winning team turn to the camera and dance when the match ends.
- The result sheet waits 3.5 seconds after a won match, so the dance is seen. The victory or defeat music starts with the dance.
- A draw, and a player who asks for reduced motion, get the result at once with no dance.
- The clip library gains four dance clips, made with PINOC text to motion. Each hero keeps one of the four.
- `higgsfield/models3d/pinoc-clip.mjs` converts a PINOC motion to a Shore clip entry.

## Scope
Presentation only. The simulation, the result text, the controls and the layouts do not change. No new input is added.
