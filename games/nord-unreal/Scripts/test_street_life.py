"""Sherbrooke shows lane traffic and sidewalk walkers. The opening aim stays.

This does not run Unreal.
"""
import json
import unittest
from pathlib import Path

from street_life import LANE_CM, SHERBROOKE, sidewalk_cm, street_population

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
TRAFFIC = (ROOT / "Source/Quebec/QuebecTrafficModel.h").read_text()
LAYOUT = json.loads((ROOT / "Data/LaFontaine/layout.json").read_text())


class StreetLifeTests(unittest.TestCase):
    def test_the_avenue_holds_cars_and_walkers(self):
        self.assertIn("inline constexpr float CurbLane = 145.f;", TRAFFIC)
        self.assertIn("RoadSegmentWidths[Road]*.5f+150.f", GAME)
        width = LAYOUT["road_widths"][SHERBROOKE]
        self.assertEqual(width, 1400)
        life = street_population(LAYOUT["roads"][SHERBROOKE], width, LAYOUT["car"])
        self.assertEqual(sidewalk_cm(width), 850.0)
        self.assertEqual({car["lateral"] for car in life["cars"]}, {-LANE_CM, LANE_CM})
        self.assertGreater(len({car["paint"] for car in life["cars"]}), 1)
        sides = {walker["lateral"] for walker in life["walkers"]}
        self.assertEqual(sides, {-850.0, 850.0})
        self.assertEqual(len(life["walkers"]), 3)
        self.assertAlmostEqual(life["yaw"], 77.53080143026988, places=4)
        self.assertEqual(life["pitch"], -12.0)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
