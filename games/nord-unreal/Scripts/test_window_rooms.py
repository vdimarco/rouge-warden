"""Dusk windows are not one lamp, and a short wall stays blank.

The opening camera stays. This does not run Unreal.
"""
import unittest
from pathlib import Path

from dusk_windows import pane_light, window_grid

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


class WindowRoomTests(unittest.TestCase):
    def test_lit_rooms_are_not_one_colour(self):
        lights = [pane_light(column, row, salt) for salt in range(30) for column in range(6) for row in range(4)]
        dark = [light for light in lights if not light[3]]
        lit = [light[:3] for light in lights if light[3]]
        self.assertGreater(len(dark), 0)
        self.assertGreater(len(lit), len(dark))
        spread = max(max(abs(a - b) for a, b in zip(one, other)) for one in lit for other in lit)
        self.assertGreater(spread, 0.25)
        self.assertEqual(pane_light(2, 1, 14), pane_light(2, 1, 14))
        self.assertEqual(window_grid(402.7, 1121.0, True), (0, 0))
        self.assertEqual(window_grid(2000.0, 1200.0, False), (0, 0))
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
