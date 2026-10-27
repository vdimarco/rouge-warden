"""The opening asphalt uses the existing wet-ground material.

The spawn weather stays clear. This checks the wet-ground graph, the puddle
mask, and the splash rings, and that the opening camera was not moved.
"""
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()
ATMOSPHERE = (ROOT / "Scripts/plateau_atmosphere.py").read_text()
PUDDLES = (ROOT / "Scripts/wet_puddles.hlsl").read_text()
SPLASH = (ROOT / "Scripts/rain_splash.hlsl").read_text()


class OpeningWetRoadTests(unittest.TestCase):
    def test_wet_ground_stays_the_existing_material(self):
        self.assertIn("const_b=.5", ATMOSPHERE)
        self.assertIn("const_b=.03", ATMOSPHERE)
        self.assertIn("const_b=1.45", ATMOSPHERE)
        self.assertIn("const_b=.18", ATMOSPHERE)
        self.assertIn("return smoothstep(0.55, 0.7, Noise) * saturate(Puddles);", PUDDLES)
        self.assertIn("float2 Cell = floor(float2(WorldPos.x, WorldPos.y) / 70.0);", SPLASH)
        self.assertIn("float Ring = saturate(1.0 - abs(Dist - Radius) / 3.5);", SPLASH)
        self.assertIn("QuebecSky::EWeather Weather = QuebecSky::EWeather::Clear;", SKY)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
