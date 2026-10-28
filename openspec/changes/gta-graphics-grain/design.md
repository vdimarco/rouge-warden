# Two scales of the same photo

Eric Heitz and Fabrice Neyret, "High-Performance By-Example Noise using a Histogram-Preserving Blending Operator" (HPG 2018), break a repeated photo by blending stochastic tiles. Their hash does not fit the Plateau material graph, which has multiply, add, sine and lerp. The colour mixes two samples of `asphalt_02`: world XY times 0.005, and the same position times 0.013 plus 0.37. The mix is a sine of world X at 0.0011 and world Y at 0.0009. A second, faster sine pair (0.0023 and 0.0017) moves the colour between 0.78 and 1. The sine node keeps period 1, so the output is sin(2π · input). Normals and roughness stay on the 0.005 grid. The tint stays (0.82, 0.87, 0.89).

Unreal is not installed. The offline picture is the walking camera (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90) looking along a flat road at the capsule bottom. The before frame is the 2 m repeat. The after frame is the two-scale mix. It is not an engine capture.
