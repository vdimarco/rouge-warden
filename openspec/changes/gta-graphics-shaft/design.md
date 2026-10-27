# Design: haze and shafts at a low sun

## Source

Kenny Mitchell, Volumetric Light Scattering as a Post-Process, GPU Gems 3, chapter 13. The shafts are a radial sample of the sky toward the sun, so a tree or a wall leaves a dark gap and the sky between them stays bright. Unreal's exponential height fog, with volumetric fog enabled, is the distance haze. The extinction scale is the density of that volume.

## Choice

`QuebecHaze.h` holds the elevation gate at 8 degrees, the bloom scale 0.4, the occlusion darkness 0.5, the volumetric scattering 2, the extinction 2, and the offline density 0.00015 per centimetre. `WriteScene` turns the sun's shaft bloom and the fog's volumetric flag on only while the sun is below that elevation, so the opening afternoon is unchanged. The offline shade uses the same density: near pixels stay, far pixels take a dusk colour, and the radial samples draw the shafts. The curb eye stays. The frame yaws toward the sun, because the street look faces away from it. The opening look stays at pitch −16 and the socket at (0, 70, 110). The opening weather stays clear.
