"""The Marie-Anne blades hang on the wooden utility pole, not a grey post.

The opening camera stays. This does not run Unreal.
"""
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


class WoodPoleTests(unittest.TestCase):
    def test_the_corner_blades_use_the_wood_pole(self):
        furniture = json.loads((ROOT / "Data/Plateau/ReplicaGeometry/Furniture/placements.json").read_text())
        rows = furniture["placements"]
        pole = next(item for item in rows if item.get("city_pole") == "13707" and item["prop"] == "utility_pole")
        sign = next(item for item in rows if item.get("city_pole") == "13707" and item["prop"] == "sign_street")
        self.assertEqual(pole["pole_kind"], "wood")
        self.assertEqual(pole["position"], [-38893.9, 46509.5, 18.0])
        self.assertEqual(sign["without"], ["post"])
        self.assertIn("(0, 1053)", (ROOT / "Scripts/blender/plateau_props.py").read_text())
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
