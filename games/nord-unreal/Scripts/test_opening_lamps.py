"""Parked cars take a headlight once the street lamps are on.

Daytime rain still leaves a parked car dark. The opening coupe's lamps fall
in the walk camera. This does not run Unreal.
"""
import json
import math
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
LAYOUT = json.loads((ROOT / "Data/LaFontaine/layout.json").read_text())


def _project(point):
    spawn = np.array(LAYOUT["spawn"], dtype=np.float64)
    pitch, yaw = -16.0, 110.076
    arm, sock_y, sock_z = 420.0, 70.0, 110.0
    sp, cp = math.sin(math.radians(pitch)), math.cos(math.radians(pitch))
    sy, cy = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    forward = np.array((cp * cy, cp * sy, sp))
    right = np.array((-sy, cy, 0.0))
    up = np.array((-sp * cy, -sp * sy, cp))
    cam = spawn - arm * forward + sock_y * right + sock_z * up
    view = np.array(point) - cam
    depth = float(np.dot(view, forward))
    tan_h = math.tan(math.radians(45.0))
    tan_v = tan_h * (540.0 / 960.0)
    x = float(np.dot(view, right)) / (depth * tan_h)
    y = float(np.dot(view, up)) / (depth * tan_v)
    return (x + 1.0) * 0.5 * 960.0, (1.0 - y) * 0.5 * 540.0, depth


class ParkedLampTests(unittest.TestCase):
    def test_a_parked_car_lamps_when_the_street_does(self):
        self.assertIn("It->Occupant || It->bTraffic || Lighting.bStreetLamps", SKY)
        self.assertIn('Part(TEXT("LeftHeadlight"), Cylinder.Object, FVector(222., -58., -20.)', GAME)
        self.assertIn('Part(TEXT("RightHeadlight"), Cylinder.Object, FVector(222., 58., -20.)', GAME)
        self.assertIn('Name.Contains(TEXT("Headlight")) ? TEXT("M_Light")', GAME)
        origin = np.array(LAYOUT["car"], dtype=np.float64)
        yaw = math.radians(LAYOUT["car_yaw"])
        forward = np.array((math.cos(yaw), math.sin(yaw), 0.0))
        right = np.array((-math.sin(yaw), math.cos(yaw), 0.0))
        up = np.array((0.0, 0.0, 1.0))
        for local in ((222.0, -58.0, -20.0), (222.0, 58.0, -20.0)):
            point = origin + local[0] * forward + local[1] * right + local[2] * up
            px, py, depth = _project(point)
            self.assertGreater(depth, 0.0)
            self.assertGreaterEqual(px, 0.0)
            self.assertLessEqual(px, 960.0)
            self.assertGreaterEqual(py, 0.0)
            self.assertLessEqual(py, 540.0)
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)


if __name__ == "__main__":
    unittest.main()
