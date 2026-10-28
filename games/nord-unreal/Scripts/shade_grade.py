"""Filmic grade for the offline shade.

Krzysztof Narkowicz, ACES Filmic Tone Mapping Curve. The gain and the offset
match QuebecGrade.h.
"""
import numpy as np

TONE_CURVE = 1.0
GAIN = np.array((1.06, 1.02, 0.94))
OFFSET = np.array((0.012, 0.008, 0.004))


def aces(colour):
    """Fitted ACES curve. A hot value shoulders, and a lifted black stays warm."""
    x = np.maximum(np.asarray(colour, dtype=np.float64) * GAIN + OFFSET, 0.0)
    a, b, c, d, e = 2.51, 0.03, 2.43, 0.59, 0.14
    curved = (x * (a * x + b)) / (x * (c * x + d) + e)
    return np.clip(curved * TONE_CURVE + np.asarray(colour, dtype=np.float64) * (1.0 - TONE_CURVE), 0.0, 1.0)
