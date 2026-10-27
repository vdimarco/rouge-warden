"""The curb frame holds a walker and a car. The eye and the opening aim stay.

This does not run Unreal.
"""
import json
import math
import unittest
from pathlib import Path

import borne
from passer import CAR_LATERAL_CM, WALKER_LATERAL_CM, WALKER_PHASE, curb_bodies

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
TRAFFIC = (ROOT / "Source/Quebec/QuebecTrafficModel.h").read_text()


def _axes(pitch, yaw):
    sp, cp = math.sin(math.radians(pitch)), math.cos(math.radians(pitch))
    sy, cy = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    return (cp * cy, cp * sy, sp), (-sy, cy, 0.0)


class PasserTests(unittest.TestCase):
    def test_the_walker_and_the_car_are_in_the_curb_frame(self):
        lay = json.loads((ROOT / "Data/LaFontaine/layout.json").read_text())
        road = lay["roads"][borne.ROAD]
        look = borne.curb_look(road)
        bodies = curb_bodies(look, borne._closest(road, borne.BIN))
        self.assertEqual(look["pitch"], -14.0)
        self.assertEqual(borne.EYE_BACK_CM, 420.0)
        self.assertEqual(WALKER_LATERAL_CM, -850.0)
        self.assertEqual(CAR_LATERAL_CM, -145.0)
        self.assertIn("constexpr float CurbLane = 145.f;", TRAFFIC)
        self.assertEqual(WALKER_PHASE, 0.22)
        forward, right = _axes(look["pitch"], look["yaw"])
        eye = look["eye"]
        for point in (bodies["walker"], bodies["car"], borne.BIN, borne.HYDRANT):
            rel = (point[0] - eye[0], point[1] - eye[1], point[2] - eye[2])
            ahead = rel[0] * forward[0] + rel[1] * forward[1] + rel[2] * forward[2]
            side = rel[0] * right[0] + rel[1] * right[1] + rel[2] * right[2]
            self.assertGreater(ahead, 200.0)
            self.assertLess(abs(side / ahead), 0.85)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
