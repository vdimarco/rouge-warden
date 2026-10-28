# Street steam

## Source

William T. Reeves, "Particle Systems — a Technique for Modeling a Class of Fuzzy Objects" (SIGGRAPH 1983). Each puff has a birth, a life, and a death, and it drifts upward. The shading is not Reeves's fuzzy cloud. The puff is the lumpy cel cloud this game already draws for a sludge puff: a hard fill, a hard shade, an ink edge.

## Decisions

- One instanced mesh of camera-facing cards, added to the city, so a named camera and flat play both draw it. It is not a full-screen pass. A headset draws it with the city.
- Two puffs per grate, half a loop apart, so one is up at any time. The loop is about 2.6 seconds. They rise about 3.6 m and grow as they age.
- Grates sit on both sidewalks, inset past the curb furniture, every 36 m, and skip parks, crossings, the Needle, and the Dome.
- Cards shrink away inside 8 m and past 70 m, and the print fog takes the rest, so they do not sit on the lens or on the horizon.
- The colour is warm cream with a cool lower shade, so it reads on the dark road and in the violet haze.
