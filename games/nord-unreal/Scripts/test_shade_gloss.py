"""Wet asphalt and car paint take a GGX lobe. The game sets the same roughness.

This does not run Unreal.
"""
import unittest
from pathlib import Path

import numpy as np

from shade_gloss import (
    CAR_F0,
    CAR_ROUGHNESS,
    SPECULAR_SCALE,
    WET_F0,
    WET_ROUGHNESS,
    env_weight,
    ggx_direct,
)

ROOT = Path(__file__).resolve().parents[1]
GLOSS = (ROOT / "Source/Quebec/QuebecGloss.h").read_text()
MISSION = (ROOT / "Source/Quebec/QuebecShade.h").read_text()
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
ATMOSPHERE = (ROOT / "Scripts/plateau_atmosphere.py").read_text()


class ShadeGlossTests(unittest.TestCase):
    def test_a_grazing_wet_road_reflects_more_than_a_head_on_panel(self):
        grazing = float(env_weight(WET_ROUGHNESS, 0.06, WET_F0))
        head_on = float(env_weight(CAR_ROUGHNESS, 0.85, CAR_F0))
        self.assertGreater(grazing, 0.4)
        self.assertLess(head_on, 0.08)
        sun = np.array([-0.567, 0.679, 0.466])
        sun = sun / np.linalg.norm(sun)
        view = np.array([-0.132, -0.961, 0.242])
        view = view / np.linalg.norm(view)
        half = sun + view
        half = half / np.linalg.norm(half)
        aligned = float(ggx_direct(half, view, sun, WET_ROUGHNESS, WET_F0))
        away = float(ggx_direct(np.array([1.0, 0.0, 0.0]), view, sun, WET_ROUGHNESS, WET_F0))
        self.assertGreater(aligned, 1.0)
        self.assertLess(away, aligned * 0.05)
        self.assertAlmostEqual(WET_ROUGHNESS, 0.15)
        self.assertAlmostEqual(CAR_ROUGHNESS, 0.22)
        self.assertAlmostEqual(WET_F0, 0.04)
        self.assertAlmostEqual(CAR_F0, 0.04)
        self.assertAlmostEqual(SPECULAR_SCALE, 1.0)
        self.assertIn("inline constexpr float WetRoadRoughness = 0.15f;", GLOSS)
        self.assertIn("inline constexpr float CarPaintRoughness = 0.22f;", GLOSS)
        self.assertIn("inline constexpr float WetRoadF0 = 0.04f;", GLOSS)
        self.assertIn("inline constexpr float CarClearcoatF0 = 0.04f;", GLOSS)
        self.assertIn("inline constexpr float SpecularScale = 1.f;", GLOSS)
        self.assertIn("Light->SetSpecularScale(QuebecShade::SpecularScale);", SKY)
        self.assertIn("Moon->SetSpecularScale(QuebecShade::SpecularScale);", SKY)
        self.assertIn('Coat->SetScalarParameterValue(TEXT("Roughness"), QuebecShade::CarPaintRoughness);', GAME)
        self.assertIn("WET_ROAD_ROUGHNESS = 0.15", ATMOSPHERE)
        self.assertIn("inline constexpr int StepPocket = 0;", MISSION)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
