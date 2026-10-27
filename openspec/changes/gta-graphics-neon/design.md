# Design: night opening, neon, wet road, glare

## Source

The hour is the existing Montréal sky model at 22:00 (sun about 39 degrees down, lamps and headlights on). The wet road keeps the GGX water film from the gloss pass. Reflections of the signs and lamps are a few samples of a screen-space march (McGuire and Mara, "Efficient GPU Screen-Space Ray Tracing", JCGT 2014), not their full tracer. Headlamp glare is a box blur of the bright pixels, the cheap form of Masaki Kawase's bloom (GDC 2003, DOUBLE-S.T.E.A.L). The neon blades are original emissive colours. No outside sign art fitted.

## Choice

`QuebecNight.h` sets the opening hour to 22 and lists three blade positions on the near sidewalk of Rue Sherbrooke. The sky spawns a coloured point light at each one and turns them on with the street lamps. The browser launcher pins that hour and still leaves weather unpinned. The opening aim stays at pitch −16 and the socket at (0, 70, 110).

The offline hero uses that same camera. It is wet, so the road keeps the water film and picks up the signs and lamps. Four posed walkers stand on the sidewalk. Two extra cars bring headlights into the lane. The default weather in the game stays clear, so a normal start is a clear night; the shaded frame is the rainy night.
