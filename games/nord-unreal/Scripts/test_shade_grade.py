"""The dusk picture takes a filmic curve, and the view sets the same grade.

This does not run Unreal.
"""
import unittest
from pathlib import Path

import numpy as np

from shade_grade import GAIN, OFFSET, TONE_CURVE, aces

ROOT = Path(__file__).resolve().parents[1]
GRADE = (ROOT / "Source/Quebec/QuebecGrade.h").read_text()
MISSION = (ROOT / "Source/Quebec/QuebecShade.h").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


class ShadeGradeTests(unittest.TestCase):
    def test_the_curve_shoulders_highlights_and_lifts_the_dusk(self):
        black = aces(np.zeros(3))
        mid = aces(np.array((0.18, 0.18, 0.18)))
        hot = aces(np.ones(3))
        self.assertGreater(float(black[0]), float(black[2]))
        self.assertGreater(float(mid[0]), 0.18)
        self.assertLess(float(hot[0]), 0.95)
        self.assertAlmostEqual(TONE_CURVE, 1.0)
        self.assertTrue(np.allclose(GAIN, (1.06, 1.02, 0.94)))
        self.assertTrue(np.allclose(OFFSET, (0.012, 0.008, 0.004)))
        self.assertIn("inline constexpr float ToneCurveAmount = 1.f;", GRADE)
        self.assertIn("inline constexpr float GradeGainR = 1.06f;", GRADE)
        self.assertIn("inline constexpr float GradeOffsetB = 0.004f;", GRADE)
        self.assertIn("Settings.ToneCurveAmount = QuebecShade::ToneCurveAmount;", GAME)
        self.assertIn("Settings.ColorGain = FVector4(QuebecShade::GradeGainR, QuebecShade::GradeGainG, QuebecShade::GradeGainB, 1.f);", GAME)
        self.assertIn("Settings.ColorOffset = FVector4(QuebecShade::GradeOffsetR, QuebecShade::GradeOffsetG, QuebecShade::GradeOffsetB, 0.f);", GAME)
        self.assertIn("inline constexpr int StepPocket = 0;", MISSION)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
