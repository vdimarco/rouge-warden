"""Height fog and radial light shafts for the dusk shade.

Kenny Mitchell, Volumetric Light Scattering as a Post-Process, GPU Gems 3,
chapter 13. The density matches QuebecHaze.h.
"""
import numpy as np

HAZE_DENSITY = 0.00015
SHAFT_ELEVATION = 8.0
SHAFT_BLOOM = 0.4
SHAFT_SAMPLES = 16


def fog_amount(depth):
    """How much haze covers a surface. Sky (non-finite depth) stays open."""
    far = np.isfinite(depth)
    dist = np.where(far, np.maximum(depth, 0.0), 0.0)
    return (1.0 - np.exp(-HAZE_DENSITY * dist)) * far


def sun_pixel(forward, right, up, sun, width, height, tan_h, tan_v):
    """Screen pixel of the sun, or None when it is behind the camera."""
    forward = np.asarray(forward, dtype=np.float64)
    right = np.asarray(right, dtype=np.float64)
    up = np.asarray(up, dtype=np.float64)
    sun = np.asarray(sun, dtype=np.float64)
    ahead = float(np.dot(sun, forward))
    if ahead <= 0.05:
        return None
    x = float(np.dot(sun, right) / (ahead * tan_h))
    y = float(np.dot(sun, up) / (ahead * tan_v))
    return (x * 0.5 + 0.5) * width, (1.0 - (y * 0.5 + 0.5)) * height


def _sample(image, x, y):
    height, width = image.shape[:2]
    x = np.clip(x, 0.0, width - 1.001)
    y = np.clip(y, 0.0, height - 1.001)
    x0 = np.floor(x).astype(np.int32)
    y0 = np.floor(y).astype(np.int32)
    fx = (x - x0)[..., None]
    fy = (y - y0)[..., None]
    return (
        image[y0, x0] * (1.0 - fx) * (1.0 - fy)
        + image[y0, x0 + 1] * fx * (1.0 - fy)
        + image[y0 + 1, x0] * (1.0 - fx) * fy
        + image[y0 + 1, x0 + 1] * fx * fy
    )


def light_shafts(colour, sky, sun_xy, samples=SHAFT_SAMPLES):
    """Radial blur of the sky toward the sun. Occluders stay dark, so the gaps read as shafts."""
    if sun_xy is None:
        return colour
    height, width = colour.shape[:2]
    ys, xs = np.mgrid[0:height, 0:width]
    acc = np.zeros_like(colour)
    decay = 1.0
    for step in range(1, samples + 1):
        t = step / samples
        decay *= 0.96
        sx = xs * (1.0 - t) + sun_xy[0] * t
        sy = ys * (1.0 - t) + sun_xy[1] * t
        acc += _sample(colour, sx, sy) * _sample(sky, sx, sy) * decay
    return colour + acc * (SHAFT_BLOOM / samples)
