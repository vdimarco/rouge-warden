"""Soft shadows keep a penumbra, and the game sets the same disk and occlusion.

This does not run Unreal.
"""
import math
import unittest
from pathlib import Path

import numpy as np

from shade_contact import (
    AO_INTENSITY,
    CONTACT_CM,
    SUN_DISK_DEGREES,
    ambient_occlusion,
    capsule_light,
    penumbra_cm,
    shadow_light,
)

ROOT = Path(__file__).resolve().parents[1]
SHADE = (ROOT / "Source/Quebec/QuebecShade.h").read_text()
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


class ShadeContactTests(unittest.TestCase):
    def test_a_pole_throws_a_soft_shadow_and_the_game_uses_the_same_disk(self):
        sun = np.array([-0.2, 0.0, 0.98])
        sun = sun / np.linalg.norm(sun)
        self.assertGreater(penumbra_cm(400.0), penumbra_cm(20.0))
        points = np.array([[0.0, 0.0], [30.0, 0.0], [400.0, 0.0], [2500.0, 0.0]])
        light = capsule_light(points, (0.0, 0.0), 300.0, 25.0, sun)
        self.assertLess(light[0], 0.05)
        self.assertLess(light[1], light[2])
        self.assertGreater(light[3], 0.95)
        square = np.array([[0.0, 0.0], [200.0, 0.0], [200.0, 200.0], [0.0, 200.0]])
        inside = shadow_light(np.array([[100.0, 100.0]]), square, 200.0)
        outside = shadow_light(np.array([[800.0, 100.0]]), square, 200.0)
        self.assertLess(float(inside[0]), 0.05)
        self.assertGreater(float(outside[0]), 0.95)
        depth = np.full((8, 8), 500.0)
        depth[3:5, 3:5] = 100.0
        colour = np.ones((8, 8, 3))
        darkened = ambient_occlusion(colour, depth, radius_px=2)
        self.assertLess(float(darkened[2, 3, 0]), 1.0)
        self.assertEqual(float(darkened[0, 0, 0]), 1.0)
        self.assertIn("inline constexpr float SunDiskDegrees = 3.f;", SHADE)
        self.assertIn("inline constexpr float ContactShadowCm = 45.f;", SHADE)
        self.assertIn("inline constexpr float AmbientOcclusion = 0.65f;", SHADE)
        self.assertAlmostEqual(SUN_DISK_DEGREES, 3.0)
        self.assertAlmostEqual(CONTACT_CM, 45.0)
        self.assertAlmostEqual(AO_INTENSITY, 0.65)
        self.assertIn("Light->SetLightSourceAngle(QuebecShade::SunDiskDegrees);", SKY)
        self.assertIn("Light->ContactShadowLength = QuebecShade::ContactShadowCm;", SKY)
        self.assertIn("Settings.AmbientOcclusionIntensity = QuebecShade::AmbientOcclusion;", GAME)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)
        self.assertGreater(math.tan(math.radians(1.5)) * 400.0, 0.0)


if __name__ == "__main__":
    unittest.main()
