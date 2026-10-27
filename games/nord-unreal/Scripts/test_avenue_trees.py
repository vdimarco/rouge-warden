"""The Sherbrooke planting strip continues past the near crowns.

The opening aim stays. This does not run Unreal.
"""
import json
import unittest
from pathlib import Path

from avenue_trees import avenue_trees
from street_life import SHERBROOKE, street_population

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
LAYOUT = json.loads((ROOT / "Data/LaFontaine/layout.json").read_text())
PARK = json.loads((ROOT / "Data/ParkComic/layout.json").read_text())


class AvenueTreeTests(unittest.TestCase):
    def test_the_strip_continues_down_the_avenue(self):
        life = street_population(LAYOUT["roads"][SHERBROOKE], LAYOUT["road_widths"][SHERBROOKE], LAYOUT["car"])
        row = avenue_trees(PARK["trees"], LAYOUT["roads"][SHERBROOKE], LAYOUT["car"], life["eye"])
        self.assertEqual(len(row), 11)
        for tree in row:
            distance = ((tree["xy"][0] - life["eye"][0]) ** 2 + (tree["xy"][1] - life["eye"][1]) ** 2) ** 0.5
            self.assertGreater(distance, 5000.0)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
