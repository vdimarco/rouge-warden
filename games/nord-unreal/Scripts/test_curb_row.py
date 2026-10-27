"""The corner curb is a row of surveyed cars, not one coupe.

The opening camera stays. This does not run Unreal.
"""
import json
import unittest
from pathlib import Path

from curb_row import corner_row

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
SLOTS = json.loads((ROOT / "Data/Plateau/ReplicaGeometry/Streets/parked_cars.json").read_text())["slots"]


class CurbRowTests(unittest.TestCase):
    def test_three_cars_share_the_marie_anne_curb(self):
        row = corner_row(SLOTS)
        self.assertEqual([slot["id"] for slot in row], [1023, 1024, 1025])
        self.assertEqual({slot["street"] for slot in row}, {"Rue Marie-Anne Est"})
        self.assertGreater(len({slot["paint"] for slot in row}), 1)
        self.assertGreater(len({slot["body"] for slot in row}), 1)
        self.assertEqual(row[0]["z"] + 108.0, 115.0)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
