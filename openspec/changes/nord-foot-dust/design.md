# Foot dust on the shell

## Decision

The puff rule stays in `QuebecScuff.h`. The character reports each slot's age. The stream sends the five ages. The play shell draws a puff only while its age is inside the life.

## Rendering

William T. Reeves, "Particle Systems — A Technique for Modeling a Class of Fuzzy Objects" (SIGGRAPH 1983), already cited in `QuebecScuff.h`. Each puff is born, ages, and dies. The shell uses that same `At` rule. No new shading, texture, or world material.
