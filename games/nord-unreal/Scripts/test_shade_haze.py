"""Dusk haze thickens with distance, and the game turns shafts on for a low sun.

This does not run Unreal.
"""
import math
import unittest
from pathlib import Path

import numpy as np

from shade_haze import HAZE_DENSITY, SHAFT_BLOOM, SHAFT_ELEVATION, fog_amount, light_shafts, sun_pixel

ROOT = Path(__file__).resolve().parents[1]
HAZE = (ROOT / "Source/Quebec/QuebecHaze.h").read_text()
MISSION = (ROOT / "Source/Quebec/QuebecShade.h").read_text()
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


class ShadeHazeTests(unittest.TestCase):
    def test_distance_hazes_and_a_low_sun_throws_shafts(self):
        near = float(fog_amount(np.array(200.0)))
        far = float(fog_amount(np.array(8000.0)))
        sky = float(fog_amount(np.array(np.inf)))
        self.assertLess(near, 0.1)
        self.assertGreater(far, near + 0.3)
        self.assertEqual(sky, 0.0)
        colour = np.zeros((8, 8, 3))
        mask = np.zeros((8, 8, 1))
        colour[2:5, 3] = (1.0, 0.6, 0.2)
        mask[2:5, 3] = 1.0
        shaft = light_shafts(colour, mask, (3.5, 0.5), samples=8)
        self.assertGreater(float(shaft[6, 3, 0]), float(shaft[6, 0, 0]) + 0.02)
        forward = np.array((1.0, 0.0, 0.0))
        right = np.array((0.0, 1.0, 0.0))
        up = np.array((0.0, 0.0, 1.0))
        pixel = sun_pixel(forward, right, up, np.array((1.0, 0.0, 0.2)), 100, 50, 1.0, 0.5)
        self.assertIsNotNone(pixel)
        self.assertAlmostEqual(pixel[0], 50.0, delta=1.0)
        self.assertIsNone(sun_pixel(forward, right, up, np.array((-1.0, 0.0, 0.0)), 100, 50, 1.0, 0.5))
        self.assertAlmostEqual(HAZE_DENSITY, 0.00015)
        self.assertAlmostEqual(SHAFT_ELEVATION, 8.0)
        self.assertAlmostEqual(SHAFT_BLOOM, 0.4)
        self.assertIn("inline constexpr float ShaftElevationDegrees = 8.f;", HAZE)
        self.assertIn("inline constexpr float ShaftBloomScale = 0.4f;", HAZE)
        self.assertIn("inline constexpr float HazeDensityPerCm = 0.00015f;", HAZE)
        self.assertIn("Light->SetEnableLightShaftBloom(bShafts);", SKY)
        self.assertIn("Light->SetBloomScale(QuebecShade::ShaftBloomScale);", SKY)
        self.assertIn("Haze->SetVolumetricFog(bShafts);", SKY)
        self.assertIn("inline constexpr int StepPocket = 0;", MISSION)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)
        self.assertIn("QuebecSky::EWeather Weather = QuebecSky::EWeather::Clear;", SKY)
        self.assertGreater(math.exp(-HAZE_DENSITY * 200.0), 0.9)


if __name__ == "__main__":
    unittest.main()
