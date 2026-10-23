"""Surveyed lamps along the opening avenue.

The level already instances the park furniture. This checks that a row of
those lamps falls in the opening camera, and that the camera stays put.
"""
import json
import math
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
BUILD = (ROOT / "Scripts/build_park_comic.py").read_text()
SPAWN = np.array([38793.0165416717, -7522.815200551502, 120.0])
REACH = 18000.0


def _project(point):
    pitch, yaw = -16.0, 110.076
    arm, sock_y, sock_z = 420.0, 70.0, 110.0
    sp, cp = math.sin(math.radians(pitch)), math.cos(math.radians(pitch))
    sy, cy = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    forward = np.array((cp * cy, cp * sy, sp))
    right = np.array((-sy, cy, 0.0))
    up = np.array((-sp * cy, -sp * sy, cp))
    cam = SPAWN - arm * forward + sock_y * right + sock_z * up
    view = np.array(point) - cam
    depth = float(np.dot(view, forward))
    tan_h = math.tan(math.radians(45.0))
    tan_v = tan_h * (540.0 / 960.0)
    x = float(np.dot(view, right)) / (depth * tan_h)
    y = float(np.dot(view, up)) / (depth * tan_v)
    return (x + 1.0) * 0.5 * 960.0, (1.0 - y) * 0.5 * 540.0, depth


class OpeningPropTests(unittest.TestCase):
    def test_surveyed_lamps_stand_in_the_opening_shot(self):
        furniture = json.loads((ROOT / "Data/ParkComic/layout.json").read_text())["furniture"]
        lamps = []
        benches = 0
        for item in furniture:
            x, y = item["xy"]
            if math.hypot(x - SPAWN[0], y - SPAWN[1]) > REACH:
                continue
            if item["kind"] == "bench":
                benches += 1
            if item["kind"] != "street_lamp":
                continue
            px, py, depth = _project((x, y, 500.0))
            if depth > 0 and 0 <= px <= 960 and 0 <= py <= 540:
                lamps.append((px, py))
        self.assertGreaterEqual(len(lamps), 8)
        self.assertGreater(benches, 0)
        self.assertLess(min(py for px, py in lamps), 200)
        self.assertIn("part('Cylinder','Ink',(x,y,245),(13,13,490))", BUILD)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
