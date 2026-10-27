# Scattering sky

The avenue shade had no scattering shader. Its sunset was a warm horizon blended over the day colour, the same at every azimuth.

This replaces that grade with one sample:

- Rayleigh phase (3/16π)(1+cos²θ) and Henyey-Greenstein Mie phase (g = 0.758), as Sean O'Neil quotes them in GPU Gems 2, chapter 16, "Accurate Atmospheric Scattering".
- Zenith Rayleigh optical depths (0.058, 0.135, 0.331), the RGB depths used with that chapter.
- Horizon air mass from Young, "Air mass and refraction", Applied Optics 33 (1994). The sun is about 6° below the horizon, so the illuminant is the transmittance of that horizon path. Red remains and blue does not.

A full ray march does not fit this raster. The 0.40 elevation band, and the reddening (0.04, 0.9, 3.4), are chosen so a sun that far down still colours the sky this camera can reflect. They are not in the papers. Unreal's sky atmosphere already scatters in the engine. This picture is the offline shade, not an engine capture. The spawn clock stays Clear.
