"""A dusk pane is split both ways, and a short wall stays blank.

The opening camera stays. This does not run Unreal.
"""
import unittest
from pathlib import Path

from dusk_windows import GLASS_HALF_ALONG_CM, MULLION_HALF_ALONG_CM, MUNTIN_HALF_UP_CM, window_grid

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


class WindowMullionTests(unittest.TestCase):
    def test_the_upright_bar_matches_the_cross_bar(self):
        self.assertEqual(MULLION_HALF_ALONG_CM, MUNTIN_HALF_UP_CM)
        self.assertLess(MULLION_HALF_ALONG_CM * 2, GLASS_HALF_ALONG_CM)
        self.assertEqual(window_grid(402.7, 1121.0, True), (0, 0))
        self.assertEqual(window_grid(2000.0, 1200.0, False), (0, 0))
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
