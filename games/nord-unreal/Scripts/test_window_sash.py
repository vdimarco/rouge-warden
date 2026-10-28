"""A dusk pane keeps a dark border, and a short wall stays blank.

The opening camera stays. This does not run Unreal.
"""
import unittest
from pathlib import Path

from dusk_windows import sash_box, window_grid

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


class WindowSashTests(unittest.TestCase):
    def test_the_border_is_larger_than_the_glass(self):
        glass_along, glass_up, sash_along, sash_up = sash_box()
        self.assertEqual(glass_along, 36.0)
        self.assertEqual(glass_up, 55.0)
        self.assertGreater(sash_along, glass_along)
        self.assertGreater(sash_up, glass_up)
        self.assertEqual(window_grid(402.7, 1121.0, True), (0, 0))
        self.assertEqual(window_grid(2000.0, 1200.0, False), (0, 0))
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
