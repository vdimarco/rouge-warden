# Foot contact dust

William T. Reeves, *Particle Systems — A Technique for Modeling a Class of Fuzzy Objects* (SIGGRAPH 1983), is the birth, age, and death model. The leaf cards already use it for a crown, so that drift does not fit a shoe. The exhaust column rises off a tail. A contact puff is born at the rear shoe and is left in the world as the walker moves on.

`QuebecScuff.h` has no Unreal types. Five puffs, each living 0.7 s, a new one every 0.16 s, so a slot is free before it is reused. Below 80 cm/s nothing is born. The puff drifts back at 84 cm per second of age and rises, and its radius grows from 12 cm then fades over the last quarter of its life. The engine sphere is 100 cm across, so the scale is the radius divided by 50. The material is the existing white.

The birth point is 40 cm behind the visible body, 13 cm to one side, 4 cm up, plus the puff's own side and lift. The mesh is used when it is showing; otherwise the casual stand. A vehicle, a swim, a knockdown, and a fall do not birth a new puff. A dedicated server does not. A body that was not drawn recently does not.

The offline picture is the opening walk, the casual stride at 0.75 s, with and without four puffs whose ages are 0.04, 0.20, 0.36, and 0.52 s. The walker is moving at 180 cm/s, so older puffs were born further back. It is not an engine capture. `QuebecGameplay.cpp` was not compiled.

Unreal is not installed. Confirming the spheres in a viewport is unchecked.
