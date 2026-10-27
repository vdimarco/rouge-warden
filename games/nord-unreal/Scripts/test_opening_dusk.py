"""The opening shade can show the sky model's sunset without moving the spawn.

The sunset model stays available. The opening hour is the night clock. This
checks that the sun model, the clear-weather default, and the opening camera stay.
"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()
MODEL = (ROOT / "Source/Quebec/QuebecSkyModel.h").read_text()


class OpeningDuskTests(unittest.TestCase):
    def test_sunset_stays_in_the_model(self):
        self.assertIn("inline FSun SunAt(double Hour, int DayOfYear = 288", MODEL)
        self.assertIn("Directions are (east, north, up)", MODEL)
        self.assertIn("Light.bStreetLamps = Light.NightFactor + .25f * Look.Gloom > .5f;", MODEL)
        self.assertIn("inline constexpr float NightSkyLuminance = .15f;", MODEL)
        self.assertIn("QuebecSky::EWeather Weather = QuebecSky::EWeather::Clear;", SKY)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
