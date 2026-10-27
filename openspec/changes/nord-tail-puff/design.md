# Tail puffs on the shell

## Decision

The puff rule stays in `QuebecExhaust.h`. The car reports each slot's age. The stream sends the six ages. The play shell draws a puff only while its age is inside the life. The car's own motion stays an offset each frame. The shell uses the same life, speeds, and swell.

## Rendering

William T. Reeves, "Particle Systems — A Technique for Modeling a Class of Fuzzy Objects" (SIGGRAPH 1983), already used for the foot dust. Each puff is born, ages, and dies. The shell uses that same `At` rule. No new shading, texture, or world material.
