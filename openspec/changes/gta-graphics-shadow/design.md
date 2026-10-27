# Design: a wider solar disk and a contact term

## Source

Randima Fernando, Percentage-Closer Soft Shadows, SIGGRAPH 2005. The penumbra grows with the gap between the blocker and the ground. Unreal's directional light takes that gap from the source angle. Martin Mittring, Finding Next Gen, SIGGRAPH 2007, for the occlusion: a pixel darkens when a neighbour is closer and the step is a crease, not a ground slope.

## Choice

`QuebecContact.h` puts `QuebecShade::SunDiskDegrees` at 3, beside the lamp-crossing rules rather than inside them. The contact length is 45 cm in world space. Ambient occlusion intensity is 0.65. `WriteScene` sets the sun's source angle and contact length. The moon is created with the same disk. `ApplySkyGrading` sets the view's occlusion. The offline shade uses the same disk: a building footprint and a capsule throw a soft ground shadow, and a crease darkens the contact. A full shadow keeps 57 percent of the lit ground, which is the ambient share of the afternoon term. The opening look stays at pitch −16 and the socket at (0, 70, 110).
