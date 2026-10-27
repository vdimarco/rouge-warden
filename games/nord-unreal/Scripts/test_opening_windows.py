"""Dusk walls can carry warm panes. The opening camera stays."""
import unittest
from pathlib import Path

from dusk_windows import window_grid

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()


class OpeningWindowTests(unittest.TestCase):
    def test_a_long_wall_is_lit_only_after_dusk(self):
        self.assertEqual(window_grid(2000, 1200, True), (7, 4))
        self.assertEqual(window_grid(2000, 1200, False), (0, 0))
        self.assertEqual(window_grid(400, 1200, True), (0, 0))

    def test_the_opening_camera_stays(self):
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)
        self.assertIn("QuebecSky::EWeather Weather = QuebecSky::EWeather::Clear;", SKY)


if __name__ == "__main__":
    unittest.main()
