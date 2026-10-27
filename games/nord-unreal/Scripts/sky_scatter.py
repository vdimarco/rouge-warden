"""One-sample sunset sky for the offline avenue shade.

The phase functions are the Rayleigh and Henyey-Greenstein terms Sean O'Neil
quotes in GPU Gems 2, chapter 16. The zenith optical depths are the RGB values
used with that model. The sun is below the horizon, so its colour is the
transmittance of one horizon air mass from Young, Applied Optics, 1994.

There is no ray march. The elevation band is wide enough that a sun about six
degrees down still colours the sky this camera reflects.
"""

import math

import numpy as np

TAU_R = np.array([0.058, 0.135, 0.331])


def horizon_airmass():
    zenith = 90.0
    return 1.0 / (
        math.cos(math.radians(zenith)) + 0.50572 * (96.07995 - zenith) ** -1.6364
    )


def scatter(dirs, sun):
    """dirs and sun are (east, north-or-game-y, up). Returns RGB in 0..1."""
    hat = dirs / np.maximum(np.linalg.norm(dirs, axis=-1, keepdims=True), 1e-6)
    sun = np.asarray(sun, dtype=np.float64)
    sun = sun / np.linalg.norm(sun)
    elev = hat[..., 2]
    cos_t = np.clip(np.sum(hat * sun, axis=-1), -1.0, 1.0)
    rayleigh = 0.059683103 * (1.0 + cos_t * cos_t)
    g = 0.758
    mie_phase = (
        1.5
        * (1.0 - g * g)
        / (2.0 + g * g)
        * (1.0 + cos_t * cos_t)
        / np.maximum(1.0 + g * g - 2.0 * g * cos_t, 1e-4) ** 1.5
    )
    horizon_sun = np.exp(-(TAU_R + 0.05) * horizon_airmass())
    sun_side = np.clip(cos_t, 0.0, 1.0) ** 0.6
    band = np.clip(1.0 - np.clip(elev, 0.0, None) / 0.40, 0.0, 1.0)
    warm = band * (0.15 + 0.85 * sun_side)
    redden = np.exp(-np.array([0.04, 0.9, 3.4]) * warm[..., None])
    ray_term = TAU_R * rayleigh[..., None] * 18.0 * redden
    mie = horizon_sun * mie_phase[..., None] * 2.6 * band[..., None] * (0.4 + sun_side)[..., None]
    return np.clip(ray_term + mie, 0.0, 1.0)
