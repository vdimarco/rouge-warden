# Opening sunset

A new sky shader does not fit. `QuebecSkyModel.h` already computes the sun. `SunAt` is the NOAA zenith and azimuth written as one (east, north, up) vector. Day 288 is mid-October, latitude 45.525, solar noon 12.67. At 18.70 the sun is about 6 degrees below the horizon, `SunScale` is 0.624, the day factor is 0, and `bStreetLamps` is on. The game frame is (east, −north, up), the same map the replica preview uses.

`LightingFor` on clear weather does not shift the white balance. The direct term follows `SunScale` and the low sun, so upward faces lose it. The raster has no scattering shader, so the sky grade is a warm horizon and a dark zenith weighted by the day factor. That grade is a stand-in for the sunset colour the model keeps until the sun is about 4 degrees down. Puddles pick up that sky. The lamp globes are emissive only when the model turns the lamps on.

`QuebecSky.cpp` still starts at Clear in the afternoon. This picture is a later sample of the model, not the spawn clock. It is not an engine capture. Unreal is not installed, so confirming the saved sun in a viewport is unchecked.
