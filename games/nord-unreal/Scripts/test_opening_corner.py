"""A second camera frames a surveyed street blade and a parked car.

The opening pitch and the walking socket stay. This view is not that camera.
"""
import json
import math
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
GAME = (ROOT / "Source/Quebec/QuebecGameplay.cpp").read_text()
SKY = (ROOT / "Source/Quebec/QuebecSky.cpp").read_text()
SIGN_TEXT = ("Rue Marie-Anne Est", "Rue De Lanaudière")
EYE = np.array([-38481.828, 46277.416, 170.0]) + np.array([-0.178, 0.985, 0.0]) * 140.0
PITCH = 11.75951156159503
YAW = -169.770424853505
W, H = 960, 540


def _axes(pitch, yaw):
    sp, cp = math.sin(math.radians(pitch)), math.cos(math.radians(pitch))
    sy, cy = math.sin(math.radians(yaw)), math.cos(math.radians(yaw))
    forward = np.array((cp * cy, cp * sy, sp))
    right = np.array((-sy, cy, 0.0))
    up = np.array((-sp * cy, -sp * sy, cp))
    return forward, right, up


def _project(points):
    forward, right, up = _axes(PITCH, YAW)
    tan_h = math.tan(math.radians(45))
    tan_v = tan_h * H / W
    out = []
    for point in points:
        rel = np.asarray(point, dtype=np.float64) - EYE
        x, y, z = np.dot(rel, right), np.dot(rel, up), np.dot(rel, forward)
        if z <= 40:
            return None
        out.append(((x / (z * tan_h) * 0.5 + 0.5) * W, (1 - (y / (z * tan_v) * 0.5 + 0.5)) * H))
    return out


class OpeningCornerTests(unittest.TestCase):
    def test_the_blade_and_the_parked_car_fall_inside_the_second_camera(self):
        furniture = json.loads((ROOT / "Data/Plateau/ReplicaGeometry/Furniture/placements.json").read_text())
        sign = next(
            row for row in furniture["placements"]
            if row["prop"] == "sign_street"
            and row["text"]["blade_a"]["full"] == SIGN_TEXT[0]
            and row["text"]["blade_b"]["full"] == SIGN_TEXT[1]
        )
        parked = json.loads((ROOT / "Data/Plateau/ReplicaGeometry/Streets/parked_cars.json").read_text())["slots"]
        sx, sy, sz = sign["position"]
        car = min(parked, key=lambda slot: math.hypot(slot["x"] - sx, slot["y"] - sy))
        self.assertLess(math.hypot(car["x"] - sx, car["y"] - sy), 1500)
        self.assertEqual(car["street"], "Rue Marie-Anne Est")
        yaw = math.radians(sign["yaw"])
        c, s = math.cos(yaw), math.sin(yaw)

        def world(local):
            x, y, z = local
            return (sx + x * c - y * s, sy + x * s + y * c, sz + z)

        blade = [world((0.0, 58.0 + dy, 288.0 + dz)) for dy in (-46, 46) for dz in (-16, 16)]
        cy = math.radians(car["yaw"])
        cc, ss = math.cos(cy), math.sin(cy)
        origin = np.array([car["x"], car["y"], 115.0])
        body = [
            origin + np.array([lx * cc - ly * ss, lx * ss + ly * cc, lz])
            for lx in (-230, 230) for ly in (-90, 90) for lz in (-40, 50)
        ]
        face = _project(blade)
        parked_car = _project(body)
        self.assertIsNotNone(face)
        self.assertIsNotNone(parked_car)
        for points, wide in ((face, 70), (parked_car, 80)):
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            self.assertGreater(min(xs), 0)
            self.assertLess(max(xs), W)
            self.assertGreater(min(ys), 0)
            self.assertLess(max(ys), H)
            self.assertGreater(max(xs) - min(xs), wide)

    def test_the_opening_camera_stays(self):
        self.assertIn("const FRotator Look(-16.f, Yaw, 0.f);", GAME)
        self.assertIn("CameraArm->SocketOffset = FVector(0., 70., 110.);", GAME)
        self.assertIn("QuebecSky::EWeather Weather = QuebecSky::EWeather::Clear;", SKY)


if __name__ == "__main__":
    unittest.main()
