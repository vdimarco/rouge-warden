"""The sunset shade uses a scattering gradient, and the opening camera stays.

The opening hour is night. The gradient is the offline
stand-in for the sky the puddles reflect.
"""
import math
import unittest
from pathlib import Path

import numpy as np

from sky_scatter import scatter

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()
SUN = np.array([-0.990, 0.095, -0.107], dtype=np.float64)
SUN /= np.linalg.norm(SUN)


def _view(elev_deg, toward):
    elevation = math.radians(elev_deg)
    horizontal = np.array([SUN[0], SUN[1], 0.0])
    horizontal /= np.linalg.norm(horizontal)
    direction = horizontal * toward * math.cos(elevation) + np.array([0.0, 0.0, 1.0]) * math.sin(elevation)
    return direction / np.linalg.norm(direction)


class OpeningScatterTests(unittest.TestCase):
    def test_horizon_toward_the_sun_is_red_and_the_zenith_is_blue(self):
        horizon = scatter(_view(1, 1)[None, None, :], SUN)[0, 0]
        zenith = scatter(_view(70, 1)[None, None, :], SUN)[0, 0]
        self.assertGreater(horizon[0], horizon[2])
        self.assertGreater(float(horizon[0]), 0.7)
        self.assertGreater(zenith[2], zenith[0])
        self.assertGreater(float(horizon[0]), float(zenith[0]))

    def test_spawn_stays_clear_and_the_opening_camera_stays(self):
        self.assertIn("QuebecSky::EWeather Weather = QuebecSky::EWeather::Clear;", SKY)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
