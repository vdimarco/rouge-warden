# Design: a water film and a clearcoat

## Source

Bruce Walter, Stephen Marschner, Hongsong Li, and Kenneth Torrance, Microfacet Models for Refraction through Rough Surfaces, EGSR 2007. The distribution is GGX. Christophe Schlick, An Inexpensive BRDF Model for Physically-based Rendering, 1994, for the Fresnel. Brian Karis, Real Shading in Unreal Engine 4, SIGGRAPH 2013, for the split-sum weight that turns that Fresnel into a sky reflection. Unreal's light specular scale is the engine's multiplier on the same lobe.

## Choice

`QuebecGloss.h` holds the roughness and the Fresnel. Wet asphalt is 0.15 with F0 0.04. Car clearcoat is 0.22 with F0 0.04. The specular scale is 1, a full lobe. `WriteScene` sets that scale on the sun. The moon is created with it. `ApplyPaint` sets the paint slot's roughness through a dynamic instance, on the seventies mesh and on the fallback body. `plateau_atmosphere.wet_ground` lerps roughness to 0.15 with wetness, and puddles stay at 0.03. The opening weather stays clear, so the street is dry until the sky wets it. The offline shade uses the same roughness: a lit road lerps toward the reflected sky, and paint adds the clearcoat on top of its colour. A shadow on the road keeps the dark asphalt. The opening look stays at pitch −16 and the socket at (0, 70, 110).
