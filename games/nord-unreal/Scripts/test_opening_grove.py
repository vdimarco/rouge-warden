"""The opening shade includes the surveyed trees that frame that shot.

The level already instances the park inventory. This checks the trees that
sit in the opening camera, and that the camera itself stays put.
"""
import json
import math
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
SPAWN = np.array([38793.0165416717, -7522.815200551502, 120.0])
REACH = 5000.0


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


class OpeningGroveTests(unittest.TestCase):
    def test_surveyed_trees_frame_the_opening_shot(self):
        trees = json.loads((ROOT / "Data/ParkComic/layout.json").read_text())["trees"]
        framed = []
        for tree in trees:
            x, y = tree["xy"]
            if math.hypot(x - SPAWN[0], y - SPAWN[1]) > REACH:
                continue
            px, py, depth = _project((x, y, 0.0))
            if depth > 0 and 0 <= px <= 960 and 0 <= py <= 540:
                framed.append((px, py, tree["height_cm"], tree["crown_radius_cm"]))
        self.assertGreaterEqual(len(framed), 8)
        self.assertTrue(any(px < 220 for px, py, height, radius in framed))
        self.assertTrue(any(px > 720 for px, py, height, radius in framed))
        foreground = [row for row in framed if 400 <= row[0] <= 520 and row[2] > 1400]
        self.assertEqual(len(foreground), 1)
        self.assertGreater(foreground[0][3], 300)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
