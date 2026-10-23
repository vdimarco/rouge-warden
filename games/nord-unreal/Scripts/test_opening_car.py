"""The player car in the opening shade is the authored seventies coupe.

ApplyPaint already swaps the constructor box for that mesh. This locks the
profile, the wheel placement, and the camera the shade used.
"""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
HEADER = (ROOT / "Source/Quebec/QuebecGameplay.h").read_text()
CARS = ROOT / "Data/SeventiesCars"


class OpeningCarTests(unittest.TestCase):
    def test_apply_paint_uses_the_fastback_coupe(self):
        manifest = json.loads((CARS / "manifest.json").read_text())
        self.assertEqual(manifest["profiles"][0], "fastback coupe")
        self.assertEqual(manifest["units"], "centimetres; X forward; pivot and wheel centres match existing QuebecCar")
        paint = manifest["paints"][0]
        self.assertAlmostEqual(paint[0], 0.035)
        self.assertAlmostEqual(paint[1], 0.26)
        self.assertAlmostEqual(paint[2], 0.24)
        body = (CARS / "Geometry/Car70Body0.obj").read_text()
        self.assertIn("usemtl Paint", body)
        faces = sum(1 for line in body.splitlines() if line.startswith("f "))
        self.assertGreater(faces, 5000)
        self.assertIn("SM_Car70Body%d", GAME)
        self.assertIn("Car70Cabin%d", GAME)
        self.assertIn("Car70Roof%d", GAME)
        self.assertIn('MeshName = TEXT("Car70Tire")', GAME)
        self.assertIn('MeshName = TEXT("Car70Rim")', GAME)
        self.assertIn("FVector(155., -95., -64.)", GAME)
        self.assertIn("FVector(-155., 95., -64.)", GAME)
        self.assertIn("Location.Y = Location.Y < 0. ? -106.5 : 106.5;", GAME)
        self.assertIn("int32 PaintStyle = 0;", HEADER)
        self.assertIn("int32 BodyProfile = 0;", HEADER)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
