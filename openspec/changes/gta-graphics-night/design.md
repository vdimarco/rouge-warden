# Sixteen taps, not a bloom pyramid

Masaki Kawase, "Frame Buffer Postprocessing Effects in DOUBLE-S.T.E.A.L (Wreckless)" (GDC 2003), gathers bloom by sampling a few wide taps instead of a separable kernel. The separable pyramid does not fit the comic post-process node. What was adapted is that gather: sixteen point taps of the post-process input, averaged, added only where a tap is still warm-and-bright or white-and-bright.

The moon disc uses `FLighting::MoonColor` `(0.62, 0.72, 1)`. Its direction is a fixed slot in the walking frame, `normalize(0.90, 0.22, 0.25)`, because this node does not receive the clock's moon azimuth. `MoonLux`, `NightOffset` of −9, and `WindowGlow = 1 + 11 * NightFactor` stay in `QuebecSkyModel.h`. `QuebecSkyTests` still locks midnight exposure at −9 and window glow above 11.

The comic node runs after tonemapping. A grade that crushed every pixel would darken a frame the sky model had already exposed. The final mix is `lerp(Color, NightCol, saturate(NightFactor))`. At NightFactor 0, including the clear 15:00 contract and the collection default, the colour is unchanged. At night, a pixel whose peak is under about 0.20 is not re-crushed and is not classified as neon. The centre class reads the scene colour at this pixel, so a lamp becomes neon rather than only a halo around it. Sky pixels take the moon. Everything else takes the spill.

`NightFactor` is read from `MPC_NordAtmosphere`, which the sky already writes. A scalar parameter on the comic material would stay at day. If that collection is missing when the material is authored, the input is a constant 0.

Unreal is not installed here. The offline picture is a walking-camera night plate (arm 420, socket Y 70, socket Z 110, pitch −12, horizontal FOV 90). The before frame is that plate: dark sky, warm windows, lamps at 440 cm, a box coupe with headlights. The after frame is the same plate plus this grade. The coupe is a box stand-in, not the seventies mesh. It is not an engine capture.
