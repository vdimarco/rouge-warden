# Tail column, not bonnet smoke

The damage puffs are engine spheres. None of the rain papers (Tariq 2007, the streak shader) fit a tailpipe, so this reuses that sphere and moves the birth point. Six puffs, a new one every 0.16 s, life 1.1 s. Each one is born 240 cm behind the actor origin, 18 cm up, and a few centimetres to either side. It drifts back along the car at 160 cm/s and rises at 180 cm/s, swelling from scale 0.16 to 0.55 and then shrinking. Scale 1 on the engine sphere is a 50 cm radius. A wreck skips this and keeps the bonnet smoke. A pedalo skips it too. A car slower than 80 cm/s with no throttle stays clear.

Unreal is not installed. The offline picture is the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) behind a stand-in car on the brick street. The before frame is the car. The after frame adds the column. It is not an engine capture. `QuebecDrive.cpp` was not compiled.
