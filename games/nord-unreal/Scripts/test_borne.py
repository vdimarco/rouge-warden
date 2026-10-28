"""A bag pile and a hydrant sit inside the curb frame. The opening aim stays.

This does not run Unreal.
"""
import json
import math
import unittest
from pathlib import Path

from borne import BIN, HYDRANT, ROAD, curb_look

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()


def _axes(pitch, yaw):
    sp, cp = math.sin(math.radians(pitch)), math.cos(math.radians(pitch))
    sy, cy = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    forward = (cp * cy, cp * sy, sp)
    right = (-sy, cy, 0.0)
    up = (-sp * cy, -sp * sy, cp)
    return forward, right, up


class BorneTests(unittest.TestCase):
    def test_the_pair_is_surveyed_and_in_frame(self):
        furniture = json.loads((ROOT / "Data/Plateau/ReplicaGeometry/Furniture/placements.json").read_text())
        found = {("bin_garbage", BIN[:2]), ("hydrant", HYDRANT[:2])}
        seen = set()
        for item in furniture["placements"]:
            if item["prop"] not in ("bin_garbage", "hydrant"):
                continue
            for kind, point in found:
                if item["prop"] == kind and math.hypot(item["position"][0] - point[0], item["position"][1] - point[1]) < 1.0:
                    seen.add((kind, point))
        self.assertEqual(seen, found)
        apart = math.hypot(BIN[0] - HYDRANT[0], BIN[1] - HYDRANT[1])
        self.assertLess(apart, 500.0)
        lay = json.loads((ROOT / "Data/LaFontaine/layout.json").read_text())
        look = curb_look(lay["roads"][ROAD])
        self.assertEqual(look["pitch"], -14.0)
        self.assertGreater(lay["road_widths"][ROAD], 900.0)
        forward, right, _up = _axes(look["pitch"], look["yaw"])
        eye = look["eye"]
        for point, height in ((BIN, 40.0), (HYDRANT, 50.0)):
            rel = (point[0] - eye[0], point[1] - eye[1], height - eye[2])
            ahead = rel[0] * forward[0] + rel[1] * forward[1] + rel[2] * forward[2]
            side = rel[0] * right[0] + rel[1] * right[1] + rel[2] * right[2]
            self.assertGreater(ahead, 80.0)
            self.assertLess(ahead, 1200.0)
            self.assertLess(abs(side / ahead), 0.85)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
